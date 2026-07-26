import { basicSetup, EditorView } from "codemirror";
import { Compartment, EditorState } from "@codemirror/state";
import { diagnosticCount, lintGutter } from "@codemirror/lint";
import { h, render } from "preact";
import type { ComponentChildren } from "preact";
import { signal } from "@preact/signals";
import type { GameVariant, InitResponse } from "@creatures-codemirror/engine";
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
import { VariantChangePrompt } from "./variant-change-prompt.js";
import { CaosPanel } from "./panel.js";
import { FileBrowser } from "./files/FileBrowser.js";
import { checkNameConflict, createFile, changeFileVariant, getFile, type CaosFile } from "./storage/files.js";
import {
  changeProjectVariant,
  getEffectiveVariant,
  getProject,
  sweepExpiredTrash,
  type CaosProject,
} from "./storage/projects.js";
import { kvGet, kvSet } from "./storage/db.js";
import { createAutosaveController, fileLoadAnnotation, LAST_OPENED_FILE_ID_KEY } from "./autosave.js";

const GLOBAL_FALLBACK_VARIANT_KEY = "globalFallbackVariant";
const DEFAULT_VARIANT: GameVariant = "DS";
// Only used to detect a cold, fully-offline first-ever visit (SW has nothing
// cached yet, so the engine Worker's module fetch never resolves) -- long
// enough that a real cache hit (near-instant, no network involved) never
// trips it, per ../../plan-webapp/05-offline-pwa.md.
const OFFLINE_ENGINE_LOAD_TIMEOUT_MS = 5000;

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

/**
 * Resolves the boot-time file/variant per
 * `../../plan-webapp/04-variant-persistence-autosave.md`'s boot sequence:
 * restore `kv.lastOpenedFileId` if it still points at a live row (trashed is
 * fine, hard-deleted is not — `getFile` returns `null` for that), else fall
 * back to `kv.globalFallbackVariant` (or a hardcoded default) and create a
 * fresh root-scope draft.
 */
async function resolveBootFile(): Promise<{ file: CaosFile; project: CaosProject | null; variant: GameVariant }> {
  const lastOpenedFileId = await kvGet<string>(LAST_OPENED_FILE_ID_KEY);
  if (lastOpenedFileId) {
    const file = await getFile(lastOpenedFileId);
    if (file) {
      const project = file.parentProjectId === null ? null : await getProject(file.parentProjectId);
      const variant = getEffectiveVariant(file, project);
      return { file, project, variant };
    }
  }

  const fallbackVariant = (await kvGet<GameVariant>(GLOBAL_FALLBACK_VARIANT_KEY)) ?? DEFAULT_VARIANT;
  let name = "Untitled";
  let n = 2;
  while (await checkNameConflict(null, name)) {
    name = `Untitled (${n})`;
    n += 1;
  }
  const file = await createFile({ name, parentProjectId: null, variant: fallbackVariant, text: "" });
  return { file, project: null, variant: fallbackVariant };
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && "onLine" in navigator && navigator.onLine === false;
}

/**
 * Races `client.init()` against a timeout, but only when the browser reports
 * offline -- an online load (even a slow one) keeps waiting on the real
 * init() promise indefinitely, unchanged from prior behavior. Distinct from
 * the "first-interaction" tap-to-load affordance: that assumes the bundle is
 * reachable, this is for when it provably isn't (a cold offline first visit,
 * before the service worker has cached anything).
 */
async function initEngineOrShowOfflineState(
  client: CaosEngineClient,
  editorContainer: HTMLDivElement,
): Promise<InitResponse | null> {
  const initPromise = client.init();
  if (!isOffline()) return initPromise;

  const timedOut = Symbol("timed out");
  const result = await Promise.race([
    initPromise,
    new Promise<typeof timedOut>((resolve) => setTimeout(() => resolve(timedOut), OFFLINE_ENGINE_LOAD_TIMEOUT_MS)),
  ]);
  if (result !== timedOut) return result;

  log("Offline and the CAOS engine hasn't been cached on this device yet -- can't load.");
  editorContainer.textContent =
    "You're offline, and this editor hasn't finished its first online load yet, so it can't start. " +
    "Connect to the internet once and reload — after that it will keep working offline.";
  return null;
}

