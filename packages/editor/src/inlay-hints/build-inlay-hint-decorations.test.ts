import { describe, expect, it } from "vitest";
import { Text } from "@codemirror/state";
import type { CaosInlayHint } from "@creatures-codemirror/engine";
import { buildInlayHintDecorations } from "./build-inlay-hint-decorations.js";
import { InlayHintWidget } from "./inlay-hint-widget.js";

// Minimal structural fixture — this package never imports caos-kt directly
// (plan/00-risks-and-verified-facts.md risk #2/#8), matching diagnostic-
// mapper.test.ts's fixture pattern rather than calling the real
// getCaosInlayHints.
function fixture(overrides: Partial<CaosInlayHint> = {}): CaosInlayHint {
  return {
    position: { line: 0, character: 0 },
    label: "(Carryable,Mouseable)",
    ...overrides,
  };
}

function widgetsOf(doc: Text, hints: CaosInlayHint[]): InlayHintWidget[] {
  const decorations = buildInlayHintDecorations(doc, hints);
  const widgets: InlayHintWidget[] = [];
  decorations.between(0, doc.length, (_from, _to, deco) => {
    widgets.push(deco.spec.widget as InlayHintWidget);
  });
  return widgets;
}

describe("buildInlayHintDecorations", () => {
  const doc = Text.of(["attr 3", "setv va00 1"]);

  it("renders a bitflag hint label as-is (already parenthesized by caos-kt)", () => {
    const widgets = widgetsOf(doc, [fixture({ position: { line: 0, character: 6 } })]);
    expect(widgets).toHaveLength(1);
    expect(widgets[0].label).toBe("(Carryable,Mouseable)");
  });

  it("filters out a degenerate empty-parens bitflag label (value with no matching named flags)", () => {
    const widgets = widgetsOf(doc, [fixture({ label: "()" })]);
    expect(widgets).toHaveLength(0);
  });

  it("filters out an empty-string label", () => {
    const widgets = widgetsOf(doc, [fixture({ label: "" })]);
    expect(widgets).toHaveLength(0);
  });

  it("joins InlayHintLabelPart[] label parts into plain text", () => {
    const widgets = widgetsOf(doc, [
      fixture({ label: [{ value: "attributes" }, { value: ":" }] }),
    ]);
    expect(widgets[0].label).toBe("attributes:");
  });

  it("extracts tooltip text from a plain string", () => {
    const widgets = widgetsOf(doc, [fixture({ tooltip: "Carryable: can be picked up" })]);
    expect(widgets[0].tooltip).toBe("Carryable: can be picked up");
  });

  it("extracts tooltip text from MarkupContent", () => {
    const widgets = widgetsOf(doc, [
      fixture({ tooltip: { kind: "markdown", value: "**Carryable**" } }),
    ]);
    expect(widgets[0].tooltip).toBe("**Carryable**");
  });

  it("defaults paddingLeft/paddingRight to false when absent", () => {
    const widgets = widgetsOf(doc, [fixture()]);
    expect(widgets[0].paddingLeft).toBe(false);
    expect(widgets[0].paddingRight).toBe(false);
  });

  it("sorts hints into ascending doc-offset order even when given out of order", () => {
    const hints = [
      fixture({ position: { line: 1, character: 5 }, label: "(second)" }),
      fixture({ position: { line: 0, character: 5 }, label: "(first)" }),
    ];
    // buildInlayHintDecorations must not throw (RangeSetBuilder requires
    // strictly ascending add() order — plan's "Critical CM6 correctness
    // detail") and must yield hints in ascending position order regardless
    // of input order.
    const widgets = widgetsOf(doc, hints);
    expect(widgets.map((w) => w.label)).toEqual(["(first)", "(second)"]);
  });
});
