/**
 * Applies `theme-store.ts`'s `themeOverrides` as CSS custom properties on an
 * ancestor of the editor DOM, per
 * `../../../plan-webapp/07-theming-data-model-dark-light.md`: no new JS-level
 * theming API reaches into CM6 -- the existing `var(--caos-x, #fallback)` /
 * `var(--caos-x-dark, #fallback)` pattern already in all four
 * `packages/editor` theme files reads these at render time. Both the light
 * and dark custom properties are always kept in sync with their respective
 * maps regardless of the currently *effective* mode -- CM6's own `&dark`
 * base-theme selector (see `main.ts`'s dark-mode `Compartment`) decides
 * which one actually applies.
 */
import { effect } from "@preact/signals";
import { themeOverrides, type ThemeOverrides } from "./theme-store.js";

function propertyName(mode: "light" | "dark", key: string): string {
  return mode === "light" ? `--caos-${key}` : `--caos-${key}-dark`;
}

/**
 * Starts reactively applying `themeOverrides` to `root`'s inline style.
 * Returns a disposer (from `@preact/signals`' `effect()`).
 */
export function startApplyingTheme(root: HTMLElement = document.documentElement): () => void {
  let appliedProperties = new Set<string>();

  return effect(() => {
    const overrides: ThemeOverrides = themeOverrides.value;
    const nextProperties = new Set<string>();

    for (const [key, value] of Object.entries(overrides.light)) {
      const prop = propertyName("light", key);
      root.style.setProperty(prop, value);
      nextProperties.add(prop);
    }
    for (const [key, value] of Object.entries(overrides.dark)) {
      const prop = propertyName("dark", key);
      root.style.setProperty(prop, value);
      nextProperties.add(prop);
    }

    for (const prop of appliedProperties) {
      if (!nextProperties.has(prop)) root.style.removeProperty(prop);
    }
    appliedProperties = nextProperties;
  });
}
