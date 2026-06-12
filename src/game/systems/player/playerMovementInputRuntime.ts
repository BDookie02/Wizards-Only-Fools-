import * as THREE from "three";
import type { PlayerMovementKeyCode, TouchButtonName } from "../input/playerInputState";
import type { PlayerControllerGamepadMovementInput } from "./playerControllerGamepadRuntime";

type BooleanRef = { current: boolean };
type MovementKeyState = Record<PlayerMovementKeyCode, boolean>;
type TouchMoveState = { x: number; y: number };
type QaWalkInputState = { forward: number; strafe: number; sprint: boolean };

export type PlayerMovementInputIntent = {
  controllerMoveX: number;
  controllerMoveZ: number;
  touchMoveX: number;
  touchMoveZ: number;
  qaWalkForwardInput: number;
  qaWalkStrafeInput: number;
  qaWalkSprintHeld: boolean;
  jumpHeld: boolean;
  jumpRequested: boolean;
  descendHeld: boolean;
  crouchInputHeld: boolean;
  verticalInput: number;
  forwardInput: number;
  strafeInput: number;
  ladderActive: boolean;
  ladderVerticalInput: number;
  hasPlanarMovementInput: boolean;
  hasMovementInput: boolean;
};

const clampUnit = (value: number) => Math.max(-1, Math.min(1, value));

export function resolvePlayerMovementInputIntent({
  keys,
  controllerMovementInput,
  touchControlsActive,
  touchMove,
  touchButtons,
  keyboardJumpWasPressed,
  touchJumpWasPressed,
  touchSprintWasPressed,
  controllerSprintLatched,
  touchSprintLatched,
  qaWalkActive,
  qaWalkInput,
  qaJumpHeld,
  qaJumpWasPressed,
  activeLadderZoneCount,
  vclipActive,
  sleepActive,
  frontVector,
  sideVector,
  direction,
}: {
  keys: MovementKeyState;
  controllerMovementInput: PlayerControllerGamepadMovementInput;
  touchControlsActive: boolean;
  touchMove: TouchMoveState;
  touchButtons: Record<TouchButtonName, boolean>;
  keyboardJumpWasPressed: BooleanRef;
  touchJumpWasPressed: BooleanRef;
  touchSprintWasPressed: BooleanRef;
  controllerSprintLatched: BooleanRef;
  touchSprintLatched: BooleanRef;
  qaWalkActive: boolean;
  qaWalkInput: QaWalkInputState;
  qaJumpHeld: boolean;
  qaJumpWasPressed: BooleanRef;
  activeLadderZoneCount: number;
  vclipActive: boolean;
  sleepActive: boolean;
  frontVector: THREE.Vector3;
  sideVector: THREE.Vector3;
  direction: THREE.Vector3;
}): PlayerMovementInputIntent {
  const controllerMoveX = controllerMovementInput.moveX;
  const controllerMoveZ = controllerMovementInput.moveZ;
  const touchMoveX = touchControlsActive ? touchMove.x : 0;
  const touchMoveZ = touchControlsActive ? touchMove.y : 0;
  const qaWalkForwardInput = qaWalkActive ? qaWalkInput.forward : 0;
  const qaWalkStrafeInput = qaWalkActive ? qaWalkInput.strafe : 0;
  const qaWalkSprintHeld = qaWalkActive && qaWalkInput.sprint;

  const keyboardJumpHeld = keys.Space;
  const keyboardJumpPressed = keyboardJumpHeld && !keyboardJumpWasPressed.current;
  keyboardJumpWasPressed.current = keyboardJumpHeld;

  const controllerJumpHeld = controllerMovementInput.jumpHeld;
  const controllerJumpPressed = controllerMovementInput.jumpPressed;
  const controllerSprintPressed = controllerMovementInput.sprintPressed;

  const touchSlideHeld = touchControlsActive && touchButtons.slide;
  const touchJumpHeld = touchControlsActive && touchButtons.jump;
  const touchJumpPressed = touchJumpHeld && !touchJumpWasPressed.current;
  touchJumpWasPressed.current = touchJumpHeld;

  const qaJumpPressed = qaJumpHeld && !qaJumpWasPressed.current;
  qaJumpWasPressed.current = qaJumpHeld;

  const touchSprintHeld = touchControlsActive && touchButtons.sprint;
  const touchSprintPressed = touchSprintHeld && !touchSprintWasPressed.current;
  touchSprintWasPressed.current = touchSprintHeld;

  const controllerSlideHeld = controllerMovementInput.slideHeld;
  const jumpHeld = keyboardJumpHeld || controllerJumpHeld || touchJumpHeld || qaJumpHeld;
  const jumpRequested = keyboardJumpPressed || controllerJumpPressed || touchJumpPressed || qaJumpPressed;
  const descendHeld = keys.KeyC || controllerSlideHeld || touchSlideHeld;
  const crouchInputHeld = !vclipActive && !sleepActive && (keys.KeyC || controllerSlideHeld);
  const verticalInput = vclipActive ? (jumpHeld ? 1 : 0) - (descendHeld ? 1 : 0) : 0;
  const forwardInput = clampUnit((keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) - controllerMoveZ - touchMoveZ + qaWalkForwardInput);
  const strafeInput = clampUnit((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + controllerMoveX + touchMoveX + qaWalkStrafeInput);
  const ladderActive = !vclipActive && !sleepActive && activeLadderZoneCount > 0;
  const ladderVerticalInput = ladderActive
    ? clampUnit(forwardInput + (jumpHeld ? 1 : 0) - (descendHeld ? 1 : 0))
    : 0;

  frontVector.set(0, 0, -forwardInput);
  sideVector.set(-strafeInput, 0, 0);
  direction.subVectors(frontVector, sideVector);
  const hasPlanarMovementInput = direction.lengthSq() > 0;
  const hasMovementInput = !sleepActive && (hasPlanarMovementInput || verticalInput !== 0 || ladderVerticalInput !== 0);

  if (!hasMovementInput) {
    controllerSprintLatched.current = false;
    touchSprintLatched.current = false;
  } else if (controllerSprintPressed) {
    controllerSprintLatched.current = true;
  } else if (touchSprintPressed) {
    touchSprintLatched.current = true;
  }

  return {
    controllerMoveX,
    controllerMoveZ,
    touchMoveX,
    touchMoveZ,
    qaWalkForwardInput,
    qaWalkStrafeInput,
    qaWalkSprintHeld,
    jumpHeld,
    jumpRequested,
    descendHeld,
    crouchInputHeld,
    verticalInput,
    forwardInput,
    strafeInput,
    ladderActive,
    ladderVerticalInput,
    hasPlanarMovementInput,
    hasMovementInput,
  };
}
