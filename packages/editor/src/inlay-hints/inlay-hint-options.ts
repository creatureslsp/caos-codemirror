// Live-toggleable inlay-hint settings (plan/05-hover-and-inlay-hints.md):
// a StateField holding the current {disabledInlayHints, minimumParameterCount}
// pair, updated via a StateEffect — the standard CM6 substitute for a
// "live Facet" (a plain Facet's value is fixed for the life of the
// extension instance; this lets a settings UI reconfigure without tearing
// down and recreating the editor). ../inlay-hints/inlay-hints-plugin.ts
// reads this field to decide what to request from the worker, and reacts
// immediately (bypassing its debounce) when it changes.
import { StateEffect, StateField } from "@codemirror/state";

export interface InlayHintOptions {
  /** Provider ids to suppress, from getCaosInlayOptions() (surfaced as
   * InitResponse.inlayHintOptions). */
  disabledInlayHints: string[];
  /** Threshold below which "<paramName>:" argument-position hints are
   * omitted. null defers to getCaosInlayHints' own default. */
  minimumParameterCount: number | null;
}

export const DEFAULT_INLAY_HINT_OPTIONS: InlayHintOptions = {
  disabledInlayHints: [],
  minimumParameterCount: null,
};

export const setInlayHintOptions = StateEffect.define<InlayHintOptions>();

export const inlayHintOptionsField = StateField.define<InlayHintOptions>({
  create() {
    return DEFAULT_INLAY_HINT_OPTIONS;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setInlayHintOptions)) return effect.value;
    }
    return value;
  },
});
