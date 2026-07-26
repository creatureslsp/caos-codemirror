// Message type definitions shared between main-thread and worker code.
// Plain types/interfaces only — no runtime dependency on either side.
import type { GameVariant } from "../shared/variant.js";
import type { Diagnostic as CaosDiagnostic } from "@creatureslsp/caos/validation-report";
export type { CaosDiagnostic };
import type { CompletionItem, Hover, InlayHint } from "vscode-languageserver-types";
export type { CompletionItem as CaosCompletionItem, Hover as CaosHover, InlayHint as CaosInlayHint };

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
  /** Token types/modifiers legend. */
  semanticTokensLegend: { tokenTypes: string[]; tokenModifiers: string[] };
  /** List of togglable inlay-hint-provider ids. */
  inlayHintOptions: string[];
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
  /** Inlay-hint-provider ids to suppress. Defaults to []. */
  disabledInlayHints?: string[];
  /** Threshold below which parameter name hints are omitted. */
  minimumParameterCount?: number | null;
}

export interface FullAnalysisResponse extends RpcResponseBase {
  diagnostics: CaosDiagnostic[];
  /** Flat semantic-token-legend-encoded quintuples. */
  semanticTokensData: number[];
  inlayHints: InlayHint[];
  scriptCount: number;
  itemCount: number;
}

export interface GetCompletionsRequest extends RpcRequestBase {
  type: "getCompletions";
  variant: GameVariant;
  text: string;
  /** 0-indexed line/character, converted from the CM6 cursor offset. */
  line: number;
  character: number;
}

export interface GetCompletionsResponse extends RpcResponseBase {
  isIncomplete: boolean;
  items: CompletionItem[];
}

export interface GetHoverRequest extends RpcRequestBase {
  type: "getHover";
  variant: GameVariant;
  text: string;
  /** 0-indexed line/character, converted from the CM6 cursor offset. */
  line: number;
  character: number;
}

export interface GetHoverResponse extends RpcResponseBase {
  /** null when there's no command beneath the cursor to document. */
  hover: Hover | null;
}

export interface CancelRequest {
  type: "cancel";
  id: number;
}

export type RpcRequest =
  | InitRequest
  | SetVariantRequest
  | FullAnalysisRequest
  | GetCompletionsRequest
  | GetHoverRequest
  | CancelRequest;

export interface ErrorResponse extends RpcResponseBase {
  ok: false;
  error: string;
}

export type RpcResponse =
  | InitResponse
  | SetVariantResponse
  | FullAnalysisResponse
  | GetCompletionsResponse
  | GetHoverResponse
  | ErrorResponse;
