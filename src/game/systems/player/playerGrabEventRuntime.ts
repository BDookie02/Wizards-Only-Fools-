export type PlayerGrabEventVector = {
  x: number;
  y: number;
  z: number;
};

export type PlayerGrabMutableVector = {
  x: number;
  y: number;
  z: number;
  set(x: number, y: number, z: number): PlayerGrabMutableVector;
  normalize(): PlayerGrabMutableVector;
};

export type PlayerGrabMutableOrigin = PlayerGrabEventVector & {
  set(x: number, y: number, z: number): unknown;
};

export type PlayerGrabFollowVector = PlayerGrabEventVector & {
  set(x: number, y: number, z: number): PlayerGrabFollowVector;
  normalize(): PlayerGrabFollowVector;
  addScaledVector(vector: PlayerGrabEventVector, scale: number): PlayerGrabFollowVector;
  lerp(vector: PlayerGrabEventVector, alpha: number): PlayerGrabFollowVector;
};

type PlayerGrabEventPayload = Record<string, unknown>;

export type PlayerGrabStartEventAction =
  | { type: "none" }
  | {
      type: "apply";
      casterId: string;
      grabId?: string;
      direction: PlayerGrabEventVector;
      origin: PlayerGrabEventVector;
      distance: number;
    };

export type PlayerGrabControlEventAction =
  | { type: "none" }
  | {
      type: "apply";
      direction?: PlayerGrabEventVector;
      origin?: PlayerGrabEventVector;
    };

export type PlayerGrabReleaseEventAction =
  | { type: "none" }
  | {
      type: "throw";
      direction: PlayerGrabEventVector;
    };

type PlayerGrabIdentity = {
  casterId: string;
  grabId?: string;
};

export type PlayerGrabbedEventState = PlayerGrabIdentity & {
  dir: PlayerGrabMutableVector;
  origin: PlayerGrabMutableOrigin;
  distance: number;
  lastControlAt: number;
  until: number;
};

export type PlayerGrabbedStateRef<TState extends PlayerGrabbedEventState> = {
  current: TState | null;
};

export type PlayerGrabThrowBody = {
  setLinvel(velocity: PlayerGrabEventVector, wakeUp: boolean): void;
};

export type PlayerGrabFollowBody = PlayerGrabThrowBody & {
  setTranslation(position: PlayerGrabEventVector, wakeUp: boolean): void;
};

export type PlayerGrabFollowCamera = {
  position: {
    lerp(target: PlayerGrabEventVector, alpha: number): unknown;
  };
  getWorldDirection(target: PlayerGrabMutableVector): PlayerGrabMutableVector;
};

export type PlayerGrabFollowCaster = {
  aimDir?: [number, number, number];
  pos: [number, number, number];
  rot?: [number, number, number];
};

export type PlayerGrabFollowMovedPayload = {
  x: number;
  y: number;
  z: number;
  angle: number;
  isMoving: false;
  grounded: false;
};

export type PlayerGrabFollowFrameResult =
  | { type: "expired" }
  | {
      type: "applied";
      position: PlayerGrabEventVector;
      shouldSyncNetwork: boolean;
      yaw: number;
    };

type PlayerGrabStartEventOptions = {
  localPlayerId: string | null | undefined;
  fallbackOrigin: PlayerGrabEventVector;
  defaultDistance: number;
};

type PlayerGrabMatchedEventOptions = PlayerGrabIdentity & {
  fallbackDirection?: PlayerGrabEventVector;
  fallbackOrigin?: PlayerGrabEventVector;
};

const PLAYER_GRAB_MIN_DISTANCE = 4;
const PLAYER_GRAB_MAX_DISTANCE = 36;
const PLAYER_GRAB_DEFAULT_DIRECTION: PlayerGrabEventVector = { x: 0, y: 0, z: -1 };

