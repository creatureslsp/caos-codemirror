/** Stop/rename/overwrite prompt for a name collision on rename or move-into-project. */
import { useState } from "preact/hooks";

export interface ConfirmMoveDialogProps {
  /** The name that collided in the destination scope. */
  conflictingName: string;
  onCancel: () => void;
  onRename: (newName: string) => void;
  onOverwrite: () => void;
}

export function ConfirmMoveDialog(props: ConfirmMoveDialogProps) {
  const { conflictingName, onCancel, onRename, onOverwrite } = props;
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(conflictingName);

  return (
    <div class="files-dialog-backdrop" onClick={onCancel}>
      <div class="files-dialog" onClick={(event) => event.stopPropagation()}>
        <h3>Name already in use</h3>
        <p>
          A file named "{conflictingName}" already exists here. Rename the new file, overwrite
          the existing one, or cancel.
        </p>
        {renaming ? (
          <>
            <input
              type="text"
              value={newName}
              aria-label="New name"
              onInput={(event) => setNewName((event.target as HTMLInputElement).value)}
            />
            <div class="files-dialog-actions">
              <button type="button" onClick={onCancel}>
                Cancel
              </button>
              <button type="button" onClick={() => onRename(newName)} disabled={newName.trim() === ""}>
                Save as new name
              </button>
            </div>
          </>
        ) : (
          <div class="files-dialog-actions">
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" onClick={() => setRenaming(true)}>
              Rename
            </button>
            <button type="button" onClick={onOverwrite}>
              Overwrite
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
