import { describe, expect, it } from "vitest";
import { computeCompanionColor, parseColor } from "./companion-color.js";

describe("parseColor", () => {
  it("parses 6-digit hex", () => {
    expect(parseColor("#0550ae")).toEqual({ r: 5, g: 80, b: 174, a: 1 });
  });

  it("parses 3-digit hex", () => {
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });

  it("parses rgba() with alpha", () => {
    expect(parseColor("rgba(110, 119, 129, 0.12)")).toEqual({ r: 110, g: 119, b: 129, a: 0.12 });
  });

  it("returns null for unrecognized input", () => {
    expect(parseColor("not-a-color")).toBeNull();
  });
});

describe("computeCompanionColor", () => {
  it("produces a dark-band companion for a dark hex color from a light source", () => {
    // #cf222e (light-mode keyword red) is fairly dark -- inverted lightness
    // should land in the dark band (65-85%), i.e. a lighter companion.
    const companion = computeCompanionColor("#cf222e", "dark");
    expect(companion).not.toBeNull();
    const parsed = parseColor(companion!);
    expect(parsed).not.toBeNull();
    // Lighter overall than the source.
    const sum = (c: { r: number; g: number; b: number }) => c.r + c.g + c.b;
    expect(sum(parsed!)).toBeGreaterThan(sum(parseColor("#cf222e")!));
  });

  it("produces a light-band companion for a light dark-mode color", () => {
    const companion = computeCompanionColor("#ff7b72", "light");
    expect(companion).not.toBeNull();
    const sum = (c: { r: number; g: number; b: number }) => c.r + c.g + c.b;
    expect(sum(parseColor(companion!)!)).toBeLessThan(sum(parseColor("#ff7b72")!));
  });

  it("preserves alpha and returns rgba() when source had alpha < 1", () => {
    const companion = computeCompanionColor("rgba(110, 119, 129, 0.12)", "dark");
    expect(companion).toMatch(/^rgba\(/);
    expect(parseColor(companion!)!.a).toBe(0.12);
  });

  it("returns null for an unparseable source color", () => {
    expect(computeCompanionColor("var(--something)", "dark")).toBeNull();
  });
});
