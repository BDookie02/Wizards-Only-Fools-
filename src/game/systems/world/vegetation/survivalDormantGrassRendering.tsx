import { useFrame } from "@react-three/fiber";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE, useGameStore, type SurvivalBiome } from "../../../../store/gameStore";
import { isSurvivalGrassInspectionView } from "../../../tools/qa/survivalGrassDebug";
import { isMobilePerformanceMode } from "../../input/performanceMode";
import {
  getEffectiveSurvivalCycleElapsedSeconds,
  getSurvivalDayNightCycle,
} from "../../rendering/sky/survivalSkyCycleMath";
import {
  getSurvivalGrassStreamScale,
  scheduleSurvivalBackgroundTask,
  type SurvivalScheduledBackgroundTask,
} from "../survival/survivalLoadStage";
import {
  getBrowserSurvivalPlayerPosition as getBrowserLocalPlayerPosition,
  getInitialSurvivalLocalGrassCenter,
  getQaSurvivalUrlPlayerWorldPosition,
} from "../survival/survivalPosition";
import { getSurvivalRestoredMeadowMask } from "../survival/survivalBiome";
import { clamp01, lerpNumber, smoothstepRange, survivalHash01 } from "../survival/survivalMath";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import {
  SURVIVAL_LOCAL_GRASS_AIR_RADIUS,
  SURVIVAL_LOCAL_GRASS_CARPET_OPACITY,
  SURVIVAL_LOCAL_GRASS_CARPET_SEGMENTS,
  SURVIVAL_LOCAL_GRASS_CELL_AREA_SCALE,
  SURVIVAL_LOCAL_GRASS_CELL_MOUNT_INTERVAL_MS,
  SURVIVAL_LOCAL_GRASS_CELL_SIZE,
  SURVIVAL_LOCAL_GRASS_DEFAULT_LIFT_COLOR,
  SURVIVAL_LOCAL_GRASS_DESERT_LIFT_COLOR,
  SURVIVAL_LOCAL_GRASS_DETAIL_RADIUS,
  SURVIVAL_LOCAL_GRASS_EDGE_FADE,
  SURVIVAL_LOCAL_GRASS_FLOWERS_PER_CELL,
  SURVIVAL_LOCAL_GRASS_GROUND_PATCHES_PER_CELL,
  SURVIVAL_LOCAL_GRASS_GROUND_PATCH_OPACITY,
  SURVIVAL_LOCAL_GRASS_GROUND_RADIUS,
  SURVIVAL_LOCAL_GRASS_HIGH_ALTITUDE_FADE_END,
  SURVIVAL_LOCAL_GRASS_HIGH_ALTITUDE_FADE_START,
  SURVIVAL_LOCAL_GRASS_INITIAL_CELL_MOUNT_COUNT,
  SURVIVAL_LOCAL_GRASS_MEADOW_LIFT_COLOR,
  SURVIVAL_LOCAL_GRASS_MEADOW_SHADOW_COLOR,
  SURVIVAL_LOCAL_GRASS_MOBILE_CELL_MOUNT_INTERVAL_MS,
  SURVIVAL_LOCAL_GRASS_RADIUS_BUCKET_SIZE,
  SURVIVAL_LOCAL_GRASS_SHORT_BLADES_PER_TUFT,
  SURVIVAL_LOCAL_GRASS_SHORT_TUFTS_PER_CELL,
  SURVIVAL_LOCAL_GRASS_SOLID_BLADES_PER_CELL,
  SURVIVAL_LOCAL_GRASS_SWAMP_LIFT_COLOR,
  SURVIVAL_LOCAL_GRASS_TALL_TUFTS_PER_CELL,
  getSurvivalLocalGrassCellCoord,
  getSurvivalLocalGrassHysteresisCell,
  getSurvivalLocalGrassStreamRadius,
  makeSurvivalLocalGrassCells,
  reconcileSurvivalLocalGrassVisibleCells,
  useSurvivalLocalGrassCellLoadStage,
  type SurvivalLocalGrassCell,
} from "./survivalLocalGrassStreaming";
import {
  SURVIVAL_TUTORIAL_GRASS_AIR_RADIUS,
  SURVIVAL_TUTORIAL_GRASS_BLADE_DENSITY_DISTANCE,
  SURVIVAL_TUTORIAL_GRASS_CELL_MOUNT_INTERVAL_MS,
  SURVIVAL_TUTORIAL_GRASS_CELL_SIZE,
  SURVIVAL_TUTORIAL_GRASS_EDGE_FADE,
  SURVIVAL_TUTORIAL_GRASS_GROUND_RADIUS,
  SURVIVAL_TUTORIAL_GRASS_IDLE_TIMEOUT_MS,
  SURVIVAL_TUTORIAL_GRASS_INITIAL_CELL_MOUNT_COUNT,
  SURVIVAL_TUTORIAL_GRASS_MID_BLADE_BASE_COUNT,
  SURVIVAL_TUTORIAL_GRASS_MID_BLADE_EXTRA_COUNT,
  SURVIVAL_TUTORIAL_GRASS_MID_STRAND_DISTANCE,
  SURVIVAL_TUTORIAL_GRASS_NEAR_BLADE_BASE_COUNT,
  SURVIVAL_TUTORIAL_GRASS_NEAR_BLADE_EXTRA_COUNT,
  SURVIVAL_TUTORIAL_GRASS_NORMAL_UP_BIAS,
  SURVIVAL_TUTORIAL_GRASS_STRAND_DISTANCE,
  getSurvivalTutorialGrassCellCoord,
  getSurvivalTutorialGrassHysteresisCell,
  makeSurvivalTutorialGrassCellBatches,
  makeSurvivalTutorialGrassCells,
  reconcileSurvivalTutorialGrassVisibleCells,
  type SurvivalTutorialGrassCell,
  type SurvivalTutorialGrassCellBatch,
} from "./survivalTutorialGrassStreaming";
import { SURVIVAL_FLOWER_COLORS } from "./survivalFoliagePalettes";
import { isCurrentQaTelemetryRouteEnabled } from "../../../tools/qa/qaRouteTelemetry";
import {
  applySurvivalLocalGrassShader,
  type SurvivalLocalGrassFadeUniforms,
} from "./survivalGrassShader";
import {
  getLilyCoilBladeAlphaTexture,
  getSurvivalGroundGrassCoverAlphaTexture,
  getSurvivalLocalGrassClumpAlphaTexture,
  getSurvivalMeadowGrassCarpetTexture,
  getSurvivalShortGrassCarpetAlphaTexture,
} from "./survivalGrassTextures";
import {
  createSurvivalVertexColoredDiscGeometry,
  createSurvivalVertexColoredPlaneGeometry,
  getSurvivalLocalFlowerStarGeometry,
  getSurvivalTutorialGrassTuftGeometry,
} from "./survivalGrassGeometry";
import {
  ensureSurvivalInstancedMeshColors,
  finalizeSurvivalInstancedMesh,
  finalizeSurvivalInstancedMeshColors,
} from "./survivalInstancing";
import { HIDE_FROM_MINIMAP } from "./SurvivalFoliagePrimitives";

const SURVIVAL_WORLD_GRASS_BLADES_PER_TUFT = 4;
const SURVIVAL_WORLD_SHORT_GRASS_BLADES_PER_TUFT = 2;
const SURVIVAL_GRASS_BLADE_SOURCE_UP = new THREE.Vector3(0, 1, 0);
const SURVIVAL_GROUND_GRASS_SOURCE_NORMAL = new THREE.Vector3(0, 0, 1);
const SURVIVAL_GRASS_SYSTEM_ENABLED = true;
export const SURVIVAL_LEGACY_GRASS_SYSTEM_ENABLED = false;
const MOBILE_SURVIVAL_GRASS_WIND_UPDATE_INTERVAL_SECONDS = 1 / 24;
const MOBILE_SURVIVAL_GRASS_FIELD_UPDATE_INTERVAL_SECONDS = 1 / 30;

type SurvivalLocalGrassPlacement = {
  terrainY: number;
  biome: SurvivalBiome;
  normal: THREE.Vector3;
};

type DormantSurvivalGrassResolvers = {
  getChunkInfoAtWorld: (worldX: number, worldZ: number) => SurvivalChunkInfo;
  getTerrainHeightForChunk: (chunk: SurvivalChunkInfo, localX: number, localZ: number) => number;
  getGrassSurfaceHeightForChunk: (chunk: SurvivalChunkInfo, localX: number, localZ: number) => number;
  getGrassSurfaceNormalForChunk: (chunk: SurvivalChunkInfo, localX: number, localZ: number, sampleDistance?: number) => THREE.Vector3;
  getGrassSurfaceHeightAtWorld: (worldX: number, worldZ: number) => number;
  getChunkGrassSurfaceBiome: (chunk: SurvivalChunkInfo) => SurvivalBiome;
  getGrassSurfaceBiome: (baseBiome: SurvivalBiome, worldX: number, worldZ: number, height: number) => SurvivalBiome;
  getSmoothedTerrainColor: (worldX: number, worldZ: number, height: number) => THREE.Color;
  getGrassBladeColor: (biome: SurvivalBiome, worldX: number, worldZ: number, height: number, variant: number) => THREE.Color;
  getIntegratedGrassBladeColor: (biome: SurvivalBiome, worldX: number, worldZ: number, height: number, variant: number, terrainMix: number) => THREE.Color;
  isGrassAllowedAtChunkPoint: (chunk: SurvivalChunkInfo, localX: number, localZ: number) => boolean;
  isGrassSubmergedAtWorldPoint: (chunk: SurvivalChunkInfo, worldX: number, worldZ: number, terrainY: number, shorelinePadding?: number, footprintRadius?: number) => boolean;
  getBotwGrassFootprintStats: (worldX: number, worldZ: number, radius: number) => { baseY: number; heightRange: number };
  getLocalGrassPlacement: (worldX: number, worldZ: number, submergeMargin: number, footprintRadius?: number, minNormalY?: number) => SurvivalLocalGrassPlacement | null;
  getGrassDebugRejectionSummary: (worldX: number, worldZ: number) => string;
};

let dormantSurvivalGrassResolvers: DormantSurvivalGrassResolvers | null = null;

export function configureDormantSurvivalGrassResolvers(resolvers: DormantSurvivalGrassResolvers) {
  dormantSurvivalGrassResolvers = resolvers;
}

function getDormantSurvivalGrassResolvers() {
  if (!dormantSurvivalGrassResolvers) {
    throw new Error("Dormant survival grass resolvers have not been configured.");
  }
  return dormantSurvivalGrassResolvers;
}

function getDormantGrassVectorLength2D(x: number, z: number) {
  return Math.sqrt(x * x + z * z);
}

function getDormantGrassVectorLength3D(x: number, y: number, z: number) {
  return Math.sqrt(x * x + y * y + z * z);
}

function clampDormantGrassColor(color: THREE.Color) {
  color.r = clamp01(color.r);
  color.g = clamp01(color.g);
  color.b = clamp01(color.b);
}

function getSurvivalChunkInfoAtWorld(worldX: number, worldZ: number) {
  return getDormantSurvivalGrassResolvers().getChunkInfoAtWorld(worldX, worldZ);
}

function getSurvivalTerrainHeightForChunk(chunk: SurvivalChunkInfo, localX: number, localZ: number) {
  return getDormantSurvivalGrassResolvers().getTerrainHeightForChunk(chunk, localX, localZ);
}

function getSurvivalGrassSurfaceHeightForChunk(chunk: SurvivalChunkInfo, localX: number, localZ: number) {
  return getDormantSurvivalGrassResolvers().getGrassSurfaceHeightForChunk(chunk, localX, localZ);
}

function getSurvivalGrassSurfaceNormalForChunk(chunk: SurvivalChunkInfo, localX: number, localZ: number, sampleDistance?: number) {
  return getDormantSurvivalGrassResolvers().getGrassSurfaceNormalForChunk(chunk, localX, localZ, sampleDistance);
}

function getSurvivalGrassSurfaceHeightAtWorld(worldX: number, worldZ: number) {
  return getDormantSurvivalGrassResolvers().getGrassSurfaceHeightAtWorld(worldX, worldZ);
}

function getSurvivalChunkGrassSurfaceBiome(chunk: SurvivalChunkInfo) {
  return getDormantSurvivalGrassResolvers().getChunkGrassSurfaceBiome(chunk);
}

function getSurvivalGrassSurfaceBiome(baseBiome: SurvivalBiome, worldX: number, worldZ: number, height: number) {
  return getDormantSurvivalGrassResolvers().getGrassSurfaceBiome(baseBiome, worldX, worldZ, height);
}

function getSurvivalSmoothedTerrainColor(worldX: number, worldZ: number, height: number) {
  return getDormantSurvivalGrassResolvers().getSmoothedTerrainColor(worldX, worldZ, height);
}

function getSurvivalGrassBladeColor(biome: SurvivalBiome, worldX: number, worldZ: number, height: number, variant: number) {
  return getDormantSurvivalGrassResolvers().getGrassBladeColor(biome, worldX, worldZ, height, variant);
}

function getSurvivalIntegratedGrassBladeColor(
  biome: SurvivalBiome,
  worldX: number,
  worldZ: number,
  height: number,
  variant: number,
  terrainMix: number,
) {
  return getDormantSurvivalGrassResolvers().getIntegratedGrassBladeColor(biome, worldX, worldZ, height, variant, terrainMix);
}

function isSurvivalGrassAllowedAtChunkPoint(chunk: SurvivalChunkInfo, localX: number, localZ: number) {
  return getDormantSurvivalGrassResolvers().isGrassAllowedAtChunkPoint(chunk, localX, localZ);
}

function isSurvivalGrassSubmergedAtWorldPoint(
  chunk: SurvivalChunkInfo,
  worldX: number,
  worldZ: number,
  terrainY: number,
  shorelinePadding?: number,
  footprintRadius?: number,
) {
  return getDormantSurvivalGrassResolvers().isGrassSubmergedAtWorldPoint(chunk, worldX, worldZ, terrainY, shorelinePadding, footprintRadius);
}

function getSurvivalBotwGrassFootprintStats(worldX: number, worldZ: number, radius: number) {
  return getDormantSurvivalGrassResolvers().getBotwGrassFootprintStats(worldX, worldZ, radius);
}

function getSurvivalLocalGrassPlacement(
  worldX: number,
  worldZ: number,
  submergeMargin: number,
  footprintRadius = 0,
  minNormalY = 0.58,
) {
  return getDormantSurvivalGrassResolvers().getLocalGrassPlacement(worldX, worldZ, submergeMargin, footprintRadius, minNormalY);
}

function getSurvivalGrassDebugRejectionSummary(worldX: number, worldZ: number) {
  return getDormantSurvivalGrassResolvers().getGrassDebugRejectionSummary(worldX, worldZ);
}

function shouldPublishSurvivalLocalGrassTelemetry() {
  return isCurrentQaTelemetryRouteEnabled(["grass", "perf", "canvas", "touch", "mountain", "survival"]);
}

function getSurvivalLocalGrassViewerPosition(camera: THREE.Camera) {
  const localPlayer = getBrowserLocalPlayerPosition();
  if (localPlayer) {
    return {
      x: localPlayer.x,
      y: typeof localPlayer.y === "number" ? localPlayer.y : camera.position.y,
      z: localPlayer.z,
    };
  }

  return { x: camera.position.x, y: camera.position.y, z: camera.position.z };
}
type SurvivalGrassBlade = {
  key: string;
  x: number;
  y: number;
  z: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  yaw: number;
  tilt: number;
  width: number;
  height: number;
};

type SurvivalLocalGrassBlade = SurvivalGrassBlade & {
  color: THREE.Color;
};

type SurvivalGroundGrassPatch = {
  x: number;
  y: number;
  z: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  yaw: number;
  width: number;
  depth: number;
  color: THREE.Color;
};

type SurvivalTutorialGrassTuft = {
  x: number;
  y: number;
  z: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  yaw: number;
  width: number;
  height: number;
  color: THREE.Color;
};

type SurvivalTutorialGrassTuftInstance = SurvivalTutorialGrassTuft & {
  worldX: number;
  worldZ: number;
};

type SurvivalTutorialGrassFlowerInstance = SurvivalWildflower & {
  worldX: number;
  worldZ: number;
};

type SurvivalWildflower = {
  x: number;
  y: number;
  z: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  yaw: number;
  stemHeight: number;
  stemRadius: number;
  bloomSize: number;
  color: string;
  bloomType?: "star" | "round" | "bell" | "puff";
  bloomWidth?: number;
  bloomHeight?: number;
  centerSize?: number;
  centerColor?: string;
};

type SurvivalFlowerBloomType = NonNullable<SurvivalWildflower["bloomType"]>;

type SurvivalFlowerBloomGroups<T extends { bloomType?: SurvivalFlowerBloomType }> = {
  star: T[];
  round: T[];
  bell: T[];
  puff: T[];
};

function splitSurvivalFlowersByBloomType<T extends { bloomType?: SurvivalFlowerBloomType }>(
  flowers: T[],
): SurvivalFlowerBloomGroups<T> {
  const groups: SurvivalFlowerBloomGroups<T> = {
    star: [],
    round: [],
    bell: [],
    puff: [],
  };

  for (let index = 0; index < flowers.length; index += 1) {
    const flower = flowers[index];
    if (flower.bloomType === "star") {
      groups.star.push(flower);
    } else if (flower.bloomType === "round") {
      groups.round.push(flower);
    } else if (flower.bloomType === "bell") {
      groups.bell.push(flower);
    } else if (flower.bloomType === "puff") {
      groups.puff.push(flower);
    }
  }

  return groups;
}

function getSurvivalGroundGrassPatchCount(chunk: SurvivalChunkInfo, mobilePerformanceMode: boolean, streamScale = 1) {
  if (streamScale <= 0) return 0;
  const grassBiome = getSurvivalChunkGrassSurfaceBiome(chunk);
  const biomeBase = grassBiome === "desert"
    ? 0.9
    : grassBiome === "swamp"
      ? 0.82
      : grassBiome === "mushroom"
        ? 0.88
        : grassBiome === "tallgrass"
          ? 1.18
          : grassBiome === "jungle"
            ? 0.94
            : 1.08;
  const lodBase = chunk.lod === "near"
    ? 4200
      : chunk.lod === "mid"
        ? 2200
      : chunk.distance <= 2
        ? 1200
        : chunk.distance <= 4
          ? 820
          : chunk.distance <= 6
            ? 560
            : 320;

  return Math.max(
    Math.round((chunk.lod === "far" ? 220 : chunk.lod === "mid" ? 620 : 900) * streamScale),
    Math.round(lodBase * biomeBase * (mobilePerformanceMode ? 0.46 : 1) * streamScale),
  );
}

