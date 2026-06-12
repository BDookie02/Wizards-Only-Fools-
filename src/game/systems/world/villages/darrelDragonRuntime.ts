import {
  DARREL_DRAGON_FOUGHT_FLAG,
  DARREL_DRAGON_NPC_ID,
  DARREL_DRAGON_PEACEFUL_FLAG,
  DARREL_DRAGON_WOKEN_FLAG,
  DARREL_POTION_FLAG,
  type ControllerButtonName,
} from "../../../../store/gameStore";

export type DarrelDragonMode = "sleep" | "wake" | "idle" | "attack";

export type DarrelDragonQuestInteractDetail = {
  source?: "keyboard" | "controller" | "cast" | string;
  handled?: boolean;
};

export type DarrelDragonVector3Like = {
  x: number;
  y: number;
  z: number;
};

export type DarrelDragonInteractionState = {
  questDialogSession?: unknown;
  questNpcEditorTarget?: unknown;
  isInventoryOpen: boolean;
  isPauseMenuOpen: boolean;
  isSpellMenuOpen: boolean;
  isMapExpanded: boolean;
  isScoreboardOpen: boolean;
  health: number;
};

export type DarrelDragonQuestState = {
  hasPeacefulDragon: boolean;
  hasFoughtDragon: boolean;
  hasWoken: boolean;
};

export type DarrelDragonAnimationTiming = {
  sleepFrameMs: number;
  wakeFrameMs: number;
  idleFrameMs: number;
  attackFrameMs: number;
  sleepFrameCount: number;
  wakeFrameCount: number;
  idleFrameCount: number;
  attackFrameCount: number;
};

export type DarrelDragonResolvedFrame = {
  activeMode: DarrelDragonMode;
  activeModeStartedAt: number;
  frameIndex: number;
  frameMs: number;
};

export type DarrelDragonSpriteVisuals = {
  positionY: number;
  scaleX: number;
  scaleY: number;
};

const DARREL_DRAGON_CONTROLLER_LABELS: Record<ControllerButtonName, string> = {
  a: "A",
  b: "B",
  x: "X",
  y: "Y",
  leftBumper: "LB",
  rightBumper: "RB",
  leftTrigger: "LT",
  rightTrigger: "RT",
  back: "Select",
  start: "Start",
  leftStick: "LS",
  rightStick: "RS",
  dpadUp: "D-Up",
  dpadDown: "D-Down",
  dpadLeft: "D-Left",
  dpadRight: "D-Right",
};

function isTruthyQuestFlag(value: unknown) {
  return value === true || value === "true";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, alpha: number) {
  return start + (end - start) * alpha;
}

function getSafeFrameCount(count: number) {
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
}

export function isDarrelDragonEditableTarget(target: EventTarget | null) {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  return target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT";
}

export function getDarrelDragonLocalPosition(
  position: DarrelDragonVector3Like,
  worldOrigin: { x: number; z: number },
) {
  return {
    x: position.x - worldOrigin.x,
    y: position.y,
    z: position.z - worldOrigin.z,
  };
}

export function isInsideDarrelDragonHouse(
  localPosition: DarrelDragonVector3Like,
  halfWidth: number,
  halfDepth: number,
) {
  return Math.abs(localPosition.x) <= halfWidth &&
    Math.abs(localPosition.z) <= halfDepth;
}

export function isNearDarrelDragon(
  localPosition: DarrelDragonVector3Like,
  dragonLocalPosition: readonly [number, number, number],
  talkRadiusSq: number,
) {
  const dx = localPosition.x - dragonLocalPosition[0];
  const dz = localPosition.z - dragonLocalPosition[2];
  return dx * dx + dz * dz <= talkRadiusSq;
}

export function getDarrelDragonInteractPrompt(
  controllerBindings: Record<string, ControllerButtonName>,
  isControllerGameplayActive: boolean,
  isTouchControlsActive: boolean,
) {
  if (isTouchControlsActive) return "TAP CAST / INTERACT";
  if (!isControllerGameplayActive) return "F / LMB / RMB";

  const buttons = [
    controllerBindings.interact,
    controllerBindings.leftCast,
    controllerBindings.rightCast,
  ];
  const labels: string[] = [];
  for (let index = 0; index < buttons.length; index += 1) {
    const button = buttons[index];
    if (!button) continue;
    const label = DARREL_DRAGON_CONTROLLER_LABELS[button] ?? button;
    if (!labels.includes(label)) labels.push(label);
  }

  return labels.join(" / ") || "INTERACT";
}

export function canUseDarrelDragonInteraction(state: DarrelDragonInteractionState) {
  return !state.questDialogSession &&
    !state.questNpcEditorTarget &&
    !state.isInventoryOpen &&
    !state.isPauseMenuOpen &&
    !state.isSpellMenuOpen &&
    !state.isMapExpanded &&
    !state.isScoreboardOpen &&
    state.health > 0;
}

export function shouldShowDarrelDragonInteractPrompt({
  state,
  playerInsideHouse,
  playerNearDragon,
}: {
  state: DarrelDragonInteractionState;
  playerInsideHouse: boolean;
  playerNearDragon: boolean;
}) {
  return playerInsideHouse &&
    playerNearDragon &&
    canUseDarrelDragonInteraction(state);
}

