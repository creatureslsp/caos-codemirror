/** Inlay Hints settings tab: diagnostics count, feature status, inlay-hint category toggles. */
import type { Signal } from "@preact/signals";
import { useState } from "preact/hooks";
import type { InlayHintOptions } from "@creatures-codemirror/editor";

export interface InlayHintsTabProps {
  /** Provider ids from InitResponse.inlayHintOptions. */
  inlayHintOptionIds: string[];
  initialInlayHintOptions: InlayHintOptions;
  diagnosticsCount: Signal<number>;
  onInlayHintOptionsChange: (options: InlayHintOptions) => void;
}

export function InlayHintsTab(props: InlayHintsTabProps) {
  const { inlayHintOptionIds, initialInlayHintOptions, diagnosticsCount, onInlayHintOptionsChange } = props;

  const [disabled, setDisabled] = useState(() => new Set(initialInlayHintOptions.disabledInlayHints));
  const [minParam, setMinParam] = useState(
    initialInlayHintOptions.minimumParameterCount != null
      ? String(initialInlayHintOptions.minimumParameterCount)
      : "",
  );

  function emitChange(nextDisabled: Set<string>, nextMinParam: string): void {
    const raw = nextMinParam.trim();
    onInlayHintOptionsChange({
      disabledInlayHints: [...nextDisabled],
      minimumParameterCount: raw === "" ? null : Number(raw),
    });
  }

  function toggleHint(id: string, checked: boolean): void {
    const next = new Set(disabled);
    if (checked) next.delete(id);
    else next.add(id);
    setDisabled(next);
    emitChange(next, minParam);
  }

  function updateMinParam(value: string): void {
    setMinParam(value);
    emitChange(disabled, value);
  }

  return (
    <div id="panel">
      <h2>Status</h2>
      <p id="panel-diagnostics-count">Diagnostics: {diagnosticsCount.value}</p>
      <p id="panel-feature-status">
        Hover: enabled (mouse + touch-tap)
        <br />
        Completion: enabled (typing + tap-to-trigger button)
      </p>
      <h3>Inlay hint categories</h3>
      <div id="panel-inlay-hint-checkboxes">
        {inlayHintOptionIds.length === 0 && <p>(no togglable inlay-hint categories reported)</p>}
        {inlayHintOptionIds.map((id) => (
          <label class="panel-checkbox-row" key={id}>
            <input
              type="checkbox"
              checked={!disabled.has(id)}
              onChange={(event) => toggleHint(id, (event.target as HTMLInputElement).checked)}
            />
            {" " + id}
          </label>
        ))}
      </div>
      <label class="panel-min-param-row">
        minimumParameterCount:{" "}
        <input
          type="number"
          min="0"
          id="panel-min-param-count"
          placeholder="(default)"
          value={minParam}
          onChange={(event) => updateMinParam((event.target as HTMLInputElement).value)}
        />
      </label>
    </div>
  );
}