export function SurvivalGrassGroundCover({ chunk, loadStage = 4 }: { chunk: SurvivalChunkInfo; loadStage?: number }) {
  const groundRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const normal = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const patchAlphaTexture = useMemo(() => getSurvivalGroundGrassCoverAlphaTexture(), []);
  const groundPlaneGeometry = useMemo(() => createSurvivalVertexColoredPlaneGeometry(1, 1), []);
  const streamScale = getSurvivalGrassStreamScale(loadStage);
  const patches = useMemo<SurvivalGroundGrassPatch[]>(() => {
    const targetCount = getSurvivalGroundGrassPatchCount(chunk, mobilePerformanceMode, streamScale);
    if (targetCount <= 0) return [];

    const generated: SurvivalGroundGrassPatch[] = [];
    const scatterSize = SURVIVAL_BLOCK_SIZE * 0.99;
    const gridSize = Math.ceil(Math.sqrt(targetCount * 1.05));
    const attempts = gridSize * gridSize;
    const isFarLod = chunk.lod === "far";
    const widthBase = isFarLod ? 27.5 : chunk.lod === "mid" ? 13.4 : 7.8;
    const widthRange = isFarLod ? 20.5 : chunk.lod === "mid" ? 10.6 : 6.5;
    const depthBase = isFarLod ? 20.2 : chunk.lod === "mid" ? 9.8 : 6.1;
    const depthRange = isFarLod ? 16.4 : chunk.lod === "mid" ? 8.4 : 5.4;

    const sampleOffset = Math.floor(survivalHash01(chunk.cx, chunk.cz, 18050) * attempts);

    for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
      const sampleIndex = (sampleOffset + index * 8191) % attempts;
      const col = sampleIndex % gridSize;
      const row = Math.floor(sampleIndex / gridSize);
      const jitterX = 0.1 + survivalHash01(chunk.cx + col, chunk.cz + row, 8000 + index) * 0.8;
      const jitterZ = 0.1 + survivalHash01(chunk.cx - row, chunk.cz + col, 8100 + index) * 0.8;
      const localX = (((col + jitterX) / gridSize) - 0.5) * scatterSize;
      const localZ = (((row + jitterZ) / gridSize) - 0.5) * scatterSize;

      const worldX = chunk.x + localX;
      const worldZ = chunk.z + localZ;
      const terrainY = getSurvivalGrassSurfaceHeightForChunk(chunk, localX, localZ);
      if (!isSurvivalGrassAllowedAtChunkPoint(chunk, localX, localZ)) continue;
      if (isSurvivalGrassSubmergedAtWorldPoint(
        chunk,
        worldX,
        worldZ,
        terrainY,
        0.02,
        Math.max(widthBase + widthRange, depthBase + depthRange) * 0.48,
      )) continue;

      const terrainNormal = getSurvivalGrassSurfaceNormalForChunk(chunk, localX, localZ, isFarLod ? 7.5 : 3.2);
      const width = widthBase + survivalHash01(chunk.cx, chunk.cz, 8400 + index) * widthRange;
      const depth = depthBase + survivalHash01(chunk.cx, chunk.cz, 8500 + index) * depthRange;
      const footprintStats = getSurvivalBotwGrassFootprintStats(
        worldX,
        worldZ,
        Math.max(width, depth) * (isFarLod ? 0.42 : 0.5),
      );
      const maxFootprintRange = isFarLod ? 5.2 : chunk.lod === "mid" ? 3.4 : 2.6;
      const minNormalY = isFarLod ? 0.78 : chunk.lod === "mid" ? 0.82 : 0.84;
      if (footprintStats.heightRange > maxFootprintRange || terrainNormal.y < minNormalY) continue;

      const slopeTuck = clamp01(Math.max(
        smoothstepRange(0.7, maxFootprintRange, footprintStats.heightRange),
        smoothstepRange(0.02, 1 - minNormalY, 1 - terrainNormal.y),
      ));
      const terrainLift = isFarLod ? 0.12 : 0.095;
      const tuckedY = Math.min(
        terrainY + terrainLift,
        footprintStats.baseY + lerpNumber(0.045, -0.035, slopeTuck),
      );
      const slopeSizeScale = lerpNumber(1, isFarLod ? 0.62 : 0.72, slopeTuck);
      const variant = survivalHash01(chunk.cx, chunk.cz, 8200 + index);
      const grassBiome = getSurvivalGrassSurfaceBiome(chunk.biome, worldX, worldZ, terrainY);
      const color = getSurvivalGrassBladeColor(grassBiome, worldX, worldZ, terrainY, variant);
      const terrainColor = getSurvivalSmoothedTerrainColor(worldX, worldZ, terrainY);
      color.lerp(terrainColor, isFarLod ? 0.08 : chunk.lod === "mid" ? 0.1 : 0.12);
      color.multiplyScalar(isFarLod ? 1.3 : chunk.lod === "mid" ? 1.28 : 1.26);
      generated.push({
        x: localX,
        y: tuckedY,
        z: localZ,
        normalX: terrainNormal.x,
        normalY: terrainNormal.y,
        normalZ: terrainNormal.z,
        yaw: survivalHash01(chunk.cx, chunk.cz, 8300 + index) * Math.PI * 2,
        width: width * slopeSizeScale,
        depth: depth * slopeSizeScale,
        color,
      });
    }

    return generated;
  }, [chunk, mobilePerformanceMode, streamScale]);

  useEffect(() => {
    const mesh = groundRef.current;
    if (!mesh) return;

    ensureSurvivalInstancedMeshColors(mesh, patches.length);
    for (let index = 0; index < patches.length; index += 1) {
      const patch = patches[index];
      normal.set(patch.normalX, patch.normalY, patch.normalZ).normalize();
      dummy.position.set(chunk.x + patch.x, patch.y, chunk.z + patch.z);
      dummy.quaternion.setFromUnitVectors(SURVIVAL_GROUND_GRASS_SOURCE_NORMAL, normal);
      dummy.rotateZ(patch.yaw);
      dummy.scale.set(patch.width, patch.depth, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, patch.color);
    }

    mesh.count = patches.length;
    mesh.instanceMatrix.needsUpdate = true;
    finalizeSurvivalInstancedMeshColors(mesh);
    finalizeSurvivalInstancedMesh(mesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.72, 64);
  }, [chunk.x, chunk.z, dummy, normal, patches]);

  if (patches.length === 0) return null;

  return (
    <instancedMesh ref={groundRef} args={[undefined, undefined, patches.length]} renderOrder={3} frustumCulled={false}>
      <primitive object={groundPlaneGeometry} attach="geometry" />
      <meshBasicMaterial
        alphaMap={patchAlphaTexture}
        alphaTest={0.04}
        color="#ffffff"
        vertexColors
        side={THREE.DoubleSide}
        transparent
        opacity={chunk.lod === "far" ? 0.42 : chunk.lod === "mid" ? 0.45 : 0.48}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

export function SurvivalGrassPatches({ chunk, loadStage = 4 }: { chunk: SurvivalChunkInfo; loadStage?: number }) {
  const grassRef = useRef<THREE.InstancedMesh>(null);
  const shortGrassRef = useRef<THREE.InstancedMesh>(null);
  const grassUniformRef = useRef<{ value: number } | null>(null);
  const shortGrassUniformRef = useRef<{ value: number } | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const patchNormal = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const bladeBase = useMemo(() => new THREE.Vector3(), []);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const streamScale = getSurvivalGrassStreamScale(loadStage);
  const bladeAlphaTexture = useMemo(() => getLilyCoilBladeAlphaTexture(), []);
  const grassBiome = useMemo(() => getSurvivalChunkGrassSurfaceBiome(chunk), [chunk]);
  const isTallgrassBiome = grassBiome === "tallgrass";
  const shortGrassPatchTexture = useMemo(() => getSurvivalLocalGrassClumpAlphaTexture(), []);
  const grassMaterialColor = useMemo(() => {
    const sampleHeight = getSurvivalTerrainHeightForChunk(chunk, 0, 0);
    const color = getSurvivalIntegratedGrassBladeColor(
      grassBiome,
      chunk.x,
      chunk.z,
      sampleHeight,
      survivalHash01(chunk.cx, chunk.cz, 1750),
      0.2,
    );
    return `#${color.getHexString()}`;
  }, [chunk, grassBiome]);
  const shortGrassMaterialColor = useMemo(() => {
    const sampleHeight = getSurvivalTerrainHeightForChunk(chunk, 17, -13);
    const color = getSurvivalIntegratedGrassBladeColor(
      getSurvivalGrassSurfaceBiome(chunk.biome, chunk.x + 17, chunk.z - 13, sampleHeight),
      chunk.x + 17,
      chunk.z - 13,
      sampleHeight,
      survivalHash01(chunk.cx, chunk.cz, 1760),
      isTallgrassBiome ? 0.22 : 0.26,
    );
    return `#${color.getHexString()}`;
  }, [chunk, isTallgrassBiome]);
  const blades = useMemo<SurvivalGrassBlade[]>(() => {
    if (streamScale <= 0) return [];
    if (chunk.lod === "far") return [];
    if (grassBiome === "desert") return [];
    if (grassBiome !== "tallgrass") return [];

    const baseTargetCount = chunk.lod === "mid"
      ? 420
      : 1800;
    const targetCount = Math.max(
      Math.round((chunk.lod === "mid" ? 80 : 420) * streamScale),
      Math.round(baseTargetCount * (mobilePerformanceMode ? 0.46 : 1) * streamScale),
    );
    const generated: SurvivalGrassBlade[] = [];
    const attempts = targetCount * 4;

    for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
      const localX = (survivalHash01(chunk.cx, chunk.cz, 700 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.92;
      const localZ = (survivalHash01(chunk.cx, chunk.cz, 900 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.92;

      const worldX = chunk.x + localX;
      const worldZ = chunk.z + localZ;
      const terrainY = getSurvivalGrassSurfaceHeightForChunk(chunk, localX, localZ);
      if (!isSurvivalGrassAllowedAtChunkPoint(chunk, localX, localZ)) continue;
      if (isSurvivalGrassSubmergedAtWorldPoint(chunk, worldX, worldZ, terrainY, 0.06, 0.85)) continue;
      const terrainNormal = getSurvivalGrassSurfaceNormalForChunk(chunk, localX, localZ, 4.5);

      const shape = survivalHash01(chunk.cx, chunk.cz, 1100 + index);
      const heightBase = 0.95;
      const heightRange = 1.35;
      const widthScale = 0.62;
      generated.push({
        key: `${chunk.key}-grass-${index}`,
        x: localX,
        y: terrainY + 0.03,
        z: localZ,
        normalX: terrainNormal.x,
        normalY: terrainNormal.y,
        normalZ: terrainNormal.z,
        yaw: survivalHash01(chunk.cx, chunk.cz, 1300 + index) * Math.PI * 2,
        tilt: (survivalHash01(chunk.cx, chunk.cz, 1500 + index) - 0.5) * 0.62,
        width: (0.58 + shape * 1.02) * widthScale,
        height: heightBase + shape * heightRange,
      });
    }

    return generated;
  }, [chunk, grassBiome, mobilePerformanceMode, streamScale]);
  const shortBlades = useMemo<SurvivalGrassBlade[]>(() => {
    if (streamScale <= 0) return [];
    if (chunk.distance > 1) return [];

    const nearBiomeCount = isTallgrassBiome
      ? 3000
      : grassBiome === "jungle"
        ? 2700
        : grassBiome === "swamp"
          ? 2100
          : grassBiome === "mushroom"
            ? 2300
            : grassBiome === "desert"
              ? 1900
              : 2800;
    const distanceScale = chunk.distance === 0
      ? 1
      : chunk.distance === 1
        ? 0.18
        : 0;
    const baseTargetCount = Math.round(nearBiomeCount * distanceScale);
    const performanceScale = mobilePerformanceMode
      ? (chunk.distance === 0 ? 0.58 : 0.5)
      : 1;
    const targetCount = Math.max(
      Math.round((chunk.distance === 0 ? 700 : 150) * streamScale),
      Math.round(baseTargetCount * performanceScale * streamScale),
    );
    const generated: SurvivalGrassBlade[] = [];
    const scatterSize = SURVIVAL_BLOCK_SIZE * 0.98;
    const gridSize = Math.ceil(Math.sqrt(targetCount * 1.12));
    const attempts = gridSize * gridSize;

    const sampleOffset = Math.floor(survivalHash01(chunk.cx, chunk.cz, 17050) * attempts);

    for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
      const sampleIndex = (sampleOffset + index * 8191) % attempts;
      const col = sampleIndex % gridSize;
      const row = Math.floor(sampleIndex / gridSize);
      const jitterX = 0.18 + survivalHash01(chunk.cx + col, chunk.cz + row, 2700 + index) * 0.64;
      const jitterZ = 0.18 + survivalHash01(chunk.cx - row, chunk.cz + col, 2900 + index) * 0.64;
      const localX = (((col + jitterX) / gridSize) - 0.5) * scatterSize;
      const localZ = (((row + jitterZ) / gridSize) - 0.5) * scatterSize;

      const worldX = chunk.x + localX;
      const worldZ = chunk.z + localZ;
      const terrainY = getSurvivalGrassSurfaceHeightForChunk(chunk, localX, localZ);
      if (!isSurvivalGrassAllowedAtChunkPoint(chunk, localX, localZ)) continue;
      if (isSurvivalGrassSubmergedAtWorldPoint(chunk, worldX, worldZ, terrainY, 0.04, 0.38)) continue;
      const terrainNormal = getSurvivalGrassSurfaceNormalForChunk(chunk, localX, localZ, chunk.lod === "far" ? 6.5 : 3.4);
      const shape = survivalHash01(chunk.cx, chunk.cz, 3100 + index);
      const heightBase = isTallgrassBiome
        ? 1.05
        : grassBiome === "jungle"
          ? 0.62
        : grassBiome === "swamp"
          ? 0.46
          : grassBiome === "mushroom"
            ? 0.5
            : grassBiome === "desert"
              ? 0.46
              : 0.64;
      const heightRange = isTallgrassBiome
        ? 1.3
        : grassBiome === "jungle"
          ? 0.76
        : grassBiome === "swamp"
          ? 0.58
          : grassBiome === "mushroom"
            ? 0.64
            : grassBiome === "desert"
              ? 0.54
              : 0.82;
      const widthScale = isTallgrassBiome ? 0.98 : grassBiome === "jungle" ? 1.02 : grassBiome === "desert" ? 0.95 : 1.08;
      const lodWidthScale = chunk.lod === "far" ? 0.9 : 1;
      const lodHeightScale = chunk.lod === "far" ? 0.92 : 1;

      generated.push({
        key: `${chunk.key}-short-grass-${index}`,
        x: localX,
        y: terrainY + 0.02,
        z: localZ,
        normalX: terrainNormal.x,
        normalY: terrainNormal.y,
        normalZ: terrainNormal.z,
        yaw: survivalHash01(chunk.cx, chunk.cz, 3300 + index) * Math.PI * 2,
        tilt: (survivalHash01(chunk.cx, chunk.cz, 3500 + index) - 0.5) * (isTallgrassBiome ? 0.36 : 0.28),
        width: (isTallgrassBiome ? 2.2 + shape * 2.8 : 1.35 + shape * 1.95) * widthScale * lodWidthScale,
        height: (heightBase + shape * heightRange) * lodHeightScale,
      });
    }

    return generated;
  }, [chunk, grassBiome, isTallgrassBiome, mobilePerformanceMode, streamScale]);
  const shortBladesPerTuft = SURVIVAL_LOCAL_GRASS_SHORT_BLADES_PER_TUFT;
  const lastMobileWindUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime;
    if (
      mobilePerformanceMode &&
      elapsed - lastMobileWindUpdateAtRef.current < MOBILE_SURVIVAL_GRASS_WIND_UPDATE_INTERVAL_SECONDS
    ) return;
    lastMobileWindUpdateAtRef.current = elapsed;

    if (grassUniformRef.current) {
      grassUniformRef.current.value = elapsed;
    }
    if (shortGrassUniformRef.current) {
      shortGrassUniformRef.current.value = elapsed;
    }
  });

  useEffect(() => {
    const mesh = grassRef.current;
    const shortMesh = shortGrassRef.current;
    if (!mesh && !shortMesh) return;

    if (shortMesh) {
      let shortInstance = 0;
      for (let bladeIndex = 0; bladeIndex < shortBlades.length; bladeIndex += 1) {
        const blade = shortBlades[bladeIndex];
        for (let tuftIndex = 0; tuftIndex < shortBladesPerTuft; tuftIndex += 1) {
          const radial = (tuftIndex / shortBladesPerTuft) * Math.PI * 2;
          const yaw = blade.yaw + radial + (bladeIndex % 6) * 0.07;
          const spread = blade.width * (0.08 + tuftIndex * 0.04);
          const heightJitter = 0.82 + survivalHash01(chunk.cx + tuftIndex, chunk.cz - tuftIndex, 5200 + bladeIndex) * 0.34;
          const widthJitter = 0.84 + survivalHash01(chunk.cx - tuftIndex, chunk.cz + tuftIndex, 5300 + bladeIndex) * 0.46;
          const bladeHeight = blade.height * heightJitter;
          patchNormal.set(blade.normalX, blade.normalY, blade.normalZ).normalize();
          bladeBase.set(
            chunk.x + blade.x + Math.sin(yaw) * spread,
            blade.y,
            chunk.z + blade.z + Math.cos(yaw) * spread,
          );

          dummy.position.copy(bladeBase).addScaledVector(patchNormal, bladeHeight * 0.5);
          dummy.quaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, patchNormal);
          dummy.rotateY(yaw);
          dummy.rotateX(blade.tilt * 0.18);
          dummy.rotateZ(Math.sin(yaw + blade.tilt) * 0.1);
          dummy.scale.set(blade.width * widthJitter, bladeHeight, 1);
          dummy.updateMatrix();
          shortMesh.setMatrixAt(shortInstance, dummy.matrix);
          shortInstance += 1;
        }
      }

      shortMesh.count = shortInstance;
      finalizeSurvivalInstancedMesh(shortMesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.82, 16);
    }

    if (!mesh) return;

    let instance = 0;
    for (let bladeIndex = 0; bladeIndex < blades.length; bladeIndex += 1) {
      const blade = blades[bladeIndex];
      for (let tuftIndex = 0; tuftIndex < SURVIVAL_WORLD_GRASS_BLADES_PER_TUFT; tuftIndex += 1) {
        const radial = (tuftIndex / SURVIVAL_WORLD_GRASS_BLADES_PER_TUFT) * Math.PI * 2;
        const yaw = blade.yaw + radial + (bladeIndex % 5) * 0.09;
        const spread = blade.width * (0.12 + tuftIndex * 0.06);
        const heightJitter = 0.76 + survivalHash01(chunk.cx + tuftIndex, chunk.cz - tuftIndex, 4200 + bladeIndex) * 0.42;
        const widthJitter = 0.88 + survivalHash01(chunk.cx - tuftIndex, chunk.cz + tuftIndex, 4300 + bladeIndex) * 0.52;
        const bladeHeight = blade.height * heightJitter;
        patchNormal.set(blade.normalX, blade.normalY, blade.normalZ).normalize();
        bladeBase.set(
          chunk.x + blade.x + Math.sin(yaw) * spread,
          blade.y,
          chunk.z + blade.z + Math.cos(yaw) * spread,
        );

        dummy.position.copy(bladeBase).addScaledVector(patchNormal, bladeHeight * 0.48);
        dummy.quaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, patchNormal);
        dummy.rotateY(yaw);
        dummy.rotateX(blade.tilt * 0.46);
        dummy.rotateZ(Math.sin(yaw + blade.tilt) * 0.14);
        dummy.scale.set(blade.width * widthJitter, bladeHeight, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(instance, dummy.matrix);
        instance += 1;
      }
    }

    mesh.count = instance;
    finalizeSurvivalInstancedMesh(mesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.82, 24);
  }, [bladeBase, blades, chunk.cx, chunk.cz, chunk.x, chunk.z, dummy, patchNormal, shortBlades, shortBladesPerTuft]);

  if (blades.length === 0 && shortBlades.length === 0) return null;

  const capacity = Math.max(1, blades.length * SURVIVAL_WORLD_GRASS_BLADES_PER_TUFT);
  const shortCapacity = Math.max(1, shortBlades.length * shortBladesPerTuft);

  return (
    <group name={`survival-grass-${chunk.key}`}>
      <instancedMesh ref={shortGrassRef} args={[undefined, undefined, shortCapacity]} renderOrder={4}>
        <planeGeometry args={[1, 1, 1, 3]} />
        <meshBasicMaterial
          alphaMap={shortGrassPatchTexture}
          alphaTest={chunk.lod === "far" ? 0.14 : 0.12}
          color={shortGrassMaterialColor}
          side={THREE.DoubleSide}
          transparent
          opacity={chunk.lod === "far" ? 0.66 : 0.76}
          depthWrite={false}
          toneMapped={false}
          onBeforeCompile={(shader) => {
            const timeUniform = { value: 0 };
            shader.uniforms.uTime = timeUniform;
            shader.vertexShader = `uniform float uTime;\n${shader.vertexShader.replace(
              "#include <begin_vertex>",
              `#include <begin_vertex>
              float survivalShortBladeMask = smoothstep(-0.5, 0.5, position.y);
              float survivalShortWindSeed = position.x * 4.0;
              #ifdef USE_INSTANCING
                survivalShortWindSeed += instanceMatrix[3].x * 0.023 + instanceMatrix[3].z * 0.029;
              #endif
              float survivalShortWind = sin(uTime * 1.1 + survivalShortWindSeed) + sin(uTime * 1.8 + survivalShortWindSeed * 1.37) * 0.24;
              transformed.x += survivalShortWind * survivalShortBladeMask * survivalShortBladeMask * 0.055;
              transformed.z += cos(uTime * 0.92 + survivalShortWindSeed) * survivalShortBladeMask * 0.025;`,
            )}`;
            shortGrassUniformRef.current = timeUniform;
          }}
        />
      </instancedMesh>
      <instancedMesh ref={grassRef} args={[undefined, undefined, capacity]} renderOrder={5}>
        <planeGeometry args={[1, 1, 1, 3]} />
        <meshBasicMaterial
          alphaMap={bladeAlphaTexture}
          alphaTest={0.16}
          color={grassMaterialColor}
          side={THREE.DoubleSide}
          transparent
          opacity={0.9}
          depthWrite={false}
          toneMapped={false}
          onBeforeCompile={(shader) => {
            const timeUniform = { value: 0 };
            shader.uniforms.uTime = timeUniform;
            shader.vertexShader = `uniform float uTime;\n${shader.vertexShader.replace(
              "#include <begin_vertex>",
              `#include <begin_vertex>
              float survivalBladeMask = smoothstep(-0.5, 0.5, position.y);
              float survivalWindSeed = position.x * 5.0;
              #ifdef USE_INSTANCING
                survivalWindSeed += instanceMatrix[3].x * 0.027 + instanceMatrix[3].z * 0.031;
              #endif
              float survivalWind = sin(uTime * 1.34 + survivalWindSeed) + sin(uTime * 2.08 + survivalWindSeed * 1.53) * 0.34;
              transformed.x += survivalWind * survivalBladeMask * survivalBladeMask * 0.18;
              transformed.z += cos(uTime * 1.08 + survivalWindSeed) * survivalBladeMask * 0.055;`,
            )}`;
            grassUniformRef.current = timeUniform;
          }}
        />
      </instancedMesh>
    </group>
  );
}


