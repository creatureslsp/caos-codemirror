// Main-thread wrapper around the CAOS engine Worker: correlates
// request/response pairs by id and drops responses to stale requests.
import type {
  CancelRequest,
  FullAnalysisResponse,
  GetCompletionsResponse,
  GetHoverResponse,
  InitResponse,
  RequestKind,
  RpcRequest,
  RpcResponse,
  SetVariantResponse,
} from "../worker/rpc-protocol.js";
import type { GameVariant } from "../shared/variant.js";

export interface CaosEngineClientOptions {
  /** Called for Worker-level failures (e.g. a script error), not per-request
   * rejections — those are surfaced through the returned promise instead. */
  onUnexpectedError?: (error: unknown) => void;
}

/** Rejection reason used for a request superseded by bumpRevision() (or an
 * explicit cancel() call). */
export class CancelledError extends Error {
  constructor() {
    super("cancelled");
    this.name = "CancelledError";
  }
}

interface PendingEntry {
  resolve: (response: RpcResponse) => void;
  reject: (reason: unknown) => void;
  revision: number;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type OutgoingRequest = DistributiveOmit<
  Extract<RpcRequest, { type: Exclude<RequestKind, "cancel"> }>,
  "id" | "revision"
>;

export class CaosEngineClient {
  private readonly worker: Worker;
  private nextId = 1;
  private revision = 0;
  private readonly pending = new Map<number, PendingEntry>();
  // Coalesces concurrent fullAnalysis() calls for the same parameters into a single worker round trip.
  private lastAnalysisKey: string | null = null;
  private lastAnalysisPromise: Promise<FullAnalysisResponse> | null = null;

  constructor(private readonly options: CaosEngineClientOptions = {}) {
    this.worker = new Worker(new URL("../worker/caos.worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (event: MessageEvent<RpcResponse>) => this.handleMessage(event.data);
    this.worker.onerror = (event: ErrorEvent) => {
      this.options.onUnexpectedError?.(event.error ?? event.message);
    };
  }

  /** Bumps the document revision and cancels all currently in-flight requests. */
  bumpRevision(): number {
    this.revision += 1;
    for (const id of [...this.pending.keys()]) {
      this.cancel(id);
    }
    return this.revision;
  }

  init(): Promise<InitResponse> {
    return this.send({ type: "init" }) as Promise<InitResponse>;
  }

  setVariant(variant: GameVariant): Promise<SetVariantResponse> {
    return this.send({ type: "setVariant", variant }) as Promise<SetVariantResponse>;
  }

  fullAnalysis(
    variant: GameVariant,
    text: string,
    disabledInlayHints: string[] = [],
    minimumParameterCount?: number | null,
  ): Promise<FullAnalysisResponse> {
    const key = `${variant} ${minimumParameterCount ?? ""} ${disabledInlayHints.join(",")} ${text}`;
    if (this.lastAnalysisKey === key && this.lastAnalysisPromise) {
      return this.lastAnalysisPromise;
    }

    const promise = this.send({
      type: "fullAnalysis",
      variant,
      text,
      disabledInlayHints,
      minimumParameterCount,
    }) as Promise<FullAnalysisResponse>;
    this.lastAnalysisKey = key;
    this.lastAnalysisPromise = promise;
    promise.catch(() => {
      if (this.lastAnalysisPromise === promise) {
        this.lastAnalysisKey = null;
        this.lastAnalysisPromise = null;
      }
    });
    return promise;
  }

  getCompletions(
    variant: GameVariant,
    text: string,
    line: number,
    character: number,
  ): Promise<GetCompletionsResponse> {
    return this.send({
      type: "getCompletions",
      variant,
      text,
      line,
      character,
    }) as Promise<GetCompletionsResponse>;
  }

  getHover(variant: GameVariant, text: string, line: number, character: number): Promise<GetHoverResponse> {
    return this.send({
      type: "getHover",
      variant,
      text,
      line,
      character,
    }) as Promise<GetHoverResponse>;
  }

  cancel(id: number): void {
    const request: CancelRequest = { type: "cancel", id };
    this.worker.postMessage(request);
    const entry = this.pending.get(id);
    if (entry) {
      this.pending.delete(id);
      entry.reject(new CancelledError());
    }
  }

  dispose(): void {
    this.worker.terminate();
    this.pending.clear();
  }

  private send(partial: OutgoingRequest): Promise<RpcResponse> {
    const id = this.nextId++;
    const revision = this.revision;
    const request = { ...partial, id, revision } as RpcRequest;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, revision });
      this.worker.postMessage(request);
    });
  }

  private handleMessage(response: RpcResponse): void {
    const entry = this.pending.get(response.id);
    if (!entry) return; // unknown, already cancelled, or already handled
    this.pending.delete(response.id);
    if (entry.revision !== this.revision) return; // stale response, drop silently
    if (response.ok) {
      entry.resolve(response);
    } else {
      entry.reject(new Error(response.error));
    }
  }
}
