/** Selector component for choosing a GameVariant. */
import type { GameVariant } from "@creatures-codemirror/engine";
import { GAME_VARIANTS } from "@creatures-codemirror/engine";

export interface VariantPickerProps {
  initialVariant: GameVariant;
  onChange: (variant: GameVariant) => void;
}

export function VariantPicker(props: VariantPickerProps) {
  const { initialVariant, onChange } = props;

  return (
    <label>
      Variant:{" "}
      <select
        id="variant-picker"
        aria-label="CAOS game variant"
        value={initialVariant}
        onChange={(event) => onChange((event.target as HTMLSelectElement).value as GameVariant)}
      >
        {GAME_VARIANTS.map((variant) => (
          <option key={variant} value={variant}>
            {variant}
          </option>
        ))}
      </select>
    </label>
  );
}
