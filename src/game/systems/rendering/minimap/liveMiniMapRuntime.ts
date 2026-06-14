import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";

export type LiveMiniMapPlayerSnapshot = {
  x: number;
  z: number;
};

export type LiveMiniMapPlayerState = LiveMiniMapPlayerSnapshot & {
  angle: number;
};

export type PublishedLiveMiniMapPosition = {
  x: number;
  z: number;
} | null | undefined;

export type LiveMiniMapRenderCheckpoint = LiveMiniMapPlayerSnapshot & {
  expanded: boolean;
};

export type LiveMiniMapHudLayout = {
  expandedMapFrameInnerSize: number;
  expandedMapFrameOuterSize: number;
  expandedMapSize: number;
  miniMapCompassEdge: number;
  miniMapCompassFontSize: number;
  miniMapInset: number;
  miniMapRadius: number;
  miniMapSize: number;
};

export type LiveMiniMapHiddenObjectCache = {
  lastRefreshAt: number;
  rootChildCount: number;
  objects: THREE.Object3D[];
};

export const COMPACT_MINIMAP_VIEW_SIZE = 80;
export const EXPANDED_BLOCK_MAP_VIEW_SIZE = SURVIVAL_BLOCK_SIZE / 2;
const HIDDEN_OBJECT_CACHE_REFRESH_MS = 2400;

export function toFiniteLiveMiniMapNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

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

export function getLiveMiniMapHudLayout(width: number, height: number): LiveMiniMapHudLayout {
  const minViewportSide = Math.min(width, height);
  const isUltraShortViewport = height <= 260;
  const isShortViewport = height <= 390;
  const isNarrowViewport = width <= 430;
  const isTallNarrowViewport = isNarrowViewport && height >= 470;
  const miniMapSize = isUltraShortViewport
    ? Math.max(56, Math.min(minViewportSide * 0.32, 70))
    : isTallNarrowViewport
    ? Math.max(98, Math.min(minViewportSide * 0.25, 132))
    : (isShortViewport || isNarrowViewport)
      ? Math.max(84, Math.min(minViewportSide * 0.26, 112))
      : Math.max(104, Math.min(minViewportSide * 0.22, 212));
  const miniMapInset = isUltraShortViewport
    ? Math.max(3, Math.min(minViewportSide * 0.018, 8))
    : Math.max(8, Math.min(minViewportSide * 0.02, 16));
  const miniMapCompassEdge = isUltraShortViewport
    ? Math.max(2, Math.min(miniMapSize * 0.055, 4))
    : Math.max(3, Math.min(miniMapSize * 0.055, 8));
  const miniMapCompassFontSize = isUltraShortViewport
    ? Math.max(6, Math.min(miniMapSize * 0.13, 8))
    : Math.max(7, Math.min(miniMapSize * 0.1, 10));
  const expandedMapSize = Math.min(width * 0.8, height * 0.8, 800);

  return {
    expandedMapFrameInnerSize: expandedMapSize + 8,
    expandedMapFrameOuterSize: expandedMapSize + 16,
    expandedMapSize,
    miniMapCompassEdge,
    miniMapCompassFontSize,
    miniMapInset,
    miniMapRadius: miniMapSize / 2,
    miniMapSize,
  };
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

export function syncLiveMiniMapPlayerFromPublishedStateInto(
  target: LiveMiniMapPlayerState,
  publishedPosition: PublishedLiveMiniMapPosition,
  publishedYaw: number | undefined,
) {
  if (publishedPosition) {
    target.x = toFiniteLiveMiniMapNumber(publishedPosition.x, target.x);
    target.z = toFiniteLiveMiniMapNumber(publishedPosition.z, target.z);
  }

  if (publishedYaw !== undefined) {
    target.angle = toFiniteLiveMiniMapNumber(publishedYaw, target.angle);
  }

  return target;
}

export function resolveLiveMiniMapPlayerMoveDetail(
  detail: Record<string, unknown> | null | undefined,
  previous: LiveMiniMapPlayerState,
): LiveMiniMapPlayerState {
  return {
    x: toFiniteLiveMiniMapNumber(detail?.x, previous.x),
    z: toFiniteLiveMiniMapNumber(detail?.z, previous.z),
    angle: toFiniteLiveMiniMapNumber(detail?.angle, previous.angle),
  };
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
