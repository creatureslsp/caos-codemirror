// Additive/overlay styling for Layer 2 (plan/02-syntax-highlighting.md,
// "Reconciliation with Layer 1" — risk #5): these classes never replace
// Layer 1's StreamLanguage base color (../language/highlight-style.ts),
// only layer modifier/identity classes on top via normal CSS cascade, not
// !important overrides. Register this extension after caosLanguageSupport()
// so its rules cascade after Layer 1's for any overlapping span.
//
// Colors are exposed as CSS custom properties (--caos-<type>[-dark]) with
// fallbacks, so a host app can override them to match its own design
// system without forking this stylesheet. Type names are the real,
// code-verified legend (plan/00-risks-and-verified-facts.md risk #10).
import { EditorView } from "@codemirror/view";

export const semanticTokensTheme = EditorView.baseTheme({
  ".cm-caos-sem-command": { color: "var(--caos-command, #8250df)" },
  "&dark .cm-caos-sem-command": { color: "var(--caos-command-dark, #d2a8ff)" },

  ".cm-caos-sem-rvalue": { color: "var(--caos-rvalue, #0550ae)" },
  "&dark .cm-caos-sem-rvalue": { color: "var(--caos-rvalue-dark, #79c0ff)" },

  ".cm-caos-sem-lvalue": { color: "var(--caos-lvalue, #953800)" },
  "&dark .cm-caos-sem-lvalue": { color: "var(--caos-lvalue-dark, #ffa657)" },

  ".cm-caos-sem-string": { color: "var(--caos-string, #0a7d34)" },
  "&dark .cm-caos-sem-string": { color: "var(--caos-string-dark, #7ee787)" },

  ".cm-caos-sem-token": { color: "var(--caos-token, #6e7781)" },
  "&dark .cm-caos-sem-token": { color: "var(--caos-token-dark, #8b949e)" },

  ".cm-caos-sem-variable": { color: "var(--caos-variable, #953800)" },
  "&dark .cm-caos-sem-variable": { color: "var(--caos-variable-dark, #ffa657)" },

  ".cm-caos-sem-unknown-type": { color: "var(--caos-unknown-type, #6e7781)" },
  "&dark .cm-caos-sem-unknown-type": { color: "var(--caos-unknown-type-dark, #8b949e)" },

  ".cm-caos-sem-subroutine-name": {
    color: "var(--caos-subroutine-name, #8250df)",
    fontWeight: "bold",
  },
  "&dark .cm-caos-sem-subroutine-name": { color: "var(--caos-subroutine-name-dark, #d2a8ff)" },

  ".cm-caos-sem-placeholder-text": {
    color: "var(--caos-placeholder-text, #6e7781)",
    fontStyle: "italic",
  },
  "&dark .cm-caos-sem-placeholder-text": { color: "var(--caos-placeholder-text-dark, #8b949e)" },

  ".cm-caos-sem-dde-pict-token": { color: "var(--caos-dde-pict-token, #0550ae)" },
  "&dark .cm-caos-sem-dde-pict-token": { color: "var(--caos-dde-pict-token-dark, #79c0ff)" },

  ".cm-caos-sem-eqOp": { color: "var(--caos-eq-op, #cf222e)" },
  "&dark .cm-caos-sem-eqOp": { color: "var(--caos-eq-op-dark, #ff7b72)" },

  ".cm-caos-sem-eqJoin": { color: "var(--caos-eq-join, #cf222e)" },
  "&dark .cm-caos-sem-eqJoin": { color: "var(--caos-eq-join-dark, #ff7b72)" },

  ".cm-caos-sem-caos2pray-tag": {
    color: "var(--caos-caos2pray-tag, #986801)",
    fontWeight: "bold",
  },
  "&dark .cm-caos-sem-caos2pray-tag": { color: "var(--caos-caos2pray-tag-dark, #d29922)" },

  ".cm-caos-sem-caos2pray-command": { color: "var(--caos-caos2pray-command, #986801)" },
  "&dark .cm-caos-sem-caos2pray-command": { color: "var(--caos-caos2pray-command-dark, #d29922)" },

  ".cm-caos-sem-string-escape-character": {
    color: "var(--caos-string-escape-character, #0550ae)",
    fontWeight: "bold",
  },
  "&dark .cm-caos-sem-string-escape-character": {
    color: "var(--caos-string-escape-character-dark, #79c0ff)",
  },

  ".cm-caos-sem-number": { color: "var(--caos-number, #0550ae)" },
  "&dark .cm-caos-sem-number": { color: "var(--caos-number-dark, #79c0ff)" },

  // Modifiers — additive, layered on top of the type color above. Only
  // "not-found" gets dedicated styling in Phase 2 (it's the plan's own
  // verification target: "a red squiggle-equivalent under an unknown
  // command"); the rest are available as bare classes for later phases/
  // host apps to hook without needing a stream-parser.ts change.
  ".cm-caos-mod-not-found": {
    textDecoration: "underline wavy var(--caos-error, #cf222e)",
  },
  "&dark .cm-caos-mod-not-found": {
    textDecoration: "underline wavy var(--caos-error-dark, #ff7b72)",
  },
});
