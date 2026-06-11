import {
  LILY_COIL_QUEST_CHUNK,
  SURVIVAL_BLOCK_SIZE,
} from "../../../../store/gameStore";
import {
  SURVIVAL_CHUNK_MOUNT_IMMEDIATE_RADIUS,
  SURVIVAL_CHUNK_STREAM_ROUNDING,
  SURVIVAL_COLLISION_RADIUS,
  SURVIVAL_NEAR_RADIUS,
  SURVIVAL_RENDER_RADIUS,
  SURVIVAL_TERRAIN_CACHE_LIMIT,
  type SurvivalChunkInfo,
  type SurvivalVillageKind,
} from "./survivalWorldConfig";
import { getSurvivalBiome, isSurvivalRestoredMeadowWaterSuppressed } from "./survivalBiome";
import { getSurvivalChunkHasRiver } from "./survivalRivers";
import {
  getCurrentSurvivalPlayerChunkCoords,
  getSurvivalChunkCoord,
} from "./survivalPosition";
import { survivalHash01 } from "./survivalMath";
import {
  getSurvivalVillageKindForChunk,
  isLilyCoilRealmCenter,
} from "../villages/survivalVillageRegistry";

const survivalChunkInfoCache = new Map<string, SurvivalChunkInfo>();

type SurvivalChunkPriorityComparator = (a: SurvivalChunkInfo, b: SurvivalChunkInfo) => number;

function getSurvivalChunksSortedByPriority(
  chunks: SurvivalChunkInfo[],
  compareChunkPriority: SurvivalChunkPriorityComparator,
) {
  for (let index = 1; index < chunks.length; index += 1) {
    if (compareChunkPriority(chunks[index - 1], chunks[index]) > 0) {
      return chunks.slice().sort(compareChunkPriority);
    }
  }
  return chunks;
}

function sortSurvivalChunksByPriorityIfNeeded(
  chunks: SurvivalChunkInfo[],
  compareChunkPriority: SurvivalChunkPriorityComparator,
) {
  for (let index = 1; index < chunks.length; index += 1) {
    if (compareChunkPriority(chunks[index - 1], chunks[index]) > 0) {
      chunks.sort(compareChunkPriority);
      break;
    }
  }
  return chunks;
}

export function shouldBuildSurvivalChunkColliders(chunk: Pick<SurvivalChunkInfo, "distance">) {
  return chunk.distance <= SURVIVAL_COLLISION_RADIUS;
}

export function shouldRenderSurvivalChunkSkirt(chunk: Pick<SurvivalChunkInfo, "distance">) {
  return chunk.distance > 0;
}

export function shouldRenderSurvivalTerrainSkirt(chunk: SurvivalChunkInfo) {
  return shouldRenderSurvivalChunkSkirt(chunk) &&
    !isSurvivalRestoredMeadowWaterSuppressed(chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 1.08);
}

export function makeSurvivalChunks(
  centerCx: number,
  centerCz: number,
  includeBaseChunk = false,
  streamRadius = SURVIVAL_RENDER_RADIUS,
) {
  if (isLilyCoilRealmCenter(centerCx, centerCz)) {
    const cx = LILY_COIL_QUEST_CHUNK.cx;
    const cz = LILY_COIL_QUEST_CHUNK.cz;
    const biome = getSurvivalBiome(cx, cz);
    return [{
      key: `${cx}:${cz}`,
      cx,
      cz,
      x: cx * SURVIVAL_BLOCK_SIZE,
      z: cz * SURVIVAL_BLOCK_SIZE,
      distance: 0,
      biome,
      hasVillage: true,
      villageKind: "lily-coil" as SurvivalVillageKind,
      hasRiver: false,
      riverVertical: false,
      lod: "near" as const,
    }];
  }

  const chunks: SurvivalChunkInfo[] = [];
  const radius = Math.max(0, Math.min(SURVIVAL_RENDER_RADIUS, Math.floor(streamRadius)));
  const roundedRadius = radius + SURVIVAL_CHUNK_STREAM_ROUNDING;
  const roundedRadiusSq = roundedRadius * roundedRadius;

  for (let dz = -radius; dz <= radius; dz += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dz * dz > roundedRadiusSq) continue;

      const cx = centerCx + dx;
      const cz = centerCz + dz;
      if (!includeBaseChunk && cx === 0 && cz === 0) continue;
      const distance = Math.max(Math.abs(dx), Math.abs(dz));
      const biome = getSurvivalBiome(cx, cz);
      const villageKind = getSurvivalVillageKindForChunk(biome, cx, cz);

      chunks.push({
        key: `${cx}:${cz}`,
        cx,
        cz,
        x: cx * SURVIVAL_BLOCK_SIZE,
        z: cz * SURVIVAL_BLOCK_SIZE,
        distance,
        biome,
        hasVillage: villageKind !== null,
        villageKind,
        hasRiver: getSurvivalChunkHasRiver(cx, cz),
        riverVertical: survivalHash01(cx, cz, 5) > 0.5,
        lod: distance === 0 ? "near" : distance <= SURVIVAL_NEAR_RADIUS ? "mid" : "far",
      });
    }
  }

  return chunks.sort((a, b) => a.distance - b.distance || a.key.localeCompare(b.key));
}

