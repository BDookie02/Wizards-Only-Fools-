import {
  GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS,
  isGamepadButtonPressed,
  type GamepadButtonName,
} from "../../systems/input/controllerInput";

type Ref<T> = {
  current: T;
};

export type HudControllerLastSeenRef = Ref<number>;

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

const HUD_CONTROLLER_DISCONNECT_PAUSE_MS = 1200;

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

  if (!isTouchControlsActive && isControllerGameplayActive && lastGameplayInputMode === "controller") {
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
