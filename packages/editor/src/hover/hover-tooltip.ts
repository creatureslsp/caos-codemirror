// Wires @codemirror/view's mouse-driven hoverTooltip to showHoverAt.
import { hoverTooltip } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import type { CaosEngineClient, GameVariant } from "@creatures-codemirror/engine";
import type { ShowHoverAtOptions } from "./touch-hover.js";
import { showHoverAt } from "./touch-hover.js";

export interface CaosHoverTooltipOptions {
  client: CaosEngineClient;
  getVariant: () => GameVariant;
}

export function caosHoverTooltip(options: CaosHoverTooltipOptions): Extension {
  const showOptions: ShowHoverAtOptions = options;
  return hoverTooltip((view, pos) => showHoverAt(view, pos, showOptions), {
    hideOnChange: true,
  });
}
