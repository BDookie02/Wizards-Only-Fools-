import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import { clamp01, lerpNumber, smoothstepRange, survivalHash01 } from "../survival/survivalMath";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import {
  getSurvivalBotwGrassFootprintStats,
  getSurvivalChunkGrassSurfaceBiome,
  getSurvivalGrassBladeColor,
  getSurvivalGrassSurfaceBiome,
  getSurvivalGrassSurfaceHeightForChunk,
  getSurvivalGrassSurfaceNormalForChunk,
  getSurvivalSmoothedTerrainColor,
  isSurvivalGrassAllowedAtChunkPoint,
  isSurvivalGrassSubmergedAtWorldPoint,
} from "./survivalDormantGrassSurface";
import type { SurvivalGroundGrassPatch } from "./survivalLocalGrassPatches";

export function getSurvivalChunkGroundGrassPatchCount(
  chunk: SurvivalChunkInfo,
  mobilePerformanceMode: boolean,
  streamScale = 1,
) {
  if (streamScale <= 0) return 0;
  const grassBiome = getSurvivalChunkGrassSurfaceBiome(chunk);
  const biomeBase = grassBiome === "desert"
    ? 0.9
    : grassBiome === "swamp"
      ? 0.82
      : grassBiome === "mushroom"
        ? 0.88
        : grassBiome === "tallgrass"
          ? 1.18
          : grassBiome === "jungle"
            ? 0.94
            : 1.08;
  const lodBase = chunk.lod === "near"
    ? 4200
    : chunk.lod === "mid"
      ? 2200
      : chunk.distance <= 2
        ? 1200
        : chunk.distance <= 4
          ? 820
          : chunk.distance <= 6
            ? 560
            : 320;

  return Math.max(
    Math.round((chunk.lod === "far" ? 220 : chunk.lod === "mid" ? 620 : 900) * streamScale),
    Math.round(lodBase * biomeBase * (mobilePerformanceMode ? 0.46 : 1) * streamScale),
  );
}

export function makeSurvivalChunkGroundGrassPatches(
  chunk: SurvivalChunkInfo,
  mobilePerformanceMode: boolean,
  streamScale = 1,
): SurvivalGroundGrassPatch[] {
  const targetCount = getSurvivalChunkGroundGrassPatchCount(chunk, mobilePerformanceMode, streamScale);
  if (targetCount <= 0) return [];

  const generated: SurvivalGroundGrassPatch[] = [];
  const scatterSize = SURVIVAL_BLOCK_SIZE * 0.99;
  const gridSize = Math.ceil(Math.sqrt(targetCount * 1.05));
  const attempts = gridSize * gridSize;
  const isFarLod = chunk.lod === "far";
  const widthBase = isFarLod ? 27.5 : chunk.lod === "mid" ? 13.4 : 7.8;
  const widthRange = isFarLod ? 20.5 : chunk.lod === "mid" ? 10.6 : 6.5;
  const depthBase = isFarLod ? 20.2 : chunk.lod === "mid" ? 9.8 : 6.1;
  const depthRange = isFarLod ? 16.4 : chunk.lod === "mid" ? 8.4 : 5.4;

  const sampleOffset = Math.floor(survivalHash01(chunk.cx, chunk.cz, 18050) * attempts);

  for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
    const sampleIndex = (sampleOffset + index * 8191) % attempts;
    const col = sampleIndex % gridSize;
    const row = Math.floor(sampleIndex / gridSize);
    const jitterX = 0.1 + survivalHash01(chunk.cx + col, chunk.cz + row, 8000 + index) * 0.8;
    const jitterZ = 0.1 + survivalHash01(chunk.cx - row, chunk.cz + col, 8100 + index) * 0.8;
    const localX = (((col + jitterX) / gridSize) - 0.5) * scatterSize;
    const localZ = (((row + jitterZ) / gridSize) - 0.5) * scatterSize;

    const worldX = chunk.x + localX;
    const worldZ = chunk.z + localZ;
    const terrainY = getSurvivalGrassSurfaceHeightForChunk(chunk, localX, localZ);
    if (!isSurvivalGrassAllowedAtChunkPoint(chunk, localX, localZ)) continue;
    if (isSurvivalGrassSubmergedAtWorldPoint(
      chunk,
      worldX,
      worldZ,
      terrainY,
      0.02,
      Math.max(widthBase + widthRange, depthBase + depthRange) * 0.48,
    )) continue;

    const terrainNormal = getSurvivalGrassSurfaceNormalForChunk(chunk, localX, localZ, isFarLod ? 7.5 : 3.2);
    const width = widthBase + survivalHash01(chunk.cx, chunk.cz, 8400 + index) * widthRange;
    const depth = depthBase + survivalHash01(chunk.cx, chunk.cz, 8500 + index) * depthRange;
    const footprintStats = getSurvivalBotwGrassFootprintStats(
      worldX,
      worldZ,
      Math.max(width, depth) * (isFarLod ? 0.42 : 0.5),
    );
    const maxFootprintRange = isFarLod ? 5.2 : chunk.lod === "mid" ? 3.4 : 2.6;
    const minNormalY = isFarLod ? 0.78 : chunk.lod === "mid" ? 0.82 : 0.84;
    if (footprintStats.heightRange > maxFootprintRange || terrainNormal.y < minNormalY) continue;

    const slopeTuck = clamp01(Math.max(
      smoothstepRange(0.7, maxFootprintRange, footprintStats.heightRange),
      smoothstepRange(0.02, 1 - minNormalY, 1 - terrainNormal.y),
    ));
    const terrainLift = isFarLod ? 0.12 : 0.095;
    const tuckedY = Math.min(
      terrainY + terrainLift,
      footprintStats.baseY + lerpNumber(0.045, -0.035, slopeTuck),
    );
    const slopeSizeScale = lerpNumber(1, isFarLod ? 0.62 : 0.72, slopeTuck);
    const variant = survivalHash01(chunk.cx, chunk.cz, 8200 + index);
    const grassBiome = getSurvivalGrassSurfaceBiome(chunk.biome, worldX, worldZ, terrainY);
    const color = getSurvivalGrassBladeColor(grassBiome, worldX, worldZ, terrainY, variant);
    const terrainColor = getSurvivalSmoothedTerrainColor(worldX, worldZ, terrainY);
    color.lerp(terrainColor, isFarLod ? 0.08 : chunk.lod === "mid" ? 0.1 : 0.12);
    color.multiplyScalar(isFarLod ? 1.3 : chunk.lod === "mid" ? 1.28 : 1.26);
    generated.push({
      x: localX,
      y: tuckedY,
      z: localZ,
      normalX: terrainNormal.x,
      normalY: terrainNormal.y,
      normalZ: terrainNormal.z,
      yaw: survivalHash01(chunk.cx, chunk.cz, 8300 + index) * Math.PI * 2,
      width: width * slopeSizeScale,
      depth: depth * slopeSizeScale,
      color,
    });
  }

  return generated;
}
