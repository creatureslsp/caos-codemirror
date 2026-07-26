/** Combined view of soft-deleted files and projects, with per-item restore. */
import type { CaosFile } from "../storage/files.js";
import type { CaosProject } from "../storage/projects.js";
import { formatRelativeDate } from "./format.js";

export interface TrashViewProps {
  trashedFiles: CaosFile[];
  trashedProjects: CaosProject[];
  onRestoreFile: (id: string) => void;
  onRestoreProject: (id: string) => void;
}

export function TrashView(props: TrashViewProps) {
  const { trashedFiles, trashedProjects, onRestoreFile, onRestoreProject } = props;

  if (trashedFiles.length === 0 && trashedProjects.length === 0) {
    return <p class="files-empty">Trash is empty.</p>;
  }

  return (
    <ul class="files-trash-list">
      {trashedProjects.map((project) => (
        <li key={`project-${project.id}`} class="files-row">
          <span class="files-row-name">
            📁 {project.name}
            <span class="files-row-meta">deleted {formatRelativeDate(project.deletedDate ?? Date.now())}</span>
          </span>
          <button type="button" onClick={() => onRestoreProject(project.id)}>
            Restore
          </button>
        </li>
      ))}
      {trashedFiles.map((file) => (
        <li key={`file-${file.id}`} class="files-row">
          <span class="files-row-name">
            {file.name}
            <span class="files-row-meta">deleted {formatRelativeDate(file.deletedDate ?? Date.now())}</span>
          </span>
          <button type="button" onClick={() => onRestoreFile(file.id)}>
            Restore
          </button>
        </li>
      ))}
    </ul>
  );
}
