export const DESERT_VILLAGE_RADIUS = 232;
export const DESERT_VILLAGE_PAD_FLAT_RADIUS = 244;

export function isNearDesertGate(localX: number, localZ: number) {
  const nearNorthSouth = Math.abs(localX) < 32 && Math.abs(Math.abs(localZ) - DESERT_VILLAGE_RADIUS) < 34;
  const nearEastWest = Math.abs(localZ) < 32 && Math.abs(Math.abs(localX) - DESERT_VILLAGE_RADIUS) < 34;
  return nearNorthSouth || nearEastWest;
}
