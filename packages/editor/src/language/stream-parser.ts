// Synchronous StreamLanguage tokenizer for baseline CAOS syntax highlighting (Layer 1).
import type { StreamParser, StringStream } from "@codemirror/language";
import { caosTags, type CaosTokenName } from "./caos-tags.js";

export interface CaosStreamState {
  /** True from the start of the current line until the first real
   * (non-whitespace) token is emitted on it. Comments and CAOS2Pray
   * directive/header lines are only recognized here, matching the
   * tmLanguage grammar's "only leading whitespace precedes it" rules. */
  atLineStart: boolean;
  /** Inside a "*#key = value" directive line, after its key has been
   * consumed (plan: "a dedicated inCaos2Directive sub-state"). Reset every
   * line — these directives never span lines, matching the tmLanguage
   * rule's own `(?=\n|$)` end anchor. */
  inCaos2Directive: boolean;
  /** Inside an opened, unclosed `"…"` string. Reset every line. */
  inQuoteString: boolean;
  /** Inside an opened, unclosed `[…]` bracket/byte-string span. Reset every line. */
  inBracketString: boolean;
  /** True immediately after tokenizing a SUBR or GSUB keyword. */
  afterLabelKeyword: boolean;
}

function freshLineState(state: CaosStreamState): void {
  state.atLineStart = true;
  state.inCaos2Directive = false;
  state.inQuoteString = false;
  state.inBracketString = false;
  state.afterLabelKeyword = false;
}

const CONTROL_KEYWORDS = new Set([
  "doif", "elif", "else", "endi",
  "reps", "repe",
  "loop", "untl", "ever",
  "enum", "next", "subr", "retn", "scrp", "iscr", "rscr",
  "etch", "esee", "epas", "econ", "elst", "escn", "nscn",
]);

const COMPARE_WORDS = new Set(["eq", "ne", "gt", "ge", "lt", "le", "bt", "bf", "and", "or"]);

const COMMAND_SHAPE = /^[a-zA-Z_$][a-zA-Z0-9_$+]{2}[a-zA-Z0-9_+:]$/;

function classifyWord(word: string, state: CaosStreamState): CaosTokenName | null {
  const lower = word.toLowerCase();
  let tag: CaosTokenName | null;

  if (state.afterLabelKeyword) {
    state.afterLabelKeyword = false;
    tag = "labelName";
  } else if (COMPARE_WORDS.has(lower)) {
    tag = "compareOperator";
  } else if (CONTROL_KEYWORDS.has(lower)) {
    tag = "controlKeyword";
  } else if (COMMAND_SHAPE.test(word)) {
    tag = "commandHeuristic";
  } else {
    tag = null;
  }

  if (lower === "subr" || lower === "gsub") {
    state.afterLabelKeyword = true;
  }

  return tag;
}

function quoteStringToken(stream: StringStream, state: CaosStreamState): CaosTokenName {
  if (stream.match(/^"/)) {
    state.inQuoteString = false;
    return "string";
  }
  if (stream.match(/^\\./)) return "escape";
  if (stream.match(/^[^"\\\n]+/)) return "string";
  stream.next();
  return "string";
}

function bracketStringToken(stream: StringStream, state: CaosStreamState): CaosTokenName {
  if (stream.match(/^\]/)) {
    state.inBracketString = false;
    return "string";
  }
  if (stream.match(/^[^\]\n]+/)) return "string";
  stream.next();
  return "string";
}

function caos2DirectiveToken(stream: StringStream, state: CaosStreamState): CaosTokenName | null {
  if (stream.match(/^=/)) return "caos2Eq";
  if (stream.match(/^"(?:\\.|[^"\\\n])*"?/)) return "string";
  if (stream.match(/^[^ \t\n]+/)) return "string";
  stream.next();
  state.inCaos2Directive = false;
  return null;
}

function token(stream: StringStream, state: CaosStreamState): CaosTokenName | null {
  if (stream.sol()) freshLineState(state);

  // Quote/bracket-string sub-tokenizers own whitespace inside their span
  // (it's part of the string content) — checked before the generic
  // eatSpace() below, which would otherwise swallow it as insignificant.
  if (state.inQuoteString) return quoteStringToken(stream, state);
  if (state.inBracketString) return bracketStringToken(stream, state);

  if (stream.eatSpace()) return null;

  if (state.inCaos2Directive) return caos2DirectiveToken(stream, state);

  if (state.atLineStart) {
    if (stream.match(/^\*\*(caos2pray|caos2cob)\b.*/i)) {
      state.atLineStart = false;
      return "caos2Directive";
    }
    // Ported from tmLanguage's caos2statement: when a "=" appears later on
    // the line, the key runs non-greedily up to it (spaces allowed inside,
    // e.g. "*#Agent Type = 0"); with no "=" at all, the key-only fallback
    // stops at the first space instead.
    if (
      stream.match(/^\*#[ \t]*[^=\n]*?(?=[ \t]*=)/) ||
      stream.match(/^\*#[ \t]*[^ \t\n]*/)
    ) {
      state.atLineStart = false;
      state.inCaos2Directive = true;
      return "caos2Directive";
    }
    if (stream.match(/^\*.*/)) {
      state.atLineStart = false;
      return "lineComment";
    }
  }
  state.atLineStart = false;

  const ch = stream.peek();

  if (ch === '"') {
    stream.next();
    state.inQuoteString = true;
    return "string";
  }

  if (ch === "[") {
    stream.next();
    state.inBracketString = true;
    return "string";
  }

  if (ch === "'" && stream.match(/^'(?:\\.|[^'\n])'/)) {
    return "string";
  }

  if ((ch === "<" || ch === ">" || ch === "=") && stream.match(/^(<>|<=|>=|<|>|=)/)) {
    return "compareOperator";
  }

  const next = stream.string[stream.pos + 1];
  const looksNumeric = ch != null && (/[0-9]/.test(ch) || ((ch === "+" || ch === "-") && next != null && /[0-9]/.test(next)));
  if (looksNumeric) {
    if (stream.match(/^0[xX][0-9a-fA-F]+/)) return "number";
    if (stream.match(/^[-+]?[0-9]*\.[0-9]+/)) return "number";
    if (stream.match(/^[+-]?[0-9]+/)) return "number";
  }

  if (ch != null && /[a-zA-Z_$]/.test(ch)) {
    if (stream.match(/^[a-zA-Z_$][a-zA-Z0-9_$+:]*/)) return classifyWord(stream.current(), state);
  }

  stream.next();
  return null;
}

export const caosStreamParser: StreamParser<CaosStreamState> = {
  name: "caos",
  startState(): CaosStreamState {
    return {
      atLineStart: true,
      inCaos2Directive: false,
      inQuoteString: false,
      inBracketString: false,
      afterLabelKeyword: false,
    };
  },
  token,
  tokenTable: caosTags,
  languageData: {
    commentTokens: { line: "*" },
  },
};
