/**
 * Theme mode + per-token color-override store, per
 * `../../../plan-webapp/07-theming-data-model-dark-light.md` and Phase 08's
 * link-aware extension (`../../../plan-webapp/08-color-linking-inlay-hint-style.md`).
 * Persists to `kv.themeMode` / `kv.themeOverrides` / `kv.inlayHintStyle`
 * (Phase 02's `kv` store) and exposes `@preact/signals` for reactive
 * consumption by `main.ts` (dark/light `Compartment` + `apply-theme.ts`) and
 * `ThemeTab.tsx`.
 */
import { computed, signal } from "@preact/signals";
import { kvGet, kvSet } from "../storage/db.js";
import { computeCompanionColor, type ThemeMode } from "./companion-color.js";
import { isLink, resolveTokenColor, wouldCreateCycle, type OverrideValue, type ThemeOverrides } from "./link-resolution.js";
import { findTokenKey } from "./token-keys.js";

export type { ThemeMode } from "./companion-color.js";
export type { OverrideValue, ThemeOverrides } from "./link-resolution.js";
export type ThemeModeSetting = "system" | "light" | "dark";

export interface InlayHintStyle {
  padding: string;
  borderRadius: string;
  fontFamily: string;
  fontSize: string;
  /** 0-1, independently adjustable in "Advanced" but driven together by the simple transparency slider. */
  bgOpacity: number;
  textOpacity: number;
}

export const DEFAULT_INLAY_HINT_STYLE: InlayHintStyle = {
  padding: "0 4px",
  borderRadius: "4px",
  fontFamily: "inherit",
  fontSize: "0.85em",
  bgOpacity: 1,
  textOpacity: 1,
};

/** Fallback literal for a brand-new override (e.g. a just-checked modifier, or a token unlinked with nothing resolvable). */
export const DEFAULT_OVERRIDE_COLOR = "#888888";

const THEME_MODE_KEY = "themeMode";
const THEME_OVERRIDES_KEY = "themeOverrides";
const INLAY_HINT_STYLE_KEY = "inlayHintStyle";

export const themeMode = signal<ThemeModeSetting>("system");
export const themeOverrides = signal<ThemeOverrides>({ light: {}, dark: {} });
export const inlayHintStyle = signal<InlayHintStyle>(DEFAULT_INLAY_HINT_STYLE);

/** Live `prefers-color-scheme: dark` state; only consulted when `themeMode` is `"system"`. */
export const systemPrefersDark = signal<boolean>(
  typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)").matches : false,
);

/** The mode actually in effect right now -- resolves `"system"` against `systemPrefersDark`. */
export const effectiveMode = computed<ThemeMode>(() =>
  themeMode.value === "system" ? (systemPrefersDark.value ? "dark" : "light") : themeMode.value,
);

let listenerInstalled = false;

function installSystemPreferenceListener(): void {
  if (listenerInstalled || typeof matchMedia !== "function") return;
  listenerInstalled = true;
  const mql = matchMedia("(prefers-color-scheme: dark)");
  systemPrefersDark.value = mql.matches;
  mql.addEventListener("change", (event) => {
    systemPrefersDark.value = event.matches;
  });
}

/** Hydrates signals from IndexedDB and starts the live OS-preference listener. Call once at boot. */
export async function loadThemeStore(): Promise<void> {
  const [mode, overrides, hintStyle] = await Promise.all([
    kvGet<ThemeModeSetting>(THEME_MODE_KEY),
    kvGet<ThemeOverrides>(THEME_OVERRIDES_KEY),
    kvGet<Partial<InlayHintStyle>>(INLAY_HINT_STYLE_KEY),
  ]);
  if (mode) themeMode.value = mode;
  if (overrides) themeOverrides.value = overrides;
  if (hintStyle) inlayHintStyle.value = { ...DEFAULT_INLAY_HINT_STYLE, ...hintStyle };
  installSystemPreferenceListener();
}

/** Explicit mode pick -- persists and stops following the system signal until `"system"` is chosen again. */
export async function setThemeMode(mode: ThemeModeSetting): Promise<void> {
  themeMode.value = mode;
  await kvSet(THEME_MODE_KEY, mode);
}

