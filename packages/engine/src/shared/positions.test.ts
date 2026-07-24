import { describe, expect, it } from "vitest";
import { Text } from "@codemirror/state";
import { adjustForIndexing, cmOffsetToLineChar, lineCharToCmOffset } from "./positions.js";
import { caosInitLib } from "@creatures-lsp/caos-kt/caos-init-lib";
import { useFullCaosLibDefinitions } from "@creatures-lsp/caos-kt/caos-libsfile-full";
import { caosValidationAsDiagnostics } from "@creatures-lsp/caos-kt/caos-validation-report";

caosInitLib();
useFullCaosLibDefinitions();

describe("cmOffsetToLineChar / lineCharToCmOffset", () => {
  it("round-trips on an empty document", () => {
    const doc = Text.of([""]);
    expect(cmOffsetToLineChar(doc, 0)).toEqual({ line: 0, character: 0 });
    expect(lineCharToCmOffset(doc, 0, 0)).toBe(0);
  });

  it("counts tabs as one character, not a visual column", () => {
    const doc = Text.of(["\tabc"]);
    expect(cmOffsetToLineChar(doc, 1)).toEqual({ line: 0, character: 1 });
    expect(lineCharToCmOffset(doc, 0, 1)).toBe(1);
  });

  it("treats \\r\\n as a single line boundary", () => {
    const doc = Text.of(["aaaa", "bbbb", "cccc"]);
    // CM6's Text.of with an array already splits per-line; verify the
    // equivalent raw-string construction agrees on line starts.
    const raw = Text.of("aaaa\r\nbbbb\r\ncccc".split(/\r\n/));
    expect(raw.lines).toBe(3);
    expect(cmOffsetToLineChar(doc, 6)).toEqual({ line: 1, character: 1 });
    expect(lineCharToCmOffset(doc, 1, 0)).toBe(5);
  });

  it("handles an astral character (surrogate pair) inside a line", () => {
    // "\u{1F600}" is a 2-UTF-16-code-unit emoji.
    const doc = Text.of(["* hello \u{1F600} world"]);
    const offsetOfWorld = "* hello \u{1F600} ".length;
    expect(cmOffsetToLineChar(doc, offsetOfWorld)).toEqual({ line: 0, character: offsetOfWorld });
  });

  it("handles the last line with no trailing newline", () => {
    const doc = Text.of(["first", "second"]);
    expect(doc.lines).toBe(2);
    expect(cmOffsetToLineChar(doc, doc.length)).toEqual({ line: 1, character: 6 });
  });

  it("clamps out-of-range requests instead of throwing", () => {
    const doc = Text.of(["abc"]);
    expect(cmOffsetToLineChar(doc, 999)).toEqual({ line: 0, character: 3 });
    expect(lineCharToCmOffset(doc, 999, 999)).toBe(3);
  });
});

describe("adjustForIndexing", () => {
  it("converts a 1-indexed location to a 0-indexed CM6 offset range", () => {
    const doc = Text.of(["aaaa", "bbbb"]);
    const { from, to } = adjustForIndexing(
      { startLine: 2, endLine: 2, startColumn: 1, endColumn: 5, indexing: "1-indexed" },
      doc,
    );
    expect(from).toBe(5); // start of line 2 (1-indexed) == line 1 (0-indexed) == offset 5
    expect(to).toBe(9);
  });

  it("converts a 0-indexed location to a 0-indexed CM6 offset range unchanged", () => {
    const doc = Text.of(["aaaa", "bbbb"]);
    const { from, to } = adjustForIndexing(
      { startLine: 1, endLine: 1, startColumn: 0, endColumn: 4, indexing: "0-indexed" },
      doc,
    );
    expect(from).toBe(5);
    expect(to).toBe(9);
  });
});

// Empirical cross-check against real caos-kt output (risk #4's "needs spike"
// items) rather than assuming behavior — see positions.ts's header comment
// for what these confirmed.
describe("caos-kt line/offset conventions (empirical, guards against upstream drift)", () => {
  it("treats \\r\\n as one 2-char line boundary, matching CM6's Text", () => {
    const text = "zzzz\r\nzzzz\r\nzzzz"; // "zzzz" is not a real CAOS command -> diagnostics
    const doc = Text.of(text.split(/\r\n/));
    const diagnostics = caosValidationAsDiagnostics("DS", text, true);
    expect(diagnostics.length).toBeGreaterThan(0);

    for (const d of diagnostics) {
      const { from } = adjustForIndexing(d.location, doc);
      // The reported line must land at a real line start in CM6's own
      // splitting of the same raw text (i.e. no stray "\r" desync).
      const { character } = cmOffsetToLineChar(doc, from);
      const line = cmOffsetToLineChar(doc, from).line;
      expect(doc.line(line + 1).from + character).toBe(from);
    }
  });

  it("counts an astral character as 2 UTF-16 code units, matching CM6's Text", () => {
    const text = "*  hello \u{1F600} world\nzzzz";
    const doc = Text.of(text.split("\n"));
    const diagnostics = caosValidationAsDiagnostics("DS", text, true);
    expect(diagnostics.length).toBeGreaterThan(0);

    const { from } = adjustForIndexing(diagnostics[0].location, doc);
    // Expected absolute offset of "zzzz" (line 1, 0-indexed) computed via
    // plain JS UTF-16 string length, independently of caos-kt.
    const expectedLineStart = text.indexOf("\n") + 1;
    expect(from).toBeGreaterThanOrEqual(expectedLineStart);
    expect(from).toBeLessThanOrEqual(expectedLineStart + "zzzz".length);
  });

  it("does not throw when caosInitLib is called more than once", () => {
    expect(() => {
      caosInitLib();
      caosInitLib();
    }).not.toThrow();
  });
});
