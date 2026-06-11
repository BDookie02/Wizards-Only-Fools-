import { DAY_NIGHT_CYCLE_SECONDS } from "../../../../store/gameStore";

export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function smoothstepRange(edge0: number, edge1: number, value: number) {
  const t = clamp01((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function getSurvivalDayNightCycle(elapsedSeconds: number) {
  const phase = ((elapsedSeconds / DAY_NIGHT_CYCLE_SECONDS) + 0.18) % 1;
  const sunAngle = phase * Math.PI * 2;
  const sunHeight = Math.sin(sunAngle);
  const dayAmount = smoothstepRange(-0.12, 0.34, sunHeight);
  const nightAmount = 1 - smoothstepRange(-0.36, 0.08, sunHeight);
  const duskAmount = 1 - smoothstepRange(0.02, 0.48, Math.abs(sunHeight));

  return { phase, sunAngle, sunHeight, dayAmount, nightAmount, duskAmount };
}

export function getQaSurvivalTimeOverrideSeconds() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("qaSurvivalTime") || params.get("qaTimeOfDay");
  if (!raw) return null;

  const value = raw.trim().toLowerCase();
  if (value === "day" || value === "noon") return DAY_NIGHT_CYCLE_SECONDS * 0.07;
  if (value === "night" || value === "midnight") return DAY_NIGHT_CYCLE_SECONDS * 0.57;

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, numericValue) : null;
}

export function getEffectiveSurvivalCycleElapsedSeconds(
  storeOverride: number | null,
  elapsedSeconds: number,
  qaRouteOverrideSeconds = getQaSurvivalTimeOverrideSeconds(),
) {
  return storeOverride ?? qaRouteOverrideSeconds ?? elapsedSeconds;
}
