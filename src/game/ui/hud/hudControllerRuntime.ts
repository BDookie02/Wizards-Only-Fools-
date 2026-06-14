import {
  GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS,
  isGamepadButtonPressed,
  type GamepadButtonName,
} from "../../systems/input/controllerInput";
import { CONTROLLER_INVENTORY_HOLD_MS, MAGIC_UNARM_HOLD_MS } from "../../systems/input/hudInputConfig";
import type { SpellMenuControllerDirection } from "./hudControllerEventRuntime";
import type { HudControllerButtonsRef, HudControllerRepeatRef } from "./hudControllerRepeatRuntime";
export {
  dispatchInventoryControllerBack,
  dispatchInventoryControllerMove,
  dispatchInventoryControllerSelect,
  dispatchSpellMenuControllerNavigate,
  dispatchSpellMenuControllerScroll,
  dispatchSpellMenuControllerSelect,
  type InventoryControllerMoveDetail,
  type SpellMenuControllerDirection,
  type SpellMenuControllerNavigateDetail,
} from "./hudControllerEventRuntime";
export {
  createHudControllerInputSnapshot,
  readHudControllerInputSnapshot,
  readHudControllerInputSnapshotInto,
  type HudControllerBindings,
  type HudControllerInputSnapshot,
} from "./hudControllerInputSnapshotRuntime";
export {
  consumeHudControllerPress,
  consumeHudControllerRepeat,
  type HudControllerButtonsRef,
  type HudControllerRepeatRef,
} from "./hudControllerRepeatRuntime";

type Ref<T> = {
  current: T;
};

export type HudControllerInventoryHoldRefs = {
  controllerInventoryHoldStartedAtRef: Ref<number | null>;
  controllerInventoryTapEligibleRef: Ref<boolean>;
  controllerInventoryIgnoreUntilReleaseRef: Ref<boolean>;
};

export type HudControllerMagicHoldRefs = {
  controllerMagicHoldStartedAtRef: Ref<number | null>;
  controllerMagicHoldConsumedRef: Ref<boolean>;
};

export type HudControllerLastSeenRef = Ref<number>;

export type HudControllerGameplaySignalOptions = {
  isLocked: boolean;
  pointerLockActive: boolean;
  controllerGameplayActive: boolean;
  touchGameplayActive?: boolean;
  mouseLookFallbackActive?: boolean;
};

export type HudControllerDevFastTravelGateOptions = {
  isDevFastTravelAllowed: boolean;
  isGameLaunched: boolean;
  startMenuStage: string;
  showVideoMenu: boolean;
  isMapExpanded: boolean;
  isScoreboardOpen: boolean;
  isSpellMenuOpen: boolean;
  isInventoryOpen: boolean;
  isCommandConsoleOpen: boolean;
  hotbarModifierHeld: boolean;
  gameplayInputActive: boolean;
};

export type HudControllerInventoryStandstillOptions = {
  controllerGameplayActive: boolean;
  playerMoving: boolean;
  playerSprinting: boolean;
  playerSliding: boolean;
  playerCrouching: boolean;
  movementAxisX: number;
  movementAxisY: number;
};

export type HudControllerInventoryGateOptions = {
  inventoryInputActive: boolean;
  isMapExpanded: boolean;
  isScoreboardOpen: boolean;
  isSpellMenuOpen: boolean;
  hotbarModifierHeld: boolean;
};

export type HudControllerMagicGateOptions = {
  gameplayInputActive: boolean;
  isMapExpanded: boolean;
  isScoreboardOpen: boolean;
};

export type HudControllerMapGateOptions = HudControllerMagicGateOptions & {
  isSpellMenuOpen: boolean;
  isInventoryOpen: boolean;
  hotbarModifierHeld: boolean;
};

export type HudControllerInventoryHoldAction = "none" | "openInventory";

export type HudControllerInventoryHoldUpdateOptions = {
  refs: HudControllerInventoryHoldRefs;
  now: number;
  inventoryHeld: boolean;
  isStandingStillForInventory: boolean;
  canUseControllerInventoryShortcut: boolean;
  holdMs?: number;
};

export type HudControllerMagicHoldAction = "none" | "interact";

