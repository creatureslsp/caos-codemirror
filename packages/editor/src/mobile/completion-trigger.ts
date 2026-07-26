// Adds a manual completion trigger button panel for touch environments.
import { showPanel } from "@codemirror/view";
import type { EditorView, Panel } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { startCompletion } from "@codemirror/autocomplete";

export interface CompletionTriggerOptions {
  /** @default "Suggest" */
  label?: string;
}

function createPanel(label: string) {
  return (view: EditorView): Panel => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className = "cm-caos-completion-trigger";
    // mousedown (not click) so the editor never loses focus/its selection
    // before startCompletion runs — a plain click first blurs the
    // contentEditable, which some virtual keyboards treat as "dismiss and
    // don't reopen for this call."
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      startCompletion(view);
    });

    const dom = document.createElement("div");
    dom.className = "cm-caos-completion-trigger-panel";
    dom.appendChild(button);

    return { dom, top: false };
  };
}

/** Adds a bottom panel with a manual "trigger completion" button. */
export function completionTrigger(options: CompletionTriggerOptions = {}): Extension {
  const label = options.label ?? "Suggest";
  return showPanel.of(createPanel(label));
}
