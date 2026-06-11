import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE, type SurvivalBiome } from "../../../../store/gameStore";
import { checkIsBaseVillageHutCell } from "../terrain/BaseVillageTerrain";
import {
  getSurvivalRenderedTerrainHeightForChunk,
  getSurvivalRenderedTerrainNormalForChunkInto,
  getSurvivalTerrainRenderSegments,
} from "../terrain/survivalTerrainGeometry";
import {
  BASE_VILLAGE_HALF_SIZE,
  SURVIVAL_RIVER_SURFACE_MASK_THRESHOLD,
  type SurvivalChunkInfo,
} from "./survivalWorldConfig";
import {
  getSurvivalBiomeWeightValuesInto,
  getSurvivalRestoredMeadowMask,
  getSurvivalWaterLevelAtWorld,
  isSurvivalRestoredMeadowWaterSuppressed,
  survivalBiomes,
} from "./survivalBiome";
import { getSurvivalChunkInfoAtWorld } from "./survivalChunks";
import {
  getSurvivalChunkRiverMask,
  getSurvivalRiverCarveAtWorld,
} from "./survivalRivers";
import { getSurvivalTownRouteMask } from "./survivalRoutes";
import {
  getSurvivalRenderedTerrainColorInto,
  getSurvivalSmoothedTerrainColorInto,
  getSurvivalTerrainHeightForChunk,
  getSurvivalVillageBaseHeight,
  getSurvivalVillagePadHeight,
} from "./survivalTerrainSurface";
import { clamp01, lerpNumber, smoothstepRange, survivalHash01 } from "./survivalMath";
import {
  SURVIVAL_BOTW_GRASS_BLADE_MIN_NORMAL_Y,
} from "../vegetation/survivalBotwGrassConfig";
import { configureSurvivalBotwGrassResolvers } from "../vegetation/survivalBotwGrassResolvers";
import { getSurvivalBotwGrassFootprintStats } from "../vegetation/survivalBotwGrassFootprints";
import {
  getSurvivalBotwGrassCarpetPlacement,
  getSurvivalBotwGrassPlacement,
} from "../vegetation/survivalBotwGrassPlacement";
import {
  isSurvivalDesertVillageBuildingGrassBlocked,
  isSurvivalGrassVillageAxisPathBlocked,
  isSurvivalGrassVillageRingBlocked,
  isSurvivalMountainVillageGrassBlocked,
} from "../vegetation/survivalGrassVillageBlocking";
import { SURVIVAL_GRASS_COLORS } from "../vegetation/survivalFoliagePalettes";
import { shouldRenderSurvivalFullVillageChunk } from "../villages/survivalVillageVisibility";
import {
  DESERT_VILLAGE_RADIUS,
  isNearDesertGate,
} from "../villages/survivalDesertVillageTerrain";
import {
  GRAVEYARD_FENCE_RADIUS,
  getGraveyardChapelMask,
  getGraveyardEffectivePathMask,
  getGraveyardGateClearingMask,
} from "../villages/survivalGraveyardVillageTerrain";
import { getMountainVillageHeight as getMountainVillageSurfaceHeight } from "../villages/mountainVillageTerrain";
import { SWAMP_VILLAGE_RADIUS } from "../villages/survivalSwampVillageTerrain";

const survivalGrassTerrainColorSample = new THREE.Color();
const survivalGrassBiomeTerrainColorSample = new THREE.Color();
const survivalGrassDebugTerrainColorSample = new THREE.Color();
const survivalGrassBiomeWeights = new Array<number>(survivalBiomes.length).fill(0);

const SURVIVAL_GRASS_WATER_SURFACE_OFFSET = 0.16;
const SURVIVAL_GRASS_WATER_MASK_FEATHER = 0.12;
const SURVIVAL_GRASS_WATER_EDGE_CLEARANCE = 0.22;
const SURVIVAL_GRASS_WATER_CENTER_CLEARANCE = 0.58;
const SURVIVAL_GRASS_WATER_FOOTPRINT_SAMPLE_DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0.7071, 0.7071],
  [-0.7071, 0.7071],
  [0.7071, -0.7071],
  [-0.7071, -0.7071],
];

