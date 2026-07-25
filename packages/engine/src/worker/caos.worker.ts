/// <reference lib="webworker" />
// The Worker entry module. Constructed lazily by CaosEngineClient on first
// use (../main/worker-client.ts), never eagerly at page load — see plan/06
// for the mobile lazy-load rationale.
//
// Import discipline (plan/00-risks-and-verified-facts.md risk #2): only
// caos-kt subpath imports, never the bare "@creatures-lsp/caos-kt"
// specifier as a value import — that eagerly loads the ~549KB full command
// library as a side effect on module evaluation. This file calls
// useFullCaosLibDefinitions() itself, explicitly, exactly once, in
// ensureInitialized().
//
// Note: caos-kt's dist/ ships a caos-init-lib.mjs (a caosInitLib() helper
// that just idempotency-guards a call to useFullCaosLibDefinitions()) but
// it has no corresponding entry in package.json's "exports" map and no
// source file under src/ — it's an orphaned build artifact, not importable
// via "@creatures-lsp/caos-kt/caos-init-lib" despite dist/index.mjs's own
// header comment recommending it. We don't depend on it; ensureInitialized
// below already provides the same once-only guard itself.
import { useFullCaosLibDefinitions } from "@creatures-lsp/caos-kt/caos-libsfile-full";
import { parseCaos } from "@creatures-lsp/caos-kt/caos-parser";
import { caosValidationAsDiagnostics } from "@creatures-lsp/caos-kt/caos-validation-report";

import { semanticLegend } from "@creatures-lsp/caos-util/semantics-legend";
import { getCaosDocumentSemanticTokens } from "@creatures-lsp/caos-util/semantic-highlighter";

import { CAOS_LIB_MODE } from "./lib-mode.js";
import { beginRequest, cancelRequest, endRequest, keepGoingFor } from "./request-registry.js";
import type {
  FullAnalysisResponse,
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
    throw new Error("slim CAOS lib mode is not shippable yet (see lib-mode.ts, risk #1)");
  }
  initialized = true;
}

function post(response: RpcResponse): void {
  self.postMessage(response);
}

// Derived structurally from getCaosDocumentSemanticTokens's own parameter
// type rather than importing "vscode-languageserver-types" directly (not a
// declared dependency of this package — caos-util re-exports its types).
type SemanticCancellationToken = NonNullable<
  Parameters<typeof getCaosDocumentSemanticTokens>[2]
>;

/** Adapts this worker's request-registry cancellation flag (risk #3 — a
 * flag, not a cross-postMessage closure) to caos-util's CancellationToken
 * shape. `onCancellationRequested` is unused by semantic-highlighter's own
 * cancellation checks but required by the type. */
function cancellationTokenFor(id: number): SemanticCancellationToken {
  const keepGoing = keepGoingFor(id);
  return {
    get isCancellationRequested() {
      return !keepGoing();
    },
    onCancellationRequested: () => ({ dispose() {} }),
  };
}

function handleRequest(request: Exclude<RpcRequest, { type: "cancel" }>): RpcResponse {
  switch (request.type) {
    case "init": {
      ensureInitialized();
      const response: InitResponse = {
        id: request.id,
        ok: true,
        semanticTokensLegend: semanticLegend,
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
      // Reuse the same parseResult for semantic tokens instead of a second
      // parse (plan/00-risks-and-verified-facts.md risk #7) —
      // getCaosDocumentSemanticTokens accepts a CaosParseResult directly.
      // (This previously crashed due to a bug in caos-util's Is.parseResult
      // — checked result.command instead of result.commandCalls, so a real
      // CaosParseResult was never recognized as one — now fixed upstream.)
      const semanticTokens = getCaosDocumentSemanticTokens(
        request.variant,
        parseResult,
        cancellationTokenFor(request.id),
      );
      // Reuses the same parseResult rather than re-parsing (risk #7).
      // withSuggestions=true: Suggestion.description is folded into the CM6
      // diagnostic message as a "Hint: ..." suffix by the editor package's
      // diagnostic-mapper — see plan/03-validation-diagnostics.md.
      const diagnostics = caosValidationAsDiagnostics(
        request.variant,
        parseResult,
        true,
        keepGoing,
      );
      const response: FullAnalysisResponse = {
        id: request.id,
        ok: true,
        // Real inlayHints are wired in Phase 5, from this same parseResult.
        diagnostics,
        semanticTokensData: semanticTokens.data,
        inlayHints: [],
        scriptCount: parseResult.scripts?.length ?? 0,
        itemCount: parseResult.items?.length ?? 0,
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
  try {
    post(handleRequest(request));
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
};
