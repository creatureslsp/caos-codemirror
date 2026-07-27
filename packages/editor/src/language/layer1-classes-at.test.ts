import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { caosLanguageSupport } from "./caos-language.js";
import { layer1ClassesAt } from "./layer1-classes-at.js";

function stateFor(doc: string): EditorState {
  return EditorState.create({ doc, extensions: [caosLanguageSupport()] });
}

describe("layer1ClassesAt", () => {
  it("classifies a numeric literal with no Layer-2 modifier concept involved", () => {
    const state = stateFor("sndc 123");
    expect(layer1ClassesAt(state, 6)).toEqual(["cm-caos-number"]);
  });

  it("classifies a command-shaped word", () => {
    const state = stateFor("sndc 123");
    expect(layer1ClassesAt(state, 1)).toEqual(["cm-caos-command"]);
  });

  it("classifies a comment line", () => {
    const state = stateFor("* a comment");
    expect(layer1ClassesAt(state, 3)).toEqual(["cm-caos-comment"]);
  });

  it("returns an empty array for insignificant whitespace", () => {
    const state = stateFor("sndc 123");
    expect(layer1ClassesAt(state, 4)).toEqual([]);
  });

  it("returns an empty array for an empty document", () => {
    expect(layer1ClassesAt(stateFor(""), 0)).toEqual([]);
  });

  it("clamps to the last character rather than throwing at doc end", () => {
    const state = stateFor("123");
    expect(layer1ClassesAt(state, 3)).toEqual(["cm-caos-number"]);
  });
});
