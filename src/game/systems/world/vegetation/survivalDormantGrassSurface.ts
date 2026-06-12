import type { SurvivalBiome } from "../../../../store/gameStore";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { getDormantSurvivalGrassResolvers } from "./survivalDormantGrassResolvers";

export function getSurvivalChunkInfoAtWorld(worldX: number, worldZ: number) {
  return getDormantSurvivalGrassResolvers().getChunkInfoAtWorld(worldX, worldZ);
}

export function getSurvivalTerrainHeightForChunk(chunk: SurvivalChunkInfo, localX: number, localZ: number) {
  return getDormantSurvivalGrassResolvers().getTerrainHeightForChunk(chunk, localX, localZ);
}

export function getSurvivalGrassSurfaceHeightForChunk(chunk: SurvivalChunkInfo, localX: number, localZ: number) {
  return getDormantSurvivalGrassResolvers().getGrassSurfaceHeightForChunk(chunk, localX, localZ);
}

export function getSurvivalGrassSurfaceNormalForChunk(
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  sampleDistance?: number,
) {
  return getDormantSurvivalGrassResolvers().getGrassSurfaceNormalForChunk(chunk, localX, localZ, sampleDistance);
}

export function getSurvivalGrassSurfaceHeightAtWorld(worldX: number, worldZ: number) {
  return getDormantSurvivalGrassResolvers().getGrassSurfaceHeightAtWorld(worldX, worldZ);
}

export function getSurvivalChunkGrassSurfaceBiome(chunk: SurvivalChunkInfo) {
  return getDormantSurvivalGrassResolvers().getChunkGrassSurfaceBiome(chunk);
}

export function getSurvivalGrassSurfaceBiome(
  baseBiome: SurvivalBiome,
  worldX: number,
  worldZ: number,
  height: number,
) {
  return getDormantSurvivalGrassResolvers().getGrassSurfaceBiome(baseBiome, worldX, worldZ, height);
}

export function getSurvivalSmoothedTerrainColor(worldX: number, worldZ: number, height: number) {
  return getDormantSurvivalGrassResolvers().getSmoothedTerrainColor(worldX, worldZ, height);
}

export function getSurvivalGrassBladeColor(
  biome: SurvivalBiome,
  worldX: number,
  worldZ: number,
  height: number,
  variant: number,
) {
  return getDormantSurvivalGrassResolvers().getGrassBladeColor(biome, worldX, worldZ, height, variant);
}

export function getSurvivalIntegratedGrassBladeColor(
  biome: SurvivalBiome,
  worldX: number,
  worldZ: number,
  height: number,
  variant: number,
  terrainMix: number,
) {
  return getDormantSurvivalGrassResolvers().getIntegratedGrassBladeColor(biome, worldX, worldZ, height, variant, terrainMix);
}

export function isSurvivalGrassAllowedAtChunkPoint(chunk: SurvivalChunkInfo, localX: number, localZ: number) {
  return getDormantSurvivalGrassResolvers().isGrassAllowedAtChunkPoint(chunk, localX, localZ);
}

export function isSurvivalGrassSubmergedAtWorldPoint(
  chunk: SurvivalChunkInfo,
  worldX: number,
  worldZ: number,
  terrainY: number,
  shorelinePadding?: number,
  footprintRadius?: number,
) {
  return getDormantSurvivalGrassResolvers().isGrassSubmergedAtWorldPoint(
    chunk,
    worldX,
    worldZ,
    terrainY,
    shorelinePadding,
    footprintRadius,
  );
}

export function getSurvivalBotwGrassFootprintStats(worldX: number, worldZ: number, radius: number) {
  return getDormantSurvivalGrassResolvers().getBotwGrassFootprintStats(worldX, worldZ, radius);
}

export function getSurvivalLocalGrassPlacement(
  worldX: number,
  worldZ: number,
  submergeMargin: number,
  footprintRadius = 0,
  minNormalY = 0.58,
) {
  return getDormantSurvivalGrassResolvers().getLocalGrassPlacement(
    worldX,
    worldZ,
    submergeMargin,
    footprintRadius,
    minNormalY,
  );
}

export function getSurvivalGrassDebugRejectionSummary(worldX: number, worldZ: number) {
  return getDormantSurvivalGrassResolvers().getGrassDebugRejectionSummary(worldX, worldZ);
}
