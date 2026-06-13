import {
  EMPTY_QA_TELEMETRY_ROUTE_FLAGS,
  isQaTelemetryRouteFlagEnabled,
  resolveQaTelemetryRouteFlagsFromParams,
  type QaTelemetryRoute,
  type QaTelemetryRouteFlags,
} from "./qaRouteTelemetryRuntime";

export type { QaTelemetryRoute, QaTelemetryRouteFlags } from "./qaRouteTelemetryRuntime";

let cachedSearch = "";
let cachedRouteFlags: QaTelemetryRouteFlags = EMPTY_QA_TELEMETRY_ROUTE_FLAGS;
let cachedParamsSearch = "";
let cachedParams: URLSearchParams | null = null;

function getQaRouteSearchParams(search: string) {
  if (cachedParams && cachedParamsSearch === search) return cachedParams;
  cachedParamsSearch = search;
  cachedParams = new URLSearchParams(search);
  return cachedParams;
}

function getQaTelemetryRouteFlags(search: string) {
  if (search === cachedSearch) return cachedRouteFlags;

  cachedSearch = search;
  const params = getQaRouteSearchParams(search);
  cachedRouteFlags = resolveQaTelemetryRouteFlagsFromParams(params);

  return cachedRouteFlags;
}

export function getQaRouteParamFromSearch(search: string, name: string) {
  return getQaRouteSearchParams(search).get(name);
}

export function hasQaRouteParamFromSearch(search: string, name: string) {
  return getQaRouteSearchParams(search).has(name);
}

export function getCurrentQaRouteParam(name: string) {
  if (typeof window === "undefined") return null;
  return getQaRouteParamFromSearch(window.location.search, name);
}

export function hasCurrentQaRouteParam(name: string) {
  if (typeof window === "undefined") return false;
  return hasQaRouteParamFromSearch(window.location.search, name);
}

export function isQaTelemetryRouteEnabledFromSearch(search: string, routes: readonly QaTelemetryRoute[]) {
  return isQaTelemetryRouteFlagEnabled(getQaTelemetryRouteFlags(search), routes);
}

export function isCurrentQaTelemetryRouteEnabled(routes: readonly QaTelemetryRoute[]) {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  return isQaTelemetryRouteEnabledFromSearch(window.location.search, routes);
}
