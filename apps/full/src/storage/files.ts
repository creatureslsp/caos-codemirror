import type { GameVariant } from "@creatures-codemirror/engine";
import {
  openDb,
  promisifyRequest,
  promisifyTransaction,
  STORE_FILES,
  STORE_PROJECTS
} from "./db.js";
import { normalizeForSearch, sortByOptions, type SortOptions } from "./search.js";
import type { ProjectRecord } from "./projects.js";

export interface CaosFile {
  id: string;
  name: string;
  variant: GameVariant | null;
  createdDate: number;
  lastModifiedDate: number;
  text: string;
  parentProjectId: string | null;
  deletedDate: number | null;
}

export interface FileRecord extends CaosFile {
  nameNormalized: string;
}

export class NameConflictError extends Error {
  constructor(name: string) {
    super(`A file named "${name}" already exists in this project.`);
    this.name = "NameConflictError";
  }
}

function toPublicFile(record: FileRecord): CaosFile {
  const { nameNormalized: _nameNormalized, ...rest } = record;
  return rest;
}

async function getFileRecord(id: string): Promise<FileRecord> {
  const db = await openDb();
  const tx = db.transaction(STORE_FILES, "readonly");
  const record = await promisifyRequest<FileRecord | undefined>(tx.objectStore(STORE_FILES).get(id));
  if (!record) {
    throw new Error(`File not found: ${id}`);
  }
  return record;
}

/**
 * Boot-time lookup for the last-opened file: unlike `getFileRecord`, a
 * missing row (deleted, or from a stale/cleared `kv.lastOpenedFileId`) is an
 * expected outcome, not an error — callers fall back to a fresh draft.
 */
export async function getFile(id: string): Promise<CaosFile | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_FILES, "readonly");
  const record = await promisifyRequest<FileRecord | undefined>(tx.objectStore(STORE_FILES).get(id));
  return record ? toPublicFile(record) : null;
}

async function getProjectRecord(id: string): Promise<ProjectRecord> {
  const db = await openDb();
  const tx = db.transaction(STORE_PROJECTS, "readonly");
  const record = await promisifyRequest<ProjectRecord | undefined>(tx.objectStore(STORE_PROJECTS).get(id));
  if (!record) {
    throw new Error(`Project not found: ${id}`);
  }
  return record;
}

async function allFileRecords(): Promise<FileRecord[]> {
  const db = await openDb();
  const tx = db.transaction(STORE_FILES, "readonly");
  return promisifyRequest(tx.objectStore(STORE_FILES).getAll());
}

/** Non-deleted files sharing a project scope (`null` = the implicit root project). */
async function liveSiblings(parentProjectId: string | null, excludingFileId?: string): Promise<FileRecord[]> {
  const all = await allFileRecords();
  return all.filter(
    (f) =>
      f.parentProjectId === parentProjectId &&
      f.deletedDate === null &&
      f.id !== excludingFileId
  );
}

/**
 * Whether `name` collides with a non-deleted file already in the same
 * project scope. Phase 03's UI calls this before committing a
 * rename/move/create; `overwrite` flags on the mutating functions below
 * handle the case where the user chooses to replace the existing file.
 */
export async function checkNameConflict(
  parentProjectId: string | null,
  name: string,
  excludingFileId?: string
): Promise<boolean> {
  const siblings = await liveSiblings(parentProjectId, excludingFileId);
  return siblings.some((f) => f.name === name);
}

async function findConflict(
  parentProjectId: string | null,
  name: string,
  excludingFileId?: string
): Promise<FileRecord | undefined> {
  const siblings = await liveSiblings(parentProjectId, excludingFileId);
  return siblings.find((f) => f.name === name);
}

async function putFileRecord(record: FileRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_FILES, "readwrite");
  tx.objectStore(STORE_FILES).put(record);
  await promisifyTransaction(tx);
}

export interface CreateFileInput {
  name: string;
  parentProjectId: string | null;
  /** Omit (or pass `null`) inside a project to inherit; required and concrete at root. */
  variant?: GameVariant | null;
  text?: string;
}

export async function createFile(input: CreateFileInput): Promise<CaosFile> {
  const variant = input.variant ?? null;
  if (input.parentProjectId === null && variant === null) {
    throw new Error("A root-project file must have a concrete variant.");
  }
  if (await checkNameConflict(input.parentProjectId, input.name)) {
    throw new NameConflictError(input.name);
  }
  const now = Date.now();
  const record: FileRecord = {
    id: crypto.randomUUID(),
    name: input.name,
    variant,
    createdDate: now,
    lastModifiedDate: now,
    text: input.text ?? "",
    parentProjectId: input.parentProjectId,
    deletedDate: null,
    nameNormalized: normalizeForSearch(input.name)
  };
  await putFileRecord(record);
  return toPublicFile(record);
}

