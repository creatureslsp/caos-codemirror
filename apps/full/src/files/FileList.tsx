/** Files in the active project/root, with per-row rename/delete/move/variant-change actions. */
import { useState } from "preact/hooks";
import type { GameVariant } from "@creatures-codemirror/engine";
import { GAME_VARIANTS } from "@creatures-codemirror/engine";
import type { CaosFile } from "../storage/files.js";
import type { CaosProject } from "../storage/projects.js";
import { getEffectiveVariant } from "../storage/projects.js";
import { formatRelativeDate } from "./format.js";

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
  onChangeFileVariant: (id: string, variant: GameVariant | null) => void;
}

export function FileList(props: FileListProps) {
  const {
    files,
    activeProject,
    moveTargets,
    activeFileId,
    onOpenFile,
    onRenameFile,
    onDeleteFile,
    onMoveFile,
    onChangeFileVariant
  } = props;

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [movingId, setMovingId] = useState<string | null>(null);

  if (files.length === 0) {
    return <p class="files-empty">No files here yet.</p>;
  }

  return (
    <ul class="files-list">
      {files.map((file) => {
        const effectiveVariant = getEffectiveVariant(file, activeProject);
        const isRenaming = renamingId === file.id;
        const isMoving = movingId === file.id;

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
              <select
                aria-label={`Variant for ${file.name}`}
                class="files-row-variant-select"
                value={file.variant ?? ""}
                onChange={(event) => {
                  const value = (event.target as HTMLSelectElement).value;
                  onChangeFileVariant(file.id, value === "" ? null : (value as GameVariant));
                }}
              >
                {activeProject !== null && <option value="">Inherit ({activeProject.variant})</option>}
                {GAME_VARIANTS.map((variant) => (
                  <option key={variant} value={variant}>
                    {variant}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setRenamingId(file.id);
                  setRenameValue(file.name);
                }}
              >
                Rename
              </button>
              <button type="button" onClick={() => setMovingId(isMoving ? null : file.id)}>
                Move
              </button>
              <button type="button" onClick={() => onDeleteFile(file.id)}>
                Delete
              </button>
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
