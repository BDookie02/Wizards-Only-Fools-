import { getSurvivalRestoredMeadowMask } from "../survival/survivalBiome";
import { lerpNumber, survivalHash01 } from "../survival/survivalMath";
import { getSurvivalLocalGrassPlacement } from "./survivalDormantGrassSurface";
import { SURVIVAL_FLOWER_COLORS } from "./survivalFoliagePalettes";
import {
  SURVIVAL_LOCAL_GRASS_CELL_AREA_SCALE,
  SURVIVAL_LOCAL_GRASS_CELL_SIZE,
  SURVIVAL_LOCAL_GRASS_FLOWERS_PER_CELL,
  type SurvivalLocalGrassCell,
} from "./survivalLocalGrassStreaming";
import type { SurvivalWildflower } from "./survivalTutorialGrassFlowers";

export function makeSurvivalLocalGrassFlowerInstances(
  cell: SurvivalLocalGrassCell,
  cellDensity: number,
  flowerStreamScale: number,
  mobilePerformanceMode: boolean,
) {
  if (flowerStreamScale <= 0 || cellDensity <= 0) return [];

  const flowerDensity = Math.max(0.56, cellDensity);
  const targetCount = Math.round((
    mobilePerformanceMode
      ? SURVIVAL_LOCAL_GRASS_FLOWERS_PER_CELL * 0.22
      : SURVIVAL_LOCAL_GRASS_FLOWERS_PER_CELL
  ) * SURVIVAL_LOCAL_GRASS_CELL_AREA_SCALE * flowerStreamScale * flowerDensity);
  if (targetCount <= 0) return [];

  const generated: SurvivalWildflower[] = [];
  const gridSize = Math.max(2, Math.ceil(Math.sqrt(targetCount * 2.25)));
  const attempts = gridSize * gridSize;
  const sampleOffset = Math.floor(survivalHash01(cell.cellX, cell.cellZ, 23300) * attempts);

  for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
    const sampleIndex = (sampleOffset + index * 1543) % attempts;
    const col = sampleIndex % gridSize;
    const row = Math.floor(sampleIndex / gridSize);
    const jitterX = 0.1 + survivalHash01(cell.cellX + col, cell.cellZ + row, 23340 + index) * 0.8;
    const jitterZ = 0.1 + survivalHash01(cell.cellX - row, cell.cellZ + col, 23380 + index) * 0.8;
    const x = ((col + jitterX) / gridSize) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
    const z = ((row + jitterZ) / gridSize) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
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
      ? lerpNumber(0.56, 0.92, meadowMask)
      : biome === "desert"
        ? 0.42
        : biome === "swamp"
          ? 0.5
          : 0.56;
    const bloomBase = biome === "tallgrass"
      ? lerpNumber(0.3, 0.56, meadowMask)
      : biome === "mushroom"
        ? 0.46
        : 0.34;
    const bloomSize = (
      bloomBase +
      survivalHash01(cell.cellX, cell.cellZ, 23640 + index) * lerpNumber(0.08, 0.24, meadowMask)
    ) * (clusterRoll > 0.92 ? 1.18 : clusterRoll > 0.72 ? 1.08 : 1);
    const widthRoll = survivalHash01(cell.cellX, cell.cellZ, 23664 + index);
    const heightRoll = survivalHash01(cell.cellX, cell.cellZ, 23684 + index);

    generated.push({
      x,
      y: placement.terrainY + 0.055,
      z,
      normalX: placement.normal.x,
      normalY: placement.normal.y,
      normalZ: placement.normal.z,
      yaw: survivalHash01(cell.cellX, cell.cellZ, 23560 + index) * Math.PI * 2,
      stemHeight: heightBase + variant * lerpNumber(0.22, 0.42, meadowMask),
      stemRadius: 0.02 + survivalHash01(cell.cellX, cell.cellZ, 23600 + index) * 0.014,
      bloomSize,
      bloomType,
      bloomWidth: bloomSize * (
        bloomType === "bell" ? lerpNumber(0.44, 0.66, widthRoll)
          : bloomType === "star" ? lerpNumber(0.98, 1.34, widthRoll)
            : bloomType === "puff" ? lerpNumber(0.78, 1.08, widthRoll)
              : lerpNumber(0.9, 1.24, widthRoll)
      ),
      bloomHeight: bloomSize * (
        bloomType === "bell" ? lerpNumber(1.08, 1.42, heightRoll)
          : bloomType === "star" ? lerpNumber(0.88, 1.18, heightRoll)
            : bloomType === "puff" ? lerpNumber(0.76, 1.12, heightRoll)
              : lerpNumber(0.64, 0.98, heightRoll)
      ),
      centerSize: bloomSize * (
        bloomType === "round" ? 0.18
          : bloomType === "star" ? 0.16
            : bloomType === "bell" ? 0.08
              : 0.11
      ),
      centerColor: variant > 0.66 ? "#fff7ad" : variant > 0.38 ? "#facc15" : "#f59e0b",
      color: palette[Math.floor((variant + typeRoll * 0.23) * palette.length) % palette.length],
    });
  }

  return generated;
}
