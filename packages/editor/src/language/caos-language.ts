import { LanguageSupport, StreamLanguage, syntaxHighlighting } from "@codemirror/language";
import { caosStreamParser } from "./stream-parser.js";
import { caosHighlightStyle, caosHighlightTheme } from "./highlight-style.js";

export const caosLanguage = StreamLanguage.define(caosStreamParser);

export function caosLanguageSupport(): LanguageSupport {
  return new LanguageSupport(caosLanguage, [
    syntaxHighlighting(caosHighlightStyle),
    caosHighlightTheme,
  ]);
}
