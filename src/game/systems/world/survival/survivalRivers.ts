import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE, type SurvivalBiome } from "../../../../store/gameStore";
import { getSpecialSurvivalVillageKind } from "../villages/survivalVillageRegistry";
import {
  getSurvivalBiome,
  getSurvivalWaterLevelAtWorld,
  isSurvivalRestoredMeadowWaterSuppressed,
} from "./survivalBiome";
import { survivalHash01, smoothstep01, smoothstepRange } from "./survivalMath";
import { getSurvivalChunkCoord } from "./survivalPosition";
import {
  SURVIVAL_RIVER_SURFACE_FAR_SEGMENTS,
  SURVIVAL_RIVER_SURFACE_MASK_THRESHOLD,
  SURVIVAL_RIVER_SURFACE_MID_SEGMENTS,
  SURVIVAL_RIVER_SURFACE_NEAR_SEGMENTS,
  SURVIVAL_TERRAIN_CACHE_LIMIT,
  type SurvivalChunkInfo,
} from "./survivalWorldConfig";

export type SurvivalTerrainHeightForChunk = (
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
) => number;

const survivalRiverSurfaceGeometryCache = new Map<string, THREE.BufferGeometry | null>();

export function getSurvivalRiverWidth(chunk: SurvivalChunkInfo) {
  return getSurvivalRiverWidthForBiome(chunk.biome);
}

export function getSurvivalRiverOffset(chunk: SurvivalChunkInfo) {
  return getSurvivalRiverOffsetForCoords(chunk.cx, chunk.cz);
}

export function getSurvivalChunkHasRiver(cx: number, cz: number) {
  const biome = getSurvivalBiome(cx, cz);
  const specialVillageKind = getSpecialSurvivalVillageKind(cx, cz);
  if (specialVillageKind && specialVillageKind !== "swamp") return false;
  if (biome === "swamp") return true;
  const macroRibbon = Math.abs(cz - Math.round(Math.sin(cx * 0.52) * 2.1 + Math.sin(cx * 0.16) * 1.4)) <= 0;
  const crossingRibbon = Math.abs(cx - Math.round(Math.cos(cz * 0.47) * 2.2 + Math.sin(cz * 0.12) * 1.2)) <= 0;
  const ribbonKeep = survivalHash01(cx, cz, 407) > (biome === "jungle" ? 0.34 : 0.58);
  return (macroRibbon || crossingRibbon) && ribbonKeep;
}

export function getSurvivalRiverWidthForBiome(biome: SurvivalBiome) {
  return biome === "swamp" ? 86 : biome === "jungle" ? 58 : biome === "desert" ? 48 : 44;
}

export function getSurvivalWaterOpacityForBiome(biome: SurvivalBiome) {
  if (biome === "swamp") return 0.66;
  if (biome === "desert") return 0.34;
  return 0.44;
}

export function getSurvivalShoreOpacityForBiome(biome: SurvivalBiome) {
  if (biome === "swamp") return 0.26;
  if (biome === "desert") return 0.16;
  return 0.12;
}

export function getSurvivalPondCountForChunk(chunk: SurvivalChunkInfo) {
  if (chunk.lod === "far") return 0;
  const specialVillageKind = getSpecialSurvivalVillageKind(chunk.cx, chunk.cz);
  if (specialVillageKind && specialVillageKind !== "swamp") return 0;
  const roll = survivalHash01(chunk.cx, chunk.cz, 155);
  if (chunk.biome === "swamp") return 3;
  if (chunk.biome === "jungle") return roll > 0.72 ? 1 : 0;
  if (chunk.biome === "tallgrass") return roll > 0.9 ? 1 : 0;
  if (chunk.biome === "plains") return roll > 0.94 ? 1 : 0;
  if (chunk.biome === "mushroom") return roll > 0.96 ? 1 : 0;
  return roll > 0.985 ? 1 : 0;
}

export function getSurvivalRiverOffsetForCoords(cx: number, cz: number) {
  return (survivalHash01(cx, cz, 15) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.32;
}

export function getSurvivalRiverMaskForChunkFields(
  chunkX: number,
  chunkZ: number,
  biome: SurvivalBiome,
  riverVertical: boolean,
  riverOffset: number,
  worldX: number,
  worldZ: number,
) {
  const localX = worldX - chunkX;
  const localZ = worldZ - chunkZ;
  const riverHalfWidth = getSurvivalRiverWidthForBiome(biome) * 0.5 + (biome === "swamp" ? 8 : 12);
  const distance = riverVertical ? Math.abs(localX - riverOffset) : Math.abs(localZ - riverOffset);
  const travelAxis = riverVertical ? Math.abs(localZ) : Math.abs(localX);
  const endFade = 1 - smoothstepRange(SURVIVAL_BLOCK_SIZE * 0.46, SURVIVAL_BLOCK_SIZE * 0.56, travelAxis);
  const rawMask = Math.max(0, 1 - distance / riverHalfWidth) * endFade;
  return Math.pow(smoothstep01(rawMask), biome === "swamp" ? 1.35 : 1.18);
}

export function getSurvivalChunkRiverMask(chunk: SurvivalChunkInfo, worldX: number, worldZ: number) {
  if (!chunk.hasRiver) return 0;
  return getSurvivalRiverMaskForChunkFields(
    chunk.x,
    chunk.z,
    chunk.biome,
    chunk.riverVertical,
    getSurvivalRiverOffset(chunk),
    worldX,
    worldZ,
  );
}

export function getSurvivalRiverCarveAtWorld(worldX: number, worldZ: number) {
  const centerCx = getSurvivalChunkCoord(worldX);
  const centerCz = getSurvivalChunkCoord(worldZ);
  let strength = 0;
  let bed = 0;

  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dz = -1; dz <= 1; dz += 1) {
      const cx = centerCx + dx;
      const cz = centerCz + dz;
      if (!getSurvivalChunkHasRiver(cx, cz)) continue;

      const biome = getSurvivalBiome(cx, cz);
      const centerX = cx * SURVIVAL_BLOCK_SIZE;
      const centerZ = cz * SURVIVAL_BLOCK_SIZE;
      const riverVertical = survivalHash01(cx, cz, 5) > 0.5;
      const carve = getSurvivalRiverMaskForChunkFields(
        centerX,
        centerZ,
        biome,
        riverVertical,
        getSurvivalRiverOffsetForCoords(cx, cz),
        worldX,
        worldZ,
      );

      if (carve > strength) {
        strength = carve;
        bed = getSurvivalWaterLevelAtWorld(worldX, worldZ) - (biome === "swamp" ? 2.6 : 3.4);
      }
    }
  }

  return { strength, bed };
}

