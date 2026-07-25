// A structural subset of caos-util's SemanticTokensLegend (from
// "@creatures-lsp/caos-util/semantics-legend"). This package never imports
// caos-kt/caos-util directly — only the worker does (plan/00-risks-and-
// verified-facts.md risk #2/#8) — so it gets the real legend at runtime via
// CaosEngineClient.init()'s InitResponse.semanticTokensLegend instead.
export interface SemanticTokensLegend {
  readonly tokenTypes: readonly string[];
  readonly tokenModifiers: readonly string[];
}
