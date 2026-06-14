export type HudSurfaceVisibilityState = {
  isEngineMenuOpen: boolean;
  isInventoryOpen: boolean;
  isMapExpanded: boolean;
  isScoreboardOpen: boolean;
  isSpellMenuOpen: boolean;
  questDialogActive: boolean;
  questNpcEditorActive: boolean;
};

export type HudGameplaySurfaceVisibilityInput = HudSurfaceVisibilityState & {
  isDevFastTravelOpen: boolean;
  isMagicArmed: boolean;
  playerMeditating: boolean;
  shouldHideGameplayHudForQa: boolean;
  shouldHideGameplayViewObstructionsForQa: boolean;
  shouldRenderGameplayHud: boolean;
  touchGameplayActive: boolean;
};

export type HudGameplaySurfaceVisibility = {
  shouldExpectMagicHands: boolean;
  shouldShowGameplayOverlay: boolean;
  shouldShowMagicHands: boolean;
  shouldShowTouchControls: boolean;
  shouldSuppressMapForHudToolOverlay: boolean;
};

export type HudLayoutQaVisibilityInput = HudSurfaceVisibilityState & {
  isDevFastTravelOpen: boolean;
  isEngineMenuAllowed: boolean;
  isGameLaunched: boolean;
  isPauseMenuVisible: boolean;
  shouldExpectMagicHands: boolean;
  shouldShowGameplayOverlay: boolean;
  shouldShowMenuOverlay: boolean;
  shouldShowTouchControls: boolean;
  showVideoMenu: boolean;
};

export type HudLayoutQaVisibilityOptions = {
  compactMapVisible: boolean;
  engineMenuVisible: boolean;
  expandedMapVisible: boolean;
  gameplayHudVisible: boolean;
  inventoryVisible: boolean;
  magicHandsVisible: boolean;
  questDialogVisible: boolean;
  questNpcEditorVisible: boolean;
  scoreboardVisible: boolean;
  settingsPanelVisible: boolean;
  spellMenuVisible: boolean;
  touchControlsVisible: boolean;
};

export function isHudGameplaySurfaceBlocked({
  isEngineMenuOpen,
  isInventoryOpen,
  isMapExpanded,
  isScoreboardOpen,
  isSpellMenuOpen,
  questDialogActive,
  questNpcEditorActive,
}: HudSurfaceVisibilityState) {
  return isSpellMenuOpen ||
    isInventoryOpen ||
    isMapExpanded ||
    isScoreboardOpen ||
    isEngineMenuOpen ||
    questNpcEditorActive ||
    questDialogActive;
}

export function resolveHudGameplaySurfaceVisibility(input: HudGameplaySurfaceVisibilityInput): HudGameplaySurfaceVisibility {
  const gameplaySurfaceBlocked = isHudGameplaySurfaceBlocked(input);
  const shouldShowMagicHands = input.shouldRenderGameplayHud &&
    !input.shouldHideGameplayViewObstructionsForQa &&
    !gameplaySurfaceBlocked &&
    !input.isDevFastTravelOpen;
  const shouldShowTouchControls = input.touchGameplayActive &&
    !input.shouldHideGameplayHudForQa &&
    !gameplaySurfaceBlocked;
  const shouldShowGameplayOverlay = input.shouldRenderGameplayHud &&
    !input.shouldHideGameplayHudForQa &&
    !gameplaySurfaceBlocked;
  const shouldSuppressMapForHudToolOverlay = input.isEngineMenuOpen ||
    input.isDevFastTravelOpen ||
    input.questNpcEditorActive ||
    input.questDialogActive;

  return {
    shouldShowMagicHands,
    shouldExpectMagicHands: shouldShowMagicHands && input.isMagicArmed && !input.playerMeditating,
    shouldShowTouchControls,
    shouldShowGameplayOverlay,
    shouldSuppressMapForHudToolOverlay,
  };
}

function isHudMapQaSurfaceVisible({
  isDevFastTravelOpen,
  isEngineMenuOpen,
  isGameLaunched,
  isInventoryOpen,
  isPauseMenuVisible,
  isScoreboardOpen,
  isSpellMenuOpen,
  questDialogActive,
  questNpcEditorActive,
}: HudLayoutQaVisibilityInput) {
  return isGameLaunched &&
    !isSpellMenuOpen &&
    !isPauseMenuVisible &&
    !isScoreboardOpen &&
    !isEngineMenuOpen &&
    !isDevFastTravelOpen &&
    !isInventoryOpen &&
    !questNpcEditorActive &&
    !questDialogActive;
}

export function resolveHudLayoutQaVisibilityOptions(input: HudLayoutQaVisibilityInput): HudLayoutQaVisibilityOptions {
  const mapQaSurfaceVisible = isHudMapQaSurfaceVisible(input);

  return {
    gameplayHudVisible: input.shouldShowGameplayOverlay,
    magicHandsVisible: input.shouldExpectMagicHands,
    touchControlsVisible: input.shouldShowTouchControls,
    compactMapVisible: mapQaSurfaceVisible && !input.isMapExpanded,
    expandedMapVisible: mapQaSurfaceVisible && input.isMapExpanded,
    spellMenuVisible: input.isSpellMenuOpen,
    settingsPanelVisible: input.showVideoMenu && input.shouldShowMenuOverlay,
    engineMenuVisible: input.isEngineMenuOpen && input.isEngineMenuAllowed,
    inventoryVisible: input.isInventoryOpen && !input.isSpellMenuOpen,
    questNpcEditorVisible: input.questNpcEditorActive,
    questDialogVisible: input.questDialogActive,
    scoreboardVisible: input.isScoreboardOpen && !input.isSpellMenuOpen && !input.isInventoryOpen,
  };
}
