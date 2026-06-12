import {
  DEFAULT_CONTROLLER_LOOK_SENSITIVITY,
  DEFAULT_MOUSE_SENSITIVITY,
} from "../../../store/gameStore";
import {
  CONTROLLER_LOOK_VERTICAL_MULTIPLIER,
  KEYBOARD_ARROW_LOOK_SPEED,
  KEYBOARD_ARROW_LOOK_VERTICAL_MULTIPLIER,
} from "./playerMovementConfig";

export type PlayerLookInputFrame = {
  controllerYawDelta: number;
  controllerPitchDelta: number;
  touchYawDelta: number;
  touchPitchDelta: number;
  keyboardYawDelta: number;
  keyboardPitchDelta: number;
  clearTouchLook: boolean;
};

export type PlayerLookInputAllowedOptions = {
  isSpellMenuOpen: boolean;
  questDialogActive: boolean;
  isInventoryOpen: boolean;
  gameplayInputActive: boolean;
  sleepActive: boolean;
};

export type ResolvePlayerLookInputFrameOptions = {
  deltaSeconds: number;
  lookInputAllowed: boolean;
  controllerLookX: number;
  controllerLookY: number;
  controllerLookSensitivity: number;
  touchControlsActive: boolean;
  touchLookX: number;
  touchLookY: number;
  mouseGameplayRequested: boolean;
  mouseSensitivity: number;
  keyboardArrowLookEnabled: boolean;
  isPauseMenuOpen: boolean;
  isSpellMenuOpen: boolean;
  questDialogActive: boolean;
  isInventoryOpen: boolean;
  isMapExpanded: boolean;
  isScoreboardOpen: boolean;
  arrowRight: boolean;
  arrowLeft: boolean;
  arrowDown: boolean;
  arrowUp: boolean;
};

export type ApplyPlayerLookDelta = (yawDelta: number, pitchDelta: number) => void;

export function createPlayerLookInputFrame(): PlayerLookInputFrame {
  return {
    controllerYawDelta: 0,
    controllerPitchDelta: 0,
    touchYawDelta: 0,
    touchPitchDelta: 0,
    keyboardYawDelta: 0,
    keyboardPitchDelta: 0,
    clearTouchLook: false,
  };
}

export function isPlayerLookInputAllowed({
  isSpellMenuOpen,
  questDialogActive,
  isInventoryOpen,
  gameplayInputActive,
  sleepActive,
}: PlayerLookInputAllowedOptions) {
  return !isSpellMenuOpen && !questDialogActive && !isInventoryOpen && gameplayInputActive && !sleepActive;
}

export function resolvePlayerLookInputFrame(
  options: ResolvePlayerLookInputFrameOptions,
  target: PlayerLookInputFrame,
) {
  target.controllerYawDelta = 0;
  target.controllerPitchDelta = 0;
  target.touchYawDelta = 0;
  target.touchPitchDelta = 0;
  target.keyboardYawDelta = 0;
  target.keyboardPitchDelta = 0;
  target.clearTouchLook = false;

  if (!options.lookInputAllowed) return target;

  if (options.controllerLookX !== 0 || options.controllerLookY !== 0) {
    const lookSensitivity = options.controllerLookSensitivity || DEFAULT_CONTROLLER_LOOK_SENSITIVITY;
    target.controllerYawDelta = -options.controllerLookX * lookSensitivity * options.deltaSeconds;
    target.controllerPitchDelta = -options.controllerLookY * lookSensitivity * CONTROLLER_LOOK_VERTICAL_MULTIPLIER * options.deltaSeconds;
  }

  if (options.touchControlsActive && (options.touchLookX !== 0 || options.touchLookY !== 0)) {
    const touchLookSensitivity = options.mouseSensitivity || DEFAULT_MOUSE_SENSITIVITY;
    target.touchYawDelta = -options.touchLookX * touchLookSensitivity;
    target.touchPitchDelta = -options.touchLookY * touchLookSensitivity;
    target.clearTouchLook = true;
  }

  if (
    options.keyboardArrowLookEnabled &&
    (options.mouseGameplayRequested || options.touchControlsActive) &&
    !options.isPauseMenuOpen &&
    !options.isSpellMenuOpen &&
    !options.questDialogActive &&
    !options.isInventoryOpen &&
    !options.isMapExpanded &&
    !options.isScoreboardOpen
  ) {
    const arrowLookX = (options.arrowRight ? 1 : 0) - (options.arrowLeft ? 1 : 0);
    const arrowLookY = (options.arrowDown ? 1 : 0) - (options.arrowUp ? 1 : 0);
    if (arrowLookX !== 0 || arrowLookY !== 0) {
      const keyboardLookSensitivity =
        ((options.mouseSensitivity || DEFAULT_MOUSE_SENSITIVITY) / DEFAULT_MOUSE_SENSITIVITY) *
        KEYBOARD_ARROW_LOOK_SPEED;
      target.keyboardYawDelta = -arrowLookX * keyboardLookSensitivity * options.deltaSeconds;
      target.keyboardPitchDelta =
        -arrowLookY *
        keyboardLookSensitivity *
        KEYBOARD_ARROW_LOOK_VERTICAL_MULTIPLIER *
        options.deltaSeconds;
    }
  }

  return target;
}

export function applyPlayerLookInputFrame(
  frame: PlayerLookInputFrame,
  applyLookDelta: ApplyPlayerLookDelta,
) {
  if (frame.controllerYawDelta !== 0 || frame.controllerPitchDelta !== 0) {
    applyLookDelta(frame.controllerYawDelta, frame.controllerPitchDelta);
  }
  if (frame.touchYawDelta !== 0 || frame.touchPitchDelta !== 0) {
    applyLookDelta(frame.touchYawDelta, frame.touchPitchDelta);
  }
  if (frame.keyboardYawDelta !== 0 || frame.keyboardPitchDelta !== 0) {
    applyLookDelta(frame.keyboardYawDelta, frame.keyboardPitchDelta);
  }
}
