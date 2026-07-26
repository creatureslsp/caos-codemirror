/** Benchmark harness for CaosEngineClient.fullAnalysis round-trip latency. */
import { CaosEngineClient } from "@creatures-codemirror/engine";
import type { GameVariant } from "@creatures-codemirror/engine";
import { buildFixtures } from "./fixtures.js";

const RUNS_PER_FIXTURE = 8;
const VARIANT: GameVariant = "DS";

function withEditMarker(text: string, iteration: number): string {
  return `${text}* run ${iteration}\n`;
}

interface FixtureSummary {
  label: string;
  actualLines: number;
  coldMs: number;
  minMs: number;
  maxMs: number;
  meanMs: number;
}

async function benchFixture(
  client: CaosEngineClient,
  label: string,
  text: string,
): Promise<FixtureSummary> {
  const timings: number[] = [];
  for (let i = 0; i < RUNS_PER_FIXTURE; i++) {
    const docText = withEditMarker(text, i);
    const start = performance.now();
    await client.fullAnalysis(VARIANT, docText);
    timings.push(performance.now() - start);
  }
  // First iteration includes any one-time JIT/lazy-init warm-up inside
  // caos-kt; reported separately rather than folded into the mean so it
  // doesn't skew the steady-state number a debounce delay should actually
  // be tuned against.
  const [coldMs, ...warm] = timings;
  return {
    label,
    actualLines: text.split("\n").length,
    coldMs,
    minMs: Math.min(...warm),
    maxMs: Math.max(...warm),
    meanMs: warm.reduce((a, b) => a + b, 0) / warm.length,
  };
}

async function run(log: (line: string) => void): Promise<void> {
  log("Constructing CaosEngineClient...");
  const client = new CaosEngineClient({
    onUnexpectedError: (err) => log(`Worker error: ${err instanceof Error ? err.message : String(err)}`),
  });
  await client.init();
  await client.setVariant(VARIANT);
  log(`Engine ready. Running fullAnalysis benchmark (${RUNS_PER_FIXTURE} iterations per size)...\n`);

  for (const fixture of buildFixtures()) {
    log(`Running ${fixture.label}...`);
    const summary = await benchFixture(client, fixture.label, fixture.text);
    log(
      `  ${summary.label} (~${summary.actualLines} actual lines): ` +
        `cold=${summary.coldMs.toFixed(1)}ms, warm min=${summary.minMs.toFixed(1)}ms ` +
        `max=${summary.maxMs.toFixed(1)}ms mean=${summary.meanMs.toFixed(1)}ms`,
    );
  }

  log("\nDone.");
  client.dispose();
}

const outputElQuery = document.querySelector<HTMLPreElement>("#output");
const runButtonQuery = document.querySelector<HTMLButtonElement>("#run");
if (!outputElQuery || !runButtonQuery) throw new Error("bench page markup missing #output/#run");
// Re-bound so the closures below see statically non-null types — narrowing
// from the guard above doesn't cross a function-declaration boundary.
const outputEl = outputElQuery;
const runButton = runButtonQuery;

function log(line: string): void {
  console.log(line);
  outputEl.textContent += `${line}\n`;
}

runButton.addEventListener("click", () => {
  runButton.disabled = true;
  outputEl.textContent = "";
  run(log)
    .catch((err) => log(`Benchmark FAILED: ${err instanceof Error ? err.message : String(err)}`))
    .finally(() => {
      runButton.disabled = false;
    });
});
