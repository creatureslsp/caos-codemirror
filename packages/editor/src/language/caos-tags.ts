// Canonical token-name -> Tag mapping, shared between the Layer 1
// StreamLanguage tokenizer (stream-parser.ts, which returns these names as
// its token()'s string result) and highlight-style.ts (which styles the
// Tag values via HighlightStyle). Keeping both sides keyed off the same
// object means a typo in either place is a TypeScript error instead of a
// silently unstyled token.
import { Tag, tags } from "@lezer/highlight";

export const caosTags = {
  lineComment: tags.lineComment,
  // The "**caos2pray"/"**caos2cob" header line and a "*#key" directive
  // line's key span share one tag — see plan/02-syntax-highlighting.md's
  // Layer 1 spec ("mapping key/=/value spans to
  // processingInstruction/propertyName/string respectively").
  caos2Directive: tags.processingInstruction,
  caos2Eq: tags.propertyName,
  // Also used uniformly for C1e bracket-strings and byte-strings — Layer 1
  // deliberately does not disambiguate those (see stream-parser.ts).
  string: tags.string,
  escape: tags.escape,
  labelName: tags.labelName,
  controlKeyword: tags.controlKeyword,
  // Deliberately duller than a Layer-2-confirmed command/rvalue/lvalue
  // color once semantic tokens arrive — see stream-parser.ts's header
  // comment and plan/02-syntax-highlighting.md's "4-char command-word
  // heuristic" bullet for why two color intensities exist for one class.
  commandHeuristic: tags.function(tags.variableName),
  number: tags.number,
  compareOperator: tags.compareOperator,
} satisfies Record<string, Tag>;

export type CaosTokenName = keyof typeof caosTags;
