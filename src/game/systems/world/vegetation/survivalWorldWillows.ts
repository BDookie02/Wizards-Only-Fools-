import { SURVIVAL_BLOCK_SIZE, type SurvivalBiome } from "../../../../store/gameStore";
import { survivalHash01 } from "../survival/survivalMath";

export type SurvivalWorldWillow = {
  key: string;
  x: number;
  y: number;
  z: number;
  cx: number;
  cz: number;
  yaw: number;
  scale: number;
  biome: SurvivalBiome;
  variant: number;
};

export type SurvivalWorldWillowResolvers = {
  getChunkCoord: (worldCoordinate: number) => number;
  getBiome: (cx: number, cz: number) => SurvivalBiome;
  getRawTerrainHeightAtWorld: (worldX: number, worldZ: number) => number;
  getWaterLevelAtWorld: (worldX: number, worldZ: number) => number;
  hasVillage: (cx: number, cz: number) => boolean;
};

const SURVIVAL_WORLD_WILLOW_COUNT = 6;
let cachedSurvivalWorldWillows: SurvivalWorldWillow[] | null = null;

export function getSurvivalWorldWillows({
  getChunkCoord,
  getBiome,
  getRawTerrainHeightAtWorld,
  getWaterLevelAtWorld,
  hasVillage,
}: SurvivalWorldWillowResolvers) {
  if (cachedSurvivalWorldWillows) return cachedSurvivalWorldWillows;

  cachedSurvivalWorldWillows = [];
  for (let index = 0; index < SURVIVAL_WORLD_WILLOW_COUNT; index += 1) {
    let angle = (index / SURVIVAL_WORLD_WILLOW_COUNT) * Math.PI * 2 + (survivalHash01(index, 31, 9100) - 0.5) * 0.54;
    let radius = SURVIVAL_BLOCK_SIZE * (2.35 + survivalHash01(index, 32, 9101) * 5.15);
    let x = Math.cos(angle) * radius;
    let z = Math.sin(angle) * radius;
    let cx = getChunkCoord(x);
    let cz = getChunkCoord(z);

    for (let attempt = 0; attempt < 8 && hasVillage(cx, cz); attempt += 1) {
      angle += 0.34 + attempt * 0.08;
      radius = Math.min(SURVIVAL_BLOCK_SIZE * 7.8, radius + SURVIVAL_BLOCK_SIZE * 0.22);
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius;
      cx = getChunkCoord(x);
      cz = getChunkCoord(z);
    }

    const biome = getBiome(cx, cz);
    const waterY = getWaterLevelAtWorld(x, z);
    const y = Math.max(getRawTerrainHeightAtWorld(x, z), waterY + 1.4) + 0.1;

    cachedSurvivalWorldWillows.push({
      key: `world-willow-${index}`,
      x,
      y,
      z,
      cx,
      cz,
      yaw: angle + survivalHash01(index, 33, 9102) * Math.PI,
      scale: 1.18 + survivalHash01(index, 34, 9103) * 0.58,
      biome,
      variant: survivalHash01(index, 35, 9104),
    });
  }

  return cachedSurvivalWorldWillows;
}
