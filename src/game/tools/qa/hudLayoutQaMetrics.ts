import { useEffect } from "react";
import { readAppViewportSize } from "../../systems/input/mobileLayoutRuntime";
import { shouldPublishCurrentHudLayoutQaMetrics } from "./appQaTelemetryRoutes";
import {
  HUD_LAYOUT_QA_DATASET_KEYS,
  HUD_LAYOUT_TARGETS,
  resolveHudLayoutQaMetrics,
  type HudLayoutQaOptions,
  type HudLayoutQaRect,
} from "./hudLayoutQaRuntime";

export type { HudLayoutQaOptions } from "./hudLayoutQaRuntime";

function isHudLayoutQaEnabled() {
  if (typeof window === "undefined" || typeof document === "undefined" || !import.meta.env.DEV) return false;
  return shouldPublishCurrentHudLayoutQaMetrics();
}

function clearHudLayoutQaDataset() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const key of HUD_LAYOUT_QA_DATASET_KEYS) {
    delete root.dataset[key];
  }
}

function getFrameRect(): HudLayoutQaRect {
  const frame = document.querySelector<HTMLElement>('[data-wof-app-frame="game"]');
  if (frame) return frame.getBoundingClientRect();

  const { width, height } = readAppViewportSize();
  return {
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
  };
}

function getVisibleRect(selector: string): HudLayoutQaRect | null {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return null;

  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  if (
    rect.width <= 0 ||
    rect.height <= 0 ||
    style.display === "none" ||
    style.visibility === "hidden" ||
    Number(style.opacity) === 0
  ) {
    return null;
  }

  return rect;
}

function publishHudLayoutQaMetrics(options: HudLayoutQaOptions, previousSignature: string) {
  const frame = getFrameRect();
  const root = document.documentElement;
  const measuredRects: Partial<Record<string, HudLayoutQaRect>> = {};
  const readyDatasets: Partial<Record<string, string | undefined>> = {};

  for (const target of HUD_LAYOUT_TARGETS) {
    const rect = getVisibleRect(target.selector);
    if (rect) {
      measuredRects[target.key] = rect;
    }
    if (target.readyDatasetKey) readyDatasets[target.readyDatasetKey] = root.dataset[target.readyDatasetKey];
  }

  const metrics = resolveHudLayoutQaMetrics({
    options,
    frame,
    measuredRects,
    readyDatasets,
    touchLayoutClass: root.classList.contains("wizards-touch-layout"),
    touchGameplayClass: root.classList.contains("wizards-touch-gameplay"),
  });
  const signature = metrics.signature;
  if (signature === previousSignature) return signature;

  root.dataset.wofHudQaEnabled = "1";
  root.dataset.wofHudQaExpected = metrics.expectedText;
  root.dataset.wofHudQaMeasured = metrics.measuredText;
  root.dataset.wofHudQaMissing = metrics.missingText;
  root.dataset.wofHudQaClipped = metrics.clippedText;
  root.dataset.wofHudQaOverlaps = metrics.overlapsText;
  root.dataset.wofHudQaFailCount = metrics.failureCountText;
  root.dataset.wofHudQaFailures = metrics.failuresText;
  root.dataset.wofHudQaRects = metrics.rectsText;
  root.dataset.wofHudQaFrame = metrics.frameText;
  root.dataset.wofHudQaTouchLayoutClass = metrics.touchLayoutText;
  root.dataset.wofHudQaTouchGameplayClass = metrics.touchGameplayText;
  return signature;
}

export function useHudLayoutQaMetrics(options: HudLayoutQaOptions) {
  const enabled = isHudLayoutQaEnabled();

  useEffect(() => {
    if (!enabled) {
      clearHudLayoutQaDataset();
      return;
    }

    let raf = 0;
    let qaUpdateTimeout = 0;
    let cancelled = false;
    let lastSignature = "";
    let publishCount = 0;
    let skippedPublishCount = 0;
    const update = () => {
      const nextSignature = publishHudLayoutQaMetrics(options, lastSignature);
      if (nextSignature === lastSignature) {
        skippedPublishCount += 1;
        if (skippedPublishCount === 1 || skippedPublishCount % 10 === 0) {
          document.documentElement.dataset.wofHudQaSkippedPublishCount = String(skippedPublishCount);
        }
        return;
      }
      lastSignature = nextSignature;
      publishCount += 1;
      document.documentElement.dataset.wofHudQaPublishCount = String(publishCount);
      document.documentElement.dataset.wofHudQaSkippedPublishCount = String(skippedPublishCount);
    };
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(update);
    };
    const scheduleNextQaUpdate = () => {
      qaUpdateTimeout = window.setTimeout(() => {
        if (cancelled) return;
        scheduleUpdate();
        scheduleNextQaUpdate();
      }, 350);
    };

    scheduleUpdate();
    scheduleNextQaUpdate();
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("orientationchange", scheduleUpdate);
    window.visualViewport?.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleUpdate);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      window.clearTimeout(qaUpdateTimeout);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
      window.visualViewport?.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleUpdate);
    };
  }, [
    enabled,
    options.compactMapVisible,
    options.engineMenuVisible,
    options.expandedMapVisible,
    options.gameplayHudVisible,
    options.inventoryVisible,
    options.magicHandsVisible,
    options.questDialogVisible,
    options.questNpcEditorVisible,
    options.scoreboardVisible,
    options.settingsPanelVisible,
    options.spellMenuVisible,
    options.touchControlsVisible,
  ]);

  useEffect(() => clearHudLayoutQaDataset, []);
}

export function HudLayoutQaMetricsProbe({ options }: { options: HudLayoutQaOptions }) {
  useHudLayoutQaMetrics(options);
  return null;
}
