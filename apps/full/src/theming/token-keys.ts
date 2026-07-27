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
 * the `syntax` category, not duplicated.
 *
 * Modifier keys (`category: "modifier"`) default to `inherit` in the CSS
 * (see semantic-tokens-theme.ts) rather than a concrete color — there's no
 * meaningful "default swatch" for them the way there is for a type color,
 * only "not overridden, falls through to the type color". Per
 * `00-risks-and-open-questions.md` items 9-10: this is every declared
 * modifier in `semantics-legend.ts` except `c1-string`, confirmed dead in
 * practice.
 */

export type TokenCategory = "syntax" | "modifier" | "chrome";

export interface TokenKeyDef {
  /** CSS custom property suffix: `--caos-<key>` / `--caos-<key>-dark`. */
  key: string;
  label: string;
  category: TokenCategory;
  /** Omitted for modifiers -- they default to `inherit`, not a fixed color. */
  defaultLight?: string;
  defaultDark?: string;
}

export const TOKEN_KEYS: TokenKeyDef[] = [
  // --- Syntax colors (Layer 1 + Layer 2 types) ---
  { key: "comment", label: "Comment", category: "syntax", defaultLight: "#6a737d", defaultDark: "#8b949e" },
  {
    key: "caos2-directive",
    label: "CAOS2 directive",
    category: "syntax",
    defaultLight: "#986801",
    defaultDark: "#d29922",
  },
  { key: "caos2-eq", label: "CAOS2 \"=\"", category: "syntax", defaultLight: "#986801", defaultDark: "#d29922" },
  { key: "escape", label: "Escape sequence", category: "syntax", defaultLight: "#0550ae", defaultDark: "#79c0ff" },
  { key: "label", label: "Label", category: "syntax", defaultLight: "#8250df", defaultDark: "#d2a8ff" },
  { key: "keyword", label: "Control keyword", category: "syntax", defaultLight: "#cf222e", defaultDark: "#ff7b72" },
  {
    key: "command-heuristic",
    label: "Command (unresolved heuristic)",
    category: "syntax",
    defaultLight: "#57606a",
    defaultDark: "#8b949e",
  },
  { key: "operator", label: "Compare operator", category: "syntax", defaultLight: "#cf222e", defaultDark: "#ff7b72" },
  { key: "command", label: "Command", category: "syntax", defaultLight: "#8250df", defaultDark: "#d2a8ff" },
  { key: "rvalue", label: "Rvalue", category: "syntax", defaultLight: "#0550ae", defaultDark: "#79c0ff" },
  { key: "lvalue", label: "Lvalue", category: "syntax", defaultLight: "#953800", defaultDark: "#ffa657" },
  { key: "string", label: "String", category: "syntax", defaultLight: "#0a7d34", defaultDark: "#7ee787" },
  { key: "token", label: "Token", category: "syntax", defaultLight: "#6e7781", defaultDark: "#8b949e" },
  { key: "variable", label: "Variable", category: "syntax", defaultLight: "#953800", defaultDark: "#ffa657" },
  {
    key: "unknown-type",
    label: "Unknown type",
    category: "syntax",
    defaultLight: "#6e7781",
    defaultDark: "#8b949e",
  },
  {
    key: "subroutine-name",
    label: "Subroutine name",
    category: "syntax",
    defaultLight: "#8250df",
    defaultDark: "#d2a8ff",
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
  { key: "eq-op", label: "\"=\" operator", category: "syntax", defaultLight: "#cf222e", defaultDark: "#ff7b72" },
  { key: "eq-join", label: "\"=\" join", category: "syntax", defaultLight: "#cf222e", defaultDark: "#ff7b72" },
  {
    key: "caos2pray-tag",
    label: "CAOS2PRAY tag",
    category: "syntax",
    defaultLight: "#986801",
    defaultDark: "#d29922",
  },
  {
    key: "caos2pray-command",
    label: "CAOS2PRAY command",
    category: "syntax",
    defaultLight: "#986801",
    defaultDark: "#d29922",
  },
  {
    key: "string-escape-character",
    label: "String escape character",
    category: "syntax",
    defaultLight: "#0550ae",
    defaultDark: "#79c0ff",
  },
  { key: "number", label: "Number", category: "syntax", defaultLight: "#0550ae", defaultDark: "#79c0ff" },
  { key: "error", label: "Error (not-found underline)", category: "syntax", defaultLight: "#cf222e", defaultDark: "#ff7b72" },

  // --- Modifiers (default `inherit`; see module doc comment) ---
  { key: "mod-vaxx", label: "vaxx (event variable)", category: "modifier" },
  { key: "mod-ovxx", label: "ovxx (TARG object variable)", category: "modifier" },
  { key: "mod-mvxx", label: "mvxx (OWNR object variable)", category: "modifier" },
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
