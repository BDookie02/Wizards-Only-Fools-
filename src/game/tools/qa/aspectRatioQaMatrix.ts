import {
  getCurrentQaRouteParam,
  getQaRouteParamFromSearch,
} from "./qaRouteTelemetry";
import { isCurrentAspectRatioQaMatrixRouteEnabled } from "./appQaTelemetryRoutes";

export type AspectRatioQaProfile = {
  id: string;
  label: string;
  width: number;
  height: number;
  deviceClass: "pc" | "android" | "ios" | "tablet";
  expectedTouchLayout: boolean;
  expectedTouchControls: boolean;
  defaultParams: string;
};

export type AspectRatioHudQaState = {
  id: string;
  label: string;
  hudState: "" | "spell" | "settings" | "engine" | "map" | "inventory" | "scoreboard" | "questnpc" | "questdialog" | "magichands";
  settingsPane?: "video" | "keybinds" | "voice" | "character";
  mapPage?: "live" | "world";
  magicSpell?: string;
  expectedSurface: string;
};

export type AspectRatioHudQaRoute = {
  key: string;
  label: string;
  profileId: string;
  stateId: string;
  params: string;
};

export const ASPECT_RATIO_QA_PROFILES: AspectRatioQaProfile[] = [
  {
    id: "pc-16x9",
    label: "PC 16:9",
    width: 1366,
    height: 768,
    deviceClass: "pc",
    expectedTouchLayout: false,
    expectedTouchControls: false,
    defaultParams: "perf=quality&qaPerfStats=1&qaAspectMatrix=1&qaAspectProfile=pc-16x9",
  },
  {
    id: "pc-ultrawide",
    label: "PC Ultrawide",
    width: 2560,
    height: 1080,
    deviceClass: "pc",
    expectedTouchLayout: false,
    expectedTouchControls: false,
    defaultParams: "perf=quality&qaPerfStats=1&qaAspectMatrix=1&qaAspectProfile=pc-ultrawide",
  },
  {
    id: "android-portrait",
    label: "Android Portrait",
    width: 393,
    height: 873,
    deviceClass: "android",
    expectedTouchLayout: true,
    expectedTouchControls: false,
    defaultParams: "mobilePerf=1&qaTouchLayout=1&qaPerfStats=1&qaAspectMatrix=1&qaAspectProfile=android-portrait",
  },
  {
    id: "android-landscape",
    label: "Android Landscape",
    width: 873,
    height: 393,
    deviceClass: "android",
    expectedTouchLayout: true,
    expectedTouchControls: false,
    defaultParams: "mobilePerf=1&qaTouchLayout=1&qaPerfStats=1&qaAspectMatrix=1&qaAspectProfile=android-landscape",
  },
  {
    id: "ios-portrait",
    label: "iPhone Portrait",
    width: 390,
    height: 844,
    deviceClass: "ios",
    expectedTouchLayout: true,
    expectedTouchControls: false,
    defaultParams: "mobilePerf=1&qaTouchLayout=1&qaPerfStats=1&qaAspectMatrix=1&qaAspectProfile=ios-portrait",
  },
  {
    id: "ios-landscape",
    label: "iPhone Landscape",
    width: 844,
    height: 390,
    deviceClass: "ios",
    expectedTouchLayout: true,
    expectedTouchControls: false,
    defaultParams: "mobilePerf=1&qaTouchLayout=1&qaPerfStats=1&qaAspectMatrix=1&qaAspectProfile=ios-landscape",
  },
  {
    id: "tablet-landscape",
    label: "Tablet Landscape",
    width: 1024,
    height: 768,
    deviceClass: "tablet",
    expectedTouchLayout: true,
    expectedTouchControls: false,
    defaultParams: "mobilePerf=1&qaTouchLayout=1&qaPerfStats=1&qaAspectMatrix=1&qaAspectProfile=tablet-landscape",
  },
];

