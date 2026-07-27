import { describe, expect, it } from "vitest";
import { isLink, resolveTokenColor, wouldCreateCycle, type ThemeOverrides } from "./link-resolution.js";

function overrides(light: ThemeOverrides["light"] = {}): ThemeOverrides {
  return { light, dark: {} };
}

describe("isLink", () => {
  it("identifies link values", () => {
    expect(isLink({ linkedTo: "string" })).toBe(true);
  });

  it("identifies literal and undefined as non-links", () => {
    expect(isLink("#fff")).toBe(false);
    expect(isLink(undefined)).toBe(false);
  });
});

describe("resolveTokenColor", () => {
  it("returns a literal override directly", () => {
    const value = resolveTokenColor(overrides({ string: "#0a7d34" }), "light", "string", () => undefined);
    expect(value).toBe("#0a7d34");
  });

  it("falls back to the default when there is no override", () => {
    const value = resolveTokenColor(overrides(), "light", "string", (key) => (key === "string" ? "#default" : undefined));
    expect(value).toBe("#default");
  });

  it("follows a single link to a literal", () => {
    const value = resolveTokenColor(
      overrides({ "inlay-hint": { linkedTo: "string" }, string: "#0a7d34" }),
      "light",
      "inlay-hint",
      () => undefined,
    );
    expect(value).toBe("#0a7d34");
  });

  it("follows a multi-hop chain to a literal", () => {
    const value = resolveTokenColor(
      overrides({ a: { linkedTo: "b" }, b: { linkedTo: "c" }, c: "#123456" }),
      "light",
      "a",
      () => undefined,
    );
    expect(value).toBe("#123456");
  });

  it("resolves a link to an unset token using that token's own default, not the origin's", () => {
    const value = resolveTokenColor(
      overrides({ a: { linkedTo: "b" } }),
      "light",
      "a",
      (key) => (key === "b" ? "#b-default" : "#a-default"),
    );
    expect(value).toBe("#b-default");
  });

  it("falls back to the origin key's default if a cycle somehow made it into storage", () => {
    const value = resolveTokenColor(
      overrides({ a: { linkedTo: "b" }, b: { linkedTo: "a" } }),
      "light",
      "a",
      (key) => (key === "a" ? "#a-default" : undefined),
    );
    expect(value).toBe("#a-default");
  });
});

describe("wouldCreateCycle", () => {
  it("rejects a direct self-link", () => {
    expect(wouldCreateCycle(overrides(), "light", "a", "a")).toBe(true);
  });

  it("rejects a direct back-link", () => {
    const state = overrides({ b: { linkedTo: "a" } });
    expect(wouldCreateCycle(state, "light", "a", "b")).toBe(true);
  });

  it("rejects a longer chain that would loop back", () => {
    const state = overrides({ b: { linkedTo: "c" }, c: { linkedTo: "a" } });
    expect(wouldCreateCycle(state, "light", "a", "b")).toBe(true);
  });

  it("allows a link that does not loop back", () => {
    const state = overrides({ b: "#fff", c: { linkedTo: "b" } });
    expect(wouldCreateCycle(state, "light", "a", "c")).toBe(false);
  });

  it("allows linking into an independent existing chain", () => {
    const state = overrides({ x: { linkedTo: "y" }, y: "#000" });
    expect(wouldCreateCycle(state, "light", "z", "x")).toBe(false);
  });
});
