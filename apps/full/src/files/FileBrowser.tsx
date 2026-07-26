/**
 * Phase 03 container: composes the project/file browser inside Phase 01's
 * menu sheet. Owns all browsing state (active project, search, sort, trash
 * visibility, in-flight dialogs) locally — `main.ts` only needs to know when
 * a file was opened (so it can load its text into the editor) and needs a
 * way to read the editor's current text back out (for download).
 */
import { useEffect, useState } from "preact/hooks";
import type { GameVariant } from "@creatures-codemirror/engine";
import { GAME_VARIANTS } from "@creatures-codemirror/engine";
import {
  changeFileVariant,
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
  type CaosFile
} from "../storage/files.js";
import {
  createProject,
  deleteProjectWithCascade,
  getEffectiveVariant,
  listProjects,
  renameProject,
  restoreProject,
  searchProjects,
  softDeleteProject,
  type CaosProject,
  type DeleteProjectStrategy,
  type ProjectListItem
} from "../storage/projects.js";
import { kvGet, kvSet } from "../storage/db.js";
import type { SortDirection, SortField } from "../storage/search.js";
import { downloadAsCosFile, pickCosFileFromDisk } from "./file-io.js";
import { ProjectSwitcher } from "./ProjectSwitcher.js";
import { FileList } from "./FileList.js";
import { SearchBar } from "./SearchBar.js";
import { SortControl } from "./SortControl.js";
import { ConfirmMoveDialog } from "./ConfirmMoveDialog.js";
import { ConfirmDeleteProjectDialog } from "./ConfirmDeleteProjectDialog.js";
import { TrashView } from "./TrashView.js";

export interface FileBrowserProps {
  getEditorText: () => string;
  onFileOpened: (file: CaosFile, effectiveVariant: GameVariant) => void;
}

type PendingConflict =
  | { kind: "create"; parentProjectId: string | null; variant: GameVariant | null; text: string; name: string }
  | { kind: "rename"; fileId: string; name: string }
  | { kind: "move"; fileId: string; targetProjectId: string | null; name: string };

const STORAGE_WARNING_KV_KEY = "hasSeenStorageWarning";

