import { SURVIVAL_BLOCK_SIZE, type SurvivalBiome } from "../../../../store/gameStore";
import { survivalHash01 } from "../survival/survivalMath";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import {
  getSurvivalGrassSurfaceHeightForChunk,
  getSurvivalGrassSurfaceNormalForChunk,
  isSurvivalGrassAllowedAtChunkPoint,
  isSurvivalGrassSubmergedAtWorldPoint,
} from "./survivalDormantGrassSurface";

export type SurvivalGrassBlade = {
  key: string;
  x: number;
  y: number;
  z: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  yaw: number;
  tilt: number;
  width: number;
  height: number;
};

export function makeSurvivalChunkTallGrassBlades(
  chunk: SurvivalChunkInfo,
  grassBiome: SurvivalBiome,
  mobilePerformanceMode: boolean,
  streamScale = 1,
) {
  if (streamScale <= 0) return [];
  if (chunk.lod === "far") return [];
  if (grassBiome === "desert") return [];
  if (grassBiome !== "tallgrass") return [];

  const baseTargetCount = chunk.lod === "mid"
    ? 420
    : 1800;
  const targetCount = Math.max(
    Math.round((chunk.lod === "mid" ? 80 : 420) * streamScale),
    Math.round(baseTargetCount * (mobilePerformanceMode ? 0.46 : 1) * streamScale),
  );
  const generated: SurvivalGrassBlade[] = [];
  const attempts = targetCount * 4;

  for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
    const localX = (survivalHash01(chunk.cx, chunk.cz, 700 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.92;
    const localZ = (survivalHash01(chunk.cx, chunk.cz, 900 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.92;

    const worldX = chunk.x + localX;
    const worldZ = chunk.z + localZ;
    const terrainY = getSurvivalGrassSurfaceHeightForChunk(chunk, localX, localZ);
    if (!isSurvivalGrassAllowedAtChunkPoint(chunk, localX, localZ)) continue;
    if (isSurvivalGrassSubmergedAtWorldPoint(chunk, worldX, worldZ, terrainY, 0.06, 0.85)) continue;
    const terrainNormal = getSurvivalGrassSurfaceNormalForChunk(chunk, localX, localZ, 4.5);

    const shape = survivalHash01(chunk.cx, chunk.cz, 1100 + index);
    const heightBase = 0.95;
    const heightRange = 1.35;
    const widthScale = 0.62;
    generated.push({
      key: `${chunk.key}-grass-${index}`,
      x: localX,
      y: terrainY + 0.03,
      z: localZ,
      normalX: terrainNormal.x,
      normalY: terrainNormal.y,
      normalZ: terrainNormal.z,
      yaw: survivalHash01(chunk.cx, chunk.cz, 1300 + index) * Math.PI * 2,
      tilt: (survivalHash01(chunk.cx, chunk.cz, 1500 + index) - 0.5) * 0.62,
      width: (0.58 + shape * 1.02) * widthScale,
      height: heightBase + shape * heightRange,
    });
  }

  return generated;
}

export function makeSurvivalChunkShortGrassBlades(
  chunk: SurvivalChunkInfo,
  grassBiome: SurvivalBiome,
  mobilePerformanceMode: boolean,
  streamScale = 1,
) {
  if (streamScale <= 0) return [];
  if (chunk.distance > 1) return [];

  const isTallgrassBiome = grassBiome === "tallgrass";
  const nearBiomeCount = isTallgrassBiome
    ? 3000
    : grassBiome === "jungle"
      ? 2700
      : grassBiome === "swamp"
        ? 2100
        : grassBiome === "mushroom"
          ? 2300
          : grassBiome === "desert"
            ? 1900
            : 2800;
  const distanceScale = chunk.distance === 0
    ? 1
    : chunk.distance === 1
      ? 0.18
      : 0;
  const baseTargetCount = Math.round(nearBiomeCount * distanceScale);
  const performanceScale = mobilePerformanceMode
    ? (chunk.distance === 0 ? 0.58 : 0.5)
    : 1;
  const targetCount = Math.max(
    Math.round((chunk.distance === 0 ? 700 : 150) * streamScale),
    Math.round(baseTargetCount * performanceScale * streamScale),
  );
  const generated: SurvivalGrassBlade[] = [];
  const scatterSize = SURVIVAL_BLOCK_SIZE * 0.98;
  const gridSize = Math.ceil(Math.sqrt(targetCount * 1.12));
  const attempts = gridSize * gridSize;

  const sampleOffset = Math.floor(survivalHash01(chunk.cx, chunk.cz, 17050) * attempts);

  for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
    const sampleIndex = (sampleOffset + index * 8191) % attempts;
    const col = sampleIndex % gridSize;
    const row = Math.floor(sampleIndex / gridSize);
    const jitterX = 0.18 + survivalHash01(chunk.cx + col, chunk.cz + row, 2700 + index) * 0.64;
    const jitterZ = 0.18 + survivalHash01(chunk.cx - row, chunk.cz + col, 2900 + index) * 0.64;
    const localX = (((col + jitterX) / gridSize) - 0.5) * scatterSize;
    const localZ = (((row + jitterZ) / gridSize) - 0.5) * scatterSize;

    const worldX = chunk.x + localX;
    const worldZ = chunk.z + localZ;
    const terrainY = getSurvivalGrassSurfaceHeightForChunk(chunk, localX, localZ);
    if (!isSurvivalGrassAllowedAtChunkPoint(chunk, localX, localZ)) continue;
    if (isSurvivalGrassSubmergedAtWorldPoint(chunk, worldX, worldZ, terrainY, 0.04, 0.38)) continue;
    const terrainNormal = getSurvivalGrassSurfaceNormalForChunk(chunk, localX, localZ, chunk.lod === "far" ? 6.5 : 3.4);
    const shape = survivalHash01(chunk.cx, chunk.cz, 3100 + index);
    const heightBase = isTallgrassBiome
      ? 1.05
      : grassBiome === "jungle"
        ? 0.62
        : grassBiome === "swamp"
          ? 0.46
          : grassBiome === "mushroom"
            ? 0.5
            : grassBiome === "desert"
              ? 0.46
              : 0.64;
    const heightRange = isTallgrassBiome
      ? 1.3
      : grassBiome === "jungle"
        ? 0.76
        : grassBiome === "swamp"
          ? 0.58
          : grassBiome === "mushroom"
            ? 0.64
            : grassBiome === "desert"
              ? 0.54
              : 0.82;
    const widthScale = isTallgrassBiome ? 0.98 : grassBiome === "jungle" ? 1.02 : grassBiome === "desert" ? 0.95 : 1.08;
    const lodWidthScale = chunk.lod === "far" ? 0.9 : 1;
    const lodHeightScale = chunk.lod === "far" ? 0.92 : 1;

    generated.push({
      key: `${chunk.key}-short-grass-${index}`,
      x: localX,
      y: terrainY + 0.02,
      z: localZ,
      normalX: terrainNormal.x,
      normalY: terrainNormal.y,
      normalZ: terrainNormal.z,
      yaw: survivalHash01(chunk.cx, chunk.cz, 3300 + index) * Math.PI * 2,
      tilt: (survivalHash01(chunk.cx, chunk.cz, 3500 + index) - 0.5) * (isTallgrassBiome ? 0.36 : 0.28),
      width: (isTallgrassBiome ? 2.2 + shape * 2.8 : 1.35 + shape * 1.95) * widthScale * lodWidthScale,
      height: (heightBase + shape * heightRange) * lodHeightScale,
    });
  }

  return generated;
}
