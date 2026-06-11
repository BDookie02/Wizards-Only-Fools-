import { isCurrentQaTelemetryRouteEnabled } from "../../tools/qa/qaRouteTelemetry";

function shouldPublishGameWorldModeTelemetry() {
  return isCurrentQaTelemetryRouteEnabled(["perf", "canvas", "hud", "aspect", "touch", "mountain", "survival"]);
}

export function publishGameWorldModeTelemetry(gameMode: string, isSurvivalMode: boolean) {
  if (!shouldPublishGameWorldModeTelemetry()) return;
  document.documentElement.dataset.wofGameWorldMode = gameMode;
  document.documentElement.dataset.wofGameWorldSurvivalMode = String(isSurvivalMode);
}
