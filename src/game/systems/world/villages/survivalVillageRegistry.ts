import {
  DARREL_QUEST_CHUNK,
  LILY_COIL_QUEST_CHUNK,
  SURVIVAL_BLOCK_SIZE,
  type SurvivalBiome,
} from "../../../../store/gameStore";
import { SURVIVAL_NEAR_RADIUS, type SurvivalVillageKind } from "../survival/survivalWorldConfig";

export const SURVIVAL_DARREL_GROVE_HALF_SIZE = SURVIVAL_BLOCK_SIZE / 2;
export const SURVIVAL_GRAVEYARD_PAD_FLAT_RADIUS = 246;
export const SURVIVAL_MOUNTAIN_VILLAGE_RADIUS = SURVIVAL_BLOCK_SIZE * 0.49;

export const SPECIAL_SURVIVAL_VILLAGE_CHUNKS: Array<{ cx: number; cz: number; kind: SurvivalVillageKind }> = [
  // Keep survival landmarks unique: one authored chunk for each village type.
  { cx: -3, cz: -3, kind: "chicago" },
  { cx: 4, cz: -4, kind: "desert" },
  { cx: 0, cz: -3, kind: "swamp" },
  { cx: 3, cz: 0, kind: "mountain" },
  { cx: 5, cz: 2, kind: "graveyard" },
  { cx: DARREL_QUEST_CHUNK.cx, cz: DARREL_QUEST_CHUNK.cz, kind: "darrel-grove" },
  { cx: LILY_COIL_QUEST_CHUNK.cx, cz: LILY_COIL_QUEST_CHUNK.cz, kind: "lily-coil" },
];

export function getSpecialSurvivalVillageKind(cx: number, cz: number): SurvivalVillageKind | null {
  for (let index = 0; index < SPECIAL_SURVIVAL_VILLAGE_CHUNKS.length; index += 1) {
    const village = SPECIAL_SURVIVAL_VILLAGE_CHUNKS[index];
    if (village.cx === cx && village.cz === cz) return village.kind;
  }
  return null;
}

export function isLilyCoilQuestChunk(cx: number, cz: number) {
  return cx === LILY_COIL_QUEST_CHUNK.cx && cz === LILY_COIL_QUEST_CHUNK.cz;
}

export function isLilyCoilRealmCenter(centerCx: number, centerCz: number) {
  return Math.max(
    Math.abs(centerCx - LILY_COIL_QUEST_CHUNK.cx),
    Math.abs(centerCz - LILY_COIL_QUEST_CHUNK.cz),
  ) <= SURVIVAL_NEAR_RADIUS;
}

export function hasSurvivalVillage(cx: number, cz: number) {
  return getSpecialSurvivalVillageKind(cx, cz) !== null;
}

export function isChicagoChunk(cx: number, cz: number) {
  return getSpecialSurvivalVillageKind(cx, cz) === "chicago";
}

export function isGraveyardChunk(cx: number, cz: number) {
  return getSpecialSurvivalVillageKind(cx, cz) === "graveyard";
}

export function getSurvivalVillageKindForChunk(_biome: SurvivalBiome, cx: number, cz: number): SurvivalVillageKind | null {
  const specialVillageKind = getSpecialSurvivalVillageKind(cx, cz);
  if (specialVillageKind) return specialVillageKind;
  return null;
}
