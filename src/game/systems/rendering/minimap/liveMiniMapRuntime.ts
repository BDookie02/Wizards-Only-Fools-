import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";

export type LiveMiniMapPlayerSnapshot = {
  x: number;
  z: number;
};

export type LiveMiniMapRenderCheckpoint = LiveMiniMapPlayerSnapshot & {
  expanded: boolean;
};

export type LiveMiniMapHiddenObjectCache = {
  lastRefreshAt: number;
  rootChildCount: number;
  objects: THREE.Object3D[];
};

export const COMPACT_MINIMAP_VIEW_SIZE = 80;
export const EXPANDED_BLOCK_MAP_VIEW_SIZE = SURVIVAL_BLOCK_SIZE / 2;
const HIDDEN_OBJECT_CACHE_REFRESH_MS = 2400;

export function shouldHideForMiniMap(object: THREE.Object3D) {
  return (
    object.name === "horizon-cylinder" ||
    object.name.startsWith("survival-sky-") ||
    object.name === "quest-navigation-beacons" ||
    object.name.startsWith("quest-beacon-") ||
    object.userData.hideFromMiniMap === true
  );
}

export function createLiveMiniMapHiddenObjectCache(): LiveMiniMapHiddenObjectCache {
  return {
    lastRefreshAt: Number.NEGATIVE_INFINITY,
    rootChildCount: -1,
    objects: [],
  };
}

function collectHiddenMiniMapObjects(object: THREE.Object3D, target: THREE.Object3D[]) {
  if (shouldHideForMiniMap(object)) target.push(object);
  const children = object.children;
  for (let index = 0; index < children.length; index += 1) {
    collectHiddenMiniMapObjects(children[index], target);
  }
}

export function getCachedHiddenMiniMapObjects(
  scene: THREE.Scene,
  cache: LiveMiniMapHiddenObjectCache,
  now: number,
) {
  if (
    now - cache.lastRefreshAt < HIDDEN_OBJECT_CACHE_REFRESH_MS &&
    cache.rootChildCount === scene.children.length
  ) {
    return cache.objects;
  }

  cache.objects.length = 0;
  collectHiddenMiniMapObjects(scene, cache.objects);
  cache.lastRefreshAt = now;
  cache.rootChildCount = scene.children.length;
  return cache.objects;
}

export function hideMiniMapObjectsForRender(candidates: THREE.Object3D[], hidden: THREE.Object3D[]) {
  hidden.length = 0;
  for (let index = 0; index < candidates.length; index += 1) {
    const object = candidates[index];
    if (!object.visible) continue;
    object.visible = false;
    hidden.push(object);
  }
}

export function restoreMiniMapObjectsAfterRender(hidden: THREE.Object3D[]) {
  for (let index = 0; index < hidden.length; index += 1) {
    hidden[index].visible = true;
  }
  hidden.length = 0;
}

export function getLiveMiniMapTargetSize(mobilePerformanceMode: boolean) {
  return mobilePerformanceMode ? 112 : 224;
}

export function getLiveMiniMapCircleSegments(mobilePerformanceMode: boolean) {
  return mobilePerformanceMode ? 28 : 40;
}

export function getSurvivalBlockCenter(value: number) {
  return Math.floor((value + SURVIVAL_BLOCK_SIZE / 2) / SURVIVAL_BLOCK_SIZE) * SURVIVAL_BLOCK_SIZE;
}

export function getLiveMiniMapViewSize(isExpanded: boolean) {
  return isExpanded ? EXPANDED_BLOCK_MAP_VIEW_SIZE : COMPACT_MINIMAP_VIEW_SIZE;
}

export function getLiveMiniMapCameraCenterInto(
  player: LiveMiniMapPlayerSnapshot,
  isExpanded: boolean,
  target: LiveMiniMapPlayerSnapshot,
) {
  target.x = isExpanded ? getSurvivalBlockCenter(player.x) : player.x;
  target.z = isExpanded ? getSurvivalBlockCenter(player.z) : player.z;
  return target;
}

export function getLiveMiniMapCameraCenter(player: LiveMiniMapPlayerSnapshot, isExpanded: boolean) {
  return getLiveMiniMapCameraCenterInto(player, isExpanded, { x: 0, z: 0 });
}

export function getLiveMiniMapRenderIntervalMs(isExpanded: boolean, mobilePerformanceMode: boolean) {
  return mobilePerformanceMode
    ? isExpanded ? 900 : 2200
    : isExpanded ? 420 : 950;
}

export function getLiveMiniMapMovementThresholdSq(isExpanded: boolean) {
  const threshold = isExpanded ? 3.5 : 1.75;
  return threshold * threshold;
}

export function getLiveMiniMapToggleDelayMs(mobilePerformanceMode: boolean) {
  return mobilePerformanceMode ? 220 : 110;
}

export function shouldRenderLiveMiniMapFrame(options: {
  now: number;
  delayRenderUntil: number;
  lastRenderTime: number;
  isExpanded: boolean;
  mobilePerformanceMode: boolean;
  hasRenderedMap: boolean;
  player: LiveMiniMapPlayerSnapshot;
  lastRenderedPlayer: LiveMiniMapRenderCheckpoint;
}) {
  if (options.now < options.delayRenderUntil) return false;
  if (!options.hasRenderedMap) return true;

  const renderInterval = getLiveMiniMapRenderIntervalMs(options.isExpanded, options.mobilePerformanceMode);
  if (options.now - options.lastRenderTime < renderInterval) return false;

  const dx = options.player.x - options.lastRenderedPlayer.x;
  const dz = options.player.z - options.lastRenderedPlayer.z;
  const movedSinceLastRender = dx * dx + dz * dz >= getLiveMiniMapMovementThresholdSq(options.isExpanded);
  return !(
    options.hasRenderedMap &&
    options.lastRenderedPlayer.expanded === options.isExpanded &&
    !movedSinceLastRender
  );
}
