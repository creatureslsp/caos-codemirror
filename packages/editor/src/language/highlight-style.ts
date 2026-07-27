// Highlight style definition mapping caosTags to CSS classes with theme support.
import { HighlightStyle } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { caosTags } from "./caos-tags.js";

export const caosHighlightStyle = HighlightStyle.define([
  { tag: caosTags.lineComment, class: "cm-caos-comment" },
  { tag: caosTags.caos2Directive, class: "cm-caos-caos2-directive" },
  { tag: caosTags.caos2Eq, class: "cm-caos-caos2-eq" },
  { tag: caosTags.string, class: "cm-caos-string" },
  { tag: caosTags.escape, class: "cm-caos-escape" },
  { tag: caosTags.labelName, class: "cm-caos-label" },
  { tag: caosTags.controlKeyword, class: "cm-caos-keyword" },
  { tag: caosTags.commandHeuristic, class: "cm-caos-command-heuristic" },
  { tag: caosTags.number, class: "cm-caos-number" },
  { tag: caosTags.compareOperator, class: "cm-caos-operator" },
]);

// CSS-custom-property convention matching semantic-tokens-theme.ts/
// inlay-hint-theme.ts/touch-theme.ts: every color is `var(--caos-<name>,
// <this-hex>)` so an unset override is visually identical to today, and
// `--caos-string`/`--caos-number` intentionally reuse the same variable
// names semantic-tokens-theme.ts already defines for its Layer-2
// `string`/`number` token types (same colors today) rather than minting
// Layer-1-only duplicates, so a single override colors both layers.
export const caosHighlightTheme = EditorView.baseTheme({
  ".cm-caos-comment": { color: "var(--caos-comment, #6a737d)", fontStyle: "italic" },
  "&dark .cm-caos-comment": { color: "var(--caos-comment-dark, #8b949e)" },

  ".cm-caos-caos2-directive": { color: "var(--caos-caos2-directive, #986801)", fontWeight: "bold" },
  "&dark .cm-caos-caos2-directive": { color: "var(--caos-caos2-directive-dark, #d29922)" },

  ".cm-caos-caos2-eq": { color: "var(--caos-caos2-eq, #986801)" },
  "&dark .cm-caos-caos2-eq": { color: "var(--caos-caos2-eq-dark, #d29922)" },

  ".cm-caos-string": { color: "var(--caos-string, #0a7d34)" },
  "&dark .cm-caos-string": { color: "var(--caos-string-dark, #7ee787)" },

  ".cm-caos-escape": { color: "var(--caos-escape, #0550ae)", fontWeight: "bold" },
  "&dark .cm-caos-escape": { color: "var(--caos-escape-dark, #79c0ff)" },

  ".cm-caos-label": { color: "var(--caos-label, #8250df)", fontWeight: "bold" },
  "&dark .cm-caos-label": { color: "var(--caos-label-dark, #d2a8ff)" },

  ".cm-caos-keyword": { color: "var(--caos-keyword, #cf222e)", fontWeight: "bold" },
  "&dark .cm-caos-keyword": { color: "var(--caos-keyword-dark, #ff7b72)" },

  // Deliberately weaker than a Layer-2-confirmed command/rvalue/lvalue
  // color — see stream-parser.ts's header comment.
  ".cm-caos-command-heuristic": { color: "var(--caos-command-heuristic, #57606a)" },
  "&dark .cm-caos-command-heuristic": { color: "var(--caos-command-heuristic-dark, #8b949e)" },

  ".cm-caos-number": { color: "var(--caos-number, #0550ae)" },
  "&dark .cm-caos-number": { color: "var(--caos-number-dark, #79c0ff)" },

  ".cm-caos-operator": { color: "var(--caos-operator, #cf222e)" },
  "&dark .cm-caos-operator": { color: "var(--caos-operator-dark, #ff7b72)" },
});
