export type CampfirePoint = {
  x: number;
  y: number;
  z: number;
};

export type CampfireFlickerState = {
  intensity: number;
  lightY: number;
};

export const CAMPFIRE_DAMAGE_PER_SECOND = 2;
export const CAMPFIRE_DAMAGE_RADIUS_SQ = 6.25;
export const CAMPFIRE_DAMAGE_TICK_MS = 100;

export function getCampfireFlickerState(elapsedSeconds: number): CampfireFlickerState {
  const quick = Math.sin(elapsedSeconds * 19.7) * 0.16;
  const slow = Math.sin(elapsedSeconds * 7.1 + 1.4) * 0.1;
  const ember = Math.sin(elapsedSeconds * 31.3 + 0.7) * 0.05;
  const pulse = quick + slow + ember;
  return {
    intensity: 2.18 + pulse,
    lightY: 1.08 + pulse * 0.18,
  };
}

export function getCampfirePoint(position: readonly [number, number, number]): CampfirePoint {
  return {
    x: position[0],
    y: position[1],
    z: position[2],
  };
}

export function isWithinCampfireDamageRadius(point: CampfirePoint, campfire: CampfirePoint) {
  const dx = point.x - campfire.x;
  const dy = point.y - campfire.y;
  const dz = point.z - campfire.z;
  return dx * dx + dy * dy + dz * dz < CAMPFIRE_DAMAGE_RADIUS_SQ;
}
