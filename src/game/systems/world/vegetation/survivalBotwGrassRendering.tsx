import { useFrame } from "@react-three/fiber";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { isMobilePerformanceMode } from "../../input/performanceMode";
import { useLazyRef } from "../../react/useLazyRef";
import {
  installSurvivalGrassDebugSampler,
  isSurvivalGrassInspectionView,
} from "../../../tools/qa/survivalGrassDebug";
import {
  getBrowserSurvivalPlayerPosition as getBrowserLocalPlayerPosition,
  getQaSurvivalUrlPlayerWorldPosition,
} from "../survival/survivalPosition";
import { getSurvivalProceduralPendingChunkCount } from "../survival/survivalProceduralWorldTelemetry";
import { getSurvivalRestoredMeadowMask } from "../survival/survivalBiome";
import { clamp01, lerpNumber, smoothstepRange, survivalHash01 } from "../survival/survivalMath";
import {
  SURVIVAL_LOCAL_GRASS_HIGH_ALTITUDE_FADE_END,
  SURVIVAL_LOCAL_GRASS_HIGH_ALTITUDE_FADE_START,
} from "./survivalLocalGrassStreaming";
import {
  SURVIVAL_BOTW_GRASS_AIR_RADIUS,
  SURVIVAL_BOTW_GRASS_BUILD_CACHE_LIMIT,
  SURVIVAL_BOTW_GRASS_BUILD_DESKTOP_SLICE_CANDIDATES,
  SURVIVAL_BOTW_GRASS_BUILD_DESKTOP_SLICE_MS,
  SURVIVAL_BOTW_GRASS_BUILD_MOBILE_SLICE_CANDIDATES,
  SURVIVAL_BOTW_GRASS_BUILD_MOBILE_SLICE_MS,
  SURVIVAL_BOTW_GRASS_BUILD_SLICE_DELAY_MS,
  SURVIVAL_BOTW_GRASS_CARPET_AIR_RADIUS,
  SURVIVAL_BOTW_GRASS_CARPET_EDGE_FADE,
  SURVIVAL_BOTW_GRASS_CARPET_ENABLED,
  SURVIVAL_BOTW_GRASS_CARPET_RADIUS,
  SURVIVAL_BOTW_GRASS_CARPET_SEGMENTS,
  SURVIVAL_BOTW_GRASS_CENTER_STEP,
  SURVIVAL_BOTW_GRASS_DESKTOP_COUNT,
  SURVIVAL_BOTW_GRASS_DESKTOP_PREVIEW_COUNT,
  SURVIVAL_BOTW_GRASS_DESKTOP_PREVIEW_MIN_COUNT,
  SURVIVAL_BOTW_GRASS_EDGE_FADE,
  SURVIVAL_BOTW_GRASS_FAST_LEAD_SPEED,
  SURVIVAL_BOTW_GRASS_FAST_MIN_LEAD_DISTANCE,
  SURVIVAL_BOTW_GRASS_FLOWER_VISIBLE_FADE,
  SURVIVAL_BOTW_GRASS_FLOWER_VISIBLE_RADIUS,
  SURVIVAL_BOTW_GRASS_LEAD_SECONDS,
  SURVIVAL_BOTW_GRASS_LEAD_SMOOTHING,
  SURVIVAL_BOTW_GRASS_MAX_BACKGROUND_PENDING_PREWARMS,
  SURVIVAL_BOTW_GRASS_MAX_DIRECTIONAL_PENDING_PREWARMS,
  SURVIVAL_BOTW_GRASS_MAX_LEAD_DISTANCE,
  SURVIVAL_BOTW_GRASS_MAX_PENDING_PREWARMS,
  SURVIVAL_BOTW_GRASS_MIN_CENTER_TRAVEL_ALIGNMENT,
  SURVIVAL_BOTW_GRASS_MIN_LEAD_DISTANCE,
  SURVIVAL_BOTW_GRASS_MOBILE_COUNT,
  SURVIVAL_BOTW_GRASS_MOBILE_PREVIEW_COUNT,
  SURVIVAL_BOTW_GRASS_MOBILE_PREVIEW_MIN_COUNT,
  SURVIVAL_BOTW_GRASS_NEIGHBOR_PREWARM_INTERVAL_SECONDS,
  SURVIVAL_BOTW_GRASS_NEIGHBOR_PREWARM_OFFSETS,
  SURVIVAL_BOTW_GRASS_PENDING_TARGET_SAFE_DISTANCE,
  SURVIVAL_BOTW_GRASS_PENDING_VIEWER_SAFE_DISTANCE,
  SURVIVAL_BOTW_GRASS_PREVIEW_MAX_WAIT_MS,
  SURVIVAL_BOTW_GRASS_PREVIEW_RECENTER_VIEWER_DISTANCE,
  SURVIVAL_BOTW_GRASS_PREVIEW_REFRESH_COUNT,
  SURVIVAL_BOTW_GRASS_PREVIEW_REFRESH_MS,
  SURVIVAL_BOTW_GRASS_PREWARM_AHEAD_STEPS,
  SURVIVAL_BOTW_GRASS_PREWARM_DISTANCE,
  SURVIVAL_BOTW_GRASS_PREWARM_VIEWER_DISTANCE,
  SURVIVAL_BOTW_GRASS_RADIUS,
  SURVIVAL_BOTW_GRASS_RECENTER_DISTANCE,
  SURVIVAL_BOTW_GRASS_RECENTER_EMERGENCY_VIEWER_DISTANCE,
  SURVIVAL_BOTW_GRASS_RECENTER_MAX_VIEWER_DISTANCE,
  SURVIVAL_BOTW_GRASS_RECENTER_MAX_VIEWER_DISTANCE_INCREASE,
  SURVIVAL_BOTW_GRASS_RECENTER_MIN_INTERVAL_SECONDS,
  SURVIVAL_BOTW_GRASS_RECENTER_VIEWER_DRIFT_RELEASE,
  SURVIVAL_BOTW_GRASS_UPLOAD_DESKTOP_BATCH,
  SURVIVAL_BOTW_GRASS_UPLOAD_DESKTOP_INITIAL_BATCH,
  SURVIVAL_BOTW_GRASS_UPLOAD_MOBILE_BATCH,
  SURVIVAL_BOTW_GRASS_UPLOAD_MOBILE_INITIAL_BATCH,
  SURVIVAL_BOTW_GRASS_UPLOAD_RECENTER_EDGE_RELEASE_DISTANCE,
  SURVIVAL_BOTW_GRASS_UPLOAD_RECENTER_MIN_PROGRESS,
  SURVIVAL_BOTW_GRASS_VERTICAL_FADE_END,
  SURVIVAL_BOTW_GRASS_VERTICAL_FADE_START,
  type SurvivalBotwFlowerInstance,
  type SurvivalBotwGrassBladeInstance,
  type SurvivalBotwGrassCenter,
} from "./survivalBotwGrassConfig";
import {
  SURVIVAL_GRASS_BLADE_SOURCE_UP,
  getSurvivalBotwGrassCarpetPlacementForBuild,
} from "./survivalBotwGrassPlacement";
import {
  appendSurvivalBotwTallFeatureFlowers,
  getSurvivalBotwFlowerBuildContext,
  getSurvivalBotwGrassBuildContext,
  makeSurvivalBotwFlowerCandidate,
  makeSurvivalBotwGrassBladeCandidate,
  makeSurvivalBotwGrassBootstrapPreview,
} from "./survivalBotwGrassGeneration";
import {
  applySurvivalLocalGrassShader,
  type SurvivalLocalGrassFadeUniforms,
} from "./survivalGrassShader";
import {
  getSurvivalBotwGrassTexture,
  getSurvivalMeadowGrassCarpetTexture,
} from "./survivalGrassTextures";
import {
  getSurvivalBotwGrassClusterGeometry,
  getSurvivalBotwFlowerHeadGeometry,
  getSurvivalBotwFlowerHeadTexture,
} from "./survivalGrassGeometry";
import { splitSurvivalFlowersByBloomType } from "./survivalFlowerGrouping";
import {
  ensureSurvivalInstancedMeshColors,
  finalizeSurvivalInstancedMeshColors,
  markSurvivalInstancedMeshRange,
} from "./survivalInstancing";
import {
  getSurvivalBotwGrassUploadPrioritizedInstances,
  type SurvivalBotwGrassUploadPriority,
} from "./survivalBotwGrassUploadPriority";
import {
  clearSurvivalBotwGrassDebugLine,
  clearSurvivalBotwGrassRuntimeMetrics,
  publishSurvivalBotwGrassBuildResult,
  publishSurvivalBotwGrassBuildState,
  publishSurvivalBotwGrassDebugLine,
  publishSurvivalBotwGrassFlowerCounts,
  publishSurvivalBotwGrassPendingPrewarms,
  publishSurvivalBotwGrassPrewarmBuilding,
  publishSurvivalBotwGrassPrewarmReady,
  publishSurvivalBotwGrassRuntimeMetrics,
  publishSurvivalBotwGrassUploadComplete,
  publishSurvivalBotwGrassUploadSnapshot,
  shouldPublishCurrentSurvivalBotwGrassRuntimeMetrics,
} from "./survivalBotwGrassTelemetry";
import {
  getSurvivalGrassDebugSampleAt,
  getSurvivalGrassSurfaceHeightAtWorld,
  getSurvivalSmoothedTerrainColorInto,
} from "./survivalBotwGrassResolvers";
import {
  finishPendingSurvivalBotwGrassBuild,
  getCachedSurvivalBotwGrassBuild,
  getPendingSurvivalBotwGrassBuildCount,
  hasCachedSurvivalBotwGrassBuild,
  hasPendingSurvivalBotwGrassBuild,
  markPendingSurvivalBotwGrassBuild,
  rememberSurvivalBotwGrassBuild,
  type SurvivalBotwGrassBuildResult,
} from "./survivalBotwGrassBuildCache";
import { SURVIVAL_GRASS_SYSTEM_ENABLED } from "./survivalGrassSystemConfig";
import { HIDE_FROM_MINIMAP } from "./SurvivalFoliagePrimitives";

const MOBILE_BOTW_GRASS_WIND_UPDATE_INTERVAL_SECONDS = 1 / 24;
const SURVIVAL_BOTW_GRASS_PENDING_VIEWER_SAFE_DISTANCE_SQ =
  SURVIVAL_BOTW_GRASS_PENDING_VIEWER_SAFE_DISTANCE * SURVIVAL_BOTW_GRASS_PENDING_VIEWER_SAFE_DISTANCE;
const SURVIVAL_BOTW_GRASS_PENDING_TARGET_SAFE_DISTANCE_SQ =
  SURVIVAL_BOTW_GRASS_PENDING_TARGET_SAFE_DISTANCE * SURVIVAL_BOTW_GRASS_PENDING_TARGET_SAFE_DISTANCE;
