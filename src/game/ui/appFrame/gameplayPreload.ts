type IdleSchedulerWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export type GameplayPreloadScheduleOptions = {
  mobilePerformanceMode?: boolean;
};

const DESKTOP_IDLE_TIMEOUT_MS = 1200;
const DESKTOP_FALLBACK_DELAY_MS = 650;
const MOBILE_IDLE_TIMEOUT_MS = 2400;
const MOBILE_FALLBACK_DELAY_MS = 1600;

export function scheduleGameplayPreload(callback: () => void, options: GameplayPreloadScheduleOptions = {}) {
  if (typeof window === "undefined") return () => {};

  const idleTimeoutMs = options.mobilePerformanceMode ? MOBILE_IDLE_TIMEOUT_MS : DESKTOP_IDLE_TIMEOUT_MS;
  const fallbackDelayMs = options.mobilePerformanceMode ? MOBILE_FALLBACK_DELAY_MS : DESKTOP_FALLBACK_DELAY_MS;
  const idleWindow = window as IdleSchedulerWindow;
  if (typeof idleWindow.requestIdleCallback === "function") {
    const handle = idleWindow.requestIdleCallback(callback, { timeout: idleTimeoutMs });
    return () => idleWindow.cancelIdleCallback?.(handle);
  }

  const timer = window.setTimeout(callback, fallbackDelayMs);
  return () => window.clearTimeout(timer);
}
