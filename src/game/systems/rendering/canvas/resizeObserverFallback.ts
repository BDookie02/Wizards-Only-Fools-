import { isCurrentQaTelemetryRouteEnabled } from "../../../tools/qa/qaRouteTelemetry";

type ResizeObserverFallbackTarget = Element;

let resizeObserverDeliveryCount = 0;
let resizeObserverSkippedDeliveryCount = 0;

function shouldPublishResizeObserverTelemetry() {
  return isCurrentQaTelemetryRouteEnabled(["perf", "hud", "aspect", "canvas", "touch", "spellDummies", "mountain", "survival"]);
}

function makeBoxSize(rect: DOMRectReadOnly): ResizeObserverSize[] {
  return [{ inlineSize: rect.width, blockSize: rect.height }];
}

function writeResizeObserverQaRect(prefix: string, rect: DOMRectReadOnly) {
  if (!shouldPublishResizeObserverTelemetry()) return;
  document.documentElement.dataset[prefix] = [
    Math.round(rect.width),
    Math.round(rect.height),
    Math.round(rect.left),
    Math.round(rect.top),
  ].join("x");
}

function makeResizeObserverEntry(target: ResizeObserverFallbackTarget, rect = target.getBoundingClientRect()): ResizeObserverEntry {
  return {
    target,
    contentRect: rect,
    borderBoxSize: makeBoxSize(rect),
    contentBoxSize: makeBoxSize(rect),
    devicePixelContentBoxSize: makeBoxSize(rect),
  } as ResizeObserverEntry;
}

export class ImmediateResizeObserver implements ResizeObserver {
  private readonly callback: ResizeObserverCallback;
  private readonly targets = new Set<ResizeObserverFallbackTarget>();
  private readonly lastDeliveredRects = new Map<ResizeObserverFallbackTarget, string>();
  private raf = 0;
  private timeout = 0;
  private pollTimeout = 0;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: ResizeObserverFallbackTarget) {
    this.targets.add(target);
    writeResizeObserverQaRect("wofResizeObserverLastObservedRect", target.getBoundingClientRect());
    if (shouldPublishResizeObserverTelemetry()) {
      document.documentElement.dataset.wofResizeObserverObservedTargets = String(this.targets.size);
    }
    if (!this.pollTimeout && typeof window !== "undefined") {
      this.scheduleFallbackPoll();
      window.addEventListener("resize", this.schedule);
      window.addEventListener("orientationchange", this.schedule);
    }
    this.schedule();
  }

  unobserve(target: ResizeObserverFallbackTarget) {
    this.targets.delete(target);
    this.lastDeliveredRects.delete(target);
    if (this.targets.size === 0) this.stop();
  }

  disconnect() {
    this.targets.clear();
    this.lastDeliveredRects.clear();
    this.stop();
  }

  private readonly schedule = () => {
    if (this.raf || typeof window === "undefined") return;
    this.raf = window.requestAnimationFrame(() => {
      if (this.timeout) window.clearTimeout(this.timeout);
      this.timeout = 0;
      this.raf = 0;
      this.deliver();
    });
    this.timeout = window.setTimeout(() => {
      if (this.raf) window.cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.timeout = 0;
      this.deliver();
    }, 32);
  };

  private readonly scheduleFallbackPoll = () => {
    if (typeof window === "undefined" || this.targets.size === 0) return;
    this.schedule();
    this.pollTimeout = window.setTimeout(this.scheduleFallbackPoll, 250);
  };

  private deliver() {
    if (this.targets.size === 0) return;
    const entries: ResizeObserverEntry[] = [];
    for (const target of this.targets) {
      const rect = target.getBoundingClientRect();
      const rectKey = [
        Math.round(rect.width),
        Math.round(rect.height),
        Math.round(rect.left),
        Math.round(rect.top),
        typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
      ].join("x");
      if (this.lastDeliveredRects.get(target) === rectKey) continue;
      this.lastDeliveredRects.set(target, rectKey);
      entries.push(makeResizeObserverEntry(target, rect));
    }

    if (entries.length === 0) {
      if (shouldPublishResizeObserverTelemetry()) {
        resizeObserverSkippedDeliveryCount += 1;
        document.documentElement.dataset.wofResizeObserverSkippedDeliveries = String(resizeObserverSkippedDeliveryCount);
      }
      return;
    }

    if (shouldPublishResizeObserverTelemetry()) {
      resizeObserverDeliveryCount += 1;
      document.documentElement.dataset.wofResizeObserverDeliveries = String(resizeObserverDeliveryCount);
      const firstEntry = entries[0];
      if (firstEntry) writeResizeObserverQaRect("wofResizeObserverLastDeliveredRect", firstEntry.contentRect);
    }
    this.callback(entries, this);
  }

  private stop() {
    if (typeof window === "undefined") return;
    if (this.raf) window.cancelAnimationFrame(this.raf);
    if (this.timeout) window.clearTimeout(this.timeout);
    if (this.pollTimeout) window.clearTimeout(this.pollTimeout);
    this.raf = 0;
    this.timeout = 0;
    this.pollTimeout = 0;
    window.removeEventListener("resize", this.schedule);
    window.removeEventListener("orientationchange", this.schedule);
  }
}

type ResizeObserverFallbackOptions = {
  force?: boolean;
};

export function installResizeObserverFallback({ force = false }: ResizeObserverFallbackOptions = {}) {
  if (typeof window === "undefined") return;
  if (!force && typeof window.ResizeObserver !== "undefined") {
    if (shouldPublishResizeObserverTelemetry()) {
      document.documentElement.dataset.wofResizeObserverStatus = "native";
    }
    return;
  }

  window.ResizeObserver = ImmediateResizeObserver;
  if (shouldPublishResizeObserverTelemetry()) {
    document.documentElement.dataset.wofResizeObserverFallback = "1";
    document.documentElement.dataset.wofResizeObserverStatus = force ? "forced-fallback" : "fallback";
  }
}
