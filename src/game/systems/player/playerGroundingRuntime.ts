import {
  FLOOR_DEEP_RECOVERY_MAX_LIFT,
  FLOOR_DEEP_RECOVERY_RAY_DOWN,
  FLOOR_DEEP_RECOVERY_RAY_UP,
  FLOOR_DEEP_RECOVERY_TRIGGER_Y,
  FLOOR_RECOVERY_MAX_LIFT,
  FLOOR_RECOVERY_RAY_DOWN,
  FLOOR_RECOVERY_RAY_UP,
  FLOOR_RECOVERY_TRIGGER_DEPTH,
  FLOOR_RECOVERY_VERTICAL_SETTLE,
  GROUND_COYOTE_MS,
  GROUND_PROBE_CAST_DISTANCE,
  GROUND_PROBE_MAX_TOI,
  GROUND_PROBE_OFFSETS,
  GROUND_PROBE_ORIGIN_LIFT,
  PLAYER_FOOT_OFFSET,
} from "./playerMovementConfig";
import {
  castPlayerWorldRay,
  type PlayerRapierQueryOptions,
} from "./playerRapierQueryRuntime";

export type PlayerGroundingWorld = {
  castRay: (...args: any[]) => any;
};

export type PlayerGroundingRapier = {
  Ray: new (...args: any[]) => any;
};

export type PlayerGroundingPosition = {
  x: number;
  y: number;
  z: number;
};

export type PlayerFloorRecoveryTarget = {
  correctedY: number;
  floorY: number;
};

export type PlayerFloorRecoveryBody = {
  setLinvel: (velocity: { x: number; y: number; z: number }, wakeUp: boolean) => void;
  setTranslation: (translation: { x: number; y: number; z: number }, wakeUp: boolean) => void;
};

export type PlayerFloorRecoveryCameraPosition = {
  set: (x: number, y: number, z: number) => unknown;
};

export type PlayerFloorRecoveryStatePayload = {
  isMoving: boolean;
  isSprinting: boolean;
  isSliding: boolean;
  isCrouching: boolean;
  isGrounded: boolean;
  isMeditating: boolean;
};

export type PlayerFloorRecoveryMovePayload = {
  x: number;
  y: number;
  z: number;
  angle: number;
  isMoving: boolean;
  grounded: boolean;
};

export type PlayerGroundMotionState = {
  lastGroundedAt: number;
  grounded: boolean;
  climbingLadder: boolean;
  effectiveGrounded: boolean;
  idleGroundedPlanarLock: boolean;
  crouchAllowed: boolean;
};

export type PlayerFloorRecoveryGate = {
  shouldRecover: boolean;
  includeDeepRecovery: boolean;
  deepRecoveryNeeded: boolean;
  surfaceRecoveryNeeded: boolean;
};

export function resolvePlayerFloorRecoveryGate({
  climbingLadder,
  grabbedActive,
  hasGroundHit,
  jumpHeld,
  posY,
  survivalModeActive,
  vclipActive,
  velocityY,
  deepRecoveryTriggerY = FLOOR_DEEP_RECOVERY_TRIGGER_Y,
}: {
  climbingLadder: boolean;
  grabbedActive: boolean;
  hasGroundHit: boolean;
  jumpHeld: boolean;
  posY: number;
  survivalModeActive: boolean;
  vclipActive: boolean;
  velocityY: number;
  deepRecoveryTriggerY?: number;
}): PlayerFloorRecoveryGate {
  const deepRecoveryNeeded = survivalModeActive && posY < deepRecoveryTriggerY;
  const surfaceRecoveryNeeded = survivalModeActive && !hasGroundHit;
  const fallingRecoveryNeeded = !hasGroundHit && velocityY < -0.35;
  const shouldRecover = !vclipActive &&
    !climbingLadder &&
    !hasGroundHit &&
    !jumpHeld &&
    !grabbedActive &&
    (fallingRecoveryNeeded || deepRecoveryNeeded || surfaceRecoveryNeeded);

  return {
    shouldRecover,
    includeDeepRecovery: deepRecoveryNeeded,
    deepRecoveryNeeded,
    surfaceRecoveryNeeded,
  };
}

