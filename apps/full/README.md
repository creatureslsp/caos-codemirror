# CAOS Editor (`apps/full`)

The mobile-first CAOS editor web app — the consumer product built on top of
[`@creatures-codemirror/editor`](../../packages/editor) and
[`@creatures-codemirror/engine`](../../packages/engine). See
[`../../WEBAPP.md`](../../WEBAPP.md) for the product requirements and
[`../../plan-webapp/PLAN.md`](../../plan-webapp/PLAN.md) for the phased
implementation plan this app is being built against. `apps/demo` remains the
separate reference integration/manual-verification tool for the underlying
library; this app is the real thing.

## Run it

From the repo root (this is a pnpm workspace):

```bash
pnpm install
pnpm dev
```

This starts the Vite dev server for `@creatures-codemirror/full` and prints a
local URL. Opening it (at a mobile viewport, or narrow the desktop window) loads
a full-screen editor with syntax highlighting, semantic highlighting,
diagnostics, autocomplete, hover docs, and inlay hints all wired up, plus:

- A fixed **menu button** (bottom-right) opening a slide-over sheet. Today
  this holds the **Variant** picker (`C1`/`C2`/`CV`/`C3`/`DS`/`DS:CE`/`SM`,
  switches `GameVariant` in place without recreating the editor) and a status
  panel with the live diagnostics count and inlay-hint category toggles /
  `minimumParameterCount` control. File/project management (Phase 03) and a
  full tabbed settings panel (Phase 06+) land here in later phases.
- A **log pane**, hidden by default, toggled via "Show log"/"Hide log" in the
  sheet — echoes engine lifecycle events (Worker load timing chosen,
  `init()`/`setVariant()` results, variant switches).

An IndexedDB storage layer exists (`src/storage/` — file/project CRUD, trash
and undelete, variant inheritance, search/sort; see
[`../../plan-webapp/02-storage-layer.md`](../../plan-webapp/02-storage-layer.md)),
but nothing in the UI calls it yet. There is currently no in-app fixture
picker: `fixtures/empty.cos` is the only document this app loads today
(`main.ts`'s `FIXTURES`/`DEFAULT_FIXTURE`); real file open/management arrives
in Phase 03, which wires this storage layer into a file/project browser.
Offline support and theming are later phases still.

See **[`TEST-CHECKLIST.md`](./TEST-CHECKLIST.md)** for the manual
verification checklist.

## Other scripts

```bash
pnpm build      # production build (emits both the main app and bench/ pages)
pnpm preview    # serve the production build locally
pnpm typecheck
pnpm test       # storage-layer unit tests (Vitest + fake-indexeddb)
```

## Latency benchmark

`bench/` is a second, standalone page (`bench/index.html`) measuring
`CaosEngineClient.fullAnalysis` Worker round-trip latency across
representative document sizes — carried over unchanged from `apps/demo`, not
part of the `plan-webapp/` phases. With the dev server running, open
`/bench/index.html` (or use Chrome DevTools' Performance panel
CPU-throttling presets first, to approximate low-end mobile hardware) — see
`plan/06-mobile-ux-and-performance.md` for the latency targets this checks
against.
