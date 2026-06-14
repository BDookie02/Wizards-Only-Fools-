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
