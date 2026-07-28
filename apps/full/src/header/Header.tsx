/**
 * Persistent header bar above the editor (mobile-first, always visible --
 * unlike the hamburger sheet, which is hidden until opened). Owns the
 * filename button (opens `FileSelectPopover`), New file / Open from disk /
 * Download (moved here from the sheet's file-browser toolbar, now this
 * effort's only home for those three actions), a compact variant control,
 * and `ActiveFileMenu`'s "⋯" (rename/move/delete the open file).
 *
 * New-file/open-from-disk creation targets whatever project scope
 * `browsing-state.ts`'s shared signal currently points at -- the same
 * scope the sheet's own ProjectSwitcher shows/persists.
 */
import { useState } from "preact/hooks";
import type { GameVariant } from "@creatures-codemirror/engine";
import { GAME_VARIANTS } from "@creatures-codemirror/engine";
import { createFile, NameConflictError, type CaosFile } from "../storage/files.js";
import { getEffectiveVariant, getProject } from "../storage/projects.js";
import { kvGet, kvSet } from "../storage/db.js";
import { downloadAsCosFile, pickCosFileFromDisk } from "../files/file-io.js";
import { NewFileIcon, OpenFileIcon, DownloadIcon, ExpandMoreIcon } from "../icons.js";
import { ConfirmMoveDialog } from "../files/ConfirmMoveDialog.js";
import { activeFile, currentVariant, pendingVariantPrompt, activeProject } from "../files/active-file-store.js";
import { browsingProjectId } from "../files/browsing-state.js";
import { bumpFilesRevision } from "../files/refresh-bus.js";
import { VariantChangePrompt } from "../variant-change-prompt.js";
import { FileSelectPopover } from "./FileSelectPopover.js";
import { ActiveFileMenu } from "./ActiveFileMenu.js";

export interface HeaderProps {
  getEditorText: () => string;
  onFileOpened: (file: CaosFile, effectiveVariant: GameVariant) => void;
  onDeleteActiveFileFallback: () => void;
  onRequestVariantChange: (variant: GameVariant) => void;
  onVariantPromptFileOnly: () => void;
  onVariantPromptWholeProject: () => void;
  onVariantPromptCancel: () => void;
}

const STORAGE_WARNING_KV_KEY = "hasSeenStorageWarning";

type PendingConflict = { parentProjectId: string | null; variant: GameVariant | null; text: string; name: string };

