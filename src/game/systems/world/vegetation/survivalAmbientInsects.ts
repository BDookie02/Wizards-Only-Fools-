import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { survivalHash01 } from "../survival/survivalMath";
import { SURVIVAL_BUTTERFLY_COLORS } from "./survivalFoliagePalettes";

export type SurvivalAmbientInsectKind = "butterfly" | "bee";

export type SurvivalAmbientInsect = {
  x: number;
  y: number;
  z: number;
  orbitRadius: number;
  height: number;
  speed: number;
  phase: number;
  size: number;
  color: string;
  wobble: number;
};

export type SurvivalAmbientInsectResolvers = {
  getTerrainHeightForChunk: (chunk: SurvivalChunkInfo, localX: number, localZ: number) => number;
  getWaterLevelAtWorld: (worldX: number, worldZ: number) => number;
};

export function makeSurvivalAmbientInsects(
  chunk: SurvivalChunkInfo,
  mobilePerformanceMode: boolean,
  kind: SurvivalAmbientInsectKind,
  {
    getTerrainHeightForChunk,
    getWaterLevelAtWorld,
  }: SurvivalAmbientInsectResolvers,
) {
  if (
    chunk.distance > 0 ||
    chunk.hasVillage
  ) return [];

  const biomeMultiplier = chunk.biome === "desert"
    ? 0.45
    : chunk.biome === "swamp"
      ? 0.72
      : chunk.biome === "tallgrass"
        ? 1.35
        : 1;
  const baseCount = kind === "butterfly"
    ? 8
    : 10;
  const targetCount = Math.max(0, Math.round(baseCount * biomeMultiplier * (mobilePerformanceMode ? 0.62 : 1)));
  const insects: SurvivalAmbientInsect[] = [];
  const palette = SURVIVAL_BUTTERFLY_COLORS[chunk.biome];
  const attempts = targetCount * 6;

  for (let index = 0; index < attempts && insects.length < targetCount; index += 1) {
    const localX = (survivalHash01(chunk.cx, chunk.cz, (kind === "butterfly" ? 7000 : 7400) + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.84;
    const localZ = (survivalHash01(chunk.cx, chunk.cz, (kind === "butterfly" ? 7100 : 7500) + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.84;
    const worldX = chunk.x + localX;
    const worldZ = chunk.z + localZ;
    const terrainY = getTerrainHeightForChunk(chunk, localX, localZ);
    const waterY = getWaterLevelAtWorld(worldX, worldZ);
    if (terrainY < waterY + 0.12) continue;

    const variant = survivalHash01(chunk.cx, chunk.cz, (kind === "butterfly" ? 7200 : 7600) + index);
    insects.push({
      x: localX,
      y: terrainY,
      z: localZ,
      orbitRadius: (kind === "butterfly" ? 2.6 : 1.8) + survivalHash01(chunk.cx, chunk.cz, 7300 + index) * (kind === "butterfly" ? 5.2 : 3.4),
      height: (kind === "butterfly" ? 1.6 : 1.0) + survivalHash01(chunk.cx, chunk.cz, 7350 + index) * (kind === "butterfly" ? 3.4 : 2.1),
      speed: (kind === "butterfly" ? 0.45 : 0.86) + survivalHash01(chunk.cx, chunk.cz, 7360 + index) * (kind === "butterfly" ? 0.54 : 0.92),
      phase: survivalHash01(chunk.cx, chunk.cz, 7370 + index) * Math.PI * 2,
      size: (kind === "butterfly" ? 1.05 : 0.58) + survivalHash01(chunk.cx, chunk.cz, 7380 + index) * (kind === "butterfly" ? 0.82 : 0.34),
      color: kind === "bee" ? "#facc15" : palette[Math.floor(variant * palette.length) % palette.length],
      wobble: survivalHash01(chunk.cx, chunk.cz, 7390 + index) * Math.PI * 2,
    });
  }

  return insects;
}
