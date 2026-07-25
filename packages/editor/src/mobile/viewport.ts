// Keeps the editor, its caret, and any open tooltip/autocomplete popup
// visible above the on-screen virtual keyboard on mobile browsers
// (plan/06-mobile-ux-and-performance.md). Desktop browsers rarely resize
// window.visualViewport in a way that changes any of the numbers below, so
// this extension is a safe no-op there without a UA check, and degrades to
// a true no-op (not an error) in environments with no visualViewport at
// all (e.g. under Node during SSR/tests).
import { EditorView, ViewPlugin, repositionTooltips } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

export interface MobileViewportOptions {
  /** Extra breathing room (px) kept between the keyboard and the caret/
   * editor bottom edge. @default 8 */
  keyboardMargin?: number;
  /** Called whenever the amount of the layout viewport covered by the
   * on-screen keyboard changes (0 when closed), in CSS px — for a host
   * app that wants to reposition its own surrounding chrome (a fixed
   * toolbar, a wrapping container) beyond what this extension already
   * does to the editor's own DOM. */
  onKeyboardOverlapChange?: (coveredPx: number) => void;
}

const DEFAULT_KEYBOARD_MARGIN = 8;

export function mobileViewport(options: MobileViewportOptions = {}): Extension {
  const keyboardMargin = options.keyboardMargin ?? DEFAULT_KEYBOARD_MARGIN;
  const { onKeyboardOverlapChange } = options;
  return ViewPlugin.define((view) => new MobileViewportPlugin(view, keyboardMargin, onKeyboardOverlapChange));
}

class MobileViewportPlugin {
  private readonly vv: VisualViewport | null =
    typeof window !== "undefined" ? (window.visualViewport ?? null) : null;
  private raf: number | null = null;
  private lastCovered = 0;

  private readonly onResize = (): void => this.scheduleLayout();
  private readonly onScroll = (): void => this.scheduleLayout();

  constructor(
    private readonly view: EditorView,
    private readonly keyboardMargin: number,
    private readonly onKeyboardOverlapChange: ((coveredPx: number) => void) | undefined,
  ) {
    this.vv?.addEventListener("resize", this.onResize);
    this.vv?.addEventListener("scroll", this.onScroll);
    this.scheduleLayout();
  }

  private scheduleLayout(): void {
    if (this.raf != null) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = null;
      this.applyLayout();
    });
  }

  private applyLayout(): void {
    const vv = this.vv;
    if (!vv) return;

    // Standard visualViewport keyboard-detection technique: the layout
    // viewport (documentElement) stays full-height when the keyboard
    // opens, but the *visual* viewport shrinks to the space above it.
    const layoutViewportHeight = document.documentElement.clientHeight;
    const covered = Math.max(0, layoutViewportHeight - (vv.height + vv.offsetTop));

    if (covered !== this.lastCovered) {
      this.lastCovered = covered;
      this.onKeyboardOverlapChange?.(covered);
    }

    // Constrain the editor's own height to whatever's left above the
    // keyboard, relative to wherever it's actually positioned on the page
    // (not just "100vh minus keyboard" — that would be wrong for an editor
    // that isn't full-page). Cleared entirely once the keyboard closes.
    if (covered > 0) {
      const rect = this.view.dom.getBoundingClientRect();
      const visibleBottom = vv.offsetTop + vv.height;
      const available = Math.max(0, visibleBottom - rect.top - this.keyboardMargin);
      this.view.dom.style.maxHeight = `${available}px`;
    } else {
      this.view.dom.style.maxHeight = "";
    }

    if (covered > 0 && this.view.hasFocus) {
      this.view.dispatch({
        effects: EditorView.scrollIntoView(this.view.state.selection.main.head, {
          y: "nearest",
          yMargin: this.keyboardMargin,
        }),
      });
    }

    // visualViewport resize/scroll isn't one of the events CM6's own
    // tooltip positioning logic listens for, so any open hover/autocomplete
    // popup would otherwise stay anchored to its stale on-screen position
    // as the keyboard opens/closes underneath it.
    repositionTooltips(this.view);
  }

  destroy(): void {
    this.vv?.removeEventListener("resize", this.onResize);
    this.vv?.removeEventListener("scroll", this.onScroll);
    if (this.raf != null) cancelAnimationFrame(this.raf);
    this.view.dom.style.maxHeight = "";
  }
}