export function Header(props: HeaderProps) {
  const {
    getEditorText,
    onFileOpened,
    onDeleteActiveFileFallback,
    onRequestVariantChange,
    onVariantPromptFileOnly,
    onVariantPromptWholeProject,
    onVariantPromptCancel,
  } = props;

  const [filePopoverOpen, setFilePopoverOpen] = useState(false);
  const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(null);
  const [pendingRootCreate, setPendingRootCreate] = useState<{ name: string; text: string } | null>(null);
  const [rootCreateVariant, setRootCreateVariant] = useState<GameVariant>(GAME_VARIANTS[0]);
  const [showStorageWarning, setShowStorageWarning] = useState(false);

  const file = activeFile.value;

  async function maybeShowStorageWarning(): Promise<void> {
    const seen = await kvGet<boolean>(STORAGE_WARNING_KV_KEY);
    if (!seen) {
      setShowStorageWarning(true);
      await kvSet(STORAGE_WARNING_KV_KEY, true);
    }
  }

  async function attemptCreateFile(
    name: string,
    parentProjectId: string | null,
    variant: GameVariant | null,
    text: string,
    overwrite = false,
  ): Promise<void> {
    try {
      const created = await createFile({ name, parentProjectId, variant, text });
      bumpFilesRevision();
      await maybeShowStorageWarning();
      const project = parentProjectId === null ? null : await getProject(parentProjectId);
      onFileOpened(created, getEffectiveVariant(created, project));
    } catch (err) {
      if (err instanceof NameConflictError) {
        setPendingConflict({ parentProjectId, variant, text, name });
      } else {
        throw err;
      }
    }
  }

  function handleNewFile(): void {
    const name = window.prompt("New file name:");
    if (!name || name.trim() === "") return;
    const trimmed = name.trim();
    const scope = browsingProjectId.value;
    if (scope === null) {
      setPendingRootCreate({ name: trimmed, text: "" });
    } else {
      void attemptCreateFile(trimmed, scope, null, "");
    }
  }

  async function handleOpenFromDisk(): Promise<void> {
    const picked = await pickCosFileFromDisk();
    const name = picked.name.replace(/\.cos$/i, "");
    const scope = browsingProjectId.value;
    if (scope === null) {
      setPendingRootCreate({ name, text: picked.text });
    } else {
      await attemptCreateFile(name, scope, null, picked.text);
    }
  }

  function handleDownload(): void {
    downloadAsCosFile(file?.name ?? "untitled", getEditorText());
  }

  const prompt = pendingVariantPrompt.value;

  return (
    <div class="app-header">
      <button
        type="button"
        class="app-header-filename"
        aria-haspopup="true"
        aria-expanded={filePopoverOpen}
        onClick={() => setFilePopoverOpen((open) => !open)}
      >
        <span class="app-header-filename-text">{file?.name ?? "Untitled"}</span>
        <span class="app-header-filename-caret">
          <ExpandMoreIcon />
        </span>
      </button>

      <div class="app-header-actions">
        <button type="button" class="icon-btn header-icon-btn" title="New file" aria-label="New file" onClick={handleNewFile}>
          <NewFileIcon />
        </button>
        <button
          type="button"
          class="icon-btn header-icon-btn"
          title="Open from disk"
          aria-label="Open from disk"
          onClick={() => void handleOpenFromDisk()}
        >
          <OpenFileIcon />
        </button>
        <button
          type="button"
          class="icon-btn header-icon-btn"
          title="Download current file"
          aria-label="Download current file"
          onClick={handleDownload}
        >
          <DownloadIcon />
        </button>
        <select
          class="app-header-variant"
          aria-label="CAOS game variant"
          value={currentVariant.value ?? undefined}
          onChange={(event) => onRequestVariantChange((event.target as HTMLSelectElement).value as GameVariant)}
        >
          {GAME_VARIANTS.map((variant) => (
            <option key={variant} value={variant}>
              {variant}
            </option>
          ))}
        </select>
        <ActiveFileMenu onDeleteFallback={onDeleteActiveFileFallback} />
      </div>

      {filePopoverOpen && (
        <FileSelectPopover onFileOpened={onFileOpened} onClose={() => setFilePopoverOpen(false)} />
      )}

      {prompt && activeProject.value && (
        <VariantChangePrompt
          fileName={file?.name ?? ""}
          projectName={activeProject.value.name}
          variant={prompt.variant}
          onFileOnly={onVariantPromptFileOnly}
          onWholeProject={onVariantPromptWholeProject}
          onCancel={onVariantPromptCancel}
        />
      )}

      {pendingConflict && (
        <ConfirmMoveDialog
          conflictingName={pendingConflict.name}
          onCancel={() => setPendingConflict(null)}
          onRename={(newName) => {
            const conflict = pendingConflict;
            setPendingConflict(null);
            void attemptCreateFile(newName, conflict.parentProjectId, conflict.variant, conflict.text);
          }}
          onOverwrite={() => {
            const conflict = pendingConflict;
            setPendingConflict(null);
            void attemptCreateFile(conflict.name, conflict.parentProjectId, conflict.variant, conflict.text, true);
          }}
        />
      )}

      {pendingRootCreate && (
        <div class="files-dialog-backdrop" onClick={() => setPendingRootCreate(null)}>
          <div class="files-dialog" onClick={(event) => event.stopPropagation()}>
            <h3>Choose a variant</h3>
            <p>Root has no project to inherit from — files here need an explicit game variant.</p>
            <select
              aria-label="Root file variant"
              value={rootCreateVariant}
              onChange={(event) => setRootCreateVariant((event.target as HTMLSelectElement).value as GameVariant)}
            >
              {GAME_VARIANTS.map((variant) => (
                <option key={variant} value={variant}>
                  {variant}
                </option>
              ))}
            </select>
            <div class="files-dialog-actions">
              <button type="button" onClick={() => setPendingRootCreate(null)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const { name, text } = pendingRootCreate;
                  setPendingRootCreate(null);
                  void attemptCreateFile(name, null, rootCreateVariant, text);
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showStorageWarning && (
        <div class="files-dialog-backdrop" onClick={() => setShowStorageWarning(false)}>
          <div class="files-dialog" onClick={(event) => event.stopPropagation()}>
            <h3>Files are stored only in this browser</h3>
            <p>
              Your files are saved locally in this browser's storage. If you clear your browser's
              site data (or switch browsers/devices), they will be lost — download anything
              important as a backup.
            </p>
            <div class="files-dialog-actions">
              <button type="button" onClick={() => setShowStorageWarning(false)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
