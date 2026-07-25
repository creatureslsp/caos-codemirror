// Sidebar panel (plan/07-demo-app-and-verification.md): visibly shows the
// current diagnostics count, hover/completion feature status, and the
// inlay-hint category checkboxes/minimumParameterCount control — so the
// manual test checklist has something concrete to look at rather than
// wiring these features silently.
import type { InlayHintOptions } from "@caos-cm6/editor";

export interface CaosPanelOptions {
  /** Provider ids from InitResponse.inlayHintOptions (getCaosInlayOptions()). */
  inlayHintOptionIds: string[];
  initialInlayHintOptions: InlayHintOptions;
  onInlayHintOptionsChange: (options: InlayHintOptions) => void;
}

export interface CaosPanel {
  dom: HTMLElement;
  setDiagnosticsCount(count: number): void;
}

export function createCaosPanel(options: CaosPanelOptions): CaosPanel {
  const { inlayHintOptionIds, initialInlayHintOptions, onInlayHintOptionsChange } = options;

  const dom = document.createElement("div");
  dom.id = "panel";

  const heading = document.createElement("h2");
  heading.textContent = "Status";
  dom.appendChild(heading);

  const diagnosticsCountEl = document.createElement("p");
  diagnosticsCountEl.id = "panel-diagnostics-count";
  diagnosticsCountEl.textContent = "Diagnostics: —";
  dom.appendChild(diagnosticsCountEl);

  const featureStatusEl = document.createElement("p");
  featureStatusEl.id = "panel-feature-status";
  featureStatusEl.innerHTML =
    "Hover: enabled (mouse + touch-tap)<br>Completion: enabled (typing + tap-to-trigger button)";
  dom.appendChild(featureStatusEl);

  const hintsHeading = document.createElement("h3");
  hintsHeading.textContent = "Inlay hint categories";
  dom.appendChild(hintsHeading);

  const disabled = new Set(initialInlayHintOptions.disabledInlayHints);

  const minParamInput = document.createElement("input");

  function emitChange(): void {
    const raw = minParamInput.value.trim();
    onInlayHintOptionsChange({
      disabledInlayHints: [...disabled],
      minimumParameterCount: raw === "" ? null : Number(raw),
    });
  }

  const checkboxList = document.createElement("div");
  checkboxList.id = "panel-inlay-hint-checkboxes";
  if (inlayHintOptionIds.length === 0) {
    const none = document.createElement("p");
    none.textContent = "(no togglable inlay-hint categories reported)";
    checkboxList.appendChild(none);
  }
  for (const id of inlayHintOptionIds) {
    const label = document.createElement("label");
    label.className = "panel-checkbox-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !disabled.has(id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) disabled.delete(id);
      else disabled.add(id);
      emitChange();
    });

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(" " + id));
    checkboxList.appendChild(label);
  }
  dom.appendChild(checkboxList);

  const minParamLabel = document.createElement("label");
  minParamLabel.className = "panel-min-param-row";
  minParamLabel.appendChild(document.createTextNode("minimumParameterCount: "));
  minParamInput.type = "number";
  minParamInput.min = "0";
  minParamInput.id = "panel-min-param-count";
  minParamInput.placeholder = "(default)";
  minParamInput.value =
    initialInlayHintOptions.minimumParameterCount != null
      ? String(initialInlayHintOptions.minimumParameterCount)
      : "";
  minParamInput.addEventListener("change", emitChange);
  minParamLabel.appendChild(minParamInput);
  dom.appendChild(minParamLabel);

  return {
    dom,
    setDiagnosticsCount(count: number): void {
      diagnosticsCountEl.textContent = `Diagnostics: ${count}`;
    },
  };
}
