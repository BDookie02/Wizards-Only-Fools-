import * as THREE from "three";
import {
  CAMERA_TERRAIN_EYE_CLEARANCE,
  CAMERA_TERRAIN_MAX_BODY_LIFT,
  CAMERA_TERRAIN_MAX_SURFACE_ABOVE_BODY,
  CAMERA_TERRAIN_RAY_DOWN,
  CAMERA_TERRAIN_RAY_UP,
  CAMERA_WALL_CLEARANCE,
  CAMERA_WALL_MIN_HORIZONTAL_PUSH_SQ,
  CAMERA_WALL_PUSH_MAX,
  FLOOR_RECOVERY_TRIGGER_DEPTH,
  PLAYER_FOOT_OFFSET,
  WORLD_UP,
} from "./playerMovementConfig";
import {
  castPlayerWorldRay,
  type PlayerRapierQueryOptions,
} from "./playerRapierQueryRuntime";

export type PlayerCameraRollScratch = {
  forward: THREE.Vector3;
  actualUp: THREE.Vector3;
  right: THREE.Vector3;
  expectedUp: THREE.Vector3;
};

export type LilyCoilCameraState = {
  active: boolean;
  jumpOffset: number;
  jumpVelocity: number;
  lastUp: THREE.Vector3;
};

export type PlayerCameraAntiClipScratch = {
  probe: THREE.Vector3;
  push: THREE.Vector3;
  solidQueryOptions: PlayerRapierQueryOptions;
};

export type PlayerCameraLookScratch = {
  lookDir: THREE.Vector3;
  yawAxis: THREE.Vector3;
  rightAxis: THREE.Vector3;
  rotation: THREE.Quaternion;
};

export type PlayerSolidColliderFilter = {
  playerBodyHandle?: number | null;
  isSolidCollider: (collider: any) => boolean;
};

export type PlayerCameraAntiClipWorld = {
  castRay: (...args: any[]) => any;
};

export type PlayerCameraAntiClipRapier = {
  Ray: new (...args: any[]) => any;
};

export type PlayerCameraAntiClipResult = {
  x: number;
  y: number;
  z: number;
  eyeY: number;
  bodyLifted: boolean;
};

export type PlayerCameraAntiClipBody = {
  handle?: number;
  setLinvel: (velocity: { x: number; y: number; z: number }, wakeUp: boolean) => void;
  setTranslation: (translation: { x: number; y: number; z: number }, wakeUp: boolean) => void;
};

export function createPlayerCameraRollScratch(): PlayerCameraRollScratch {
  return {
    forward: new THREE.Vector3(),
    actualUp: new THREE.Vector3(),
    right: new THREE.Vector3(),
    expectedUp: new THREE.Vector3(),
  };
}

export function createPlayerCameraAntiClipScratch(): PlayerCameraAntiClipScratch {
  return {
    probe: new THREE.Vector3(),
    push: new THREE.Vector3(),
    solidQueryOptions: {},
  };
}

export function createPlayerCameraLookScratch(): PlayerCameraLookScratch {
  return {
    lookDir: new THREE.Vector3(),
    yawAxis: new THREE.Vector3(),
    rightAxis: new THREE.Vector3(),
    rotation: new THREE.Quaternion(),
  };
}

const DEFAULT_PLAYER_CAMERA_LOOK_SCRATCH = createPlayerCameraLookScratch();
const CAMERA_WALL_RAY_DIRECTIONS = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
] as const;

export function isSolidPlayerCameraCollider(collider: any, playerBodyHandle?: number | null) {
  const parent = typeof collider.parent === "function" ? collider.parent() : null;
  const isSensor = typeof collider.isSensor === "function" ? collider.isSensor() : collider.isSensor === true;
  return parent?.handle !== playerBodyHandle && !isSensor;
}

export function createPlayerSolidColliderFilter(): PlayerSolidColliderFilter {
  const filter: PlayerSolidColliderFilter = {
    playerBodyHandle: null,
    isSolidCollider: (collider: any) => isSolidPlayerCameraCollider(collider, filter.playerBodyHandle),
  };
  return filter;
}

