import { useEffect, useMemo, useState } from "react";
import { isMobilePerformanceMode } from "../../input/performanceMode";
import type { SurvivalChunkInfo } from "./survivalWorldConfig";

export type SurvivalScheduledBackgroundTask = {
  cancel: () => void;
};

type ChunkLoadStageProfile = {
  desktopDelays: readonly number[];
  mobileDelays: readonly number[];
  desktopDistanceDelay: number;
  mobileDistanceDelay: number;
  desktopJitter: number;
  mobileJitter: number;
  salt: number;
};

const TREE_LOAD_STAGE_PROFILE: ChunkLoadStageProfile = {
  desktopDelays: [180, 560, 1320, 2280, 3600],
  mobileDelays: [280, 820, 1860, 3160, 4760],
  desktopDistanceDelay: 280,
  mobileDistanceDelay: 460,
  desktopJitter: 520,
  mobileJitter: 760,
  salt: 9011,
};

const GRAVEYARD_LOAD_STAGE_PROFILE: ChunkLoadStageProfile = {
  desktopDelays: [60, 160, 300, 500],
  mobileDelays: [130, 320, 560, 860],
  desktopDistanceDelay: 80,
  mobileDistanceDelay: 150,
  desktopJitter: 110,
  mobileJitter: 210,
  salt: 11901,
};

const GRASS_LOAD_STAGE_PROFILE: ChunkLoadStageProfile = {
  desktopDelays: [120, 360, 760, 1250],
  mobileDelays: [180, 480, 960, 1560],
  desktopDistanceDelay: 320,
  mobileDistanceDelay: 500,
  desktopJitter: 480,
  mobileJitter: 680,
  salt: 12701,
};

function survivalLoadHash01(x: number, z: number, salt = 0) {
  const n = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function getSurvivalGrassStreamScale(loadStage: number) {
  if (loadStage <= 0) return 0;
  if (loadStage === 1) return 0.22;
  if (loadStage === 2) return 0.45;
  if (loadStage === 3) return 0.72;
  return 1;
}

export function scheduleSurvivalBackgroundTask(callback: () => void, timeout = 900): SurvivalScheduledBackgroundTask {
  if (typeof window === "undefined") return { cancel: () => {} };

  const idleWindow = window as Window & {
    requestIdleCallback?: (handler: IdleRequestCallback, options?: IdleRequestOptions) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  if (typeof idleWindow.requestIdleCallback === "function") {
    const handle = idleWindow.requestIdleCallback(() => callback(), { timeout });
    return {
      cancel: () => {
        if (typeof idleWindow.cancelIdleCallback === "function") {
          idleWindow.cancelIdleCallback(handle);
        }
      },
    };
  }

  const handle = window.setTimeout(callback, Math.min(80, timeout));
  return { cancel: () => window.clearTimeout(handle) };
}

let survivalDecorationHeavyStageNextAt = 0;

function reserveSurvivalDecorationHeavyStageDelay(stage: number) {
  if (stage < 3 || typeof performance === "undefined") return 0;

  const now = performance.now();
  const spacing = stage >= 5
    ? 520
    : stage >= 4
      ? 360
      : 240;
  const scheduledAt = Math.max(now, survivalDecorationHeavyStageNextAt);
  survivalDecorationHeavyStageNextAt = scheduledAt + spacing;
  return Math.max(0, scheduledAt - now);
}

function useChunkDecorationLoadStage(chunk: SurvivalChunkInfo, profile: ChunkLoadStageProfile, resetOnDistance = true) {
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const maxStage = Math.max(profile.desktopDelays.length, profile.mobileDelays.length);
  const [stage, setStage] = useState(() => (typeof window === "undefined" ? maxStage : 0));
  const distanceDependency = resetOnDistance ? chunk.distance : -1;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let cancelled = false;
    setStage(0);

    const chunkJitter = survivalLoadHash01(chunk.cx, chunk.cz, profile.salt);
    const baseDelay = chunk.distance * (mobilePerformanceMode ? profile.mobileDistanceDelay : profile.desktopDistanceDelay)
      + chunkJitter * (mobilePerformanceMode ? profile.mobileJitter : profile.desktopJitter);
    const stageDelays = mobilePerformanceMode ? profile.mobileDelays : profile.desktopDelays;
    const backgroundTasks: SurvivalScheduledBackgroundTask[] = [];
    const timers: number[] = [];

    const requestStageUpdate = (nextStage: number) => {
      if (!cancelled) {
        backgroundTasks.push(scheduleSurvivalBackgroundTask(() => {
          if (!cancelled) {
            setStage((currentStage) => Math.max(currentStage, nextStage));
          }
        }, nextStage >= 3 ? 1300 : 850));
      }
    };

    for (let index = 0; index < stageDelays.length; index += 1) {
      const delay = stageDelays[index];
      const nextStage = index + 1;
      const timer = window.setTimeout(() => {
        if (cancelled) return;

        const queueDelay = reserveSurvivalDecorationHeavyStageDelay(nextStage);
        if (queueDelay > 0) {
          const queuedTimer = window.setTimeout(() => requestStageUpdate(nextStage), queueDelay);
          timers.push(queuedTimer);
          return;
        }

        requestStageUpdate(nextStage);
      }, baseDelay + delay);
      timers.push(timer);
    }

    return () => {
      cancelled = true;
      for (let index = 0; index < timers.length; index += 1) {
        window.clearTimeout(timers[index]);
      }
      for (let index = 0; index < backgroundTasks.length; index += 1) {
        backgroundTasks[index].cancel();
      }
    };
  }, [chunk.cx, chunk.cz, distanceDependency, mobilePerformanceMode, profile]);

  return stage;
}

export function useChunkTreeLoadStage(chunk: SurvivalChunkInfo) {
  return useChunkDecorationLoadStage(chunk, TREE_LOAD_STAGE_PROFILE, false);
}

export function useGraveyardLoadStage(chunk: SurvivalChunkInfo) {
  return useChunkDecorationLoadStage(chunk, GRAVEYARD_LOAD_STAGE_PROFILE);
}

export function useChunkGrassLoadStage(chunk: SurvivalChunkInfo) {
  return useChunkDecorationLoadStage(chunk, GRASS_LOAD_STAGE_PROFILE, false);
}