function readObject(value: unknown): PlayerGrabEventPayload {
  return value && typeof value === "object" ? value as PlayerGrabEventPayload : {};
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readFiniteNumber(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function resolveVectorPayload(
  value: unknown,
  fallback: PlayerGrabEventVector,
): PlayerGrabEventVector {
  const payload = readObject(value);
  return {
    x: readFiniteNumber(payload.x, fallback.x),
    y: readFiniteNumber(payload.y, fallback.y),
    z: readFiniteNumber(payload.z, fallback.z),
  };
}

function isMatchingGrabEvent(payload: PlayerGrabEventPayload, grabbed: PlayerGrabIdentity) {
  const casterId = readOptionalString(payload.id) ?? readOptionalString(payload.casterId);
  const grabId = readOptionalString(payload.grabId);
  return (Boolean(grabId) && grabbed.grabId === grabId)
    || (Boolean(casterId) && grabbed.casterId === casterId);
}

export function resolvePlayerGrabStartEventAction(
  detail: unknown,
  options: PlayerGrabStartEventOptions,
): PlayerGrabStartEventAction {
  const payload = readObject(detail);
  const casterId = readOptionalString(payload.casterId);
  if (!casterId || casterId === options.localPlayerId) return { type: "none" };

  const distance = clampNumber(
    readFiniteNumber(payload.distance, options.defaultDistance),
    PLAYER_GRAB_MIN_DISTANCE,
    PLAYER_GRAB_MAX_DISTANCE,
  );

  return {
    type: "apply",
    casterId,
    grabId: readOptionalString(payload.grabId),
    direction: resolveVectorPayload(payload.dir, PLAYER_GRAB_DEFAULT_DIRECTION),
    origin: resolveVectorPayload(payload.origin, options.fallbackOrigin),
    distance,
  };
}

export function resolvePlayerGrabControlEventAction(
  detail: unknown,
  options: PlayerGrabMatchedEventOptions,
): PlayerGrabControlEventAction {
  const payload = readObject(detail);
  if (!isMatchingGrabEvent(payload, options)) return { type: "none" };

  const aimDir = payload.aimDir ?? payload.dir;
  const origin = payload.origin;
  return {
    type: "apply",
    direction: aimDir == null ? undefined : resolveVectorPayload(aimDir, PLAYER_GRAB_DEFAULT_DIRECTION),
    origin: origin == null || !options.fallbackOrigin
      ? undefined
      : resolveVectorPayload(origin, options.fallbackOrigin),
  };
}

export function resolvePlayerGrabReleaseEventAction(
  detail: unknown,
  options: PlayerGrabMatchedEventOptions,
): PlayerGrabReleaseEventAction {
  const payload = readObject(detail);
  if (!isMatchingGrabEvent(payload, options)) return { type: "none" };

  return {
    type: "throw",
    direction: resolveVectorPayload(
      payload.dir,
      options.fallbackDirection ?? PLAYER_GRAB_DEFAULT_DIRECTION,
    ),
  };
}

export function applyPlayerGrabStartEventAction<TState extends PlayerGrabbedEventState>(
  action: PlayerGrabStartEventAction,
  current: TState | null,
  createState: () => TState,
  nowMs: number,
  maxDurationMs: number,
) {
  if (action.type !== "apply") return null;

  const grabbed = current ?? createState();
  grabbed.casterId = action.casterId;
  grabbed.grabId = action.grabId;
  grabbed.dir.set(action.direction.x, action.direction.y, action.direction.z).normalize();
  grabbed.origin.set(action.origin.x, action.origin.y, action.origin.z);
  grabbed.distance = action.distance;
  grabbed.lastControlAt = nowMs;
  grabbed.until = nowMs + maxDurationMs;
  return grabbed;
}

export function applyPlayerGrabControlEventAction(
  action: PlayerGrabControlEventAction,
  grabbed: PlayerGrabbedEventState,
  nowMs: number,
) {
  if (action.type !== "apply") return false;

  const aimDir = action.direction;
  const origin = action.origin;
  if (aimDir) {
    grabbed.dir.set(aimDir.x, aimDir.y, aimDir.z).normalize();
  }
  if (origin) {
    grabbed.origin.set(origin.x, origin.y, origin.z);
  }
  grabbed.lastControlAt = nowMs;
  return true;
}

export function resolvePlayerGrabReleaseDirectionInto<TVector extends PlayerGrabMutableVector>(
  action: PlayerGrabReleaseEventAction,
  target: TVector,
) {
  if (action.type !== "throw") return null;
  target.set(action.direction.x, action.direction.y, action.direction.z).normalize();
  return target;
}

export function applyPlayerGrabbedFollowFrame<TVector extends PlayerGrabFollowVector>({
  aimScratch,
  applyScreenShake,
  body,
  camera,
  cameraHeight,
  cameraTargetPosition,
  caster,
  casterAnchor,
  currentPosition,
  deltaSeconds,
  dispatchPlayerMoved,
  dispatchStationaryPlayerState,
  followSpeed,
  frameForward,
  grabbed,
  holdPoint,
  lastNetworkSync,
  networkSyncIntervalMs,
  nowMs,
  playerPosition,
  publishLocalPlayerPosition,
  resolveCasterAimDirection,
}: {
  aimScratch: TVector;
  applyScreenShake: () => void;
  body: PlayerGrabFollowBody;
  camera: PlayerGrabFollowCamera;
  cameraHeight: number;
  cameraTargetPosition: TVector;
  caster: PlayerGrabFollowCaster | null | undefined;
  casterAnchor: TVector;
  currentPosition: TVector;
  deltaSeconds: number;
  dispatchPlayerMoved: (payload: PlayerGrabFollowMovedPayload) => void;
  dispatchStationaryPlayerState: () => void;
  followSpeed: number;
  frameForward: PlayerGrabMutableVector;
  grabbed: PlayerGrabbedEventState;
  holdPoint: TVector;
  lastNetworkSync: { current: number };
  networkSyncIntervalMs: number;
  nowMs: number;
  playerPosition: PlayerGrabEventVector;
  publishLocalPlayerPosition: (position: PlayerGrabEventVector) => void;
  resolveCasterAimDirection: (caster: PlayerGrabFollowCaster, target: TVector) => PlayerGrabEventVector;
}): PlayerGrabFollowFrameResult {
  if (nowMs >= grabbed.until) return { type: "expired" };

  const hasRecentControl = nowMs - grabbed.lastControlAt < 450;
  const liveAimDir = hasRecentControl
    ? grabbed.dir
    : caster
      ? resolveCasterAimDirection(caster, aimScratch)
      : grabbed.dir;
  grabbed.dir.set(liveAimDir.x, liveAimDir.y, liveAimDir.z).normalize();

  if (hasRecentControl || !caster) {
    casterAnchor.set(grabbed.origin.x, grabbed.origin.y, grabbed.origin.z);
  } else {
    casterAnchor.set(caster.pos[0], caster.pos[1] + cameraHeight, caster.pos[2]);
  }

  holdPoint
    .set(casterAnchor.x, casterAnchor.y, casterAnchor.z)
    .addScaledVector(grabbed.dir, grabbed.distance);
  const followAlpha = 1 - Math.exp(-followSpeed * deltaSeconds);
  const nextPosition = currentPosition
    .set(playerPosition.x, playerPosition.y, playerPosition.z)
    .lerp(holdPoint, followAlpha);

  body.setTranslation(nextPosition, true);
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  camera.position.lerp(
    cameraTargetPosition.set(nextPosition.x, nextPosition.y + cameraHeight, nextPosition.z),
    0.55,
  );
  applyScreenShake();
  publishLocalPlayerPosition(nextPosition);

  camera.getWorldDirection(frameForward);
  const yaw = Math.atan2(frameForward.x, -frameForward.z);
  dispatchStationaryPlayerState();
  dispatchPlayerMoved({
    x: nextPosition.x,
    y: nextPosition.y,
    z: nextPosition.z,
    angle: yaw,
    isMoving: false,
    grounded: false,
  });

  const shouldSyncNetwork = nowMs - lastNetworkSync.current > networkSyncIntervalMs;
  if (shouldSyncNetwork) {
    lastNetworkSync.current = nowMs;
  }

  return {
    type: "applied",
    position: nextPosition,
    shouldSyncNetwork,
    yaw,
  };
}

export function throwPlayerGrabbedState<TState extends PlayerGrabbedEventState>({
  body,
  grabbedState,
  maxVerticalSpeed,
  minVerticalSpeed,
  overrideDirection,
  speed,
  throwDirection,
}: {
  body: PlayerGrabThrowBody | null | undefined;
  grabbedState: PlayerGrabbedStateRef<TState>;
  maxVerticalSpeed: number;
  minVerticalSpeed: number;
  overrideDirection?: PlayerGrabEventVector | null;
  speed: number;
  throwDirection: PlayerGrabMutableVector;
}) {
  const grabbed = grabbedState.current;
  if (!body || !grabbed) return false;

  const direction = overrideDirection ?? grabbed.dir;
  throwDirection.set(direction.x, direction.y, direction.z).normalize();
  body.setLinvel({
    x: throwDirection.x * speed,
    y: clampNumber(throwDirection.y * speed, minVerticalSpeed, maxVerticalSpeed),
    z: throwDirection.z * speed,
  }, true);
  grabbedState.current = null;
  return true;
}
