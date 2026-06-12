import * as THREE from "three";
import { getSurvivalRestoredMeadowMask } from "../survival/survivalBiome";
import { clamp01, lerpNumber, survivalHash01 } from "../survival/survivalMath";
import {
  getSurvivalIntegratedGrassBladeColor,
  getSurvivalLocalGrassPlacement,
} from "./survivalDormantGrassSurface";
import {
  SURVIVAL_LOCAL_GRASS_CELL_AREA_SCALE,
  SURVIVAL_LOCAL_GRASS_CELL_SIZE,
  SURVIVAL_LOCAL_GRASS_DEFAULT_LIFT_COLOR,
  SURVIVAL_LOCAL_GRASS_DESERT_LIFT_COLOR,
  SURVIVAL_LOCAL_GRASS_MEADOW_LIFT_COLOR,
  SURVIVAL_LOCAL_GRASS_MEADOW_SHADOW_COLOR,
  SURVIVAL_LOCAL_GRASS_SHORT_TUFTS_PER_CELL,
  SURVIVAL_LOCAL_GRASS_SWAMP_LIFT_COLOR,
  SURVIVAL_LOCAL_GRASS_TALL_TUFTS_PER_CELL,
  type SurvivalLocalGrassCell,
} from "./survivalLocalGrassStreaming";

export type SurvivalLocalGrassBlade = {
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
  color: THREE.Color;
};