function makeSurvivalLocalGrassCarpetGeometry(cell: SurvivalLocalGrassCell) {
  const segments = SURVIVAL_LOCAL_GRASS_CARPET_SEGMENTS;
  const step = SURVIVAL_LOCAL_GRASS_CELL_SIZE / segments;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const vertexMap = new Map<string, number>();

  const addVertex = (gridX: number, gridZ: number) => {
    const key = `${gridX}:${gridZ}`;
    const existing = vertexMap.get(key);
    if (existing !== undefined) return existing;

    const x = gridX * step;
    const z = gridZ * step;
    const worldX = cell.x + x;
    const worldZ = cell.z + z;
    const chunk = getSurvivalChunkInfoAtWorld(worldX, worldZ);
    const localX = worldX - chunk.x;
    const localZ = worldZ - chunk.z;
    const y = getSurvivalGrassSurfaceHeightForChunk(chunk, localX, localZ) + 0.045;
    const terrainColor = getSurvivalSmoothedTerrainColor(worldX, worldZ, y);
    const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
    const meadowFiber = (
      Math.sin(worldX * 0.115 + worldZ * 0.041) +
      Math.cos(worldZ * 0.107 - worldX * 0.052) +
      Math.sin((worldX + worldZ) * 0.073)
    ) / 3;
    const meadowCluster = smoothstepRange(-0.42, 0.76, meadowFiber);
    const meadowColor = new THREE.Color("#65c73d").lerp(new THREE.Color("#a9e65b"), meadowCluster);
    if (meadowMask > 0.04) {
      const meadowShade = new THREE.Color("#55b738").lerp(meadowColor, 0.64 + meadowMask * 0.24);
      terrainColor.lerp(meadowShade, 0.62 + meadowMask * 0.28);
    } else {
      terrainColor.lerp(meadowColor, meadowMask * 0.97);
    }
    terrainColor.multiplyScalar(lerpNumber(0.99, 1.08, meadowMask));
    terrainColor.r = clamp01(terrainColor.r);
    terrainColor.g = clamp01(terrainColor.g);
    terrainColor.b = clamp01(terrainColor.b);

    const vertexIndex = positions.length / 3;
    positions.push(worldX, y, worldZ);
    colors.push(terrainColor.r, terrainColor.g, terrainColor.b);
    uvs.push(worldX / 24, worldZ / 24);
    vertexMap.set(key, vertexIndex);
    return vertexIndex;
  };

  for (let z = 0; z < segments; z += 1) {
    for (let x = 0; x < segments; x += 1) {
      const centerWorldX = cell.x + (x + 0.5) * step;
      const centerWorldZ = cell.z + (z + 0.5) * step;
      const placement = getSurvivalLocalGrassPlacement(centerWorldX, centerWorldZ, 0.025, Math.min(1.2, step * 0.08), 0.34);
      if (!placement) continue;

      const a = addVertex(x, z);
      const b = addVertex(x + 1, z);
      const c = addVertex(x, z + 1);
      const d = addVertex(x + 1, z + 1);
      indices.push(a, c, b, b, c, d);
    }
  }

  if (indices.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function makeSurvivalLocalSolidGrassBladeGeometry(
  cell: SurvivalLocalGrassCell,
  cellDensity: number,
  streamScale: number,
  mobilePerformanceMode: boolean,
) {
  if (streamScale <= 0 || cellDensity <= 0) return null;

  const targetCount = Math.round(Math.min(
    mobilePerformanceMode ? 18000 : 64000,
    SURVIVAL_LOCAL_GRASS_SOLID_BLADES_PER_CELL * SURVIVAL_LOCAL_GRASS_CELL_AREA_SCALE * streamScale * cellDensity,
  ));
  if (targetCount <= 0) return null;

  const positions: number[] = [];
  const colors: number[] = [];
  const bladeWeights: number[] = [];
  const indices: number[] = [];
  const baseColor = new THREE.Color();
  const midColor = new THREE.Color();
  const tipColor = new THREE.Color();
  const normal = new THREE.Vector3();
  const side = new THREE.Vector3();
  const lean = new THREE.Vector3();
  const base = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const left = new THREE.Vector3();
  const right = new THREE.Vector3();
  const tip = new THREE.Vector3();
  const attempts = Math.ceil(targetCount * 1.55);

  const pushVertex = (point: THREE.Vector3, color: THREE.Color, weight: number) => {
    const vertexIndex = positions.length / 3;
    positions.push(point.x, point.y, point.z);
    colors.push(color.r, color.g, color.b);
    bladeWeights.push(weight);
    return vertexIndex;
  };

  let generated = 0;
  for (let index = 0; index < attempts && generated < targetCount; index += 1) {
    const x = survivalHash01(cell.cellX, cell.cellZ, 22100 + index * 17) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
    const z = survivalHash01(cell.cellX, cell.cellZ, 22200 + index * 19) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
    const worldX = cell.x + x;
    const worldZ = cell.z + z;
    const placement = getSurvivalLocalGrassPlacement(worldX, worldZ, 0.035, 0, 0.4);
    if (!placement) continue;
    if (placement.biome === "desert" && survivalHash01(cell.cellX, cell.cellZ, 22300 + index) > 0.88) continue;

    const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
    const shape = survivalHash01(cell.cellX, cell.cellZ, 22400 + index);
    const yaw = survivalHash01(cell.cellX, cell.cellZ, 22500 + index) * Math.PI * 2;
    const heightBase = placement.biome === "tallgrass"
      ? lerpNumber(0.88, 1.14, meadowMask)
      : placement.biome === "swamp"
        ? 0.56
        : placement.biome === "desert"
          ? 0.38
          : lerpNumber(0.58, 0.82, meadowMask);
    const height = heightBase + shape * lerpNumber(0.24, 0.42, meadowMask);
    const width = (0.16 + survivalHash01(cell.cellX, cell.cellZ, 22600 + index) * 0.2) * lerpNumber(1.08, 1.42, meadowMask);
    const leanAmount = (survivalHash01(cell.cellX, cell.cellZ, 22700 + index) - 0.5) * height * lerpNumber(0.22, 0.42, meadowMask);

    normal.set(placement.normal.x, placement.normal.y, placement.normal.z).normalize();
    side.set(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(width);
    lean.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(leanAmount);
    base.set(worldX, placement.terrainY + 0.035, worldZ).addScaledVector(normal, 0.035);
    mid.copy(base)
      .addScaledVector(normal, height * 0.54)
      .addScaledVector(lean, 0.42)
      .addScaledVector(side, (survivalHash01(cell.cellX, cell.cellZ, 22750 + index) - 0.5) * 0.45);
    tip.copy(base).addScaledVector(normal, height).add(lean);

    const variant = survivalHash01(cell.cellX, cell.cellZ, 22800 + index);
    baseColor.copy(getSurvivalIntegratedGrassBladeColor(
      placement.biome,
      worldX,
      worldZ,
      placement.terrainY,
      variant,
      placement.biome === "desert" ? 0.12 : 0.04,
    ));
    if (meadowMask > 0.02 && placement.biome !== "desert" && placement.biome !== "swamp") {
      const bladeShade = survivalHash01(cell.cellX, cell.cellZ, 22900 + index);
      baseColor.lerp(
        bladeShade < 0.42 ? SURVIVAL_LOCAL_GRASS_MEADOW_SHADOW_COLOR : SURVIVAL_LOCAL_GRASS_MEADOW_LIFT_COLOR,
        meadowMask * (bladeShade < 0.42 ? 0.16 : 0.24),
      );
    }
    const highlightRoll = survivalHash01(cell.cellX, cell.cellZ, 22950 + index);
    const meadowTipMix = highlightRoll > 0.86 ? lerpNumber(0.12, 0.22, meadowMask) : lerpNumber(0.02, 0.08, meadowMask);
    midColor.copy(baseColor).lerp(SURVIVAL_LOCAL_GRASS_MEADOW_LIFT_COLOR, placement.biome === "desert" ? 0.025 : meadowTipMix * 0.45);
    tipColor.copy(baseColor).lerp(SURVIVAL_LOCAL_GRASS_MEADOW_LIFT_COLOR, placement.biome === "desert" ? 0.04 : meadowTipMix);
    baseColor.multiplyScalar(placement.biome === "desert" ? 0.96 : 1.03);
    tipColor.multiplyScalar(placement.biome === "desert" ? 1.01 : lerpNumber(1.03, 1.1, meadowMask));
    clampDormantGrassColor(baseColor);
    clampDormantGrassColor(tipColor);

    const baseSide = side.clone();
    const midSide = side.clone().multiplyScalar(0.58);
    const tipSide = side.clone().multiplyScalar(0.08);
    left.copy(base).add(baseSide);
    right.copy(base).sub(baseSide);
    const baseLeftIndex = pushVertex(left, baseColor, 0);
    const baseRightIndex = pushVertex(right, baseColor, 0);
    left.copy(mid).add(midSide);
    right.copy(mid).sub(midSide);
    const midLeftIndex = pushVertex(left, midColor, 0.54);
    const midRightIndex = pushVertex(right, midColor, 0.54);
    left.copy(tip).add(tipSide);
    right.copy(tip).sub(tipSide);
    const tipLeftIndex = pushVertex(left, tipColor, 1);
    const tipRightIndex = pushVertex(right, tipColor, 1);
    indices.push(
      baseLeftIndex, midLeftIndex, baseRightIndex,
      baseRightIndex, midLeftIndex, midRightIndex,
      midLeftIndex, tipLeftIndex, midRightIndex,
      midRightIndex, tipLeftIndex, tipRightIndex,
    );
    generated += 1;
  }

  if (positions.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("grassBladeWeight", new THREE.Float32BufferAttribute(bladeWeights, 1));
  geometry.setIndex(indices);
  return geometry;
}

function SurvivalLocalGrassCellTile({
  cell,
  fadeUniforms,
}: {
  cell: SurvivalLocalGrassCell;
  fadeUniforms: SurvivalLocalGrassFadeUniforms;
}) {
  const carpetRef = useRef<THREE.Mesh>(null);
  const solidGrassRef = useRef<THREE.Mesh>(null);
  const groundRef = useRef<THREE.InstancedMesh>(null);
  const shortGrassRef = useRef<THREE.InstancedMesh>(null);
  const tallGrassRef = useRef<THREE.InstancedMesh>(null);
  const flowerStemRef = useRef<THREE.InstancedMesh>(null);
  const flowerStarBloomRef = useRef<THREE.InstancedMesh>(null);
  const flowerRoundBloomRef = useRef<THREE.InstancedMesh>(null);
  const flowerBellBloomRef = useRef<THREE.InstancedMesh>(null);
  const flowerPuffBloomRef = useRef<THREE.InstancedMesh>(null);
  const flowerCenterRef = useRef<THREE.InstancedMesh>(null);
  const solidGrassUniformRef = useRef<{ value: number } | null>(null);
  const shortGrassUniformRef = useRef<{ value: number } | null>(null);
  const tallGrassUniformRef = useRef<{ value: number } | null>(null);
  const survivalTimeOverrideSeconds = useGameStore(s => s.survivalTimeOverrideSeconds);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const normal = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const bladeBase = useMemo(() => new THREE.Vector3(), []);
  const grassLightTint = useMemo(() => new THREE.Color("#ffffff"), []);
  const grassDayTint = useMemo(() => new THREE.Color("#8ed86d"), []);
  const grassNightTint = useMemo(() => new THREE.Color("#3f5a3e"), []);
  const grassDuskTint = useMemo(() => new THREE.Color("#d4bf68"), []);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const meadowCarpetTexture = useMemo(() => getSurvivalMeadowGrassCarpetTexture(), []);
  const shortGrassPatchTexture = useMemo(() => getSurvivalShortGrassCarpetAlphaTexture(), []);
  const tallGrassAlphaTexture = useMemo(() => getLilyCoilBladeAlphaTexture(), []);
  const groundDiscGeometry = useMemo(() => createSurvivalVertexColoredDiscGeometry(0.5, 10), []);
  const shortBladePlaneGeometry = useMemo(() => createSurvivalVertexColoredPlaneGeometry(1, 3, "#74a83a", "#f5ff9c"), []);
  const tallBladePlaneGeometry = useMemo(() => createSurvivalVertexColoredPlaneGeometry(1, 3, "#659532", "#e3f96d"), []);
  const loadStage = useSurvivalLocalGrassCellLoadStage(cell);
  const stagedStreamScale = getSurvivalGrassStreamScale(loadStage);
  const bladeStreamScale = stagedStreamScale;
  const coverStreamScale = 1;
  const flowerStreamScale = coverStreamScale;
  const carpetEnabled = true;
  const hasBladeDetail = cell.distance <= SURVIVAL_LOCAL_GRASS_DETAIL_RADIUS;
  const flowerStarGeometry = useMemo(() => getSurvivalLocalFlowerStarGeometry(7), []);
  const carpetGeometry = useMemo(
    () => carpetEnabled ? makeSurvivalLocalGrassCarpetGeometry(cell) : null,
    [cell, carpetEnabled],
  );
  const cellDensity = useMemo(() => {
    const centerWorldX = cell.x + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.5;
    const centerWorldZ = cell.z + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.5;
    const centerChunk = getSurvivalChunkInfoAtWorld(centerWorldX, centerWorldZ);
    const effectiveDensityDistance = Math.max(cell.densityDistance, cell.distance * 0.72);
    const nearFalloff = 1 - smoothstepRange(90, SURVIVAL_LOCAL_GRASS_GROUND_RADIUS + 90, effectiveDensityDistance);
    const nearDensity = 0.08 + nearFalloff * nearFalloff * 0.84;
    const grassBiome = getSurvivalChunkGrassSurfaceBiome(centerChunk);
    const meadowMask = getSurvivalRestoredMeadowMask(centerWorldX, centerWorldZ);
    const mountainMeadowBoost = centerChunk.villageKind === "mountain" ? 1.06 : 1;
    const grasslandBoost = grassBiome === "tallgrass"
      ? 1.14
      : grassBiome === "plains"
        ? 1.08
        : 1;
    return nearDensity * mountainMeadowBoost * lerpNumber(grasslandBoost, 1.2, meadowMask);
  }, [cell.densityDistance, cell.distance, cell.x, cell.z]);
  const solidGrassGeometry = useMemo(
    () => hasBladeDetail ? makeSurvivalLocalSolidGrassBladeGeometry(cell, cellDensity, bladeStreamScale, mobilePerformanceMode) : null,
    [cell, cellDensity, hasBladeDetail, mobilePerformanceMode, bladeStreamScale],
  );
  const localGrassMaterialColors = useMemo(() => {
    const sampleWorldX = cell.x + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.48;
    const sampleWorldZ = cell.z + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.52;
    const sampleChunk = getSurvivalChunkInfoAtWorld(sampleWorldX, sampleWorldZ);
    const sampleTerrainY = getSurvivalGrassSurfaceHeightForChunk(
      sampleChunk,
      sampleWorldX - sampleChunk.x,
      sampleWorldZ - sampleChunk.z,
    );
    const sampleBiome = getSurvivalGrassSurfaceBiome(sampleChunk.biome, sampleWorldX, sampleWorldZ, sampleTerrainY);
    const terrainColor = getSurvivalSmoothedTerrainColor(sampleWorldX, sampleWorldZ, sampleTerrainY);
    const grassColor = getSurvivalGrassBladeColor(sampleBiome, sampleWorldX, sampleWorldZ, sampleTerrainY, survivalHash01(cell.cellX, cell.cellZ, 19690));
    const meadowMask = getSurvivalRestoredMeadowMask(sampleWorldX, sampleWorldZ);
    const dryTerrain = sampleBiome === "desert" && terrainColor.g < terrainColor.r * 1.06;
    const meadowGreen = dryTerrain
      ? new THREE.Color("#a9a35a")
      : sampleBiome === "swamp"
        ? new THREE.Color("#789344")
        : sampleBiome === "jungle"
          ? new THREE.Color("#69b14f")
          : new THREE.Color(meadowMask > 0.28 ? "#92d84b" : "#6fb63d");
    const liftColor = sampleBiome === "desert"
      ? SURVIVAL_LOCAL_GRASS_DESERT_LIFT_COLOR
      : sampleBiome === "swamp"
        ? SURVIVAL_LOCAL_GRASS_SWAMP_LIFT_COLOR
        : SURVIVAL_LOCAL_GRASS_DEFAULT_LIFT_COLOR;
    const ground = terrainColor.clone().lerp(meadowGreen, dryTerrain ? 0.3 : lerpNumber(0.48, 0.62, meadowMask)).lerp(grassColor, 0.08).lerp(liftColor, dryTerrain ? 0.02 : 0.035);
    const short = meadowGreen.clone().lerp(grassColor, dryTerrain ? 0.24 : 0.16).lerp(liftColor, dryTerrain ? 0.05 : 0.07).multiplyScalar(dryTerrain ? 1 : lerpNumber(1.0, 1.08, meadowMask));
    const tall = meadowGreen.clone().lerp(grassColor, dryTerrain ? 0.22 : 0.18).lerp(liftColor, dryTerrain ? 0.04 : 0.06).multiplyScalar(dryTerrain ? 0.98 : lerpNumber(0.99, 1.06, meadowMask));
    clampDormantGrassColor(ground);
    clampDormantGrassColor(short);
    clampDormantGrassColor(tall);
    return {
      ground: `#${ground.getHexString()}`,
      short: `#${short.getHexString()}`,
      tall: `#${tall.getHexString()}`,
    };
  }, [cell.cellX, cell.cellZ, cell.x, cell.z]);

  const groundPatches = useMemo<SurvivalGroundGrassPatch[]>(() => {
    if (coverStreamScale <= 0 || cellDensity <= 0) return [];

    const groundCellDensity = cellDensity;

    const targetCount = Math.round((
      mobilePerformanceMode
        ? SURVIVAL_LOCAL_GRASS_GROUND_PATCHES_PER_CELL * 0.46
        : SURVIVAL_LOCAL_GRASS_GROUND_PATCHES_PER_CELL
    ) * SURVIVAL_LOCAL_GRASS_CELL_AREA_SCALE * coverStreamScale * groundCellDensity);
    const generated: SurvivalGroundGrassPatch[] = [];
    const gridSize = Math.max(2, Math.ceil(Math.sqrt(targetCount * 1.45)));
    const attempts = gridSize * gridSize;
    const sampleOffset = Math.floor(survivalHash01(cell.cellX, cell.cellZ, 18050) * attempts);

    for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
      const sampleIndex = (sampleOffset + index * 8191) % attempts;
      const col = sampleIndex % gridSize;
      const row = Math.floor(sampleIndex / gridSize);
      const jitterX = 0.12 + survivalHash01(cell.cellX + col, cell.cellZ + row, 18200 + index) * 0.76;
      const jitterZ = 0.12 + survivalHash01(cell.cellX - row, cell.cellZ + col, 18300 + index) * 0.76;
      const x = ((col + jitterX) / gridSize) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
      const z = ((row + jitterZ) / gridSize) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
      const worldX = cell.x + x;
      const worldZ = cell.z + z;
      const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
      const width = lerpNumber(11.6, 10.2, meadowMask) + survivalHash01(cell.cellX, cell.cellZ, 18700 + index) * lerpNumber(9.6, 8.2, meadowMask);
      const depth = lerpNumber(10.8, 9.6, meadowMask) + survivalHash01(cell.cellX, cell.cellZ, 18800 + index) * lerpNumber(8.8, 7.6, meadowMask);
      const placement = getSurvivalLocalGrassPlacement(worldX, worldZ, 0.02, 0.8, 0.58);
      if (!placement) continue;
      if (placement.biome === "desert" && survivalHash01(cell.cellX, cell.cellZ, 18400 + index) > 0.9) continue;

      const variant = survivalHash01(cell.cellX, cell.cellZ, 18500 + index);
      const terrainColor = getSurvivalSmoothedTerrainColor(worldX, worldZ, placement.terrainY);
      const grassColor = getSurvivalGrassBladeColor(placement.biome, worldX, worldZ, placement.terrainY, variant);
      const coverLift = placement.biome === "desert"
        ? SURVIVAL_LOCAL_GRASS_DESERT_LIFT_COLOR
        : placement.biome === "swamp"
          ? SURVIVAL_LOCAL_GRASS_SWAMP_LIFT_COLOR
          : SURVIVAL_LOCAL_GRASS_DEFAULT_LIFT_COLOR;
      const slopeTerrainBlend = (1 - clamp01((placement.normal.y - 0.58) / 0.32)) * 0.34;
      const color = terrainColor
        .clone()
        .lerp(grassColor, placement.biome === "desert" ? 0.28 : 0.58)
        .lerp(coverLift, placement.biome === "desert" ? 0.04 : 0.08)
        .lerp(terrainColor, slopeTerrainBlend);
      if (meadowMask > 0.04 && placement.biome !== "desert" && placement.biome !== "swamp") {
        const meadowPatchTone = new THREE.Color("#3f9c2e")
          .lerp(SURVIVAL_LOCAL_GRASS_MEADOW_LIFT_COLOR, 0.36 + variant * 0.46);
        meadowPatchTone.multiplyScalar(0.92 + variant * 0.2);
        color.copy(color.lerp(meadowPatchTone, meadowMask));
      }
      color.multiplyScalar(placement.biome === "desert" ? 1.0 : lerpNumber(1.03, 1.18, meadowMask));
      color.r = clamp01(color.r);
      color.g = clamp01(color.g);
      color.b = clamp01(color.b);
      generated.push({
        x,
        y: placement.terrainY + 0.11,
        z,
        normalX: placement.normal.x,
        normalY: placement.normal.y,
        normalZ: placement.normal.z,
        yaw: survivalHash01(cell.cellX, cell.cellZ, 18600 + index) * Math.PI * 2,
        width,
        depth,
        color,
      });
    }

    return generated;
  }, [cell.cellX, cell.cellZ, cell.x, cell.z, cellDensity, mobilePerformanceMode, coverStreamScale]);

  const shortBlades = useMemo<SurvivalLocalGrassBlade[]>(() => {
    if (!hasBladeDetail) return [];
    if (bladeStreamScale <= 0 || cellDensity <= 0) return [];

    const nearBladeDensity = cellDensity;

    const targetCount = Math.round((
      mobilePerformanceMode
        ? SURVIVAL_LOCAL_GRASS_SHORT_TUFTS_PER_CELL * 0.44
        : SURVIVAL_LOCAL_GRASS_SHORT_TUFTS_PER_CELL
    ) * SURVIVAL_LOCAL_GRASS_CELL_AREA_SCALE * bladeStreamScale * nearBladeDensity);
    const generated: SurvivalLocalGrassBlade[] = [];
    const gridSize = Math.max(2, Math.ceil(Math.sqrt(targetCount * 1.2)));
    const attempts = gridSize * gridSize;
    const sampleOffset = Math.floor(survivalHash01(cell.cellX, cell.cellZ, 17050) * attempts);

    for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
      const sampleIndex = (sampleOffset + index * 8191) % attempts;
      const col = sampleIndex % gridSize;
      const row = Math.floor(sampleIndex / gridSize);
      const jitterX = 0.08 + survivalHash01(cell.cellX + col, cell.cellZ - row, 17100 + index * 13) * 0.84;
      const jitterZ = 0.08 + survivalHash01(cell.cellX - row, cell.cellZ + col, 17200 + index * 17) * 0.84;
      const x = ((col + jitterX) / gridSize) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
      const z = ((row + jitterZ) / gridSize) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
      const worldX = cell.x + x;
      const worldZ = cell.z + z;
      const placement = getSurvivalLocalGrassPlacement(worldX, worldZ, 0.035, 0, 0.42);
      if (!placement) continue;

      const biome = placement.biome;
      if (biome === "desert" && survivalHash01(cell.cellX, cell.cellZ, 17300 + index) >= 0.97) continue;

      const shape = survivalHash01(cell.cellX, cell.cellZ, 17400 + index);
      const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
      const heightBase = biome === "tallgrass"
        ? lerpNumber(0.74, 0.98, meadowMask)
        : biome === "jungle"
          ? 0.92
        : biome === "swamp"
          ? 0.62
        : biome === "mushroom"
            ? 0.76
        : biome === "desert"
              ? 0.42
              : lerpNumber(0.62, 0.84, meadowMask);
      const heightRange = biome === "tallgrass"
        ? lerpNumber(0.14, 0.24, meadowMask)
        : biome === "jungle"
          ? 0.24
        : biome === "swamp"
          ? 0.14
        : biome === "mushroom"
            ? 0.16
        : biome === "desert"
              ? 0.1
              : lerpNumber(0.12, 0.2, meadowMask);
      const widthScale = biome === "tallgrass"
        ? lerpNumber(1.05, 1.28, meadowMask)
        : biome === "jungle"
          ? 0.96
        : biome === "desert"
          ? 0.56
            : lerpNumber(0.82, 1.04, meadowMask);
      const variant = survivalHash01(cell.cellX, cell.cellZ, 17500 + index);
      const color = getSurvivalIntegratedGrassBladeColor(
        biome,
        worldX,
        worldZ,
        placement.terrainY,
        variant,
        biome === "desert" ? 0.08 : 0.04,
      );
      const bladeLift = biome === "desert"
        ? SURVIVAL_LOCAL_GRASS_DESERT_LIFT_COLOR
        : biome === "swamp"
          ? SURVIVAL_LOCAL_GRASS_SWAMP_LIFT_COLOR
          : SURVIVAL_LOCAL_GRASS_DEFAULT_LIFT_COLOR;
      color.lerp(bladeLift, biome === "tallgrass" ? 0.1 : 0.08);
      if (meadowMask > 0.02 && biome !== "desert" && biome !== "swamp") {
        const bladeShade = survivalHash01(cell.cellX, cell.cellZ, 17750 + index);
        color.lerp(
          bladeShade < 0.38 ? SURVIVAL_LOCAL_GRASS_MEADOW_SHADOW_COLOR : SURVIVAL_LOCAL_GRASS_MEADOW_LIFT_COLOR,
          meadowMask * (bladeShade < 0.38 ? 0.08 : 0.3),
        );
      }
      color.multiplyScalar(biome === "desert" ? 1.02 : biome === "tallgrass" ? 1.2 : lerpNumber(1.08, 1.18, meadowMask));
      color.r = clamp01(color.r);
      color.g = clamp01(color.g);
      color.b = clamp01(color.b);

      generated.push({
        key: `${cell.key}-short-${index}`,
        x,
        y: placement.terrainY + 0.03,
        z,
        normalX: placement.normal.x,
        normalY: placement.normal.y,
        normalZ: placement.normal.z,
        yaw: survivalHash01(cell.cellX, cell.cellZ, 17600 + index) * Math.PI * 2,
        tilt: (survivalHash01(cell.cellX, cell.cellZ, 17700 + index) - 0.5) * (biome === "tallgrass" ? 0.34 : 0.28),
        width: (biome === "tallgrass" ? 0.72 + shape * 0.34 : 0.56 + shape * 0.22) * widthScale,
        height: (heightBase + shape * heightRange) * lerpNumber(0.97, 1.03, meadowMask),
        color,
      });
    }

    return generated;
  }, [cell.cellX, cell.cellZ, cell.key, cell.x, cell.z, cellDensity, hasBladeDetail, mobilePerformanceMode, bladeStreamScale]);

  const tallBlades = useMemo<SurvivalLocalGrassBlade[]>(() => {
    if (!hasBladeDetail) return [];
    if (bladeStreamScale <= 0 || cellDensity <= 0) return [];

    const nearMeadowDensity = cellDensity;

    const targetCount = Math.round((
      mobilePerformanceMode
        ? SURVIVAL_LOCAL_GRASS_TALL_TUFTS_PER_CELL * 0.42
        : SURVIVAL_LOCAL_GRASS_TALL_TUFTS_PER_CELL
    ) * SURVIVAL_LOCAL_GRASS_CELL_AREA_SCALE * bladeStreamScale * nearMeadowDensity);
    const generated: SurvivalLocalGrassBlade[] = [];
    const attempts = Math.max(1, targetCount * 4);

    for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
      const x = survivalHash01(cell.cellX, cell.cellZ, 16100 + index) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
      const z = survivalHash01(cell.cellX, cell.cellZ, 16200 + index) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
      const worldX = cell.x + x;
      const worldZ = cell.z + z;
      const placement = getSurvivalLocalGrassPlacement(worldX, worldZ, 0.06, 0.85, 0.72);
      if (!placement) continue;
      if (placement.biome === "desert" && survivalHash01(cell.cellX, cell.cellZ, 16250 + index) > 0.86) continue;

      const shape = survivalHash01(cell.cellX, cell.cellZ, 16300 + index);
      const variant = survivalHash01(cell.cellX, cell.cellZ, 16400 + index);
      const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
      const color = getSurvivalIntegratedGrassBladeColor(
        placement.biome,
        worldX,
        worldZ,
        placement.terrainY,
        variant,
        placement.biome === "desert" ? 0.1 : 0.08,
      );
      const bladeLift = placement.biome === "desert"
        ? SURVIVAL_LOCAL_GRASS_DESERT_LIFT_COLOR
        : placement.biome === "swamp"
          ? SURVIVAL_LOCAL_GRASS_SWAMP_LIFT_COLOR
          : SURVIVAL_LOCAL_GRASS_DEFAULT_LIFT_COLOR;
      color.lerp(bladeLift, placement.biome === "tallgrass" ? 0.14 : 0.1);
      if (meadowMask > 0.02 && placement.biome !== "desert" && placement.biome !== "swamp") {
        const bladeShade = survivalHash01(cell.cellX, cell.cellZ, 16450 + index);
        color.lerp(
          bladeShade < 0.42 ? SURVIVAL_LOCAL_GRASS_MEADOW_SHADOW_COLOR : SURVIVAL_LOCAL_GRASS_MEADOW_LIFT_COLOR,
          meadowMask * (bladeShade < 0.42 ? 0.16 : 0.18),
        );
      }
      color.multiplyScalar(placement.biome === "desert" ? 1.02 : placement.biome === "tallgrass" ? 1.12 : lerpNumber(1.04, 1.1, meadowMask));
      color.r = clamp01(color.r);
      color.g = clamp01(color.g);
      color.b = clamp01(color.b);

      const heightBase = placement.biome === "tallgrass"
        ? lerpNumber(0.86, 1.08, meadowMask)
        : placement.biome === "jungle"
          ? 1.06
        : placement.biome === "swamp"
            ? 0.76
            : placement.biome === "desert"
              ? 0.82
              : lerpNumber(0.82, 1.12, meadowMask);
      const heightRange = placement.biome === "tallgrass"
        ? lerpNumber(0.24, 0.36, meadowMask)
        : placement.biome === "jungle"
          ? 0.36
          : placement.biome === "swamp"
            ? 0.28
            : placement.biome === "desert"
              ? 0.36
              : lerpNumber(0.28, 0.44, meadowMask);
      const widthBase = placement.biome === "tallgrass" ? lerpNumber(0.18, 0.24, meadowMask) : placement.biome === "desert" ? 0.24 : lerpNumber(0.22, 0.28, meadowMask);
      const widthRange = placement.biome === "tallgrass" ? lerpNumber(0.22, 0.32, meadowMask) : placement.biome === "desert" ? 0.28 : lerpNumber(0.24, 0.34, meadowMask);

      generated.push({
        key: `${cell.key}-tall-${index}`,
        x,
        y: placement.terrainY + 0.03,
        z,
        normalX: placement.normal.x,
        normalY: placement.normal.y,
        normalZ: placement.normal.z,
        yaw: survivalHash01(cell.cellX, cell.cellZ, 16500 + index) * Math.PI * 2,
        tilt: (survivalHash01(cell.cellX, cell.cellZ, 16600 + index) - 0.5) * (placement.biome === "tallgrass" ? 0.56 : 0.42),
        width: widthBase + shape * widthRange,
        height: (heightBase + shape * heightRange) * lerpNumber(1.0, 1.08, meadowMask),
        color,
      });
    }

    return generated;
  }, [cell.cellX, cell.cellZ, cell.key, cell.x, cell.z, cellDensity, hasBladeDetail, mobilePerformanceMode, bladeStreamScale]);

  const localFlowers = useMemo<SurvivalWildflower[]>(() => {
    if (flowerStreamScale <= 0 || cellDensity <= 0) return [];

    const flowerDensity = Math.max(0.56, cellDensity);
    const targetCount = Math.round((
      mobilePerformanceMode
        ? SURVIVAL_LOCAL_GRASS_FLOWERS_PER_CELL * 0.22
        : SURVIVAL_LOCAL_GRASS_FLOWERS_PER_CELL
    ) * SURVIVAL_LOCAL_GRASS_CELL_AREA_SCALE * flowerStreamScale * flowerDensity);
    if (targetCount <= 0) return [];

    const generated: SurvivalWildflower[] = [];
    const gridSize = Math.max(2, Math.ceil(Math.sqrt(targetCount * 2.25)));
    const attempts = gridSize * gridSize;
    const sampleOffset = Math.floor(survivalHash01(cell.cellX, cell.cellZ, 23300) * attempts);

    for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
      const sampleIndex = (sampleOffset + index * 1543) % attempts;
      const col = sampleIndex % gridSize;
      const row = Math.floor(sampleIndex / gridSize);
      const jitterX = 0.1 + survivalHash01(cell.cellX + col, cell.cellZ + row, 23340 + index) * 0.8;
      const jitterZ = 0.1 + survivalHash01(cell.cellX - row, cell.cellZ + col, 23380 + index) * 0.8;
      const x = ((col + jitterX) / gridSize) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
      const z = ((row + jitterZ) / gridSize) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
      const worldX = cell.x + x;
      const worldZ = cell.z + z;
      const placement = getSurvivalLocalGrassPlacement(worldX, worldZ, 0.035, 0, 0.46);
      if (!placement) continue;

      const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
      const biome = meadowMask > 0.08 && placement.biome !== "desert" && placement.biome !== "swamp"
        ? "tallgrass"
        : placement.biome;
      if (biome === "desert" && survivalHash01(cell.cellX, cell.cellZ, 23420 + index) < 0.42) continue;
      if (biome === "swamp" && survivalHash01(cell.cellX, cell.cellZ, 23440 + index) < 0.18) continue;

      const variant = survivalHash01(cell.cellX, cell.cellZ, 23480 + index);
      const localMeadowPalette = biome === "tallgrass"
        ? ["#fff9a6", "#fef08a", "#ffd23f", "#fb7185", "#ff4fa3", "#f472b6", "#a78bfa", "#c4b5fd", "#f0abfc", "#ffffff", "#fb923c"]
        : biome === "swamp"
          ? ["#d9f99d", "#86efac", "#5eead4", "#c084fc", "#fde047"]
          : biome === "desert"
            ? ["#fff1a8", "#fb923c", "#f97316", "#fb7185", "#fde68a"]
            : SURVIVAL_FLOWER_COLORS[biome];
      const palette = localMeadowPalette;
      const clusterRoll = survivalHash01(cell.cellX, cell.cellZ, 23520 + index);
      const typeRoll = survivalHash01(cell.cellX, cell.cellZ, 23534 + index);
      const bloomType: NonNullable<SurvivalWildflower["bloomType"]> = typeRoll > 0.86
        ? "puff"
        : typeRoll > 0.62
          ? "star"
          : typeRoll > 0.5
            ? "bell"
            : "round";
      const heightBase = biome === "tallgrass"
        ? lerpNumber(0.56, 0.92, meadowMask)
        : biome === "desert"
          ? 0.42
        : biome === "swamp"
          ? 0.5
          : 0.56;
      const bloomBase = biome === "tallgrass"
        ? lerpNumber(0.3, 0.56, meadowMask)
        : biome === "mushroom"
          ? 0.46
          : 0.34;
      const bloomSize = (
        bloomBase +
        survivalHash01(cell.cellX, cell.cellZ, 23640 + index) * lerpNumber(0.08, 0.24, meadowMask)
      ) * (clusterRoll > 0.92 ? 1.18 : clusterRoll > 0.72 ? 1.08 : 1);
      const widthRoll = survivalHash01(cell.cellX, cell.cellZ, 23664 + index);
      const heightRoll = survivalHash01(cell.cellX, cell.cellZ, 23684 + index);

      generated.push({
        x,
        y: placement.terrainY + 0.055,
        z,
        normalX: placement.normal.x,
        normalY: placement.normal.y,
        normalZ: placement.normal.z,
        yaw: survivalHash01(cell.cellX, cell.cellZ, 23560 + index) * Math.PI * 2,
        stemHeight: heightBase + variant * lerpNumber(0.22, 0.42, meadowMask),
        stemRadius: 0.02 + survivalHash01(cell.cellX, cell.cellZ, 23600 + index) * 0.014,
        bloomSize,
        bloomType,
        bloomWidth: bloomSize * (
          bloomType === "bell" ? lerpNumber(0.44, 0.66, widthRoll)
            : bloomType === "star" ? lerpNumber(0.98, 1.34, widthRoll)
              : bloomType === "puff" ? lerpNumber(0.78, 1.08, widthRoll)
                : lerpNumber(0.9, 1.24, widthRoll)
        ),
        bloomHeight: bloomSize * (
          bloomType === "bell" ? lerpNumber(1.08, 1.42, heightRoll)
            : bloomType === "star" ? lerpNumber(0.88, 1.18, heightRoll)
              : bloomType === "puff" ? lerpNumber(0.76, 1.12, heightRoll)
                : lerpNumber(0.64, 0.98, heightRoll)
        ),
        centerSize: bloomSize * (
          bloomType === "round" ? 0.18
            : bloomType === "star" ? 0.16
              : bloomType === "bell" ? 0.08
                : 0.11
        ),
        centerColor: variant > 0.66 ? "#fff7ad" : variant > 0.38 ? "#facc15" : "#f59e0b",
        color: palette[Math.floor((variant + typeRoll * 0.23) * palette.length) % palette.length],
      });
    }

    return generated;
  }, [cell.cellX, cell.cellZ, cell.x, cell.z, cellDensity, mobilePerformanceMode, flowerStreamScale]);

  const flowerGroups = useMemo(() => splitSurvivalFlowersByBloomType(localFlowers), [localFlowers]);
  const starFlowers = flowerGroups.star;
  const roundFlowers = flowerGroups.round;
  const bellFlowers = flowerGroups.bell;
  const puffFlowers = flowerGroups.puff;

  const shortBladesPerTuft = SURVIVAL_LOCAL_GRASS_SHORT_BLADES_PER_TUFT;
  const lastMobileVisualUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime;
    if (
      mobilePerformanceMode &&
      elapsed - lastMobileVisualUpdateAtRef.current < MOBILE_SURVIVAL_GRASS_WIND_UPDATE_INTERVAL_SECONDS
    ) return;
    lastMobileVisualUpdateAtRef.current = elapsed;

    const cycle = getSurvivalDayNightCycle(
      getEffectiveSurvivalCycleElapsedSeconds(survivalTimeOverrideSeconds, elapsed),
    );
    const opacityScale = 0.78 + cycle.dayAmount * 0.22 + cycle.duskAmount * 0.04;
    grassLightTint
      .copy(grassNightTint)
      .lerp(grassDayTint, cycle.dayAmount)
      .lerp(grassDuskTint, cycle.duskAmount * 0.18);

    const tintMaterial = (mesh: THREE.InstancedMesh | THREE.Mesh | null, opacity: number) => {
      if (!mesh) return;
      const tintOneMaterial = (material: THREE.Material) => {
        if ("color" in material && material.color instanceof THREE.Color) {
          material.color.copy(grassLightTint);
        }
        if ("opacity" in material && typeof material.opacity === "number") {
          material.opacity = opacity * opacityScale;
        }
      };
      if (Array.isArray(mesh.material)) {
        for (let index = 0; index < mesh.material.length; index += 1) {
          tintOneMaterial(mesh.material[index]);
        }
      } else {
        tintOneMaterial(mesh.material);
      }
    };

    tintMaterial(carpetRef.current, SURVIVAL_LOCAL_GRASS_CARPET_OPACITY);
    tintMaterial(solidGrassRef.current, 0.96);
    tintMaterial(groundRef.current, SURVIVAL_LOCAL_GRASS_GROUND_PATCH_OPACITY);
    tintMaterial(shortGrassRef.current, 1);
    tintMaterial(tallGrassRef.current, 0.38);

    if (shortGrassUniformRef.current) {
      shortGrassUniformRef.current.value = elapsed;
    }
    if (solidGrassUniformRef.current) {
      solidGrassUniformRef.current.value = elapsed;
    }
    if (tallGrassUniformRef.current) {
      tallGrassUniformRef.current.value = elapsed;
    }
  });

  useEffect(() => {
    const mesh = groundRef.current;
    if (!mesh) return;

    ensureSurvivalInstancedMeshColors(mesh, groundPatches.length);
    for (let index = 0; index < groundPatches.length; index += 1) {
      const patch = groundPatches[index];
      normal.set(patch.normalX, patch.normalY, patch.normalZ).normalize();
      dummy.position.set(cell.x + patch.x, patch.y, cell.z + patch.z);
      dummy.quaternion.setFromUnitVectors(SURVIVAL_GROUND_GRASS_SOURCE_NORMAL, normal);
      dummy.rotateZ(patch.yaw);
      dummy.scale.set(patch.width, patch.depth, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, patch.color);
    }

    mesh.count = groundPatches.length;
    mesh.instanceMatrix.needsUpdate = true;
    finalizeSurvivalInstancedMeshColors(mesh);
    finalizeSurvivalInstancedMesh(
      mesh,
      cell.x + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.5,
      cell.z + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.5,
      SURVIVAL_LOCAL_GRASS_CELL_SIZE,
      32,
    );
  }, [cell.x, cell.z, dummy, groundPatches, normal]);

  useEffect(() => {
    const shortMesh = shortGrassRef.current;
    if (!shortMesh) return;

    ensureSurvivalInstancedMeshColors(shortMesh, shortBlades.length * shortBladesPerTuft);
    let shortInstance = 0;
    for (let bladeIndex = 0; bladeIndex < shortBlades.length; bladeIndex += 1) {
      const blade = shortBlades[bladeIndex];
      for (let tuftIndex = 0; tuftIndex < shortBladesPerTuft; tuftIndex += 1) {
        const scatterAngle = survivalHash01(cell.cellX + tuftIndex, cell.cellZ - tuftIndex, 17840 + bladeIndex) * Math.PI * 2;
        const yaw = blade.yaw + scatterAngle * 0.12 + tuftIndex * (Math.PI / shortBladesPerTuft) + (bladeIndex % 6) * 0.07;
        const spread = shortBladesPerTuft > 1
          ? survivalHash01(cell.cellX - tuftIndex, cell.cellZ + tuftIndex, 17860 + bladeIndex) * 0.48
          : 0;
        const heightJitter = 0.9 + survivalHash01(cell.cellX + tuftIndex, cell.cellZ - tuftIndex, 17800 + bladeIndex) * 0.24;
        const widthJitter = 0.92 + survivalHash01(cell.cellX - tuftIndex, cell.cellZ + tuftIndex, 17900 + bladeIndex) * 0.34;
        const bladeHeight = blade.height * heightJitter;
        normal.set(blade.normalX, blade.normalY, blade.normalZ).normalize();
        bladeBase.set(
          cell.x + blade.x + Math.sin(scatterAngle) * spread,
          blade.y,
          cell.z + blade.z + Math.cos(scatterAngle) * spread,
        );

        dummy.position.copy(bladeBase).addScaledVector(normal, bladeHeight * 0.5);
        dummy.quaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, normal);
        dummy.rotateY(yaw);
        dummy.rotateX(blade.tilt * 0.5);
        dummy.rotateZ(Math.sin(yaw + blade.tilt) * 0.18);
        dummy.scale.set(blade.width * widthJitter, bladeHeight, 1);
        dummy.updateMatrix();
        shortMesh.setMatrixAt(shortInstance, dummy.matrix);
        shortMesh.setColorAt(shortInstance, blade.color);
        shortInstance += 1;
      }
    }

    shortMesh.count = shortInstance;
    shortMesh.instanceMatrix.needsUpdate = true;
    finalizeSurvivalInstancedMeshColors(shortMesh);
    finalizeSurvivalInstancedMesh(
      shortMesh,
      cell.x + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.5,
      cell.z + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.5,
      SURVIVAL_LOCAL_GRASS_CELL_SIZE,
      24,
    );
  }, [bladeBase, cell.cellX, cell.cellZ, cell.x, cell.z, dummy, normal, shortBlades, shortBladesPerTuft]);

  useEffect(() => {
    const tallMesh = tallGrassRef.current;
    if (!tallMesh) return;

    ensureSurvivalInstancedMeshColors(tallMesh, tallBlades.length * SURVIVAL_WORLD_GRASS_BLADES_PER_TUFT);
    let instance = 0;
    for (let bladeIndex = 0; bladeIndex < tallBlades.length; bladeIndex += 1) {
      const blade = tallBlades[bladeIndex];
      for (let tuftIndex = 0; tuftIndex < SURVIVAL_WORLD_GRASS_BLADES_PER_TUFT; tuftIndex += 1) {
        const radial = (tuftIndex / SURVIVAL_WORLD_GRASS_BLADES_PER_TUFT) * Math.PI * 2;
        const yaw = blade.yaw + radial + (bladeIndex % 5) * 0.09;
        const spread = blade.width * (0.12 + tuftIndex * 0.06);
        const heightJitter = 0.76 + survivalHash01(cell.cellX + tuftIndex, cell.cellZ - tuftIndex, 16700 + bladeIndex) * 0.38;
        const widthJitter = 0.88 + survivalHash01(cell.cellX - tuftIndex, cell.cellZ + tuftIndex, 16800 + bladeIndex) * 0.48;
        const bladeHeight = blade.height * heightJitter;
        normal.set(blade.normalX, blade.normalY, blade.normalZ).normalize();
        bladeBase.set(
          cell.x + blade.x + Math.sin(yaw) * spread,
          blade.y,
          cell.z + blade.z + Math.cos(yaw) * spread,
        );

        dummy.position.copy(bladeBase).addScaledVector(normal, bladeHeight * 0.48);
        dummy.quaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, normal);
        dummy.rotateY(yaw);
        dummy.rotateX(blade.tilt * 0.32);
        dummy.rotateZ(Math.sin(yaw + blade.tilt) * 0.1);
        dummy.scale.set(blade.width * widthJitter, bladeHeight, 1);
        dummy.updateMatrix();
        tallMesh.setMatrixAt(instance, dummy.matrix);
        tallMesh.setColorAt(instance, blade.color);
        instance += 1;
      }
    }

    tallMesh.count = instance;
    tallMesh.instanceMatrix.needsUpdate = true;
    finalizeSurvivalInstancedMeshColors(tallMesh);
    finalizeSurvivalInstancedMesh(
      tallMesh,
      cell.x + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.5,
      cell.z + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.5,
      SURVIVAL_LOCAL_GRASS_CELL_SIZE,
      28,
    );
  }, [bladeBase, cell.cellX, cell.cellZ, cell.x, cell.z, dummy, normal, tallBlades]);

  useEffect(() => {
    const stemMesh = flowerStemRef.current;
    const starMesh = flowerStarBloomRef.current;
    const roundMesh = flowerRoundBloomRef.current;
    const bellMesh = flowerBellBloomRef.current;
    const puffMesh = flowerPuffBloomRef.current;
    const centerMesh = flowerCenterRef.current;
    if (!stemMesh || !starMesh || !roundMesh || !bellMesh || !puffMesh || !centerMesh) return;

    const flowerColor = new THREE.Color();
    const writeBloomInstances = (mesh: THREE.InstancedMesh, flowers: SurvivalWildflower[], type: NonNullable<SurvivalWildflower["bloomType"]>) => {
      ensureSurvivalInstancedMeshColors(mesh, flowers.length);
      for (let index = 0; index < flowers.length; index += 1) {
        const flower = flowers[index];
        normal.set(flower.normalX, flower.normalY, flower.normalZ).normalize();
        const bloomWidth = flower.bloomWidth ?? flower.bloomSize;
        const bloomHeight = flower.bloomHeight ?? flower.bloomSize;

        dummy.position
          .set(cell.x + flower.x, flower.y, cell.z + flower.z)
          .addScaledVector(normal, flower.stemHeight + Math.max(0.08, bloomHeight) * 0.32 + 0.2);
        dummy.quaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, normal);
        dummy.rotateY(flower.yaw);
        if (type === "star") {
          dummy.scale.set(bloomWidth, 1, bloomWidth);
        } else if (type === "bell") {
          dummy.scale.set(bloomWidth * 0.74, bloomHeight, bloomWidth * 0.74);
        } else {
          dummy.scale.set(bloomWidth, bloomHeight, bloomWidth);
        }
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        mesh.setColorAt(index, flowerColor.set(flower.color));
      }
      mesh.count = flowers.length;
      mesh.instanceMatrix.needsUpdate = true;
      finalizeSurvivalInstancedMeshColors(mesh);
      finalizeSurvivalInstancedMesh(
        mesh,
        cell.x + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.5,
        cell.z + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.5,
        SURVIVAL_LOCAL_GRASS_CELL_SIZE,
        18,
      );
    };

    ensureSurvivalInstancedMeshColors(centerMesh, localFlowers.length);
    for (let index = 0; index < localFlowers.length; index += 1) {
      const flower = localFlowers[index];
      normal.set(flower.normalX, flower.normalY, flower.normalZ).normalize();

      dummy.position
        .set(cell.x + flower.x, flower.y, cell.z + flower.z)
        .addScaledVector(normal, flower.stemHeight * 0.5);
      dummy.quaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, normal);
      dummy.rotateY(flower.yaw);
      dummy.scale.set(flower.stemRadius, flower.stemHeight, flower.stemRadius);
      dummy.updateMatrix();
      stemMesh.setMatrixAt(index, dummy.matrix);

      dummy.position
        .set(cell.x + flower.x, flower.y, cell.z + flower.z)
        .addScaledVector(normal, flower.stemHeight + Math.max(0.08, flower.bloomHeight ?? flower.bloomSize) * 0.34 + 0.2);
      dummy.quaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, normal);
      dummy.rotateY(flower.yaw);
      dummy.scale.setScalar(flower.centerSize ?? flower.bloomSize * 0.12);
      dummy.updateMatrix();
      centerMesh.setMatrixAt(index, dummy.matrix);
      centerMesh.setColorAt(index, flowerColor.set(flower.centerColor ?? "#facc15"));
    }

    stemMesh.count = localFlowers.length;
    centerMesh.count = localFlowers.length;
    stemMesh.instanceMatrix.needsUpdate = true;
    centerMesh.instanceMatrix.needsUpdate = true;
    writeBloomInstances(starMesh, starFlowers, "star");
    writeBloomInstances(roundMesh, roundFlowers, "round");
    writeBloomInstances(bellMesh, bellFlowers, "bell");
    writeBloomInstances(puffMesh, puffFlowers, "puff");
    finalizeSurvivalInstancedMeshColors(centerMesh);
    finalizeSurvivalInstancedMesh(
      stemMesh,
      cell.x + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.5,
      cell.z + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.5,
      SURVIVAL_LOCAL_GRASS_CELL_SIZE,
      18,
    );
    finalizeSurvivalInstancedMesh(
      centerMesh,
      cell.x + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.5,
      cell.z + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.5,
      SURVIVAL_LOCAL_GRASS_CELL_SIZE,
      18,
    );
  }, [bellFlowers, cell.x, cell.z, dummy, localFlowers, normal, puffFlowers, roundFlowers, starFlowers]);

  if (!solidGrassGeometry && groundPatches.length === 0 && shortBlades.length === 0 && tallBlades.length === 0 && localFlowers.length === 0) return null;

  const groundCapacity = Math.max(1, groundPatches.length);
  const shortCapacity = Math.max(1, shortBlades.length * shortBladesPerTuft);
  const tallCapacity = Math.max(1, tallBlades.length * SURVIVAL_WORLD_GRASS_BLADES_PER_TUFT);
  const flowerCapacity = Math.max(1, localFlowers.length);
  const starFlowerCapacity = Math.max(1, starFlowers.length);
  const roundFlowerCapacity = Math.max(1, roundFlowers.length);
  const bellFlowerCapacity = Math.max(1, bellFlowers.length);
  const puffFlowerCapacity = Math.max(1, puffFlowers.length);

  return (
    <group name={`survival-local-grass-cell-${cell.key}`} userData={HIDE_FROM_MINIMAP}>
      {carpetGeometry && (
        <mesh ref={carpetRef} geometry={carpetGeometry} renderOrder={2} frustumCulled={false}>
          <meshBasicMaterial
            map={meadowCarpetTexture}
            color="#ffffff"
            side={THREE.DoubleSide}
            transparent
            opacity={SURVIVAL_LOCAL_GRASS_CARPET_OPACITY}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
            toneMapped={false}
            onBeforeCompile={(shader) => {
              applySurvivalLocalGrassShader(shader, fadeUniforms);
            }}
          />
        </mesh>
      )}
      {groundPatches.length > 0 && (
        <instancedMesh ref={groundRef} args={[undefined, undefined, groundCapacity]} renderOrder={3} frustumCulled={false}>
          <primitive object={groundDiscGeometry} attach="geometry" />
          <meshBasicMaterial
            color={localGrassMaterialColors.ground}
            vertexColors
            side={THREE.DoubleSide}
            transparent
            opacity={SURVIVAL_LOCAL_GRASS_GROUND_PATCH_OPACITY}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
            toneMapped={false}
            onBeforeCompile={(shader) => {
              applySurvivalLocalGrassShader(shader, fadeUniforms);
            }}
          />
        </instancedMesh>
      )}
      {solidGrassGeometry && (
        <mesh ref={solidGrassRef} geometry={solidGrassGeometry} renderOrder={4} frustumCulled={false}>
          <meshBasicMaterial
            color="#ffffff"
            vertexColors
            side={THREE.DoubleSide}
            depthWrite
            toneMapped={false}
            onBeforeCompile={(shader) => {
              const timeUniform = { value: 0 };
              shader.uniforms.uTime = timeUniform;
              shader.vertexShader = `attribute float grassBladeWeight;\nuniform float uTime;\n${shader.vertexShader}`;
              applySurvivalLocalGrassShader(
                shader,
                fadeUniforms,
                `float survivalSolidWindSeed = position.x * 0.041 + position.z * 0.052;
              float survivalSolidWind = sin(uTime * 1.12 + survivalSolidWindSeed) + sin(uTime * 1.76 + survivalSolidWindSeed * 1.43) * 0.28;
              transformed.x += survivalSolidWind * grassBladeWeight * grassBladeWeight * 0.09;
              transformed.z += cos(uTime * 0.9 + survivalSolidWindSeed) * grassBladeWeight * 0.04;`,
              );
              solidGrassUniformRef.current = timeUniform;
            }}
          />
        </mesh>
      )}
      {shortBlades.length > 0 && (
        <instancedMesh ref={shortGrassRef} args={[undefined, undefined, shortCapacity]} renderOrder={4} frustumCulled={false}>
          <primitive object={shortBladePlaneGeometry} attach="geometry" />
          <meshBasicMaterial
            alphaMap={shortGrassPatchTexture}
            alphaTest={0.08}
            color="#ffffff"
            vertexColors
            side={THREE.DoubleSide}
            opacity={1}
            depthWrite
            toneMapped={false}
            onBeforeCompile={(shader) => {
              const timeUniform = { value: 0 };
              shader.uniforms.uTime = timeUniform;
              shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`;
              applySurvivalLocalGrassShader(
                shader,
                fadeUniforms,
                `float survivalShortBladeMask = smoothstep(-0.5, 0.5, position.y);
              float survivalShortWindSeed = position.x * 4.0;
              #ifdef USE_INSTANCING
                survivalShortWindSeed += instanceMatrix[3].x * 0.023 + instanceMatrix[3].z * 0.029;
              #endif
              float survivalShortWind = sin(uTime * 1.1 + survivalShortWindSeed) + sin(uTime * 1.8 + survivalShortWindSeed * 1.37) * 0.24;
              transformed.x += survivalShortWind * survivalShortBladeMask * survivalShortBladeMask * 0.085;
              transformed.z += cos(uTime * 0.92 + survivalShortWindSeed) * survivalShortBladeMask * 0.04;`,
              );
              shortGrassUniformRef.current = timeUniform;
            }}
          />
        </instancedMesh>
      )}
      {localFlowers.length > 0 && (
        <>
          <instancedMesh ref={flowerStemRef} args={[undefined, undefined, flowerCapacity]} renderOrder={4.2} frustumCulled>
            <cylinderGeometry args={[1, 1, 1, 4]} />
            <meshBasicMaterial
              color="#3f7d2e"
              transparent
              opacity={0.92}
              depthWrite={false}
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, fadeUniforms);
              }}
            />
          </instancedMesh>
          <instancedMesh ref={flowerStarBloomRef} args={[undefined, undefined, starFlowerCapacity]} renderOrder={4.35} frustumCulled>
            <primitive object={flowerStarGeometry} attach="geometry" />
            <meshBasicMaterial
              color="#ffffff"
              side={THREE.DoubleSide}
              transparent
              opacity={0.98}
              depthWrite={false}
              depthTest
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, fadeUniforms, "", 2, 12);
              }}
            />
          </instancedMesh>
          <instancedMesh ref={flowerRoundBloomRef} args={[undefined, undefined, roundFlowerCapacity]} renderOrder={4.35} frustumCulled>
            <octahedronGeometry args={[0.5, 0]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.98}
              depthWrite={false}
              depthTest
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, fadeUniforms, "", 2, 12);
              }}
            />
          </instancedMesh>
          <instancedMesh ref={flowerBellBloomRef} args={[undefined, undefined, bellFlowerCapacity]} renderOrder={4.35} frustumCulled>
            <coneGeometry args={[0.5, 1, 6]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.98}
              depthWrite={false}
              depthTest
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, fadeUniforms, "", 2, 12);
              }}
            />
          </instancedMesh>
          <instancedMesh ref={flowerPuffBloomRef} args={[undefined, undefined, puffFlowerCapacity]} renderOrder={4.35} frustumCulled>
            <sphereGeometry args={[0.5, 6, 5]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.96}
              depthWrite={false}
              depthTest
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, fadeUniforms, "", 2, 12);
              }}
            />
          </instancedMesh>
          <instancedMesh ref={flowerCenterRef} args={[undefined, undefined, flowerCapacity]} renderOrder={4.45} frustumCulled>
            <sphereGeometry args={[0.5, 5, 4]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.94}
              depthWrite={false}
              depthTest
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, fadeUniforms, "", 2, 12);
              }}
            />
          </instancedMesh>
        </>
      )}
      {tallBlades.length > 0 && (
        <instancedMesh ref={tallGrassRef} args={[undefined, undefined, tallCapacity]} renderOrder={5} frustumCulled={false}>
          <primitive object={tallBladePlaneGeometry} attach="geometry" />
          <meshBasicMaterial
            alphaMap={tallGrassAlphaTexture}
            alphaTest={0.1}
            color="#ffffff"
            vertexColors
            side={THREE.DoubleSide}
            transparent
            opacity={0.96}
            depthWrite={false}
            toneMapped={false}
            onBeforeCompile={(shader) => {
              const timeUniform = { value: 0 };
              shader.uniforms.uTime = timeUniform;
              shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`;
              applySurvivalLocalGrassShader(
                shader,
                fadeUniforms,
                `float survivalBladeMask = smoothstep(-0.5, 0.5, position.y);
              float survivalWindSeed = position.x * 5.0;
              #ifdef USE_INSTANCING
                survivalWindSeed += instanceMatrix[3].x * 0.027 + instanceMatrix[3].z * 0.031;
              #endif
              float survivalWind = sin(uTime * 1.34 + survivalWindSeed) + sin(uTime * 2.08 + survivalWindSeed * 1.53) * 0.34;
              transformed.x += survivalWind * survivalBladeMask * survivalBladeMask * 0.26;
              transformed.z += cos(uTime * 1.08 + survivalWindSeed) * survivalBladeMask * 0.08;`,
              );
              tallGrassUniformRef.current = timeUniform;
            }}
          />
        </instancedMesh>
      )}
    </group>
  );
}