const SURVIVAL_BOTW_GRASS_UPLOAD_RECENTER_EDGE_RELEASE_DISTANCE_SQ =
  SURVIVAL_BOTW_GRASS_UPLOAD_RECENTER_EDGE_RELEASE_DISTANCE * SURVIVAL_BOTW_GRASS_UPLOAD_RECENTER_EDGE_RELEASE_DISTANCE;
const SURVIVAL_BOTW_GRASS_RECENTER_DISTANCE_SQ =
  SURVIVAL_BOTW_GRASS_RECENTER_DISTANCE * SURVIVAL_BOTW_GRASS_RECENTER_DISTANCE;
const SURVIVAL_BOTW_GRASS_TARGET_RECENTER_DISTANCE =
  SURVIVAL_BOTW_GRASS_RADIUS - SURVIVAL_BOTW_GRASS_EDGE_FADE * 0.35;
const SURVIVAL_BOTW_GRASS_TARGET_RECENTER_DISTANCE_SQ =
  SURVIVAL_BOTW_GRASS_TARGET_RECENTER_DISTANCE * SURVIVAL_BOTW_GRASS_TARGET_RECENTER_DISTANCE;
const SURVIVAL_BOTW_GRASS_PREWARM_VIEWER_DISTANCE_SQ =
  SURVIVAL_BOTW_GRASS_PREWARM_VIEWER_DISTANCE * SURVIVAL_BOTW_GRASS_PREWARM_VIEWER_DISTANCE;
const SURVIVAL_BOTW_GRASS_PREWARM_DISTANCE_SQ =
  SURVIVAL_BOTW_GRASS_PREWARM_DISTANCE * SURVIVAL_BOTW_GRASS_PREWARM_DISTANCE;
const SURVIVAL_BOTW_GRASS_PREVIEW_RECENTER_VIEWER_DISTANCE_SQ =
  SURVIVAL_BOTW_GRASS_PREVIEW_RECENTER_VIEWER_DISTANCE * SURVIVAL_BOTW_GRASS_PREVIEW_RECENTER_VIEWER_DISTANCE;
const SURVIVAL_BOTW_GRASS_RECENTER_EMERGENCY_VIEWER_DISTANCE_SQ =
  SURVIVAL_BOTW_GRASS_RECENTER_EMERGENCY_VIEWER_DISTANCE * SURVIVAL_BOTW_GRASS_RECENTER_EMERGENCY_VIEWER_DISTANCE;
const SURVIVAL_BOTW_GRASS_RECENTER_VIEWER_DRIFT_RELEASE_SQ =
  SURVIVAL_BOTW_GRASS_RECENTER_VIEWER_DRIFT_RELEASE * SURVIVAL_BOTW_GRASS_RECENTER_VIEWER_DRIFT_RELEASE;
const SURVIVAL_BOTW_GRASS_RECENTER_MAX_VIEWER_DISTANCE_SQ =
  SURVIVAL_BOTW_GRASS_RECENTER_MAX_VIEWER_DISTANCE * SURVIVAL_BOTW_GRASS_RECENTER_MAX_VIEWER_DISTANCE;

type SurvivalBotwGrassViewerPosition = { x: number; y: number; z: number };

type SurvivalBotwGrassNeighborPrewarmState = {
  centerKey: string;
  offsetIndex: number;
  lastAt: number;
  travelOffsets: Array<[number, number]>;
  seenOffsets: Array<[number, number]>;
};

type SurvivalBotwGrassUploadScratch = {
  dummy: THREE.Object3D;
  normal: THREE.Vector3;
  normalQuaternion: THREE.Quaternion;
  yawQuaternion: THREE.Quaternion;
  color: THREE.Color;
};

function createSurvivalBotwGrassUploadScratch(): SurvivalBotwGrassUploadScratch {
  return {
    dummy: new THREE.Object3D(),
    normal: new THREE.Vector3(),
    normalQuaternion: new THREE.Quaternion(),
    yawQuaternion: new THREE.Quaternion(),
    color: new THREE.Color(),
  };
}

function makeOffsetScratch(count: number): Array<[number, number]> {
  const offsets: Array<[number, number]> = [];
  for (let index = 0; index < count; index += 1) {
    offsets.push([0, 0]);
  }
  return offsets;
}

function clearSurvivalFlowerMesh(mesh: THREE.InstancedMesh) {
  mesh.count = 0;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
}

function getSurvivalLocalGrassViewerPositionInto(camera: THREE.Camera, target: SurvivalBotwGrassViewerPosition) {
  const localPlayer = getBrowserLocalPlayerPosition();
  if (localPlayer) {
    target.x = localPlayer.x;
    target.y = typeof localPlayer.y === "number" ? localPlayer.y : camera.position.y;
    target.z = localPlayer.z;
    return target;
  }

  target.x = camera.position.x;
  target.y = camera.position.y;
  target.z = camera.position.z;
  return target;
}

function getInitialSurvivalBotwGrassCenter(): SurvivalBotwGrassCenter {
  const qaPlayer = getQaSurvivalUrlPlayerWorldPosition();
  const localPlayer = getBrowserLocalPlayerPosition();
  const x = qaPlayer?.x ?? localPlayer?.x ?? 0;
  const z = qaPlayer?.z ?? localPlayer?.z ?? 0;
  const y = !qaPlayer && typeof localPlayer?.y === "number"
    ? localPlayer.y
    : getSurvivalGrassSurfaceHeightAtWorld(x, z) + 12;
  return getSurvivalBotwGrassSnappedCenter(x, y, z);
}

function getSurvivalBotwGrassSnappedCenter(worldX: number, worldY: number, worldZ: number): SurvivalBotwGrassCenter {
  return {
    x: Math.round(worldX / SURVIVAL_BOTW_GRASS_CENTER_STEP) * SURVIVAL_BOTW_GRASS_CENTER_STEP,
    y: worldY,
    z: Math.round(worldZ / SURVIVAL_BOTW_GRASS_CENTER_STEP) * SURVIVAL_BOTW_GRASS_CENTER_STEP,
  };
}

const survivalBotwGrassCarpetGeometryCache = new Map<string, THREE.BufferGeometry | null>();

function getSurvivalBotwGrassCarpetGeometryCacheKey(centerX: number, centerZ: number, mobilePerformanceMode: boolean) {
  return `${Math.round(centerX)}:${Math.round(centerZ)}:${mobilePerformanceMode ? "m" : "d"}`;
}

function rememberSurvivalBotwGrassCarpetGeometry(cacheKey: string, geometry: THREE.BufferGeometry | null) {
  if (survivalBotwGrassCarpetGeometryCache.has(cacheKey)) {
    survivalBotwGrassCarpetGeometryCache.delete(cacheKey);
  }
  survivalBotwGrassCarpetGeometryCache.set(cacheKey, geometry);
  while (survivalBotwGrassCarpetGeometryCache.size > SURVIVAL_BOTW_GRASS_BUILD_CACHE_LIMIT) {
    const oldestKey = survivalBotwGrassCarpetGeometryCache.keys().next().value;
    if (typeof oldestKey !== "string") break;
    survivalBotwGrassCarpetGeometryCache.delete(oldestKey);
  }
}

function getCachedSurvivalBotwGrassCarpetGeometry(centerX: number, centerZ: number, mobilePerformanceMode: boolean) {
  const cacheKey = getSurvivalBotwGrassCarpetGeometryCacheKey(centerX, centerZ, mobilePerformanceMode);
  if (survivalBotwGrassCarpetGeometryCache.has(cacheKey)) {
    const cached = survivalBotwGrassCarpetGeometryCache.get(cacheKey) ?? null;
    survivalBotwGrassCarpetGeometryCache.delete(cacheKey);
    survivalBotwGrassCarpetGeometryCache.set(cacheKey, cached);
    return cached;
  }

  const geometry = makeSurvivalBotwGrassCarpetGeometry(centerX, centerZ, mobilePerformanceMode);
  rememberSurvivalBotwGrassCarpetGeometry(cacheKey, geometry);
  return geometry;
}

