/**
 * Shared "which project scope am I currently browsing" state -- the project
 * chip selected in FileBrowser's own switcher (sheet) and, now, in the
 * header's lightweight FileSelectPopover. A single signal so switching scope
 * in either place is reflected in the other, and persisted to `kv` so it
 * survives a reload (per plan-webapp's file-selection requirements).
 */
import { signal } from "@preact/signals";
import { kvGet, kvSet } from "../storage/db.js";
import { listProjects } from "../storage/projects.js";

const LAST_ACTIVE_PROJECT_ID_KEY = "lastActiveProjectId";

export const browsingProjectId = signal<string | null>(null);

/**
 * Hydrates from `kv` at boot, validated against currently-live (non-deleted)
 * projects -- a stored id pointing at a hard-deleted (or never-restored,
 * trashed) project falls back to root rather than leaving the UI pointed at
 * a project that can no longer be listed.
 */
export async function loadBrowsingProjectId(): Promise<void> {
  const stored = await kvGet<string | null>(LAST_ACTIVE_PROJECT_ID_KEY);
  if (!stored) {
    browsingProjectId.value = null;
    return;
  }
  const live = await listProjects();
  browsingProjectId.value = live.some((p) => p.id === stored) ? stored : null;
}

export function setBrowsingProjectId(id: string | null): void {
  browsingProjectId.value = id;
  void kvSet(LAST_ACTIVE_PROJECT_ID_KEY, id);
}
