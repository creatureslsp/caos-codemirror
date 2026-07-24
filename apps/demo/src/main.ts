import { basicSetup, EditorView } from "codemirror";
import { EditorState } from "@codemirror/state";
import { CaosEngineClient } from "@caos-cm6/engine";

const logElQuery = document.querySelector<HTMLDivElement>("#log");
if (!logElQuery) throw new Error("#log element missing");
// Re-bound so the closure below sees a statically non-null type — narrowing
// from the guard above doesn't cross a function-declaration boundary.
const logEl = logElQuery;

function log(...args: unknown[]): void {
  console.log(...args);
  const line = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a, null, 2)))
    .join(" ");
  logEl.textContent += line + "\n";
}

// "*" is CAOS's real line-comment prefix. Deliberately includes an invalid
// command ("zzzz") afterwards so fullAnalysis has something non-trivial to
// parse for the smoke test.
const initialDoc = "* CAOS engine smoke test\nzzzz\n";

const editorParent = document.querySelector<HTMLDivElement>("#editor");
if (!editorParent) throw new Error("#editor element missing");

const view = new EditorView({
  state: EditorState.create({
    doc: initialDoc,
    extensions: [basicSetup],
  }),
  parent: editorParent,
});

async function runSmokeTest(): Promise<void> {
  log("Constructing CaosEngineClient (this lazily spins up the Worker)...");
  const client = new CaosEngineClient({
    onUnexpectedError: (err) => log("Worker error:", err instanceof Error ? err.message : String(err)),
  });

  const initResponse = await client.init();
  log("init() ->", initResponse);

  const setVariantResponse = await client.setVariant("DS");
  log("setVariant('DS') ->", setVariantResponse);

  const text = view.state.doc.toString();
  const fullAnalysisResponse = await client.fullAnalysis("DS", text);
  log("fullAnalysis(...) ->", fullAnalysisResponse);

  log("Smoke test complete — no errors thrown, RPC round-tripped correctly.");
}

runSmokeTest().catch((err) => {
  log("Smoke test FAILED:", err instanceof Error ? err.message : String(err));
});
