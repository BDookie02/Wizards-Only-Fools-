import {
  isGamepadButtonPressed,
  readGamepadStickAxesInto,
  type GamepadButtonName,
  type GamepadStickAxes,
} from "../../systems/input/controllerInput";
import { CONTROLLER_INVENTORY_HOLD_MS, MAGIC_UNARM_HOLD_MS } from "../../systems/input/hudInputConfig";

type Ref<T> = {
  current: T;
};

export type HudControllerButtonsRef = Ref<Record<string, boolean>>;
export type HudControllerRepeatRef = Ref<Partial<Record<string, number>>>;

export type HudControllerInventoryHoldRefs = {
  controllerInventoryHoldStartedAtRef: Ref<number | null>;
  controllerInventoryTapEligibleRef: Ref<boolean>;
  controllerInventoryIgnoreUntilReleaseRef: Ref<boolean>;
};

export type HudControllerMagicHoldRefs = {
  controllerMagicHoldStartedAtRef: Ref<number | null>;
  controllerMagicHoldConsumedRef: Ref<boolean>;
};

export type HudControllerBindings = {
  leftHotbar: string;
  rightHotbar: string;
  menuSelect: string;
  menuBack: string;
  inventory: string;
  spellMenu: string;
  interact: string;
  map: string;
  scoreboard: string;
  pause: string;
};

export type HudControllerInputSnapshot = {
  leftBumperHeld: boolean;
  rightBumperHeld: boolean;
  hotbarModifierHeld: boolean;
  leftBumperPressed: boolean;
  rightBumperPressed: boolean;
  aPressed: boolean;
  bPressed: boolean;
  inventoryHeld: boolean;
  inventoryPressed: boolean;
  spellMenuHeld: boolean;
  spellMenuPressed: boolean;
  interactHeld: boolean;
  yPressed: boolean;
  backHeld: boolean;
  startPressed: boolean;
  dpadLeft: boolean;
  dpadRight: boolean;
  dpadUp: boolean;
  dpadDown: boolean;
  movementAxisX: number;
  movementAxisY: number;
  menuAxisX: number;
  menuAxisY: number;
  scrollAxisY: number;
};

const hudLeftStickScratch: GamepadStickAxes = { x: 0, y: 0 };
const hudRightStickScratch: GamepadStickAxes = { x: 0, y: 0 };

export type InventoryControllerMoveDetail = {
  direction: 1 | -1;
};

export type SpellMenuControllerDirection = "up" | "down" | "left" | "right";

export type SpellMenuControllerNavigateDetail = {
  direction: SpellMenuControllerDirection;
};

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

export function consumeHudControllerPress(
  controllerButtonsRef: HudControllerButtonsRef,
  key: string,
  pressed: boolean,
) {
  const wasPressed = controllerButtonsRef.current[key] ?? false;
  controllerButtonsRef.current[key] = pressed;
  return pressed && !wasPressed;
}

export function consumeHudControllerRepeat(
  controllerButtonsRef: HudControllerButtonsRef,
  controllerRepeatRef: HudControllerRepeatRef,
  key: string,
  pressed: boolean,
  now: number,
  firstDelay = 260,
  repeatDelay = 170,
) {
  const wasPressed = controllerButtonsRef.current[key] ?? false;
  controllerButtonsRef.current[key] = pressed;

  if (!pressed) {
    delete controllerRepeatRef.current[key];
    return false;
  }

  if (!wasPressed) {
    controllerRepeatRef.current[key] = now + firstDelay;
    return true;
  }

  if (now >= (controllerRepeatRef.current[key] ?? 0)) {
    controllerRepeatRef.current[key] = now + repeatDelay;
    return true;
  }

  return false;
}

function readBoundControllerButton(gamepad: Gamepad, button: string) {
  return isGamepadButtonPressed(gamepad, button as GamepadButtonName);
}

export function createHudControllerInputSnapshot(): HudControllerInputSnapshot {
  return {
    leftBumperHeld: false,
    rightBumperHeld: false,
    hotbarModifierHeld: false,
    leftBumperPressed: false,
    rightBumperPressed: false,
    aPressed: false,
    bPressed: false,
    inventoryHeld: false,
    inventoryPressed: false,
    spellMenuHeld: false,
    spellMenuPressed: false,
    interactHeld: false,
    yPressed: false,
    backHeld: false,
    startPressed: false,
    dpadLeft: false,
    dpadRight: false,
    dpadUp: false,
    dpadDown: false,
    movementAxisX: 0,
    movementAxisY: 0,
    menuAxisX: 0,
    menuAxisY: 0,
    scrollAxisY: 0,
  };
}

