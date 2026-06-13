import { useCallback, useMemo, useRef } from "react";
import * as THREE from "three";
import { useLazyRef } from "../../systems/react/useLazyRef";
import {
  QA_LILY_COIL_TUBE_FORWARD,
  QA_LILY_COIL_TUBE_STRAFE,
} from "../../systems/player/playerLilyCoilTubeRuntime";
import {
  QA_SURVIVAL_OVERHEAD_BLOCKED_CLEARANCE,
  QA_SURVIVAL_OVERHEAD_SOFT_CLEARANCE,
  QA_DARREL_GROVE_DRAGON_STEP_JUMP_DISTANCE,
  QA_SURVIVAL_ROUTE_BLOCKED_DWELL_SECONDS,
  QA_SURVIVAL_ROUTE_REACH_DISTANCE,
  QA_SURVIVAL_ROUTE_WAYPOINT_SECONDS,
  QA_SURVIVAL_ROUTE_YAW_SMOOTH_RATE,
  QA_SURVIVAL_ROUTE_YAW_SNAP_DELTA,
  QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE,
  QA_SURVIVAL_VIEW_SOFT_CLEARANCE,
  QA_SURVIVAL_LOW_SPEED_THRESHOLD,
  QA_SURVIVAL_LOW_SPEED_TRIGGER_SECONDS,
  QA_SURVIVAL_LOOK_TURN_RATE,
  QA_SURVIVAL_RECOVERY_TURN_RATE,
  QA_SURVIVAL_STUCK_CHECK_SECONDS,
  QA_SURVIVAL_WALK_BLOCKED_CLEARANCE,
  QA_SURVIVAL_WALK_DECISION_MAX_SECONDS,
  QA_SURVIVAL_WALK_LOOKAHEAD_DISTANCE,
  QA_SURVIVAL_WALK_MIN_PROGRESS,
  QA_SURVIVAL_WALK_MIN_TOWARD_PROGRESS,
  QA_SURVIVAL_WALK_PROBE_DISTANCE,
  QA_SURVIVAL_WALK_SOFT_CLEARANCE,
  QA_SURVIVAL_WALK_SOFT_LOOKAHEAD,
  QA_SURVIVAL_WALK_TURN_IN_PLACE_ERROR,
  angleDeltaRadians,
  getQaSurvivalWalkStartDelaySeconds,
  isQaSurvivalWalkEnabled,
  lerpAngleRadians,
  moveAngleTowardsRadians,
  type QaSurvivalIntent,
  type QaSurvivalIntentKind,
  type QaSurvivalRouteWaypoint,
  type QaSurvivalWalkInputState,
  type QaSurvivalWalkMode,
} from "./survivalWalkQa";

type QaWalkPosition = { x: number; y: number; z: number };
type LazyVector3Ref = { current: THREE.Vector3 };

const DEFAULT_QA_WALK_INPUT: QaSurvivalWalkInputState = {
  forward: 0,
  strafe: 0,
  sprint: false,
  mode: "travel",
};

const QA_WALK_MAX_STUCK_STRIKES = 6;

export type QaWalkProgressRecoveryReason = "progress" | "blocked-progress";

export type QaWalkProgressRecoveryAction =
  | "none"
  | "recover"
  | "set-forward-waypoint"
  | "clear-stuck";

export type QaWalkTelemetryAbnormality =
  | ""
  | "stuck-strikes"
  | "low-overhead"
  | "slow-input"
  | "low-clearance"
  | "low-view"
  | `recovery:${string}`
  | `position-jump:${number}`;

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function resolveQaWalkRouteWaypoint({
  active,
  elapsedSeconds,
  position,
  routeIndex,
  waypoints,
  reachDistance = QA_SURVIVAL_ROUTE_REACH_DISTANCE,
  waypointSeconds = QA_SURVIVAL_ROUTE_WAYPOINT_SECONDS,
}: {
  active: boolean;
  elapsedSeconds: number;
  position: { x: number; z: number };
  routeIndex: number;
  waypoints: QaSurvivalRouteWaypoint[];
  reachDistance?: number;
  waypointSeconds?: number;
}) {
  if (!active || waypoints.length <= 0) return null;

  let nextRouteIndex = routeIndex;
  let target = waypoints[nextRouteIndex % waypoints.length];
  let guard = 0;
  const routeReachDistanceSq = reachDistance * reachDistance;
  while (
    guard < waypoints.length &&
    (target.x - position.x) * (target.x - position.x) + (target.z - position.z) * (target.z - position.z) < routeReachDistanceSq
  ) {
    nextRouteIndex = (nextRouteIndex + 1) % waypoints.length;
    target = waypoints[nextRouteIndex % waypoints.length];
    guard += 1;
  }

  return {
    routeIndex: nextRouteIndex,
    waypoint: {
      x: target.x,
      z: target.z,
      expiresAt: elapsedSeconds + waypointSeconds,
    },
  };
}

