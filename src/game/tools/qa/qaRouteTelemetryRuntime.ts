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

export type QaTelemetryRouteFlags = Record<QaTelemetryRoute, boolean>;

export const EMPTY_QA_TELEMETRY_ROUTE_FLAGS: QaTelemetryRouteFlags = {
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

export function hasSurvivalQaParam(params: URLSearchParams) {
  for (const key of params.keys()) {
    if (key.startsWith("qaSurvival")) return true;
  }

  return false;
}

export function resolveQaTelemetryRouteFlagsFromParams(params: URLSearchParams): QaTelemetryRouteFlags {
  return {
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
}

export function resolveQaTelemetryRouteFlagsFromSearch(search: string) {
  return resolveQaTelemetryRouteFlagsFromParams(new URLSearchParams(search));
}

export function isQaTelemetryRouteFlagEnabled(flags: QaTelemetryRouteFlags, routes: readonly QaTelemetryRoute[]) {
  for (const route of routes) {
    if (flags[route]) return true;
  }

  return false;
}
