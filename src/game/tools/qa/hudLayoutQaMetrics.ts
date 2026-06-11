import { useEffect } from "react";
import { readAppViewportSize } from "../../systems/input/mobileLayoutRuntime";
import { isCurrentQaTelemetryRouteEnabled } from "./qaRouteTelemetry";

export type HudLayoutQaOptions = {
  gameplayHudVisible: boolean;
  magicHandsVisible: boolean;
  touchControlsVisible: boolean;
  compactMapVisible: boolean;
  expandedMapVisible: boolean;
  spellMenuVisible: boolean;
  settingsPanelVisible: boolean;
  engineMenuVisible: boolean;
  inventoryVisible: boolean;
  questNpcEditorVisible: boolean;
  questDialogVisible: boolean;
  scoreboardVisible: boolean;
};

type HudLayoutTarget = {
  key: string;
  selector: string;
  optionKey: keyof HudLayoutQaOptions;
  allowedFrameBleed?: number;
  readyDatasetKey?: string;
};

const QA_DATASET_KEYS = [
  "wofHudQaEnabled",
  "wofHudQaExpected",
  "wofHudQaMeasured",
  "wofHudQaMissing",
  "wofHudQaClipped",
  "wofHudQaOverlaps",
  "wofHudQaFailCount",
  "wofHudQaFailures",
  "wofHudQaRects",
  "wofHudQaFrame",
  "wofHudQaTouchLayoutClass",
  "wofHudQaTouchGameplayClass",
  "wofHudQaPublishCount",
  "wofHudQaSkippedPublishCount",
] as const;

const OVERLAP_PAIRS: Array<[string, string]> = [
  ["minimap-compact", "gameplay-hud"],
  ["minimap-compact", "mana-meter"],
];

const HUD_LAYOUT_TARGETS: readonly HudLayoutTarget[] = [
  { key: "gameplay-hud", selector: '[data-wof-hud-qa="gameplay-hud"]', optionKey: "gameplayHudVisible" },
  { key: "status-bar", selector: '[data-wof-hud-qa="status-bar"]', optionKey: "gameplayHudVisible" },
  { key: "mana-meter", selector: '[data-wof-hud-qa="mana-meter"]', optionKey: "gameplayHudVisible" },
  { key: "magic-hands", selector: '[data-wof-hud-qa="magic-hands"]', optionKey: "magicHandsVisible", allowedFrameBleed: 24 },
  { key: "left-hand", selector: '[data-wof-hud-qa="magic-hand-left"]', optionKey: "magicHandsVisible", allowedFrameBleed: 220 },
  { key: "right-hand", selector: '[data-wof-hud-qa="magic-hand-right"]', optionKey: "magicHandsVisible", allowedFrameBleed: 220 },
  { key: "mobile-touch-controls", selector: '[data-wof-hud-qa="mobile-touch-controls"]', optionKey: "touchControlsVisible" },
  { key: "minimap-compact", selector: '[data-wof-hud-qa="minimap-compact"]', optionKey: "compactMapVisible", readyDatasetKey: "wofMiniMapMounted" },
  { key: "map-expanded", selector: '[data-wof-hud-qa="map-expanded"]', optionKey: "expandedMapVisible", readyDatasetKey: "wofMiniMapMounted" },
  { key: "spell-menu", selector: '[data-wof-hud-qa="spell-menu"]', optionKey: "spellMenuVisible" },
  { key: "settings-panel", selector: '[data-wof-hud-qa="settings-panel"]', optionKey: "settingsPanelVisible" },
  { key: "engine-menu", selector: '[data-wof-hud-qa="engine-menu"]', optionKey: "engineMenuVisible" },
  { key: "inventory-panel", selector: '[data-wof-hud-qa="inventory-panel"]', optionKey: "inventoryVisible" },
  { key: "quest-npc-editor", selector: '[data-testid="quest-npc-editor"]', optionKey: "questNpcEditorVisible" },
  { key: "quest-dialog-panel", selector: '[data-wof-hud-qa="quest-dialog-panel"]', optionKey: "questDialogVisible" },
  { key: "scoreboard-menu", selector: '[data-wof-hud-qa="scoreboard-menu"]', optionKey: "scoreboardVisible" },
];

function isHudLayoutQaEnabled() {
  if (typeof window === "undefined" || typeof document === "undefined" || !import.meta.env.DEV) return false;
  return isCurrentQaTelemetryRouteEnabled(["hud", "aspect"]);
}

