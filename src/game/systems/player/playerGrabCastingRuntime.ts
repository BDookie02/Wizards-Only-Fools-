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
