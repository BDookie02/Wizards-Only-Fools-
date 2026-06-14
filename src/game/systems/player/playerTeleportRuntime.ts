import {
  applyPlayerBodyCameraPlacement,
  type PlayerPlacementBody,
  type PlayerPlacementCamera,
} from "./playerBodyPlacementRuntime";
import type {
  PlayerMovedEventDetail,
  PlayerPositionLike,
} from "./playerEventBridge";

export type PlayerTeleportAction =
  | { type: "none" }
  | {
      type: "apply";
      position: { x: number; y: number; z: number };
      yaw?: number;
    };

export type PlayerTeleportSpawn = {
  x: number;
  y: number;
  z: number;
  yaw?: number;
};

export type PlayerTeleportApplicationApplier = {
  body: PlayerPlacementBody | null | undefined;
  camera: PlayerPlacementCamera;
  cameraHeight: number;
  dispatchPlayerMoved: (detail: PlayerMovedEventDetail) => void;
  getNowMs: () => number;
  publishLastTeleportPosition: (position: PlayerPositionLike) => void;
  publishLocalPlayerPosition: (position: PlayerPositionLike, options: { rememberLast?: boolean }) => void;
  publishManualFastTravelSpawn: (spawn: PlayerTeleportSpawn, nowMs: number) => { key: string };
  publishQaPlayerPosition: (position: PlayerPositionLike) => void;
  resetCameraYaw: (yawOverride?: number) => number;
  resetQaWalkSession: (position: PlayerPositionLike) => void;
  setForcedSpawnKey: (key: string) => void;
};

export type PlayerTeleportApplication = {
  applied: boolean;
  moved: PlayerMovedEventDetail | null;
  spawnKey: string | null;
};

function readFiniteNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function readOptionalFiniteNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function resolvePlayerTeleportEventAction(detail: unknown): PlayerTeleportAction {
  const payload = detail && typeof detail === "object" ? detail as Record<string, unknown> : {};
  const x = readFiniteNumber(payload.x);
  const y = readFiniteNumber(payload.y);
  const z = readFiniteNumber(payload.z);
  if (x === null || y === null || z === null) return { type: "none" };

  return {
    type: "apply",
    position: { x, y, z },
    yaw: readOptionalFiniteNumber(payload.yaw),
  };
}

export function applyPlayerTeleportEventApplication(
  action: PlayerTeleportAction,
  applier: PlayerTeleportApplicationApplier,
): PlayerTeleportApplication {
  if (action.type !== "apply") {
    return { applied: false, moved: null, spawnKey: null };
  }

  const placed = applyPlayerBodyCameraPlacement({
    body: applier.body,
    camera: applier.camera,
    cameraHeight: applier.cameraHeight,
    position: action.position,
    resetAngularVelocity: true,
  });
  if (!placed) {
    return { applied: false, moved: null, spawnKey: null };
  }

  const resolvedYaw = applier.resetCameraYaw(action.yaw);
  applier.resetQaWalkSession(action.position);
  const nowMs = applier.getNowMs();
  const manualFastTravelSpawn = applier.publishManualFastTravelSpawn({
    x: action.position.x,
    y: action.position.y,
    z: action.position.z,
    yaw: action.yaw,
  }, nowMs);
  applier.setForcedSpawnKey(manualFastTravelSpawn.key);
  applier.publishLocalPlayerPosition(action.position, { rememberLast: true });
  applier.publishQaPlayerPosition(action.position);
  applier.publishLastTeleportPosition(action.position);

  const moved: PlayerMovedEventDetail = {
    ...action.position,
    angle: resolvedYaw,
    isMoving: false,
    grounded: false,
  };
  applier.dispatchPlayerMoved(moved);
  return {
    applied: true,
    moved,
    spawnKey: manualFastTravelSpawn.key,
  };
}
