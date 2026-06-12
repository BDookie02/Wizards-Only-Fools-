import * as THREE from "three";
import { getSurvivalRestoredMeadowMask } from "../survival/survivalBiome";
import { clamp01, lerpNumber, smoothstepRange, survivalHash01 } from "../survival/survivalMath";
import {
  SURVIVAL_TUTORIAL_GRASS_AIR_RADIUS,
  SURVIVAL_TUTORIAL_GRASS_CELL_SIZE,
  SURVIVAL_TUTORIAL_GRASS_EDGE_FADE,
  SURVIVAL_TUTORIAL_GRASS_GROUND_RADIUS,
  type SurvivalTutorialGrassCell,
} from "./survivalTutorialGrassStreaming";
import {
  getSurvivalGrassBladeColor,
  getSurvivalLocalGrassPlacement,
} from "./survivalDormantGrassSurface";

export const SURVIVAL_TUTORIAL_GRASS_MEADOW_BASE_COLOR = new THREE.Color("#5ab93a");
export const SURVIVAL_TUTORIAL_GRASS_MEADOW_TIP_COLOR = new THREE.Color("#b9ec5a");

export type SurvivalTutorialGrassTuft = {
  x: number;
  y: number;
  z: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  yaw: number;
  width: number;
  height: number;
  color: THREE.Color;
};

export type SurvivalTutorialGrassTuftInstance = SurvivalTutorialGrassTuft & {
  worldX: number;
  worldZ: number;
};

export function makeSurvivalTutorialGrassTuftInstances(cell: SurvivalTutorialGrassCell): SurvivalTutorialGrassTuftInstance[] {
  const distanceFade = 1 - smoothstepRange(
    SURVIVAL_TUTORIAL_GRASS_GROUND_RADIUS,
    SURVIVAL_TUTORIAL_GRASS_AIR_RADIUS + SURVIVAL_TUTORIAL_GRASS_EDGE_FADE,
    cell.densityDistance,
  );
  const nearBoost = 1 - smoothstepRange(90, 205, cell.densityDistance);
  const targetCount = Math.round(
    (cell.lod === "near" ? 168 : 78) *
    (0.42 + distanceFade * 0.86 + nearBoost * 0.42),
  );
  if (targetCount <= 0) return [];

  const generated: SurvivalTutorialGrassTuftInstance[] = [];
  const gridSize = Math.max(2, Math.ceil(Math.sqrt(targetCount * 1.55)));
  const attempts = gridSize * gridSize;
  const sampleOffset = Math.floor(survivalHash01(cell.cellX, cell.cellZ, 36200) * attempts);
  const meadowTone = new THREE.Color();

  for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
    const sampleIndex = (sampleOffset + index * 1543) % attempts;
    const col = sampleIndex % gridSize;
    const row = Math.floor(sampleIndex / gridSize);
    const jitterX = 0.12 + survivalHash01(cell.cellX + col, cell.cellZ - row, 36240 + index) * 0.76;
    const jitterZ = 0.12 + survivalHash01(cell.cellX - row, cell.cellZ + col, 36280 + index) * 0.76;
    const x = ((col + jitterX) / gridSize) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
    const z = ((row + jitterZ) / gridSize) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
    const worldX = cell.x + x;
    const worldZ = cell.z + z;
    const placement = getSurvivalLocalGrassPlacement(worldX, worldZ, 0.035, cell.lod === "near" ? 0.2 : 0.36, 0.44);
    if (!placement) continue;

    const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
    const variant = survivalHash01(cell.cellX, cell.cellZ, 36320 + index);
    const color = getSurvivalGrassBladeColor(placement.biome, worldX, worldZ, placement.terrainY, variant);
    if (placement.biome !== "desert" && placement.biome !== "swamp") {
      meadowTone.copy(SURVIVAL_TUTORIAL_GRASS_MEADOW_BASE_COLOR).lerp(SURVIVAL_TUTORIAL_GRASS_MEADOW_TIP_COLOR, survivalHash01(cell.cellX, cell.cellZ, 36360 + index));
      color.lerp(meadowTone, 0.24 + meadowMask * 0.54);
    }
    color.multiplyScalar(placement.biome === "desert" ? 0.95 : lerpNumber(1.05, 1.18, meadowMask));
    color.r = clamp01(color.r);
    color.g = clamp01(color.g);
    color.b = clamp01(color.b);

    const shape = survivalHash01(cell.cellX, cell.cellZ, 36400 + index);
    const height = (cell.lod === "near"
      ? lerpNumber(0.52, 0.94, shape)
      : lerpNumber(0.36, 0.72, shape)) * lerpNumber(0.92, 1.08, meadowMask);
    const width = (cell.lod === "near"
      ? lerpNumber(0.7, 1.28, survivalHash01(cell.cellX, cell.cellZ, 36440 + index))
      : lerpNumber(1.05, 2.05, survivalHash01(cell.cellX, cell.cellZ, 36440 + index))) * lerpNumber(0.9, 1.04, meadowMask);

    generated.push({
      x,
      y: placement.terrainY + 0.035,
      z,
      worldX,
      worldZ,
      normalX: placement.normal.x,
      normalY: placement.normal.y,
      normalZ: placement.normal.z,
      yaw: survivalHash01(cell.cellX, cell.cellZ, 36480 + index) * Math.PI * 2,
      width,
      height,
      color,
    });
  }

  return generated;
}