async function main(): Promise<void> {
  if (!editorParent) throw new Error("Shell did not mount an editor container");
  const editorContainer = editorParent;

  // Not a background timer — run once per boot, per
  // ../../plan-webapp/00-risks-and-open-questions.md's trash-retention note.
  await sweepExpiredTrash();

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

  const initResult = await initEngineOrShowOfflineState(client, editorContainer);
  if (!initResult) return; // offline-blocked; explicit state is already showing.
  // Re-bound with an explicit non-nullable type: TS's control-flow narrowing
  // from the guard above doesn't reach the nested closures below that
  // reference this value (buildAnalysisExtensions, rebuildSheetBody).
  const initResponse: InitResponse = initResult;
  editorContainer.textContent = "";
  log("init() ->", initResponse);

  const boot = await resolveBootFile();
  let activeFile: CaosFile = boot.file;
  let activeProject: CaosProject | null = boot.project;
  let currentVariant: GameVariant = boot.variant;
  await client.setVariant(currentVariant);
  log(`setVariant('${currentVariant}') -> ok (restored file "${activeFile.name}")`);

  const autosave = createAutosaveController({
    onError: (err) => log("Autosave FAILED:", err instanceof Error ? err.message : String(err)),
  });

  // Prompt state for "just this file" vs "whole project" on a project file's
  // variant change; `null` when no prompt is showing. Plain closure state
  // (not a signal) — resolved the same imperative way `currentVariant` is,
  // via `rebuildSheetBody()`.
  let pendingVariantPrompt: { variant: GameVariant } | null = null;

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
      doc: activeFile.text,
      extensions: [
        basicSetup,
        caosLanguageSupport(),
        analysisCompartment.of(buildAnalysisExtensions()),
        mobileHoverTrigger(),
        mobileViewport(),
        touchTheme,
        completionTrigger(),
        autosave.extension,
        EditorView.updateListener.of((update) => {
          diagnosticsCount.value = diagnosticCount(update.state);
        }),
      ],
    }),
    parent: editorContainer,
  });

  await autosave.openFile(activeFile.id);

  async function applyVariantToEditor(variant: GameVariant): Promise<void> {
    currentVariant = variant;
    log(`Variant changed to ${variant} — re-validating.`);
    await client.setVariant(variant);
    view.dispatch({ effects: analysisCompartment.reconfigure(buildAnalysisExtensions()) });
  }

  async function applyFileOnlyVariantChange(variant: GameVariant): Promise<void> {
    const updated = await changeFileVariant(activeFile.id, variant);
    activeFile = updated;
    if (updated.parentProjectId === null) {
      // Root files have no project to attach the choice to — treat it as the
      // new standalone/global default for the next fallback draft too.
      await kvSet(GLOBAL_FALLBACK_VARIANT_KEY, variant);
    }
    pendingVariantPrompt = null;
    await applyVariantToEditor(variant);
    rebuildSheetBody();
  }

  async function applyWholeProjectVariantChange(variant: GameVariant): Promise<void> {
    if (!activeProject) return;
    activeProject = await changeProjectVariant(activeProject.id, variant);
    pendingVariantPrompt = null;
    // The active file may itself carry an explicit override that this
    // project-wide change doesn't touch (only `variant: null` siblings
    // inherit it) — re-resolve rather than assuming `variant` now applies to
    // the open document, so the picker/live validation don't drift from what
    // a reload would actually restore for this file.
    await applyVariantToEditor(getEffectiveVariant(activeFile, activeProject));
    rebuildSheetBody();
  }

  function cancelVariantChange(): void {
    pendingVariantPrompt = null;
    // Re-sync VariantPicker's <select> back to `currentVariant`, undoing the
    // browser's already-applied (but not yet confirmed) native selection.
    rebuildSheetBody();
  }

  function requestVariantChange(variant: GameVariant): void {
    if (variant === currentVariant) return;
    if (activeFile.parentProjectId === null || activeProject === null) {
      void applyFileOnlyVariantChange(variant);
      return;
    }
    pendingVariantPrompt = { variant };
    rebuildSheetBody();
  }

  // Reassigning `sheetBody.value` re-renders Shell's `{sheetBody.value}` slot, but
  // Preact's positional reconciliation preserves each child component's own
  // internal state (FileBrowser's browsing state, CaosPanel's checkboxes) across
  // the reassignment — only needed here because a programmatic variant change
  // (opening a file with a different effective variant, or resolving the
  // file/project prompt) has to force VariantPicker's <select> to a new
  // value, unlike a user-driven picker change.
  function rebuildSheetBody(): void {
    sheetBody.value = h(
      "div",
      null,
      h(FileBrowser, {
        getEditorText: () => view.state.doc.toString(),
        onFileOpened: (file, effectiveVariant) => {
          void (async () => {
            // Flush the outgoing file's pending edits (autosave reads the
            // editor's *current* text, so this must happen before the doc is
            // replaced below) then switch autosave tracking to the new file.
            await autosave.openFile(file.id);
            view.dispatch({
              changes: { from: 0, to: view.state.doc.length, insert: file.text },
              annotations: fileLoadAnnotation,
            });
            activeFile = file;
            activeProject = file.parentProjectId === null ? null : await getProject(file.parentProjectId);
            pendingVariantPrompt = null;
            log(`Opened file "${file.name}".`);
            if (effectiveVariant !== currentVariant) {
              await applyVariantToEditor(effectiveVariant);
            }
            rebuildSheetBody();
          })();
        },
      }),
      h(VariantPicker, {
        initialVariant: currentVariant,
        onChange: requestVariantChange,
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
      pendingVariantPrompt &&
        activeProject &&
        h(VariantChangePrompt, {
          fileName: activeFile.name,
          projectName: activeProject.name,
          variant: pendingVariantPrompt.variant,
          onFileOnly: () => void applyFileOnlyVariantChange(pendingVariantPrompt!.variant),
          onWholeProject: () => void applyWholeProjectVariantChange(pendingVariantPrompt!.variant),
          onCancel: cancelVariantChange,
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
