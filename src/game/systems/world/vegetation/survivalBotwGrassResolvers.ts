import * as THREE from "three";
import type { SurvivalBiome } from "../../../../store/gameStore";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";

export type SurvivalBotwUnifiedTerrainSurfaceSample = {
  chunk: SurvivalChunkInfo;
  localX: number;
  localZ: number;
  grassY: number;
  grassNormal: THREE.Vector3;
  grassBiome: SurvivalBiome;
  restoredMeadowMask: number;
};

export type SurvivalBotwUnifiedTerrainSurfaceSampleTargets = {
  terrainNormal?: THREE.Vector3;
  grassNormal?: THREE.Vector3;
};

export type SurvivalBotwGrassResolvers = {
  getGrassSurfaceHeightAtWorld: (worldX: number, worldZ: number) => number;
  getSmoothedTerrainColor: (worldX: number, worldZ: number, height: number) => THREE.Color;
  getSmoothedTerrainColorInto: (worldX: number, worldZ: number, height: number, target: THREE.Color) => THREE.Color;
  getFastGrassBladeColorInto: (biome: SurvivalBiome, worldX: number, worldZ: number, height: number, variant: number, target: THREE.Color) => THREE.Color;
  isBaseVillageLocalGrassBlocked: (worldX: number, worldZ: number) => boolean;
  getUnifiedTerrainSurfaceSampleAtWorld: (
    worldX: number,
    worldZ: number,
    sampleDistance?: number,
    targets?: SurvivalBotwUnifiedTerrainSurfaceSampleTargets,
  ) => SurvivalBotwUnifiedTerrainSurfaceSample;
  isVillageGrassBlocked: (chunk: SurvivalChunkInfo, localX: number, localZ: number) => boolean;
  isGrassSubmergedAtWorldPoint: (chunk: SurvivalChunkInfo, worldX: number, worldZ: number, terrainY: number, shorelinePadding?: number, footprintRadius?: number) => boolean;
  getGrassDebugSampleAt: (worldX: number, worldZ: number) => Record<string, unknown>;
};

let survivalBotwGrassResolvers: SurvivalBotwGrassResolvers | null = null;

export function configureSurvivalBotwGrassResolvers(resolvers: SurvivalBotwGrassResolvers) {
  survivalBotwGrassResolvers = resolvers;
}

export function getSurvivalBotwGrassResolvers() {
  if (!survivalBotwGrassResolvers) {
    throw new Error("Survival BOTW grass resolvers have not been configured.");
  }
  return survivalBotwGrassResolvers;
}

export function getSurvivalGrassSurfaceHeightAtWorld(worldX: number, worldZ: number) {
  return getSurvivalBotwGrassResolvers().getGrassSurfaceHeightAtWorld(worldX, worldZ);
}

export function getSurvivalSmoothedTerrainColor(worldX: number, worldZ: number, height: number) {
  return getSurvivalBotwGrassResolvers().getSmoothedTerrainColor(worldX, worldZ, height);
}

export function getSurvivalSmoothedTerrainColorInto(
  worldX: number,
  worldZ: number,
  height: number,
  target: THREE.Color,
) {
  return getSurvivalBotwGrassResolvers().getSmoothedTerrainColorInto(worldX, worldZ, height, target);
}

export function getSurvivalFastGrassBladeColorInto(
  biome: SurvivalBiome,
  worldX: number,
  worldZ: number,
  height: number,
  variant: number,
  target: THREE.Color,
) {
  return getSurvivalBotwGrassResolvers().getFastGrassBladeColorInto(biome, worldX, worldZ, height, variant, target);
}

export function isBaseVillageLocalGrassBlocked(worldX: number, worldZ: number) {
  return getSurvivalBotwGrassResolvers().isBaseVillageLocalGrassBlocked(worldX, worldZ);
}

export function getSurvivalUnifiedTerrainSurfaceSampleAtWorld(
  worldX: number,
  worldZ: number,
  sampleDistance?: number,
  targets?: SurvivalBotwUnifiedTerrainSurfaceSampleTargets,
) {
  return getSurvivalBotwGrassResolvers().getUnifiedTerrainSurfaceSampleAtWorld(worldX, worldZ, sampleDistance, targets);
}

export function isSurvivalVillageGrassBlocked(chunk: SurvivalChunkInfo, localX: number, localZ: number) {
  return getSurvivalBotwGrassResolvers().isVillageGrassBlocked(chunk, localX, localZ);
}

export function isSurvivalGrassSubmergedAtWorldPoint(
  chunk: SurvivalChunkInfo,
  worldX: number,
  worldZ: number,
  terrainY: number,
  shorelinePadding?: number,
  footprintRadius?: number,
) {
  return getSurvivalBotwGrassResolvers().isGrassSubmergedAtWorldPoint(chunk, worldX, worldZ, terrainY, shorelinePadding, footprintRadius);
}

export function getSurvivalGrassDebugSampleAt(worldX: number, worldZ: number) {
  return getSurvivalBotwGrassResolvers().getGrassDebugSampleAt(worldX, worldZ);
}