export function resolveQaWalkRouteSteeringState({
  active,
  elapsedSeconds,
  deltaSeconds,
  routeBlockedSince,
  routeTargetId,
  previousRouteTargetId,
  previousSmoothedYaw,
  desiredYaw,
  forwardClearance,
  forwardLookAhead,
  viewClearance,
  overheadClearance,
  blockedClearance = QA_SURVIVAL_WALK_BLOCKED_CLEARANCE,
  softLookAhead = QA_SURVIVAL_WALK_SOFT_LOOKAHEAD,
  softClearance = QA_SURVIVAL_WALK_SOFT_CLEARANCE,
  viewBlockedClearance = QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE,
  viewSoftClearance = QA_SURVIVAL_VIEW_SOFT_CLEARANCE,
  overheadBlockedClearance = QA_SURVIVAL_OVERHEAD_BLOCKED_CLEARANCE,
  dwellSeconds = QA_SURVIVAL_ROUTE_BLOCKED_DWELL_SECONDS,
  yawSnapDelta = QA_SURVIVAL_ROUTE_YAW_SNAP_DELTA,
  yawSmoothRate = QA_SURVIVAL_ROUTE_YAW_SMOOTH_RATE,
}: {
  active: boolean;
  elapsedSeconds: number;
  deltaSeconds: number;
  routeBlockedSince: number;
  routeTargetId: string | null;
  previousRouteTargetId: string | null;
  previousSmoothedYaw: number | null;
  desiredYaw: number;
  forwardClearance: number;
  forwardLookAhead: number;
  viewClearance: number;
  overheadClearance: number;
  blockedClearance?: number;
  softLookAhead?: number;
  softClearance?: number;
  viewBlockedClearance?: number;
  viewSoftClearance?: number;
  overheadBlockedClearance?: number;
  dwellSeconds?: number;
  yawSnapDelta?: number;
  yawSmoothRate?: number;
}) {
  const routeHardBlocked = active && (
    forwardClearance < blockedClearance ||
    viewClearance < viewBlockedClearance ||
    overheadClearance < overheadBlockedClearance
  );
  const routeSoftBlocked = active && (
    routeHardBlocked ||
    forwardLookAhead < softLookAhead * 0.72 ||
    forwardClearance < softClearance * 0.86
  );
  const nextRouteBlockedSince = routeSoftBlocked
    ? (routeBlockedSince <= 0 ? elapsedSeconds : routeBlockedSince)
    : 0;
  const routeBlockDwelled = active &&
    nextRouteBlockedSince > 0 &&
    elapsedSeconds - nextRouteBlockedSince >= dwellSeconds;

  if (!active) {
    return {
      routeHardBlocked,
      routeSoftBlocked,
      routeBlockedSince: 0,
      routeBlockDwelled,
      route: null,
    };
  }

  const routeTargetChanged = routeTargetId !== previousRouteTargetId;
  const routeYawDelta = previousSmoothedYaw === null ? 0 : Math.abs(angleDeltaRadians(previousSmoothedYaw, desiredYaw));
  const routeSmoothedYaw = routeTargetChanged || previousSmoothedYaw === null || routeYawDelta > yawSnapDelta
    ? desiredYaw
    : lerpAngleRadians(
      previousSmoothedYaw,
      desiredYaw,
      1 - Math.exp(-yawSmoothRate * deltaSeconds),
    );

  return {
    routeHardBlocked,
    routeSoftBlocked,
    routeBlockedSince: nextRouteBlockedSince,
    routeBlockDwelled,
    route: {
      targetYaw: routeSmoothedYaw,
      smoothedYaw: routeSmoothedYaw,
      targetId: routeTargetId,
      forwardAmount: 0.92,
      strafeAmount: 0,
      sprint: forwardClearance > blockedClearance * 1.35 &&
        forwardLookAhead > softLookAhead * 0.82 &&
        viewClearance > viewBlockedClearance * 1.35 &&
        overheadClearance > overheadBlockedClearance,
    },
  };
}

export function resolveQaWalkClearanceThrottle({
  forwardAmount,
  forwardClearance,
  forwardLookAhead,
  mode,
  overheadClearance,
  sprint,
  viewClearance,
  blockedClearance = QA_SURVIVAL_WALK_BLOCKED_CLEARANCE,
  lookAheadDistance = QA_SURVIVAL_WALK_LOOKAHEAD_DISTANCE,
  overheadBlockedClearance = QA_SURVIVAL_OVERHEAD_BLOCKED_CLEARANCE,
  softClearance = QA_SURVIVAL_WALK_SOFT_CLEARANCE,
  softLookAhead = QA_SURVIVAL_WALK_SOFT_LOOKAHEAD,
  viewBlockedClearance = QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE,
}: {
  forwardAmount: number;
  forwardClearance: number;
  forwardLookAhead: number;
  mode: QaSurvivalWalkMode;
  overheadClearance: number;
  sprint: boolean;
  viewClearance: number;
  blockedClearance?: number;
  lookAheadDistance?: number;
  overheadBlockedClearance?: number;
  softClearance?: number;
  softLookAhead?: number;
  viewBlockedClearance?: number;
}) {
  if (mode === "route") {
    if (
      forwardClearance < blockedClearance ||
      viewClearance < viewBlockedClearance ||
      overheadClearance < overheadBlockedClearance
    ) {
      return {
        forwardAmount: Math.min(forwardAmount, 0.22),
        sprint: false,
      };
    }

    if (forwardClearance < softClearance || forwardLookAhead < softLookAhead) {
      return {
        forwardAmount: Math.min(forwardAmount, 0.72),
        sprint: false,
      };
    }

    return { forwardAmount, sprint };
  }

  if (mode === "travel") {
    const clearanceEase = clampNumber(
      (forwardClearance - blockedClearance) / Math.max(1, softClearance - blockedClearance),
      0.32,
      1,
    );
    const lookAheadEase = clampNumber(
      (forwardLookAhead - softLookAhead) / Math.max(1, lookAheadDistance - softLookAhead),
      0.38,
      1,
    );
    const humanThrottle = Math.min(clearanceEase, lookAheadEase);
    return {
      forwardAmount: forwardAmount * humanThrottle,
      sprint: humanThrottle < 0.72 ? false : sprint,
    };
  }

  return { forwardAmount, sprint };
}

