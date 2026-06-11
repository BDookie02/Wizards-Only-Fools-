import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import { getSurvivalPondCountForChunk } from "./survivalRivers";
import { getSurvivalWaterLevelAtWorld, isSurvivalRestoredMeadowWaterSuppressed } from "./survivalBiome";
import { survivalHash01 } from "./survivalMath";
import type { SurvivalChunkInfo } from "./survivalWorldConfig";

export type SurvivalPondFeature = {
  key: string;
  localX: number;
  localZ: number;
  radiusX: number;
  radiusZ: number;
  y: number;
};

export type SurvivalLilyPadFeature = {
  key: string;
  localX: number;
  localZ: number;
  scale: number;
};

export function makeSurvivalPonds(chunk: SurvivalChunkInfo): SurvivalPondFeature[] {
  const count = getSurvivalPondCountForChunk(chunk);
  if (count <= 0) return [];

  const ponds: SurvivalPondFeature[] = [];

  for (let index = 0; index < count; index += 1) {
    const localX = (survivalHash01(chunk.cx, chunk.cz, 160 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.62;
    const localZ = (survivalHash01(chunk.cx, chunk.cz, 180 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.62;
    const radiusX = 20 + survivalHash01(chunk.cx, chunk.cz, 210 + index) * (chunk.biome === "swamp" ? 42 : 24);
    const radiusZ = 16 + survivalHash01(chunk.cx, chunk.cz, 240 + index) * (chunk.biome === "swamp" ? 36 : 18);
    const y = getSurvivalWaterLevelAtWorld(chunk.x + localX, chunk.z + localZ) + 0.12;

    if (isSurvivalRestoredMeadowWaterSuppressed(
      chunk.x + localX,
      chunk.z + localZ,
      Math.max(radiusX, radiusZ) + 24,
    )) continue;

    ponds.push({ key: `${chunk.key}-pond-${index}`, localX, localZ, radiusX, radiusZ, y });
  }

  return ponds;
}

export function makeSurvivalLilyPads(chunk: SurvivalChunkInfo): SurvivalLilyPadFeature[] {
  if (chunk.biome !== "swamp" || chunk.lod === "far") return [];

  const count = chunk.lod === "near" ? 12 : 4;
  const lilyPads: SurvivalLilyPadFeature[] = [];

  for (let index = 0; index < count; index += 1) {
    const localX = (survivalHash01(chunk.cx, chunk.cz, 300 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.86;
    const localZ = (survivalHash01(chunk.cx, chunk.cz, 330 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.86;
    const scale = 2.4 + survivalHash01(chunk.cx, chunk.cz, 360 + index) * 3.2;

    lilyPads.push({ key: `${chunk.key}-lily-${index}`, localX, localZ, scale });
  }

  return lilyPads;
}