export function reconcileSurvivalVisibleChunks(
  previousChunks: SurvivalChunkInfo[],
  targetChunks: SurvivalChunkInfo[],
  addCount: number,
) {
  const targetMap = new Map<string, SurvivalChunkInfo>();
  for (const chunk of targetChunks) {
    targetMap.set(chunk.key, chunk);
  }
  const immediateKeys = getImmediateSurvivalVisibleChunkKeys(targetChunks);
  const playerChunk = getCurrentSurvivalPlayerChunkCoords();
  const getChunkPriority = (chunk: SurvivalChunkInfo) => {
    const targetChunk = targetMap.get(chunk.key) ?? chunk;
    return playerChunk
      ? Math.max(Math.abs(targetChunk.cx - playerChunk.cx), Math.abs(targetChunk.cz - playerChunk.cz))
      : targetChunk.distance;
  };
  const compareChunkPriority = (a: SurvivalChunkInfo, b: SurvivalChunkInfo) => (
    getChunkPriority(a) - getChunkPriority(b)
  ) || (
    (targetMap.get(a.key)?.distance ?? a.distance) -
    (targetMap.get(b.key)?.distance ?? b.distance)
  ) || a.key.localeCompare(b.key);
  const orderedTargetChunks = getSurvivalChunksSortedByPriority(targetChunks, compareChunkPriority);
  const nextChunks: SurvivalChunkInfo[] = [];
  const seenKeys = new Set<string>();
  const staleChunks: SurvivalChunkInfo[] = [];
  let remainingWork = Math.max(0, addCount);
  const canReusePreviousChunk = (previousChunk: SurvivalChunkInfo, nextChunk: SurvivalChunkInfo) => (
    previousChunk.lod === nextChunk.lod &&
    previousChunk.biome === nextChunk.biome &&
    previousChunk.villageKind === nextChunk.villageKind &&
    previousChunk.hasVillage === nextChunk.hasVillage &&
    previousChunk.hasRiver === nextChunk.hasRiver &&
    previousChunk.riverVertical === nextChunk.riverVertical &&
    shouldBuildSurvivalChunkColliders(previousChunk) === shouldBuildSurvivalChunkColliders(nextChunk) &&
    shouldRenderSurvivalTerrainSkirt(previousChunk) === shouldRenderSurvivalTerrainSkirt(nextChunk)
  );

  const orderedPreviousChunks = getSurvivalChunksSortedByPriority(previousChunks, compareChunkPriority);
  for (const chunk of orderedPreviousChunks) {
    const nextChunk = targetMap.get(chunk.key);
    if (!nextChunk) {
      staleChunks.push(chunk);
      continue;
    }
    if (seenKeys.has(nextChunk.key)) continue;
    const canReuse = canReusePreviousChunk(chunk, nextChunk);
    const shouldUpgrade = !canReuse && remainingWork > 0;
    if (shouldUpgrade) remainingWork -= 1;
    nextChunks.push(canReuse || !shouldUpgrade ? chunk : nextChunk);
    seenKeys.add(nextChunk.key);
  }

  for (const chunk of orderedTargetChunks) {
    if (!immediateKeys.has(chunk.key) || seenKeys.has(chunk.key)) continue;
    nextChunks.push(chunk);
    seenKeys.add(chunk.key);
  }

  for (const chunk of orderedTargetChunks) {
    if (seenKeys.has(chunk.key)) continue;
    if (remainingWork <= 0) break;
    nextChunks.push(chunk);
    seenKeys.add(chunk.key);
    remainingWork -= 1;
  }

  if (staleChunks.length > 0) {
    const targetComplete = seenKeys.size >= targetMap.size;
    const staleKeepCount = targetComplete
      ? Math.max(0, staleChunks.length - Math.max(1, addCount))
      : staleChunks.length;
    for (let index = 0; index < staleKeepCount; index += 1) {
      nextChunks.push(staleChunks[index]);
    }
  }

  const orderedNextChunks = sortSurvivalChunksByPriorityIfNeeded(nextChunks, compareChunkPriority);
  let unchanged = previousChunks.length === orderedNextChunks.length;
  if (unchanged) {
    for (let index = 0; index < previousChunks.length; index += 1) {
      if (previousChunks[index] !== orderedNextChunks[index]) {
        unchanged = false;
        break;
      }
    }
  }

  return unchanged ? previousChunks : orderedNextChunks;
}

