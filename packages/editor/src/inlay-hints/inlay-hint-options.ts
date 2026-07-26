// StateField and StateEffect for live-toggleable inlay-hint settings.
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
