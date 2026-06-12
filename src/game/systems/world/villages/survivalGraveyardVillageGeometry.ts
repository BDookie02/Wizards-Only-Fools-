import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import { makeSurvivalEdgeSkirtGeometry } from "../terrain/survivalTerrainGeometry";
import { clamp01, lerpNumber, smoothstepRange, survivalHash01 } from "../survival/survivalMath";
import { SURVIVAL_NEAR_RADIUS, type SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import {
  GRAVEYARD_FENCE_RADIUS,
  getGraveyardChapelFoundationMask,
  getGraveyardEffectivePathMask,
  getGraveyardGateClearingMask,
  getGraveyardLocalRadius,
  getGraveyardLocalSurfaceHeight,
} from "./survivalGraveyardVillageTerrain";

export type SurvivalTerrainHeightForChunk = (chunk: SurvivalChunkInfo, localX: number, localZ: number) => number;
export type SurvivalTerrainColorAtWorld = (worldX: number, worldZ: number, height: number) => THREE.Color;
export type SurvivalVillageBaseHeightForChunk = (chunk: SurvivalChunkInfo) => number;

const GRAVEYARD_COLOR_GRASS_A = new THREE.Color("#26301f");
const GRAVEYARD_COLOR_GRASS_B = new THREE.Color("#38422b");
const GRAVEYARD_COLOR_GRASS_C = new THREE.Color("#1b2118");
const GRAVEYARD_COLOR_GRASS_SHADOW = new THREE.Color("#111511");
const GRAVEYARD_COLOR_GRAVEL_A = new THREE.Color("#b7b8b0");
const GRAVEYARD_COLOR_GRAVEL_B = new THREE.Color("#d9d9cf");
const GRAVEYARD_COLOR_GRAVEL_C = new THREE.Color("#8e928d");
const GRAVEYARD_COLOR_GRAVEL_EDGE = new THREE.Color("#5f625d");
const GRAVEYARD_COLOR_CHAPEL_STONE_LIGHT = new THREE.Color("#72746d");
const GRAVEYARD_COLOR_CHAPEL_STONE_DARK = new THREE.Color("#595b55");
const GRAVEYARD_COLOR_CHAPEL_CRACK = new THREE.Color("#2d302b");
const graveyardGroundGravelScratch = new THREE.Color();
const graveyardGroundChapelScratch = new THREE.Color();

export function getGraveyardVillageHeight(
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  terrainHeightForChunk: SurvivalTerrainHeightForChunk,
  baseHeight: number,
) {
  const naturalHeight = terrainHeightForChunk(chunk, localX, localZ);
  const gateClearingMask = getGraveyardGateClearingMask(localX, localZ);
  const radius = getGraveyardLocalRadius(localX, localZ);
  const edgeBlend = smoothstepRange(GRAVEYARD_FENCE_RADIUS - 42, SURVIVAL_BLOCK_SIZE / 2, radius) * (1 - gateClearingMask * 0.95);
  const graveyardHeight = getGraveyardLocalSurfaceHeight(localX, localZ, chunk.cx, chunk.cz, baseHeight);
  return lerpNumber(graveyardHeight, naturalHeight, edgeBlend);
}

function getGraveyardGroundColorInto(
  target: THREE.Color,
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  height: number,
  baseHeight: number,
  terrainColorAtWorld: SurvivalTerrainColorAtWorld,
) {
  const pathMask = getGraveyardEffectivePathMask(localX, localZ);
  const chapelFoundationMask = getGraveyardChapelFoundationMask(localX, localZ);
  const noise = survivalHash01(Math.floor(localX * 0.21), Math.floor(localZ * 0.21), 12050);
  const gravelNoise = survivalHash01(Math.floor(localX * 0.52), Math.floor(localZ * 0.52), 12062);
  const gravelSpeckle = survivalHash01(Math.floor(localX * 1.25), Math.floor(localZ * 1.25), 12073);
  const chapelStoneNoise = survivalHash01(Math.floor(localX * 0.88), Math.floor(localZ * 0.88), 12084);
  const chapelCrackNoise = survivalHash01(Math.floor(localX * 1.72), Math.floor(localZ * 1.72), 12091);
  const pathEdgeMask = smoothstepRange(0.18, 0.48, pathMask) * (1 - smoothstepRange(0.66, 0.9, pathMask));
  const slopeTint = clamp01((height - baseHeight + 3) / 12);
  target
    .copy(GRAVEYARD_COLOR_GRASS_A)
    .lerp(noise > 0.62 ? GRAVEYARD_COLOR_GRASS_B : GRAVEYARD_COLOR_GRASS_C, noise > 0.62 ? 0.5 : 0.34)
    .lerp(GRAVEYARD_COLOR_GRASS_SHADOW, slopeTint * 0.22);
  const gravel = graveyardGroundGravelScratch
    .copy(GRAVEYARD_COLOR_GRAVEL_A)
    .lerp(GRAVEYARD_COLOR_GRAVEL_B, gravelNoise * 0.62)
    .lerp(GRAVEYARD_COLOR_GRAVEL_C, gravelSpeckle > 0.72 ? 0.34 : 0.08)
    .lerp(GRAVEYARD_COLOR_GRAVEL_EDGE, pathEdgeMask * 0.42);
  const chapelGravel = graveyardGroundChapelScratch
    .copy(gravel)
    .lerp(chapelStoneNoise > 0.58 ? GRAVEYARD_COLOR_CHAPEL_STONE_LIGHT : GRAVEYARD_COLOR_CHAPEL_STONE_DARK, 0.42)
    .lerp(GRAVEYARD_COLOR_CHAPEL_CRACK, chapelCrackNoise > 0.76 ? 0.32 : 0.06);
  target.lerp(gravel, clamp01(pathMask * 0.92)).lerp(chapelGravel, chapelFoundationMask * 0.48);
  const worldX = chunk.x + localX;
  const worldZ = chunk.z + localZ;
  const naturalColor = terrainColorAtWorld(worldX, worldZ, height);
  const radius = getGraveyardLocalRadius(localX, localZ);
  const edgeBreakup = (
    Math.sin(localX * 0.034 + chunk.cx * 1.9) * 4.5 +
    Math.cos(localZ * 0.041 - chunk.cz * 1.4) * 3.5 +
    Math.sin((localX + localZ) * 0.019) * 3
  );
  const outerBlend = smoothstepRange(GRAVEYARD_FENCE_RADIUS - 92, SURVIVAL_BLOCK_SIZE / 2 - 2, radius + edgeBreakup);
  return target.lerp(naturalColor, clamp01(outerBlend));
}

function getGraveyardTerrainSegments(chunk: SurvivalChunkInfo) {
  if (chunk.distance === 0) return 52;
  if (chunk.distance <= SURVIVAL_NEAR_RADIUS) return 34;
  return 22;
}

export function makeGraveyardVillageTerrainGeometry(
  chunk: SurvivalChunkInfo,
  terrainHeightForChunk: SurvivalTerrainHeightForChunk,
  terrainColorAtWorld: SurvivalTerrainColorAtWorld,
  villageBaseHeightForChunk: SurvivalVillageBaseHeightForChunk,
) {
  const segments = getGraveyardTerrainSegments(chunk);
  const baseHeight = villageBaseHeightForChunk(chunk);
  const geo = new THREE.PlaneGeometry(SURVIVAL_BLOCK_SIZE, SURVIVAL_BLOCK_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const colorScratch = new THREE.Color();

  for (let i = 0; i < pos.count; i += 1) {
    const localX = pos.getX(i);
    const localZ = pos.getZ(i);
    const height = getGraveyardVillageHeight(chunk, localX, localZ, terrainHeightForChunk, baseHeight);
    const color = getGraveyardGroundColorInto(colorScratch, chunk, localX, localZ, height, baseHeight, terrainColorAtWorld);
    const colorOffset = i * 3;
    pos.setY(i, height);
    colors[colorOffset] = color.r;
    colors[colorOffset + 1] = color.g;
    colors[colorOffset + 2] = color.b;
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

export function makeGraveyardVillageTerrainSkirtGeometry(
  chunk: SurvivalChunkInfo,
  terrainHeightForChunk: SurvivalTerrainHeightForChunk,
  terrainColorAtWorld: SurvivalTerrainColorAtWorld,
  villageBaseHeightForChunk: SurvivalVillageBaseHeightForChunk,
) {
  const segments = getGraveyardTerrainSegments(chunk);
  const baseHeight = villageBaseHeightForChunk(chunk);
  const colorScratch = new THREE.Color();
  return makeSurvivalEdgeSkirtGeometry(
    `${chunk.key}:graveyard-skirt:${segments}`,
    segments,
    (localX, localZ) => {
      const height = getGraveyardVillageHeight(chunk, localX, localZ, terrainHeightForChunk, baseHeight);
      const color = getGraveyardGroundColorInto(colorScratch, chunk, localX, localZ, height, baseHeight, terrainColorAtWorld);
      return { height, color };
    },
  );
}
