import * as THREE from "three";
import type { PlayerMovementKeyCode, TouchButtonName } from "../input/playerInputState";
import type { PlayerControllerGamepadMovementInput } from "./playerControllerGamepadRuntime";
import {
  CROUCH_SPEED_MULTIPLIER,
  SLIDE_SPEED,
  SPEED,
  SPEED_BOOST_MULTIPLIER,
  TUNGSTON_SLOW_MULTIPLIER,
  VCLIP_SPRINT_MULTIPLIER,
} from "./playerMovementConfig";

type BooleanRef = { current: boolean };
type MutableRef<T> = { current: T };
type PlayerVelocityBody = {
  setLinvel(velocity: { x: number; y: number; z: number }, wakeUp: boolean): void;
};
type PlayerJumpThrusterBody = PlayerVelocityBody & {
  applyImpulse(impulse: { x: number; y: number; z: number }, wakeUp: boolean): void;
};
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

export type PlayerMovementMotionState = {
  speedBoostActive: boolean;
  jumpBoostActive: boolean;
  isSprinting: boolean;
  slideInputHeld: boolean;
  slideHeld: boolean;
  boostedSpeed: number;
  slideSpeed: number;
  currentSpeed: number;
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

export function resetPlayerCrouchState({
  crouchHoldStartedAt,
  isCrouching,
  setIsCrouching,
}: {
  crouchHoldStartedAt: MutableRef<number | null>;
  isCrouching: boolean;
  setIsCrouching: (active: boolean) => void;
}) {
  if (isCrouching) setIsCrouching(false);
  crouchHoldStartedAt.current = null;
}

export function resetPlayerSlideState({
  isSliding,
  setIsSliding,
}: {
  isSliding: boolean;
  setIsSliding: (active: boolean) => void;
}) {
  if (isSliding) setIsSliding(false);
}

export function resetPlayerSlideAndCrouchState({
  crouchHoldStartedAt,
  isCrouching,
  isSliding,
  setIsCrouching,
  setIsSliding,
}: {
  crouchHoldStartedAt: MutableRef<number | null>;
  isCrouching: boolean;
  isSliding: boolean;
  setIsCrouching: (active: boolean) => void;
  setIsSliding: (active: boolean) => void;
}) {
  resetPlayerSlideState({ isSliding, setIsSliding });
  resetPlayerCrouchState({ crouchHoldStartedAt, isCrouching, setIsCrouching });
}

export function updatePlayerCrouchHoldState({
  crouchAllowed,
  crouchHoldMs,
  crouchHoldStartedAt,
  isCrouching,
  nowMs,
  setIsCrouching,
}: {
  crouchAllowed: boolean;
  crouchHoldMs: number;
  crouchHoldStartedAt: MutableRef<number | null>;
  isCrouching: boolean;
  nowMs: number;
  setIsCrouching: (active: boolean) => void;
}) {
  if (!crouchAllowed) {
    resetPlayerCrouchState({ crouchHoldStartedAt, isCrouching, setIsCrouching });
    return "reset" as const;
  }

  if (crouchHoldStartedAt.current === null) {
    crouchHoldStartedAt.current = nowMs;
    return "started" as const;
  }

  if (!isCrouching && nowMs - crouchHoldStartedAt.current >= crouchHoldMs) {
    setIsCrouching(true);
    return "activated" as const;
  }

  return "held" as const;
}

export function stopPlayerPlanarVelocity({
  body,
  currentVelocityY,
  vclipActive,
}: {
  body: PlayerVelocityBody;
  currentVelocityY: number;
  vclipActive: boolean;
}) {
  body.setLinvel({ x: 0, y: vclipActive ? 0 : currentVelocityY, z: 0 }, true);
}

export type PlayerGroundSlideFrameResult = {
  resetJumps: boolean;
  startedSlide: boolean;
  stoppedSlide: boolean;
};

export function applyPlayerGroundSlideFrame({
  delta,
  effectiveGrounded,
  hasPlanarMovementInput,
  isSliding,
  lastSlideTime,
  nowMs,
  planarVelocityX,
  planarVelocityZ,
  resetJumps,
  setIsSliding,
  slideHeld,
  slideRestartCooldownMs,
  slideStartMinSpeedSq,
  slideTimer,
  vclipActive,
}: {
  delta: number;
  effectiveGrounded: boolean;
  hasPlanarMovementInput: boolean;
  isSliding: boolean;
  lastSlideTime: MutableRef<number>;
  nowMs: number;
  planarVelocityX: number;
  planarVelocityZ: number;
  resetJumps: () => void;
  setIsSliding: (active: boolean) => void;
  slideHeld: boolean;
  slideRestartCooldownMs: number;
  slideStartMinSpeedSq: number;
  slideTimer: MutableRef<number>;
  vclipActive: boolean;
}): PlayerGroundSlideFrameResult {
  const result: PlayerGroundSlideFrameResult = {
    resetJumps: false,
    startedSlide: false,
    stoppedSlide: false,
  };

  if (!vclipActive && effectiveGrounded) {
    resetJumps();
    result.resetJumps = true;

    const planarVelocitySq = planarVelocityX * planarVelocityX + planarVelocityZ * planarVelocityZ;
    if (slideHeld && !isSliding && (hasPlanarMovementInput || planarVelocitySq > slideStartMinSpeedSq)) {
      if (nowMs - lastSlideTime.current >= slideRestartCooldownMs) {
        setIsSliding(true);
        slideTimer.current = 1.0;
        lastSlideTime.current = nowMs;
        result.startedSlide = true;
      }
    }
  }

  if (!vclipActive && isSliding) {
    slideTimer.current -= delta;
    if (slideTimer.current <= 0 || !slideHeld) {
      setIsSliding(false);
      result.stoppedSlide = true;
    }
  }

  return result;
}

export type PlayerJumpThrusterFrameResult = {
  nextFuel: number;
  fuelChanged: boolean;
  jumped: boolean;
  thrusted: boolean;
  resetThrusterLock: boolean;
  lockedThruster: boolean;
  rechargedFuel: boolean;
};

export function applyPlayerJumpThrusterFrame({
  body,
  climbingLadder,
  currentFuel,
  delta,
  effectiveGrounded,
  groundJumpMaxUpwardVelocity,
  grounded,
  idleGroundedPlanarLock,
  jumpBoostActive,
  jumpBoostMultiplier,
  jumpForce,
  jumpHeld,
  jumpRequested,
  planarVelocityX,
  planarVelocityZ,
  setJumps,
  setThrusterFuel,
  sleepActive,
  thrusterFuelDrainPerSecond,
  thrusterFuelRechargePerSecond,
  thrusterImpulsePerSecond,
  thrusterLocked,
  vclipActive,
  velocityY,
}: {
  body: PlayerJumpThrusterBody;
  climbingLadder: boolean;
  currentFuel: number;
  delta: number;
  effectiveGrounded: boolean;
  groundJumpMaxUpwardVelocity: number;
  grounded: boolean;
  idleGroundedPlanarLock: boolean;
  jumpBoostActive: boolean;
  jumpBoostMultiplier: number;
  jumpForce: number;
  jumpHeld: boolean;
  jumpRequested: boolean;
  planarVelocityX: number;
  planarVelocityZ: number;
  setJumps: (count: number) => void;
  setThrusterFuel: (fuel: number) => void;
  sleepActive: boolean;
  thrusterFuelDrainPerSecond: number;
  thrusterFuelRechargePerSecond: number;
  thrusterImpulsePerSecond: number;
  thrusterLocked: BooleanRef;
  vclipActive: boolean;
  velocityY: number;
}): PlayerJumpThrusterFrameResult {
  let nextFuel = currentFuel;
  const result: PlayerJumpThrusterFrameResult = {
    nextFuel,
    fuelChanged: false,
    jumped: false,
    thrusted: false,
    resetThrusterLock: false,
    lockedThruster: false,
    rechargedFuel: false,
  };

  if (!jumpHeld) {
    thrusterLocked.current = false;
    result.resetThrusterLock = true;
  }

  const boostMultiplier = jumpBoostActive ? jumpBoostMultiplier : 1;
  if (!vclipActive && !sleepActive && !climbingLadder && jumpHeld) {
    if (grounded && velocityY <= groundJumpMaxUpwardVelocity) {
      if (jumpRequested) {
        body.setLinvel({
          x: idleGroundedPlanarLock ? 0 : planarVelocityX,
          y: jumpForce * boostMultiplier,
          z: idleGroundedPlanarLock ? 0 : planarVelocityZ,
        }, true);
        setJumps(1);
        thrusterLocked.current = false;
        result.jumped = true;
        result.resetThrusterLock = true;
      }
    } else if (!grounded && currentFuel > 0 && !thrusterLocked.current) {
      body.applyImpulse({ x: 0, y: thrusterImpulsePerSecond * boostMultiplier * delta, z: 0 }, true);
      nextFuel = Math.max(0, currentFuel - delta * thrusterFuelDrainPerSecond);
      result.thrusted = true;
      if (nextFuel === 0) {
        thrusterLocked.current = true;
        result.lockedThruster = true;
      }
    }
  }

  if (!vclipActive && effectiveGrounded && nextFuel < 1.0) {
    const rechargedFuel = Math.min(1.0, nextFuel + delta * thrusterFuelRechargePerSecond);
    result.rechargedFuel = rechargedFuel !== nextFuel;
    nextFuel = rechargedFuel;
  }

  if (nextFuel !== currentFuel) {
    setThrusterFuel(nextFuel);
    result.fuelChanged = true;
  }
  result.nextFuel = nextFuel;

  return result;
}

export function applyPlayerModalBlockedMovementFrame({
  body,
  crouchHoldStartedAt,
  currentVelocityY,
  dispatchStationaryPlayerState,
  isCrouching,
  setIsCrouching,
  vclipActive,
}: {
  body: PlayerVelocityBody;
  crouchHoldStartedAt: MutableRef<number | null>;
  currentVelocityY: number;
  dispatchStationaryPlayerState: () => void;
  isCrouching: boolean;
  setIsCrouching: (active: boolean) => void;
  vclipActive: boolean;
}) {
  resetPlayerCrouchState({ crouchHoldStartedAt, isCrouching, setIsCrouching });
  stopPlayerPlanarVelocity({ body, currentVelocityY, vclipActive });
  dispatchStationaryPlayerState();
}

export function resolvePlayerMovementMotionState({
  nowMs,
  speedBoostUntil,
  jumpBoostUntil,
  slowActive,
  sleepActive,
  vclipActive,
  descendHeld,
  hasMovementInput,
  hasPlanarMovementInput,
  keyboardSprintHeld,
  controllerSprintLatched,
  touchSprintLatched,
  qaWalkSprintHeld,
  isSliding,
  isCrouching,
}: {
  nowMs: number;
  speedBoostUntil: number;
  jumpBoostUntil: number;
  slowActive: boolean;
  sleepActive: boolean;
  vclipActive: boolean;
  descendHeld: boolean;
  hasMovementInput: boolean;
  hasPlanarMovementInput: boolean;
  keyboardSprintHeld: boolean;
  controllerSprintLatched: boolean;
  touchSprintLatched: boolean;
  qaWalkSprintHeld: boolean;
  isSliding: boolean;
  isCrouching: boolean;
}): PlayerMovementMotionState {
  const speedBoostActive = speedBoostUntil > nowMs;
  const jumpBoostActive = jumpBoostUntil > nowMs;
  const isSprinting =
    hasMovementInput &&
    (keyboardSprintHeld || controllerSprintLatched || touchSprintLatched || qaWalkSprintHeld) &&
    !isSliding &&
    !isCrouching;
  const slideInputHeld = !vclipActive && descendHeld && !isCrouching;
  const slideHeld = slideInputHeld && (isSliding || isSprinting || hasPlanarMovementInput);
  const boostedSpeed = SPEED * (speedBoostActive ? SPEED_BOOST_MULTIPLIER : 1) * (slowActive ? TUNGSTON_SLOW_MULTIPLIER : 1);
  const slideSpeed = SLIDE_SPEED * (slowActive ? TUNGSTON_SLOW_MULTIPLIER : 1);
  const sprintMultiplier = vclipActive ? VCLIP_SPRINT_MULTIPLIER : 1.6;
  const currentSpeed = sleepActive
    ? 0
    : isSliding
      ? slideSpeed
      : isCrouching
        ? boostedSpeed * CROUCH_SPEED_MULTIPLIER
        : isSprinting
          ? boostedSpeed * sprintMultiplier
          : boostedSpeed;

  return {
    speedBoostActive,
    jumpBoostActive,
    isSprinting,
    slideInputHeld,
    slideHeld,
    boostedSpeed,
    slideSpeed,
    currentSpeed,
  };
}
