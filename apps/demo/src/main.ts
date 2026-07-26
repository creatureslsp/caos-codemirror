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
  // plan/06-mobile-ux-and-performance.md: on a measurably slow connection
  // or low-end device, defer constructing CaosEngineClient (and so
  // fetching the ~549KB worker bundle behind it) until idle or first
  // interaction with #editor, instead of competing with initial page load.
  // No signal available at all (most desktop browsers) resolves to
  // "immediate" — see bundle-strategy.ts's chooseEngineLoadTiming.
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

  // plan/07: switching variants must re-validate/re-hint/re-complete
  // without recreating the whole EditorView. All variant-dependent
  // extensions live in this one Compartment; a variant change
  // reconfigures it with fresh plugin instances (each ViewPlugin class is
  // freshly defined by these factory calls, so CM6 tears down and
  // reconstructs rather than reusing stale state), which also makes each
  // plugin's constructor fire its own immediate/near-immediate analysis
  // request instead of waiting out a debounce meant for keystrokes.
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

  // Created before the EditorView below since its updateListener extension
  // closes over `panel` — defining it first avoids relying on the panel's
  // first real invocation happening on a later tick.
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
        // Phase 6: touch/pen-only hover trigger (mouse hover above is
        // untouched by this), keyboard-aware viewport handling, larger
        // touch targets, and a manual completion-trigger button (there's
        // no Ctrl+Space on a touch keyboard).
        mobileHoverTrigger(),
        mobileViewport(),
        touchTheme,
        completionTrigger(),
        // diagnosticCount(state) is a cheap StateField read (not a
        // recomputation), so no need to gate this on which transaction
        // fired — every update (including the async setDiagnosticsEffect
        // dispatch @codemirror/lint's own linter() issues) should refresh
        // the panel's count.
        EditorView.updateListener.of((update) => {
          panel.setDiagnosticsCount(diagnosticCount(update.state));
        }),
      ],
    }),
    parent: editorParent,
  });

  // --- Toolbar: variant picker + fixture picker ---
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

  log("Editor constructed with Layer 1 (StreamLanguage) + Layer 2 (semantic overlay) + diagnostics + autocomplete + hover/inlay hints wired up.");
  log("Use the Variant/Fixture selectors above the editor to exercise plan/07's checklist scenarios.");
  log("On a touch device: tap a command name to see hover docs, tap the 'Suggest' button below the editor to trigger completion, and open the on-screen keyboard to confirm the editor/tooltips stay above it.");
  log("See apps/demo/bench/ for the fullAnalysis latency benchmark harness (plan/06-mobile-ux-and-performance.md verification item 4).");
  log("See apps/demo/TEST-CHECKLIST.md for the full manual verification checklist (plan/07-demo-app-and-verification.md).");
}

main().catch((err) => {
  log("Demo setup FAILED:", err instanceof Error ? err.message : String(err));
});