export function resolveQaWalkCombatFocusMovement({
  activeIntentKind,
  combatFocusActive,
  combatFocusUntil,
  combatTargetYaw,
  elapsedSeconds,
  mode,
  qaSpellDummyRunActive,
}: {
  activeIntentKind: QaSurvivalIntentKind | null;
  combatFocusActive: boolean;
  combatFocusUntil: number;
  combatTargetYaw: number;
  elapsedSeconds: number;
  mode: QaSurvivalWalkMode;
  qaSpellDummyRunActive: boolean;
}): {
  forwardAmount: number;
  mode: QaSurvivalWalkMode;
  sprint: boolean;
  strafeAmount: number;
  targetYaw: number;
} | null {
  if (!combatFocusActive || elapsedSeconds >= combatFocusUntil) return null;
  if (mode !== "travel" && mode !== "approach" && mode !== "act") return null;

  return {
    forwardAmount: qaSpellDummyRunActive ? 0 : 0.06,
    mode: activeIntentKind === "spell-dummy" ? "act" : "inspect",
    sprint: false,
    strafeAmount: Math.sin(elapsedSeconds * 3.1) * (qaSpellDummyRunActive ? 0.035 : 0.1),
    targetYaw: combatTargetYaw + Math.sin(elapsedSeconds * 2.4) * 0.05,
  };
}

export function resolveQaWalkRecoveryJumpHoldUntil({
  forwardClearance,
  nowSeconds,
  previousJumpHeldUntil,
  yawError,
  cooldownSeconds = 2.1,
  holdSeconds = 0.16,
  maxForwardClearance = 4.2,
  maxYawError = 0.55,
  minForwardClearance = 1.6,
}: {
  forwardClearance: number;
  nowSeconds: number;
  previousJumpHeldUntil: number;
  yawError: number;
  cooldownSeconds?: number;
  holdSeconds?: number;
  maxForwardClearance?: number;
  maxYawError?: number;
  minForwardClearance?: number;
}) {
  if (nowSeconds <= previousJumpHeldUntil + cooldownSeconds) return null;
  if (yawError >= maxYawError) return null;
  if (forwardClearance <= minForwardClearance || forwardClearance >= maxForwardClearance) return null;
  return nowSeconds + holdSeconds;
}

export function resolveQaWalkIntentJumpHoldUntil({
  activeIntentKind,
  activeIntentDistance,
  intentMoveDistance,
  nowSeconds,
  planarSpeedSq,
  previousJumpHeldUntil,
  cooldownSeconds = 0.9,
  holdSeconds = 0.18,
  lowSpeedThreshold = QA_SURVIVAL_LOW_SPEED_THRESHOLD,
  stepJumpDistance = QA_DARREL_GROVE_DRAGON_STEP_JUMP_DISTANCE,
}: {
  activeIntentKind: QaSurvivalIntentKind;
  activeIntentDistance: number;
  intentMoveDistance: number;
  nowSeconds: number;
  planarSpeedSq: number;
  previousJumpHeldUntil: number;
  cooldownSeconds?: number;
  holdSeconds?: number;
  lowSpeedThreshold?: number;
  stepJumpDistance?: number;
}) {
  if (activeIntentKind !== "darrel-dragon") return null;
  if (activeIntentDistance >= stepJumpDistance) return null;
  if (nowSeconds <= previousJumpHeldUntil + cooldownSeconds) return null;
  if (planarSpeedSq >= lowSpeedThreshold * lowSpeedThreshold && intentMoveDistance >= 34) return null;
  return nowSeconds + holdSeconds;
}

export function resolveQaWalkAvoidMovement({
  currentYaw,
  elapsedSeconds,
  forwardClearance,
  overheadClearance,
  positionX,
  qaRouteActive,
  strafeAmount,
  targetYaw,
  viewClearance,
  overheadSoftClearance = QA_SURVIVAL_OVERHEAD_SOFT_CLEARANCE,
  probeDistance = QA_SURVIVAL_WALK_PROBE_DISTANCE,
  turnInPlaceError = QA_SURVIVAL_WALK_TURN_IN_PLACE_ERROR,
  viewSoftClearance = QA_SURVIVAL_VIEW_SOFT_CLEARANCE,
}: {
  currentYaw: number;
  elapsedSeconds: number;
  forwardClearance: number;
  overheadClearance: number;
  positionX: number;
  qaRouteActive: boolean;
  strafeAmount: number;
  targetYaw: number;
  viewClearance: number;
  overheadSoftClearance?: number;
  probeDistance?: number;
  turnInPlaceError?: number;
  viewSoftClearance?: number;
}): {
  forwardAmount: number;
  mode: QaSurvivalWalkMode;
  sprint: boolean;
  strafeAmount: number;
} | null {
  if (qaRouteActive) return null;
  if (
    forwardClearance >= probeDistance * 0.72 &&
    viewClearance >= viewSoftClearance * 0.72 &&
    overheadClearance >= overheadSoftClearance
  ) {
    return null;
  }

  const avoidYawError = Math.abs(angleDeltaRadians(currentYaw, targetYaw));
  if (avoidYawError > turnInPlaceError) {
    return {
      forwardAmount: 0,
      mode: "avoid",
      sprint: false,
      strafeAmount: 0,
    };
  }

  const baseForwardAmount = viewClearance < viewSoftClearance * 0.58 ? 0.18 : 0.38;
  return {
    forwardAmount: overheadClearance < overheadSoftClearance ? Math.min(baseForwardAmount, 0.22) : baseForwardAmount,
    mode: "avoid",
    sprint: false,
    strafeAmount: clampNumber(
      strafeAmount + Math.sign(Math.sin(elapsedSeconds * 1.7 + positionX * 0.01)) * 0.18,
      -0.58,
      0.58,
    ),
  };
}

