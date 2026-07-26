// Device/network-aware timing for when to construct CaosEngineClient.
interface NetworkInformationLike {
  /** "slow-2g" | "2g" | "3g" | "4g", per the spec — typed as a bare string
   * since the underlying browser API itself doesn't expose a narrower
   * union and new values have been added to the spec before. */
  effectiveType?: string;
}

interface NavigatorWithDeviceSignals extends Navigator {
  connection?: NetworkInformationLike;
  deviceMemory?: number;
}

export interface DeviceSignals {
  effectiveType?: string;
  deviceMemoryGb?: number;
  hardwareConcurrency?: number;
}

/** Reads whatever of navigator.connection/.deviceMemory/.hardwareConcurrency
 * the current browser actually exposes. */
export function readDeviceSignals(): DeviceSignals {
  if (typeof navigator === "undefined") return {};
  const nav = navigator as NavigatorWithDeviceSignals;
  return {
    effectiveType: nav.connection?.effectiveType,
    deviceMemoryGb: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
  };
}

export type EngineLoadTiming = "immediate" | "idle" | "first-interaction";

const SLOW_EFFECTIVE_TYPES = new Set(["slow-2g", "2g", "3g"]);
const LOW_MEMORY_GB_THRESHOLD = 2;
const LOW_CORE_COUNT_THRESHOLD = 4;

/**
 * Picks a load timing from device/network signals.
 */
export function chooseEngineLoadTiming(signals: DeviceSignals = readDeviceSignals()): EngineLoadTiming {
  if (signals.effectiveType != null && SLOW_EFFECTIVE_TYPES.has(signals.effectiveType)) {
    return "first-interaction";
  }
  const lowMemory = signals.deviceMemoryGb != null && signals.deviceMemoryGb <= LOW_MEMORY_GB_THRESHOLD;
  const lowCores =
    signals.hardwareConcurrency != null && signals.hardwareConcurrency <= LOW_CORE_COUNT_THRESHOLD;
  if (lowMemory || lowCores) {
    return "idle";
  }
  return "immediate";
}

export interface ScheduleEngineLoadOptions {
  /** @default chooseEngineLoadTiming() */
  timing?: EngineLoadTiming;
  /** Only used when timing is "first-interaction": the element(s) whose
   * first pointerdown/keydown/focus should trigger construction.
   * @default window */
  interactionTarget?: EventTarget;
  /** Only used when timing is "idle": requestIdleCallback's timeout, so a
   * genuinely idle-starved page still constructs the client eventually
   * rather than waiting forever. @default 2000 */
  idleTimeoutMs?: number;
}

type IdleCallbackHandle = number;
interface IdleRequestOptions {
  timeout?: number;
}
interface WindowWithIdleCallback {
  requestIdleCallback?: (callback: () => void, options?: IdleRequestOptions) => IdleCallbackHandle;
}

function runWhenIdle(callback: () => void, timeoutMs: number): void {
  const w = typeof window !== "undefined" ? (window as unknown as WindowWithIdleCallback) : undefined;
  if (w?.requestIdleCallback) {
    w.requestIdleCallback(callback, { timeout: timeoutMs });
  } else {
    // Safari has never shipped requestIdleCallback — falling back to a
    // macrotask still yields to any pending render/input work first,
    // which is the property that actually matters here.
    setTimeout(callback, 0);
  }
}

const INTERACTION_EVENTS = ["pointerdown", "keydown", "focusin"] as const;

function runOnFirstInteraction(target: EventTarget, callback: () => void): void {
  const options: AddEventListenerOptions = { once: true, passive: true };
  const cleanup = (): void => {
    for (const type of INTERACTION_EVENTS) target.removeEventListener(type, onInteract, options);
  };
  function onInteract(): void {
    cleanup();
    callback();
  }
  for (const type of INTERACTION_EVENTS) target.addEventListener(type, onInteract, options);
}

/**
 * Defers calling `create` (typically `() => new CaosEngineClient(...)`)
 * according to the chosen timing. Returns a Promise so callers don't need
 * to branch on timing themselves — `scheduleEngineLoad(() => new
 * CaosEngineClient()).then(client => client.init())` works regardless of
 * which strategy was picked.
 */
export function scheduleEngineLoad<T>(create: () => T, options: ScheduleEngineLoadOptions = {}): Promise<T> {
  const timing = options.timing ?? chooseEngineLoadTiming();
  switch (timing) {
    case "immediate":
      return Promise.resolve(create());
    case "idle":
      return new Promise((resolve) => runWhenIdle(() => resolve(create()), options.idleTimeoutMs ?? 2000));
    case "first-interaction": {
      const target = options.interactionTarget ?? (typeof window !== "undefined" ? window : undefined);
      if (!target) return Promise.resolve(create());
      return new Promise((resolve) => runOnFirstInteraction(target, () => resolve(create())));
    }
  }
}