function getInitialSurvivalTutorialGrassCenter() {
  const localPlayer = getBrowserLocalPlayerPosition();
  if (localPlayer) return localPlayer;

  const qaPlayer = getQaSurvivalUrlPlayerWorldPosition();
  if (qaPlayer) return qaPlayer;

  return { x: 0, y: 12, z: 0 };
}

function mergeSurvivalGrassGeometries(geometries: Array<THREE.BufferGeometry | null>, includeUv = false) {
  const entries: Array<{
    geometry: THREE.BufferGeometry;
    position: THREE.BufferAttribute;
    color: THREE.BufferAttribute;
    normal: THREE.BufferAttribute | null;
    bendWeight: THREE.BufferAttribute | null;
    uv: THREE.BufferAttribute | null;
    vertexOffset: number;
  }> = [];
  let vertexCount = 0;
  let indexCount = 0;
  let hasNormals = false;
  let hasBendWeights = false;

  for (let geometryIndex = 0; geometryIndex < geometries.length; geometryIndex += 1) {
    const geometry = geometries[geometryIndex];
    if (!geometry) continue;
    const positionAttribute = geometry.getAttribute("position");
    const colorAttribute = geometry.getAttribute("color");
    const normalAttribute = geometry.getAttribute("normal");
    const bendWeightAttribute = geometry.getAttribute("grassBendWeight");
    const uvAttribute = geometry.getAttribute("uv");
    if (!positionAttribute || !colorAttribute) continue;

    entries.push({
      geometry,
      position: positionAttribute as THREE.BufferAttribute,
      color: colorAttribute as THREE.BufferAttribute,
      normal: normalAttribute ? normalAttribute as THREE.BufferAttribute : null,
      bendWeight: bendWeightAttribute ? bendWeightAttribute as THREE.BufferAttribute : null,
      uv: includeUv && uvAttribute ? uvAttribute as THREE.BufferAttribute : null,
      vertexOffset: vertexCount,
    });
    hasNormals = hasNormals || Boolean(normalAttribute);
    hasBendWeights = hasBendWeights || Boolean(bendWeightAttribute);
    vertexCount += positionAttribute.count;
    indexCount += geometry.index?.count ?? positionAttribute.count;
  }

  if (vertexCount === 0 || indexCount === 0) return null;

  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const normals = hasNormals ? new Float32Array(vertexCount * 3) : null;
  const bendWeights = hasBendWeights ? new Float32Array(vertexCount) : null;
  const uvs = includeUv ? new Float32Array(vertexCount * 2) : null;
  const indices = new Uint32Array(indexCount);
  let indexOffset = 0;

  for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
    const entry = entries[entryIndex];
    positions.set(entry.position.array as ArrayLike<number>, entry.vertexOffset * 3);
    colors.set(entry.color.array as ArrayLike<number>, entry.vertexOffset * 3);
    if (normals) {
      if (entry.normal) {
        normals.set(entry.normal.array as ArrayLike<number>, entry.vertexOffset * 3);
      } else {
        for (let index = 0; index < entry.position.count; index += 1) {
          const offset = (entry.vertexOffset + index) * 3;
          normals[offset] = 0;
          normals[offset + 1] = 1;
          normals[offset + 2] = 0;
        }
      }
    }
    if (bendWeights) {
      if (entry.bendWeight) {
        bendWeights.set(entry.bendWeight.array as ArrayLike<number>, entry.vertexOffset);
      }
    }
    if (uvs && entry.uv) {
      uvs.set(entry.uv.array as ArrayLike<number>, entry.vertexOffset * 2);
    }

    if (entry.geometry.index) {
      const sourceIndex = entry.geometry.index.array as ArrayLike<number>;
      for (let index = 0; index < sourceIndex.length; index += 1) {
        indices[indexOffset + index] = sourceIndex[index] + entry.vertexOffset;
      }
      indexOffset += sourceIndex.length;
    } else {
      for (let index = 0; index < entry.position.count; index += 1) {
        indices[indexOffset + index] = entry.vertexOffset + index;
      }
      indexOffset += entry.position.count;
    }
  }

  const mergedGeometry = new THREE.BufferGeometry();
  mergedGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  mergedGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  if (normals) {
    mergedGeometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  }
  if (bendWeights) {
    mergedGeometry.setAttribute("grassBendWeight", new THREE.BufferAttribute(bendWeights, 1));
  }
  if (uvs) {
    mergedGeometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  }
  mergedGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
  mergedGeometry.computeBoundingSphere();
  return mergedGeometry;
}

