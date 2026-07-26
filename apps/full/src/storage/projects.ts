import type { GameVariant } from "@creatures-codemirror/engine";
import { openDb, promisifyRequest, promisifyTransaction, STORE_PROJECTS } from "./db.js";
import { normalizeForSearch, sortByOptions, type SortOptions } from "./search.js";
import {
  hardDeleteFile,
  listFilesInProject,
  moveFileToProject,
  moveFileToRoot,
  renameFile,
  restoreFile,
  softDeleteFile,
  sweepExpiredFiles,
  type CaosFile
} from "./files.js";

export interface CaosProject {
  id: string;
  name: string;
  variant: GameVariant;
  createdDate: number;
  lastModifiedDate: number;
  deletedDate: number | null;
}

export interface ProjectRecord extends CaosProject {
  nameNormalized: string;
}

/** `listProjects`'s sort-relevant view: the project's own row plus its effective modified date. */
export interface ProjectListItem extends CaosProject {
  /** `max(project.lastModifiedDate, max(file.lastModifiedDate for file in project))`. */
  effectiveLastModifiedDate: number;
}

function toPublicProject(record: ProjectRecord): CaosProject {
  const { nameNormalized: _nameNormalized, ...rest } = record;
  return rest;
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

/**
 * Boot-time/prompt lookup for a file's parent project: unlike
 * `getProjectRecord`, a missing row is an expected outcome (not an error) for
 * callers resolving a possibly-stale `parentProjectId`.
 */
export async function getProject(id: string): Promise<CaosProject | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_PROJECTS, "readonly");
  const record = await promisifyRequest<ProjectRecord | undefined>(tx.objectStore(STORE_PROJECTS).get(id));
  return record ? toPublicProject(record) : null;
}

async function allProjectRecords(): Promise<ProjectRecord[]> {
  const db = await openDb();
  const tx = db.transaction(STORE_PROJECTS, "readonly");
  return promisifyRequest(tx.objectStore(STORE_PROJECTS).getAll());
}

async function putProjectRecord(record: ProjectRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_PROJECTS, "readwrite");
  tx.objectStore(STORE_PROJECTS).put(record);
  await promisifyTransaction(tx);
}

export interface CreateProjectInput {
  name: string;
  variant: GameVariant;
}

export async function createProject(input: CreateProjectInput): Promise<CaosProject> {
  const now = Date.now();
  const record: ProjectRecord = {
    id: crypto.randomUUID(),
    name: input.name,
    variant: input.variant,
    createdDate: now,
    lastModifiedDate: now,
    deletedDate: null,
    nameNormalized: normalizeForSearch(input.name)
  };
  await putProjectRecord(record);
  return toPublicProject(record);
}

export async function renameProject(id: string, newName: string): Promise<CaosProject> {
  const record = await getProjectRecord(id);
  record.name = newName;
  record.nameNormalized = normalizeForSearch(newName);
  record.lastModifiedDate = Date.now();
  await putProjectRecord(record);
  return toPublicProject(record);
}

/**
 * Changes the project's own variant. Files with `variant: null` inherit this
 * automatically at read-time (see `getEffectiveVariant`) — nothing about
 * their own records changes. Files with an explicit override are unaffected,
 * which is what makes this "cascade only to null-variant files" in practice.
 */
export async function changeProjectVariant(id: string, variant: GameVariant): Promise<CaosProject> {
  const record = await getProjectRecord(id);
  record.variant = variant;
  record.lastModifiedDate = Date.now();
  await putProjectRecord(record);
  return toPublicProject(record);
}

/** Resolves a file's effective variant, joining against its parent project when it inherits. */
export function getEffectiveVariant(file: CaosFile, parentProject: CaosProject | null): GameVariant {
  if (file.variant !== null) {
    return file.variant;
  }
  if (parentProject === null) {
    throw new Error("A root-project file must have a concrete variant.");
  }
  return parentProject.variant;
}

export async function softDeleteProject(id: string): Promise<CaosProject> {
  const record = await getProjectRecord(id);
  record.deletedDate = Date.now();
  await putProjectRecord(record);
  return toPublicProject(record);
}

/**
 * Restores a trashed project and every file still pointing at it that is
 * also still trashed. Files individually moved out (or independently
 * undeleted) before this call are left exactly where they are, per
 * `../../plan-webapp/00-risks-and-open-questions.md`.
 */
