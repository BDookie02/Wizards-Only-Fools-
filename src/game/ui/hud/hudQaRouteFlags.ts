import {
  EMPTY_HUD_QA_ROUTE_FLAGS,
  resolveHudQaRouteFlagsFromSearch,
  type HudQaRouteFlags,
} from "./hudQaRouteFlagsRuntime";

export type { HudQaRouteFlags } from "./hudQaRouteFlagsRuntime";

let cachedHudQaRouteSearch = "";
let cachedHudQaRouteFlags: HudQaRouteFlags = EMPTY_HUD_QA_ROUTE_FLAGS;

export function readHudQaRouteFlagsFromSearch(search: string): HudQaRouteFlags {
  if (search === cachedHudQaRouteSearch) return cachedHudQaRouteFlags;

  cachedHudQaRouteSearch = search;
  cachedHudQaRouteFlags = resolveHudQaRouteFlagsFromSearch(search);

  return cachedHudQaRouteFlags;
}

export function readCurrentHudQaRouteFlags(): HudQaRouteFlags {
  if (typeof window === "undefined" || !import.meta.env.DEV) return EMPTY_HUD_QA_ROUTE_FLAGS;
  return readHudQaRouteFlagsFromSearch(window.location.search);
}
