# @creatures-codemirror/editor

CodeMirror 6 language support for [CAOS](https://creatures.wiki/CAOS) (`.cos`
scripts from the *Creatures* game series): syntax highlighting, semantic
(validity-aware) highlighting, diagnostics, autocomplete, hover
documentation, and inlay hints — plus a set of extensions for making all of
that usable on mobile/touch.

All engine work (parsing, validation, completion, hover, and the
"what does this raw number mean" lookups behind inlay hints) happens off the
main thread in [`@creatures-codemirror/engine`](https://www.npmjs.com/package/@creatures-codemirror/engine),
which this package requires as a peer piece — you construct one
`CaosEngineClient` and pass it into the extensions below.

## Install

```bash
npm install @creatures-codemirror/editor @creatures-codemirror/engine codemirror
```

(`codemirror` here means the CodeMirror 6 packages your app already
depends on: `@codemirror/state`, `@codemirror/view`, `@codemirror/language`,
`@codemirror/autocomplete`, `@codemirror/lint`. This package declares them
as dependencies, but you'll typically also import `basicSetup` etc. from
the `codemirror` convenience package or your own editor setup.)

## Quick start

```ts
import { basicSetup, EditorView } from "codemirror";
import { EditorState } from "@codemirror/state";
import { lintGutter } from "@codemirror/lint";
import { CaosEngineClient, type GameVariant } from "@creatures-codemirror/engine";
import {
  caosLanguageSupport,
  caosLinter,
  caosCompletion,
  caosHoverTooltip,
  inlayHints,
  inlayHintTheme,
  semanticTokens,
  semanticTokensTheme,
} from "@creatures-codemirror/editor";

const client = new CaosEngineClient();
const initResponse = await client.init();

let variant: GameVariant = "DS";
await client.setVariant(variant);

const view = new EditorView({
  state: EditorState.create({
    doc: "setv va00 1\n",
    extensions: [
      basicSetup,
      caosLanguageSupport(),
      semanticTokens({ client, legend: initResponse.semanticTokensLegend, getVariant: () => variant }),
      semanticTokensTheme,
      caosLinter({ client, getVariant: () => variant }),
      lintGutter(),
      caosCompletion({ client, getVariant: () => variant }),
      caosHoverTooltip({ client, getVariant: () => variant }),
      inlayHints({ client, getVariant: () => variant }),
      inlayHintTheme,
    ],
  }),
  parent: document.querySelector("#editor")!,
});
```

See `apps/demo` in this repository for a complete, runnable example,
including variant switching, an inlay-hint options panel, and the mobile
extensions below.

## What each extension does

| Extension | Import | Notes |
|---|---|---|
| Base syntax highlighting | `caosLanguageSupport()` | A `StreamLanguage`-based tokenizer — works instantly, before any Worker round trip. Also exports the raw `caosLanguage` and `caosHighlightStyle`/`caosHighlightTheme` if you want to compose your own `LanguageSupport`. |
| Semantic (validity-aware) highlighting | `semanticTokens({ client, legend, getVariant, debounceMs? })`, `semanticTokensTheme` | Debounced overlay on top of the base tokenizer, driven by the engine's `fullAnalysis`. `legend` comes from `client.init()`'s response. Retains the last-known-good decorations while a request is in flight — never flashes to blank on keystroke. |
| Diagnostics | `caosLinter({ client, getVariant, delay? })` | Wires `@codemirror/lint`'s `linter()` to `fullAnalysis`. Pair with `@codemirror/lint`'s own `lintGutter()`. |
| Autocomplete | `caosCompletion({ client, getVariant })` | An `autocompletion({ override: [...] })` source; also exports the lower-level `caosCompletionSource` and `lspCompletionItemToCM6` if you want to compose it into your own `autocompletion()` call. |
| Hover docs | `caosHoverTooltip({ client, getVariant })` | Mouse-driven `hoverTooltip`. Renders the engine's markdown-lite hover content (`renderCaosMarkdownLite`). |
| Inlay hints | `inlayHints({ client, getVariant, debounceMs? })`, `inlayHintTheme` | Widget decorations showing what a raw number means (e.g. `attr 3` → `(Carryable,Mouseable)`). Reacts to live option changes (see below) without waiting out the debounce. |

### Inlay hint options

Which hint categories are shown, and the minimum parameter count before a
hint appears, are runtime-configurable via a CodeMirror effect:

```ts
import { setInlayHintOptions, DEFAULT_INLAY_HINT_OPTIONS } from "@creatures-codemirror/editor";

view.dispatch({
  effects: setInlayHintOptions.of({
    ...DEFAULT_INLAY_HINT_OPTIONS,
    disabledInlayHints: ["bitflag"],
    minimumParameterCount: 2,
  }),
});
```

The set of available option ids comes back from `client.init()` as
`initResponse.inlayHintOptions`.

### Switching game variants

CAOS validation/completion/hints all depend on the active `GameVariant`
(`C1`, `C2`, `CV`, `C3`, `DS`, `DS:CE`, `SM`). Changing variants doesn't
require tearing down the `EditorView` — put the variant-dependent
extensions above in a `Compartment` and `reconfigure` it after calling
`client.setVariant()`:

```ts
const analysisCompartment = new Compartment();
// ...extensions: [..., analysisCompartment.of(buildAnalysisExtensions())]

await client.setVariant(nextVariant);
view.dispatch({ effects: analysisCompartment.reconfigure(buildAnalysisExtensions()) });
```

See `apps/demo/src/main.ts` for the full pattern.

## Mobile / touch support

Mobile web is a first-class target, not an afterthought. These extensions
are additive — safe to include unconditionally alongside the desktop ones
above, since each one only activates for touch/pen input or when a virtual
keyboard is actually present:

| Extension | Import | What it's for |
|---|---|---|
| Touch hover trigger | `mobileHoverTrigger({ trigger? })` | Tap (or long-press) a token to show the hover tooltip — there's no mouse-hover on touch. |
| Keyboard-aware viewport | `mobileViewport({ keyboardMargin?, onKeyboardOverlapChange? })` | Keeps the caret and any open tooltip/autocomplete popup above the on-screen virtual keyboard. |
| Larger touch targets | `touchTheme` | Theme tweaks for tap targets (tooltip padding, gutter width, etc). |
| Manual completion trigger | `completionTrigger({ label? })` | A visible "Suggest" panel button — there's no Ctrl+Space on a touch keyboard. |

## License

MIT
