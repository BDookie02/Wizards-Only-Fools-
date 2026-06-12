import * as THREE from "three";
import { getSurvivalRestoredMeadowMask } from "../survival/survivalBiome";
import { clamp01, lerpNumber, survivalHash01 } from "../survival/survivalMath";
import {
  getSurvivalGrassBladeColor,
  getSurvivalLocalGrassPlacement,
  getSurvivalSmoothedTerrainColor,
} from "./survivalDormantGrassSurface";
import {
  SURVIVAL_LOCAL_GRASS_CELL_AREA_SCALE,
  SURVIVAL_LOCAL_GRASS_CELL_SIZE,
  SURVIVAL_LOCAL_GRASS_DEFAULT_LIFT_COLOR,
  SURVIVAL_LOCAL_GRASS_DESERT_LIFT_COLOR,
  SURVIVAL_LOCAL_GRASS_GROUND_PATCHES_PER_CELL,
  SURVIVAL_LOCAL_GRASS_MEADOW_LIFT_COLOR,
  SURVIVAL_LOCAL_GRASS_SWAMP_LIFT_COLOR,
  type SurvivalLocalGrassCell,
} from "./survivalLocalGrassStreaming";

const SURVIVAL_LOCAL_GRASS_GROUND_PATCH_MEADOW_BASE_COLOR = new THREE.Color("#3f9c2e");

export type SurvivalGroundGrassPatch = {
  x: number;
  y: number;
  z: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  yaw: number;
  width: number;
  depth: number;
  color: THREE.Color;
};

export function makeSurvivalLocalGroundGrassPatches(
  cell: SurvivalLocalGrassCell,
  cellDensity: number,
  coverStreamScale: number,
  mobilePerformanceMode: boolean,
) {
  if (coverStreamScale <= 0 || cellDensity <= 0) return [];

  const targetCount = Math.round((
    mobilePerformanceMode
      ? SURVIVAL_LOCAL_GRASS_GROUND_PATCHES_PER_CELL * 0.46
      : SURVIVAL_LOCAL_GRASS_GROUND_PATCHES_PER_CELL
  ) * SURVIVAL_LOCAL_GRASS_CELL_AREA_SCALE * coverStreamScale * cellDensity);
  const generated: SurvivalGroundGrassPatch[] = [];
  const gridSize = Math.max(2, Math.ceil(Math.sqrt(targetCount * 1.45)));
  const attempts = gridSize * gridSize;
  const sampleOffset = Math.floor(survivalHash01(cell.cellX, cell.cellZ, 18050) * attempts);
  const meadowPatchTone = new THREE.Color();
  const patchColor = new THREE.Color();

  for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
    const sampleIndex = (sampleOffset + index * 8191) % attempts;
    const col = sampleIndex % gridSize;
    const row = Math.floor(sampleIndex / gridSize);
    const jitterX = 0.12 + survivalHash01(cell.cellX + col, cell.cellZ + row, 18200 + index) * 0.76;
    const jitterZ = 0.12 + survivalHash01(cell.cellX - row, cell.cellZ + col, 18300 + index) * 0.76;
    const x = ((col + jitterX) / gridSize) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
    const z = ((row + jitterZ) / gridSize) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
    const worldX = cell.x + x;
    const worldZ = cell.z + z;
    const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
    const width = lerpNumber(11.6, 10.2, meadowMask) + survivalHash01(cell.cellX, cell.cellZ, 18700 + index) * lerpNumber(9.6, 8.2, meadowMask);
    const depth = lerpNumber(10.8, 9.6, meadowMask) + survivalHash01(cell.cellX, cell.cellZ, 18800 + index) * lerpNumber(8.8, 7.6, meadowMask);
    const placement = getSurvivalLocalGrassPlacement(worldX, worldZ, 0.02, 0.8, 0.58);
    if (!placement) continue;
    if (placement.biome === "desert" && survivalHash01(cell.cellX, cell.cellZ, 18400 + index) > 0.9) continue;

    const variant = survivalHash01(cell.cellX, cell.cellZ, 18500 + index);
    const terrainColor = getSurvivalSmoothedTerrainColor(worldX, worldZ, placement.terrainY);
    const grassColor = getSurvivalGrassBladeColor(placement.biome, worldX, worldZ, placement.terrainY, variant);
    const coverLift = placement.biome === "desert"
      ? SURVIVAL_LOCAL_GRASS_DESERT_LIFT_COLOR
      : placement.biome === "swamp"
        ? SURVIVAL_LOCAL_GRASS_SWAMP_LIFT_COLOR
        : SURVIVAL_LOCAL_GRASS_DEFAULT_LIFT_COLOR;
    const slopeTerrainBlend = (1 - clamp01((placement.normal.y - 0.58) / 0.32)) * 0.34;
    const color = patchColor
      .copy(terrainColor)
      .lerp(grassColor, placement.biome === "desert" ? 0.28 : 0.58)
      .lerp(coverLift, placement.biome === "desert" ? 0.04 : 0.08)
      .lerp(terrainColor, slopeTerrainBlend);
    if (meadowMask > 0.04 && placement.biome !== "desert" && placement.biome !== "swamp") {
      meadowPatchTone
        .copy(SURVIVAL_LOCAL_GRASS_GROUND_PATCH_MEADOW_BASE_COLOR)
        .lerp(SURVIVAL_LOCAL_GRASS_MEADOW_LIFT_COLOR, 0.36 + variant * 0.46);
      meadowPatchTone.multiplyScalar(0.92 + variant * 0.2);
      color.lerp(meadowPatchTone, meadowMask);
    }
    color.multiplyScalar(placement.biome === "desert" ? 1.0 : lerpNumber(1.03, 1.18, meadowMask));
    color.r = clamp01(color.r);
    color.g = clamp01(color.g);
    color.b = clamp01(color.b);
    generated.push({
      x,
      y: placement.terrainY + 0.11,
      z,
      normalX: placement.normal.x,
      normalY: placement.normal.y,
      normalZ: placement.normal.z,
      yaw: survivalHash01(cell.cellX, cell.cellZ, 18600 + index) * Math.PI * 2,
      width,
      depth,
      color,
    });
  }

  return generated;
}
