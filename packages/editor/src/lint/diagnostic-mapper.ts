// Maps caos-kt's Diagnostic (caos-validation-report.d.mts) to CM6's own
// Diagnostic type from @codemirror/lint — distinct types sharing a name, so
// the import aliases below are deliberately unambiguous.
import type { Text } from "@codemirror/state";
import type { Diagnostic as CM6Diagnostic } from "@codemirror/lint";
import type { CaosDiagnostic } from "@creatures-codemirror/engine";
import { adjustForIndexing } from "@creatures-codemirror/engine";

/**
 * Severity is an identity mapping (plan/00-risks-and-verified-facts.md
 * risk #9, resolved): caos-kt's `Diagnostic.severity` is a checked
 * `"info" | "warning" | "error"` union, an exact match for CM6's own
 * vocabulary (CM6's `Severity` also allows `"hint"`, which caos-kt never
 * produces). No lookup table needed.
 */
function toMessage(d: CaosDiagnostic): string {
  const parts = [d.message];

  if (d.source?.lineText) {
    parts.push(d.source.lineText);
    if (d.source.marker) parts.push(d.source.marker);
  }

  // Suggestion.replacement is explicitly documented upstream as prose
  // ("a description of what can be done to fix the problem (NOT ACTUAL
  // CODE)"), not an applicable edit — never wired into CM6's `actions`
  // auto-fix mechanism, only folded into the message as a hint.
  if (d.suggestion?.description) {
    parts.push(`Hint: ${d.suggestion.description}`);
  }

  return parts.join("\n");
}

export function toCM6Diagnostic(d: CaosDiagnostic, doc: Text): CM6Diagnostic {
  const { from, to } = adjustForIndexing(d.location, doc);
  return {
    from,
    to,
    severity: d.severity,
    message: toMessage(d),
    source: d.code,
  };
}