export function resolveQaWalkTravelMovementFrame({
  desiredYaw,
  elapsedSeconds,
  forwardClearance,
  forwardLookAhead,
  positionX,
  positionZ,
  viewClearance,
  probeDistance = QA_SURVIVAL_WALK_PROBE_DISTANCE,
  softLookAhead = QA_SURVIVAL_WALK_SOFT_LOOKAHEAD,
  viewSoftClearance = QA_SURVIVAL_VIEW_SOFT_CLEARANCE,
}: {
  desiredYaw: number;
  elapsedSeconds: number;
  forwardClearance: number;
  forwardLookAhead: number;
  positionX: number;
  positionZ: number;
  viewClearance: number;
  probeDistance?: number;
  softLookAhead?: number;
  viewSoftClearance?: number;
}) {
  return {
    forwardAmount: 0.58 + Math.sin(elapsedSeconds * 0.47 + positionZ * 0.001) * 0.12,
    sprint: forwardClearance > probeDistance * 0.68 &&
      forwardLookAhead > softLookAhead &&
      viewClearance > viewSoftClearance * 0.72 &&
      Math.sin(elapsedSeconds * 0.29 + positionX * 0.0017) > -0.18,
    strafeAmount: Math.sin(elapsedSeconds * 0.62 + positionX * 0.003 + positionZ * 0.002) * 0.16,
    targetYaw: desiredYaw
      + Math.sin(elapsedSeconds * 0.43 + positionX * 0.002) * 0.14
      + Math.sin(elapsedSeconds * 0.91 + positionZ * 0.0014) * 0.05,
  };
}

export function resolveQaWalkInspectMovement({
  elapsedSeconds,
  inspectUntil,
  inspectYaw,
}: {
  elapsedSeconds: number;
  inspectUntil: number;
  inspectYaw: number;
}): {
  forwardAmount: number;
  mode: QaSurvivalWalkMode;
  sprint: boolean;
  strafeAmount: number;
  targetYaw: number;
} | null {
  if (elapsedSeconds >= inspectUntil) return null;
  return {
    forwardAmount: 0,
    mode: "inspect",
    sprint: false,
    strafeAmount: 0,
    targetYaw: inspectYaw + Math.sin(elapsedSeconds * 1.35) * 0.18,
  };
}

export function resolveQaWalkTubeMovementFrame({
  elapsedSeconds,
  positionX,
  positionY,
  tubeDirection,
  tubeT,
  tubeTravelYaw,
  tubeForward = QA_LILY_COIL_TUBE_FORWARD,
  tubeStrafe = QA_LILY_COIL_TUBE_STRAFE,
}: {
  elapsedSeconds: number;
  positionX: number;
  positionY: number;
  tubeDirection: number;
  tubeT: number;
  tubeTravelYaw: number | null;
  tubeForward?: number;
  tubeStrafe?: number;
}): {
  forwardAmount: number;
  sprint: boolean;
  strafeAmount: number;
  targetYaw: number;
} | null {
  if (tubeTravelYaw === null) return null;
  const direction = tubeDirection >= 0 ? 1 : -1;
  return {
    forwardAmount: direction * (tubeForward + Math.sin(elapsedSeconds * 0.21 + positionX * 0.001) * 0.06),
    sprint: true,
    strafeAmount: Math.sin(elapsedSeconds * 0.53 + tubeT * 22) * tubeStrafe,
    targetYaw: tubeTravelYaw + Math.sin(elapsedSeconds * 0.48 + positionY * 0.006) * 0.1,
  };
}

export function resolveQaWalkBlockedRecoveryTrigger({
  elapsedSeconds,
  forwardClearance,
  lilyCoilTubeQaActive,
  overheadClearance,
  qaRouteActive,
  recoveryUntil,
  routeBlockDwelled,
  routeHardBlocked,
  viewClearance,
  blockedClearance = QA_SURVIVAL_WALK_BLOCKED_CLEARANCE,
  overheadBlockedClearance = QA_SURVIVAL_OVERHEAD_BLOCKED_CLEARANCE,
  viewBlockedClearance = QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE,
}: {
  elapsedSeconds: number;
  forwardClearance: number;
  lilyCoilTubeQaActive: boolean;
  overheadClearance: number;
  qaRouteActive: boolean;
  recoveryUntil: number;
  routeBlockDwelled: boolean;
  routeHardBlocked: boolean;
  viewClearance: number;
  blockedClearance?: number;
  overheadBlockedClearance?: number;
  viewBlockedClearance?: number;
}): {
  aggressive: boolean;
  recoveryReason: string;
} | null {
  if (lilyCoilTubeQaActive) return null;
  const blocked = forwardClearance < blockedClearance ||
    viewClearance < viewBlockedClearance ||
    overheadClearance < overheadBlockedClearance;
  if (!blocked) return null;
  if (qaRouteActive && (!routeHardBlocked || !routeBlockDwelled)) return null;
  if (elapsedSeconds < recoveryUntil - 0.08) return null;

  return {
    aggressive: forwardClearance < 2.4 ||
      viewClearance < 2.2 ||
      overheadClearance < overheadBlockedClearance,
    recoveryReason: overheadClearance < overheadBlockedClearance
      ? "overhead"
      : viewClearance < viewBlockedClearance
        ? "view-blocked"
        : "clearance",
  };
}

