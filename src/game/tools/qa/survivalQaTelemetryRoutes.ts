import {
  isCurrentQaTelemetryRouteEnabled,
  isQaTelemetryRouteEnabledFromSearch,
  type QaTelemetryRoute,
} from "./qaRouteTelemetry";

const SURVIVAL_WORLD_TELEMETRY_ROUTES: readonly QaTelemetryRoute[] = [
  "perf",
  "canvas",
  "grass",
  "touch",
  "mountain",
  "survival",
];
const SURVIVAL_FEATURE_COUNTER_ROUTES: readonly QaTelemetryRoute[] = [
  "perf",
  "hud",
  "aspect",
  "canvas",
  "touch",
  "mountain",
  "grass",
  "survival",
];
const SURVIVAL_DESERT_LANDMARK_TELEMETRY_ROUTES: readonly QaTelemetryRoute[] = [
  "perf",
  "canvas",
  "grass",
  "survival",
];
const SURVIVAL_MOUNTAIN_SLOPE_GRASS_TELEMETRY_ROUTES: readonly QaTelemetryRoute[] = [
  "perf",
  "canvas",
  "grass",
  "mountain",
  "survival",
];

export function shouldPublishCurrentSurvivalWorldTelemetry() {
  return isCurrentQaTelemetryRouteEnabled(SURVIVAL_WORLD_TELEMETRY_ROUTES);
}

export function shouldPublishSurvivalWorldTelemetryFromSearch(search: string) {
  return isQaTelemetryRouteEnabledFromSearch(search, SURVIVAL_WORLD_TELEMETRY_ROUTES);
}

export function shouldPublishCurrentSurvivalFeatureCounters() {
  return isCurrentQaTelemetryRouteEnabled(SURVIVAL_FEATURE_COUNTER_ROUTES);
}

export function shouldPublishCurrentSurvivalDesertLandmarkTelemetry() {
  return isCurrentQaTelemetryRouteEnabled(SURVIVAL_DESERT_LANDMARK_TELEMETRY_ROUTES);
}

export function shouldPublishCurrentMountainSlopeGrassTelemetry() {
  return isCurrentQaTelemetryRouteEnabled(SURVIVAL_MOUNTAIN_SLOPE_GRASS_TELEMETRY_ROUTES);
}
