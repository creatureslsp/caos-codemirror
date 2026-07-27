/**
 * Minimal theming settings tab, per
 * `../../../plan-webapp/07-theming-data-model-dark-light.md`: dark/light/
 * system mode picker plus per-token color pickers for the syntax-color and
 * modifier categories (enough to prove the data model + companion-color
 * mechanism end to end). Palette-reuse/linking UI and inlay-hint-specific
 * controls (the `chrome` category in `token-keys.ts`) are Phase 08's
 * addition, not this tab's.
 */
import { useState } from "preact/hooks";
import { TOKEN_KEYS, type TokenKeyDef } from "../theming/token-keys.js";
import {
  clearTokenColor,
  effectiveMode,
  getTokenColor,
  setThemeMode,
  setTokenColor,
  themeMode,
  type ThemeMode,
  type ThemeModeSetting,
} from "../theming/theme-store.js";

const MODE_OPTIONS: { id: ThemeModeSetting; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

const EDITING_MODE_OPTIONS: { id: ThemeMode; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

const DEFAULT_NEW_OVERRIDE_COLOR = "#888888";

function segmentClass(active: boolean): string {
  return active ? "segmented-control-segment segmented-control-segment--active" : "segmented-control-segment";
}

export function ThemeTab() {
  const [editingMode, setEditingMode] = useState<ThemeMode>(() => effectiveMode.value);

  const syntaxKeys = TOKEN_KEYS.filter((t) => t.category === "syntax");
  const modifierKeys = TOKEN_KEYS.filter((t) => t.category === "modifier");

  function colorFor(def: TokenKeyDef): string {
    return (
      getTokenColor(editingMode, def.key) ??
      (editingMode === "light" ? def.defaultLight : def.defaultDark) ??
      DEFAULT_NEW_OVERRIDE_COLOR
    );
  }

  function onColorInput(key: string, value: string): void {
    void setTokenColor(editingMode, key, value);
  }

  function onReset(key: string): void {
    void clearTokenColor(editingMode, key);
  }

  function onModifierToggle(key: string, checked: boolean): void {
    if (checked) {
      void setTokenColor(editingMode, key, DEFAULT_NEW_OVERRIDE_COLOR);
    } else {
      void clearTokenColor(editingMode, key);
    }
  }

  return (
    <div id="theme-tab">
      <h2>Theme</h2>

      <div class="segmented-control theme-mode-switcher" role="tablist">
        {MODE_OPTIONS.map((opt) => (
          <button
            type="button"
            role="tab"
            key={opt.id}
            aria-selected={themeMode.value === opt.id}
            class={segmentClass(themeMode.value === opt.id)}
            onClick={() => void setThemeMode(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p class="theme-effective-mode">Currently displaying: {effectiveMode.value}</p>

      <h3>Editing colors for</h3>
      <div class="segmented-control theme-editing-mode-switcher" role="tablist">
        {EDITING_MODE_OPTIONS.map((opt) => (
          <button
            type="button"
            role="tab"
            key={opt.id}
            aria-selected={editingMode === opt.id}
            class={segmentClass(editingMode === opt.id)}
            onClick={() => setEditingMode(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <h3>Syntax colors</h3>
      <div class="theme-token-list">
        {syntaxKeys.map((def) => {
          const overridden = getTokenColor(editingMode, def.key) !== undefined;
          return (
            <label class="theme-token-row" data-token-key={def.key} key={def.key}>
              <input
                type="color"
                value={colorFor(def)}
                onInput={(event) => onColorInput(def.key, (event.target as HTMLInputElement).value)}
              />
              <span class="theme-token-label">{def.label}</span>
              {overridden && (
                <button type="button" class="theme-token-reset" onClick={() => onReset(def.key)}>
                  Reset
                </button>
              )}
            </label>
          );
        })}
      </div>

      <h3>Modifiers</h3>
      <p class="theme-token-hint">Unchecked modifiers inherit their token type's color above.</p>
      <div class="theme-token-list">
        {modifierKeys.map((def) => {
          const explicit = getTokenColor(editingMode, def.key);
          return (
            <div class="theme-token-row theme-token-row--modifier" data-token-key={def.key} key={def.key}>
              <label class="theme-token-modifier-checkbox">
                <input
                  type="checkbox"
                  checked={explicit !== undefined}
                  onChange={(event) => onModifierToggle(def.key, (event.target as HTMLInputElement).checked)}
                />
                {" " + def.label}
              </label>
              {explicit !== undefined && (
                <>
                  <input
                    type="color"
                    value={explicit}
                    onInput={(event) => onColorInput(def.key, (event.target as HTMLInputElement).value)}
                  />
                  <button type="button" class="theme-token-reset" onClick={() => onReset(def.key)}>
                    Reset
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