/** Raw override at `key` -- a literal, a link, or `undefined` if unset. */
export function getTokenOverride(mode: ThemeMode, key: string): OverrideValue | undefined {
  return themeOverrides.value[mode][key];
}

export function isTokenLinked(mode: ThemeMode, key: string): boolean {
  return isLink(getTokenOverride(mode, key));
}

export function getTokenLinkTarget(mode: ThemeMode, key: string): string | undefined {
  const value = getTokenOverride(mode, key);
  return isLink(value) ? value.linkedTo : undefined;
}

/** `key`'s effective literal color: follows link chains, falling back to the (chain-current) token's built-in default. */
export function getResolvedTokenColor(mode: ThemeMode, key: string): string | undefined {
  return resolveTokenColor(themeOverrides.value, mode, key, (k) => {
    const def = findTokenKey(k);
    return mode === "light" ? def?.defaultLight : def?.defaultDark;
  });
}

/**
 * Sets an explicit literal-color override for `key` in `mode`, then seeds
 * the *other* mode's companion color via `computeCompanionColor` -- but
 * only if that key has no existing value there. Once a key exists in a
 * mode's map (whether typed by the user, auto-seeded here, or a link),
 * it's "explicit" and this never overwrites it again -- matching the phase
 * doc's "never overwrite a value the user already set themselves" rule.
 */
export async function setTokenColor(mode: ThemeMode, key: string, value: string): Promise<void> {
  const other: ThemeMode = mode === "light" ? "dark" : "light";
  const current = themeOverrides.value;
  const next: ThemeOverrides = { light: { ...current.light }, dark: { ...current.dark } };
  next[mode][key] = value;

  if (!(key in current[other])) {
    const companion = computeCompanionColor(value, other);
    if (companion) next[other][key] = companion;
  }

  themeOverrides.value = next;
  await kvSet(THEME_OVERRIDES_KEY, next);
}

/**
 * Links `key` to `linkedTo`'s resolved color in `mode`. Throws if this
 * would create a circular reference -- callers (UI) should pre-filter link
 * candidates with `wouldCreateCycle` so this is a backstop, not the primary
 * validation path.
 */
export async function setTokenLink(mode: ThemeMode, key: string, linkedTo: string): Promise<void> {
  const current = themeOverrides.value;
  if (wouldCreateCycle(current, mode, key, linkedTo)) {
    throw new Error(`Linking "${key}" to "${linkedTo}" would create a circular reference.`);
  }
  const next: ThemeOverrides = { light: { ...current.light }, dark: { ...current.dark } };
  next[mode][key] = { linkedTo };
  themeOverrides.value = next;
  await kvSet(THEME_OVERRIDES_KEY, next);
}

/** Unlinks `key`, replacing the link with its last-resolved literal color (not a reset to the hardcoded default). */
export async function unlinkTokenColor(mode: ThemeMode, key: string): Promise<void> {
  const resolved = getResolvedTokenColor(mode, key) ?? DEFAULT_OVERRIDE_COLOR;
  await setTokenColor(mode, key, resolved);
}

/** Removes an explicit override (literal or link), falling back to the token's built-in default. Does not touch the other mode. */
export async function clearTokenColor(mode: ThemeMode, key: string): Promise<void> {
  const current = themeOverrides.value;
  const next: ThemeOverrides = { light: { ...current.light }, dark: { ...current.dark } };
  delete next[mode][key];
  themeOverrides.value = next;
  await kvSet(THEME_OVERRIDES_KEY, next);
}

export async function setInlayHintStyle(patch: Partial<InlayHintStyle>): Promise<void> {
  const next: InlayHintStyle = { ...inlayHintStyle.value, ...patch };
  inlayHintStyle.value = next;
  await kvSet(INLAY_HINT_STYLE_KEY, next);
}

export async function resetInlayHintStyle(): Promise<void> {
  inlayHintStyle.value = DEFAULT_INLAY_HINT_STYLE;
  await kvSet(INLAY_HINT_STYLE_KEY, DEFAULT_INLAY_HINT_STYLE);
}
