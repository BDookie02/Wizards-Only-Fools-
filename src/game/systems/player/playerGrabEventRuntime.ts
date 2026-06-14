export type PlayerGrabEventVector = {
  x: number;
  y: number;
  z: number;
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
