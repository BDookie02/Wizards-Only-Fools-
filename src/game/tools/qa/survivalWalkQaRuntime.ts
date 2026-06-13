import { useCallback, useMemo, useRef } from "react";
import * as THREE from "three";
import { useLazyRef } from "../../systems/react/useLazyRef";
import {
  QA_LILY_COIL_TUBE_FORWARD,
  QA_LILY_COIL_TUBE_LOOK_AHEAD_T,
  QA_LILY_COIL_TUBE_STRAFE,
} from "../../systems/player/playerLilyCoilTubeRuntime";
import {
  getLilyCoilTubeFrameInto,
  type LilyCoilTubeFrame,
} from "../../systems/world/villages/lilyCoilTubeMotion";
import {
  QA_SURVIVAL_OVERHEAD_BLOCKED_CLEARANCE,
  QA_SURVIVAL_OVERHEAD_SOFT_CLEARANCE,
  QA_BASE_VILLAGE_ROAD_HALF_WIDTH,
  QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT,
  QA_DARREL_GROVE_CLEARING_LOCAL_X,
  QA_DARREL_GROVE_CLEARING_LOCAL_Z,
  QA_DARREL_GROVE_DRAGON_DOOR_Z,
  QA_DARREL_GROVE_DRAGON_INTERACT_DISTANCE,
  QA_DARREL_GROVE_DRAGON_INTENT_SECONDS,
  QA_DARREL_GROVE_DRAGON_INTEREST_SCORE,
  QA_DARREL_GROVE_DRAGON_SIDE_APPROACH_X,
  QA_DARREL_GROVE_DRAGON_SIDE_APPROACH_Z,
  QA_DARREL_GROVE_DRAGON_SIDE_STAIR_X,
  QA_DARREL_GROVE_DRAGON_SIDE_STAIR_Z,
  QA_DARREL_GROVE_DRAGON_STEP_JUMP_DISTANCE,
  QA_DARREL_GROVE_RESCUE_Y,
  QA_INTENT_DUMMY_CLOSE_DISTANCE,
  QA_INTENT_DUMMY_KEEP_DISTANCE,
  QA_INTENT_DUMMY_RANGE,
  QA_INTENT_DUMMY_TEST_RANGE,
  QA_INTENT_INTERACT_DISTANCE,
  QA_INTENT_INTEREST_STALE_SECONDS,
  QA_INTENT_MANA_COLLECT_RADIUS,
  QA_INTENT_MANA_LOW_THRESHOLD,
  QA_INTENT_MANA_RANGE,
  QA_INTENT_OBSERVE_SECONDS,
  QA_INTENT_QUEST_RANGE,
  QA_INTENT_REPLAN_MAX_SECONDS,
  QA_INTENT_REPLAN_MIN_SECONDS,
  QA_SURVIVAL_INSPECTION_MAX_INTERVAL,
  QA_SURVIVAL_INSPECTION_MAX_SECONDS,
  QA_SURVIVAL_INSPECTION_MIN_INTERVAL,
  QA_SURVIVAL_INSPECTION_MIN_SECONDS,
  QA_SURVIVAL_COMBAT_TARGET_RANGE,
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
  QA_SURVIVAL_RECOVERY_CLEAR_EXIT_DISTANCE,
  QA_SURVIVAL_RECOVERY_CLEAR_EXIT_SECONDS,
  QA_SURVIVAL_RECOVERY_MAX_SECONDS,
  QA_SURVIVAL_RECOVERY_MIN_ESCAPE_DISTANCE,
  QA_SURVIVAL_RECOVERY_MIN_SECONDS,
  QA_SURVIVAL_RECOVERY_NUDGE_DISTANCE,
  QA_SURVIVAL_RECOVERY_NUDGE_SECONDS,
  QA_SURVIVAL_RECOVERY_REVERSE_SECONDS,
  QA_SURVIVAL_RECOVERY_REVERSE_STUCK_SECONDS,
  QA_SURVIVAL_RECOVERY_TURN_RATE,
  QA_SURVIVAL_STUCK_CHECK_SECONDS,
  QA_SURVIVAL_WAYPOINT_MAX_DISTANCE,
  QA_SURVIVAL_WAYPOINT_MIN_DISTANCE,
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
  randomRangeFromNoise,
  survivalishTurnNoise,
  type QaManaFlowerSnapshot,
  type QaSpellDummySnapshot,
  type QaSurvivalIntent,
  type QaSurvivalIntentKind,
  type QaSurvivalRouteWaypoint,
  type QaSurvivalWalkInputState,
  type QaSurvivalWalkMode,
} from "./survivalWalkQa";
import {
  DARREL_QUEST_CHUNK,
  SURVIVAL_BLOCK_SIZE,
} from "../../../store/gameStore";

type QaWalkPosition = { x: number; y: number; z: number };
type QaWalkWaypoint = { x: number; z: number; expiresAt: number };
type QaWalkQuestIntentTarget = { id: string; label: string; x: number; y: number; z: number };
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