export function FileBrowser(props: FileBrowserProps) {
  const { getEditorText, onFileOpened } = props;

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<CaosFile | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // `allProjectsUnfiltered` backs move-target/lookup logic that must not be
  // affected by an in-progress search; `displayedProjects` is what
  // ProjectSwitcher actually renders as chips.
  const [allProjectsUnfiltered, setAllProjectsUnfiltered] = useState<ProjectListItem[]>([]);
  const [displayedProjects, setDisplayedProjects] = useState<CaosProject[]>([]);
  const [files, setFiles] = useState<CaosFile[]>([]);

  const [showTrash, setShowTrash] = useState(false);
  const [trashedProjects, setTrashedProjects] = useState<CaosProject[]>([]);
  const [trashedFiles, setTrashedFiles] = useState<CaosFile[]>([]);

  const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(null);
  const [pendingDeleteProject, setPendingDeleteProject] = useState<{
    project: CaosProject;
    fileCount: number;
  } | null>(null);
  const [pendingRootCreate, setPendingRootCreate] = useState<{ name: string; text: string } | null>(null);
  const [rootCreateVariant, setRootCreateVariant] = useState<GameVariant>(GAME_VARIANTS[0]);
  const [showStorageWarning, setShowStorageWarning] = useState(false);

  // Clears `files` in the same batch as `activeProjectId` so the two state
  // updates commit together: `files`/`activeProject` must never disagree
  // about scope mid-render, since FileList's `getEffectiveVariant(file,
  // activeProject)` call throws synchronously for a null-variant file whose
  // (stale) parent project no longer matches the newly active one — crashing
  // Preact's render pass, not just producing a wrong-but-recoverable result.
  function switchActiveProject(id: string | null): void {
    // No-op when already on `id`: clearing `files` here would wipe the list
    // with nothing to repopulate it, since the effect below only refetches
    // when `activeProjectId` actually *changes* value.
    if (id === activeProjectId) return;
    setFiles([]);
    setActiveProjectId(id);
  }

  async function refreshProjects(): Promise<void> {
    const sortOpts = { sortBy, sortDirection };
    const unfiltered = await listProjects(sortOpts);
    setAllProjectsUnfiltered(unfiltered);
    const trimmed = searchQuery.trim();
    setDisplayedProjects(trimmed === "" ? unfiltered : await searchProjects(trimmed, sortOpts));
  }

  async function refreshFiles(): Promise<void> {
    const sortOpts = { sortBy, sortDirection };
    const trimmed = searchQuery.trim();
    const result =
      trimmed === ""
        ? await listFilesInProject(activeProjectId, sortOpts)
        : await searchFiles(trimmed, activeProjectId, sortOpts);
    setFiles(result);
  }

  async function refreshTrash(): Promise<void> {
    const [projectsAll, filesAll] = await Promise.all([
      listProjects({ includeDeleted: true }),
      searchFiles("", undefined, { includeDeleted: true })
    ]);
    setTrashedProjects(projectsAll.filter((p) => p.deletedDate !== null));
    setTrashedFiles(filesAll.filter((f) => f.deletedDate !== null));
  }

  async function refreshAll(): Promise<void> {
    await Promise.all([refreshProjects(), refreshFiles(), refreshTrash()]);
  }

  useEffect(() => {
    void refreshAll();
  }, [activeProjectId, searchQuery, sortBy, sortDirection]);

  const activeProject: CaosProject | null =
    activeProjectId === null ? null : allProjectsUnfiltered.find((p) => p.id === activeProjectId) ?? null;

  const moveTargets: { id: string | null; name: string }[] =
    activeProjectId === null
      ? allProjectsUnfiltered.map((p) => ({ id: p.id, name: p.name }))
      : [
          { id: null, name: "Root" },
          ...allProjectsUnfiltered.filter((p) => p.id !== activeProjectId).map((p) => ({ id: p.id, name: p.name }))
        ];

  async function maybeShowStorageWarning(): Promise<void> {
    const seen = await kvGet<boolean>(STORAGE_WARNING_KV_KEY);
    if (!seen) {
      setShowStorageWarning(true);
      await kvSet(STORAGE_WARNING_KV_KEY, true);
    }
  }

  function handleOpenFile(file: CaosFile): void {
    const parentProject =
      file.parentProjectId === null ? null : allProjectsUnfiltered.find((p) => p.id === file.parentProjectId) ?? null;
    const effectiveVariant = getEffectiveVariant(file, parentProject);
    setActiveFile(file);
    onFileOpened(file, effectiveVariant);
  }

  async function attemptCreateFile(
    name: string,
    parentProjectId: string | null,
    variant: GameVariant | null,
    text: string,
    overwrite = false
  ): Promise<void> {
    if (overwrite) {
      const conflict = (await listFilesInProject(parentProjectId)).find((f) => f.name === name);
      if (conflict) await hardDeleteFile(conflict.id);
    }
    try {
      const file = await createFile({ name, parentProjectId, variant, text });
      await refreshAll();
      await maybeShowStorageWarning();
      handleOpenFile(file);
    } catch (err) {
      if (err instanceof NameConflictError) {
        setPendingConflict({ kind: "create", parentProjectId, variant, text, name });
      } else {
        throw err;
      }
    }
  }

  async function attemptRenameFile(fileId: string, newName: string, overwrite = false): Promise<void> {
    try {
      const updated = await renameFile(fileId, newName, { overwrite });
      await refreshAll();
      if (activeFile?.id === fileId) setActiveFile(updated);
    } catch (err) {
      if (err instanceof NameConflictError) {
        setPendingConflict({ kind: "rename", fileId, name: newName });
      } else {
        throw err;
      }
    }
  }

  async function attemptMoveFile(fileId: string, targetProjectId: string | null, overwrite = false): Promise<void> {
    const name = files.find((f) => f.id === fileId)?.name ?? activeFile?.name ?? "";
    try {
      const updated =
        targetProjectId === null
          ? await moveFileToRoot(fileId, { overwrite })
          : await moveFileToProject(fileId, targetProjectId, { overwrite });
      await refreshAll();
      if (activeFile?.id === fileId) setActiveFile(updated);
    } catch (err) {
      if (err instanceof NameConflictError) {
        setPendingConflict({ kind: "move", fileId, targetProjectId, name });
      } else {
        throw err;
      }
    }
  }

  function handleConflictRename(newName: string): void {
    if (!pendingConflict) return;
    const conflict = pendingConflict;
    setPendingConflict(null);
    if (conflict.kind === "create") {
      void attemptCreateFile(newName, conflict.parentProjectId, conflict.variant, conflict.text);
    } else if (conflict.kind === "rename") {
      void attemptRenameFile(conflict.fileId, newName);
    } else {
      void renameFile(conflict.fileId, newName).then(() => attemptMoveFile(conflict.fileId, conflict.targetProjectId));
    }
  }

  function handleConflictOverwrite(): void {
    if (!pendingConflict) return;
    const conflict = pendingConflict;
    setPendingConflict(null);
    if (conflict.kind === "create") {
      void attemptCreateFile(conflict.name, conflict.parentProjectId, conflict.variant, conflict.text, true);
    } else if (conflict.kind === "rename") {
      void attemptRenameFile(conflict.fileId, conflict.name, true);
    } else {
      void attemptMoveFile(conflict.fileId, conflict.targetProjectId, true);
    }
  }

  async function handleDeleteFile(id: string): Promise<void> {
    await softDeleteFile(id);
    await refreshAll();
  }

  async function handleChangeFileVariant(id: string, variant: GameVariant | null): Promise<void> {
    const updated = await changeFileVariant(id, variant);
    await refreshAll();
    if (activeFile?.id === id) setActiveFile(updated);
  }

  async function handleCreateProject(name: string, variant: GameVariant): Promise<void> {
    await createProject({ name, variant });
    await refreshAll();
  }

  async function handleRenameProject(id: string, newName: string): Promise<void> {
    await renameProject(id, newName);
    await refreshAll();
  }

  // When the deleted/emptied project is the one currently active, switching
  // `activeProjectId` to `null` already triggers the effect above to refresh
  // `files`/`projects` for the new (root) scope. Calling `refreshAll()`
  // ourselves *as well* would race it using the stale pre-update
  // `activeProjectId`, intermittently clobbering the correct root-scope data
  // with a stale, now-empty listing for the just-deleted project — so the two
  // refresh paths are kept mutually exclusive per call.
  async function handleRequestDeleteProject(project: CaosProject): Promise<void> {
    const filesInProject = await listFilesInProject(project.id);
    if (filesInProject.length === 0) {
      await softDeleteProject(project.id);
      if (activeProjectId === project.id) {
        switchActiveProject(null);
      } else {
        await refreshAll();
      }
    } else {
      setPendingDeleteProject({ project, fileCount: filesInProject.length });
    }
  }

  async function handleConfirmDeleteProjectCascade(strategy: DeleteProjectStrategy): Promise<void> {
    if (!pendingDeleteProject) return;
    const { project } = pendingDeleteProject;
    setPendingDeleteProject(null);
    await deleteProjectWithCascade(project.id, strategy);
    if (activeProjectId === project.id) {
      switchActiveProject(null);
    } else {
      await refreshAll();
    }
  }

  async function handleRestoreFile(id: string): Promise<void> {
    await restoreFile(id);
    await refreshAll();
  }

  async function handleRestoreProject(id: string): Promise<void> {
    await restoreProject(id);
    await refreshAll();
  }

  function handleNewFile(): void {
    const name = window.prompt("New file name:");
    if (!name || name.trim() === "") return;
    const trimmed = name.trim();
    if (activeProjectId === null) {
      setPendingRootCreate({ name: trimmed, text: "" });
    } else {
      void attemptCreateFile(trimmed, activeProjectId, null, "");
    }
  }

  async function handleOpenFromDisk(): Promise<void> {
    const picked = await pickCosFileFromDisk();
    const name = picked.name.replace(/\.cos$/i, "");
    if (activeProjectId === null) {
      setPendingRootCreate({ name, text: picked.text });
    } else {
      await attemptCreateFile(name, activeProjectId, null, picked.text);
    }
  }

  function handleDownload(): void {
    downloadAsCosFile(activeFile?.name ?? "untitled", getEditorText());
  }

  return (
    <div class="file-browser">
      <div class="file-browser-toolbar">
        <SearchBar onChange={setSearchQuery} />
        <SortControl
          sortBy={sortBy}
          sortDirection={sortDirection}
          onChange={(nextSortBy, nextDirection) => {
            setSortBy(nextSortBy);
            setSortDirection(nextDirection);
          }}
        />
      </div>

      <ProjectSwitcher
        projects={displayedProjects}
        activeProjectId={activeProjectId}
        onSelectProject={switchActiveProject}
        onCreateProject={(name, variant) => void handleCreateProject(name, variant)}
        onRenameProject={(id, newName) => void handleRenameProject(id, newName)}
        onRequestDeleteProject={(project) => void handleRequestDeleteProject(project)}
      />

      <div class="file-browser-file-actions">
        <button type="button" onClick={handleNewFile}>
          + New file
        </button>
        <button type="button" onClick={() => void handleOpenFromDisk()}>
          Open from disk…
        </button>
        <button type="button" onClick={handleDownload}>
          Download current file
        </button>
      </div>

      <FileList
        files={files}
        activeProject={activeProject}
        moveTargets={moveTargets}
        activeFileId={activeFile?.id ?? null}
        onOpenFile={handleOpenFile}
        onRenameFile={(id, newName) => void attemptRenameFile(id, newName)}
        onDeleteFile={(id) => void handleDeleteFile(id)}
        onMoveFile={(id, targetProjectId) => void attemptMoveFile(id, targetProjectId)}
        onChangeFileVariant={(id, variant) => void handleChangeFileVariant(id, variant)}
      />

      <button type="button" class="files-trash-toggle" onClick={() => setShowTrash((open) => !open)}>
        {showTrash ? "Hide trash" : `Trash (${trashedFiles.length + trashedProjects.length})`}
      </button>
      {showTrash && (
        <TrashView
          trashedFiles={trashedFiles}
          trashedProjects={trashedProjects}
          onRestoreFile={(id) => void handleRestoreFile(id)}
          onRestoreProject={(id) => void handleRestoreProject(id)}
        />
      )}

      {pendingConflict && (
        <ConfirmMoveDialog
          conflictingName={pendingConflict.name}
          onCancel={() => setPendingConflict(null)}
          onRename={handleConflictRename}
          onOverwrite={handleConflictOverwrite}
        />
      )}

      {pendingDeleteProject && (
        <ConfirmDeleteProjectDialog
          project={pendingDeleteProject.project}
          fileCount={pendingDeleteProject.fileCount}
          otherProjects={allProjectsUnfiltered.filter((p) => p.id !== pendingDeleteProject.project.id)}
          onCancel={() => setPendingDeleteProject(null)}
          onConfirm={(strategy) => void handleConfirmDeleteProjectCascade(strategy)}
        />
      )}

      {pendingRootCreate && (
        <div class="files-dialog-backdrop" onClick={() => setPendingRootCreate(null)}>
          <div class="files-dialog" onClick={(event) => event.stopPropagation()}>
            <h3>Choose a variant</h3>
            <p>Root has no project to inherit from — files here need an explicit game variant.</p>
            <select
              aria-label="Root file variant"
              value={rootCreateVariant}
              onChange={(event) => setRootCreateVariant((event.target as HTMLSelectElement).value as GameVariant)}
            >
              {GAME_VARIANTS.map((variant) => (
                <option key={variant} value={variant}>
                  {variant}
                </option>
              ))}
            </select>
            <div class="files-dialog-actions">
              <button type="button" onClick={() => setPendingRootCreate(null)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const { name, text } = pendingRootCreate;
                  setPendingRootCreate(null);
                  void attemptCreateFile(name, null, rootCreateVariant, text);
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showStorageWarning && (
        <div class="files-dialog-backdrop" onClick={() => setShowStorageWarning(false)}>
          <div class="files-dialog" onClick={(event) => event.stopPropagation()}>
            <h3>Files are stored only in this browser</h3>
            <p>
              Your files are saved locally in this browser's storage. If you clear your browser's
              site data (or switch browsers/devices), they will be lost — download anything
              important as a backup.
            </p>
            <div class="files-dialog-actions">
              <button type="button" onClick={() => setShowStorageWarning(false)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
