import * as THREE from "three";
import { getSurvivalRestoredMeadowMask } from "../survival/survivalBiome";
import { lerpNumber, smoothstepRange, survivalHash01 } from "../survival/survivalMath";
import {
  SURVIVAL_TUTORIAL_GRASS_CELL_SIZE,
  SURVIVAL_TUTORIAL_GRASS_MID_STRAND_DISTANCE,
  SURVIVAL_TUTORIAL_GRASS_STRAND_DISTANCE,
  type SurvivalTutorialGrassCell,
} from "./survivalTutorialGrassStreaming";
import {
  getSurvivalGrassBladeColor,
  getSurvivalLocalGrassPlacement,
} from "./survivalDormantGrassSurface";

const SURVIVAL_TUTORIAL_GRASS_STRAND_MEADOW_BASE_COLOR = new THREE.Color("#479c31");
const SURVIVAL_TUTORIAL_GRASS_STRAND_MEADOW_TIP_COLOR = new THREE.Color("#84cf42");
const SURVIVAL_TUTORIAL_GRASS_STRAND_MEADOW_SHADOW_TIP_COLOR = new THREE.Color("#56aa34");

export function makeSurvivalTutorialGrassStrandGeometry(cell: SurvivalTutorialGrassCell) {
  const cellMeadowMask = getSurvivalRestoredMeadowMask(
    cell.x + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
    cell.z + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
  );
  const meadowBoost = smoothstepRange(0.05, 0.36, cellMeadowMask);
  const effectiveDensityDistance = cell.densityDistance * lerpNumber(1, 0.7, meadowBoost);
  const strandDensity = cell.lod === "near"
    ? 1 - smoothstepRange(20, SURVIVAL_TUTORIAL_GRASS_STRAND_DISTANCE, effectiveDensityDistance)
    : 1 - smoothstepRange(118, SURVIVAL_TUTORIAL_GRASS_MID_STRAND_DISTANCE, effectiveDensityDistance);
  if (strandDensity <= 0) return null;
  const targetCount = Math.round(
    (cell.lod === "near"
      ? lerpNumber(520, 1360, strandDensity)
      : lerpNumber(160, 640, strandDensity)) *
    lerpNumber(1, 1.18, meadowBoost),
  );
  const gridSize = Math.max(2, Math.ceil(Math.sqrt(targetCount * 1.04)));
  const attempts = gridSize * gridSize;
  const sampleOffset = Math.floor(survivalHash01(cell.cellX, cell.cellZ, 36520) * attempts);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const baseColor = new THREE.Color();
  const midColor = new THREE.Color();
  const tipColor = new THREE.Color();

  for (let index = 0; index < attempts && indices.length / 9 < targetCount; index += 1) {
    const sampleIndex = (sampleOffset + index * 2039) % attempts;
    const col = sampleIndex % gridSize;
    const row = Math.floor(sampleIndex / gridSize);
    const jitterX = 0.08 + survivalHash01(cell.cellX + col, cell.cellZ - row, 36560 + index) * 0.84;
    const jitterZ = 0.08 + survivalHash01(cell.cellX - row, cell.cellZ + col, 36600 + index) * 0.84;
    const x = ((col + jitterX) / gridSize) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
    const z = ((row + jitterZ) / gridSize) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
    const worldX = cell.x + x;
    const worldZ = cell.z + z;
    const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
    const placement = getSurvivalLocalGrassPlacement(
      worldX,
      worldZ,
      0.018,
      lerpNumber(cell.lod === "near" ? 0.12 : 0.2, 0.024, meadowMask),
      lerpNumber(0.5, 0.32, meadowMask),
    );
    if (!placement) continue;

    const terrainY = placement.terrainY;
    const biome = placement.biome;
    const variant = survivalHash01(cell.cellX, cell.cellZ, 36640 + index);
    const height = (
      cell.lod === "near"
        ? lerpNumber(0.34, 0.68, survivalHash01(cell.cellX, cell.cellZ, 36680 + index))
        : lerpNumber(0.32, 0.58, survivalHash01(cell.cellX, cell.cellZ, 36680 + index))
    ) *
      lerpNumber(0.94, 1.08, meadowMask);
    const leanAngle = survivalHash01(cell.cellX, cell.cellZ, 36720 + index) * Math.PI * 2;
    const lean = lerpNumber(0.06, 0.26, survivalHash01(cell.cellX, cell.cellZ, 36760 + index));
    const baseY = terrainY + 0.05;
    const tipX = worldX + Math.cos(leanAngle) * lean;
    const tipZ = worldZ + Math.sin(leanAngle) * lean;
    const tipY = baseY + height;
    const sideX = Math.cos(leanAngle + Math.PI * 0.5);
    const sideZ = Math.sin(leanAngle + Math.PI * 0.5);
    const width = cell.lod === "near"
      ? lerpNumber(0.025, 0.075, survivalHash01(cell.cellX, cell.cellZ, 36780 + index))
      : lerpNumber(0.024, 0.058, survivalHash01(cell.cellX, cell.cellZ, 36780 + index));
    const midX = lerpNumber(worldX, tipX, 0.58) + sideX * (survivalHash01(cell.cellX, cell.cellZ, 36790 + index) - 0.5) * 0.058;
    const midY = lerpNumber(baseY, tipY, 0.62);
    const midZ = lerpNumber(worldZ, tipZ, 0.58) + sideZ * (survivalHash01(cell.cellX, cell.cellZ, 36795 + index) - 0.5) * 0.058;
    const shade = survivalHash01(cell.cellX, cell.cellZ, 36800 + index);

    baseColor.copy(getSurvivalGrassBladeColor(biome, worldX, worldZ, terrainY, variant));
    if (biome !== "desert" && biome !== "swamp") {
      baseColor.lerp(SURVIVAL_TUTORIAL_GRASS_STRAND_MEADOW_BASE_COLOR, 0.5 + meadowMask * 0.32);
    }
    tipColor.copy(shade > 0.58
      ? SURVIVAL_TUTORIAL_GRASS_STRAND_MEADOW_TIP_COLOR
      : SURVIVAL_TUTORIAL_GRASS_STRAND_MEADOW_SHADOW_TIP_COLOR);
    tipColor.lerp(baseColor, shade > 0.58 ? 0.52 : 0.64);
    midColor.copy(baseColor).lerp(tipColor, 0.46);

    const vertexBase = positions.length / 3;
    positions.push(
      worldX - sideX * width, baseY, worldZ - sideZ * width,
      worldX + sideX * width, baseY, worldZ + sideZ * width,
      midX - sideX * width * 0.42, midY, midZ - sideZ * width * 0.42,
      midX + sideX * width * 0.42, midY, midZ + sideZ * width * 0.42,
      tipX, tipY, tipZ,
    );
    colors.push(
      baseColor.r * 0.84,
      baseColor.g * 0.84,
      baseColor.b * 0.84,
      baseColor.r * 0.84,
      baseColor.g * 0.84,
      baseColor.b * 0.84,
      midColor.r,
      midColor.g,
      midColor.b,
      midColor.r,
      midColor.g,
      midColor.b,
      tipColor.r,
      tipColor.g,
      tipColor.b,
    );
    indices.push(
      vertexBase, vertexBase + 2, vertexBase + 1,
      vertexBase + 1, vertexBase + 2, vertexBase + 3,
      vertexBase + 2, vertexBase + 4, vertexBase + 3,
    );
  }

  if (indices.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