export function resolvePlayerCameraAntiClip(options: {
  bodyPos: { x: number; y: number; z: number };
  eyeY: number;
  cameraHeight: number;
  scratch: PlayerCameraAntiClipScratch;
  world: PlayerCameraAntiClipWorld;
  rapier: PlayerCameraAntiClipRapier;
  queryOptions?: PlayerRapierQueryOptions;
  playerBodyHandle?: number | null;
  isSolidCollider?: (collider: any) => boolean;
  survivalModeActive: boolean;
}): PlayerCameraAntiClipResult | null {
  const {
    bodyPos,
    eyeY,
    cameraHeight,
    scratch,
    world,
    rapier,
    queryOptions,
    playerBodyHandle,
    isSolidCollider,
    survivalModeActive,
  } = options;
  const hasNativeQueryFilters = Boolean(
    queryOptions?.filterFlags !== undefined ||
    queryOptions?.filterExcludeCollider !== undefined ||
    queryOptions?.filterExcludeRigidBody !== undefined
  );
  const isSolidWorldCollider = isSolidCollider ?? (
    hasNativeQueryFilters ? undefined : (collider: any) => isSolidPlayerCameraCollider(collider, playerBodyHandle)
  );
  const probe = scratch.probe.set(bodyPos.x, eyeY, bodyPos.z);
  const solidQueryOptions = scratch.solidQueryOptions;
  solidQueryOptions.filterFlags = queryOptions?.filterFlags;
  solidQueryOptions.filterExcludeCollider = queryOptions?.filterExcludeCollider;
  solidQueryOptions.filterExcludeRigidBody = queryOptions?.filterExcludeRigidBody;
  solidQueryOptions.filterPredicate = isSolidWorldCollider;
  let cameraX = bodyPos.x;
  let bodyY = bodyPos.y;
  let cameraZ = bodyPos.z;
  let nextEyeY = eyeY;
  let cameraAdjusted = false;
  let bodyLifted = false;
  const push = scratch.push;

  push.set(0, 0, 0);
  for (let index = 0; index < CAMERA_WALL_RAY_DIRECTIONS.length; index += 1) {
    const direction = CAMERA_WALL_RAY_DIRECTIONS[index];
    const wallRay = new rapier.Ray(
      { x: probe.x, y: probe.y, z: probe.z },
      { x: direction.x, y: 0, z: direction.z },
    );
    const wallHit = castPlayerWorldRay(
      world,
      wallRay,
      CAMERA_WALL_CLEARANCE,
      true,
      solidQueryOptions,
    );
    const toi = wallHit?.timeOfImpact;
    if (!Number.isFinite(toi) || toi < 0 || toi >= CAMERA_WALL_CLEARANCE) continue;
    const pushDistance = Math.min(CAMERA_WALL_PUSH_MAX, CAMERA_WALL_CLEARANCE - Math.max(0, toi));
    push.x -= direction.x * pushDistance;
    push.z -= direction.z * pushDistance;
  }

  const horizontalDistanceSq = push.lengthSq();
  if (horizontalDistanceSq >= CAMERA_WALL_MIN_HORIZONTAL_PUSH_SQ) {
    const horizontalDistance = Math.sqrt(horizontalDistanceSq);
    if (horizontalDistance > CAMERA_WALL_PUSH_MAX) {
      push.multiplyScalar(CAMERA_WALL_PUSH_MAX / horizontalDistance);
    }
    cameraX += push.x;
    cameraZ += push.z;
    cameraAdjusted = true;
  }

  if (survivalModeActive) {
    const terrainProbeY = nextEyeY + CAMERA_TERRAIN_RAY_UP;
    const terrainRay = new rapier.Ray(
      { x: cameraX, y: terrainProbeY, z: cameraZ },
      { x: 0, y: -1, z: 0 },
    );
    const terrainHit = castPlayerWorldRay(
      world,
      terrainRay,
      CAMERA_TERRAIN_RAY_UP + CAMERA_TERRAIN_RAY_DOWN,
      true,
      solidQueryOptions,
    );
    if (terrainHit) {
      const surfaceY = terrainProbeY - terrainHit.timeOfImpact;
      const surfaceAboveBody = surfaceY - bodyY;
      const targetEyeY = surfaceY + CAMERA_TERRAIN_EYE_CLEARANCE;
      const lift = targetEyeY - nextEyeY;
      if (
        lift > FLOOR_RECOVERY_TRIGGER_DEPTH &&
        lift < CAMERA_TERRAIN_MAX_BODY_LIFT &&
        surfaceAboveBody > -PLAYER_FOOT_OFFSET &&
        surfaceAboveBody < CAMERA_TERRAIN_MAX_SURFACE_ABOVE_BODY
      ) {
        bodyY += lift;
        nextEyeY = bodyY + cameraHeight;
        cameraAdjusted = true;
        bodyLifted = true;
      }
    }
  }

  if (!cameraAdjusted && !bodyLifted) return null;
  return { x: cameraX, y: bodyY, z: cameraZ, eyeY: nextEyeY, bodyLifted };
}

