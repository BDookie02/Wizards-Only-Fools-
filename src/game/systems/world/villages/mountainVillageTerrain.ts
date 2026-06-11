import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import { absoluteAngleDeltaRadians } from "../../math/angleMath";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { clamp01, lerpNumber, smoothstep01, smoothstepRange, survivalHash01 } from "../survival/survivalMath";
import { SURVIVAL_MOUNTAIN_VILLAGE_RADIUS } from "./survivalVillageRegistry";

export type MountainVillageTerrainHeightResolver = (
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
) => number;

export const MOUNTAIN_VILLAGE_RADIUS = SURVIVAL_MOUNTAIN_VILLAGE_RADIUS;
export const MOUNTAIN_VILLAGE_GRASS_CLEAR_PADDING = 60;
export const MOUNTAIN_VILLAGE_EDGE_BLEND_START = SURVIVAL_BLOCK_SIZE * 0.43;
export const MOUNTAIN_VILLAGE_HEIGHT = 214;
export const MOUNTAIN_VILLAGE_PLATEAU_RADIUS = 92;
export const MOUNTAIN_VILLAGE_TRAIL_TURNS = 0.42;
export const MOUNTAIN_VILLAGE_TRAIL_START_RADIUS = SURVIVAL_BLOCK_SIZE * 0.385;
export const MOUNTAIN_VILLAGE_TRAIL_END_RADIUS = 76;
export const MOUNTAIN_VILLAGE_TRAIL_HEIGHT_OFFSET = 8.8;
export const MOUNTAIN_VILLAGE_SUMMIT_COLLIDER_RADIUS = MOUNTAIN_VILLAGE_PLATEAU_RADIUS + 4;
export const MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS = 32;
export const MOUNTAIN_VILLAGE_MINESHAFT_TERRAIN_CUT_RADIUS = 36;
export const MOUNTAIN_VILLAGE_MINESHAFT_RIM_MID_RADIUS = 41;
export const MOUNTAIN_VILLAGE_MINESHAFT_RIM_OUTER_RADIUS = 48;
export const MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_BASE_OFFSET = 3.2;
export const MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS = 28.5;
export const MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_LIGHT_COUNT = 8;
export const MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_LIGHT_RADIUS = 23.4;
export const MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_TABLE_RADIUS = 6.4;
export const MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_RADIUS = 10.2;
export const MOUNTAIN_VILLAGE_MINESHAFT_THRONE_Z = -15.6;
export const MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_ANGLES = [-2.36, -1.57, -0.78, 0, 0.78, 1.57, 2.36] as const;
export const MOUNTAIN_VILLAGE_MINESHAFT_WALL_LANTERN_COUNT = 9;
export const MOUNTAIN_VILLAGE_MINESHAFT_WALL_PAINTING_COUNT = 6;
export const MOUNTAIN_VILLAGE_MINESHAFT_WALL_FIBONACCI_SEQUENCE = [1, 1, 2, 3, 5, 8] as const;
export const MOUNTAIN_VILLAGE_MINESHAFT_GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
export const MOUNTAIN_VILLAGE_MINESHAFT_HUT_RADIUS = 24.2;
export const MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS = 13.2;
export const MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS = 22.6;
export const MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_SEGMENTS = 8;
export const MOUNTAIN_VILLAGE_MINESHAFT_LADDER_RING_RADIUS = MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS - 1.25;
export const MOUNTAIN_VILLAGE_MINESHAFT_LADDER_WIDTH = 4.2;
export const MOUNTAIN_VILLAGE_MINESHAFT_LADDER_START_CLEARANCE = 0.78;
export const MOUNTAIN_VILLAGE_MINESHAFT_LADDER_EXIT_CLEARANCE = 1.85;
export const MOUNTAIN_VILLAGE_MINESHAFT_LADDER_SENSOR_DEPTH = 2.1;
export const MOUNTAIN_VILLAGE_MINESHAFT_LADDER_PLATFORM_GAP = 7.6;
export const MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH = 8.6;
export const MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_Y_OFFSET = 1.55;
export const MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_START_RADIUS = MOUNTAIN_VILLAGE_MINESHAFT_LADDER_RING_RADIUS - 0.65;
export const MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_END_RADIUS = MOUNTAIN_VILLAGE_MINESHAFT_RIM_OUTER_RADIUS + 8.5;
export const MOUNTAIN_WATERFALL_CAMERA_HIDE_FAR = 56;
export const MOUNTAIN_VILLAGE_SLOPE_GRASS_NEAR_COUNT = 1080;
export const MOUNTAIN_VILLAGE_SLOPE_GRASS_MID_COUNT = 380;

export function getMountainVillageLocalRadius(localX: number, localZ: number) {
  return Math.sqrt(localX * localX + localZ * localZ);
}

export function getMountainVillageRadialLift(radius: number) {
  if (radius <= MOUNTAIN_VILLAGE_PLATEAU_RADIUS) return MOUNTAIN_VILLAGE_HEIGHT;

  const raw = 1 - (radius - MOUNTAIN_VILLAGE_PLATEAU_RADIUS) / (MOUNTAIN_VILLAGE_RADIUS - MOUNTAIN_VILLAGE_PLATEAU_RADIUS);
  const shoulder = Math.pow(smoothstep01(raw), 1.12);
  return shoulder * MOUNTAIN_VILLAGE_HEIGHT;
}

