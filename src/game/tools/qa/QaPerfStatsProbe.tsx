import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLazyRef } from "../../systems/react/useLazyRef";
import { shouldMountCurrentQaPerfStatsProbe } from "./appQaTelemetryRoutes";
import {
  QA_PERF_RECENT_SAMPLE_COUNT,
  QA_PERF_SAMPLE_CAPACITY,
  clearQaPerfStatsDataset,
  getQaPerfStatsEpochNowMs,
  getQaPerfStatsFrameNowMs,
  publishQaPerfStatsDataset,
  selectQaPerfSampleByRank,
} from "./qaPerfStatsRuntime";

function isQaPerfStatsProbeEnabled() {
  return shouldMountCurrentQaPerfStatsProbe();
}

export function QaPerfStatsProbe() {
  const enabled = useMemo(isQaPerfStatsProbeEnabled, []);
  if (!enabled) return null;

  return <QaPerfStatsSampler />;
}

function QaPerfStatsSampler() {
  const startedAtRef = useRef(getQaPerfStatsEpochNowMs());
  const samplesRef = useLazyRef<number[]>(() => []);
  const sampleScratchRef = useLazyRef<number[]>(() => []);
  const sampleWriteIndexRef = useRef(0);
  const sampleCountRef = useRef(0);
  const lastPublishRef = useRef(0);

  const publishSample = useCallback((sampleMs: number, elapsedSeconds: number) => {
    if (!Number.isFinite(sampleMs) || sampleMs <= 0) return;

    const samples = samplesRef.current;
    samples[sampleWriteIndexRef.current] = sampleMs;
    sampleWriteIndexRef.current = (sampleWriteIndexRef.current + 1) % QA_PERF_SAMPLE_CAPACITY;
    sampleCountRef.current = Math.min(QA_PERF_SAMPLE_CAPACITY, sampleCountRef.current + 1);
    if (elapsedSeconds - lastPublishRef.current < 1) return;
    lastPublishRef.current = elapsedSeconds;

    const sampleCount = sampleCountRef.current;
    const scratch = sampleScratchRef.current;
    scratch.length = sampleCount;
    let sum = 0;
    let max = 0;
    let stutter50Count = 0;
    let stutter100Count = 0;
    for (let index = 0; index < sampleCount; index += 1) {
      const value = samples[index] ?? 0;
      scratch[index] = value;
      sum += value;
      if (value > max) max = value;
      if (value >= 50) stutter50Count += 1;
      if (value >= 100) stutter100Count += 1;
    }
    const p95 = selectQaPerfSampleByRank(
      scratch,
      sampleCount,
      Math.min(sampleCount - 1, Math.floor(sampleCount * 0.95)),
    );
    const recentCount = Math.min(QA_PERF_RECENT_SAMPLE_COUNT, sampleCount);
    let recentMax = 0;
    for (let offset = 0; offset < recentCount; offset += 1) {
      const index = (sampleWriteIndexRef.current - 1 - offset + QA_PERF_SAMPLE_CAPACITY) % QA_PERF_SAMPLE_CAPACITY;
      recentMax = Math.max(recentMax, samples[index] ?? 0);
    }
    const stats = {
      averageMs: sampleCount ? Number((sum / sampleCount).toFixed(2)) : 0,
      frames: sampleCount,
      maxMs: Number(max.toFixed(2)),
      p95Ms: Number(p95.toFixed(2)),
      recentMaxMs: Number(recentMax.toFixed(2)),
      stutter50Count,
      stutter100Count,
      startedAtMs: startedAtRef.current,
      updatedAtMs: getQaPerfStatsEpochNowMs(),
    };
    publishQaPerfStatsDataset(stats);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.wofPerfProbeEnabled = "1";

    const resetStats = () => {
      startedAtRef.current = getQaPerfStatsEpochNowMs();
      samplesRef.current.length = 0;
      sampleScratchRef.current.length = 0;
      sampleWriteIndexRef.current = 0;
      sampleCountRef.current = 0;
      lastPublishRef.current = 0;
      clearQaPerfStatsDataset();
    };

    window.addEventListener("wof-reset-perf-stats", resetStats);
    let raf = 0;
    let lastFrameTime = getQaPerfStatsFrameNowMs();
    const firstFrameTime = lastFrameTime;
    const tick = (now: number) => {
      document.documentElement.dataset.wofPerfProbeFrameHook = "raf";
      publishSample(now - lastFrameTime, (now - firstFrameTime) / 1000);
      lastFrameTime = now;
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    let fallbackTimeout = 0;
    let cancelled = false;
    const checkFallbackFrame = () => {
      const now = getQaPerfStatsFrameNowMs();
      if (now - lastFrameTime >= 950) {
        document.documentElement.dataset.wofPerfProbeFrameHook = "timeout";
        publishSample(now - lastFrameTime, (now - firstFrameTime) / 1000);
        lastFrameTime = now;
      }
      if (!cancelled) {
        fallbackTimeout = window.setTimeout(checkFallbackFrame, 1000);
      }
    };
    fallbackTimeout = window.setTimeout(checkFallbackFrame, 1000);

    return () => {
      cancelled = true;
      delete document.documentElement.dataset.wofPerfProbeEnabled;
      delete document.documentElement.dataset.wofPerfProbeFrameHook;
      window.cancelAnimationFrame(raf);
      window.clearTimeout(fallbackTimeout);
      window.removeEventListener("wof-reset-perf-stats", resetStats);
    };
  }, [publishSample]);

  return null;
}
