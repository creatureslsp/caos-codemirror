import { beforeEach, describe, expect, it } from "vitest";
import { openDb, promisifyTransaction, resetDbForTests, STORE_FILES } from "./db.js";
import {
  changeFileVariant,
  checkNameConflict,
  createFile,
  hardDeleteFile,
  listFilesInProject,
  moveFileToProject,
  moveFileToRoot,
  NameConflictError,
  renameFile,
  restoreFile,
  searchFiles,
  softDeleteFile,
  sweepExpiredFiles,
  updateFileText
} from "./files.js";
import { createProject } from "./projects.js";

beforeEach(async () => {
  await resetDbForTests();
});

describe("createFile", () => {
  it("requires a concrete variant at root", async () => {
    await expect(createFile({ name: "a.cos", parentProjectId: null })).rejects.toThrow();
    const file = await createFile({ name: "a.cos", parentProjectId: null, variant: "C3" });
    expect(file.variant).toBe("C3");
  });

  it("defaults to null (inherit) inside a project", async () => {
    const project = await createProject({ name: "P", variant: "C3" });
    const file = await createFile({ name: "a.cos", parentProjectId: project.id });
    expect(file.variant).toBeNull();
  });

  it("round-trips id, timestamps, and text", async () => {
    const file = await createFile({ name: "a.cos", parentProjectId: null, variant: "C3", text: "hello" });
    const [listed] = await listFilesInProject(null);
    expect(listed).toEqual(file);
    expect(listed.text).toBe("hello");
    expect(listed.createdDate).toBe(listed.lastModifiedDate);
  });
});

describe("name conflicts", () => {
  it("is scoped per project — same name in two different projects is never a conflict", async () => {
    const p1 = await createProject({ name: "P1", variant: "C3" });
    const p2 = await createProject({ name: "P2", variant: "C3" });
    await createFile({ name: "same.cos", parentProjectId: p1.id });
    await expect(createFile({ name: "same.cos", parentProjectId: p2.id })).resolves.toBeDefined();
    expect(await checkNameConflict(p1.id, "same.cos")).toBe(true);
    expect(await checkNameConflict(p2.id, "same.cos")).toBe(true);
  });

  it("renameFile throws NameConflictError without overwrite, succeeds with it", async () => {
    const project = await createProject({ name: "P", variant: "C3" });
    const a = await createFile({ name: "a.cos", parentProjectId: project.id });
    await createFile({ name: "b.cos", parentProjectId: project.id });

    await expect(renameFile(a.id, "b.cos")).rejects.toBeInstanceOf(NameConflictError);

    const renamed = await renameFile(a.id, "b.cos", { overwrite: true });
    expect(renamed.name).toBe("b.cos");
    const remaining = await listFilesInProject(project.id);
    expect(remaining).toHaveLength(1);
  });

  it("ignores trashed files when checking for a conflict", async () => {
    const project = await createProject({ name: "P", variant: "C3" });
    const a = await createFile({ name: "a.cos", parentProjectId: project.id });
    await softDeleteFile(a.id);
    await expect(createFile({ name: "a.cos", parentProjectId: project.id })).resolves.toBeDefined();
  });
});

describe("variant inheritance on move", () => {
  it("resolves an explicit variant matching the destination to null (inherit)", async () => {
    const project = await createProject({ name: "P", variant: "C3" });
    const file = await createFile({ name: "a.cos", parentProjectId: null, variant: "C3" });
    const moved = await moveFileToProject(file.id, project.id);
    expect(moved.variant).toBeNull();
  });

  it("keeps an explicit variant that differs from the destination", async () => {
    const project = await createProject({ name: "P", variant: "C3" });
    const file = await createFile({ name: "a.cos", parentProjectId: null, variant: "DS" });
    const moved = await moveFileToProject(file.id, project.id);
    expect(moved.variant).toBe("DS");
  });

  it("resolves a null (inherited) variant to the project's concrete variant on move-to-root", async () => {
    const project = await createProject({ name: "P", variant: "C3" });
    const file = await createFile({ name: "a.cos", parentProjectId: project.id });
    expect(file.variant).toBeNull();
    const moved = await moveFileToRoot(file.id);
    expect(moved.variant).toBe("C3");
    expect(moved.parentProjectId).toBeNull();
  });

  it("leaves an explicit variant alone on move-to-root", async () => {
    const project = await createProject({ name: "P", variant: "C3" });
    const file = await createFile({ name: "a.cos", parentProjectId: project.id, variant: "DS" });
    const moved = await moveFileToRoot(file.id);
    expect(moved.variant).toBe("DS");
  });
});

