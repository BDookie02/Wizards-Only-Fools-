export type QaTelemetryRoute =
  | "aspect"
  | "canvas"
  | "grass"
  | "hud"
  | "mobilePerf"
  | "mountain"
  | "perf"
  | "spellDummies"
  | "survival"
  | "touch"
  | "waterRipple";

type QaTelemetryRouteFlags = Record<QaTelemetryRoute, boolean>;

const EMPTY_QA_TELEMETRY_ROUTE_FLAGS: QaTelemetryRouteFlags = {
  aspect: false,
  canvas: false,
  grass: false,
  hud: false,
  mobilePerf: false,
  mountain: false,
  perf: false,
  spellDummies: false,
  survival: false,
  touch: false,
  waterRipple: false,
};

let cachedSearch = "";
let cachedRouteFlags: QaTelemetryRouteFlags = EMPTY_QA_TELEMETRY_ROUTE_FLAGS;

function hasSurvivalQaParam(params: URLSearchParams) {
  for (const key of params.keys()) {
    if (key.startsWith("qaSurvival")) return true;
  }

  return false;
}

function getQaTelemetryRouteFlags(search: string) {
  if (search === cachedSearch) return cachedRouteFlags;

  cachedSearch = search;
  const params = new URLSearchParams(search);
  cachedRouteFlags = {
    aspect: params.get("qaAspectMatrix") === "1",
    canvas: params.get("qaCanvasRuntime") === "1",
    grass: params.get("qaGrassView") === "1",
    hud: params.get("qaHudLayout") === "1",
    mobilePerf: params.get("mobilePerf") === "1",
    mountain: params.get("spawnMountain") === "1",
    perf: params.get("qaPerfStats") === "1",
    spellDummies: params.get("qaSpellDummies") === "1",
    survival: hasSurvivalQaParam(params),
    touch: params.get("qaTouchLayout") === "1",
    waterRipple: params.get("qaWaterRipple") === "1",
  };

  return cachedRouteFlags;
}

export function isQaTelemetryRouteEnabledFromSearch(search: string, routes: readonly QaTelemetryRoute[]) {
  const flags = getQaTelemetryRouteFlags(search);
  for (const route of routes) {
    if (flags[route]) return true;
  }

  return false;
}

export function isCurrentQaTelemetryRouteEnabled(routes: readonly QaTelemetryRoute[]) {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  return isQaTelemetryRouteEnabledFromSearch(window.location.search, routes);
}