const SURVIVAL_TUTORIAL_GRASS_CELL_GEOMETRY_CACHE_LIMIT = 900;
const survivalTutorialGrassBladeGeometryCache = new Map<string, THREE.BufferGeometry | null>();
const survivalTutorialGrassCarpetGeometryCache = new Map<string, THREE.BufferGeometry | null>();
const survivalTutorialGrassStrandGeometryCache = new Map<string, THREE.BufferGeometry | null>();
let cachedSurvivalTutorialGrassBladeTexture: THREE.CanvasTexture | null = null;

function trimSurvivalTutorialGrassGeometryCache(cache: Map<string, THREE.BufferGeometry | null>) {
  while (cache.size > SURVIVAL_TUTORIAL_GRASS_CELL_GEOMETRY_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) return;
    const geometry = cache.get(oldestKey);
    cache.delete(oldestKey);
    geometry?.dispose();
  }
}

function getCachedSurvivalTutorialGrassBladeGeometry(cell: SurvivalTutorialGrassCell) {
  const densityBand = Math.round(cell.densityDistance / 8);
  const cacheKey = `${cell.key}:${cell.lod}:tutorial-blades:${densityBand}`;
  if (survivalTutorialGrassBladeGeometryCache.has(cacheKey)) {
    return survivalTutorialGrassBladeGeometryCache.get(cacheKey) ?? null;
  }

  const geometry = makeSurvivalTutorialGrassBladeGeometry({
    ...cell,
    densityDistance: densityBand * 8,
  });
  survivalTutorialGrassBladeGeometryCache.set(cacheKey, geometry);
  trimSurvivalTutorialGrassGeometryCache(survivalTutorialGrassBladeGeometryCache);
  return geometry;
}

function getSurvivalTutorialGrassBladeTexture() {
  if (cachedSurvivalTutorialGrassBladeTexture) return cachedSurvivalTutorialGrassBladeTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.save();
    ctx.globalCompositeOperation = "copy";
    ctx.fillStyle = "rgba(255, 255, 255, 0)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.imageSmoothingEnabled = true;

    const drawBlade = (
      baseX: number,
      baseY: number,
      tipX: number,
      tipY: number,
      width: number,
      alpha: number,
    ) => {
      const midX = (baseX + tipX) * 0.5;
      const midY = (baseY + tipY) * 0.5;
      const curve = (tipX - baseX) * 0.22;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(baseX - width, baseY);
      ctx.quadraticCurveTo(midX - width * 0.5 - curve, midY, tipX, tipY);
      ctx.quadraticCurveTo(midX + width * 0.5 - curve * 0.35, midY + 4, baseX + width, baseY);
      ctx.closePath();
      ctx.fill();
    };

    drawBlade(31, 95, 34, 6, 4.2, 0.96);
    drawBlade(29, 95, 22, 24, 2.1, 0.5);
    drawBlade(35, 95, 43, 31, 1.8, 0.42);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  cachedSurvivalTutorialGrassBladeTexture = texture;
  return texture;
}

function getCachedSurvivalTutorialGrassCarpetGeometry(cell: SurvivalTutorialGrassCell) {
  const cacheKey = `${cell.key}:${cell.lod}:carpet`;
  if (survivalTutorialGrassCarpetGeometryCache.has(cacheKey)) {
    return survivalTutorialGrassCarpetGeometryCache.get(cacheKey) ?? null;
  }

  const geometry = makeSurvivalTutorialGrassCarpetGeometry(cell);
  survivalTutorialGrassCarpetGeometryCache.set(cacheKey, geometry);
  trimSurvivalTutorialGrassGeometryCache(survivalTutorialGrassCarpetGeometryCache);
  return geometry;
}

function getCachedSurvivalTutorialGrassStrandGeometry(cell: SurvivalTutorialGrassCell) {
  const densityBand = Math.round(cell.densityDistance / 8);
  const cacheKey = `${cell.key}:${cell.lod}:strand:${densityBand}`;
  if (survivalTutorialGrassStrandGeometryCache.has(cacheKey)) {
    return survivalTutorialGrassStrandGeometryCache.get(cacheKey) ?? null;
  }

  const geometry = makeSurvivalTutorialGrassStrandGeometry({
    ...cell,
    densityDistance: densityBand * 8,
  });
  survivalTutorialGrassStrandGeometryCache.set(cacheKey, geometry);
  trimSurvivalTutorialGrassGeometryCache(survivalTutorialGrassStrandGeometryCache);
  return geometry;
}

