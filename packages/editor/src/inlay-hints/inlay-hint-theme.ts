// Base theme for inlay hints styling.
// A host app can restyle without forking this file.
import { EditorView } from "@codemirror/view";

export const inlayHintTheme = EditorView.baseTheme({
  ".cm-caos-inlay-hint": {
    color: "var(--caos-inlay-hint, #6e7781)",
    backgroundColor: "var(--caos-inlay-hint-bg, rgba(110, 119, 129, 0.12))",
    borderRadius: "4px",
    padding: "0 4px",
    fontSize: "0.85em",
    fontFamily: "inherit",
  },
  "&dark .cm-caos-inlay-hint": {
    color: "var(--caos-inlay-hint-dark, #8b949e)",
    backgroundColor: "var(--caos-inlay-hint-bg-dark, rgba(139, 148, 158, 0.18))",
  },
});
