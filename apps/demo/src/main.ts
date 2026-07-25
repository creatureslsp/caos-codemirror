import { basicSetup, EditorView } from "codemirror";
import { EditorState } from "@codemirror/state";
import { lintGutter } from "@codemirror/lint";
import { CaosEngineClient, chooseEngineLoadTiming, scheduleEngineLoad } from "@caos-cm6/engine";
import {
  caosCompletion,
  caosHoverTooltip,
  caosLanguageSupport,
  caosLinter,
  completionTrigger,
  inlayHints,
  inlayHintTheme,
  mobileHoverTrigger,
  mobileViewport,
  semanticTokens,
  semanticTokensTheme,
  touchTheme,
} from "@caos-cm6/editor";

const logElQuery = document.querySelector<HTMLDivElement>("#log");
if (!logElQuery) throw new Error("#log element missing");
// Re-bound so the closure below sees a statically non-null type — narrowing
// from the guard above doesn't cross a function-declaration boundary.
const logEl = logElQuery;

function log(...args: unknown[]): void {
  console.log(...args);
  const line = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a, null, 2)))
    .join(" ");
  logEl.textContent += line + "\n";
}

// Exercises every Layer 1/Layer 2 branch from plan/02-syntax-highlighting.md's
// verification section: comment, CAOS2Pray header + directive line, quoted
// string with an escape, bracket/byte-string, SUBR/GSUB + label, keyword
// pairs, hex/float/int literals, both operator spellings — plus one
// deliberately-invalid command ("zzzz") so the semantic overlay's
// "not-found" modifier (a wavy underline) has something to demonstrate.
// "attr 3" is Phase 5's verification fixture (plan/05-hover-and-inlay-
// hints.md item 1): should show an inline "(Carryable,Mouseable)" pill.
const initialDoc = `**caos2pray
*#Name = "Phase 2 demo script"

* comment, caos2pray header/directive above, this line is a plain comment
scrp 1 1 1 0
setv va00 0x1F
setv va01 3.14
doif va00 eq 0
  outs "Hello, \\"world\\"!\\n"
endi

subr Greet
  outs "Hi from a subroutine\\n"
retn

gsub Greet
anim [0 1 2 3 R]
attr 3

zzzz

endm
`;

const editorParentQuery = document.querySelector<HTMLDivElement>("#editor");
if (!editorParentQuery) throw new Error("#editor element missing");
const editorParent = editorParentQuery;

async function main(): Promise<void> {
  // plan/06-mobile-ux-and-performance.md: on a measurably slow connection
  // or low-end device, defer constructing CaosEngineClient (and so
  // fetching the ~549KB worker bundle behind it) until idle or first
  // interaction with #editor, instead of competing with initial page load.
  // No signal available at all (most desktop browsers) resolves to
  // "immediate" — see bundle-strategy.ts's chooseEngineLoadTiming.
  const timing = chooseEngineLoadTiming();
  log(`Engine load timing chosen: "${timing}" (device/network heuristic).`);
  if (timing === "first-interaction") {
    editorParent.textContent = "Tap/click here to load the CAOS engine and editor…";
  }
  const client = await scheduleEngineLoad(
    () =>
      new CaosEngineClient({
        onUnexpectedError: (err) => log("Worker error:", err instanceof Error ? err.message : String(err)),
      }),
    { timing, interactionTarget: editorParent },
  );
  log("CaosEngineClient constructed.");
  editorParent.textContent = "";

  const initResponse = await client.init();
  log("init() ->", initResponse);

  const setVariantResponse = await client.setVariant("DS");
  log("setVariant('DS') ->", setVariantResponse);

  new EditorView({
    state: EditorState.create({
      doc: initialDoc,
      extensions: [
        basicSetup,
        caosLanguageSupport(),
        semanticTokens({
          client,
          legend: initResponse.semanticTokensLegend,
          getVariant: () => "DS",
          debounceMs: 200,
        }),
        semanticTokensTheme,
        caosLinter({ client, getVariant: () => "DS" }),
        lintGutter(),
        caosCompletion({ client, getVariant: () => "DS" }),
        caosHoverTooltip({ client, getVariant: () => "DS" }),
        inlayHints({ client, getVariant: () => "DS" }),
        inlayHintTheme,
        // Phase 6: touch/pen-only hover trigger (mouse hover above is
        // untouched by this), keyboard-aware viewport handling, larger
        // touch targets, and a manual completion-trigger button (there's
        // no Ctrl+Space on a touch keyboard).
        mobileHoverTrigger(),
        mobileViewport(),
        touchTheme,
        completionTrigger(),
      ],
    }),
    parent: editorParent,
  });

  log("Editor constructed with Layer 1 (StreamLanguage) + Layer 2 (semantic overlay) + Phase 3 diagnostics + Phase 4 autocomplete + Phase 5 hover/inlay hints wired up.");
  log("Edit the document — the semantic overlay re-analyzes ~200ms, and diagnostics/inlay hints ~300ms/~200ms, after you stop typing.");
  log("The 'zzzz' line in the initial doc is deliberately invalid CAOS — it should show a red squiggle + gutter marker.");
  log("Try typing a partial command (e.g. 'sndl' or 'outs') on a new line to see completions.");
  log("Hover over a command name (e.g. 'setv', 'outs', 'attr') to see documentation.");
  log("The 'attr 3' line should show an inline '(Carryable,Mouseable)' inlay hint pill.");
  log("On a touch device: tap a command name to see hover docs (no long-press — that's native text-selection's gesture), tap the 'Suggest' button below the editor to trigger completion, and open the on-screen keyboard to confirm the editor/tooltips stay above it.");
  log("See apps/demo/bench/ for the fullAnalysis latency benchmark harness (plan/06-mobile-ux-and-performance.md verification item 4).");
}

main().catch((err) => {
  log("Demo setup FAILED:", err instanceof Error ? err.message : String(err));
});
