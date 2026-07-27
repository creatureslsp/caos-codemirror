/**
 * Applies `theme-store.ts`'s `themeOverrides`/`inlayHintStyle` as CSS custom
 * properties on an ancestor of the editor DOM, per
 * `../../../plan-webapp/07-theming-data-model-dark-light.md` and Phase 08's
 * link/opacity extension
 * (`../../../plan-webapp/08-color-linking-inlay-hint-style.md`): no new
 * JS-level theming API reaches into CM6 -- the existing
 * `var(--caos-x, #fallback)` / `var(--caos-x-dark, #fallback)` pattern
 * already in all four `packages/editor` theme files reads these at render
 * time. Both the light and dark custom properties are always kept in sync
 * with their respective maps regardless of the currently *effective* mode
 * -- CM6's own `&dark` base-theme selector (see `main.ts`'s dark-mode
 * `Compartment`) decides which one actually applies.
 *
 * Link resolution happens here, not in the CSS: every override (literal or
 * `{ linkedTo }`) is resolved to a plain literal color before it's written
 * to a custom property, so CM6's static `var(...)` fallback chains never
 * need to represent a link themselves.
 */
import { effect } from "@preact/signals";
import { formatColor, parseColor } from "./companion-color.js";
import { resolveTokenColor } from "./link-resolution.js";
import { findTokenKey } from "./token-keys.js";
import { inlayHintStyle, themeOverrides, type InlayHintStyle, type ThemeMode, type ThemeOverrides } from "./theme-store.js";

function propertyName(mode: ThemeMode, key: string): string {
  return mode === "light" ? `--caos-${key}` : `--caos-${key}-dark`;
}

function defaultFor(mode: ThemeMode, key: string): string | undefined {
  const def = findTokenKey(key);
  return mode === "light" ? def?.defaultLight : def?.defaultDark;
}

/** Composes `opacity` (0-1) into `color`'s alpha channel; multiplies against any alpha `color` already carries. No-op at opacity 1. */
function applyOpacity(color: string, opacity: number): string {
  if (opacity >= 1) return color;
  const parsed = parseColor(color);
  if (!parsed) return color;
  return formatColor({ r: parsed.r, g: parsed.g, b: parsed.b }, parsed.a * Math.max(0, opacity));
}

const OPACITY_TOKENS: { key: "inlay-hint" | "inlay-hint-bg"; field: keyof Pick<InlayHintStyle, "bgOpacity" | "textOpacity"> }[] = [
  { key: "inlay-hint", field: "textOpacity" },
  { key: "inlay-hint-bg", field: "bgOpacity" },
];

const STYLE_PROPERTIES: { cssVar: string; field: keyof Pick<InlayHintStyle, "padding" | "borderRadius" | "fontFamily" | "fontSize"> }[] = [
  { cssVar: "--caos-inlay-hint-padding", field: "padding" },
  { cssVar: "--caos-inlay-hint-radius", field: "borderRadius" },
  { cssVar: "--caos-inlay-hint-font-family", field: "fontFamily" },
  { cssVar: "--caos-inlay-hint-font-size", field: "fontSize" },
];

/**
 * Starts reactively applying `themeOverrides`/`inlayHintStyle` to `root`'s
 * inline style. Returns a disposer (from `@preact/signals`' `effect()`).
 */
export function startApplyingTheme(root: HTMLElement = document.documentElement): () => void {
  let appliedProperties = new Set<string>();

  return effect(() => {
    const overrides: ThemeOverrides = themeOverrides.value;
    const style = inlayHintStyle.value;
    const nextProperties = new Set<string>();

    const set = (prop: string, value: string) => {
      root.style.setProperty(prop, value);
      nextProperties.add(prop);
    };

    for (const mode of ["light", "dark"] as const) {
      for (const key of Object.keys(overrides[mode])) {
        const resolved = resolveTokenColor(overrides, mode, key, (k) => defaultFor(mode, k));
        if (resolved === undefined) continue;
        const opacityToken = OPACITY_TOKENS.find((t) => t.key === key);
        const value = opacityToken ? applyOpacity(resolved, style[opacityToken.field]) : resolved;
        set(propertyName(mode, key), value);
      }

      // Opacity must apply even when inlay-hint color is at its built-in
      // default (no override present) -- otherwise the transparency
      // sliders would have no visible effect until the user also picks a
      // custom color for that mode.
      for (const { key, field } of OPACITY_TOKENS) {
        const prop = propertyName(mode, key);
        if (nextProperties.has(prop) || style[field] >= 1) continue;
        const base = defaultFor(mode, key);
        if (base === undefined) continue;
        set(prop, applyOpacity(base, style[field]));
      }
    }

    for (const { cssVar, field } of STYLE_PROPERTIES) {
      set(cssVar, style[field]);
    }

    for (const prop of appliedProperties) {
      if (!nextProperties.has(prop)) root.style.removeProperty(prop);
    }
    appliedProperties = nextProperties;
  });
}
