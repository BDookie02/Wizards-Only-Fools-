import {
  isCurrentQaTelemetryRouteEnabled,
  isQaTelemetryRouteEnabledFromSearch,
  type QaTelemetryRoute,
} from "./qaRouteTelemetry";

const APP_FRAME_QA_METRIC_ROUTES: readonly QaTelemetryRoute[] = [
  "perf",
  "hud",
  "aspect",
  "touch",
  "mobilePerf",
  "canvas",
  "mountain",
  "survival",
];
const GAME_WORLD_MODE_TELEMETRY_ROUTES: readonly QaTelemetryRoute[] = [
  "perf",
  "canvas",
  "hud",
  "aspect",
  "touch",
  "mountain",
  "survival",
];
const HUD_LAYOUT_QA_METRIC_ROUTES: readonly QaTelemetryRoute[] = ["hud", "aspect"];
const ASPECT_RATIO_QA_MATRIX_ROUTES: readonly QaTelemetryRoute[] = ["aspect"];
const QA_PERF_STATS_PROBE_ROUTES: readonly QaTelemetryRoute[] = ["perf"];

export function shouldPublishAppFrameQaMetricsFromSearch(search: string) {
  return isQaTelemetryRouteEnabledFromSearch(search, APP_FRAME_QA_METRIC_ROUTES);
}

export function shouldPublishCurrentGameWorldModeTelemetry() {
  return isCurrentQaTelemetryRouteEnabled(GAME_WORLD_MODE_TELEMETRY_ROUTES);
}

export function shouldPublishCurrentHudLayoutQaMetrics() {
  return isCurrentQaTelemetryRouteEnabled(HUD_LAYOUT_QA_METRIC_ROUTES);
}

export function isCurrentAspectRatioQaMatrixRouteEnabled() {
  return isCurrentQaTelemetryRouteEnabled(ASPECT_RATIO_QA_MATRIX_ROUTES);
}

export function shouldMountCurrentQaPerfStatsProbe() {
  return isCurrentQaTelemetryRouteEnabled(QA_PERF_STATS_PROBE_ROUTES);
}
