import * as THREE from "three";
import type { SurvivalBiome } from "../../../../store/gameStore";
import { getSurvivalRestoredMeadowMask } from "../survival/survivalBiome";
import { clamp01, lerpNumber, smoothstepRange, survivalHash01 } from "../survival/survivalMath";
import {
  getSurvivalTownRouteMask,
  shouldSkipSurvivalBotwGrassForTownRoute,
} from "../survival/survivalRoutes";
import {
  SURVIVAL_BOTW_FLOWER_FAR_HEIGHT_LIMIT,
  SURVIVAL_BOTW_FLOWER_FLUSH_FOOTPRINT_RANGE,
  SURVIVAL_BOTW_FLOWER_NEAR_HEIGHT_LIMIT,
  SURVIVAL_BOTW_GRASS_BLADE_MIN_NORMAL_Y,
  SURVIVAL_BOTW_GRASS_BOOTSTRAP_CANDIDATE_MULTIPLIER,
  SURVIVAL_BOTW_GRASS_BOOTSTRAP_DESKTOP_COUNT,
  SURVIVAL_BOTW_GRASS_BOOTSTRAP_DESKTOP_RADIUS_SCALE,
  SURVIVAL_BOTW_GRASS_BOOTSTRAP_MOBILE_COUNT,
  SURVIVAL_BOTW_GRASS_BOOTSTRAP_MOBILE_RADIUS_SCALE,
  SURVIVAL_BOTW_GRASS_CANDIDATE_MULTIPLIER,
  SURVIVAL_BOTW_GRASS_DESKTOP_COUNT,
  SURVIVAL_BOTW_GRASS_FLOWER_DESKTOP_COUNT,
  SURVIVAL_BOTW_GRASS_FLOWER_DESKTOP_RADIUS_SCALE,
  SURVIVAL_BOTW_GRASS_FLOWER_MIN_NORMAL_Y,
  SURVIVAL_BOTW_GRASS_FLOWER_MOBILE_COUNT,
  SURVIVAL_BOTW_GRASS_FLOWER_MOBILE_RADIUS_SCALE,
  SURVIVAL_BOTW_GRASS_FOOTPRINT_SCALE,
  SURVIVAL_BOTW_GRASS_MAX_FOOTPRINT_HEIGHT_RANGE,
  SURVIVAL_BOTW_GRASS_MOBILE_COUNT,
  SURVIVAL_BOTW_GRASS_RADIUS,
  SURVIVAL_BOTW_GRASS_TALL_FLOWER_FEATURE_COUNT,
  type SurvivalBotwFlowerInstance,
  type SurvivalBotwFlowerType,
  type SurvivalBotwGrassBladeInstance,
  type SurvivalBotwGrassCenter,
} from "./survivalBotwGrassConfig";
import {
  getSurvivalBotwFlowerFootprintStatsForPlacement,
  getSurvivalBotwGrassFlushFootprintLimit,
  getSurvivalBotwGrassFootprintStatsForPlacement,
} from "./survivalBotwGrassFootprints";
import {
  getSurvivalBotwGrassPlacementForBuild,
  shouldKeepSurvivalBotwGrassBareForDesert,
} from "./survivalBotwGrassPlacement";
import {
  SURVIVAL_BOTW_FLOWER_GLOW_COLOR,
  SURVIVAL_BOTW_FLOWER_LEAF_BASE_COLOR,
  SURVIVAL_BOTW_FLOWER_LEAF_BRIGHT_COLOR,
  SURVIVAL_BOTW_FLOWER_LEAF_TALL_COLOR,
  SURVIVAL_FLOWER_COLORS,
  getSurvivalBotwHillsideKeepChance,
  getSurvivalBotwHillsideVegetationMix,
  tintSurvivalBotwHillsideGrassColor,
} from "./survivalFoliagePalettes";
import {
  getSurvivalFastGrassBladeColorInto,
  getSurvivalSmoothedTerrainColorInto,
} from "./survivalBotwGrassResolvers";

const SURVIVAL_BOTW_INSTANCE_BASE_COLOR = new THREE.Color("#62bd37");
const SURVIVAL_BOTW_INSTANCE_LIFT_COLOR = new THREE.Color("#b9ef5b");
const SURVIVAL_BOTW_INSTANCE_SHADOW_COLOR = new THREE.Color("#3c8b2d");
const survivalBotwInstanceAccentScratch = new THREE.Color();
const survivalBotwBladeInstanceColorScratch = new THREE.Color();
const survivalBotwHillsideTerrainColorScratch = new THREE.Color();
const survivalBotwFlowerColorScratch = new THREE.Color();
const survivalBotwFlowerLargeColorScratch = new THREE.Color();
const survivalBotwFlowerLeafColorScratch = new THREE.Color();

