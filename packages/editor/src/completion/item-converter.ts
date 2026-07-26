// Converts LSP-shaped CompletionItems from the engine Worker to CM6 Completions.
import type { Text } from "@codemirror/state";
import type { Completion } from "@codemirror/autocomplete";
import { snippet } from "@codemirror/autocomplete";
import { CompletionItemKind, InsertTextFormat, type CompletionItem } from "vscode-languageserver-types";
import { lineCharToCmOffset } from "@creatures-codemirror/engine";

const KIND_TO_TYPE: Partial<Record<CompletionItemKind, string>> = {
  [CompletionItemKind.Text]: "text",
  [CompletionItemKind.Method]: "method",
  [CompletionItemKind.Function]: "function",
  [CompletionItemKind.Constructor]: "function",
  [CompletionItemKind.Field]: "property",
  [CompletionItemKind.Variable]: "variable",
  [CompletionItemKind.Class]: "class",
  [CompletionItemKind.Interface]: "interface",
  [CompletionItemKind.Module]: "namespace",
  [CompletionItemKind.Property]: "property",
  [CompletionItemKind.Unit]: "constant",
  [CompletionItemKind.Value]: "constant",
  [CompletionItemKind.Enum]: "enum",
  [CompletionItemKind.Keyword]: "keyword",
  [CompletionItemKind.Snippet]: "text",
  [CompletionItemKind.Color]: "constant",
  [CompletionItemKind.File]: "text",
  [CompletionItemKind.Reference]: "variable",
  [CompletionItemKind.Folder]: "text",
  [CompletionItemKind.EnumMember]: "constant",
  [CompletionItemKind.Constant]: "constant",
  [CompletionItemKind.Struct]: "class",
  [CompletionItemKind.Event]: "function",
  [CompletionItemKind.Operator]: "keyword",
  [CompletionItemKind.TypeParameter]: "type",
};

function kindToType(kind: CompletionItem["kind"]): string | undefined {
  return kind == null ? undefined : KIND_TO_TYPE[kind];
}

/** Adjust completion score based on sortText prefix. */
function boostFor(sortText: string | undefined): number | undefined {
  if (sortText?.startsWith("a_")) return 1;
  if (sortText?.startsWith("b_")) return -1;
  return undefined;
}

/** Converts LSP snippet syntax to CM6 snippet syntax. */
function lspSnippetToCM6(insertText: string): string {
  return insertText.replace(/\$\{\d+(?::([^}]*))?\}/g, (_match, text: string | undefined) => `\${${text ?? ""}}`);
}

function infoNode(documentation: string | CompletionItem["documentation"]): (() => Node) | undefined {
  const text = typeof documentation === "string" ? documentation : documentation?.value;
  if (!text) return undefined;
  return () => {
    const el = document.createElement("div");
    el.style.whiteSpace = "pre-wrap";
    el.textContent = text;
    return el;
  };
}

export function lspCompletionItemToCM6(item: CompletionItem, doc: Text): Completion | null {
  // The bitflags "Generate Bitflag Value" helper item (completions.bitflags.ts)
  // exists purely to trigger a VS Code client command (caos.generateBitflagValue)
  // and inserts empty text on its own — meaningless without that command
  // execution model, which this web port doesn't have (no VS Code command
  // palette/UI). Its real bitflag *value* completions (the rest of the list)
  // are unaffected and still come through normally.
  if (item.command && !item.insertText && (!item.textEdit || item.textEdit.newText === "")) {
    return null;
  }

  const base = {
    label: item.label,
    type: kindToType(item.kind),
    detail: item.detail,
    info: infoNode(item.documentation),
    boost: boostFor(item.sortText),
  };

  // caos-util only ever constructs a plain TextEdit ({range, newText}) — the
  // InsertReplaceEdit variant ({insert, replace}) is an LSP client-capability
  // opt-in (clientCapabilities.useInsertReplace in the real extension's
  // server) this port never requests, so it never appears in practice.
  if (item.textEdit && "range" in item.textEdit) {
    const { range, newText } = item.textEdit;
    const from = lineCharToCmOffset(doc, range.start.line, range.start.character);
    const to = lineCharToCmOffset(doc, range.end.line, range.end.character);
    const isSnippet = item.insertTextFormat === InsertTextFormat.Snippet;
    const applySnippet = isSnippet ? snippet(lspSnippetToCM6(newText)) : undefined;
    return {
      ...base,
      // Ignores the (from, to) CM6 passes in — those are the completion
      // *result*'s shared from/to (word-match-derived), not this specific
      // item's replacement range, which for multi-word commands spans
      // further back (e.g. replacing "particle in" with "particle info").
      apply: (view, _completion, _from, _to) => {
        if (applySnippet) {
          applySnippet(view, _completion, from, to);
        } else {
          view.dispatch({
            changes: { from, to, insert: newText },
            selection: { anchor: from + newText.length },
          });
        }
      },
    };
  }

  if (item.insertTextFormat === InsertTextFormat.Snippet && item.insertText) {
    return { ...base, apply: snippet(lspSnippetToCM6(item.insertText)) };
  }

  return { ...base, apply: item.insertText ?? item.label };
}
