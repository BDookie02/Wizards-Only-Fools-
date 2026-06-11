import {
  BASE_VILLAGE_HALF_SIZE,
  type SurvivalChunkInfo,
} from "../survival/survivalWorldConfig";
import { survivalHash01 } from "../survival/survivalMath";
import {
  MOUNTAIN_VILLAGE_GRASS_CLEAR_PADDING,
  MOUNTAIN_VILLAGE_RADIUS,
  getMountainVillageTrailSurfaceMask,
} from "../villages/mountainVillageTerrain";

const SURVIVAL_DESERT_VILLAGE_GRASS_BUILDING_RINGS = [
  { radius: 78, count: 10, width: 18, depth: 16, phase: 0.18 },
  { radius: 122, count: 16, width: 20, depth: 18, phase: 0.02 },
  { radius: 166, count: 22, width: 22, depth: 19, phase: 0.12 },
  { radius: 207, count: 26, width: 20, depth: 18, phase: 0.05 },
];

export function isSurvivalGrassVillageAxisPathBlocked(
  localX: number,
  localZ: number,
  halfWidth: number,
  reach = BASE_VILLAGE_HALF_SIZE + 72,
) {
  const absX = Math.abs(localX);
  const absZ = Math.abs(localZ);
  return Math.max(absX, absZ) < reach && (absX < halfWidth || absZ < halfWidth);
}

export function isSurvivalGrassVillageRingBlocked(
  localX: number,
  localZ: number,
  radius: number,
  halfWidth: number,
) {
  const distanceSq = localX * localX + localZ * localZ;
  const innerRadius = Math.max(0, radius - halfWidth);
  const outerRadius = radius + halfWidth;
  return distanceSq > innerRadius * innerRadius && distanceSq < outerRadius * outerRadius;
}

export function isSurvivalDesertVillageBuildingGrassBlocked(
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  isNearDesertGate: (localX: number, localZ: number) => boolean,
) {
  let buildingIndex = 0;

  for (let ringIndex = 0; ringIndex < SURVIVAL_DESERT_VILLAGE_GRASS_BUILDING_RINGS.length; ringIndex += 1) {
    const ring = SURVIVAL_DESERT_VILLAGE_GRASS_BUILDING_RINGS[ringIndex];
    for (let index = 0; index < ring.count; index += 1) {
      if (chunk.lod === "mid" && index % 2 === 1) continue;

      const angleStep = (Math.PI * 2) / ring.count;
      const jitter = (survivalHash01(chunk.cx + ringIndex * 17, chunk.cz + index, 640) - 0.5) * angleStep * 0.34;
      const angle = index * angleStep + ring.phase + jitter;
      const tangentJitter = (survivalHash01(chunk.cx - ringIndex * 9, chunk.cz + index, 641) - 0.5) * 9;
      const buildingX = Math.sin(angle) * ring.radius + Math.cos(angle) * tangentJitter;
      const buildingZ = Math.cos(angle) * ring.radius - Math.sin(angle) * tangentJitter;
      const roadClearance = ring.radius > 190 ? 28 : 18;
      if (Math.abs(buildingX) < roadClearance || Math.abs(buildingZ) < roadClearance || isNearDesertGate(buildingX, buildingZ)) {
        continue;
      }

      const variant = survivalHash01(chunk.cx + buildingIndex, chunk.cz - buildingIndex, 642);
      const width = ring.width + Math.round(variant * 7);
      const depth = ring.depth + Math.round(survivalHash01(chunk.cx - buildingIndex, chunk.cz + buildingIndex, 643) * 6);
      const rotation = Math.atan2(-buildingX, -buildingZ);
      const dx = localX - buildingX;
      const dz = localZ - buildingZ;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const buildingLocalX = cos * dx - sin * dz;
      const buildingLocalZ = sin * dx + cos * dz;
      if (Math.abs(buildingLocalX) < width * 0.5 + 3 && Math.abs(buildingLocalZ) < depth * 0.5 + 3) return true;

      buildingIndex += 1;
    }
  }

  return false;
}

export function isSurvivalMountainVillageGrassBlocked(
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
) {
  const blockRadius = MOUNTAIN_VILLAGE_RADIUS + MOUNTAIN_VILLAGE_GRASS_CLEAR_PADDING;
  const insideConstructedMountain = localX * localX + localZ * localZ < blockRadius * blockRadius;
  const trailMask = getMountainVillageTrailSurfaceMask(chunk, localX, localZ);
  if (trailMask > 0.08) return true;
  if (!insideConstructedMountain) return false;

  return true;
}
