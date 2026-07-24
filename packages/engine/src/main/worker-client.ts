// Main-thread wrapper around the CAOS engine Worker: correlates
// request/response pairs by id, and drops responses to stale requests as a
// defense-in-depth guard on top of explicit cancellation
// (plan/00-risks-and-verified-facts.md risk #7).
import type {
  CancelRequest,
  FullAnalysisResponse,
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

  fullAnalysis(variant: GameVariant, text: string): Promise<FullAnalysisResponse> {
    return this.send({ type: "fullAnalysis", variant, text }) as Promise<FullAnalysisResponse>;
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