export function shouldResolveQaWalkSteeringDecision({
  elapsedSeconds,
  forwardClearance,
  forwardLookAhead,
  lastDecisionAt,
  lilyCoilTubeQaActive,
  nextDecisionAt,
  overheadClearance,
  qaRouteActive,
  routeBlockDwelled,
  viewClearance,
  decisionMaxSeconds = QA_SURVIVAL_WALK_DECISION_MAX_SECONDS,
  lookAheadDistance = QA_SURVIVAL_WALK_LOOKAHEAD_DISTANCE,
  overheadSoftClearance = QA_SURVIVAL_OVERHEAD_SOFT_CLEARANCE,
  probeDistance = QA_SURVIVAL_WALK_PROBE_DISTANCE,
  viewSoftClearance = QA_SURVIVAL_VIEW_SOFT_CLEARANCE,
}: {
  elapsedSeconds: number;
  forwardClearance: number;
  forwardLookAhead: number;
  lastDecisionAt: number;
  lilyCoilTubeQaActive: boolean;
  nextDecisionAt: number;
  overheadClearance: number;
  qaRouteActive: boolean;
  routeBlockDwelled: boolean;
  viewClearance: number;
  decisionMaxSeconds?: number;
  lookAheadDistance?: number;
  overheadSoftClearance?: number;
  probeDistance?: number;
  viewSoftClearance?: number;
}) {
  if (lilyCoilTubeQaActive) return false;
  if (qaRouteActive) return routeBlockDwelled;
  return forwardClearance < probeDistance * 0.72 ||
    forwardLookAhead < lookAheadDistance * 0.48 ||
    viewClearance < viewSoftClearance * 0.68 ||
    overheadClearance < overheadSoftClearance ||
    elapsedSeconds >= nextDecisionAt ||
    elapsedSeconds - lastDecisionAt > decisionMaxSeconds;
}

export function resolveQaWalkLookInputFrame({
  currentYaw,
  deltaSeconds,
  elapsedSeconds,
  forwardAmount,
  lilyCoilTubeQaActive,
  mode,
  sprint,
  strafeAmount,
  targetYaw,
  lookTurnRate = QA_SURVIVAL_LOOK_TURN_RATE,
  recoveryTurnRate = QA_SURVIVAL_RECOVERY_TURN_RATE,
}: {
  currentYaw: number | null;
  deltaSeconds: number;
  elapsedSeconds: number;
  forwardAmount: number;
  lilyCoilTubeQaActive: boolean;
  mode: QaSurvivalWalkMode;
  sprint: boolean;
  strafeAmount: number;
  targetYaw: number;
  lookTurnRate?: number;
  recoveryTurnRate?: number;
}) {
  const turnRate = mode === "recover"
    ? recoveryTurnRate
    : mode === "inspect"
      ? lookTurnRate * 0.72
      : lookTurnRate;
  const yaw = moveAngleTowardsRadians(currentYaw, targetYaw, turnRate * deltaSeconds);
  const pitch = mode === "inspect"
    ? -0.02 + Math.sin(elapsedSeconds * 1.18) * 0.1
    : -0.045 + Math.sin(elapsedSeconds * 0.62) * 0.032;
  const cameraYaw = lilyCoilTubeQaActive ? yaw : -yaw;
  const inputMode: QaSurvivalWalkMode = lilyCoilTubeQaActive ? "tube" : mode;

  return {
    cameraYaw,
    input: {
      forward: clampNumber(forwardAmount, inputMode === "tube" ? -1 : -0.28, 1),
      strafe: clampNumber(strafeAmount, -0.72, 0.72),
      sprint,
      mode: inputMode,
    },
    pitch,
    yaw,
  };
}

export function resolveQaWalkLowSpeedRecovery({
  elapsedSeconds,
  forwardAmount,
  lilyCoilTubeQaActive,
  lowSpeedStartedAt,
  mode,
  planarSpeedSq,
  stuckStrikes,
  lowSpeedThreshold = QA_SURVIVAL_LOW_SPEED_THRESHOLD,
  lowSpeedTriggerSeconds = QA_SURVIVAL_LOW_SPEED_TRIGGER_SECONDS,
}: {
  elapsedSeconds: number;
  forwardAmount: number;
  lilyCoilTubeQaActive: boolean;
  lowSpeedStartedAt: number;
  mode: QaSurvivalWalkMode;
  planarSpeedSq: number;
  stuckStrikes: number;
  lowSpeedThreshold?: number;
  lowSpeedTriggerSeconds?: number;
}) {
  const expectingMovement = mode !== "inspect" && forwardAmount > 0.18;
  if (!lilyCoilTubeQaActive && expectingMovement && planarSpeedSq < lowSpeedThreshold * lowSpeedThreshold) {
    if (lowSpeedStartedAt <= 0) {
      return {
        expectingMovement,
        lowSpeedStartedAt: elapsedSeconds,
        shouldRecover: false,
        stuckStrikes,
      };
    }

    if (elapsedSeconds - lowSpeedStartedAt > lowSpeedTriggerSeconds) {
      return {
        expectingMovement,
        lowSpeedStartedAt: elapsedSeconds,
        shouldRecover: true,
        stuckStrikes: Math.min(stuckStrikes + 1, QA_WALK_MAX_STUCK_STRIKES),
      };
    }

    return {
      expectingMovement,
      lowSpeedStartedAt,
      shouldRecover: false,
      stuckStrikes,
    };
  }

  return {
    expectingMovement,
    lowSpeedStartedAt: 0,
    shouldRecover: false,
    stuckStrikes,
  };
}

