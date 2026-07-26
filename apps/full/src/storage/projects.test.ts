import { beforeEach, describe, expect, it } from "vitest";
import { openDb, promisifyTransaction, resetDbForTests, STORE_PROJECTS } from "./db.js";
import { createFile, listFilesInProject, moveFileToRoot, restoreFile, softDeleteFile } from "./files.js";
import {
  changeProjectVariant,
  createProject,
  deleteProjectWithCascade,
  getEffectiveVariant,
  hardDeleteProject,
  listProjects,
  renameProject,
  restoreProject,
  searchProjects,
  softDeleteProject,
  sweepExpiredTrash
} from "./projects.js";

beforeEach(async () => {
  await resetDbForTests();
});

describe("createProject / renameProject / changeProjectVariant", () => {
  it("round-trips basic fields", async () => {
    const project = await createProject({ name: "P", variant: "C3" });
    expect(project.variant).toBe("C3");
    expect(project.deletedDate).toBeNull();

    const renamed = await renameProject(project.id, "P2");
    expect(renamed.name).toBe("P2");

    const revariant = await changeProjectVariant(project.id, "DS");
    expect(revariant.variant).toBe("DS");
  });
});

describe("getEffectiveVariant / variant cascade", () => {
  it("cascades a project variant change only to null-variant files, never explicit overrides", async () => {
    const project = await createProject({ name: "P", variant: "C3" });
    const inheriting = await createFile({ name: "a.cos", parentProjectId: project.id });
    const overridden = await createFile({ name: "b.cos", parentProjectId: project.id, variant: "DS" });

    const updatedProject = await changeProjectVariant(project.id, "SM");

    expect(getEffectiveVariant(inheriting, updatedProject)).toBe("SM");
    expect(getEffectiveVariant(overridden, updatedProject)).toBe("DS");
  });

  it("throws resolving a root file with no parent project against a null variant", () => {
    const rootFile = {
      id: "x",
      name: "a.cos",
      variant: null,
      createdDate: 0,
      lastModifiedDate: 0,
      text: "",
      parentProjectId: null,
      deletedDate: null
    } as const;
    expect(() => getEffectiveVariant(rootFile as any, null)).toThrow();
  });
});

describe("deleteProjectWithCascade", () => {
  it("delete-all strategy trashes every active file", async () => {
    const project = await createProject({ name: "P", variant: "C3" });
    const a = await createFile({ name: "a.cos", parentProjectId: project.id });
    const b = await createFile({ name: "b.cos", parentProjectId: project.id });

    await deleteProjectWithCascade(project.id, "delete-all");

    const remainingActive = await listFilesInProject(project.id);
    expect(remainingActive).toHaveLength(0);
    const withDeleted = await listFilesInProject(project.id, { includeDeleted: true });
    expect(withDeleted.map((f) => f.id).sort()).toEqual([a.id, b.id].sort());
    expect(withDeleted.every((f) => f.deletedDate !== null)).toBe(true);
  });

  it("move-to-root strategy resolves variant and auto-renames on collision", async () => {
    const project = await createProject({ name: "P", variant: "C3" });
    const inheriting = await createFile({ name: "a.cos", parentProjectId: project.id });
    await createFile({ name: "a.cos", parentProjectId: null, variant: "DS" }); // pre-existing root collision

    await deleteProjectWithCascade(project.id, "move-to-root");

    const rootFiles = await listFilesInProject(null);
    const moved = rootFiles.find((f) => f.id === inheriting.id)!;
    expect(moved.parentProjectId).toBeNull();
    expect(moved.variant).toBe("C3"); // resolved from the project's variant
    expect(moved.name).toBe("a.cos (2)"); // auto-renamed to avoid the collision
    expect(rootFiles).toHaveLength(2);
  });

  it("moveToProjectId strategy moves files into the destination project", async () => {
    const source = await createProject({ name: "Source", variant: "C3" });
    const destination = await createProject({ name: "Destination", variant: "DS" });
    const file = await createFile({ name: "a.cos", parentProjectId: source.id });

    await deleteProjectWithCascade(source.id, { moveToProjectId: destination.id });

    const destFiles = await listFilesInProject(destination.id);
    expect(destFiles).toHaveLength(1);
    expect(destFiles[0].id).toBe(file.id);
  });
});

