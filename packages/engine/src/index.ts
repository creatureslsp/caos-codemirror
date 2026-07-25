export { CaosEngineClient } from "./main/worker-client.js";
export type { CaosEngineClientOptions } from "./main/worker-client.js";
export type { GameVariant } from "./shared/variant.js";
export { GAME_VARIANTS } from "./shared/variant.js";
export { adjustForIndexing, cmOffsetToLineChar, lineCharToCmOffset } from "./shared/positions.js";
export type { IndexedLocation, LineChar } from "./shared/positions.js";
export type {
  CaosCompletionItem,
  CaosDiagnostic,
  CaosHover,
  CaosInlayHint,
  FullAnalysisRequest,
  FullAnalysisResponse,
  GetCompletionsRequest,
  GetCompletionsResponse,
  GetHoverRequest,
  GetHoverResponse,
  InitRequest,
  InitResponse,
  RpcRequest,
  RpcResponse,
  SetVariantRequest,
  SetVariantResponse,
} from "./worker/rpc-protocol.js";
