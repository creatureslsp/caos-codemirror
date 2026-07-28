/**
 * Source of truth for every `--caos-*` CSS custom property the theming
 * system can override, per `../../../plan-webapp/07-theming-data-model-dark-light.md`.
 * Drawn from the four `packages/editor` theme files (after Phase 07's
 * `highlight-style.ts` retrofit, all four expose their colors as
 * `var(--caos-<key>[-dark], <fallback>)`):
 *
 * - `language/highlight-style.ts` (Layer 1 syntax highlighting)
 * - `semantic/semantic-tokens-theme.ts` (Layer 2 semantic types + modifiers)
 * - `inlay-hints/inlay-hint-theme.ts`
 * - `mobile/touch-theme.ts`
 *
 * `--caos-string` and `--caos-number` are shared between Layer 1 and Layer 2
 * (both already used the same colors before this phase) — listed once, in
 * the `syntax` category, not duplicated. `escape`/`label` (Layer 1 only)
 * were deliberately dropped the same way and merged into their Layer 2
 * counterparts instead of getting their own keys: `.cm-caos-escape` now
 * reads `--caos-string-escape-character` and `.cm-caos-label` reads
 * `--caos-subroutine-name` (`highlight-style.ts`) — same pairing
 * `command`/`command-heuristic` already used before that key was merged
 * outright. One color, one control, immediate Layer 1 heuristic and
 * confirmed Layer 2 classification always agree (no flash of a different
 * color once analysis lands).
 *
 * Modifier keys (`category: "modifier"`) have no `defaultLight`/`defaultDark`
 * of their own — deliberately. Every one of them decorates a span that's
 * always nested *inside* another element's own span (a Layer 1 base-type
 * span, or another Layer 2 type/modifier), per `build-decorations.ts`/CM6's
 * own decoration nesting -- see `semantic-tokens-theme.ts`'s module comment
 * for why that nesting happens and how the CSS `<selector> span` rules
 * resolve it. Left unset, a modifier is meant to be invisible: the wrapped
 * element's own color shows through untouched. `fallbackKey` records *which*
 * element it wraps, purely so `getResolvedTokenColor` (and therefore
 * `TokenColorControl`'s swatch, and `ThemeTab`'s "seed a newly-checked
 * modifier box from its current color" behavior) can show the same color the
 * editor already renders instead of a meaningless generic gray -- it has no
 * effect on the actual CSS, which is what `semantic-tokens-theme.ts`'s own
 * `var(--caos-<key>, var(--caos-<fallbackKey>, ...))` chains already encode
 * independently.
 *
 * `rvalue`/`lvalue`/`caos2pray-tag`/`caos2pray-command` are `category:
 * "modifier"` for exactly this reason (moved out of `syntax`, not just to
 * declutter that list): `rvalue`/`lvalue` always wrap Layer 1's
 * `.cm-caos-command` heuristic span (`fallbackKey: "command"`);
 * `caos2pray-tag`/`caos2pray-command` always wrap Layer 1's
 * `.cm-caos-caos2-directive` span (`fallbackKey: "caos2-directive"`). Per
 * `00-risks-and-open-questions.md` items 9-10, every *true* modifier
 * declared in `semantics-legend.ts` (except `c1-string`, confirmed dead) is
 * here too, without a `fallbackKey` -- `getResolvedTokenColor` returning
 * `undefined` for those is fine as-is (existing, unflagged behavior), not
 * something this exception list changes.
 */

export type TokenCategory = "syntax" | "modifier" | "chrome";

export interface TokenKeyDef {
  /** CSS custom property suffix: `--caos-<key>` / `--caos-<key>-dark`. */
  key: string;
  label: string;
  category: TokenCategory;
  /** Omitted for most modifiers -- see module doc comment. */
  defaultLight?: string;
  defaultDark?: string;
  /** Another `TOKEN_KEYS` key this one wraps and, unset, visually defers to -- see module doc comment. Display-only; doesn't affect the real CSS. */
  fallbackKey?: string;
}

