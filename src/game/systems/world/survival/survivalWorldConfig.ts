import { SURVIVAL_BLOCK_SIZE, type SurvivalBiome } from "../../../../store/gameStore";

export type SurvivalVillageKind = "desert" | "swamp" | "chicago" | "mountain" | "graveyard" | "darrel-grove" | "lily-coil";

export type SurvivalChunkInfo = {
  key: string;
  cx: number;
  cz: number;
  x: number;
  z: number;
  distance: number;
  biome: SurvivalBiome;
  hasVillage: boolean;
  villageKind: SurvivalVillageKind | null;
  hasRiver: boolean;
  riverVertical: boolean;
  lod: "near" | "mid" | "far";
};

export const SURVIVAL_RENDER_RADIUS = 3;
export const SURVIVAL_NEAR_RADIUS = 1;
export const SURVIVAL_COLLISION_RADIUS = 2;
export const SURVIVAL_CHUNK_MOUNT_IMMEDIATE_RADIUS = 2;
export const SURVIVAL_CHUNK_STREAM_INITIAL_RADIUS = 2;
export const SURVIVAL_CHUNK_STREAM_STEP_MS = 450;
export const SURVIVAL_CHUNK_STREAM_STEP_CURVE_MS = 120;
export const SURVIVAL_CHUNK_MOUNT_INTERVAL_MS = 120;
export const SURVIVAL_CHUNK_MOBILE_MOUNT_INTERVAL_MS = 160;
export const SURVIVAL_CHUNK_MOUNT_BATCH = 2;
export const SURVIVAL_CHUNK_CENTER_HYSTERESIS = SURVIVAL_BLOCK_SIZE * 0.72;
export const SURVIVAL_CHUNK_STREAM_ROUNDING = 0.45;
export const SURVIVAL_BIOME_HEX_RADIUS = SURVIVAL_BLOCK_SIZE * 0.62;
export const SURVIVAL_TERRAIN_CENTER_SEGMENTS = 32;
export const SURVIVAL_TERRAIN_NEAR_SEGMENTS = 32;
export const SURVIVAL_TERRAIN_MID_SEGMENTS = 12;
export const SURVIVAL_TERRAIN_FAR_SEGMENTS = 4;
export const SURVIVAL_TERRAIN_CENTER_COLLISION_SEGMENTS = SURVIVAL_TERRAIN_CENTER_SEGMENTS;
export const SURVIVAL_TERRAIN_NEAR_COLLISION_SEGMENTS = SURVIVAL_TERRAIN_NEAR_SEGMENTS;
export const SURVIVAL_VILLAGE_PAD_SEGMENTS = 18;
export const SURVIVAL_TERRAIN_SKIRT_DEPTH = 44;
export const SURVIVAL_TERRAIN_SKIRT_TOP_INSET = 0.04;
export const SURVIVAL_TERRAIN_CACHE_LIMIT = 512;
export const SURVIVAL_RESTORED_MEADOW_TERRAIN_VISUAL_FADE_RADIUS = 350;
export const SURVIVAL_RESTORED_MEADOW_TERRAIN_VISUAL_FADE_WIDTH = 76;
export const SURVIVAL_RESTORED_MEADOW_TERRAIN_VISUAL_NEAR_SOLID = 252;
export const SURVIVAL_RESTORED_MEADOW_TERRAIN_VISUAL_NEAR_FADE = 72;
export const SURVIVAL_RIVER_SURFACE_NEAR_SEGMENTS = 48;
export const SURVIVAL_RIVER_SURFACE_MID_SEGMENTS = 24;
export const SURVIVAL_RIVER_SURFACE_FAR_SEGMENTS = 8;
export const SURVIVAL_RIVER_SURFACE_MASK_THRESHOLD = 0.2;
export const SURVIVAL_BIOME_BLEND_INNER_RADIUS = 0.18;
export const SURVIVAL_BIOME_BLEND_OUTER_RADIUS = 1.86;
export const SURVIVAL_BIOME_BLEND_POWER = 2.15;
export const SURVIVAL_TERRAIN_COLOR_SAMPLE_RADIUS = 16;
export const SURVIVAL_TERRAIN_DETAIL_UV_WORLD_SIZE = SURVIVAL_BLOCK_SIZE * 0.93;
export const SURVIVAL_TERRAIN_COLOR_SAMPLES: Array<[number, number, number]> = [
  [0, 0, 0.38],
  [SURVIVAL_TERRAIN_COLOR_SAMPLE_RADIUS, 0, 0.09],
  [-SURVIVAL_TERRAIN_COLOR_SAMPLE_RADIUS, 0, 0.09],
  [0, SURVIVAL_TERRAIN_COLOR_SAMPLE_RADIUS, 0.09],
  [0, -SURVIVAL_TERRAIN_COLOR_SAMPLE_RADIUS, 0.09],
];
export const BASE_VILLAGE_HALF_SIZE = 256;
export const BASE_VILLAGE_EXIT_HEIGHT = 2;
export const BASE_VILLAGE_EXIT_BLEND_DISTANCE = 220;
export const BASE_VILLAGE_APRON_DISTANCE = 172;

export function getSurvivalChunkStreamDelay(stepIndex: number) {
  const streamStep = stepIndex + 1;
  return SURVIVAL_CHUNK_STREAM_STEP_MS * streamStep + SURVIVAL_CHUNK_STREAM_STEP_CURVE_MS * stepIndex * stepIndex;
}
