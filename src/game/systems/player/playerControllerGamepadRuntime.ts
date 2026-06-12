import type { ControllerAction, ControllerButtonName } from "../../../store/gameStore";
import {
  isGamepadButtonPressed,
  readGamepadStickAxesInto,
  type GamepadStickAxes,
} from "../input/controllerInput";
import { areControllerGameplayButtonsReleased } from "../input/playerInputState";

type BooleanRef = { current: boolean };

export type PlayerControllerGamepadBindings = Record<ControllerAction, ControllerButtonName>;

export type PlayerControllerGamepadArmingRefs = {
  controllerGameplayArmed: BooleanRef;
  keyboardJumpWasPressed: BooleanRef;
  controllerJumpWasPressed: BooleanRef;
  controllerSprintWasPressed: BooleanRef;
};

export type PlayerControllerGamepadMovementRefs = {
  jumpWasPressed: BooleanRef;
  sprintWasPressed: BooleanRef;
};

export type PlayerControllerGamepadLookInput = {
  lookX: number;
  lookY: number;
};

export type PlayerControllerGamepadMovementInput = {
  moveX: number;
  moveZ: number;
  slideHeld: boolean;
  jumpHeld: boolean;
  jumpPressed: boolean;
  sprintHeld: boolean;
  sprintPressed: boolean;
};

const lookStickScratch: GamepadStickAxes = { x: 0, y: 0 };
const moveStickScratch: GamepadStickAxes = { x: 0, y: 0 };

export function createPlayerControllerGamepadLookInput(): PlayerControllerGamepadLookInput {
  return {
    lookX: 0,
    lookY: 0,
  };
}

export function createPlayerControllerGamepadMovementInput(): PlayerControllerGamepadMovementInput {
  return {
    moveX: 0,
    moveZ: 0,
    slideHeld: false,
    jumpHeld: false,
    jumpPressed: false,
    sprintHeld: false,
    sprintPressed: false,
  };
}

export function updatePlayerControllerGamepadArming({
  gamepad,
  controllerGameplayRequested,
  controllerModeReady,
  controllerBindings,
  refs,
}: {
  gamepad: Gamepad | null;
  controllerGameplayRequested: boolean;
  controllerModeReady: boolean;
  controllerBindings: PlayerControllerGamepadBindings;
  refs: PlayerControllerGamepadArmingRefs;
}) {
  if (!controllerGameplayRequested) {
    refs.controllerGameplayArmed.current = false;
  } else if (
    controllerModeReady &&
    !refs.controllerGameplayArmed.current &&
    areControllerGameplayButtonsReleased(gamepad, controllerBindings)
  ) {
    refs.controllerGameplayArmed.current = true;
    refs.keyboardJumpWasPressed.current = false;
    refs.controllerJumpWasPressed.current = false;
    refs.controllerSprintWasPressed.current = false;
  }

  return controllerModeReady && refs.controllerGameplayArmed.current;
}

export function readPlayerControllerGamepadLookInput({
  gamepad,
  controllerInputActive,
  target,
}: {
  gamepad: Gamepad | null;
  controllerInputActive: boolean;
  target: PlayerControllerGamepadLookInput;
}) {
  readGamepadStickAxesInto(controllerInputActive ? gamepad : null, "right", lookStickScratch);
  target.lookX = lookStickScratch.x;
  target.lookY = lookStickScratch.y;
  return target;
}

export function readPlayerControllerGamepadMovementInput({
  gamepad,
  controllerInputActive,
  controllerBindings,
  refs,
  target,
}: {
  gamepad: Gamepad | null;
  controllerInputActive: boolean;
  controllerBindings: PlayerControllerGamepadBindings;
  refs: PlayerControllerGamepadMovementRefs;
  target: PlayerControllerGamepadMovementInput;
}) {
  readGamepadStickAxesInto(controllerInputActive ? gamepad : null, "left", moveStickScratch);
  target.moveX = moveStickScratch.x;
  target.moveZ = moveStickScratch.y;
  target.slideHeld = controllerInputActive && isGamepadButtonPressed(gamepad, controllerBindings.slide);
  target.jumpHeld = controllerInputActive && isGamepadButtonPressed(gamepad, controllerBindings.jump);
  target.jumpPressed = target.jumpHeld && !refs.jumpWasPressed.current;
  refs.jumpWasPressed.current = target.jumpHeld;
  target.sprintHeld = controllerInputActive && isGamepadButtonPressed(gamepad, controllerBindings.sprint);
  target.sprintPressed = target.sprintHeld && !refs.sprintWasPressed.current;
  refs.sprintWasPressed.current = target.sprintHeld;
  return target;
}
