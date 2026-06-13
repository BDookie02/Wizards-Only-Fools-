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
