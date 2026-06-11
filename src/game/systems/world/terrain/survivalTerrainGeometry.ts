import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import { clamp01, lerpNumber } from "../survival/survivalMath";
import {
  getSurvivalRenderedTerrainColor,
  getSurvivalRenderedTerrainColorInto,
  getSurvivalTerrainHeightForChunk,
} from "../survival/survivalTerrainSurface";
import {
  SURVIVAL_COLLISION_RADIUS,
  SURVIVAL_TERRAIN_CACHE_LIMIT,
  SURVIVAL_TERRAIN_CENTER_COLLISION_SEGMENTS,
  SURVIVAL_TERRAIN_CENTER_SEGMENTS,
  SURVIVAL_TERRAIN_DETAIL_UV_WORLD_SIZE,
  SURVIVAL_TERRAIN_FAR_SEGMENTS,
  SURVIVAL_TERRAIN_MID_SEGMENTS,
  SURVIVAL_TERRAIN_NEAR_COLLISION_SEGMENTS,
  SURVIVAL_TERRAIN_NEAR_SEGMENTS,
  SURVIVAL_TERRAIN_SKIRT_DEPTH,
  SURVIVAL_TERRAIN_SKIRT_TOP_INSET,
  type SurvivalChunkInfo,
} from "../survival/survivalWorldConfig";

type SurvivalTerrainHeightGrid = {
  segments: number;
  heights: Float32Array;
};

type SurvivalTerrainEdgeSample = {
  height: number;
  color: THREE.Color;
};

export type SurvivalTerrainSkirtEdges = {
  north: boolean;
  east: boolean;
  south: boolean;
  west: boolean;
};

export const SURVIVAL_ALL_TERRAIN_SKIRT_EDGES: SurvivalTerrainSkirtEdges = {
  north: true,
  east: true,
  south: true,
  west: true,
};

const SURVIVAL_TERRAIN_COLOR_CACHE_VERSION = "grass-blend-v4";
const survivalTerrainGeometryCache = new Map<string, THREE.BufferGeometry>();
const survivalTerrainSkirtGeometryCache = new Map<string, THREE.BufferGeometry>();
const survivalTerrainCollisionGeometryCache = new Map<string, THREE.BufferGeometry>();
const survivalTerrainHeightGridCache = new Map<string, SurvivalTerrainHeightGrid>();

export function getSurvivalTerrainSegmentsForLod(lod: SurvivalChunkInfo["lod"]) {
  return lod === "near"
    ? SURVIVAL_TERRAIN_NEAR_SEGMENTS
    : lod === "mid"
      ? SURVIVAL_TERRAIN_MID_SEGMENTS
      : SURVIVAL_TERRAIN_FAR_SEGMENTS;
}

export function getSurvivalTerrainRenderSegments(chunk: SurvivalChunkInfo) {
  if (chunk.distance === 0) return SURVIVAL_TERRAIN_CENTER_SEGMENTS;
  return getSurvivalTerrainSegmentsForLod(chunk.lod);
}

export function getSurvivalTerrainCollisionSegments(chunk: SurvivalChunkInfo) {
  if (chunk.distance === 0) return SURVIVAL_TERRAIN_CENTER_COLLISION_SEGMENTS;
  if (chunk.distance <= SURVIVAL_COLLISION_RADIUS) return SURVIVAL_TERRAIN_NEAR_COLLISION_SEGMENTS;
  return getSurvivalTerrainSegmentsForLod(chunk.lod);
}

function trimSurvivalGeometryCache(cache: Map<string, THREE.BufferGeometry>) {
  if (cache.size <= SURVIVAL_TERRAIN_CACHE_LIMIT) return;
  const oldestKey = cache.keys().next().value;
  if (oldestKey) {
    cache.get(oldestKey)?.dispose();
    cache.delete(oldestKey);
  }
}

function trimSurvivalTerrainHeightGridCache() {
  while (survivalTerrainHeightGridCache.size > SURVIVAL_TERRAIN_CACHE_LIMIT) {
    const oldestKey = survivalTerrainHeightGridCache.keys().next().value;
    if (!oldestKey) return;
    survivalTerrainHeightGridCache.delete(oldestKey);
  }
}

