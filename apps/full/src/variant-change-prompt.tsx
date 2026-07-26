/**
 * Confirmation dialog for `main.ts`'s variant-picker handling: changing the
 * variant of a file that belongs to a project is ambiguous (just this file,
 * or every file in the project?), per
 * `../../plan-webapp/04-variant-persistence-autosave.md`. Root-project files
 * never reach this component — that case is applied directly, no prompt.
 */
import type { GameVariant } from "@creatures-codemirror/engine";

export interface VariantChangePromptProps {
  fileName: string;
  projectName: string;
  variant: GameVariant;
  onFileOnly: () => void;
  onWholeProject: () => void;
  onCancel: () => void;
}

export function VariantChangePrompt(props: VariantChangePromptProps) {
  const { fileName, projectName, variant, onFileOnly, onWholeProject, onCancel } = props;

  return (
    <div class="files-dialog-backdrop" onClick={onCancel}>
      <div class="files-dialog" onClick={(event) => event.stopPropagation()}>
        <h3>Change variant to {variant}?</h3>
        <p>
          "{fileName}" belongs to project "{projectName}". Apply this change to just this file, or
          to every file in the project that doesn't have its own variant override?
        </p>
        <div class="files-dialog-actions files-dialog-actions--stacked">
          <button type="button" onClick={onFileOnly}>
            Just this file
          </button>
          <button type="button" onClick={onWholeProject}>
            Whole project ("{projectName}")
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