export function getMountainVillageSummitFloorHeight(baseHeight: number) {
  return baseHeight + MOUNTAIN_VILLAGE_HEIGHT;
}

export function getMountainVillageSummitFlatMask(radius: number) {
  return 1 - smoothstepRange(MOUNTAIN_VILLAGE_PLATEAU_RADIUS - 20, MOUNTAIN_VILLAGE_PLATEAU_RADIUS + 4, radius);
}

export function getMountainVillageHeight(
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  terrainHeightForChunk: MountainVillageTerrainHeightResolver,
  baseHeight: number,
) {
  const naturalHeight = terrainHeightForChunk(chunk, localX, localZ);
  const radius = getMountainVillageLocalRadius(localX, localZ);
  const angle = Math.atan2(localX, localZ);
  const lift = getMountainVillageRadialLift(radius);
  const ridgeNoise = (
    Math.sin(angle * 9 + radius * 0.053 + chunk.cx * 1.7) +
    Math.cos(angle * 5 - radius * 0.037 + chunk.cz * 1.3)
  ) * 2.6;
  const cliffBands = Math.max(0, Math.sin(radius * 0.19 + angle * 4.2)) * 2.1;
  const roughness = (1 - smoothstepRange(72, MOUNTAIN_VILLAGE_RADIUS, radius)) * (ridgeNoise + cliffBands);
  const plateauNoise = radius < MOUNTAIN_VILLAGE_PLATEAU_RADIUS
    ? Math.sin(localX * 0.06 + chunk.cx) * 0.55 + Math.cos(localZ * 0.052 - chunk.cz) * 0.45
    : 0;
  const mountainHeight = baseHeight + lift + roughness + plateauNoise;
  const edgeBlend = smoothstepRange(MOUNTAIN_VILLAGE_EDGE_BLEND_START, SURVIVAL_BLOCK_SIZE / 2, radius);
  const summitFlatMask = getMountainVillageSummitFlatMask(radius);
  const summitHeight = getMountainVillageSummitFloorHeight(baseHeight);

  return lerpNumber(lerpNumber(mountainHeight, summitHeight, summitFlatMask), naturalHeight, edgeBlend);
}

export function getMountainVillageTrailAngleOffset(chunk: SurvivalChunkInfo) {
  return -0.48 + (survivalHash01(chunk.cx, chunk.cz, 4420) - 0.5) * 0.14;
}

export function getMountainVillageTrailSurfaceMask(chunk: SurvivalChunkInfo, localX: number, localZ: number) {
  const radius = getMountainVillageLocalRadius(localX, localZ);
  const radialProgress = clamp01((MOUNTAIN_VILLAGE_TRAIL_START_RADIUS - radius) / (MOUNTAIN_VILLAGE_TRAIL_START_RADIUS - MOUNTAIN_VILLAGE_TRAIL_END_RADIUS));
  if (radialProgress <= 0 || radialProgress >= 1) return 0;

  const trailT = Math.pow(radialProgress, 1 / 0.86);
  const angleOffset = getMountainVillageTrailAngleOffset(chunk);
  const trailAngle = angleOffset + Math.pow(trailT, 1.16) * MOUNTAIN_VILLAGE_TRAIL_TURNS * Math.PI * 2;
  const pointAngle = Math.atan2(localX, localZ);
  const arcDistance = absoluteAngleDeltaRadians(trailAngle, pointAngle) * radius;
  const widthMask = 1 - smoothstepRange(5.5, 13.5, arcDistance);
  const endFade = smoothstepRange(0.02, 0.1, radialProgress) * (1 - smoothstepRange(0.9, 0.99, radialProgress));

  return clamp01(widthMask * endFade);
}

export function getMountainVillageTerrainSegments(chunk: SurvivalChunkInfo) {
  if (chunk.lod === "near") return 104;
  if (chunk.lod === "mid") return 56;
  return 40;
}

export function getMountainVillageTrailWidth(t: number) {
  return lerpNumber(19.5, 13.5, smoothstep01(t));
}

export function cutCircularHoleFromPlaneGeometry(geo: THREE.BufferGeometry, radius: number) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const sourceIndex = geo.getIndex();
  const nextIndices: number[] = [];
  const radiusSq = radius * radius;

  if (sourceIndex) {
    const sourceIndices = sourceIndex.array;
    for (let i = 0; i < sourceIndices.length; i += 3) {
      const a = sourceIndices[i];
      const b = sourceIndices[i + 1];
      const c = sourceIndices[i + 2];
      const centerX = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
      const centerZ = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;

      if (centerX * centerX + centerZ * centerZ < radiusSq) continue;
      nextIndices.push(a, b, c);
    }
  } else {
    for (let i = 0; i < pos.count; i += 3) {
      const a = i;
      const b = i + 1;
      const c = i + 2;
      const centerX = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
      const centerZ = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;

      if (centerX * centerX + centerZ * centerZ < radiusSq) continue;
      nextIndices.push(a, b, c);
    }
  }

  geo.setIndex(nextIndices);
}