function getSurvivalGrassBladeColorInto(
  biome: SurvivalBiome,
  worldX: number,
  worldZ: number,
  height: number,
  variant: number,
  target: THREE.Color,
) {
  const palette = SURVIVAL_GRASS_COLORS[biome];
  const base = target.set(palette[Math.floor(variant * palette.length) % palette.length]);
  const terrainColor = getSurvivalSmoothedTerrainColorInto(worldX, worldZ, height, survivalGrassTerrainColorSample);
  const altitudeMix = smoothstepRange(58, 165, height);
  const terrainMix = biome === "desert"
    ? 0.32
    : biome === "swamp"
      ? 0.24
      : 0.12 + altitudeMix * 0.1;
  const shade = 0.96 + survivalHash01(Math.floor(worldX * 0.12), Math.floor(worldZ * 0.12), Math.floor(variant * 4096)) * 0.28;

  base.lerp(terrainColor, clamp01(terrainMix));
  base.r = clamp01(base.r * shade);
  base.g = clamp01(base.g * shade);
  base.b = clamp01(base.b * shade);
  return base;
}

function getSurvivalTerrainNormalForChunkInto(
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  target: THREE.Vector3,
  sampleDistance = 4,
) {
  const left = getSurvivalTerrainHeightForChunk(chunk, localX - sampleDistance, localZ);
  const right = getSurvivalTerrainHeightForChunk(chunk, localX + sampleDistance, localZ);
  const down = getSurvivalTerrainHeightForChunk(chunk, localX, localZ - sampleDistance);
  const up = getSurvivalTerrainHeightForChunk(chunk, localX, localZ + sampleDistance);
  return target.set(left - right, sampleDistance * 2, down - up).normalize();
}

function shouldUseVillagePadForGrassSurface(chunk: SurvivalChunkInfo, localX: number, localZ: number) {
  if (!chunk.hasVillage || !chunk.villageKind || chunk.villageKind === "lily-coil") return false;
  if (!shouldRenderSurvivalFullVillageChunk(chunk)) return false;
  return Math.max(Math.abs(localX), Math.abs(localZ)) < SURVIVAL_BLOCK_SIZE * 0.5;
}

function getSurvivalMountainVillageHeight(
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  baseHeight = getSurvivalVillageBaseHeight(chunk),
) {
  return getMountainVillageSurfaceHeight(chunk, localX, localZ, getSurvivalTerrainHeightForChunk, baseHeight);
}

function shouldUseMountainVillageGrassSurface(chunk: SurvivalChunkInfo) {
  return chunk.villageKind === "mountain" && shouldRenderSurvivalFullVillageChunk(chunk);
}

export function getSurvivalGrassSurfaceHeightForChunk(chunk: SurvivalChunkInfo, localX: number, localZ: number) {
  if (shouldUseMountainVillageGrassSurface(chunk)) {
    return getSurvivalMountainVillageHeight(chunk, localX, localZ);
  }

  if (shouldUseVillagePadForGrassSurface(chunk, localX, localZ)) {
    return getSurvivalVillagePadHeight(chunk, localX, localZ);
  }

  return getSurvivalRenderedTerrainHeightForChunk(chunk, localX, localZ);
}

export function getSurvivalGrassSurfaceHeightAtWorld(worldX: number, worldZ: number) {
  const chunk = getSurvivalChunkInfoAtWorld(worldX, worldZ);
  return getSurvivalGrassSurfaceHeightForChunk(chunk, worldX - chunk.x, worldZ - chunk.z);
}

function getSurvivalGrassSurfaceNormalForChunkInto(
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  target: THREE.Vector3,
  sampleDistance = 4,
) {
  if (!shouldUseVillagePadForGrassSurface(chunk, localX, localZ) && !shouldUseMountainVillageGrassSurface(chunk)) {
    return getSurvivalTerrainNormalForChunkInto(chunk, localX, localZ, target, sampleDistance);
  }

  const left = getSurvivalGrassSurfaceHeightForChunk(chunk, localX - sampleDistance, localZ);
  const right = getSurvivalGrassSurfaceHeightForChunk(chunk, localX + sampleDistance, localZ);
  const down = getSurvivalGrassSurfaceHeightForChunk(chunk, localX, localZ - sampleDistance);
  const up = getSurvivalGrassSurfaceHeightForChunk(chunk, localX, localZ + sampleDistance);
  return target.set(left - right, sampleDistance * 2, down - up).normalize();
}

