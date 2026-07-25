// Touch trigger for the hover tooltip registered by ../hover/hover-tooltip.ts
// (plan/06-mobile-ux-and-performance.md, risk #6). Mouse-driven hover
// already works via @codemirror/view's own hoverTooltip pointermove timer;
// this plugin only reacts to touch/pen pointers, so it's safe to include
// unconditionally alongside caosHoverTooltip() on both desktop and mobile.
//
// Default trigger is tap-with-indicator, not long-press-on-token: a
// long-press on editable text is the OS's native "select/copy" gesture,
// and hijacking it for hover docs would fight that gesture rather than
// complementing it (risk #6, accepted tradeoff — not fully settled pending
// real user testing). Deliberately structured as a `trigger` option rather
// than a hardcoded implementation so long-press can be selected instead
// (or added to) without rewriting this plugin.
//
// This module intentionally does *not* duplicate ../hover/touch-hover.ts's
// fetch/render logic (that file's name predates this one and refers to
// something different — the shared showHoverAt() fetch/render entry point
// reused by both the mouse hoverTooltip source and, indirectly, this touch
// trigger). This file only decides *when* to ask CM6 to show that tooltip,
// via the view-level activateHover()/closeHoverTooltips() API — the same
// mechanism CM6's own mouse-hover implementation uses internally.
import { EditorView, ViewPlugin, activateHover, closeHoverTooltips } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

export type MobileHoverTrigger = "tap" | "long-press";

export interface MobileHoverTriggerOptions {
  /** @default "tap" */
  trigger?: MobileHoverTrigger;
  /** Long-press hold duration in ms, only used when trigger is "long-press". @default 500 */
  longPressMs?: number;
  /** Pointer movement (px) beyond which a touch is treated as a drag/
   * selection gesture rather than a tap or long-press, so native text
   * selection is never hijacked. @default 10 */
  dragThresholdPx?: number;
}

const DEFAULTS: Required<MobileHoverTriggerOptions> = {
  trigger: "tap",
  longPressMs: 500,
  dragThresholdPx: 10,
};

const TOUCH_POINTER_TYPES = new Set(["touch", "pen"]);

/**
 * Touch/pen-only trigger for the hover tooltip. Include this alongside
 * caosHoverTooltip() — mouse pointers pass straight through untouched.
 */
export function mobileHoverTrigger(options: MobileHoverTriggerOptions = {}): Extension {
  const resolved: Required<MobileHoverTriggerOptions> = { ...DEFAULTS, ...options };
  return ViewPlugin.define((view) => new MobileHoverTriggerPlugin(view, resolved));
}

class MobileHoverTriggerPlugin {
  private downX = 0;
  private downY = 0;
  private downActive = false;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!TOUCH_POINTER_TYPES.has(event.pointerType)) return;
    this.downX = event.clientX;
    this.downY = event.clientY;
    this.downActive = true;
    this.clearLongPressTimer();

    if (this.options.trigger === "long-press") {
      const { clientX, clientY } = event;
      this.longPressTimer = setTimeout(() => {
        this.longPressTimer = null;
        if (!this.downActive) return; // pointer already released/moved
        this.activateAt(clientX, clientY);
      }, this.options.longPressMs);
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.downActive || !TOUCH_POINTER_TYPES.has(event.pointerType)) return;
    const dx = event.clientX - this.downX;
    const dy = event.clientY - this.downY;
    if (Math.hypot(dx, dy) > this.options.dragThresholdPx) {
      // Turned into a drag/selection gesture — bail out so native text
      // selection is unaffected.
      this.downActive = false;
      this.clearLongPressTimer();
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (!TOUCH_POINTER_TYPES.has(event.pointerType)) return;
    const wasActive = this.downActive;
    this.downActive = false;
    this.clearLongPressTimer();
    if (!wasActive) return; // was already cancelled as a drag by onPointerMove
    if (this.options.trigger === "tap") {
      this.activateAt(event.clientX, event.clientY);
    }
    // "long-press" mode: a plain tap (released before the timer fired) is
    // not a trigger — mirrors long-press-to-inspect conventions elsewhere.
  };

  private readonly onScroll = (): void => {
    this.dismiss();
  };

  constructor(
    private readonly view: EditorView,
    private readonly options: Required<MobileHoverTriggerOptions>,
  ) {
    view.dom.addEventListener("pointerdown", this.onPointerDown);
    view.dom.addEventListener("pointermove", this.onPointerMove);
    view.dom.addEventListener("pointerup", this.onPointerUp);
    view.dom.addEventListener("pointercancel", this.onPointerUp);
    view.scrollDOM.addEventListener("scroll", this.onScroll, { passive: true });
  }

  private activateAt(clientX: number, clientY: number): void {
    const pos = this.view.posAtCoords({ x: clientX, y: clientY });
    if (pos == null) {
      // Tap landed outside any document text (e.g. below the last line) —
      // treat like "tap elsewhere": dismiss whatever's currently shown.
      this.dismiss();
      return;
    }
    // No `tooltip` extension identity passed: this activates every
    // registered hover-tooltip source at `pos` (we only ever register one
    // via caosHoverTooltip()), and — since we never pass `until` — it stays
    // open until we explicitly dismiss it below (tap elsewhere / scroll),
    // not on CM6's own mouse-out timer, which doesn't fire for touch.
    activateHover(this.view, pos, 1);
  }

  private dismiss(): void {
    this.view.dispatch({ effects: closeHoverTooltips });
  }

  destroy(): void {
    this.view.dom.removeEventListener("pointerdown", this.onPointerDown);
    this.view.dom.removeEventListener("pointermove", this.onPointerMove);
    this.view.dom.removeEventListener("pointerup", this.onPointerUp);
    this.view.dom.removeEventListener("pointercancel", this.onPointerUp);
    this.view.scrollDOM.removeEventListener("scroll", this.onScroll);
    this.clearLongPressTimer();
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer != null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }
}
