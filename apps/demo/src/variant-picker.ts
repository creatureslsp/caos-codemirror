// A <select> for GameVariant, used to drive apps/demo/src/main.ts's
// Compartment-based reconfiguration (plan/07-demo-app-and-verification.md's
// "Variant behavior" checklist section): switching variants should
// re-validate and change completion/hint results without recreating the
// whole EditorView.
import type { GameVariant } from "@creatures-codemirror/engine";
import { GAME_VARIANTS } from "@creatures-codemirror/engine";

export interface VariantPickerOptions {
  initialVariant: GameVariant;
  onChange: (variant: GameVariant) => void;
}

export function createVariantPicker(options: VariantPickerOptions): HTMLSelectElement {
  const { initialVariant, onChange } = options;

  const select = document.createElement("select");
  select.id = "variant-picker";
  select.setAttribute("aria-label", "CAOS game variant");

  for (const variant of GAME_VARIANTS) {
    const option = document.createElement("option");
    option.value = variant;
    option.textContent = variant;
    option.selected = variant === initialVariant;
    select.appendChild(option);
  }

  select.addEventListener("change", () => {
    onChange(select.value as GameVariant);
  });

  return select;
}
