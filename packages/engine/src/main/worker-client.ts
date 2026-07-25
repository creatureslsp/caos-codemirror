// Main-thread wrapper around the CAOS engine Worker: correlates
// request/response pairs by id, and drops responses to stale requests as a
// defense-in-depth guard on top of explicit cancellation
// (plan/00-risks-and-verified-facts.md risk #7).
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

interface PendingEntry {
  resolve: (response: RpcResponse) => void;
  reject: (reason: unknown) => void;
  revision: number;
}

// Plain `Omit` is not distributive over unions (it collapses to only the
// keys common to every member); this form re-distributes over each member
// of the union first so request-kind-specific fields (e.g. `variant`,
// `text`) survive.
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
  // Coalesces concurrent/near-simultaneous fullAnalysis() calls for the same
  // (variant, text) pair into a single worker round trip (plan/00-risks-and-
  // verified-facts.md risk #7): Phase 2's semantic-tokens plugin and Phase
  // 3's linter each independently debounce and call fullAnalysis with their
  // own timers, so without this a keystroke pause could trigger two
  // requests — each re-parsing the identical document — instead of one.
  // Keyed by content rather than revision since validity depends on the
  // text/variant matching, not on request bookkeeping. Kept as a single
  // most-recent entry (not a full cache) since only back-to-back requests
  // for the same content need to share a result.
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

  /** Bump on every document change; requests sent under a revision that is
   * no longer current have their responses silently dropped. */
  bumpRevision(): number {
    this.revision += 1;
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
    // Inlay-hint options are part of the cache key (not just variant/text):
    // toggling them must produce a fresh worker round trip rather than
    // reusing a memoized response computed under different settings.
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
    // Drop the cache entry on failure (cancelled/stale/worker error) so a
    // retry for the same content doesn't reuse a rejected promise forever.
    promise.catch(() => {
      if (this.lastAnalysisPromise === promise) {
        this.lastAnalysisKey = null;
        this.lastAnalysisPromise = null;
      }
    });
    return promise;
  }

  // Deliberately never debounced or memoized (unlike fullAnalysis above) —
  // plan/00-risks-and-verified-facts.md risk #7: perceived responsiveness
  // matters most here, and it's only tenable because the worker calls the
  // cheap, scoped parseCaosNear internally rather than a full-document
  // parse. Staleness across rapid keystrokes is still handled generically —
  // a document edit bumps the revision (see semantic-tokens-plugin.ts),
  // which drops any in-flight response, including a completions one, whose
  // revision no longer matches (handleMessage below).
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

  // Deliberately never debounced or memoized, same rationale as
  // getCompletions above: a hover request fires once per pointer-idle at a
  // single position and the worker's getHoverItem call is cheap. Staleness
  // is handled the same generic revision-drop way in handleMessage below.
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
      entry.reject(new Error("cancelled"));
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
