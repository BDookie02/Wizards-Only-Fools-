import {
  SURVIVAL_BOTW_GRASS_BUILD_DESKTOP_SLICE_CANDIDATES,
  SURVIVAL_BOTW_GRASS_BUILD_DESKTOP_SLICE_MS,
  SURVIVAL_BOTW_GRASS_BUILD_MOBILE_SLICE_CANDIDATES,
  SURVIVAL_BOTW_GRASS_BUILD_MOBILE_SLICE_MS,
  SURVIVAL_BOTW_GRASS_BUILD_SLICE_DELAY_MS,
  SURVIVAL_BOTW_GRASS_MAX_PENDING_PREWARMS,
  type SurvivalBotwFlowerInstance,
  type SurvivalBotwGrassBladeInstance,
  type SurvivalBotwGrassCenter,
} from "./survivalBotwGrassConfig";
import {
  appendSurvivalBotwTallFeatureFlowers,
  getSurvivalBotwFlowerBuildContext,
  getSurvivalBotwGrassBuildContext,
  makeSurvivalBotwFlowerCandidate,
  makeSurvivalBotwGrassBladeCandidate,
} from "./survivalBotwGrassGeneration";
import {
  finishPendingSurvivalBotwGrassBuild,
  getPendingSurvivalBotwGrassBuildCount,
  hasCachedSurvivalBotwGrassBuild,
  hasPendingSurvivalBotwGrassBuild,
  markPendingSurvivalBotwGrassBuild,
  rememberSurvivalBotwGrassBuild,
} from "./survivalBotwGrassBuildCache";
import {
  publishSurvivalBotwGrassPendingPrewarms,
  publishSurvivalBotwGrassPrewarmBuilding,
  publishSurvivalBotwGrassPrewarmReady,
} from "./survivalBotwGrassTelemetry";
import {
  getSurvivalBotwGrassElapsedMs,
  getSurvivalBotwGrassNowMs,
  shouldContinueSurvivalBotwGrassSlice,
} from "./survivalBotwGrassRuntime";

export function getSurvivalBotwGrassBuildKey(center: SurvivalBotwGrassCenter, mobilePerformanceMode: boolean) {
  return `${center.x}:${center.z}:${mobilePerformanceMode ? "m" : "d"}`;
}

export function publishSurvivalBotwGrassPendingPrewarmCount() {
  publishSurvivalBotwGrassPendingPrewarms(getPendingSurvivalBotwGrassBuildCount());
}

export function prewarmSurvivalBotwGrassBuild(
  center: SurvivalBotwGrassCenter,
  mobilePerformanceMode: boolean,
  maxPendingPrewarms = SURVIVAL_BOTW_GRASS_MAX_PENDING_PREWARMS,
) {
  if (typeof window === "undefined") return;
  const buildKey = getSurvivalBotwGrassBuildKey(center, mobilePerformanceMode);
  if (hasCachedSurvivalBotwGrassBuild(buildKey) || hasPendingSurvivalBotwGrassBuild(buildKey)) return;
  if (!markPendingSurvivalBotwGrassBuild(buildKey, maxPendingPrewarms)) return;

  publishSurvivalBotwGrassPendingPrewarmCount();
  const bladeContext = getSurvivalBotwGrassBuildContext(center.x, center.y, center.z, mobilePerformanceMode);
  const flowerContext = getSurvivalBotwFlowerBuildContext(center.x, center.y, center.z, mobilePerformanceMode);
  const bladeInstances: SurvivalBotwGrassBladeInstance[] = [];
  const flowerInstances: SurvivalBotwFlowerInstance[] = [];
  const candidateSliceLimit = mobilePerformanceMode
    ? SURVIVAL_BOTW_GRASS_BUILD_MOBILE_SLICE_CANDIDATES
    : SURVIVAL_BOTW_GRASS_BUILD_DESKTOP_SLICE_CANDIDATES;
  const sliceBudgetMs = mobilePerformanceMode
    ? SURVIVAL_BOTW_GRASS_BUILD_MOBILE_SLICE_MS
    : SURVIVAL_BOTW_GRASS_BUILD_DESKTOP_SLICE_MS;
  const startedAt = getSurvivalBotwGrassNowMs();
  let bladeCandidate = 0;
  let flowerCandidate = 0;

  const runSlice = () => {
    const sliceStartedAt = getSurvivalBotwGrassNowMs();
    let workCount = 0;
    while (
      bladeCandidate < bladeContext.candidateCount &&
      bladeInstances.length < bladeContext.maxInstances &&
      workCount < candidateSliceLimit &&
      shouldContinueSurvivalBotwGrassSlice(workCount, sliceStartedAt, sliceBudgetMs)
    ) {
      const instance = makeSurvivalBotwGrassBladeCandidate(bladeContext, bladeCandidate);
      if (instance) bladeInstances.push(instance);
      bladeCandidate += 1;
      workCount += 1;
    }

    while (
      flowerCandidate < flowerContext.candidateCount &&
      flowerInstances.length < flowerContext.maxFlowers &&
      workCount < candidateSliceLimit &&
      shouldContinueSurvivalBotwGrassSlice(workCount, sliceStartedAt, sliceBudgetMs)
    ) {
      const instance = makeSurvivalBotwFlowerCandidate(flowerContext, flowerCandidate);
      if (instance) flowerInstances.push(instance);
      flowerCandidate += 1;
      workCount += 1;
    }

    const doneBlades = bladeCandidate >= bladeContext.candidateCount || bladeInstances.length >= bladeContext.maxInstances;
    const doneFlowers = flowerCandidate >= flowerContext.candidateCount || flowerInstances.length >= flowerContext.maxFlowers;
    if (doneBlades && doneFlowers) {
      appendSurvivalBotwTallFeatureFlowers(flowerInstances, flowerContext);
      finishPendingSurvivalBotwGrassBuild(buildKey);
      publishSurvivalBotwGrassPendingPrewarmCount();
      const buildMs = getSurvivalBotwGrassElapsedMs(startedAt);
      rememberSurvivalBotwGrassBuild(buildKey, {
        bladeInstances,
        flowerInstances,
        buildMs,
      });
      publishSurvivalBotwGrassPrewarmReady(buildKey, buildMs);
      return;
    }

    window.setTimeout(runSlice, SURVIVAL_BOTW_GRASS_BUILD_SLICE_DELAY_MS);
  };

  publishSurvivalBotwGrassPrewarmBuilding(buildKey);
  window.setTimeout(runSlice, SURVIVAL_BOTW_GRASS_BUILD_SLICE_DELAY_MS);
}
