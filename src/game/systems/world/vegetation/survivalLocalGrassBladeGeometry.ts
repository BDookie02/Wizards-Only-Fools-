import * as THREE from "three";
import { getSurvivalRestoredMeadowMask } from "../survival/survivalBiome";
import { lerpNumber, survivalHash01 } from "../survival/survivalMath";
import { clampDormantGrassColor } from "./survivalDormantGrassRuntime";
import {
  getSurvivalIntegratedGrassBladeColor,
  getSurvivalLocalGrassPlacement,
} from "./survivalDormantGrassSurface";
import {
  SURVIVAL_LOCAL_GRASS_CELL_AREA_SCALE,
  SURVIVAL_LOCAL_GRASS_CELL_SIZE,
  SURVIVAL_LOCAL_GRASS_MEADOW_LIFT_COLOR,
  SURVIVAL_LOCAL_GRASS_MEADOW_SHADOW_COLOR,
  SURVIVAL_LOCAL_GRASS_SOLID_BLADES_PER_CELL,
  type SurvivalLocalGrassCell,
} from "./survivalLocalGrassStreaming";

export function makeSurvivalLocalSolidGrassBladeGeometry(
  cell: SurvivalLocalGrassCell,
  cellDensity: number,
  streamScale: number,
  mobilePerformanceMode: boolean,
) {
  if (streamScale <= 0 || cellDensity <= 0) return null;

  const targetCount = Math.round(Math.min(
    mobilePerformanceMode ? 18000 : 64000,
    SURVIVAL_LOCAL_GRASS_SOLID_BLADES_PER_CELL * SURVIVAL_LOCAL_GRASS_CELL_AREA_SCALE * streamScale * cellDensity,
  ));
  if (targetCount <= 0) return null;

  const positions: number[] = [];
  const colors: number[] = [];
  const bladeWeights: number[] = [];
  const indices: number[] = [];
  const baseColor = new THREE.Color();
  const midColor = new THREE.Color();
  const tipColor = new THREE.Color();
  const normal = new THREE.Vector3();
  const side = new THREE.Vector3();
  const lean = new THREE.Vector3();
  const base = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const left = new THREE.Vector3();
  const right = new THREE.Vector3();
  const tip = new THREE.Vector3();
  const attempts = Math.ceil(targetCount * 1.55);

  const pushVertex = (point: THREE.Vector3, color: THREE.Color, weight: number) => {
    const vertexIndex = positions.length / 3;
    positions.push(point.x, point.y, point.z);
    colors.push(color.r, color.g, color.b);
    bladeWeights.push(weight);
    return vertexIndex;
  };

  let generated = 0;
  for (let index = 0; index < attempts && generated < targetCount; index += 1) {
    const x = survivalHash01(cell.cellX, cell.cellZ, 22100 + index * 17) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
    const z = survivalHash01(cell.cellX, cell.cellZ, 22200 + index * 19) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
    const worldX = cell.x + x;
    const worldZ = cell.z + z;
    const placement = getSurvivalLocalGrassPlacement(worldX, worldZ, 0.035, 0, 0.4);
    if (!placement) continue;
    if (placement.biome === "desert" && survivalHash01(cell.cellX, cell.cellZ, 22300 + index) > 0.88) continue;

    const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
    const shape = survivalHash01(cell.cellX, cell.cellZ, 22400 + index);
    const yaw = survivalHash01(cell.cellX, cell.cellZ, 22500 + index) * Math.PI * 2;
    const heightBase = placement.biome === "tallgrass"
      ? lerpNumber(0.88, 1.14, meadowMask)
      : placement.biome === "swamp"
        ? 0.56
        : placement.biome === "desert"
          ? 0.38
          : lerpNumber(0.58, 0.82, meadowMask);
    const height = heightBase + shape * lerpNumber(0.24, 0.42, meadowMask);
    const width = (0.16 + survivalHash01(cell.cellX, cell.cellZ, 22600 + index) * 0.2) * lerpNumber(1.08, 1.42, meadowMask);
    const leanAmount = (survivalHash01(cell.cellX, cell.cellZ, 22700 + index) - 0.5) * height * lerpNumber(0.22, 0.42, meadowMask);

    normal.set(placement.normal.x, placement.normal.y, placement.normal.z).normalize();
    side.set(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(width);
    lean.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(leanAmount);
    base.set(worldX, placement.terrainY + 0.035, worldZ).addScaledVector(normal, 0.035);
    mid.copy(base)
      .addScaledVector(normal, height * 0.54)
      .addScaledVector(lean, 0.42)
      .addScaledVector(side, (survivalHash01(cell.cellX, cell.cellZ, 22750 + index) - 0.5) * 0.45);
    tip.copy(base).addScaledVector(normal, height).add(lean);

    const variant = survivalHash01(cell.cellX, cell.cellZ, 22800 + index);
    baseColor.copy(getSurvivalIntegratedGrassBladeColor(
      placement.biome,
      worldX,
      worldZ,
      placement.terrainY,
      variant,
      placement.biome === "desert" ? 0.12 : 0.04,
    ));
    if (meadowMask > 0.02 && placement.biome !== "desert" && placement.biome !== "swamp") {
      const bladeShade = survivalHash01(cell.cellX, cell.cellZ, 22900 + index);
      baseColor.lerp(
        bladeShade < 0.42 ? SURVIVAL_LOCAL_GRASS_MEADOW_SHADOW_COLOR : SURVIVAL_LOCAL_GRASS_MEADOW_LIFT_COLOR,
        meadowMask * (bladeShade < 0.42 ? 0.16 : 0.24),
      );
    }
    const highlightRoll = survivalHash01(cell.cellX, cell.cellZ, 22950 + index);
    const meadowTipMix = highlightRoll > 0.86 ? lerpNumber(0.12, 0.22, meadowMask) : lerpNumber(0.02, 0.08, meadowMask);
    midColor.copy(baseColor).lerp(SURVIVAL_LOCAL_GRASS_MEADOW_LIFT_COLOR, placement.biome === "desert" ? 0.025 : meadowTipMix * 0.45);
    tipColor.copy(baseColor).lerp(SURVIVAL_LOCAL_GRASS_MEADOW_LIFT_COLOR, placement.biome === "desert" ? 0.04 : meadowTipMix);
    baseColor.multiplyScalar(placement.biome === "desert" ? 0.96 : 1.03);
    tipColor.multiplyScalar(placement.biome === "desert" ? 1.01 : lerpNumber(1.03, 1.1, meadowMask));
    clampDormantGrassColor(baseColor);
    clampDormantGrassColor(tipColor);

    left.copy(base).add(side);
    right.copy(base).addScaledVector(side, -1);
    const baseLeftIndex = pushVertex(left, baseColor, 0);
    const baseRightIndex = pushVertex(right, baseColor, 0);
    left.copy(mid).addScaledVector(side, 0.58);
    right.copy(mid).addScaledVector(side, -0.58);
    const midLeftIndex = pushVertex(left, midColor, 0.54);
    const midRightIndex = pushVertex(right, midColor, 0.54);
    left.copy(tip).addScaledVector(side, 0.08);
    right.copy(tip).addScaledVector(side, -0.08);
    const tipLeftIndex = pushVertex(left, tipColor, 1);
    const tipRightIndex = pushVertex(right, tipColor, 1);
    indices.push(
      baseLeftIndex, midLeftIndex, baseRightIndex,
      baseRightIndex, midLeftIndex, midRightIndex,
      midLeftIndex, tipLeftIndex, midRightIndex,
      midRightIndex, tipLeftIndex, tipRightIndex,
    );
    generated += 1;
  }

  if (positions.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("grassBladeWeight", new THREE.Float32BufferAttribute(bladeWeights, 1));
  geometry.setIndex(indices);
  return geometry;
}
