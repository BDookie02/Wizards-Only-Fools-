import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import { clamp01, smoothstepRange } from "../survival/survivalMath";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import {
  MOUNTAIN_VILLAGE_EDGE_BLEND_START,
  MOUNTAIN_VILLAGE_HEIGHT,
  MOUNTAIN_VILLAGE_MINESHAFT_TERRAIN_CUT_RADIUS,
  MOUNTAIN_VILLAGE_PLATEAU_RADIUS,
  MOUNTAIN_VILLAGE_RADIUS,
  cutCircularHoleFromPlaneGeometry,
  getMountainVillageHeight,
  getMountainVillageLocalRadius,
  getMountainVillageTerrainSegments,
  getMountainVillageTrailSurfaceMask,
} from "./mountainVillageTerrain";

type MountainVillageTerrainHeightForChunk = (chunk: SurvivalChunkInfo, localX: number, localZ: number) => number;
type MountainVillageTerrainColorAtWorld = (worldX: number, worldZ: number, height: number) => THREE.Color;
type MountainVillageBaseHeightForChunk = (chunk: SurvivalChunkInfo) => number;

const MOUNTAIN_COLOR_STONE = new THREE.Color("#5f6668");
const MOUNTAIN_COLOR_DARK_STONE = new THREE.Color("#34393b");
const MOUNTAIN_COLOR_PALE_STONE = new THREE.Color("#7c878a");
const MOUNTAIN_COLOR_SUMMIT_STONE = new THREE.Color("#8d9aa0");
const MOUNTAIN_COLOR_ALPINE_BASE = new THREE.Color("#536a3f");
const MOUNTAIN_COLOR_ALPINE_BRIGHT = new THREE.Color("#6e7d48");
const MOUNTAIN_COLOR_SNOW = new THREE.Color("#eef8ff");
const MOUNTAIN_COLOR_HARD_SNOW = new THREE.Color("#f9fdff");
const MOUNTAIN_COLOR_ICE = new THREE.Color("#a7d8ef");
const MOUNTAIN_COLOR_MOSS = new THREE.Color("#405a3d");
const MOUNTAIN_COLOR_SLOPE_GRASS = new THREE.Color("#48673a");
const MOUNTAIN_COLOR_SUNLIT_GRASS = new THREE.Color("#6f8f48");
const MOUNTAIN_COLOR_DEEP_GRASS = new THREE.Color("#354d32");
const MOUNTAIN_COLOR_DRY_GRASS = new THREE.Color("#8b8f59");
const MOUNTAIN_COLOR_LICHEN = new THREE.Color("#9ca36f");
const MOUNTAIN_COLOR_SLOPE_SOIL = new THREE.Color("#5f5137");
const MOUNTAIN_COLOR_ROOT_DIRT = new THREE.Color("#3f3426");
const MOUNTAIN_COLOR_TRAIL_DIRT = new THREE.Color("#5f4e35");
const MOUNTAIN_COLOR_TRAIL_STONE = new THREE.Color("#3e342b");
const mountainTerrainTrailColorScratch = new THREE.Color();

