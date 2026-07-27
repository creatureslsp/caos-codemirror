// Base theme exposing CSS custom properties for Layer 2 semantic token styles.
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

  // Modifiers — additive, layered on top of the type color above. Each
  // token's decoration carries its type class and all modifier classes
  // together in one `class` string (build-decorations.ts), so a modifier
  // rule can't rely on CSS `inherit` to "fall through" to the type rule
  // also matching the same element -- `inherit` resolves from the DOM
  // *parent*, not from a sibling same-specificity rule (confirmed the hard
  // way with a live browser check: it rendered as the editor's plain-text
  // black, not the type color). The fix is a fallback that names the
  // co-occurring type's own var() chain directly: `var(--caos-mod-<name>,
  // var(--caos-<type>, <type's own default>))`. This also means a *type*
  // color change (no modifier override set) correctly cascades to
  // modifier-tagged tokens of that type too, per
  // ../../../plan-webapp/07-theming-data-model-dark-light.md's verification
  // ("set the type color: confirm it applies to every `variable` token
  // *without* that modifier's override").
  //
  // Type pairing per modifier, verified against
  // vs-caos-editor/packages/caos/src/semantic-highlighter.ts:
  // - vaxx/ovxx/mvxx: always VARIABLE_TOKEN (onIndexedVar).
  // - quote-string/byte-string: always STRING_TOKEN (addStringDecorations).
  // - agent-constructor: COMMAND_TOKEN in practice ("new:" commands are
  //   always called as commands, never as an lvalue/rvalue).
  // - official: always CAOS2PRAY_TAG (onCaos2PrayTag).
  // - command-prefix/command-suffix and the six returns-* modifiers:
  //   attach to whichever of command/lvalue/rvalue a given call resolves
  //   to (addCommandTokenDecorations/getTypeModifierTokens) -- there's no
  //   single correct type to chain to. Falls back through command, then
  //   lvalue, then rvalue (in that priority order): correct whenever none
  //   of the three has been customized, and correct whenever the actual
  //   type happens to be the first one in the chain that IS customized --
  //   the one known gap is if the user customizes `command` but the actual
  //   token is an lvalue/rvalue prefix/suffix, it shows the `command`
  //   customization instead. Inherent to the flat per-modifier-key design
  //   (00-risks-and-open-questions.md item 9's "each modifier only ever
  //   co-occurs with one or two token types in practice" call), not a
  //   regression -- flagged rather than hidden.
  // - found/not-found: not attached to any token type in the current
  //   engine (declared in semantics-legend.ts but never pushed by
  //   semantic-highlighter.ts) -- falls back to the generic `token` type
  //   since the pairing is moot until the engine actually emits either.
  ".cm-caos-mod-vaxx": { color: "var(--caos-mod-vaxx, var(--caos-variable, #953800))" },
  "&dark .cm-caos-mod-vaxx": { color: "var(--caos-mod-vaxx-dark, var(--caos-variable-dark, #ffa657))" },

  ".cm-caos-mod-ovxx": { color: "var(--caos-mod-ovxx, var(--caos-variable, #953800))" },
  "&dark .cm-caos-mod-ovxx": { color: "var(--caos-mod-ovxx-dark, var(--caos-variable-dark, #ffa657))" },

  ".cm-caos-mod-mvxx": { color: "var(--caos-mod-mvxx, var(--caos-variable, #953800))" },
  "&dark .cm-caos-mod-mvxx": { color: "var(--caos-mod-mvxx-dark, var(--caos-variable-dark, #ffa657))" },

  ".cm-caos-mod-command-prefix": {
    color: "var(--caos-mod-command-prefix, var(--caos-command, var(--caos-lvalue, var(--caos-rvalue, #8250df))))",
  },
  "&dark .cm-caos-mod-command-prefix": {
    color:
      "var(--caos-mod-command-prefix-dark, var(--caos-command-dark, var(--caos-lvalue-dark, var(--caos-rvalue-dark, #d2a8ff))))",
  },

  ".cm-caos-mod-command-suffix": {
    color: "var(--caos-mod-command-suffix, var(--caos-command, var(--caos-lvalue, var(--caos-rvalue, #8250df))))",
  },
  "&dark .cm-caos-mod-command-suffix": {
    color:
      "var(--caos-mod-command-suffix-dark, var(--caos-command-dark, var(--caos-lvalue-dark, var(--caos-rvalue-dark, #d2a8ff))))",
  },

  ".cm-caos-mod-quote-string": { color: "var(--caos-mod-quote-string, var(--caos-string, #0a7d34))" },
  "&dark .cm-caos-mod-quote-string": { color: "var(--caos-mod-quote-string-dark, var(--caos-string-dark, #7ee787))" },

  ".cm-caos-mod-byte-string": { color: "var(--caos-mod-byte-string, var(--caos-string, #0a7d34))" },
  "&dark .cm-caos-mod-byte-string": { color: "var(--caos-mod-byte-string-dark, var(--caos-string-dark, #7ee787))" },

  ".cm-caos-mod-returns-number": {
    color: "var(--caos-mod-returns-number, var(--caos-command, var(--caos-lvalue, var(--caos-rvalue, #8250df))))",
  },
  "&dark .cm-caos-mod-returns-number": {
    color:
      "var(--caos-mod-returns-number-dark, var(--caos-command-dark, var(--caos-lvalue-dark, var(--caos-rvalue-dark, #d2a8ff))))",
  },

  ".cm-caos-mod-returns-string": {
    color: "var(--caos-mod-returns-string, var(--caos-command, var(--caos-lvalue, var(--caos-rvalue, #8250df))))",
  },
  "&dark .cm-caos-mod-returns-string": {
    color:
      "var(--caos-mod-returns-string-dark, var(--caos-command-dark, var(--caos-lvalue-dark, var(--caos-rvalue-dark, #d2a8ff))))",
  },

  ".cm-caos-mod-returns-int": {
    color: "var(--caos-mod-returns-int, var(--caos-command, var(--caos-lvalue, var(--caos-rvalue, #8250df))))",
  },
  "&dark .cm-caos-mod-returns-int": {
    color:
      "var(--caos-mod-returns-int-dark, var(--caos-command-dark, var(--caos-lvalue-dark, var(--caos-rvalue-dark, #d2a8ff))))",
  },

  ".cm-caos-mod-returns-float": {
    color: "var(--caos-mod-returns-float, var(--caos-command, var(--caos-lvalue, var(--caos-rvalue, #8250df))))",
  },
  "&dark .cm-caos-mod-returns-float": {
    color:
      "var(--caos-mod-returns-float-dark, var(--caos-command-dark, var(--caos-lvalue-dark, var(--caos-rvalue-dark, #d2a8ff))))",
  },

  ".cm-caos-mod-returns-variable": {
    color: "var(--caos-mod-returns-variable, var(--caos-command, var(--caos-lvalue, var(--caos-rvalue, #8250df))))",
  },
  "&dark .cm-caos-mod-returns-variable": {
    color:
      "var(--caos-mod-returns-variable-dark, var(--caos-command-dark, var(--caos-lvalue-dark, var(--caos-rvalue-dark, #d2a8ff))))",
  },

  ".cm-caos-mod-returns-agent": {
    color: "var(--caos-mod-returns-agent, var(--caos-command, var(--caos-lvalue, var(--caos-rvalue, #8250df))))",
  },
  "&dark .cm-caos-mod-returns-agent": {
    color:
      "var(--caos-mod-returns-agent-dark, var(--caos-command-dark, var(--caos-lvalue-dark, var(--caos-rvalue-dark, #d2a8ff))))",
  },

  ".cm-caos-mod-agent-constructor": { color: "var(--caos-mod-agent-constructor, var(--caos-command, #8250df))" },
  "&dark .cm-caos-mod-agent-constructor": {
    color: "var(--caos-mod-agent-constructor-dark, var(--caos-command-dark, #d2a8ff))",
  },

  ".cm-caos-mod-official": { color: "var(--caos-mod-official, var(--caos-caos2pray-tag, #986801))" },
  "&dark .cm-caos-mod-official": { color: "var(--caos-mod-official-dark, var(--caos-caos2pray-tag-dark, #d29922))" },

  ".cm-caos-mod-found": { color: "var(--caos-mod-found, var(--caos-token, #6e7781))" },
  "&dark .cm-caos-mod-found": { color: "var(--caos-mod-found-dark, var(--caos-token-dark, #8b949e))" },

  // `not-found` keeps its existing underline (a real rule, unaffected) and
  // additionally gains an overridable text color, same as every other
  // modifier above.
  ".cm-caos-mod-not-found": {
    color: "var(--caos-mod-not-found, var(--caos-token, #6e7781))",
    textDecoration: "underline wavy var(--caos-error, #cf222e)",
  },
  "&dark .cm-caos-mod-not-found": {
    color: "var(--caos-mod-not-found-dark, var(--caos-token-dark, #8b949e))",
    textDecoration: "underline wavy var(--caos-error-dark, #ff7b72)",
  },
});