export type SurvivalUnifiedTerrainSurfaceSample = {
  chunk: SurvivalChunkInfo;
  worldX: number;
  worldZ: number;
  localX: number;
  localZ: number;
  terrainY: number;
  grassY: number;
  terrainNormal: THREE.Vector3;
  grassNormal: THREE.Vector3;
  terrainBiome: SurvivalBiome;
  grassBiome: SurvivalBiome;
  restoredMeadowMask: number;
  riverMask: number;
  townRouteMask: number;
  usesGrassSurfaceOverride: boolean;
};

export type SurvivalUnifiedTerrainSurfaceSampleTargets = {
  terrainNormal?: THREE.Vector3;
  grassNormal?: THREE.Vector3;
};

export function getSurvivalUnifiedTerrainSurfaceSampleForChunk(
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  sampleDistance = 3.6,
  targets?: SurvivalUnifiedTerrainSurfaceSampleTargets,
): SurvivalUnifiedTerrainSurfaceSample {
  const worldX = chunk.x + localX;
  const worldZ = chunk.z + localZ;
  const terrainSegments = getSurvivalTerrainRenderSegments(chunk);
  const terrainY = getSurvivalRenderedTerrainHeightForChunk(chunk, localX, localZ, terrainSegments);
  const useMountainVillageSurface = shouldUseMountainVillageGrassSurface(chunk);
  const useVillagePadSurface = shouldUseVillagePadForGrassSurface(chunk, localX, localZ);
  const usesGrassSurfaceOverride = useMountainVillageSurface || useVillagePadSurface;
  const grassY = usesGrassSurfaceOverride
    ? getSurvivalGrassSurfaceHeightForChunk(chunk, localX, localZ)
    : terrainY;
  const terrainNormal = getSurvivalRenderedTerrainNormalForChunkInto(
    chunk,
    localX,
    localZ,
    targets?.terrainNormal ?? new THREE.Vector3(),
    sampleDistance,
    terrainSegments,
  );
  const grassNormal = usesGrassSurfaceOverride
    ? getSurvivalGrassSurfaceNormalForChunkInto(
      chunk,
      localX,
      localZ,
      targets?.grassNormal ?? new THREE.Vector3(),
      sampleDistance,
    )
    : terrainNormal;
  const riverMask = Math.max(
    getSurvivalChunkRiverMask(chunk, worldX, worldZ),
    getSurvivalRiverCarveAtWorld(worldX, worldZ).strength,
  );

  return {
    chunk,
    worldX,
    worldZ,
    localX,
    localZ,
    terrainY,
    grassY,
    terrainNormal,
    grassNormal,
    terrainBiome: chunk.biome,
    grassBiome: getSurvivalGrassSurfaceBiome(chunk.biome, worldX, worldZ, grassY),
    restoredMeadowMask: getSurvivalRestoredMeadowMask(worldX, worldZ),
    riverMask,
    townRouteMask: getSurvivalTownRouteMask(worldX, worldZ),
    usesGrassSurfaceOverride,
  };
}

function getSurvivalUnifiedTerrainSurfaceSampleAtWorld(
  worldX: number,
  worldZ: number,
  sampleDistance = 3.6,
  targets?: SurvivalUnifiedTerrainSurfaceSampleTargets,
) {
  const chunk = getSurvivalChunkInfoAtWorld(worldX, worldZ);
  return getSurvivalUnifiedTerrainSurfaceSampleForChunk(
    chunk,
    worldX - chunk.x,
    worldZ - chunk.z,
    sampleDistance,
    targets,
  );
}

