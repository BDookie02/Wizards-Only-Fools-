export type HudQaRouteFlags = {
  qaHudState: string;
  shouldMountHudStateQaRuntimeProbe: boolean;
  qaMagicSpell: string;
  qaMapPage: string;
  qaSettingsPane: string;
  shouldMountHudLayoutQaMetricsProbe: boolean;
  isMenuOverlaySuppressedForQa: boolean;
  shouldHideGameplayViewObstructionsForQa: boolean;
  shouldHideGameplayHudForQa: boolean;
};

const EMPTY_HUD_QA_ROUTE_FLAGS: HudQaRouteFlags = {
  qaHudState: "",
  shouldMountHudStateQaRuntimeProbe: false,
  qaMagicSpell: "",
  qaMapPage: "",
  qaSettingsPane: "",
  shouldMountHudLayoutQaMetricsProbe: false,
  isMenuOverlaySuppressedForQa: false,
  shouldHideGameplayViewObstructionsForQa: false,
  shouldHideGameplayHudForQa: false,
};

let cachedHudQaRouteSearch = "";
let cachedHudQaRouteFlags: HudQaRouteFlags = EMPTY_HUD_QA_ROUTE_FLAGS;

function getLowerRouteParam(params: URLSearchParams, name: string) {
  return params.get(name)?.trim().toLowerCase() ?? "";
}

export function readHudQaRouteFlagsFromSearch(search: string): HudQaRouteFlags {
  if (search === cachedHudQaRouteSearch) return cachedHudQaRouteFlags;

  const params = new URLSearchParams(search);
  const qaHudState = getLowerRouteParam(params, "qaHudState");
  const shouldHideGameplayViewObstructionsForQa =
    params.get("qaHideMenu") === "1" ||
    params.get("qaHideHands") === "1" ||
    params.get("qaCleanView") === "1" ||
    params.get("qaGrassView") === "1";
  const shouldHideGameplayHudForQa =
    params.get("qaCleanView") === "1" ||
    params.get("qaGrassView") === "1";

  cachedHudQaRouteSearch = search;
  cachedHudQaRouteFlags = {
    qaHudState,
    shouldMountHudStateQaRuntimeProbe: Boolean(qaHudState),
    qaMagicSpell: getLowerRouteParam(params, "qaMagicSpell"),
    qaMapPage: getLowerRouteParam(params, "qaMapPage"),
    qaSettingsPane: getLowerRouteParam(params, "qaSettingsPane"),
    shouldMountHudLayoutQaMetricsProbe:
      params.get("qaHudLayout") === "1" ||
      params.get("qaAspectMatrix") === "1",
    isMenuOverlaySuppressedForQa:
      params.get("qaHideMenu") === "1" ||
      params.get("qaSurvivalWalk") === "1" ||
      params.get("qaPerfStats") === "1" ||
      params.get("qaSurvival") === "1" ||
      params.has("qaSurvivalChunk"),
    shouldHideGameplayViewObstructionsForQa,
    shouldHideGameplayHudForQa,
  };

  return cachedHudQaRouteFlags;
}

export function readCurrentHudQaRouteFlags(): HudQaRouteFlags {
  if (typeof window === "undefined" || !import.meta.env.DEV) return EMPTY_HUD_QA_ROUTE_FLAGS;
  return readHudQaRouteFlagsFromSearch(window.location.search);
}
