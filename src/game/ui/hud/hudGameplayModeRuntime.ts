export type GameplayInputMode = "mouse" | "touch" | "controller";

export const HUD_TOUCH_TAKEOVER_COOLDOWN_MS = 48;

export type HudPauseInputModeOptions = {
  controllerGameplayActive: boolean;
  touchGameplayActive: boolean;
};

export type HudTouchGameplayTakeoverBlockOptions = {
  commandConsoleOpen: boolean;
  devFastTravelOpen: boolean;
  engineMenuOpen: boolean;
  hasLocalPlayerName: boolean;
  health: number;
  inventoryOpen: boolean;
  isGameLaunched: boolean;
  mapExpanded: boolean;
  pauseMenuVisible: boolean;
  questDialogOpen: boolean;
  questNpcEditorOpen: boolean;
  remappingActionActive: boolean;
  remappingVoiceKey: boolean;
  returningToGame: boolean;
  scoreboardOpen: boolean;
  showVideoMenu: boolean;
  spellMenuOpen: boolean;
};

export type HudTouchGameplayTakeoverAction =
  | { type: "none" }
  | { type: "start"; nextLastTouchTakeoverAtMs: number };

export type HudTouchGameplayTakeoverActionOptions = {
  blocked: boolean;
  cooldownMs?: number;
  lastGameplayInputMode: GameplayInputMode;
  lastTouchTakeoverAtMs: number;
  nowMs: number;
  targetEditable: boolean;
  touchControlsActive: boolean;
};

export function getHudPauseInputMode({
  controllerGameplayActive,
  touchGameplayActive,
}: HudPauseInputModeOptions): GameplayInputMode {
  if (touchGameplayActive) return "touch";
  if (controllerGameplayActive) return "controller";
  return "mouse";
}

export function getHudGameplayModeNowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function isHudTouchGameplayTakeoverBlocked({
  commandConsoleOpen,
  devFastTravelOpen,
  engineMenuOpen,
  hasLocalPlayerName,
  health,
  inventoryOpen,
  isGameLaunched,
  mapExpanded,
  pauseMenuVisible,
  questDialogOpen,
  questNpcEditorOpen,
  remappingActionActive,
  remappingVoiceKey,
  returningToGame,
  scoreboardOpen,
  showVideoMenu,
  spellMenuOpen,
}: HudTouchGameplayTakeoverBlockOptions) {
  return (
    !isGameLaunched ||
    !hasLocalPlayerName ||
    health <= 0 ||
    spellMenuOpen ||
    inventoryOpen ||
    mapExpanded ||
    scoreboardOpen ||
    questNpcEditorOpen ||
    questDialogOpen ||
    commandConsoleOpen ||
    devFastTravelOpen ||
    engineMenuOpen ||
    pauseMenuVisible ||
    returningToGame ||
    showVideoMenu ||
    remappingActionActive ||
    remappingVoiceKey
  );
}

export function resolveHudTouchGameplayTakeoverAction({
  blocked,
  cooldownMs = HUD_TOUCH_TAKEOVER_COOLDOWN_MS,
  lastGameplayInputMode,
  lastTouchTakeoverAtMs,
  nowMs,
  targetEditable,
  touchControlsActive,
}: HudTouchGameplayTakeoverActionOptions): HudTouchGameplayTakeoverAction {
  if (targetEditable || blocked) return { type: "none" };
  if (touchControlsActive && lastGameplayInputMode === "touch") return { type: "none" };
  if (nowMs - lastTouchTakeoverAtMs < cooldownMs) return { type: "none" };
  return { type: "start", nextLastTouchTakeoverAtMs: nowMs };
}
