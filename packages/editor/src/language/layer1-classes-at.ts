// Layer 1 syntax-highlighting classes at a document position -- the Layer-1
// counterpart to semantic-tokens-plugin.ts's semanticTokenClassesAt().
//
// Needed because click-to-edit token colors (PreviewPanel.tsx) must resolve
// tokens the engine never emits a Layer-2 semantic token for at all (e.g.
// numeric/binary/float/char literals: onInt/onBinary/onFloat/onChar are
// no-op in semantic-highlighter.ts), which are only ever classified here.
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { highlightTree } from "@lezer/highlight";
import { caosHighlightStyle } from "./highlight-style.js";

/** Returns the Layer-1 `cm-caos-*` class names covering `pos` (e.g.
 * `"cm-caos-number"`). Empty array if no styled token covers `pos`. */
export function layer1ClassesAt(state: EditorState, pos: number): string[] {
  const docLength = state.doc.length;
  if (docLength === 0) return [];
  const clamped = Math.max(0, Math.min(pos, docLength - 1));

  const tree = ensureSyntaxTree(state, clamped + 1, 50) ?? syntaxTree(state);
  const classes = new Set<string>();
  highlightTree(
    tree,
    caosHighlightStyle,
    (_from, _to, cls) => {
      for (const c of cls.split(" ")) {
        if (c) classes.add(c);
      }
    },
    clamped,
    clamped + 1,
  );
  return [...classes];
}
