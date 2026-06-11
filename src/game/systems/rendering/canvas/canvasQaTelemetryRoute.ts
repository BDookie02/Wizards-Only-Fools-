import {
  isCurrentQaTelemetryRouteEnabled,
  isQaTelemetryRouteEnabledFromSearch,
  type QaTelemetryRoute,
} from "../../../tools/qa/qaRouteTelemetry";

const CANVAS_RUNTIME_PROBE_ROUTES: readonly QaTelemetryRoute[] = ["perf", "hud", "aspect", "canvas"];
const CANVAS_LAYOUT_TELEMETRY_ROUTES: readonly QaTelemetryRoute[] = [
  "perf",
  "hud",
  "aspect",
  "canvas",
  "touch",
  "mountain",
  "survival",
];
const RESIZE_OBSERVER_TELEMETRY_ROUTES: readonly QaTelemetryRoute[] = [
  "perf",
  "hud",
  "aspect",
  "canvas",
  "touch",
  "spellDummies",
  "mountain",
  "survival",
];
const LOCAL_CANVAS_RESIZE_OBSERVER_FALLBACK_ROUTES: readonly QaTelemetryRoute[] = [
  "perf",
  "survival",
  "spellDummies",
  "touch",
  "mobilePerf",
  "mountain",
];

export function shouldMountCanvasRuntimeProbeFromSearch(search: string) {
  return isQaTelemetryRouteEnabledFromSearch(search, CANVAS_RUNTIME_PROBE_ROUTES);
}

export function shouldMountCurrentCanvasRuntimeProbe() {
  return isCurrentQaTelemetryRouteEnabled(CANVAS_RUNTIME_PROBE_ROUTES);
}

export function shouldPublishCanvasLayoutTelemetry() {
  return isCurrentQaTelemetryRouteEnabled(CANVAS_LAYOUT_TELEMETRY_ROUTES);
}

export function shouldPublishCanvasResizeObserverTelemetry() {
  return isCurrentQaTelemetryRouteEnabled(RESIZE_OBSERVER_TELEMETRY_ROUTES);
}

export function shouldForceLocalCanvasResizeObserverFallbackFromSearch(search: string) {
  return isQaTelemetryRouteEnabledFromSearch(search, LOCAL_CANVAS_RESIZE_OBSERVER_FALLBACK_ROUTES);
}
