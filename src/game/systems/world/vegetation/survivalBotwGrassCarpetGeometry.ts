import * as THREE from "three";
import { getSurvivalRestoredMeadowMask } from "../survival/survivalBiome";
import { clamp01, smoothstepRange, survivalHash01 } from "../survival/survivalMath";
import {
  SURVIVAL_BOTW_GRASS_BUILD_CACHE_LIMIT,
  SURVIVAL_BOTW_GRASS_CARPET_RADIUS,
  SURVIVAL_BOTW_GRASS_CARPET_SEGMENTS,
} from "./survivalBotwGrassConfig";
import { getSurvivalBotwGrassCarpetPlacementForBuild } from "./survivalBotwGrassPlacement";
import {
  getSurvivalGrassSurfaceHeightAtWorld,
  getSurvivalSmoothedTerrainColorInto,
} from "./survivalBotwGrassResolvers";

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

export function getCachedSurvivalBotwGrassCarpetGeometry(centerX: number, centerZ: number, mobilePerformanceMode: boolean) {
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

export function makeSurvivalBotwGrassCarpetGeometry(centerX: number, centerZ: number, mobilePerformanceMode: boolean) {
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
