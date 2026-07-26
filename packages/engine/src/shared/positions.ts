/**
 * Position/offset conversion between CodeMirror 6's single absolute UTF-16
 * code-unit document offset and caos-kt's line/character positions.
 */
import type { Text } from "@codemirror/state";

export interface LineChar {
  /** 0-indexed line number. */
  line: number;
  /** 0-indexed character offset within the line (UTF-16 code units). */
  character: number;
}

/** A structural subset of caos-kt's `Location` (caos-validation-report.d.mts)
 * — only the fields this module needs, so callers can pass the real type
 * directly without this module depending on caos-kt's types. */
export interface IndexedLocation {
  readonly startLine: number;
  readonly endLine: number;
  readonly startColumn: number;
  readonly endColumn: number;
  readonly indexing: "0-indexed" | "1-indexed";
}

export function cmOffsetToLineChar(doc: Text, offset: number): LineChar {
  const clamped = Math.max(0, Math.min(offset, doc.length));
  const line = doc.lineAt(clamped);
  return { line: line.number - 1, character: clamped - line.from };
}

export function lineCharToCmOffset(doc: Text, line: number, character: number): number {
  const lineNumber = Math.max(1, Math.min(line + 1, doc.lines));
  const lineObj = doc.line(lineNumber);
  const character0 = Math.max(0, Math.min(character, lineObj.length));
  return lineObj.from + character0;
}

/** Reads `location.indexing` at call time and converts to a CM6 `{from, to}` offset range. */
export function adjustForIndexing(location: IndexedLocation, doc: Text): { from: number; to: number } {
  const lineOffset = location.indexing === "1-indexed" ? 1 : 0;
  const columnOffset = lineOffset;

  const from = lineCharToCmOffset(
    doc,
    location.startLine - lineOffset,
    location.startColumn - columnOffset,
  );
  const to = lineCharToCmOffset(
    doc,
    location.endLine - lineOffset,
    location.endColumn - columnOffset,
  );
  return { from, to };
}
