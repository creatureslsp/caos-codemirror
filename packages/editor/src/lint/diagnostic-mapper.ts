// Maps caos-kt's Diagnostic (caos-validation-report.d.mts) to CM6's own
// Diagnostic type from @codemirror/lint — distinct types sharing a name, so
// the import aliases below are deliberately unambiguous.
import type { Text } from "@codemirror/state";
import type { Diagnostic as CM6Diagnostic } from "@codemirror/lint";
import type { CaosDiagnostic } from "@creatures-codemirror/engine";
import { adjustForIndexing } from "@creatures-codemirror/engine";

/**
 * Maps caos-kt's `Diagnostic.severity` ("info" | "warning" | "error") to CM6's severity.
 */
function toMessage(d: CaosDiagnostic): string {
  const parts = [d.message];

  if (d.source?.lineText) {
    parts.push(d.source.lineText);
    if (d.source.marker) parts.push(d.source.marker);
  }

  // Suggestion.replacement is explicitly documented upstream as prose
  // ("a description of what can be done to fix the problem (NOT ACTUAL
  // CODE)"), not an applicable edit — never wired into CM6's `actions`
  // auto-fix mechanism, only folded into the message as a hint.
  if (d.suggestion?.description) {
    parts.push(`Hint: ${d.suggestion.description}`);
  }

  return parts.join("\n");
}

declare type CreateElementOpts = {
  init?: (element: HTMLElement) => void,
  contents?: string
  isHTML?: boolean
} | ((element: HTMLElement) => void) | string | Element[];

function createElement(tag: string, opts: CreateElementOpts, init?: (element: HTMLElement) => void): HTMLElement {
  const out = document.createElement(tag);
  if (typeof opts === "string") {
    out.innerText = opts;
  } else if (Array.isArray(opts)) {
    for (const element of opts) {
      out.appendChild(element);
    }
  } else if (typeof opts === "object") {
    const {init, contents, isHTML} = opts;
    if (contents != null) {
      if (isHTML) {
        out.innerHTML = contents;
      } else {
        out.innerText = contents;
      }
    }
    if (init) {
      init(out);
    }
  } else if (typeof opts === "function") {
      opts(out);
  }
  if (init) {
    init(out)
  }
  return out;
}

function monospacedSpan(text: string) {
  return createElement("span", text, (e) => {
    e.classList.add("font-monospaced")
  })
}

function toMessageElement(d: CaosDiagnostic) {
  const parts: HTMLElement[] = [createElement("span", d.message)];

  if (d.source?.lineText && d.source.marker) {
    parts.push(monospacedSpan(d.source.lineText));
    parts.push(monospacedSpan(d.source!.marker));
  }

  return createElement("div", (out) => {
    for (const part of parts) {
      out.append(part)
      out.append(document.createElement("br"))
    }
  });
}

export function toCM6Diagnostic(d: CaosDiagnostic, doc: Text): CM6Diagnostic {
  const { from, to } = adjustForIndexing(d.location, doc);
  return {
    from,
    to,
    severity: d.severity,
    source: d.code,
    message: toMessage(d),
    renderMessage() {
      return toMessageElement(d);
    }
  };
}