export const ASPECT_RATIO_HUD_QA_STATES: AspectRatioHudQaState[] = [
  {
    id: "gameplay",
    label: "Gameplay HUD",
    hudState: "",
    expectedSurface: "gameplay-hud",
  },
  {
    id: "spell",
    label: "Spell Menu",
    hudState: "spell",
    expectedSurface: "spell-menu",
  },
  {
    id: "settings-video",
    label: "Video Settings",
    hudState: "settings",
    settingsPane: "video",
    expectedSurface: "settings-panel",
  },
  {
    id: "settings-keybinds",
    label: "Keybind Settings",
    hudState: "settings",
    settingsPane: "keybinds",
    expectedSurface: "settings-panel",
  },
  {
    id: "settings-voice",
    label: "Voice Settings",
    hudState: "settings",
    settingsPane: "voice",
    expectedSurface: "settings-panel",
  },
  {
    id: "settings-character",
    label: "Character Settings",
    hudState: "settings",
    settingsPane: "character",
    expectedSurface: "settings-panel",
  },
  {
    id: "engine",
    label: "Engine Menu",
    hudState: "engine",
    expectedSurface: "engine-menu",
  },
  {
    id: "map",
    label: "Expanded Map",
    hudState: "map",
    expectedSurface: "map-expanded",
  },
  {
    id: "map-world",
    label: "Expanded World Map",
    hudState: "map",
    mapPage: "world",
    expectedSurface: "map-expanded",
  },
  {
    id: "inventory",
    label: "Inventory",
    hudState: "inventory",
    expectedSurface: "inventory-panel",
  },
  {
    id: "scoreboard",
    label: "Scoreboard",
    hudState: "scoreboard",
    expectedSurface: "scoreboard-menu",
  },
  {
    id: "questnpc",
    label: "Quest NPC Editor",
    hudState: "questnpc",
    expectedSurface: "quest-npc-editor",
  },
  {
    id: "questdialog",
    label: "Quest Dialog",
    hudState: "questdialog",
    expectedSurface: "quest-dialog-panel",
  },
  {
    id: "magichands-fireball",
    label: "Magic Hands Fireball",
    hudState: "magichands",
    magicSpell: "fireball",
    expectedSurface: "magic-hands",
  },
];

export const ASPECT_RATIO_HUD_QA_SURVIVAL_PARAMS = "qaSurvivalChunk=0,0&qaSurvivalLocalX=0&qaSurvivalLocalZ=50&qaSurvivalY=20&qaSurvivalYaw=0&qaSurvivalPitch=-0.08";

let aspectRatioProfileSummaryCache: string | null = null;
let aspectRatioHudStateSummaryCache: string | null = null;
let aspectRatioHudRouteSummaryCache: string | null = null;

function appendParams(...paramBlocks: Array<string | null | undefined>) {
  const params = new URLSearchParams();
  for (const block of paramBlocks) {
    if (!block) continue;
    const blockParams = new URLSearchParams(block);
    for (const [key, value] of blockParams.entries()) {
      params.set(key, value);
    }
  }
  return params.toString();
}

export function buildAspectRatioHudQaRoutes(options: {
  profiles?: readonly AspectRatioQaProfile[];
  states?: readonly AspectRatioHudQaState[];
  survivalParams?: string;
  reloadPrefix?: string;
} = {}): AspectRatioHudQaRoute[] {
  const profiles = options.profiles ?? ASPECT_RATIO_QA_PROFILES;
  const states = options.states ?? ASPECT_RATIO_HUD_QA_STATES;
  const survivalParams = options.survivalParams ?? ASPECT_RATIO_HUD_QA_SURVIVAL_PARAMS;
  const reloadPrefix = options.reloadPrefix ?? "hud-aspect";
  const routes: AspectRatioHudQaRoute[] = [];

  for (const profile of profiles) {
    for (const state of states) {
      const stateParams = state.hudState
        ? appendParams(
          `qaHudState=${state.hudState}`,
          state.settingsPane ? `qaSettingsPane=${state.settingsPane}` : "",
          state.mapPage ? `qaMapPage=${state.mapPage}` : "",
          state.magicSpell ? `qaMagicSpell=${state.magicSpell}` : "",
        )
        : "";
      const key = `${profile.id}:${state.id}`;
      const route: AspectRatioHudQaRoute = {
        key,
        label: `${profile.label} / ${state.label}`,
        profileId: profile.id,
        stateId: state.id,
        params: appendParams(
          survivalParams,
          profile.defaultParams,
          stateParams,
          `qaReload=${reloadPrefix}-${profile.id}-${state.id}`,
        ),
      };
      routes.push(route);
    }
  }

  return routes;
}

