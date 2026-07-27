/**
 * Theme mode + per-token color-override store, per
 * `../../../plan-webapp/07-theming-data-model-dark-light.md`. Persists to
 * `kv.themeMode` / `kv.themeOverrides` (Phase 02's `kv` store) and exposes
 * `@preact/signals` for reactive consumption by `main.ts` (dark/light
 * `Compartment` + `apply-theme.ts`) and `ThemeTab.tsx`.
 */
import { computed, signal } from "@preact/signals";
import { kvGet, kvSet } from "../storage/db.js";
import { computeCompanionColor, type ThemeMode } from "./companion-color.js";

export type { ThemeMode } from "./companion-color.js";
export type ThemeModeSetting = "system" | "light" | "dark";

export interface ThemeOverrides {
  light: Record<string, string>;
  dark: Record<string, string>;
}

const THEME_MODE_KEY = "themeMode";
const THEME_OVERRIDES_KEY = "themeOverrides";

export const themeMode = signal<ThemeModeSetting>("system");
export const themeOverrides = signal<ThemeOverrides>({ light: {}, dark: {} });

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
  const [mode, overrides] = await Promise.all([
    kvGet<ThemeModeSetting>(THEME_MODE_KEY),
    kvGet<ThemeOverrides>(THEME_OVERRIDES_KEY),
  ]);
  if (mode) themeMode.value = mode;
  if (overrides) themeOverrides.value = overrides;
  installSystemPreferenceListener();
}

/** Explicit mode pick -- persists and stops following the system signal until `"system"` is chosen again. */
export async function setThemeMode(mode: ThemeModeSetting): Promise<void> {
  themeMode.value = mode;
  await kvSet(THEME_MODE_KEY, mode);
}

export function getTokenColor(mode: ThemeMode, key: string): string | undefined {
  return themeOverrides.value[mode][key];
}

/**
 * Sets an explicit override for `key` in `mode`, then seeds the *other*
 * mode's companion color via `computeCompanionColor` -- but only if that
 * key has no existing value there. Once a key exists in a mode's map
 * (whether typed by the user or auto-seeded here), it's "explicit" and this
 * never overwrites it again -- matching the phase doc's "never overwrite a
 * value the user already set themselves" rule.
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

/** Removes an explicit override, falling back to the token's built-in default. Does not touch the other mode. */
export async function clearTokenColor(mode: ThemeMode, key: string): Promise<void> {
  const current = themeOverrides.value;
  const next: ThemeOverrides = { light: { ...current.light }, dark: { ...current.dark } };
  delete next[mode][key];
  themeOverrides.value = next;
  await kvSet(THEME_OVERRIDES_KEY, next);
}
