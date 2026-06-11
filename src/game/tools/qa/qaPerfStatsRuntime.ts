export type WofPerfStats = {
  averageMs: number;
  frames: number;
  maxMs: number;
  p95Ms: number;
  recentMaxMs: number;
  stutter50Count: number;
  stutter100Count: number;
  startedAtMs: number;
  updatedAtMs: number;
};

declare global {
  interface Window {
    __wofPerfStats?: WofPerfStats;
  }
}

export const QA_PERF_SAMPLE_CAPACITY = 720;
export const QA_PERF_RECENT_SAMPLE_COUNT = 120;

export function selectQaPerfSampleByRank(
  samples: number[],
  count: number,
  targetIndex: number,
) {
  const sampleCount = Math.max(0, Math.min(count, samples.length));
  if (sampleCount === 0) return 0;

  const target = Math.max(0, Math.min(sampleCount - 1, targetIndex));
  let left = 0;
  let right = sampleCount - 1;

  while (left < right) {
    const pivot = samples[(left + right) >> 1];
    let low = left;
    let high = right;

    while (low <= high) {
      while (samples[low] < pivot) low += 1;
      while (samples[high] > pivot) high -= 1;
      if (low <= high) {
        const nextLow = samples[low];
        samples[low] = samples[high];
        samples[high] = nextLow;
        low += 1;
        high -= 1;
      }
    }

    if (target <= high) {
      right = high;
    } else if (target >= low) {
      left = low;
    } else {
      return samples[target] ?? 0;
    }
  }

  return samples[left] ?? 0;
}

export function publishQaPerfStatsDataset(stats: WofPerfStats) {
  window.__wofPerfStats = stats;
  document.documentElement.dataset.wofPerfAverageMs = String(stats.averageMs);
  document.documentElement.dataset.wofPerfP95Ms = String(stats.p95Ms);
  document.documentElement.dataset.wofPerfMaxMs = String(stats.maxMs);
  document.documentElement.dataset.wofPerfRecentMaxMs = String(stats.recentMaxMs);
  document.documentElement.dataset.wofPerfStutter50 = String(stats.stutter50Count);
  document.documentElement.dataset.wofPerfStutter100 = String(stats.stutter100Count);
  document.documentElement.dataset.wofPerfFrames = String(stats.frames);
}

export function clearQaPerfStatsDataset() {
  window.__wofPerfStats = undefined;
  delete document.documentElement.dataset.wofPerfAverageMs;
  delete document.documentElement.dataset.wofPerfP95Ms;
  delete document.documentElement.dataset.wofPerfMaxMs;
  delete document.documentElement.dataset.wofPerfRecentMaxMs;
  delete document.documentElement.dataset.wofPerfStutter50;
  delete document.documentElement.dataset.wofPerfStutter100;
  delete document.documentElement.dataset.wofPerfFrames;
}
