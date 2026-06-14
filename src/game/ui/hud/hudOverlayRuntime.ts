import type { CSSProperties } from "react";
import type { StartMenuStage } from "./PauseStartMenuContent";

export const HUD_ROOT_STYLE = {
  containerType: "size",
} as CSSProperties;

const HUD_FILL_SAFE_FRAME_STYLE = {
  width: "min(100cqw, calc(100cqh * 16 / 9))",
  height: "min(100cqh, calc(100cqw * 9 / 16))",
} as CSSProperties;

const HUD_MENU_OVERLAY_BASE_STYLE = {
  containerType: "size",
  width: "var(--app-vw, 100dvw)",
  height: "var(--app-vh, 100dvh)",
  maxWidth: "var(--app-vw, 100dvw)",
  maxHeight: "var(--app-vh, 100dvh)",
  overflow: "hidden",
} as CSSProperties;

export type HudMenuOverlayStateInput = {
  isCommandConsoleOpen: boolean;
  isGameLaunched: boolean;
  isGameplayActive: boolean;
  isInventoryOpen: boolean;
  isMenuOverlaySuppressedForQa: boolean;
  isPauseOverlayOpen: boolean;
  isReturningToGame: boolean;
  isSpellMenuOpen: boolean;
  mouseGameplayActive: boolean;
  pauseMenuExplicitlyRequested: boolean;
  pauseMenuRequested: boolean;
  questDialogActive: boolean;
  questNpcEditorActive: boolean;
  showVideoMenu: boolean;
  startMenuStage: StartMenuStage;
};

export type HudMenuOverlayState = {
  isResumePauseOverlayRequested: boolean;
  menuOverlayStyle: CSSProperties;
  shouldRenderGameplayHud: boolean;
  shouldShowMenuOverlay: boolean;
};

export type HudOverlayResumeClickOptions = {
  canLock: boolean;
  isInventoryOpen: boolean;
  isTouchDevice: boolean;
  questDialogActive: boolean;
  showVideoMenu: boolean;
  startMenuStage: StartMenuStage;
  targetBlocksResume: boolean;
  targetEditable: boolean;
};

export type HudOverlayResumeClickAction =
  | { type: "none" }
  | { type: "startTouchGameplay" }
  | { type: "closePauseMenuWithMouse" };

export function getHudFillSafeFrameStyle(aspectRatio: string) {
  return aspectRatio === "Fill" ? HUD_FILL_SAFE_FRAME_STYLE : undefined;
}

export function resolveHudMenuOverlayState(input: HudMenuOverlayStateInput): HudMenuOverlayState {
  const isResumePauseOverlayRequested = input.isGameLaunched &&
    input.startMenuStage === "resume" &&
    (
      (
        input.isPauseOverlayOpen &&
        input.pauseMenuRequested &&
        (!input.isMenuOverlaySuppressedForQa || input.pauseMenuExplicitlyRequested)
      ) ||
      input.showVideoMenu
    ) &&
    !input.mouseGameplayActive;

  const shouldShowMenuOverlay = (!input.isMenuOverlaySuppressedForQa || isResumePauseOverlayRequested) &&
    !input.isCommandConsoleOpen &&
    !input.isSpellMenuOpen &&
    !input.questNpcEditorActive &&
    !input.questDialogActive &&
    !input.isInventoryOpen &&
    !input.isReturningToGame &&
    (
      isResumePauseOverlayRequested ||
      ((!input.isGameLaunched || input.startMenuStage !== "resume") && !input.isGameplayActive)
    );

  const shouldRenderGameplayHud = input.isGameplayActive ||
    input.isReturningToGame ||
    (input.isGameLaunched && input.startMenuStage === "resume" && !shouldShowMenuOverlay);

  return {
    isResumePauseOverlayRequested,
    shouldShowMenuOverlay,
    shouldRenderGameplayHud,
    menuOverlayStyle: {
      ...HUD_MENU_OVERLAY_BASE_STYLE,
      display: shouldShowMenuOverlay ? "flex" : "none",
    },
  };
}

export function resolveHudDeveloperToolAccess({
  gameMode,
  isDevBuild,
  isQuestDevModeEnabled,
  isSurvivalMode,
}: {
  gameMode: string;
  isDevBuild: boolean;
  isQuestDevModeEnabled: boolean;
  isSurvivalMode: boolean;
}) {
  const areDeveloperToolsAllowed = isSurvivalMode && (
    isDevBuild ||
    isQuestDevModeEnabled ||
    gameMode === "creative"
  );

  return {
    areDeveloperToolsAllowed,
    isDevFastTravelAllowed: areDeveloperToolsAllowed,
    isEngineMenuAllowed: areDeveloperToolsAllowed,
  };
}

export function getHudMainMenuActionCount(startMenuStage: StartMenuStage, resumeMenuActionCount: number) {
  switch (startMenuStage) {
    case "press-start":
      return 1;
    case "mode-select":
      return 2;
    case "multiplayer-select":
      return 3;
    case "custom-lobby":
      return 8;
    case "survival-options":
      return 7;
    case "resume":
    default:
      return resumeMenuActionCount;
  }
}

export function resolveHudOverlayResumeClickAction({
  canLock,
  isInventoryOpen,
  isTouchDevice,
  questDialogActive,
  showVideoMenu,
  startMenuStage,
  targetBlocksResume,
  targetEditable,
}: HudOverlayResumeClickOptions): HudOverlayResumeClickAction {
  if (questDialogActive || isInventoryOpen) return { type: "none" };
  if (showVideoMenu || startMenuStage !== "resume" || !canLock) return { type: "none" };
  if (targetEditable || targetBlocksResume) return { type: "none" };
  if (isTouchDevice) return { type: "startTouchGameplay" };
  return { type: "closePauseMenuWithMouse" };
}
