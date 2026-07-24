// Single conditional deciding which command-library payload the worker
// loads. Default (and currently only working option) is "full": the slim
// bundle is declared in caos-kt's .d.mts but has no shipped .mjs
// implementation (plan/00-risks-and-verified-facts.md risk #1). Re-check
// upstream @creatures-lsp/caos-kt before flipping this to "slim" — until
// then this file exists purely so that future change is a one-line swap.
export type CaosLibMode = "full" | "slim";

export const CAOS_LIB_MODE: CaosLibMode = "full";
