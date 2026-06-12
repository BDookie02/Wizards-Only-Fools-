export type PlayerGameplayInputGateState = {
  isPauseMenuOpen: boolean;
  isSpellMenuOpen: boolean;
  isMapExpanded: boolean;
  isScoreboardOpen: boolean;
  isInventoryOpen: boolean;
  isAstralMeditating: boolean;
  isTouchControlsActive: boolean;
  isControllerGameplayActive: boolean;
  questNpcEditorTarget: unknown;
  questDialogSession: unknown;
  health: number;
};

export type PlayerGameplayBlockOptions = {
  blockSpellMenu?: boolean;
  blockQuestEditor?: boolean;
  astralActive?: boolean;
};

export function isPlayerGameplayBlocked(
  state: PlayerGameplayInputGateState,
  {
    blockSpellMenu = false,
    blockQuestEditor = true,
    astralActive = state.isAstralMeditating,
  }: PlayerGameplayBlockOptions = {},
) {
  return Boolean(
    state.isPauseMenuOpen ||
      (blockSpellMenu && state.isSpellMenuOpen) ||
      state.isMapExpanded ||
      state.isScoreboardOpen ||
      (blockQuestEditor && state.questNpcEditorTarget) ||
      state.questDialogSession ||
      state.isInventoryOpen ||
      astralActive ||
      state.health <= 0,
  );
}

export type PlayerGameplayInputOptions = PlayerGameplayBlockOptions & {
  mouseGameplayActive: boolean;
  controllerGameplayReady: boolean;
};

export function canUsePlayerGameplayInput(
  state: PlayerGameplayInputGateState,
  {
    mouseGameplayActive,
    controllerGameplayReady,
    ...blockOptions
  }: PlayerGameplayInputOptions,
) {
  const activeInput = Boolean(mouseGameplayActive || state.isTouchControlsActive || controllerGameplayReady);
  return activeInput && !isPlayerGameplayBlocked(state, blockOptions);
}

export type PlayerControllerModeOptions = {
  gamepadConnected: boolean;
  controllerGameplayRequested: boolean;
  astralActive: boolean;
};

export function canUsePlayerControllerMode(
  state: PlayerGameplayInputGateState,
  { gamepadConnected, controllerGameplayRequested, astralActive }: PlayerControllerModeOptions,
) {
  return Boolean(gamepadConnected && controllerGameplayRequested) && !isPlayerGameplayBlocked(state, {
    blockSpellMenu: true,
    blockQuestEditor: false,
    astralActive,
  });
}
