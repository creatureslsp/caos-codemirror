// Detects whether the primary pointing device is touch (no hardware keyboard
// guaranteed) rather than a mouse/trackpad.

/** True when the browser's primary pointer is coarse (touch) rather than
 * fine (mouse/trackpad) — the standard signal for "no reliable hover, no
 * guaranteed physical keyboard." False (desktop assumed) when `matchMedia`
 * isn't available, e.g. in a non-browser test environment. */
export function isCoarsePointer(): boolean {
  return typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
}
