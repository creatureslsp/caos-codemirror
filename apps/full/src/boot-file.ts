/**
 * Boot-time (and delete-active-file-time) file/variant resolution, per
 * `../../plan-webapp/04-variant-persistence-autosave.md`'s boot sequence.
 * Split out of `main.ts` so `createFallbackDraft` -- the "no file to
 * restore, make a fresh root-scope draft" branch -- is reusable by the
 * header's delete-current-file action, not just cold boot.
 */
import type { GameVariant } from "@creatures-codemirror/engine";
import { checkNameConflict, createFile, getFile, type CaosFile } from "./storage/files.js";
import { getEffectiveVariant, getProject, type CaosProject } from "./storage/projects.js";
import { kvGet } from "./storage/db.js";

export const GLOBAL_FALLBACK_VARIANT_KEY = "globalFallbackVariant";
export const DEFAULT_VARIANT: GameVariant = "DS";

export interface ResolvedFile {
  file: CaosFile;
  project: CaosProject | null;
  variant: GameVariant;
}

/** Creates a fresh, de-duplicated root-scope "Untitled" draft using the persisted global fallback variant. */
export async function createFallbackDraft(): Promise<ResolvedFile> {
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

/**
 * Restores `kv.lastOpenedFileId` if it still points at a live row (trashed is
 * fine, hard-deleted is not -- `getFile` returns `null` for that), else falls
 * back to a fresh draft via `createFallbackDraft`.
 */
export async function resolveBootFile(lastOpenedFileIdKey: string): Promise<ResolvedFile> {
  const lastOpenedFileId = await kvGet<string>(lastOpenedFileIdKey);
  if (lastOpenedFileId) {
    const file = await getFile(lastOpenedFileId);
    if (file) {
      const project = file.parentProjectId === null ? null : await getProject(file.parentProjectId);
      const variant = getEffectiveVariant(file, project);
      return { file, project, variant };
    }
  }
  return createFallbackDraft();
}