export function samplePlayerGroundToi(options: {
  pos: PlayerGroundingPosition;
  world: PlayerGroundingWorld;
  rapier: PlayerGroundingRapier;
  queryOptions?: PlayerRapierQueryOptions;
  isSolidCollider?: (collider: any) => boolean;
}) {
  const { pos, world, rapier, queryOptions, isSolidCollider } = options;
  let nearestGroundToi = Number.POSITIVE_INFINITY;
  const solidQueryOptions = {
    ...queryOptions,
    filterPredicate: isSolidCollider,
  };

  for (const offset of GROUND_PROBE_OFFSETS) {
    const ray = new rapier.Ray(
      {
        x: pos.x + offset.x,
        y: pos.y - PLAYER_FOOT_OFFSET + GROUND_PROBE_ORIGIN_LIFT,
        z: pos.z + offset.z,
      },
      { x: 0, y: -1, z: 0 },
    );
    const groundHit = castPlayerWorldRay(
      world,
      ray,
      GROUND_PROBE_CAST_DISTANCE,
      true,
      solidQueryOptions,
    );
    if (groundHit && groundHit.timeOfImpact < nearestGroundToi) {
      nearestGroundToi = groundHit.timeOfImpact;
    }
  }

  return nearestGroundToi;
}

export function hasPlayerGroundHit(nearestGroundToi: number) {
  return nearestGroundToi < GROUND_PROBE_MAX_TOI;
}

export function resolvePlayerGroundMotionState({
  nowMs,
  lastGroundedAt,
  hasGroundHit,
  velocityY,
  vclipActive,
  ladderActive,
  hasGrabbedState,
  hasMovementInput,
  slideHeld,
  isSliding,
  hasActiveExternalPull,
  crouchInputHeld,
  jumpHeld,
  isSprinting,
}: {
  nowMs: number;
  lastGroundedAt: number;
  hasGroundHit: boolean;
  velocityY: number;
  vclipActive: boolean;
  ladderActive: boolean;
  hasGrabbedState: boolean;
  hasMovementInput: boolean;
  slideHeld: boolean;
  isSliding: boolean;
  hasActiveExternalPull: boolean;
  crouchInputHeld: boolean;
  jumpHeld: boolean;
  isSprinting: boolean;
}): PlayerGroundMotionState {
  const nextLastGroundedAt = hasGroundHit ? nowMs : lastGroundedAt;
  const grounded = !vclipActive && (
    hasGroundHit ||
    (velocityY <= 0.1 && nowMs - nextLastGroundedAt <= GROUND_COYOTE_MS)
  );
  const climbingLadder = ladderActive && !vclipActive;
  const effectiveGrounded = grounded || climbingLadder;
  const idleGroundedPlanarLock =
    !vclipActive &&
    effectiveGrounded &&
    !climbingLadder &&
    !hasGrabbedState &&
    !hasMovementInput &&
    !slideHeld &&
    !isSliding &&
    !hasActiveExternalPull;
  const crouchAllowed =
    crouchInputHeld &&
    effectiveGrounded &&
    !climbingLadder &&
    !jumpHeld &&
    !isSliding &&
    !isSprinting &&
    Math.abs(velocityY) < 0.35;

  return {
    lastGroundedAt: nextLastGroundedAt,
    grounded,
    climbingLadder,
    effectiveGrounded,
    idleGroundedPlanarLock,
    crouchAllowed,
  };
}

function resolveFloorRecoveryTarget(options: {
  pos: PlayerGroundingPosition;
  floorY: number;
  maxLift: number;
}): PlayerFloorRecoveryTarget | null {
  const { pos, floorY, maxLift } = options;
  const correctedY = floorY + PLAYER_FOOT_OFFSET + FLOOR_RECOVERY_VERTICAL_SETTLE;
  const lift = correctedY - pos.y;
  if (lift <= FLOOR_RECOVERY_TRIGGER_DEPTH || lift >= maxLift) return null;
  return { correctedY, floorY };
}

