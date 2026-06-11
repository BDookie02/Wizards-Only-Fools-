import { isCurrentQaTelemetryRouteEnabled } from "../../../tools/qa/qaRouteTelemetry";

export interface WaterRipple {
  id: number;
  x: number;
  y: number;
  z: number;
  spawnTime: number;
}

export const WATER_RIPPLE_LIFETIME_MS = 500;
export const BASE_VILLAGE_WATER_Y = -0.79;
export const WATER_RIPPLE_QA_QUERY_PARAM = "qaWaterRipple";

const INNER_MOAT_MIN_RADIUS_SQ = 42 * 42;
const INNER_MOAT_MAX_RADIUS_SQ = 58 * 58;
const OUTER_WATER_MIN_RADIUS_SQ = 125 * 125;
const OUTER_WATER_MAX_RADIUS_SQ = 145 * 145;
let cachedWaterRippleQaSearch: string | null = null;
let cachedWaterRippleQaEnabled = false;

export function isBaseVillageWaterRippleSpot(x: number, y: number, z: number) {
  const radiusSq = x * x + z * z;
  const inMoatOrOuterWater =
    (radiusSq > INNER_MOAT_MIN_RADIUS_SQ && radiusSq < INNER_MOAT_MAX_RADIUS_SQ) ||
    (radiusSq > OUTER_WATER_MIN_RADIUS_SQ && radiusSq < OUTER_WATER_MAX_RADIUS_SQ);
  return inMoatOrOuterWater && y < 1.15;
}

export function isWaterRippleQaEnabled(search: string) {
  if (search === cachedWaterRippleQaSearch) return cachedWaterRippleQaEnabled;
  cachedWaterRippleQaSearch = search;
  cachedWaterRippleQaEnabled = new URLSearchParams(search).get(WATER_RIPPLE_QA_QUERY_PARAM) === "1";
  return cachedWaterRippleQaEnabled;
}

export function isCurrentWaterRippleQaEnabled() {
  if (typeof window === "undefined") return false;
  return isWaterRippleQaEnabled(window.location.search);
}

export function shouldPublishCurrentWaterRippleTelemetry() {
  return isCurrentQaTelemetryRouteEnabled(["waterRipple", "perf", "canvas"]);
}

export function appendWaterRipple(current: readonly WaterRipple[], ripple: WaterRipple, now: number) {
  const next: WaterRipple[] = [];
  for (let index = 0; index < current.length; index += 1) {
    const candidate = current[index];
    if (now - candidate.spawnTime < WATER_RIPPLE_LIFETIME_MS) next.push(candidate);
  }
  next.push(ripple);
  return next;
}

export function getWaterRippleCleanupDelayMs(current: readonly WaterRipple[], now: number) {
  let nextDelay = WATER_RIPPLE_LIFETIME_MS;
  for (let index = 0; index < current.length; index += 1) {
    const remaining = WATER_RIPPLE_LIFETIME_MS - (now - current[index].spawnTime);
    if (remaining < nextDelay) nextDelay = remaining;
  }
  return Math.max(0, nextDelay);
}

export function pruneExpiredWaterRipples(current: readonly WaterRipple[], now: number) {
  let hasExpired = false;
  for (let index = 0; index < current.length; index += 1) {
    if (now - current[index].spawnTime >= WATER_RIPPLE_LIFETIME_MS) {
      hasExpired = true;
      break;
    }
  }

  if (!hasExpired) return current;

  const next: WaterRipple[] = [];
  for (let index = 0; index < current.length; index += 1) {
    const candidate = current[index];
    if (now - candidate.spawnTime < WATER_RIPPLE_LIFETIME_MS) next.push(candidate);
  }
  return next;
}
