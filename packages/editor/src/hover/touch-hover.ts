// Shared hover fetch+render entry point (plan/05-hover-and-inlay-hints.md):
// used directly by ./hover-tooltip.ts's mouse-driven hoverTooltip source
// below, and reused as-is by Phase 6's touch/tap trigger mechanism so the
// touch UX work (deciding *when* to call this) doesn't duplicate the
// fetch/render logic (deciding *what* to show).
import type { EditorView, Tooltip } from "@codemirror/view";
import type { CaosEngineClient, GameVariant } from "@creatures-codemirror/engine";
import { cmOffsetToLineChar } from "@creatures-codemirror/engine";
import { renderCaosMarkdownLite } from "./markdown-lite.js";

export interface ShowHoverAtOptions {
  client: CaosEngineClient;
  getVariant: () => GameVariant;
}

/** getHoverItem (vs-caos-editor/packages/caos-util/src/hover-documentation.ts)
 * only ever constructs `{kind: 'markdown', value}` (MarkupContent) — never
 * the deprecated MarkedString/MarkedString[] shapes also permitted by
 * Hover.contents' type. Handled defensively anyway since it costs nothing. */
function hoverMarkdown(contents: NonNullable<Awaited<ReturnType<CaosEngineClient["getHover"]>>["hover"]>["contents"]): string {
  if (typeof contents === "string") return contents;
  if (Array.isArray(contents)) {
    return contents.map((c) => (typeof c === "string" ? c : c.value)).join("\n");
  }
  return contents.value;
}

export async function showHoverAt(
  view: EditorView,
  pos: number,
  options: ShowHoverAtOptions,
): Promise<Tooltip | null> {
  const { client, getVariant } = options;
  const text = view.state.doc.toString();
  const variant = getVariant();
  const { line, character } = cmOffsetToLineChar(view.state.doc, pos);

  let response;
  try {
    response = await client.getHover(variant, text, line, character);
  } catch {
    // Cancelled/stale/worker error — no tooltip to show.
    return null;
  }

  // The doc changed while the request was in flight; `pos` no longer
  // refers to the same content. Same belt-and-suspenders pattern as
  // caos-completion-source.ts.
  if (view.state.doc.toString() !== text) return null;
  if (!response.hover) return null;

  const markdown = hoverMarkdown(response.hover.contents);
  if (!markdown) return null;

  return {
    pos,
    create: () => ({ dom: renderCaosMarkdownLite(markdown) }),
  };
}
