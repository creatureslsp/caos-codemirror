// A visible manual "trigger completion" button (plan/06-mobile-ux-and-
// performance.md) — there's no Ctrl+Space on a touch keyboard, so without
// this, autocomplete on mobile is reachable only by typing enough of a
// word for the default activateOnTyping trigger to fire. Implemented as a
// bottom Panel (not a fixed-position element the host app has to place
// itself), wired straight to @codemirror/autocomplete's own startCompletion
// command — no reimplementation of what "start completion" means.
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
