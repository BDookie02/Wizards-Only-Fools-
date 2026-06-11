import * as THREE from "three";
import type { SurvivalBiome } from "../../../../store/gameStore";
import { clamp01, lerpNumber, smoothstepRange, survivalHash01 } from "../survival/survivalMath";
import {
  SURVIVAL_BOTW_HILLSIDE_GRASS_DRY_COLOR,
  SURVIVAL_BOTW_HILLSIDE_GRASS_FULL_Y,
  SURVIVAL_BOTW_HILLSIDE_GRASS_MUTE_COLOR,
  SURVIVAL_BOTW_HILLSIDE_GRASS_START_Y,
} from "./survivalBotwGrassConfig";

export type SurvivalTerrainColorResolver = (
  worldX: number,
  worldZ: number,
  height: number,
) => THREE.Color;

export const SURVIVAL_GRASS_COLORS: Record<SurvivalBiome, string[]> = {
  plains: ["#6cab43", "#83c750", "#4f8f35"],
  jungle: ["#3b9141", "#59b35a", "#2f7435"],
  desert: ["#b99b4b", "#d9c36e", "#83984a"],
  swamp: ["#657939", "#819144", "#4d6530"],
  mushroom: ["#668a4c", "#8aad58", "#9a8bd0"],
  tallgrass: ["#72b43e", "#95c84c", "#5f9f35"],
};

export const SURVIVAL_BUSH_COLORS: Record<SurvivalBiome, string[]> = {
  plains: ["#416f2f", "#5e9341", "#7aad55"],
  jungle: ["#174d26", "#246b31", "#3a8e45"],
  desert: ["#8a7139", "#b68e43", "#d0ad62"],
  swamp: ["#33441f", "#526126", "#687337"],
  mushroom: ["#4f6d3c", "#745699", "#a976bf"],
  tallgrass: ["#5c7d2f", "#7d9539", "#a9a84c"],
};

export const SURVIVAL_FLOWER_COLORS: Record<SurvivalBiome, string[]> = {
  plains: ["#f8fafc", "#fde047", "#f9a8d4", "#93c5fd"],
  jungle: ["#f97316", "#facc15", "#ef4444", "#f0abfc"],
  desert: ["#fef3c7", "#f59e0b", "#fb7185", "#f97316"],
  swamp: ["#d9f99d", "#a7f3d0", "#c084fc", "#facc15"],
  mushroom: ["#f0abfc", "#c084fc", "#f9a8d4", "#fef3c7"],
  tallgrass: ["#fde047", "#fef08a", "#f9a8d4", "#bfdbfe"],
};

export const SURVIVAL_BOTW_FLOWER_GLOW_COLOR = new THREE.Color("#fffbea");
export const SURVIVAL_BOTW_FLOWER_LEAF_DARK_COLOR = new THREE.Color("#3f8f31");
export const SURVIVAL_BOTW_FLOWER_LEAF_BASE_COLOR = new THREE.Color("#5cad3b");
export const SURVIVAL_BOTW_FLOWER_LEAF_LIGHT_COLOR = new THREE.Color("#7fbd47");
export const SURVIVAL_BOTW_FLOWER_LEAF_BRIGHT_COLOR = new THREE.Color("#9bd95b");
export const SURVIVAL_BOTW_FLOWER_LEAF_TALL_COLOR = new THREE.Color("#a4df5b");
export const SURVIVAL_BOTW_FLOWER_CENTER_YELLOW_COLOR = new THREE.Color("#ffe45c");
export const SURVIVAL_BOTW_FLOWER_CENTER_ORANGE_COLOR = new THREE.Color("#f59e0b");

export const SURVIVAL_BUTTERFLY_COLORS: Record<SurvivalBiome, string[]> = {
  plains: ["#f97316", "#60a5fa", "#f472b6", "#fde047"],
  jungle: ["#22c55e", "#ef4444", "#38bdf8", "#facc15"],
  desert: ["#f59e0b", "#fef3c7", "#fb7185", "#fdba74"],
  swamp: ["#a7f3d0", "#84cc16", "#c084fc", "#eab308"],
  mushroom: ["#d946ef", "#c084fc", "#f0abfc", "#fef3c7"],
  tallgrass: ["#fde047", "#f97316", "#93c5fd", "#f9a8d4"],
};

export const SURVIVAL_TREE_CANOPY_COLORS: Record<SurvivalBiome, [string, string]> = {
  plains: ["#71b34b", "#5f9d3f"],
  jungle: ["#0f5b2b", "#1f7a3b"],
  desert: ["#4f8b3f", "#6ca54a"],
  swamp: ["#53652d", "#68783a"],
  mushroom: ["#9a63c7", "#d071df"],
  tallgrass: ["#7aa13c", "#a0a849"],
};

export const SURVIVAL_ROOF_FOREST_CANOPY_COLORS: Record<SurvivalBiome, [string, string, string]> = {
  plains: ["#1f5f2f", "#2f7a38", "#4f9a42"],
  jungle: ["#082d18", "#0f4925", "#1b6a35"],
  desert: ["#4f8b3f", "#6ca54a", "#8cb45c"],
  swamp: ["#304620", "#465528", "#617136"],
  mushroom: ["#9a4fb1", "#d65dc5", "#ff8fcf"],
  tallgrass: ["#4f7a2c", "#77953a", "#b0a847"],
};

export const SURVIVAL_TREE_TRUNK_COLORS: Record<SurvivalBiome, string> = {
  plains: "#5a351d",
  jungle: "#2b160d",
  desert: "#8a5d2b",
  swamp: "#332315",
  mushroom: "#dcc7aa",
  tallgrass: "#6a421f",
};

export function getSurvivalBotwHillsideVegetationMix(
  terrainY: number,
  normalY: number,
  footprintHeightRange = 0,
) {
  const elevationMix = smoothstepRange(
    SURVIVAL_BOTW_HILLSIDE_GRASS_START_Y,
    SURVIVAL_BOTW_HILLSIDE_GRASS_FULL_Y,
    terrainY,
  );
  const slopeMix = smoothstepRange(0.025, 0.18, 1 - normalY);
  const roughnessMix = smoothstepRange(0.65, 4.8, footprintHeightRange);
  return clamp01(Math.max(elevationMix * 0.88, slopeMix, roughnessMix * 0.78));
}

export function getSurvivalBotwHillsideKeepChance(hillsideMix: number, floor = 0.46) {
  return lerpNumber(1, floor, clamp01(hillsideMix));
}

export function tintSurvivalBotwHillsideGrassColor(
  color: THREE.Color,
  worldX: number,
  worldZ: number,
  terrainY: number,
  hillsideMix: number,
  getTerrainColor: SurvivalTerrainColorResolver,
) {
  if (hillsideMix <= 0.001) return color;

  const terrainColor = getTerrainColor(worldX, worldZ, terrainY);
  const dryNoise = survivalHash01(Math.floor(worldX * 0.08), Math.floor(worldZ * 0.08), 8440);
  color
    .lerp(terrainColor, hillsideMix * 0.18)
    .lerp(SURVIVAL_BOTW_HILLSIDE_GRASS_MUTE_COLOR, hillsideMix * 0.28)
    .lerp(SURVIVAL_BOTW_HILLSIDE_GRASS_DRY_COLOR, hillsideMix * smoothstepRange(0.55, 1, dryNoise) * 0.12)
    .multiplyScalar(lerpNumber(1, 0.86, hillsideMix));
  color.r = clamp01(color.r);
  color.g = clamp01(color.g);
  color.b = clamp01(color.b);
  return color;
}