function makeSurvivalBotwGrassCarpetGeometry(centerX: number, centerZ: number, mobilePerformanceMode: boolean) {
  const segments = mobilePerformanceMode
    ? Math.max(36, Math.round(SURVIVAL_BOTW_GRASS_CARPET_SEGMENTS * 0.72))
    : SURVIVAL_BOTW_GRASS_CARPET_SEGMENTS;
  const radius = SURVIVAL_BOTW_GRASS_CARPET_RADIUS;
  const step = (radius * 2) / segments;
  const maxQuadCount = segments * segments;
  const maxVertexCount = maxQuadCount * 4;
  const positions = new Float32Array(maxVertexCount * 3);
  const colors = new Float32Array(maxVertexCount * 3);
  const uvs = new Float32Array(maxVertexCount * 2);
  const indices = maxVertexCount > 65535 ? new Uint32Array(maxQuadCount * 6) : new Uint16Array(maxQuadCount * 6);
  let vertexOffset = 0;
  let indexOffset = 0;
  const color = new THREE.Color();
  const terrainColor = new THREE.Color();
  const meadowDark = new THREE.Color("#3d872b");
  const meadowLight = new THREE.Color("#62b83a");

  const pushVertex = (worldX: number, worldZ: number, y: number, vertexColor: THREE.Color) => {
    const vertexIndex = vertexOffset;
    const positionBase = vertexIndex * 3;
    const uvBase = vertexIndex * 2;
    positions[positionBase] = worldX;
    positions[positionBase + 1] = y;
    positions[positionBase + 2] = worldZ;
    colors[positionBase] = vertexColor.r;
    colors[positionBase + 1] = vertexColor.g;
    colors[positionBase + 2] = vertexColor.b;
    uvs[uvBase] = worldX / 18;
    uvs[uvBase + 1] = worldZ / 18;
    vertexOffset += 1;
    return vertexIndex;
  };

  for (let row = 0; row < segments; row += 1) {
    for (let col = 0; col < segments; col += 1) {
      const centerWorldX = centerX - radius + (col + 0.5) * step;
      const centerWorldZ = centerZ - radius + (row + 0.5) * step;
      const centerDeltaX = centerWorldX - centerX;
      const centerDeltaZ = centerWorldZ - centerZ;
      if (centerDeltaX * centerDeltaX + centerDeltaZ * centerDeltaZ > radius * radius) continue;

      const meadowMask = getSurvivalRestoredMeadowMask(centerWorldX, centerWorldZ);
      const placement = getSurvivalBotwGrassCarpetPlacementForBuild(centerWorldX, centerWorldZ);
      if (!placement && meadowMask <= 0.001) continue;
      const terrainY = placement?.terrainY ?? getSurvivalGrassSurfaceHeightAtWorld(centerWorldX, centerWorldZ);

      getSurvivalSmoothedTerrainColorInto(centerWorldX, centerWorldZ, terrainY, terrainColor);
      const carpetFiber = (
        Math.sin(centerWorldX * 0.12 + centerWorldZ * 0.047) +
        Math.cos(centerWorldZ * 0.095 - centerWorldX * 0.031) +
        Math.sin((centerWorldX + centerWorldZ) * 0.062)
      ) / 3;
      const carpetSpeckle = survivalHash01(Math.floor(centerWorldX * 0.42), Math.floor(centerWorldZ * 0.42), 39240);
      const carpetBlend = clamp01(0.22 + smoothstepRange(-0.56, 0.78, carpetFiber) * 0.34 + carpetSpeckle * 0.16);
      color.copy(meadowDark).lerp(meadowLight, carpetBlend);
      color.lerp(terrainColor, meadowMask > 0.001 ? 0.018 : 0.12);
      color.multiplyScalar((meadowMask > 0.001 ? 0.92 : 0.96) + (carpetSpeckle - 0.5) * 0.04);
      color.r = clamp01(color.r);
      color.g = clamp01(color.g);
      color.b = clamp01(color.b);

      const x0 = centerX - radius + col * step;
      const z0 = centerZ - radius + row * step;
      const x1 = x0 + step;
      const z1 = z0 + step;
      const y00 = getSurvivalGrassSurfaceHeightAtWorld(x0, z0) + 0.085;
      const y10 = getSurvivalGrassSurfaceHeightAtWorld(x1, z0) + 0.085;
      const y01 = getSurvivalGrassSurfaceHeightAtWorld(x0, z1) + 0.085;
      const y11 = getSurvivalGrassSurfaceHeightAtWorld(x1, z1) + 0.085;
      const quadMinY = Math.min(y00, y10, y01, y11);
      const quadMaxY = Math.max(y00, y10, y01, y11);
      if (quadMaxY - quadMinY > (meadowMask > 0.001 ? 999 : 22)) continue;

      const a = pushVertex(x0, z0, y00, color);
      const b = pushVertex(x1, z0, y10, color);
      const c = pushVertex(x0, z1, y01, color);
      const d = pushVertex(x1, z1, y11, color);
      indices[indexOffset] = a;
      indices[indexOffset + 1] = c;
      indices[indexOffset + 2] = b;
      indices[indexOffset + 3] = b;
      indices[indexOffset + 4] = c;
      indices[indexOffset + 5] = d;
      indexOffset += 6;
    }
  }

  if (indexOffset === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions.subarray(0, vertexOffset * 3), 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors.subarray(0, vertexOffset * 3), 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs.subarray(0, vertexOffset * 2), 2));
  geometry.setIndex(new THREE.BufferAttribute(indices.subarray(0, indexOffset), 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function getSurvivalBotwGrassBuildKey(center: SurvivalBotwGrassCenter, mobilePerformanceMode: boolean) {
  return `${center.x}:${center.z}:${mobilePerformanceMode ? "m" : "d"}`;
}

const SURVIVAL_BOTW_GRASS_SLICE_CLOCK_CHECK_INTERVAL = 16;

function getSurvivalBotwGrassNowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function shouldContinueSurvivalBotwGrassSlice(workCount: number, sliceStartedAt: number, sliceBudgetMs: number) {
  if (workCount === 0 || workCount % SURVIVAL_BOTW_GRASS_SLICE_CLOCK_CHECK_INTERVAL !== 0) return true;
  return getSurvivalBotwGrassNowMs() - sliceStartedAt < sliceBudgetMs;
}

function getSurvivalBotwGrassElapsedMs(startedAt: number) {
  return getSurvivalBotwGrassNowMs() - startedAt;
}

function publishSurvivalBotwGrassPendingPrewarmCount() {
  publishSurvivalBotwGrassPendingPrewarms(getPendingSurvivalBotwGrassBuildCount());
}

function prewarmSurvivalBotwGrassBuild(
  center: SurvivalBotwGrassCenter,
  mobilePerformanceMode: boolean,
  maxPendingPrewarms = SURVIVAL_BOTW_GRASS_MAX_PENDING_PREWARMS,
) {
  if (typeof window === "undefined") return;
  const buildKey = getSurvivalBotwGrassBuildKey(center, mobilePerformanceMode);
  if (hasCachedSurvivalBotwGrassBuild(buildKey) || hasPendingSurvivalBotwGrassBuild(buildKey)) return;
  if (!markPendingSurvivalBotwGrassBuild(buildKey, maxPendingPrewarms)) return;

  publishSurvivalBotwGrassPendingPrewarmCount();
  const bladeContext = getSurvivalBotwGrassBuildContext(center.x, center.y, center.z, mobilePerformanceMode);
  const flowerContext = getSurvivalBotwFlowerBuildContext(center.x, center.y, center.z, mobilePerformanceMode);
  const bladeInstances: SurvivalBotwGrassBladeInstance[] = [];
  const flowerInstances: SurvivalBotwFlowerInstance[] = [];
  const candidateSliceLimit = mobilePerformanceMode
    ? SURVIVAL_BOTW_GRASS_BUILD_MOBILE_SLICE_CANDIDATES
    : SURVIVAL_BOTW_GRASS_BUILD_DESKTOP_SLICE_CANDIDATES;
  const sliceBudgetMs = mobilePerformanceMode
    ? SURVIVAL_BOTW_GRASS_BUILD_MOBILE_SLICE_MS
    : SURVIVAL_BOTW_GRASS_BUILD_DESKTOP_SLICE_MS;
  const startedAt = getSurvivalBotwGrassNowMs();
  let bladeCandidate = 0;
  let flowerCandidate = 0;

  const runSlice = () => {
    const sliceStartedAt = getSurvivalBotwGrassNowMs();
    let workCount = 0;
    while (
      bladeCandidate < bladeContext.candidateCount &&
      bladeInstances.length < bladeContext.maxInstances &&
      workCount < candidateSliceLimit &&
      shouldContinueSurvivalBotwGrassSlice(workCount, sliceStartedAt, sliceBudgetMs)
    ) {
      const instance = makeSurvivalBotwGrassBladeCandidate(bladeContext, bladeCandidate);
      if (instance) bladeInstances.push(instance);
      bladeCandidate += 1;
      workCount += 1;
    }

    while (
      flowerCandidate < flowerContext.candidateCount &&
      flowerInstances.length < flowerContext.maxFlowers &&
      workCount < candidateSliceLimit &&
      shouldContinueSurvivalBotwGrassSlice(workCount, sliceStartedAt, sliceBudgetMs)
    ) {
      const instance = makeSurvivalBotwFlowerCandidate(flowerContext, flowerCandidate);
      if (instance) flowerInstances.push(instance);
      flowerCandidate += 1;
      workCount += 1;
    }

    const doneBlades = bladeCandidate >= bladeContext.candidateCount || bladeInstances.length >= bladeContext.maxInstances;
    const doneFlowers = flowerCandidate >= flowerContext.candidateCount || flowerInstances.length >= flowerContext.maxFlowers;
    if (doneBlades && doneFlowers) {
      appendSurvivalBotwTallFeatureFlowers(flowerInstances, flowerContext);
      finishPendingSurvivalBotwGrassBuild(buildKey);
      publishSurvivalBotwGrassPendingPrewarmCount();
      const buildMs = getSurvivalBotwGrassElapsedMs(startedAt);
      rememberSurvivalBotwGrassBuild(buildKey, {
        bladeInstances,
        flowerInstances,
        buildMs,
      });
      publishSurvivalBotwGrassPrewarmReady(buildKey, buildMs);
      return;
    }

    window.setTimeout(runSlice, SURVIVAL_BOTW_GRASS_BUILD_SLICE_DELAY_MS);
  };

  publishSurvivalBotwGrassPrewarmBuilding(buildKey);
  window.setTimeout(runSlice, SURVIVAL_BOTW_GRASS_BUILD_SLICE_DELAY_MS);
}

function ActiveSurvivalBotwGrassField() {
  const enabled = SURVIVAL_GRASS_SYSTEM_ENABLED;
  const initialCenter = useMemo(() => getInitialSurvivalBotwGrassCenter(), []);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const publishRuntimeMetrics = useMemo(() => shouldPublishCurrentSurvivalBotwGrassRuntimeMetrics(), []);
  const grassDebugViewEnabled = useMemo(() => isSurvivalGrassInspectionView(), []);
  const [center, setCenter] = useState(initialCenter);
  const centerRef = useRef(center);
  const viewerPositionRef = useRef<SurvivalBotwGrassViewerPosition>({ x: center.x, y: center.y, z: center.z });
  const lastViewerRef = useRef<{ x: number; z: number; time: number; ready: boolean }>({
    x: center.x,
    z: center.z,
    time: 0,
    ready: false,
  });
  const grassLeadVelocityRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const lastGrassRecenterAtRef = useRef(0);
  const lowCameraGrassClearanceRef = useRef(0);
  const neighborGrassPrewarmRef = useRef<SurvivalBotwGrassNeighborPrewarmState>({
    centerKey: "",
    offsetIndex: 0,
    lastAt: 0,
    travelOffsets: makeOffsetScratch(5),
    seenOffsets: makeOffsetScratch(18),
  });
  const hasPublishedGrassBuildRef = useRef(false);
  const publishedGrassBuildKeyRef = useRef<string | null>(null);
  const activeGrassUploadKeyRef = useRef<string | null>(null);
  const completedGrassUploadKeyRef = useRef<string | null>(null);
  const publishedGrassBuildCompleteRef = useRef(false);
  const forceSparsePreviewBuildKeyRef = useRef<string | null>(null);
  const debugSampleSecondRef = useRef(-1);
  const uploadPriorityRef = useRef<SurvivalBotwGrassUploadPriority>({
    viewerX: initialCenter.x,
    viewerZ: initialCenter.z,
    leadX: initialCenter.x,
    leadZ: initialCenter.z,
  });
  const bladeUploadProgressRef = useRef(0);
  const bladeMeshRef = useRef<THREE.InstancedMesh>(null);
  const flowerStemRef = useRef<THREE.InstancedMesh>(null);
  const flowerLeafRef = useRef<THREE.InstancedMesh>(null);
  const flowerStarBloomRef = useRef<THREE.InstancedMesh>(null);
  const flowerRoundBloomRef = useRef<THREE.InstancedMesh>(null);
  const flowerBellBloomRef = useRef<THREE.InstancedMesh>(null);
  const flowerPuffBloomRef = useRef<THREE.InstancedMesh>(null);
  const bladeUploadCountRef = useRef(0);
  const lastMobileWindUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const normalScratch = useMemo(() => new THREE.Vector3(), []);
  const flowerForwardScratch = useMemo(() => new THREE.Vector3(), []);
  const flowerRightScratch = useMemo(() => new THREE.Vector3(), []);
  const flowerBasisScratch = useMemo(() => new THREE.Matrix4(), []);
  const flowerColorScratch = useMemo(() => new THREE.Color(), []);
  const uploadScratch = useMemo(createSurvivalBotwGrassUploadScratch, []);
  const bladeGeometry = useMemo(() => getSurvivalBotwGrassClusterGeometry(), []);
  const bladeTexture = useMemo(() => getSurvivalBotwGrassTexture(), []);
  const meadowCarpetTexture = useMemo(() => getSurvivalMeadowGrassCarpetTexture(), []);
  const flowerHeadGeometry = useMemo(() => getSurvivalBotwFlowerHeadGeometry(), []);
  const flowerHeadTexture = useMemo(() => getSurvivalBotwFlowerHeadTexture(), []);
  const windUniform = useMemo(() => ({ value: 0 }), []);
  const fadeUniforms = useMemo<SurvivalLocalGrassFadeUniforms>(() => ({
    viewerXZ: { value: new THREE.Vector2(initialCenter.x, initialCenter.z) },
    viewerY: { value: initialCenter.y },
    radius: { value: SURVIVAL_BOTW_GRASS_RADIUS + SURVIVAL_BOTW_GRASS_EDGE_FADE * 0.72 },
    fadeWidth: { value: SURVIVAL_BOTW_GRASS_EDGE_FADE },
    altitudeFade: { value: 1 },
    verticalFadeStart: { value: SURVIVAL_BOTW_GRASS_VERTICAL_FADE_START },
    verticalFadeEnd: { value: SURVIVAL_BOTW_GRASS_VERTICAL_FADE_END },
    nearFadeStart: { value: 0 },
    nearFadeEnd: { value: 0 },
  }), [initialCenter.x, initialCenter.y, initialCenter.z]);
  const carpetFadeUniforms = useMemo<SurvivalLocalGrassFadeUniforms>(() => ({
    viewerXZ: { value: new THREE.Vector2(initialCenter.x, initialCenter.z) },
    viewerY: { value: initialCenter.y },
    radius: { value: SURVIVAL_BOTW_GRASS_CARPET_RADIUS },
    fadeWidth: { value: SURVIVAL_BOTW_GRASS_CARPET_EDGE_FADE },
    altitudeFade: { value: 1 },
    verticalFadeStart: { value: SURVIVAL_BOTW_GRASS_VERTICAL_FADE_START },
    verticalFadeEnd: { value: SURVIVAL_BOTW_GRASS_VERTICAL_FADE_END },
  }), [initialCenter.x, initialCenter.y, initialCenter.z]);
  const flowerFadeUniforms = useMemo<SurvivalLocalGrassFadeUniforms>(() => ({
    viewerXZ: { value: new THREE.Vector2(initialCenter.x, initialCenter.z) },
    viewerY: { value: initialCenter.y },
    radius: { value: SURVIVAL_BOTW_GRASS_FLOWER_VISIBLE_RADIUS },
    fadeWidth: { value: SURVIVAL_BOTW_GRASS_FLOWER_VISIBLE_FADE },
    altitudeFade: { value: 1 },
    verticalFadeStart: { value: SURVIVAL_BOTW_GRASS_VERTICAL_FADE_START },
    verticalFadeEnd: { value: SURVIVAL_BOTW_GRASS_VERTICAL_FADE_END },
  }), [initialCenter.x, initialCenter.y, initialCenter.z]);

  useEffect(() => {
    return installSurvivalGrassDebugSampler(getSurvivalGrassDebugSampleAt);
  }, []);

  useEffect(() => {
    if (!publishRuntimeMetrics) clearSurvivalBotwGrassRuntimeMetrics();
    return () => clearSurvivalBotwGrassRuntimeMetrics();
  }, [publishRuntimeMetrics]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;

    const handlePlayerState = (event: Event) => {
      const detail = (event as CustomEvent<{ isSliding?: boolean; isCrouching?: boolean }>).detail;
      lowCameraGrassClearanceRef.current = detail?.isSliding
        ? 1.25
        : detail?.isCrouching
          ? 0.7
          : 0;
    };

    window.addEventListener("player-state", handlePlayerState);
    return () => window.removeEventListener("player-state", handlePlayerState);
  }, [enabled]);

  const bladeInstancesRef = useLazyRef<SurvivalBotwGrassBladeInstance[]>(() => []);
  const [bladeUploadVersion, setBladeUploadVersion] = useState(0);
  const carpetGeometry = useMemo(
    () => enabled && SURVIVAL_BOTW_GRASS_CARPET_ENABLED
      ? getCachedSurvivalBotwGrassCarpetGeometry(center.x, center.z, mobilePerformanceMode)
      : null,
    [center.x, center.z, enabled, mobilePerformanceMode],
  );
  const [flowerInstances, setFlowerInstances] = useState<SurvivalBotwFlowerInstance[]>([]);
  const flowerGroups = useMemo(() => splitSurvivalFlowersByBloomType(flowerInstances), [flowerInstances]);
  const starFlowers = flowerGroups.star;
  const roundFlowers = flowerGroups.round;
  const bellFlowers = flowerGroups.bell;
  const puffFlowers = flowerGroups.puff;
  const bladeCapacity = mobilePerformanceMode ? SURVIVAL_BOTW_GRASS_MOBILE_COUNT : SURVIVAL_BOTW_GRASS_DESKTOP_COUNT;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      bladeInstancesRef.current = [];
      hasPublishedGrassBuildRef.current = false;
      publishedGrassBuildKeyRef.current = null;
      activeGrassUploadKeyRef.current = null;
      completedGrassUploadKeyRef.current = null;
      publishedGrassBuildCompleteRef.current = false;
      forceSparsePreviewBuildKeyRef.current = null;
      bladeUploadProgressRef.current = 0;
      setBladeUploadVersion((version) => version + 1);
      setFlowerInstances([]);
      return undefined;
    }

    let cancelled = false;
    let timer: number | null = null;
    const buildKey = getSurvivalBotwGrassBuildKey(center, mobilePerformanceMode);
    const bladeContext = getSurvivalBotwGrassBuildContext(center.x, center.y, center.z, mobilePerformanceMode);
    const flowerContext = getSurvivalBotwFlowerBuildContext(center.x, center.y, center.z, mobilePerformanceMode);
    const nextBladeInstances: SurvivalBotwGrassBladeInstance[] = [];
    const nextFlowerInstances: SurvivalBotwFlowerInstance[] = [];
    const candidateSliceLimit = mobilePerformanceMode
      ? SURVIVAL_BOTW_GRASS_BUILD_MOBILE_SLICE_CANDIDATES
      : SURVIVAL_BOTW_GRASS_BUILD_DESKTOP_SLICE_CANDIDATES;
    const sliceBudgetMs = mobilePerformanceMode
      ? SURVIVAL_BOTW_GRASS_BUILD_MOBILE_SLICE_MS
      : SURVIVAL_BOTW_GRASS_BUILD_DESKTOP_SLICE_MS;
    const startedAt = getSurvivalBotwGrassNowMs();
    let bladeCandidate = 0;
    let flowerCandidate = 0;
    let lastPreviewPublishCount = 0;
    let lastPreviewPublishAt = 0;
    const forceSparsePreviewForThisBuild = forceSparsePreviewBuildKeyRef.current === buildKey;
    if (forceSparsePreviewForThisBuild) {
      forceSparsePreviewBuildKeyRef.current = null;
    }
    const hadCompletePublishedBuild =
      !forceSparsePreviewForThisBuild &&
      publishedGrassBuildCompleteRef.current &&
      bladeInstancesRef.current.length >= Math.min(bladeCapacity, bladeContext.maxInstances) * 0.82;
    const allowSparsePreviewPublish = forceSparsePreviewForThisBuild || !hadCompletePublishedBuild;

    if (publishedGrassBuildKeyRef.current !== buildKey) {
      hasPublishedGrassBuildRef.current = hadCompletePublishedBuild;
      publishedGrassBuildCompleteRef.current = hadCompletePublishedBuild;
      bladeUploadProgressRef.current = hadCompletePublishedBuild ? 1 : 0;
      publishSurvivalBotwGrassBuildState(hadCompletePublishedBuild
        ? "building-held"
        : forceSparsePreviewForThisBuild ? "building-emergency-preview" : "building");
    }

    const clearScheduledWork = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const publishBuild = (result: SurvivalBotwGrassBuildResult, fromCache = false, complete = true) => {
      if (cancelled) return;
      if (
        complete &&
        publishedGrassBuildKeyRef.current === buildKey &&
        publishedGrassBuildCompleteRef.current &&
        bladeInstancesRef.current.length > 0
      ) {
        hasPublishedGrassBuildRef.current = true;
        publishSurvivalBotwGrassBuildState("ready");
        return;
      }

      hasPublishedGrassBuildRef.current = true;
      publishedGrassBuildKeyRef.current = buildKey;
      publishedGrassBuildCompleteRef.current = complete;
      activeGrassUploadKeyRef.current = buildKey;
      bladeInstancesRef.current = result.bladeInstances;
      startTransition(() => {
        setBladeUploadVersion((version) => version + 1);
        setFlowerInstances(result.flowerInstances);
      });
      publishSurvivalBotwGrassBuildResult(buildKey, result.buildMs, complete
        ? fromCache ? "cached" : "ready"
        : "preview");
    };

    const cachedBuild = getCachedSurvivalBotwGrassBuild(buildKey);
    if (cachedBuild) {
      publishBuild(cachedBuild, true);
      return () => {
        cancelled = true;
        clearScheduledWork();
      };
    }

    const bootstrapBladeInstances = allowSparsePreviewPublish
      ? makeSurvivalBotwGrassBootstrapPreview(center, mobilePerformanceMode)
      : [];
    if (bootstrapBladeInstances.length > 0) {
      lastPreviewPublishCount = bootstrapBladeInstances.length;
      lastPreviewPublishAt = getSurvivalBotwGrassElapsedMs(startedAt);
      publishBuild({
        bladeInstances: bootstrapBladeInstances,
        flowerInstances: [],
        buildMs: lastPreviewPublishAt,
      }, false, false);
    }

    const runSlice = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      timer = null;
      if (cancelled) return;

      const sliceStartedAt = getSurvivalBotwGrassNowMs();
      let workCount = 0;
      const previewCount = mobilePerformanceMode
        ? SURVIVAL_BOTW_GRASS_MOBILE_PREVIEW_COUNT
        : SURVIVAL_BOTW_GRASS_DESKTOP_PREVIEW_COUNT;
      const previewMinCount = mobilePerformanceMode
        ? SURVIVAL_BOTW_GRASS_MOBILE_PREVIEW_MIN_COUNT
        : SURVIVAL_BOTW_GRASS_DESKTOP_PREVIEW_MIN_COUNT;
      while (
        bladeCandidate < bladeContext.candidateCount &&
        nextBladeInstances.length < bladeContext.maxInstances &&
        workCount < candidateSliceLimit &&
        shouldContinueSurvivalBotwGrassSlice(workCount, sliceStartedAt, sliceBudgetMs)
      ) {
        const instance = makeSurvivalBotwGrassBladeCandidate(bladeContext, bladeCandidate);
        if (instance) nextBladeInstances.push(instance);
        bladeCandidate += 1;
        workCount += 1;
      }

      while (
        flowerCandidate < flowerContext.candidateCount &&
        nextFlowerInstances.length < flowerContext.maxFlowers &&
        workCount < candidateSliceLimit &&
        shouldContinueSurvivalBotwGrassSlice(workCount, sliceStartedAt, sliceBudgetMs)
      ) {
        const instance = makeSurvivalBotwFlowerCandidate(flowerContext, flowerCandidate);
        if (instance) nextFlowerInstances.push(instance);
        flowerCandidate += 1;
        workCount += 1;
      }

      const elapsedBuildMs = getSurvivalBotwGrassElapsedMs(startedAt);
      const hasEnoughFirstPreview =
        allowSparsePreviewPublish &&
        !hasPublishedGrassBuildRef.current &&
        (
          nextBladeInstances.length >= previewCount ||
          (nextBladeInstances.length >= previewMinCount && elapsedBuildMs >= SURVIVAL_BOTW_GRASS_PREVIEW_MAX_WAIT_MS)
        );
      const hasEnoughPreviewRefresh =
        allowSparsePreviewPublish &&
        hasPublishedGrassBuildRef.current &&
        !publishedGrassBuildCompleteRef.current &&
        nextBladeInstances.length >= lastPreviewPublishCount + SURVIVAL_BOTW_GRASS_PREVIEW_REFRESH_COUNT &&
        elapsedBuildMs - lastPreviewPublishAt >= SURVIVAL_BOTW_GRASS_PREVIEW_REFRESH_MS;
      if (hasEnoughFirstPreview || hasEnoughPreviewRefresh) {
        lastPreviewPublishCount = nextBladeInstances.length;
        lastPreviewPublishAt = elapsedBuildMs;
        publishBuild({
          bladeInstances: nextBladeInstances.slice(),
          flowerInstances: [],
          buildMs: elapsedBuildMs,
        }, false, false);
      }

      const doneBlades = bladeCandidate >= bladeContext.candidateCount || nextBladeInstances.length >= bladeContext.maxInstances;
      const doneFlowers = flowerCandidate >= flowerContext.candidateCount || nextFlowerInstances.length >= flowerContext.maxFlowers;
      if (doneBlades && doneFlowers) {
        appendSurvivalBotwTallFeatureFlowers(nextFlowerInstances, flowerContext);
        const buildMs = getSurvivalBotwGrassElapsedMs(startedAt);
        const result = {
          bladeInstances: nextBladeInstances,
          flowerInstances: nextFlowerInstances,
          buildMs,
        };
        rememberSurvivalBotwGrassBuild(buildKey, result);
        publishBuild(result);
        return;
      }

      timer = window.setTimeout(runSlice, SURVIVAL_BOTW_GRASS_BUILD_SLICE_DELAY_MS);
    };

    timer = window.setTimeout(runSlice, 0);

    return () => {
      cancelled = true;
      clearScheduledWork();
    };
  }, [center.x, center.y, center.z, enabled, mobilePerformanceMode]);

  useEffect(() => {
    const mesh = bladeMeshRef.current;
    if (!mesh) return;

    const bladeInstances = getSurvivalBotwGrassUploadPrioritizedInstances(
      bladeInstancesRef.current,
      uploadPriorityRef.current,
    );
    const count = Math.min(bladeInstances.length, bladeCapacity);
    const batchSize = mobilePerformanceMode
      ? SURVIVAL_BOTW_GRASS_UPLOAD_MOBILE_BATCH
      : SURVIVAL_BOTW_GRASS_UPLOAD_DESKTOP_BATCH;
    const initialBatchSize = mobilePerformanceMode
      ? SURVIVAL_BOTW_GRASS_UPLOAD_MOBILE_INITIAL_BATCH
      : SURVIVAL_BOTW_GRASS_UPLOAD_DESKTOP_INITIAL_BATCH;
    const uploadBuildKey = activeGrassUploadKeyRef.current ?? getSurvivalBotwGrassBuildKey(center, mobilePerformanceMode);
    let cancelled = false;
    let frameId: number | null = null;
    let uploadIndex = 0;
    const uploadDummy = uploadScratch.dummy;
    const uploadNormal = uploadScratch.normal;
    const uploadNormalQuaternion = uploadScratch.normalQuaternion;
    const uploadYawQuaternion = uploadScratch.yawQuaternion;
    const uploadColor = uploadScratch.color;

    if (count <= 0) {
      mesh.count = 0;
      bladeUploadCountRef.current = 0;
      bladeUploadProgressRef.current = 0;
      completedGrassUploadKeyRef.current = null;
      mesh.instanceMatrix.needsUpdate = true;
      publishSurvivalBotwGrassUploadSnapshot(
        center.x,
        center.z,
        0,
        0,
        0,
        carpetGeometry?.index ? Math.floor(carpetGeometry.index.count / 3) : 0,
      );
      return;
    }

    if (
      completedGrassUploadKeyRef.current === uploadBuildKey &&
      bladeUploadProgressRef.current >= 1 &&
      bladeUploadCountRef.current === count
    ) {
      return;
    }

    ensureSurvivalInstancedMeshColors(mesh, count);
    bladeUploadProgressRef.current = 0;
    if (bladeUploadCountRef.current <= 0 || bladeUploadCountRef.current > count) {
      mesh.count = 0;
    }

    mesh.frustumCulled = false;

    const uploadBatch = () => {
      if (cancelled) return;
      const currentBatchSize = uploadIndex === 0 ? Math.max(batchSize, initialBatchSize) : batchSize;
      const end = Math.min(count, uploadIndex + currentBatchSize);
      for (let index = uploadIndex; index < end; index += 1) {
        const instance = bladeInstances[index];
        uploadNormal.set(instance.normalX, instance.normalY, instance.normalZ).normalize();
        uploadNormalQuaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, uploadNormal);
        uploadYawQuaternion.setFromAxisAngle(SURVIVAL_GRASS_BLADE_SOURCE_UP, instance.yaw);
        uploadDummy.position.set(instance.x, instance.y, instance.z);
        uploadDummy.quaternion.copy(uploadNormalQuaternion).multiply(uploadYawQuaternion);
        uploadDummy.scale.set(instance.width, instance.height, instance.width);
        uploadDummy.updateMatrix();
        mesh.setMatrixAt(index, uploadDummy.matrix);
        mesh.setColorAt(index, uploadColor.setRGB(instance.colorR, instance.colorG, instance.colorB));
      }

      const batchStart = uploadIndex;
      uploadIndex = end;
      bladeUploadProgressRef.current = count > 0 ? uploadIndex / count : 0;
      mesh.count = Math.max(mesh.count, uploadIndex);
      markSurvivalInstancedMeshRange(mesh, batchStart, end - batchStart);

      publishSurvivalBotwGrassUploadSnapshot(
        center.x,
        center.z,
        Math.max(mesh.count, uploadIndex),
        uploadIndex,
        count,
        carpetGeometry?.index ? Math.floor(carpetGeometry.index.count / 3) : 0,
      );

      if (uploadIndex < count) {
        frameId = window.requestAnimationFrame(uploadBatch);
        return;
      }

      bladeUploadCountRef.current = count;
      bladeUploadProgressRef.current = 1;
      completedGrassUploadKeyRef.current = uploadBuildKey;
      publishSurvivalBotwGrassUploadComplete(count);
    };

    frameId = window.requestAnimationFrame(uploadBatch);
    return () => {
      cancelled = true;
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, [
    bladeCapacity,
    bladeUploadVersion,
    carpetGeometry,
    center.x,
    center.z,
    mobilePerformanceMode,
    uploadScratch,
  ]);

  useEffect(() => {
    const stemMesh = flowerStemRef.current;
    const leafMesh = flowerLeafRef.current;
    const starMesh = flowerStarBloomRef.current;
    const roundMesh = flowerRoundBloomRef.current;
    const bellMesh = flowerBellBloomRef.current;
    const puffMesh = flowerPuffBloomRef.current;
    if (!stemMesh || !leafMesh || !starMesh || !roundMesh || !bellMesh || !puffMesh) {
      publishSurvivalBotwGrassFlowerCounts(0, 0);
      return;
    }

    clearSurvivalFlowerMesh(starMesh);
    clearSurvivalFlowerMesh(roundMesh);
    clearSurvivalFlowerMesh(bellMesh);
    clearSurvivalFlowerMesh(puffMesh);

    for (let index = 0; index < flowerInstances.length; index += 1) {
      const flower = flowerInstances[index];
      normalScratch.set(flower.normalX, flower.normalY, flower.normalZ).normalize();

      dummy.position
        .set(flower.x, flower.y, flower.z)
        .addScaledVector(normalScratch, flower.stemHeight * 0.5);
      dummy.quaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, normalScratch);
      dummy.rotateY(flower.yaw);
      dummy.scale.set(flower.stemRadius, flower.stemHeight, flower.stemRadius);
      dummy.updateMatrix();
      stemMesh.setMatrixAt(index, dummy.matrix);
    }

    ensureSurvivalInstancedMeshColors(leafMesh, flowerInstances.length * 2);
    let leafInstance = 0;
    for (let index = 0; index < flowerInstances.length; index += 1) {
      const flower = flowerInstances[index];
      normalScratch.set(flower.normalX, flower.normalY, flower.normalZ).normalize();

      for (let leafSide = 0; leafSide < flower.leafCount; leafSide += 1) {
        const side = leafSide === 0 ? -1 : 1;
        dummy.position
          .set(flower.x, flower.y, flower.z)
          .addScaledVector(normalScratch, flower.stemHeight * flower.leafHeight);
        dummy.quaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, normalScratch);
        dummy.rotateY(flower.yaw + side * (0.92 + flower.leafYawOffset));
        dummy.rotateZ(side * -0.42);
        dummy.scale.set(flower.leafWidth, flower.leafLength, 1);
        dummy.updateMatrix();
        leafMesh.setMatrixAt(leafInstance, dummy.matrix);
        leafMesh.setColorAt(
          leafInstance,
          flowerColorScratch.setRGB(flower.leafColorR, flower.leafColorG, flower.leafColorB),
        );
        leafInstance += 1;
      }
    }

    const writeReadableFlowerHeads = (
      mesh: THREE.InstancedMesh,
      flowers: SurvivalBotwFlowerInstance[],
      widthScale: number,
      heightScale: number,
    ) => {
      ensureSurvivalInstancedMeshColors(mesh, flowers.length);
      let headInstance = 0;
      for (let index = 0; index < flowers.length; index += 1) {
        const flower = flowers[index];
        normalScratch.set(flower.normalX, flower.normalY, flower.normalZ).normalize();
        const batchBloomBoost = flower.largeBloomAmount ?? 0;
        const blossomY = flower.stemHeight + Math.max(0.06, flower.bloomHeight) * 0.05 + 0.08 + batchBloomBoost * 0.08;
        const headWidth = Math.min(1.35, flower.bloomWidth * (widthScale * 1.08 + batchBloomBoost * 0.08));
        const headHeight = Math.min(1.28, flower.bloomHeight * (heightScale * 1.04 + batchBloomBoost * 0.08));
        const bloomYaw = flower.yaw;

        flowerForwardScratch.set(center.x - flower.x, 0, center.z - flower.z);
        if (flowerForwardScratch.lengthSq() < 0.0001) {
          flowerForwardScratch.set(Math.sin(bloomYaw), 0, Math.cos(bloomYaw));
        }
        flowerForwardScratch
          .addScaledVector(normalScratch, -flowerForwardScratch.dot(normalScratch))
          .normalize();
        flowerRightScratch.crossVectors(normalScratch, flowerForwardScratch);
        if (flowerRightScratch.lengthSq() < 0.0001) {
          flowerRightScratch.set(Math.cos(bloomYaw), 0, -Math.sin(bloomYaw));
        } else {
          flowerRightScratch.normalize();
        }
        flowerBasisScratch.makeBasis(flowerRightScratch, normalScratch, flowerForwardScratch);
        dummy.position
          .set(flower.x, flower.y, flower.z)
          .addScaledVector(normalScratch, blossomY);
        dummy.quaternion.setFromRotationMatrix(flowerBasisScratch);
        dummy.rotateZ(bloomYaw * 0.18);
        dummy.scale.set(headWidth, headHeight, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(headInstance, dummy.matrix);
        mesh.setColorAt(
          headInstance,
          flowerColorScratch.setRGB(flower.colorR, flower.colorG, flower.colorB),
        );
        headInstance += 1;
      }
      mesh.count = headInstance;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.needsUpdate = true;
      finalizeSurvivalInstancedMeshColors(mesh);
    };

    stemMesh.count = flowerInstances.length;
    leafMesh.count = leafInstance;
    stemMesh.frustumCulled = false;
    leafMesh.frustumCulled = false;
    stemMesh.instanceMatrix.needsUpdate = true;
    leafMesh.instanceMatrix.needsUpdate = true;
    writeReadableFlowerHeads(starMesh, starFlowers, 0.72, 0.76);
    writeReadableFlowerHeads(roundMesh, roundFlowers, 0.66, 0.68);
    writeReadableFlowerHeads(bellMesh, bellFlowers, 0.6, 0.68);
    writeReadableFlowerHeads(puffMesh, puffFlowers, 0.68, 0.7);
    finalizeSurvivalInstancedMeshColors(leafMesh);

    let largeFlowerCount = 0;
    for (let index = 0; index < flowerInstances.length; index += 1) {
      const flower = flowerInstances[index];
      if ((flower.largeBloomAmount ?? 0) > 0.12) largeFlowerCount += 1;
    }
    publishSurvivalBotwGrassFlowerCounts(
      flowerInstances.length,
      largeFlowerCount,
    );
  }, [
    bellFlowers,
    center.x,
    center.z,
    dummy,
    flowerBasisScratch,
    flowerColorScratch,
    flowerForwardScratch,
    flowerInstances,
    flowerRightScratch,
    normalScratch,
    puffFlowers,
    roundFlowers,
    starFlowers,
  ]);

  useFrame(({ camera, clock }) => {
    if (!enabled) return;

    if (
      !mobilePerformanceMode ||
      clock.elapsedTime - lastMobileWindUpdateAtRef.current >= MOBILE_BOTW_GRASS_WIND_UPDATE_INTERVAL_SECONDS
    ) {
      lastMobileWindUpdateAtRef.current = clock.elapsedTime;
      windUniform.value = clock.elapsedTime;
    }
    const viewerPosition = getSurvivalLocalGrassViewerPositionInto(camera, viewerPositionRef.current);
    const currentCenter = centerRef.current;
    const lastViewer = lastViewerRef.current;
    let predictedX = viewerPosition.x;
    let predictedZ = viewerPosition.z;
    let leadDistance = 0;
    let leadSpeed = 0;
    let leadDirectionX = 0;
    let leadDirectionZ = 0;
    let centerTravelAlignment = 1;
    if (lastViewer.ready) {
      const deltaTime = Math.max(0.016, clock.elapsedTime - lastViewer.time);
      const deltaX = viewerPosition.x - lastViewer.x;
      const deltaZ = viewerPosition.z - lastViewer.z;
      const travelDistanceSq = deltaX * deltaX + deltaZ * deltaZ;
      const hasTravelDistance = travelDistanceSq > 0.001 * 0.001;
      const instantVelocityX = hasTravelDistance ? deltaX / deltaTime : 0;
      const instantVelocityZ = hasTravelDistance ? deltaZ / deltaTime : 0;
      const velocityAlpha = 1 - Math.exp(-deltaTime * SURVIVAL_BOTW_GRASS_LEAD_SMOOTHING);
      const leadVelocity = grassLeadVelocityRef.current;
      leadVelocity.x = THREE.MathUtils.lerp(leadVelocity.x, instantVelocityX, velocityAlpha);
      leadVelocity.z = THREE.MathUtils.lerp(leadVelocity.z, instantVelocityZ, velocityAlpha);
      const leadSpeedSq = leadVelocity.x * leadVelocity.x + leadVelocity.z * leadVelocity.z;
      if (leadSpeedSq > 0.49) {
        leadSpeed = Math.sqrt(leadSpeedSq);
        leadDirectionX = leadVelocity.x / leadSpeed;
        leadDirectionZ = leadVelocity.z / leadSpeed;
        const minLeadDistance = leadSpeed >= SURVIVAL_BOTW_GRASS_FAST_LEAD_SPEED
          ? SURVIVAL_BOTW_GRASS_FAST_MIN_LEAD_DISTANCE
          : SURVIVAL_BOTW_GRASS_MIN_LEAD_DISTANCE;
        leadDistance = THREE.MathUtils.clamp(
          leadSpeed * SURVIVAL_BOTW_GRASS_LEAD_SECONDS,
          minLeadDistance,
          SURVIVAL_BOTW_GRASS_MAX_LEAD_DISTANCE,
        );
        predictedX += leadDirectionX * leadDistance;
        predictedZ += leadDirectionZ * leadDistance;
      }
    }
    lastViewer.x = viewerPosition.x;
    lastViewer.z = viewerPosition.z;
    lastViewer.time = clock.elapsedTime;
    lastViewer.ready = true;
    const uploadPriority = uploadPriorityRef.current;
    uploadPriority.viewerX = viewerPosition.x;
    uploadPriority.viewerZ = viewerPosition.z;
    uploadPriority.leadX = predictedX;
    uploadPriority.leadZ = predictedZ;
    const viewerCenterDeltaX = viewerPosition.x - currentCenter.x;
    const viewerCenterDeltaZ = viewerPosition.z - currentCenter.z;
    const targetCenterDeltaX = predictedX - currentCenter.x;
    const targetCenterDeltaZ = predictedZ - currentCenter.z;
    const viewerDistanceFromGrassCenterSq = viewerCenterDeltaX * viewerCenterDeltaX + viewerCenterDeltaZ * viewerCenterDeltaZ;
    const targetDistanceFromGrassCenterSq = targetCenterDeltaX * targetCenterDeltaX + targetCenterDeltaZ * targetCenterDeltaZ;
    const chunkStreamingActive = getSurvivalProceduralPendingChunkCount() > 0;
    const currentGrassBuildKey = getSurvivalBotwGrassBuildKey(currentCenter, mobilePerformanceMode);
    const currentCenterBuildStillPublishing =
      publishedGrassBuildKeyRef.current !== currentGrassBuildKey ||
      !publishedGrassBuildCompleteRef.current;
    const shouldDelayGrassRecenter =
      chunkStreamingActive &&
      viewerDistanceFromGrassCenterSq < SURVIVAL_BOTW_GRASS_PENDING_VIEWER_SAFE_DISTANCE_SQ &&
      targetDistanceFromGrassCenterSq < SURVIVAL_BOTW_GRASS_PENDING_TARGET_SAFE_DISTANCE_SQ;
    const coldBuildStillPublishing = !hasPublishedGrassBuildRef.current;
    const uploadStillCatchingUp =
      bladeUploadProgressRef.current < SURVIVAL_BOTW_GRASS_UPLOAD_RECENTER_MIN_PROGRESS &&
      viewerDistanceFromGrassCenterSq < SURVIVAL_BOTW_GRASS_UPLOAD_RECENTER_EDGE_RELEASE_DISTANCE_SQ;
    const timeSinceRecenter = clock.elapsedTime - lastGrassRecenterAtRef.current;
    const viewerCenter = getSurvivalBotwGrassSnappedCenter(viewerPosition.x, viewerPosition.y, viewerPosition.z);
    const predictedCenter = getSurvivalBotwGrassSnappedCenter(predictedX, viewerPosition.y, predictedZ);
    const viewerNeedsGrassRecenter = viewerDistanceFromGrassCenterSq > SURVIVAL_BOTW_GRASS_RECENTER_DISTANCE_SQ;
    const targetNeedsGrassRecenter =
      targetDistanceFromGrassCenterSq > SURVIVAL_BOTW_GRASS_TARGET_RECENTER_DISTANCE_SQ;
    if (
      viewerDistanceFromGrassCenterSq > SURVIVAL_BOTW_GRASS_PREWARM_VIEWER_DISTANCE_SQ &&
      (viewerCenter.x !== currentCenter.x || viewerCenter.z !== currentCenter.z)
    ) {
      prewarmSurvivalBotwGrassBuild(
        viewerCenter,
        mobilePerformanceMode,
        SURVIVAL_BOTW_GRASS_MAX_DIRECTIONAL_PENDING_PREWARMS,
      );
    }
    if (
      targetDistanceFromGrassCenterSq > SURVIVAL_BOTW_GRASS_PREWARM_DISTANCE_SQ &&
      (predictedCenter.x !== currentCenter.x || predictedCenter.z !== currentCenter.z)
    ) {
      prewarmSurvivalBotwGrassBuild(
        predictedCenter,
        mobilePerformanceMode,
        SURVIVAL_BOTW_GRASS_MAX_DIRECTIONAL_PENDING_PREWARMS,
      );
      if (leadSpeed > 0.7) {
        for (let step = 1; step <= SURVIVAL_BOTW_GRASS_PREWARM_AHEAD_STEPS; step += 1) {
          const aheadCenter = getSurvivalBotwGrassSnappedCenter(
            predictedX + leadDirectionX * SURVIVAL_BOTW_GRASS_CENTER_STEP * step,
            viewerPosition.y,
            predictedZ + leadDirectionZ * SURVIVAL_BOTW_GRASS_CENTER_STEP * step,
          );
          if (
            (aheadCenter.x !== currentCenter.x || aheadCenter.z !== currentCenter.z) &&
            (aheadCenter.x !== predictedCenter.x || aheadCenter.z !== predictedCenter.z)
          ) {
            prewarmSurvivalBotwGrassBuild(
              aheadCenter,
              mobilePerformanceMode,
              SURVIVAL_BOTW_GRASS_MAX_DIRECTIONAL_PENDING_PREWARMS,
            );
          }
        }
      }
    }
    const neighborPrewarm = neighborGrassPrewarmRef.current;
    if (neighborPrewarm.centerKey !== currentGrassBuildKey) {
      neighborPrewarm.centerKey = currentGrassBuildKey;
      neighborPrewarm.offsetIndex = 0;
      neighborPrewarm.lastAt = 0;
    }
    const canPrewarmNeighborShell =
      hasPublishedGrassBuildRef.current &&
      publishedGrassBuildCompleteRef.current &&
      bladeUploadProgressRef.current >= 0.72 &&
      getPendingSurvivalBotwGrassBuildCount() < SURVIVAL_BOTW_GRASS_MAX_BACKGROUND_PENDING_PREWARMS &&
      clock.elapsedTime - neighborPrewarm.lastAt >= SURVIVAL_BOTW_GRASS_NEIGHBOR_PREWARM_INTERVAL_SECONDS;
    if (canPrewarmNeighborShell) {
      const travelStepX = leadSpeed > 0.7 && Math.abs(leadDirectionX) > 0.28 ? Math.sign(leadDirectionX) : 0;
      const travelStepZ = leadSpeed > 0.7 && Math.abs(leadDirectionZ) > 0.28 ? Math.sign(leadDirectionZ) : 0;
      const travelOffsets = neighborPrewarm.travelOffsets;
      let travelOffsetCount = 0;
      if (travelStepX || travelStepZ) {
        travelOffsets[travelOffsetCount][0] = travelStepX;
        travelOffsets[travelOffsetCount][1] = travelStepZ;
        travelOffsetCount += 1;
        if (travelStepX) {
          travelOffsets[travelOffsetCount][0] = travelStepX;
          travelOffsets[travelOffsetCount][1] = 0;
          travelOffsetCount += 1;
          travelOffsets[travelOffsetCount][0] = travelStepX * 2;
          travelOffsets[travelOffsetCount][1] = travelStepZ;
          travelOffsetCount += 1;
        }
        if (travelStepZ) {
          travelOffsets[travelOffsetCount][0] = 0;
          travelOffsets[travelOffsetCount][1] = travelStepZ;
          travelOffsetCount += 1;
          travelOffsets[travelOffsetCount][0] = travelStepX;
          travelOffsets[travelOffsetCount][1] = travelStepZ * 2;
          travelOffsetCount += 1;
        }
      }
      const orderedOffsetCount = travelOffsetCount + SURVIVAL_BOTW_GRASS_NEIGHBOR_PREWARM_OFFSETS.length;
      const seenOffsets = neighborPrewarm.seenOffsets;
      let seenOffsetCount = 0;
      for (let attempt = 0; attempt < orderedOffsetCount; attempt += 1) {
        const orderedIndex = (neighborPrewarm.offsetIndex + attempt) % orderedOffsetCount;
        const offset = orderedIndex < travelOffsetCount
          ? travelOffsets[orderedIndex]
          : SURVIVAL_BOTW_GRASS_NEIGHBOR_PREWARM_OFFSETS[orderedIndex - travelOffsetCount];
        const offsetX = offset[0];
        const offsetZ = offset[1];
        let alreadySeen = false;
        for (let seenIndex = 0; seenIndex < seenOffsetCount; seenIndex += 1) {
          if (seenOffsets[seenIndex][0] === offsetX && seenOffsets[seenIndex][1] === offsetZ) {
            alreadySeen = true;
            break;
          }
        }
        if (alreadySeen) continue;
        seenOffsets[seenOffsetCount][0] = offsetX;
        seenOffsets[seenOffsetCount][1] = offsetZ;
        seenOffsetCount += 1;
        if (offsetX === 0 && offsetZ === 0) continue;
        const neighborCenter = getSurvivalBotwGrassSnappedCenter(
          currentCenter.x + offsetX * SURVIVAL_BOTW_GRASS_CENTER_STEP,
          viewerPosition.y,
          currentCenter.z + offsetZ * SURVIVAL_BOTW_GRASS_CENTER_STEP,
        );
        const neighborKey = getSurvivalBotwGrassBuildKey(neighborCenter, mobilePerformanceMode);
        if (neighborKey === currentGrassBuildKey) continue;
        prewarmSurvivalBotwGrassBuild(
          neighborCenter,
          mobilePerformanceMode,
          SURVIVAL_BOTW_GRASS_MAX_BACKGROUND_PENDING_PREWARMS,
        );
        neighborPrewarm.offsetIndex = (neighborPrewarm.offsetIndex + attempt + 1) % orderedOffsetCount;
        neighborPrewarm.lastAt = clock.elapsedTime;
        break;
      }
    }
    if (
      (viewerNeedsGrassRecenter || targetNeedsGrassRecenter) &&
      !shouldDelayGrassRecenter &&
      !uploadStillCatchingUp &&
      !coldBuildStillPublishing &&
      (!currentCenterBuildStillPublishing ||
        viewerDistanceFromGrassCenterSq > SURVIVAL_BOTW_GRASS_PREVIEW_RECENTER_VIEWER_DISTANCE_SQ)
    ) {
      const viewerDistanceFromGrassCenter = Math.sqrt(viewerDistanceFromGrassCenterSq);
      const targetDistanceFromGrassCenter = Math.sqrt(targetDistanceFromGrassCenterSq);
      const recenterEmergency = viewerDistanceFromGrassCenterSq > SURVIVAL_BOTW_GRASS_RECENTER_EMERGENCY_VIEWER_DISTANCE_SQ;
      const predictedViewerDeltaX = viewerPosition.x - predictedCenter.x;
      const predictedViewerDeltaZ = viewerPosition.z - predictedCenter.z;
      const predictedViewerDistanceSq = predictedViewerDeltaX * predictedViewerDeltaX + predictedViewerDeltaZ * predictedViewerDeltaZ;
      const prioritizeViewerCenter =
        recenterEmergency ||
        viewerNeedsGrassRecenter ||
        viewerDistanceFromGrassCenterSq > SURVIVAL_BOTW_GRASS_RECENTER_VIEWER_DRIFT_RELEASE_SQ ||
        predictedViewerDistanceSq >= SURVIVAL_BOTW_GRASS_RECENTER_MAX_VIEWER_DISTANCE_SQ;
      const firstCandidateCenter = prioritizeViewerCenter ? viewerCenter : predictedCenter;
      const secondCandidateCenter = prioritizeViewerCenter ? predictedCenter : viewerCenter;
      for (let candidateIndex = 0; candidateIndex < 2; candidateIndex += 1) {
        const nextCenter = candidateIndex === 0 ? firstCandidateCenter : secondCandidateCenter;
        if (nextCenter.x === currentCenter.x && nextCenter.z === currentCenter.z) continue;
        const nextBuildKey = getSurvivalBotwGrassBuildKey(nextCenter, mobilePerformanceMode);
        const nextBuildReady = hasCachedSurvivalBotwGrassBuild(nextBuildKey) ||
          (
            publishedGrassBuildKeyRef.current === nextBuildKey &&
            publishedGrassBuildCompleteRef.current
          );
        const canBootstrapViewerCenter =
          nextCenter === viewerCenter &&
          viewerDistanceFromGrassCenter > SURVIVAL_BOTW_GRASS_PREVIEW_RECENTER_VIEWER_DISTANCE;
        if (!nextBuildReady && !canBootstrapViewerCenter) continue;
        const nextViewerDeltaX = viewerPosition.x - nextCenter.x;
        const nextViewerDeltaZ = viewerPosition.z - nextCenter.z;
        const nextTargetDeltaX = predictedX - nextCenter.x;
        const nextTargetDeltaZ = predictedZ - nextCenter.z;
        const nextViewerDistanceSq = nextViewerDeltaX * nextViewerDeltaX + nextViewerDeltaZ * nextViewerDeltaZ;
        const nextTargetDistanceSq = nextTargetDeltaX * nextTargetDeltaX + nextTargetDeltaZ * nextTargetDeltaZ;
        const centerMoveX = nextCenter.x - currentCenter.x;
        const centerMoveZ = nextCenter.z - currentCenter.z;
        const centerMoveLengthSq = centerMoveX * centerMoveX + centerMoveZ * centerMoveZ;
        if (centerMoveLengthSq > 0 && leadSpeed > 0.7) {
          const inverseCenterMoveLength = 1 / Math.sqrt(centerMoveLengthSq);
          centerTravelAlignment = centerMoveX * inverseCenterMoveLength * leadDirectionX + centerMoveZ * inverseCenterMoveLength * leadDirectionZ;
        } else {
          centerTravelAlignment = 1;
        }
        const recenterIntervalReady =
          timeSinceRecenter >= SURVIVAL_BOTW_GRASS_RECENTER_MIN_INTERVAL_SECONDS ||
          viewerDistanceFromGrassCenterSq > SURVIVAL_BOTW_GRASS_RECENTER_VIEWER_DRIFT_RELEASE_SQ;
        const nextCenterKeepsViewerCovered = recenterEmergency ||
          nextViewerDistanceSq < SURVIVAL_BOTW_GRASS_RECENTER_MAX_VIEWER_DISTANCE_SQ;
        const targetDistanceRelease = Math.max(
          SURVIVAL_BOTW_GRASS_RECENTER_MAX_VIEWER_DISTANCE,
          targetDistanceFromGrassCenter + 12,
        );
        const nextCenterKeepsTargetCovered = recenterEmergency ||
          nextCenter === viewerCenter ||
          nextTargetDistanceSq <= targetDistanceRelease * targetDistanceRelease;
        const viewerDistanceRelease = viewerDistanceFromGrassCenter + SURVIVAL_BOTW_GRASS_RECENTER_MAX_VIEWER_DISTANCE_INCREASE;
        const nextCenterDoesNotOverleadViewer =
          nextViewerDistanceSq <= viewerDistanceRelease * viewerDistanceRelease ||
          viewerDistanceFromGrassCenterSq > SURVIVAL_BOTW_GRASS_RECENTER_DISTANCE_SQ;
        const nextCenterTracksTravel =
          recenterEmergency ||
          nextCenter === viewerCenter ||
          centerTravelAlignment >= SURVIVAL_BOTW_GRASS_MIN_CENTER_TRAVEL_ALIGNMENT ||
          viewerDistanceFromGrassCenterSq > SURVIVAL_BOTW_GRASS_RECENTER_VIEWER_DRIFT_RELEASE_SQ;
        if (
          recenterIntervalReady &&
          nextCenterKeepsViewerCovered &&
          nextCenterKeepsTargetCovered &&
          nextCenterDoesNotOverleadViewer &&
          nextCenterTracksTravel
        ) {
          centerRef.current = nextCenter;
          lastGrassRecenterAtRef.current = clock.elapsedTime;
          const keepCurrentFullGrassVisible =
            nextBuildReady ||
            (
              !canBootstrapViewerCenter &&
              publishedGrassBuildCompleteRef.current &&
              bladeInstancesRef.current.length >= bladeCapacity * 0.82
            );
          if (!nextBuildReady && canBootstrapViewerCenter) {
            forceSparsePreviewBuildKeyRef.current = nextBuildKey;
          }
          hasPublishedGrassBuildRef.current = keepCurrentFullGrassVisible;
          bladeUploadProgressRef.current = keepCurrentFullGrassVisible ? 1 : 0;
          publishSurvivalBotwGrassBuildState(nextBuildReady ? "switching-ready" : "emergency");
          startTransition(() => setCenter(nextCenter));
          break;
        }
      }
    }
    if (publishRuntimeMetrics) {
      const viewerDistanceFromGrassCenter = Math.sqrt(viewerDistanceFromGrassCenterSq);
      const targetDistanceFromGrassCenter = Math.sqrt(targetDistanceFromGrassCenterSq);
      publishSurvivalBotwGrassRuntimeMetrics({
        leadDistance,
        leadSpeed,
        centerTravelAlignment,
        targetDistance: targetDistanceFromGrassCenter,
        viewerDistance: viewerDistanceFromGrassCenter,
        uploadRatio: bladeUploadProgressRef.current,
      });
    }
    if (grassDebugViewEnabled) {
      const debugSecond = Math.floor(clock.elapsedTime);
      if (debugSampleSecondRef.current !== debugSecond) {
        debugSampleSecondRef.current = debugSecond;
        const offsets = [-40, -10, 15, 40, 70, 100, 135, 175, 220, 270];
        const debugSamples = [];
        for (let index = 0; index < offsets.length; index += 1) {
          const offset = offsets[index];
          debugSamples.push({
            offset,
            ...getSurvivalGrassDebugSampleAt(viewerPosition.x + offset, viewerPosition.z),
          });
        }
        publishSurvivalBotwGrassDebugLine(debugSamples);
      }
    } else {
      clearSurvivalBotwGrassDebugLine();
    }

    const groundY = getSurvivalGrassSurfaceHeightAtWorld(viewerPosition.x, viewerPosition.z);
    const altitude = Math.max(0, viewerPosition.y - groundY);
    const airMix = smoothstepRange(32, 180, altitude);
    const lowCameraClearance = lowCameraGrassClearanceRef.current;
    fadeUniforms.viewerXZ.value.set(viewerPosition.x, viewerPosition.z);
    fadeUniforms.viewerY.value = viewerPosition.y;
    if (fadeUniforms.nearFadeStart && fadeUniforms.nearFadeEnd) {
      if (lowCameraClearance > 0.01) {
        fadeUniforms.nearFadeStart.value = 0.06;
        fadeUniforms.nearFadeEnd.value = 0.9 + 2.6 * lowCameraClearance;
      } else {
        fadeUniforms.nearFadeStart.value = 0;
        fadeUniforms.nearFadeEnd.value = 0;
      }
    }
    fadeUniforms.radius.value = lerpNumber(
      SURVIVAL_BOTW_GRASS_RADIUS + SURVIVAL_BOTW_GRASS_EDGE_FADE * 0.72,
      SURVIVAL_BOTW_GRASS_AIR_RADIUS + SURVIVAL_BOTW_GRASS_EDGE_FADE * 0.92,
      airMix,
    );
    fadeUniforms.fadeWidth.value = lerpNumber(SURVIVAL_BOTW_GRASS_EDGE_FADE, SURVIVAL_BOTW_GRASS_EDGE_FADE * 1.55, airMix);
    fadeUniforms.altitudeFade.value = 1 - smoothstepRange(
      SURVIVAL_LOCAL_GRASS_HIGH_ALTITUDE_FADE_START,
      SURVIVAL_LOCAL_GRASS_HIGH_ALTITUDE_FADE_END,
      altitude,
    );
    carpetFadeUniforms.viewerXZ.value.set(viewerPosition.x, viewerPosition.z);
    carpetFadeUniforms.viewerY.value = viewerPosition.y;
    carpetFadeUniforms.radius.value = lerpNumber(SURVIVAL_BOTW_GRASS_CARPET_RADIUS, SURVIVAL_BOTW_GRASS_CARPET_AIR_RADIUS, airMix);
    carpetFadeUniforms.fadeWidth.value = lerpNumber(SURVIVAL_BOTW_GRASS_CARPET_EDGE_FADE, SURVIVAL_BOTW_GRASS_CARPET_EDGE_FADE * 1.35, airMix);
    carpetFadeUniforms.altitudeFade.value = fadeUniforms.altitudeFade.value;
    flowerFadeUniforms.viewerXZ.value.set(viewerPosition.x, viewerPosition.z);
    flowerFadeUniforms.viewerY.value = viewerPosition.y;
    flowerFadeUniforms.radius.value = lerpNumber(
      SURVIVAL_BOTW_GRASS_FLOWER_VISIBLE_RADIUS,
      SURVIVAL_BOTW_GRASS_FLOWER_VISIBLE_RADIUS * 1.36,
      airMix,
    );
    flowerFadeUniforms.fadeWidth.value = lerpNumber(
      SURVIVAL_BOTW_GRASS_FLOWER_VISIBLE_FADE,
      SURVIVAL_BOTW_GRASS_FLOWER_VISIBLE_FADE * 1.22,
      airMix,
    );
    flowerFadeUniforms.altitudeFade.value = fadeUniforms.altitudeFade.value;
  });

  if (!enabled) return null;

  const flowerCapacity = Math.max(1, flowerInstances.length);
  const flowerLeafCapacity = Math.max(1, flowerInstances.length * 2);
  const starFlowerCapacity = Math.max(1, starFlowers.length);
  const roundFlowerCapacity = Math.max(1, roundFlowers.length);
  const bellFlowerCapacity = Math.max(1, bellFlowers.length);
  const puffFlowerCapacity = Math.max(1, puffFlowers.length);

  return (
    <group name="survival-botw-grass-field" userData={HIDE_FROM_MINIMAP}>
      {carpetGeometry && (
        <mesh geometry={carpetGeometry} renderOrder={2.8} frustumCulled={false} userData={HIDE_FROM_MINIMAP} dispose={null}>
          <meshBasicMaterial
            map={meadowCarpetTexture}
            color="#ffffff"
            vertexColors
            side={THREE.FrontSide}
            transparent
            opacity={0.42}
            depthWrite={false}
            depthTest
            polygonOffset
            polygonOffsetFactor={-5}
            polygonOffsetUnits={-5}
            toneMapped={false}
            onBeforeCompile={(shader) => {
              applySurvivalLocalGrassShader(shader, carpetFadeUniforms);
            }}
          />
        </mesh>
      )}
      <instancedMesh
        ref={bladeMeshRef}
        args={[undefined, undefined, bladeCapacity]}
        renderOrder={4.1}
        frustumCulled={false}
      >
        <primitive object={bladeGeometry} attach="geometry" />
        <meshBasicMaterial
          map={bladeTexture ?? undefined}
          vertexColors
          side={THREE.DoubleSide}
          transparent
          opacity={0.98}
          alphaTest={0.14}
          depthWrite={false}
          depthTest
          toneMapped={false}
          onBeforeCompile={(shader) => {
            shader.uniforms.uBotwGrassWind = windUniform;
            shader.vertexShader = `attribute float grassBendWeight;
uniform float uBotwGrassWind;
${shader.vertexShader}`;
            applySurvivalLocalGrassShader(
              shader,
              fadeUniforms,
              `float botwGrassWindA = sin(uBotwGrassWind * 1.65 + position.x * 2.1 + position.z * 1.2);
              float botwGrassWindB = cos(uBotwGrassWind * 2.15 + position.x * 0.7 - position.z * 1.8);
              transformed.x += (botwGrassWindA * 0.085 + botwGrassWindB * 0.045) * grassBendWeight;
              transformed.z += (botwGrassWindB * 0.07) * grassBendWeight;`,
              0,
              0,
            );
          }}
        />
      </instancedMesh>
      {flowerInstances.length > 0 && (
        <>
          <instancedMesh ref={flowerStemRef} args={[undefined, undefined, flowerCapacity]} renderOrder={4.22} frustumCulled={false} userData={HIDE_FROM_MINIMAP}>
            <cylinderGeometry args={[1, 1, 1, 4]} />
            <meshBasicMaterial
              color="#61b640"
              depthWrite
              depthTest
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, flowerFadeUniforms);
              }}
            />
          </instancedMesh>
          <instancedMesh ref={flowerLeafRef} args={[undefined, undefined, flowerLeafCapacity]} renderOrder={4.3} frustumCulled={false} userData={HIDE_FROM_MINIMAP}>
            <planeGeometry args={[1, 1, 1, 1]} />
            <meshBasicMaterial
              color="#ffffff"
              side={THREE.DoubleSide}
              vertexColors
              depthWrite={false}
              depthTest
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, flowerFadeUniforms);
              }}
            />
          </instancedMesh>
          <instancedMesh ref={flowerStarBloomRef} args={[undefined, undefined, starFlowerCapacity]} renderOrder={4.05} frustumCulled={false} userData={HIDE_FROM_MINIMAP}>
            <primitive object={flowerHeadGeometry} attach="geometry" />
            <meshBasicMaterial
              color="#7dd3fc"
              map={flowerHeadTexture}
              side={THREE.DoubleSide}
              alphaTest={0.42}
              depthWrite
              depthTest
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, flowerFadeUniforms, "", 1.2, 4.5);
              }}
            />
          </instancedMesh>
          <instancedMesh ref={flowerRoundBloomRef} args={[undefined, undefined, roundFlowerCapacity]} renderOrder={4.05} frustumCulled={false} userData={HIDE_FROM_MINIMAP}>
            <primitive object={flowerHeadGeometry} attach="geometry" />
            <meshBasicMaterial
              color="#fff45c"
              map={flowerHeadTexture}
              side={THREE.DoubleSide}
              alphaTest={0.42}
              depthWrite
              depthTest
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, flowerFadeUniforms, "", 1.2, 4.5);
              }}
            />
          </instancedMesh>
          <instancedMesh ref={flowerBellBloomRef} args={[undefined, undefined, bellFlowerCapacity]} renderOrder={4.05} frustumCulled={false} userData={HIDE_FROM_MINIMAP}>
            <primitive object={flowerHeadGeometry} attach="geometry" />
            <meshBasicMaterial
              color="#ff8ab8"
              map={flowerHeadTexture}
              side={THREE.DoubleSide}
              alphaTest={0.42}
              depthWrite
              depthTest
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, flowerFadeUniforms, "", 1.2, 4.5);
              }}
            />
          </instancedMesh>
          <instancedMesh ref={flowerPuffBloomRef} args={[undefined, undefined, puffFlowerCapacity]} renderOrder={4.05} frustumCulled={false} userData={HIDE_FROM_MINIMAP}>
            <primitive object={flowerHeadGeometry} attach="geometry" />
            <meshBasicMaterial
              color="#f0abfc"
              map={flowerHeadTexture}
              side={THREE.DoubleSide}
              alphaTest={0.42}
              depthWrite
              depthTest
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, flowerFadeUniforms, "", 1.2, 4.5);
              }}
            />
          </instancedMesh>
        </>
      )}
    </group>
  );
}

export function SurvivalBotwGrassField({ disabled = false }: { disabled?: boolean }) {
  if (disabled || !SURVIVAL_GRASS_SYSTEM_ENABLED) return null;
  return <ActiveSurvivalBotwGrassField />;
}