export async function renameFile(
  id: string,
  newName: string,
  options?: { overwrite?: boolean }
): Promise<CaosFile> {
  const record = await getFileRecord(id);
  const conflict = await findConflict(record.parentProjectId, newName, id);
  if (conflict) {
    if (!options?.overwrite) {
      throw new NameConflictError(newName);
    }
    await hardDeleteFile(conflict.id);
  }
  record.name = newName;
  record.nameNormalized = normalizeForSearch(newName);
  record.lastModifiedDate = Date.now();
  await putFileRecord(record);
  return toPublicFile(record);
}

export async function updateFileText(id: string, text: string): Promise<CaosFile> {
  const record = await getFileRecord(id);
  record.text = text;
  record.lastModifiedDate = Date.now();
  await putFileRecord(record);
  return toPublicFile(record);
}

export async function softDeleteFile(id: string): Promise<CaosFile> {
  const record = await getFileRecord(id);
  record.deletedDate = Date.now();
  await putFileRecord(record);
  return toPublicFile(record);
}

export async function restoreFile(id: string): Promise<CaosFile> {
  const record = await getFileRecord(id);
  record.deletedDate = null;
  await putFileRecord(record);
  return toPublicFile(record);
}

export async function hardDeleteFile(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_FILES, "readwrite");
  tx.objectStore(STORE_FILES).delete(id);
  await promisifyTransaction(tx);
}

export async function moveFileToProject(
  id: string,
  projectId: string,
  options?: { overwrite?: boolean }
): Promise<CaosFile> {
  const record = await getFileRecord(id);
  const project = await getProjectRecord(projectId);

  const conflict = await findConflict(projectId, record.name, id);
  if (conflict) {
    if (!options?.overwrite) {
      throw new NameConflictError(record.name);
    }
    await hardDeleteFile(conflict.id);
  }

  // A file whose explicit variant matches the destination project's variant
  // becomes redundant — fold it back to "inherit" so a later project-variant
  // change transitively affects it again.
  if (record.variant === project.variant) {
    record.variant = null;
  }
  record.parentProjectId = projectId;
  record.lastModifiedDate = Date.now();
  await putFileRecord(record);
  return toPublicFile(record);
}

export async function moveFileToRoot(
  id: string,
  options?: { overwrite?: boolean }
): Promise<CaosFile> {
  const record = await getFileRecord(id);

  const conflict = await findConflict(null, record.name, id);
  if (conflict) {
    if (!options?.overwrite) {
      throw new NameConflictError(record.name);
    }
    await hardDeleteFile(conflict.id);
  }

  // Root files can never inherit — resolve a null variant to the (former)
  // parent project's concrete variant before detaching.
  if (record.variant === null) {
    if (record.parentProjectId === null) {
      throw new Error("File already has no parent project.");
    }
    const project = await getProjectRecord(record.parentProjectId);
    record.variant = project.variant;
  }
  record.parentProjectId = null;
  record.lastModifiedDate = Date.now();
  await putFileRecord(record);
  return toPublicFile(record);
}

/** File-only variant change. For the whole-project cascade, see `changeProjectVariant`. */
export async function changeFileVariant(id: string, variant: GameVariant | null): Promise<CaosFile> {
  const record = await getFileRecord(id);
  if (record.parentProjectId === null && variant === null) {
    throw new Error("A root-project file must have a concrete variant.");
  }
  record.variant = variant;
  record.lastModifiedDate = Date.now();
  await putFileRecord(record);
  return toPublicFile(record);
}

export async function listFilesInProject(
  parentProjectId: string | null,
  options?: SortOptions & { includeDeleted?: boolean }
): Promise<CaosFile[]> {
  const all = await allFileRecords();
  const matching = all.filter(
    (f) => f.parentProjectId === parentProjectId && (options?.includeDeleted || f.deletedDate === null)
  );
  return sortByOptions(matching, options).map(toPublicFile);
}

/** Hard-deletes every file (in any project scope) trashed before `cutoff`. */
export async function sweepExpiredFiles(cutoff: number): Promise<void> {
  const all = await allFileRecords();
  for (const record of all) {
    if (record.deletedDate !== null && record.deletedDate < cutoff) {
      await hardDeleteFile(record.id);
    }
  }
}

export async function searchFiles(
  query: string,
  parentProjectId?: string | null,
  options?: SortOptions & { includeDeleted?: boolean }
): Promise<CaosFile[]> {
  const normalizedQuery = normalizeForSearch(query);
  const all = await allFileRecords();
  const matching = all.filter(
    (f) =>
      (options?.includeDeleted || f.deletedDate === null) &&
      (parentProjectId === undefined || f.parentProjectId === parentProjectId) &&
      f.nameNormalized.includes(normalizedQuery)
  );
  return sortByOptions(matching, options).map(toPublicFile);
}
