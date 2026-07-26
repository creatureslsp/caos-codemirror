/** Representative document-size fixtures for bench/main.ts. */
const LINES_PER_BLOCK = 9;

function scriptBlock(index: number): string {
  return [
    `scrp 1 1 1 ${index}`,
    `setv va00 ${index}`,
    `doif va00 eq 0`,
    `  outs "block ${index}"`,
    `endi`,
    `setv va01 va00 add 1`,
    `attr 3`,
    `endm`,
    ``,
  ].join("\n");
}

/** Generates a real, parseable multi-script CAOS document with roughly
 * `targetLines` lines. */
export function generateCaosDocument(targetLines: number): string {
  const blockCount = Math.max(1, Math.round(targetLines / LINES_PER_BLOCK));
  let text = "";
  for (let i = 0; i < blockCount; i++) text += scriptBlock(i);
  return text;
}

export interface BenchFixture {
  label: string;
  text: string;
}

export const BENCH_DOCUMENT_SIZES = [50, 200, 1000] as const;

export function buildFixtures(): BenchFixture[] {
  return BENCH_DOCUMENT_SIZES.map((lines) => ({
    label: `${lines} lines`,
    text: generateCaosDocument(lines),
  }));
}