export function getMountainVillageTerrainColorInto(
  target: THREE.Color,
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  height: number,
  baseHeight: number,
  showTrailSurface: boolean,
  terrainHeightForChunk: MountainVillageTerrainHeightForChunk,
  terrainColorAtWorld: MountainVillageTerrainColorAtWorld,
) {
  const worldX = chunk.x + localX;
  const worldZ = chunk.z + localZ;
  const radius = getMountainVillageLocalRadius(localX, localZ);
  const lift = height - baseHeight;
  const naturalHeight = terrainHeightForChunk(chunk, localX, localZ);
  const naturalColor = terrainColorAtWorld(worldX, worldZ, naturalHeight);
  const snowMix = smoothstepRange(MOUNTAIN_VILLAGE_HEIGHT * 0.82, MOUNTAIN_VILLAGE_HEIGHT * 1.02, lift);
  const cliffMix = smoothstepRange(20, 130, lift);
  const plateauMix = 1 - smoothstepRange(MOUNTAIN_VILLAGE_PLATEAU_RADIUS - 8, MOUNTAIN_VILLAGE_PLATEAU_RADIUS + 18, radius);
  const edgeBlend = smoothstepRange(MOUNTAIN_VILLAGE_EDGE_BLEND_START, SURVIVAL_BLOCK_SIZE / 2, radius);
  const trailMask = showTrailSurface ? getMountainVillageTrailSurfaceMask(chunk, localX, localZ) : 0;
  const vein = Math.max(0, Math.sin(radius * 0.21 + localX * 0.018 - localZ * 0.024));
  const strata = Math.max(0, Math.sin(radius * 0.33 + Math.atan2(localX, localZ) * 7.2));
  const grain = clamp01((
    Math.sin(worldX * 0.19 + worldZ * 0.31) +
    Math.cos(worldX * 0.43 - worldZ * 0.17) +
    Math.sin(radius * 0.56 + localX * 0.09)
  ) / 3 * 0.5 + 0.5);
  const broadGrassPatch = clamp01((
    Math.sin(localX * 0.046 + localZ * 0.021 + radius * 0.052) +
    Math.cos(localZ * 0.057 - localX * 0.034) +
    Math.sin(Math.atan2(localX, localZ) * 5.6 + radius * 0.033)
  ) / 3 * 0.5 + 0.5);
  const hillsideScratch = clamp01((
    Math.sin(localX * 0.18 - localZ * 0.07 + lift * 0.05) +
    Math.cos(localZ * 0.14 + radius * 0.12)
  ) * 0.5 + 0.5);
  const contourBand = Math.pow(Math.max(0, Math.sin(lift * 0.24 + radius * 0.16 + Math.atan2(localX, localZ) * 2.4)), 2.4);
  const snowScour = Math.max(0, Math.sin(localX * 0.42 - localZ * 0.29 + radius * 0.12));
  const exposedCliff = smoothstepRange(MOUNTAIN_VILLAGE_PLATEAU_RADIUS + 10, MOUNTAIN_VILLAGE_PLATEAU_RADIUS + 78, radius) * snowMix;
  const snowCoverage = clamp01(snowMix * (0.2 + plateauMix * 0.58 - exposedCliff * 0.24));
  const lowerSlopeGrass = smoothstepRange(MOUNTAIN_VILLAGE_PLATEAU_RADIUS + 28, MOUNTAIN_VILLAGE_RADIUS - 26, radius) *
    (1 - smoothstepRange(MOUNTAIN_VILLAGE_RADIUS - 10, MOUNTAIN_VILLAGE_RADIUS + 34, radius)) *
    (1 - snowCoverage) *
    (1 - trailMask);
  const grassMottle = clamp01(0.16 + grain * 0.42 + broadGrassPatch * 0.36 - vein * 0.22 + strata * 0.1);
  const grassPatch = lowerSlopeGrass * smoothstepRange(0.28, 0.88, broadGrassPatch + grassMottle * 0.34);
  const dryPatch = lowerSlopeGrass * smoothstepRange(0.6, 0.94, hillsideScratch + contourBand * 0.18) * (1 - plateauMix * 0.6);
  const shadowRavine = lowerSlopeGrass * smoothstepRange(0.58, 0.96, vein) * smoothstepRange(18, 104, lift);
  const shelfBand = lowerSlopeGrass * contourBand * smoothstepRange(0.24, 0.8, grassMottle);
  const sunFleck = lowerSlopeGrass * Math.max(0, grain - 0.62);
  target.copy(naturalColor)
    .lerp(MOUNTAIN_COLOR_ALPINE_BASE, (1 - edgeBlend) * 0.72)
    .lerp(MOUNTAIN_COLOR_ALPINE_BRIGHT, (1 - edgeBlend) * (grain * 0.12 + broadGrassPatch * 0.08));

  if (!showTrailSurface) {
    return target
      .lerp(MOUNTAIN_COLOR_MOSS, 0.1 * (1 - cliffMix))
      .lerp(MOUNTAIN_COLOR_STONE, cliffMix * 0.36 + lowerSlopeGrass * 0.04)
      .lerp(MOUNTAIN_COLOR_ROOT_DIRT, shadowRavine * 0.12)
      .lerp(MOUNTAIN_COLOR_SLOPE_SOIL, lowerSlopeGrass * (1 - grassMottle) * 0.14 + shelfBand * 0.08)
      .lerp(MOUNTAIN_COLOR_DEEP_GRASS, grassPatch * 0.22 + shadowRavine * 0.08)
      .lerp(MOUNTAIN_COLOR_SLOPE_GRASS, lowerSlopeGrass * (0.16 + grassMottle * 0.18))
      .lerp(MOUNTAIN_COLOR_DRY_GRASS, dryPatch * 0.18)
      .lerp(MOUNTAIN_COLOR_LICHEN, shelfBand * 0.12)
      .lerp(MOUNTAIN_COLOR_SUNLIT_GRASS, sunFleck * 0.18)
      .lerp(MOUNTAIN_COLOR_PALE_STONE, grain * cliffMix * 0.05)
      .lerp(MOUNTAIN_COLOR_DARK_STONE, vein * cliffMix * 0.06)
      .lerp(MOUNTAIN_COLOR_SUMMIT_STONE, plateauMix * 0.22)
      .lerp(MOUNTAIN_COLOR_SNOW, snowCoverage * 0.38)
      .lerp(MOUNTAIN_COLOR_STONE, exposedCliff * snowScour * 0.12)
      .lerp(naturalColor, edgeBlend * 0.8);
  }

  const trailColor = mountainTerrainTrailColorScratch
    .copy(MOUNTAIN_COLOR_TRAIL_DIRT)
    .lerp(MOUNTAIN_COLOR_TRAIL_STONE, cliffMix * 0.42)
    .lerp(MOUNTAIN_COLOR_SNOW, snowCoverage * 0.08);

  return target
    .lerp(MOUNTAIN_COLOR_MOSS, 0.12 * (1 - cliffMix))
    .lerp(MOUNTAIN_COLOR_STONE, cliffMix * 0.4 + lowerSlopeGrass * 0.04)
    .lerp(MOUNTAIN_COLOR_ROOT_DIRT, shadowRavine * 0.16)
    .lerp(MOUNTAIN_COLOR_SLOPE_SOIL, lowerSlopeGrass * (1 - grassMottle) * 0.16 + shelfBand * 0.1)
    .lerp(MOUNTAIN_COLOR_DEEP_GRASS, grassPatch * 0.26 + shadowRavine * 0.1)
    .lerp(MOUNTAIN_COLOR_SLOPE_GRASS, lowerSlopeGrass * (0.18 + grassMottle * 0.22))
    .lerp(MOUNTAIN_COLOR_DRY_GRASS, dryPatch * 0.22)
    .lerp(MOUNTAIN_COLOR_LICHEN, shelfBand * 0.16)
    .lerp(MOUNTAIN_COLOR_SUNLIT_GRASS, sunFleck * 0.22)
    .lerp(MOUNTAIN_COLOR_PALE_STONE, grain * cliffMix * 0.1)
    .lerp(MOUNTAIN_COLOR_DARK_STONE, vein * cliffMix * 0.12)
    .lerp(MOUNTAIN_COLOR_DARK_STONE, strata * exposedCliff * 0.18)
    .lerp(MOUNTAIN_COLOR_SUMMIT_STONE, plateauMix * 0.42)
    .lerp(MOUNTAIN_COLOR_SNOW, snowCoverage * 0.82)
    .lerp(MOUNTAIN_COLOR_STONE, exposedCliff * snowScour * 0.28)
    .lerp(MOUNTAIN_COLOR_HARD_SNOW, snowCoverage * grain * 0.1)
    .lerp(MOUNTAIN_COLOR_ICE, snowCoverage * vein * 0.18)
    .lerp(trailColor, trailMask * 0.52)
    .lerp(naturalColor, edgeBlend * (1 - trailMask * 0.7));
}

