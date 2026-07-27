/**
 * Light<->dark companion-color auto-suggestion, per
 * `../../../plan-webapp/07-theming-data-model-dark-light.md` and the
 * algorithm fixed in `00-risks-and-open-questions.md`'s "Open product
 * decisions" section: convert to HSL, invert lightness, clamp into the
 * *target* mode's readability band, preserve hue/saturation. A heuristic,
 * not a contrast-guaranteed (APCA/WCAG) algorithm -- acceptable per
 * `WEBAPP.md`'s own "similar... would look good" framing.
 */

export type ThemeMode = "light" | "dark";

const LIGHT_BAND: [number, number] = [0.25, 0.45];
const DARK_BAND: [number, number] = [0.65, 0.85];

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Parses `#rgb`, `#rrggbb`, or `rgba(r, g, b, a)` / `rgb(r, g, b)`. */
export function parseColor(input: string): Rgba | null {
  const hex = input.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    }
    const num = parseInt(h, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255, a: 1 };
  }
  const rgb = input.trim().match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
      a: rgb[4] !== undefined ? Number(rgb[4]) : 1,
    };
  }
  return null;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case rn:
      h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
      break;
    case gn:
      h = ((bn - rn) / d + 2) / 6;
      break;
    default:
      h = ((rn - gn) / d + 4) / 6;
  }
  return { h, s, l };
}

function hueToRgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, h) * 255),
    b: Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  };
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, "0");
}

function formatColor(rgb: { r: number; g: number; b: number }, a: number): string {
  if (a >= 1) {
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

/**
 * Computes a companion color for `targetMode`, given a color the user just
 * set in the *other* mode. Returns `null` if `sourceColor` isn't a
 * recognized format (caller should leave the target mode untouched).
 */
export function computeCompanionColor(sourceColor: string, targetMode: ThemeMode): string | null {
  const rgba = parseColor(sourceColor);
  if (!rgba) return null;

  const { h, s, l } = rgbToHsl(rgba.r, rgba.g, rgba.b);
  const inverted = 1 - l;
  const [min, max] = targetMode === "light" ? LIGHT_BAND : DARK_BAND;
  const clampedL = clamp(inverted, min, max);
  const rgb = hslToRgb(h, s, clampedL);
  return formatColor(rgb, rgba.a);
}