function castFloorRecoveryTarget(options: {
  pos: PlayerGroundingPosition;
  world: PlayerGroundingWorld;
  rapier: PlayerGroundingRapier;
  queryOptions?: PlayerRapierQueryOptions;
  isSolidCollider?: (collider: any) => boolean;
  rayUp: number;
  rayDown: number;
  maxLift: number;
}) {
  const { pos, world, rapier, queryOptions, isSolidCollider, rayUp, rayDown, maxLift } = options;
  const rayOriginY = pos.y + rayUp;
  const ray = new rapier.Ray(
    { x: pos.x, y: rayOriginY, z: pos.z },
    { x: 0, y: -1, z: 0 },
  );
  const hit = castPlayerWorldRay(
    world,
    ray,
    rayUp + rayDown,
    true,
    {
      ...queryOptions,
      filterPredicate: isSolidCollider,
    },
  );
  if (!hit) return null;

  const floorY = rayOriginY - hit.timeOfImpact;
  return resolveFloorRecoveryTarget({ pos, floorY, maxLift });
}

export function getPlayerFloorRecoveryTarget(options: {
  pos: PlayerGroundingPosition;
  world: PlayerGroundingWorld;
  rapier: PlayerGroundingRapier;
  queryOptions?: PlayerRapierQueryOptions;
  isSolidCollider?: (collider: any) => boolean;
  includeDeepRecovery: boolean;
}) {
  const { pos, world, rapier, queryOptions, isSolidCollider, includeDeepRecovery } = options;
  const recoveryTarget = castFloorRecoveryTarget({
    pos,
    world,
    rapier,
    queryOptions,
    isSolidCollider,
    rayUp: FLOOR_RECOVERY_RAY_UP,
    rayDown: FLOOR_RECOVERY_RAY_DOWN,
    maxLift: FLOOR_RECOVERY_MAX_LIFT,
  });
  if (recoveryTarget) return recoveryTarget;

  if (!includeDeepRecovery) return null;
  return castFloorRecoveryTarget({
    pos,
    world,
    rapier,
    queryOptions,
    isSolidCollider,
    rayUp: FLOOR_DEEP_RECOVERY_RAY_UP,
    rayDown: FLOOR_DEEP_RECOVERY_RAY_DOWN,
    maxLift: FLOOR_DEEP_RECOVERY_MAX_LIFT,
  });
}

export function applyPlayerFloorRecovery(options: {
  body: PlayerFloorRecoveryBody;
  cameraHeight: number;
  cameraPosition: PlayerFloorRecoveryCameraPosition;
  correctedY: number;
  dispatchPlayerMoved: (payload: PlayerFloorRecoveryMovePayload) => void;
  dispatchPlayerState: (payload: PlayerFloorRecoveryStatePayload) => void;
  hasMovementInput: boolean;
  idleGroundedPlanarLock: boolean;
  isCrouching: boolean;
  isSliding: boolean;
  isSprinting: boolean;
  publishLocalPlayerPosition: (position: PlayerGroundingPosition) => void;
  resetJumps: () => void;
  setSliding: (sliding: boolean) => void;
  pos: PlayerGroundingPosition;
  velocity: { x: number; y: number; z: number };
  yaw: number;
}) {
  const {
    body,
    cameraHeight,
    cameraPosition,
    correctedY,
    dispatchPlayerMoved,
    dispatchPlayerState,
    hasMovementInput,
    idleGroundedPlanarLock,
    isCrouching,
    isSliding,
    isSprinting,
    publishLocalPlayerPosition,
    resetJumps,
    setSliding,
    pos,
    velocity,
    yaw,
  } = options;

  body.setTranslation({ x: pos.x, y: correctedY, z: pos.z }, true);
  body.setLinvel({
    x: idleGroundedPlanarLock ? 0 : velocity.x,
    y: 0,
    z: idleGroundedPlanarLock ? 0 : velocity.z,
  }, true);
  cameraPosition.set(pos.x, correctedY + cameraHeight, pos.z);
  publishLocalPlayerPosition({ x: pos.x, y: correctedY, z: pos.z });
  dispatchPlayerState({
    isMoving: hasMovementInput,
    isSprinting,
    isSliding: false,
    isCrouching,
    isGrounded: true,
    isMeditating: false,
  });
  dispatchPlayerMoved({
    x: pos.x,
    y: correctedY,
    z: pos.z,
    angle: yaw,
    isMoving: hasMovementInput,
    grounded: true,
  });
  if (isSliding) setSliding(false);
  resetJumps();
}
