import * as THREE from "three";
import type { SurvivalBiome } from "../../../../store/gameStore";
import {
  getSurvivalRestoredMeadowMask,
  isStrictSurvivalDesertTerrainAtWorld,
} from "../survival/survivalBiome";
import { lerpNumber } from "../survival/survivalMath";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import {
  SURVIVAL_BOTW_DECORATION_MIN_NORMAL_Y,
  SURVIVAL_BOTW_GRASS_FLAT_NORMAL_Y,
} from "./survivalBotwGrassConfig";
import {
  getSurvivalUnifiedTerrainSurfaceSampleAtWorld,
  isBaseVillageLocalGrassBlocked,
  isSurvivalGrassSubmergedAtWorldPoint,
  isSurvivalVillageGrassBlocked,
  type SurvivalBotwUnifiedTerrainSurfaceSampleTargets,
} from "./survivalBotwGrassResolvers";

export const SURVIVAL_GRASS_BLADE_SOURCE_UP = new THREE.Vector3(0, 1, 0);

export type SurvivalBotwGrassPlacementResult = {
  chunk: SurvivalChunkInfo;
  localX: number;
  localZ: number;
  terrainY: number;
  biome: SurvivalBiome;
  normal: THREE.Vector3;
};

export type SurvivalBotwGrassCarpetPlacementResult = {
  terrainY: number;
  biome: SurvivalBiome;
};

const survivalBotwPlacementSurfaceTargets: SurvivalBotwUnifiedTerrainSurfaceSampleTargets = {
  terrainNormal: new THREE.Vector3(),
  grassNormal: new THREE.Vector3(),
};
const survivalBotwCarpetSurfaceTargets: SurvivalBotwUnifiedTerrainSurfaceSampleTargets = {
  terrainNormal: new THREE.Vector3(),
  grassNormal: new THREE.Vector3(),
};

export function shouldKeepSurvivalBotwGrassBareForDesert(chunk: SurvivalChunkInfo, worldX: number, worldZ: number) {
  if (chunk.biome !== "desert") return false;
  return isStrictSurvivalDesertTerrainAtWorld(worldX, worldZ);
}

export function getSurvivalBotwGrassPlacement(
  worldX: number,
  worldZ: number,
  minNormalY = 0.28,
  targets?: SurvivalBotwUnifiedTerrainSurfaceSampleTargets,
): SurvivalBotwGrassPlacementResult | null {
  if (isBaseVillageLocalGrassBlocked(worldX, worldZ)) return null;

  const surface = getSurvivalUnifiedTerrainSurfaceSampleAtWorld(worldX, worldZ, 3.4, targets);
  const {
    chunk,
    localX,
    localZ,
    grassY: terrainY,
    grassNormal: normal,
    restoredMeadowMask,
  } = surface;
  if (isSurvivalVillageGrassBlocked(chunk, localX, localZ)) return null;

  if (isSurvivalGrassSubmergedAtWorldPoint(chunk, worldX, worldZ, terrainY, 0.018, 0)) {
    return null;
  }

  const biome = surface.grassBiome;
  if (biome === "desert" && shouldKeepSurvivalBotwGrassBareForDesert(chunk, worldX, worldZ)) return null;

  if (restoredMeadowMask > 0.02 && minNormalY <= 0.42) {
    return {
      chunk,
      localX,
      localZ,
      terrainY,
      biome: biome === "desert" ? "plains" : biome,
      normal: normal.y > SURVIVAL_BOTW_GRASS_FLAT_NORMAL_Y ? SURVIVAL_GRASS_BLADE_SOURCE_UP : normal,
    };
  }

  const meadowRelaxedMinNormalY = minNormalY <= 0.42
    ? 0.03
    : Math.max(minNormalY, SURVIVAL_BOTW_DECORATION_MIN_NORMAL_Y);
  const effectiveMinNormalY = lerpNumber(minNormalY, meadowRelaxedMinNormalY, restoredMeadowMask);
  if (normal.y < effectiveMinNormalY) return null;

  return { chunk, localX, localZ, terrainY, biome: biome === "desert" ? "plains" : biome, normal };
}

export function getSurvivalBotwGrassPlacementForBuild(worldX: number, worldZ: number, minNormalY = 0.28) {
  return getSurvivalBotwGrassPlacement(worldX, worldZ, minNormalY, survivalBotwPlacementSurfaceTargets);
}

export function getSurvivalBotwGrassCarpetPlacement(
  worldX: number,
  worldZ: number,
  targets?: SurvivalBotwUnifiedTerrainSurfaceSampleTargets,
): SurvivalBotwGrassCarpetPlacementResult | null {
  if (isBaseVillageLocalGrassBlocked(worldX, worldZ)) return null;

  const surface = getSurvivalUnifiedTerrainSurfaceSampleAtWorld(worldX, worldZ, 3.4, targets);
  const {
    chunk,
    localX,
    localZ,
    grassY: terrainY,
    grassNormal: normal,
    restoredMeadowMask,
  } = surface;
  if (isSurvivalVillageGrassBlocked(chunk, localX, localZ)) return null;

  if (isSurvivalGrassSubmergedAtWorldPoint(chunk, worldX, worldZ, terrainY, 0.018, 0)) {
    return null;
  }

  const biome = surface.grassBiome;
  if (biome === "desert" && shouldKeepSurvivalBotwGrassBareForDesert(chunk, worldX, worldZ)) return null;

  if (normal.y < lerpNumber(0.12, 0.02, restoredMeadowMask)) return null;

  return { terrainY, biome: biome === "desert" ? "plains" : biome };
}

export function getSurvivalBotwGrassCarpetPlacementForBuild(worldX: number, worldZ: number) {
  return getSurvivalBotwGrassCarpetPlacement(worldX, worldZ, survivalBotwCarpetSurfaceTargets);
}
