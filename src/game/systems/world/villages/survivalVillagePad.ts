import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import { makeSurvivalEdgeSkirtGeometry } from "../terrain/survivalTerrainGeometry";
import { lerpNumber, smoothstepRange } from "../survival/survivalMath";
import { SURVIVAL_VILLAGE_PAD_SEGMENTS, type SurvivalChunkInfo } from "../survival/survivalWorldConfig";

export type SurvivalVillagePadTerrainHeightResolver = (
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
) => number;

export type SurvivalVillagePadTerrainColorResolver = (
  worldX: number,
  worldZ: number,
  height: number,
) => THREE.Color;

export type SurvivalVillagePadResolvers = {
  flatRadius: number;
  terrainHeightForChunk: SurvivalVillagePadTerrainHeightResolver;
  terrainColorAtWorld: SurvivalVillagePadTerrainColorResolver;
};

export function getSurvivalVillageBaseHeight(
  chunk: SurvivalChunkInfo,
  terrainHeightForChunk: SurvivalVillagePadTerrainHeightResolver,
) {
  return terrainHeightForChunk(chunk, 0, 0);
}

export function getSurvivalVillagePadHeight(
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  resolvers: Pick<SurvivalVillagePadResolvers, "flatRadius" | "terrainHeightForChunk">,
  baseHeight = getSurvivalVillageBaseHeight(chunk, resolvers.terrainHeightForChunk),
) {
  const naturalHeight = resolvers.terrainHeightForChunk(chunk, localX, localZ);
  const maxAbs = Math.max(Math.abs(localX), Math.abs(localZ));
  const edgeBlend = smoothstepRange(resolvers.flatRadius, SURVIVAL_BLOCK_SIZE / 2, maxAbs);
  return lerpNumber(baseHeight, naturalHeight, edgeBlend);
}

export function makeSurvivalVillagePadGeometry(
  chunk: SurvivalChunkInfo,
  resolvers: SurvivalVillagePadResolvers,
) {
  const baseHeight = getSurvivalVillageBaseHeight(chunk, resolvers.terrainHeightForChunk);
  const geo = new THREE.PlaneGeometry(
    SURVIVAL_BLOCK_SIZE,
    SURVIVAL_BLOCK_SIZE,
    SURVIVAL_VILLAGE_PAD_SEGMENTS,
    SURVIVAL_VILLAGE_PAD_SEGMENTS,
  );
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i += 1) {
    const localX = pos.getX(i);
    const localZ = pos.getZ(i);
    const height = getSurvivalVillagePadHeight(chunk, localX, localZ, resolvers, baseHeight);
    const color = resolvers.terrainColorAtWorld(chunk.x + localX, chunk.z + localZ, height);
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

export function makeSurvivalVillagePadSkirtGeometry(
  chunk: SurvivalChunkInfo,
  resolvers: SurvivalVillagePadResolvers,
) {
  const baseHeight = getSurvivalVillageBaseHeight(chunk, resolvers.terrainHeightForChunk);
  return makeSurvivalEdgeSkirtGeometry(
    `${chunk.key}:village-pad-skirt:${SURVIVAL_VILLAGE_PAD_SEGMENTS}`,
    SURVIVAL_VILLAGE_PAD_SEGMENTS,
    (localX, localZ) => {
      const worldX = chunk.x + localX;
      const worldZ = chunk.z + localZ;
      const height = getSurvivalVillagePadHeight(chunk, localX, localZ, resolvers, baseHeight);
      const color = resolvers.terrainColorAtWorld(worldX, worldZ, height);
      return { height, color };
    },
  );
}
