// Base theme exposing CSS custom properties for Layer 2 semantic token styles.
import { EditorView } from "@codemirror/view";

/**
 * Every rule below is generated in two forms: `.cls` (the color applies
 * directly to the decorated span) and `.cls span` (the color applies to a
 * span nested *inside* it, `!important`). Both are needed because CM6 does
 * not always combine same-range decorations from different sources into one
 * span with a merged `class` string -- that only happens for decorations
 * built by the same plugin's own `RangeSetBuilder` (e.g. a type + its
 * modifiers, via `build-decorations.ts`). When two *different* sources
 * decorate the exact same range -- Layer 1's stream-parser highlighting and
 * this file's Layer 2 semantic overlay, or (per `build-decorations.ts`'s
 * per-token entries) two duplicate Layer 2 decorations for the same
 * quoted-string span -- CM6 nests them as separate DOM spans instead,
 * confirmed via a live DOM dump: every command word renders as
 * `<span class="cm-caos-sem-command"><span class="cm-caos-command">word</span></span>`,
 * Layer 2 outermost. CSS `color` is decided by the innermost element with
 * an explicit declaration, so without the `span` variant here, Layer 2's
 * "confirmed" color is silently invisible behind Layer 1's own default
 * every time this nesting happens -- not a hypothetical, this was the
 * actual rendered behavior before this rule shape existed. `!important` is
 * required since normal specificity doesn't reliably win against whatever
 * rule happens to target the inner span.
 */
interface ColorRuleSpec {
  /** CSS class this rule targets, without the leading `.`. */
  cls: string;
  /** Full `color` value for light mode, e.g. `"var(--caos-command, #8250df)"`. */
  light: string;
  /** Full `color` value for dark mode. */
  dark: string;
  /** Extra non-color declarations (e.g. `fontWeight`) applied in light mode and both `span` variants. */
  extra?: Record<string, string>;
  /** Extra non-color declarations for dark mode specifically (e.g. `not-found`'s themed underline). Falls back to `extra` if omitted. */
  darkExtra?: Record<string, string>;
}

function important(props: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [prop, value] of Object.entries(props)) out[prop] = `${value} !important`;
  return out;
}

function colorRule({ cls, light, dark, extra = {}, darkExtra = extra }: ColorRuleSpec): Record<string, Record<string, string>> {
  return {
    [`.${cls}`]: { color: light, ...extra },
    [`&dark .${cls}`]: { color: dark, ...darkExtra },
    [`.${cls} span`]: important({ color: light, ...extra }),
    [`&dark .${cls} span`]: important({ color: dark, ...darkExtra }),
  };
}

const TYPE_RULES: ColorRuleSpec[] = [
  { cls: "cm-caos-sem-command", light: "var(--caos-command, #8250df)", dark: "var(--caos-command-dark, #d2a8ff)" },
  { cls: "cm-caos-sem-string", light: "var(--caos-string, #0a7d34)", dark: "var(--caos-string-dark, #7ee787)" },
  { cls: "cm-caos-sem-token", light: "var(--caos-token, #6e7781)", dark: "var(--caos-token-dark, #8b949e)" },
  { cls: "cm-caos-sem-variable", light: "var(--caos-variable, #953800)", dark: "var(--caos-variable-dark, #ffa657)" },
  {
    cls: "cm-caos-sem-unknown-type",
    light: "var(--caos-unknown-type, #6e7781)",
    dark: "var(--caos-unknown-type-dark, #8b949e)",
  },
  {
    cls: "cm-caos-sem-subroutine-name",
    light: "var(--caos-subroutine-name, #8250df)",
    dark: "var(--caos-subroutine-name-dark, #d2a8ff)",
    extra: { fontWeight: "bold" },
  },
  {
    cls: "cm-caos-sem-placeholder-text",
    light: "var(--caos-placeholder-text, #6e7781)",
    dark: "var(--caos-placeholder-text-dark, #8b949e)",
    extra: { fontStyle: "italic" },
  },
  {
    cls: "cm-caos-sem-dde-pict-token",
    light: "var(--caos-dde-pict-token, #0550ae)",
    dark: "var(--caos-dde-pict-token-dark, #79c0ff)",
  },
  { cls: "cm-caos-sem-eqOp", light: "var(--caos-eq-op, #cf222e)", dark: "var(--caos-eq-op-dark, #ff7b72)" },
  { cls: "cm-caos-sem-eqJoin", light: "var(--caos-eq-join, #cf222e)", dark: "var(--caos-eq-join-dark, #ff7b72)" },
  // caos2pray-hash: the `*#` directive-line prefix marker, distinct from
  // caos2pray-tag (the key after it) -- shares the same CAOS2Pray-family
  // default as caos2-hash (Layer 1's immediate, unconfirmed heuristic for
  // the same span) and caos2-directive/caos2-eq, per token-keys.ts.
  {
    cls: "cm-caos-sem-caos2pray-hash",
    light: "var(--caos-caos2-hash, #986801)",
    dark: "var(--caos-caos2-hash-dark, #d29922)",
  },
  {
    cls: "cm-caos-sem-string-escape-character",
    light: "var(--caos-string-escape-character, #0550ae)",
    dark: "var(--caos-string-escape-character-dark, #79c0ff)",
    extra: { fontWeight: "bold" },
  },
  { cls: "cm-caos-sem-number", light: "var(--caos-number, #0550ae)", dark: "var(--caos-number-dark, #79c0ff)" },
];

