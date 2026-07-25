import { describe, expect, it, vi } from "vitest";
import { chooseEngineLoadTiming, scheduleEngineLoad } from "./bundle-strategy.js";
import type { DeviceSignals } from "./bundle-strategy.js";

describe("chooseEngineLoadTiming", () => {
  it("defers to first-interaction on a measurably slow connection", () => {
    expect(chooseEngineLoadTiming({ effectiveType: "2g" })).toBe("first-interaction");
  });

  it("prioritizes slow-connection over otherwise-capable hardware", () => {
    const signals: DeviceSignals = { effectiveType: "slow-2g", deviceMemoryGb: 8, hardwareConcurrency: 8 };
    expect(chooseEngineLoadTiming(signals)).toBe("first-interaction");
  });

  it("defers to idle on low device memory", () => {
    expect(chooseEngineLoadTiming({ deviceMemoryGb: 1 })).toBe("idle");
  });

  it("defers to idle on a low core count", () => {
    expect(chooseEngineLoadTiming({ hardwareConcurrency: 2 })).toBe("idle");
  });

  it("loads immediately when no signals are available at all", () => {
    expect(chooseEngineLoadTiming({})).toBe("immediate");
  });

  it("loads immediately on a fast connection with capable hardware", () => {
    const signals: DeviceSignals = { effectiveType: "4g", deviceMemoryGb: 8, hardwareConcurrency: 8 };
    expect(chooseEngineLoadTiming(signals)).toBe("immediate");
  });
});

describe("scheduleEngineLoad", () => {
  it("calls create synchronously under immediate timing", async () => {
    const create = vi.fn(() => "client");
    const result = await scheduleEngineLoad(create, { timing: "immediate" });
    expect(result).toBe("client");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("defers create until the idle/setTimeout fallback fires under idle timing", async () => {
    const create = vi.fn(() => "client");
    const promise = scheduleEngineLoad(create, { timing: "idle" });
    expect(create).not.toHaveBeenCalled();
    await expect(promise).resolves.toBe("client");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("defers create until the interaction target fires a trigger event under first-interaction timing", async () => {
    const target = new EventTarget();
    const create = vi.fn(() => "client");
    const promise = scheduleEngineLoad(create, { timing: "first-interaction", interactionTarget: target });
    expect(create).not.toHaveBeenCalled();
    target.dispatchEvent(new Event("pointerdown"));
    await expect(promise).resolves.toBe("client");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("ignores events outside the trigger set under first-interaction timing", async () => {
    const target = new EventTarget();
    const create = vi.fn(() => "client");
    const promise = scheduleEngineLoad(create, { timing: "first-interaction", interactionTarget: target });
    target.dispatchEvent(new Event("mouseover")); // not a trigger event — should have no effect
    target.dispatchEvent(new Event("keydown")); // is a trigger event
    await expect(promise).resolves.toBe("client");
    expect(create).toHaveBeenCalledTimes(1);
  });
});
