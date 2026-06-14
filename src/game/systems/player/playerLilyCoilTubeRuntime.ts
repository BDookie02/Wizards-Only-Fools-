import { getLilyCoilTubePlayerRadius } from "../world/villages/lilyCoilTubeMotion";
import { PLAYER_FOOT_OFFSET } from "./playerMovementConfig";

export const LILY_COIL_TUBE_PLAYER_RADIUS = getLilyCoilTubePlayerRadius(PLAYER_FOOT_OFFSET);
export const QA_LILY_COIL_TUBE_FORWARD = 0.78;
export const QA_LILY_COIL_TUBE_STRAFE = 0.24;
export const QA_LILY_COIL_TUBE_LOOK_AHEAD_T = 0.048;
export const QA_LILY_COIL_TUBE_REVERSE_EDGE_T = 0.94;
export const QA_LILY_COIL_TUBE_RESTART_EDGE_T = 0.045;

export type PlayerLilyCoilTubeNetworkAnimation = "jump" | "slide" | "sprint" | "walk" | "holding";

export type PlayerLilyCoilTubePosition = {
  x: number;
  y: number;
  z: number;
};

export type PlayerLilyCoilTubeDispatchState = {
  grounded: boolean;
  moving: boolean;
  sliding: boolean;
  sprinting: boolean;
};

export type PlayerLilyCoilTubeMovePayload = {
  x: number;
  y: number;
  z: number;
  angle: number;
  isMoving: boolean;
  grounded: boolean;
};

type MutableRef<T> = { current: T };

export type PlayerLilyCoilTubeSlideFrame = {
  startedSlide: boolean;
  stoppedSlide: boolean;
  tubeGroundedBeforeMove: boolean;
  tubeSlideHeld: boolean;
  tubeSliding: boolean;
};

export function applyPlayerLilyCoilTubeSlideFrame({
  delta,
  hasPlanarMovementInput,
  isSliding,
  lastSlideTime,
  nowMs,
  setIsSliding,
  slideInputHeld,
  slideRestartCooldownMs,
  slideTimer,
  tubeJumpOffset,
  tubeJumpVelocity,
}: {
  delta: number;
  hasPlanarMovementInput: boolean;
  isSliding: boolean;
  lastSlideTime: MutableRef<number>;
  nowMs: number;
  setIsSliding: (active: boolean) => void;
  slideInputHeld: boolean;
  slideRestartCooldownMs: number;
  slideTimer: MutableRef<number>;
  tubeJumpOffset: number;
  tubeJumpVelocity: number;
}): PlayerLilyCoilTubeSlideFrame {
  let tubeSliding = isSliding;
  const tubeSlideHeld = slideInputHeld && hasPlanarMovementInput;
  const tubeGroundedBeforeMove = tubeJumpOffset <= 0.025 && tubeJumpVelocity <= 0;
  let startedSlide = false;
  let stoppedSlide = false;

  if (tubeGroundedBeforeMove && tubeSlideHeld && !tubeSliding) {
    if (nowMs - lastSlideTime.current >= slideRestartCooldownMs) {
      tubeSliding = true;
      setIsSliding(true);
      slideTimer.current = 1.0;
      lastSlideTime.current = nowMs;
      startedSlide = true;
    }
  }

  if (tubeSliding) {
    slideTimer.current -= delta;
    if (slideTimer.current <= 0 || !tubeSlideHeld) {
      tubeSliding = false;
      setIsSliding(false);
      stoppedSlide = true;
    }
  }

  return {
    startedSlide,
    stoppedSlide,
    tubeGroundedBeforeMove,
    tubeSlideHeld,
    tubeSliding,
  };
}

export function isPlayerLilyCoilTubeMoving({
  forwardInput,
  hasMovementInput,
  tubeSurfaceInput,
}: {
  forwardInput: number;
  hasMovementInput: boolean;
  tubeSurfaceInput: number;
}) {
  return hasMovementInput || Math.abs(tubeSurfaceInput) > 0.05 || Math.abs(forwardInput) > 0.05;
}

export function getPlayerLilyCoilTubeDispatchState({
  isSprinting,
  tubeAirborne,
  tubeMoving,
  tubeSliding,
}: {
  isSprinting: boolean;
  tubeAirborne: boolean;
  tubeMoving: boolean;
  tubeSliding: boolean;
}): PlayerLilyCoilTubeDispatchState {
  return {
    grounded: !tubeAirborne,
    moving: tubeMoving,
    sliding: tubeSliding,
    sprinting: isSprinting && !tubeSliding,
  };
}

export function createPlayerLilyCoilTubeMovePayload({
  position,
  tubeAirborne,
  tubeMoving,
  yaw,
}: {
  position: PlayerLilyCoilTubePosition;
  tubeAirborne: boolean;
  tubeMoving: boolean;
  yaw: number;
}): PlayerLilyCoilTubeMovePayload {
  return {
    x: position.x,
    y: position.y,
    z: position.z,
    angle: yaw,
    isMoving: tubeMoving,
    grounded: !tubeAirborne,
  };
}

export function getPlayerLilyCoilTubeNetworkAnimation({
  isSprinting,
  tubeAirborne,
  tubeMoving,
  tubeSliding,
}: {
  isSprinting: boolean;
  tubeAirborne: boolean;
  tubeMoving: boolean;
  tubeSliding: boolean;
}): PlayerLilyCoilTubeNetworkAnimation {
  if (tubeAirborne) return "jump";
  if (tubeSliding) return "slide";
  if (!tubeMoving) return "holding";
  return isSprinting ? "sprint" : "walk";
}

export function resolvePlayerLilyCoilTubeNetworkFrame({
  isSprinting,
  lastNetworkSync,
  networkSyncIntervalMs,
  nowMs,
  tubeAirborne,
  tubeMoving,
  tubeSliding,
}: {
  isSprinting: boolean;
  lastNetworkSync: { current: number };
  networkSyncIntervalMs: number;
  nowMs: number;
  tubeAirborne: boolean;
  tubeMoving: boolean;
  tubeSliding: boolean;
}) {
  const shouldSyncNetwork = nowMs - lastNetworkSync.current > networkSyncIntervalMs;
  if (shouldSyncNetwork) {
    lastNetworkSync.current = nowMs;
  }

  return {
    anim: getPlayerLilyCoilTubeNetworkAnimation({
      isSprinting,
      tubeAirborne,
      tubeMoving,
      tubeSliding,
    }),
    shouldSyncNetwork,
  };
}