function clearHudLayoutQaDataset() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const key of QA_DATASET_KEYS) {
    delete root.dataset[key];
  }
}

function getFrameRect() {
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

function getVisibleRect(selector: string) {
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

function frameBleed(rect: DOMRect, frame: ReturnType<typeof getFrameRect>) {
  return Math.max(
    0,
    frame.left - rect.left,
    frame.top - rect.top,
    rect.right - frame.right,
    rect.bottom - frame.bottom,
  );
}

function rectOverlap(a: DOMRect, b: DOMRect) {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  if (width <= 0 || height <= 0) return 0;
  return Math.round(width * height);
}

function formatRect(key: string, rect: DOMRect, frame: ReturnType<typeof getFrameRect>) {
  return [
    key,
    Math.round(rect.left - frame.left),
    Math.round(rect.top - frame.top),
    Math.round(rect.width),
    Math.round(rect.height),
  ].join(":");
}

function publishHudLayoutQaMetrics(options: HudLayoutQaOptions, previousSignature: string) {
  const frame = getFrameRect();
  const root = document.documentElement;
  const expectedKeys: string[] = [];
  const measuredKeys: string[] = [];
  const measuredRects: Record<string, DOMRect | undefined> = {};
  const rectParts: string[] = [];
  const missing: string[] = [];
  const clipped: string[] = [];
  const failures: string[] = [];

  for (const target of HUD_LAYOUT_TARGETS) {
    const rect = getVisibleRect(target.selector);
    if (rect) {
      measuredRects[target.key] = rect;
      measuredKeys.push(target.key);
      rectParts.push(formatRect(target.key, rect, frame));
    }

    if (!options[target.optionKey]) continue;
    if (target.readyDatasetKey && root.dataset[target.readyDatasetKey] !== "1") continue;
    expectedKeys.push(target.key);

    if (!rect) {
      missing.push(target.key);
      failures.push(`missing:${target.key}`);
      continue;
    }

    const bleed = frameBleed(rect, frame);
    if (bleed > (target.allowedFrameBleed ?? 4)) {
      const clippedKey = `${target.key}:${Math.round(bleed)}`;
      clipped.push(clippedKey);
      failures.push(`clipped:${clippedKey}`);
    }
  }

  const overlaps: string[] = [];
  for (const [leftKey, rightKey] of OVERLAP_PAIRS) {
    const left = measuredRects[leftKey];
    const right = measuredRects[rightKey];
    if (!left || !right) continue;
    const area = rectOverlap(left, right);
    if (area <= 36) continue;
    const overlapKey = `${leftKey}+${rightKey}:${area}`;
    overlaps.push(overlapKey);
    failures.push(`overlap:${overlapKey}`);
  }

  const expectedText = expectedKeys.join(",") || "none";
  const measuredText = measuredKeys.join(",") || "none";
  const missingText = missing.join(",") || "none";
  const clippedText = clipped.join(",") || "none";
  const overlapsText = overlaps.join(",") || "none";
  const failureCountText = String(failures.length);
  const failuresText = failures.join("|") || "none";
  const rectsText = rectParts.join("|") || "none";
  const frameText = [
    Math.round(frame.left),
    Math.round(frame.top),
    Math.round(frame.width),
    Math.round(frame.height),
  ].join("x");
  const touchLayoutText = root.classList.contains("wizards-touch-layout") ? "1" : "0";
  const touchGameplayText = root.classList.contains("wizards-touch-gameplay") ? "1" : "0";
  const signature = [
    expectedText,
    measuredText,
    missingText,
    clippedText,
    overlapsText,
    failureCountText,
    failuresText,
    rectsText,
    frameText,
    touchLayoutText,
    touchGameplayText,
  ].join("\n");
  if (signature === previousSignature) return signature;

  root.dataset.wofHudQaEnabled = "1";
  root.dataset.wofHudQaExpected = expectedText;
  root.dataset.wofHudQaMeasured = measuredText;
  root.dataset.wofHudQaMissing = missingText;
  root.dataset.wofHudQaClipped = clippedText;
  root.dataset.wofHudQaOverlaps = overlapsText;
  root.dataset.wofHudQaFailCount = failureCountText;
  root.dataset.wofHudQaFailures = failuresText;
  root.dataset.wofHudQaRects = rectsText;
  root.dataset.wofHudQaFrame = frameText;
  root.dataset.wofHudQaTouchLayoutClass = touchLayoutText;
  root.dataset.wofHudQaTouchGameplayClass = touchGameplayText;
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
