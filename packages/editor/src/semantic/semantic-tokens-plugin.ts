// Layer 2 semantic highlighting ViewPlugin. Renders semantic tokens as an overlay DecorationSet.
import { StateEffect, StateField, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { CancelledError, type CaosEngineClient, type GameVariant } from "@creatures-codemirror/engine";
import { buildSemanticDecorations } from "./build-decorations.js";
import type { SemanticTokensLegend } from "./legend.js";

// Not exported: the only way to change semanticTokensField's value is to
// dispatch this effect, and only analysisDriver() below ever does that. This
// is what makes the exported field safe to read from other modules (e.g. a
// click handler for a settings-panel token inspector) without exposing any
// way for those callers to corrupt or fight the plugin's own updates.
const setSemanticTokens = StateEffect.define<DecorationSet>();

/**
 * The live semantic-highlighting decorations, keyed to CM6 state so any
 * caller with an `EditorState`/`EditorView` can read the current
 * classification without re-running analysis. Read-only from outside this
 * module — see `setSemanticTokens` above.
 *
 * Prefer `semanticTokenClassesAt()` over reading this field directly: it
 * handles the case where the `semanticTokens()` extension isn't installed in
 * the given state (returns `[]` instead of throwing) and the boundary/dedupe
 * details of querying a single position.
 */
export const semanticTokensField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    // Retain the last-known-good set across doc edits while a new request
    // is in flight. Map through position changes so existing
    // decorations keep tracking edits until the fresh response arrives.
    let next = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setSemanticTokens)) next = effect.value;
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/**
 * Returns the semantic-token class names (e.g. `"cm-caos-sem-variable"`,
 * `"cm-caos-mod-vaxx"`) applied at a document position — everything a color
 * picker needs to know what's under a click, with no separate markup or
 * re-analysis step. Empty array if the `semanticTokens()` extension isn't
 * installed in `state`, or no token covers `pos`.
 *
 * `RangeSet.between`'s "touch" semantics mean a `pos` sitting exactly on the
 * boundary between two adjacent tokens can return both tokens' classes
 * (deduplicated) rather than a single unambiguous token — expected at
 * boundaries, not a bug; callers driving a click UI should tolerate more
 * than one token type/modifier set coming back.
 */
export function semanticTokenClassesAt(state: EditorState, pos: number): string[] {
  const decorations = state.field(semanticTokensField, false);
  if (!decorations) return [];

  const clamped = Math.max(0, Math.min(pos, state.doc.length));
  const classes = new Set<string>();
  decorations.between(clamped, clamped, (_from, _to, deco) => {
    const className = (deco.spec as { class?: string }).class;
    if (className) {
      for (const cls of className.split(" ")) classes.add(cls);
    }
  });
  return [...classes];
}

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
      // Skip rebuilding decorations when data hasn't changed.
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
          // Leave the last-known-good decorations in place either way.
          // CancelledError is the expected, silent case — bumpRevision()
          // actively cancels a request like this one on every subsequent
          // keystroke, so logging it as an error would spam the console
          // during ordinary typing. A genuine worker/RPC failure is still
          // logged.
          if (!(err instanceof CancelledError)) {
            console.error("[caos semanticTokens] fullAnalysis failed:", err);
          }
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
