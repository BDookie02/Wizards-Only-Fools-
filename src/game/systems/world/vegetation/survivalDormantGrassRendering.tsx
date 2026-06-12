import { useFrame } from "@react-three/fiber";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE, useGameStore } from "../../../../store/gameStore";
import { isSurvivalGrassInspectionView } from "../../../tools/qa/survivalGrassDebug";
import { isMobilePerformanceMode } from "../../input/performanceMode";
import {
  createSurvivalDayNightCycle,
  getEffectiveSurvivalCycleElapsedSeconds,
  getSurvivalDayNightCycleInto,
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
  SURVIVAL_LOCAL_GRASS_CELL_AREA_SCALE,
  SURVIVAL_LOCAL_GRASS_CELL_MOUNT_INTERVAL_MS,
  SURVIVAL_LOCAL_GRASS_CELL_SIZE,
  SURVIVAL_LOCAL_GRASS_DEFAULT_LIFT_COLOR,
  SURVIVAL_LOCAL_GRASS_DESERT_LIFT_COLOR,
  SURVIVAL_LOCAL_GRASS_DETAIL_RADIUS,
  SURVIVAL_LOCAL_GRASS_EDGE_FADE,
  SURVIVAL_LOCAL_GRASS_GROUND_PATCHES_PER_CELL,
  SURVIVAL_LOCAL_GRASS_GROUND_PATCH_OPACITY,
  SURVIVAL_LOCAL_GRASS_GROUND_RADIUS,
  SURVIVAL_LOCAL_GRASS_HIGH_ALTITUDE_FADE_END,
  SURVIVAL_LOCAL_GRASS_HIGH_ALTITUDE_FADE_START,
  SURVIVAL_LOCAL_GRASS_INITIAL_CELL_MOUNT_COUNT,
  SURVIVAL_LOCAL_GRASS_MOBILE_CELL_MOUNT_INTERVAL_MS,
  SURVIVAL_LOCAL_GRASS_RADIUS_BUCKET_SIZE,
  SURVIVAL_LOCAL_GRASS_SHORT_BLADES_PER_TUFT,
  SURVIVAL_LOCAL_GRASS_SWAMP_LIFT_COLOR,
  getSurvivalLocalGrassCellCoord,
  getSurvivalLocalGrassHysteresisCell,
  getSurvivalLocalGrassStreamRadius,
  makeSurvivalLocalGrassCells,
  reconcileSurvivalLocalGrassVisibleCells,
  useSurvivalLocalGrassCellLoadStage,
  type SurvivalLocalGrassCell,
} from "./survivalLocalGrassStreaming";
import { makeSurvivalLocalGrassCarpetGeometry } from "./survivalLocalGrassCarpetGeometry";
import { makeSurvivalLocalSolidGrassBladeGeometry } from "./survivalLocalGrassBladeGeometry";
import {
  makeSurvivalLocalGroundGrassPatches,
  type SurvivalGroundGrassPatch,
} from "./survivalLocalGrassPatches";
import {
  makeSurvivalLocalShortGrassBlades,
  makeSurvivalLocalTallGrassBlades,
  type SurvivalLocalGrassBlade,
} from "./survivalLocalGrassBlades";
import { makeSurvivalLocalGrassFlowerInstances } from "./survivalLocalGrassFlowers";
import { mergeSurvivalGrassGeometries } from "./survivalGrassGeometryMerge";
import {
  SURVIVAL_TUTORIAL_GRASS_AIR_RADIUS,
  SURVIVAL_TUTORIAL_GRASS_CELL_MOUNT_INTERVAL_MS,
  SURVIVAL_TUTORIAL_GRASS_CELL_SIZE,
  SURVIVAL_TUTORIAL_GRASS_EDGE_FADE,
  SURVIVAL_TUTORIAL_GRASS_GROUND_RADIUS,
  SURVIVAL_TUTORIAL_GRASS_IDLE_TIMEOUT_MS,
  SURVIVAL_TUTORIAL_GRASS_INITIAL_CELL_MOUNT_COUNT,
  getSurvivalTutorialGrassCellCoord,
  getSurvivalTutorialGrassHysteresisCell,
  makeSurvivalTutorialGrassCellBatches,
  makeSurvivalTutorialGrassCells,
  reconcileSurvivalTutorialGrassVisibleCells,
  type SurvivalTutorialGrassCell,
  type SurvivalTutorialGrassCellBatch,
} from "./survivalTutorialGrassStreaming";
import { makeSurvivalTutorialGrassBladeGeometry } from "./survivalTutorialGrassBladeGeometry";
import { makeSurvivalTutorialGrassCarpetGeometry } from "./survivalTutorialGrassCarpetGeometry";
import { makeSurvivalTutorialGrassStrandGeometry } from "./survivalTutorialGrassStrandGeometry";
import {
  SURVIVAL_TUTORIAL_GRASS_MEADOW_BASE_COLOR,
  SURVIVAL_TUTORIAL_GRASS_MEADOW_TIP_COLOR,
  makeSurvivalTutorialGrassTuftInstances,
  type SurvivalTutorialGrassTuft,
  type SurvivalTutorialGrassTuftInstance,
} from "./survivalTutorialGrassTufts";
import {
  makeSurvivalTutorialGrassFlowerInstances,
  type SurvivalTutorialGrassFlowerInstance,
  type SurvivalWildflower,
} from "./survivalTutorialGrassFlowers";
import { SURVIVAL_FLOWER_COLORS } from "./survivalFoliagePalettes";
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
  getSurvivalTutorialGrassBladeTexture,
} from "./survivalGrassTextures";
import {
  createSurvivalVertexColoredDiscGeometry,
  createSurvivalVertexColoredPlaneGeometry,
  getSurvivalLocalFlowerStarGeometry,
  getSurvivalTutorialGrassTuftGeometry,
} from "./survivalGrassGeometry";
import {
  splitSurvivalFlowersByBloomType,
  type SurvivalFlowerBloomType,
} from "./survivalFlowerGrouping";
import {
  ensureSurvivalInstancedMeshColors,
  finalizeSurvivalInstancedMesh,
  finalizeSurvivalInstancedMeshColors,
} from "./survivalInstancing";
import { HIDE_FROM_MINIMAP } from "./SurvivalFoliagePrimitives";
import {
  clampDormantGrassColor,
  copyInitialVisibleGrassCells,
  getDormantGrassVectorLength2D,
  getDormantGrassVectorLength3D,
  getSurvivalLocalGrassViewerPositionInto,
} from "./survivalDormantGrassRuntime";
import {
  publishSurvivalLocalGrassTelemetry,
  publishSurvivalTutorialGrassDebugSummary,
  publishSurvivalTutorialGrassTelemetry,
} from "./survivalDormantGrassTelemetry";
import {
  getSurvivalBotwGrassFootprintStats,
  getSurvivalChunkGrassSurfaceBiome,
  getSurvivalChunkInfoAtWorld,
  getSurvivalGrassBladeColor,
  getSurvivalGrassDebugRejectionSummary,
  getSurvivalGrassSurfaceBiome,
  getSurvivalGrassSurfaceHeightAtWorld,
  getSurvivalGrassSurfaceHeightForChunk,
  getSurvivalGrassSurfaceNormalForChunk,
  getSurvivalIntegratedGrassBladeColor,
  getSurvivalLocalGrassPlacement,
  getSurvivalSmoothedTerrainColor,
  getSurvivalTerrainHeightForChunk,
  isSurvivalGrassAllowedAtChunkPoint,
  isSurvivalGrassSubmergedAtWorldPoint,
} from "./survivalDormantGrassSurface";

