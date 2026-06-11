import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { clamp01, lerpNumber, smoothstepRange, survivalHash01 } from "../survival/survivalMath";
import {
  MOUNTAIN_VILLAGE_HEIGHT,
  MOUNTAIN_VILLAGE_PLATEAU_RADIUS,
  MOUNTAIN_VILLAGE_RADIUS,
  MOUNTAIN_VILLAGE_SLOPE_GRASS_MID_COUNT,
  MOUNTAIN_VILLAGE_SLOPE_GRASS_NEAR_COUNT,
  getMountainVillageTrailSurfaceMask,
} from "../villages/mountainVillageTerrain";

export type MountainSlopeGrassTuft = {
  localX: number;
  localZ: number;
  y: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  yaw: number;
  width: number;
  height: number;
  colorR: number;
  colorG: number;
  colorB: number;
};

export type MountainVillageSlopeGrassHeightResolver = (
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  baseHeight: number,
) => number;

export type MountainVillageSlopeGrassColorResolver = (
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  y: number,
  baseHeight: number,
  showTrailSurface: boolean,
) => THREE.Color;

const MOUNTAIN_SLOPE_GRASS_DEEP_COLOR = new THREE.Color("#4f723b");
const MOUNTAIN_SLOPE_GRASS_LIGHT_COLOR = new THREE.Color("#829a52");
const MOUNTAIN_SLOPE_GRASS_DRY_COLOR = new THREE.Color("#9a965d");
const MOUNTAIN_SLOPE_NORMAL_SAMPLE_STEP = 3.2;

function getMountainVillageSlopeSurfaceNormalInto(
  target: THREE.Vector3,
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  baseHeight: number,
  getHeight: MountainVillageSlopeGrassHeightResolver,
) {
  const step = MOUNTAIN_SLOPE_NORMAL_SAMPLE_STEP;
  const left = getHeight(chunk, localX - step, localZ, baseHeight);
  const right = getHeight(chunk, localX + step, localZ, baseHeight);
  const down = getHeight(chunk, localX, localZ - step, baseHeight);
  const up = getHeight(chunk, localX, localZ + step, baseHeight);
  return target.set(left - right, step * 2, down - up).normalize();
}

export function makeMountainVillageSlopeGrassTufts(
  chunk: SurvivalChunkInfo,
  baseHeight: number,
  getHeight: MountainVillageSlopeGrassHeightResolver,
  getTerrainColor: MountainVillageSlopeGrassColorResolver,
): MountainSlopeGrassTuft[] {
  if (chunk.lod === "far") return [];

  const targetCount = chunk.lod === "near"
    ? MOUNTAIN_VILLAGE_SLOPE_GRASS_NEAR_COUNT
    : MOUNTAIN_VILLAGE_SLOPE_GRASS_MID_COUNT;
  const generated: MountainSlopeGrassTuft[] = [];
  const gridSize = Math.ceil(Math.sqrt(targetCount * 2.15));
  const attempts = gridSize * gridSize;
  const halfSize = SURVIVAL_BLOCK_SIZE * 0.5;
  const normalScratch = new THREE.Vector3();
  const terrainTint = new THREE.Color();

  for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
    const sampleIndex = (index * 1543 + Math.floor(survivalHash01(chunk.cx, chunk.cz, 61900) * attempts)) % attempts;
    const col = sampleIndex % gridSize;
    const row = Math.floor(sampleIndex / gridSize);
    const jitterX = 0.18 + survivalHash01(chunk.cx + col, chunk.cz - row, 61920 + index) * 0.64;
    const jitterZ = 0.18 + survivalHash01(chunk.cx - row, chunk.cz + col, 61950 + index) * 0.64;
    const localX = -halfSize + ((col + jitterX) / gridSize) * SURVIVAL_BLOCK_SIZE;
    const localZ = -halfSize + ((row + jitterZ) / gridSize) * SURVIVAL_BLOCK_SIZE;
    const radiusSq = localX * localX + localZ * localZ;
    const minRadius = MOUNTAIN_VILLAGE_PLATEAU_RADIUS + 20;
    const maxRadius = MOUNTAIN_VILLAGE_RADIUS - 16;
    if (radiusSq < minRadius * minRadius || radiusSq > maxRadius * maxRadius) continue;
    const radius = Math.sqrt(radiusSq);

    const trailMask = getMountainVillageTrailSurfaceMask(chunk, localX, localZ);
    if (trailMask > 0.16) continue;

    const y = getHeight(chunk, localX, localZ, baseHeight);
    const lift = y - baseHeight;
    if (lift < 18 || lift > MOUNTAIN_VILLAGE_HEIGHT * 0.84) continue;

    const normal = getMountainVillageSlopeSurfaceNormalInto(normalScratch, chunk, localX, localZ, baseHeight, getHeight);
    if (normal.y < 0.34) continue;

    const angle = Math.atan2(localX, localZ);
    const broadPatch = clamp01((
      Math.sin(localX * 0.045 + localZ * 0.023 + radius * 0.052) +
      Math.cos(localZ * 0.052 - localX * 0.031) +
      Math.sin(angle * 5.4 + radius * 0.036)
    ) / 3 * 0.5 + 0.5);
    const slopeMix = smoothstepRange(0.04, 0.42, 1 - normal.y);
    const radialBand = smoothstepRange(MOUNTAIN_VILLAGE_PLATEAU_RADIUS + 26, MOUNTAIN_VILLAGE_PLATEAU_RADIUS + 86, radius) *
      (1 - smoothstepRange(MOUNTAIN_VILLAGE_RADIUS - 54, MOUNTAIN_VILLAGE_RADIUS - 10, radius));
    const keepChance = clamp01((0.24 + broadPatch * 0.58 + slopeMix * 0.16) * radialBand);
    if (survivalHash01(chunk.cx + col, chunk.cz + row, 61980 + index) > keepChance) continue;

    const dryMix = smoothstepRange(0.62, 0.96, broadPatch + survivalHash01(col, row, 62010) * 0.18);
    const terrainColor = getTerrainColor(chunk, localX, localZ, y, baseHeight, true);
    terrainTint.copy(MOUNTAIN_SLOPE_GRASS_DEEP_COLOR)
      .lerp(MOUNTAIN_SLOPE_GRASS_LIGHT_COLOR, smoothstepRange(0.38, 0.9, broadPatch) * 0.42)
      .lerp(MOUNTAIN_SLOPE_GRASS_DRY_COLOR, dryMix * 0.24)
      .lerp(terrainColor, 0.24)
      .multiplyScalar(0.88 + survivalHash01(col, row, 62040) * 0.16);
    terrainTint.r = clamp01(terrainTint.r);
    terrainTint.g = clamp01(terrainTint.g);
    terrainTint.b = clamp01(terrainTint.b);

    generated.push({
      localX,
      localZ,
      y,
      normalX: normal.x,
      normalY: normal.y,
      normalZ: normal.z,
      yaw: angle + (survivalHash01(row, col, 62070) - 0.5) * 1.4,
      width: lerpNumber(0.96, 1.86, survivalHash01(col, row, 62100)) * lerpNumber(1, 0.82, slopeMix),
      height: lerpNumber(1.08, 2.08, survivalHash01(row, col, 62130)) * lerpNumber(1, 0.76, slopeMix),
      colorR: terrainTint.r,
      colorG: terrainTint.g,
      colorB: terrainTint.b,
    });
  }

  return generated;
}
