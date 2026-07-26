# CAOS CodeMirror 6 demo

A Vite app exercising every feature in
[`@creatures-codemirror/editor`](../../packages/editor) end-to-end, for manual
verification on both desktop and mobile browsers. This is the reference
integration to copy from if you're wiring the packages into your own app.

Not published to npm — this is a dev/verification tool, not a library.

## Run it

From the repo root (this is a pnpm workspace):

```bash
pnpm install
pnpm dev
```

This starts the Vite dev server for `@creatures-codemirror/demo` and prints a
local URL. Opening it loads the editor with syntax highlighting, semantic
highlighting, diagnostics, autocomplete, hover docs, and inlay hints all
wired up, plus:

- A **Variant** picker (`C1`/`C2`/`CV`/`C3`/`DS`/`DS:CE`/`SM`) — switches
  `GameVariant` in place, without recreating the editor.
- A **Fixture** picker — loads one of `fixtures/*.cos` into the editor.
- A sidebar panel with the live diagnostics count and inlay-hint category
  toggles / `minimumParameterCount` control.
- A log pane echoing engine lifecycle events (Worker load timing chosen,
  `init()`/`setVariant()` results, variant switches).

See **[`TEST-CHECKLIST.md`](./TEST-CHECKLIST.md)** for the full manual
verification checklist this app exists to support — golden path, variant
behavior, edge-case fixtures, and a mobile pass.

## Other scripts

```bash
pnpm build      # production build (emits both the main demo and bench/ pages)
pnpm preview    # serve the production build locally
pnpm typecheck
```

## Fixtures

`fixtures/*.cos` are hand-picked `.cos` files covering the scenarios in
`TEST-CHECKLIST.md`: a clean golden-path script, a bitflag-heavy script (for
exercising inlay hints), a script with deliberate errors (`broken.cos`), a
CAOS2Pray header, C1e-only string syntax, an empty document, and a
stress-test document for latency checks.

## Latency benchmark

`bench/` is a second, standalone page (`bench/index.html`) measuring
`CaosEngineClient.fullAnalysis` Worker round-trip latency across
representative document sizes. With the dev server running, open
`/bench/index.html` alongside the main demo (or use Chrome DevTools'
Performance panel CPU-throttling presets first, to approximate low-end
mobile hardware) — see `plan/06-mobile-ux-and-performance.md` in the
project docs for the latency targets this checks against.
