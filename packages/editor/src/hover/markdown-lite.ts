// Minimal Markdown-ish renderer for hover tooltips. Renders bold text and line breaks safely.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Pure string transform, kept separate from the DOM-touching wrapper below
 * so it's directly unit-testable under vitest's node environment (no jsdom
 * dependency needed — see markdown-lite.test.ts). */
export function caosMarkdownLiteToHtml(markdown: string): string {
  const escaped = escapeHtml(markdown);
  const withBold = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // "   \n" (LSP markdown hard line break: trailing spaces + newline) and
  // plain "\n" (within multi-line descriptions) both become <br>.
  return withBold.replace(/ *\n/g, "<br>");
}

export function renderCaosMarkdownLite(markdown: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "cm-caos-markdown-lite";
  el.innerHTML = caosMarkdownLiteToHtml(markdown);
  return el;
}
