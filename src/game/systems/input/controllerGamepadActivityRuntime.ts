import {
  GAMEPAD_STICK_DEADZONE,
  GAMEPAD_TRIGGER_THRESHOLD,
  applyGamepadDeadzone,
  readGamepadStickAxesInto,
  type GamepadStickAxes,
} from "./controllerInputRuntime";

const GAMEPAD_ACTIVITY_LEFT_STICK_SCRATCH: GamepadStickAxes = { x: 0, y: 0 };
const GAMEPAD_ACTIVITY_RIGHT_STICK_SCRATCH: GamepadStickAxes = { x: 0, y: 0 };

export function getGamepadActivity(gamepad: Gamepad) {
  let axisActivity = 0;
  for (let index = 0; index < gamepad.axes.length; index += 1) {
    axisActivity += Math.abs(applyGamepadDeadzone(gamepad.axes[index] ?? 0, 0.18));
  }

  let buttonActivity = 0;
  for (let index = 0; index < gamepad.buttons.length; index += 1) {
    const button = gamepad.buttons[index];
    if (button.pressed || button.value >= GAMEPAD_TRIGGER_THRESHOLD) {
      buttonActivity += 1;
    }
  }

  return axisActivity + buttonActivity;
}

export function hasGamepadInput(gamepad: Gamepad | null, axisDeadzone = GAMEPAD_STICK_DEADZONE) {
  if (!gamepad) return false;

  readGamepadStickAxesInto(gamepad, "left", GAMEPAD_ACTIVITY_LEFT_STICK_SCRATCH, axisDeadzone);
  if (
    Math.abs(GAMEPAD_ACTIVITY_LEFT_STICK_SCRATCH.x) > 0 ||
    Math.abs(GAMEPAD_ACTIVITY_LEFT_STICK_SCRATCH.y) > 0
  ) {
    return true;
  }

  readGamepadStickAxesInto(gamepad, "right", GAMEPAD_ACTIVITY_RIGHT_STICK_SCRATCH, axisDeadzone);
  if (
    Math.abs(GAMEPAD_ACTIVITY_RIGHT_STICK_SCRATCH.x) > 0 ||
    Math.abs(GAMEPAD_ACTIVITY_RIGHT_STICK_SCRATCH.y) > 0
  ) {
    return true;
  }

  for (let index = 0; index < gamepad.buttons.length; index += 1) {
    const button = gamepad.buttons[index];
    if (button?.pressed || (button?.value ?? 0) >= GAMEPAD_TRIGGER_THRESHOLD) {
      return true;
    }
  }

  return false;
}