export function getDarrelDragonQuestState({
  questFlags,
  questUnlockedSpells,
  questDialogNpcId,
  hasPlayerEnteredHouse,
}: {
  questFlags: Record<string, unknown>;
  questUnlockedSpells: string[];
  questDialogNpcId?: string;
  hasPlayerEnteredHouse: boolean;
}): DarrelDragonQuestState {
  const hasPeacefulDragon = isTruthyQuestFlag(questFlags[DARREL_DRAGON_PEACEFUL_FLAG]) ||
    questUnlockedSpells.includes("healingcrystals");
  const hasFoughtDragon = isTruthyQuestFlag(questFlags[DARREL_DRAGON_FOUGHT_FLAG]) && !hasPeacefulDragon;
  const hasWoken = isTruthyQuestFlag(questFlags[DARREL_DRAGON_WOKEN_FLAG]) ||
    hasPeacefulDragon ||
    hasFoughtDragon ||
    questDialogNpcId === DARREL_DRAGON_NPC_ID ||
    hasPlayerEnteredHouse;

  return {
    hasPeacefulDragon,
    hasFoughtDragon,
    hasWoken,
  };
}

export function getNextDarrelDragonMode(
  currentMode: DarrelDragonMode,
  hasFoughtDragon: boolean,
  hasWoken: boolean,
): DarrelDragonMode {
  if (hasFoughtDragon) return "attack";
  if (hasWoken && currentMode === "sleep") return "wake";
  if (hasWoken && currentMode === "attack") return "idle";
  if (!hasWoken) return "sleep";
  return currentMode;
}

export function getDarrelDragonFrameMs(mode: DarrelDragonMode, timing: DarrelDragonAnimationTiming) {
  if (mode === "sleep") return timing.sleepFrameMs;
  if (mode === "wake") return timing.wakeFrameMs;
  if (mode === "attack") return timing.attackFrameMs;
  return timing.idleFrameMs;
}

export function getDarrelDragonFrameCount(mode: DarrelDragonMode, timing: DarrelDragonAnimationTiming) {
  if (mode === "sleep") return getSafeFrameCount(timing.sleepFrameCount);
  if (mode === "wake") return getSafeFrameCount(timing.wakeFrameCount);
  if (mode === "attack") return getSafeFrameCount(timing.attackFrameCount);
  return getSafeFrameCount(timing.idleFrameCount);
}

export function resolveDarrelDragonAnimationFrame({
  mode,
  modeStartedAt,
  now,
  timing,
}: {
  mode: DarrelDragonMode;
  modeStartedAt: number;
  now: number;
  timing: DarrelDragonAnimationTiming;
}): DarrelDragonResolvedFrame {
  const frameMs = getDarrelDragonFrameMs(mode, timing);
  const elapsed = Math.max(0, now - modeStartedAt);
  const wakeFrameCount = getDarrelDragonFrameCount("wake", timing);
  const wakeFinished = mode === "wake" && elapsed >= wakeFrameCount * frameMs;
  const activeMode = wakeFinished ? "idle" : mode;
  const activeModeStartedAt = wakeFinished ? now : modeStartedAt;
  const activeFrameMs = getDarrelDragonFrameMs(activeMode, timing);
  const activeFrameCount = getDarrelDragonFrameCount(activeMode, timing);
  const activeElapsed = Math.max(0, now - activeModeStartedAt);
  const frameIndex = activeMode === "wake"
    ? Math.min(activeFrameCount - 1, Math.floor(activeElapsed / activeFrameMs))
    : Math.floor(activeElapsed / activeFrameMs) % activeFrameCount;

  return {
    activeMode,
    activeModeStartedAt,
    frameIndex,
    frameMs: activeFrameMs,
  };
}

export function resolveDarrelDragonSpriteVisuals({
  activeMode,
  activeModeStartedAt,
  now,
  timing,
}: {
  activeMode: DarrelDragonMode;
  activeModeStartedAt: number;
  now: number;
  timing: DarrelDragonAnimationTiming;
}): DarrelDragonSpriteVisuals {
  const wakeDurationMs = Math.max(1, getDarrelDragonFrameCount("wake", timing) * timing.wakeFrameMs);
  const wakeProgress = activeMode === "sleep"
    ? 0
    : activeMode === "wake"
      ? clamp((now - activeModeStartedAt) / wakeDurationMs, 0, 1)
      : 1;
  const breath = 1 + Math.sin(now / 620) * (activeMode === "sleep" ? 0.018 : activeMode === "attack" ? 0.055 : 0.035);
  const width = activeMode === "attack" ? 49 : lerp(43, 38, wakeProgress);
  const height = activeMode === "attack" ? 34 : lerp(27, 31, wakeProgress);
  const attentionLift = activeMode === "attack" ? 4.2 : lerp(0, 2.7, wakeProgress);
  const floatAmplitude = activeMode === "attack" ? 0.34 : 0.18;

  return {
    positionY: attentionLift + Math.sin(now / 700) * floatAmplitude * wakeProgress,
    scaleX: width * breath,
    scaleY: height * breath,
  };
}

export function isDarrelDragonQuestReadyForEncounter(flags: Record<string, unknown>, unlocked: string[]) {
  return !unlocked.includes("healingcrystals") &&
    (flags[DARREL_POTION_FLAG] === "drunk" || flags["quest:darrel-grove"] === "started");
}
