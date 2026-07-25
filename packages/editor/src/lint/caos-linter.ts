// Wires @codemirror/lint to the engine Worker's fullAnalysis RPC, mapping
// caos-kt's Diagnostic[] to CM6 lint Diagnostic[] via diagnostic-mapper.ts.
// See plan/03-validation-diagnostics.md.
import { linter, type Diagnostic as CM6Diagnostic, type LintSource } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
import type { CaosEngineClient, GameVariant } from "@caos-cm6/engine";
import { toCM6Diagnostic } from "./diagnostic-mapper.js";

export interface CaosLinterOptions {
  client: CaosEngineClient;
  getVariant: () => GameVariant;
  /** Time to wait after the last edit before linting (@codemirror/lint's own
   * debounce). Independent of Layer 2's semantic-token debounce, but both
   * ultimately share one worker round trip per unchanged document via
   * CaosEngineClient.fullAnalysis's own content-keyed memoization (risk #7)
   * rather than double-parsing. */
  delay?: number;
}

function makeSource(options: CaosLinterOptions): LintSource {
  const { client, getVariant } = options;

  return async (view): Promise<CM6Diagnostic[]> => {
    const text = view.state.doc.toString();
    const variant = getVariant();

    // Deliberately rethrown, not caught-and-emptied: @codemirror/lint's own
    // lintPlugin only dispatches setDiagnostics on a *fulfilled* source
    // promise (batchResults never calls sink() for a rejected source), so
    // letting fullAnalysis's rejection (cancelled/stale/worker error)
    // propagate here leaves the existing diagnostics on screen untouched
    // instead of flashing them to empty.
    const response = await client.fullAnalysis(variant, text);

    // Redundant with @codemirror/lint's own "doc == state.doc" dispatch
    // guard (it captures the pre-request doc and compares before applying
    // results), but kept for consistency with the semantic-tokens plugin's
    // identical belt-and-suspenders check.
    if (view.state.doc.toString() !== text) return [];

    return response.diagnostics.map((d) => toCM6Diagnostic(d, view.state.doc));
  };
}

export function caosLinter(options: CaosLinterOptions): Extension {
  const { delay = 300 } = options;
  return linter(makeSource(options), { delay });
}
