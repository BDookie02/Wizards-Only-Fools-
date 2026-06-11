import {
  SURVIVAL_BOTW_GRASS_BUILD_CACHE_LIMIT,
  type SurvivalBotwFlowerInstance,
  type SurvivalBotwGrassBladeInstance,
} from "./survivalBotwGrassConfig";

export type SurvivalBotwGrassBuildResult = {
  bladeInstances: SurvivalBotwGrassBladeInstance[];
  flowerInstances: SurvivalBotwFlowerInstance[];
  buildMs: number;
};

const cachedSurvivalBotwGrassBuilds = new Map<string, SurvivalBotwGrassBuildResult>();
const pendingSurvivalBotwGrassBuilds = new Set<string>();

export function getCachedSurvivalBotwGrassBuild(buildKey: string) {
  const cached = cachedSurvivalBotwGrassBuilds.get(buildKey);
  if (!cached) return null;
  cachedSurvivalBotwGrassBuilds.delete(buildKey);
  cachedSurvivalBotwGrassBuilds.set(buildKey, cached);
  return cached;
}

export function rememberSurvivalBotwGrassBuild(buildKey: string, result: SurvivalBotwGrassBuildResult) {
  if (cachedSurvivalBotwGrassBuilds.has(buildKey)) {
    cachedSurvivalBotwGrassBuilds.delete(buildKey);
  }
  cachedSurvivalBotwGrassBuilds.set(buildKey, result);
  while (cachedSurvivalBotwGrassBuilds.size > SURVIVAL_BOTW_GRASS_BUILD_CACHE_LIMIT) {
    const oldestKey = cachedSurvivalBotwGrassBuilds.keys().next().value;
    if (typeof oldestKey !== "string") break;
    cachedSurvivalBotwGrassBuilds.delete(oldestKey);
  }
}

export function hasCachedSurvivalBotwGrassBuild(buildKey: string) {
  return cachedSurvivalBotwGrassBuilds.has(buildKey);
}

export function hasPendingSurvivalBotwGrassBuild(buildKey: string) {
  return pendingSurvivalBotwGrassBuilds.has(buildKey);
}

export function getPendingSurvivalBotwGrassBuildCount() {
  return pendingSurvivalBotwGrassBuilds.size;
}

export function markPendingSurvivalBotwGrassBuild(buildKey: string, maxPendingBuilds: number) {
  if (pendingSurvivalBotwGrassBuilds.has(buildKey)) return false;
  if (pendingSurvivalBotwGrassBuilds.size >= maxPendingBuilds) return false;
  pendingSurvivalBotwGrassBuilds.add(buildKey);
  return true;
}

export function finishPendingSurvivalBotwGrassBuild(buildKey: string) {
  pendingSurvivalBotwGrassBuilds.delete(buildKey);
}
