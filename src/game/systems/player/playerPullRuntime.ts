export type PlayerPullVector = {
  x: number;
  y: number;
  z: number;
};

export type PlayerPullEventAction =
  | { type: "none" }
  | {
      type: "apply";
      velocity: PlayerPullVector;
      frames: number;
    };

export const PLAYER_PULL_EVENT_FRAMES = 15;

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function readFiniteNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function resolvePlayerPullEventAction(detail: unknown): PlayerPullEventAction {
  const payload = readObject(detail);
  if (!payload) return { type: "none" };

  return {
    type: "apply",
    velocity: {
      x: readFiniteNumber(payload.x),
      y: readFiniteNumber(payload.y),
      z: readFiniteNumber(payload.z),
    },
    frames: PLAYER_PULL_EVENT_FRAMES,
  };
}