export function getImmediateSurvivalVisibleChunkKeys(chunks: SurvivalChunkInfo[]) {
  if (chunks.length === 0) return new Set<string>();

  const immediateKeys = new Set<string>();
  const playerChunk = getCurrentSurvivalPlayerChunkCoords();
  if (playerChunk) {
    for (const chunk of chunks) {
      const playerDistance = Math.max(
        Math.abs(chunk.cx - playerChunk.cx),
        Math.abs(chunk.cz - playerChunk.cz),
      );
      if (playerDistance <= SURVIVAL_CHUNK_MOUNT_IMMEDIATE_RADIUS) {
        immediateKeys.add(chunk.key);
      }
    }
  }

  if (immediateKeys.size === 0) immediateKeys.add(chunks[0].key);

  return immediateKeys;
}

export function getInitialSurvivalVisibleChunks(chunks: SurvivalChunkInfo[]) {
  if (chunks.length === 0) return [];

  const immediateKeys = getImmediateSurvivalVisibleChunkKeys(chunks);
  const immediateChunks: SurvivalChunkInfo[] = [];
  for (const chunk of chunks) {
    if (immediateKeys.has(chunk.key)) immediateChunks.push(chunk);
  }
  return immediateChunks.length > 0 ? immediateChunks : [chunks[0]];
}

export function makeSurvivalChunkInfoForCoords(
  cx: number,
  cz: number,
  distance = 0,
  lod: SurvivalChunkInfo["lod"] = "near",
): SurvivalChunkInfo {
  const cacheKey = `${cx}:${cz}:${distance}:${lod}`;
  const cached = survivalChunkInfoCache.get(cacheKey);
  if (cached) {
    survivalChunkInfoCache.delete(cacheKey);
    survivalChunkInfoCache.set(cacheKey, cached);
    return cached;
  }

  const biome = getSurvivalBiome(cx, cz);
  const villageKind = getSurvivalVillageKindForChunk(biome, cx, cz);
  const chunk = {
    key: `${cx}:${cz}`,
    cx,
    cz,
    x: cx * SURVIVAL_BLOCK_SIZE,
    z: cz * SURVIVAL_BLOCK_SIZE,
    distance,
    biome,
    hasVillage: villageKind !== null,
    villageKind,
    hasRiver: getSurvivalChunkHasRiver(cx, cz),
    riverVertical: survivalHash01(cx, cz, 5) > 0.5,
    lod,
  };

  survivalChunkInfoCache.set(cacheKey, chunk);
  if (survivalChunkInfoCache.size > SURVIVAL_TERRAIN_CACHE_LIMIT * 4) {
    const oldestKey = survivalChunkInfoCache.keys().next().value;
    if (oldestKey) survivalChunkInfoCache.delete(oldestKey);
  }

  return chunk;
}

export function getSurvivalChunkInfoAtWorld(
  worldX: number,
  worldZ: number,
  distance = 0,
  lod: SurvivalChunkInfo["lod"] = "near",
) {
  return makeSurvivalChunkInfoForCoords(
    getSurvivalChunkCoord(worldX),
    getSurvivalChunkCoord(worldZ),
    distance,
    lod,
  );
}
