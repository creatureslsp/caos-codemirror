import { autocompletion, type CompletionSource } from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import type { CaosCompletionSourceOptions } from "./caos-completion-source.js";
import { caosCompletionSource } from "./caos-completion-source.js";

export function caosCompletion(options: CaosCompletionSourceOptions): Extension {
  const source: CompletionSource = caosCompletionSource(options);
  return autocompletion({ override: [source] });
}
