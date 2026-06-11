import { DAY_NIGHT_CYCLE_SECONDS } from "../../../../store/gameStore";

let cachedQaSurvivalTimeSearch: string | null = null;
let cachedQaSurvivalTimeOverrideSeconds: number | null = null;

export type SurvivalDayNightCycle = {
  phase: number;
  sunAngle: number;
  sunHeight: number;
  dayAmount: number;
  nightAmount: number;
  duskAmount: number;
};

export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function smoothstepRange(edge0: number, edge1: number, value: number) {
  const t = clamp01((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function createSurvivalDayNightCycle(): SurvivalDayNightCycle {
  return {
    phase: 0,
    sunAngle: 0,
    sunHeight: 0,
    dayAmount: 0,
    nightAmount: 0,
    duskAmount: 0,
  };
}

export function getSurvivalDayNightCycleInto(elapsedSeconds: number, target: SurvivalDayNightCycle) {
  const phase = ((elapsedSeconds / DAY_NIGHT_CYCLE_SECONDS) + 0.18) % 1;
  const sunAngle = phase * Math.PI * 2;
  const sunHeight = Math.sin(sunAngle);
  target.phase = phase;
  target.sunAngle = sunAngle;
  target.sunHeight = sunHeight;
  target.dayAmount = smoothstepRange(-0.12, 0.34, sunHeight);
  target.nightAmount = 1 - smoothstepRange(-0.36, 0.08, sunHeight);
  target.duskAmount = 1 - smoothstepRange(0.02, 0.48, Math.abs(sunHeight));
  return target;
}

export function getSurvivalDayNightCycle(elapsedSeconds: number) {
  return getSurvivalDayNightCycleInto(elapsedSeconds, createSurvivalDayNightCycle());
}

export function getQaSurvivalTimeOverrideSecondsFromSearch(search: string) {
  if (search === cachedQaSurvivalTimeSearch) return cachedQaSurvivalTimeOverrideSeconds;
  const params = new URLSearchParams(search);
  const raw = params.get("qaSurvivalTime") || params.get("qaTimeOfDay");
  if (!raw) {
    cachedQaSurvivalTimeSearch = search;
    cachedQaSurvivalTimeOverrideSeconds = null;
    return null;
  }

  const value = raw.trim().toLowerCase();
  let overrideSeconds: number | null = null;
  if (value === "day" || value === "noon") {
    overrideSeconds = DAY_NIGHT_CYCLE_SECONDS * 0.07;
  } else if (value === "night" || value === "midnight") {
    overrideSeconds = DAY_NIGHT_CYCLE_SECONDS * 0.57;
  } else {
    const numericValue = Number(value);
    overrideSeconds = Number.isFinite(numericValue) ? Math.max(0, numericValue) : null;
  }

  cachedQaSurvivalTimeSearch = search;
  cachedQaSurvivalTimeOverrideSeconds = overrideSeconds;
  return overrideSeconds;
}

export function getQaSurvivalTimeOverrideSeconds() {
  if (typeof window === "undefined") return null;
  return getQaSurvivalTimeOverrideSecondsFromSearch(window.location.search);
}

export function getEffectiveSurvivalCycleElapsedSeconds(
  storeOverride: number | null,
  elapsedSeconds: number,
  qaRouteOverrideSeconds = getQaSurvivalTimeOverrideSeconds(),
) {
  return storeOverride ?? qaRouteOverrideSeconds ?? elapsedSeconds;
}