export function applyPlayerCameraAntiClip(options: {
  body: PlayerCameraAntiClipBody;
  bodyPos: { x: number; y: number; z: number };
  cameraHeight: number;
  clearPlanarVelocity: boolean;
  eyeY: number;
  rapier: PlayerCameraAntiClipRapier;
  scratch: PlayerCameraAntiClipScratch;
  queryOptions?: PlayerRapierQueryOptions;
  isSolidCollider?: (collider: any) => boolean;
  survivalModeActive: boolean;
  velocity: { x: number; y: number; z: number };
  world: PlayerCameraAntiClipWorld;
}) {
  const {
    body,
    bodyPos,
    cameraHeight,
    clearPlanarVelocity,
    eyeY,
    rapier,
    scratch,
    queryOptions,
    isSolidCollider,
    survivalModeActive,
    velocity,
    world,
  } = options;
  const cameraCorrection = resolvePlayerCameraAntiClip({
    bodyPos,
    eyeY,
    cameraHeight,
    scratch,
    world,
    rapier,
    queryOptions,
    playerBodyHandle: body.handle,
    isSolidCollider,
    survivalModeActive,
  });
  if (!cameraCorrection) return null;

  if (cameraCorrection.bodyLifted) {
    body.setTranslation({ x: bodyPos.x, y: cameraCorrection.y, z: bodyPos.z }, true);
  }
  if (cameraCorrection.bodyLifted && cameraCorrection.y > bodyPos.y + FLOOR_RECOVERY_TRIGGER_DEPTH) {
    body.setLinvel({
      x: clearPlanarVelocity ? 0 : velocity.x,
      y: Math.max(0, velocity.y),
      z: clearPlanarVelocity ? 0 : velocity.z,
    }, true);
  }
  return cameraCorrection;
}

export function hasCameraRollAgainstWorldUp(camera: THREE.Camera, scratch: PlayerCameraRollScratch) {
  if (Math.abs(camera.up.x) > 0.001 || Math.abs(camera.up.y - 1) > 0.001 || Math.abs(camera.up.z) > 0.001) {
    return true;
  }

  camera.getWorldDirection(scratch.forward).normalize();
  scratch.right.crossVectors(scratch.forward, WORLD_UP);
  if (scratch.right.lengthSq() < 0.0001) {
    return false;
  }

  scratch.right.normalize();
  scratch.expectedUp.crossVectors(scratch.right, scratch.forward).normalize();
  scratch.actualUp.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
  return scratch.actualUp.angleTo(scratch.expectedUp) > 0.01;
}

export function resetLilyCoilCameraState(
  camera: THREE.Camera,
  controllerLookEuler: THREE.Euler,
  tubeState: LilyCoilCameraState,
  yawOverride?: number,
  pitchOverride?: number,
  scratch = DEFAULT_PLAYER_CAMERA_LOOK_SCRATCH,
) {
  tubeState.active = false;
  tubeState.jumpOffset = 0;
  tubeState.jumpVelocity = 0;
  tubeState.lastUp.set(0, 1, 0);
  if (typeof window !== "undefined") {
    (window as any).__wofLilyCoilTubeState = null;
  }

  const lookDir = scratch.lookDir;
  camera.getWorldDirection(lookDir);
  const horizontalLengthSq = lookDir.x * lookDir.x + lookDir.z * lookDir.z;
  const yaw = Number.isFinite(yawOverride)
    ? Number(yawOverride)
    : horizontalLengthSq > 0.00000001
      ? Math.atan2(lookDir.x, -lookDir.z)
      : controllerLookEuler.y;
  const pitch = Number.isFinite(pitchOverride)
    ? THREE.MathUtils.clamp(Number(pitchOverride), -1.45, 1.45)
    : Number.isFinite(yawOverride)
      ? 0
      : THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(lookDir.y, -1, 1)), -1.45, 1.45);

  camera.up.set(0, 1, 0);
  controllerLookEuler.set(pitch, yaw, 0);
  camera.quaternion.setFromEuler(controllerLookEuler);
  return yaw;
}

export function applyCameraLookDelta(
  camera: THREE.Camera,
  controllerLookEuler: THREE.Euler,
  tubeState: LilyCoilCameraState,
  yawDelta: number,
  pitchDelta: number,
  scratch = DEFAULT_PLAYER_CAMERA_LOOK_SCRATCH,
) {
  if (yawDelta === 0 && pitchDelta === 0) return;

  if (tubeState.active) {
    if (yawDelta !== 0) {
      scratch.yawAxis.copy(camera.up).normalize();
      camera.quaternion.premultiply(scratch.rotation.setFromAxisAngle(scratch.yawAxis, yawDelta));
    }
    if (pitchDelta !== 0) {
      scratch.rightAxis.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
      camera.quaternion.premultiply(scratch.rotation.setFromAxisAngle(scratch.rightAxis, pitchDelta));
    }
    controllerLookEuler.setFromQuaternion(camera.quaternion);
    return;
  }

  controllerLookEuler.setFromQuaternion(camera.quaternion);
  controllerLookEuler.y += yawDelta;
  controllerLookEuler.x = THREE.MathUtils.clamp(controllerLookEuler.x + pitchDelta, -Math.PI / 2, Math.PI / 2);
  camera.quaternion.setFromEuler(controllerLookEuler);
}