export function readHudControllerInputSnapshotInto(
  gamepad: Gamepad,
  bindings: HudControllerBindings,
  consumePress: (key: string, pressed: boolean) => boolean,
  target: HudControllerInputSnapshot,
): HudControllerInputSnapshot {
  const leftBumperHeld = readBoundControllerButton(gamepad, bindings.leftHotbar);
  const rightBumperHeld = readBoundControllerButton(gamepad, bindings.rightHotbar);
  const inventoryHeld = readBoundControllerButton(gamepad, bindings.inventory);
  const spellMenuHeld = readBoundControllerButton(gamepad, bindings.spellMenu);

  target.leftBumperHeld = leftBumperHeld;
  target.rightBumperHeld = rightBumperHeld;
  target.hotbarModifierHeld = leftBumperHeld || rightBumperHeld;
  target.leftBumperPressed = consumePress("leftBumper", leftBumperHeld);
  target.rightBumperPressed = consumePress("rightBumper", rightBumperHeld);
  target.aPressed = consumePress("a", readBoundControllerButton(gamepad, bindings.menuSelect));
  target.bPressed = consumePress("b", readBoundControllerButton(gamepad, bindings.menuBack));
  target.inventoryHeld = inventoryHeld;
  target.inventoryPressed = consumePress("inventory", inventoryHeld);
  target.spellMenuHeld = spellMenuHeld;
  target.spellMenuPressed = consumePress("spellMenu", spellMenuHeld);
  target.interactHeld = readBoundControllerButton(gamepad, bindings.interact);
  target.yPressed = consumePress("y", readBoundControllerButton(gamepad, bindings.map));
  target.backHeld = readBoundControllerButton(gamepad, bindings.scoreboard);
  target.startPressed = consumePress("start", readBoundControllerButton(gamepad, bindings.pause));
  target.dpadLeft = isGamepadButtonPressed(gamepad, "dpadLeft");
  target.dpadRight = isGamepadButtonPressed(gamepad, "dpadRight");
  target.dpadUp = isGamepadButtonPressed(gamepad, "dpadUp");
  target.dpadDown = isGamepadButtonPressed(gamepad, "dpadDown");
  readGamepadStickAxesInto(gamepad, "left", hudLeftStickScratch, 0.25);
  target.movementAxisX = hudLeftStickScratch.x;
  target.movementAxisY = hudLeftStickScratch.y;
  readGamepadStickAxesInto(gamepad, "left", hudLeftStickScratch, 0.55);
  target.menuAxisX = hudLeftStickScratch.x;
  target.menuAxisY = hudLeftStickScratch.y;
  readGamepadStickAxesInto(gamepad, "right", hudRightStickScratch, 0.25);
  target.scrollAxisY = hudRightStickScratch.y;
  return target;
}

export function readHudControllerInputSnapshot(
  gamepad: Gamepad,
  bindings: HudControllerBindings,
  consumePress: (key: string, pressed: boolean) => boolean,
): HudControllerInputSnapshot {
  return readHudControllerInputSnapshotInto(
    gamepad,
    bindings,
    consumePress,
    createHudControllerInputSnapshot(),
  );
}

function dispatchHudControllerEvent(event: Event) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return false;
  return window.dispatchEvent(event);
}

function createHudControllerCustomEvent<T>(type: string, detail: T) {
  if (typeof window !== "undefined" && typeof window.CustomEvent === "function") {
    return new window.CustomEvent<T>(type, { detail });
  }
  if (typeof document !== "undefined" && typeof document.createEvent === "function") {
    const event = document.createEvent("CustomEvent");
    event.initCustomEvent(type, false, false, detail);
    return event as CustomEvent<T>;
  }
  return new Event(type) as CustomEvent<T>;
}

export function dispatchInventoryControllerMove(direction: 1 | -1) {
  return dispatchHudControllerEvent(
    createHudControllerCustomEvent<InventoryControllerMoveDetail>("inventory-controller-move", { direction }),
  );
}

export function dispatchInventoryControllerSelect() {
  return dispatchHudControllerEvent(new Event("inventory-controller-select"));
}

export function dispatchInventoryControllerBack() {
  const detail = { handled: false };
  dispatchHudControllerEvent(createHudControllerCustomEvent("inventory-controller-back", detail));
  return detail.handled;
}

export function dispatchSpellMenuControllerScroll(delta: number) {
  return dispatchHudControllerEvent(createHudControllerCustomEvent("spell-menu-controller-scroll", delta));
}

export function dispatchSpellMenuControllerNavigate(direction: SpellMenuControllerDirection) {
  return dispatchHudControllerEvent(
    createHudControllerCustomEvent<SpellMenuControllerNavigateDetail>("spell-menu-controller-navigate", { direction }),
  );
}

export function dispatchSpellMenuControllerSelect() {
  return dispatchHudControllerEvent(new Event("spell-menu-controller-select"));
}

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