export function makeSurvivalTutorialGrassFallbackTufts(cell: SurvivalTutorialGrassCell): SurvivalTutorialGrassTuft[] {
  const distanceFade = 1 - smoothstepRange(
    SURVIVAL_TUTORIAL_GRASS_GROUND_RADIUS,
    SURVIVAL_TUTORIAL_GRASS_AIR_RADIUS + SURVIVAL_TUTORIAL_GRASS_EDGE_FADE,
    cell.densityDistance,
  );
  const nearBoost = 1 - smoothstepRange(90, 205, cell.densityDistance);
  const cellMeadowMask = getSurvivalRestoredMeadowMask(
    cell.x + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
    cell.z + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
  );
  const restoredDensityBoost = lerpNumber(
    1,
    cell.lod === "near" ? 1.22 : 1.46,
    smoothstepRange(0.06, 0.36, cellMeadowMask),
  );
  const targetCount = Math.round(
    (cell.lod === "near" ? 740 : 500) *
    (0.46 + distanceFade * 0.9 + nearBoost * 0.54) *
    restoredDensityBoost,
  );
  if (targetCount <= 0) return [];

  const generated: SurvivalTutorialGrassTuft[] = [];
  const gridSize = Math.max(2, Math.ceil(Math.sqrt(targetCount * 1.55)));
  const attempts = gridSize * gridSize;
  const sampleOffset = Math.floor(survivalHash01(cell.cellX, cell.cellZ, 36200) * attempts);
  const meadowTone = new THREE.Color();

  for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
    const sampleIndex = (sampleOffset + index * 1543) % attempts;
    const col = sampleIndex % gridSize;
    const row = Math.floor(sampleIndex / gridSize);
    const jitterX = 0.12 + survivalHash01(cell.cellX + col, cell.cellZ - row, 36240 + index) * 0.76;
    const jitterZ = 0.12 + survivalHash01(cell.cellX - row, cell.cellZ + col, 36280 + index) * 0.76;
    const x = ((col + jitterX) / gridSize) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
    const z = ((row + jitterZ) / gridSize) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
    const worldX = cell.x + x;
    const worldZ = cell.z + z;
    const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
    const placement = getSurvivalLocalGrassPlacement(
      worldX,
      worldZ,
      0.035,
      lerpNumber(cell.lod === "near" ? 0.22 : 0.42, 0.045, meadowMask),
      lerpNumber(0.36, 0.28, meadowMask),
    );
    if (!placement) continue;

    const variant = survivalHash01(cell.cellX, cell.cellZ, 36320 + index);
    const color = getSurvivalGrassBladeColor(placement.biome, worldX, worldZ, placement.terrainY, variant);
    if (placement.biome !== "desert" && placement.biome !== "swamp") {
      meadowTone.copy(SURVIVAL_TUTORIAL_GRASS_MEADOW_BASE_COLOR).lerp(SURVIVAL_TUTORIAL_GRASS_MEADOW_TIP_COLOR, survivalHash01(cell.cellX, cell.cellZ, 36360 + index));
      color.lerp(meadowTone, 0.24 + meadowMask * 0.54);
    }
    color.multiplyScalar(placement.biome === "desert" ? 0.95 : lerpNumber(1.05, 1.18, meadowMask));
    color.r = clamp01(color.r);
    color.g = clamp01(color.g);
    color.b = clamp01(color.b);

    const shape = survivalHash01(cell.cellX, cell.cellZ, 36400 + index);
    const height = (cell.lod === "near"
      ? lerpNumber(0.5, 0.9, shape)
      : lerpNumber(0.46, 0.86, shape)) * lerpNumber(0.92, 1.12, meadowMask);
    const width = (cell.lod === "near"
      ? lerpNumber(0.92, 1.75, survivalHash01(cell.cellX, cell.cellZ, 36440 + index))
      : lerpNumber(1.55, 2.9, survivalHash01(cell.cellX, cell.cellZ, 36440 + index))) * lerpNumber(0.9, 1.16, meadowMask);

    generated.push({
      x,
      y: placement.terrainY + 0.035,
      z,
      normalX: placement.normal.x,
      normalY: placement.normal.y,
      normalZ: placement.normal.z,
      yaw: survivalHash01(cell.cellX, cell.cellZ, 36480 + index) * Math.PI * 2,
      width,
      height,
      color,
    });
  }

  return generated;
}