export function makeSurvivalLocalShortGrassBlades(
  cell: SurvivalLocalGrassCell,
  cellDensity: number,
  bladeStreamScale: number,
  mobilePerformanceMode: boolean,
) {
  if (bladeStreamScale <= 0 || cellDensity <= 0) return [];

  const targetCount = Math.round((
    mobilePerformanceMode
      ? SURVIVAL_LOCAL_GRASS_SHORT_TUFTS_PER_CELL * 0.44
      : SURVIVAL_LOCAL_GRASS_SHORT_TUFTS_PER_CELL
  ) * SURVIVAL_LOCAL_GRASS_CELL_AREA_SCALE * bladeStreamScale * cellDensity);
  const generated: SurvivalLocalGrassBlade[] = [];
  const gridSize = Math.max(2, Math.ceil(Math.sqrt(targetCount * 1.2)));
  const attempts = gridSize * gridSize;
  const sampleOffset = Math.floor(survivalHash01(cell.cellX, cell.cellZ, 17050) * attempts);

  for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
    const sampleIndex = (sampleOffset + index * 8191) % attempts;
    const col = sampleIndex % gridSize;
    const row = Math.floor(sampleIndex / gridSize);
    const jitterX = 0.08 + survivalHash01(cell.cellX + col, cell.cellZ - row, 17100 + index * 13) * 0.84;
    const jitterZ = 0.08 + survivalHash01(cell.cellX - row, cell.cellZ + col, 17200 + index * 17) * 0.84;
    const x = ((col + jitterX) / gridSize) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
    const z = ((row + jitterZ) / gridSize) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
    const worldX = cell.x + x;
    const worldZ = cell.z + z;
    const placement = getSurvivalLocalGrassPlacement(worldX, worldZ, 0.035, 0, 0.42);
    if (!placement) continue;

    const biome = placement.biome;
    if (biome === "desert" && survivalHash01(cell.cellX, cell.cellZ, 17300 + index) >= 0.97) continue;

    const shape = survivalHash01(cell.cellX, cell.cellZ, 17400 + index);
    const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
    const heightBase = biome === "tallgrass"
      ? lerpNumber(0.74, 0.98, meadowMask)
      : biome === "jungle"
        ? 0.92
        : biome === "swamp"
          ? 0.62
          : biome === "mushroom"
            ? 0.76
            : biome === "desert"
              ? 0.42
              : lerpNumber(0.62, 0.84, meadowMask);
    const heightRange = biome === "tallgrass"
      ? lerpNumber(0.14, 0.24, meadowMask)
      : biome === "jungle"
        ? 0.24
        : biome === "swamp"
          ? 0.14
          : biome === "mushroom"
            ? 0.16
            : biome === "desert"
              ? 0.1
              : lerpNumber(0.12, 0.2, meadowMask);
    const widthScale = biome === "tallgrass"
      ? lerpNumber(1.05, 1.28, meadowMask)
      : biome === "jungle"
        ? 0.96
        : biome === "desert"
          ? 0.56
          : lerpNumber(0.82, 1.04, meadowMask);
    const variant = survivalHash01(cell.cellX, cell.cellZ, 17500 + index);
    const color = getSurvivalIntegratedGrassBladeColor(
      biome,
      worldX,
      worldZ,
      placement.terrainY,
      variant,
      biome === "desert" ? 0.08 : 0.04,
    );
    const bladeLift = biome === "desert"
      ? SURVIVAL_LOCAL_GRASS_DESERT_LIFT_COLOR
      : biome === "swamp"
        ? SURVIVAL_LOCAL_GRASS_SWAMP_LIFT_COLOR
        : SURVIVAL_LOCAL_GRASS_DEFAULT_LIFT_COLOR;
    color.lerp(bladeLift, biome === "tallgrass" ? 0.1 : 0.08);
    if (meadowMask > 0.02 && biome !== "desert" && biome !== "swamp") {
      const bladeShade = survivalHash01(cell.cellX, cell.cellZ, 17750 + index);
      color.lerp(
        bladeShade < 0.38 ? SURVIVAL_LOCAL_GRASS_MEADOW_SHADOW_COLOR : SURVIVAL_LOCAL_GRASS_MEADOW_LIFT_COLOR,
        meadowMask * (bladeShade < 0.38 ? 0.08 : 0.3),
      );
    }
    color.multiplyScalar(biome === "desert" ? 1.02 : biome === "tallgrass" ? 1.2 : lerpNumber(1.08, 1.18, meadowMask));
    color.r = clamp01(color.r);
    color.g = clamp01(color.g);
    color.b = clamp01(color.b);

    generated.push({
      key: `${cell.key}-short-${index}`,
      x,
      y: placement.terrainY + 0.03,
      z,
      normalX: placement.normal.x,
      normalY: placement.normal.y,
      normalZ: placement.normal.z,
      yaw: survivalHash01(cell.cellX, cell.cellZ, 17600 + index) * Math.PI * 2,
      tilt: (survivalHash01(cell.cellX, cell.cellZ, 17700 + index) - 0.5) * (biome === "tallgrass" ? 0.34 : 0.28),
      width: (biome === "tallgrass" ? 0.72 + shape * 0.34 : 0.56 + shape * 0.22) * widthScale,
      height: (heightBase + shape * heightRange) * lerpNumber(0.97, 1.03, meadowMask),
      color,
    });
  }

  return generated;
}

