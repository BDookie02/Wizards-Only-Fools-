import { shouldPublishCurrentGameWorldModeTelemetry } from "../../tools/qa/appQaTelemetryRoutes";

function shouldPublishGameWorldModeTelemetry() {
  return shouldPublishCurrentGameWorldModeTelemetry();
}

export function publishGameWorldModeTelemetry(gameMode: string, isSurvivalMode: boolean) {
  if (!shouldPublishGameWorldModeTelemetry()) return;
  document.documentElement.dataset.wofGameWorldMode = gameMode;
  document.documentElement.dataset.wofGameWorldSurvivalMode = String(isSurvivalMode);
}