function makeSurvivalTutorialGrassBladeGeometry(cell: SurvivalTutorialGrassCell) {
  const cellMeadowMask = getSurvivalRestoredMeadowMask(
    cell.x + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
    cell.z + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
  );
  const distanceFade = 1 - smoothstepRange(
    SURVIVAL_TUTORIAL_GRASS_GROUND_RADIUS,
    SURVIVAL_TUTORIAL_GRASS_AIR_RADIUS + SURVIVAL_TUTORIAL_GRASS_EDGE_FADE,
    cell.densityDistance,
  );
  const nearDensity = 1 - smoothstepRange(30, SURVIVAL_TUTORIAL_GRASS_BLADE_DENSITY_DISTANCE, cell.densityDistance);
  const restoredDensityBoost = lerpNumber(
    1,
    cell.lod === "near" ? 1.34 : 1.68,
    smoothstepRange(0.06, 0.36, cellMeadowMask),
  );
  const targetCount = Math.round(
    (cell.lod === "near"
      ? SURVIVAL_TUTORIAL_GRASS_NEAR_BLADE_BASE_COUNT + SURVIVAL_TUTORIAL_GRASS_NEAR_BLADE_EXTRA_COUNT * nearDensity
      : SURVIVAL_TUTORIAL_GRASS_MID_BLADE_BASE_COUNT + SURVIVAL_TUTORIAL_GRASS_MID_BLADE_EXTRA_COUNT * distanceFade) *
      restoredDensityBoost,
  );
  if (targetCount <= 0) return null;

  const gridSize = Math.max(2, Math.ceil(Math.sqrt(targetCount * 1.18)));
  const attempts = gridSize * gridSize;
  const sampleOffset = Math.floor(survivalHash01(cell.cellX, cell.cellZ, 45200) * attempts);
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const bendWeights: number[] = [];
  const indices: number[] = [];
  const baseColor = new THREE.Color();
  const midColor = new THREE.Color();
  const tipColor = new THREE.Color();
  const meadowTop = new THREE.Color("#cdf76e");
  const meadowBody = new THREE.Color("#85dc4c");
  const meadowShadow = new THREE.Color("#68bc3e");
  let placed = 0;

  const pushVertex = (
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    color: THREE.Color,
    bendWeight: number,
    u: number,
    v: number,
  ) => {
    positions.push(x, y, z);
    normals.push(nx, ny, nz);
    colors.push(color.r, color.g, color.b);
    uvs.push(u, v);
    bendWeights.push(bendWeight);
  };

  for (let index = 0; index < attempts && placed < targetCount; index += 1) {
    const sampleIndex = (sampleOffset + index * 2029) % attempts;
    const col = sampleIndex % gridSize;
    const row = Math.floor(sampleIndex / gridSize);
    const jitterX = 0.08 + survivalHash01(cell.cellX + col, cell.cellZ - row, 45240 + index) * 0.84;
    const jitterZ = 0.08 + survivalHash01(cell.cellX - row, cell.cellZ + col, 45280 + index) * 0.84;
    const localX = ((col + jitterX) / gridSize) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
    const localZ = ((row + jitterZ) / gridSize) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
    const worldX = cell.x + localX;
    const worldZ = cell.z + localZ;
    const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
    const footprint = lerpNumber(cell.lod === "near" ? 0.08 : 0.22, 0.025, meadowMask);
    const placement = getSurvivalLocalGrassPlacement(worldX, worldZ, 0.02, footprint, lerpNumber(0.48, 0.32, meadowMask));
    if (!placement) continue;

    const terrainY = placement.terrainY;
    const biome = placement.biome;
    const variant = survivalHash01(cell.cellX, cell.cellZ, 45320 + index);
    const heightRoll = survivalHash01(cell.cellX, cell.cellZ, 45360 + index);
    const widthRoll = survivalHash01(cell.cellX, cell.cellZ, 45400 + index);
    const colorRoll = survivalHash01(cell.cellX, cell.cellZ, 45440 + index);
    const yaw = survivalHash01(cell.cellX, cell.cellZ, 45480 + index) * Math.PI * 2;
    const yaw2 = yaw + Math.PI * 0.5 + (survivalHash01(cell.cellX, cell.cellZ, 45520 + index) - 0.5) * 0.42;
    const normalX = placement.normal.x;
    const normalY = placement.normal.y;
    const normalZ = placement.normal.z;
    const litNormalX = normalX * (1 - SURVIVAL_TUTORIAL_GRASS_NORMAL_UP_BIAS);
    const litNormalY = normalY * (1 - SURVIVAL_TUTORIAL_GRASS_NORMAL_UP_BIAS) + SURVIVAL_TUTORIAL_GRASS_NORMAL_UP_BIAS;
    const litNormalZ = normalZ * (1 - SURVIVAL_TUTORIAL_GRASS_NORMAL_UP_BIAS);
    const litNormalLength = getDormantGrassVectorLength3D(litNormalX, litNormalY, litNormalZ) || 1;
    const nx = litNormalX / litNormalLength;
    const ny = litNormalY / litNormalLength;
    const nz = litNormalZ / litNormalLength;

    let sideX = Math.cos(yaw);
    let sideY = 0;
    let sideZ = Math.sin(yaw);
    let sideDot = sideX * normalX + sideY * normalY + sideZ * normalZ;
    sideX -= normalX * sideDot;
    sideY -= normalY * sideDot;
    sideZ -= normalZ * sideDot;
    let sideLength = getDormantGrassVectorLength3D(sideX, sideY, sideZ);
    if (sideLength < 0.001) {
      sideX = 1;
      sideY = 0;
      sideZ = 0;
      sideLength = 1;
    }
    sideX /= sideLength;
    sideY /= sideLength;
    sideZ /= sideLength;

    let bendX = Math.cos(yaw2);
    let bendY = 0;
    let bendZ = Math.sin(yaw2);
    const bendDot = bendX * normalX + bendY * normalY + bendZ * normalZ;
    bendX -= normalX * bendDot;
    bendY -= normalY * bendDot;
    bendZ -= normalZ * bendDot;
    const bendLength = getDormantGrassVectorLength3D(bendX, bendY, bendZ) || 1;
    bendX /= bendLength;
    bendY /= bendLength;
    bendZ /= bendLength;

    const meadowHeight = lerpNumber(0.95, 1.13, meadowMask);
    const height = (
      cell.lod === "near"
        ? lerpNumber(0.48, 0.86, heightRoll)
        : lerpNumber(0.44, 0.78, heightRoll)
    ) * meadowHeight;
    const halfWidth = (
      cell.lod === "near"
        ? lerpNumber(0.16, 0.34, widthRoll)
        : lerpNumber(0.18, 0.38, widthRoll)
    ) * lerpNumber(0.95, 1.12, meadowMask);
    const lean = height * lerpNumber(0.08, 0.26, survivalHash01(cell.cellX, cell.cellZ, 45560 + index));
    const baseY = terrainY + 0.028;
    const terrainTint = getSurvivalSmoothedTerrainColor(worldX, worldZ, terrainY);
    baseColor.copy(getSurvivalGrassBladeColor(biome, worldX, worldZ, terrainY, variant));
    if (biome !== "desert" && biome !== "swamp") {
      baseColor.lerp(meadowBody, 0.48 + meadowMask * 0.42);
      baseColor.lerp(meadowTop, colorRoll * meadowMask * 0.16);
    }
    baseColor.lerp(terrainTint, biome === "desert" ? 0.25 : 0.015);
    baseColor.multiplyScalar(1.06 + colorRoll * 0.16);
    midColor.copy(baseColor).lerp(meadowBody, 0.42 + meadowMask * 0.18);
    tipColor.copy(baseColor).lerp(meadowTop, 0.52 + meadowMask * 0.28);
    baseColor.lerp(meadowShadow, 0.035 + (1 - normalY) * 0.045);

    const pushGrassCard = (
      cardSideX: number,
      cardSideY: number,
      cardSideZ: number,
      widthScale: number,
      heightScale: number,
      colorOffset: number,
    ) => {
      const cardHalfWidth = halfWidth * widthScale;
      const cardTopHalfWidth = cardHalfWidth * 0.3;
      const cardTipX = worldX + bendX * lean * heightScale + normalX * height * 0.08 * heightScale;
      const cardTipY = baseY + normalY * height * heightScale + bendY * lean * heightScale;
      const cardTipZ = worldZ + bendZ * lean * heightScale + normalZ * height * 0.08 * heightScale;
      const cardMidColor = midColor.clone().lerp(tipColor, colorOffset);
      const vertexBase = positions.length / 3;

      pushVertex(
        worldX - cardSideX * cardHalfWidth,
        baseY - cardSideY * cardHalfWidth,
        worldZ - cardSideZ * cardHalfWidth,
        nx,
        ny,
        nz,
        baseColor,
        0,
        0,
        0,
      );
      pushVertex(
        worldX + cardSideX * cardHalfWidth,
        baseY + cardSideY * cardHalfWidth,
        worldZ + cardSideZ * cardHalfWidth,
        nx,
        ny,
        nz,
        baseColor,
        0,
        1,
        0,
      );
      pushVertex(
        cardTipX - cardSideX * cardTopHalfWidth,
        cardTipY - cardSideY * cardTopHalfWidth,
        cardTipZ - cardSideZ * cardTopHalfWidth,
        nx,
        ny,
        nz,
        cardMidColor,
        1,
        0,
        1,
      );
      pushVertex(
        cardTipX + cardSideX * cardTopHalfWidth,
        cardTipY + cardSideY * cardTopHalfWidth,
        cardTipZ + cardSideZ * cardTopHalfWidth,
        nx,
        ny,
        nz,
        tipColor,
        1,
        1,
        1,
      );
      indices.push(
        vertexBase,
        vertexBase + 2,
        vertexBase + 1,
        vertexBase + 1,
        vertexBase + 2,
        vertexBase + 3,
      );
    };

    pushGrassCard(sideX, sideY, sideZ, 1, 1, 0.18);
    if (
      (cell.lod === "near" && survivalHash01(cell.cellX, cell.cellZ, 45620 + index) > 0.58) ||
      survivalHash01(cell.cellX, cell.cellZ, 45660 + index) > 0.82
    ) {
      let crossSideX = bendX;
      let crossSideY = bendY;
      let crossSideZ = bendZ;
      const crossSideDot = crossSideX * normalX + crossSideY * normalY + crossSideZ * normalZ;
      crossSideX -= normalX * crossSideDot;
      crossSideY -= normalY * crossSideDot;
      crossSideZ -= normalZ * crossSideDot;
      const crossSideLength = getDormantGrassVectorLength3D(crossSideX, crossSideY, crossSideZ) || 1;
      crossSideX /= crossSideLength;
      crossSideY /= crossSideLength;
      crossSideZ /= crossSideLength;
      pushGrassCard(crossSideX, crossSideY, crossSideZ, 0.72, 0.9, 0.34);
    }
    placed += 1;
  }

  if (indices.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("grassBendWeight", new THREE.Float32BufferAttribute(bendWeights, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function makeSurvivalTutorialGrassCarpetGeometry(cell: SurvivalTutorialGrassCell) {
  const segments = cell.lod === "near" ? 14 : 7;
  const step = SURVIVAL_TUTORIAL_GRASS_CELL_SIZE / segments;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const color = new THREE.Color();
  const meadowDark = new THREE.Color("#5fbe38");
  const meadowLight = new THREE.Color("#a9e85c");

  const getSurfaceY = (worldX: number, worldZ: number) => {
    const chunk = getSurvivalChunkInfoAtWorld(worldX, worldZ);
    return getSurvivalGrassSurfaceHeightForChunk(chunk, worldX - chunk.x, worldZ - chunk.z) + 0.072;
  };

  const pushVertex = (worldX: number, worldZ: number, y: number, vertexColor: THREE.Color) => {
    const vertexIndex = positions.length / 3;
    positions.push(worldX, y, worldZ);
    colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
    uvs.push(worldX / 18, worldZ / 18);
    return vertexIndex;
  };

  for (let row = 0; row < segments; row += 1) {
    for (let col = 0; col < segments; col += 1) {
      const centerWorldX = cell.x + (col + 0.5) * step;
      const centerWorldZ = cell.z + (row + 0.5) * step;
      const placement = getSurvivalLocalGrassPlacement(centerWorldX, centerWorldZ, 0.025, Math.min(1.2, step * 0.12), 0.34);
      const meadowMask = getSurvivalRestoredMeadowMask(centerWorldX, centerWorldZ);
      if (!placement && meadowMask <= 0.18) continue;
      const terrainY = placement?.terrainY ?? getSurvivalGrassSurfaceHeightAtWorld(centerWorldX, centerWorldZ);
      const biome = placement?.biome ?? getSurvivalGrassSurfaceBiome(
        getSurvivalChunkInfoAtWorld(centerWorldX, centerWorldZ).biome,
        centerWorldX,
        centerWorldZ,
        terrainY,
      );
      const noise = (
        Math.sin(centerWorldX * 0.12 + centerWorldZ * 0.04) +
        Math.cos(centerWorldZ * 0.1 - centerWorldX * 0.06)
      ) * 0.5;
      const terrainColor = getSurvivalSmoothedTerrainColor(centerWorldX, centerWorldZ, terrainY);
      color.copy(meadowDark).lerp(meadowLight, 0.36 + smoothstepRange(-0.8, 1.0, noise) * 0.42);
      color.lerp(terrainColor, biome === "desert" ? 0.4 : 0.12 * (1 - meadowMask));
      color.multiplyScalar(biome === "desert" ? 0.92 : 1.06);
      color.r = clamp01(color.r);
      color.g = clamp01(color.g);
      color.b = clamp01(color.b);

      const x0 = cell.x + col * step;
      const z0 = cell.z + row * step;
      const x1 = x0 + step;
      const z1 = z0 + step;
      const y00 = getSurfaceY(x0, z0);
      const y10 = getSurfaceY(x1, z0);
      const y01 = getSurfaceY(x0, z1);
      const y11 = getSurfaceY(x1, z1);

      const a = pushVertex(x0, z0, y00, color);
      const b = pushVertex(x1, z0, y10, color);
      const c = pushVertex(x0, z1, y01, color);
      const d = pushVertex(x1, z1, y11, color);
      indices.push(a, c, b, b, c, d);
    }
  }

  if (indices.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function makeSurvivalTutorialGrassStrandGeometry(cell: SurvivalTutorialGrassCell) {
  const cellMeadowMask = getSurvivalRestoredMeadowMask(
    cell.x + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
    cell.z + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
  );
  const meadowBoost = smoothstepRange(0.05, 0.36, cellMeadowMask);
  const effectiveDensityDistance = cell.densityDistance * lerpNumber(1, 0.7, meadowBoost);
  const strandDensity = cell.lod === "near"
    ? 1 - smoothstepRange(20, SURVIVAL_TUTORIAL_GRASS_STRAND_DISTANCE, effectiveDensityDistance)
    : 1 - smoothstepRange(118, SURVIVAL_TUTORIAL_GRASS_MID_STRAND_DISTANCE, effectiveDensityDistance);
  if (strandDensity <= 0) return null;
  const targetCount = Math.round(
    (cell.lod === "near"
      ? lerpNumber(520, 1360, strandDensity)
      : lerpNumber(160, 640, strandDensity)) *
    lerpNumber(1, 1.18, meadowBoost),
  );
  const gridSize = Math.max(2, Math.ceil(Math.sqrt(targetCount * 1.04)));
  const attempts = gridSize * gridSize;
  const sampleOffset = Math.floor(survivalHash01(cell.cellX, cell.cellZ, 36520) * attempts);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const baseColor = new THREE.Color();
  const midColor = new THREE.Color();
  const tipColor = new THREE.Color();
  const meadowBase = new THREE.Color("#479c31");
  const meadowTip = new THREE.Color("#84cf42");
  const shadowTip = new THREE.Color("#56aa34");

  for (let index = 0; index < attempts && indices.length / 9 < targetCount; index += 1) {
    const sampleIndex = (sampleOffset + index * 2039) % attempts;
    const col = sampleIndex % gridSize;
    const row = Math.floor(sampleIndex / gridSize);
    const jitterX = 0.08 + survivalHash01(cell.cellX + col, cell.cellZ - row, 36560 + index) * 0.84;
    const jitterZ = 0.08 + survivalHash01(cell.cellX - row, cell.cellZ + col, 36600 + index) * 0.84;
    const x = ((col + jitterX) / gridSize) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
    const z = ((row + jitterZ) / gridSize) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
    const worldX = cell.x + x;
    const worldZ = cell.z + z;
    const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
    const placement = getSurvivalLocalGrassPlacement(
      worldX,
      worldZ,
      0.018,
      lerpNumber(cell.lod === "near" ? 0.12 : 0.2, 0.024, meadowMask),
      lerpNumber(0.5, 0.32, meadowMask),
    );
    if (!placement) continue;

    const terrainY = placement.terrainY;
    const biome = placement.biome;
    const variant = survivalHash01(cell.cellX, cell.cellZ, 36640 + index);
    const height = (
      cell.lod === "near"
        ? lerpNumber(0.34, 0.68, survivalHash01(cell.cellX, cell.cellZ, 36680 + index))
        : lerpNumber(0.32, 0.58, survivalHash01(cell.cellX, cell.cellZ, 36680 + index))
    ) *
      lerpNumber(0.94, 1.08, meadowMask);
    const leanAngle = survivalHash01(cell.cellX, cell.cellZ, 36720 + index) * Math.PI * 2;
    const lean = lerpNumber(0.06, 0.26, survivalHash01(cell.cellX, cell.cellZ, 36760 + index));
    const baseY = terrainY + 0.05;
    const tipX = worldX + Math.cos(leanAngle) * lean;
    const tipZ = worldZ + Math.sin(leanAngle) * lean;
    const tipY = baseY + height;
    const sideX = Math.cos(leanAngle + Math.PI * 0.5);
    const sideZ = Math.sin(leanAngle + Math.PI * 0.5);
    const width = cell.lod === "near"
      ? lerpNumber(0.025, 0.075, survivalHash01(cell.cellX, cell.cellZ, 36780 + index))
      : lerpNumber(0.024, 0.058, survivalHash01(cell.cellX, cell.cellZ, 36780 + index));
    const midX = lerpNumber(worldX, tipX, 0.58) + sideX * (survivalHash01(cell.cellX, cell.cellZ, 36790 + index) - 0.5) * 0.058;
    const midY = lerpNumber(baseY, tipY, 0.62);
    const midZ = lerpNumber(worldZ, tipZ, 0.58) + sideZ * (survivalHash01(cell.cellX, cell.cellZ, 36795 + index) - 0.5) * 0.058;
    const shade = survivalHash01(cell.cellX, cell.cellZ, 36800 + index);

    baseColor.copy(getSurvivalGrassBladeColor(biome, worldX, worldZ, terrainY, variant));
    if (biome !== "desert" && biome !== "swamp") {
      baseColor.lerp(meadowBase, 0.5 + meadowMask * 0.32);
    }
    tipColor.copy(shade > 0.58 ? meadowTip : shadowTip);
    tipColor.lerp(baseColor, shade > 0.58 ? 0.52 : 0.64);
    midColor.copy(baseColor).lerp(tipColor, 0.46);

    const vertexBase = positions.length / 3;
    positions.push(
      worldX - sideX * width, baseY, worldZ - sideZ * width,
      worldX + sideX * width, baseY, worldZ + sideZ * width,
      midX - sideX * width * 0.42, midY, midZ - sideZ * width * 0.42,
      midX + sideX * width * 0.42, midY, midZ + sideZ * width * 0.42,
      tipX, tipY, tipZ,
    );
    colors.push(
      baseColor.r * 0.84,
      baseColor.g * 0.84,
      baseColor.b * 0.84,
      baseColor.r * 0.84,
      baseColor.g * 0.84,
      baseColor.b * 0.84,
      midColor.r,
      midColor.g,
      midColor.b,
      midColor.r,
      midColor.g,
      midColor.b,
      tipColor.r,
      tipColor.g,
      tipColor.b,
    );
    indices.push(
      vertexBase, vertexBase + 2, vertexBase + 1,
      vertexBase + 1, vertexBase + 2, vertexBase + 3,
      vertexBase + 2, vertexBase + 4, vertexBase + 3,
    );
  }

  if (indices.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function makeSurvivalTutorialGrassTuftInstances(cell: SurvivalTutorialGrassCell): SurvivalTutorialGrassTuftInstance[] {
  const distanceFade = 1 - smoothstepRange(
    SURVIVAL_TUTORIAL_GRASS_GROUND_RADIUS,
    SURVIVAL_TUTORIAL_GRASS_AIR_RADIUS + SURVIVAL_TUTORIAL_GRASS_EDGE_FADE,
    cell.densityDistance,
  );
  const nearBoost = 1 - smoothstepRange(90, 205, cell.densityDistance);
  const targetCount = Math.round(
    (cell.lod === "near" ? 168 : 78) *
    (0.42 + distanceFade * 0.86 + nearBoost * 0.42),
  );
  if (targetCount <= 0) return [];

  const generated: SurvivalTutorialGrassTuftInstance[] = [];
  const gridSize = Math.max(2, Math.ceil(Math.sqrt(targetCount * 1.55)));
  const attempts = gridSize * gridSize;
  const sampleOffset = Math.floor(survivalHash01(cell.cellX, cell.cellZ, 36200) * attempts);

  for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
    const sampleIndex = (sampleOffset + index * 1543) % attempts;
    const col = sampleIndex % gridSize;
    const row = Math.floor(sampleIndex / gridSize);
    const jitterX = 0.12 + survivalHash01(cell.cellX + col, cell.cellZ - row, 36240 + index) * 0.76;
    const jitterZ = 0.12 + survivalHash01(cell.cellX - row, cell.cellZ + col, 36280 + index) * 0.76;
    const x = ((col + jitterX) / gridSize) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
    const z = ((row + jitterZ) / gridSize) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
    const worldX = cell.x + x;
    const worldZ = cell.z + z;
    const placement = getSurvivalLocalGrassPlacement(worldX, worldZ, 0.035, cell.lod === "near" ? 0.2 : 0.36, 0.44);
    if (!placement) continue;

    const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
    const variant = survivalHash01(cell.cellX, cell.cellZ, 36320 + index);
    const color = getSurvivalGrassBladeColor(placement.biome, worldX, worldZ, placement.terrainY, variant);
    if (placement.biome !== "desert" && placement.biome !== "swamp") {
      const meadowTone = new THREE.Color("#5ab93a").lerp(new THREE.Color("#b9ec5a"), survivalHash01(cell.cellX, cell.cellZ, 36360 + index));
      color.lerp(meadowTone, 0.24 + meadowMask * 0.54);
    }
    color.multiplyScalar(placement.biome === "desert" ? 0.95 : lerpNumber(1.05, 1.18, meadowMask));
    color.r = clamp01(color.r);
    color.g = clamp01(color.g);
    color.b = clamp01(color.b);

    const shape = survivalHash01(cell.cellX, cell.cellZ, 36400 + index);
    const height = (cell.lod === "near"
      ? lerpNumber(0.52, 0.94, shape)
      : lerpNumber(0.36, 0.72, shape)) * lerpNumber(0.92, 1.08, meadowMask);
    const width = (cell.lod === "near"
      ? lerpNumber(0.7, 1.28, survivalHash01(cell.cellX, cell.cellZ, 36440 + index))
      : lerpNumber(1.05, 2.05, survivalHash01(cell.cellX, cell.cellZ, 36440 + index))) * lerpNumber(0.9, 1.04, meadowMask);

    generated.push({
      x,
      y: placement.terrainY + 0.035,
      z,
      worldX,
      worldZ,
      normalX: placement.normal.x,
      normalY: placement.normal.y,
      normalZ: placement.normal.z,
      yaw: survivalHash01(cell.cellX, cell.cellZ, 36480 + index) * Math.PI * 2,
      width,
      height,
      color,
    });
  }

  return generated;
}

function makeSurvivalTutorialGrassFlowerInstances(
  cell: SurvivalTutorialGrassCell,
  mobilePerformanceMode: boolean,
): SurvivalTutorialGrassFlowerInstance[] {
  const flowerDensity = 1 - smoothstepRange(30, 132, cell.densityDistance);
  if (flowerDensity <= 0) return [];
  const targetCount = Math.round((
    cell.lod === "near"
      ? lerpNumber(7, 27, flowerDensity)
      : 0
  ) * (mobilePerformanceMode ? 0.42 : 1));
  if (targetCount <= 0) return [];

  const generated: SurvivalTutorialGrassFlowerInstance[] = [];
  const gridSize = Math.max(2, Math.ceil(Math.sqrt(targetCount * 2.15)));
  const attempts = gridSize * gridSize;
  const sampleOffset = Math.floor(survivalHash01(cell.cellX, cell.cellZ, 23300) * attempts);

  for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
    const sampleIndex = (sampleOffset + index * 1543) % attempts;
    const col = sampleIndex % gridSize;
    const row = Math.floor(sampleIndex / gridSize);
    const jitterX = 0.1 + survivalHash01(cell.cellX + col, cell.cellZ + row, 23340 + index) * 0.8;
    const jitterZ = 0.1 + survivalHash01(cell.cellX - row, cell.cellZ + col, 23380 + index) * 0.8;
    const x = ((col + jitterX) / gridSize) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
    const z = ((row + jitterZ) / gridSize) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
    const worldX = cell.x + x;
    const worldZ = cell.z + z;
    const placement = getSurvivalLocalGrassPlacement(worldX, worldZ, 0.035, 0, 0.46);
    if (!placement) continue;

    const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
    const biome = meadowMask > 0.08 && placement.biome !== "desert" && placement.biome !== "swamp"
      ? "tallgrass"
      : placement.biome;
    if (biome === "desert" && survivalHash01(cell.cellX, cell.cellZ, 23420 + index) < 0.42) continue;
    if (biome === "swamp" && survivalHash01(cell.cellX, cell.cellZ, 23440 + index) < 0.18) continue;

    const variant = survivalHash01(cell.cellX, cell.cellZ, 23480 + index);
    const palette = biome === "tallgrass"
      ? ["#fff9a6", "#fef08a", "#ffd23f", "#fb7185", "#ff4fa3", "#f472b6", "#a78bfa", "#c4b5fd", "#f0abfc", "#ffffff", "#fb923c"]
      : biome === "swamp"
        ? ["#d9f99d", "#86efac", "#5eead4", "#c084fc", "#fde047"]
        : biome === "desert"
          ? ["#fff1a8", "#fb923c", "#f97316", "#fb7185", "#fde68a"]
          : SURVIVAL_FLOWER_COLORS[biome];
    const clusterRoll = survivalHash01(cell.cellX, cell.cellZ, 23520 + index);
    const typeRoll = survivalHash01(cell.cellX, cell.cellZ, 23534 + index);
    const bloomType: NonNullable<SurvivalWildflower["bloomType"]> = typeRoll > 0.86
      ? "puff"
      : typeRoll > 0.62
        ? "star"
        : typeRoll > 0.5
          ? "bell"
          : "round";
    const heightBase = biome === "tallgrass"
      ? lerpNumber(0.86, 1.28, meadowMask)
      : biome === "desert"
        ? 0.56
        : biome === "swamp"
          ? 0.72
          : 0.76;
    const bloomBase = biome === "tallgrass"
      ? lerpNumber(0.24, 0.42, meadowMask)
      : biome === "mushroom"
        ? 0.38
        : 0.3;
    const bloomSize = (
      bloomBase +
      survivalHash01(cell.cellX, cell.cellZ, 23640 + index) * lerpNumber(0.05, 0.13, meadowMask)
    ) * (clusterRoll > 0.92 ? 1.08 : clusterRoll > 0.72 ? 1.03 : 1);
    const widthRoll = survivalHash01(cell.cellX, cell.cellZ, 23664 + index);
    const heightRoll = survivalHash01(cell.cellX, cell.cellZ, 23684 + index);

    generated.push({
      x,
      y: placement.terrainY + 0.055,
      z,
      worldX,
      worldZ,
      normalX: placement.normal.x,
      normalY: placement.normal.y,
      normalZ: placement.normal.z,
      yaw: survivalHash01(cell.cellX, cell.cellZ, 23560 + index) * Math.PI * 2,
      stemHeight: heightBase + variant * lerpNumber(0.14, 0.28, meadowMask),
      stemRadius: 0.02 + survivalHash01(cell.cellX, cell.cellZ, 23600 + index) * 0.014,
      bloomSize,
      bloomType,
      bloomWidth: bloomSize * (
        bloomType === "bell" ? lerpNumber(0.34, 0.5, widthRoll)
          : bloomType === "star" ? lerpNumber(0.72, 1.02, widthRoll)
            : bloomType === "puff" ? lerpNumber(0.48, 0.72, widthRoll)
              : lerpNumber(0.58, 0.84, widthRoll)
      ),
      bloomHeight: bloomSize * (
        bloomType === "bell" ? lerpNumber(0.84, 1.1, heightRoll)
          : bloomType === "star" ? lerpNumber(0.62, 0.84, heightRoll)
            : bloomType === "puff" ? lerpNumber(0.5, 0.72, heightRoll)
              : lerpNumber(0.45, 0.68, heightRoll)
      ),
      centerSize: bloomSize * (
        bloomType === "round" ? 0.12
          : bloomType === "star" ? 0.11
            : bloomType === "bell" ? 0.06
              : 0.08
      ),
      centerColor: variant > 0.66 ? "#fff7ad" : variant > 0.38 ? "#facc15" : "#f59e0b",
      color: palette[Math.floor((variant + typeRoll * 0.23) * palette.length) % palette.length],
    });
  }

  return generated;
}

const SURVIVAL_TUTORIAL_GRASS_INSTANCE_CACHE_LIMIT = 900;
const survivalTutorialGrassTuftInstanceCache = new Map<string, SurvivalTutorialGrassTuftInstance[]>();
const survivalTutorialGrassFlowerInstanceCache = new Map<string, SurvivalTutorialGrassFlowerInstance[]>();

function trimSurvivalTutorialGrassInstanceCache<T>(cache: Map<string, T[]>) {
  while (cache.size > SURVIVAL_TUTORIAL_GRASS_INSTANCE_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) return;
    cache.delete(oldestKey);
  }
}

function getCachedSurvivalTutorialGrassTuftInstances(cell: SurvivalTutorialGrassCell) {
  const densityBand = Math.round(cell.densityDistance / 8);
  const cacheKey = `${cell.key}:${cell.lod}:tufts:${densityBand}`;
  const cached = survivalTutorialGrassTuftInstanceCache.get(cacheKey);
  if (cached) return cached;

  const instances = makeSurvivalTutorialGrassTuftInstances({
    ...cell,
    densityDistance: densityBand * 8,
  });
  survivalTutorialGrassTuftInstanceCache.set(cacheKey, instances);
  trimSurvivalTutorialGrassInstanceCache(survivalTutorialGrassTuftInstanceCache);
  return instances;
}

function getCachedSurvivalTutorialGrassFlowerInstances(
  cell: SurvivalTutorialGrassCell,
  mobilePerformanceMode: boolean,
) {
  const densityBand = Math.round(cell.densityDistance / 8);
  const cacheKey = `${cell.key}:${cell.lod}:flowers:${densityBand}:${mobilePerformanceMode ? "m" : "d"}`;
  const cached = survivalTutorialGrassFlowerInstanceCache.get(cacheKey);
  if (cached) return cached;

  const instances = makeSurvivalTutorialGrassFlowerInstances({
    ...cell,
    densityDistance: densityBand * 8,
  }, mobilePerformanceMode);
  survivalTutorialGrassFlowerInstanceCache.set(cacheKey, instances);
  trimSurvivalTutorialGrassInstanceCache(survivalTutorialGrassFlowerInstanceCache);
  return instances;
}

function getSurvivalTutorialGrassBatchBladeGeometries(cells: SurvivalTutorialGrassCell[]) {
  const geometries = new Array<THREE.BufferGeometry | null>(cells.length);
  for (let index = 0; index < cells.length; index += 1) {
    geometries[index] = getCachedSurvivalTutorialGrassBladeGeometry(cells[index]);
  }
  return geometries;
}

function getSurvivalTutorialGrassBatchFlowerInstances(
  cells: SurvivalTutorialGrassCell[],
  mobilePerformanceMode: boolean,
) {
  const flowers: SurvivalTutorialGrassFlowerInstance[] = [];
  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    const cellFlowers = getCachedSurvivalTutorialGrassFlowerInstances(cells[cellIndex], mobilePerformanceMode);
    for (let flowerIndex = 0; flowerIndex < cellFlowers.length; flowerIndex += 1) {
      flowers.push(cellFlowers[flowerIndex]);
    }
  }
  return flowers;
}

function SurvivalTutorialGrassBatchTile({
  batch,
  fadeUniforms,
  windUniform,
}: {
  batch: SurvivalTutorialGrassCellBatch;
  fadeUniforms: SurvivalLocalGrassFadeUniforms;
  windUniform: { value: number };
}) {
  const flowerStemRef = useRef<THREE.InstancedMesh>(null);
  const flowerStarBloomRef = useRef<THREE.InstancedMesh>(null);
  const flowerRoundBloomRef = useRef<THREE.InstancedMesh>(null);
  const flowerBellBloomRef = useRef<THREE.InstancedMesh>(null);
  const flowerPuffBloomRef = useRef<THREE.InstancedMesh>(null);
  const flowerCenterRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const normal = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const bladeTexture = useMemo(() => getSurvivalTutorialGrassBladeTexture(), []);
  const flowerStarGeometry = useMemo(() => getSurvivalLocalFlowerStarGeometry(7), []);
  const batchSignature = batch.signature;
  const batchBounds = useMemo(() => {
    if (batch.cells.length === 0) return { x: 0, z: 0, radius: 1 };
    let minX = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxZ = -Infinity;
    for (let index = 0; index < batch.cells.length; index += 1) {
      const cell = batch.cells[index];
      minX = Math.min(minX, cell.x);
      minZ = Math.min(minZ, cell.z);
      maxX = Math.max(maxX, cell.x + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE);
      maxZ = Math.max(maxZ, cell.z + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE);
    }
    const x = (minX + maxX) * 0.5;
    const z = (minZ + maxZ) * 0.5;
    return {
      x,
      z,
      radius: getDormantGrassVectorLength2D(maxX - minX, maxZ - minZ) * 0.62 + 18,
    };
  }, [batchSignature]);
  const bladeGeometry = useMemo(
    () => mergeSurvivalGrassGeometries(getSurvivalTutorialGrassBatchBladeGeometries(batch.cells), true),
    [batchSignature],
  );
  const underpaintGeometry = null;
  const localFlowers = useMemo<SurvivalTutorialGrassFlowerInstance[]>(
    () => getSurvivalTutorialGrassBatchFlowerInstances(batch.cells, mobilePerformanceMode),
    [batchSignature, mobilePerformanceMode],
  );
  const flowerGroups = useMemo(() => splitSurvivalFlowersByBloomType(localFlowers), [localFlowers]);
  const starFlowers = flowerGroups.star;
  const roundFlowers = flowerGroups.round;
  const bellFlowers = flowerGroups.bell;
  const puffFlowers = flowerGroups.puff;

  useEffect(() => {
    const stemMesh = flowerStemRef.current;
    const starMesh = flowerStarBloomRef.current;
    const roundMesh = flowerRoundBloomRef.current;
    const bellMesh = flowerBellBloomRef.current;
    const puffMesh = flowerPuffBloomRef.current;
    const centerMesh = flowerCenterRef.current;
    if (!stemMesh || !starMesh || !roundMesh || !bellMesh || !puffMesh || !centerMesh) return;

    const flowerColor = new THREE.Color();
    const writeBloomInstances = (
      mesh: THREE.InstancedMesh,
      flowers: SurvivalTutorialGrassFlowerInstance[],
      type: NonNullable<SurvivalWildflower["bloomType"]>,
    ) => {
      ensureSurvivalInstancedMeshColors(mesh, flowers.length);
      for (let index = 0; index < flowers.length; index += 1) {
        const flower = flowers[index];
        normal.set(flower.normalX, flower.normalY, flower.normalZ).normalize();
        const bloomWidth = flower.bloomWidth ?? flower.bloomSize;
        const bloomHeight = flower.bloomHeight ?? flower.bloomSize;

        dummy.position
          .set(flower.worldX, flower.y, flower.worldZ)
          .addScaledVector(normal, flower.stemHeight + Math.max(0.08, bloomHeight) * 0.32 + 0.2);
        dummy.quaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, normal);
        dummy.rotateY(flower.yaw);
        if (type === "star") {
          dummy.scale.set(bloomWidth, 1, bloomWidth);
        } else if (type === "bell") {
          dummy.scale.set(bloomWidth * 0.74, bloomHeight, bloomWidth * 0.74);
        } else {
          dummy.scale.set(bloomWidth, bloomHeight, bloomWidth);
        }
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        mesh.setColorAt(index, flowerColor.set(flower.color));
      }
      mesh.count = flowers.length;
      mesh.instanceMatrix.needsUpdate = true;
      finalizeSurvivalInstancedMeshColors(mesh);
      finalizeSurvivalInstancedMesh(mesh, batchBounds.x, batchBounds.z, batchBounds.radius, 18);
    };

    ensureSurvivalInstancedMeshColors(centerMesh, localFlowers.length);
    for (let index = 0; index < localFlowers.length; index += 1) {
      const flower = localFlowers[index];
      normal.set(flower.normalX, flower.normalY, flower.normalZ).normalize();

      dummy.position
        .set(flower.worldX, flower.y, flower.worldZ)
        .addScaledVector(normal, flower.stemHeight * 0.5);
      dummy.quaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, normal);
      dummy.rotateY(flower.yaw);
      dummy.scale.set(flower.stemRadius, flower.stemHeight, flower.stemRadius);
      dummy.updateMatrix();
      stemMesh.setMatrixAt(index, dummy.matrix);

      dummy.position
        .set(flower.worldX, flower.y, flower.worldZ)
        .addScaledVector(normal, flower.stemHeight + Math.max(0.08, flower.bloomHeight ?? flower.bloomSize) * 0.34 + 0.2);
      dummy.quaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, normal);
      dummy.rotateY(flower.yaw);
      dummy.scale.setScalar(flower.centerSize ?? flower.bloomSize * 0.12);
      dummy.updateMatrix();
      centerMesh.setMatrixAt(index, dummy.matrix);
      centerMesh.setColorAt(index, flowerColor.set(flower.centerColor ?? "#facc15"));
    }

    stemMesh.count = localFlowers.length;
    centerMesh.count = localFlowers.length;
    stemMesh.instanceMatrix.needsUpdate = true;
    centerMesh.instanceMatrix.needsUpdate = true;
    writeBloomInstances(starMesh, starFlowers, "star");
    writeBloomInstances(roundMesh, roundFlowers, "round");
    writeBloomInstances(bellMesh, bellFlowers, "bell");
    writeBloomInstances(puffMesh, puffFlowers, "puff");
    finalizeSurvivalInstancedMeshColors(centerMesh);
    finalizeSurvivalInstancedMesh(stemMesh, batchBounds.x, batchBounds.z, batchBounds.radius, 18);
    finalizeSurvivalInstancedMesh(centerMesh, batchBounds.x, batchBounds.z, batchBounds.radius, 18);
  }, [batchBounds, bellFlowers, dummy, localFlowers, normal, puffFlowers, roundFlowers, starFlowers]);

  if (!underpaintGeometry && !bladeGeometry && localFlowers.length === 0) return null;

  const flowerCapacity = Math.max(1, localFlowers.length);
  const starFlowerCapacity = Math.max(1, starFlowers.length);
  const roundFlowerCapacity = Math.max(1, roundFlowers.length);
  const bellFlowerCapacity = Math.max(1, bellFlowers.length);
  const puffFlowerCapacity = Math.max(1, puffFlowers.length);

  return (
    <group name={batch.key} userData={HIDE_FROM_MINIMAP}>
      {underpaintGeometry && (
        <mesh geometry={underpaintGeometry} renderOrder={2.4} frustumCulled userData={HIDE_FROM_MINIMAP}>
          <meshBasicMaterial
            color="#ffffff"
            vertexColors
            side={THREE.FrontSide}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1.5}
            polygonOffsetUnits={-1.5}
            toneMapped={false}
            onBeforeCompile={(shader) => {
              applySurvivalLocalGrassShader(shader, fadeUniforms);
            }}
          />
        </mesh>
      )}
      {bladeGeometry && (
        <mesh geometry={bladeGeometry} renderOrder={4} frustumCulled userData={HIDE_FROM_MINIMAP}>
          <meshBasicMaterial
            map={bladeTexture}
            color="#ffffff"
            vertexColors
            side={THREE.DoubleSide}
            alphaTest={0.055}
            depthWrite
            toneMapped={false}
            onBeforeCompile={(shader) => {
              shader.uniforms.uTime = windUniform;
              shader.vertexShader = `attribute float grassBendWeight;\nuniform float uTime;\n${shader.vertexShader}`;
              applySurvivalLocalGrassShader(
                shader,
                fadeUniforms,
                `float tutorialWindSeed = position.x * 0.047 + position.z * 0.061;
              float tutorialWindNoise = sin(tutorialWindSeed + uTime * 1.12) + sin(tutorialWindSeed * 1.73 - uTime * 0.74) * 0.36;
              float tutorialWindGust = sin(position.x * 0.012 - position.z * 0.018 + uTime * 0.32) * 0.5 + 0.5;
              transformed.x += tutorialWindNoise * grassBendWeight * grassBendWeight * (0.035 + tutorialWindGust * 0.05);
              transformed.z += cos(tutorialWindSeed * 1.21 + uTime * 0.88) * grassBendWeight * (0.022 + tutorialWindGust * 0.026);`,
                0.08,
                1.8,
              );
            }}
          />
        </mesh>
      )}
      {localFlowers.length > 0 && (
        <>
          <instancedMesh ref={flowerStemRef} args={[undefined, undefined, flowerCapacity]} renderOrder={4.2} frustumCulled userData={HIDE_FROM_MINIMAP}>
            <cylinderGeometry args={[1, 1, 1, 4]} />
            <meshBasicMaterial
              color="#3f7d2e"
              transparent
              opacity={0.92}
              depthWrite={false}
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, fadeUniforms);
              }}
            />
          </instancedMesh>
          <instancedMesh ref={flowerStarBloomRef} args={[undefined, undefined, starFlowerCapacity]} renderOrder={4.35} frustumCulled userData={HIDE_FROM_MINIMAP}>
            <primitive object={flowerStarGeometry} attach="geometry" />
            <meshBasicMaterial
              color="#ffffff"
              side={THREE.DoubleSide}
              transparent
              opacity={0.98}
              depthWrite={false}
              depthTest
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, fadeUniforms, "", 2, 12);
              }}
            />
          </instancedMesh>
          <instancedMesh ref={flowerRoundBloomRef} args={[undefined, undefined, roundFlowerCapacity]} renderOrder={4.35} frustumCulled userData={HIDE_FROM_MINIMAP}>
            <octahedronGeometry args={[0.5, 0]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.98}
              depthWrite={false}
              depthTest
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, fadeUniforms, "", 2, 12);
              }}
            />
          </instancedMesh>
          <instancedMesh ref={flowerBellBloomRef} args={[undefined, undefined, bellFlowerCapacity]} renderOrder={4.35} frustumCulled userData={HIDE_FROM_MINIMAP}>
            <coneGeometry args={[0.5, 1, 6]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.98}
              depthWrite={false}
              depthTest
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, fadeUniforms, "", 2, 12);
              }}
            />
          </instancedMesh>
          <instancedMesh ref={flowerPuffBloomRef} args={[undefined, undefined, puffFlowerCapacity]} renderOrder={4.35} frustumCulled userData={HIDE_FROM_MINIMAP}>
            <sphereGeometry args={[0.5, 6, 5]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.96}
              depthWrite={false}
              depthTest
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, fadeUniforms, "", 2, 12);
              }}
            />
          </instancedMesh>
          <instancedMesh ref={flowerCenterRef} args={[undefined, undefined, flowerCapacity]} renderOrder={4.45} frustumCulled userData={HIDE_FROM_MINIMAP}>
            <sphereGeometry args={[0.5, 5, 4]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.94}
              depthWrite={false}
              depthTest
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, fadeUniforms, "", 2, 12);
              }}
            />
          </instancedMesh>
        </>
      )}
    </group>
  );
}