export type SurvivalBotwGrassBuildContext = {
  centerX: number;
  centerY: number;
  centerZ: number;
  radius: number;
  maxInstances: number;
  candidateCount: number;
  centerSeedX: number;
  centerSeedZ: number;
  angleOffset: number;
};

export type SurvivalBotwFlowerBuildContext = SurvivalBotwGrassBuildContext & {
  maxFlowers: number;
};

function getSurvivalBotwGrassInstanceColorInto(
  biome: SurvivalBiome,
  worldX: number,
  worldZ: number,
  height: number,
  variant: number,
  target: THREE.Color,
) {
  const color = getSurvivalFastGrassBladeColorInto(biome, worldX, worldZ, height, variant, target);
  const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
  const fiber = survivalHash01(Math.floor(worldX * 0.44), Math.floor(worldZ * 0.44), 8200 + Math.floor(variant * 1000));
  const botwColor = survivalBotwInstanceAccentScratch
    .copy(SURVIVAL_BOTW_INSTANCE_SHADOW_COLOR)
    .lerp(SURVIVAL_BOTW_INSTANCE_BASE_COLOR, 0.56 + fiber * 0.28)
    .lerp(SURVIVAL_BOTW_INSTANCE_LIFT_COLOR, smoothstepRange(0.62, 1, fiber) * 0.34);
  color.lerp(botwColor, biome === "desert" || biome === "swamp" ? 0.34 : 0.68 + meadowMask * 0.2);
  color.multiplyScalar(0.98 + survivalHash01(Math.floor(worldX * 0.18), Math.floor(worldZ * 0.18), 8300) * 0.1);
  color.r = clamp01(color.r);
  color.g = clamp01(color.g);
  color.b = clamp01(color.b);
  return color;
}

export function getSurvivalBotwGrassBuildContext(
  centerX: number,
  centerY: number,
  centerZ: number,
  mobilePerformanceMode: boolean,
): SurvivalBotwGrassBuildContext {
  const radius = SURVIVAL_BOTW_GRASS_RADIUS;
  const maxInstances = mobilePerformanceMode ? SURVIVAL_BOTW_GRASS_MOBILE_COUNT : SURVIVAL_BOTW_GRASS_DESKTOP_COUNT;
  const centerSeedX = Math.floor(centerX * 0.25);
  const centerSeedZ = Math.floor(centerZ * 0.25);
  return {
    centerX,
    centerY,
    centerZ,
    radius,
    maxInstances,
    candidateCount: Math.round(maxInstances * SURVIVAL_BOTW_GRASS_CANDIDATE_MULTIPLIER),
    centerSeedX,
    centerSeedZ,
    angleOffset: survivalHash01(centerSeedX, centerSeedZ, 1850) * Math.PI * 2,
  };
}

export function getSurvivalBotwFlowerBuildContext(
  centerX: number,
  centerY: number,
  centerZ: number,
  mobilePerformanceMode: boolean,
): SurvivalBotwFlowerBuildContext {
  const radius = SURVIVAL_BOTW_GRASS_RADIUS * (
    mobilePerformanceMode
      ? SURVIVAL_BOTW_GRASS_FLOWER_MOBILE_RADIUS_SCALE
      : SURVIVAL_BOTW_GRASS_FLOWER_DESKTOP_RADIUS_SCALE
  );
  const maxFlowers = mobilePerformanceMode ? SURVIVAL_BOTW_GRASS_FLOWER_MOBILE_COUNT : SURVIVAL_BOTW_GRASS_FLOWER_DESKTOP_COUNT;
  const centerSeedX = Math.floor(centerX * 0.25);
  const centerSeedZ = Math.floor(centerZ * 0.25);
  return {
    centerX,
    centerY,
    centerZ,
    radius,
    maxInstances: maxFlowers,
    maxFlowers,
    candidateCount: Math.round(maxFlowers * 6.4),
    centerSeedX,
    centerSeedZ,
    angleOffset: survivalHash01(centerSeedX, centerSeedZ, 4850) * Math.PI * 2,
  };
}

