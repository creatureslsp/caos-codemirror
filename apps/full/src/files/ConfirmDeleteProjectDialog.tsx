/** Delete-all / move-to-root / move-to-other-project cascade prompt for a non-empty project. */
import { useState } from "preact/hooks";
import type { CaosProject, DeleteProjectStrategy } from "../storage/projects.js";

export interface ConfirmDeleteProjectDialogProps {
  project: CaosProject;
  fileCount: number;
  /** Other live projects a user could move files into instead. */
  otherProjects: CaosProject[];
  onCancel: () => void;
  onConfirm: (strategy: DeleteProjectStrategy) => void;
}

export function ConfirmDeleteProjectDialog(props: ConfirmDeleteProjectDialogProps) {
  const { project, fileCount, otherProjects, onCancel, onConfirm } = props;
  const [moveTargetId, setMoveTargetId] = useState(otherProjects[0]?.id ?? "");

  return (
    <div class="files-dialog-backdrop" onClick={onCancel}>
      <div class="files-dialog" onClick={(event) => event.stopPropagation()}>
        <h3>Delete "{project.name}"?</h3>
        <p>
          This project has {fileCount} file{fileCount === 1 ? "" : "s"}. Choose what happens to
          them before the project is deleted.
        </p>
        <div class="files-dialog-actions files-dialog-actions--stacked">
          <button type="button" onClick={() => onConfirm("delete-all")}>
            Delete project and all its files
          </button>
          <button type="button" onClick={() => onConfirm("move-to-root")}>
            Move files to root, then delete project
          </button>
          {otherProjects.length > 0 && (
            <div class="files-dialog-move-row">
              <select
                aria-label="Move files to project"
                value={moveTargetId}
                onChange={(event) => setMoveTargetId((event.target as HTMLSelectElement).value)}
              >
                {otherProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onConfirm({ moveToProjectId: moveTargetId })}
                disabled={moveTargetId === ""}
              >
                Move files here, then delete project
              </button>
            </div>
          )}
        </div>
        <div class="files-dialog-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