export async function restoreProject(id: string): Promise<CaosProject> {
  const record = await getProjectRecord(id);
  record.deletedDate = null;
  await putProjectRecord(record);

  const children = await listFilesInProject(id, { includeDeleted: true });
  for (const file of children) {
    if (file.deletedDate !== null) {
      await restoreFile(file.id);
    }
  }
  return toPublicProject(record);
}

export async function hardDeleteProject(id: string): Promise<void> {
  // Defensive cleanup: any file record still pointing at this project (e.g.
  // trashed alongside it via `deleteProjectWithCascade`'s "delete-all"
  // strategy) would otherwise become an orphaned foreign key.
  const children = await listFilesInProject(id, { includeDeleted: true });
  for (const file of children) {
    await hardDeleteFile(file.id);
  }
  const db = await openDb();
  const tx = db.transaction(STORE_PROJECTS, "readwrite");
  tx.objectStore(STORE_PROJECTS).delete(id);
  await promisifyTransaction(tx);
}

export type DeleteProjectStrategy = "delete-all" | "move-to-root" | { moveToProjectId: string };

/**
 * Resolves a name that may collide in the destination scope by appending
 * " (2)", " (3)", etc. Used by the cascade below, which moves many files in
 * one bulk operation with no per-file interactive overwrite decision
 * available (unlike `moveFileToProject`/`moveFileToRoot`'s `overwrite` flag).
 */
async function uniqueNameInScope(
  parentProjectId: string | null,
  name: string,
  excludingFileId: string
): Promise<string> {
  const siblings = await listFilesInProject(parentProjectId);
  const taken = new Set(siblings.filter((f) => f.id !== excludingFileId).map((f) => f.name));
  if (!taken.has(name)) {
    return name;
  }
  let n = 2;
  while (taken.has(`${name} (${n})`)) {
    n += 1;
  }
  return `${name} (${n})`;
}

/**
 * `WEBAPP.md` requires the user choose what happens to a project's files
 * *before* the project itself is trashed. This runs that cascade, then
 * trashes the project.
 */
export async function deleteProjectWithCascade(
  id: string,
  strategy: DeleteProjectStrategy
): Promise<CaosProject> {
  const activeFiles = await listFilesInProject(id);

  for (const file of activeFiles) {
    if (strategy === "delete-all") {
      await softDeleteFile(file.id);
      continue;
    }

    const targetProjectId = strategy === "move-to-root" ? null : strategy.moveToProjectId;
    const uniqueName = await uniqueNameInScope(targetProjectId, file.name, file.id);
    if (uniqueName !== file.name) {
      await renameFile(file.id, uniqueName);
    }
    if (targetProjectId === null) {
      await moveFileToRoot(file.id);
    } else {
      await moveFileToProject(file.id, targetProjectId);
    }
  }

  return softDeleteProject(id);
}

export async function listProjects(
  options?: SortOptions & { includeDeleted?: boolean }
): Promise<ProjectListItem[]> {
  const all = await allProjectRecords();
  const matching = all.filter((p) => options?.includeDeleted || p.deletedDate === null);

  const withEffectiveModified: ProjectListItem[] = [];
  for (const record of matching) {
    const files = await listFilesInProject(record.id);
    const effectiveLastModifiedDate = files.reduce(
      (max, f) => Math.max(max, f.lastModifiedDate),
      record.lastModifiedDate
    );
    withEffectiveModified.push({ ...toPublicProject(record), effectiveLastModifiedDate });
  }
  return sortByOptions(withEffectiveModified, options);
}

export async function searchProjects(
  query: string,
  options?: SortOptions & { includeDeleted?: boolean }
): Promise<CaosProject[]> {
  const normalizedQuery = normalizeForSearch(query);
  const all = await allProjectRecords();
  const matching = all.filter(
    (p) => (options?.includeDeleted || p.deletedDate === null) && p.nameNormalized.includes(normalizedQuery)
  );
  return sortByOptions(matching, options).map(toPublicProject);
}

const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Hard-deletes anything whose `deletedDate` is older than the retention
 * window. Run once at app boot, not a background timer — see
 * `../../plan-webapp/00-risks-and-open-questions.md`'s trash-retention note.
 */
export async function sweepExpiredTrash(now: number = Date.now()): Promise<void> {
  const cutoff = now - TRASH_RETENTION_MS;

  const projects = await allProjectRecords();
  for (const project of projects) {
    if (project.deletedDate !== null && project.deletedDate < cutoff) {
      await hardDeleteProject(project.id);
    }
  }

  // Files trashed independently of any project deletion (or trashed inside a
  // project that itself hasn't expired yet) still need their own sweep.
  await sweepExpiredFiles(cutoff);
}