export function makeSurvivalBotwGrassBladeCandidate(
  context: SurvivalBotwGrassBuildContext,
  candidate: number,
): SurvivalBotwGrassBladeInstance | null {
  const radial = Math.sqrt((candidate + 0.5) / context.candidateCount);
  const angle = context.angleOffset + candidate * 2.399963229728653;
  const jitter = (survivalHash01(context.centerSeedX + candidate * 17, context.centerSeedZ - candidate * 11, 1900) - 0.5) * 0.56;
  const radialDistance = context.radius * radial + jitter;
  const worldX = context.centerX + Math.cos(angle) * radialDistance;
  const worldZ = context.centerZ + Math.sin(angle) * radialDistance;
  const routeMask = getSurvivalTownRouteMask(worldX, worldZ);
  const placement = getSurvivalBotwGrassPlacementForBuild(worldX, worldZ, SURVIVAL_BOTW_GRASS_BLADE_MIN_NORMAL_Y);
  if (!placement) return null;
  const earlyHillsideMix = getSurvivalBotwHillsideVegetationMix(placement.terrainY, placement.normal.y);
  const hillsideKeepRoll = survivalHash01(context.centerSeedX - candidate * 13, context.centerSeedZ + candidate * 17, 2860);
  if (hillsideKeepRoll > getSurvivalBotwHillsideKeepChance(earlyHillsideMix, 0.5)) return null;

  const variant = survivalHash01(context.centerSeedX + candidate * 23, context.centerSeedZ - candidate * 29, 2300);
  const color = getSurvivalBotwGrassInstanceColorInto(
    placement.biome,
    worldX,
    worldZ,
    placement.terrainY,
    variant,
    survivalBotwBladeInstanceColorScratch,
  );
  const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
  const slopeCompression = lerpNumber(1, 0.72, smoothstepRange(0.34, 0.78, 1 - placement.normal.y));
  const routeCompression = shouldKeepSurvivalBotwGrassBareForDesert(placement.chunk, worldX, worldZ)
    ? lerpNumber(1, 0.78, smoothstepRange(0.28, 0.64, routeMask))
    : 1;
  const meadowCoverageBoost = lerpNumber(1, 1.42, meadowMask);
  const baseHeight = (
    1.1 +
    survivalHash01(context.centerSeedX + candidate * 31, context.centerSeedZ, 2500) * 0.34 +
    meadowMask * 0.12
  ) * slopeCompression * routeCompression * lerpNumber(1, 1.16, meadowMask);
  const baseWidth = (
    1.42 +
    survivalHash01(context.centerSeedX, context.centerSeedZ + candidate * 37, 2700) * 0.54
  ) * meadowCoverageBoost;
  const footprintStats = getSurvivalBotwGrassFootprintStatsForPlacement(
    worldX,
    worldZ,
    Math.min(2.1, baseWidth * SURVIVAL_BOTW_GRASS_FOOTPRINT_SCALE * 1.72),
    placement,
  );
  const flushFootprintLimit = getSurvivalBotwGrassFlushFootprintLimit(placement.normal.y, meadowMask);
  if (footprintStats.heightRange > Math.min(SURVIVAL_BOTW_GRASS_MAX_FOOTPRINT_HEIGHT_RANGE, flushFootprintLimit)) return null;
  const hillsideMix = getSurvivalBotwHillsideVegetationMix(placement.terrainY, placement.normal.y, footprintStats.heightRange);
  tintSurvivalBotwHillsideGrassColor(
    color,
    worldX,
    worldZ,
    placement.terrainY,
    hillsideMix,
    getSurvivalSmoothedTerrainColorInto,
    survivalBotwHillsideTerrainColorScratch,
  );
  const distanceFromCenter = Math.abs(radialDistance);
  const midDistanceFill = meadowMask * smoothstepRange(28, context.radius * 0.82, distanceFromCenter);
  const footprintCompression = lerpNumber(
    1,
    0.68,
    smoothstepRange(1.2, SURVIVAL_BOTW_GRASS_MAX_FOOTPRINT_HEIGHT_RANGE, footprintStats.heightRange),
  );
  const slopeSurfaceTuck = clamp01(Math.max(
    smoothstepRange(0.18, 2.4, footprintStats.heightRange),
    smoothstepRange(0.04, 0.24, 1 - placement.normal.y),
  ));
  const height = baseHeight *
    footprintCompression *
    lerpNumber(1, 1.28, midDistanceFill) *
    lerpNumber(1, 0.78, slopeSurfaceTuck) *
    lerpNumber(1, 0.48, hillsideMix);
  const width = baseWidth *
    lerpNumber(1, 0.82, smoothstepRange(1.2, SURVIVAL_BOTW_GRASS_MAX_FOOTPRINT_HEIGHT_RANGE, footprintStats.heightRange)) *
    lerpNumber(1, 1.62, midDistanceFill) *
    lerpNumber(1, 0.46, slopeSurfaceTuck) *
    lerpNumber(1, 0.58, hillsideMix);

  return {
    x: worldX,
    y: footprintStats.baseY,
    z: worldZ,
    normalX: placement.normal.x,
    normalY: placement.normal.y,
    normalZ: placement.normal.z,
    yaw: survivalHash01(context.centerSeedX - candidate * 41, context.centerSeedZ + candidate * 43, 2900) * Math.PI * 2,
    width,
    height,
    colorR: color.r,
    colorG: color.g,
    colorB: color.b,
  };
}