export {
  configureDormantSurvivalGrassResolvers,
  type DormantSurvivalGrassResolvers,
  type SurvivalLocalGrassPlacement,
} from "./survivalDormantGrassResolvers";

const SURVIVAL_WORLD_GRASS_BLADES_PER_TUFT = 4;
const SURVIVAL_WORLD_SHORT_GRASS_BLADES_PER_TUFT = 2;
const SURVIVAL_GRASS_BLADE_SOURCE_UP = new THREE.Vector3(0, 1, 0);
const SURVIVAL_GROUND_GRASS_SOURCE_NORMAL = new THREE.Vector3(0, 0, 1);
const SURVIVAL_GRASS_SYSTEM_ENABLED = true;
export const SURVIVAL_LEGACY_GRASS_SYSTEM_ENABLED = false;
const MOBILE_SURVIVAL_GRASS_WIND_UPDATE_INTERVAL_SECONDS = 1 / 24;
const MOBILE_SURVIVAL_GRASS_FIELD_UPDATE_INTERVAL_SECONDS = 1 / 30;
const SURVIVAL_LOCAL_GRASS_MEADOW_DRY_COLOR = new THREE.Color("#a9a35a");
const SURVIVAL_LOCAL_GRASS_MEADOW_SWAMP_COLOR = new THREE.Color("#789344");
const SURVIVAL_LOCAL_GRASS_MEADOW_JUNGLE_COLOR = new THREE.Color("#69b14f");
const SURVIVAL_LOCAL_GRASS_MEADOW_BRIGHT_COLOR = new THREE.Color("#92d84b");
const SURVIVAL_LOCAL_GRASS_MEADOW_DEFAULT_COLOR = new THREE.Color("#6fb63d");
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
      ? SURVIVAL_LOCAL_GRASS_MEADOW_DRY_COLOR
      : sampleBiome === "swamp"
        ? SURVIVAL_LOCAL_GRASS_MEADOW_SWAMP_COLOR
        : sampleBiome === "jungle"
          ? SURVIVAL_LOCAL_GRASS_MEADOW_JUNGLE_COLOR
          : meadowMask > 0.28
            ? SURVIVAL_LOCAL_GRASS_MEADOW_BRIGHT_COLOR
            : SURVIVAL_LOCAL_GRASS_MEADOW_DEFAULT_COLOR;
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

  const groundPatches = useMemo<SurvivalGroundGrassPatch[]>(
    () => makeSurvivalLocalGroundGrassPatches(cell, cellDensity, coverStreamScale, mobilePerformanceMode),
    [cell, cellDensity, coverStreamScale, mobilePerformanceMode],
  );

  const shortBlades = useMemo<SurvivalLocalGrassBlade[]>(
    () => hasBladeDetail
      ? makeSurvivalLocalShortGrassBlades(cell, cellDensity, bladeStreamScale, mobilePerformanceMode)
      : [],
    [cell, cellDensity, hasBladeDetail, mobilePerformanceMode, bladeStreamScale],
  );

  const tallBlades = useMemo<SurvivalLocalGrassBlade[]>(
    () => hasBladeDetail
      ? makeSurvivalLocalTallGrassBlades(cell, cellDensity, bladeStreamScale, mobilePerformanceMode)
      : [],
    [cell, cellDensity, hasBladeDetail, mobilePerformanceMode, bladeStreamScale],
  );

  const localFlowers = useMemo<SurvivalWildflower[]>(
    () => makeSurvivalLocalGrassFlowerInstances(cell, cellDensity, flowerStreamScale, mobilePerformanceMode),
    [cell, cellDensity, flowerStreamScale, mobilePerformanceMode],
  );

  const flowerGroups = useMemo(() => splitSurvivalFlowersByBloomType(localFlowers), [localFlowers]);
  const starFlowers = flowerGroups.star;
  const roundFlowers = flowerGroups.round;
  const bellFlowers = flowerGroups.bell;
  const puffFlowers = flowerGroups.puff;

  const shortBladesPerTuft = SURVIVAL_LOCAL_GRASS_SHORT_BLADES_PER_TUFT;
  const lastMobileVisualUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);
  const cycleScratch = useMemo(createSurvivalDayNightCycle, []);

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime;
    if (
      mobilePerformanceMode &&
      elapsed - lastMobileVisualUpdateAtRef.current < MOBILE_SURVIVAL_GRASS_WIND_UPDATE_INTERVAL_SECONDS
    ) return;
    lastMobileVisualUpdateAtRef.current = elapsed;

    const cycle = getSurvivalDayNightCycleInto(
      getEffectiveSurvivalCycleElapsedSeconds(survivalTimeOverrideSeconds, elapsed),
      cycleScratch,
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

const SURVIVAL_TUTORIAL_GRASS_CELL_GEOMETRY_CACHE_LIMIT = 900;
const survivalTutorialGrassBladeGeometryCache = new Map<string, THREE.BufferGeometry | null>();
const survivalTutorialGrassCarpetGeometryCache = new Map<string, THREE.BufferGeometry | null>();
const survivalTutorialGrassStrandGeometryCache = new Map<string, THREE.BufferGeometry | null>();

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
    const meadowTone = new THREE.Color();

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
        meadowTone.copy(SURVIVAL_TUTORIAL_GRASS_MEADOW_BASE_COLOR).lerp(SURVIVAL_TUTORIAL_GRASS_MEADOW_TIP_COLOR, survivalHash01(cell.cellX, cell.cellZ, 36360 + index));
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
  const viewerPositionRef = useRef({
    x: initialCenter.x,
    y: "y" in initialCenter && typeof initialCenter.y === "number" ? initialCenter.y : 12,
    z: initialCenter.z,
  });

  useFrame(({ camera, clock }) => {
    const elapsed = clock.elapsedTime;
    if (
      mobilePerformanceMode &&
      elapsed - lastMobileFieldUpdateAtRef.current < MOBILE_SURVIVAL_GRASS_FIELD_UPDATE_INTERVAL_SECONDS
    ) return;
    lastMobileFieldUpdateAtRef.current = elapsed;

    windUniform.value = elapsed;
    const viewerPosition = getSurvivalLocalGrassViewerPositionInto(camera, viewerPositionRef.current);
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

    if (grassDebugViewEnabled) {
      const debugSecond = Math.floor(elapsed);
      if (debugSampleSecondRef.current !== debugSecond) {
        debugSampleSecondRef.current = debugSecond;
        publishSurvivalTutorialGrassDebugSummary(getSurvivalGrassDebugRejectionSummary(worldX, worldZ));
      }
    }
  });

  const cells = useMemo(
    () => makeSurvivalTutorialGrassCells(centerCell.cellX, centerCell.cellZ),
    [centerCell.cellX, centerCell.cellZ],
  );
  const [visibleCells, setVisibleCells] = useState<SurvivalTutorialGrassCell[]>(() => (
    copyInitialVisibleGrassCells(cells, SURVIVAL_TUTORIAL_GRASS_INITIAL_CELL_MOUNT_COUNT)
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
    publishSurvivalTutorialGrassTelemetry({
      centerCellX: centerCell.cellX,
      centerCellZ: centerCell.cellZ,
      visibleCellCount: visibleCells.length,
      targetCellCount: cells.length,
    });
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
  const viewerPositionRef = useRef({
    x: initialCenter.x,
    y: "y" in initialCenter && typeof initialCenter.y === "number" ? initialCenter.y : 12,
    z: initialCenter.z,
  });
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
    const viewerPosition = getSurvivalLocalGrassViewerPositionInto(camera, viewerPositionRef.current);
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
    copyInitialVisibleGrassCells(cells, SURVIVAL_LOCAL_GRASS_INITIAL_CELL_MOUNT_COUNT)
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
    publishSurvivalLocalGrassTelemetry({
      centerCellX: centerCell.cellX,
      centerCellZ: centerCell.cellZ,
      visibleCellCount: visibleCells.length,
      targetCellCount: cells.length,
      streamRadius: cellStreamRadius,
    });
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
