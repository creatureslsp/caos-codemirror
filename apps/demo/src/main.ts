import { basicSetup, EditorView } from "codemirror";
import { Compartment, EditorState } from "@codemirror/state";
import { diagnosticCount, lintGutter } from "@codemirror/lint";
import type { GameVariant } from "@creatures-codemirror/engine";
import { CaosEngineClient, chooseEngineLoadTiming, scheduleEngineLoad } from "@creatures-codemirror/engine";
import {
  caosCompletion,
  caosHoverTooltip,
  caosLanguageSupport,
  caosLinter,
  completionTrigger,
  DEFAULT_INLAY_HINT_OPTIONS,
  inlayHints,
  inlayHintTheme,
  mobileHoverTrigger,
  mobileViewport,
  semanticTokens,
  semanticTokensTheme,
  setInlayHintOptions,
  touchTheme,
  type InlayHintOptions,
} from "@creatures-codemirror/editor";
import { createVariantPicker } from "./variant-picker.js";
import { createCaosPanel } from "./panel.js";

import goldenPath from "../fixtures/golden-path.cos?raw";
import bitflagHeavy from "../fixtures/bitflag-heavy.cos?raw";
import broken from "../fixtures/broken.cos?raw";
import caos2prayHeader from "../fixtures/caos2pray-header.cos?raw";
import c1eStrings from "../fixtures/c1e-strings.cos?raw";
import empty from "../fixtures/empty.cos?raw";
import stressTest from "../fixtures/stress-test.cos?raw";

const FIXTURES: Record<string, string> = {
  "golden-path.cos": goldenPath,
  "bitflag-heavy.cos": bitflagHeavy,
  "broken.cos": broken,
  "caos2pray-header.cos": caos2prayHeader,
  "c1e-strings.cos": c1eStrings,
  "empty.cos": empty,
  "stress-test.cos": stressTest,
};
const DEFAULT_FIXTURE = "golden-path.cos";

const logElQuery = document.querySelector<HTMLDivElement>("#log");
if (!logElQuery) throw new Error("#log element missing");
// Re-bound so the closure below sees a statically non-null type — narrowing
// from the guard above doesn't cross a function-declaration boundary.
const logEl = logElQuery;

function log(...args: unknown[]): void {
  console.log(...args);
  const line = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a, null, 2)))
    .join(" ");
  logEl.textContent += line + "\n";
}

const editorParentQuery = document.querySelector<HTMLDivElement>("#editor");
if (!editorParentQuery) throw new Error("#editor element missing");
const editorParent = editorParentQuery;

const sidebarQuery = document.querySelector<HTMLDivElement>("#sidebar");
if (!sidebarQuery) throw new Error("#sidebar element missing");
const sidebar = sidebarQuery;

const toolbarQuery = document.querySelector<HTMLDivElement>("#toolbar");
if (!toolbarQuery) throw new Error("#toolbar element missing");
const toolbar = toolbarQuery;

async function main(): Promise<void> {
  const timing = chooseEngineLoadTiming();
  log(`Engine load timing chosen: "${timing}" (device/network heuristic).`);
  if (timing === "first-interaction") {
    editorParent.textContent = "Tap/click here to load the CAOS engine and editor…";
  }
  const client = await scheduleEngineLoad(
    () =>
      new CaosEngineClient({
        onUnexpectedError: (err) => log("Worker error:", err instanceof Error ? err.message : String(err)),
      }),
    { timing, interactionTarget: editorParent },
  );
  log("CaosEngineClient constructed.");
  editorParent.textContent = "";

  const initResponse = await client.init();
  log("init() ->", initResponse);

  let currentVariant: GameVariant = "DS";
  await client.setVariant(currentVariant);
  log(`setVariant('${currentVariant}') -> ok`);

  // Compartment allowing dynamic reconfiguration on variant switch
  const analysisCompartment = new Compartment();

  function buildAnalysisExtensions() {
    return [
      semanticTokens({
        client,
        legend: initResponse.semanticTokensLegend,
        getVariant: () => currentVariant,
        debounceMs: 200,
      }),
      semanticTokensTheme,
      caosLinter({ client, getVariant: () => currentVariant }),
      lintGutter(),
      caosCompletion({ client, getVariant: () => currentVariant }),
      caosHoverTooltip({ client, getVariant: () => currentVariant }),
      inlayHints({ client, getVariant: () => currentVariant }),
      inlayHintTheme,
    ];
  }

  const panel = createCaosPanel({
    inlayHintOptionIds: initResponse.inlayHintOptions,
    initialInlayHintOptions: DEFAULT_INLAY_HINT_OPTIONS,
    onInlayHintOptionsChange: (options: InlayHintOptions) => {
      view.dispatch({ effects: setInlayHintOptions.of(options) });
      log("Inlay hint options changed:", options);
    },
  });
  sidebar.appendChild(panel.dom);

  const view = new EditorView({
    state: EditorState.create({
      doc: FIXTURES[DEFAULT_FIXTURE],
      extensions: [
        basicSetup,
        caosLanguageSupport(),
        analysisCompartment.of(buildAnalysisExtensions()),
        mobileHoverTrigger(),
        mobileViewport(),
        touchTheme,
        completionTrigger(),
        EditorView.updateListener.of((update) => {
          panel.setDiagnosticsCount(diagnosticCount(update.state));
        }),
      ],
    }),
    parent: editorParent,
  });

  const variantLabel = document.createElement("label");
  variantLabel.textContent = "Variant: ";
  const variantPicker = createVariantPicker({
    initialVariant: currentVariant,
    onChange: (variant) => {
      currentVariant = variant;
      log(`Variant changed to ${variant} — re-validating/re-hinting/re-completing.`);
      void client.setVariant(variant).then(() => {
        view.dispatch({ effects: analysisCompartment.reconfigure(buildAnalysisExtensions()) });
      });
    },
  });
  variantLabel.appendChild(variantPicker);
  toolbar.appendChild(variantLabel);

  const fixtureLabel = document.createElement("label");
  fixtureLabel.textContent = "Fixture: ";
  const fixturePicker = document.createElement("select");
  fixturePicker.id = "fixture-picker";
  for (const name of Object.keys(FIXTURES)) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    option.selected = name === DEFAULT_FIXTURE;
    fixturePicker.appendChild(option);
  }
  fixturePicker.addEventListener("change", () => {
    const text = FIXTURES[fixturePicker.value] ?? "";
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
    });
    log(`Loaded fixture: ${fixturePicker.value}`);
  });
  fixtureLabel.appendChild(fixturePicker);
  toolbar.appendChild(fixtureLabel);

  panel.setDiagnosticsCount(diagnosticCount(view.state));

  log("Editor initialized.");
}

main().catch((err) => {
  log("Demo setup FAILED:", err instanceof Error ? err.message : String(err));
});
