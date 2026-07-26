/**
 * Tabbed settings container per `../../plan-webapp/06-settings-panel-architecture.md`.
 * Reads `SETTINGS_TABS` directly rather than taking a `tabs` prop, so adding
 * a tab (Phase 07/08) never requires threading a new prop through
 * `main.ts`/`shell.tsx` -- registering into the array is enough.
 */
import { useState } from "preact/hooks";
import { SETTINGS_TABS } from "./tabs.js";

export function SettingsPanel() {
  const [activeId, setActiveId] = useState(() => SETTINGS_TABS[0]?.id ?? "");
  const active = SETTINGS_TABS.find((tab) => tab.id === activeId) ?? SETTINGS_TABS[0];

  return (
    <div class="settings-panel">
      {SETTINGS_TABS.length === 0 ? (
        <p>(no settings tabs registered)</p>
      ) : (
        <>
          <div class="segmented-control settings-tab-strip" role="tablist">
            {SETTINGS_TABS.map((tab) => (
              <button
                type="button"
                role="tab"
                key={tab.id}
                aria-selected={tab.id === active?.id}
                class={
                  tab.id === active?.id
                    ? "segmented-control-segment segmented-control-segment--active"
                    : "segmented-control-segment"
                }
                onClick={() => setActiveId(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div class="settings-tab-body">{active?.render()}</div>
        </>
      )}
    </div>
  );
}
