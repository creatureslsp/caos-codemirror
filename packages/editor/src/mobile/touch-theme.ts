// Larger touch targets for autocomplete/hover on mobile
// (plan/06-mobile-ux-and-performance.md). Selectors below are
// @codemirror/autocomplete's real, undocumented-but-stable DOM class names
// (verified against its source, same approach as ../semantic/semantic-
// tokens-theme.ts's legend-name verification) — there's no public "make
// this touch-friendly" option to configure instead.
//
// Applied unconditionally (no pointer:coarse media-query gate): a taller
// row/larger tap target costs nothing on desktop and pointer-capability
// media queries are an imperfect proxy for "this session is on mobile"
// (hybrid touch+mouse laptops, etc).
import { EditorView } from "@codemirror/view";

const MIN_TOUCH_TARGET_PX = 44;

export const touchTheme = EditorView.baseTheme({
  ".cm-tooltip-autocomplete ul li": {
    minHeight: `${MIN_TOUCH_TARGET_PX}px`,
    display: "flex",
    alignItems: "center",
    padding: "0 6px",
  },
  // The hover tooltip's dismiss affordance on touch is "tap elsewhere in
  // the editor, or scroll" (./touch-hover.ts), not an in-tooltip close
  // button — so the tooltip's own touch target is really "make it easy to
  // tap *outside* it without also re-triggering it," which is handled by
  // touch-hover.ts's drag-threshold + posAtCoords check, not CSS. This
  // padding just keeps tooltip content from feeling cramped under a
  // fingertip. Scoped to `.cm-tooltip-hover` specifically (not the generic
  // `.cm-tooltip` every tooltip — including the autocomplete popup — gets)
  // so it doesn't also pad the completion list.
  ".cm-tooltip-hover": {
    padding: "4px 2px",
  },
  // ./completion-trigger.ts's manual "Suggest" button/panel.
  ".cm-caos-completion-trigger-panel": {
    display: "flex",
    justifyContent: "flex-end",
    padding: "4px 6px",
    borderTop: "1px solid var(--caos-panel-border, #d0d7de)",
  },
  "&dark .cm-caos-completion-trigger-panel": {
    borderTop: "1px solid var(--caos-panel-border-dark, #30363d)",
  },
  ".cm-caos-completion-trigger": {
    minHeight: `${MIN_TOUCH_TARGET_PX}px`,
    minWidth: `${MIN_TOUCH_TARGET_PX}px`,
    padding: "0 12px",
    borderRadius: "6px",
    border: "1px solid var(--caos-panel-border, #d0d7de)",
    background: "var(--caos-completion-trigger-bg, #f6f8fa)",
    color: "inherit",
    font: "inherit",
    cursor: "pointer",
  },
  "&dark .cm-caos-completion-trigger": {
    border: "1px solid var(--caos-panel-border-dark, #30363d)",
    background: "var(--caos-completion-trigger-bg-dark, #21262d)",
  },
});
