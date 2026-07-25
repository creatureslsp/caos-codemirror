// Layer 2 of the two-layer highlighting design (plan/02-syntax-
// highlighting.md): on debounced doc updates, sends the document to the
// engine Worker's fullAnalysis RPC and renders its semanticTokensData as an
// overlay DecorationSet (../semantic/semantic-tokens-theme.ts supplies the
// CSS). See ../language/stream-parser.ts for Layer 1.
import { StateEffect, StateField, type Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import type { CaosEngineClient, GameVariant } from "@caos-cm6/engine";
import { buildSemanticDecorations } from "./build-decorations.js";
import type { SemanticTokensLegend } from "./legend.js";

const setSemanticTokens = StateEffect.define<DecorationSet>();

const semanticTokensField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    // Retain the last-known-good set across doc edits while a new request
    // is in flight (risk #5 — never clear to empty; that would flash-to-
    // blank on every keystroke). Map through position changes so existing
    // decorations keep tracking edits until the fresh response arrives.
    let next = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setSemanticTokens)) next = effect.value;
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export interface SemanticTokensPluginOptions {
  client: CaosEngineClient;
  /** The token-types/modifiers legend from CaosEngineClient.init()'s
   * InitResponse — callers are expected to have already called init()
   * once (see apps/demo for the pattern). */
  legend: SemanticTokensLegend;
  getVariant: () => GameVariant;
  /** Delay between the last keystroke and firing the analysis request. */
  debounceMs?: number;
}

function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function analysisDriver(options: SemanticTokensPluginOptions) {
  const { client, legend, getVariant, debounceMs = 200 } = options;

  return ViewPlugin.fromClass(
    class {
      private timer: ReturnType<typeof setTimeout> | undefined;
      // Comparing the worker's raw encoded data is cheaper than diffing
      // built decorations, and is exactly "the semantic result hasn't
      // actually changed" from plan/02's reconciliation note — skips
      // rebuilding decorations and dispatching entirely when nothing did.
      private lastData: number[] | null = null;

      constructor(private view: EditorView) {
        this.schedule();
      }

      update(update: ViewUpdate): void {
        if (update.docChanged) {
          // Marks any in-flight request's response as stale immediately
          // (CaosEngineClient drops responses whose revision no longer
          // matches), even before the new debounced request fires.
          client.bumpRevision();
          this.schedule();
        }
      }

      destroy(): void {
        if (this.timer != null) clearTimeout(this.timer);
      }

      private schedule(): void {
        if (this.timer != null) clearTimeout(this.timer);
        this.timer = setTimeout(() => void this.run(), debounceMs);
      }

      private async run(): Promise<void> {
        const view = this.view;
        const text = view.state.doc.toString();
        const variant = getVariant();

        let response;
        try {
          response = await client.fullAnalysis(variant, text);
        } catch (err) {
          // Cancelled/stale (never settles) or a worker error — leave the
          // last-known-good decorations in place either way.
          console.error("[caos semanticTokens] fullAnalysis failed:", err);
          return;
        }

        // Belt-and-suspenders on top of the client's own revision check:
        // guards against this specific response having been the current
        // one at settle-time but the doc moving on again before this
        // continuation ran.
        if (view.state.doc.toString() !== text) return;

        if (this.lastData != null && arraysEqual(this.lastData, response.semanticTokensData)) {
          return;
        }
        this.lastData = response.semanticTokensData;

        const decorations = buildSemanticDecorations(view.state.doc, response.semanticTokensData, legend);
        view.dispatch({ effects: setSemanticTokens.of(decorations) });
      }
    },
  );
}

export function semanticTokens(options: SemanticTokensPluginOptions): Extension {
  return [semanticTokensField, analysisDriver(options)];
}
