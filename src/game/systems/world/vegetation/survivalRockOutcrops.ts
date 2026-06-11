import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import {
  BASE_VILLAGE_HALF_SIZE,
  type SurvivalChunkInfo,
} from "../survival/survivalWorldConfig";
import { survivalHash01 } from "../survival/survivalMath";

export type SurvivalRockOutcrop = {
  key: string;
  localX: number;
  localZ: number;
  y: number;
  scale: number;
  yaw: number;
  color: string;
  spire: boolean;
};

export type SurvivalRockSurfaceQuality = {
  y: number;
  heightRange: number;
  normal: { y: number };
};

export type SurvivalRockOutcropResolvers = {
  getSurfaceQuality: (
    chunk: SurvivalChunkInfo,
    localX: number,
    localZ: number,
    footprintRadius: number,
    sampleDistance: number,
  ) => SurvivalRockSurfaceQuality;
  getWaterLevelAtWorld: (worldX: number, worldZ: number) => number;
};

export function makeSurvivalRockOutcrops(
  chunk: SurvivalChunkInfo,
  {
    getSurfaceQuality,
    getWaterLevelAtWorld,
  }: SurvivalRockOutcropResolvers,
) {
  if (chunk.lod === "far") return [];
  if (chunk.biome === "desert") return [];

  const targetCount = chunk.lod === "near"
    ? chunk.biome === "jungle" ? 5 : 4
    : 1;
  const palette = chunk.biome === "swamp"
    ? ["#48513a", "#5c6549", "#343829"]
    : ["#777a62", "#8a866e", "#5e6652"];
  const generated: SurvivalRockOutcrop[] = [];
  const attempts = targetCount * 4;

  for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
    const localX = (survivalHash01(chunk.cx, chunk.cz, 910 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.86;
    const localZ = (survivalHash01(chunk.cx, chunk.cz, 960 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.86;
    if (chunk.hasVillage && Math.max(Math.abs(localX), Math.abs(localZ)) < BASE_VILLAGE_HALF_SIZE + 26) continue;

    const worldX = chunk.x + localX;
    const worldZ = chunk.z + localZ;
    const surfaceQuality = getSurfaceQuality(chunk, localX, localZ, 5.6, 4.8);
    if (surfaceQuality.normal.y < 0.62 || surfaceQuality.heightRange > 7.8) continue;
    const y = surfaceQuality.y;
    const waterY = getWaterLevelAtWorld(worldX, worldZ);
    if (y < waterY + 0.24) continue;

    const variant = survivalHash01(chunk.cx, chunk.cz, 990 + index);
    generated.push({
      key: `${chunk.key}-rock-${index}`,
      localX,
      localZ,
      y,
      scale: 1.8 + variant * 3.6,
      yaw: survivalHash01(chunk.cx, chunk.cz, 1020 + index) * Math.PI * 2,
      color: palette[Math.floor(variant * palette.length) % palette.length],
      spire: variant > 0.76,
    });
  }

  return generated;
}