export function makeSurvivalBotwGrassBootstrapPreview(
  center: SurvivalBotwGrassCenter,
  mobilePerformanceMode: boolean,
) {
  const context = getSurvivalBotwGrassBuildContext(center.x, center.y, center.z, mobilePerformanceMode);
  const targetCount = mobilePerformanceMode
    ? SURVIVAL_BOTW_GRASS_BOOTSTRAP_MOBILE_COUNT
    : SURVIVAL_BOTW_GRASS_BOOTSTRAP_DESKTOP_COUNT;
  const previewContext = {
    ...context,
    radius: context.radius * (
      mobilePerformanceMode
        ? SURVIVAL_BOTW_GRASS_BOOTSTRAP_MOBILE_RADIUS_SCALE
        : SURVIVAL_BOTW_GRASS_BOOTSTRAP_DESKTOP_RADIUS_SCALE
    ),
    maxInstances: targetCount,
    candidateCount: Math.round(targetCount * SURVIVAL_BOTW_GRASS_BOOTSTRAP_CANDIDATE_MULTIPLIER),
  };
  const candidateLimit = previewContext.candidateCount;
  const instances: SurvivalBotwGrassBladeInstance[] = [];

  for (let candidate = 0; candidate < candidateLimit && instances.length < targetCount; candidate += 1) {
    const instance = makeSurvivalBotwGrassBladeCandidate(previewContext, candidate);
    if (instance) instances.push(instance);
  }

  return instances;
}