function SurvivalTutorialGrassCellTile({
  cell,
  fadeUniforms,
  windUniform,
}: {
  cell: SurvivalTutorialGrassCell;
  fadeUniforms: SurvivalLocalGrassFadeUniforms;
  windUniform: { value: number };
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const flowerStemRef = useRef<THREE.InstancedMesh>(null);
  const flowerStarBloomRef = useRef<THREE.InstancedMesh>(null);
  const flowerRoundBloomRef = useRef<THREE.InstancedMesh>(null);
  const flowerBellBloomRef = useRef<THREE.InstancedMesh>(null);
  const flowerPuffBloomRef = useRef<THREE.InstancedMesh>(null);
  const flowerCenterRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const normal = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const flowerStarGeometry = useMemo(() => getSurvivalLocalFlowerStarGeometry(7), []);
  const grassGeometry = useMemo(
    () => getSurvivalTutorialGrassTuftGeometry(cell.lod === "near" ? 8 : 5),
    [cell.lod],
  );
  const strandGeometry = useMemo(
    () => getCachedSurvivalTutorialGrassStrandGeometry(cell),
    [cell.cellX, cell.cellZ, cell.densityDistance, cell.lod, cell.x, cell.z],
  );
  const tufts = useMemo<SurvivalTutorialGrassTuft[]>(() => {
    const distanceFade = 1 - smoothstepRange(
      SURVIVAL_TUTORIAL_GRASS_GROUND_RADIUS,
      SURVIVAL_TUTORIAL_GRASS_AIR_RADIUS + SURVIVAL_TUTORIAL_GRASS_EDGE_FADE,
      cell.densityDistance,
    );
  const nearBoost = 1 - smoothstepRange(90, 205, cell.densityDistance);
  const cellMeadowMask = getSurvivalRestoredMeadowMask(
    cell.x + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
    cell.z + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
  );
  const restoredDensityBoost = lerpNumber(
    1,
    cell.lod === "near" ? 1.22 : 1.46,
    smoothstepRange(0.06, 0.36, cellMeadowMask),
  );
  const targetCount = Math.round(
    (cell.lod === "near" ? 740 : 500) *
    (0.46 + distanceFade * 0.9 + nearBoost * 0.54) *
    restoredDensityBoost,
  );
    if (targetCount <= 0) return [];

    const generated: SurvivalTutorialGrassTuft[] = [];
    const gridSize = Math.max(2, Math.ceil(Math.sqrt(targetCount * 1.55)));
    const attempts = gridSize * gridSize;
    const sampleOffset = Math.floor(survivalHash01(cell.cellX, cell.cellZ, 36200) * attempts);

    for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
      const sampleIndex = (sampleOffset + index * 1543) % attempts;
      const col = sampleIndex % gridSize;
      const row = Math.floor(sampleIndex / gridSize);
      const jitterX = 0.12 + survivalHash01(cell.cellX + col, cell.cellZ - row, 36240 + index) * 0.76;
      const jitterZ = 0.12 + survivalHash01(cell.cellX - row, cell.cellZ + col, 36280 + index) * 0.76;
      const x = ((col + jitterX) / gridSize) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
      const z = ((row + jitterZ) / gridSize) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
      const worldX = cell.x + x;
      const worldZ = cell.z + z;
      const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
      const placement = getSurvivalLocalGrassPlacement(
        worldX,
        worldZ,
        0.035,
        lerpNumber(cell.lod === "near" ? 0.22 : 0.42, 0.045, meadowMask),
        lerpNumber(0.36, 0.28, meadowMask),
      );
      if (!placement) continue;

      const variant = survivalHash01(cell.cellX, cell.cellZ, 36320 + index);
      const color = getSurvivalGrassBladeColor(placement.biome, worldX, worldZ, placement.terrainY, variant);
      if (placement.biome !== "desert" && placement.biome !== "swamp") {
        const meadowTone = new THREE.Color("#5ab93a").lerp(new THREE.Color("#b9ec5a"), survivalHash01(cell.cellX, cell.cellZ, 36360 + index));
        color.lerp(meadowTone, 0.24 + meadowMask * 0.54);
      }
      color.multiplyScalar(placement.biome === "desert" ? 0.95 : lerpNumber(1.05, 1.18, meadowMask));
      color.r = clamp01(color.r);
      color.g = clamp01(color.g);
      color.b = clamp01(color.b);

      const shape = survivalHash01(cell.cellX, cell.cellZ, 36400 + index);
      const height = (cell.lod === "near"
        ? lerpNumber(0.5, 0.9, shape)
        : lerpNumber(0.46, 0.86, shape)) * lerpNumber(0.92, 1.12, meadowMask);
      const width = (cell.lod === "near"
        ? lerpNumber(0.92, 1.75, survivalHash01(cell.cellX, cell.cellZ, 36440 + index))
        : lerpNumber(1.55, 2.9, survivalHash01(cell.cellX, cell.cellZ, 36440 + index))) * lerpNumber(0.9, 1.16, meadowMask);

      generated.push({
        x,
        y: placement.terrainY + 0.035,
        z,
        normalX: placement.normal.x,
        normalY: placement.normal.y,
        normalZ: placement.normal.z,
        yaw: survivalHash01(cell.cellX, cell.cellZ, 36480 + index) * Math.PI * 2,
        width,
        height,
        color,
      });
    }

    return generated;
  }, [cell.cellX, cell.cellZ, cell.lod, cell.x, cell.z]);

  const localFlowers = useMemo<SurvivalWildflower[]>(() => {
    const flowerDensity = 1 - smoothstepRange(30, 132, cell.densityDistance);
    if (flowerDensity <= 0) return [];
    const targetCount = Math.round((
      cell.lod === "near"
        ? lerpNumber(7, 27, flowerDensity)
        : 0
    ) * (mobilePerformanceMode ? 0.42 : 1));
    if (targetCount <= 0) return [];

    const generated: SurvivalWildflower[] = [];
    const gridSize = Math.max(2, Math.ceil(Math.sqrt(targetCount * 2.15)));
    const attempts = gridSize * gridSize;
    const sampleOffset = Math.floor(survivalHash01(cell.cellX, cell.cellZ, 23300) * attempts);

    for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
      const sampleIndex = (sampleOffset + index * 1543) % attempts;
      const col = sampleIndex % gridSize;
      const row = Math.floor(sampleIndex / gridSize);
      const jitterX = 0.1 + survivalHash01(cell.cellX + col, cell.cellZ + row, 23340 + index) * 0.8;
      const jitterZ = 0.1 + survivalHash01(cell.cellX - row, cell.cellZ + col, 23380 + index) * 0.8;
      const x = ((col + jitterX) / gridSize) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
      const z = ((row + jitterZ) / gridSize) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
      const worldX = cell.x + x;
      const worldZ = cell.z + z;
      const placement = getSurvivalLocalGrassPlacement(worldX, worldZ, 0.035, 0, 0.46);
      if (!placement) continue;

      const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
      const biome = meadowMask > 0.08 && placement.biome !== "desert" && placement.biome !== "swamp"
        ? "tallgrass"
        : placement.biome;
      if (biome === "desert" && survivalHash01(cell.cellX, cell.cellZ, 23420 + index) < 0.42) continue;
      if (biome === "swamp" && survivalHash01(cell.cellX, cell.cellZ, 23440 + index) < 0.18) continue;

      const variant = survivalHash01(cell.cellX, cell.cellZ, 23480 + index);
      const palette = biome === "tallgrass"
        ? ["#fff9a6", "#fef08a", "#ffd23f", "#fb7185", "#ff4fa3", "#f472b6", "#a78bfa", "#c4b5fd", "#f0abfc", "#ffffff", "#fb923c"]
        : biome === "swamp"
          ? ["#d9f99d", "#86efac", "#5eead4", "#c084fc", "#fde047"]
          : biome === "desert"
            ? ["#fff1a8", "#fb923c", "#f97316", "#fb7185", "#fde68a"]
            : SURVIVAL_FLOWER_COLORS[biome];
      const clusterRoll = survivalHash01(cell.cellX, cell.cellZ, 23520 + index);
      const typeRoll = survivalHash01(cell.cellX, cell.cellZ, 23534 + index);
      const bloomType: NonNullable<SurvivalWildflower["bloomType"]> = typeRoll > 0.86
        ? "puff"
        : typeRoll > 0.62
          ? "star"
          : typeRoll > 0.5
            ? "bell"
            : "round";
      const heightBase = biome === "tallgrass"
        ? lerpNumber(0.86, 1.28, meadowMask)
        : biome === "desert"
          ? 0.56
          : biome === "swamp"
            ? 0.72
            : 0.76;
      const bloomBase = biome === "tallgrass"
        ? lerpNumber(0.24, 0.42, meadowMask)
        : biome === "mushroom"
          ? 0.38
          : 0.3;
      const bloomSize = (
        bloomBase +
        survivalHash01(cell.cellX, cell.cellZ, 23640 + index) * lerpNumber(0.05, 0.13, meadowMask)
      ) * (clusterRoll > 0.92 ? 1.08 : clusterRoll > 0.72 ? 1.03 : 1);
      const widthRoll = survivalHash01(cell.cellX, cell.cellZ, 23664 + index);
      const heightRoll = survivalHash01(cell.cellX, cell.cellZ, 23684 + index);

      generated.push({
        x,
        y: placement.terrainY + 0.055,
        z,
        normalX: placement.normal.x,
        normalY: placement.normal.y,
        normalZ: placement.normal.z,
        yaw: survivalHash01(cell.cellX, cell.cellZ, 23560 + index) * Math.PI * 2,
        stemHeight: heightBase + variant * lerpNumber(0.14, 0.28, meadowMask),
        stemRadius: 0.02 + survivalHash01(cell.cellX, cell.cellZ, 23600 + index) * 0.014,
        bloomSize,
        bloomType,
        bloomWidth: bloomSize * (
          bloomType === "bell" ? lerpNumber(0.34, 0.5, widthRoll)
            : bloomType === "star" ? lerpNumber(0.72, 1.02, widthRoll)
              : bloomType === "puff" ? lerpNumber(0.48, 0.72, widthRoll)
                : lerpNumber(0.58, 0.84, widthRoll)
        ),
        bloomHeight: bloomSize * (
          bloomType === "bell" ? lerpNumber(0.84, 1.1, heightRoll)
            : bloomType === "star" ? lerpNumber(0.62, 0.84, heightRoll)
              : bloomType === "puff" ? lerpNumber(0.5, 0.72, heightRoll)
                : lerpNumber(0.45, 0.68, heightRoll)
        ),
        centerSize: bloomSize * (
          bloomType === "round" ? 0.12
            : bloomType === "star" ? 0.11
              : bloomType === "bell" ? 0.06
                : 0.08
        ),
        centerColor: variant > 0.66 ? "#fff7ad" : variant > 0.38 ? "#facc15" : "#f59e0b",
        color: palette[Math.floor((variant + typeRoll * 0.23) * palette.length) % palette.length],
      });
    }

    return generated;
  }, [cell.cellX, cell.cellZ, cell.lod, cell.x, cell.z, mobilePerformanceMode]);

  const flowerGroups = useMemo(() => splitSurvivalFlowersByBloomType(localFlowers), [localFlowers]);
  const starFlowers = flowerGroups.star;
  const roundFlowers = flowerGroups.round;
  const bellFlowers = flowerGroups.bell;
  const puffFlowers = flowerGroups.puff;

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    ensureSurvivalInstancedMeshColors(mesh, tufts.length);
    for (let index = 0; index < tufts.length; index += 1) {
      const tuft = tufts[index];
      normal.set(tuft.normalX, tuft.normalY, tuft.normalZ).normalize();
      dummy.position
        .set(cell.x + tuft.x, tuft.y, cell.z + tuft.z)
        .addScaledVector(normal, 0.025);
      dummy.quaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, normal);
      dummy.rotateY(tuft.yaw);
      dummy.scale.set(tuft.width, tuft.height, tuft.width);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, tuft.color);
    }

    mesh.count = tufts.length;
    mesh.instanceMatrix.needsUpdate = true;
    finalizeSurvivalInstancedMeshColors(mesh);
    finalizeSurvivalInstancedMesh(
      mesh,
      cell.x + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
      cell.z + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
      SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 1.25,
      12,
    );
  }, [cell.x, cell.z, dummy, normal, tufts]);

  useEffect(() => {
    const stemMesh = flowerStemRef.current;
    const starMesh = flowerStarBloomRef.current;
    const roundMesh = flowerRoundBloomRef.current;
    const bellMesh = flowerBellBloomRef.current;
    const puffMesh = flowerPuffBloomRef.current;
    const centerMesh = flowerCenterRef.current;
    if (!stemMesh || !starMesh || !roundMesh || !bellMesh || !puffMesh || !centerMesh) return;

    const flowerColor = new THREE.Color();
    const writeBloomInstances = (
      mesh: THREE.InstancedMesh,
      flowers: SurvivalWildflower[],
      type: NonNullable<SurvivalWildflower["bloomType"]>,
    ) => {
      ensureSurvivalInstancedMeshColors(mesh, flowers.length);
      for (let index = 0; index < flowers.length; index += 1) {
        const flower = flowers[index];
        normal.set(flower.normalX, flower.normalY, flower.normalZ).normalize();
        const bloomWidth = flower.bloomWidth ?? flower.bloomSize;
        const bloomHeight = flower.bloomHeight ?? flower.bloomSize;

        dummy.position
          .set(cell.x + flower.x, flower.y, cell.z + flower.z)
          .addScaledVector(normal, flower.stemHeight + Math.max(0.08, bloomHeight) * 0.32 + 0.2);
        dummy.quaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, normal);
        dummy.rotateY(flower.yaw);
        if (type === "star") {
          dummy.scale.set(bloomWidth, 1, bloomWidth);
        } else if (type === "bell") {
          dummy.scale.set(bloomWidth * 0.74, bloomHeight, bloomWidth * 0.74);
        } else {
          dummy.scale.set(bloomWidth, bloomHeight, bloomWidth);
        }
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        mesh.setColorAt(index, flowerColor.set(flower.color));
      }
      mesh.count = flowers.length;
      mesh.instanceMatrix.needsUpdate = true;
      finalizeSurvivalInstancedMeshColors(mesh);
      finalizeSurvivalInstancedMesh(
        mesh,
        cell.x + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
        cell.z + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
        SURVIVAL_TUTORIAL_GRASS_CELL_SIZE,
        18,
      );
    };

    ensureSurvivalInstancedMeshColors(centerMesh, localFlowers.length);
    for (let index = 0; index < localFlowers.length; index += 1) {
      const flower = localFlowers[index];
      normal.set(flower.normalX, flower.normalY, flower.normalZ).normalize();

      dummy.position
        .set(cell.x + flower.x, flower.y, cell.z + flower.z)
        .addScaledVector(normal, flower.stemHeight * 0.5);
      dummy.quaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, normal);
      dummy.rotateY(flower.yaw);
      dummy.scale.set(flower.stemRadius, flower.stemHeight, flower.stemRadius);
      dummy.updateMatrix();
      stemMesh.setMatrixAt(index, dummy.matrix);

      dummy.position
        .set(cell.x + flower.x, flower.y, cell.z + flower.z)
        .addScaledVector(normal, flower.stemHeight + Math.max(0.08, flower.bloomHeight ?? flower.bloomSize) * 0.34 + 0.2);
      dummy.quaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, normal);
      dummy.rotateY(flower.yaw);
      dummy.scale.setScalar(flower.centerSize ?? flower.bloomSize * 0.12);
      dummy.updateMatrix();
      centerMesh.setMatrixAt(index, dummy.matrix);
      centerMesh.setColorAt(index, flowerColor.set(flower.centerColor ?? "#facc15"));
    }

    stemMesh.count = localFlowers.length;
    centerMesh.count = localFlowers.length;
    stemMesh.instanceMatrix.needsUpdate = true;
    centerMesh.instanceMatrix.needsUpdate = true;
    writeBloomInstances(starMesh, starFlowers, "star");
    writeBloomInstances(roundMesh, roundFlowers, "round");
    writeBloomInstances(bellMesh, bellFlowers, "bell");
    writeBloomInstances(puffMesh, puffFlowers, "puff");
    finalizeSurvivalInstancedMeshColors(centerMesh);
    finalizeSurvivalInstancedMesh(
      stemMesh,
      cell.x + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
      cell.z + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
      SURVIVAL_TUTORIAL_GRASS_CELL_SIZE,
      18,
    );
    finalizeSurvivalInstancedMesh(
      centerMesh,
      cell.x + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
      cell.z + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
      SURVIVAL_TUTORIAL_GRASS_CELL_SIZE,
      18,
    );
  }, [bellFlowers, cell.x, cell.z, dummy, localFlowers, normal, puffFlowers, roundFlowers, starFlowers]);

  if (!strandGeometry && tufts.length === 0 && localFlowers.length === 0) return null;

  const flowerCapacity = Math.max(1, localFlowers.length);
  const starFlowerCapacity = Math.max(1, starFlowers.length);
  const roundFlowerCapacity = Math.max(1, roundFlowers.length);
  const bellFlowerCapacity = Math.max(1, bellFlowers.length);
  const puffFlowerCapacity = Math.max(1, puffFlowers.length);

  return (
    <group name={`survival-tutorial-grass-cell-${cell.key}`} userData={HIDE_FROM_MINIMAP}>
      {strandGeometry && (
        <mesh geometry={strandGeometry} renderOrder={3.8} frustumCulled={false} userData={HIDE_FROM_MINIMAP}>
          <meshBasicMaterial
            color="#ffffff"
            vertexColors
            side={THREE.DoubleSide}
            depthWrite
            depthTest
            toneMapped={false}
            onBeforeCompile={(shader) => {
              applySurvivalLocalGrassShader(shader, fadeUniforms);
            }}
          />
        </mesh>
      )}
      {tufts.length > 0 && (
        <instancedMesh ref={meshRef} args={[grassGeometry, undefined, Math.max(1, tufts.length)]} renderOrder={4} frustumCulled={false} userData={HIDE_FROM_MINIMAP}>
          <meshBasicMaterial
            color="#ffffff"
            vertexColors
            side={THREE.DoubleSide}
            depthWrite
            depthTest
            toneMapped={false}
            onBeforeCompile={(shader) => {
              shader.uniforms.uTime = windUniform;
              shader.vertexShader = `attribute float grassBendWeight;\nuniform float uTime;\n${shader.vertexShader}`;
              applySurvivalLocalGrassShader(
                shader,
                fadeUniforms,
                `float tutorialWindSeed = position.x * 2.7 + position.z * 3.1;
              #ifdef USE_INSTANCING
                tutorialWindSeed += instanceMatrix[3].x * 0.027 + instanceMatrix[3].z * 0.031;
              #endif
              float tutorialWind = sin(uTime * 1.18 + tutorialWindSeed) + sin(uTime * 1.92 + tutorialWindSeed * 1.37) * 0.24;
              transformed.x += tutorialWind * grassBendWeight * grassBendWeight * 0.08;
              transformed.z += cos(uTime * 0.94 + tutorialWindSeed) * grassBendWeight * 0.045;`,
              );
            }}
          />
        </instancedMesh>
      )}
      {localFlowers.length > 0 && (
        <>
          <instancedMesh ref={flowerStemRef} args={[undefined, undefined, flowerCapacity]} renderOrder={4.2} frustumCulled userData={HIDE_FROM_MINIMAP}>
            <cylinderGeometry args={[1, 1, 1, 4]} />
            <meshBasicMaterial
              color="#3f7d2e"
              transparent
              opacity={0.92}
              depthWrite={false}
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, fadeUniforms);
              }}
            />
          </instancedMesh>
          <instancedMesh ref={flowerStarBloomRef} args={[undefined, undefined, starFlowerCapacity]} renderOrder={4.35} frustumCulled userData={HIDE_FROM_MINIMAP}>
            <primitive object={flowerStarGeometry} attach="geometry" />
            <meshBasicMaterial
              color="#ffffff"
              side={THREE.DoubleSide}
              transparent
              opacity={0.98}
              depthWrite={false}
              depthTest
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, fadeUniforms, "", 2, 12);
              }}
            />
          </instancedMesh>
          <instancedMesh ref={flowerRoundBloomRef} args={[undefined, undefined, roundFlowerCapacity]} renderOrder={4.35} frustumCulled userData={HIDE_FROM_MINIMAP}>
            <octahedronGeometry args={[0.5, 0]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.98}
              depthWrite={false}
              depthTest
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, fadeUniforms, "", 2, 12);
              }}
            />
          </instancedMesh>
          <instancedMesh ref={flowerBellBloomRef} args={[undefined, undefined, bellFlowerCapacity]} renderOrder={4.35} frustumCulled userData={HIDE_FROM_MINIMAP}>
            <coneGeometry args={[0.5, 1, 6]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.98}
              depthWrite={false}
              depthTest
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, fadeUniforms, "", 2, 12);
              }}
            />
          </instancedMesh>
          <instancedMesh ref={flowerPuffBloomRef} args={[undefined, undefined, puffFlowerCapacity]} renderOrder={4.35} frustumCulled userData={HIDE_FROM_MINIMAP}>
            <sphereGeometry args={[0.5, 6, 5]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.96}
              depthWrite={false}
              depthTest
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, fadeUniforms, "", 2, 12);
              }}
            />
          </instancedMesh>
          <instancedMesh ref={flowerCenterRef} args={[undefined, undefined, flowerCapacity]} renderOrder={4.45} frustumCulled userData={HIDE_FROM_MINIMAP}>
            <sphereGeometry args={[0.5, 5, 4]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.94}
              depthWrite={false}
              depthTest
              toneMapped={false}
              onBeforeCompile={(shader) => {
                applySurvivalLocalGrassShader(shader, fadeUniforms, "", 2, 12);
              }}
            />
          </instancedMesh>
        </>
      )}
    </group>
  );
}

