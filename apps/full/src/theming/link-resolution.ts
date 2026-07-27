/**
 * Token-color link chains and cycle detection, per
 * `../../../plan-webapp/08-color-linking-inlay-hint-style.md`. Lives below
 * `theme-store.ts` (which imports from here, not the reverse) so the
 * `ThemeOverrides`/`OverrideValue` shape has one definition even though
 * both `theme-store.ts` and `apply-theme.ts` need it.
 */
import type { ThemeMode } from "./companion-color.js";

/** A per-token override: either a literal CSS color, or a link to another token's resolved color. */
export type OverrideValue = string | { linkedTo: string };

export interface ThemeOverrides {
  light: Record<string, OverrideValue>;
  dark: Record<string, OverrideValue>;
}

export function isLink(value: OverrideValue | undefined): value is { linkedTo: string } {
  return typeof value === "object" && value !== null && "linkedTo" in value;
}

/**
 * Resolves `key`'s effective literal color in `mode`: follows `linkedTo`
 * references until a literal is found, or until a key has no override at
 * all (falls back to `getDefault(key)` for *that* key -- a link to a token
 * with no override takes on that token's own default, not the origin
 * key's). `getDefault` is consulted with the chain's current key, not the
 * original one.
 *
 * The `visited` guard is a safety net for a cycle that somehow made it into
 * storage -- `wouldCreateCycle` is what actually prevents that at write
 * time. On a detected cycle this returns `getDefault(key)` (the original
 * key's default) rather than looping forever.
 */
export function resolveTokenColor(
  overrides: ThemeOverrides,
  mode: ThemeMode,
  key: string,
  getDefault: (key: string) => string | undefined,
): string | undefined {
  const visited = new Set<string>();
  let current = key;
  while (!visited.has(current)) {
    visited.add(current);
    const value = overrides[mode][current];
    if (value === undefined) return getDefault(current);
    if (isLink(value)) {
      current = value.linkedTo;
      continue;
    }
    return value;
  }
  return getDefault(key);
}

/**
 * Would linking `from -> to` create a circular reference? Resolves `to`'s
 * existing chain and checks whether it ever revisits `from`. Call before
 * committing a new link; reject the edit (surface as "would create a
 * circular reference," not a silent failure) if this returns `true`.
 */
export function wouldCreateCycle(overrides: ThemeOverrides, mode: ThemeMode, from: string, to: string): boolean {
  if (from === to) return true;
  const visited = new Set<string>();
  let current: string | undefined = to;
  while (current !== undefined) {
    if (current === from) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    const value: OverrideValue | undefined = overrides[mode][current];
    current = isLink(value) ? value.linkedTo : undefined;
  }
  return false;
}
