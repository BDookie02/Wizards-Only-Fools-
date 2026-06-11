export type SurvivalGrassDebugSampleResolver = (worldX: number, worldZ: number) => unknown;

export function isSurvivalGrassInspectionView() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("qaGrassView") === "1";
}

export function installSurvivalGrassDebugSampler(resolveSample: SurvivalGrassDebugSampleResolver) {
  if (typeof window === "undefined") return undefined;
  const debugWindow = window as typeof window & {
    __wofSurvivalGrassDebugAt?: SurvivalGrassDebugSampleResolver;
  };
  debugWindow.__wofSurvivalGrassDebugAt = resolveSample;
  document.documentElement.dataset.wofSurvivalGrassDebugSampler = "1";

  return () => {
    if (debugWindow.__wofSurvivalGrassDebugAt === resolveSample) {
      delete debugWindow.__wofSurvivalGrassDebugAt;
      document.documentElement.dataset.wofSurvivalGrassDebugSampler = "0";
    }
  };
}