export function SurvivalTutorialGrassField({ disabled = false }: { disabled?: boolean }) {
  if (disabled || !SURVIVAL_GRASS_SYSTEM_ENABLED) return null;
  return <ActiveSurvivalTutorialGrassField />;
}

function ActiveSurvivalTutorialGrassField() {
  const initialCenter = useMemo(() => getInitialSurvivalTutorialGrassCenter(), []);
  const [centerCell, setCenterCell] = useState(() => ({
    cellX: getSurvivalTutorialGrassCellCoord(initialCenter.x),
    cellZ: getSurvivalTutorialGrassCellCoord(initialCenter.z),
  }));
  const centerCellRef = useRef(centerCell);
  const fadeUniforms = useMemo<SurvivalLocalGrassFadeUniforms>(() => ({
    viewerXZ: { value: new THREE.Vector2(initialCenter.x, initialCenter.z) },
    viewerY: { value: "y" in initialCenter && typeof initialCenter.y === "number" ? initialCenter.y : 12 },
    radius: { value: SURVIVAL_TUTORIAL_GRASS_GROUND_RADIUS + SURVIVAL_TUTORIAL_GRASS_EDGE_FADE * 0.85 },
    fadeWidth: { value: SURVIVAL_TUTORIAL_GRASS_EDGE_FADE },
    altitudeFade: { value: 1 },
    verticalFadeStart: { value: 32 },
    verticalFadeEnd: { value: 76 },
  }), [initialCenter.x, initialCenter.z]);
  const windUniform = useMemo(() => ({ value: 0 }), []);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const grassDebugViewEnabled = useMemo(() => isSurvivalGrassInspectionView(), []);
  const lastMobileFieldUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);
  const debugSampleSecondRef = useRef(-1);

  useFrame(({ camera, clock }) => {
    const elapsed = clock.elapsedTime;
    if (
      mobilePerformanceMode &&
      elapsed - lastMobileFieldUpdateAtRef.current < MOBILE_SURVIVAL_GRASS_FIELD_UPDATE_INTERVAL_SECONDS
    ) return;
    lastMobileFieldUpdateAtRef.current = elapsed;

    windUniform.value = elapsed;
    const viewerPosition = getSurvivalLocalGrassViewerPosition(camera);
    const worldX = viewerPosition.x;
    const worldZ = viewerPosition.z;
    const nextCell = getSurvivalTutorialGrassHysteresisCell(centerCellRef.current, worldX, worldZ);
    if (
      centerCellRef.current.cellX !== nextCell.cellX ||
      centerCellRef.current.cellZ !== nextCell.cellZ
    ) {
      centerCellRef.current = nextCell;
      startTransition(() => setCenterCell(nextCell));
    }

    const groundY = getSurvivalGrassSurfaceHeightAtWorld(worldX, worldZ);
    const altitude = Math.max(0, viewerPosition.y - groundY);
    const airMix = smoothstepRange(42, 220, altitude);
    fadeUniforms.viewerXZ.value.set(worldX, worldZ);
    fadeUniforms.viewerY.value = viewerPosition.y;
    fadeUniforms.radius.value = lerpNumber(
      SURVIVAL_TUTORIAL_GRASS_GROUND_RADIUS + SURVIVAL_TUTORIAL_GRASS_EDGE_FADE * 0.85,
      SURVIVAL_TUTORIAL_GRASS_AIR_RADIUS + SURVIVAL_TUTORIAL_GRASS_EDGE_FADE,
      airMix,
    );
    fadeUniforms.fadeWidth.value = lerpNumber(
      SURVIVAL_TUTORIAL_GRASS_EDGE_FADE,
      SURVIVAL_TUTORIAL_GRASS_EDGE_FADE * 1.45,
      airMix,
    );
    fadeUniforms.altitudeFade.value = 1 - smoothstepRange(
      SURVIVAL_LOCAL_GRASS_HIGH_ALTITUDE_FADE_START,
      SURVIVAL_LOCAL_GRASS_HIGH_ALTITUDE_FADE_END,
      altitude,
    );

    if (grassDebugViewEnabled && typeof document !== "undefined") {
      const debugSecond = Math.floor(elapsed);
      if (debugSampleSecondRef.current !== debugSecond) {
        debugSampleSecondRef.current = debugSecond;
        document.documentElement.dataset.wofTutorialGrassDebug = getSurvivalGrassDebugRejectionSummary(worldX, worldZ);
      }
    }
  });

  const cells = useMemo(
    () => makeSurvivalTutorialGrassCells(centerCell.cellX, centerCell.cellZ),
    [centerCell.cellX, centerCell.cellZ],
  );
  const [visibleCells, setVisibleCells] = useState<SurvivalTutorialGrassCell[]>(() => (
    cells.slice(0, SURVIVAL_TUTORIAL_GRASS_INITIAL_CELL_MOUNT_COUNT)
  ));
  const visibleCellsRef = useRef(visibleCells);

  useEffect(() => {
    visibleCellsRef.current = visibleCells;
  }, [visibleCells]);

  useEffect(() => {
    if (cells.length === 0 || typeof window === "undefined") {
      visibleCellsRef.current = [];
      setVisibleCells([]);
      return undefined;
    }

    let cancelled = false;
    startTransition(() => {
      setVisibleCells((previousCells) => {
        const nextCells = reconcileSurvivalTutorialGrassVisibleCells(
          previousCells,
          cells,
          previousCells.length === 0 ? SURVIVAL_TUTORIAL_GRASS_INITIAL_CELL_MOUNT_COUNT : 1,
        );
        visibleCellsRef.current = nextCells;
        return nextCells;
      });
    });

    let mountTask: SurvivalScheduledBackgroundTask | null = null;
    let mountTimeout = 0;
    const scheduleNextMount = () => {
      if (cancelled || visibleCellsRef.current.length >= cells.length) return;
      mountTimeout = window.setTimeout(() => {
        if (cancelled) return;

        mountTask = scheduleSurvivalBackgroundTask(() => {
          mountTask = null;
          if (cancelled) return;

          startTransition(() => {
            setVisibleCells((previousCells) => {
              const nextCells = reconcileSurvivalTutorialGrassVisibleCells(previousCells, cells, 1);
              visibleCellsRef.current = nextCells;
              return nextCells;
            });
          });
          scheduleNextMount();
        }, SURVIVAL_TUTORIAL_GRASS_IDLE_TIMEOUT_MS);
      }, SURVIVAL_TUTORIAL_GRASS_CELL_MOUNT_INTERVAL_MS);
    };
    scheduleNextMount();

    return () => {
      cancelled = true;
      mountTask?.cancel();
      window.clearTimeout(mountTimeout);
    };
  }, [cells]);

  useEffect(() => {
    if (!shouldPublishSurvivalLocalGrassTelemetry()) return;
    document.documentElement.dataset.wofTutorialGrassCenter = `${centerCell.cellX},${centerCell.cellZ}`;
    document.documentElement.dataset.wofTutorialGrassCells = String(visibleCells.length);
    document.documentElement.dataset.wofTutorialGrassBatches = "0";
    document.documentElement.dataset.wofTutorialGrassTargetCells = String(cells.length);
    document.documentElement.dataset.wofTutorialGrassPendingCells = String(Math.max(0, cells.length - visibleCells.length));
  }, [centerCell.cellX, centerCell.cellZ, cells.length, visibleCells.length]);

  if (visibleCells.length === 0) return null;

  return (
    <group name="survival-tutorial-grass-field" userData={HIDE_FROM_MINIMAP}>
      {visibleCells.map((cell) => (
        <SurvivalTutorialGrassCellTile
          key={cell.key}
          cell={cell}
          fadeUniforms={fadeUniforms}
          windUniform={windUniform}
        />
      ))}
    </group>
  );
}

export function SurvivalLocalGrassField({ disabled = false }: { disabled?: boolean }) {
  if (disabled || !SURVIVAL_LEGACY_GRASS_SYSTEM_ENABLED) return null;
  return <ActiveSurvivalLocalGrassField />;
}

function ActiveSurvivalLocalGrassField() {
  const initialCenter = useMemo(() => getInitialSurvivalLocalGrassCenter(), []);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const [centerCell, setCenterCell] = useState(() => ({
    cellX: getSurvivalLocalGrassCellCoord(initialCenter.x),
    cellZ: getSurvivalLocalGrassCellCoord(initialCenter.z),
  }));
  const initialStreamRadius = getSurvivalLocalGrassStreamRadius(
    SURVIVAL_LOCAL_GRASS_GROUND_RADIUS,
    SURVIVAL_LOCAL_GRASS_EDGE_FADE,
  );
  const [cellStreamRadius, setCellStreamRadius] = useState(initialStreamRadius);
  const centerCellRef = useRef(centerCell);
  const cellStreamRadiusRef = useRef(initialStreamRadius);
  const fadeUniforms = useMemo<SurvivalLocalGrassFadeUniforms>(() => ({
    viewerXZ: { value: new THREE.Vector2(initialCenter.x, initialCenter.z) },
    viewerY: { value: "y" in initialCenter && typeof initialCenter.y === "number" ? initialCenter.y : 12 },
    radius: { value: SURVIVAL_LOCAL_GRASS_GROUND_RADIUS },
    fadeWidth: { value: SURVIVAL_LOCAL_GRASS_EDGE_FADE },
    altitudeFade: { value: 1 },
    verticalFadeStart: { value: 14 },
    verticalFadeEnd: { value: 34 },
  }), [initialCenter.x, initialCenter.z]);

  useFrame(({ camera }) => {
    const viewerPosition = getSurvivalLocalGrassViewerPosition(camera);
    const worldX = viewerPosition.x;
    const worldZ = viewerPosition.z;
    const nextCell = getSurvivalLocalGrassHysteresisCell(centerCellRef.current, worldX, worldZ);
    if (
      centerCellRef.current.cellX !== nextCell.cellX ||
      centerCellRef.current.cellZ !== nextCell.cellZ
    ) {
      centerCellRef.current = nextCell;
      startTransition(() => setCenterCell(nextCell));
    }

    const groundY = getSurvivalGrassSurfaceHeightAtWorld(worldX, worldZ);
    const altitude = Math.max(0, viewerPosition.y - groundY);
    const airMix = smoothstepRange(36, 220, altitude);
    fadeUniforms.viewerXZ.value.set(worldX, worldZ);
    fadeUniforms.viewerY.value = viewerPosition.y;
    fadeUniforms.radius.value = lerpNumber(
      SURVIVAL_LOCAL_GRASS_GROUND_RADIUS,
      SURVIVAL_LOCAL_GRASS_AIR_RADIUS,
      airMix,
    );
    fadeUniforms.fadeWidth.value = lerpNumber(
      SURVIVAL_LOCAL_GRASS_EDGE_FADE,
      SURVIVAL_LOCAL_GRASS_EDGE_FADE * 1.55,
      airMix,
    );
    const nextStreamRadius = getSurvivalLocalGrassStreamRadius(
      fadeUniforms.radius.value,
      fadeUniforms.fadeWidth.value,
    );
    if (Math.abs(nextStreamRadius - cellStreamRadiusRef.current) >= SURVIVAL_LOCAL_GRASS_RADIUS_BUCKET_SIZE) {
      cellStreamRadiusRef.current = nextStreamRadius;
      startTransition(() => setCellStreamRadius(nextStreamRadius));
    }
    fadeUniforms.altitudeFade.value = 1 - smoothstepRange(
      SURVIVAL_LOCAL_GRASS_HIGH_ALTITUDE_FADE_START,
      SURVIVAL_LOCAL_GRASS_HIGH_ALTITUDE_FADE_END,
      altitude,
    );
  });

  const cells = useMemo(
    () => makeSurvivalLocalGrassCells(centerCell.cellX, centerCell.cellZ, cellStreamRadius),
    [centerCell.cellX, centerCell.cellZ, cellStreamRadius],
  );
  const [visibleCells, setVisibleCells] = useState<SurvivalLocalGrassCell[]>(() => (
    cells.slice(0, SURVIVAL_LOCAL_GRASS_INITIAL_CELL_MOUNT_COUNT)
  ));
  const visibleCellsRef = useRef(visibleCells);

  useEffect(() => {
    visibleCellsRef.current = visibleCells;
  }, [visibleCells]);

  useEffect(() => {
    if (cells.length === 0 || typeof window === "undefined") {
      visibleCellsRef.current = [];
      setVisibleCells([]);
      return undefined;
    }

    let cancelled = false;
    const intervalMs = mobilePerformanceMode
      ? SURVIVAL_LOCAL_GRASS_MOBILE_CELL_MOUNT_INTERVAL_MS
      : SURVIVAL_LOCAL_GRASS_CELL_MOUNT_INTERVAL_MS;
    const mountBatchSize = 1;

    startTransition(() => {
      setVisibleCells((previousCells) => {
        const immediateMountCount = previousCells.length === 0
          ? SURVIVAL_LOCAL_GRASS_INITIAL_CELL_MOUNT_COUNT
          : 1;
        const nextCells = reconcileSurvivalLocalGrassVisibleCells(previousCells, cells, immediateMountCount);
        visibleCellsRef.current = nextCells;
        return nextCells;
      });
    });
    let mountTimeout = 0;
    const scheduleNextMount = () => {
      if (cancelled || visibleCellsRef.current.length >= cells.length) return;
      mountTimeout = window.setTimeout(() => {
        if (cancelled) return;

        startTransition(() => {
          setVisibleCells((previousCells) => {
            if (previousCells.length >= cells.length) {
              const nextCells = reconcileSurvivalLocalGrassVisibleCells(previousCells, cells, 0);
              visibleCellsRef.current = nextCells;
              return nextCells;
            }
            const nextCells = reconcileSurvivalLocalGrassVisibleCells(previousCells, cells, mountBatchSize);
            visibleCellsRef.current = nextCells;
            return nextCells;
          });
        });
        scheduleNextMount();
      }, intervalMs);
    };
    scheduleNextMount();

    return () => {
      cancelled = true;
      window.clearTimeout(mountTimeout);
    };
  }, [cells, mobilePerformanceMode]);

  useEffect(() => {
    if (!shouldPublishSurvivalLocalGrassTelemetry()) return;
    document.documentElement.dataset.wofLocalGrassCenter = `${centerCell.cellX},${centerCell.cellZ}`;
    document.documentElement.dataset.wofLocalGrassCells = String(visibleCells.length);
    document.documentElement.dataset.wofLocalGrassTargetCells = String(cells.length);
    document.documentElement.dataset.wofLocalGrassPendingCells = String(Math.max(0, cells.length - visibleCells.length));
    document.documentElement.dataset.wofLocalGrassStreamRadius = String(Math.round(cellStreamRadius));
  }, [cellStreamRadius, centerCell.cellX, centerCell.cellZ, cells.length, visibleCells.length]);

  if (visibleCells.length === 0) return null;

  return (
    <group name="survival-local-grass-field" userData={HIDE_FROM_MINIMAP}>
      {visibleCells.map((cell) => (
        <SurvivalLocalGrassCellTile
          key={cell.key}
          cell={cell}
          fadeUniforms={fadeUniforms}
        />
      ))}
    </group>
  );
}
