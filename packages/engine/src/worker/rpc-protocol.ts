// Message type definitions shared between main-thread and worker code.
// Plain types/interfaces only — no runtime dependency on either side, and no
// value imports from "@creatures-lsp/caos-kt" (only erased type-only ones).
import type { GameVariant } from "../shared/variant.js";
import type { Diagnostic as CaosDiagnostic } from "@creatureslsp/caos/validation-report";
export type { CaosDiagnostic };
// vscode-languageserver-types is a real dependency (not the bare caos-kt/
// caos-util specifier risk #2 warns about) — a pure-ESM, browser-safe types
// package with no Node dependency, so a runtime (non-type-only) import is
// also safe wherever the editor package needs the CompletionItemKind/
// InsertTextFormat enums. Here only the type is needed.
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
  /** Token types/modifiers legend, echoed back to prove the caos-util import
   * pattern works end-to-end (see plan/01, worker step 4). Populated with
   * real consumers starting Phase 2. */
  semanticTokensLegend: { tokenTypes: string[]; tokenModifiers: string[] };
  /** getCaosInlayOptions()'s full list of togglable inlay-hint-provider ids
   * (plan/05-hover-and-inlay-hints.md), read once at worker init so a
   * settings UI can populate itself without a dedicated round trip. */
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
  /** Inlay-hint-provider ids to suppress (from getCaosInlayOptions(), see
   * InitResponse.inlayHintOptions). Defaults to [] (nothing disabled). */
  disabledInlayHints?: string[];
  /** Threshold below which "<paramName>:" argument-position hints are
   * omitted (plan/05-hover-and-inlay-hints.md). undefined/null defers to
   * getCaosInlayHints' own default. */
  minimumParameterCount?: number | null;
}

export interface FullAnalysisResponse extends RpcResponseBase {
  /** From caosValidationAsDiagnostics — see risk #9 (severity is a checked
   * "info" | "warning" | "error" union, already resolved, no lookup table
   * needed). */
  diagnostics: CaosDiagnostic[];
  /** Flat semantic-token-legend-encoded quintuples once wired in Phase 2. */
  semanticTokensData: number[];
  /** From caos-kt's getCaosInlayHints, called directly against the same
   * parseResult used for diagnostics/semantic tokens above — no
   * reimplementation, no re-parse (plan/05-hover-and-inlay-hints.md). */
  inlayHints: InlayHint[];
  /** Phase-1-only smoke-test fields, safe to keep around: cheap proof the
   * worker actually parsed the text via caos-kt. */
  scriptCount: number;
  itemCount: number;
}

export interface GetCompletionsRequest extends RpcRequestBase {
  type: "getCompletions";
  variant: GameVariant;
  text: string;
  /** 0-indexed line/character, converted from the CM6 cursor offset via
   * positions.ts — no `indexing`-flag ambiguity here (risk #4 only applies
   * to Diagnostic.location; CaosCompletionOptions/CompletionItem positions
   * follow caos-kt's plain, always-0-indexed Position/Range type). */
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
  /** 0-indexed line/character, converted from the CM6 cursor offset via
   * positions.ts — same convention as GetCompletionsRequest above. */
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
