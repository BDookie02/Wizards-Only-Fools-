import * as THREE from "three";
import { getSurvivalRestoredMeadowMask } from "../survival/survivalBiome";
import { lerpNumber, survivalHash01 } from "../survival/survivalMath";
import {
  getSurvivalChunkInfoAtWorld,
  getSurvivalGrassBladeColor,
  getSurvivalGrassSurfaceBiome,
  getSurvivalGrassSurfaceHeightForChunk,
  getSurvivalSmoothedTerrainColor,
} from "./survivalDormantGrassSurface";
import { clampDormantGrassColor } from "./survivalDormantGrassRuntime";
import {
  SURVIVAL_LOCAL_GRASS_CELL_SIZE,
  SURVIVAL_LOCAL_GRASS_DEFAULT_LIFT_COLOR,
  SURVIVAL_LOCAL_GRASS_DESERT_LIFT_COLOR,
  SURVIVAL_LOCAL_GRASS_SWAMP_LIFT_COLOR,
  type SurvivalLocalGrassCell,
} from "./survivalLocalGrassStreaming";

const SURVIVAL_LOCAL_GRASS_MEADOW_DRY_COLOR = new THREE.Color("#a9a35a");
const SURVIVAL_LOCAL_GRASS_MEADOW_SWAMP_COLOR = new THREE.Color("#789344");
const SURVIVAL_LOCAL_GRASS_MEADOW_JUNGLE_COLOR = new THREE.Color("#69b14f");
const SURVIVAL_LOCAL_GRASS_MEADOW_BRIGHT_COLOR = new THREE.Color("#92d84b");
const SURVIVAL_LOCAL_GRASS_MEADOW_DEFAULT_COLOR = new THREE.Color("#6fb63d");

export type SurvivalLocalGrassMaterialColors = {
  ground: string;
  short: string;
  tall: string;
};

export function getSurvivalLocalGrassMaterialColors(cell: SurvivalLocalGrassCell): SurvivalLocalGrassMaterialColors {
  const sampleWorldX = cell.x + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.48;
  const sampleWorldZ = cell.z + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.52;
  const sampleChunk = getSurvivalChunkInfoAtWorld(sampleWorldX, sampleWorldZ);
  const sampleTerrainY = getSurvivalGrassSurfaceHeightForChunk(
    sampleChunk,
    sampleWorldX - sampleChunk.x,
    sampleWorldZ - sampleChunk.z,
  );
  const sampleBiome = getSurvivalGrassSurfaceBiome(sampleChunk.biome, sampleWorldX, sampleWorldZ, sampleTerrainY);
  const terrainColor = getSurvivalSmoothedTerrainColor(sampleWorldX, sampleWorldZ, sampleTerrainY);
  const grassColor = getSurvivalGrassBladeColor(sampleBiome, sampleWorldX, sampleWorldZ, sampleTerrainY, survivalHash01(cell.cellX, cell.cellZ, 19690));
  const meadowMask = getSurvivalRestoredMeadowMask(sampleWorldX, sampleWorldZ);
  const dryTerrain = sampleBiome === "desert" && terrainColor.g < terrainColor.r * 1.06;
  const meadowGreen = dryTerrain
    ? SURVIVAL_LOCAL_GRASS_MEADOW_DRY_COLOR
    : sampleBiome === "swamp"
      ? SURVIVAL_LOCAL_GRASS_MEADOW_SWAMP_COLOR
      : sampleBiome === "jungle"
        ? SURVIVAL_LOCAL_GRASS_MEADOW_JUNGLE_COLOR
        : meadowMask > 0.28
          ? SURVIVAL_LOCAL_GRASS_MEADOW_BRIGHT_COLOR
          : SURVIVAL_LOCAL_GRASS_MEADOW_DEFAULT_COLOR;
  const liftColor = sampleBiome === "desert"
    ? SURVIVAL_LOCAL_GRASS_DESERT_LIFT_COLOR
    : sampleBiome === "swamp"
      ? SURVIVAL_LOCAL_GRASS_SWAMP_LIFT_COLOR
      : SURVIVAL_LOCAL_GRASS_DEFAULT_LIFT_COLOR;
  const ground = terrainColor.clone().lerp(meadowGreen, dryTerrain ? 0.3 : lerpNumber(0.48, 0.62, meadowMask)).lerp(grassColor, 0.08).lerp(liftColor, dryTerrain ? 0.02 : 0.035);
  const short = meadowGreen.clone().lerp(grassColor, dryTerrain ? 0.24 : 0.16).lerp(liftColor, dryTerrain ? 0.05 : 0.07).multiplyScalar(dryTerrain ? 1 : lerpNumber(1.0, 1.08, meadowMask));
  const tall = meadowGreen.clone().lerp(grassColor, dryTerrain ? 0.22 : 0.18).lerp(liftColor, dryTerrain ? 0.04 : 0.06).multiplyScalar(dryTerrain ? 0.98 : lerpNumber(0.99, 1.06, meadowMask));
  clampDormantGrassColor(ground);
  clampDormantGrassColor(short);
  clampDormantGrassColor(tall);
  return {
    ground: `#${ground.getHexString()}`,
    short: `#${short.getHexString()}`,
    tall: `#${tall.getHexString()}`,
  };
}

export function tintSurvivalLocalGrassMeshMaterial(
  mesh: THREE.InstancedMesh | THREE.Mesh | null,
  color: THREE.Color,
  opacity: number,
) {
  if (!mesh) return;
  const tintOneMaterial = (material: THREE.Material) => {
    if ("color" in material && material.color instanceof THREE.Color) {
      material.color.copy(color);
    }
    if ("opacity" in material && typeof material.opacity === "number") {
      material.opacity = opacity;
    }
  };
  if (Array.isArray(mesh.material)) {
    for (let index = 0; index < mesh.material.length; index += 1) {
      tintOneMaterial(mesh.material[index]);
    }
  } else {
    tintOneMaterial(mesh.material);
  }
}
