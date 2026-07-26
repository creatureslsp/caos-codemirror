import { basicSetup, EditorView } from "codemirror";
import { Compartment, EditorState } from "@codemirror/state";
import { diagnosticCount, lintGutter } from "@codemirror/lint";
import { h, render } from "preact";
import type { ComponentChildren } from "preact";
import { signal } from "@preact/signals";
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
import { Shell } from "./shell.js";
import { VariantPicker } from "./variant-picker.js";
import { CaosPanel } from "./panel.js";
import { FileBrowser } from "./files/FileBrowser.js";

import empty from "../fixtures/empty.cos?raw";

const FIXTURES: Record<string, string> = {
  "new.cos": empty
};
const DEFAULT_FIXTURE = "new.cos";

let logEl: HTMLDivElement | null = null;

function log(...args: unknown[]): void {
  console.log(...args);
  if (!logEl) return;
  const line = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a, null, 2)))
    .join(" ");
  logEl.textContent += line + "\n";
}

const appQuery = document.querySelector<HTMLDivElement>("#app");
if (!appQuery) throw new Error("#app element missing");
const app = appQuery;

let editorParent: HTMLDivElement | null = null;
const sheetBody = signal<ComponentChildren>(null);

render(
  h(Shell, {
    editorContainerRef: (node) => {
      editorParent = node;
    },
    sheetBody,
  }),
  app,
);

logEl = document.querySelector<HTMLDivElement>("#log");

async function main(): Promise<void> {
  if (!editorParent) throw new Error("Shell did not mount an editor container");
  const editorContainer = editorParent;

  const timing = chooseEngineLoadTiming();
  log(`Engine load timing chosen: "${timing}" (device/network heuristic).`);
  if (timing === "first-interaction") {
    editorContainer.textContent = "Tap/click here to load the CAOS engine and editor…";
  }
  const client = await scheduleEngineLoad(
    () =>
      new CaosEngineClient({
        onUnexpectedError: (err) => log("Worker error:", err instanceof Error ? err.message : String(err)),
      }),
    { timing, interactionTarget: editorContainer },
  );
  log("CaosEngineClient constructed.");
  editorContainer.textContent = "";

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

  const diagnosticsCount = signal(0);

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
          diagnosticsCount.value = diagnosticCount(update.state);
        }),
      ],
    }),
    parent: editorContainer,
  });

  // Reassigning `sheetBody.value` re-renders Shell's `{sheetBody.value}` slot, but
  // Preact's positional reconciliation preserves each child component's own
  // internal state (FileBrowser's browsing state, CaosPanel's checkboxes) across
  // the reassignment — only needed here because a programmatic variant change
  // (opening a file with a different effective variant) has to force
  // VariantPicker's <select> to a new value, unlike a user-driven picker change.
  function rebuildSheetBody(): void {
    sheetBody.value = h(
      "div",
      null,
      h(FileBrowser, {
        getEditorText: () => view.state.doc.toString(),
        onFileOpened: (file, effectiveVariant) => {
          view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: file.text } });
          log(`Opened file "${file.name}".`);
          if (effectiveVariant !== currentVariant) {
            currentVariant = effectiveVariant;
            log(`Variant changed to ${effectiveVariant} (from opened file) — re-validating.`);
            void client.setVariant(currentVariant).then(() => {
              view.dispatch({ effects: analysisCompartment.reconfigure(buildAnalysisExtensions()) });
            });
            rebuildSheetBody();
          }
        },
      }),
      h(VariantPicker, {
        initialVariant: currentVariant,
        onChange: (variant) => {
          currentVariant = variant;
          log(`Variant changed to ${variant} — re-validating.`);
          void client.setVariant(variant).then(() => {
            view.dispatch({ effects: analysisCompartment.reconfigure(buildAnalysisExtensions()) });
          });
        },
      }),
      h(CaosPanel, {
        inlayHintOptionIds: initResponse.inlayHintOptions,
        initialInlayHintOptions: DEFAULT_INLAY_HINT_OPTIONS,
        diagnosticsCount,
        onInlayHintOptionsChange: (options: InlayHintOptions) => {
          view.dispatch({ effects: setInlayHintOptions.of(options) });
          log("Inlay hint options changed:", options);
        },
      }),
    );
  }

  rebuildSheetBody();

  diagnosticsCount.value = diagnosticCount(view.state);

  log("Editor initialized.");
}

main().catch((err) => {
  log("Demo setup FAILED:", err instanceof Error ? err.message : String(err));
});
