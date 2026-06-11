import { setMouseLookFallbackActive } from "../../systems/input/browserDisplayMode";
import {
  dispatchHudGameplayModalOpened,
  exitPointerLockIfActive,
  isHudMouseLookFallbackActive,
  isPointerLockActive,
  setHudMouseGameplayActive,
} from "./hudMouseGameplayRuntime";

type BooleanRef = {
  current: boolean;
};

export type HudCommandConsoleOpenOptions = {
  isGameLaunched: boolean;
  isCommandConsoleOpen: boolean;
  isSpellMenuOpen: boolean;
  isInventoryOpen: boolean;
  isTouchDevice: boolean;
  hasQuestNpcEditorTarget: boolean;
  hasQuestDialogSession: boolean;
  shouldRelockRef: BooleanRef;
  setKeyboardScoreboardOpen: (open: boolean) => void;
  setControllerScoreboardOpen: (open: boolean) => void;
  setControllerGameplayActive: (active: boolean) => void;
  setShowVideoMenu: (open: boolean) => void;
  setCommandConsoleValue: (value: string) => void;
  setCommandConsoleOpen: (open: boolean) => void;
  setIsLocked: (locked: boolean) => void;
};

export type HudCommandConsoleCloseOptions = {
  resumeGameplay?: boolean;
  shouldRelockRef: BooleanRef;
  setCommandConsoleOpen: (open: boolean) => void;
  setCommandConsoleValue: (value: string) => void;
  setIsReturningToGame: (returning: boolean) => void;
  requestGamePointerLock: () => void;
};

export function openHudCommandConsole({
  isGameLaunched,
  isCommandConsoleOpen,
  isSpellMenuOpen,
  isInventoryOpen,
  isTouchDevice,
  hasQuestNpcEditorTarget,
  hasQuestDialogSession,
  shouldRelockRef,
  setKeyboardScoreboardOpen,
  setControllerScoreboardOpen,
  setControllerGameplayActive,
  setShowVideoMenu,
  setCommandConsoleValue,
  setCommandConsoleOpen,
  setIsLocked,
}: HudCommandConsoleOpenOptions) {
  if (
    !isGameLaunched ||
    isCommandConsoleOpen ||
    isSpellMenuOpen ||
    hasQuestNpcEditorTarget ||
    hasQuestDialogSession ||
    isInventoryOpen
  ) {
    return false;
  }

  shouldRelockRef.current = Boolean(
    (isPointerLockActive() || isHudMouseLookFallbackActive()) && !isTouchDevice
  );
  setKeyboardScoreboardOpen(false);
  setControllerScoreboardOpen(false);
  setControllerGameplayActive(false);
  setShowVideoMenu(false);
  setCommandConsoleValue("/");
  setCommandConsoleOpen(true);
  setHudMouseGameplayActive(false);
  setMouseLookFallbackActive(false);
  setIsLocked(false);
  dispatchHudGameplayModalOpened();
  exitPointerLockIfActive();

  return true;
}

export function closeHudCommandConsole({
  resumeGameplay = true,
  shouldRelockRef,
  setCommandConsoleOpen,
  setCommandConsoleValue,
  setIsReturningToGame,
  requestGamePointerLock,
}: HudCommandConsoleCloseOptions) {
  setCommandConsoleOpen(false);
  setCommandConsoleValue("/");

  if (resumeGameplay && shouldRelockRef.current) {
    setIsReturningToGame(true);
    window.setTimeout(requestGamePointerLock, 0);
  }

  shouldRelockRef.current = false;
}
