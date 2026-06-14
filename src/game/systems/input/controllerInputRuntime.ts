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

export type GamepadStickName = "left" | "right";

export type GamepadStickAxes = {
  x: number;
  y: number;
};

type GamepadAxisPair = readonly [number, number];

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

const LEFT_STICK_AXIS_CANDIDATES: readonly GamepadAxisPair[] = [[0, 1]];
const RIGHT_STICK_AXIS_CANDIDATES: readonly GamepadAxisPair[] = [[2, 3]];

export const GAMEPAD_STICK_DEADZONE = 0.22;
export const GAMEPAD_TRIGGER_THRESHOLD = 0.45;
export const GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS = 120;

export function getGamepadScanNowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
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

export function readGamepadStickAxesInto(
  gamepad: Gamepad | null,
  stick: GamepadStickName,
  target: GamepadStickAxes,
  deadzone = GAMEPAD_STICK_DEADZONE,
) {
  target.x = 0;
  target.y = 0;
  if (!gamepad) return target;

  const candidates = stick === "left" ? LEFT_STICK_AXIS_CANDIDATES : RIGHT_STICK_AXIS_CANDIDATES;
  let bestMagnitude = 0;
  for (let index = 0; index < candidates.length; index += 1) {
    const [axisX, axisY] = candidates[index];
    if (axisX >= gamepad.axes.length || axisY >= gamepad.axes.length) continue;
    const x = applyGamepadDeadzone(gamepad.axes[axisX] ?? 0, deadzone);
    const y = applyGamepadDeadzone(gamepad.axes[axisY] ?? 0, deadzone);
    const magnitude = x * x + y * y;
    if (magnitude <= bestMagnitude) continue;
    bestMagnitude = magnitude;
    target.x = x;
    target.y = y;
  }

  return target;
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
