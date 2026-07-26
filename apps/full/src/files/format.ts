/** Relative-time formatting shared by FileList/TrashView row labels. */
export function formatRelativeDate(timestampMs: number, now: number = Date.now()): string {
  const diffMs = now - timestampMs;
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(timestampMs).toLocaleDateString();
}
