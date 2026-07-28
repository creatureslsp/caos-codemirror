/** Files in the active project/root, with a per-row actions menu for rename/move/delete. */
import { useEffect, useRef, useState } from "preact/hooks";
import type { CaosFile } from "../storage/files.js";
import type { CaosProject } from "../storage/projects.js";
import { getEffectiveVariant } from "../storage/projects.js";
import { formatRelativeDate } from "./format.js";
import { MoreVertIcon } from "../icons.js";

export interface FileListProps {
  files: CaosFile[];
  /** The project the listed files belong to, or `null` at root. */
  activeProject: CaosProject | null;
  /** Other projects a file can be moved into (excludes `activeProject`). */
  moveTargets: { id: string | null; name: string }[];
  activeFileId: string | null;
  onOpenFile: (file: CaosFile) => void;
  onRenameFile: (id: string, newName: string) => void;
  onDeleteFile: (id: string) => void;
  onMoveFile: (id: string, targetProjectId: string | null) => void;
}

export function FileList(props: FileListProps) {
  const { files, activeProject, moveTargets, activeFileId, onOpenFile, onRenameFile, onDeleteFile, onMoveFile } =
    props;

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [movingId, setMovingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Closes the open actions menu on an outside click or Escape. Listening on
  // `mousedown` (not `click`) means this runs *before* the trigger button's
  // own `onClick` toggle, so clicking the trigger while its menu is open
  // still lands on a single, correct closed-then-toggled state rather than
  // fighting it.
  useEffect(() => {
    if (openMenuId === null) return;
    function handlePointerDown(event: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") setOpenMenuId(null);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuId]);

  if (files.length === 0) {
    return <p class="files-empty">No files here yet.</p>;
  }

  return (
    <ul class="files-list">
      {files.map((file) => {
        const effectiveVariant = getEffectiveVariant(file, activeProject);
        const isRenaming = renamingId === file.id;
        const isMoving = movingId === file.id;
        const isMenuOpen = openMenuId === file.id;

        return (
          <li key={file.id} class={file.id === activeFileId ? "files-row files-row--active" : "files-row"}>
            {isRenaming ? (
              <input
                type="text"
                class="files-rename-input"
                value={renameValue}
                autoFocus
                onInput={(event) => setRenameValue((event.target as HTMLInputElement).value)}
                onBlur={() => setRenamingId(null)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && renameValue.trim() !== "") {
                    onRenameFile(file.id, renameValue.trim());
                    setRenamingId(null);
                  } else if (event.key === "Escape") {
                    setRenamingId(null);
                  }
                }}
              />
            ) : (
              <button type="button" class="files-row-name" onClick={() => onOpenFile(file)}>
                {file.name}
                <span class="files-row-meta">
                  {effectiveVariant} · {formatRelativeDate(file.lastModifiedDate)}
                </span>
              </button>
            )}

            <div class="files-row-actions">
              <button
                type="button"
                class="icon-btn files-row-menu-trigger"
                aria-label={`Actions for ${file.name}`}
                aria-haspopup="true"
                aria-expanded={isMenuOpen}
                onClick={() => setOpenMenuId(isMenuOpen ? null : file.id)}
              >
                <MoreVertIcon />
              </button>
              {isMenuOpen && (
                <div class="files-row-menu" role="menu" ref={menuRef}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setRenamingId(file.id);
                      setRenameValue(file.name);
                      setOpenMenuId(null);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMovingId(isMoving ? null : file.id);
                      setOpenMenuId(null);
                    }}
                  >
                    Move
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onDeleteFile(file.id);
                      setOpenMenuId(null);
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>

            {isMoving && (
              <div class="files-row-move">
                <select
                  aria-label={`Move ${file.name} to`}
                  onChange={(event) => {
                    const value = (event.target as HTMLSelectElement).value;
                    onMoveFile(file.id, value === "" ? null : value);
                    setMovingId(null);
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
          </li>
        );
      })}
    </ul>
  );
}
