/**
 * Phase 03 container: composes the project/file browser inside Phase 01's
 * menu sheet. Owns search/sort/trash/list state locally; the "which project
 * am I browsing" scope and "which file is open" identity are shared signals
 * (`browsing-state.ts`/`active-file-store.ts`) so the header's
 * FileSelectPopover/ActiveFileMenu and this sheet stay in sync -- `main.ts`
 * only needs to know when a file was opened here (so it can load its text
 * into the editor).
 *
 * New file / open from disk / download moved to the header (`../header/`),
 * which is now the only place those three actions live.
 */
import { useEffect, useState } from "preact/hooks";
import type { GameVariant } from "@creatures-codemirror/engine";
import {
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
import type { SortDirection, SortField } from "../storage/search.js";
import { ProjectSwitcher } from "./ProjectSwitcher.js";
import { FileList } from "./FileList.js";
import { SearchBar } from "./SearchBar.js";
import { SortControl } from "./SortControl.js";
import { ConfirmMoveDialog } from "./ConfirmMoveDialog.js";
import { ConfirmDeleteProjectDialog } from "./ConfirmDeleteProjectDialog.js";
import { TrashView } from "./TrashView.js";
import { browsingProjectId, setBrowsingProjectId } from "./browsing-state.js";
import { activeFile as activeFileSignal } from "./active-file-store.js";
import { filesRevision } from "./refresh-bus.js";

export interface FileBrowserProps {
  onFileOpened: (file: CaosFile, effectiveVariant: GameVariant) => void;
}

type PendingConflict =
  | { kind: "rename"; fileId: string; name: string }
  | { kind: "move"; fileId: string; targetProjectId: string | null; name: string };

export function FileBrowser(props: FileBrowserProps) {
  const { onFileOpened } = props;

  const activeProjectId = browsingProjectId.value;

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

  // Clears `files` in the same render pass as switching scope so `files`/
  // `activeProject` never disagree mid-render: FileList's
  // `getEffectiveVariant(file, activeProject)` call throws synchronously for
  // a null-variant file whose (stale) parent project no longer matches the
  // newly active one — crashing Preact's render pass, not just producing a
  // wrong-but-recoverable result.
  function switchActiveProject(id: string | null): void {
    // No-op when already on `id`: clearing `files` here would wipe the list
    // with nothing to repopulate it, since the effect below only refetches
    // when `activeProjectId` actually *changes* value.
    if (id === activeProjectId) return;
    setFiles([]);
    setBrowsingProjectId(id);
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
    // Also refetch on any header-triggered mutation (new/open/rename/move/
    // delete on the active file) -- see refresh-bus.ts.
  }, [activeProjectId, searchQuery, sortBy, sortDirection, filesRevision.value]);

  const activeProject: CaosProject | null =
    activeProjectId === null ? null : allProjectsUnfiltered.find((p) => p.id === activeProjectId) ?? null;

  const moveTargets: { id: string | null; name: string }[] =
    activeProjectId === null
      ? allProjectsUnfiltered.map((p) => ({ id: p.id, name: p.name }))
      : [
          { id: null, name: "Root" },
          ...allProjectsUnfiltered.filter((p) => p.id !== activeProjectId).map((p) => ({ id: p.id, name: p.name }))
        ];

  function handleOpenFile(file: CaosFile): void {
    const parentProject =
      file.parentProjectId === null ? null : allProjectsUnfiltered.find((p) => p.id === file.parentProjectId) ?? null;
    const effectiveVariant = getEffectiveVariant(file, parentProject);
    onFileOpened(file, effectiveVariant);
  }

  async function attemptRenameFile(fileId: string, newName: string, overwrite = false): Promise<void> {
    try {
      const updated = await renameFile(fileId, newName, { overwrite });
      await refreshAll();
      if (activeFileSignal.value?.id === fileId) activeFileSignal.value = updated;
    } catch (err) {
      if (err instanceof NameConflictError) {
        setPendingConflict({ kind: "rename", fileId, name: newName });
      } else {
        throw err;
      }
    }
  }

  async function attemptMoveFile(fileId: string, targetProjectId: string | null, overwrite = false): Promise<void> {
    const name = files.find((f) => f.id === fileId)?.name ?? activeFileSignal.value?.name ?? "";
    try {
      const updated =
        targetProjectId === null
          ? await moveFileToRoot(fileId, { overwrite })
          : await moveFileToProject(fileId, targetProjectId, { overwrite });
      await refreshAll();
      if (activeFileSignal.value?.id === fileId) activeFileSignal.value = updated;
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
    if (conflict.kind === "rename") {
      void attemptRenameFile(conflict.fileId, newName);
    } else {
      void renameFile(conflict.fileId, newName).then(() => attemptMoveFile(conflict.fileId, conflict.targetProjectId));
    }
  }

  function handleConflictOverwrite(): void {
    if (!pendingConflict) return;
    const conflict = pendingConflict;
    setPendingConflict(null);
    if (conflict.kind === "rename") {
      void attemptRenameFile(conflict.fileId, conflict.name, true);
    } else {
      void attemptMoveFile(conflict.fileId, conflict.targetProjectId, true);
    }
  }

  async function handleDeleteFile(id: string): Promise<void> {
    await softDeleteFile(id);
    await refreshAll();
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

      <FileList
        files={files}
        activeProject={activeProject}
        moveTargets={moveTargets}
        activeFileId={activeFileSignal.value?.id ?? null}
        onOpenFile={handleOpenFile}
        onRenameFile={(id, newName) => void attemptRenameFile(id, newName)}
        onDeleteFile={(id) => void handleDeleteFile(id)}
        onMoveFile={(id, targetProjectId) => void attemptMoveFile(id, targetProjectId)}
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
    </div>
  );
}
