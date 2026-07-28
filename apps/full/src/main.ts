import { basicSetup, EditorView } from "codemirror";
import { Compartment, EditorState } from "@codemirror/state";
import { diagnosticCount, lintGutter } from "@codemirror/lint";
import { h, render } from "preact";
import type { ComponentChildren } from "preact";
import { effect, signal } from "@preact/signals";
import type { GameVariant, InitResponse } from "@creatures-codemirror/engine";
import { CaosEngineClient, chooseEngineLoadTiming, scheduleEngineLoad } from "@creatures-codemirror/engine";
import {
  caosCompletion,
  caosHoverTooltip,
  caosLanguageSupport,
  caosLinter,
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
import { SettingsPanel } from "./settings/SettingsPanel.js";
import { InlayHintsTab } from "./settings/InlayHintsTab.js";
import { ThemeTab } from "./settings/ThemeTab.js";
import { SETTINGS_TABS } from "./settings/tabs.js";
import { FileBrowser } from "./files/FileBrowser.js";
import { Header } from "./header/Header.js";
import { changeFileVariant, type CaosFile } from "./storage/files.js";
import {
  changeProjectVariant,
  getEffectiveVariant,
  getProject,
  sweepExpiredTrash,
  type CaosProject,
} from "./storage/projects.js";
import { kvSet } from "./storage/db.js";
import { createAutosaveController, fileLoadAnnotation, LAST_OPENED_FILE_ID_KEY } from "./autosave.js";
import { effectiveMode, loadThemeStore } from "./theming/theme-store.js";
import { startApplyingDisplayMode, startApplyingTheme } from "./theming/apply-theme.js";
import {
  activeFile as activeFileSignal,
  activeProject as activeProjectSignal,
  currentVariant as currentVariantSignal,
  pendingVariantPrompt as pendingVariantPromptSignal,
} from "./files/active-file-store.js";
import { loadBrowsingProjectId } from "./files/browsing-state.js";
import { createFallbackDraft, GLOBAL_FALLBACK_VARIANT_KEY, resolveBootFile } from "./boot-file.js";

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
const filesBody = signal<ComponentChildren>(null);
const settingsBody = signal<ComponentChildren>(null);
const headerBody = signal<ComponentChildren>(null);

render(
  h(Shell, {
    editorContainerRef: (node) => {
      editorParent = node;
    },
    filesBody,
    settingsBody,
    headerBody,
  }),
  app,
);

logEl = document.querySelector<HTMLDivElement>("#log");

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

  // Hydrates the shared "which project am I browsing" signal (FileBrowser's
  // project chips, Header's FileSelectPopover) from kv so it survives reload.
  await loadBrowsingProjectId();

  // Hydrate themeMode/themeOverrides from kv and start the live
  // prefers-color-scheme listener before anything paints, then start
  // reactively applying overrides as --caos-* custom properties on the
  // document root (ancestor of the editor DOM) per
  // ../../plan-webapp/07-theming-data-model-dark-light.md, and the
  // app-shell-wide data-theme attribute (index.html's own light/dark CSS,
  // outside the --caos-* token system entirely) alongside it.
  await loadThemeStore();
  startApplyingTheme();
  startApplyingDisplayMode();

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
  // reference this value (buildAnalysisExtensions, rebuildFilesBody).
  const initResponse: InitResponse = initResult;
  editorContainer.textContent = "";
  log("init() ->", initResponse);

  const boot = await resolveBootFile(LAST_OPENED_FILE_ID_KEY);
  let activeFile: CaosFile = boot.file;
  let activeProject: CaosProject | null = boot.project;
  let currentVariant: GameVariant = boot.variant;
  activeFileSignal.value = activeFile;
  activeProjectSignal.value = activeProject;
  currentVariantSignal.value = currentVariant;
  // Keeps the shared signals (Header, FileBrowser row highlighting) in sync
  // with this closure's own `activeFile`/`activeProject` -- every assignment
  // to either below goes through these instead of a bare `=`.
  function setActiveFile(file: CaosFile): void {
    activeFile = file;
    activeFileSignal.value = file;
  }
  function setActiveProject(project: CaosProject | null): void {
    activeProject = project;
    activeProjectSignal.value = project;
  }
  await client.setVariant(currentVariant);
  log(`setVariant('${currentVariant}') -> ok (restored file "${activeFile.name}")`);

  const autosave = createAutosaveController({
    onError: (err) => log("Autosave FAILED:", err instanceof Error ? err.message : String(err)),
  });


  // Compartment allowing dynamic reconfiguration on variant switch
  const analysisCompartment = new Compartment();

  // Compartment toggling CM6's dark-mode marker extension -- an otherwise
  // style-less `EditorView.theme({}, { dark: true })` that activates every
  // `&dark` selector across the four packages/editor base themes. Reused
  // for both live system-preference changes and an explicit mode pick, per
  // ../../plan-webapp/07-theming-data-model-dark-light.md.
  const darkModeCompartment = new Compartment();
  function darkModeExtension() {
    return effectiveMode.value === "dark" ? EditorView.theme({}, { dark: true }) : [];
  }

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
        darkModeCompartment.of(darkModeExtension()),
        mobileHoverTrigger(),
        mobileViewport(),
        touchTheme,
        autosave.extension,
        EditorView.updateListener.of((update) => {
          diagnosticsCount.value = diagnosticCount(update.state);
        }),
      ],
    }),
    parent: editorContainer,
  });

  await autosave.openFile(activeFile.id);

  // Live-follows `effectiveMode` (system preference while themeMode is
  // "system", or the explicit pick otherwise) -- runs immediately on
  // creation (redundant with the initial compartment content above, but
  // harmless) and again on every subsequent change, with no reload needed.
  effect(() => {
    view.dispatch({ effects: darkModeCompartment.reconfigure(darkModeExtension()) });
  });

  // Registered once, not rebuilt per `rebuildFilesBody()` call: this tab's
  // props (initResponse-derived ids/defaults, the stable view.dispatch-based
  // callback) don't depend on activeFile/activeProject/currentVariant.
  SETTINGS_TABS.push({
    id: "theme",
    label: "Theme",
    render: () => h(ThemeTab, { client, legend: initResponse.semanticTokensLegend }),
  });
  SETTINGS_TABS.push({
    id: "inlay-hints",
    label: "Inlay Hints",
    render: () =>
      h(InlayHintsTab, {
        inlayHintOptionIds: initResponse.inlayHintOptions,
        initialInlayHintOptions: DEFAULT_INLAY_HINT_OPTIONS,
        diagnosticsCount,
        onInlayHintOptionsChange: (options: InlayHintOptions) => {
          view.dispatch({ effects: setInlayHintOptions.of(options) });
          log("Inlay hint options changed:", options);
        },
      }),
  });
  settingsBody.value = h(SettingsPanel, null);

  async function applyVariantToEditor(variant: GameVariant): Promise<void> {
    currentVariant = variant;
    currentVariantSignal.value = variant;
    log(`Variant changed to ${variant} — re-validating.`);
    await client.setVariant(variant);
    view.dispatch({ effects: analysisCompartment.reconfigure(buildAnalysisExtensions()) });
  }

  async function applyFileOnlyVariantChange(variant: GameVariant): Promise<void> {
    const updated = await changeFileVariant(activeFile.id, variant);
    setActiveFile(updated);
    if (updated.parentProjectId === null) {
      // Root files have no project to attach the choice to — treat it as the
      // new standalone/global default for the next fallback draft too.
      await kvSet(GLOBAL_FALLBACK_VARIANT_KEY, variant);
    }
    pendingVariantPromptSignal.value = null;
    await applyVariantToEditor(variant);
    rebuildFilesBody();
  }

  async function applyWholeProjectVariantChange(variant: GameVariant): Promise<void> {
    if (!activeProject) return;
    setActiveProject(await changeProjectVariant(activeProject.id, variant));
    pendingVariantPromptSignal.value = null;
    // The active file may itself carry an explicit override that this
    // project-wide change doesn't touch (only `variant: null` siblings
    // inherit it) — re-resolve rather than assuming `variant` now applies to
    // the open document, so the picker/live validation don't drift from what
    // a reload would actually restore for this file.
    await applyVariantToEditor(getEffectiveVariant(activeFile, activeProject));
    rebuildFilesBody();
  }

  function cancelVariantChange(): void {
    pendingVariantPromptSignal.value = null;
    // Re-sync VariantPicker's <select> back to `currentVariant`, undoing the
    // browser's already-applied (but not yet confirmed) native selection.
    rebuildFilesBody();
  }

  function requestVariantChange(variant: GameVariant): void {
    if (variant === currentVariant) return;
    if (activeFile.parentProjectId === null || activeProject === null) {
      void applyFileOnlyVariantChange(variant);
      return;
    }
    pendingVariantPromptSignal.value = { variant };
    rebuildFilesBody();
  }

  // Shared by FileBrowser (sheet), Header's new/open/FileSelectPopover
  // actions, and ActiveFileMenu's delete-then-fallback -- anything that picks
  // a different file to load into the editor goes through here so
  // autosave/variant/the shared active-file signals all stay in sync,
  // wherever the action was triggered from.
  async function openFileInEditor(file: CaosFile, effectiveVariant: GameVariant): Promise<void> {
    // Flush the outgoing file's pending edits (autosave reads the editor's
    // *current* text, so this must happen before the doc is replaced below)
    // then switch autosave tracking to the new file.
    await autosave.openFile(file.id);
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: file.text },
      annotations: fileLoadAnnotation,
    });
    setActiveFile(file);
    setActiveProject(file.parentProjectId === null ? null : await getProject(file.parentProjectId));
    pendingVariantPromptSignal.value = null;
    log(`Opened file "${file.name}".`);
    if (effectiveVariant !== currentVariant) {
      await applyVariantToEditor(effectiveVariant);
    }
    rebuildFilesBody();
  }

  // Reassigning `filesBody.value` re-renders Shell's Files-section slot, but
  // Preact's positional reconciliation preserves each child component's own
  // internal state (FileBrowser's browsing state) across the reassignment —
  // only needed here because a programmatic variant change (opening a file
  // with a different effective variant, or resolving the file/project
  // prompt) has to force VariantPicker's <select> to a new value, unlike a
  // user-driven picker change.
  function rebuildFilesBody(): void {
    filesBody.value = h(
      "div",
      null,
      h(FileBrowser, {
        onFileOpened: (file, effectiveVariant) => void openFileInEditor(file, effectiveVariant),
      }),
      h(VariantPicker, {
        initialVariant: currentVariant,
        onChange: requestVariantChange,
      }),
      pendingVariantPromptSignal.value &&
        activeProject &&
        h(VariantChangePrompt, {
          fileName: activeFile.name,
          projectName: activeProject.name,
          variant: pendingVariantPromptSignal.value.variant,
          onFileOnly: () => void applyFileOnlyVariantChange(pendingVariantPromptSignal.value!.variant),
          onWholeProject: () => void applyWholeProjectVariantChange(pendingVariantPromptSignal.value!.variant),
          onCancel: cancelVariantChange,
        }),
    );
  }

  // Delete-the-active-file fallback: `ActiveFileMenu` (header) calls this
  // after trashing whichever file is currently open, then hands the fresh
  // draft to `onFileOpened` the same way any other file-open does.
  async function openFallbackDraft(): Promise<void> {
    const draft = await createFallbackDraft();
    await openFileInEditor(draft.file, draft.variant);
  }

  rebuildFilesBody();
  headerBody.value = h(Header, {
    getEditorText: () => view.state.doc.toString(),
    onFileOpened: (file, effectiveVariant) => void openFileInEditor(file, effectiveVariant),
    onDeleteActiveFileFallback: () => void openFallbackDraft(),
    onRequestVariantChange: requestVariantChange,
    onVariantPromptFileOnly: () => void applyFileOnlyVariantChange(pendingVariantPromptSignal.value!.variant),
    onVariantPromptWholeProject: () => void applyWholeProjectVariantChange(pendingVariantPromptSignal.value!.variant),
    onVariantPromptCancel: cancelVariantChange,
  });

  diagnosticsCount.value = diagnosticCount(view.state);

  log("Editor initialized.");
}

main().catch((err) => {
  log("Demo setup FAILED:", err instanceof Error ? err.message : String(err));
});
