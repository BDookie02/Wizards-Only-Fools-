import {
  applyPlayerBodyCameraPlacement,
  type PlayerPlacementBody,
  type PlayerPlacementCamera,
} from "./playerBodyPlacementRuntime";
import type {
  PlayerMovedEventDetail,
  PlayerPositionLike,
} from "./playerEventBridge";

export type PlayerSpawnOverrideLike = {
  key: string;
  position: readonly [number, number, number];
  yaw?: unknown;
  pitch?: unknown;
};

export type PlayerSpawnOverrideAction =
  | { type: "none" }
  | {
      type: "apply";
      key: string;
      position: { x: number; y: number; z: number };
      yaw?: number;
      pitch?: number;
    };

export type PlayerSpawnOverrideApplicationApplier = {
  body: PlayerPlacementBody | null | undefined;
  camera: PlayerPlacementCamera;
  cameraHeight: number;
  dispatchPlayerMoved: (detail: PlayerMovedEventDetail) => void;
  publishLocalPlayerPosition: (position: PlayerPositionLike, options: { rememberLast?: boolean }) => void;
  publishQaPlayerPosition: (position: PlayerPositionLike) => void;
  resetCameraState: (yawOverride?: number, pitchOverride?: number) => number;
  resetQaWalkSession: (position: PlayerPositionLike) => void;
  setForcedSpawnKey: (key: string) => void;
};

export type PlayerSpawnOverrideApplication = {
  applied: boolean;
  key: string | null;
  moved: PlayerMovedEventDetail | null;
};

function toFiniteOptionalNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function resolvePlayerSpawnOverrideAction({
  forcedSpawnKey,
  spawnOverride,
}: {
  forcedSpawnKey: string | null;
  spawnOverride: PlayerSpawnOverrideLike | null;
}): PlayerSpawnOverrideAction {
  if (!spawnOverride || forcedSpawnKey === spawnOverride.key) return { type: "none" };

  const [x, y, z] = spawnOverride.position;
  return {
    type: "apply",
    key: spawnOverride.key,
    position: { x, y, z },
    yaw: toFiniteOptionalNumber(spawnOverride.yaw),
    pitch: toFiniteOptionalNumber(spawnOverride.pitch),
  };
}

export function applyPlayerSpawnOverrideAction(
  action: PlayerSpawnOverrideAction,
  applier: PlayerSpawnOverrideApplicationApplier,
): PlayerSpawnOverrideApplication {
  if (action.type !== "apply") {
    return { applied: false, key: null, moved: null };
  }

  const placed = applyPlayerBodyCameraPlacement({
    body: applier.body,
    camera: applier.camera,
    cameraHeight: applier.cameraHeight,
    position: action.position,
    resetAngularVelocity: true,
  });
  if (!placed) {
    return { applied: false, key: null, moved: null };
  }

  const resolvedYaw = applier.resetCameraState(action.yaw, action.pitch);
  applier.resetQaWalkSession(action.position);
  applier.setForcedSpawnKey(action.key);
  applier.publishLocalPlayerPosition(action.position, { rememberLast: true });
  applier.publishQaPlayerPosition(action.position);

  const moved: PlayerMovedEventDetail = {
    ...action.position,
    angle: resolvedYaw,
    isMoving: false,
    grounded: false,
  };
  applier.dispatchPlayerMoved(moved);
  return {
    applied: true,
    key: action.key,
    moved,
  };
}
