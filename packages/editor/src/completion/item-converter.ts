// Converts caos-util's LSP-shaped CompletionItem (returned by the worker's
// "getCompletions" RPC, see plan/04-autocomplete.md) to CM6's Completion.
//
// Verified against the actual completion-item builders in
// vs-caos-editor/packages/caos-util/src/completion/*.ts before writing this
// file (not just the plan doc's description of them):
//   - `documentation` is always a plain-text command/value description
//     (e.g. `command.description` assigned directly in
//     command-to-completion-item.ts), never markdown — formatCaosDocumentation
//     (documentation-formattter.ts), which *does* produce markdown, is only
//     used by the extension's hover path, not completions. So `info` below
//     renders plain text, not markdown — there is no shared markdown-lite
//     renderer to reuse here (Phase 5's hover will need one; it has nothing
//     to do with this file).
//   - Only multi-word commands (getMultiTokenCommands in
//     completion.command.ts) carry a `textEdit`; everything else
//     (single-word commands, bitflag/values-list/lvalue/rvalue items) relies
//     on plain `insertText`, so `from`/`to` for those come from the
//     completion source's own word-match instead.
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

/** Best-effort only (plan/04-autocomplete.md's accepted parity gap): the
 * only real signal in caos-kt's sortText scheme is the 'a_'/'b_' prefix
 * getCommandCompletionsForCommandType adds for return-type-matching
 * (completion.command.ts) — every other sortText uses a constant numeric
 * prefix that carries no real ordering information, so isn't worth parsing. */
function boostFor(sortText: string | undefined): number | undefined {
  if (sortText?.startsWith("a_")) return 1;
  if (sortText?.startsWith("b_")) return -1;
  return undefined;
}

/** LSP tabstop syntax `${1:name:type}` (or bare `${1}`) → CM6 snippet syntax
 * `${name:type}` (or `${}`) — strips the leading numeric tabstop index,
 * keeping only the placeholder text (plan/04-autocomplete.md: two
 * parameters sharing a placeholder name become linked/mirrored tabstops in
 * CM6's model; accepted as low-risk since CAOS parameter names are
 * typically distinct). */
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