// Modifiers — additive, layered on top of the type color above. Each
// token's decoration carries its type class and all modifier classes
// together in one `class` string (build-decorations.ts), so a modifier
// rule can't rely on CSS `inherit` to "fall through" to the type rule also
// matching the same element -- `inherit` resolves from the DOM *parent*,
// not from a sibling same-specificity rule (confirmed the hard way with a
// live browser check: it rendered as the editor's plain-text black, not
// the type color). The fix is a fallback that names the co-occurring
// type's own var() chain directly: `var(--caos-mod-<name>,
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
// - command-prefix/command-suffix and the six returns-* modifiers: attach
//   to whichever of command/lvalue/rvalue a given call resolves to
//   (addCommandTokenDecorations/getTypeModifierTokens) -- there's no single
//   correct type to chain to. Falls back through command, then lvalue,
//   then rvalue (in that priority order): correct whenever none of the
//   three has been customized, and correct whenever the actual type
//   happens to be the first one in the chain that IS customized -- the one
//   known gap is if the user customizes `command` but the actual token is
//   an lvalue/rvalue prefix/suffix, it shows the `command` customization
//   instead. Inherent to the flat per-modifier-key design
//   (00-risks-and-open-questions.md item 9's "each modifier only ever
//   co-occurs with one or two token types in practice" call), not a
//   regression -- flagged rather than hidden.
// - found/not-found: not attached to any token type in the current engine
//   (declared in semantics-legend.ts but never pushed by
//   semantic-highlighter.ts) -- falls back to the generic `token` type
//   since the pairing is moot until the engine actually emits either.
const COMMAND_LVALUE_RVALUE_CHAIN_LIGHT = "var(--caos-command, var(--caos-lvalue, var(--caos-rvalue, #8250df)))";
const COMMAND_LVALUE_RVALUE_CHAIN_DARK =
  "var(--caos-command-dark, var(--caos-lvalue-dark, var(--caos-rvalue-dark, #d2a8ff)))";

// rvalue/lvalue/caos2pray-tag/caos2pray-command: unlike the true modifiers
// below, these are semantic *types* in their own right (semantics-legend.ts
// tokenTypes, not tokenModifiers) -- but they're still chain-only, no
// independent color of their own, because every real token classified as
// one of these always wraps another element's span (confirmed via a live
// DOM dump): rvalue/lvalue always wrap Layer 1's blanket `.cm-caos-command`
// 4-char-shape heuristic (`command`, the same class *every* 4-char-shaped
// word gets immediately, before Layer 2 confirms what it actually is), and
// caos2pray-tag/caos2pray-command always wrap Layer 1's
// `.cm-caos-caos2-directive` span. Left unset, they're meant to be
// invisible -- the wrapped span's own color (respecting *its* own override)
// shows through untouched, exactly like a true modifier chaining to its
// type. token-keys.ts's `fallbackKey` records this same relationship for
// `getResolvedTokenColor`'s display purposes; it has no effect on the CSS
// below, which encodes the relationship independently via its own chain.
const RVALUE_LVALUE_CAOS2PRAY_TAG_RULES: ColorRuleSpec[] = [
  {
    cls: "cm-caos-sem-rvalue",
    light: "var(--caos-rvalue, var(--caos-command, #8250df))",
    dark: "var(--caos-rvalue-dark, var(--caos-command-dark, #d2a8ff))",
  },
  {
    cls: "cm-caos-sem-lvalue",
    light: "var(--caos-lvalue, var(--caos-command, #8250df))",
    dark: "var(--caos-lvalue-dark, var(--caos-command-dark, #d2a8ff))",
  },
  {
    cls: "cm-caos-sem-caos2pray-tag",
    light: "var(--caos-caos2pray-tag, var(--caos-caos2-directive, #986801))",
    dark: "var(--caos-caos2pray-tag-dark, var(--caos-caos2-directive-dark, #d29922))",
    extra: { fontWeight: "bold" },
  },
  {
    cls: "cm-caos-sem-caos2pray-command",
    light: "var(--caos-caos2pray-command, var(--caos-caos2-directive, #986801))",
    dark: "var(--caos-caos2pray-command-dark, var(--caos-caos2-directive-dark, #d29922))",
  },
];

