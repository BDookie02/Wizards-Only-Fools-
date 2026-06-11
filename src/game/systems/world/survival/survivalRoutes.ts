import {
  DARREL_QUEST_CHUNK,
  LILY_COIL_QUEST_CHUNK,
  SURVIVAL_BLOCK_SIZE,
} from "../../../../store/gameStore";
import {
  clamp01,
  lerpNumber,
  smoothstepRange,
  survivalHash01,
} from "./survivalMath";
import { isStrictSurvivalDesertTerrainAtWorld } from "./survivalBiome";

type SurvivalTownRoutePoint = { cx: number; cz: number };
type SurvivalTownRouteWorldPoint = { x: number; z: number };

const SURVIVAL_TOWN_ROUTE_SEGMENTS: Array<[SurvivalTownRoutePoint, SurvivalTownRoutePoint]> = [
  [{ cx: 0, cz: 0 }, { cx: 0, cz: -3 }],
  [{ cx: 0, cz: -3 }, { cx: -3, cz: -3 }],
  [{ cx: 0, cz: -3 }, { cx: 4, cz: -4 }],
  [{ cx: 0, cz: 0 }, { cx: 3, cz: 0 }],
  [{ cx: 3, cz: 0 }, { cx: 5, cz: 2 }],
  [{ cx: 4, cz: -4 }, { cx: DARREL_QUEST_CHUNK.cx, cz: DARREL_QUEST_CHUNK.cz }],
  [{ cx: DARREL_QUEST_CHUNK.cx, cz: DARREL_QUEST_CHUNK.cz }, { cx: LILY_COIL_QUEST_CHUNK.cx, cz: LILY_COIL_QUEST_CHUNK.cz }],
];

const SURVIVAL_TOWN_ROUTE_CORE_WIDTH = 4.5;
const SURVIVAL_TOWN_ROUTE_SHOULDER_WIDTH = 10;
const SURVIVAL_TOWN_ROUTE_MAX_MEANDER = 4.25;

export const SURVIVAL_TOWN_ROUTE_GRASS_BLOCK_MASK = 0.985;

function setSurvivalTownRoutePointInto(
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  dx: number,
  dz: number,
  routeLength: number,
  routeSeed: number,
  t: number,
  target: SurvivalTownRouteWorldPoint,
) {
  const perpX = -dz / routeLength;
  const perpZ = dx / routeLength;
  const fade = Math.sin(t * Math.PI);
  const meander = fade * Math.sin(t * Math.PI + routeSeed * Math.PI * 2) * SURVIVAL_TOWN_ROUTE_MAX_MEANDER;

  target.x = lerpNumber(startX, endX, t) + perpX * meander;
  target.z = lerpNumber(startZ, endZ, t) + perpZ * meander;
  return target;
}

function getDistanceToSegment2DSq(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq < 0.0001) {
    const pointDx = px - ax;
    const pointDz = pz - az;
    return pointDx * pointDx + pointDz * pointDz;
  }

  const t = clamp01(((px - ax) * dx + (pz - az) * dz) / lengthSq);
  const closestX = ax + dx * t;
  const closestZ = az + dz * t;
  const pointDx = px - closestX;
  const pointDz = pz - closestZ;
  return pointDx * pointDx + pointDz * pointDz;
}

export function getSurvivalTownRouteMask(worldX: number, worldZ: number) {
  let mask = 0;
  const previous: SurvivalTownRouteWorldPoint = { x: 0, z: 0 };
  const next: SurvivalTownRouteWorldPoint = { x: 0, z: 0 };

  for (let routeIndex = 0; routeIndex < SURVIVAL_TOWN_ROUTE_SEGMENTS.length; routeIndex += 1) {
    const [start, end] = SURVIVAL_TOWN_ROUTE_SEGMENTS[routeIndex];
    const startX = start.cx * SURVIVAL_BLOCK_SIZE;
    const startZ = start.cz * SURVIVAL_BLOCK_SIZE;
    const endX = end.cx * SURVIVAL_BLOCK_SIZE;
    const endZ = end.cz * SURVIVAL_BLOCK_SIZE;
    const dx = endX - startX;
    const dz = endZ - startZ;
    const padding = SURVIVAL_TOWN_ROUTE_SHOULDER_WIDTH + SURVIVAL_TOWN_ROUTE_MAX_MEANDER + 8;
    if (
      worldX < Math.min(startX, endX) - padding ||
      worldX > Math.max(startX, endX) + padding ||
      worldZ < Math.min(startZ, endZ) - padding ||
      worldZ > Math.max(startZ, endZ) + padding
    ) {
      continue;
    }

    const routeLength = Math.max(1, Math.sqrt(dx * dx + dz * dz));
    const routeSeed = survivalHash01(start.cx + end.cx * 7, start.cz + end.cz * 11, 15011 + routeIndex);
    const segmentCount = Math.max(2, Math.min(42, Math.ceil(routeLength / (SURVIVAL_BLOCK_SIZE * 0.85))));
    let closestDistanceSq = Infinity;
    setSurvivalTownRoutePointInto(startX, startZ, endX, endZ, dx, dz, routeLength, routeSeed, 0, previous);
    for (let segmentIndex = 1; segmentIndex <= segmentCount; segmentIndex += 1) {
      setSurvivalTownRoutePointInto(
        startX,
        startZ,
        endX,
        endZ,
        dx,
        dz,
        routeLength,
        routeSeed,
        segmentIndex / segmentCount,
        next,
      );
      closestDistanceSq = Math.min(
        closestDistanceSq,
        getDistanceToSegment2DSq(worldX, worldZ, previous.x, previous.z, next.x, next.z),
      );
      previous.x = next.x;
      previous.z = next.z;
    }

    const routeMask = 1 - smoothstepRange(
      SURVIVAL_TOWN_ROUTE_CORE_WIDTH,
      SURVIVAL_TOWN_ROUTE_SHOULDER_WIDTH,
      Math.sqrt(closestDistanceSq),
    );
    mask = Math.max(mask, routeMask);
  }

  return clamp01(mask);
}

export function shouldSkipSurvivalBotwGrassForTownRoute(worldX: number, worldZ: number, threshold = 0.78) {
  return isStrictSurvivalDesertTerrainAtWorld(worldX, worldZ) &&
    getSurvivalTownRouteMask(worldX, worldZ) > threshold;
}
