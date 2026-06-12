import { getSurvivalRestoredMeadowMask } from "../survival/survivalBiome";
import { lerpNumber, smoothstepRange, survivalHash01 } from "../survival/survivalMath";
import {
  SURVIVAL_TUTORIAL_GRASS_CELL_SIZE,
  type SurvivalTutorialGrassCell,
} from "./survivalTutorialGrassStreaming";
import { SURVIVAL_FLOWER_COLORS } from "./survivalFoliagePalettes";
import { getSurvivalLocalGrassPlacement } from "./survivalDormantGrassSurface";

export type SurvivalWildflower = {
  x: number;
  y: number;
  z: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  yaw: number;
  stemHeight: number;
  stemRadius: number;
  bloomSize: number;
  color: string;
  bloomType?: "star" | "round" | "bell" | "puff";
  bloomWidth?: number;
  bloomHeight?: number;
  centerSize?: number;
  centerColor?: string;
};

export type SurvivalTutorialGrassFlowerInstance = SurvivalWildflower & {
  worldX: number;
  worldZ: number;
};

export function makeSurvivalTutorialGrassFlowerInstances(
  cell: SurvivalTutorialGrassCell,
  mobilePerformanceMode: boolean,
): SurvivalTutorialGrassFlowerInstance[] {
  const flowerDensity = 1 - smoothstepRange(30, 132, cell.densityDistance);
  if (flowerDensity <= 0) return [];
  const targetCount = Math.round((
    cell.lod === "near"
      ? lerpNumber(7, 27, flowerDensity)
      : 0
  ) * (mobilePerformanceMode ? 0.42 : 1));
  if (targetCount <= 0) return [];

  const generated: SurvivalTutorialGrassFlowerInstance[] = [];
  const gridSize = Math.max(2, Math.ceil(Math.sqrt(targetCount * 2.15)));
  const attempts = gridSize * gridSize;
  const sampleOffset = Math.floor(survivalHash01(cell.cellX, cell.cellZ, 23300) * attempts);

  for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
    const sampleIndex = (sampleOffset + index * 1543) % attempts;
    const col = sampleIndex % gridSize;
    const row = Math.floor(sampleIndex / gridSize);
    const jitterX = 0.1 + survivalHash01(cell.cellX + col, cell.cellZ + row, 23340 + index) * 0.8;
    const jitterZ = 0.1 + survivalHash01(cell.cellX - row, cell.cellZ + col, 23380 + index) * 0.8;
    const x = ((col + jitterX) / gridSize) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
    const z = ((row + jitterZ) / gridSize) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
    const worldX = cell.x + x;
    const worldZ = cell.z + z;
    const placement = getSurvivalLocalGrassPlacement(worldX, worldZ, 0.035, 0, 0.46);
    if (!placement) continue;

    const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
    const biome = meadowMask > 0.08 && placement.biome !== "desert" && placement.biome !== "swamp"
      ? "tallgrass"
      : placement.biome;
    if (biome === "desert" && survivalHash01(cell.cellX, cell.cellZ, 23420 + index) < 0.42) continue;
    if (biome === "swamp" && survivalHash01(cell.cellX, cell.cellZ, 23440 + index) < 0.18) continue;

    const variant = survivalHash01(cell.cellX, cell.cellZ, 23480 + index);
    const palette = biome === "tallgrass"
      ? ["#fff9a6", "#fef08a", "#ffd23f", "#fb7185", "#ff4fa3", "#f472b6", "#a78bfa", "#c4b5fd", "#f0abfc", "#ffffff", "#fb923c"]
      : biome === "swamp"
        ? ["#d9f99d", "#86efac", "#5eead4", "#c084fc", "#fde047"]
        : biome === "desert"
          ? ["#fff1a8", "#fb923c", "#f97316", "#fb7185", "#fde68a"]
          : SURVIVAL_FLOWER_COLORS[biome];
    const clusterRoll = survivalHash01(cell.cellX, cell.cellZ, 23520 + index);
    const typeRoll = survivalHash01(cell.cellX, cell.cellZ, 23534 + index);
    const bloomType: NonNullable<SurvivalWildflower["bloomType"]> = typeRoll > 0.86
      ? "puff"
      : typeRoll > 0.62
        ? "star"
        : typeRoll > 0.5
          ? "bell"
          : "round";
    const heightBase = biome === "tallgrass"
      ? lerpNumber(0.86, 1.28, meadowMask)
      : biome === "desert"
        ? 0.56
        : biome === "swamp"
          ? 0.72
          : 0.76;
    const bloomBase = biome === "tallgrass"
      ? lerpNumber(0.24, 0.42, meadowMask)
      : biome === "mushroom"
        ? 0.38
        : 0.3;
    const bloomSize = (
      bloomBase +
      survivalHash01(cell.cellX, cell.cellZ, 23640 + index) * lerpNumber(0.05, 0.13, meadowMask)
    ) * (clusterRoll > 0.92 ? 1.08 : clusterRoll > 0.72 ? 1.03 : 1);
    const widthRoll = survivalHash01(cell.cellX, cell.cellZ, 23664 + index);
    const heightRoll = survivalHash01(cell.cellX, cell.cellZ, 23684 + index);

    generated.push({
      x,
      y: placement.terrainY + 0.055,
      z,
      worldX,
      worldZ,
      normalX: placement.normal.x,
      normalY: placement.normal.y,
      normalZ: placement.normal.z,
      yaw: survivalHash01(cell.cellX, cell.cellZ, 23560 + index) * Math.PI * 2,
      stemHeight: heightBase + variant * lerpNumber(0.14, 0.28, meadowMask),
      stemRadius: 0.02 + survivalHash01(cell.cellX, cell.cellZ, 23600 + index) * 0.014,
      bloomSize,
      bloomType,
      bloomWidth: bloomSize * (
        bloomType === "bell" ? lerpNumber(0.34, 0.5, widthRoll)
          : bloomType === "star" ? lerpNumber(0.72, 1.02, widthRoll)
            : bloomType === "puff" ? lerpNumber(0.48, 0.72, widthRoll)
              : lerpNumber(0.58, 0.84, widthRoll)
      ),
      bloomHeight: bloomSize * (
        bloomType === "bell" ? lerpNumber(0.84, 1.1, heightRoll)
          : bloomType === "star" ? lerpNumber(0.62, 0.84, heightRoll)
            : bloomType === "puff" ? lerpNumber(0.5, 0.72, heightRoll)
              : lerpNumber(0.45, 0.68, heightRoll)
      ),
      centerSize: bloomSize * (
        bloomType === "round" ? 0.12
          : bloomType === "star" ? 0.11
            : bloomType === "bell" ? 0.06
              : 0.08
      ),
      centerColor: variant > 0.66 ? "#fff7ad" : variant > 0.38 ? "#facc15" : "#f59e0b",
      color: palette[Math.floor((variant + typeRoll * 0.23) * palette.length) % palette.length],
    });
  }

  return generated;
}