export function makeSurvivalBotwFlowerCandidate(
  context: SurvivalBotwFlowerBuildContext,
  candidate: number,
): SurvivalBotwFlowerInstance | null {
  const radial = Math.sqrt((candidate + 0.5) / context.candidateCount);
  const angle = context.angleOffset + candidate * 2.399963229728653;
  const jitter = (survivalHash01(context.centerSeedX + candidate * 13, context.centerSeedZ - candidate * 19, 4900) - 0.5) * 2.2;
  const sampleX = context.centerX + Math.cos(angle) * (context.radius * radial + jitter);
  const sampleZ = context.centerZ + Math.sin(angle) * (context.radius * radial + jitter);
  const clusterSize = 82;
  const clusterCellX = Math.floor(sampleX / clusterSize);
  const clusterCellZ = Math.floor(sampleZ / clusterSize);
  const clusterWave =
    Math.sin(clusterCellX * 1.73 + clusterCellZ * 0.41) +
    Math.cos(clusterCellZ * 1.29 - clusterCellX * 0.37) * 0.62;
  const clusterMask = smoothstepRange(-0.34, 1.06, clusterWave);
  const clusterRoll = survivalHash01(clusterCellX, clusterCellZ, 5310);
  if (clusterRoll > lerpNumber(0.18, 0.42, clusterMask)) return null;

  const clusterCenterX = (clusterCellX + 0.5) * clusterSize +
    (survivalHash01(clusterCellX, clusterCellZ, 5320) - 0.5) * clusterSize * 0.48;
  const clusterCenterZ = (clusterCellZ + 0.5) * clusterSize +
    (survivalHash01(clusterCellX, clusterCellZ, 5330) - 0.5) * clusterSize * 0.48;
  const clusterAngle = survivalHash01(context.centerSeedX + candidate * 13, context.centerSeedZ - candidate * 19, 5340) * Math.PI * 2;
  const clusterRadius = lerpNumber(10, 22, survivalHash01(clusterCellX, clusterCellZ, 5350));
  const clusterDistance = Math.sqrt(survivalHash01(context.centerSeedX - candidate * 17, context.centerSeedZ + candidate * 23, 5360)) * clusterRadius;
  const clusteredX = clusterCenterX + Math.cos(clusterAngle) * clusterDistance;
  const clusteredZ = clusterCenterZ + Math.sin(clusterAngle) * clusterDistance;
  const clusterInfluence = lerpNumber(0.06, 0.2, clusterMask);
  const worldX = lerpNumber(sampleX, clusteredX, clusterInfluence);
  const worldZ = lerpNumber(sampleZ, clusteredZ, clusterInfluence);
  const distanceFromCenterX = worldX - context.centerX;
  const distanceFromCenterZ = worldZ - context.centerZ;
  const distanceFromCenterSq = distanceFromCenterX * distanceFromCenterX + distanceFromCenterZ * distanceFromCenterZ;
  if (distanceFromCenterSq > context.radius * context.radius) return null;
  if (shouldSkipSurvivalBotwGrassForTownRoute(worldX, worldZ)) return null;

  const placement = getSurvivalBotwGrassPlacementForBuild(worldX, worldZ, SURVIVAL_BOTW_GRASS_FLOWER_MIN_NORMAL_Y);
  if (!placement) return null;

  const footprintStats = getSurvivalBotwFlowerFootprintStatsForPlacement(worldX, worldZ, 0.36, placement);
  const flushFootprintLimit = Math.min(
    SURVIVAL_BOTW_FLOWER_FLUSH_FOOTPRINT_RANGE,
    getSurvivalBotwGrassFlushFootprintLimit(placement.normal.y, getSurvivalRestoredMeadowMask(worldX, worldZ)) * 0.7,
  );
  if (footprintStats.heightRange > flushFootprintLimit) return null;
  const hillsideMix = getSurvivalBotwHillsideVegetationMix(placement.terrainY, placement.normal.y, footprintStats.heightRange);
  const hillsideKeepRoll = survivalHash01(context.centerSeedX + candidate * 19, context.centerSeedZ - candidate * 29, 5382);
  if (hillsideKeepRoll > getSurvivalBotwHillsideKeepChance(hillsideMix, 0.42)) return null;
  const distanceFromCenter = Math.sqrt(distanceFromCenterSq);
  const patchWave =
    Math.sin(worldX * 0.041 + context.centerSeedX * 0.013) +
    Math.cos(worldZ * 0.049 - context.centerSeedZ * 0.019) * 0.52 +
    Math.sin((worldX - worldZ) * 0.027 + context.centerSeedZ * 0.017) * 0.34;
  const patchMask = smoothstepRange(0.18, 0.92, patchWave);
  const patchRoll = survivalHash01(context.centerSeedX - candidate * 23, context.centerSeedZ + candidate * 17, 4920);
  if (patchRoll > lerpNumber(0.62, 1, patchMask)) return null;
  const heightLimit = lerpNumber(
    SURVIVAL_BOTW_FLOWER_NEAR_HEIGHT_LIMIT,
    SURVIVAL_BOTW_FLOWER_FAR_HEIGHT_LIMIT,
    smoothstepRange(28, context.radius, distanceFromCenter),
  );
  if (footprintStats.baseY - context.centerY > heightLimit) return null;

  const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
  const biome = meadowMask > 0.08 && placement.biome !== "swamp"
    ? "tallgrass"
    : placement.biome;
  const palette = biome === "tallgrass"
    ? ["#7dd3fc", "#93e8ff", "#bae6fd", "#67e8f9", "#a5f3fc", "#fff176", "#fde047", "#fef08a", "#fff7b8", "#facc15", "#d9f99d", "#bbf7d0"]
    : biome === "swamp"
      ? ["#d9f99d", "#bbf7d0", "#99f6e4", "#ddd6fe", "#fef3c7", "#bae6fd"]
      : SURVIVAL_FLOWER_COLORS[biome];
  const variant = survivalHash01(context.centerSeedX + candidate * 29, context.centerSeedZ - candidate * 31, 4940);
  const typeRoll = survivalHash01(clusterCellX, clusterCellZ, 4980) * 0.48 +
    survivalHash01(context.centerSeedX - candidate * 37, context.centerSeedZ + candidate * 41, 4980) * 0.52;
  const bloomType: SurvivalBotwFlowerType = typeRoll > 0.76
    ? "puff"
    : typeRoll > 0.44
      ? "star"
      : typeRoll > 0.24
        ? "bell"
    : "round";
  const distanceFade = smoothstepRange(context.radius * 0.42, context.radius, distanceFromCenter);
  const bloomBase = (
    lerpNumber(0.72, 0.98, meadowMask) +
    survivalHash01(context.centerSeedX, context.centerSeedZ + candidate * 43, 5020) * 0.16
  ) * lerpNumber(0.92, 1.04, patchMask) * lerpNumber(1, 0.9, distanceFade) * lerpNumber(1, 0.74, hillsideMix);
  const widthRoll = survivalHash01(context.centerSeedX - candidate * 47, context.centerSeedZ, 5060);
  const heightRoll = survivalHash01(context.centerSeedX, context.centerSeedZ - candidate * 53, 5100);
  const sizeFamily = survivalHash01(context.centerSeedX + candidate * 7, context.centerSeedZ - candidate * 5, 5124);
  const bloomSize = bloomBase * (
    sizeFamily > 0.88
      ? 1.26
      : sizeFamily > 0.58
        ? 1.08
        : sizeFamily > 0.22
          ? 0.94
          : 0.8
  ) * (bloomType === "bell" ? 0.88 : bloomType === "puff" ? 1.04 : 1);
  const largeBloomScale = survivalHash01(clusterCellX, clusterCellZ, 5376) > 0.94 && clusterMask > 0.62
    ? lerpNumber(1.08, 1.18, survivalHash01(clusterCellX - candidate * 3, clusterCellZ + candidate * 5, 5396))
    : 1;
  const scaledBloomSize = bloomSize * largeBloomScale;
  const largeFlowerAmount = smoothstepRange(1, 1.18, largeBloomScale) * 0.28;
  const largeStemScale = lerpNumber(1, 1.08, largeFlowerAmount);
  const largeLeafScale = lerpNumber(1, 1.06, largeFlowerAmount);
  const color = survivalBotwFlowerColorScratch.set(palette[Math.floor((variant + typeRoll * 0.23) * palette.length) % palette.length]);
  color.lerp(SURVIVAL_BOTW_FLOWER_GLOW_COLOR, survivalHash01(context.centerSeedX - candidate * 11, context.centerSeedZ + candidate * 13, 5134) * 0.04);
  if (largeFlowerAmount > 0.001) {
    const largeColorRoll = survivalHash01(context.centerSeedX + candidate * 127, context.centerSeedZ - candidate * 131, 5408);
    const largeFlowerColor = survivalBotwFlowerLargeColorScratch.set(
      largeColorRoll > 0.78
        ? "#93e8ff"
        : largeColorRoll > 0.56
          ? "#fff7b8"
          : largeColorRoll > 0.34
            ? "#fef08a"
            : largeColorRoll > 0.16
              ? "#bbf7d0"
              : "#bae6fd",
    );
    color.lerp(largeFlowerColor, largeFlowerAmount * 0.5);
  }
  color.multiplyScalar(1.02 + survivalHash01(context.centerSeedX + candidate, context.centerSeedZ - candidate, 5140) * 0.08);
  color.r = clamp01(color.r);
  color.g = clamp01(color.g);
  color.b = clamp01(color.b);
  const leafColor = survivalBotwFlowerLeafColorScratch
    .copy(SURVIVAL_BOTW_FLOWER_LEAF_BASE_COLOR)
    .lerp(SURVIVAL_BOTW_FLOWER_LEAF_BRIGHT_COLOR, survivalHash01(context.centerSeedX - candidate * 103, context.centerSeedZ + candidate * 107, 5280));

  return {
    x: worldX,
    y: footprintStats.baseY + 0.018,
    z: worldZ,
    normalX: placement.normal.x,
    normalY: placement.normal.y,
    normalZ: placement.normal.z,
    yaw: survivalHash01(context.centerSeedX + candidate * 59, context.centerSeedZ - candidate * 61, 5180) * Math.PI * 2,
    stemHeight: (
      (lerpNumber(0.58, 0.96, variant) + meadowMask * 0.06) *
      lerpNumber(0.94, 1.04, patchMask) *
      lerpNumber(1, 0.94, distanceFade) *
      lerpNumber(1, 0.76, hillsideMix) *
      largeStemScale
    ) + largeFlowerAmount * 0.08,
    stemRadius: (0.032 + survivalHash01(context.centerSeedX - candidate * 67, context.centerSeedZ + candidate * 71, 5220) * 0.01) * lerpNumber(1, 1.18, largeFlowerAmount),
    leafCount: largeFlowerAmount > 0.001 ? (typeRoll > 0.42 ? 3 : 2) : variant > 0.24 ? (typeRoll > 0.62 ? 2 : 1) : 0,
    leafWidth: (0.08 + survivalHash01(context.centerSeedX + candidate * 73, context.centerSeedZ, 5232) * 0.06) * (bloomType === "bell" ? 1.12 : 1) * largeLeafScale,
    leafLength: (0.36 + survivalHash01(context.centerSeedX, context.centerSeedZ - candidate * 79, 5244) * 0.28) * largeLeafScale,
    leafHeight: 0.2 + survivalHash01(context.centerSeedX - candidate * 83, context.centerSeedZ + candidate * 89, 5256) * 0.32,
    leafYawOffset: survivalHash01(context.centerSeedX + candidate * 97, context.centerSeedZ - candidate * 101, 5268) * 0.72,
    leafColorR: leafColor.r,
    leafColorG: leafColor.g,
    leafColorB: leafColor.b,
    bloomSize: scaledBloomSize,
    bloomType,
    largeBloomAmount: largeFlowerAmount,
    bloomWidth: scaledBloomSize * lerpNumber(1, 1.22, largeFlowerAmount) * (
      bloomType === "star" ? lerpNumber(0.94, 1.22, widthRoll)
        : bloomType === "puff" ? lerpNumber(0.74, 1.0, widthRoll)
        : lerpNumber(0.76, 1.02, widthRoll)
    ),
    bloomHeight: scaledBloomSize * lerpNumber(1, 1.16, largeFlowerAmount) * (
      bloomType === "star" ? lerpNumber(0.92, 1.18, heightRoll)
        : bloomType === "puff" ? lerpNumber(0.8, 1.02, heightRoll)
        : lerpNumber(0.76, 1.0, heightRoll)
    ),
    colorR: color.r,
    colorG: color.g,
    colorB: color.b,
  };
}