export function makeMountainVillageTerrainGeometry(
  chunk: SurvivalChunkInfo,
  cutMineshaftOpening: boolean,
  showTrailSurface: boolean,
  terrainHeightForChunk: MountainVillageTerrainHeightForChunk,
  terrainColorAtWorld: MountainVillageTerrainColorAtWorld,
  villageBaseHeightForChunk: MountainVillageBaseHeightForChunk,
) {
  const segments = getMountainVillageTerrainSegments(chunk);
  const baseHeight = villageBaseHeightForChunk(chunk);
  const geo = new THREE.PlaneGeometry(SURVIVAL_BLOCK_SIZE, SURVIVAL_BLOCK_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const colorScratch = new THREE.Color();

  for (let i = 0; i < pos.count; i += 1) {
    const localX = pos.getX(i);
    const localZ = pos.getZ(i);
    const height = getMountainVillageHeight(chunk, localX, localZ, terrainHeightForChunk, baseHeight);
    const color = getMountainVillageTerrainColorInto(colorScratch, chunk, localX, localZ, height, baseHeight, showTrailSurface, terrainHeightForChunk, terrainColorAtWorld);
    const colorOffset = i * 3;
    pos.setY(i, height);
    colors[colorOffset] = color.r;
    colors[colorOffset + 1] = color.g;
    colors[colorOffset + 2] = color.b;
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  if (cutMineshaftOpening) {
    cutCircularHoleFromPlaneGeometry(geo, MOUNTAIN_VILLAGE_MINESHAFT_TERRAIN_CUT_RADIUS);
  }
  geo.computeVertexNormals();
  return geo;
}
