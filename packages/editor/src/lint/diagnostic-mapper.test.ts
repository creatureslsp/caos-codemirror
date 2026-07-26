import { describe, expect, it } from "vitest";
import { Text } from "@codemirror/state";
import type { CaosDiagnostic } from "@creatures-codemirror/engine";
import { toCM6Diagnostic } from "./diagnostic-mapper.js";

// Minimal structural fixture — this package never imports caos-kt directly
// (plan/00-risks-and-verified-facts.md risk #2/#8), so tests build plain
// objects matching CaosDiagnostic's shape rather than calling the real
// caosValidationAsDiagnostics.
function fixture(overrides: Partial<CaosDiagnostic> = {}): CaosDiagnostic {
  return {
    severity: "error",
    code: "GENERAL",
    message: "Invalid input 'zzzz'",
    location: {
      startLine: 1,
      endLine: 1,
      startColumn: 1,
      endColumn: 5,
      startIndex: 0,
      endIndex: 4,
      indexing: "1-indexed",
    },
    ...overrides,
  };
}

describe("toCM6Diagnostic", () => {
  const doc = Text.of(["zzzz", "scrp 1 1 1 0", "endm"]);

  it("maps severity through as an identity (risk #9 — checked union matches CM6's vocabulary)", () => {
    for (const severity of ["info", "warning", "error"] as const) {
      const d = toCM6Diagnostic(fixture({ severity }), doc);
      expect(d.severity).toBe(severity);
    }
  });

  it("maps the location to a CM6 offset range via adjustForIndexing", () => {
    const d = toCM6Diagnostic(fixture(), doc);
    expect(d.from).toBe(0);
    expect(d.to).toBe(4);
  });

  it("uses the diagnostic code as the CM6 diagnostic's source", () => {
    const d = toCM6Diagnostic(fixture({ code: "UNKNOWN_COMMAND" }), doc);
    expect(d.source).toBe("UNKNOWN_COMMAND");
  });

  it("uses the bare message when there's no source snippet or suggestion", () => {
    const d = toCM6Diagnostic(fixture(), doc);
    expect(d.message).toBe("Invalid input 'zzzz'");
  });

  it("folds source.lineText and source.marker into the message", () => {
    const d = toCM6Diagnostic(
      fixture({ source: { lineText: "zzzz", marker: "^^^^" } }),
      doc,
    );
    expect(d.message).toBe("Invalid input 'zzzz'\nzzzz\n^^^^");
  });

  it("folds suggestion.description in as a 'Hint: ...' suffix", () => {
    const d = toCM6Diagnostic(
      fixture({ suggestion: { description: "Did you mean 'sndc'?" } }),
      doc,
    );
    expect(d.message).toBe("Invalid input 'zzzz'\nHint: Did you mean 'sndc'?");
  });

  it("does not wire suggestion.replacement into an auto-fix action", () => {
    const d = toCM6Diagnostic(
      fixture({
        suggestion: { description: "Did you mean 'sndc'?", replacement: "sndc" },
      }),
      doc,
    );
    expect(d.actions).toBeUndefined();
  });
});
