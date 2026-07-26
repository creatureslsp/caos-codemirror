// Re-exported as a type only: never import the bare "@creatures-lsp/caos-kt"
// specifier as a value (it eagerly loads the ~549KB full command library as
// a side effect — see plan/00-risks-and-verified-facts.md risk #2). Type-only
// imports are erased at compile time and never execute that side effect.
export type { GameVariant } from "@creatureslsp/caos";

export const GAME_VARIANTS = ["C1", "C2", "CV", "C3", "DS", "DS:CE", "SM"] as const;