export type HudControllerMagicHoldUpdateOptions = {
  refs: HudControllerMagicHoldRefs;
  now: number;
  interactHeld: boolean;
  canUseControllerMagic: boolean;
  toggleMagicArmed: () => boolean;
  holdMs?: number;
};

export type HudControllerOverlayRepeatReader = (
  key: string,
  pressed: boolean,
  now: number,
  firstDelay?: number,
  repeatDelay?: number,
) => boolean;

export type HudControllerPressReader = (key: string, pressed: boolean) => boolean;

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

export type HudControllerDevFastTravelOpenActionOptions = HudControllerDevFastTravelGateOptions & {
  dpadDown: boolean;
  consumePress: HudControllerPressReader;
};

export type HudControllerScoreboardSourceOptions = {
  isSpellMenuOpen: boolean;
  backHeld: boolean;
};

export type HudControllerOverlayScrollOptions = {
  pauseMenuOpen: boolean;
  showVideoMenu: boolean;
  isSpellMenuOpen: boolean;
  scrollAxisY: number;
  threshold?: number;
  multiplier?: number;
};

export type HudControllerOverlayScrollAction = {
  settingsDelta: number;
  spellMenuDelta: number;
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

export type HudControllerBlockedSurfaceAction =
  | { type: "none" }
  | {
      type: "interrupt";
      nextPollMs: number;
      resetTransientState: boolean;
      clearScoreboardSource: boolean;
    };

export type HudControllerBlockedSurfaceActionOptions = {
  questNpcEditorOpen: boolean;
  questDialogOpen: boolean;
  nextPollMs?: number;
};

export type HudControllerMissingGamepadAction = {
  pauseGameplay: boolean;
  nextPollMs: number;
  resetTransientState: boolean;
  clearScoreboardSource: boolean;
};

export type HudControllerMissingGamepadActionOptions = {
  controllerGameplayActive: boolean;
  controllerLastSeenAtRef: HudControllerLastSeenRef;
  now: number;
  nextPollMs?: number;
  disconnectPauseMs?: number;
};

export type HudControllerGameplayActivationAction =
  | { type: "none" }
  | {
      type: "activate";
      releaseTouchControls: boolean;
      setControllerGameplayActive: boolean;
      dispatchControllerGameplayStarted: boolean;
      nextInputMode: "controller";
    };

export type HudControllerGameplayActivationActionOptions = {
  isGameLaunched: boolean;
  hasLocalPlayerName: boolean;
  hasActiveGamepadInput: boolean;
  isTouchControlsActive: boolean;
  isControllerGameplayActive: boolean;
  lastGameplayInputMode: string;
};

export type HudControllerRemapAction =
  | { type: "none" }
  | { type: "cancel" }
  | { type: "capture"; button: string };

export type HudControllerRemapActionOptions = {
  gamepad: Gamepad;
  now: number;
  remapReadyAt: number;
  menuBackButton: string;
  controllerButtonOptions: readonly string[];
};

const HUD_CONTROLLER_MENU_AXIS_THRESHOLD = 0.6;
const HUD_CONTROLLER_DEV_FAST_TRAVEL_NAVIGATION_DELAY_MS = 220;
const HUD_CONTROLLER_OVERLAY_SCROLL_THRESHOLD = 0.05;
const HUD_CONTROLLER_OVERLAY_SCROLL_MULTIPLIER = 18;
const HUD_CONTROLLER_DISCONNECT_PAUSE_MS = 1200;

export function hasHudControllerGameplaySignal({
  isLocked,
  pointerLockActive,
  controllerGameplayActive,
  touchGameplayActive = false,
  mouseLookFallbackActive = false,
}: HudControllerGameplaySignalOptions) {
  return Boolean(
    touchGameplayActive ||
    controllerGameplayActive ||
    isLocked ||
    pointerLockActive ||
    mouseLookFallbackActive
  );
}

export function canOpenControllerDevFastTravelMenu({
  isDevFastTravelAllowed,
  isGameLaunched,
  startMenuStage,
  showVideoMenu,
  isMapExpanded,
  isScoreboardOpen,
  isSpellMenuOpen,
  isInventoryOpen,
  isCommandConsoleOpen,
  hotbarModifierHeld,
  gameplayInputActive,
}: HudControllerDevFastTravelGateOptions) {
  return Boolean(
    isDevFastTravelAllowed &&
    isGameLaunched &&
    startMenuStage === "resume" &&
    !showVideoMenu &&
    !isMapExpanded &&
    !isScoreboardOpen &&
    !isSpellMenuOpen &&
    !isInventoryOpen &&
    !isCommandConsoleOpen &&
    !hotbarModifierHeld &&
    gameplayInputActive
  );
}

export function getHudControllerDevFastTravelOpenAction({
  dpadDown,
  consumePress,
  ...gateOptions
}: HudControllerDevFastTravelOpenActionOptions) {
  const openPressed = consumePress(
    "controllerDevFastTravelOpen",
    dpadDown && !gateOptions.hotbarModifierHeld,
  );
  return openPressed && canOpenControllerDevFastTravelMenu(gateOptions);
}

export function getHudControllerScoreboardSourceActive({
  isSpellMenuOpen,
  backHeld,
}: HudControllerScoreboardSourceOptions) {
  return !isSpellMenuOpen && backHeld;
}

export function getHudControllerOverlayScrollAction({
  pauseMenuOpen,
  showVideoMenu,
  isSpellMenuOpen,
  scrollAxisY,
  threshold = HUD_CONTROLLER_OVERLAY_SCROLL_THRESHOLD,
  multiplier = HUD_CONTROLLER_OVERLAY_SCROLL_MULTIPLIER,
}: HudControllerOverlayScrollOptions): HudControllerOverlayScrollAction {
  if (Math.abs(scrollAxisY) <= threshold) {
    return { settingsDelta: 0, spellMenuDelta: 0 };
  }

  const delta = scrollAxisY * multiplier;
  return {
    settingsDelta: pauseMenuOpen && showVideoMenu ? delta : 0,
    spellMenuDelta: isSpellMenuOpen ? delta : 0,
  };
}

export function isStandingStillForControllerInventory({
  controllerGameplayActive,
  playerMoving,
  playerSprinting,
  playerSliding,
  playerCrouching,
  movementAxisX,
  movementAxisY,
}: HudControllerInventoryStandstillOptions) {
  return Boolean(
    controllerGameplayActive &&
    !playerMoving &&
    !playerSprinting &&
    !playerSliding &&
    !playerCrouching &&
    Math.abs(movementAxisX) === 0 &&
    Math.abs(movementAxisY) === 0
  );
}

export function canUseControllerInventory({
  inventoryInputActive,
  isMapExpanded,
  isScoreboardOpen,
  isSpellMenuOpen,
  hotbarModifierHeld,
}: HudControllerInventoryGateOptions) {
  return Boolean(
    inventoryInputActive &&
    !isMapExpanded &&
    !isScoreboardOpen &&
    !isSpellMenuOpen &&
    !hotbarModifierHeld
  );
}

export function canUseControllerMagicShortcut({
  gameplayInputActive,
  isMapExpanded,
  isScoreboardOpen,
}: HudControllerMagicGateOptions) {
  return Boolean(gameplayInputActive && !isMapExpanded && !isScoreboardOpen);
}

export function canUseControllerMapShortcut({
  gameplayInputActive,
  isMapExpanded,
  isScoreboardOpen,
  isSpellMenuOpen,
  isInventoryOpen,
  hotbarModifierHeld,
}: HudControllerMapGateOptions) {
  return Boolean(
    gameplayInputActive &&
    !isMapExpanded &&
    !isScoreboardOpen &&
    !isSpellMenuOpen &&
    !isInventoryOpen &&
    !hotbarModifierHeld
  );
}

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

export function markHudControllerInventoryIgnoreUntilRelease({
  controllerInventoryHoldStartedAtRef,
  controllerInventoryTapEligibleRef,
  controllerInventoryIgnoreUntilReleaseRef,
}: HudControllerInventoryHoldRefs) {
  controllerInventoryIgnoreUntilReleaseRef.current = true;
  controllerInventoryHoldStartedAtRef.current = null;
  controllerInventoryTapEligibleRef.current = false;
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

export function getHudControllerBlockedSurfaceAction({
  questNpcEditorOpen,
  questDialogOpen,
  nextPollMs = GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS,
}: HudControllerBlockedSurfaceActionOptions): HudControllerBlockedSurfaceAction {
  if (!questNpcEditorOpen && !questDialogOpen) return { type: "none" };

  return {
    type: "interrupt",
    nextPollMs,
    resetTransientState: true,
    clearScoreboardSource: true,
  };
}

export function updateHudControllerMissingGamepadAction({
  controllerGameplayActive,
  controllerLastSeenAtRef,
  now,
  nextPollMs = GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS,
  disconnectPauseMs = HUD_CONTROLLER_DISCONNECT_PAUSE_MS,
}: HudControllerMissingGamepadActionOptions): HudControllerMissingGamepadAction {
  let pauseGameplay = false;

  if (controllerGameplayActive) {
    if (controllerLastSeenAtRef.current === 0) {
      controllerLastSeenAtRef.current = now;
    } else if (now - controllerLastSeenAtRef.current > disconnectPauseMs) {
      pauseGameplay = true;
      controllerLastSeenAtRef.current = 0;
    }
  } else {
    controllerLastSeenAtRef.current = 0;
  }

  return {
    pauseGameplay,
    nextPollMs,
    resetTransientState: true,
    clearScoreboardSource: true,
  };
}

export function markHudControllerGamepadSeen(controllerLastSeenAtRef: HudControllerLastSeenRef, now: number) {
  controllerLastSeenAtRef.current = now;
}

export function getHudControllerGameplayActivationAction({
  isGameLaunched,
  hasLocalPlayerName,
  hasActiveGamepadInput,
  isTouchControlsActive,
  isControllerGameplayActive,
  lastGameplayInputMode,
}: HudControllerGameplayActivationActionOptions): HudControllerGameplayActivationAction {
  if (!isGameLaunched || !hasLocalPlayerName || !hasActiveGamepadInput) {
    return { type: "none" };
  }

  if (
    !isTouchControlsActive &&
    isControllerGameplayActive &&
    lastGameplayInputMode === "controller"
  ) {
    return { type: "none" };
  }

  const setControllerGameplayActive = !isControllerGameplayActive;
  return {
    type: "activate",
    releaseTouchControls: isTouchControlsActive,
    setControllerGameplayActive,
    dispatchControllerGameplayStarted: setControllerGameplayActive,
    nextInputMode: "controller",
  };
}

export function getHudControllerRemapAction({
  gamepad,
  now,
  remapReadyAt,
  menuBackButton,
  controllerButtonOptions,
}: HudControllerRemapActionOptions): HudControllerRemapAction {
  if (now < remapReadyAt) return { type: "none" };

  if (isGamepadButtonPressed(gamepad, menuBackButton as GamepadButtonName)) {
    return { type: "cancel" };
  }

  for (let index = 0; index < controllerButtonOptions.length; index += 1) {
    const button = controllerButtonOptions[index];
    if (!isGamepadButtonPressed(gamepad, button as GamepadButtonName)) continue;
    return { type: "capture", button };
  }

  return { type: "none" };
}

export function updateHudControllerInventoryHold({
  refs,
  now,
  inventoryHeld,
  isStandingStillForInventory,
  canUseControllerInventoryShortcut,
  holdMs = CONTROLLER_INVENTORY_HOLD_MS,
}: HudControllerInventoryHoldUpdateOptions): HudControllerInventoryHoldAction {
  const {
    controllerInventoryHoldStartedAtRef,
    controllerInventoryTapEligibleRef,
    controllerInventoryIgnoreUntilReleaseRef,
  } = refs;

  if (controllerInventoryIgnoreUntilReleaseRef.current) {
    controllerInventoryHoldStartedAtRef.current = null;
    controllerInventoryTapEligibleRef.current = false;
    if (!inventoryHeld) {
      controllerInventoryIgnoreUntilReleaseRef.current = false;
    }
    return "none";
  }

  if (inventoryHeld) {
    if (isStandingStillForInventory && canUseControllerInventoryShortcut) {
      if (controllerInventoryHoldStartedAtRef.current === null) {
        controllerInventoryHoldStartedAtRef.current = now;
        controllerInventoryTapEligibleRef.current = true;
      } else if (now - controllerInventoryHoldStartedAtRef.current >= holdMs) {
        controllerInventoryTapEligibleRef.current = false;
      }
    } else {
      controllerInventoryTapEligibleRef.current = false;
    }
    return "none";
  }

  if (controllerInventoryHoldStartedAtRef.current !== null) {
    const holdDuration = now - controllerInventoryHoldStartedAtRef.current;
    const shouldOpenInventory =
      controllerInventoryTapEligibleRef.current &&
      holdDuration < holdMs &&
      isStandingStillForInventory &&
      canUseControllerInventoryShortcut;
    resetHudControllerInventoryHoldState(refs);
    return shouldOpenInventory ? "openInventory" : "none";
  }

  return "none";
}

export function updateHudControllerMagicHold({
  refs,
  now,
  interactHeld,
  canUseControllerMagic,
  toggleMagicArmed,
  holdMs = MAGIC_UNARM_HOLD_MS,
}: HudControllerMagicHoldUpdateOptions): HudControllerMagicHoldAction {
  const { controllerMagicHoldStartedAtRef, controllerMagicHoldConsumedRef } = refs;

  if (interactHeld) {
    if (canUseControllerMagic) {
      if (controllerMagicHoldStartedAtRef.current === null) {
        controllerMagicHoldStartedAtRef.current = now;
        controllerMagicHoldConsumedRef.current = false;
      } else if (!controllerMagicHoldConsumedRef.current && now - controllerMagicHoldStartedAtRef.current >= holdMs) {
        controllerMagicHoldConsumedRef.current = toggleMagicArmed();
      }
    } else {
      resetHudControllerMagicHoldState(refs);
    }
    return "none";
  }

  if (controllerMagicHoldStartedAtRef.current !== null) {
    const holdDuration = now - controllerMagicHoldStartedAtRef.current;
    const shouldInteract =
      !controllerMagicHoldConsumedRef.current &&
      holdDuration < holdMs &&
      canUseControllerMagic;
    resetHudControllerMagicHoldState(refs);
    return shouldInteract ? "interact" : "none";
  }

  return "none";
}

export function resetHudControllerButtonState(
  controllerButtonsRef: HudControllerButtonsRef,
  controllerRepeatRef: HudControllerRepeatRef,
) {
  controllerButtonsRef.current = {};
  controllerRepeatRef.current = {};
}

export function resetHudControllerInventoryHoldState({
  controllerInventoryHoldStartedAtRef,
  controllerInventoryTapEligibleRef,
  controllerInventoryIgnoreUntilReleaseRef,
}: HudControllerInventoryHoldRefs) {
  controllerInventoryHoldStartedAtRef.current = null;
  controllerInventoryTapEligibleRef.current = false;
  controllerInventoryIgnoreUntilReleaseRef.current = false;
}

export function resetHudControllerMagicHoldState({
  controllerMagicHoldStartedAtRef,
  controllerMagicHoldConsumedRef,
}: HudControllerMagicHoldRefs) {
  controllerMagicHoldStartedAtRef.current = null;
  controllerMagicHoldConsumedRef.current = false;
}

export function resetHudControllerTransientState({
  controllerButtonsRef,
  controllerRepeatRef,
  controllerInventoryHoldStartedAtRef,
  controllerInventoryTapEligibleRef,
  controllerInventoryIgnoreUntilReleaseRef,
  controllerMagicHoldStartedAtRef,
  controllerMagicHoldConsumedRef,
}: HudControllerInventoryHoldRefs & HudControllerMagicHoldRefs & {
  controllerButtonsRef: HudControllerButtonsRef;
  controllerRepeatRef: HudControllerRepeatRef;
}) {
  resetHudControllerButtonState(controllerButtonsRef, controllerRepeatRef);
  resetHudControllerInventoryHoldState({
    controllerInventoryHoldStartedAtRef,
    controllerInventoryTapEligibleRef,
    controllerInventoryIgnoreUntilReleaseRef,
  });
  resetHudControllerMagicHoldState({
    controllerMagicHoldStartedAtRef,
    controllerMagicHoldConsumedRef,
  });
}
