/**
 * Reusable per-token color control, per
 * `../../../plan-webapp/08-color-linking-inlay-hint-style.md`: a plain color
 * picker that can be switched to "link to another token" and back. Used by
 * `ThemeTab.tsx` for syntax-color rows, modifier rows, and the Inlay Hints
 * section's text/background rows -- any place a `TOKEN_KEYS` entry gets a
 * color control.
 */
import { useState } from "preact/hooks";
import { toHexColor } from "../theming/companion-color.js";
import { wouldCreateCycle } from "../theming/link-resolution.js";
import {
  DEFAULT_OVERRIDE_COLOR,
  getResolvedTokenColor,
  getTokenLinkTarget,
  isTokenLinked,
  setTokenColor,
  setTokenLink,
  themeOverrides,
  unlinkTokenColor,
  type ThemeMode,
} from "../theming/theme-store.js";
import { TOKEN_KEYS, findTokenKey } from "../theming/token-keys.js";

export function TokenColorControl({ mode, tokenKey }: { mode: ThemeMode; tokenKey: string }) {
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const linked = isTokenLinked(mode, tokenKey);
  const resolved = getResolvedTokenColor(mode, tokenKey) ?? DEFAULT_OVERRIDE_COLOR;
  const overrides = themeOverrides.value;
  const linkCandidates = TOKEN_KEYS.filter(
    (t) => t.key !== tokenKey && !wouldCreateCycle(overrides, mode, tokenKey, t.key),
  );

  async function onPickLink(target: string): Promise<void> {
    try {
      await setTokenLink(mode, tokenKey, target);
      setLinking(false);
      setLinkError(null);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : String(err));
    }
  }

  if (linking) {
    return (
      <span class="theme-link-picker">
        <select
          class="theme-link-select"
          onChange={(event) => {
            const target = (event.target as HTMLSelectElement).value;
            if (target) void onPickLink(target);
          }}
        >
          <option value="">Link to…</option>
          {linkCandidates.map((t) => (
            <option value={t.key} key={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          class="theme-token-reset"
          onClick={() => {
            setLinking(false);
            setLinkError(null);
          }}
        >
          Cancel
        </button>
        {linkError && <span class="theme-link-error">{linkError}</span>}
      </span>
    );
  }

  if (linked) {
    const targetKey = getTokenLinkTarget(mode, tokenKey);
    const targetLabel = (targetKey && findTokenKey(targetKey)?.label) ?? targetKey ?? "?";
    return (
      <span class="theme-token-linked">
        <span class="theme-swatch" style={{ backgroundColor: resolved }} />
        <span class="theme-token-linked-label">Linked to {targetLabel}</span>
        <button type="button" class="theme-token-reset" onClick={() => void unlinkTokenColor(mode, tokenKey)}>
          Unlink
        </button>
      </span>
    );
  }

  return (
    <span class="theme-color-picker">
      <input
        type="color"
        value={toHexColor(resolved) ?? DEFAULT_OVERRIDE_COLOR}
        onInput={(event) => void setTokenColor(mode, tokenKey, (event.target as HTMLInputElement).value)}
      />
      {linkCandidates.length > 0 && (
        <button type="button" class="theme-token-link-toggle" onClick={() => setLinking(true)}>
          Link…
        </button>
      )}
    </span>
  );
}
