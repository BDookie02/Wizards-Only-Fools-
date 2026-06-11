import { useCallback, useEffect, useMemo, useRef } from "react";
import { shouldMountCurrentQaPerfStatsProbe } from "./appQaTelemetryRoutes";

type WofPerfStats = {
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

const PERF_SAMPLE_CAPACITY = 720;
const PERF_RECENT_SAMPLE_COUNT = 120;

function isQaPerfStatsProbeEnabled() {
  return shouldMountCurrentQaPerfStatsProbe();
}

export function QaPerfStatsProbe() {
  const enabled = useMemo(isQaPerfStatsProbeEnabled, []);
  if (!enabled) return null;

  return <QaPerfStatsSampler />;
}

function QaPerfStatsSampler() {
  const startedAtRef = useRef(Date.now());
  const samplesRef = useRef<number[]>([]);
  const sortedSamplesRef = useRef<number[]>([]);
  const sampleWriteIndexRef = useRef(0);
  const sampleCountRef = useRef(0);
  const lastPublishRef = useRef(0);

  const publishSample = useCallback((sampleMs: number, elapsedSeconds: number) => {
    if (!Number.isFinite(sampleMs) || sampleMs <= 0) return;

    const samples = samplesRef.current;
    samples[sampleWriteIndexRef.current] = sampleMs;
    sampleWriteIndexRef.current = (sampleWriteIndexRef.current + 1) % PERF_SAMPLE_CAPACITY;
    sampleCountRef.current = Math.min(PERF_SAMPLE_CAPACITY, sampleCountRef.current + 1);
    if (elapsedSeconds - lastPublishRef.current < 1) return;
    lastPublishRef.current = elapsedSeconds;

    const sampleCount = sampleCountRef.current;
    const sorted = sortedSamplesRef.current;
    sorted.length = sampleCount;
    let sum = 0;
    let stutter50Count = 0;
    let stutter100Count = 0;
    for (let index = 0; index < sampleCount; index += 1) {
      const value = samples[index] ?? 0;
      sorted[index] = value;
      sum += value;
      if (value >= 50) stutter50Count += 1;
      if (value >= 100) stutter100Count += 1;
    }
    sorted.sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
    const recentCount = Math.min(PERF_RECENT_SAMPLE_COUNT, sampleCount);
    let recentMax = 0;
    for (let offset = 0; offset < recentCount; offset += 1) {
      const index = (sampleWriteIndexRef.current - 1 - offset + PERF_SAMPLE_CAPACITY) % PERF_SAMPLE_CAPACITY;
      recentMax = Math.max(recentMax, samples[index] ?? 0);
    }
    const stats = {
      averageMs: sampleCount ? Number((sum / sampleCount).toFixed(2)) : 0,
      frames: sampleCount,
      maxMs: Number((sorted[sorted.length - 1] ?? 0).toFixed(2)),
      p95Ms: Number(p95.toFixed(2)),
      recentMaxMs: Number(recentMax.toFixed(2)),
      stutter50Count,
      stutter100Count,
      startedAtMs: startedAtRef.current,
      updatedAtMs: Date.now(),
    };
    window.__wofPerfStats = stats;
    document.documentElement.dataset.wofPerfAverageMs = String(stats.averageMs);
    document.documentElement.dataset.wofPerfP95Ms = String(stats.p95Ms);
    document.documentElement.dataset.wofPerfMaxMs = String(stats.maxMs);
    document.documentElement.dataset.wofPerfRecentMaxMs = String(stats.recentMaxMs);
    document.documentElement.dataset.wofPerfStutter50 = String(stats.stutter50Count);
    document.documentElement.dataset.wofPerfStutter100 = String(stats.stutter100Count);
    document.documentElement.dataset.wofPerfFrames = String(stats.frames);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.wofPerfProbeEnabled = "1";

    const resetStats = () => {
      startedAtRef.current = Date.now();
      samplesRef.current = [];
      sortedSamplesRef.current.length = 0;
      sampleWriteIndexRef.current = 0;
      sampleCountRef.current = 0;
      lastPublishRef.current = 0;
      window.__wofPerfStats = undefined;
      delete document.documentElement.dataset.wofPerfAverageMs;
      delete document.documentElement.dataset.wofPerfP95Ms;
      delete document.documentElement.dataset.wofPerfMaxMs;
      delete document.documentElement.dataset.wofPerfRecentMaxMs;
      delete document.documentElement.dataset.wofPerfStutter50;
      delete document.documentElement.dataset.wofPerfStutter100;
      delete document.documentElement.dataset.wofPerfFrames;
    };

    window.addEventListener("wof-reset-perf-stats", resetStats);
    let raf = 0;
    let lastFrameTime = performance.now();
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
      const now = performance.now();
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