const MODIFIER_RULES: ColorRuleSpec[] = [
  {
    cls: "cm-caos-mod-vaxx",
    light: "var(--caos-mod-vaxx, var(--caos-variable, #953800))",
    dark: "var(--caos-mod-vaxx-dark, var(--caos-variable-dark, #ffa657))",
  },
  {
    cls: "cm-caos-mod-ovxx",
    light: "var(--caos-mod-ovxx, var(--caos-variable, #953800))",
    dark: "var(--caos-mod-ovxx-dark, var(--caos-variable-dark, #ffa657))",
  },
  {
    cls: "cm-caos-mod-mvxx",
    light: "var(--caos-mod-mvxx, var(--caos-variable, #953800))",
    dark: "var(--caos-mod-mvxx-dark, var(--caos-variable-dark, #ffa657))",
  },
  {
    cls: "cm-caos-mod-command-prefix",
    light: `var(--caos-mod-command-prefix, ${COMMAND_LVALUE_RVALUE_CHAIN_LIGHT})`,
    dark: `var(--caos-mod-command-prefix-dark, ${COMMAND_LVALUE_RVALUE_CHAIN_DARK})`,
  },
  {
    cls: "cm-caos-mod-command-suffix",
    light: `var(--caos-mod-command-suffix, ${COMMAND_LVALUE_RVALUE_CHAIN_LIGHT})`,
    dark: `var(--caos-mod-command-suffix-dark, ${COMMAND_LVALUE_RVALUE_CHAIN_DARK})`,
  },
  {
    cls: "cm-caos-mod-quote-string",
    light: "var(--caos-mod-quote-string, var(--caos-string, #0a7d34))",
    dark: "var(--caos-mod-quote-string-dark, var(--caos-string-dark, #7ee787))",
  },
  {
    cls: "cm-caos-mod-byte-string",
    light: "var(--caos-mod-byte-string, var(--caos-string, #0a7d34))",
    dark: "var(--caos-mod-byte-string-dark, var(--caos-string-dark, #7ee787))",
  },
  {
    cls: "cm-caos-mod-returns-number",
    light: `var(--caos-mod-returns-number, ${COMMAND_LVALUE_RVALUE_CHAIN_LIGHT})`,
    dark: `var(--caos-mod-returns-number-dark, ${COMMAND_LVALUE_RVALUE_CHAIN_DARK})`,
  },
  {
    cls: "cm-caos-mod-returns-string",
    light: `var(--caos-mod-returns-string, ${COMMAND_LVALUE_RVALUE_CHAIN_LIGHT})`,
    dark: `var(--caos-mod-returns-string-dark, ${COMMAND_LVALUE_RVALUE_CHAIN_DARK})`,
  },
  {
    cls: "cm-caos-mod-returns-int",
    light: `var(--caos-mod-returns-int, ${COMMAND_LVALUE_RVALUE_CHAIN_LIGHT})`,
    dark: `var(--caos-mod-returns-int-dark, ${COMMAND_LVALUE_RVALUE_CHAIN_DARK})`,
  },
  {
    cls: "cm-caos-mod-returns-float",
    light: `var(--caos-mod-returns-float, ${COMMAND_LVALUE_RVALUE_CHAIN_LIGHT})`,
    dark: `var(--caos-mod-returns-float-dark, ${COMMAND_LVALUE_RVALUE_CHAIN_DARK})`,
  },
  {
    cls: "cm-caos-mod-returns-variable",
    light: `var(--caos-mod-returns-variable, ${COMMAND_LVALUE_RVALUE_CHAIN_LIGHT})`,
    dark: `var(--caos-mod-returns-variable-dark, ${COMMAND_LVALUE_RVALUE_CHAIN_DARK})`,
  },
  {
    cls: "cm-caos-mod-returns-agent",
    light: `var(--caos-mod-returns-agent, ${COMMAND_LVALUE_RVALUE_CHAIN_LIGHT})`,
    dark: `var(--caos-mod-returns-agent-dark, ${COMMAND_LVALUE_RVALUE_CHAIN_DARK})`,
  },
  {
    cls: "cm-caos-mod-agent-constructor",
    light: "var(--caos-mod-agent-constructor, var(--caos-command, #8250df))",
    dark: "var(--caos-mod-agent-constructor-dark, var(--caos-command-dark, #d2a8ff))",
  },
  {
    cls: "cm-caos-mod-official",
    light: "var(--caos-mod-official, var(--caos-caos2pray-tag, var(--caos-caos2-directive, #986801)))",
    dark: "var(--caos-mod-official-dark, var(--caos-caos2pray-tag-dark, var(--caos-caos2-directive-dark, #d29922)))",
  },
  {
    cls: "cm-caos-mod-found",
    light: "var(--caos-mod-found, var(--caos-token, #6e7781))",
    dark: "var(--caos-mod-found-dark, var(--caos-token-dark, #8b949e))",
  },
  // `not-found` keeps its existing underline (a real rule, unaffected) and
  // additionally gains an overridable text color, same as every other
  // modifier above.
  {
    cls: "cm-caos-mod-not-found",
    light: "var(--caos-mod-not-found, var(--caos-token, #6e7781))",
    dark: "var(--caos-mod-not-found-dark, var(--caos-token-dark, #8b949e))",
    extra: { textDecoration: "underline wavy var(--caos-error, #cf222e)" },
    darkExtra: { textDecoration: "underline wavy var(--caos-error-dark, #ff7b72)" },
  },
];

export const semanticTokensTheme = EditorView.baseTheme(
  Object.assign(
    {},
    ...[...TYPE_RULES, ...RVALUE_LVALUE_CAOS2PRAY_TAG_RULES, ...MODIFIER_RULES].map(colorRule),
  ),
);