export function resolveQaWalkWaypointRefreshState({
  blockSize,
  elapsedSeconds,
  maxLocalDistance,
  position,
  qaRouteActive,
  routeReachDistance = QA_SURVIVAL_ROUTE_REACH_DISTANCE,
  travelReachDistance = 18,
  waypoint,
}: {
  blockSize: number;
  elapsedSeconds: number;
  maxLocalDistance: number;
  position: { x: number; z: number };
  qaRouteActive: boolean;
  routeReachDistance?: number;
  travelReachDistance?: number;
  waypoint: QaWalkWaypoint;
}) {
  const waypointDistanceX = waypoint.x - position.x;
  const waypointDistanceZ = waypoint.z - position.z;
  const waypointDistanceSq = waypointDistanceX * waypointDistanceX + waypointDistanceZ * waypointDistanceZ;
  const waypointDistance = Math.sqrt(waypointDistanceSq);
  const waypointReachDistance = qaRouteActive ? routeReachDistance : travelReachDistance;
  const preferCenter = !qaRouteActive && maxLocalDistance > blockSize * 0.48;
  return {
    preferCenter,
    shouldRefresh:
      elapsedSeconds >= waypoint.expiresAt ||
      waypointDistanceSq < waypointReachDistance * waypointReachDistance ||
      preferCenter,
    waypointDistance,
    waypointDistanceSq,
    waypointReachDistance,
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

export function getQaWalkIntentDistance(intent: QaSurvivalIntent | null, position: { x: number; z: number }) {
  if (!intent) return Number.POSITIVE_INFINITY;
  const distanceX = intent.x - position.x;
  const distanceZ = intent.z - position.z;
  return Math.sqrt(distanceX * distanceX + distanceZ * distanceZ);
}

export function resolveQaWalkIntentMoveTarget({
  chunkCenterX,
  chunkCenterZ,
  intent,
  isDarrelGroveQaArea,
  position,
}: {
  chunkCenterX: number;
  chunkCenterZ: number;
  intent: QaSurvivalIntent;
  isDarrelGroveQaArea: boolean;
  position: QaWalkPosition;
}): QaWalkPosition {
  if (intent.kind !== "darrel-dragon" || !isDarrelGroveQaArea) return intent;

  const localX = position.x - chunkCenterX;
  const localZ = position.z - chunkCenterZ;
  const routeSide = localX >= 0 ? 1 : -1;
  const stage = (x: number, z: number) => ({
    x: chunkCenterX + x,
    y: intent.y,
    z: chunkCenterZ + z,
  });

  if (localZ > QA_DARREL_GROVE_DRAGON_SIDE_APPROACH_Z + 14) {
    return stage(
      routeSide * QA_DARREL_GROVE_DRAGON_SIDE_APPROACH_X,
      QA_DARREL_GROVE_DRAGON_SIDE_APPROACH_Z,
    );
  }
  if (
    Math.abs(localX) > QA_DARREL_GROVE_DRAGON_SIDE_STAIR_X + 12 ||
    localZ < QA_DARREL_GROVE_DRAGON_SIDE_STAIR_Z - 16
  ) {
    return stage(
      routeSide * QA_DARREL_GROVE_DRAGON_SIDE_STAIR_X,
      QA_DARREL_GROVE_DRAGON_SIDE_STAIR_Z,
    );
  }
  if (Math.abs(localX) > 18 || localZ < QA_DARREL_GROVE_DRAGON_DOOR_Z - 8) {
    return stage(0, QA_DARREL_GROVE_DRAGON_DOOR_Z);
  }
  return intent;
}

export function resolveQaWalkIntentCompletionDistance({
  intent,
  manaFlowers,
  dragonInteractDistance = QA_DARREL_GROVE_DRAGON_INTERACT_DISTANCE,
  dummyKeepDistance = QA_INTENT_DUMMY_KEEP_DISTANCE,
  interactDistance = QA_INTENT_INTERACT_DISTANCE,
  manaCollectRadius = QA_INTENT_MANA_COLLECT_RADIUS,
}: {
  intent: QaSurvivalIntent;
  manaFlowers: QaManaFlowerSnapshot[];
  dragonInteractDistance?: number;
  dummyKeepDistance?: number;
  interactDistance?: number;
  manaCollectRadius?: number;
}) {
  if (intent.kind === "mana-flower") {
    let flowerRadius = 0;
    for (const flower of manaFlowers) {
      if (flower.id === intent.id) {
        flowerRadius = Number.isFinite(flower.radius) ? flower.radius ?? 0 : 0;
        break;
      }
    }
    return Math.max(manaCollectRadius, 1.2 + flowerRadius);
  }
  if (intent.kind === "spell-dummy") return dummyKeepDistance;
  if (intent.kind === "darrel-dragon") return dragonInteractDistance;
  return interactDistance;
}

export function resolveQaWalkIntentWaypoint({
  elapsedSeconds,
  intent,
  maxWaypointSeconds = 3.8,
}: {
  elapsedSeconds: number;
  intent: QaSurvivalIntent;
  maxWaypointSeconds?: number;
}) {
  return {
    x: intent.x,
    z: intent.z,
    expiresAt: Math.min(intent.expiresAt, elapsedSeconds + maxWaypointSeconds),
  };
}

export function resolveQaWalkIntentChoice({
  currentIntent,
  darrelDragonWorldPosition,
  elapsedSeconds,
  interestMemory,
  isDarrelGroveQaArea,
  lowestRunePower,
  manaFlowers,
  position,
  qaSpellDummyRunActive,
  questTargets,
  spellDummies,
}: {
  currentIntent: QaSurvivalIntent | null;
  darrelDragonWorldPosition: QaWalkPosition;
  elapsedSeconds: number;
  interestMemory: Record<string, number>;
  isDarrelGroveQaArea: boolean;
  lowestRunePower: number;
  manaFlowers: QaManaFlowerSnapshot[];
  position: QaWalkPosition;
  qaSpellDummyRunActive: boolean;
  questTargets: QaWalkQuestIntentTarget[];
  spellDummies: QaSpellDummySnapshot[];
}): {
  intent: QaSurvivalIntent | null;
  memoryKey: string | null;
  memorySeenAt: number;
  nextIntentAt: number | null;
  waypoint: { x: number; z: number; expiresAt: number } | null;
} {
  let shouldPrioritizeDummies = false;
  if (qaSpellDummyRunActive) {
    for (const dummy of spellDummies) {
      if (dummy.health > 0) {
        shouldPrioritizeDummies = true;
        break;
      }
    }
  }

  let currentDummy: QaSpellDummySnapshot | null = null;
  if (currentIntent?.kind === "spell-dummy") {
    for (const dummy of spellDummies) {
      if (dummy.id === currentIntent.id) {
        currentDummy = dummy;
        break;
      }
    }
  }

  const abandonCurrentDummy = qaSpellDummyRunActive && currentIntent?.kind === "spell-dummy" && (
    !currentDummy ||
    currentDummy.health <= 38 ||
    getQaWalkIntentDistance(currentIntent, position) > QA_SURVIVAL_COMBAT_TARGET_RANGE * 1.05
  );
  if (
    currentIntent &&
    elapsedSeconds < currentIntent.expiresAt &&
    getQaWalkIntentDistance(currentIntent, position) > resolveQaWalkIntentCompletionDistance({
      intent: currentIntent,
      manaFlowers,
    }) &&
    !(shouldPrioritizeDummies && currentIntent.kind === "mana-flower") &&
    !abandonCurrentDummy
  ) {
    return {
      intent: currentIntent,
      memoryKey: null,
      memorySeenAt: elapsedSeconds,
      nextIntentAt: null,
      waypoint: resolveQaWalkIntentWaypoint({ elapsedSeconds, intent: currentIntent }),
    };
  }

  const makeIntent = (
    kind: QaSurvivalIntentKind,
    id: string,
    label: string,
    target: QaWalkPosition,
    durationSeconds = QA_INTENT_INTEREST_STALE_SECONDS,
  ): QaSurvivalIntent => ({
    kind,
    id,
    label,
    x: target.x,
    y: target.y,
    z: target.z,
    expiresAt: elapsedSeconds + durationSeconds,
    observeUntil: elapsedSeconds + QA_INTENT_OBSERVE_SECONDS,
  });
  const scoreInterest = (id: string, score: number) => {
    const lastSeen = interestMemory[id] ?? -Infinity;
    return elapsedSeconds - lastSeen < QA_INTENT_INTEREST_STALE_SECONDS ? score - 16 : score;
  };

  let bestIntent: QaSurvivalIntent | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  const consider = (intent: QaSurvivalIntent, score: number) => {
    const adjustedScore = scoreInterest(`${intent.kind}:${intent.id}`, score);
    if (adjustedScore > bestScore) {
      bestIntent = intent;
      bestScore = adjustedScore;
    }
  };

  const needsMana = shouldPrioritizeDummies ? false : lowestRunePower < QA_INTENT_MANA_LOW_THRESHOLD;
  const manaRangeSq = QA_INTENT_MANA_RANGE * QA_INTENT_MANA_RANGE;
  for (const flower of manaFlowers) {
    if (shouldPrioritizeDummies && !needsMana) continue;
    const distanceX = flower.x - position.x;
    const distanceZ = flower.z - position.z;
    const distanceSq = distanceX * distanceX + distanceZ * distanceZ;
    if (distanceSq > manaRangeSq) continue;
    const distance = Math.sqrt(distanceSq);
    const urgency = needsMana ? 46 : 14;
    consider(
      makeIntent("mana-flower", flower.id, "mana flower", { x: flower.x, y: flower.y, z: flower.z }, needsMana ? 15 : 8),
      urgency - distance / 26,
    );
  }

  const dummyIntentRange = qaSpellDummyRunActive ? QA_INTENT_DUMMY_TEST_RANGE : QA_INTENT_DUMMY_RANGE;
  const dummyIntentRangeSq = dummyIntentRange * dummyIntentRange;
  for (const dummy of spellDummies) {
    const distanceX = dummy.position.x - position.x;
    const distanceZ = dummy.position.z - position.z;
    const distanceSq = distanceX * distanceX + distanceZ * distanceZ;
    if (distanceSq > dummyIntentRangeSq) continue;
    const distance = Math.sqrt(distanceSq);
    const healthScore = clampNumber(dummy.health / 7, 0, 18);
    const woundedPenalty = qaSpellDummyRunActive && dummy.health <= 38 ? 20 : 0;
    consider(
      makeIntent("spell-dummy", dummy.id, `dummy ${Math.round(dummy.health)}`, dummy.position, qaSpellDummyRunActive ? 24 : 10),
      (qaSpellDummyRunActive ? 104 - distance / 16 : 52 - distance / 9) + healthScore - woundedPenalty,
    );
  }

  const questIntentRangeSq = QA_INTENT_QUEST_RANGE * QA_INTENT_QUEST_RANGE;
  for (const target of questTargets) {
    const distanceX = target.x - position.x;
    const distanceZ = target.z - position.z;
    const distanceSq = distanceX * distanceX + distanceZ * distanceZ;
    if (distanceSq > questIntentRangeSq) continue;
    const distance = Math.sqrt(distanceSq);
    consider(
      makeIntent("quest-target", target.id, target.label, { x: target.x, y: target.y, z: target.z }, 18),
      42 - distance / 22,
    );
  }

  if (isDarrelGroveQaArea) {
    const dragonDistanceX = darrelDragonWorldPosition.x - position.x;
    const dragonDistanceZ = darrelDragonWorldPosition.z - position.z;
    const dragonDistance = Math.sqrt(dragonDistanceX * dragonDistanceX + dragonDistanceZ * dragonDistanceZ);
    consider(
      makeIntent("darrel-dragon", "darrel-dragon", "spirit dragon", darrelDragonWorldPosition, QA_DARREL_GROVE_DRAGON_INTENT_SECONDS),
      QA_DARREL_GROVE_DRAGON_INTEREST_SCORE - dragonDistance / 14,
    );
  }

  if (!bestIntent || bestScore < 8) {
    return {
      intent: null,
      memoryKey: null,
      memorySeenAt: elapsedSeconds,
      nextIntentAt: null,
      waypoint: null,
    };
  }

  const memoryKey = `${bestIntent.kind}:${bestIntent.id}`;
  return {
    intent: bestIntent,
    memoryKey,
    memorySeenAt: elapsedSeconds,
    nextIntentAt: elapsedSeconds + randomRangeFromNoise(
      survivalishTurnNoise(bestIntent.x, bestIntent.z, elapsedSeconds),
      QA_INTENT_REPLAN_MIN_SECONDS,
      QA_INTENT_REPLAN_MAX_SECONDS,
    ),
    waypoint: resolveQaWalkIntentWaypoint({ elapsedSeconds, intent: bestIntent }),
  };
}

export function resolveQaWalkActiveIntentRefresh({
  currentIntent,
  elapsedSeconds,
  qaRouteActive,
  qaSpellDummyRunActive,
  spellDummies,
}: {
  currentIntent: QaSurvivalIntent | null;
  elapsedSeconds: number;
  qaRouteActive: boolean;
  qaSpellDummyRunActive: boolean;
  spellDummies: QaSpellDummySnapshot[];
}): {
  activeIntent: QaSurvivalIntent | null;
  clearIntent: boolean;
  resetNextIntentAt: boolean;
  shouldChooseIntent: boolean;
} {
  if (qaRouteActive) {
    return {
      activeIntent: null,
      clearIntent: currentIntent !== null,
      resetNextIntentAt: false,
      shouldChooseIntent: false,
    };
  }

  let activeIntent = currentIntent && elapsedSeconds < currentIntent.expiresAt ? currentIntent : null;
  let clearIntent = !activeIntent && currentIntent !== null;
  if (!activeIntent && qaSpellDummyRunActive && spellDummies.length > 0) {
    return {
      activeIntent: null,
      clearIntent,
      resetNextIntentAt: false,
      shouldChooseIntent: true,
    };
  }

  let hasActiveSpellDummy = false;
  if (activeIntent?.kind === "mana-flower" && qaSpellDummyRunActive) {
    for (const dummy of spellDummies) {
      if (dummy.health > 0) {
        hasActiveSpellDummy = true;
        break;
      }
    }
  }
  if (activeIntent?.kind === "mana-flower" && qaSpellDummyRunActive && hasActiveSpellDummy) {
    return {
      activeIntent: null,
      clearIntent: true,
      resetNextIntentAt: true,
      shouldChooseIntent: true,
    };
  }

  if (activeIntent?.kind === "spell-dummy") {
    let liveDummy: QaSpellDummySnapshot | null = null;
    for (const dummy of spellDummies) {
      if (dummy.id === activeIntent.id) {
        liveDummy = dummy;
        break;
      }
    }
    if (liveDummy) {
      activeIntent = {
        ...activeIntent,
        x: liveDummy.position.x,
        y: liveDummy.position.y,
        z: liveDummy.position.z,
      };
    } else if (qaSpellDummyRunActive) {
      return {
        activeIntent: null,
        clearIntent: true,
        resetNextIntentAt: true,
        shouldChooseIntent: true,
      };
    }
  }

  return {
    activeIntent,
    clearIntent,
    resetNextIntentAt: false,
    shouldChooseIntent: false,
  };
}

export function resolveQaWalkInspectionStart({
  currentYaw,
  elapsedSeconds,
  hasCurrentIntent,
  hasSpellDummies,
  inspectUntil,
  lilyCoilTubeQaActive,
  nextInspectAt,
  position,
  qaRouteActive,
  qaSpellDummyRunActive,
  recoveryUntil,
  stuckStrikes,
  inspectionMaxInterval = QA_SURVIVAL_INSPECTION_MAX_INTERVAL,
  inspectionMaxSeconds = QA_SURVIVAL_INSPECTION_MAX_SECONDS,
  inspectionMinInterval = QA_SURVIVAL_INSPECTION_MIN_INTERVAL,
  inspectionMinSeconds = QA_SURVIVAL_INSPECTION_MIN_SECONDS,
}: {
  currentYaw: number;
  elapsedSeconds: number;
  hasCurrentIntent: boolean;
  hasSpellDummies: boolean;
  inspectUntil: number;
  lilyCoilTubeQaActive: boolean;
  nextInspectAt: number;
  position: QaWalkPosition;
  qaRouteActive: boolean;
  qaSpellDummyRunActive: boolean;
  recoveryUntil: number;
  stuckStrikes: number;
  inspectionMaxInterval?: number;
  inspectionMaxSeconds?: number;
  inspectionMinInterval?: number;
  inspectionMinSeconds?: number;
}) {
  if (
    lilyCoilTubeQaActive ||
    qaRouteActive ||
    hasCurrentIntent ||
    (qaSpellDummyRunActive && hasSpellDummies) ||
    elapsedSeconds < nextInspectAt ||
    elapsedSeconds < inspectUntil ||
    elapsedSeconds <= recoveryUntil + 2.5 ||
    stuckStrikes > 1
  ) {
    return null;
  }

  const inspectNoise = survivalishTurnNoise(position.x + 103, position.z - 59, elapsedSeconds);
  const nextInspectUntil = elapsedSeconds + randomRangeFromNoise(
    inspectNoise,
    inspectionMinSeconds,
    inspectionMaxSeconds,
  );
  return {
    inspectUntil: nextInspectUntil,
    inspectYaw: currentYaw + randomRangeFromNoise(inspectNoise, -0.85, 0.85),
    nextInspectAt: nextInspectUntil + randomRangeFromNoise(
      survivalishTurnNoise(position.x - 17, position.z + 97, elapsedSeconds * 0.4),
      inspectionMinInterval,
      inspectionMaxInterval,
    ),
  };
}

export function resolveQaWalkRoamWaypoint({
  blockSize,
  chunkCenterX,
  chunkCenterZ,
  currentYaw,
  elapsedSeconds,
  maxLocalDistance,
  position,
  preferCenter,
  waypointMaxDistance = QA_SURVIVAL_WAYPOINT_MAX_DISTANCE,
  waypointMinDistance = QA_SURVIVAL_WAYPOINT_MIN_DISTANCE,
}: {
  blockSize: number;
  chunkCenterX: number;
  chunkCenterZ: number;
  currentYaw: number;
  elapsedSeconds: number;
  maxLocalDistance: number;
  position: QaWalkPosition;
  preferCenter: boolean;
  waypointMaxDistance?: number;
  waypointMinDistance?: number;
}) {
  const noiseA = survivalishTurnNoise(position.x + elapsedSeconds * 3.7, position.z - elapsedSeconds * 2.9, elapsedSeconds * 0.31);
  const noiseB = survivalishTurnNoise(position.x - 41.7, position.z + 19.3, elapsedSeconds * 0.23);
  const noiseC = survivalishTurnNoise(position.x + 7.9, position.z - 13.1, elapsedSeconds * 0.17);
  const edgePressure = clampNumber((maxLocalDistance - blockSize * 0.34) / (blockSize * 0.18), 0, 1);
  const centerYaw = Math.atan2(chunkCenterX - position.x, -(chunkCenterZ - position.z));
  const roamYaw = currentYaw + (noiseA - 0.5) * 1.85;
  const waypointYaw = preferCenter || edgePressure > 0
    ? lerpAngleRadians(roamYaw, centerYaw, preferCenter ? 0.82 : edgePressure * 0.72)
    : roamYaw;
  const distance = randomRangeFromNoise(noiseB, waypointMinDistance, waypointMaxDistance);
  const sideOffset = (noiseC - 0.5) * 70;
  const forwardX = Math.sin(waypointYaw);
  const forwardZ = -Math.cos(waypointYaw);
  const rightX = Math.cos(waypointYaw);
  const rightZ = Math.sin(waypointYaw);
  return {
    x: position.x + forwardX * distance + rightX * sideOffset,
    z: position.z + forwardZ * distance + rightZ * sideOffset,
    expiresAt: elapsedSeconds + randomRangeFromNoise(noiseC, 6.5, 13.5),
  };
}

export function resolveQaWalkForwardWaypoint({
  distance = QA_SURVIVAL_WAYPOINT_MIN_DISTANCE * 1.15,
  elapsedSeconds,
  position,
  yaw,
}: {
  distance?: number;
  elapsedSeconds: number;
  position: QaWalkPosition;
  yaw: number;
}) {
  return {
    x: position.x + Math.sin(yaw) * distance,
    z: position.z - Math.cos(yaw) * distance,
    expiresAt: elapsedSeconds + 5.8,
  };
}

export function resolveQaWalkLilyCoilTubeWaypoint({
  active,
  elapsedSeconds,
  frameScratch,
  lookAheadT = QA_LILY_COIL_TUBE_LOOK_AHEAD_T,
  lookAheadJitterT = 0.014,
  maxTargetT = 0.98,
  minTargetT = 0.02,
  position,
  tubeDirection,
  tubeT,
}: {
  active: boolean;
  elapsedSeconds: number;
  frameScratch: LilyCoilTubeFrame;
  lookAheadT?: number;
  lookAheadJitterT?: number;
  maxTargetT?: number;
  minTargetT?: number;
  position: QaWalkPosition;
  tubeDirection: number;
  tubeT: number | null;
}) {
  if (!active || tubeT === null || !Number.isFinite(tubeT)) return null;

  const noise = survivalishTurnNoise(position.x + 317, position.z - 241, elapsedSeconds * 0.21);
  const direction = tubeDirection >= 0 ? 1 : -1;
  const targetT = clampNumber(
    tubeT + direction * (lookAheadT + (noise - 0.5) * lookAheadJitterT),
    minTargetT,
    maxTargetT,
  );
  const targetFrame = getLilyCoilTubeFrameInto(targetT, frameScratch);
  return {
    x: targetFrame.center.x,
    z: targetFrame.center.z,
    expiresAt: elapsedSeconds + randomRangeFromNoise(noise, 2.4, 4.1),
  };
}

export function isQaWalkDarrelGroveArea({
  chunkCenterX,
  chunkCenterZ,
  questChunkCenterX = DARREL_QUEST_CHUNK.cx * SURVIVAL_BLOCK_SIZE,
  questChunkCenterZ = DARREL_QUEST_CHUNK.cz * SURVIVAL_BLOCK_SIZE,
}: {
  chunkCenterX: number;
  chunkCenterZ: number;
  questChunkCenterX?: number;
  questChunkCenterZ?: number;
}) {
  return Math.abs(chunkCenterX - questChunkCenterX) < 1 &&
    Math.abs(chunkCenterZ - questChunkCenterZ) < 1;
}

export function resolveQaWalkDarrelGroveWaypoint({
  active,
  chunkCenterX,
  chunkCenterZ,
  elapsedSeconds,
  position,
}: {
  active: boolean;
  chunkCenterX: number;
  chunkCenterZ: number;
  elapsedSeconds: number;
  position: QaWalkPosition;
}) {
  if (!active) return null;

  const noiseA = survivalishTurnNoise(position.x + 73, position.z - 29, elapsedSeconds * 0.31);
  const noiseB = survivalishTurnNoise(position.x - 111, position.z + 53, elapsedSeconds * 0.27);
  const orbit = noiseA * Math.PI * 2;
  const radiusX = randomRangeFromNoise(noiseB, 26, 72);
  const radiusZ = randomRangeFromNoise(noiseA, 14, 42);
  const localTargetX = clampNumber(
    QA_DARREL_GROVE_CLEARING_LOCAL_X + Math.cos(orbit) * radiusX,
    -118,
    146,
  );
  const localTargetZ = clampNumber(
    QA_DARREL_GROVE_CLEARING_LOCAL_Z + Math.sin(orbit) * radiusZ,
    152,
    218,
  );

  return {
    x: chunkCenterX + localTargetX,
    z: chunkCenterZ + localTargetZ,
    expiresAt: elapsedSeconds + randomRangeFromNoise(noiseB, 4.6, 7.4),
  };
}

export function resolveQaWalkDarrelGroveRescuePosition({
  active,
  chunkCenterX,
  chunkCenterZ,
  currentIntent,
  localX,
  localZ,
  position,
}: {
  active: boolean;
  chunkCenterX: number;
  chunkCenterZ: number;
  currentIntent: QaSurvivalIntent | null;
  localX: number;
  localZ: number;
  position: QaWalkPosition;
}) {
  if (!active) return null;
  const followingDarrelDragonRoute = currentIntent?.kind === "darrel-dragon";
  const inRiverBridgePocket =
    localZ > 72 &&
    localZ < 148 &&
    Math.abs(localX) < 142;
  const underHouseOrRoof =
    localZ > -64 &&
    localZ < 72 &&
    Math.abs(localX) < 96;
  const belowClearWalkingSurface = position.y < 12;
  if (followingDarrelDragonRoute && !belowClearWalkingSurface) return null;
  if (!inRiverBridgePocket && !underHouseOrRoof && !belowClearWalkingSurface) return null;
  return {
    x: chunkCenterX + QA_DARREL_GROVE_CLEARING_LOCAL_X,
    y: QA_DARREL_GROVE_RESCUE_Y,
    z: chunkCenterZ + QA_DARREL_GROVE_CLEARING_LOCAL_Z,
  };
}

export function resolveQaWalkDarrelDragonRouteAssistPosition({
  active,
  chunkCenterX,
  chunkCenterZ,
  currentIntent,
  localX,
  localZ,
  position,
}: {
  active: boolean;
  chunkCenterX: number;
  chunkCenterZ: number;
  currentIntent: QaSurvivalIntent | null;
  localX: number;
  localZ: number;
  position: QaWalkPosition;
}) {
  if (!active || currentIntent?.kind !== "darrel-dragon") return null;
  const inSideSnagPocket =
    Math.abs(localX) > 58 &&
    Math.abs(localX) < 112 &&
    localZ > 36 &&
    localZ < 82 &&
    position.y > 12;
  const inPorchSnagPocket =
    Math.abs(localX) > 18 &&
    Math.abs(localX) < 48 &&
    localZ > -62 &&
    localZ < -34 &&
    position.y > 24;
  if (inPorchSnagPocket || inSideSnagPocket) {
    return {
      x: chunkCenterX,
      y: QA_DARREL_GROVE_RESCUE_Y,
      z: chunkCenterZ + QA_DARREL_GROVE_DRAGON_DOOR_Z,
    };
  }
  return null;
}

export function isQaWalkBaseVillageArea({
  chunkCenterX,
  chunkCenterZ,
  position,
  travelLimit = QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT,
}: {
  chunkCenterX: number;
  chunkCenterZ: number;
  position: QaWalkPosition;
  travelLimit?: number;
}) {
  return Math.abs(chunkCenterX) < 1 &&
    Math.abs(chunkCenterZ) < 1 &&
    Math.max(Math.abs(position.x), Math.abs(position.z)) < travelLimit + 54;
}

export function resolveQaWalkBaseVillageRoadWaypoint({
  active,
  currentYaw,
  elapsedSeconds,
  position,
  halfWidth = QA_BASE_VILLAGE_ROAD_HALF_WIDTH,
  travelLimit = QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT,
  waypointMaxDistance = QA_SURVIVAL_WAYPOINT_MAX_DISTANCE,
  waypointMinDistance = QA_SURVIVAL_WAYPOINT_MIN_DISTANCE,
}: {
  active: boolean;
  currentYaw: number;
  elapsedSeconds: number;
  position: QaWalkPosition;
  halfWidth?: number;
  travelLimit?: number;
  waypointMaxDistance?: number;
  waypointMinDistance?: number;
}) {
  if (!active) return null;

  const absX = Math.abs(position.x);
  const absZ = Math.abs(position.z);
  const onVerticalRoad = absX <= halfWidth;
  const onHorizontalRoad = absZ <= halfWidth;
  const noise = survivalishTurnNoise(position.x + 19, position.z - 37, elapsedSeconds * 0.41);
  const distance = randomRangeFromNoise(
    survivalishTurnNoise(position.x - 27, position.z + 11, elapsedSeconds * 0.23),
    waypointMinDistance * 0.68,
    waypointMaxDistance * 0.72,
  );
  let targetX = position.x;
  let targetZ = position.z;

  if (!onVerticalRoad && !onHorizontalRoad) {
    if (absX < absZ) {
      targetX = 0;
      targetZ = clampNumber(position.z, -travelLimit, travelLimit);
    } else {
      targetX = clampNumber(position.x, -travelLimit, travelLimit);
      targetZ = 0;
    }
  } else if (onVerticalRoad && (!onHorizontalRoad || noise < 0.58)) {
    const forwardZ = -Math.cos(currentYaw);
    const direction = position.z > travelLimit * 0.7
      ? -1
      : position.z < -travelLimit * 0.7
        ? 1
        : (Math.abs(forwardZ) > 0.22 ? Math.sign(forwardZ) : (noise > 0.5 ? 1 : -1));
    targetX = 0;
    targetZ = clampNumber(position.z + direction * distance, -travelLimit, travelLimit);
  } else {
    const forwardX = Math.sin(currentYaw);
    const direction = position.x > travelLimit * 0.7
      ? -1
      : position.x < -travelLimit * 0.7
        ? 1
        : (Math.abs(forwardX) > 0.22 ? Math.sign(forwardX) : (noise > 0.5 ? 1 : -1));
    targetX = clampNumber(position.x + direction * distance, -travelLimit, travelLimit);
    targetZ = 0;
  }

  return {
    x: targetX,
    z: targetZ,
    expiresAt: elapsedSeconds + randomRangeFromNoise(noise, 4.8, 8.2),
  };
}

export function resolveQaWalkBaseVillageRoadRescuePosition({
  active,
  position,
  halfWidth = QA_BASE_VILLAGE_ROAD_HALF_WIDTH,
  travelLimit = QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT,
}: {
  active: boolean;
  position: QaWalkPosition;
  halfWidth?: number;
  travelLimit?: number;
}) {
  if (!active) return null;
  const absX = Math.abs(position.x);
  const absZ = Math.abs(position.z);
  if (absX <= halfWidth || absZ <= halfWidth) return null;
  if (absX < absZ) {
    return {
      x: 0,
      y: position.y + 0.28,
      z: clampNumber(position.z, -travelLimit, travelLimit),
    };
  }
  return {
    x: clampNumber(position.x, -travelLimit, travelLimit),
    y: position.y + 0.28,
    z: 0,
  };
}

export function resolveQaWalkActiveIntentMovement({
  activeIntent,
  activeIntentDistance,
  completionDistance,
  currentYaw,
  elapsedSeconds,
  forwardClearance,
  intentMoveDistance,
  intentMoveTarget,
  position,
  qaSpellDummyRunActive,
  strafeAmount,
  dummyCloseDistance = QA_INTENT_DUMMY_CLOSE_DISTANCE,
  dummyKeepDistance = QA_INTENT_DUMMY_KEEP_DISTANCE,
  softClearance = QA_SURVIVAL_WALK_SOFT_CLEARANCE,
  turnInPlaceError = QA_SURVIVAL_WALK_TURN_IN_PLACE_ERROR,
}: {
  activeIntent: QaSurvivalIntent;
  activeIntentDistance: number;
  completionDistance: number;
  currentYaw: number;
  elapsedSeconds: number;
  forwardClearance: number;
  intentMoveDistance: number;
  intentMoveTarget: QaWalkPosition;
  position: QaWalkPosition;
  qaSpellDummyRunActive: boolean;
  strafeAmount: number;
  dummyCloseDistance?: number;
  dummyKeepDistance?: number;
  softClearance?: number;
  turnInPlaceError?: number;
}): {
  closeEnough: boolean;
  forwardAmount: number;
  mode: QaSurvivalWalkMode;
  sprint: boolean;
  strafeAmount: number;
  targetYaw: number;
} {
  const closeEnough = activeIntentDistance <= completionDistance;
  let mode: QaSurvivalWalkMode = closeEnough ? "act" : "approach";
  let nextForwardAmount: number;
  let nextStrafeAmount = strafeAmount;
  let sprint = !closeEnough &&
    activeIntentDistance > 72 &&
    activeIntent.kind !== "quest-target" &&
    activeIntent.kind !== "darrel-dragon";

  const nextTargetYaw = Math.atan2(intentMoveTarget.x - position.x, -(intentMoveTarget.z - position.z)) +
    Math.sin(elapsedSeconds * 0.76 + activeIntent.x * 0.001) * 0.045;

  if (activeIntent.kind === "spell-dummy") {
    if (qaSpellDummyRunActive) {
      mode = "act";
      nextForwardAmount = activeIntentDistance < dummyCloseDistance ? -0.04 : 0;
      nextStrafeAmount = Math.sin(elapsedSeconds * 2.15 + activeIntent.x * 0.01) * 0.04;
      sprint = false;
    } else if (activeIntentDistance < dummyCloseDistance) {
      nextForwardAmount = -0.18;
    } else if (activeIntentDistance > dummyKeepDistance) {
      nextForwardAmount = 0.42;
    } else {
      nextForwardAmount = 0.04;
    }
    if (!qaSpellDummyRunActive) {
      nextStrafeAmount = Math.sin(elapsedSeconds * 2.15 + activeIntent.x * 0.01) * 0.24;
    }
  } else if (closeEnough) {
    nextForwardAmount = activeIntent.kind === "mana-flower" ? 0.08 : 0;
    nextStrafeAmount = Math.sin(elapsedSeconds * 1.4 + activeIntent.z * 0.006) * 0.1;
  } else {
    nextForwardAmount = clampNumber(intentMoveDistance / 130, 0.34, 0.72);
    nextStrafeAmount *= 0.35;
  }

  const intentYawError = Math.abs(angleDeltaRadians(currentYaw, nextTargetYaw));
  const turnBeforeAdvanceThreshold = forwardClearance < softClearance
    ? turnInPlaceError * 0.74
    : turnInPlaceError * 1.45;
  if (!closeEnough && intentYawError > turnBeforeAdvanceThreshold) {
    nextForwardAmount = 0;
    nextStrafeAmount *= 0.35;
    sprint = false;
  }

  if (activeIntent.observeUntil && elapsedSeconds < activeIntent.observeUntil) {
    nextForwardAmount *= 0.34;
    sprint = false;
  }

  return {
    closeEnough,
    forwardAmount: nextForwardAmount,
    mode,
    sprint,
    strafeAmount: nextStrafeAmount,
    targetYaw: nextTargetYaw,
  };
}

export type QaWalkRecoveryRescueReason =
  | "darrel-route-assist"
  | "darrel-grove-rescue"
  | "base-road-rescue";

export function resolveQaWalkRecoveryRescuePlan({
  baseRoadRescuePosition,
  currentPosition,
  darrelDragonWorldPosition,
  darrelGroveRescuePosition,
  darrelRouteAssistPosition,
  elapsedSeconds,
  lastUnstickNudgeAt,
  minRecoverySeconds = QA_SURVIVAL_RECOVERY_MIN_SECONDS,
  targetYaw,
}: {
  baseRoadRescuePosition: QaWalkPosition | null;
  currentPosition: QaWalkPosition;
  darrelDragonWorldPosition: QaWalkPosition;
  darrelGroveRescuePosition: QaWalkPosition | null;
  darrelRouteAssistPosition: QaWalkPosition | null;
  elapsedSeconds: number;
  lastUnstickNudgeAt: number;
  minRecoverySeconds?: number;
  targetYaw: number;
}) {
  if (darrelRouteAssistPosition && elapsedSeconds > lastUnstickNudgeAt + 0.9) {
    const escapeYaw = Math.atan2(
      darrelDragonWorldPosition.x - darrelRouteAssistPosition.x,
      -(darrelDragonWorldPosition.z - darrelRouteAssistPosition.z),
    );
    return {
      position: darrelRouteAssistPosition,
      reason: "darrel-route-assist" as const,
      recoveryUntil: elapsedSeconds + 0.18,
      yaw: Number.isFinite(escapeYaw) ? escapeYaw : targetYaw,
    };
  }

  if (darrelGroveRescuePosition && elapsedSeconds > lastUnstickNudgeAt + 0.9) {
    const escapeYaw = Math.atan2(
      darrelGroveRescuePosition.x - currentPosition.x,
      -(darrelGroveRescuePosition.z - currentPosition.z),
    );
    return {
      position: darrelGroveRescuePosition,
      reason: "darrel-grove-rescue" as const,
      recoveryUntil: elapsedSeconds + minRecoverySeconds,
      yaw: Number.isFinite(escapeYaw) ? escapeYaw : targetYaw,
    };
  }

  if (baseRoadRescuePosition && elapsedSeconds > lastUnstickNudgeAt + 1.1) {
    const escapeYaw = Math.atan2(
      baseRoadRescuePosition.x - currentPosition.x,
      -(baseRoadRescuePosition.z - currentPosition.z),
    );
    return {
      position: baseRoadRescuePosition,
      reason: "base-road-rescue" as const,
      recoveryUntil: elapsedSeconds + minRecoverySeconds,
      yaw: Number.isFinite(escapeYaw) ? escapeYaw : targetYaw,
    };
  }

  return null;
}

export function shouldResolveQaWalkUnstickNudgePlan({
  elapsedSeconds,
  lastUnstickNudgeAt,
  recoveryAge,
  recoveryDistanceSq,
  stuckStrikes,
  minEscapeDistance = QA_SURVIVAL_RECOVERY_MIN_ESCAPE_DISTANCE,
  nudgeSeconds = QA_SURVIVAL_RECOVERY_NUDGE_SECONDS,
}: {
  elapsedSeconds: number;
  lastUnstickNudgeAt: number;
  recoveryAge: number;
  recoveryDistanceSq: number;
  stuckStrikes: number;
  minEscapeDistance?: number;
  nudgeSeconds?: number;
}) {
  const nudgeEscapeDistance = minEscapeDistance * 0.62;
  return stuckStrikes >= 3 &&
    recoveryAge > nudgeSeconds &&
    recoveryDistanceSq < nudgeEscapeDistance * nudgeEscapeDistance &&
    elapsedSeconds > lastUnstickNudgeAt + 1.1;
}

export function resolveQaWalkUnstickNudgePlan({
  currentPosition,
  elapsedSeconds,
  escapeYaw,
  minRecoverySeconds = QA_SURVIVAL_RECOVERY_MIN_SECONDS,
  nudgeDistance = QA_SURVIVAL_RECOVERY_NUDGE_DISTANCE,
  stuckStrikes,
}: {
  currentPosition: QaWalkPosition;
  elapsedSeconds: number;
  escapeYaw: number;
  minRecoverySeconds?: number;
  nudgeDistance?: number;
  stuckStrikes: number;
}) {
  const distance = nudgeDistance + Math.min(stuckStrikes, 6) * 0.8;
  return {
    position: {
      x: currentPosition.x + Math.sin(escapeYaw) * distance,
      y: currentPosition.y + 0.18,
      z: currentPosition.z - Math.cos(escapeYaw) * distance,
    },
    reason: "unstick-nudge" as const,
    recoveryUntil: elapsedSeconds + minRecoverySeconds,
    yaw: escapeYaw,
  };
}

export function resolveQaWalkRecoveryMovementFrame({
  elapsedSeconds,
  forwardClearance,
  recoveryAge,
  recoveryDistanceSq,
  recoveryStrafe,
  recoveryYaw,
  stuckStrikes,
  targetYaw,
  yawError,
  blockedClearance = QA_SURVIVAL_WALK_BLOCKED_CLEARANCE,
  clearExitDistance = QA_SURVIVAL_RECOVERY_CLEAR_EXIT_DISTANCE,
  clearExitSeconds = QA_SURVIVAL_RECOVERY_CLEAR_EXIT_SECONDS,
  minEscapeDistance = QA_SURVIVAL_RECOVERY_MIN_ESCAPE_DISTANCE,
  reverseSeconds = QA_SURVIVAL_RECOVERY_REVERSE_SECONDS,
  reverseStuckSeconds = QA_SURVIVAL_RECOVERY_REVERSE_STUCK_SECONDS,
  turnInPlaceError = QA_SURVIVAL_WALK_TURN_IN_PLACE_ERROR,
}: {
  elapsedSeconds: number;
  forwardClearance: number;
  recoveryAge: number;
  recoveryDistanceSq: number;
  recoveryStrafe: number;
  recoveryYaw: number;
  stuckStrikes: number;
  targetYaw: number;
  yawError: number;
  blockedClearance?: number;
  clearExitDistance?: number;
  clearExitSeconds?: number;
  minEscapeDistance?: number;
  reverseSeconds?: number;
  reverseStuckSeconds?: number;
  turnInPlaceError?: number;
}) {
  const escapeYaw = recoveryYaw || targetYaw;
  let forwardAmount = 0;
  let mode: QaSurvivalWalkMode = "recover";
  let nextStuckStrikes = stuckStrikes;
  let nextTargetYaw = escapeYaw;
  let recoveryReason = "";
  let recoveryUntil: number | null = null;
  let setForwardWaypointYaw: number | null = null;
  let strafeAmount = forwardClearance < blockedClearance ? 0 : recoveryStrafe;

  if (recoveryAge < reverseSeconds || forwardClearance < 2.4) {
    forwardAmount = -0.32;
  } else if (
    recoveryDistanceSq < minEscapeDistance * minEscapeDistance &&
    recoveryAge < reverseStuckSeconds
  ) {
    forwardAmount = -0.32;
    strafeAmount = recoveryStrafe;
  } else if (
    recoveryAge > clearExitSeconds &&
    forwardClearance > clearExitDistance &&
    recoveryDistanceSq >= minEscapeDistance * minEscapeDistance
  ) {
    recoveryUntil = elapsedSeconds;
    nextStuckStrikes = Math.max(0, stuckStrikes - 1);
    setForwardWaypointYaw = escapeYaw;
    mode = "travel";
    nextTargetYaw = escapeYaw;
    forwardAmount = 0.62;
    strafeAmount = recoveryStrafe * 0.22;
    recoveryReason = "clear-exit";
  } else if (forwardClearance < blockedClearance * 0.62) {
    forwardAmount = 0;
    strafeAmount = 0;
  } else if (yawError > turnInPlaceError) {
    forwardAmount = 0;
    strafeAmount = 0;
  } else {
    forwardAmount = forwardClearance < blockedClearance ? 0.22 : 0.56;
  }

  return {
    forwardAmount,
    mode,
    recoveryReason,
    recoveryUntil,
    setForwardWaypointYaw,
    strafeAmount,
    stuckStrikes: nextStuckStrikes,
    targetYaw: nextTargetYaw,
  };
}

export function resolveQaWalkRecoveryStartPlan({
  elapsedSeconds,
  escapeLeftClearance,
  escapeRightClearance,
  escapeYaw,
  positionX,
  positionZ,
  stuckStrikes,
  maxRecoverySeconds = QA_SURVIVAL_RECOVERY_MAX_SECONDS,
  minRecoverySeconds = QA_SURVIVAL_RECOVERY_MIN_SECONDS,
}: {
  elapsedSeconds: number;
  escapeLeftClearance: number;
  escapeRightClearance: number;
  escapeYaw: number;
  positionX: number;
  positionZ: number;
  stuckStrikes: number;
  maxRecoverySeconds?: number;
  minRecoverySeconds?: number;
}) {
  const durationNoise = survivalishTurnNoise(positionX + 31, positionZ - 83, elapsedSeconds + stuckStrikes * 1.7);
  const strikeBonus = Math.min(stuckStrikes, 4) * 0.22;
  const strafe = clampNumber((escapeRightClearance - escapeLeftClearance) * 0.12, -0.72, 0.72);
  const recoveryStrafe = Math.abs(strafe) > 0.12
    ? strafe
    : (survivalishTurnNoise(positionX - 7, positionZ + 19, elapsedSeconds) > 0.5 ? 0.46 : -0.46);

  return {
    nextDecisionAt: elapsedSeconds + randomRangeFromNoise(durationNoise, 1.15, 2.35),
    recoveryStartedAt: elapsedSeconds,
    recoveryStrafe,
    recoveryUntil: elapsedSeconds + randomRangeFromNoise(
      durationNoise,
      minRecoverySeconds + strikeBonus,
      maxRecoverySeconds + strikeBonus,
    ),
    recoveryYaw: escapeYaw,
  };
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
