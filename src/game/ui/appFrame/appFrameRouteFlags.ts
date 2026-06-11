export type AppFrameRouteFlags = {
  voiceChatRequested: boolean;
  qaPerfStatsRequested: boolean;
  survivalQaObserverRequested: boolean;
  publishQaMetrics: boolean;
};

const EMPTY_APP_FRAME_ROUTE_FLAGS: AppFrameRouteFlags = {
  voiceChatRequested: false,
  qaPerfStatsRequested: false,
  survivalQaObserverRequested: false,
  publishQaMetrics: false,
};

let cachedAppFrameRouteSearch = "";
let cachedAppFrameRouteFlags: AppFrameRouteFlags = EMPTY_APP_FRAME_ROUTE_FLAGS;

function hasSurvivalQaParam(params: URLSearchParams) {
  for (const key of params.keys()) {
    if (key.startsWith("qaSurvival")) return true;
  }
  return false;
}

export function readAppFrameRouteFlagsFromSearch(search: string): AppFrameRouteFlags {
  if (search === cachedAppFrameRouteSearch) return cachedAppFrameRouteFlags;

  try {
    const params = new URLSearchParams(search);
    const survivalQaParamPresent = hasSurvivalQaParam(params);
    const qaPerfStatsRequested = params.get("qaPerfStats") === "1";

    cachedAppFrameRouteSearch = search;
    cachedAppFrameRouteFlags = {
      voiceChatRequested:
        params.has("voiceAutoStart") ||
        params.has("voiceSoundboard") ||
        params.has("voiceTest"),
      qaPerfStatsRequested,
      survivalQaObserverRequested:
        params.get("qaSurvival") === "1" ||
        params.has("qaSurvivalChunk") ||
        params.get("qaSpellDummies") === "1" ||
        params.get("spawnMountain") === "1" ||
        params.get("spawnGraveyard") === "1",
      publishQaMetrics:
        qaPerfStatsRequested ||
        params.get("qaHudLayout") === "1" ||
        params.get("qaAspectMatrix") === "1" ||
        params.get("qaTouchLayout") === "1" ||
        params.get("mobilePerf") === "1" ||
        params.get("qaCanvasRuntime") === "1" ||
        params.get("spawnMountain") === "1" ||
        survivalQaParamPresent,
    };
    return cachedAppFrameRouteFlags;
  } catch {
    cachedAppFrameRouteSearch = search;
    cachedAppFrameRouteFlags = EMPTY_APP_FRAME_ROUTE_FLAGS;
    return EMPTY_APP_FRAME_ROUTE_FLAGS;
  }
}

export function readCurrentAppFrameRouteFlags() {
  if (typeof window === "undefined") return EMPTY_APP_FRAME_ROUTE_FLAGS;
  return readAppFrameRouteFlagsFromSearch(window.location.search);
}
