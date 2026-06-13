import type { MenuDirection } from "./launchMenuConfig";

export type LaunchControllerButtonState = Partial<Record<string, boolean>>;
export type LaunchControllerRepeatState = Partial<Record<string, number>>;

export function consumeLaunchControllerPress(
  buttonState: LaunchControllerButtonState,
  key: string,
  pressed: boolean,
) {
  const wasPressed = buttonState[key] ?? false;
  buttonState[key] = pressed;
  return pressed && !wasPressed;
}

export function consumeLaunchControllerRepeat(
  buttonState: LaunchControllerButtonState,
  repeatState: LaunchControllerRepeatState,
  key: string,
  pressed: boolean,
  now: number,
  firstDelay = 260,
  repeatDelay = 130,
) {
  const wasPressed = buttonState[key] ?? false;
  buttonState[key] = pressed;
  if (!pressed) {
    delete repeatState[key];
    return false;
  }
  if (!wasPressed) {
    repeatState[key] = now + firstDelay;
    return true;
  }
  if (now >= (repeatState[key] ?? 0)) {
    repeatState[key] = now + repeatDelay;
    return true;
  }
  return false;
}

export function resetLaunchControllerTracking(
  buttonState: LaunchControllerButtonState,
  repeatState: LaunchControllerRepeatState,
) {
  for (const key in buttonState) {
    if (!Object.prototype.hasOwnProperty.call(buttonState, key)) continue;
    delete buttonState[key];
  }
  for (const key in repeatState) {
    if (!Object.prototype.hasOwnProperty.call(repeatState, key)) continue;
    delete repeatState[key];
  }
}

export type LaunchControllerMoveOptions = {
  buttonState: LaunchControllerButtonState;
  repeatState: LaunchControllerRepeatState;
  now: number;
  dpadUp: boolean;
  dpadDown: boolean;
  dpadLeft: boolean;
  dpadRight: boolean;
  stickX: number;
  stickY: number;
};

export function resolveLaunchControllerMoveDirection({
  buttonState,
  repeatState,
  now,
  dpadUp,
  dpadDown,
  dpadLeft,
  dpadRight,
  stickX,
  stickY,
}: LaunchControllerMoveOptions): MenuDirection | null {
  const moveUp = consumeLaunchControllerRepeat(buttonState, repeatState, "launchUp", dpadUp || stickY < -0.6, now);
  const moveDown = consumeLaunchControllerRepeat(buttonState, repeatState, "launchDown", dpadDown || stickY > 0.6, now);
  const moveLeft = consumeLaunchControllerRepeat(buttonState, repeatState, "launchLeft", dpadLeft || stickX < -0.6, now);
  const moveRight = consumeLaunchControllerRepeat(buttonState, repeatState, "launchRight", dpadRight || stickX > 0.6, now);

  if (moveUp) return "up";
  if (moveDown) return "down";
  if (moveLeft) return "left";
  if (moveRight) return "right";
  return null;
}
