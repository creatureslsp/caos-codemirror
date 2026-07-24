// Synthesizes cancellation locally inside the worker, since closures cannot
// cross a postMessage boundary (plan/00-risks-and-verified-facts.md risk #3).
// The main thread never sends a function — only a {type:"cancel", id}
// message that flips a flag this module owns.

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