function getSurvivalTerrainHeightGrid(chunk: SurvivalChunkInfo, segments: number) {
  const cacheKey = `${chunk.key}:height-grid:${segments}`;
  const cached = survivalTerrainHeightGridCache.get(cacheKey);
  if (cached) {
    survivalTerrainHeightGridCache.delete(cacheKey);
    survivalTerrainHeightGridCache.set(cacheKey, cached);
    return cached;
  }

  const halfBlock = SURVIVAL_BLOCK_SIZE / 2;
  const step = SURVIVAL_BLOCK_SIZE / segments;
  const gridSize = segments + 1;
  const heights = new Float32Array(gridSize * gridSize);

  for (let zIndex = 0; zIndex <= segments; zIndex += 1) {
    const localZ = -halfBlock + zIndex * step;
    for (let xIndex = 0; xIndex <= segments; xIndex += 1) {
      const localX = -halfBlock + xIndex * step;
      heights[zIndex * gridSize + xIndex] = getSurvivalTerrainHeightForChunk(chunk, localX, localZ);
    }
  }

  const grid = { segments, heights };
  survivalTerrainHeightGridCache.set(cacheKey, grid);
  trimSurvivalTerrainHeightGridCache();
  return grid;
}

export function getSurvivalRenderedTerrainHeightForChunk(
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  segments = getSurvivalTerrainRenderSegments(chunk),
) {
  const grid = getSurvivalTerrainHeightGrid(chunk, segments);
  const halfBlock = SURVIVAL_BLOCK_SIZE / 2;
  const step = SURVIVAL_BLOCK_SIZE / grid.segments;
  const gridSize = grid.segments + 1;
  const x = clamp01((localX + halfBlock) / SURVIVAL_BLOCK_SIZE) * grid.segments;
  const z = clamp01((localZ + halfBlock) / SURVIVAL_BLOCK_SIZE) * grid.segments;
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const x1 = Math.min(grid.segments, x0 + 1);
  const z1 = Math.min(grid.segments, z0 + 1);
  const tx = x - x0;
  const tz = z - z0;
  const h00 = grid.heights[z0 * gridSize + x0] ?? getSurvivalTerrainHeightForChunk(chunk, -halfBlock + x0 * step, -halfBlock + z0 * step);
  const h10 = grid.heights[z0 * gridSize + x1] ?? h00;
  const h01 = grid.heights[z1 * gridSize + x0] ?? h00;
  const h11 = grid.heights[z1 * gridSize + x1] ?? h01;
  return lerpNumber(
    lerpNumber(h00, h10, tx),
    lerpNumber(h01, h11, tx),
    tz,
  );
}

export function getSurvivalRenderedTerrainNormalForChunkInto(
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  target: THREE.Vector3,
  sampleDistance = 4,
  segments = getSurvivalTerrainRenderSegments(chunk),
) {
  const left = getSurvivalRenderedTerrainHeightForChunk(chunk, localX - sampleDistance, localZ, segments);
  const right = getSurvivalRenderedTerrainHeightForChunk(chunk, localX + sampleDistance, localZ, segments);
  const down = getSurvivalRenderedTerrainHeightForChunk(chunk, localX, localZ - sampleDistance, segments);
  const up = getSurvivalRenderedTerrainHeightForChunk(chunk, localX, localZ + sampleDistance, segments);
  return target.set(left - right, sampleDistance * 2, down - up).normalize();
}

export function getSurvivalRenderedTerrainNormalForChunk(
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  sampleDistance = 4,
  segments = getSurvivalTerrainRenderSegments(chunk),
) {
  return getSurvivalRenderedTerrainNormalForChunkInto(
    chunk,
    localX,
    localZ,
    new THREE.Vector3(),
    sampleDistance,
    segments,
  );
}

function getSurvivalTerrainSkirtEdgeCacheKey(edges: SurvivalTerrainSkirtEdges) {
  return [
    edges.north ? "n" : "",
    edges.east ? "e" : "",
    edges.south ? "s" : "",
    edges.west ? "w" : "",
  ].join("") || "none";
}

