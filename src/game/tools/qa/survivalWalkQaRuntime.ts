import { useCallback, useMemo, useRef } from "react";
import * as THREE from "three";
import { useLazyRef } from "../../systems/react/useLazyRef";
import {
  QA_SURVIVAL_OVERHEAD_BLOCKED_CLEARANCE,
  QA_SURVIVAL_ROUTE_BLOCKED_DWELL_SECONDS,
  QA_SURVIVAL_ROUTE_REACH_DISTANCE,
  QA_SURVIVAL_ROUTE_WAYPOINT_SECONDS,
  QA_SURVIVAL_ROUTE_YAW_SMOOTH_RATE,
  QA_SURVIVAL_ROUTE_YAW_SNAP_DELTA,
  QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE,
  QA_SURVIVAL_VIEW_SOFT_CLEARANCE,
  QA_SURVIVAL_WALK_BLOCKED_CLEARANCE,
  QA_SURVIVAL_WALK_SOFT_CLEARANCE,
  QA_SURVIVAL_WALK_SOFT_LOOKAHEAD,
  angleDeltaRadians,
  getQaSurvivalWalkStartDelaySeconds,
  isQaSurvivalWalkEnabled,
  lerpAngleRadians,
  type QaSurvivalIntent,
  type QaSurvivalRouteWaypoint,
  type QaSurvivalWalkInputState,
} from "./survivalWalkQa";

type QaWalkPosition = { x: number; y: number; z: number };
type LazyVector3Ref = { current: THREE.Vector3 };

const DEFAULT_QA_WALK_INPUT: QaSurvivalWalkInputState = {
  forward: 0,
  strafe: 0,
  sprint: false,
  mode: "travel",
};

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
