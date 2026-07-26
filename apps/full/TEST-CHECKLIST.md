# Manual Test Checklist

Manual verification checklist for `apps/full` (`pnpm dev`, then open the
printed local URL), covering both the underlying library port (per
`plan/07-demo-app-and-verification.md`'s acceptance gate, still valid here
since `apps/full` wires the same packages) and `plan-webapp/`'s app-specific
phases as they land. Run the relevant sections after any change to
`packages/engine`, `packages/editor`, a `caos-kt`/`caos` version bump in
`vs-caos-editor/`, or `apps/full` itself.

The editor fills the full viewport. A fixed **menu button** (bottom-right)
opens a slide-over sheet containing a **Variant** picker (`GameVariant`:
C1/C2/CV/C3/DS/DS:CE/SM), a status panel (live diagnostics count,
hover/completion status, inlay-hint category checkboxes +
`minimumParameterCount` control), and a **Show log**/**Hide log** toggle for
the (hidden-by-default) log pane. There is currently no in-app fixture
picker — `fixtures/empty.cos` is the only document loaded (Phase 03 adds
real file management); to exercise the scenarios below that need specific
fixture content, paste it into the editor manually or temporarily point
`main.ts`'s `FIXTURES` at `apps/demo/fixtures/*.cos`.

## Shell (Phase 01)

- [ ] At a 360px viewport (or narrower): editor fills the entire screen, no
      layout overflow/scrollbars from the shell itself.
- [ ] Menu button is visible and thumb-reachable (bottom-right corner) and
      does not overlap/get occluded by CodeMirror's own bottom panels (e.g.
      the mobile "Suggest" completion-trigger button) — see
      `plan-webapp/00-risks-and-open-questions.md` fact #8 if this regresses.
- [ ] Tapping the menu button opens the sheet from the bottom; tapping it
      again, tapping the backdrop, or tapping the sheet's `×` all close it.
- [ ] Log pane is hidden on load. "Show log" reveals it at the bottom of the
      screen with live worker RPC log text; "Hide log" hides it again without
      losing previously logged content (reopening shows the full history, not
      a blank pane).
- [ ] With the log pane open, the menu button remains visible and clickable
      (shifts above the log pane rather than being covered by it).
- [ ] Variant picker and status panel inside the sheet behave exactly as
      before the Preact port (see "Golden path"/"Variant behavior" below).

## Golden path

Variant: `DS` (default).

- [ ] Editor loads with the default fixture; instant syntax highlighting visible before any worker round-trip.
- [ ] Semantic highlighting (command-validity coloring) appears within ~300ms of load/edit.
- [ ] Status panel shows `Diagnostics: 0` for a valid script.
- [ ] Typing a partial command shows relevant, correctly ordered completions; accepting one with parameters inserts a tab-navigable snippet.
- [ ] Hovering a command shows correct markdown-formatted documentation.
- [ ] Loading a bitflag-heavy script (e.g. `apps/demo/fixtures/bitflag-heavy.cos`'s contents) shows correct inlay-hint pills for bitflag attrs (e.g. `attr 3` → `(Carryable,Mouseable)`).
- [ ] Toggling inlay-hint categories and `minimumParameterCount` in the panel updates hints live (no page reload).

## Variant behavior

- [ ] Switching the Variant picker re-validates and changes completion/hint results appropriately. `apps/demo/fixtures/c1e-strings.cos`'s contents are the sharpest example: clean under `C1` but its `anim [0123R]`/`dbgm [Hello world]` lines are exactly the kind of construct that differs across variants (`R`-repeat animation strings and C1e bracket-strings are C1/C2-only) — switching to `DS` should surface new diagnostics.
- [ ] Variant switches reconfigure in place — no editor flash/recreate, cursor position and undo history are preserved across the switch.

## Edge cases

- [ ] A script with deliberate errors (e.g. `apps/demo/fixtures/broken.cos`'s contents: unknown command `zzzz`, wrong-argument-type `setv va00 "not a number"`, unterminated `DOIF`) shows three distinct, correctly positioned, correctly worded diagnostics with gutter markers.
- [ ] CAOS2Pray header content shows correct tag/directive coloring on the `**CAOS2Pray` and `*#` lines.
- [ ] C1e string content shows correct string vs. byte-string coloring once semantic tokens resolve, under the `C1` variant where it validates cleanly.
- [ ] `empty.cos` (the current default/only fixture) doesn't error on load; typing from empty produces highlighting/completions normally.
- [ ] A large/stress-test document — record load/edit latency, compare against Phase 6's benchmark targets (`bench/`).
- [ ] Rapid typing produces no visible flicker in either highlighting layer, no stale/duplicate diagnostics, no runaway worker requests (verify via DevTools that superseded requests are actually cancelled).
- [ ] Reload with a slow/offline network simulated — confirm a reasonable loading state instead of a silent failure while the worker bundle loads.

## Mobile pass (repeat golden path + edge cases on)

- [ ] iOS Safari (real device or simulator).
- [ ] Chrome Android (real device or emulator).
- [ ] 360px viewport width in desktop Chrome DevTools device mode.
- [ ] On-screen keyboard open: autocomplete/hover remain visible and usable.
- [ ] Touch hover trigger works and doesn't break native text selection/copy-paste.

## Known gaps (accepted, not blocking)

- **On-device mobile passes**: headless Chromium (this sandbox's available
  verification tool) cannot reproduce a real on-screen virtual keyboard or
  true touch-drag gestures faithfully — the mobile-pass checklist items above
  need a real device or simulator/emulator to close out.
