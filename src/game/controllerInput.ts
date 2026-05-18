export type GamepadButtonName =
  | "a"
  | "b"
  | "x"
  | "y"
  | "leftBumper"
  | "rightBumper"
  | "leftTrigger"
  | "rightTrigger"
  | "back"
  | "start"
  | "leftStick"
  | "rightStick"
  | "dpadUp"
  | "dpadDown"
  | "dpadLeft"
  | "dpadRight";

const BUTTON_INDEX: Record<GamepadButtonName, number> = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
  leftBumper: 4,
  rightBumper: 5,
  leftTrigger: 6,
  rightTrigger: 7,
  back: 8,
  start: 9,
  leftStick: 10,
  rightStick: 11,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
};

export const GAMEPAD_STICK_DEADZONE = 0.22;
export const GAMEPAD_TRIGGER_THRESHOLD = 0.45;

let preferredGamepadIndex: number | null = null;

function getGamepadActivity(gamepad: Gamepad) {
  const axisActivity = gamepad.axes.reduce((sum, axis) => sum + Math.abs(applyGamepadDeadzone(axis ?? 0, 0.18)), 0);
  const buttonActivity = gamepad.buttons.reduce((sum, button) => sum + (button.pressed || button.value >= GAMEPAD_TRIGGER_THRESHOLD ? 1 : 0), 0);
  return axisActivity + buttonActivity;
}

export function getPrimaryGamepad() {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") {
    return null;
  }

  const gamepads = Array.from(navigator.getGamepads()).filter((gamepad): gamepad is Gamepad => Boolean(gamepad?.connected));
  if (gamepads.length === 0) {
    preferredGamepadIndex = null;
    return null;
  }

  const activeGamepad = gamepads
    .map((gamepad) => ({ gamepad, activity: getGamepadActivity(gamepad) }))
    .filter(({ activity }) => activity > 0.02)
    .sort((a, b) => b.activity - a.activity)[0]?.gamepad;

  if (activeGamepad) {
    preferredGamepadIndex = activeGamepad.index;
    return activeGamepad;
  }

  const preferredGamepad = preferredGamepadIndex === null
    ? null
    : gamepads.find((gamepad) => gamepad.index === preferredGamepadIndex) ?? null;
  if (preferredGamepad) return preferredGamepad;

  return gamepads.find((gamepad) => gamepad.mapping === "standard") ?? gamepads[0] ?? null;
}

export function applyGamepadDeadzone(value: number, deadzone = GAMEPAD_STICK_DEADZONE) {
  const magnitude = Math.abs(value);
  if (magnitude <= deadzone) return 0;
  return Math.sign(value) * ((magnitude - deadzone) / (1 - deadzone));
}

export function getGamepadAxis(gamepad: Gamepad | null, axisIndex: number, deadzone = GAMEPAD_STICK_DEADZONE) {
  if (!gamepad) return 0;
  return applyGamepadDeadzone(gamepad.axes[axisIndex] ?? 0, deadzone);
}

export function getGamepadButtonValue(gamepad: Gamepad | null, button: GamepadButtonName) {
  if (!gamepad) return 0;
  return gamepad.buttons[BUTTON_INDEX[button]]?.value ?? 0;
}

export function isGamepadButtonPressed(
  gamepad: Gamepad | null,
  button: GamepadButtonName,
  threshold = GAMEPAD_TRIGGER_THRESHOLD
) {
  if (!gamepad) return false;
  const gamepadButton = gamepad.buttons[BUTTON_INDEX[button]];
  return Boolean(gamepadButton?.pressed || (gamepadButton?.value ?? 0) >= threshold);
}
