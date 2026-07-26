// Shared token-name -> Tag mapping for Layer 1 syntax highlighting.
import { Tag, tags } from "@lezer/highlight";

export const caosTags = {
  lineComment: tags.lineComment,
  // Header line and directive key spans share processingInstruction / propertyName tags
  caos2Directive: tags.processingInstruction,
  caos2Eq: tags.propertyName,
  string: tags.string,
  escape: tags.escape,
  labelName: tags.labelName,
  controlKeyword: tags.controlKeyword,
  commandHeuristic: tags.function(tags.variableName),
  number: tags.number,
  compareOperator: tags.compareOperator,
} satisfies Record<string, Tag>;

export type CaosTokenName = keyof typeof caosTags;
