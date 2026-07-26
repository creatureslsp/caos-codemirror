// Tracks request cancellation state inside the worker. Main thread sends
// cancel messages by request ID, flipping flags managed by this module.

interface RequestEntry {
  cancelled: boolean;
}

const pending = new Map<number, RequestEntry>();

export function beginRequest(id: number): void {
  pending.set(id, { cancelled: false });
}

export function endRequest(id: number): void {
  pending.delete(id);
}

export function cancelRequest(id: number): void {
  const entry = pending.get(id);
  if (entry) entry.cancelled = true;
}

/** Returns a `keepGoing`-style closure for caos-kt APIs that accept one. */
export function keepGoingFor(id: number): () => boolean {
  return () => !(pending.get(id)?.cancelled ?? true);
}
