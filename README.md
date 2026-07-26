# caos-codemirror

CodeMirror 6 language support for **CAOS**, the scripting language used by
the *Creatures* game series (Creatures 1/2/3, Docking Station, Creatures
Village, etc): syntax highlighting, semantic (validity-aware) highlighting,
diagnostics, autocomplete, hover documentation, and inlay hints, plus
first-class support for mobile/touch browsers.

The actual CAOS parsing/validation/completion engine
[`@creatures-lsp/caos`](https://www.npmjs.com/package/@creatureslsp/caos),
originally built for the [`vs-caos-editor`](https://github.com/bedalton/caos-language-server)
VS Code extension) is not reimplemented here — it's already browser-safe, so
this project runs it directly inside a Web Worker and builds CodeMirror 6
extensions around its output.

## Packages

| Package | What it is |
|---|---|
| [`@creatures-codemirror/engine`](./packages/engine) | Web Worker + RPC client wrapping the CAOS engine. Framework-agnostic — no CodeMirror dependency. |
| [`@creatures-codemirror/editor`](./packages/editor) | CodeMirror 6 extensions (highlighting, lint, autocomplete, hover, inlay hints, mobile UX) built on top of `engine`. |

Each package has its own README with install instructions and full API
reference. [`apps/demo`](./apps/demo) is a working end-to-end integration
of both — the best place to see everything wired up together, or to copy
from.

## Quick start (this repo)

This is a pnpm workspace (Node >= 20):

```bash
pnpm install
pnpm dev          # runs apps/demo
pnpm test         # runs all package test suites
pnpm typecheck    # typechecks all packages/apps
pnpm build        # builds all publishable packages
```

## Using the packages in your own app

```bash
npm install @creatures-codemirror/editor @creatures-codemirror/engine
```

```ts
import { basicSetup, EditorView } from "codemirror";
import { EditorState } from "@codemirror/state";
import { CaosEngineClient } from "@creatures-codemirror/engine";
import { caosLanguageSupport, caosLinter, caosCompletion, caosHoverTooltip } from "@creatures-codemirror/editor";

const client = new CaosEngineClient();
await client.init();
await client.setVariant("DS");

new EditorView({
  state: EditorState.create({
    doc: "setv va00 1\n",
    extensions: [
      basicSetup,
      caosLanguageSupport(),
      caosLinter({ client, getVariant: () => "DS" }),
      caosCompletion({ client, getVariant: () => "DS" }),
      caosHoverTooltip({ client, getVariant: () => "DS" }),
    ],
  }),
  parent: document.querySelector("#editor")!,
});
```

See [`packages/editor`](./packages/editor)'s README for the full extension
list (semantic highlighting, inlay hints, mobile/touch extensions, variant
switching) and [`packages/engine`](./packages/engine)'s README for the
lower-level client API if you're integrating with something other than
CodeMirror.

## Architecture, in brief

- **Execution model**: the engine runs in a Web Worker with a small
  hand-rolled request/response protocol (not LSP) — see
  `@creatures-codemirror/engine`'s `CaosEngineClient`.
- **Highlighting is two layers**: an instant `StreamLanguage`-based
  tokenizer (works before any Worker round trip) plus a debounced semantic
  overlay driven by the engine's validity analysis.
- **Diagnostics, completion, and hover** are each driven by their own
  engine RPC call, with in-flight requests cancelled and stale responses
  dropped whenever the document changes (`CaosEngineClient.bumpRevision()`).
- **Mobile is a first-class target**: touch hover triggers, on-screen
  keyboard-aware viewport handling, larger tap targets, and a manual
  completion-trigger button are all part of `@creatures-codemirror/editor`, not
  a separate add-on.

## Scope

CAOS (`.cos`) language support only: syntax highlighting, autocomplete,
validation, hover, and inlay hints. Catalogue/PRAY languages, outline/
goto/rename/formatting, and live-game-injection are out of scope.

## License

MIT — see [LICENSE](./LICENSE).