export function makeSurvivalEdgeSkirtGeometry(
  cacheKey: string,
  segments: number,
  sampleEdge: (localX: number, localZ: number) => SurvivalTerrainEdgeSample,
  edges: SurvivalTerrainSkirtEdges = SURVIVAL_ALL_TERRAIN_SKIRT_EDGES,
) {
  if (!edges.north && !edges.east && !edges.south && !edges.west) return null;

  const cached = survivalTerrainSkirtGeometryCache.get(cacheKey);
  if (cached) {
    survivalTerrainSkirtGeometryCache.delete(cacheKey);
    survivalTerrainSkirtGeometryCache.set(cacheKey, cached);
    return cached;
  }

  const halfSize = SURVIVAL_BLOCK_SIZE / 2;
  const step = SURVIVAL_BLOCK_SIZE / segments;
  const edgeCount = Number(edges.north) + Number(edges.east) + Number(edges.south) + Number(edges.west);
  const vertexCount = edgeCount * (segments + 1) * 2;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const indices = vertexCount > 65535
    ? new Uint32Array(edgeCount * segments * 6)
    : new Uint16Array(edgeCount * segments * 6);
  let vertexCursor = 0;
  let positionOffset = 0;
  let colorOffset = 0;
  let indexOffset = 0;

  const addPoint = (localX: number, localZ: number) => {
    const { height, color } = sampleEdge(localX, localZ);
    const top = height - SURVIVAL_TERRAIN_SKIRT_TOP_INSET;

    positions[positionOffset] = localX;
    positions[positionOffset + 1] = top;
    positions[positionOffset + 2] = localZ;
    positions[positionOffset + 3] = localX;
    positions[positionOffset + 4] = top - SURVIVAL_TERRAIN_SKIRT_DEPTH;
    positions[positionOffset + 5] = localZ;
    positionOffset += 6;

    colors[colorOffset] = color.r;
    colors[colorOffset + 1] = color.g;
    colors[colorOffset + 2] = color.b;
    colors[colorOffset + 3] = color.r * 0.98;
    colors[colorOffset + 4] = color.g * 0.98;
    colors[colorOffset + 5] = color.b * 0.98;
    colorOffset += 6;
    vertexCursor += 2;
  };

  const addEdge = (getPoint: (index: number) => [number, number]) => {
    const startVertex = vertexCursor;
    for (let index = 0; index <= segments; index += 1) {
      const [localX, localZ] = getPoint(index);
      addPoint(localX, localZ);
    }

    for (let index = 0; index < segments; index += 1) {
      const topA = startVertex + index * 2;
      const bottomA = topA + 1;
      const topB = topA + 2;
      const bottomB = topA + 3;
      indices[indexOffset] = topA;
      indices[indexOffset + 1] = topB;
      indices[indexOffset + 2] = bottomA;
      indices[indexOffset + 3] = topB;
      indices[indexOffset + 4] = bottomB;
      indices[indexOffset + 5] = bottomA;
      indexOffset += 6;
    }
  };

  if (edges.north) addEdge((index) => [-halfSize + index * step, -halfSize]);
  if (edges.east) addEdge((index) => [halfSize, -halfSize + index * step]);
  if (edges.south) addEdge((index) => [halfSize - index * step, halfSize]);
  if (edges.west) addEdge((index) => [-halfSize, halfSize - index * step]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  survivalTerrainSkirtGeometryCache.set(cacheKey, geo);
  trimSurvivalGeometryCache(survivalTerrainSkirtGeometryCache);

  return geo;
}

export function makeSurvivalTerrainGeometry(chunk: SurvivalChunkInfo) {
  const segments = getSurvivalTerrainRenderSegments(chunk);
  const cacheKey = `${chunk.key}:${chunk.lod}:${segments}:${SURVIVAL_TERRAIN_COLOR_CACHE_VERSION}`;
  const cached = survivalTerrainGeometryCache.get(cacheKey);
  if (cached) {
    survivalTerrainGeometryCache.delete(cacheKey);
    survivalTerrainGeometryCache.set(cacheKey, cached);
    return cached;
  }

  const geo = new THREE.PlaneGeometry(SURVIVAL_BLOCK_SIZE, SURVIVAL_BLOCK_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const colors = new Float32Array(pos.count * 3);
  const halfBlock = SURVIVAL_BLOCK_SIZE / 2;
  const edgeOverlap = 0.08;
  const heightGrid = getSurvivalTerrainHeightGrid(chunk, segments);
  const vertexColor = new THREE.Color();

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const worldX = chunk.x + x;
    const worldZ = chunk.z + z;
    const y = heightGrid.heights[i] ?? getSurvivalTerrainHeightForChunk(chunk, x, z);
    const color = getSurvivalRenderedTerrainColorInto
      ? getSurvivalRenderedTerrainColorInto(worldX, worldZ, y, vertexColor)
      : vertexColor.copy(getSurvivalRenderedTerrainColor(worldX, worldZ, y));
    const renderX = x <= -halfBlock ? x - edgeOverlap : x >= halfBlock ? x + edgeOverlap : x;
    const renderZ = z <= -halfBlock ? z - edgeOverlap : z >= halfBlock ? z + edgeOverlap : z;
    pos.setX(i, renderX);
    pos.setY(i, y);
    pos.setZ(i, renderZ);
    uv.setXY(i, worldX / SURVIVAL_TERRAIN_DETAIL_UV_WORLD_SIZE, worldZ / SURVIVAL_TERRAIN_DETAIL_UV_WORLD_SIZE);
    const colorOffset = i * 3;
    colors[colorOffset] = color.r;
    colors[colorOffset + 1] = color.g;
    colors[colorOffset + 2] = color.b;
  }

  uv.needsUpdate = true;
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  survivalTerrainGeometryCache.set(cacheKey, geo);
  trimSurvivalGeometryCache(survivalTerrainGeometryCache);

  return geo;
}

export function getSurvivalVisibleTerrainSkirtEdges(
  chunk: SurvivalChunkInfo,
  visibleChunkKeys?: ReadonlySet<string>,
): SurvivalTerrainSkirtEdges {
  if (!visibleChunkKeys) return SURVIVAL_ALL_TERRAIN_SKIRT_EDGES;

  return {
    north: !visibleChunkKeys.has(`${chunk.cx}:${chunk.cz - 1}`),
    east: !visibleChunkKeys.has(`${chunk.cx + 1}:${chunk.cz}`),
    south: !visibleChunkKeys.has(`${chunk.cx}:${chunk.cz + 1}`),
    west: !visibleChunkKeys.has(`${chunk.cx - 1}:${chunk.cz}`),
  };
}

export function hasAnySurvivalTerrainSkirtEdge(edges: SurvivalTerrainSkirtEdges) {
  return edges.north || edges.east || edges.south || edges.west;
}

export function makeSurvivalTerrainSkirtGeometry(chunk: SurvivalChunkInfo, edges: SurvivalTerrainSkirtEdges) {
  const segments = getSurvivalTerrainRenderSegments(chunk);
  const edgeKey = getSurvivalTerrainSkirtEdgeCacheKey(edges);
  const skirtColor = new THREE.Color();
  return makeSurvivalEdgeSkirtGeometry(
    `${chunk.key}:${chunk.lod}:terrain-skirt:${segments}:${edgeKey}:${SURVIVAL_TERRAIN_COLOR_CACHE_VERSION}`,
    segments,
    (localX, localZ) => {
      const worldX = chunk.x + localX;
      const worldZ = chunk.z + localZ;
      const height = getSurvivalTerrainHeightForChunk(chunk, localX, localZ);
      const color = getSurvivalRenderedTerrainColorInto
        ? getSurvivalRenderedTerrainColorInto(worldX, worldZ, height, skirtColor)
        : skirtColor.copy(getSurvivalRenderedTerrainColor(worldX, worldZ, height));
      return { height, color };
    },
    edges,
  );
}

export function makeSurvivalTerrainCollisionGeometry(chunk: SurvivalChunkInfo) {
  const segments = getSurvivalTerrainCollisionSegments(chunk);
  const cacheKey = `${chunk.key}:${chunk.lod}:collision:${segments}`;
  const cached = survivalTerrainCollisionGeometryCache.get(cacheKey);
  if (cached) {
    survivalTerrainCollisionGeometryCache.delete(cacheKey);
    survivalTerrainCollisionGeometryCache.set(cacheKey, cached);
    return cached;
  }

  const geo = new THREE.PlaneGeometry(
    SURVIVAL_BLOCK_SIZE,
    SURVIVAL_BLOCK_SIZE,
    segments,
    segments,
  );
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const heightGrid = getSurvivalTerrainHeightGrid(chunk, segments);

  for (let i = 0; i < pos.count; i += 1) {
    pos.setY(i, heightGrid.heights[i] ?? getSurvivalTerrainHeightForChunk(chunk, pos.getX(i), pos.getZ(i)));
  }

  survivalTerrainCollisionGeometryCache.set(cacheKey, geo);
  trimSurvivalGeometryCache(survivalTerrainCollisionGeometryCache);

  return geo;
}
