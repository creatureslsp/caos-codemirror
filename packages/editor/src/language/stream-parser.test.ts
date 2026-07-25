import { describe, expect, it } from "vitest";
import { StringStream } from "@codemirror/language";
import { caosStreamParser } from "./stream-parser.js";

interface TokenResult {
  text: string;
  tag: string | null;
}

/** Feeds a whole (possibly multi-line) fixture through the real StreamParser
 * exactly the way CM6's StreamLanguage driver would: one StringStream per
 * line, one shared mutable state object carried across lines. */
function tokenizeDoc(text: string): TokenResult[] {
  const state = caosStreamParser.startState!(2);
  const results: TokenResult[] = [];
  for (const line of text.split("\n")) {
    const stream = new StringStream(line, 4, 2);
    while (!stream.eol()) {
      // Mirrors @codemirror/language's internal readToken(), which resets
      // stream.start = stream.pos before every token() call — our parser
      // relies on that for stream.current() to return just the newly
      // matched text, not everything consumed so far on the line.
      stream.start = stream.pos;
      const before = stream.pos;
      const tag = caosStreamParser.token(stream, state);
      // Every branch must consume at least one character per call, or CM6
      // would spin forever — guard it here too.
      expect(stream.pos).toBeGreaterThan(before);
      results.push({ text: stream.current(), tag });
    }
  }
  return results;
}

function tags(text: string): (string | null)[] {
  return tokenizeDoc(text).map((r) => r.tag);
}

/** Drops the insignificant null-tagged whitespace tokens eatSpace()
 * produces between real tokens, so tests can assert on the tokens that
 * actually matter without spelling out every space run. */
function significant(results: TokenResult[]): TokenResult[] {
  return results.filter((r) => !(r.tag === null && r.text.trim() === ""));
}

describe("caosStreamParser — comments", () => {
  it("tokenizes a whole-line comment as lineComment", () => {
    const result = tokenizeDoc("* this is a comment");
    expect(result).toEqual([{ text: "* this is a comment", tag: "lineComment" }]);
  });

  it("allows leading whitespace before the comment marker", () => {
    expect(significant(tokenizeDoc("   * indented comment")).map((r) => r.tag)).toEqual([
      "lineComment",
    ]);
  });
});

describe("caosStreamParser — CAOS2Pray mini-grammar", () => {
  it("tokenizes a **caos2pray header line as one caos2Directive span", () => {
    const result = tokenizeDoc("**caos2pray Scriptorium");
    expect(result).toEqual([{ text: "**caos2pray Scriptorium", tag: "caos2Directive" }]);
  });

  it("tokenizes a key = quoted-value directive line", () => {
    const result = significant(tokenizeDoc('*#Name = "Foo"'));
    expect(result).toEqual([
      { text: "*#Name", tag: "caos2Directive" },
      { text: "=", tag: "caos2Eq" },
      { text: '"Foo"', tag: "string" },
    ]);
  });

  it("tokenizes a key-only directive line with no '=' (stops key at first space)", () => {
    const result = tokenizeDoc("*#Attach");
    expect(result).toEqual([{ text: "*#Attach", tag: "caos2Directive" }]);
  });

  it("does not leak directive state across lines", () => {
    const result = significant(tokenizeDoc('*#Name = "Foo"\nsndc "meow"'));
    // "sndc" isn't a real directive line — must be tokenized as a normal
    // 4-char command-heuristic word, not swallowed as a caos2 value.
    expect(result.slice(3)).toEqual([
      { text: "sndc", tag: "commandHeuristic" },
      { text: '"', tag: "string" },
      { text: "meow", tag: "string" },
      { text: '"', tag: "string" },
    ]);
  });
});

