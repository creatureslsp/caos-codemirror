import type { Text } from "@codemirror/state";
import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, type DecorationSet } from "@codemirror/view";
import { lineCharToCmOffset } from "@creatures-codemirror/engine";
import { classNamesFor, decodeSemanticTokens } from "./decode-semantic-tokens.js";
import type { SemanticTokensLegend } from "./legend.js";

/** Builds a CM6 DecorationSet from the worker's raw semanticTokensData.
 * Each decoded token's line-relative position is converted to an absolute
 * CM6 doc offset via Phase 1's positions.ts (lineCharToCmOffset) — semantic
 * tokens use vscode-languageserver-types' 0-indexed Position convention
 * directly, unlike diagnostics' separately-flagged Location.indexing. */
export function buildSemanticDecorations(
  doc: Text,
  data: readonly number[],
  legend: SemanticTokensLegend,
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const token of decodeSemanticTokens(data)) {
    if (token.length <= 0) continue;
    const from = lineCharToCmOffset(doc, token.line, token.character);
    const to = from + token.length;
    if (to <= from || to > doc.length) continue;

    const className = classNamesFor(token, legend).join(" ");
    if (!className) continue;

    builder.add(from, to, Decoration.mark({ class: className }));
  }

  return builder.finish();
}
