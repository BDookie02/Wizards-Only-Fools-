import type { SpellMenuControllerDirection } from "./hudControllerEventRuntime";

export type HudControllerOverlayRepeatReader = (
  key: string,
  pressed: boolean,
  now: number,
  firstDelay?: number,
  repeatDelay?: number,
) => boolean;

export type HudControllerOverlayRepeatOptions = {
  isSpellMenuOpen: boolean;
  pauseMenuOpen: boolean;
  dpadLeft: boolean;
  dpadRight: boolean;
  dpadUp: boolean;
  dpadDown: boolean;
  menuAxisX: number;
  menuAxisY: number;
  now: number;
  consumeRepeat: HudControllerOverlayRepeatReader;
};

export type HudControllerOverlayRepeats = {
  spellMenuRightPressed: boolean;
  spellMenuLeftPressed: boolean;
  spellMenuDownPressed: boolean;
  spellMenuUpPressed: boolean;
  pauseNextPressed: boolean;
  pausePrevPressed: boolean;
  pauseRightPressed: boolean;
  pauseLeftPressed: boolean;
};

export type HudControllerSpellMenuActionOptions = {
  rightBumperHeld: boolean;
  rightBumperPressed: boolean;
  leftBumperHeld: boolean;
  leftBumperPressed: boolean;
  bPressed: boolean;
  startPressed: boolean;
  aPressed: boolean;
} & Pick<
  HudControllerOverlayRepeats,
  "spellMenuUpPressed" | "spellMenuDownPressed" | "spellMenuLeftPressed" | "spellMenuRightPressed"
>;

export type HudControllerSpellMenuAction = {
  bindingHand: "left" | "right" | null;
  close: boolean;
  navigate: SpellMenuControllerDirection | null;
  select: boolean;
};

export type HudControllerDevFastTravelAction =
  | { type: "none" }
  | { type: "emptyMove" }
  | { type: "move"; direction: 1 | -1 }
  | { type: "close" }
  | { type: "select" };

export type HudControllerDevFastTravelActionOptions = {
  now: number;
  openedAt: number;
  dpadUp: boolean;
  dpadDown: boolean;
  menuAxisY: number;
  aPressed: boolean;
  bPressed: boolean;
  startPressed: boolean;
  locationCount: number;
  consumeRepeat: HudControllerOverlayRepeatReader;
  navigationDelayMs?: number;
};

export type HudControllerInventoryPanelAction = {
  moveDirection: 1 | -1 | null;
  select: boolean;
  back: boolean;
  ignoreUntilReleaseOnClose: boolean;
};

export type HudControllerInventoryPanelActionOptions = {
  now: number;
  dpadUp: boolean;
  dpadDown: boolean;
  menuAxisY: number;
  aPressed: boolean;
  bPressed: boolean;
  startPressed: boolean;
  inventoryHeld: boolean;
  consumeRepeat: HudControllerOverlayRepeatReader;
};

export type HudControllerPauseMenuAction = {
  moveFocus: "up" | "down" | null;
  horizontalDirection: 1 | -1 | null;
  submit: "close" | "run" | "startGameplay" | null;
};

export type HudControllerPauseMenuActionOptions = Pick<
  HudControllerOverlayRepeats,
  "pauseNextPressed" | "pausePrevPressed" | "pauseRightPressed" | "pauseLeftPressed"
> & {
  bPressed: boolean;
  aPressed: boolean;
  startPressed: boolean;
};

export type HudControllerGameplayStartAction =
  | { type: "none" }
  | { type: "pause" }
  | { type: "start"; shouldReturn: boolean };

export type HudControllerGameplayStartActionOptions = {
  startPressed: boolean;
  aPressed: boolean;
  isLocked: boolean;
  controllerGameplayActive: boolean;
  isReturningToGame: boolean;
  touchGameplayActive: boolean;
  canPauseActiveGameplay: boolean;
};

const HUD_CONTROLLER_MENU_AXIS_THRESHOLD = 0.6;
const HUD_CONTROLLER_DEV_FAST_TRAVEL_NAVIGATION_DELAY_MS = 220;

export function readHudControllerOverlayRepeats({
  isSpellMenuOpen,
  pauseMenuOpen,
  dpadLeft,
  dpadRight,
  dpadUp,
  dpadDown,
  menuAxisX,
  menuAxisY,
  now,
  consumeRepeat,
}: HudControllerOverlayRepeatOptions): HudControllerOverlayRepeats {
  const rightHeld = dpadRight || menuAxisX > HUD_CONTROLLER_MENU_AXIS_THRESHOLD;
  const leftHeld = dpadLeft || menuAxisX < -HUD_CONTROLLER_MENU_AXIS_THRESHOLD;
  const downHeld = dpadDown || menuAxisY > HUD_CONTROLLER_MENU_AXIS_THRESHOLD;
  const upHeld = dpadUp || menuAxisY < -HUD_CONTROLLER_MENU_AXIS_THRESHOLD;

  return {
    spellMenuRightPressed: consumeRepeat("controllerSpellMenuRight", isSpellMenuOpen && rightHeld, now),
    spellMenuLeftPressed: consumeRepeat("controllerSpellMenuLeft", isSpellMenuOpen && leftHeld, now),
    spellMenuDownPressed: consumeRepeat("controllerSpellMenuDown", isSpellMenuOpen && downHeld, now),
    spellMenuUpPressed: consumeRepeat("controllerSpellMenuUp", isSpellMenuOpen && upHeld, now),
    pauseNextPressed: consumeRepeat("controllerPauseNext", pauseMenuOpen && downHeld, now),
    pausePrevPressed: consumeRepeat("controllerPausePrev", pauseMenuOpen && upHeld, now),
    pauseRightPressed: consumeRepeat("controllerPauseRight", pauseMenuOpen && rightHeld, now),
    pauseLeftPressed: consumeRepeat("controllerPauseLeft", pauseMenuOpen && leftHeld, now),
  };
}

