import type { ExpandedMapPage } from "../../../store/gameStore";
import {
  getPrimaryGamepad,
  isGamepadButtonPressed,
  readGamepadStickAxesInto,
  type GamepadButtonName,
  type GamepadStickAxes,
} from "../../systems/input/controllerInput";
import { consumeHudControllerPress, consumeHudControllerRepeat, type HudControllerButtonsRef, type HudControllerRepeatRef } from "./hudControllerRuntime";

export type MapDirection = "up" | "down" | "left" | "right";

export type MapControllerBindings = {
  menuBack: GamepadButtonName;
  menuSelect: GamepadButtonName;
};

export type ExpandedMapControllerPollOptions = {
  buttonDownRef: HudControllerButtonsRef;
  controllerBindings: MapControllerBindings;
  ignoreNavigationUntilNeutral: boolean;
  now: number;
  repeatAtRef: HudControllerRepeatRef;
};

export type ExpandedMapControllerPollResult = {
  back: boolean;
  direction: MapDirection | null;
  hasGamepad: boolean;
  ignoreNavigationUntilNeutral: boolean;
  page: ExpandedMapPage | null;
  select: boolean;
};

export const MAP_CONTROLLER_AXIS_THRESHOLD = 0.72;
export const MAP_CONTROLLER_REPEAT_FIRST_DELAY = 320;
export const MAP_CONTROLLER_REPEAT_DELAY = 180;

const mapControllerStickScratch: GamepadStickAxes = { x: 0, y: 0 };

export function getExpandedMapControllerPollResult({
  buttonDownRef,
  controllerBindings,
  ignoreNavigationUntilNeutral,
  now,
  repeatAtRef,
}: ExpandedMapControllerPollOptions): ExpandedMapControllerPollResult {
  const gamepad = getPrimaryGamepad();
  const leftPagePressed = consumeHudControllerPress(
    buttonDownRef,
    "mapPageLeft",
    isGamepadButtonPressed(gamepad, "leftBumper") || isGamepadButtonPressed(gamepad, "leftTrigger"),
  );
  const rightPagePressed = consumeHudControllerPress(
    buttonDownRef,
    "mapPageRight",
    isGamepadButtonPressed(gamepad, "rightBumper") || isGamepadButtonPressed(gamepad, "rightTrigger"),
  );
  const selectPressed = consumeHudControllerPress(
    buttonDownRef,
    "mapSelect",
    isGamepadButtonPressed(gamepad, controllerBindings.menuSelect),
  );
  const backPressed = consumeHudControllerPress(
    buttonDownRef,
    "mapBack",
    isGamepadButtonPressed(gamepad, controllerBindings.menuBack),
  );
  readGamepadStickAxesInto(gamepad, "left", mapControllerStickScratch, 0.55);
  const navUpHeld = isGamepadButtonPressed(gamepad, "dpadUp") || mapControllerStickScratch.y < -MAP_CONTROLLER_AXIS_THRESHOLD;
  const navDownHeld = isGamepadButtonPressed(gamepad, "dpadDown") || mapControllerStickScratch.y > MAP_CONTROLLER_AXIS_THRESHOLD;
  const navLeftHeld = isGamepadButtonPressed(gamepad, "dpadLeft") || mapControllerStickScratch.x < -MAP_CONTROLLER_AXIS_THRESHOLD;
  const navRightHeld = isGamepadButtonPressed(gamepad, "dpadRight") || mapControllerStickScratch.x > MAP_CONTROLLER_AXIS_THRESHOLD;
  const navHeld = navUpHeld || navDownHeld || navLeftHeld || navRightHeld;
  const nextIgnoreNavigationUntilNeutral = ignoreNavigationUntilNeutral && navHeld;
  const canNavigate = !nextIgnoreNavigationUntilNeutral;

  const upPressed = canNavigate && consumeHudControllerRepeat(buttonDownRef, repeatAtRef, "mapUp", navUpHeld, now, MAP_CONTROLLER_REPEAT_FIRST_DELAY, MAP_CONTROLLER_REPEAT_DELAY);
  const downPressed = canNavigate && consumeHudControllerRepeat(buttonDownRef, repeatAtRef, "mapDown", navDownHeld, now, MAP_CONTROLLER_REPEAT_FIRST_DELAY, MAP_CONTROLLER_REPEAT_DELAY);
  const leftPressed = canNavigate && consumeHudControllerRepeat(buttonDownRef, repeatAtRef, "mapLeft", navLeftHeld, now, MAP_CONTROLLER_REPEAT_FIRST_DELAY, MAP_CONTROLLER_REPEAT_DELAY);
  const rightPressed = canNavigate && consumeHudControllerRepeat(buttonDownRef, repeatAtRef, "mapRight", navRightHeld, now, MAP_CONTROLLER_REPEAT_FIRST_DELAY, MAP_CONTROLLER_REPEAT_DELAY);

  return {
    back: backPressed,
    direction: upPressed ? "up" : downPressed ? "down" : leftPressed ? "left" : rightPressed ? "right" : null,
    hasGamepad: Boolean(gamepad),
    ignoreNavigationUntilNeutral: nextIgnoreNavigationUntilNeutral,
    page: leftPagePressed ? "live" : rightPagePressed ? "world" : null,
    select: selectPressed,
  };
}
