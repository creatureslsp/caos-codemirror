// Shared minimal Markdown-ish renderer for hover tooltips
// (./hover-tooltip.ts). Deliberately not a full markdown parser:
// formatCaosDocumentation's actual output shape (verified in
// vs-caos-editor/packages/caos-util/src/documentation-formattter.ts before
// writing this file) is always `**COMMAND** (returnType) **param**
// (type@ValuesListName)...` followed by a `"   \n"`-joined (LSP hard-break)
// description — only `**bold**` and line breaks ever appear — so that's all
// this renders. Phase 4's completion `info()` deliberately does *not* use
// this (item-converter.ts's own note: completion `documentation` is always
// plain text, never markdown).
//
// Input is HTML-escaped first, then only `<strong>`/`<br>` are introduced by
// regexes operating on the already-escaped text — any `<`/`>`/`&` etc. in
// the original content can no longer form a tag, so this is safe against
// content that happens to contain HTML-like text, even though the content
// is effectively static/trusted engine output (defense in depth).
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
