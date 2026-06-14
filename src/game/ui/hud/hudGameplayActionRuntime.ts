export type HudGameplayInputActivityState = {
  controllerGameplayActive: boolean;
  isLocked: boolean;
  pointerLockActive: boolean;
  touchGameplayActive: boolean;
};

export type HudGameplayActionGateState = {
  gameplayInputActive: boolean;
  isInventoryOpen: boolean;
  isMapExpanded: boolean;
  isPauseMenuVisible: boolean;
  isSpellMenuOpen: boolean;
  questDialogActive: boolean;
  questNpcEditorActive: boolean;
  showVideoMenu: boolean;
};

export function isHudGameplayInputActive({
  controllerGameplayActive,
  isLocked,
  pointerLockActive,
  touchGameplayActive,
}: HudGameplayInputActivityState) {
  return isLocked || pointerLockActive || touchGameplayActive || controllerGameplayActive;
}

export function canOpenHudInventoryFromGame({
  gameplayInputActive,
  isMapExpanded,
  isPauseMenuVisible,
  isSpellMenuOpen,
  questDialogActive,
  showVideoMenu,
}: HudGameplayActionGateState) {
  return gameplayInputActive &&
    !isMapExpanded &&
    !showVideoMenu &&
    !isPauseMenuVisible &&
    !isSpellMenuOpen &&
    !questDialogActive;
}

export function canOpenHudSpellMenuFromGame({
  gameplayInputActive,
  isInventoryOpen,
  isMapExpanded,
  isPauseMenuVisible,
  showVideoMenu,
}: HudGameplayActionGateState) {
  return gameplayInputActive &&
    !isMapExpanded &&
    !showVideoMenu &&
    !isPauseMenuVisible &&
    !isInventoryOpen;
}

export function canToggleHudMagicFromGame({
  gameplayInputActive,
  isInventoryOpen,
  isMapExpanded,
  isPauseMenuVisible,
  isSpellMenuOpen,
  questDialogActive,
  showVideoMenu,
}: HudGameplayActionGateState) {
  return gameplayInputActive &&
    !isMapExpanded &&
    !showVideoMenu &&
    !isPauseMenuVisible &&
    !isInventoryOpen &&
    !isSpellMenuOpen &&
    !questDialogActive;
}

export function canRequestHudVillagerInteractionFromGame({
  gameplayInputActive,
  isInventoryOpen,
  isMapExpanded,
  isPauseMenuVisible,
  isSpellMenuOpen,
  questDialogActive,
  questNpcEditorActive,
  showVideoMenu,
}: HudGameplayActionGateState) {
  return gameplayInputActive &&
    !isMapExpanded &&
    !showVideoMenu &&
    !isPauseMenuVisible &&
    !isInventoryOpen &&
    !isSpellMenuOpen &&
    !questDialogActive &&
    !questNpcEditorActive;
}
