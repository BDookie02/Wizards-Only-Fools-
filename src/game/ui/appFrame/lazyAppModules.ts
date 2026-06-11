import { lazy } from "react";

const loadHUDModule = () => import("../../HUD").then((module) => ({ default: module.HUD }));
const loadGameWorldModule = () => import("../../GameWorld").then((module) => ({ default: module.GameWorld }));
const loadMiniMapModule = () => import("../../../components/MiniMap").then((module) => ({ default: module.MiniMap }));

export const LazyHUD = lazy(loadHUDModule);
export const LazyGameWorld = lazy(loadGameWorldModule);
export const LazyQaPerfStatsProbe = lazy(() =>
  import("../../tools/qa/QaPerfStatsProbe").then((module) => ({ default: module.QaPerfStatsProbe })),
);
export const LazyVoiceChat = lazy(() => import("../../network/VoiceChat").then((module) => ({ default: module.VoiceChat })));
export const LazyMiniMap = lazy(loadMiniMapModule);
export const LazyLaunchMenu = lazy(() => import("../launch/LaunchMenu").then((module) => ({ default: module.LaunchMenu })));

export function preloadGameplayModules() {
  void Promise.all([
    loadGameWorldModule(),
    loadHUDModule(),
    loadMiniMapModule(),
  ]).catch(() => undefined);
}
