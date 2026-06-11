import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import {
  BASE_VILLAGE_HALF_SIZE,
  type SurvivalChunkInfo,
} from "./survivalWorldConfig";
import { survivalHash01 } from "./survivalMath";

export type SurvivalWaterfallFeature = {
  key: string;
  x: number;
  z: number;
  y: number;
  height: number;
  width: number;
  yaw: number;
  poolX: number;
  poolZ: number;
  poolY: number;
  poolScale: number;
};

export type SurvivalWaterfallResolvers = {
  getTerrainHeightForChunk: (chunk: SurvivalChunkInfo, localX: number, localZ: number) => number;
  getWaterLevelAtWorld: (worldX: number, worldZ: number) => number;
  isRestoredMeadowWaterSuppressed: (worldX: number, worldZ: number, radius: number) => boolean;
};

export function makeSurvivalWaterfalls(
  chunk: SurvivalChunkInfo,
  {
    getTerrainHeightForChunk,
    getWaterLevelAtWorld,
    isRestoredMeadowWaterSuppressed,
  }: SurvivalWaterfallResolvers,
) {
  if (chunk.lod === "far" || chunk.biome === "desert" || chunk.biome === "swamp") return [];

  const desired = chunk.lod === "near" && (chunk.biome === "jungle" || survivalHash01(chunk.cx, chunk.cz, 188) > 0.72)
    ? 1
    : 0;
  const generated: SurvivalWaterfallFeature[] = [];
  const attempts = desired * 8;

  for (let index = 0; index < attempts && generated.length < desired; index += 1) {
    const localX = (survivalHash01(chunk.cx, chunk.cz, 1200 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.72;
    const localZ = (survivalHash01(chunk.cx, chunk.cz, 1240 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.72;
    if (chunk.hasVillage && Math.max(Math.abs(localX), Math.abs(localZ)) < BASE_VILLAGE_HALF_SIZE + 40) continue;

    const angle = survivalHash01(chunk.cx, chunk.cz, 1280 + index) * Math.PI * 2;
    const dropX = Math.cos(angle) * 42;
    const dropZ = Math.sin(angle) * 42;
    const topY = getTerrainHeightForChunk(chunk, localX, localZ) + 3.5;
    const bottomTerrainY = getTerrainHeightForChunk(chunk, localX + dropX, localZ + dropZ);
    const worldX = chunk.x + localX;
    const worldZ = chunk.z + localZ;
    const waterY = getWaterLevelAtWorld(worldX, worldZ);
    const bottomY = Math.max(waterY + 0.45, bottomTerrainY + 0.8);
    const drop = topY - bottomY;
    if (drop < 8 || drop > 34 || topY < waterY + 9) continue;

    const poolX = worldX + dropX * 0.72;
    const poolZ = worldZ + dropZ * 0.72;
    const poolScale = 9 + survivalHash01(chunk.cx, chunk.cz, 1360 + index) * 8;
    if (
      isRestoredMeadowWaterSuppressed(worldX, worldZ, 58) ||
      isRestoredMeadowWaterSuppressed(poolX, poolZ, poolScale * 1.5 + 18)
    ) continue;

    generated.push({
      key: `${chunk.key}-waterfall-${index}`,
      x: worldX + dropX * 0.34,
      z: worldZ + dropZ * 0.34,
      y: bottomY + drop * 0.5,
      height: Math.min(26, drop),
      width: 3.2 + survivalHash01(chunk.cx, chunk.cz, 1320 + index) * 4.8,
      yaw: angle,
      poolX,
      poolZ,
      poolY: bottomY + 0.08,
      poolScale,
    });
  }

  return generated;
}
