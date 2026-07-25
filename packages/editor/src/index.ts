export { caosLanguage, caosLanguageSupport } from "./language/caos-language.js";
export { caosHighlightStyle, caosHighlightTheme } from "./language/highlight-style.js";
export { caosStreamParser } from "./language/stream-parser.js";
export type { CaosStreamState } from "./language/stream-parser.js";
export { caosTags } from "./language/caos-tags.js";
export type { CaosTokenName } from "./language/caos-tags.js";

export { semanticTokens } from "./semantic/semantic-tokens-plugin.js";
export type { SemanticTokensPluginOptions } from "./semantic/semantic-tokens-plugin.js";
export { semanticTokensTheme } from "./semantic/semantic-tokens-theme.js";
export { buildSemanticDecorations } from "./semantic/build-decorations.js";
export { decodeSemanticTokens, classNamesFor } from "./semantic/decode-semantic-tokens.js";
export type { DecodedSemanticToken } from "./semantic/decode-semantic-tokens.js";
export type { SemanticTokensLegend } from "./semantic/legend.js";

export { caosLinter } from "./lint/caos-linter.js";
export type { CaosLinterOptions } from "./lint/caos-linter.js";
export { toCM6Diagnostic } from "./lint/diagnostic-mapper.js";
