/**
 * Theming settings tab, per
 * `../../../plan-webapp/07-theming-data-model-dark-light.md` (dark/light/
 * system mode picker, per-token color pickers, companion-color mechanism)
 * and Phase 08's extension
 * (`../../../plan-webapp/08-color-linking-inlay-hint-style.md`): a
 * palette/swatch list of colors currently in use, per-token color-linking
 * via `TokenColorControl`, and an Inlay Hints styling section
 * (simple/advanced split) covering the `chrome`-category `inlay-hint`/
 * `inlay-hint-bg` tokens this tab previously left out.
 */
import { useState } from "preact/hooks";
import type { CaosEngineClient } from "@creatures-codemirror/engine";
import type { SemanticTokensLegend } from "@creatures-codemirror/editor";
import { TokenColorControl } from "./TokenColorControl.js";
import { PreviewPanel } from "../theming/PreviewPanel.js";
import { TOKEN_KEYS, findTokenKey, type TokenKeyDef } from "../theming/token-keys.js";
import {
  clearTokenColor,
  effectiveMode,
  getResolvedTokenColor,
  getTokenOverride,
  inlayHintStyle,
  resetInlayHintStyle,
  setInlayHintStyle,
  setThemeMode,
  setTokenColor,
  themeMode,
  themeOverrides,
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

function PaletteSwatchList({ mode }: { mode: ThemeMode }) {
  const overrides = themeOverrides.value[mode];
  const groups = new Map<string, string[]>();
  for (const key of Object.keys(overrides)) {
    const resolved = getResolvedTokenColor(mode, key);
    if (!resolved) continue;
    const label = findTokenKey(key)?.label ?? key;
    const labels = groups.get(resolved) ?? [];
    labels.push(label);
    groups.set(resolved, labels);
  }

  if (groups.size === 0) {
    return <p class="theme-token-hint">No custom colors set yet — pick a color below to see it here.</p>;
  }

  return (
    <ul class="theme-palette-list">
      {[...groups.entries()].map(([color, labels]) => (
        <li class="theme-palette-row" key={color}>
          <span class="theme-swatch" style={{ backgroundColor: color }} />
          <span class="theme-palette-hex">{color}</span>
          <span class="theme-palette-tokens">{labels.join(", ")}</span>
        </li>
      ))}
    </ul>
  );
}

function InlayHintSettings({ mode }: { mode: ThemeMode }) {
  const [advanced, setAdvanced] = useState(false);
  const style = inlayHintStyle.value;
  const simplePercent = Math.round(((style.bgOpacity + style.textOpacity) / 2) * 100);

  function onSimpleTransparency(percent: number): void {
    const opacity = percent / 100;
    void setInlayHintStyle({ bgOpacity: opacity, textOpacity: opacity });
  }

  return (
    <div class="theme-inlay-hints">
      <h3>Inlay hints</h3>

      <div class="theme-token-row" data-token-key="inlay-hint">
        <TokenColorControl mode={mode} tokenKey="inlay-hint" />
        <span class="theme-token-label">Text color</span>
        {getTokenOverride(mode, "inlay-hint") !== undefined && (
          <button type="button" class="theme-token-reset" onClick={() => void clearTokenColor(mode, "inlay-hint")}>
            Reset
          </button>
        )}
      </div>
      <div class="theme-token-row" data-token-key="inlay-hint-bg">
        <TokenColorControl mode={mode} tokenKey="inlay-hint-bg" />
        <span class="theme-token-label">Background color</span>
        {getTokenOverride(mode, "inlay-hint-bg") !== undefined && (
          <button
            type="button"
            class="theme-token-reset"
            onClick={() => void clearTokenColor(mode, "inlay-hint-bg")}
          >
            Reset
          </button>
        )}
      </div>

      <label class="theme-slider-row">
        <span>Transparency</span>
        <input
          type="range"
          min={0}
          max={100}
          value={simplePercent}
          onInput={(event) => onSimpleTransparency(Number((event.target as HTMLInputElement).value))}
        />
        <span class="theme-slider-value">{simplePercent}%</span>
      </label>

      <button type="button" class="theme-advanced-toggle" onClick={() => setAdvanced((v) => !v)}>
        {advanced ? "Hide advanced" : "Advanced"}
      </button>

      {advanced && (
        <div class="theme-inlay-advanced">
          <label class="theme-slider-row">
            <span>Background opacity</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(style.bgOpacity * 100)}
              onInput={(event) =>
                void setInlayHintStyle({ bgOpacity: Number((event.target as HTMLInputElement).value) / 100 })
              }
            />
            <span class="theme-slider-value">{Math.round(style.bgOpacity * 100)}%</span>
          </label>
          <label class="theme-slider-row">
            <span>Text opacity</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(style.textOpacity * 100)}
              onInput={(event) =>
                void setInlayHintStyle({ textOpacity: Number((event.target as HTMLInputElement).value) / 100 })
              }
            />
            <span class="theme-slider-value">{Math.round(style.textOpacity * 100)}%</span>
          </label>
          <label class="theme-text-row">
            <span>Padding</span>
            <input
              type="text"
              value={style.padding}
              onInput={(event) => void setInlayHintStyle({ padding: (event.target as HTMLInputElement).value })}
            />
          </label>
          <label class="theme-text-row">
            <span>Border radius</span>
            <input
              type="text"
              value={style.borderRadius}
              onInput={(event) => void setInlayHintStyle({ borderRadius: (event.target as HTMLInputElement).value })}
            />
          </label>
          <label class="theme-text-row">
            <span>Font family</span>
            <input
              type="text"
              value={style.fontFamily}
              onInput={(event) => void setInlayHintStyle({ fontFamily: (event.target as HTMLInputElement).value })}
            />
          </label>
          <label class="theme-text-row">
            <span>Font size</span>
            <input
              type="text"
              value={style.fontSize}
              onInput={(event) => void setInlayHintStyle({ fontSize: (event.target as HTMLInputElement).value })}
            />
          </label>
          <button type="button" class="theme-token-reset" onClick={() => void resetInlayHintStyle()}>
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}

export interface ThemeTabProps {
  client: CaosEngineClient;
  legend: SemanticTokensLegend;
}

export function ThemeTab({ client, legend }: ThemeTabProps) {
  const [editingMode, setEditingMode] = useState<ThemeMode>(() => effectiveMode.value);

  const syntaxKeys = TOKEN_KEYS.filter((t) => t.category === "syntax");
  const modifierKeys = TOKEN_KEYS.filter((t) => t.category === "modifier");

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

      <h3>Preview</h3>
      <p class="theme-token-hint">Tap a token to edit its color — updates live as you change colors below.</p>
      <PreviewPanel client={client} legend={legend} mode={editingMode} />

      <h3>Colors in use</h3>
      <PaletteSwatchList mode={editingMode} />

      <h3>Syntax colors</h3>
      <div class="theme-token-list">
        {syntaxKeys.map((def: TokenKeyDef) => {
          const overridden = getTokenOverride(editingMode, def.key) !== undefined;
          return (
            <div class="theme-token-row" data-token-key={def.key} key={def.key}>
              <TokenColorControl mode={editingMode} tokenKey={def.key} />
              <span class="theme-token-label">{def.label}</span>
              {overridden && (
                <button type="button" class="theme-token-reset" onClick={() => onReset(def.key)}>
                  Reset
                </button>
              )}
            </div>
          );
        })}
      </div>

      <h3>Modifiers</h3>
      <p class="theme-token-hint">Unchecked modifiers inherit their token type's color above.</p>
      <div class="theme-token-list">
        {modifierKeys.map((def) => {
          const explicit = getTokenOverride(editingMode, def.key) !== undefined;
          return (
            <div class="theme-token-row theme-token-row--modifier" data-token-key={def.key} key={def.key}>
              <label class="theme-token-modifier-checkbox">
                <input
                  type="checkbox"
                  checked={explicit}
                  onChange={(event) => onModifierToggle(def.key, (event.target as HTMLInputElement).checked)}
                />
                {" " + def.label}
              </label>
              {explicit && (
                <>
                  <TokenColorControl mode={editingMode} tokenKey={def.key} />
                  <button type="button" class="theme-token-reset" onClick={() => onReset(def.key)}>
                    Reset
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <InlayHintSettings mode={editingMode} />
    </div>
  );
}
