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

export function isDarrelDragonQuestReadyForEncounter(flags: Record<string, unknown>, unlocked: string[]) {
  return !unlocked.includes("healingcrystals") &&
    (flags[DARREL_POTION_FLAG] === "drunk" || flags["quest:darrel-grove"] === "started");
}