export function getHudControllerInventoryPanelAction({
  now,
  dpadUp,
  dpadDown,
  menuAxisY,
  aPressed,
  bPressed,
  startPressed,
  inventoryHeld,
  consumeRepeat,
}: HudControllerInventoryPanelActionOptions): HudControllerInventoryPanelAction {
  const inventoryNextPressed = consumeRepeat(
    "controllerInventoryNext",
    dpadDown || menuAxisY > HUD_CONTROLLER_MENU_AXIS_THRESHOLD,
    now,
  );
  const inventoryPrevPressed = consumeRepeat(
    "controllerInventoryPrev",
    dpadUp || menuAxisY < -HUD_CONTROLLER_MENU_AXIS_THRESHOLD,
    now,
  );
  const back = bPressed || startPressed;

  return {
    moveDirection: inventoryNextPressed || inventoryPrevPressed ? (inventoryNextPressed ? 1 : -1) : null,
    select: aPressed,
    back,
    ignoreUntilReleaseOnClose: back && inventoryHeld,
  };
}

export function getHudControllerDevFastTravelAction({
  now,
  openedAt,
  dpadUp,
  dpadDown,
  menuAxisY,
  aPressed,
  bPressed,
  startPressed,
  locationCount,
  consumeRepeat,
  navigationDelayMs = HUD_CONTROLLER_DEV_FAST_TRAVEL_NAVIGATION_DELAY_MS,
}: HudControllerDevFastTravelActionOptions): HudControllerDevFastTravelAction {
  const canNavigateFastTravel = now - openedAt > navigationDelayMs;
  const fastTravelNextPressed =
    canNavigateFastTravel &&
    consumeRepeat(
      "controllerDevFastTravelNext",
      dpadDown || menuAxisY > HUD_CONTROLLER_MENU_AXIS_THRESHOLD,
      now,
    );
  const fastTravelPrevPressed =
    canNavigateFastTravel &&
    consumeRepeat(
      "controllerDevFastTravelPrev",
      dpadUp || menuAxisY < -HUD_CONTROLLER_MENU_AXIS_THRESHOLD,
      now,
    );

  if (fastTravelNextPressed || fastTravelPrevPressed) {
    if (locationCount <= 0) return { type: "emptyMove" };
    return { type: "move", direction: fastTravelNextPressed ? 1 : -1 };
  }

  if (bPressed || startPressed) return { type: "close" };
  if (aPressed) return { type: "select" };
  return { type: "none" };
}

export function getHudControllerSpellMenuAction({
  rightBumperHeld,
  rightBumperPressed,
  leftBumperHeld,
  leftBumperPressed,
  bPressed,
  startPressed,
  aPressed,
  spellMenuUpPressed,
  spellMenuDownPressed,
  spellMenuLeftPressed,
  spellMenuRightPressed,
}: HudControllerSpellMenuActionOptions): HudControllerSpellMenuAction {
  const bindingHand =
    rightBumperHeld || rightBumperPressed
      ? "right"
      : leftBumperHeld || leftBumperPressed
        ? "left"
        : null;

  if (bPressed || startPressed) {
    return { bindingHand, close: true, navigate: null, select: false };
  }

  let navigate: SpellMenuControllerDirection | null = null;
  if (spellMenuUpPressed) {
    navigate = "up";
  } else if (spellMenuDownPressed) {
    navigate = "down";
  } else if (spellMenuLeftPressed) {
    navigate = "left";
  } else if (spellMenuRightPressed) {
    navigate = "right";
  }

  return {
    bindingHand,
    close: false,
    navigate,
    select: aPressed,
  };
}

export function getHudControllerPauseMenuAction({
  pauseNextPressed,
  pausePrevPressed,
  pauseRightPressed,
  pauseLeftPressed,
  bPressed,
  aPressed,
  startPressed,
}: HudControllerPauseMenuActionOptions): HudControllerPauseMenuAction {
  const moveFocus = pauseNextPressed ? "down" : pausePrevPressed ? "up" : null;
  const verticalMoved = pauseNextPressed || pausePrevPressed;
  const horizontalDirection = verticalMoved
    ? null
    : pauseRightPressed
      ? 1
      : pauseLeftPressed
        ? -1
        : null;
  const submit = bPressed ? "close" : aPressed ? "run" : startPressed ? "startGameplay" : null;

  return { moveFocus, horizontalDirection, submit };
}

export function getHudControllerGameplayStartAction({
  startPressed,
  aPressed,
  isLocked,
  controllerGameplayActive,
  isReturningToGame,
  touchGameplayActive,
  canPauseActiveGameplay,
}: HudControllerGameplayStartActionOptions): HudControllerGameplayStartAction {
  if (startPressed) {
    return touchGameplayActive || canPauseActiveGameplay
      ? { type: "pause" }
      : { type: "start", shouldReturn: true };
  }

  if (aPressed && !isLocked && !controllerGameplayActive && !isReturningToGame) {
    return { type: "start", shouldReturn: false };
  }

  return { type: "none" };
}
