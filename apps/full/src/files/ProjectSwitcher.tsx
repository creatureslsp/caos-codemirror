/** Lists root + real projects, lets the user switch the active project context or create a new one. */
import { useState } from "preact/hooks";
import type { GameVariant } from "@creatures-codemirror/engine";
import { GAME_VARIANTS } from "@creatures-codemirror/engine";
import type { CaosProject } from "../storage/projects.js";

export interface ProjectSwitcherProps {
  projects: CaosProject[];
  activeProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onCreateProject: (name: string, variant: GameVariant) => void;
  onRenameProject: (id: string, newName: string) => void;
  onRequestDeleteProject: (project: CaosProject) => void;
}

export function ProjectSwitcher(props: ProjectSwitcherProps) {
  const {
    projects,
    activeProjectId,
    onSelectProject,
    onCreateProject,
    onRenameProject,
    onRequestDeleteProject
  } = props;

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newVariant, setNewVariant] = useState<GameVariant>(GAME_VARIANTS[0]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  function submitCreate(): void {
    const trimmed = newName.trim();
    if (trimmed === "") return;
    onCreateProject(trimmed, newVariant);
    setNewName("");
    setCreating(false);
  }

  return (
    <div class="files-project-switcher">
      <div class="files-project-list" role="tablist" aria-label="Projects">
        <button
          type="button"
          role="tab"
          aria-selected={activeProjectId === null}
          class={activeProjectId === null ? "files-project-chip files-project-chip--active" : "files-project-chip"}
          onClick={() => onSelectProject(null)}
        >
          Root
        </button>
        {projects.map((project) =>
          renamingId === project.id ? (
            <input
              key={project.id}
              type="text"
              class="files-project-rename-input"
              value={renameValue}
              autoFocus
              onInput={(event) => setRenameValue((event.target as HTMLInputElement).value)}
              onBlur={() => setRenamingId(null)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && renameValue.trim() !== "") {
                  onRenameProject(project.id, renameValue.trim());
                  setRenamingId(null);
                } else if (event.key === "Escape") {
                  setRenamingId(null);
                }
              }}
            />
          ) : (
            <button
              key={project.id}
              type="button"
              role="tab"
              aria-selected={activeProjectId === project.id}
              class={
                activeProjectId === project.id
                  ? "files-project-chip files-project-chip--active"
                  : "files-project-chip"
              }
              onClick={() => onSelectProject(project.id)}
              onDblClick={() => {
                setRenamingId(project.id);
                setRenameValue(project.name);
              }}
            >
              {project.name}
              <span
                class="files-project-delete"
                role="button"
                aria-label={`Delete project ${project.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onRequestDeleteProject(project);
                }}
              >
                ×
              </span>
            </button>
          )
        )}
      </div>

      {creating ? (
        <div class="files-project-create-form">
          <input
            type="text"
            placeholder="Project name"
            aria-label="New project name"
            value={newName}
            autoFocus
            onInput={(event) => setNewName((event.target as HTMLInputElement).value)}
          />
          <select
            aria-label="New project variant"
            value={newVariant}
            onChange={(event) => setNewVariant((event.target as HTMLSelectElement).value as GameVariant)}
          >
            {GAME_VARIANTS.map((variant) => (
              <option key={variant} value={variant}>
                {variant}
              </option>
            ))}
          </select>
          <button type="button" onClick={submitCreate} disabled={newName.trim() === ""}>
            Create
          </button>
          <button type="button" onClick={() => setCreating(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" class="files-project-create-button" onClick={() => setCreating(true)}>
          + New project
        </button>
      )}
    </div>
  );
}
