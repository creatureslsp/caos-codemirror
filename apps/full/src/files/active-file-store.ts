/**
 * Single source of truth for "the file currently open in the editor" and its
 * parent project. Previously `main.ts` (a closure variable, driving the
 * editor/autosave/variant) and `FileBrowser` (separate local `useState`, for
 * row highlighting) each kept their own copy with no sync between them -- a
 * rename/move done via FileBrowser's row menu never reached `main.ts`'s
 * copy. Now anything that changes the active file's identity or metadata
 * (open, rename, move, delete-with-fallback) writes here, and every UI that
 * needs to *display* it (Header, FileBrowser, ActiveFileMenu) just reads the
 * signal -- only loading the new text into the CodeMirror view itself still
 * has to go through `main.ts` (the only thing holding the `EditorView`).
 */
import { signal } from "@preact/signals";
import type { GameVariant } from "@creatures-codemirror/engine";
import type { CaosFile } from "../storage/files.js";
import type { CaosProject } from "../storage/projects.js";

export const activeFile = signal<CaosFile | null>(null);
export const activeProject = signal<CaosProject | null>(null);

/**
 * Mirrors `main.ts`'s own `currentVariant` closure variable, purely so the
 * header (a real reactive Preact component, unlike the sheet's
 * imperative-rebuild-on-change body) can display/react to it without prop
 * threading. `main.ts` remains the sole writer.
 */
export const currentVariant = signal<GameVariant | null>(null);

/**
 * Mirrors `main.ts`'s own `pendingVariantPrompt` closure variable for the
 * same reason -- the header needs to show the file-vs-project confirmation
 * even when the sheet (where this used to only ever render) is closed.
 */
export const pendingVariantPrompt = signal<{ variant: GameVariant } | null>(null);
