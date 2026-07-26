// Widget-decoration implementation for inline inlay hints.
import { WidgetType } from "@codemirror/view";

export class InlayHintWidget extends WidgetType {
  constructor(
    readonly label: string,
    readonly tooltip: string | undefined,
    // LSP's InlayHint.paddingLeft/paddingRight are booleans — "add a single
    // space of padding on this side" — not pixel/em amounts (verified
    // against vscode-languageserver-types' InlayHint doc comment before
    // writing this; easy to misread as numeric from the plan doc's prose
    // alone).
    readonly paddingLeft: boolean,
    readonly paddingRight: boolean,
  ) {
    super();
  }

  eq(other: InlayHintWidget): boolean {
    return (
      other.label === this.label &&
      other.tooltip === this.tooltip &&
      other.paddingLeft === this.paddingLeft &&
      other.paddingRight === this.paddingRight
    );
  }

  ignoreEvent(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-caos-inlay-hint";
    span.textContent = this.label;
    if (this.tooltip) span.title = this.tooltip;
    if (this.paddingLeft) span.style.marginLeft = "0.2em";
    if (this.paddingRight) span.style.marginRight = "0.2em";
    return span;
  }
}
