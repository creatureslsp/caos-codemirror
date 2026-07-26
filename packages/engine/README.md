# @creatures-codemirror/engine

Web Worker wrapper around the CAOS language engine (`@creatureslsp/caos`) — parsing, validation, completion, hover, and
inlay-hint data for [CAOS](https://creatures.wiki/CAOS), the scripting
language used by the *Creatures* game series.

This package does the off-main-thread plumbing only: a Worker entry point,
a small request/response protocol, and a main-thread client that talks to
it. It has no editor UI of its own — pair it with
[`@creatures-codemirror/editor`](https://www.npmjs.com/package/@creatures-codemirror/editor)
for CodeMirror 6 extensions built on top of it, or drive it directly if
you're integrating with something else.

## Install

```bash
npm install @creatures-codemirror/engine
```

`@codemirror/state` and `vscode-languageserver-types` are peer-ish
dependencies pulled in transitively; you don't need to install them
yourself unless your bundler complains.

## Why a Worker

`@creatureslsp/caos-kt` is a ~549KB pre-compiled engine. Running it on the
main thread would block typing/scrolling on every parse or validation pass,
which matters especially on mobile. This package loads it inside a Web
Worker instead, so parsing and validation never contend with rendering.

## Usage

```ts
import { CaosEngineClient } from "@creatures-codemirror/engine";

const client = new CaosEngineClient({
  onUnexpectedError: (err) => console.error("engine worker crashed:", err),
});

await client.init();
await client.setVariant("DS"); // "C1" | "C2" | "CV" | "C3" | "DS" | "DS:CE" | "SM"

const result = await client.fullAnalysis("DS", "setv va00 1\n");
console.log(result.diagnostics, result.semanticTokensData, result.inlayHints);

const completions = await client.getCompletions("DS", "setv va00 1\nsnde", 1, 4);
const hover = await client.getHover("DS", "setv va00 1\n", 0, 2);

client.dispose(); // terminates the Worker
```

### Deferring when the Worker loads

On a slow connection or a low-end device, constructing `CaosEngineClient`
immediately competes with initial page load for that ~549KB download.
`chooseEngineLoadTiming()` / `scheduleEngineLoad()` pick a better moment
(`"immediate"`, `"idle"`, or `"first-interaction"`) based on
`navigator.connection` / `navigator.deviceMemory` / `navigator.hardwareConcurrency`,
where available:

```ts
import { scheduleEngineLoad } from "@creatures-codemirror/engine";

const client = await scheduleEngineLoad(() => new CaosEngineClient(), {
  interactionTarget: editorContainerElement,
});
```

### Cancellation and staleness

Every request carries the client's current "revision". Calling
`client.bumpRevision()` (typically on every document edit) actively cancels
all in-flight requests and causes any response that arrives under a stale
revision to be dropped silently — callers never need to manually track
"is this response still relevant." A cancelled request rejects with
`CancelledError`, which you'll usually want to swallow silently (it's the
expected outcome of routine typing, not a real failure):

```ts
import { CancelledError } from "@creatures-codemirror/engine";

try {
  await client.fullAnalysis(variant, text);
} catch (err) {
  if (!(err instanceof CancelledError)) throw err;
}
```

`fullAnalysis` calls are also coalesced: back-to-back calls for the same
`(variant, text, inlay-hint options)` share one Worker round trip rather
than triggering a duplicate parse.

## API

| Export | What it is |
|---|---|
| `CaosEngineClient` | Main-thread client — owns the Worker, correlates requests/responses. |
| `CancelledError` | Thrown when a request is superseded by `bumpRevision()` or an explicit `cancel()`. |
| `chooseEngineLoadTiming()`, `scheduleEngineLoad()`, `readDeviceSignals()` | Device/network-aware timing for when to construct `CaosEngineClient`. |
| `GAME_VARIANTS`, `GameVariant` | The supported CAOS variants: `C1`, `C2`, `CV`, `C3`, `DS`, `DS:CE`, `SM`. |
| `cmOffsetToLineChar()`, `lineCharToCmOffset()`, `adjustForIndexing()` | Convert between CodeMirror's flat document offsets and LSP-style line/character positions. |

`CaosEngineClient` methods:

| Method | Returns |
|---|---|
| `init()` | One-time setup; resolves with the semantic-tokens legend and available inlay-hint option ids. |
| `setVariant(variant)` | Switches the active `GameVariant` used by subsequent requests. |
| `fullAnalysis(variant, text, disabledInlayHints?, minimumParameterCount?)` | Diagnostics, semantic tokens, and inlay hints in one call. |
| `getCompletions(variant, text, line, character)` | Completion items at a position. |
| `getHover(variant, text, line, character)` | Hover documentation at a position. |
| `bumpRevision()` | Cancels all in-flight requests; call on every document edit. |
| `cancel(id)` | Cancels a specific request. |
| `dispose()` | Terminates the Worker. |

Full request/response and diagnostic/hover/completion/inlay-hint types
(`CaosDiagnostic`, `CaosHover`, `CaosCompletionItem`, `CaosInlayHint`, etc.)
are exported from the package root — see `src/index.ts` for the complete
list.

## Bundler requirements

This package constructs its Worker with `new Worker(new URL(...),
{ type: "module" })`, the standard pattern Vite, Webpack 5+, and Rollup all
understand natively — no bundler plugin needed. If you're on an older
bundler without `import.meta.url` Worker support, you'll need to configure
Worker handling manually.

## License

MIT