describe("changeFileVariant", () => {
  it("disallows resolving a root file's variant to null", async () => {
    const file = await createFile({ name: "a.cos", parentProjectId: null, variant: "C3" });
    await expect(changeFileVariant(file.id, null)).rejects.toThrow();
  });

  it("allows setting a project file back to inherit", async () => {
    const project = await createProject({ name: "P", variant: "C3" });
    const file = await createFile({ name: "a.cos", parentProjectId: project.id, variant: "DS" });
    const updated = await changeFileVariant(file.id, null);
    expect(updated.variant).toBeNull();
  });
});

describe("updateFileText / softDelete / restore / hardDelete", () => {
  it("bumps lastModifiedDate on text update", async () => {
    const file = await createFile({ name: "a.cos", parentProjectId: null, variant: "C3" });
    const before = file.lastModifiedDate;
    await new Promise((r) => setTimeout(r, 2));
    const updated = await updateFileText(file.id, "new text");
    expect(updated.text).toBe("new text");
    expect(updated.lastModifiedDate).toBeGreaterThan(before);
  });

  it("soft delete hides from listFilesInProject, restore brings it back", async () => {
    const file = await createFile({ name: "a.cos", parentProjectId: null, variant: "C3" });
    await softDeleteFile(file.id);
    expect(await listFilesInProject(null)).toHaveLength(0);
    expect(await listFilesInProject(null, { includeDeleted: true })).toHaveLength(1);

    await restoreFile(file.id);
    expect(await listFilesInProject(null)).toHaveLength(1);
  });

  it("hard delete removes the record entirely", async () => {
    const file = await createFile({ name: "a.cos", parentProjectId: null, variant: "C3" });
    await hardDeleteFile(file.id);
    expect(await listFilesInProject(null, { includeDeleted: true })).toHaveLength(0);
  });
});

/** Test-only: writes a specific `deletedDate` directly, bypassing softDeleteFile's `Date.now()`. */
async function backdateDeletedDate(id: string, deletedDate: number): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_FILES, "readwrite");
  const store = tx.objectStore(STORE_FILES);
  const record = await new Promise<any>((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  record.deletedDate = deletedDate;
  store.put(record);
  await promisifyTransaction(tx);
}

describe("trash sweep", () => {
  it("hard-deletes only files trashed before the retention cutoff; restore-before-expiry survives", async () => {
    const expired = await createFile({ name: "expired.cos", parentProjectId: null, variant: "C3" });
    const recent = await createFile({ name: "recent.cos", parentProjectId: null, variant: "C3" });
    const restored = await createFile({ name: "restored.cos", parentProjectId: null, variant: "C3" });

    const retentionMs = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    await softDeleteFile(expired.id);
    await softDeleteFile(recent.id);
    await softDeleteFile(restored.id);
    await backdateDeletedDate(expired.id, now - retentionMs - 1000);
    await backdateDeletedDate(restored.id, now - retentionMs - 1000);
    await restoreFile(restored.id);

    await sweepExpiredFiles(now - retentionMs);

    const remaining = await listFilesInProject(null, { includeDeleted: true });
    expect(remaining.map((f) => f.id).sort()).toEqual([recent.id, restored.id].sort());
  });
});

describe("search", () => {
  it("normalizes diacritics, case, and punctuation", async () => {
    await createFile({ name: "café-notes.cos", parentProjectId: null, variant: "C3" });
    const results = await searchFiles("Cafe Notes");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("café-notes.cos");
  });

  it("scopes to a project when projectId is given", async () => {
    const project = await createProject({ name: "P", variant: "C3" });
    await createFile({ name: "match.cos", parentProjectId: null, variant: "C3" });
    await createFile({ name: "match.cos", parentProjectId: project.id });
    expect(await searchFiles("match", project.id)).toHaveLength(1);
    expect(await searchFiles("match")).toHaveLength(2);
  });
});
