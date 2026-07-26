/**
 * Settings-tab extension point: `SettingsPanel` renders whatever is in
 * `SETTINGS_TABS` and never grows a per-feature switch statement. `main.ts`
 * pushes the Inlay Hints tab once its runtime state (client/view closures)
 * exists; Phase 07/08's theming tabs push their own entries the same way.
 */
import type { ComponentChildren } from "preact";

export interface SettingsTab {
  id: string;
  label: string;
  render: () => ComponentChildren;
}

export const SETTINGS_TABS: SettingsTab[] = [];