export function makeSurvivalLocalTallGrassBlades(
  cell: SurvivalLocalGrassCell,
  cellDensity: number,
  bladeStreamScale: number,
  mobilePerformanceMode: boolean,
) {
  if (bladeStreamScale <= 0 || cellDensity <= 0) return [];

  const targetCount = Math.round((
    mobilePerformanceMode
      ? SURVIVAL_LOCAL_GRASS_TALL_TUFTS_PER_CELL * 0.42
      : SURVIVAL_LOCAL_GRASS_TALL_TUFTS_PER_CELL
  ) * SURVIVAL_LOCAL_GRASS_CELL_AREA_SCALE * bladeStreamScale * cellDensity);
  const generated: SurvivalLocalGrassBlade[] = [];
  const attempts = Math.max(1, targetCount * 4);

  for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
    const x = survivalHash01(cell.cellX, cell.cellZ, 16100 + index) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
    const z = survivalHash01(cell.cellX, cell.cellZ, 16200 + index) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
    const worldX = cell.x + x;
    const worldZ = cell.z + z;
    const placement = getSurvivalLocalGrassPlacement(worldX, worldZ, 0.06, 0.85, 0.72);
    if (!placement) continue;
    if (placement.biome === "desert" && survivalHash01(cell.cellX, cell.cellZ, 16250 + index) > 0.86) continue;

    const shape = survivalHash01(cell.cellX, cell.cellZ, 16300 + index);
    const variant = survivalHash01(cell.cellX, cell.cellZ, 16400 + index);
    const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
    const color = getSurvivalIntegratedGrassBladeColor(
      placement.biome,
      worldX,
      worldZ,
      placement.terrainY,
      variant,
      placement.biome === "desert" ? 0.1 : 0.08,
    );
    const bladeLift = placement.biome === "desert"
      ? SURVIVAL_LOCAL_GRASS_DESERT_LIFT_COLOR
      : placement.biome === "swamp"
        ? SURVIVAL_LOCAL_GRASS_SWAMP_LIFT_COLOR
        : SURVIVAL_LOCAL_GRASS_DEFAULT_LIFT_COLOR;
    color.lerp(bladeLift, placement.biome === "tallgrass" ? 0.14 : 0.1);
    if (meadowMask > 0.02 && placement.biome !== "desert" && placement.biome !== "swamp") {
      const bladeShade = survivalHash01(cell.cellX, cell.cellZ, 16450 + index);
      color.lerp(
        bladeShade < 0.42 ? SURVIVAL_LOCAL_GRASS_MEADOW_SHADOW_COLOR : SURVIVAL_LOCAL_GRASS_MEADOW_LIFT_COLOR,
        meadowMask * (bladeShade < 0.42 ? 0.16 : 0.18),
      );
    }
    color.multiplyScalar(placement.biome === "desert" ? 1.02 : placement.biome === "tallgrass" ? 1.12 : lerpNumber(1.04, 1.1, meadowMask));
    color.r = clamp01(color.r);
    color.g = clamp01(color.g);
    color.b = clamp01(color.b);

    const heightBase = placement.biome === "tallgrass"
      ? lerpNumber(0.86, 1.08, meadowMask)
      : placement.biome === "jungle"
        ? 1.06
        : placement.biome === "swamp"
          ? 0.76
          : placement.biome === "desert"
            ? 0.82
            : lerpNumber(0.82, 1.12, meadowMask);
    const heightRange = placement.biome === "tallgrass"
      ? lerpNumber(0.24, 0.36, meadowMask)
      : placement.biome === "jungle"
        ? 0.36
        : placement.biome === "swamp"
          ? 0.28
          : placement.biome === "desert"
            ? 0.36
            : lerpNumber(0.28, 0.44, meadowMask);
    const widthBase = placement.biome === "tallgrass" ? lerpNumber(0.18, 0.24, meadowMask) : placement.biome === "desert" ? 0.24 : lerpNumber(0.22, 0.28, meadowMask);
    const widthRange = placement.biome === "tallgrass" ? lerpNumber(0.22, 0.32, meadowMask) : placement.biome === "desert" ? 0.28 : lerpNumber(0.24, 0.34, meadowMask);

    generated.push({
      key: `${cell.key}-tall-${index}`,
      x,
      y: placement.terrainY + 0.03,
      z,
      normalX: placement.normal.x,
      normalY: placement.normal.y,
      normalZ: placement.normal.z,
      yaw: survivalHash01(cell.cellX, cell.cellZ, 16500 + index) * Math.PI * 2,
      tilt: (survivalHash01(cell.cellX, cell.cellZ, 16600 + index) - 0.5) * (placement.biome === "tallgrass" ? 0.56 : 0.42),
      width: widthBase + shape * widthRange,
      height: (heightBase + shape * heightRange) * lerpNumber(1.0, 1.08, meadowMask),
      color,
    });
  }

  return generated;
}