function trimSurvivalRiverSurfaceGeometryCache() {
  while (survivalRiverSurfaceGeometryCache.size > SURVIVAL_TERRAIN_CACHE_LIMIT) {
    const oldestKey = survivalRiverSurfaceGeometryCache.keys().next().value;
    if (typeof oldestKey !== "string") return;
    survivalRiverSurfaceGeometryCache.get(oldestKey)?.dispose();
    survivalRiverSurfaceGeometryCache.delete(oldestKey);
  }
}

export function makeSurvivalRiverSurfaceGeometry(
  chunk: SurvivalChunkInfo,
  getSurvivalTerrainHeightForChunk: SurvivalTerrainHeightForChunk,
) {
  const segments = chunk.lod === "near"
    ? SURVIVAL_RIVER_SURFACE_NEAR_SEGMENTS
    : chunk.lod === "mid"
      ? SURVIVAL_RIVER_SURFACE_MID_SEGMENTS
      : SURVIVAL_RIVER_SURFACE_FAR_SEGMENTS;
  const cacheKey = `${chunk.key}:${chunk.lod}:river:${segments}`;
  if (survivalRiverSurfaceGeometryCache.has(cacheKey)) {
    const cached = survivalRiverSurfaceGeometryCache.get(cacheKey) ?? null;
    survivalRiverSurfaceGeometryCache.delete(cacheKey);
    survivalRiverSurfaceGeometryCache.set(cacheKey, cached);
    return cached;
  }

  const halfSize = SURVIVAL_BLOCK_SIZE * 0.54;
  const span = halfSize * 2;
  const vertexCount = (segments + 1) * (segments + 1);
  const maxIndexCount = segments * segments * 6;
  const positions = new Float32Array(vertexCount * 3);
  const indices = vertexCount > 65535 ? new Uint32Array(maxIndexCount) : new Uint16Array(maxIndexCount);
  let positionOffset = 0;
  let indexOffset = 0;

  for (let zIndex = 0; zIndex <= segments; zIndex += 1) {
    for (let xIndex = 0; xIndex <= segments; xIndex += 1) {
      const worldX = chunk.x - halfSize + (xIndex / segments) * span;
      const worldZ = chunk.z - halfSize + (zIndex / segments) * span;
      const y = getSurvivalWaterLevelAtWorld(worldX, worldZ) + 0.16;
      positions[positionOffset] = worldX;
      positions[positionOffset + 1] = y;
      positions[positionOffset + 2] = worldZ;
      positionOffset += 3;
    }
  }

  for (let zIndex = 0; zIndex < segments; zIndex += 1) {
    for (let xIndex = 0; xIndex < segments; xIndex += 1) {
      const centerWorldX = chunk.x - halfSize + ((xIndex + 0.5) / segments) * span;
      const centerWorldZ = chunk.z - halfSize + ((zIndex + 0.5) / segments) * span;
      if (
        isSurvivalRestoredMeadowWaterSuppressed(
          centerWorldX,
          centerWorldZ,
          getSurvivalRiverWidthForBiome(chunk.biome) * 0.62 + SURVIVAL_BLOCK_SIZE * 0.42,
        )
      ) continue;

      const mask = getSurvivalChunkRiverMask(chunk, centerWorldX, centerWorldZ);
      if (mask < SURVIVAL_RIVER_SURFACE_MASK_THRESHOLD) continue;

      const centerLocalX = centerWorldX - chunk.x;
      const centerLocalZ = centerWorldZ - chunk.z;
      const waterY = getSurvivalWaterLevelAtWorld(centerWorldX, centerWorldZ) + 0.16;
      const terrainY = getSurvivalTerrainHeightForChunk(chunk, centerLocalX, centerLocalZ);
      if (terrainY > waterY + 0.48) continue;

      const a = zIndex * (segments + 1) + xIndex;
      const b = a + 1;
      const c = a + segments + 2;
      const d = a + segments + 1;
      indices[indexOffset] = a;
      indices[indexOffset + 1] = b;
      indices[indexOffset + 2] = c;
      indices[indexOffset + 3] = a;
      indices[indexOffset + 4] = c;
      indices[indexOffset + 5] = d;
      indexOffset += 6;
    }
  }

  if (indexOffset === 0) {
    survivalRiverSurfaceGeometryCache.set(cacheKey, null);
    trimSurvivalRiverSurfaceGeometryCache();
    return null;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(new THREE.BufferAttribute(indices.subarray(0, indexOffset), 1));
  survivalRiverSurfaceGeometryCache.set(cacheKey, geo);
  trimSurvivalRiverSurfaceGeometryCache();
  return geo;
}
