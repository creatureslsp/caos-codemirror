// Decodes the flat LSP semantic-token delta encoding into position-based tokens.
import type { SemanticTokensLegend } from "./legend.js";

export interface DecodedSemanticToken {
  /** 0-indexed line, matching vscode-languageserver-types Position. */
  line: number;
  /** 0-indexed UTF-16 character offset within the line. */
  character: number;
  length: number;
  typeIndex: number;
  modifierBitmask: number;
}

export function decodeSemanticTokens(data: readonly number[]): DecodedSemanticToken[] {
  const tokens: DecodedSemanticToken[] = [];
  let line = 0;
  let character = 0;

  for (let i = 0; i + 5 <= data.length; i += 5) {
    const deltaLine = data[i];
    const deltaChar = data[i + 1];
    const length = data[i + 2];
    const typeIndex = data[i + 3];
    const modifierBitmask = data[i + 4];

    if (deltaLine > 0) {
      line += deltaLine;
      character = deltaChar;
    } else {
      character += deltaChar;
    }

    tokens.push({ line, character, length, typeIndex, modifierBitmask });
  }

  return tokens;
}

/** Returns CSS classes for a decoded token (`cm-caos-sem-<type>` and `cm-caos-mod-<modifier>`). */
export function classNamesFor(token: DecodedSemanticToken, legend: SemanticTokensLegend): string[] {
  const classes: string[] = [];
  const typeName = legend.tokenTypes[token.typeIndex];
  if (typeName) classes.push(`cm-caos-sem-${typeName}`);

  for (let bit = 0; bit < legend.tokenModifiers.length; bit++) {
    if ((token.modifierBitmask & (1 << bit)) !== 0) {
      classes.push(`cm-caos-mod-${legend.tokenModifiers[bit]}`);
    }
  }

  return classes;
}
