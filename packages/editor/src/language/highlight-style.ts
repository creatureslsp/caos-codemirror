// Maps caosTags (see caos-tags.ts) to CSS classes, and ships their actual
// colors via CM6's baseTheme mechanism so consumers get working syntax
// highlighting without importing a separate stylesheet — the idiomatic CM6
// packaging approach. "&dark" selectors apply when the editor's theme
// facet is flagged dark (e.g. a consumer adds
// `EditorView.theme({...}, {dark: true})` or a dark theme package),
// satisfying plan/02-syntax-highlighting.md Layer 1's "light + dark
// variants" requirement.
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

export const caosHighlightTheme = EditorView.baseTheme({
  ".cm-caos-comment": { color: "#6a737d", fontStyle: "italic" },
  "&dark .cm-caos-comment": { color: "#8b949e" },

  ".cm-caos-caos2-directive": { color: "#986801", fontWeight: "bold" },
  "&dark .cm-caos-caos2-directive": { color: "#d29922" },

  ".cm-caos-caos2-eq": { color: "#986801" },
  "&dark .cm-caos-caos2-eq": { color: "#d29922" },

  ".cm-caos-string": { color: "#0a7d34" },
  "&dark .cm-caos-string": { color: "#7ee787" },

  ".cm-caos-escape": { color: "#0550ae", fontWeight: "bold" },
  "&dark .cm-caos-escape": { color: "#79c0ff" },

  ".cm-caos-label": { color: "#8250df", fontWeight: "bold" },
  "&dark .cm-caos-label": { color: "#d2a8ff" },

  ".cm-caos-keyword": { color: "#cf222e", fontWeight: "bold" },
  "&dark .cm-caos-keyword": { color: "#ff7b72" },

  // Deliberately weaker than a Layer-2-confirmed command/rvalue/lvalue
  // color — see stream-parser.ts's header comment.
  ".cm-caos-command-heuristic": { color: "#57606a" },
  "&dark .cm-caos-command-heuristic": { color: "#8b949e" },

  ".cm-caos-number": { color: "#0550ae" },
  "&dark .cm-caos-number": { color: "#79c0ff" },

  ".cm-caos-operator": { color: "#cf222e" },
  "&dark .cm-caos-operator": { color: "#ff7b72" },
});