export function getSurvivalDecorationSurfaceQuality(
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  footprintRadius: number,
  sampleDistance = 4.2,
) {
  const worldX = chunk.x + localX;
  const worldZ = chunk.z + localZ;
  const terrainSegments = getSurvivalTerrainRenderSegments(chunk);
  const terrainY = getSurvivalRenderedTerrainHeightForChunk(chunk, localX, localZ, terrainSegments);
  const terrainNormal = getSurvivalRenderedTerrainNormalForChunkInto(
    chunk,
    localX,
    localZ,
    new THREE.Vector3(),
    sampleDistance,
    terrainSegments,
  );
  const footprintStats = getSurvivalBotwGrassFootprintStats(worldX, worldZ, footprintRadius);

  return {
    y: Math.min(terrainY, footprintStats.baseY),
    normal: terrainNormal,
    heightRange: footprintStats.heightRange,
  };
}

function isSurvivalVillageGrassBlocked(chunk: SurvivalChunkInfo, localX: number, localZ: number) {
  if (!chunk.hasVillage || !chunk.villageKind) return false;
  if (chunk.villageKind === "lily-coil") return true;

  const absX = Math.abs(localX);
  const absZ = Math.abs(localZ);
  const maxAbs = Math.max(absX, absZ);
  if (maxAbs > BASE_VILLAGE_HALF_SIZE + 92) return false;
  const radiusSq = localX * localX + localZ * localZ;

  if (chunk.villageKind === "desert") {
    if (getSurvivalRestoredMeadowMask(chunk.x + localX, chunk.z + localZ) > 0.02) {
      return false;
    }

    const diagonalA = Math.abs((localX - localZ) / Math.SQRT2);
    const diagonalB = Math.abs((localX + localZ) / Math.SQRT2);
    const desertInnerRadius = DESERT_VILLAGE_RADIUS - 8;
    const desertOuterRadius = DESERT_VILLAGE_RADIUS + 8;
    return (
      radiusSq < 40 * 40 ||
      isSurvivalGrassVillageAxisPathBlocked(localX, localZ, 22, BASE_VILLAGE_HALF_SIZE + 72) ||
      (diagonalA < 10 && radiusSq < 226 * 226) ||
      (diagonalB < 10 && radiusSq < 226 * 226) ||
      (
        radiusSq > desertInnerRadius * desertInnerRadius &&
        radiusSq < desertOuterRadius * desertOuterRadius &&
        !isNearDesertGate(localX, localZ)
      ) ||
      isSurvivalDesertVillageBuildingGrassBlocked(chunk, localX, localZ, isNearDesertGate)
    );
  }

  if (chunk.villageKind === "chicago") {
    return maxAbs < BASE_VILLAGE_HALF_SIZE + 24;
  }

  if (chunk.villageKind === "graveyard") {
    return (
      getGraveyardEffectivePathMask(localX, localZ) > 0.12 ||
      getGraveyardChapelMask(localX, localZ) > 0.06 ||
      getGraveyardGateClearingMask(localX, localZ) > 0.08 ||
      isSurvivalGrassVillageRingBlocked(localX, localZ, GRAVEYARD_FENCE_RADIUS, 16)
    );
  }

  if (chunk.villageKind === "swamp") {
    const grassBlockRadius = SWAMP_VILLAGE_RADIUS + 34;
    return radiusSq < grassBlockRadius * grassBlockRadius;
  }

  if (chunk.villageKind === "mountain") {
    return isSurvivalMountainVillageGrassBlocked(chunk, localX, localZ);
  }

  if (chunk.villageKind === "darrel-grove") {
    return (
      radiusSq < 154 * 154 ||
      isSurvivalGrassVillageRingBlocked(localX, localZ, 198, 24)
    );
  }

  return (
    radiusSq < 78 * 78 ||
    isSurvivalGrassVillageRingBlocked(localX, localZ, 148, 30)
  );
}