export const TOKEN_KEYS: TokenKeyDef[] = [
  // --- Syntax colors (Layer 1 + Layer 2 types) ---
  { key: "keyword", label: "Keyword", category: "syntax", defaultLight: "#cf222e", defaultDark: "#ff7b72" },
  { key: "command", label: "Command", category: "syntax", defaultLight: "#8250df", defaultDark: "#d2a8ff" },
  { key: "string", label: "String", category: "syntax", defaultLight: "#0a7d34", defaultDark: "#7ee787" },
  {
    key: "string-escape-character",
    label: "String escape character",
    category: "syntax",
    defaultLight: "#0550ae",
    defaultDark: "#79c0ff",
  },
  { key: "number", label: "Number", category: "syntax", defaultLight: "#0550ae", defaultDark: "#79c0ff" },
  { key: "variable", label: "Variable", category: "syntax", defaultLight: "#953800", defaultDark: "#ffa657" },
  {
    key: "subroutine-name",
    label: "Subroutine name",
    category: "syntax",
    defaultLight: "#8250df",
    defaultDark: "#d2a8ff",
  },
  { key: "comment", label: "Comment", category: "syntax", defaultLight: "#6a737d", defaultDark: "#8b949e" },
  { key: "token", label: "Token", category: "syntax", defaultLight: "#6e7781", defaultDark: "#8b949e" },
  { key: "operator", label: "Compare operator", category: "syntax", defaultLight: "#cf222e", defaultDark: "#ff7b72" },
  { key: "eq-join", label: "\"=\" join (and|or)", category: "syntax", defaultLight: "#cf222e", defaultDark: "#ff7b72" },
  {
    key: "caos2-directive",
    label: "CAOS2 directive",
    category: "syntax",
    defaultLight: "#986801",
    defaultDark: "#d29922",
  },
  { key: "caos2-eq", label: "CAOS2 \"=\"", category: "syntax", defaultLight: "#986801", defaultDark: "#d29922" },
  { key: "caos2-hash", label: "CAOS2 \"*#\"", category: "syntax", defaultLight: "#986801", defaultDark: "#d29922" },

  {
    key: "unknown-type",
    label: "Unknown type",
    category: "syntax",
    defaultLight: "#6e7781",
    defaultDark: "#8b949e",
  },
  {
    key: "placeholder-text",
    label: "Placeholder text",
    category: "syntax",
    defaultLight: "#6e7781",
    defaultDark: "#8b949e",
  },
  {
    key: "dde-pict-token",
    label: "DDE pict dimension",
    category: "syntax",
    defaultLight: "#0550ae",
    defaultDark: "#79c0ff",
  },
  { key: "error", label: "Error (not-found underline)", category: "syntax", defaultLight: "#cf222e", defaultDark: "#ff7b72" },

  // --- Modifiers (default `inherit`; see module doc comment) ---
  { key: "mod-vaxx", label: "vaxx (event variable)", category: "modifier" },
  { key: "mod-ovxx", label: "ovxx (TARG object variable)", category: "modifier" },
  { key: "mod-mvxx", label: "mvxx (OWNR object variable)", category: "modifier" },
  { key: "rvalue", label: "Command rvalue", category: "modifier", fallbackKey: "command" },
  { key: "lvalue", label: "Command lvalue", category: "modifier", fallbackKey: "command" },
  { key: "mod-command-prefix", label: "Command prefix word", category: "modifier" },
  { key: "mod-command-suffix", label: "Command suffix word", category: "modifier" },
  { key: "mod-quote-string", label: "Quoted string", category: "modifier" },
  { key: "mod-byte-string", label: "Byte string", category: "modifier" },
  { key: "mod-returns-number", label: "Returns: number", category: "modifier" },
  { key: "mod-returns-string", label: "Returns: string", category: "modifier" },
  { key: "mod-returns-int", label: "Returns: int", category: "modifier" },
  { key: "mod-returns-float", label: "Returns: float", category: "modifier" },
  { key: "mod-returns-variable", label: "Returns: variable", category: "modifier" },
  { key: "mod-returns-agent", label: "Returns: agent", category: "modifier" },
  { key: "mod-agent-constructor", label: "Agent constructor (new:)", category: "modifier" },
  { key: "mod-official", label: "CAOS2PRAY official tag", category: "modifier" },
  { key: "mod-found", label: "Resolved identifier", category: "modifier" },
  { key: "mod-not-found", label: "Unresolved identifier", category: "modifier" },
  { key: "caos2pray-tag", label: "CAOS2PRAY tag", category: "modifier", fallbackKey: "caos2-directive" },
  {
    key: "caos2pray-command",
    label: "CAOS2PRAY command",
    category: "modifier",
    fallbackKey: "caos2-directive",
  },

  // --- Chrome (touch targets, inlay hints) ---
  { key: "panel-border", label: "Panel border", category: "chrome", defaultLight: "#d0d7de", defaultDark: "#30363d" },
  {
    key: "completion-trigger-bg",
    label: "Completion trigger background",
    category: "chrome",
    defaultLight: "#f6f8fa",
    defaultDark: "#21262d",
  },
  { key: "inlay-hint", label: "Inlay hint text", category: "chrome", defaultLight: "#6e7781", defaultDark: "#8b949e" },
  {
    key: "inlay-hint-bg",
    label: "Inlay hint background",
    category: "chrome",
    defaultLight: "rgba(110, 119, 129, 0.12)",
    defaultDark: "rgba(139, 148, 158, 0.18)",
  },
];

export function findTokenKey(key: string): TokenKeyDef | undefined {
  return TOKEN_KEYS.find((t) => t.key === key);
}
