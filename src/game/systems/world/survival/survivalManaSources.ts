import {
  SURVIVAL_BLOCK_SIZE,
  type ManaSpawnRateSetting,
  type SurvivalBiome,
} from "../../../../store/gameStore";
import { getSurvivalBiome, getSurvivalWaterLevelAtWorld } from "./survivalBiome";
import { survivalHash01 } from "./survivalMath";
import { getSurvivalChunkCoord } from "./survivalPosition";
import { getSurvivalChunkHasRiver } from "./survivalRivers";
import { getSurvivalTownRouteMask } from "./survivalRoutes";
import { BASE_VILLAGE_HALF_SIZE, type SurvivalChunkInfo } from "./survivalWorldConfig";
import {
  SURVIVAL_DARREL_GROVE_HALF_SIZE,
  SURVIVAL_GRAVEYARD_PAD_FLAT_RADIUS,
  SURVIVAL_MOUNTAIN_VILLAGE_RADIUS,
  getSurvivalVillageKindForChunk,
} from "../villages/survivalVillageRegistry";

export type SurvivalManaWellSource = {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
};

export type SurvivalManaFlowerSource = {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  stemHeight: number;
  headScale: number;
  biome: SurvivalBiome;
};

type SurvivalManaSourceResolvers = {
  terrainHeightForChunk: (chunk: SurvivalChunkInfo, localX: number, localZ: number) => number;
  villageBaseHeightForChunk: (chunk: SurvivalChunkInfo) => number;
};

const SURVIVAL_MANA_FLOWER_COUNTS: Record<ManaSpawnRateSetting, number> = {
  low: 4,
  normal: 8,
  high: 12,
};

let survivalManaSourceResolvers: SurvivalManaSourceResolvers | null = null;

export function configureSurvivalManaSourceResolvers(nextResolvers: SurvivalManaSourceResolvers) {
  survivalManaSourceResolvers = nextResolvers;
}

export function areSurvivalManaSourceResolversConfigured() {
  return survivalManaSourceResolvers !== null;
}

export function isSurvivalVillageSafeZoneAtWorld(worldX: number, worldZ: number, padding = 54) {
  const cx = getSurvivalChunkCoord(worldX);
  const cz = getSurvivalChunkCoord(worldZ);
  const localX = worldX - cx * SURVIVAL_BLOCK_SIZE;
  const localZ = worldZ - cz * SURVIVAL_BLOCK_SIZE;
  const maxAbs = Math.max(Math.abs(localX), Math.abs(localZ));
  const radiusSq = localX * localX + localZ * localZ;
  const villageKind = cx === 0 && cz === 0
    ? "base"
    : getSurvivalVillageKindForChunk(getSurvivalBiome(cx, cz), cx, cz);

  if (!villageKind) return false;
  if (villageKind === "lily-coil") {
    const radius = SURVIVAL_BLOCK_SIZE * 0.72;
    return radiusSq < radius * radius;
  }
  if (villageKind === "mountain") {
    const radius = SURVIVAL_MOUNTAIN_VILLAGE_RADIUS + padding;
    return radiusSq < radius * radius;
  }
  if (villageKind === "graveyard") {
    const radius = SURVIVAL_GRAVEYARD_PAD_FLAT_RADIUS + padding;
    return radiusSq < radius * radius;
  }
  if (villageKind === "darrel-grove") return maxAbs < SURVIVAL_DARREL_GROVE_HALF_SIZE + padding;
  return maxAbs < BASE_VILLAGE_HALF_SIZE + padding;
}

export function isSurvivalWildernessSpawnAllowed(worldX: number, worldZ: number) {
  return !isSurvivalVillageSafeZoneAtWorld(worldX, worldZ, 62);
}

