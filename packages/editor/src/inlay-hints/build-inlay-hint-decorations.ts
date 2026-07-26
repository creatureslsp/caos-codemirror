// Builds a CM6 DecorationSet from raw InlayHint[] data.
import type { Text } from "@codemirror/state";
import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, type DecorationSet } from "@codemirror/view";
import type { CaosInlayHint } from "@creatures-codemirror/engine";
import { lineCharToCmOffset } from "@creatures-codemirror/engine";
import { InlayHintWidget } from "./inlay-hint-widget.js";

function labelText(label: CaosInlayHint["label"]): string {
  return typeof label === "string" ? label : label.map((part) => part.value).join("");
}

function tooltipText(tooltip: CaosInlayHint["tooltip"]): string | undefined {
  if (tooltip == null) return undefined;
  return typeof tooltip === "string" ? tooltip : tooltip.value;
}

/** A bitflag value of 0 (or any value with no matching named flags) still
 * produces an InlayHint from getCaosInlayHints — just with a degenerate
 * label like "()" (the ATTRIBUTE_BITFLAGS_ARGUMENT_HINT provider always
 * wraps its joined-match list in parens, even when the join is empty).
 * Plan verification item 5 requires these render nothing, not a visible
 * empty pill. */
function isDegenerate(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length === 0 || trimmed === "()";
}

export function buildInlayHintDecorations(doc: Text, hints: readonly CaosInlayHint[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  // Widget decorations are zero-width and must be added to the builder in
  // strictly ascending position order or CM6 throws at runtime — sort
  // defensively rather than assuming the worker's array is already in
  // ascending doc-offset order after line/character conversion (plan's
  // "Critical CM6 correctness detail").
  const positioned = hints
    .map((hint) => ({
      hint,
      offset: lineCharToCmOffset(doc, hint.position.line, hint.position.character),
      text: labelText(hint.label),
    }))
    .filter(({ text }) => !isDegenerate(text))
    .sort((a, b) => a.offset - b.offset);

  for (const { hint, offset, text } of positioned) {
    builder.add(
      offset,
      offset,
      Decoration.widget({
        widget: new InlayHintWidget(text, tooltipText(hint.tooltip), hint.paddingLeft ?? false, hint.paddingRight ?? false),
        side: 1,
      }),
    );
  }

  return builder.finish();
}
