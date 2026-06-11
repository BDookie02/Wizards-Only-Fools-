import type { SurvivalBiome } from "../../../../store/gameStore";
import { getSurvivalRestoredMeadowMask } from "../survival/survivalBiome";
import { clamp01, lerpNumber, smoothstepRange } from "../survival/survivalMath";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import {
  SURVIVAL_BOTW_GRASS_FLAT_NORMAL_Y,
  SURVIVAL_BOTW_GRASS_FLUSH_FOOTPRINT_RANGE,
  SURVIVAL_BOTW_GRASS_SLOPE_FOOTPRINT_RANGE,
} from "./survivalBotwGrassConfig";
import { getSurvivalGrassSurfaceHeightAtWorld } from "./survivalBotwGrassResolvers";

export type SurvivalBotwGrassFootprintStats = {
  baseY: number;
  heightRange: number;
};

export type SurvivalBotwGrassFootprintPlacement = {
  chunk: SurvivalChunkInfo;
  terrainY: number;
  biome: SurvivalBiome;
  normal: { y: number };
};

export function getSurvivalBotwGrassFootprintStats(
  worldX: number,
  worldZ: number,
  radius: number,
): SurvivalBotwGrassFootprintStats {
  const sampleRadius = Math.max(0.16, radius);
  const diagonalRadius = sampleRadius * 0.72;
  const centerY = getSurvivalGrassSurfaceHeightAtWorld(worldX, worldZ);
  let minY = centerY;
  let maxY = centerY;

  let y = getSurvivalGrassSurfaceHeightAtWorld(worldX + sampleRadius, worldZ);
  minY = Math.min(minY, y);
  maxY = Math.max(maxY, y);
  y = getSurvivalGrassSurfaceHeightAtWorld(worldX - sampleRadius, worldZ);
  minY = Math.min(minY, y);
  maxY = Math.max(maxY, y);
  y = getSurvivalGrassSurfaceHeightAtWorld(worldX, worldZ + sampleRadius);
  minY = Math.min(minY, y);
  maxY = Math.max(maxY, y);
  y = getSurvivalGrassSurfaceHeightAtWorld(worldX, worldZ - sampleRadius);
  minY = Math.min(minY, y);
  maxY = Math.max(maxY, y);
  y = getSurvivalGrassSurfaceHeightAtWorld(worldX + diagonalRadius, worldZ + diagonalRadius);
  minY = Math.min(minY, y);
  maxY = Math.max(maxY, y);
  y = getSurvivalGrassSurfaceHeightAtWorld(worldX - diagonalRadius, worldZ + diagonalRadius);
  minY = Math.min(minY, y);
  maxY = Math.max(maxY, y);
  y = getSurvivalGrassSurfaceHeightAtWorld(worldX + diagonalRadius, worldZ - diagonalRadius);
  minY = Math.min(minY, y);
  maxY = Math.max(maxY, y);
  y = getSurvivalGrassSurfaceHeightAtWorld(worldX - diagonalRadius, worldZ - diagonalRadius);
  minY = Math.min(minY, y);
  maxY = Math.max(maxY, y);

  const heightRange = maxY - minY;
  const slopeTuck = smoothstepRange(0.08, 1.55, heightRange);

  return {
    baseY: lerpNumber(centerY + 0.004, minY - 0.08, slopeTuck),
    heightRange,
  };
}

export function getSurvivalBotwGrassFlushFootprintLimit(normalY: number, restoredMeadowMask: number) {
  const slopeT = smoothstepRange(0.08, 0.38, 1 - normalY);
  const meadowRelax = lerpNumber(1, 1.55, clamp01(restoredMeadowMask));
  return lerpNumber(
    SURVIVAL_BOTW_GRASS_FLUSH_FOOTPRINT_RANGE,
    SURVIVAL_BOTW_GRASS_SLOPE_FOOTPRINT_RANGE,
    slopeT,
  ) * meadowRelax;
}

export function getSurvivalBotwGrassFootprintStatsForPlacement(
  worldX: number,
  worldZ: number,
  radius: number,
  placement: SurvivalBotwGrassFootprintPlacement,
): SurvivalBotwGrassFootprintStats {
  const restoredMeadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
  if (restoredMeadowMask > 0.02 && placement.biome !== "swamp") {
    const renderedFootprintStats = getSurvivalBotwGrassFootprintStats(worldX, worldZ, radius);
    const slopeTuck = smoothstepRange(
      1 - SURVIVAL_BOTW_GRASS_FLAT_NORMAL_Y,
      0.055,
      1 - placement.normal.y,
    );
    const hillFootprintTuck = Math.max(
      slopeTuck,
      smoothstepRange(0.28, 2.2, renderedFootprintStats.heightRange),
    );
    return {
      baseY: Math.min(
        placement.terrainY + lerpNumber(0.004, -0.035, slopeTuck),
        renderedFootprintStats.baseY - hillFootprintTuck * 0.035,
      ),
      heightRange: Math.max(renderedFootprintStats.heightRange, hillFootprintTuck * 0.72),
    };
  }

  const nearLevelGrasslandSurface =
    placement.chunk.biome !== "desert" &&
    placement.biome !== "swamp" &&
    placement.normal.y > SURVIVAL_BOTW_GRASS_FLAT_NORMAL_Y;
  if ((restoredMeadowMask > 0.02 && placement.normal.y > SURVIVAL_BOTW_GRASS_FLAT_NORMAL_Y) || nearLevelGrasslandSurface) {
    return {
      baseY: placement.terrainY + 0.004,
      heightRange: 0,
    };
  }

  return getSurvivalBotwGrassFootprintStats(worldX, worldZ, radius);
}

export function getSurvivalBotwFlowerFootprintStatsForPlacement(
  worldX: number,
  worldZ: number,
  radius: number,
  placement: SurvivalBotwGrassFootprintPlacement,
): SurvivalBotwGrassFootprintStats {
  const restoredMeadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
  if (restoredMeadowMask > 0.02 && placement.biome !== "swamp") {
    const renderedFootprintStats = getSurvivalBotwGrassFootprintStats(worldX, worldZ, radius);
    const slopeTuck = smoothstepRange(
      1 - SURVIVAL_BOTW_GRASS_FLAT_NORMAL_Y,
      0.055,
      1 - placement.normal.y,
    );
    const hillFootprintTuck = Math.max(
      slopeTuck,
      smoothstepRange(0.24, 1.65, renderedFootprintStats.heightRange),
    );
    return {
      baseY: Math.min(
        placement.terrainY + lerpNumber(0.004, -0.026, slopeTuck),
        renderedFootprintStats.baseY - hillFootprintTuck * 0.02,
      ),
      heightRange: Math.max(renderedFootprintStats.heightRange, hillFootprintTuck * 0.62),
    };
  }

  const nearLevelGrasslandSurface =
    placement.chunk.biome !== "desert" &&
    placement.biome !== "swamp" &&
    placement.normal.y > SURVIVAL_BOTW_GRASS_FLAT_NORMAL_Y;
  if ((restoredMeadowMask > 0.02 && placement.normal.y > SURVIVAL_BOTW_GRASS_FLAT_NORMAL_Y) || nearLevelGrasslandSurface) {
    return {
      baseY: placement.terrainY + 0.004,
      heightRange: 0,
    };
  }

  return getSurvivalBotwGrassFootprintStats(worldX, worldZ, radius);
}
