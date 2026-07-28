/**
 * Header's "⋯" menu: Rename/Move/Delete for whichever file is currently
 * open (the shared `activeFile`/`activeProject` signals), independent of
 * FileBrowser's own per-row "⋮" menu in the sheet (which acts on any listed
 * file, not just the open one) -- both call the same storage functions,
 * this one just also has to keep the shared active-file signals and the
 * sheet's own list (via `bumpFilesRevision`) in sync since it lives outside
 * FileBrowser's component instance.
 */
import { useEffect, useRef, useState } from "preact/hooks";
import {
  moveFileToProject,
  moveFileToRoot,
  NameConflictError,
  renameFile,
  softDeleteFile,
} from "../storage/files.js";
import { getProject, listProjects, type ProjectListItem } from "../storage/projects.js";
import { activeFile, activeProject } from "../files/active-file-store.js";
import { bumpFilesRevision } from "../files/refresh-bus.js";
import { ConfirmMoveDialog } from "../files/ConfirmMoveDialog.js";

export interface ActiveFileMenuProps {
  /** Called after the active file is trashed, with a fresh fallback draft already loaded into the editor. */
  onDeleteFallback: () => void;
}

type PendingConflict = { kind: "rename"; name: string } | { kind: "move"; targetProjectId: string | null };

export function ActiveFileMenu(props: ActiveFileMenuProps) {
  const { onDeleteFallback } = props;
  const file = activeFile.value;

  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moveTargets, setMoveTargets] = useState<{ id: string | null; name: string }[]>([]);
  const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open && !moving) return;
    function handlePointerDown(event: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
        setMoving(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setOpen(false);
        setMoving(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, moving]);

  if (!file) return null;

  async function loadMoveTargets(): Promise<void> {
    const all: ProjectListItem[] = await listProjects();
    const currentProjectId = activeProject.value?.id ?? null;
    const targets =
      currentProjectId === null
        ? all.map((p) => ({ id: p.id, name: p.name }))
        : [
            { id: null, name: "Root" },
            ...all.filter((p) => p.id !== currentProjectId).map((p) => ({ id: p.id, name: p.name })),
          ];
    setMoveTargets(targets);
  }

  async function attemptRename(newName: string, overwrite = false): Promise<void> {
    try {
      const updated = await renameFile(file!.id, newName, { overwrite });
      activeFile.value = updated;
      bumpFilesRevision();
    } catch (err) {
      if (err instanceof NameConflictError) {
        setPendingConflict({ kind: "rename", name: newName });
      } else {
        throw err;
      }
    }
  }

  async function attemptMove(targetProjectId: string | null, overwrite = false): Promise<void> {
    try {
      const updated =
        targetProjectId === null
          ? await moveFileToRoot(file!.id, { overwrite })
          : await moveFileToProject(file!.id, targetProjectId, { overwrite });
      activeFile.value = updated;
      activeProject.value = targetProjectId === null ? null : await getProject(targetProjectId);
      bumpFilesRevision();
    } catch (err) {
      if (err instanceof NameConflictError) {
        setPendingConflict({ kind: "move", targetProjectId });
      } else {
        throw err;
      }
    }
  }

  function handleRename(): void {
    setOpen(false);
    const newName = window.prompt("Rename file:", file!.name);
    if (!newName || newName.trim() === "" || newName.trim() === file!.name) return;
    void attemptRename(newName.trim());
  }

  function handleMoveClick(): void {
    setOpen(false);
    setMoving(true);
    void loadMoveTargets();
  }

  function handleDelete(): void {
    setOpen(false);
    void (async () => {
      await softDeleteFile(file!.id);
      bumpFilesRevision();
      onDeleteFallback();
    })();
  }

  function handleConflictRename(newName: string): void {
    if (!pendingConflict) return;
    const conflict = pendingConflict;
    setPendingConflict(null);
    if (conflict.kind === "rename") {
      void attemptRename(newName);
    } else {
      void renameFile(file!.id, newName).then(() => attemptMove(conflict.targetProjectId));
    }
  }

  function handleConflictOverwrite(): void {
    if (!pendingConflict) return;
    const conflict = pendingConflict;
    setPendingConflict(null);
    if (conflict.kind === "rename") {
      void attemptRename(file!.name, true);
    } else {
      void attemptMove(conflict.targetProjectId, true);
    }
  }

  return (
    <div class="header-active-file-menu" ref={menuRef}>
      <button
        type="button"
        class="icon-btn header-icon-btn"
        title="File actions"
        aria-label="File actions"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        ⋯
      </button>
      {open && (
        <div class="header-dropdown" role="menu">
          <button type="button" role="menuitem" onClick={handleRename}>
            Rename
          </button>
          <button type="button" role="menuitem" onClick={handleMoveClick}>
            Move
          </button>
          <button type="button" role="menuitem" onClick={handleDelete}>
            Delete
          </button>
        </div>
      )}
      {moving && (
        <div class="header-dropdown header-move-dropdown">
          <select
            aria-label={`Move ${file.name} to`}
            onChange={(event) => {
              const value = (event.target as HTMLSelectElement).value;
              setMoving(false);
              void attemptMove(value === "" ? null : value);
            }}
          >
            <option value="" selected disabled>
              Choose a destination…
            </option>
            {moveTargets.map((target) => (
              <option key={target.id ?? "root"} value={target.id ?? ""}>
                {target.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {pendingConflict && (
        <ConfirmMoveDialog
          conflictingName={pendingConflict.kind === "rename" ? pendingConflict.name : file.name}
          onCancel={() => setPendingConflict(null)}
          onRename={handleConflictRename}
          onOverwrite={handleConflictOverwrite}
        />
      )}
    </div>
  );
}
