import { type HandType } from "../../../store/gameStore";

export type PlayerGrabVectorPayload = {
  x: number;
  y: number;
  z: number;
};

export type PlayerGrabProjectilePayload = {
  id: string;
  creatorId: string;
  type: "grab";
  pos: PlayerGrabVectorPayload;
  dir: PlayerGrabVectorPayload;
  createdAt: number;
  hand: HandType;
  grabId: string;
  grabPhase: "cast" | "release";
};

export type PlayerGrabTimeouts = Record<HandType, number | null>;

export type PlayerGrabActiveIds = Record<HandType, string | null>;

export type PlayerGrabReleaseEventDetail = {
  casterId: string;
  grabId: string;
  dir: PlayerGrabVectorPayload;
  origin: PlayerGrabVectorPayload;
};

export function clearPlayerGrabTimeout(
  grabTimeouts: PlayerGrabTimeouts,
  hand: HandType,
  clearTimeoutFn: (timeoutId: number) => void = clearTimeout,
) {
  const timeoutId = grabTimeouts[hand];
  if (timeoutId === null) return false;
  clearTimeoutFn(timeoutId);
  grabTimeouts[hand] = null;
  return true;
}

export function clearPlayerGrabTimeouts(
  grabTimeouts: PlayerGrabTimeouts,
  hands: readonly HandType[],
  clearTimeoutFn: (timeoutId: number) => void = clearTimeout,
) {
  for (let handIndex = 0; handIndex < hands.length; handIndex += 1) {
    clearPlayerGrabTimeout(grabTimeouts, hands[handIndex], clearTimeoutFn);
  }
}

export function setPlayerGrabTimeout(
  grabTimeouts: PlayerGrabTimeouts,
  hand: HandType,
  timeoutId: number,
  clearTimeoutFn: (timeoutId: number) => void = clearTimeout,
) {
  clearPlayerGrabTimeout(grabTimeouts, hand, clearTimeoutFn);
  grabTimeouts[hand] = timeoutId;
}

export function createPlayerGrabCastProjectilePayload({
  grabId,
  creatorId,
  hand,
  origin,
  direction,
  createdAt,
}: {
  grabId: string;
  creatorId: string;
  hand: HandType;
  origin: PlayerGrabVectorPayload;
  direction: PlayerGrabVectorPayload;
  createdAt: number;
}): PlayerGrabProjectilePayload {
  return {
    id: grabId,
    creatorId,
    type: "grab",
    pos: origin,
    dir: direction,
    createdAt,
    hand,
    grabId,
    grabPhase: "cast",
  };
}

export function createPlayerGrabReleaseProjectilePayload({
  grabId,
  creatorId,
  hand,
  origin,
  direction,
  releasedAt,
}: {
  grabId: string;
  creatorId: string;
  hand: HandType;
  origin: PlayerGrabVectorPayload;
  direction: PlayerGrabVectorPayload;
  releasedAt: number;
}): PlayerGrabProjectilePayload {
  return {
    id: `${grabId}-release-${releasedAt}`,
    creatorId,
    type: "grab",
    pos: origin,
    dir: direction,
    createdAt: releasedAt,
    hand,
    grabId,
    grabPhase: "release",
  };
}

export function applyPlayerGrabCast({
  activeGrabIds,
  addProjectile,
  clearTimeoutFn,
  controlAimDir,
  controlOrigin,
  createdAt,
  creatorId,
  direction,
  emitGameNetworkEvent,
  grabId,
  grabTimeouts,
  hand,
  maxDurationMs,
  onTimeout,
  origin,
  setTimeoutFn,
}: {
  activeGrabIds: PlayerGrabActiveIds;
  addProjectile: (projectile: PlayerGrabProjectilePayload) => void;
  clearTimeoutFn?: (timeoutId: number) => void;
  controlAimDir: PlayerGrabVectorPayload;
  controlOrigin: PlayerGrabVectorPayload;
  createdAt: number;
  creatorId: string;
  direction: PlayerGrabVectorPayload;
  emitGameNetworkEvent: (eventName: string, ...args: unknown[]) => unknown;
  grabId: string;
  grabTimeouts: PlayerGrabTimeouts;
  hand: HandType;
  maxDurationMs: number;
  onTimeout: () => void;
  origin: PlayerGrabVectorPayload;
  setTimeoutFn: (handler: () => void, timeoutMs: number) => number;
}) {
  const projectile = createPlayerGrabCastProjectilePayload({
    grabId,
    creatorId,
    hand,
    origin,
    direction,
    createdAt,
  });

  activeGrabIds[hand] = grabId;
  setPlayerGrabTimeout(
    grabTimeouts,
    hand,
    setTimeoutFn(onTimeout, maxDurationMs),
    clearTimeoutFn,
  );

  emitGameNetworkEvent("castSpell", projectile);
  emitGameNetworkEvent("grabControl", {
    grabId,
    hand,
    origin: controlOrigin,
    aimDir: controlAimDir,
  });
  addProjectile(projectile);
  return projectile;
}

export function applyPlayerGrabRelease({
  activeGrabIds,
  addProjectile,
  clearTimeoutFn,
  creatorId,
  direction,
  dispatchReleaseGrabPlayer,
  emitGameNetworkEvent,
  grabTimeouts,
  hand,
  origin,
  releasedAt,
}: {
  activeGrabIds: PlayerGrabActiveIds;
  addProjectile: (projectile: PlayerGrabProjectilePayload) => void;
  clearTimeoutFn?: (timeoutId: number) => void;
  creatorId: string;
  direction: PlayerGrabVectorPayload;
  dispatchReleaseGrabPlayer: (detail: PlayerGrabReleaseEventDetail) => void;
  emitGameNetworkEvent: (eventName: string, ...args: unknown[]) => unknown;
  grabTimeouts: PlayerGrabTimeouts;
  hand: HandType;
  origin: PlayerGrabVectorPayload;
  releasedAt: number;
}) {
  const grabId = activeGrabIds[hand];
  if (!grabId) return null;

  clearPlayerGrabTimeout(grabTimeouts, hand, clearTimeoutFn);
  const projectile = createPlayerGrabReleaseProjectilePayload({
    grabId,
    creatorId,
    hand,
    origin,
    direction,
    releasedAt,
  });

  activeGrabIds[hand] = null;
  emitGameNetworkEvent("castSpell", projectile);
  emitGameNetworkEvent("grabRelease", {
    grabId,
    hand,
    origin,
    aimDir: projectile.dir,
  });
  addProjectile(projectile);
  dispatchReleaseGrabPlayer({
    casterId: creatorId,
    grabId,
    dir: projectile.dir,
    origin,
  });
  return projectile;
}
