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

export type HudControllerPressReader = (key: string, pressed: boolean) => boolean;

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

const HUD_CONTROLLER_OVERLAY_SCROLL_THRESHOLD = 0.05;
const HUD_CONTROLLER_OVERLAY_SCROLL_MULTIPLIER = 18;

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
