import type { GameplayInputMode } from "./hudGameplayModeRuntime";

export type HudKeyboardMenuDirection = "up" | "down" | "left" | "right";

export type HudKeyboardMenuBlockState = {
  commandConsoleOpen: boolean;
  editableTarget: boolean;
  inventoryOpen: boolean;
  questDialogActive: boolean;
  questNpcEditorActive: boolean;
};

export type HudKeyboardMenuKeyDownOptions = {
  code: string;
  controllerGameplayActive: boolean;
  devFastTravelLocationCount: number;
  fallbackVoiceKey: string;
  isDevFastTravelAllowed: boolean;
  isDevFastTravelOpen: boolean;
  isEngineMenuAllowed: boolean;
  isEngineMenuOpen: boolean;
  isPauseMenuVisible: boolean;
  remappingVoiceKey: boolean;
  repeat: boolean;
  touchGameplayActive: boolean;
};

export type HudKeyboardMenuAction =
  | { type: "none"; preventDefault: false }
  | { type: "cancelVoiceKeyRemap"; preventDefault: true }
  | { type: "setVoiceKey"; preventDefault: true; code: string }
  | { type: "closeEngineMenu"; preventDefault: true }
  | { type: "closeDevFastTravel"; preventDefault: true }
  | { type: "moveDevFastTravel"; preventDefault: true; direction: 1 | -1 }
  | { type: "selectDevFastTravel"; preventDefault: true }
  | { type: "openEngineMenu"; preventDefault: true; inputMode: GameplayInputMode }
  | { type: "openDevFastTravel"; preventDefault: true; inputMode: GameplayInputMode }
  | { type: "setKeyboardScoreboard"; preventDefault: true; open: boolean }
  | { type: "closePauseMenu"; preventDefault: true }
  | { type: "movePauseMenuFocus"; preventDefault: true; direction: HudKeyboardMenuDirection }
  | { type: "consume"; preventDefault: true }
  | { type: "runPauseMenuAction"; preventDefault: true };

export function isHudKeyboardMenuBlocked({
  commandConsoleOpen,
  editableTarget,
  inventoryOpen,
  questDialogActive,
  questNpcEditorActive,
}: HudKeyboardMenuBlockState) {
  return commandConsoleOpen ||
    questNpcEditorActive ||
    questDialogActive ||
    inventoryOpen ||
    editableTarget;
}

export function getHudKeyboardMenuInputMode({
  controllerGameplayActive,
  touchGameplayActive,
}: {
  controllerGameplayActive: boolean;
  touchGameplayActive: boolean;
}): GameplayInputMode {
  if (controllerGameplayActive) return "controller";
  if (touchGameplayActive) return "touch";
  return "mouse";
}

export function resolveHudKeyboardMenuKeyDownAction({
  code,
  controllerGameplayActive,
  devFastTravelLocationCount,
  fallbackVoiceKey,
  isDevFastTravelAllowed,
  isDevFastTravelOpen,
  isEngineMenuAllowed,
  isEngineMenuOpen,
  isPauseMenuVisible,
  remappingVoiceKey,
  repeat,
  touchGameplayActive,
}: HudKeyboardMenuKeyDownOptions): HudKeyboardMenuAction {
  if (remappingVoiceKey) {
    if (code === "Escape") return { type: "cancelVoiceKeyRemap", preventDefault: true };
    return { type: "setVoiceKey", preventDefault: true, code: code || fallbackVoiceKey };
  }

  if (isEngineMenuOpen) {
    if (code === "Escape" || code === "KeyL") return { type: "closeEngineMenu", preventDefault: true };
    return { type: "none", preventDefault: false };
  }

  if (isDevFastTravelOpen) {
    if (code === "Escape" || code === "F8") return { type: "closeDevFastTravel", preventDefault: true };
    if (code === "ArrowDown" || code === "ArrowRight") {
      if (devFastTravelLocationCount <= 0) return { type: "consume", preventDefault: true };
      return { type: "moveDevFastTravel", preventDefault: true, direction: 1 };
    }
    if (code === "ArrowUp" || code === "ArrowLeft") {
      if (devFastTravelLocationCount <= 0) return { type: "consume", preventDefault: true };
      return { type: "moveDevFastTravel", preventDefault: true, direction: -1 };
    }
    if (code === "Enter" || code === "Space") return { type: "selectDevFastTravel", preventDefault: true };
    return { type: "none", preventDefault: false };
  }

  if (code === "KeyL" && !repeat && isEngineMenuAllowed) {
    return {
      type: "openEngineMenu",
      preventDefault: true,
      inputMode: getHudKeyboardMenuInputMode({ controllerGameplayActive, touchGameplayActive }),
    };
  }

  if (code === "F8" && !repeat && isDevFastTravelAllowed) {
    return {
      type: "openDevFastTravel",
      preventDefault: true,
      inputMode: getHudKeyboardMenuInputMode({ controllerGameplayActive, touchGameplayActive }),
    };
  }

  if (code === "Tab") return { type: "setKeyboardScoreboard", preventDefault: true, open: true };
  if (!isPauseMenuVisible) return { type: "none", preventDefault: false };
  if (code === "Escape") return { type: "closePauseMenu", preventDefault: true };
  if (code === "ArrowDown") return { type: "movePauseMenuFocus", preventDefault: true, direction: "down" };
  if (code === "ArrowRight") return { type: "movePauseMenuFocus", preventDefault: true, direction: "right" };
  if (code === "ArrowUp") return { type: "movePauseMenuFocus", preventDefault: true, direction: "up" };
  if (code === "ArrowLeft") return { type: "movePauseMenuFocus", preventDefault: true, direction: "left" };
  if (code === "Space") return { type: "consume", preventDefault: true };
  if (code === "Enter") return { type: "runPauseMenuAction", preventDefault: true };
  return { type: "none", preventDefault: false };
}

export function resolveHudKeyboardMenuKeyUpAction(code: string): HudKeyboardMenuAction {
  if (code === "Tab") return { type: "setKeyboardScoreboard", preventDefault: true, open: false };
  return { type: "none", preventDefault: false };
}
