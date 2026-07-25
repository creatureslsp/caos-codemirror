# Manual Test Checklist

The final acceptance gate for the whole CAOS → CodeMirror 6 port
(`plan/07-demo-app-and-verification.md`). Run this against `apps/demo`
(`pnpm dev`, then open the printed local URL) after any change to
`packages/engine`, `packages/editor`, or a `caos-kt`/`caos-util` version
bump in `vs-caos-editor/`.

The toolbar above the editor has a **Variant** picker (`GameVariant`:
C1/C2/CV/C3/DS/DS:CE/SM) and a **Fixture** picker (loads one of
`apps/demo/fixtures/*.cos` into the editor). The sidebar panel shows the
live diagnostics count, hover/completion status, and the inlay-hint
category checkboxes + `minimumParameterCount` control.

## Golden path

Fixture: `golden-path.cos` (default on load), Variant: `DS` (default).

- [ ] Editor loads with `golden-path.cos`; instant syntax highlighting visible before any worker round-trip.
- [ ] Semantic highlighting (command-validity coloring) appears within ~300ms of load/edit.
- [ ] Sidebar shows `Diagnostics: 0` for the valid golden-path script.
- [ ] Typing a partial command shows relevant, correctly ordered completions; accepting one with parameters inserts a tab-navigable snippet.
- [ ] Hovering a command shows correct markdown-formatted documentation.
- [ ] Switching the Fixture picker to `bitflag-heavy.cos` shows correct inlay-hint pills for bitflag attrs (e.g. `attr 3` → `(Carryable,Mouseable)`).
- [ ] Toggling inlay-hint categories and `minimumParameterCount` in the panel updates hints live (no page reload).

## Variant behavior

- [ ] Switching the Variant picker re-validates and changes completion/hint results appropriately. `c1e-strings.cos` is the sharpest example: it's clean under `C1` but its `anim [0123R]`/`dbgm [Hello world]` lines are exactly the kind of construct that differs across variants (`R`-repeat animation strings and C1e bracket-strings are C1/C2-only) — switching to `DS` should surface new diagnostics on that fixture.
- [ ] Variant switches reconfigure in place — no editor flash/recreate, cursor position and undo history are preserved across the switch.

## Edge cases

- [ ] `broken.cos` shows three distinct, correctly positioned, correctly worded diagnostics with gutter markers: an unknown command (`zzzz`), a wrong-argument-type error (`setv va00 "not a number"`), and an unterminated `DOIF`.
- [ ] `caos2pray-header.cos` shows correct CAOS2Pray tag/directive coloring on the `**CAOS2Pray` and `*#` lines.
- [ ] `c1e-strings.cos` shows correct string vs. byte-string coloring once semantic tokens resolve (even though the base tokenizer layer treats both uniformly, per Phase 2's design) — load it under the `C1` variant, where it validates cleanly.
- [ ] `empty.cos` doesn't error on load; typing from empty produces highlighting/completions normally.
- [ ] `stress-test.cos` — record load/edit latency, compare against Phase 6's benchmark targets (`apps/demo/bench/`).
- [ ] Rapid typing produces no visible flicker in either highlighting layer, no stale/duplicate diagnostics, no runaway worker requests (verify via DevTools that superseded requests are actually cancelled — `CaosEngineClient.bumpRevision()` now posts a real `{type:"cancel"}` for every in-flight request on each doc change, not just a silent-drop-on-arrival).
- [ ] Reload with a slow/offline network simulated — confirm a reasonable loading state instead of a silent failure while the worker bundle loads.

## Mobile pass (repeat golden path + edge cases on)

- [ ] iOS Safari (real device or simulator).
- [ ] Chrome Android (real device or emulator).
- [ ] 360px viewport width in desktop Chrome DevTools device mode.
- [ ] On-screen keyboard open: autocomplete/hover remain visible and usable.
- [ ] Touch hover trigger works and doesn't break native text selection/copy-paste.

## Known gaps (accepted, not blocking)

- **On-device mobile passes**: Phase 6's own verification note already flags that this sandbox's headless Chromium cannot reproduce a real on-screen virtual keyboard or true touch-drag gestures faithfully — the mobile-pass checklist items above need a real device or simulator/emulator to close out, not just DevTools' device-mode viewport resizing.
