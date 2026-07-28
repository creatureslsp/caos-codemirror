/**
 * Tiny "something about the files/projects list changed" event bus. Needed
 * because header-triggered mutations (new/open/rename/move/delete on the
 * active file) don't live inside `FileBrowser`'s own component instance the
 * way its per-row actions do, so they have no direct way to trigger its
 * `refreshAll()`. `FileBrowser` adds `filesRevision.value` to its refetch
 * effect's dependency array; anything outside it calls `bumpFilesRevision()`
 * after a successful mutation.
 */
import { signal } from "@preact/signals";

export const filesRevision = signal(0);

export function bumpFilesRevision(): void {
  filesRevision.value++;
}
