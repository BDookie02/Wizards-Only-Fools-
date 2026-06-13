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

export type HudLayoutQaRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type HudLayoutTarget = {
  key: string;
  selector: string;
  optionKey: keyof HudLayoutQaOptions;
  allowedFrameBleed?: number;
  readyDatasetKey?: string;
};

export type HudLayoutQaMetricsInput = {
  options: HudLayoutQaOptions;
  frame: HudLayoutQaRect;
  measuredRects: Partial<Record<string, HudLayoutQaRect>>;
  readyDatasets?: Partial<Record<string, string | undefined>>;
  touchLayoutClass: boolean;
  touchGameplayClass: boolean;
};

export type HudLayoutQaMetricsResult = {
  expectedText: string;
  measuredText: string;
  missingText: string;
  clippedText: string;
  overlapsText: string;
  failureCountText: string;
  failuresText: string;
  rectsText: string;
  frameText: string;
  touchLayoutText: string;
  touchGameplayText: string;
  signature: string;
};

export const HUD_LAYOUT_QA_DATASET_KEYS = [
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

export const HUD_LAYOUT_OVERLAP_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["minimap-compact", "gameplay-hud"],
  ["minimap-compact", "mana-meter"],
];

export const HUD_LAYOUT_TARGETS: readonly HudLayoutTarget[] = [
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

function getFrameBleed(rect: HudLayoutQaRect, frame: HudLayoutQaRect) {
  return Math.max(
    0,
    frame.left - rect.left,
    frame.top - rect.top,
    rect.right - frame.right,
    rect.bottom - frame.bottom,
  );
}

function getRectOverlapArea(a: HudLayoutQaRect, b: HudLayoutQaRect) {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  if (width <= 0 || height <= 0) return 0;
  return Math.round(width * height);
}

function formatHudLayoutQaRect(key: string, rect: HudLayoutQaRect, frame: HudLayoutQaRect) {
  return [
    key,
    Math.round(rect.left - frame.left),
    Math.round(rect.top - frame.top),
    Math.round(rect.width),
    Math.round(rect.height),
  ].join(":");
}

export function resolveHudLayoutQaMetrics({
  options,
  frame,
  measuredRects,
  readyDatasets = {},
  touchLayoutClass,
  touchGameplayClass,
}: HudLayoutQaMetricsInput): HudLayoutQaMetricsResult {
  const expectedKeys: string[] = [];
  const measuredKeys: string[] = [];
  const rectParts: string[] = [];
  const missing: string[] = [];
  const clipped: string[] = [];
  const failures: string[] = [];

  for (const target of HUD_LAYOUT_TARGETS) {
    const rect = measuredRects[target.key];
    if (rect) {
      measuredKeys.push(target.key);
      rectParts.push(formatHudLayoutQaRect(target.key, rect, frame));
    }

    if (!options[target.optionKey]) continue;
    if (target.readyDatasetKey && readyDatasets[target.readyDatasetKey] !== "1") continue;
    expectedKeys.push(target.key);

    if (!rect) {
      missing.push(target.key);
      failures.push(`missing:${target.key}`);
      continue;
    }

    const bleed = getFrameBleed(rect, frame);
    if (bleed > (target.allowedFrameBleed ?? 4)) {
      const clippedKey = `${target.key}:${Math.round(bleed)}`;
      clipped.push(clippedKey);
      failures.push(`clipped:${clippedKey}`);
    }
  }

  const overlaps: string[] = [];
  for (const [leftKey, rightKey] of HUD_LAYOUT_OVERLAP_PAIRS) {
    const left = measuredRects[leftKey];
    const right = measuredRects[rightKey];
    if (!left || !right) continue;
    const area = getRectOverlapArea(left, right);
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
  const touchLayoutText = touchLayoutClass ? "1" : "0";
  const touchGameplayText = touchGameplayClass ? "1" : "0";
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

  return {
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
    signature,
  };
}