function getSurvivalGrassSurfaceBiome(baseBiome: SurvivalBiome, worldX: number, worldZ: number, height: number): SurvivalBiome {
  if (getSurvivalRestoredMeadowMask(worldX, worldZ) > 0.08) return "tallgrass";
  if (baseBiome !== "desert") return baseBiome;

  const terrainColor = getSurvivalSmoothedTerrainColorInto(worldX, worldZ, height, survivalGrassBiomeTerrainColorSample);
  const looksLikeMeadow = terrainColor.g > terrainColor.r * 1.04 && terrainColor.g > terrainColor.b * 1.18;
  const biomeWeights = getSurvivalBiomeWeightValuesInto(worldX, worldZ, survivalGrassBiomeWeights);
  let strongestNonDesertBiome: SurvivalBiome | null = null;
  let strongestNonDesertWeight = 0;
  for (let index = 0; index < survivalBiomes.length; index += 1) {
    const biome = survivalBiomes[index];
    const weight = biomeWeights[index] ?? 0;
    if (biome === "desert" || weight <= strongestNonDesertWeight) continue;
    strongestNonDesertBiome = biome;
    strongestNonDesertWeight = weight;
  }

  if (looksLikeMeadow || strongestNonDesertWeight > 0.18) {
    return strongestNonDesertBiome ?? "plains";
  }

  return "desert";
}

function isSurvivalGrassSubmergedAtWorldPoint(
  chunk: SurvivalChunkInfo,
  worldX: number,
  worldZ: number,
  terrainY: number,
  shorelinePadding = 0.08,
  footprintRadius = 0,
) {
  const isSurfaceBlocked = (
    sampleChunk: SurvivalChunkInfo,
    sampleWorldX: number,
    sampleWorldZ: number,
    sampleTerrainY: number,
  ) => {
    const riverMask = Math.max(
      getSurvivalChunkRiverMask(sampleChunk, sampleWorldX, sampleWorldZ),
      getSurvivalRiverCarveAtWorld(sampleWorldX, sampleWorldZ).strength,
    );
    const restoredMeadowMask = getSurvivalRestoredMeadowMask(sampleWorldX, sampleWorldZ);
    if (isSurvivalRestoredMeadowWaterSuppressed(sampleWorldX, sampleWorldZ, 8)) return false;
    const effectiveRiverSurfaceThreshold = lerpNumber(SURVIVAL_RIVER_SURFACE_MASK_THRESHOLD, 0.62, restoredMeadowMask);
    const effectiveWaterMaskFeather = lerpNumber(SURVIVAL_GRASS_WATER_MASK_FEATHER, 0.04, restoredMeadowMask);
    const riverMaskMinimum = Math.max(0, effectiveRiverSurfaceThreshold - effectiveWaterMaskFeather);
    if (riverMask < riverMaskMinimum) return false;

    const waterSurfaceY = getSurvivalWaterLevelAtWorld(sampleWorldX, sampleWorldZ) + SURVIVAL_GRASS_WATER_SURFACE_OFFSET;
    const meadowShoreClearanceScale = lerpNumber(1, 0.04, restoredMeadowMask);
    const visibleWaterClearance = riverMask >= effectiveRiverSurfaceThreshold
      ? lerpNumber(0.52, 0.03, restoredMeadowMask)
      : 0;
    const shoreClearance = lerpNumber(
      SURVIVAL_GRASS_WATER_EDGE_CLEARANCE,
      SURVIVAL_GRASS_WATER_CENTER_CLEARANCE,
      smoothstepRange(riverMaskMinimum, lerpNumber(0.68, 0.86, restoredMeadowMask), riverMask),
    ) * meadowShoreClearanceScale;
    return sampleTerrainY < waterSurfaceY + Math.max(shorelinePadding * meadowShoreClearanceScale, visibleWaterClearance, shoreClearance);
  };

  if (isSurfaceBlocked(chunk, worldX, worldZ, terrainY)) return true;
  if (footprintRadius <= 1.2) return false;

  const sampleDistance = Math.min(Math.max(footprintRadius * 0.78, 1.5), 20);
  const sampleCount = footprintRadius >= 6 ? SURVIVAL_GRASS_WATER_FOOTPRINT_SAMPLE_DIRECTIONS.length : 4;

  for (let index = 0; index < sampleCount; index += 1) {
    const [sampleX, sampleZ] = SURVIVAL_GRASS_WATER_FOOTPRINT_SAMPLE_DIRECTIONS[index];
    const sampleWorldX = worldX + sampleX * sampleDistance;
    const sampleWorldZ = worldZ + sampleZ * sampleDistance;
    const sampleChunk = getSurvivalChunkInfoAtWorld(sampleWorldX, sampleWorldZ, chunk.distance, chunk.lod);
    const sampleTerrainY = getSurvivalGrassSurfaceHeightForChunk(
      sampleChunk,
      sampleWorldX - sampleChunk.x,
      sampleWorldZ - sampleChunk.z,
    );
    if (isSurfaceBlocked(sampleChunk, sampleWorldX, sampleWorldZ, sampleTerrainY)) return true;
  }

  return false;
}

