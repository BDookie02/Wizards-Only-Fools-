const SURVIVAL_BOTW_GRASS_SLICE_CLOCK_CHECK_INTERVAL = 16;

export function getSurvivalBotwGrassNowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function shouldContinueSurvivalBotwGrassSlice(
  workCount: number,
  sliceStartedAt: number,
  sliceBudgetMs: number,
) {
  if (workCount === 0 || workCount % SURVIVAL_BOTW_GRASS_SLICE_CLOCK_CHECK_INTERVAL !== 0) return true;
  return getSurvivalBotwGrassNowMs() - sliceStartedAt < sliceBudgetMs;
}

export function getSurvivalBotwGrassElapsedMs(startedAt: number) {
  return getSurvivalBotwGrassNowMs() - startedAt;
}
