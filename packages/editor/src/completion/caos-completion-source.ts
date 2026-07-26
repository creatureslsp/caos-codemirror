// Wires @codemirror/autocomplete to the engine Worker's completion RPC.
import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import type { CaosEngineClient, GameVariant } from "@creatures-codemirror/engine";
import { cmOffsetToLineChar } from "@creatures-codemirror/engine";
import { lspCompletionItemToCM6 } from "./item-converter.js";

export interface CaosCompletionSourceOptions {
  client: CaosEngineClient;
  getVariant: () => GameVariant;
}

const WORD_PATTERN = /[A-Za-z_:][A-Za-z0-9_:]*/;

export function caosCompletionSource(options: CaosCompletionSourceOptions) {
  const { client, getVariant } = options;

  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    const word = context.matchBefore(WORD_PATTERN);
    if (!word && !context.explicit) return null;

    const from = word ? word.from : context.pos;
    const variant = getVariant();
    const text = context.state.doc.toString();
    const { line, character } = cmOffsetToLineChar(context.state.doc, context.pos);

    let response;
    try {
      response = await client.getCompletions(variant, text, line, character);
    } catch {
      return null;
    }

    // The doc changed while the request was in flight; the popup would be
    // positioned against text that no longer exists. Bail out — CM6 will
    // re-trigger the source for the new state on its own.
    if (context.state.doc.toString() !== text) return null;

    const options = response.items
      .map((item) => lspCompletionItemToCM6(item, context.state.doc))
      .filter((c) => c != null);
    if (options.length === 0) return null;

    return { from, options, validFor: WORD_PATTERN };
  };
}