function isBaseVillageLocalGrassBlocked(worldX: number, worldZ: number) {
  const absX = Math.abs(worldX);
  const absZ = Math.abs(worldZ);
  if (Math.max(absX, absZ) > BASE_VILLAGE_HALF_SIZE + 72) return false;

  const radiusSq = worldX * worldX + worldZ * worldZ;
  return (
    absX < 50 ||
    absZ < 50 ||
    radiusSq < 72 * 72 ||
    (radiusSq > 42 * 42 && radiusSq < 58 * 58) ||
    (radiusSq > 125 * 125 && radiusSq < 145 * 145) ||
    checkIsBaseVillageHutCell(worldX, worldZ)
  );
}

function getSurvivalGrassDebugSampleAt(worldX: number, worldZ: number) {
  const surface = getSurvivalUnifiedTerrainSurfaceSampleAtWorld(worldX, worldZ, 3.6);
  const {
    chunk,
    localX,
    localZ,
    terrainY,
    grassY,
    terrainNormal,
    grassNormal,
    riverMask,
  } = surface;
  const terrainColor = getSurvivalRenderedTerrainColorInto(worldX, worldZ, terrainY, survivalGrassDebugTerrainColorSample);
  return {
    worldX: Math.round(worldX),
    worldZ: Math.round(worldZ),
    chunk: chunk.key,
    biome: chunk.biome,
    villageKind: chunk.villageKind,
    localX: Math.round(localX),
    localZ: Math.round(localZ),
    terrainY: Math.round(terrainY * 10) / 10,
    grassY: Math.round(grassY * 10) / 10,
    terrainNormalY: Math.round(terrainNormal.y * 1000) / 1000,
    grassNormalY: Math.round(grassNormal.y * 1000) / 1000,
    restoredMeadowMask: Math.round(surface.restoredMeadowMask * 1000) / 1000,
    routeMask: Math.round(surface.townRouteMask * 1000) / 1000,
    riverMask: Math.round(riverMask * 1000) / 1000,
    waterY: Math.round(getSurvivalWaterLevelAtWorld(worldX, worldZ) * 10) / 10,
    baseBlocked: isBaseVillageLocalGrassBlocked(worldX, worldZ),
    villageBlocked: isSurvivalVillageGrassBlocked(chunk, localX, localZ),
    mountainVillageGrassBlocked: chunk.villageKind === "mountain"
      ? isSurvivalMountainVillageGrassBlocked(chunk, localX, localZ)
      : false,
    usesGrassSurfaceOverride: surface.usesGrassSurfaceOverride,
    submerged: isSurvivalGrassSubmergedAtWorldPoint(chunk, worldX, worldZ, grassY, 0.018, 0),
    botwPlacement: Boolean(getSurvivalBotwGrassPlacement(worldX, worldZ, SURVIVAL_BOTW_GRASS_BLADE_MIN_NORMAL_Y)),
    carpetPlacement: Boolean(getSurvivalBotwGrassCarpetPlacement(worldX, worldZ)),
    terrainColor: `#${terrainColor.getHexString()}`,
  };
}

configureSurvivalBotwGrassResolvers({
  getGrassSurfaceHeightAtWorld: getSurvivalGrassSurfaceHeightAtWorld,
  getSmoothedTerrainColorInto: getSurvivalSmoothedTerrainColorInto,
  getFastGrassBladeColorInto: getSurvivalGrassBladeColorInto,
  isBaseVillageLocalGrassBlocked,
  getUnifiedTerrainSurfaceSampleAtWorld: getSurvivalUnifiedTerrainSurfaceSampleAtWorld,
  isVillageGrassBlocked: isSurvivalVillageGrassBlocked,
  isGrassSubmergedAtWorldPoint: isSurvivalGrassSubmergedAtWorldPoint,
  getGrassDebugSampleAt: getSurvivalGrassDebugSampleAt,
});
