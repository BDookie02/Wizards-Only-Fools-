import {
  isCurrentQaTelemetryRouteEnabled,
  isQaTelemetryRouteEnabledFromSearch,
  type QaTelemetryRoute,
} from "../../../tools/qa/qaRouteTelemetry";

const CANVAS_RUNTIME_PROBE_ROUTES: readonly QaTelemetryRoute[] = ["perf", "hud", "aspect", "canvas"];

export function shouldMountCanvasRuntimeProbeFromSearch(search: string) {
  return isQaTelemetryRouteEnabledFromSearch(search, CANVAS_RUNTIME_PROBE_ROUTES);
}

export function shouldMountCurrentCanvasRuntimeProbe() {
  return isCurrentQaTelemetryRouteEnabled(CANVAS_RUNTIME_PROBE_ROUTES);
}