export function resolveQaWalkProgressRecovery({
  elapsedSeconds,
  forwardClearance,
  lastProgressAt,
  lastProgressPosition,
  lilyCoilTubeQaActive,
  mode,
  planarSpeedSq,
  position,
  qaRouteActive,
  stuckStrikes,
  waypoint,
  waypointDistance,
  lowSpeedThreshold = QA_SURVIVAL_LOW_SPEED_THRESHOLD,
  minProgress = QA_SURVIVAL_WALK_MIN_PROGRESS,
  minTowardProgress = QA_SURVIVAL_WALK_MIN_TOWARD_PROGRESS,
  probeDistance = QA_SURVIVAL_WALK_PROBE_DISTANCE,
  stuckCheckSeconds = QA_SURVIVAL_STUCK_CHECK_SECONDS,
}: {
  elapsedSeconds: number;
  forwardClearance: number;
  lastProgressAt: number;
  lastProgressPosition: { x: number; z: number };
  lilyCoilTubeQaActive: boolean;
  mode: QaSurvivalWalkMode;
  planarSpeedSq: number;
  position: { x: number; z: number };
  qaRouteActive: boolean;
  stuckStrikes: number;
  waypoint: { x: number; z: number };
  waypointDistance: number;
  lowSpeedThreshold?: number;
  minProgress?: number;
  minTowardProgress?: number;
  probeDistance?: number;
  stuckCheckSeconds?: number;
}): {
  action: QaWalkProgressRecoveryAction;
  clearLane: boolean;
  forwardAmount: number;
  movingClearly: boolean;
  progressDistanceSq: number;
  recoveryReason: QaWalkProgressRecoveryReason | null;
  shouldCheck: boolean;
  stuckStrikes: number;
  towardProgress: number;
} {
  const shouldCheck = !lilyCoilTubeQaActive &&
    mode !== "inspect" &&
    mode !== "act" &&
    elapsedSeconds - lastProgressAt > stuckCheckSeconds;

  if (!shouldCheck) {
    return {
      action: "none",
      clearLane: false,
      forwardAmount: 0,
      movingClearly: false,
      progressDistanceSq: 0,
      recoveryReason: null,
      shouldCheck,
      stuckStrikes,
      towardProgress: 0,
    };
  }

  const progressDistanceX = position.x - lastProgressPosition.x;
  const progressDistanceZ = position.z - lastProgressPosition.z;
  const progressDistanceSq = progressDistanceX * progressDistanceX + progressDistanceZ * progressDistanceZ;
  const previousWaypointDistanceX = waypoint.x - lastProgressPosition.x;
  const previousWaypointDistanceZ = waypoint.z - lastProgressPosition.z;
  const previousWaypointDistance = Math.sqrt(
    previousWaypointDistanceX * previousWaypointDistanceX +
    previousWaypointDistanceZ * previousWaypointDistanceZ,
  );
  const towardProgress = previousWaypointDistance - waypointDistance;
  const clearLane = forwardClearance > probeDistance * 0.88;
  const movingClearly = planarSpeedSq > (lowSpeedThreshold * 1.35) * (lowSpeedThreshold * 1.35);
  const minProgressSq = minProgress * minProgress;

  if (progressDistanceSq < minProgressSq || (!clearLane && towardProgress < minTowardProgress)) {
    const nextStuckStrikes = Math.min(stuckStrikes + 1, QA_WALK_MAX_STUCK_STRIKES);
    return {
      action: "recover",
      clearLane,
      forwardAmount: nextStuckStrikes > 1 ? -0.24 : 0,
      movingClearly,
      progressDistanceSq,
      recoveryReason: progressDistanceSq < minProgressSq ? "progress" : "blocked-progress",
      shouldCheck,
      stuckStrikes: nextStuckStrikes,
      towardProgress,
    };
  }

  if (!qaRouteActive && clearLane && movingClearly && towardProgress < -minTowardProgress) {
    return {
      action: "set-forward-waypoint",
      clearLane,
      forwardAmount: 0,
      movingClearly,
      progressDistanceSq,
      recoveryReason: null,
      shouldCheck,
      stuckStrikes,
      towardProgress,
    };
  }

  if (progressDistanceSq > (minProgress * 1.55) * (minProgress * 1.55)) {
    return {
      action: "clear-stuck",
      clearLane,
      forwardAmount: 0,
      movingClearly,
      progressDistanceSq,
      recoveryReason: null,
      shouldCheck,
      stuckStrikes: 0,
      towardProgress,
    };
  }

  return {
    action: "none",
    clearLane,
    forwardAmount: 0,
    movingClearly,
    progressDistanceSq,
    recoveryReason: null,
    shouldCheck,
    stuckStrikes,
    towardProgress,
  };
}

export function isQaWalkMovingInOpenLane({
  forwardClearance,
  forwardLookAhead,
  lilyCoilTubeQaActive,
  planarSpeedSq,
  viewClearance,
  lowSpeedThreshold = QA_SURVIVAL_LOW_SPEED_THRESHOLD,
  softClearance = QA_SURVIVAL_WALK_SOFT_CLEARANCE,
  softLookAhead = QA_SURVIVAL_WALK_SOFT_LOOKAHEAD,
  viewSoftClearance = QA_SURVIVAL_VIEW_SOFT_CLEARANCE,
}: {
  forwardClearance: number;
  forwardLookAhead: number;
  lilyCoilTubeQaActive: boolean;
  planarSpeedSq: number;
  viewClearance: number;
  lowSpeedThreshold?: number;
  softClearance?: number;
  softLookAhead?: number;
  viewSoftClearance?: number;
}) {
  return !lilyCoilTubeQaActive &&
    planarSpeedSq > (lowSpeedThreshold * 2.2) * (lowSpeedThreshold * 2.2) &&
    forwardClearance > softClearance &&
    forwardLookAhead > softLookAhead &&
    viewClearance > viewSoftClearance * 0.82;
}

export function resolveQaWalkOpenLaneRecoveryRelief({
  elapsedSeconds,
  mode,
  movingInOpenLane,
  recoveryUntil,
  stuckStrikes,
}: {
  elapsedSeconds: number;
  mode: QaSurvivalWalkMode;
  movingInOpenLane: boolean;
  recoveryUntil: number;
  stuckStrikes: number;
}) {
  if (!movingInOpenLane || stuckStrikes <= 0) {
    return {
      changed: false,
      recoveryUntil,
      stuckStrikes,
    };
  }

  return {
    changed: true,
    recoveryUntil: mode === "recover"
      ? Math.min(recoveryUntil, elapsedSeconds + 0.18)
      : recoveryUntil,
    stuckStrikes: Math.max(0, stuckStrikes - 2),
  };
}