function makeSurvivalBotwTallFeatureFlower(
  context: SurvivalBotwFlowerBuildContext,
  index: number,
): SurvivalBotwFlowerInstance | null {
  const featureCount = SURVIVAL_BOTW_GRASS_TALL_FLOWER_FEATURE_COUNT;
  const flowersPerCluster = 3;
  const clusterIndex = Math.floor(index / flowersPerCluster);
  const clusterMember = index % flowersPerCluster;
  const clusterCount = Math.ceil(featureCount / flowersPerCluster);
  const ringT = Math.sqrt((clusterIndex + 0.5) / clusterCount);
  const angle = context.angleOffset + clusterIndex * 2.399963229728653 +
    (survivalHash01(context.centerSeedX + clusterIndex * 17, context.centerSeedZ - clusterIndex * 19, 5418) - 0.5) * 0.34;
  const radius = lerpNumber(12, context.radius * 0.62, ringT) +
    (survivalHash01(context.centerSeedX - clusterIndex * 23, context.centerSeedZ + clusterIndex * 29, 5420) - 0.5) * 8;
  const clusterX = context.centerX + Math.cos(angle) * radius;
  const clusterZ = context.centerZ + Math.sin(angle) * radius;
  const memberAngle = angle + clusterMember * 2.399963229728653 +
    survivalHash01(context.centerSeedX + index * 13, context.centerSeedZ - index * 17, 5421) * 0.7;
  const memberRadius = Math.sqrt((clusterMember + 0.5) / flowersPerCluster) *
    lerpNumber(8.5, 16.5, survivalHash01(context.centerSeedX - clusterIndex * 31, context.centerSeedZ + clusterIndex * 37, 5422));
  const worldX = clusterX + Math.cos(memberAngle) * memberRadius;
  const worldZ = clusterZ + Math.sin(memberAngle) * memberRadius;
  if (shouldSkipSurvivalBotwGrassForTownRoute(worldX, worldZ)) return null;

  const placement = getSurvivalBotwGrassPlacementForBuild(worldX, worldZ, SURVIVAL_BOTW_GRASS_FLOWER_MIN_NORMAL_Y);
  if (!placement) return null;

  const footprintStats = getSurvivalBotwFlowerFootprintStatsForPlacement(worldX, worldZ, 0.38, placement);
  const flushFootprintLimit = Math.min(
    SURVIVAL_BOTW_FLOWER_FLUSH_FOOTPRINT_RANGE,
    getSurvivalBotwGrassFlushFootprintLimit(placement.normal.y, getSurvivalRestoredMeadowMask(worldX, worldZ)) * 0.72,
  );
  if (footprintStats.heightRange > flushFootprintLimit) return null;
  const hillsideMix = getSurvivalBotwHillsideVegetationMix(placement.terrainY, placement.normal.y, footprintStats.heightRange);
  if (hillsideMix > 0.38) return null;
  if (footprintStats.baseY - context.centerY > SURVIVAL_BOTW_FLOWER_NEAR_HEIGHT_LIMIT) return null;

  const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
  const variant = survivalHash01(context.centerSeedX + index * 31, context.centerSeedZ - index * 37, 5424);
  const colorRoll = survivalHash01(context.centerSeedX - index * 41, context.centerSeedZ + index * 43, 5428);
  const color = survivalBotwFlowerColorScratch.set(
    colorRoll > 0.8
      ? "#fff7b8"
      : colorRoll > 0.62
        ? "#fef08a"
        : colorRoll > 0.44
          ? "#93e8ff"
          : colorRoll > 0.28
            ? "#bae6fd"
            : colorRoll > 0.12
              ? "#bbf7d0"
              : "#f9a8d4",
  );
  color.lerp(SURVIVAL_BOTW_FLOWER_GLOW_COLOR, 0.05);
  const leafColor = survivalBotwFlowerLeafColorScratch
    .copy(SURVIVAL_BOTW_FLOWER_LEAF_BASE_COLOR)
    .lerp(SURVIVAL_BOTW_FLOWER_LEAF_TALL_COLOR, 0.42 + variant * 0.28);
  const typeRoll = survivalHash01(context.centerSeedX + index * 47, context.centerSeedZ - index * 53, 5432);
  const bloomType: SurvivalBotwFlowerType = typeRoll > 0.62
    ? "star"
    : typeRoll > 0.32
      ? "round"
      : "puff";
  const bloomSize = lerpNumber(0.86, 1.08, variant) * lerpNumber(0.94, 1.02, meadowMask);
  const stemHeight = lerpNumber(0.92, 1.16, variant) + meadowMask * 0.08;

  return {
    x: worldX,
    y: footprintStats.baseY + 0.024,
    z: worldZ,
    normalX: placement.normal.x,
    normalY: placement.normal.y,
    normalZ: placement.normal.z,
    yaw: angle + survivalHash01(context.centerSeedX + index * 59, context.centerSeedZ - index * 61, 5436) * Math.PI,
    stemHeight,
    stemRadius: 0.036 + variant * 0.009,
    leafCount: 3,
    leafWidth: 0.1 + variant * 0.05,
    leafLength: 0.42 + variant * 0.2,
    leafHeight: 0.22 + variant * 0.2,
    leafYawOffset: survivalHash01(context.centerSeedX - index * 67, context.centerSeedZ + index * 71, 5440) * 0.72,
    leafColorR: leafColor.r,
    leafColorG: leafColor.g,
    leafColorB: leafColor.b,
    bloomSize,
    bloomType,
    largeBloomAmount: 0.08,
    bloomWidth: bloomSize * (
      bloomType === "star" ? 1.22
        : bloomType === "puff" ? 1.0
        : 1.08
    ),
    bloomHeight: bloomSize * (
      bloomType === "star" ? 1.12
        : bloomType === "puff" ? 0.96
        : 1.02
    ),
    colorR: color.r,
    colorG: color.g,
    colorB: color.b,
  };
}

export function appendSurvivalBotwTallFeatureFlowers(
  flowers: SurvivalBotwFlowerInstance[],
  context: SurvivalBotwFlowerBuildContext,
) {
  for (let index = 0; index < SURVIVAL_BOTW_GRASS_TALL_FLOWER_FEATURE_COUNT; index += 1) {
    const flower = makeSurvivalBotwTallFeatureFlower(context, index);
    if (flower) flowers.push(flower);
  }
}
