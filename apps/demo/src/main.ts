import { basicSetup, EditorView } from "codemirror";
import { EditorState } from "@codemirror/state";
import { lintGutter } from "@codemirror/lint";
import { CaosEngineClient } from "@caos-cm6/engine";
import { caosLanguageSupport, caosLinter, semanticTokens, semanticTokensTheme } from "@caos-cm6/editor";

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

zzzz

endm
`;

const editorParentQuery = document.querySelector<HTMLDivElement>("#editor");
if (!editorParentQuery) throw new Error("#editor element missing");
const editorParent = editorParentQuery;

async function main(): Promise<void> {
  log("Constructing CaosEngineClient (this lazily spins up the Worker)...");
  const client = new CaosEngineClient({
    onUnexpectedError: (err) => log("Worker error:", err instanceof Error ? err.message : String(err)),
  });

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
      ],
    }),
    parent: editorParent,
  });

  log("Editor constructed with Layer 1 (StreamLanguage) + Layer 2 (semantic overlay) + Phase 3 diagnostics wired up.");
  log("Edit the document — the semantic overlay re-analyzes ~200ms, and diagnostics ~300ms, after you stop typing.");
  log("The 'zzzz' line in the initial doc is deliberately invalid CAOS — it should show a red squiggle + gutter marker.");
}

main().catch((err) => {
  log("Demo setup FAILED:", err instanceof Error ? err.message : String(err));
});