export function resolveQaWalkTelemetryMovement({
  elapsedSeconds,
  lastTelemetryAt,
  lastTelemetryPosition,
  planarSpeed,
  position,
}: {
  elapsedSeconds: number;
  lastTelemetryAt: number;
  lastTelemetryPosition: { x: number; y: number; z: number };
  planarSpeed: number;
  position: { x: number; y: number; z: number };
}) {
  const deltaSeconds = lastTelemetryAt > 0 ? elapsedSeconds - lastTelemetryAt : 0;
  const moveX = position.x - lastTelemetryPosition.x;
  const moveY = position.y - lastTelemetryPosition.y;
  const moveZ = position.z - lastTelemetryPosition.z;
  const moveSq = deltaSeconds > 0 ? moveX * moveX + moveY * moveY + moveZ * moveZ : 0;
  const jumpThreshold = Math.max(36, planarSpeed * Math.max(deltaSeconds, 0.016) * 3 + 18);
  return {
    deltaSeconds,
    moveSq,
    positionJumpAbnormality: deltaSeconds > 0 && moveSq > jumpThreshold * jumpThreshold,
  };
}

export function resolveQaWalkTelemetryAbnormality({
  expectingMovement,
  forwardClearance,
  lilyCoilTubeQaActive,
  movingInOpenLane,
  overheadClearance,
  planarSpeedSq,
  positionJumpAbnormality,
  recoveryReason,
  stuckStrikes,
  telemetryMoveSq,
  viewClearance,
  blockedClearance = QA_SURVIVAL_WALK_BLOCKED_CLEARANCE,
  lowSpeedThreshold = QA_SURVIVAL_LOW_SPEED_THRESHOLD,
  overheadBlockedClearance = QA_SURVIVAL_OVERHEAD_BLOCKED_CLEARANCE,
  viewBlockedClearance = QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE,
}: {
  expectingMovement: boolean;
  forwardClearance: number;
  lilyCoilTubeQaActive: boolean;
  movingInOpenLane: boolean;
  overheadClearance: number;
  planarSpeedSq: number;
  positionJumpAbnormality: boolean;
  recoveryReason: string;
  stuckStrikes: number;
  telemetryMoveSq: number;
  viewClearance: number;
  blockedClearance?: number;
  lowSpeedThreshold?: number;
  overheadBlockedClearance?: number;
  viewBlockedClearance?: number;
}): QaWalkTelemetryAbnormality {
  if (recoveryReason && recoveryReason !== "clear-exit" && recoveryReason !== "progress" && stuckStrikes >= 2) {
    return `recovery:${recoveryReason}`;
  }
  if (positionJumpAbnormality) return `position-jump:${Math.round(Math.sqrt(telemetryMoveSq))}`;
  if (stuckStrikes >= 3 && !movingInOpenLane) return "stuck-strikes";
  if (overheadClearance < overheadBlockedClearance) return "low-overhead";
  if (
    !lilyCoilTubeQaActive &&
    expectingMovement &&
    planarSpeedSq < (lowSpeedThreshold * 0.65) * (lowSpeedThreshold * 0.65)
  ) {
    return "slow-input";
  }
  if (forwardClearance < blockedClearance) return "low-clearance";
  if (viewClearance < viewBlockedClearance) return "low-view";
  return "";
}

function useLazyVector3Ref(): LazyVector3Ref {
  const vectorRef = useRef<THREE.Vector3 | null>(null);
  return useMemo(() => ({
    get current() {
      vectorRef.current ??= new THREE.Vector3();
      return vectorRef.current;
    },
    set current(value: THREE.Vector3) {
      vectorRef.current = value;
    },
  }), []);
}