export function getNearbySurvivalManaFlowers(
  worldX: number,
  worldZ: number,
  manaSpawnRate: ManaSpawnRateSetting = "normal",
): SurvivalManaFlowerSource[] {
  if (!survivalManaSourceResolvers) return [];

  const centerCx = getSurvivalChunkCoord(worldX);
  const centerCz = getSurvivalChunkCoord(worldZ);
  const flowers: SurvivalManaFlowerSource[] = [];
  const perChunk = SURVIVAL_MANA_FLOWER_COUNTS[manaSpawnRate] ?? SURVIVAL_MANA_FLOWER_COUNTS.normal;

  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const cx = centerCx + dx;
      const cz = centerCz + dz;
      const biome = getSurvivalBiome(cx, cz);
      const villageKind = getSurvivalVillageKindForChunk(biome, cx, cz);
      const chunk: SurvivalChunkInfo = {
        key: `${cx}:${cz}`,
        cx,
        cz,
        x: cx * SURVIVAL_BLOCK_SIZE,
        z: cz * SURVIVAL_BLOCK_SIZE,
        distance: Math.max(Math.abs(dx), Math.abs(dz)),
        biome,
        hasVillage: villageKind !== null,
        villageKind,
        hasRiver: getSurvivalChunkHasRiver(cx, cz),
        riverVertical: survivalHash01(cx, cz, 5) > 0.5,
        lod: "near",
      };

      for (let index = 0; index < perChunk; index += 1) {
        const localX = (survivalHash01(cx, cz, 9100 + index * 17) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.86;
        const localZ = (survivalHash01(cx, cz, 9300 + index * 19) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.86;
        const flowerX = chunk.x + localX;
        const flowerZ = chunk.z + localZ;
        if (!isSurvivalWildernessSpawnAllowed(flowerX, flowerZ)) continue;
        if (getSurvivalTownRouteMask(flowerX, flowerZ) > 0.18) continue;

        const y = survivalManaSourceResolvers.terrainHeightForChunk(chunk, localX, localZ);
        const waterY = getSurvivalWaterLevelAtWorld(flowerX, flowerZ);
        if (y < waterY + 0.55) continue;

        const slope = Math.max(
          Math.abs(survivalManaSourceResolvers.terrainHeightForChunk(chunk, localX + 4, localZ) - y),
          Math.abs(survivalManaSourceResolvers.terrainHeightForChunk(chunk, localX - 4, localZ) - y),
          Math.abs(survivalManaSourceResolvers.terrainHeightForChunk(chunk, localX, localZ + 4) - y),
          Math.abs(survivalManaSourceResolvers.terrainHeightForChunk(chunk, localX, localZ - 4) - y),
        );
        if (slope > 4.8) continue;

        flowers.push({
          id: `mana-flower-${cx}:${cz}:${index}`,
          x: flowerX,
          y,
          z: flowerZ,
          radius: 2.15,
          stemHeight: 1.35 + survivalHash01(cx, cz, 9500 + index) * 0.7,
          headScale: 0.72 + survivalHash01(cx, cz, 9700 + index) * 0.28,
          biome,
        });
      }
    }
  }

  return flowers;
}

export function getNearbySurvivalDesertManaWells(worldX: number, worldZ: number): SurvivalManaWellSource[] {
  if (!survivalManaSourceResolvers) return [];

  const centerCx = getSurvivalChunkCoord(worldX);
  const centerCz = getSurvivalChunkCoord(worldZ);
  const wells: SurvivalManaWellSource[] = [];

  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const cx = centerCx + dx;
      const cz = centerCz + dz;
      const biome = getSurvivalBiome(cx, cz);
      if (getSurvivalVillageKindForChunk(biome, cx, cz) !== "desert") continue;

      const chunk: SurvivalChunkInfo = {
        key: `${cx}:${cz}`,
        cx,
        cz,
        x: cx * SURVIVAL_BLOCK_SIZE,
        z: cz * SURVIVAL_BLOCK_SIZE,
        distance: Math.max(Math.abs(dx), Math.abs(dz)),
        biome,
        hasVillage: true,
        villageKind: "desert",
        hasRiver: getSurvivalChunkHasRiver(cx, cz),
        riverVertical: survivalHash01(cx, cz, 5) > 0.5,
        lod: "near",
      };
      const baseHeight = survivalManaSourceResolvers.villageBaseHeightForChunk(chunk);

      wells.push({
        id: `desert-well-mana-${cx}:${cz}`,
        x: chunk.x,
        y: baseHeight + 7.35,
        z: chunk.z,
        radius: 34,
      });
    }
  }

  return wells;
}
