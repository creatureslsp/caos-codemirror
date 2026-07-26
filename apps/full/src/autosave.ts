/**
 * Debounced autosave + last-opened-file tracking, per
 * `../../plan-webapp/04-variant-persistence-autosave.md`. Owns:
 *  - a CodeMirror `updateListener` extension that debounces `updateFileText`
 *    writes on document changes;
 *  - `visibilitychange`/`pagehide`/`beforeunload` listeners that flush a
 *    pending write immediately, since `beforeunload` alone is not a reliable
 *    point to start an async IndexedDB write in every browser;
 *  - `kv.lastOpenedFileId`, updated on every successful save *and* on
 *    `openFile`, so a hard reload with no intervening edit still restores the
 *    right file.
 */
import { EditorView } from "codemirror";
import { Transaction, type Extension } from "@codemirror/state";
import { updateFileText } from "./storage/files.js";
import { kvSet } from "./storage/db.js";

export const LAST_OPENED_FILE_ID_KEY = "lastOpenedFileId";

/** Tag applied to programmatic doc replacements (opening a file into the
 * editor) so the autosave extension doesn't treat the load itself as an edit
 * to save back. */
export const FILE_LOAD_USER_EVENT = "file.load";

export interface AutosaveController {
  /** Include once in the `EditorState`'s extensions. */
  extension: Extension;
  /**
   * Flushes any pending write for the outgoing file, then switches autosave
   * tracking (and `kv.lastOpenedFileId`) to `fileId`. Call *before*
   * dispatching the new file's text into the editor, so the flush still sees
   * the outgoing file's content.
   */
  openFile(fileId: string): Promise<void>;
  /** Forces an immediate write of the latest edited text, bypassing the debounce. */
  flush(): Promise<void>;
  destroy(): void;
}

export interface AutosaveOptions {
  debounceMs?: number;
  onSaved?: (fileId: string) => void;
  onError?: (err: unknown) => void;
}

export function createAutosaveController(options?: AutosaveOptions): AutosaveController {
  const debounceMs = options?.debounceMs ?? 600;

  let activeFileId: string | null = null;
  let latestText: string | null = null;
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  async function save(): Promise<void> {
    clearTimer();
    if (!dirty || activeFileId === null || latestText === null) return;
    const fileId = activeFileId;
    const text = latestText;
    dirty = false;
    try {
      await updateFileText(fileId, text);
      await kvSet(LAST_OPENED_FILE_ID_KEY, fileId);
      options?.onSaved?.(fileId);
    } catch (err) {
      // Leave `dirty` set so the next debounce/flush trigger retries.
      dirty = true;
      options?.onError?.(err);
    }
  }

  function scheduleSave(): void {
    clearTimer();
    timer = setTimeout(() => void save(), debounceMs);
  }

  function handleVisibilityChange(): void {
    if (document.visibilityState === "hidden") void save();
  }
  function handlePagehide(): void {
    void save();
  }
  function handleBeforeUnload(): void {
    void save();
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", handlePagehide);
  window.addEventListener("beforeunload", handleBeforeUnload);

  const extension = EditorView.updateListener.of((update) => {
    if (!update.docChanged || activeFileId === null) return;
    if (update.transactions.some((tr) => tr.isUserEvent(FILE_LOAD_USER_EVENT))) return;
    latestText = update.state.doc.toString();
    dirty = true;
    scheduleSave();
  });

  return {
    extension,
    async openFile(fileId: string): Promise<void> {
      await save();
      activeFileId = fileId;
      latestText = null;
      dirty = false;
      await kvSet(LAST_OPENED_FILE_ID_KEY, fileId);
      options?.onSaved?.(fileId);
    },
    flush: save,
    destroy(): void {
      clearTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePagehide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    }
  };
}

/** Convenience re-export so callers tagging their own dispatches don't need a second import. */
export const fileLoadAnnotation = Transaction.userEvent.of(FILE_LOAD_USER_EVENT);