export function useQaSurvivalWalkRuntimeState() {
  const qaSurvivalWalkEnabled = useMemo(() => isQaSurvivalWalkEnabled(), []);
  const qaSurvivalWalkStartDelaySeconds = useMemo(() => getQaSurvivalWalkStartDelaySeconds(), []);
  const qaWalkStartTime = useRef<number | null>(null);
  const qaWalkYaw = useRef<number | null>(null);
  const qaWalkLastDecisionAt = useRef(0);
  const qaWalkLastProgressAt = useRef(0);
  const qaWalkLastProgressPos = useLazyVector3Ref();
  const qaWalkInputState = useLazyRef<QaSurvivalWalkInputState>(() => ({ ...DEFAULT_QA_WALK_INPUT }));
  const qaWalkWaypoint = useLazyRef(() => ({ x: 0, z: 0, expiresAt: 0 }));
  const qaWalkNextDecisionAt = useRef(0);
  const qaWalkInspectUntil = useRef(0);
  const qaWalkNextInspectAt = useRef(0);
  const qaWalkInspectYaw = useRef(0);
  const qaWalkNextCombatCastAt = useRef(0);
  const qaWalkCombatFocusUntil = useRef(0);
  const qaWalkCombatTargetYaw = useRef(0);
  const qaWalkCombatSpellIndex = useRef(0);
  const qaWalkLastCombatCastAt = useRef(0);
  const qaWalkNextPracticeCastAt = useRef(0);
  const qaWalkPracticeSpellIndex = useRef(0);
  const qaWalkJumpHeldUntil = useRef(0);
  const qaWalkJumpWasPressed = useRef(false);
  const qaWalkRecoveryStartedAt = useRef(0);
  const qaWalkRecoveryUntil = useRef(0);
  const qaWalkRecoveryYaw = useRef(0);
  const qaWalkRecoveryStrafe = useRef(0);
  const qaWalkRecoveryStartPos = useLazyVector3Ref();
  const qaWalkLastUnstickNudgeAt = useRef(0);
  const qaWalkStuckStrikes = useRef(0);
  const qaWalkLowSpeedStartedAt = useRef(0);
  const qaWalkLilyTubeDirection = useRef(1);
  const qaWalkIntent = useRef<QaSurvivalIntent | null>(null);
  const qaWalkNextIntentAt = useRef(0);
  const qaWalkLastInteractionAt = useRef(0);
  const qaWalkInterestMemory = useLazyRef<Record<string, number>>(() => ({}));
  const qaWalkLastDialogActionAt = useRef(0);
  const qaWalkLastTelemetryAt = useRef(0);
  const qaWalkLastTelemetryPos = useLazyVector3Ref();
  const qaWalkLastDummyReanchorAt = useRef(0);
  const qaWalkRouteIndex = useRef(0);
  const qaWalkRouteSmoothedYaw = useRef<number | null>(null);
  const qaWalkRouteTargetId = useRef<string | null>(null);
  const qaWalkRouteBlockedSince = useRef(0);

  const resetQaWalkRecovery = useCallback(() => {
    qaWalkRecoveryStartedAt.current = 0;
    qaWalkRecoveryUntil.current = 0;
    qaWalkRecoveryYaw.current = 0;
    qaWalkRecoveryStrafe.current = 0;
    qaWalkRecoveryStartPos.current.set(0, 0, 0);
    qaWalkLastUnstickNudgeAt.current = 0;
    qaWalkStuckStrikes.current = 0;
    qaWalkLowSpeedStartedAt.current = 0;
    qaWalkRouteBlockedSince.current = 0;
  }, []);

  const resetQaWalkSession = useCallback((position?: QaWalkPosition) => {
    qaWalkStartTime.current = null;
    qaWalkYaw.current = null;
    qaWalkLastDecisionAt.current = 0;
    qaWalkLastProgressAt.current = 0;
    if (position) {
      qaWalkLastProgressPos.current.set(position.x, position.y, position.z);
      qaWalkWaypoint.current = { x: position.x, z: position.z, expiresAt: 0 };
    } else {
      qaWalkWaypoint.current.expiresAt = 0;
    }
    qaWalkInputState.current = { ...DEFAULT_QA_WALK_INPUT };
    qaWalkNextDecisionAt.current = 0;
    qaWalkInspectUntil.current = 0;
    qaWalkCombatFocusUntil.current = 0;
    qaWalkNextCombatCastAt.current = 0;
    qaWalkLastCombatCastAt.current = 0;
    qaWalkNextPracticeCastAt.current = 0;
    qaWalkIntent.current = null;
    qaWalkNextIntentAt.current = 0;
    qaWalkRouteIndex.current = 0;
    qaWalkRouteSmoothedYaw.current = null;
    qaWalkRouteTargetId.current = null;
    qaWalkLastTelemetryAt.current = 0;
    qaWalkLastDummyReanchorAt.current = 0;
    resetQaWalkRecovery();
  }, [resetQaWalkRecovery]);

  const startQaWalkSession = useCallback((options: {
    startedAt: number;
    position: QaWalkPosition;
    nextInspectAt: number;
  }) => {
    qaWalkStartTime.current = options.startedAt;
    qaWalkWaypoint.current.expiresAt = 0;
    qaWalkNextDecisionAt.current = 0;
    qaWalkInspectUntil.current = 0;
    qaWalkCombatFocusUntil.current = 0;
    qaWalkNextCombatCastAt.current = 0;
    qaWalkLastCombatCastAt.current = 0;
    qaWalkNextPracticeCastAt.current = 0;
    qaWalkIntent.current = null;
    qaWalkNextIntentAt.current = 0;
    qaWalkRouteIndex.current = 0;
    qaWalkRouteSmoothedYaw.current = null;
    qaWalkRouteTargetId.current = null;
    qaWalkLastTelemetryAt.current = 0;
    qaWalkLastTelemetryPos.current.set(options.position.x, options.position.y, options.position.z);
    qaWalkLastDummyReanchorAt.current = 0;
    resetQaWalkRecovery();
    qaWalkNextInspectAt.current = options.nextInspectAt;
  }, [resetQaWalkRecovery]);

  return {
    qaSurvivalWalkEnabled,
    qaSurvivalWalkStartDelaySeconds,
    qaWalkStartTime,
    qaWalkYaw,
    qaWalkLastDecisionAt,
    qaWalkLastProgressAt,
    qaWalkLastProgressPos,
    qaWalkInputState,
    qaWalkWaypoint,
    qaWalkNextDecisionAt,
    qaWalkInspectUntil,
    qaWalkNextInspectAt,
    qaWalkInspectYaw,
    qaWalkNextCombatCastAt,
    qaWalkCombatFocusUntil,
    qaWalkCombatTargetYaw,
    qaWalkCombatSpellIndex,
    qaWalkLastCombatCastAt,
    qaWalkNextPracticeCastAt,
    qaWalkPracticeSpellIndex,
    qaWalkJumpHeldUntil,
    qaWalkJumpWasPressed,
    qaWalkRecoveryStartedAt,
    qaWalkRecoveryUntil,
    qaWalkRecoveryYaw,
    qaWalkRecoveryStrafe,
    qaWalkRecoveryStartPos,
    qaWalkLastUnstickNudgeAt,
    qaWalkStuckStrikes,
    qaWalkLowSpeedStartedAt,
    qaWalkLilyTubeDirection,
    qaWalkIntent,
    qaWalkNextIntentAt,
    qaWalkLastInteractionAt,
    qaWalkInterestMemory,
    qaWalkLastDialogActionAt,
    qaWalkLastTelemetryAt,
    qaWalkLastTelemetryPos,
    qaWalkLastDummyReanchorAt,
    qaWalkRouteIndex,
    qaWalkRouteSmoothedYaw,
    qaWalkRouteTargetId,
    qaWalkRouteBlockedSince,
    resetQaWalkRecovery,
    resetQaWalkSession,
    startQaWalkSession,
  };
}
