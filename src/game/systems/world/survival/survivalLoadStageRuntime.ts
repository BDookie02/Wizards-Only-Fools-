export function getSurvivalLoadStageNowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
