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

export { caosCompletion } from "./completion/caos-completion.js";
export { caosCompletionSource } from "./completion/caos-completion-source.js";
export type { CaosCompletionSourceOptions } from "./completion/caos-completion-source.js";
export { lspCompletionItemToCM6 } from "./completion/item-converter.js";

export { caosHoverTooltip } from "./hover/hover-tooltip.js";
export type { CaosHoverTooltipOptions } from "./hover/hover-tooltip.js";
export { showHoverAt } from "./hover/touch-hover.js";
export type { ShowHoverAtOptions } from "./hover/touch-hover.js";
export { renderCaosMarkdownLite } from "./hover/markdown-lite.js";

export { inlayHints } from "./inlay-hints/inlay-hints-plugin.js";
export type { InlayHintsPluginOptions } from "./inlay-hints/inlay-hints-plugin.js";
export { inlayHintTheme } from "./inlay-hints/inlay-hint-theme.js";
export { buildInlayHintDecorations } from "./inlay-hints/build-inlay-hint-decorations.js";
export { InlayHintWidget } from "./inlay-hints/inlay-hint-widget.js";
export {
  DEFAULT_INLAY_HINT_OPTIONS,
  inlayHintOptionsField,
  setInlayHintOptions,
} from "./inlay-hints/inlay-hint-options.js";
export type { InlayHintOptions } from "./inlay-hints/inlay-hint-options.js";

export { mobileHoverTrigger } from "./mobile/touch-hover.js";
export type { MobileHoverTrigger, MobileHoverTriggerOptions } from "./mobile/touch-hover.js";
export { mobileViewport } from "./mobile/viewport.js";
export type { MobileViewportOptions } from "./mobile/viewport.js";
export { touchTheme } from "./mobile/touch-theme.js";
export { completionTrigger } from "./mobile/completion-trigger.js";
export type { CompletionTriggerOptions } from "./mobile/completion-trigger.js";
