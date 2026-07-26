// Debounced ViewPlugin driving the worker's fullAnalysis RPC for its
// inlayHints field, rendered as a DecorationSet via
// build-inlay-hint-decorations.ts. See plan/05-hover-and-inlay-hints.md
// Part B. Structurally mirrors ../semantic/semantic-tokens-plugin.ts (same
// retain-last-known-good-on-error, revision-drop, and doc-hasn't-moved-on
// guards), plus reacting to live inlay-hint-option changes.
import { StateEffect, StateField, type Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { CancelledError, type CaosEngineClient, type GameVariant } from "@creatures-codemirror/engine";
import { buildInlayHintDecorations } from "./build-inlay-hint-decorations.js";
import { inlayHintOptionsField } from "./inlay-hint-options.js";

const setInlayHintDecorations = StateEffect.define<DecorationSet>();

const inlayHintDecorationsField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    // Retain the last-known-good set across doc edits while a fresh
    // response is in flight, same rationale as semantic-tokens-plugin.ts's
    // field (risk #5 — never flash to empty on every keystroke).
    let next = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setInlayHintDecorations)) next = effect.value;
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export interface InlayHintsPluginOptions {
  client: CaosEngineClient;
  getVariant: () => GameVariant;
  /** Delay between the last keystroke and firing the analysis request.
   * Option changes (toggling a hint category, changing
   * minimumParameterCount) bypass this and fire immediately — see
   * verification item 2. */
  debounceMs?: number;
}

function analysisDriver(options: InlayHintsPluginOptions) {
  const { client, getVariant, debounceMs = 200 } = options;

  return ViewPlugin.fromClass(
    class {
      private timer: ReturnType<typeof setTimeout> | undefined;

      constructor(private view: EditorView) {
        this.schedule(0);
      }

      update(update: ViewUpdate): void {
        const optionsChanged =
          update.startState.field(inlayHintOptionsField) !== update.state.field(inlayHintOptionsField);

        if (update.docChanged) {
          // Marks any in-flight request's response as stale immediately,
          // same as semantic-tokens-plugin.ts.
          client.bumpRevision();
          this.schedule(debounceMs);
        } else if (optionsChanged) {
          // A discrete settings toggle, not a keystroke stream — reflect it
          // immediately rather than waiting out the debounce.
          this.schedule(0);
        }
      }

      destroy(): void {
        if (this.timer != null) clearTimeout(this.timer);
      }

      private schedule(delay: number): void {
        if (this.timer != null) clearTimeout(this.timer);
        this.timer = setTimeout(() => void this.run(), delay);
      }

      private async run(): Promise<void> {
        const view = this.view;
        const text = view.state.doc.toString();
        const variant = getVariant();
        const { disabledInlayHints, minimumParameterCount } = view.state.field(inlayHintOptionsField);

        let response;
        try {
          response = await client.fullAnalysis(variant, text, disabledInlayHints, minimumParameterCount);
        } catch (err) {
          // CancelledError is the expected, silent case — bumpRevision()
          // actively cancels a request like this one on every subsequent
          // keystroke, so logging it as an error would spam the console
          // during ordinary typing. A genuine worker/RPC failure is still
          // logged.
          if (!(err instanceof CancelledError)) {
            console.error("[caos inlayHints] fullAnalysis failed:", err);
          }
          return;
        }

        if (view.state.doc.toString() !== text) return;

        const decorations = buildInlayHintDecorations(view.state.doc, response.inlayHints);
        view.dispatch({ effects: setInlayHintDecorations.of(decorations) });
      }
    },
  );
}

export function inlayHints(options: InlayHintsPluginOptions): Extension {
  return [inlayHintOptionsField, inlayHintDecorationsField, analysisDriver(options)];
}
