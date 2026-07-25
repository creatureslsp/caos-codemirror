// Exercises CaosEngineClient's request/response bookkeeping without a real
// Worker (Node's "node" test environment has no global Worker — see
// vitest.config.ts) or a real caos-kt engine: a minimal MockWorker fake
// stands in, letting these tests assert on exactly what gets posted and
// simulate exactly what comes back.
import { describe, expect, it, vi } from "vitest";
import { CancelledError, CaosEngineClient } from "./worker-client.js";
import type { RpcRequest, RpcResponse } from "../worker/rpc-protocol.js";

class MockWorker {
  static instances: MockWorker[] = [];
  sent: RpcRequest[] = [];
  onmessage: ((event: MessageEvent<RpcResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  constructor(_url: unknown, _opts: unknown) {
    MockWorker.instances.push(this);
  }

  postMessage(message: RpcRequest): void {
    this.sent.push(message);
  }

  terminate(): void {}

  /** Simulates the worker replying, from the test's side. */
  respond(response: RpcResponse): void {
    this.onmessage?.({ data: response } as MessageEvent<RpcResponse>);
  }
}

function makeClient(): { client: CaosEngineClient; worker: MockWorker } {
  vi.stubGlobal("Worker", MockWorker);
  const client = new CaosEngineClient();
  const worker = MockWorker.instances[MockWorker.instances.length - 1];
  return { client, worker };
}

describe("CaosEngineClient", () => {
  it("bumpRevision() cancels every currently in-flight request", async () => {
    const { client, worker } = makeClient();

    const promise = client.fullAnalysis("DS", "some text");
    expect(worker.sent).toEqual([
      expect.objectContaining({ type: "fullAnalysis", text: "some text", id: 1, revision: 0 }),
    ]);

    client.bumpRevision();

    // A real {type:"cancel"} message reaches the worker (this is the actual
    // fix — request-registry.ts's keepGoing flag flips so caos-kt's
    // parse/validation loop can abort early, not just get its result
    // silently dropped on arrival).
    expect(worker.sent).toEqual([
      expect.objectContaining({ type: "fullAnalysis", id: 1 }),
      expect.objectContaining({ type: "cancel", id: 1 }),
    ]);

    await expect(promise).rejects.toBeInstanceOf(CancelledError);
  });

  it("bumpRevision() is a no-op when nothing is pending", () => {
    const { client, worker } = makeClient();
    expect(() => client.bumpRevision()).not.toThrow();
    expect(worker.sent).toEqual([]);
  });

  it("drops a response that arrives for an already-cancelled request", async () => {
    const { client, worker } = makeClient();

    const promise = client.fullAnalysis("DS", "some text");
    client.bumpRevision();
    await expect(promise).rejects.toBeInstanceOf(CancelledError);

    // The worker "finishes anyway" and replies late — handleMessage must
    // find no pending entry for this id and do nothing (no throw, no
    // second settle attempt on an already-rejected promise).
    expect(() =>
      worker.respond({ id: 1, ok: true, diagnostics: [], semanticTokensData: [], inlayHints: [], scriptCount: 0, itemCount: 0 }),
    ).not.toThrow();
  });

  it("cancel() rejects the pending request with CancelledError", async () => {
    const { client } = makeClient();
    const promise = client.fullAnalysis("DS", "some text");
    client.cancel(1);
    await expect(promise).rejects.toBeInstanceOf(CancelledError);
  });

  it("a fulfilled response still resolves normally after an unrelated bumpRevision from before it was sent", async () => {
    const { client, worker } = makeClient();

    client.bumpRevision(); // no-op, nothing pending yet
    const promise = client.fullAnalysis("DS", "some text");
    worker.respond({ id: 1, ok: true, diagnostics: [], semanticTokensData: [1, 2, 3], inlayHints: [], scriptCount: 1, itemCount: 2 });

    const result = await promise;
    expect(result.semanticTokensData).toEqual([1, 2, 3]);
  });
});
