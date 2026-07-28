/**
 * Lightweight file-select dropdown opened by tapping the filename in the
 * header -- project chips (select-only, no create/rename/delete -- that
 * stays in the sheet's fuller ProjectSwitcher) plus a plain file list (click
 * to open, no search/sort/trash/per-row menu -- also the sheet's job).
 * Shares `browsing-state.ts`'s scope signal with the sheet's own
 * ProjectSwitcher, so picking a project here or there stays in sync and
 * persists across reloads.
 */
import { useEffect, useState } from "preact/hooks";
import type { GameVariant } from "@creatures-codemirror/engine";
import { listFilesInProject, type CaosFile } from "../storage/files.js";
import { getEffectiveVariant, listProjects, type ProjectListItem } from "../storage/projects.js";
import { browsingProjectId, setBrowsingProjectId } from "../files/browsing-state.js";
import { activeFile } from "../files/active-file-store.js";
import { filesRevision } from "../files/refresh-bus.js";

export interface FileSelectPopoverProps {
  onFileOpened: (file: CaosFile, effectiveVariant: GameVariant) => void;
  onClose: () => void;
}

export function FileSelectPopover(props: FileSelectPopoverProps) {
  const { onFileOpened, onClose } = props;
  const activeProjectId = browsingProjectId.value;

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [files, setFiles] = useState<CaosFile[]>([]);

  useEffect(() => {
    void listProjects().then(setProjects);
  }, [filesRevision.value]);

  useEffect(() => {
    void listFilesInProject(activeProjectId, { sortBy: "name", sortDirection: "asc" }).then(setFiles);
  }, [activeProjectId, filesRevision.value]);

  const activeProject = activeProjectId === null ? null : projects.find((p) => p.id === activeProjectId) ?? null;

  function handleOpen(file: CaosFile): void {
    onFileOpened(file, getEffectiveVariant(file, activeProject));
    onClose();
  }

  return (
    <div class="header-file-popover">
      <div class="files-project-list" role="tablist" aria-label="Projects">
        <button
          type="button"
          role="tab"
          aria-selected={activeProjectId === null}
          class={activeProjectId === null ? "files-project-chip files-project-chip--active" : "files-project-chip"}
          onClick={() => setBrowsingProjectId(null)}
        >
          Root
        </button>
        {projects.map((project) => (
          <button
            type="button"
            role="tab"
            key={project.id}
            aria-selected={activeProjectId === project.id}
            class={
              activeProjectId === project.id ? "files-project-chip files-project-chip--active" : "files-project-chip"
            }
            onClick={() => setBrowsingProjectId(project.id)}
          >
            {project.name}
          </button>
        ))}
      </div>

      {files.length === 0 ? (
        <p class="files-empty">No files here yet.</p>
      ) : (
        <ul class="header-file-popover-list">
          {files.map((file) => (
            <li key={file.id}>
              <button
                type="button"
                class={file.id === activeFile.value?.id ? "files-row-name files-row--active" : "files-row-name"}
                onClick={() => handleOpen(file)}
              >
                {file.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
