/// <reference lib="webworker" />
// Worker entry module for executing CAOS analysis tasks in a background thread.
import { useFullCaosLibDefinitions } from "@creatureslsp/caos/libsfile-full";
import { parseCaos } from "@creatureslsp/caos/parser";
import { caosValidationAsDiagnostics } from "@creatureslsp/caos/validation-report";
import { getCaosInlayHintsWithOffset, getCaosInlayOptions} from "@creatureslsp/caos/inlay-hints";
import type { CaosCompletionOptions, CaosCompletionSettings } from "@creatureslsp/caos/completions";
import { getCompletionItems } from "@creatureslsp/caos/completions";
import { semanticLegend } from "@creatureslsp/caos/semantics-legend";
import { getCaosDocumentSemanticTokens } from "@creatureslsp/caos/semantic-highlighter";
import { getHoverItem } from "@creatureslsp/caos/hover-documentation";

import { CAOS_LIB_MODE } from "./lib-mode.js";
import { beginRequest, cancelRequest, endRequest, keepGoingFor } from "./request-registry.js";
import type {
  FullAnalysisResponse,
  GetCompletionsResponse,
  GetHoverResponse,
  InitResponse,
  RpcRequest,
  RpcResponse,
  SetVariantResponse,
} from "./rpc-protocol.js";
import type { GameVariant } from "../shared/variant.js";

declare const self: DedicatedWorkerGlobalScope;

let initialized = false;
let currentVariant: GameVariant = "DS";

function ensureInitialized(): void {
  if (initialized) return;
  if (CAOS_LIB_MODE === "full") {
    useFullCaosLibDefinitions();
  } else {
    throw new Error("slim CAOS lib mode is not supported yet (see lib-mode.ts)");
  }
  initialized = true;
}

function post(response: RpcResponse): void {
  self.postMessage(response);
}

type SemanticCancellationToken = NonNullable<
  Parameters<typeof getCaosDocumentSemanticTokens>[2]
>;

/** Adapts this worker's cancellation flag to caos's CancellationToken shape. */
function cancellationTokenFor(id: number): SemanticCancellationToken {
  const keepGoing = keepGoingFor(id);
  return {
    get isCancellationRequested() {
      return !keepGoing();
    },
    onCancellationRequested: () => ({ dispose() {} }),
  };
}

async function handleRequest(request: Exclude<RpcRequest, { type: "cancel" }>): Promise<RpcResponse> {
  switch (request.type) {
    case "init": {
      ensureInitialized();
      const response: InitResponse = {
        id: request.id,
        ok: true,
        semanticTokensLegend: semanticLegend,
        inlayHintOptions: getCaosInlayOptions(),
      };
      return response;
    }
    case "setVariant": {
      ensureInitialized();
      currentVariant = request.variant;
      const response: SetVariantResponse = {
        id: request.id,
        ok: true,
        variant: currentVariant,
      };
      return response;
    }
    case "fullAnalysis": {
      ensureInitialized();
      const keepGoing = keepGoingFor(request.id);
      const parseResult = parseCaos(request.variant, request.text, keepGoing);
      // Reuse parseResult across semantic tokens, diagnostics, and inlay hints
      const semanticTokens = getCaosDocumentSemanticTokens(
        request.variant,
        parseResult,
        cancellationTokenFor(request.id),
      );
      const diagnostics = caosValidationAsDiagnostics(
        request.variant,
        parseResult,
        true,
        keepGoing,
      );
      const inlayHints = getCaosInlayHintsWithOffset(
        request.variant,
        parseResult,
        request.disabledInlayHints ?? [],
        request.minimumParameterCount,
        1,
      );
      const response: FullAnalysisResponse = {
        id: request.id,
        ok: true,
        diagnostics,
        semanticTokensData: semanticTokens.data,
        inlayHints,
        scriptCount: parseResult.scripts?.length ?? 0,
        itemCount: parseResult.items?.length ?? 0,
      };
      return response;
    }
    case "getCompletions": {
      ensureInitialized();
      const keepGoing = keepGoingFor(request.id);
      const settings: CaosCompletionSettings = {
        usePlaceholders: true,
        dumbMode: false,
        parameterInlayHints: false,
        minimumParameterCount: 2,
      };
      const options: CaosCompletionOptions = {
        incomplete: true,
        directory: "",
        getFiles: async () => [],
        keepGoing,
      };
      const result = await getCompletionItems(
        "document.cos",
        request.variant,
        request.text,
        { line: request.line, character: request.character },
        options,
        settings,
      );

      const response: GetCompletionsResponse = {
        id: request.id,
        ok: true,
        isIncomplete: result.isIncomplete,
        items: result.items,
      };
      return response;
    }
    case "getHover": {
      ensureInitialized();
      const hover = getHoverItem(request.variant, request.text, {
        line: request.line,
        character: request.character,
      });
      const response: GetHoverResponse = {
        id: request.id,
        ok: true,
        hover: hover ?? null,
      };
      return response;
    }
  }
}

self.onmessage = (event: MessageEvent<RpcRequest>) => {
  const request = event.data;

  if (request.type === "cancel") {
    cancelRequest(request.id);
    return;
  }

  beginRequest(request.id);
  void (async () => {
    try {
      post(await handleRequest(request));
    } catch (err) {
      console.error("[caos.worker] request failed:", request.type, err);
      post({
        id: request.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      endRequest(request.id);
    }
  })();
};
