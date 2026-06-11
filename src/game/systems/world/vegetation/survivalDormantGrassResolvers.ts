import * as THREE from "three";
import type { SurvivalBiome } from "../../../../store/gameStore";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";

export type SurvivalLocalGrassPlacement = {
  terrainY: number;
  biome: SurvivalBiome;
  normal: THREE.Vector3;
};

export type DormantSurvivalGrassResolvers = {
  getChunkInfoAtWorld: (worldX: number, worldZ: number) => SurvivalChunkInfo;
  getTerrainHeightForChunk: (chunk: SurvivalChunkInfo, localX: number, localZ: number) => number;
  getGrassSurfaceHeightForChunk: (chunk: SurvivalChunkInfo, localX: number, localZ: number) => number;
  getGrassSurfaceNormalForChunk: (chunk: SurvivalChunkInfo, localX: number, localZ: number, sampleDistance?: number) => THREE.Vector3;
  getGrassSurfaceHeightAtWorld: (worldX: number, worldZ: number) => number;
  getChunkGrassSurfaceBiome: (chunk: SurvivalChunkInfo) => SurvivalBiome;
  getGrassSurfaceBiome: (baseBiome: SurvivalBiome, worldX: number, worldZ: number, height: number) => SurvivalBiome;
  getSmoothedTerrainColor: (worldX: number, worldZ: number, height: number) => THREE.Color;
  getGrassBladeColor: (biome: SurvivalBiome, worldX: number, worldZ: number, height: number, variant: number) => THREE.Color;
  getIntegratedGrassBladeColor: (biome: SurvivalBiome, worldX: number, worldZ: number, height: number, variant: number, terrainMix: number) => THREE.Color;
  isGrassAllowedAtChunkPoint: (chunk: SurvivalChunkInfo, localX: number, localZ: number) => boolean;
  isGrassSubmergedAtWorldPoint: (chunk: SurvivalChunkInfo, worldX: number, worldZ: number, terrainY: number, shorelinePadding?: number, footprintRadius?: number) => boolean;
  getBotwGrassFootprintStats: (worldX: number, worldZ: number, radius: number) => { baseY: number; heightRange: number };
  getLocalGrassPlacement: (worldX: number, worldZ: number, submergeMargin: number, footprintRadius?: number, minNormalY?: number) => SurvivalLocalGrassPlacement | null;
  getGrassDebugRejectionSummary: (worldX: number, worldZ: number) => string;
};

let dormantSurvivalGrassResolvers: DormantSurvivalGrassResolvers | null = null;

export function configureDormantSurvivalGrassResolvers(resolvers: DormantSurvivalGrassResolvers) {
  dormantSurvivalGrassResolvers = resolvers;
}

export function getDormantSurvivalGrassResolvers() {
  if (!dormantSurvivalGrassResolvers) {
    throw new Error("Dormant survival grass resolvers have not been configured.");
  }
  return dormantSurvivalGrassResolvers;
}