export function isAspectRatioQaMatrixEnabled() {
  return isCurrentAspectRatioQaMatrixRouteEnabled();
}

export function getClosestAspectRatioQaProfile(width: number, height: number) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  let closestProfile: AspectRatioQaProfile | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const profile of ASPECT_RATIO_QA_PROFILES) {
    const distance = Math.abs(profile.width - safeWidth) / profile.width +
      Math.abs(profile.height - safeHeight) / profile.height;
    if (distance < closestDistance) {
      closestDistance = distance;
      closestProfile = profile;
    }
  }

  return closestProfile;
}

export function getRequestedAspectRatioQaProfile(search?: string) {
  const requestedProfile = (typeof search === "string"
    ? getQaRouteParamFromSearch(search, "qaAspectProfile")
    : getCurrentQaRouteParam("qaAspectProfile"))?.trim().toLowerCase();
  if (!requestedProfile) return null;
  for (let index = 0; index < ASPECT_RATIO_QA_PROFILES.length; index += 1) {
    const profile = ASPECT_RATIO_QA_PROFILES[index];
    if (profile.id === requestedProfile) return profile;
  }
  return null;
}

export function getAspectRatioQaProfile(width: number, height: number, search?: string) {
  return getRequestedAspectRatioQaProfile(search) ?? getClosestAspectRatioQaProfile(width, height);
}

export function getAspectRatioQaProfileSummary() {
  if (aspectRatioProfileSummaryCache) return aspectRatioProfileSummaryCache;

  const parts: string[] = [];
  for (const profile of ASPECT_RATIO_QA_PROFILES) {
    parts.push(`${profile.id}:${profile.width}x${profile.height}:${profile.defaultParams}`);
  }
  aspectRatioProfileSummaryCache = parts.join("|");
  return aspectRatioProfileSummaryCache;
}

export function getAspectRatioHudQaStateSummary() {
  if (aspectRatioHudStateSummaryCache) return aspectRatioHudStateSummaryCache;

  const parts: string[] = [];
  for (const state of ASPECT_RATIO_HUD_QA_STATES) {
    const modifierParts: string[] = [];
    if (state.settingsPane) modifierParts.push(`settings=${state.settingsPane}`);
    if (state.mapPage) modifierParts.push(`map=${state.mapPage}`);
    if (state.magicSpell) modifierParts.push(`spell=${state.magicSpell}`);
    const modifiers = modifierParts.join(",");
    parts.push(`${state.id}:${state.hudState || "gameplay"}:${state.expectedSurface}${modifiers ? `:${modifiers}` : ""}`);
  }
  aspectRatioHudStateSummaryCache = parts.join("|");
  return aspectRatioHudStateSummaryCache;
}

export function getAspectRatioHudQaRouteSummary() {
  if (aspectRatioHudRouteSummaryCache) return aspectRatioHudRouteSummaryCache;

  const routes = buildAspectRatioHudQaRoutes();
  const parts: string[] = [];
  for (const route of routes) {
    parts.push(`${route.key}:${route.params}`);
  }
  aspectRatioHudRouteSummaryCache = parts.join("|");
  return aspectRatioHudRouteSummaryCache;
}