describe("project undelete", () => {
  it("restores trashed children still pointing at it, but leaves independently moved/undeleted files alone", async () => {
    const project = await createProject({ name: "P", variant: "C3" });
    const staysTrashed = await createFile({ name: "a.cos", parentProjectId: project.id });
    const movedOutBeforeRestore = await createFile({ name: "b.cos", parentProjectId: project.id });
    const independentlyUndeleted = await createFile({ name: "c.cos", parentProjectId: project.id });

    await softDeleteProject(project.id);
    await softDeleteFile(staysTrashed.id);
    await softDeleteFile(movedOutBeforeRestore.id);
    await softDeleteFile(independentlyUndeleted.id);

    // Moved out of the project (while still trashed) before the project is restored.
    await moveFileToRoot(movedOutBeforeRestore.id);
    // Independently undeleted before the project is restored.
    await restoreFile(independentlyUndeleted.id);

    await restoreProject(project.id);

    const projectFiles = await listFilesInProject(project.id, { includeDeleted: true });
    const staysTrashedAfter = projectFiles.find((f) => f.id === staysTrashed.id)!;
    expect(staysTrashedAfter.deletedDate).toBeNull();

    const independentlyUndeletedAfter = projectFiles.find((f) => f.id === independentlyUndeleted.id)!;
    expect(independentlyUndeletedAfter.deletedDate).toBeNull();

    const rootFiles = await listFilesInProject(null, { includeDeleted: true });
    const movedOutAfter = rootFiles.find((f) => f.id === movedOutBeforeRestore.id)!;
    expect(movedOutAfter.parentProjectId).toBeNull();
    expect(movedOutAfter.deletedDate).not.toBeNull(); // restoreProject must not force-reclaim it
  });
});

describe("listProjects / effective modified date", () => {
  it("uses the max of the project's own and its files' lastModifiedDate", async () => {
    const project = await createProject({ name: "P", variant: "C3" });
    const file = await createFile({ name: "a.cos", parentProjectId: project.id });

    const { updateFileText } = await import("./files.js");
    await new Promise((r) => setTimeout(r, 2));
    const updatedFile = await updateFileText(file.id, "new text");

    const [listed] = await listProjects();
    expect(listed.id).toBe(project.id);
    expect(listed.effectiveLastModifiedDate).toBe(updatedFile.lastModifiedDate);
    expect(listed.effectiveLastModifiedDate).toBeGreaterThan(project.lastModifiedDate);
  });
});

describe("search", () => {
  it("normalizes and scopes like files search", async () => {
    await createProject({ name: "Café Project", variant: "C3" });
    expect(await searchProjects("cafe project")).toHaveLength(1);
  });
});

/** Test-only: writes a specific `deletedDate` directly, bypassing softDeleteProject's `Date.now()`. */
async function backdateProjectDeletedDate(id: string, deletedDate: number): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_PROJECTS, "readwrite");
  const store = tx.objectStore(STORE_PROJECTS);
  const record = await new Promise<any>((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  record.deletedDate = deletedDate;
  store.put(record);
  await promisifyTransaction(tx);
}

describe("sweepExpiredTrash", () => {
  it("hard-deletes an expired project and its remaining trashed files", async () => {
    const project = await createProject({ name: "P", variant: "C3" });
    const file = await createFile({ name: "a.cos", parentProjectId: project.id });

    const retentionMs = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    await deleteProjectWithCascade(project.id, "delete-all");
    await backdateProjectDeletedDate(project.id, now - retentionMs - 1000);

    await sweepExpiredTrash(now);

    const projects = await listProjects({ includeDeleted: true });
    expect(projects.find((p) => p.id === project.id)).toBeUndefined();
    const files = await listFilesInProject(project.id, { includeDeleted: true });
    expect(files.find((f) => f.id === file.id)).toBeUndefined();
  });

  it("does not touch a project trashed within the retention window", async () => {
    const project = await createProject({ name: "P", variant: "C3" });
    await softDeleteProject(project.id);

    await sweepExpiredTrash();

    const projects = await listProjects({ includeDeleted: true });
    expect(projects.find((p) => p.id === project.id)).toBeDefined();
  });
});

describe("hardDeleteProject", () => {
  it("cleans up any file still pointing at the project", async () => {
    const project = await createProject({ name: "P", variant: "C3" });
    const file = await createFile({ name: "a.cos", parentProjectId: project.id });
    await softDeleteFile(file.id);

    await hardDeleteProject(project.id);

    const files = await listFilesInProject(project.id, { includeDeleted: true });
    expect(files).toHaveLength(0);
  });
});
