// Message type definitions shared between main-thread and worker code.
// Plain types/interfaces only — no runtime dependency on either side, and no
// value imports from "@creatures-lsp/caos-kt" (only erased type-only ones).
import type { GameVariant } from "../shared/variant.js";
// Type-only import, erased at compile time — safe per risk #2 (only value
// imports of the bare "@creatures-lsp/caos-kt" specifier are unsafe).
import type { Diagnostic as CaosDiagnostic } from "@creatures-lsp/caos-kt/caos-validation-report";
export type { CaosDiagnostic };

export type RequestKind =
  | "init"
  | "setVariant"
  | "parseNear"
  | "fullAnalysis"
  | "getCompletions"
  | "getHover"
  | "cancel";

export interface RpcRequestBase {
  id: number;
  revision: number;
  type: RequestKind;
}

export interface RpcResponseBase {
  id: number;
  ok: boolean;
  /** Present when ok is false. */
  error?: string;
}

export interface InitRequest extends RpcRequestBase {
  type: "init";
}

export interface InitResponse extends RpcResponseBase {
  /** Token types/modifiers legend, echoed back to prove the caos-util import
   * pattern works end-to-end (see plan/01, worker step 4). Populated with
   * real consumers starting Phase 2. */
  semanticTokensLegend: { tokenTypes: string[]; tokenModifiers: string[] };
}

export interface SetVariantRequest extends RpcRequestBase {
  type: "setVariant";
  variant: GameVariant;
}

export interface SetVariantResponse extends RpcResponseBase {
  variant: GameVariant;
}

export interface FullAnalysisRequest extends RpcRequestBase {
  type: "fullAnalysis";
  variant: GameVariant;
  text: string;
}

export interface FullAnalysisResponse extends RpcResponseBase {
  /** From caosValidationAsDiagnostics — see risk #9 (severity is a checked
   * "info" | "warning" | "error" union, already resolved, no lookup table
   * needed). */
  diagnostics: CaosDiagnostic[];
  /** Flat semantic-token-legend-encoded quintuples once wired in Phase 2. */
  semanticTokensData: number[];
  /** InlayHint[] once wired in Phase 5. */
  inlayHints: unknown[];
  /** Phase-1-only smoke-test fields, safe to keep around: cheap proof the
   * worker actually parsed the text via caos-kt. */
  scriptCount: number;
  itemCount: number;
}

export interface CancelRequest {
  type: "cancel";
  id: number;
}

export type RpcRequest =
  | InitRequest
  | SetVariantRequest
  | FullAnalysisRequest
  | CancelRequest;

export interface ErrorResponse extends RpcResponseBase {
  ok: false;
  error: string;
}

export type RpcResponse =
  | InitResponse
  | SetVariantResponse
  | FullAnalysisResponse
  | ErrorResponse;
