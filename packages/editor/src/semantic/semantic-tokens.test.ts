import { describe, expect, it } from "vitest";
import { Text } from "@codemirror/state";
import { classNamesFor, decodeSemanticTokens } from "./decode-semantic-tokens.js";
import { buildSemanticDecorations } from "./build-decorations.js";
import type { SemanticTokensLegend } from "./legend.js";

// Test legend order matching semantics-legend.ts.
const legend: SemanticTokensLegend = {
  tokenTypes: [
    "command", "rvalue", "lvalue", "string", "token", "variable",
    "unknown-type", "subroutine-name", "dde-pict-token", "eqOp", "eqJoin",
    "placeholder-text", "caos2pray-tag", "caos2pray-command",
    "string-escape-character", "number",
  ],
  tokenModifiers: [
    "c1-string", "quote-string", "byte-string", "found", "not-found",
    "vaxx", "ovxx", "mvxx", "returns-number", "returns-string",
    "returns-int", "returns-float", "returns-variable", "returns-agent",
    "agent-constructor", "command-prefix", "command-suffix", "official",
  ],
};

describe("decodeSemanticTokens", () => {
  it("decodes a single-line pair of tokens (delta-from-previous-start on the same line)", () => {
    // "sndc" at [0,4) -> type 0 (command), no modifiers.
    // "va00" at [5,9) -> type 5 (variable), modifier bit 5 ("vaxx").
    const data = [0, 0, 4, 0, 0, 0, 5, 4, 5, 1 << 5];
    expect(decodeSemanticTokens(data)).toEqual([
      { line: 0, character: 0, length: 4, typeIndex: 0, modifierBitmask: 0 },
      { line: 0, character: 5, length: 4, typeIndex: 5, modifierBitmask: 1 << 5 },
    ]);
  });

  it("resets character to an absolute offset when the line changes", () => {
    // line 0: "doif" at [0,4). line 2 (deltaLine=2): "endi" at absolute [2,6).
    const data = [0, 0, 4, 6, 0, 2, 2, 4, 6, 0];
    expect(decodeSemanticTokens(data)).toEqual([
      { line: 0, character: 0, length: 4, typeIndex: 6, modifierBitmask: 0 },
      { line: 2, character: 2, length: 4, typeIndex: 6, modifierBitmask: 0 },
    ]);
  });

  it("ignores a trailing partial quintuple", () => {
    expect(decodeSemanticTokens([0, 0, 4, 0, 0, 1, 2])).toHaveLength(1);
  });
});

describe("classNamesFor", () => {
  it("emits only the type class when no modifier bits are set", () => {
    const token = { line: 0, character: 0, length: 4, typeIndex: 0, modifierBitmask: 0 };
    expect(classNamesFor(token, legend)).toEqual(["cm-caos-sem-command"]);
  });

  it("emits the type class plus one class per set modifier bit", () => {
    const token = {
      line: 0,
      character: 0,
      length: 4,
      typeIndex: 5,
      modifierBitmask: (1 << 5) | (1 << 4),
    };
    expect(classNamesFor(token, legend)).toEqual([
      "cm-caos-sem-variable",
      "cm-caos-mod-not-found",
      "cm-caos-mod-vaxx",
    ]);
  });
});

describe("buildSemanticDecorations", () => {
  it("converts decoded tokens to CM6 offset ranges with the right classes", () => {
    const doc = Text.of(["sndc va00"]);
    const data = [0, 0, 4, 0, 0, 0, 5, 4, 5, 1 << 5];
    const decorations = buildSemanticDecorations(doc, data, legend);

    const ranges: { from: number; to: number; class: string }[] = [];
    decorations.between(0, doc.length, (from, to, deco) => {
      ranges.push({ from, to, class: (deco.spec as { class: string }).class });
    });

    expect(ranges).toEqual([
      { from: 0, to: 4, class: "cm-caos-sem-command" },
      { from: 5, to: 9, class: "cm-caos-sem-variable cm-caos-mod-vaxx" },
    ]);
  });

  it("skips a token whose type index has no legend entry (empty class list)", () => {
    const doc = Text.of(["abcd"]);
    // typeIndex 99 doesn't exist in the legend -> no class -> skipped.
    const data = [0, 0, 4, 99, 0];
    const decorations = buildSemanticDecorations(doc, data, legend);
    let count = 0;
    decorations.between(0, doc.length, () => {
      count++;
    });
    expect(count).toBe(0);
  });
});