describe("caosStreamParser — strings", () => {
  it("tokenizes a quoted string with an escape sequence", () => {
    const result = tokenizeDoc('"a\\"b"');
    expect(result).toEqual([
      { text: '"', tag: "string" },
      { text: "a", tag: "string" },
      { text: '\\"', tag: "escape" },
      { text: "b", tag: "string" },
      { text: '"', tag: "string" },
    ]);
  });

  it("does not span an unterminated quoted string across lines", () => {
    const result = tokenizeDoc('"unterminated\nabcd');
    const firstLine = result.filter((r) => r.text !== "abcd");
    expect(firstLine.every((r) => r.tag === "string")).toBe(true);
    // "abcd" on line 2 must NOT be swallowed as string content.
    expect(result.at(-1)).toEqual({ text: "abcd", tag: "commandHeuristic" });
  });

  it("tokenizes bracket-string content uniformly as string (no byte-string disambiguation)", () => {
    expect(tags("[1 2 3]")).toEqual(["string", "string", "string"]);
  });
});

describe("caosStreamParser — SUBR/GSUB labels", () => {
  it("tags the word after SUBR as labelName", () => {
    const result = significant(tokenizeDoc("subr MySubroutine"));
    expect(result).toEqual([
      { text: "subr", tag: "controlKeyword" },
      { text: "MySubroutine", tag: "labelName" },
    ]);
  });

  it("tags the word after GSUB as labelName", () => {
    const result = significant(tokenizeDoc("gsub MySubroutine"));
    expect(result).toEqual([
      { text: "gsub", tag: "commandHeuristic" },
      { text: "MySubroutine", tag: "labelName" },
    ]);
  });
});

describe("caosStreamParser — keyword-pair block words", () => {
  it.each([
    "doif", "elif", "else", "endi",
    "reps", "repe",
    "loop", "untl", "ever",
    "enum", "next", "subr", "retn", "scrp", "iscr", "rscr",
    "etch", "esee", "epas", "econ", "elst", "escn", "nscn",
  ])("tags '%s' as controlKeyword", (word) => {
    expect(tags(word)).toEqual(["controlKeyword"]);
  });

  it("is case-insensitive", () => {
    expect(tags("DOIF")).toEqual(["controlKeyword"]);
  });
});

describe("caosStreamParser — numeric literals", () => {
  it("tags an int literal", () => {
    expect(tags("123")).toEqual(["number"]);
  });

  it("tags a signed int literal", () => {
    expect(tags("-42")).toEqual(["number"]);
  });

  it("tags a float literal", () => {
    expect(tags("3.14")).toEqual(["number"]);
  });

  it("tags a hex literal", () => {
    expect(tags("0x1F")).toEqual(["number"]);
  });
});

describe("caosStreamParser — dual-spelling relational operators", () => {
  it("tags both textual and symbolic spellings as compareOperator", () => {
    expect(tags("eq")).toEqual(["compareOperator"]);
    expect(tags("=")).toEqual(["compareOperator"]);
    expect(tags("ne")).toEqual(["compareOperator"]);
    expect(tags("<>")).toEqual(["compareOperator"]);
    expect(tags("gt")).toEqual(["compareOperator"]);
    expect(tags(">")).toEqual(["compareOperator"]);
  });
});

describe("caosStreamParser — 4-char command-word heuristic", () => {
  it("tags an unclassified 4-letter word as commandHeuristic", () => {
    expect(tags("sndc")).toEqual(["commandHeuristic"]);
  });

  it("does not misclassify a real control keyword as a command", () => {
    // "endi" is 4 chars but must stay controlKeyword, not commandHeuristic.
    expect(tags("endi")).toEqual(["controlKeyword"]);
  });
});

describe("caosStreamParser — state never gets stuck", () => {
  it("tokenizes a realistic multi-construct fixture without desync", () => {
    const fixture = [
      "**caos2pray",
      '*#Agent Type = "Bug"',
      "* set up a variable",
      "subr StartUp",
      "  doif va00 eq 1",
      '    sndc "meow"',
      "  endi",
      "  gsub Helper",
      "retn",
    ].join("\n");
    // Should not throw (the in-loop assertion in tokenizeDoc guards
    // against a stuck/non-progressing state), and should produce a
    // non-trivial number of tokens.
    expect(tokenizeDoc(fixture).length).toBeGreaterThan(10);
  });
});
