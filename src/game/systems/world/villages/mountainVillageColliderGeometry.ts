import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import { lerpNumber, smoothstep01, smoothstepRange } from "../survival/survivalMath";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import {
  MOUNTAIN_VILLAGE_EDGE_BLEND_START,
  MOUNTAIN_VILLAGE_HEIGHT,
  MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_TERRAIN_CUT_RADIUS,
  MOUNTAIN_VILLAGE_PLATEAU_RADIUS,
  MOUNTAIN_VILLAGE_RADIUS,
  MOUNTAIN_VILLAGE_SUMMIT_COLLIDER_RADIUS,
  cutCircularHoleFromPlaneGeometry,
  getMountainVillageHeight,
  getMountainVillageLocalRadius,
  getMountainVillageSummitFloorHeight,
  getMountainVillageTerrainSegments,
} from "./mountainVillageTerrain";

type MountainVillageTerrainHeightForChunk = (chunk: SurvivalChunkInfo, localX: number, localZ: number) => number;
type MountainVillageBaseHeightForChunk = (chunk: SurvivalChunkInfo) => number;

function getMountainVillageColliderHeight(
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  terrainHeightForChunk: MountainVillageTerrainHeightForChunk,
  baseHeight: number,
) {
  const naturalHeight = terrainHeightForChunk(chunk, localX, localZ);
  const radius = getMountainVillageLocalRadius(localX, localZ);
  const angle = Math.atan2(localX, localZ);
  const raw = 1 - (radius - MOUNTAIN_VILLAGE_PLATEAU_RADIUS) / (MOUNTAIN_VILLAGE_RADIUS - MOUNTAIN_VILLAGE_PLATEAU_RADIUS);
  const shoulder = Math.pow(smoothstep01(raw), 1.08);
  const ridgeNoise = (
    Math.sin(angle * 9 + radius * 0.053 + chunk.cx * 1.7) +
    Math.cos(angle * 5 - radius * 0.037 + chunk.cz * 1.3)
  ) * 0.7;
  const roughness = (1 - smoothstepRange(82, MOUNTAIN_VILLAGE_RADIUS, radius)) * ridgeNoise;
  const mountainHeight = baseHeight + shoulder * MOUNTAIN_VILLAGE_HEIGHT + roughness;
  const edgeBlend = smoothstepRange(MOUNTAIN_VILLAGE_EDGE_BLEND_START, SURVIVAL_BLOCK_SIZE / 2, radius);
  const plateauCutout = 1 - smoothstepRange(MOUNTAIN_VILLAGE_PLATEAU_RADIUS - 7, MOUNTAIN_VILLAGE_PLATEAU_RADIUS + 7, radius);
  const hiddenUnderSummit = getMountainVillageSummitFloorHeight(baseHeight) - 0.08;

  return lerpNumber(lerpNumber(mountainHeight, naturalHeight, edgeBlend), hiddenUnderSummit, plateauCutout);
}

export function makeMountainVillageTerrainColliderGeometry(
  chunk: SurvivalChunkInfo,
  cutMineshaftOpening: boolean,
  terrainHeightForChunk: MountainVillageTerrainHeightForChunk,
  villageBaseHeightForChunk: MountainVillageBaseHeightForChunk,
) {
  const segments = getMountainVillageTerrainSegments(chunk);
  const baseHeight = villageBaseHeightForChunk(chunk);
  const geo = new THREE.PlaneGeometry(SURVIVAL_BLOCK_SIZE, SURVIVAL_BLOCK_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i += 1) {
    pos.setY(i, getMountainVillageColliderHeight(chunk, pos.getX(i), pos.getZ(i), terrainHeightForChunk, baseHeight));
  }

  if (cutMineshaftOpening) {
    cutCircularHoleFromPlaneGeometry(geo, MOUNTAIN_VILLAGE_MINESHAFT_TERRAIN_CUT_RADIUS);
  }
  geo.computeVertexNormals();
  return geo;
}

export function makeMountainVillageSummitColliderGeometry(summitY: number) {
  const segments = 32;
  const y = summitY + 0.32;
  const vertices = new Float32Array(segments * 2 * 3);
  const indices = new Uint16Array(segments * 6);
  let vertexOffset = 0;
  let indexOffset = 0;

  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    vertices[vertexOffset] = Math.sin(angle) * MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS;
    vertices[vertexOffset + 1] = y;
    vertices[vertexOffset + 2] = Math.cos(angle) * MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS;
    vertices[vertexOffset + 3] = Math.sin(angle) * MOUNTAIN_VILLAGE_SUMMIT_COLLIDER_RADIUS;
    vertices[vertexOffset + 4] = y;
    vertices[vertexOffset + 5] = Math.cos(angle) * MOUNTAIN_VILLAGE_SUMMIT_COLLIDER_RADIUS;
    vertexOffset += 6;
  }

  for (let index = 0; index < segments; index += 1) {
    const inner = index * 2;
    const outer = inner + 1;
    const nextInner = ((index + 1) % segments) * 2;
    const nextOuter = nextInner + 1;
    indices[indexOffset] = inner;
    indices[indexOffset + 1] = outer;
    indices[indexOffset + 2] = nextInner;
    indices[indexOffset + 3] = outer;
    indices[indexOffset + 4] = nextOuter;
    indices[indexOffset + 5] = nextInner;
    indexOffset += 6;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}
