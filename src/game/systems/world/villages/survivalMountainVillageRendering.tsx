import { Fragment, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import { absoluteAngleDeltaRadians } from "../../math/angleMath";
import { getCachedIndexRange } from "../../rendering/indexRange";
import type { HutInfo } from "./baseVillageHutLayout";
import { Villagers } from "../../../Villagers";
import { shouldPublishCurrentMountainSlopeGrassTelemetry } from "../../../tools/qa/survivalQaTelemetryRoutes";
import { getMountainVillageTerrainDetailTexture } from "../terrain/survivalTerrainTextures";
import { shouldBuildSurvivalChunkColliders } from "../survival/survivalChunks";
import { clamp01, lerpNumber, smoothstep01, smoothstepRange, survivalHash01 } from "../survival/survivalMath";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { getSurvivalTutorialGrassTuftGeometry } from "../vegetation/survivalGrassGeometry";
import { HIDE_FROM_MINIMAP } from "../vegetation/SurvivalFoliagePrimitives";
import {
  ensureSurvivalInstancedMeshColors,
  finalizeSurvivalInstancedMesh,
  finalizeSurvivalInstancedMeshColors,
} from "../vegetation/survivalInstancing";
import { makeMountainVillageSlopeGrassTufts, type MountainSlopeGrassTuft } from "../vegetation/survivalMountainSlopeGrass";
import {
  MOUNTAIN_VILLAGE_DETAIL_PHASE_FINISHING,
  MOUNTAIN_VILLAGE_DETAIL_PHASE_MINESHAFT_INTERIOR,
  MOUNTAIN_VILLAGE_DETAIL_PHASE_MINESHAFT_SHELL,
  MOUNTAIN_VILLAGE_DETAIL_PHASE_TRAIL_AND_CABINS,
  useMountainVillageDetailPhase,
} from "./mountainVillageDetailPhase";
import {
  getMountainMineshaftExitBridgeFrame,
  getMountainMineshaftLadderLandingLocalX,
  getMountainMineshaftPlatformPieces,
} from "./mountainVillageMineshaftRuntime";
import {
  MOUNTAIN_VILLAGE_EDGE_BLEND_START,
  MOUNTAIN_VILLAGE_HEIGHT,
  MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_ANGLES,
  MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_TABLE_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_BASE_OFFSET,
  MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_LIGHT_COUNT,
  MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_LIGHT_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_SEGMENTS,
  MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH,
  MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_Y_OFFSET,
  MOUNTAIN_VILLAGE_MINESHAFT_GOLDEN_ANGLE,
  MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_HUT_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_LADDER_EXIT_CLEARANCE,
  MOUNTAIN_VILLAGE_MINESHAFT_LADDER_PLATFORM_GAP,
  MOUNTAIN_VILLAGE_MINESHAFT_LADDER_RING_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_LADDER_SENSOR_DEPTH,
  MOUNTAIN_VILLAGE_MINESHAFT_LADDER_START_CLEARANCE,
  MOUNTAIN_VILLAGE_MINESHAFT_LADDER_WIDTH,
  MOUNTAIN_VILLAGE_MINESHAFT_RIM_MID_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_RIM_OUTER_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_TERRAIN_CUT_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_THRONE_Z,
  MOUNTAIN_VILLAGE_MINESHAFT_WALL_FIBONACCI_SEQUENCE,
  MOUNTAIN_VILLAGE_MINESHAFT_WALL_LANTERN_COUNT,
  MOUNTAIN_VILLAGE_MINESHAFT_WALL_PAINTING_COUNT,
  MOUNTAIN_VILLAGE_PLATEAU_RADIUS,
  MOUNTAIN_VILLAGE_RADIUS,
  MOUNTAIN_VILLAGE_SUMMIT_COLLIDER_RADIUS,
  MOUNTAIN_VILLAGE_TRAIL_END_RADIUS,
  MOUNTAIN_VILLAGE_TRAIL_HEIGHT_OFFSET,
  MOUNTAIN_VILLAGE_TRAIL_START_RADIUS,
  MOUNTAIN_VILLAGE_TRAIL_TURNS,
  cutCircularHoleFromPlaneGeometry,
  getMountainVillageHeight,
  getMountainVillageLocalRadius,
  getMountainVillageRadialLift,
  getMountainVillageSummitFlatMask,
  getMountainVillageSummitFloorHeight,
  getMountainVillageTerrainSegments,
  getMountainVillageTrailAngleOffset,
  getMountainVillageTrailSurfaceMask,
  getMountainVillageTrailWidth,
} from "./mountainVillageTerrain";
import { shouldHideMountainWaterfallForCamera } from "./mountainVillageWaterfallRuntime";

function shouldPublishMountainSlopeGrassTelemetry() {
  return shouldPublishCurrentMountainSlopeGrassTelemetry();
}

type SurvivalTerrainHeightForChunk = (chunk: SurvivalChunkInfo, localX: number, localZ: number) => number;
type SurvivalTerrainColorAtWorld = (worldX: number, worldZ: number, height: number) => THREE.Color;
type SurvivalVillageBaseHeightForChunk = (chunk: SurvivalChunkInfo) => number;

const MOUNTAIN_GRASS_BLADE_SOURCE_UP = new THREE.Vector3(0, 1, 0);
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
const MOUNTAIN_WATERFALL_VISIBILITY_CHECK_INTERVAL_SECONDS = 1 / 12;
const mountainTerrainTrailColorScratch = new THREE.Color();

type MountainVillageTrailPoint = {
  localX: number;
  localZ: number;
  y: number;
  width: number;
  t: number;
};

type MountainVillageTrailSupport = {
  key: string;
  localX: number;
  localZ: number;
  topY: number;
  height: number;
  yaw: number;
  side: -1 | 1;
};

type MountainVillageTrailSegment = {
  key: string;
  localX: number;
  localZ: number;
  y: number;
  yaw: number;
  slope: number;
  width: number;
  length: number;
  index: number;
  supports: MountainVillageTrailSupport[];
};

type MountainVillageCabin = {
  key: string;
  localX: number;
  localZ: number;
  rotation: number;
  width: number;
  depth: number;
  height: number;
  bodyColor: string;
  roofColor: string;
  accentColor: string;
};

type MountainMineshaftHut = {
  key: string;
  angle: number;
  localX: number;
  localZ: number;
  y: number;
  rotation: number;
  width: number;
  depth: number;
  height: number;
  platformWidth: number;
  platformDepth: number;
  bodyColor: string;
  roofColor: string;
  accentColor: string;
};

type MountainMineshaftLadder = {
  key: string;
  angle: number;
  localX: number;
  localZ: number;
  startY: number;
  endY: number;
  rotation: number;
  width: number;
};

type MountainVillageWaterfall = {
  angle: number;
  topX: number;
  topZ: number;
  topY: number;
  bottomX: number;
  bottomZ: number;
  bottomY: number;
  width: number;
};

type MountainVillageCliffPatch = {
  key: string;
  localX: number;
  localZ: number;
  y: number;
  yaw: number;
  roll: number;
  width: number;
  depth: number;
  thickness: number;
  color: string;
  opacity: number;
};

type MountainVillageLayout = {
  baseHeight: number;
  summitY: number;
  trailPoints: MountainVillageTrailPoint[];
  trailSegments: MountainVillageTrailSegment[];
  trailDeckGeometry: THREE.BufferGeometry;
  trailTopGeometry: THREE.BufferGeometry;
  trailColliderGeometry: THREE.BufferGeometry;
  summitColliderGeometry: THREE.BufferGeometry;
  cliffPatches: MountainVillageCliffPatch[];
  cabins: MountainVillageCabin[];
  interiorHuts: MountainMineshaftHut[];
  interiorLadders: MountainMineshaftLadder[];
  hutInfos: HutInfo[];
  waterfall: MountainVillageWaterfall;
};

type MountainVillageLayoutOptions = {
  includeMineshaftLayout?: boolean;
  includeVillagerHutInfos?: boolean;
};

function getMountainVillageColliderHeight(
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  terrainHeightForChunk: SurvivalTerrainHeightForChunk,
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

function getMountainVillageTerrainColorInto(
  target: THREE.Color,
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  height: number,
  baseHeight: number,
  showTrailSurface: boolean,
  terrainHeightForChunk: SurvivalTerrainHeightForChunk,
  terrainColorAtWorld: SurvivalTerrainColorAtWorld,
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

function makeMountainVillageTerrainGeometry(
  chunk: SurvivalChunkInfo,
  cutMineshaftOpening: boolean,
  showTrailSurface: boolean,
  terrainHeightForChunk: SurvivalTerrainHeightForChunk,
  terrainColorAtWorld: SurvivalTerrainColorAtWorld,
  villageBaseHeightForChunk: SurvivalVillageBaseHeightForChunk,
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

function MountainSlopeGrass({
  chunk,
  baseHeight,
  active,
  terrainHeightForChunk,
  terrainColorAtWorld,
}: {
  chunk: SurvivalChunkInfo;
  baseHeight: number;
  active: boolean;
  terrainHeightForChunk: SurvivalTerrainHeightForChunk;
  terrainColorAtWorld: SurvivalTerrainColorAtWorld;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const normal = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const grassGeometry = useMemo(() => getSurvivalTutorialGrassTuftGeometry(6), []);
  const grassColorScratch = useMemo(() => new THREE.Color(), []);
  const terrainColorScratch = useMemo(() => new THREE.Color(), []);
  const tufts = useMemo(
    () => active
      ? makeMountainVillageSlopeGrassTufts(
        chunk,
        baseHeight,
        (sampleChunk, sampleLocalX, sampleLocalZ, sampleBaseHeight) => getMountainVillageHeight(
          sampleChunk,
          sampleLocalX,
          sampleLocalZ,
          terrainHeightForChunk,
          sampleBaseHeight,
        ),
        (sampleChunk, sampleLocalX, sampleLocalZ, sampleY, sampleBaseHeight, showTrailSurface) => getMountainVillageTerrainColorInto(
          terrainColorScratch,
          sampleChunk,
          sampleLocalX,
          sampleLocalZ,
          sampleY,
          sampleBaseHeight,
          showTrailSurface,
          terrainHeightForChunk,
          terrainColorAtWorld,
        ),
      )
      : [],
    [active, baseHeight, chunk, terrainColorAtWorld, terrainColorScratch, terrainHeightForChunk],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || tufts.length === 0) return;

    ensureSurvivalInstancedMeshColors(mesh, tufts.length);
    for (let index = 0; index < tufts.length; index += 1) {
      const tuft = tufts[index];
      normal.set(tuft.normalX, tuft.normalY, tuft.normalZ).normalize();
      dummy.position
        .set(tuft.localX, tuft.y, tuft.localZ)
        .addScaledVector(normal, 0.08);
      dummy.quaternion.setFromUnitVectors(MOUNTAIN_GRASS_BLADE_SOURCE_UP, normal);
      dummy.rotateY(tuft.yaw);
      dummy.scale.set(tuft.width, tuft.height, tuft.width);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, grassColorScratch.setRGB(tuft.colorR, tuft.colorG, tuft.colorB));
    }

    mesh.count = tufts.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (shouldPublishMountainSlopeGrassTelemetry()) {
      document.documentElement.dataset.wofMountainSlopeGrass = String(tufts.length);
    }
    finalizeSurvivalInstancedMeshColors(mesh);
    finalizeSurvivalInstancedMesh(
      mesh,
      0,
      0,
      MOUNTAIN_VILLAGE_RADIUS + 34,
      baseHeight + MOUNTAIN_VILLAGE_HEIGHT * 0.48,
    );
  }, [baseHeight, dummy, grassColorScratch, normal, tufts]);

  if (tufts.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[grassGeometry, undefined, Math.max(1, tufts.length)]}
      renderOrder={5.1}
      frustumCulled
      userData={HIDE_FROM_MINIMAP}
    >
      <meshBasicMaterial
        color="#ffffff"
        vertexColors
        side={THREE.DoubleSide}
        depthWrite
        depthTest
        toneMapped={false}
      />
    </instancedMesh>
  );
}

function makeMountainVillageCliffPatches(chunk: SurvivalChunkInfo, baseHeight: number, terrainHeightForChunk: SurvivalTerrainHeightForChunk): MountainVillageCliffPatch[] {
  const count = chunk.lod === "near" ? 48 : 20;
  const stoneColors = ["#3f474a", "#545d60", "#6f7a7d", "#838f94", "#2f3638"];
  const snowColors = ["#d9eef7", "#eef9ff", "#bcdce9"];
  const patches = new Array<MountainVillageCliffPatch>(count);

  for (let index = 0; index < count; index += 1) {
    const ringT = survivalHash01(chunk.cx, chunk.cz, 5200 + index);
    const angle = (index / count) * Math.PI * 2 + (survivalHash01(chunk.cx, chunk.cz, 5230 + index) - 0.5) * 0.32;
    const radius = lerpNumber(
      MOUNTAIN_VILLAGE_PLATEAU_RADIUS + 16,
      MOUNTAIN_VILLAGE_RADIUS - 20,
      Math.pow(ringT, 0.92)
    ) + Math.sin(index * 2.17 + chunk.cx * 0.7) * 5.5;
    const localX = Math.sin(angle) * radius;
    const localZ = Math.cos(angle) * radius;
    const y = getMountainVillageHeight(chunk, localX, localZ, terrainHeightForChunk, baseHeight);
    const lift = y - baseHeight;
    const snowMix = smoothstepRange(MOUNTAIN_VILLAGE_HEIGHT * 0.6, MOUNTAIN_VILLAGE_HEIGHT * 0.92, lift);
    const colorSet = snowMix > 0.56 && index % 3 !== 1 ? snowColors : stoneColors;
    const width = lerpNumber(9, 23, survivalHash01(chunk.cx, chunk.cz, 5260 + index)) * (snowMix > 0.62 ? 0.78 : 1);
    const depth = lerpNumber(2.2, 6.4, survivalHash01(chunk.cx, chunk.cz, 5290 + index));

    patches[index] = {
      key: `${chunk.key}-mountain-cliff-patch-${index}`,
      localX,
      localZ,
      y: y + 0.46,
      yaw: angle + Math.PI / 2,
      roll: (survivalHash01(chunk.cx, chunk.cz, 5320 + index) - 0.5) * 0.34,
      width,
      depth,
      thickness: lerpNumber(0.18, 0.46, survivalHash01(chunk.cx, chunk.cz, 5350 + index)),
      color: colorSet[Math.floor(survivalHash01(chunk.cx, chunk.cz, 5380 + index) * colorSet.length) % colorSet.length],
      opacity: lerpNumber(0.48, 0.82, survivalHash01(chunk.cx, chunk.cz, 5410 + index)),
    };
  }

  return patches;
}

function makeMountainVillageTerrainColliderGeometry(
  chunk: SurvivalChunkInfo,
  cutMineshaftOpening: boolean,
  terrainHeightForChunk: SurvivalTerrainHeightForChunk,
  villageBaseHeightForChunk: SurvivalVillageBaseHeightForChunk,
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

function getMountainVillageTrailPoint(chunk: SurvivalChunkInfo, baseHeight: number, t: number, terrainHeightForChunk: SurvivalTerrainHeightForChunk) {
  const eased = Math.pow(smoothstep01(t), 0.86);
  const radius = lerpNumber(MOUNTAIN_VILLAGE_TRAIL_START_RADIUS, MOUNTAIN_VILLAGE_TRAIL_END_RADIUS, eased);
  const angleOffset = getMountainVillageTrailAngleOffset(chunk);
  const angle = angleOffset + Math.pow(t, 1.16) * MOUNTAIN_VILLAGE_TRAIL_TURNS * Math.PI * 2;
  const localX = Math.sin(angle) * radius;
  const localZ = Math.cos(angle) * radius;
  const stiltLift = smoothstepRange(0.02, 0.16, t) * (1 - smoothstepRange(0.84, 0.98, t));
  const lift = lerpNumber(1.45, MOUNTAIN_VILLAGE_TRAIL_HEIGHT_OFFSET, stiltLift) + Math.sin(t * Math.PI) * 1.25;
  const y = getMountainVillageHeight(chunk, localX, localZ, terrainHeightForChunk, baseHeight) + lift;

  return { localX, localZ, y, width: getMountainVillageTrailWidth(t), t };
}

function makeMountainVillageTrailPoints(chunk: SurvivalChunkInfo, baseHeight: number, terrainHeightForChunk: SurvivalTerrainHeightForChunk): MountainVillageTrailPoint[] {
  const pointCount = chunk.lod === "near" ? 24 : 16;
  const points = new Array<MountainVillageTrailPoint>(pointCount + 1);

  for (let index = 0; index <= pointCount; index += 1) {
    points[index] = getMountainVillageTrailPoint(chunk, baseHeight, index / pointCount, terrainHeightForChunk);
  }

  return points;
}

function makeMountainVillageTrailSegments(
  chunk: SurvivalChunkInfo,
  baseHeight: number,
  points: MountainVillageTrailPoint[],
  terrainHeightForChunk: SurvivalTerrainHeightForChunk,
): MountainVillageTrailSegment[] {
  const segmentCount = points.length - 1;
  const segments = new Array<MountainVillageTrailSegment>(segmentCount);

  for (let index = 0; index < segmentCount; index += 1) {
    const point = points[index];
    const next = points[index + 1];
    const dx = next.localX - point.localX;
    const dz = next.localZ - point.localZ;
    const dy = next.y - point.y;
    const horizontalLength = Math.max(0.1, Math.sqrt(dx * dx + dz * dz));
    const midpointLocalX = (point.localX + next.localX) / 2;
    const midpointLocalZ = (point.localZ + next.localZ) / 2;
    const midpointY = (point.y + next.y) / 2;
    const progress = index / segmentCount;
    const yaw = Math.atan2(dx, dz);
    const width = getMountainVillageTrailWidth(progress);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    const supportOffset = width / 2 - 1.12;
    const supports: MountainVillageTrailSupport[] = [];

    for (let supportIndex = 0; supportIndex < 2; supportIndex += 1) {
      const side = supportIndex === 0 ? -1 : 1;
      const localX = midpointLocalX + rightX * supportOffset * side;
      const localZ = midpointLocalZ + rightZ * supportOffset * side;
      const topY = midpointY - 1.18;
      const groundY = getMountainVillageHeight(chunk, localX, localZ, terrainHeightForChunk, baseHeight) + 0.22;
      const height = topY - groundY;
      if (height < 4.6) continue;

      supports.push({
        key: `${chunk.key}-mountain-trail-support-${index}-${side}`,
        localX,
        localZ,
        topY,
        height,
        yaw,
        side,
      });
    }

    segments[index] = {
      key: `${chunk.key}-mountain-trail-${index}`,
      localX: midpointLocalX,
      localZ: midpointLocalZ,
      y: midpointY,
      yaw,
      slope: Math.atan2(dy, horizontalLength),
      width,
      length: horizontalLength * 1.08,
      index,
      supports,
    };
  }

  return segments;
}

function getMountainVillageTrailFrame(points: MountainVillageTrailPoint[], index: number) {
  const previous = points[Math.max(0, index - 1)];
  const next = points[Math.min(points.length - 1, index + 1)];
  const dx = next.localX - previous.localX;
  const dz = next.localZ - previous.localZ;
  const yaw = Math.atan2(dx, dz);

  return {
    rightX: Math.cos(yaw),
    rightZ: -Math.sin(yaw),
  };
}

function makeMountainVillageTrailSurfaceGeometry(
  points: MountainVillageTrailPoint[],
  widthScale: number,
  yOffset: number
) {
  const vertexCount = points.length * 2;
  const segmentCount = Math.max(0, points.length - 1);
  const vertices = new Float32Array(vertexCount * 3);
  const indices = vertexCount > 65535 ? new Uint32Array(segmentCount * 6) : new Uint16Array(segmentCount * 6);
  let vertexOffset = 0;
  let indexOffset = 0;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const { rightX, rightZ } = getMountainVillageTrailFrame(points, index);
    const halfWidth = point.width * widthScale * 0.5;
    const y = point.y + yOffset;

    vertices[vertexOffset] = point.localX - rightX * halfWidth;
    vertices[vertexOffset + 1] = y;
    vertices[vertexOffset + 2] = point.localZ - rightZ * halfWidth;
    vertices[vertexOffset + 3] = point.localX + rightX * halfWidth;
    vertices[vertexOffset + 4] = y;
    vertices[vertexOffset + 5] = point.localZ + rightZ * halfWidth;
    vertexOffset += 6;
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const left = index * 2;
    const right = left + 1;
    const nextLeft = left + 2;
    const nextRight = left + 3;

    indices[indexOffset] = left;
    indices[indexOffset + 1] = nextLeft;
    indices[indexOffset + 2] = right;
    indices[indexOffset + 3] = right;
    indices[indexOffset + 4] = nextLeft;
    indices[indexOffset + 5] = nextRight;
    indexOffset += 6;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

function makeMountainVillageTrailDeckGeometry(points: MountainVillageTrailPoint[]) {
  const vertexCount = points.length * 4;
  const segmentCount = Math.max(0, points.length - 1);
  const vertices = new Float32Array(vertexCount * 3);
  const indices = vertexCount > 65535
    ? new Uint32Array(segmentCount * 24 + 12)
    : new Uint16Array(segmentCount * 24 + 12);
  let vertexOffset = 0;
  let indexOffset = 0;
  const topOffset = 0.46;
  const bottomOffset = -0.42;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const { rightX, rightZ } = getMountainVillageTrailFrame(points, index);
    const halfWidth = point.width * 0.5;
    const leftX = point.localX - rightX * halfWidth;
    const leftZ = point.localZ - rightZ * halfWidth;
    const rightXPos = point.localX + rightX * halfWidth;
    const rightZPos = point.localZ + rightZ * halfWidth;

    vertices[vertexOffset] = leftX;
    vertices[vertexOffset + 1] = point.y + topOffset;
    vertices[vertexOffset + 2] = leftZ;
    vertices[vertexOffset + 3] = rightXPos;
    vertices[vertexOffset + 4] = point.y + topOffset;
    vertices[vertexOffset + 5] = rightZPos;
    vertices[vertexOffset + 6] = leftX;
    vertices[vertexOffset + 7] = point.y + bottomOffset;
    vertices[vertexOffset + 8] = leftZ;
    vertices[vertexOffset + 9] = rightXPos;
    vertices[vertexOffset + 10] = point.y + bottomOffset;
    vertices[vertexOffset + 11] = rightZPos;
    vertexOffset += 12;
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const base = index * 4;
    const nextBase = base + 4;
    const topLeft = base;
    const topRight = base + 1;
    const bottomLeft = base + 2;
    const bottomRight = base + 3;
    const nextTopLeft = nextBase;
    const nextTopRight = nextBase + 1;
    const nextBottomLeft = nextBase + 2;
    const nextBottomRight = nextBase + 3;

    indices[indexOffset] = topLeft;
    indices[indexOffset + 1] = nextTopLeft;
    indices[indexOffset + 2] = topRight;
    indices[indexOffset + 3] = topRight;
    indices[indexOffset + 4] = nextTopLeft;
    indices[indexOffset + 5] = nextTopRight;
    indices[indexOffset + 6] = bottomLeft;
    indices[indexOffset + 7] = bottomRight;
    indices[indexOffset + 8] = nextBottomLeft;
    indices[indexOffset + 9] = bottomRight;
    indices[indexOffset + 10] = nextBottomRight;
    indices[indexOffset + 11] = nextBottomLeft;
    indices[indexOffset + 12] = topLeft;
    indices[indexOffset + 13] = bottomLeft;
    indices[indexOffset + 14] = nextTopLeft;
    indices[indexOffset + 15] = bottomLeft;
    indices[indexOffset + 16] = nextBottomLeft;
    indices[indexOffset + 17] = nextTopLeft;
    indices[indexOffset + 18] = topRight;
    indices[indexOffset + 19] = nextTopRight;
    indices[indexOffset + 20] = bottomRight;
    indices[indexOffset + 21] = bottomRight;
    indices[indexOffset + 22] = nextTopRight;
    indices[indexOffset + 23] = nextBottomRight;
    indexOffset += 24;
  }

  const first = 0;
  const last = (points.length - 1) * 4;
  indices[indexOffset] = first;
  indices[indexOffset + 1] = first + 1;
  indices[indexOffset + 2] = first + 2;
  indices[indexOffset + 3] = first + 1;
  indices[indexOffset + 4] = first + 3;
  indices[indexOffset + 5] = first + 2;
  indices[indexOffset + 6] = last;
  indices[indexOffset + 7] = last + 2;
  indices[indexOffset + 8] = last + 1;
  indices[indexOffset + 9] = last + 1;
  indices[indexOffset + 10] = last + 2;
  indices[indexOffset + 11] = last + 3;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

function makeMountainVillageSummitColliderGeometry(summitY: number) {
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

function makeMountainMineshaftHuts(chunk: SurvivalChunkInfo, baseHeight: number, summitY: number): MountainMineshaftHut[] {
  const bottomY = baseHeight + MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_BASE_OFFSET;
  const availableHeight = Math.max(96, summitY - bottomY - 30);
  const levelFractions = chunk.lod === "near"
    ? [0.18, 0.48, 0.8]
    : [0.24, 0.68];
  const bodyColors = ["#514331", "#5d4b35", "#423b32", "#664f35"];
  const roofColors = ["#6f5131", "#805d39", "#5c4028", "#8a6a42"];
  const accentColors = ["#86d9ff", "#f1cf82", "#c7eaff", "#d7b46c"];
  const angleBase = 0.72 + survivalHash01(chunk.cx, chunk.cz, 5200) * 0.38;
  const huts = new Array<MountainMineshaftHut>(levelFractions.length);

  for (let index = 0; index < levelFractions.length; index += 1) {
    const fraction = levelFractions[index];
    const angle = angleBase + index * 1.19 + (survivalHash01(chunk.cx, chunk.cz, 5220 + index) - 0.5) * 0.16;
    const width = 9.8 + survivalHash01(chunk.cx, chunk.cz, 5250 + index) * 2.8;
    const depth = 8.2 + survivalHash01(chunk.cx, chunk.cz, 5280 + index) * 2.4;
    const height = 6.6 + survivalHash01(chunk.cx, chunk.cz, 5310 + index) * 1.8;

    huts[index] = {
      key: `${chunk.key}-mineshaft-hut-${index}`,
      angle,
      localX: Math.sin(angle) * MOUNTAIN_VILLAGE_MINESHAFT_HUT_RADIUS,
      localZ: Math.cos(angle) * MOUNTAIN_VILLAGE_MINESHAFT_HUT_RADIUS,
      y: bottomY + 12 + availableHeight * fraction,
      rotation: angle + Math.PI,
      width,
      depth,
      height,
      platformWidth: width + 5.8,
      platformDepth: depth * 0.72 + 7.8,
      bodyColor: bodyColors[index % bodyColors.length],
      roofColor: roofColors[index % roofColors.length],
      accentColor: accentColors[index % accentColors.length],
    };
  }

  return huts;
}

function makeMountainMineshaftLadders(
  chunk: SurvivalChunkInfo,
  baseHeight: number,
  huts: MountainMineshaftHut[],
  summitY: number,
): MountainMineshaftLadder[] {
  const bottomY = baseHeight + MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_BASE_OFFSET + MOUNTAIN_VILLAGE_MINESHAFT_LADDER_START_CLEARANCE;
  const ladders: MountainMineshaftLadder[] = [];

  for (let index = 0; index < huts.length; index += 1) {
    const hut = huts[index];
    const ladderAngle = hut.angle + (index % 2 === 0 ? -0.46 : 0.46) + index * 0.08;
    const startY = index === 0 ? bottomY : huts[index - 1].y + MOUNTAIN_VILLAGE_MINESHAFT_LADDER_START_CLEARANCE;

    ladders.push({
      key: `${chunk.key}-mineshaft-ladder-${index}`,
      angle: ladderAngle,
      localX: Math.sin(ladderAngle) * MOUNTAIN_VILLAGE_MINESHAFT_LADDER_RING_RADIUS,
      localZ: Math.cos(ladderAngle) * MOUNTAIN_VILLAGE_MINESHAFT_LADDER_RING_RADIUS,
      startY,
      endY: hut.y + MOUNTAIN_VILLAGE_MINESHAFT_LADDER_EXIT_CLEARANCE,
      rotation: ladderAngle + Math.PI,
      width: MOUNTAIN_VILLAGE_MINESHAFT_LADDER_WIDTH,
    });
  }

  const topHut = huts[huts.length - 1];
  if (topHut) {
    const exitAngle = topHut.angle + (huts.length % 2 === 0 ? 0.62 : -0.62);
    ladders.push({
      key: `${chunk.key}-mineshaft-top-exit-ladder`,
      angle: exitAngle,
      localX: Math.sin(exitAngle) * MOUNTAIN_VILLAGE_MINESHAFT_LADDER_RING_RADIUS,
      localZ: Math.cos(exitAngle) * MOUNTAIN_VILLAGE_MINESHAFT_LADDER_RING_RADIUS,
      startY: topHut.y + MOUNTAIN_VILLAGE_MINESHAFT_LADDER_START_CLEARANCE,
      endY: summitY + MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_Y_OFFSET + 1.45,
      rotation: exitAngle + Math.PI,
      width: MOUNTAIN_VILLAGE_MINESHAFT_LADDER_WIDTH,
    });
  }

  return ladders;
}

function makeMountainVillageHutInfos(
  chunk: SurvivalChunkInfo,
  summitY: number,
  cabins: MountainVillageCabin[],
  interiorHuts: MountainMineshaftHut[],
) {
  const hutInfos = new Array<HutInfo>(cabins.length + interiorHuts.length);

  for (let index = 0; index < cabins.length; index += 1) {
    const cabin = cabins[index];
    hutInfos[index] = {
      id: `${chunk.key}-mountain-hut-${index}`,
      x: chunk.x + cabin.localX,
      y: summitY,
      z: chunk.z + cabin.localZ,
      hutType: 2,
      colorIndex: index % 4,
      rotation: cabin.rotation,
      hasPath: true,
      pathRot: cabin.rotation,
      isMushroom: false,
      interiorWidth: cabin.width,
      interiorDepth: cabin.depth,
      interiorHeight: cabin.height,
      villagerBackOffset: Math.max(2.5, cabin.depth / 2 - 2.45),
      villagerSideOffset: (index % 2 === 0 ? -1 : 1) * Math.min(0.9, cabin.width * 0.05),
      villagerYOffset: 0.95,
      villagerTheme: "village",
    };
  }

  for (let index = 0; index < interiorHuts.length; index += 1) {
    const hut = interiorHuts[index];
    hutInfos[cabins.length + index] = {
      id: `${chunk.key}-mountain-interior-hut-${index}`,
      x: chunk.x + hut.localX,
      y: hut.y + 0.48,
      z: chunk.z + hut.localZ,
      hutType: 2,
      colorIndex: (index + 1) % 4,
      rotation: hut.rotation,
      hasPath: true,
      pathRot: hut.rotation,
      isMushroom: false,
      interiorWidth: hut.width,
      interiorDepth: hut.depth,
      interiorHeight: hut.height,
      villagerBackOffset: Math.max(2.2, hut.depth / 2 + 1.4),
      villagerSideOffset: (index % 2 === 0 ? -1 : 1) * 0.55,
      villagerYOffset: 0.95,
      villagerTheme: "village",
    };
  }

  return hutInfos;
}

function makeMountainVillageLayout(
  chunk: SurvivalChunkInfo,
  baseHeight: number,
  terrainHeightForChunk: SurvivalTerrainHeightForChunk,
  options: MountainVillageLayoutOptions = {},
): MountainVillageLayout {
  const summitY = getMountainVillageHeight(chunk, 0, 0, terrainHeightForChunk, baseHeight) + 0.18;
  const trailPoints = makeMountainVillageTrailPoints(chunk, baseHeight, terrainHeightForChunk);
  const trailSegments = makeMountainVillageTrailSegments(chunk, baseHeight, trailPoints, terrainHeightForChunk);
  const cliffPatches = makeMountainVillageCliffPatches(chunk, baseHeight, terrainHeightForChunk);
  const cabinCount = chunk.lod === "near" ? 8 : 5;
  const bodyColors = ["#584633", "#64513d", "#4f4538", "#6b573f"];
  const roofColors = ["#dceefa", "#cfe4f3", "#edf7ff", "#b9d3e8"];
  const accentColors = ["#82d8ff", "#f5d28a", "#bce7ff", "#d6f4ff"];
  const cabins = new Array<MountainVillageCabin>(cabinCount);
  const roofColorOffset = Math.floor(survivalHash01(chunk.cx, chunk.cz, 4610) * roofColors.length);

  for (let index = 0; index < cabinCount; index += 1) {
    const angle = (Math.PI * 2 * index) / cabinCount + 0.28 + survivalHash01(chunk.cx, chunk.cz, 4480) * 0.2;
    const ring = 59 + (index % 2) * 12 + survivalHash01(chunk.cx, chunk.cz, 4510 + index) * 7;
    const width = 17 + survivalHash01(chunk.cx, chunk.cz, 4540 + index) * 7;
    const depth = 15 + survivalHash01(chunk.cx, chunk.cz, 4570 + index) * 6;
    const height = 9 + survivalHash01(chunk.cx, chunk.cz, 4600 + index) * 4;

    cabins[index] = {
      key: `${chunk.key}-mountain-cabin-${index}`,
      localX: Math.sin(angle) * ring,
      localZ: Math.cos(angle) * ring,
      rotation: angle + Math.PI,
      width,
      depth,
      height,
      bodyColor: bodyColors[index % bodyColors.length],
      roofColor: roofColors[(index + roofColorOffset) % roofColors.length],
      accentColor: accentColors[index % accentColors.length],
    };
  }
  const includeMineshaftLayout = options.includeMineshaftLayout ?? true;
  const interiorHuts = includeMineshaftLayout
    ? makeMountainMineshaftHuts(chunk, baseHeight, summitY)
    : [];
  const interiorLadders = includeMineshaftLayout
    ? makeMountainMineshaftLadders(chunk, baseHeight, interiorHuts, summitY)
    : [];
  const hutInfos = (options.includeVillagerHutInfos ?? true)
    ? makeMountainVillageHutInfos(chunk, summitY, cabins, interiorHuts)
    : [];
  const waterfallAngle = -Math.PI * 0.28 + survivalHash01(chunk.cx, chunk.cz, 4700) * 0.52;
  const topRadius = 112;
  const bottomRadius = MOUNTAIN_VILLAGE_TRAIL_START_RADIUS + 8;
  const topX = Math.sin(waterfallAngle) * topRadius;
  const topZ = Math.cos(waterfallAngle) * topRadius;
  const bottomX = Math.sin(waterfallAngle) * bottomRadius;
  const bottomZ = Math.cos(waterfallAngle) * bottomRadius;
  const waterfall: MountainVillageWaterfall = {
    angle: waterfallAngle,
    topX,
    topZ,
    topY: getMountainVillageHeight(chunk, topX, topZ, terrainHeightForChunk, baseHeight) + 4.8,
    bottomX,
    bottomZ,
    bottomY: getMountainVillageHeight(chunk, bottomX, bottomZ, terrainHeightForChunk, baseHeight) + 1.25,
    width: 12 + survivalHash01(chunk.cx, chunk.cz, 4730) * 7,
  };

  return {
    baseHeight,
    summitY,
    trailPoints,
    trailSegments,
    trailDeckGeometry: makeMountainVillageTrailDeckGeometry(trailPoints),
    trailTopGeometry: makeMountainVillageTrailSurfaceGeometry(trailPoints, 0.5, 0.5),
    trailColliderGeometry: makeMountainVillageTrailDeckGeometry(trailPoints),
    summitColliderGeometry: makeMountainVillageSummitColliderGeometry(summitY),
    cliffPatches,
    cabins,
    interiorHuts,
    interiorLadders,
    hutInfos,
    waterfall,
  };
}

function MountainCliffBreakup({ patches, showDetails }: { patches: MountainVillageCliffPatch[]; showDetails: boolean }) {
  if (!showDetails) return null;

  return (
    <group name="mountain-village-cliff-breakup">
      {patches.map((patch) => (
        <mesh
          key={patch.key}
          position={[patch.localX, patch.y, patch.localZ]}
          rotation={[0, patch.yaw, patch.roll]}
          castShadow={false}
          receiveShadow={showDetails}
        >
          <boxGeometry args={[patch.width, patch.thickness, patch.depth]} />
          <meshStandardMaterial color={patch.color} roughness={1} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

function getMountainCabinDoorMetrics(cabin: MountainVillageCabin) {
  const wallThickness = Math.min(1.05, cabin.width * 0.12, cabin.depth * 0.12);
  const doorWidth = Math.min(6.2, cabin.width - wallThickness * 4);
  const doorHeight = Math.min(7.4, cabin.height - 1.15);
  const frontWallWidth = Math.max(1.05, (cabin.width - doorWidth) / 2);
  const lintelHeight = Math.max(0.75, cabin.height - doorHeight);

  return { wallThickness, doorWidth, doorHeight, frontWallWidth, lintelHeight };
}

function RetroVerticalTimberDetails({
  height,
  width,
  depth,
  frontZ,
  bandColor = "#a67642",
  darkColor = "#1d130d",
  lightColor = "#6f4b2b",
}: {
  height: number;
  width: number;
  depth: number;
  frontZ?: number;
  bandColor?: string;
  darkColor?: string;
  lightColor?: string;
}) {
  const z = frontZ ?? depth / 2 + 0.035;
  const bandCount = Math.max(2, Math.min(6, Math.floor(height / 5.2)));

  return (
    <>
      {getCachedIndexRange(bandCount).map((index) => {
        const y = -height / 2 + (index + 1) * (height / (bandCount + 1));

        return (
          <Fragment key={`timber-band-${index}`}>
            <mesh position={[0, y, z]} castShadow={false}>
              <boxGeometry args={[width + 0.28, 0.28, 0.12]} />
              <meshBasicMaterial color={bandColor} />
            </mesh>
            {[-1, 1].map((side) => (
              <mesh key={`timber-bolt-${side}`} position={[side * width * 0.32, y + 0.01, z + 0.07]} castShadow={false}>
                <boxGeometry args={[0.18, 0.18, 0.12]} />
                <meshBasicMaterial color="#d7a85e" />
              </mesh>
            ))}
          </Fragment>
        );
      })}
      {[-0.27, 0.26].map((offset, index) => (
        <mesh key={`timber-grain-${index}`} position={[offset * width, 0, z + 0.04]} castShadow={false}>
          <boxGeometry args={[0.08, height * 0.86, 0.08]} />
          <meshBasicMaterial color={index === 0 ? darkColor : lightColor} transparent opacity={0.82} />
        </mesh>
      ))}
      <RetroPixelWoodTexture width={width * 0.82} height={height * 0.86} z={z + 0.12} count={Math.max(5, Math.min(14, Math.floor(height / 2.8)))} seed={Math.floor(height + width * 5)} dark />
      {[-1, 1].map((side) => (
        <mesh key={`timber-dark-edge-${side}`} position={[side * (width / 2 + 0.03), 0, z + 0.02]} castShadow={false}>
          <boxGeometry args={[0.12, height * 0.92, 0.1]} />
          <meshBasicMaterial color="#080504" transparent opacity={0.62} />
        </mesh>
      ))}
      <mesh position={[0, -height / 2 + 0.2, z + 0.05]} castShadow={false}>
        <boxGeometry args={[width + 0.22, 0.18, 0.12]} />
        <meshBasicMaterial color="#090604" transparent opacity={0.72} />
      </mesh>
    </>
  );
}

function RetroHorizontalTimberDetails({
  length,
  height,
  depth,
  frontZ,
  bandColor = "#a67642",
  darkColor = "#21150d",
}: {
  length: number;
  height: number;
  depth: number;
  frontZ?: number;
  bandColor?: string;
  darkColor?: string;
}) {
  const z = frontZ ?? depth / 2 + 0.035;
  const bandCount = Math.max(2, Math.min(7, Math.floor(length / 5.8)));

  return (
    <>
      {getCachedIndexRange(bandCount).map((index) => {
        const x = -length / 2 + (index + 1) * (length / (bandCount + 1));

        return (
          <Fragment key={`horizontal-band-${index}`}>
            <mesh position={[x, 0, z]} castShadow={false}>
              <boxGeometry args={[0.28, height + 0.22, 0.13]} />
              <meshBasicMaterial color={bandColor} />
            </mesh>
            <mesh position={[x, height * 0.18, z + 0.08]} castShadow={false}>
              <boxGeometry args={[0.18, 0.18, 0.12]} />
              <meshBasicMaterial color="#d7a85e" />
            </mesh>
          </Fragment>
        );
      })}
      {[-0.2, 0.22].map((offset, index) => (
        <mesh key={`horizontal-grain-${index}`} position={[0, offset * height, z + 0.04]} castShadow={false}>
          <boxGeometry args={[length * 0.86, 0.08, 0.08]} />
          <meshBasicMaterial color={darkColor} transparent opacity={index === 0 ? 0.72 : 0.46} />
        </mesh>
      ))}
      <RetroPixelWoodTexture width={length * 0.86} height={height * 0.86} z={z + 0.12} count={Math.max(6, Math.min(16, Math.floor(length / 2.8)))} seed={Math.floor(length + height * 9)} dark />
      {[-1, 1].map((side) => (
        <mesh key={`horizontal-end-shadow-${side}`} position={[side * (length / 2 + 0.02), 0, z + 0.04]} castShadow={false}>
          <boxGeometry args={[0.16, height + 0.16, 0.12]} />
          <meshBasicMaterial color="#080504" transparent opacity={0.68} />
        </mesh>
      ))}
      <mesh position={[0, -height / 2 - 0.02, z + 0.04]} castShadow={false}>
        <boxGeometry args={[length * 0.96, 0.14, 0.12]} />
        <meshBasicMaterial color="#090604" transparent opacity={0.58} />
      </mesh>
    </>
  );
}

function RetroPixelWoodTexture({
  width,
  height,
  z = 0.08,
  count = 10,
  seed = 0,
  dark = false,
}: {
  width: number;
  height: number;
  z?: number;
  count?: number;
  seed?: number;
  dark?: boolean;
}) {
  const colors = dark ? ["#0a0604", "#1a100a", "#2f1d11", "#4d301b"] : ["#1b1009", "#3c2415", "#704627", "#b47a3f"];

  return (
    <>
      {getCachedIndexRange(count).map((index) => {
        const t = ((index * 37 + seed * 19) % 100) / 100;
        const u = ((index * 53 + seed * 11) % 100) / 100;
        const x = -width * 0.42 + t * width * 0.84;
        const y = -height * 0.38 + u * height * 0.76;
        const pieceWidth = width * (0.09 + ((index + seed) % 3) * 0.045);
        const pieceHeight = Math.max(0.08, height * (0.025 + (index % 2) * 0.012));

        return (
          <mesh key={`pixel-wood-${index}`} position={[x, y, z]} castShadow={false}>
            <boxGeometry args={[pieceWidth, pieceHeight, 0.08]} />
            <meshBasicMaterial color={colors[(index + seed) % colors.length]} transparent opacity={dark ? 0.76 : 0.68} />
          </mesh>
        );
      })}
      {getCachedIndexRange(Math.max(2, Math.floor(count / 4))).map((index) => {
        const t = ((index * 29 + seed * 7) % 100) / 100;
        const u = ((index * 41 + seed * 13) % 100) / 100;

        return (
          <mesh key={`pixel-knot-${index}`} position={[-width * 0.36 + t * width * 0.72, -height * 0.32 + u * height * 0.64, z + 0.02]} castShadow={false}>
            <boxGeometry args={[Math.max(0.28, width * 0.08), Math.max(0.18, height * 0.035), 0.1]} />
            <meshBasicMaterial color="#090604" transparent opacity={0.72} />
          </mesh>
        );
      })}
    </>
  );
}

function MountainHutDoorPanel({
  doorWidth,
  doorHeight,
  floorY,
  frontZ,
  compact = false,
}: {
  doorWidth: number;
  doorHeight: number;
  floorY: number;
  frontZ: number;
  compact?: boolean;
}) {
  const panelWidth = doorWidth * 0.86;
  const panelHeight = doorHeight * 0.84;
  const boardCount = compact ? 3 : 4;
  const boardWidth = panelWidth / boardCount;
  const panelY = floorY + doorHeight * 0.46;
  const panelZ = frontZ + 0.42;

  return (
    <group name="solid-pixel-wood-door">
      <mesh position={[0, panelY, panelZ - 0.04]} castShadow={false}>
        <boxGeometry args={[panelWidth + 0.28, panelHeight + 0.22, 0.32]} />
        <meshBasicMaterial color="#1b1009" />
      </mesh>
      {getCachedIndexRange(boardCount).map((index) => {
        const x = -panelWidth / 2 + boardWidth * (index + 0.5);

        return (
          <group key={`door-board-${index}`} position={[x, panelY, panelZ]}>
            <mesh castShadow={false}>
              <boxGeometry args={[boardWidth + 0.04, panelHeight, 0.24]} />
              <meshBasicMaterial color={index % 2 === 0 ? "#6f4528" : "#4c2e1a"} />
            </mesh>
            <RetroPixelWoodTexture width={boardWidth * 0.88} height={panelHeight * 0.92} z={0.16} count={compact ? 5 : 7} seed={index + (compact ? 8 : 2)} />
          </group>
        );
      })}
      {getCachedIndexRange(boardCount + 1).map((index) => {
        const x = -panelWidth / 2 + index * boardWidth;

        return (
          <mesh key={`door-board-gap-${index}`} position={[x, panelY, panelZ + 0.18]} castShadow={false}>
            <boxGeometry args={[0.1, panelHeight * 0.96, 0.1]} />
            <meshBasicMaterial color="#080504" />
          </mesh>
        );
      })}
      {[0.31, 0.64].map((heightRatio, index) => (
        <mesh key={`door-cross-brace-${index}`} position={[0, floorY + doorHeight * heightRatio, panelZ + 0.24]} castShadow={false}>
          <boxGeometry args={[panelWidth + 0.42, 0.42, 0.2]} />
          <meshBasicMaterial color={index === 0 ? "#2a180d" : "#9a6333"} />
        </mesh>
      ))}
      <mesh position={[panelWidth * 0.24, floorY + doorHeight * 0.5, panelZ + 0.34]} castShadow={false}>
        <boxGeometry args={[0.36, 0.36, 0.22]} />
        <meshBasicMaterial color="#d0a05d" />
      </mesh>
      <mesh position={[0, floorY + doorHeight + 0.08, panelZ + 0.08]} castShadow={false}>
        <boxGeometry args={[panelWidth + 0.72, 0.24, 0.16]} />
        <meshBasicMaterial color="#070504" transparent opacity={0.78} />
      </mesh>
    </group>
  );
}

function MountainHutWallDetails({
  width,
  depth,
  height,
  floorY,
  frontZ,
  backZ,
  doorWidth,
  doorHeight,
  compact = false,
}: {
  width: number;
  depth: number;
  height: number;
  floorY: number;
  frontZ: number;
  backZ: number;
  doorWidth: number;
  doorHeight: number;
  compact?: boolean;
}) {
  const frontPlankCount = compact ? 5 : 7;
  const sidePlankCount = compact ? 4 : 5;
  const lowerBandY = floorY + 1.2;
  const upperBandY = floorY + height - 1.2;
  const frontPanelWidth = Math.max(1.2, (width - doorWidth) / 2);

  return (
    <>
      {getCachedIndexRange(frontPlankCount).map((index) => {
        const x = -width / 2 + ((index + 1) * width) / (frontPlankCount + 1);
        if (Math.abs(x) < doorWidth / 2 + 0.55) return null;

        return (
          <mesh key={`front-plank-seam-${index}`} position={[x, floorY + height / 2, frontZ + 0.2]} castShadow={false}>
            <boxGeometry args={[0.12, height * 0.78, 0.14]} />
            <meshBasicMaterial color="#21160f" transparent opacity={0.72} />
          </mesh>
        );
      })}
      {[-1, 1].map((side) => (
        <Fragment key={`side-wall-detail-${side}`}>
          {getCachedIndexRange(sidePlankCount).map((index) => {
            const z = -depth / 2 + ((index + 1) * depth) / (sidePlankCount + 1);

            return (
              <mesh key={`side-plank-${index}`} position={[side * (width / 2 + 0.08), floorY + height / 2, z]} castShadow={false}>
                <boxGeometry args={[0.12, height * 0.72, 0.1]} />
                <meshBasicMaterial color={index % 2 === 0 ? "#241810" : "#7b5332"} transparent opacity={0.62} />
              </mesh>
            );
          })}
        </Fragment>
      ))}
      {[lowerBandY, upperBandY].map((y, index) => (
        <Fragment key={`wall-band-${index}`}>
          <mesh position={[0, y, frontZ + 0.24]} castShadow={false}>
            <boxGeometry args={[width + 0.58, 0.32, 0.2]} />
            <meshBasicMaterial color={index === 0 ? "#2b1c12" : "#805832"} />
          </mesh>
          <mesh position={[0, y, backZ - 0.18]} castShadow={false}>
            <boxGeometry args={[width + 0.28, 0.24, 0.18]} />
            <meshBasicMaterial color="#2b1c12" />
          </mesh>
        </Fragment>
      ))}
      {[-1, 1].map((side) => (
        <Fragment key={`hut-corner-shadow-${side}`}>
          <mesh position={[side * (width / 2 + 0.18), floorY + height / 2, frontZ + 0.18]} castShadow={false}>
            <boxGeometry args={[0.34, height + 0.44, 0.22]} />
            <meshBasicMaterial color="#0b0705" transparent opacity={0.76} />
          </mesh>
          <mesh position={[side * (width / 2 + 0.12), floorY + height / 2, backZ - 0.1]} castShadow={false}>
            <boxGeometry args={[0.24, height * 0.9, 0.2]} />
            <meshBasicMaterial color="#0b0705" transparent opacity={0.58} />
          </mesh>
        </Fragment>
      ))}
      <mesh position={[0, floorY + 0.34, frontZ + 0.3]} castShadow={false}>
        <boxGeometry args={[width + 0.86, 0.42, 0.22]} />
        <meshBasicMaterial color="#0c0805" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, floorY + height + 0.14, frontZ + 0.26]} castShadow={false}>
        <boxGeometry args={[width + 1.1, 0.3, 0.2]} />
        <meshBasicMaterial color="#100b07" transparent opacity={0.68} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={`front-wall-pixel-wood-${side}`} position={[side * (doorWidth / 2 + frontPanelWidth / 2), floorY + height / 2, frontZ + 0.36]}>
          <RetroPixelWoodTexture width={frontPanelWidth * 0.82} height={height * 0.78} z={0} count={compact ? 7 : 10} seed={side > 0 ? 4 : 9} dark />
        </group>
      ))}
      <MountainHutDoorPanel doorWidth={doorWidth} doorHeight={doorHeight} floorY={floorY} frontZ={frontZ} compact={compact} />
    </>
  );
}

function MountainHutRoofDetails({
  width,
  depth,
  roofBaseY,
  roofHeight,
  compact = false,
}: {
  width: number;
  depth: number;
  roofBaseY: number;
  roofHeight: number;
  compact?: boolean;
}) {
  const rowCount = compact ? 3 : 4;
  const frontZ = depth * 0.44;
  const sideX = width * 0.44;

  return (
    <>
      {getCachedIndexRange(rowCount).map((index) => {
        const t = (index + 1) / (rowCount + 1);
        const y = roofBaseY + t * roofHeight;
        const widthScale = lerpNumber(width * 0.84, width * 0.32, t);
        const depthScale = lerpNumber(depth * 0.84, depth * 0.32, t);

        return (
          <Fragment key={`roof-shingle-row-${index}`}>
            <mesh position={[0, y, frontZ - t * depth * 0.2]} castShadow={false}>
              <boxGeometry args={[widthScale, 0.16, 0.24]} />
              <meshBasicMaterial color={index % 2 === 0 ? "#311f15" : "#8f6338"} />
            </mesh>
            <mesh position={[0, y + 0.06, -frontZ + t * depth * 0.2]} castShadow={false}>
              <boxGeometry args={[widthScale * 0.86, 0.14, 0.2]} />
              <meshBasicMaterial color="#2a1b12" />
            </mesh>
            <mesh position={[sideX - t * width * 0.22, y + 0.02, 0]} castShadow={false}>
              <boxGeometry args={[0.2, 0.14, depthScale]} />
              <meshBasicMaterial color="#7b5332" />
            </mesh>
            <mesh position={[-sideX + t * width * 0.22, y + 0.02, 0]} castShadow={false}>
              <boxGeometry args={[0.2, 0.14, depthScale]} />
              <meshBasicMaterial color="#2a1b12" />
            </mesh>
          </Fragment>
        );
      })}
      <mesh position={[0, roofBaseY + 0.28, frontZ + 0.22]} castShadow={false}>
        <boxGeometry args={[width * 1.06, 0.26, 0.32]} />
        <meshBasicMaterial color="#080504" transparent opacity={0.78} />
      </mesh>
      <mesh position={[0, roofBaseY + 0.24, -frontZ - 0.18]} castShadow={false}>
        <boxGeometry args={[width * 0.92, 0.22, 0.28]} />
        <meshBasicMaterial color="#080504" transparent opacity={0.62} />
      </mesh>
      <mesh position={[0, roofBaseY + roofHeight * 0.86, 0]} castShadow={false}>
        <boxGeometry args={[width * 0.3, 0.22, depth * 0.3]} />
        <meshBasicMaterial color="#090605" transparent opacity={0.72} />
      </mesh>
      <mesh position={[-width * 0.24, roofBaseY + roofHeight * 0.66, depth * 0.2]} castShadow={false}>
        <boxGeometry args={[width * 0.28, 0.2, 0.42]} />
        <meshBasicMaterial color="#f7fcff" transparent opacity={0.82} />
      </mesh>
      <mesh position={[width * 0.18, roofBaseY + roofHeight * 0.5, -depth * 0.28]} castShadow={false}>
        <boxGeometry args={[width * 0.22, 0.18, 0.36]} />
        <meshBasicMaterial color="#cdeafa" transparent opacity={0.7} />
      </mesh>
    </>
  );
}

function RetroWindowDetails({ x, y, z, width, height }: { x: number; y: number; z: number; width: number; height: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh castShadow={false}>
        <boxGeometry args={[width + 0.32, height + 0.32, 0.12]} />
        <meshBasicMaterial color="#18100a" transparent opacity={0.54} />
      </mesh>
      <mesh position={[0, -height / 2 - 0.15, 0.16]} castShadow={false}>
        <boxGeometry args={[width + 0.62, 0.24, 0.14]} />
        <meshBasicMaterial color="#050403" transparent opacity={0.82} />
      </mesh>
      <mesh position={[0, 0, 0.1]} castShadow={false}>
        <boxGeometry args={[0.18, height + 0.42, 0.14]} />
        <meshBasicMaterial color="#2b1c12" />
      </mesh>
      <mesh position={[0, 0, 0.12]} castShadow={false}>
        <boxGeometry args={[width + 0.42, 0.18, 0.14]} />
        <meshBasicMaterial color="#2b1c12" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={`window-glint-${side}`} position={[side * width * 0.24, height * 0.18, 0.16]} castShadow={false}>
          <boxGeometry args={[0.28, 0.34, 0.1]} />
          <meshBasicMaterial color="#fff1a9" transparent opacity={0.58} />
        </mesh>
      ))}
    </group>
  );
}

function MountainVillageTrail({ layout, showDetails }: { layout: MountainVillageLayout; showDetails: boolean }) {
  const segments = layout.trailSegments;
  const supports: MountainVillageTrailSupport[] = [];
  if (showDetails) {
    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
      const segmentSupports = segments[segmentIndex].supports;
      for (let supportIndex = 0; supportIndex < segmentSupports.length; supportIndex += 1) {
        supports.push(segmentSupports[supportIndex]);
      }
    }
  }

  return (
    <group name="mountain-village-wrapping-trail">
      <mesh geometry={layout.trailDeckGeometry} castShadow={false} receiveShadow dispose={null}>
        <meshBasicMaterial color="#4b3827" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={layout.trailTopGeometry} castShadow={false} receiveShadow dispose={null} renderOrder={2}>
        <meshBasicMaterial color="#74613f" side={THREE.DoubleSide} />
      </mesh>
      {segments.map((segment) => {
        const hasLanding = showDetails && (segment.index === 0 || segment.index === segments.length - 1);
        const landingLength = Math.min(22, segment.length * 0.72);
        const landingZ = segment.index === 0 ? -segment.length * 0.28 : segment.length * 0.28;

        return (
          <group key={segment.key} position={[segment.localX, segment.y, segment.localZ]} rotation={[segment.slope, segment.yaw, 0]}>
            <mesh position={[-segment.width / 2 + 0.94, -0.72, 0]} castShadow={false}>
              <boxGeometry args={[1.24, 0.54, segment.length * 1.02]} />
              <meshBasicMaterial color="#2f2117" />
            </mesh>
            <mesh position={[segment.width / 2 - 0.94, -0.72, 0]} castShadow={false}>
              <boxGeometry args={[1.24, 0.54, segment.length * 1.02]} />
              <meshBasicMaterial color="#2f2117" />
            </mesh>
            {showDetails && (
              <>
                {hasLanding && (
                  <mesh position={[0, -0.96, landingZ]} castShadow={false}>
                    <boxGeometry args={[segment.width * 1.08, 0.42, landingLength * 0.84]} />
                    <meshBasicMaterial color="#3a2719" />
                  </mesh>
                )}
                {[-1, 1].map((side) => (
                  <mesh key={`trail-top-shadow-${side}`} position={[side * (segment.width / 2 - 0.52), 0.08, 0]} castShadow={false}>
                    <boxGeometry args={[0.42, 0.08, segment.length * 0.92]} />
                    <meshBasicMaterial color="#120c08" transparent opacity={0.5} />
                  </mesh>
                ))}
                {getCachedIndexRange(4).map((plankIndex) => {
                  const z = -segment.length * 0.38 + plankIndex * ((segment.length * 0.76) / 3);

                  return (
                    <mesh key={`trail-cross-shadow-${plankIndex}`} position={[0, 0.1, z]} castShadow={false}>
                      <boxGeometry args={[segment.width * 0.86, 0.07, 0.18]} />
                      <meshBasicMaterial color={plankIndex % 2 === 0 ? "#16100b" : "#5b3b22"} transparent opacity={0.58} />
                    </mesh>
                  );
                })}
                <mesh position={[0, -0.32, 0]} castShadow={false}>
                  <boxGeometry args={[segment.width * 1.02, 0.16, segment.length * 0.96]} />
                  <meshBasicMaterial color="#090604" transparent opacity={0.3} />
                </mesh>
                <mesh position={[0, -1.02, -segment.length * 0.34]} castShadow={false}>
                  <boxGeometry args={[segment.width + 1.6, 0.5, 0.9]} />
                  <meshBasicMaterial color="#3a2719" />
                </mesh>
                <mesh position={[0, -1.02, segment.length * 0.34]} castShadow={false}>
                  <boxGeometry args={[segment.width + 1.6, 0.5, 0.9]} />
                  <meshBasicMaterial color="#3a2719" />
                </mesh>
                <mesh position={[0, -1.3, 0]} rotation={[0, 0, 0.24]} castShadow={false}>
                  <boxGeometry args={[segment.width * 0.72, 0.42, 0.72]} />
                  <meshBasicMaterial color="#5b4029" />
                </mesh>
                <mesh position={[0, -1.3, 0]} rotation={[0, 0, -0.24]} castShadow={false}>
                  <boxGeometry args={[segment.width * 0.72, 0.42, 0.72]} />
                  <meshBasicMaterial color="#5b4029" />
                </mesh>
              </>
            )}
          </group>
        );
      })}
      {showDetails && supports.map((support) => (
        <group key={support.key} position={[support.localX, support.topY - support.height / 2, support.localZ]} rotation={[0, support.yaw, 0]}>
          <mesh castShadow={false}>
            <boxGeometry args={[2.15, support.height, 2.15]} />
            <meshBasicMaterial color="#2f2117" />
          </mesh>
          <RetroVerticalTimberDetails height={support.height} width={2.15} depth={2.15} bandColor="#8e6137" />
          <mesh position={[0, -support.height / 2 - 0.08, 0]} castShadow={false}>
            <boxGeometry args={[5.6, 0.62, 5.6]} />
            <meshBasicMaterial color="#4b3524" />
          </mesh>
          <mesh position={[0, -support.height / 2 + 0.25, -2.92]} castShadow={false}>
            <boxGeometry args={[4.6, 0.2, 0.18]} />
            <meshBasicMaterial color="#080504" transparent opacity={0.82} />
          </mesh>
          <mesh position={[0, -support.height / 2 + 0.28, 2.92]} castShadow={false}>
            <boxGeometry args={[4.6, 0.18, 0.16]} />
            <meshBasicMaterial color="#9a7045" />
          </mesh>
          {support.height > 4.2 && (
            <>
              <group position={[support.side * 0.98, -support.height * 0.08, 0]} rotation={[0, 0, -support.side * 0.24]}>
                <mesh castShadow={false}>
                  <boxGeometry args={[0.9, support.height * 0.86, 0.9]} />
                  <meshBasicMaterial color="#3f2d1f" />
                </mesh>
                <RetroVerticalTimberDetails height={support.height * 0.86} width={0.9} depth={0.9} bandColor="#6d4a2e" />
              </group>
              <group position={[-support.side * 0.9, -support.height * 0.14, 0]} rotation={[0, 0, support.side * 0.18]}>
                <mesh castShadow={false}>
                  <boxGeometry args={[0.72, support.height * 0.7, 0.72]} />
                  <meshBasicMaterial color="#5b4029" />
                </mesh>
                <RetroVerticalTimberDetails height={support.height * 0.7} width={0.72} depth={0.72} bandColor="#a67642" />
              </group>
            </>
          )}
        </group>
      ))}
    </group>
  );
}

function MountainCabin({ cabin, summitY, showDetails }: { cabin: MountainVillageCabin; summitY: number; showDetails: boolean }) {
  const { wallThickness, doorWidth, doorHeight, frontWallWidth, lintelHeight } = getMountainCabinDoorMetrics(cabin);
  const frontZ = cabin.depth / 2 - wallThickness / 2;
  const backZ = -cabin.depth / 2 + wallThickness / 2;

  return (
    <group position={[cabin.localX, summitY, cabin.localZ]} rotation={[0, cabin.rotation, 0]}>
      <mesh position={[0, 0.18, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[cabin.width + 0.8, 0.36, cabin.depth + 0.8]} />
        <meshBasicMaterial color="#4b3826" />
      </mesh>
      {showDetails && (
        <>
          <mesh position={[0, 0.42, cabin.depth / 2 + 0.52]} castShadow={false}>
            <boxGeometry args={[cabin.width + 1.15, 0.18, 0.24]} />
            <meshBasicMaterial color="#080504" transparent opacity={0.78} />
          </mesh>
          <mesh position={[0, 0.38, -cabin.depth / 2 - 0.44]} castShadow={false}>
            <boxGeometry args={[cabin.width + 0.7, 0.14, 0.22]} />
            <meshBasicMaterial color="#080504" transparent opacity={0.56} />
          </mesh>
        </>
      )}
      <mesh position={[-cabin.width / 2 + wallThickness / 2, cabin.height / 2, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[wallThickness, cabin.height, cabin.depth]} />
        <meshBasicMaterial color={cabin.bodyColor} />
      </mesh>
      <mesh position={[cabin.width / 2 - wallThickness / 2, cabin.height / 2, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[wallThickness, cabin.height, cabin.depth]} />
        <meshBasicMaterial color={cabin.bodyColor} />
      </mesh>
      <mesh position={[0, cabin.height / 2, backZ]} castShadow={false} receiveShadow>
        <boxGeometry args={[cabin.width, cabin.height, wallThickness]} />
        <meshBasicMaterial color={cabin.bodyColor} />
      </mesh>
      <mesh position={[-doorWidth / 2 - frontWallWidth / 2, cabin.height / 2, frontZ]} castShadow={false} receiveShadow>
        <boxGeometry args={[frontWallWidth, cabin.height, wallThickness]} />
        <meshBasicMaterial color={cabin.bodyColor} />
      </mesh>
      <mesh position={[doorWidth / 2 + frontWallWidth / 2, cabin.height / 2, frontZ]} castShadow={false} receiveShadow>
        <boxGeometry args={[frontWallWidth, cabin.height, wallThickness]} />
        <meshBasicMaterial color={cabin.bodyColor} />
      </mesh>
      <mesh position={[0, doorHeight + lintelHeight / 2, frontZ]} castShadow={false} receiveShadow>
        <boxGeometry args={[doorWidth, lintelHeight, wallThickness]} />
        <meshBasicMaterial color={cabin.bodyColor} />
      </mesh>
      <mesh position={[0, doorHeight * 0.46, cabin.depth / 2 + 0.16]} castShadow={false}>
        <boxGeometry args={[doorWidth * 0.84, doorHeight * 0.86, 0.32]} />
        <meshBasicMaterial color="#4c2e1a" />
      </mesh>
      <mesh position={[0, cabin.height + 4.2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={false} receiveShadow>
        <coneGeometry args={[Math.max(cabin.width, cabin.depth) * 0.78, 9.2, 4]} />
        <meshBasicMaterial color={cabin.roofColor} />
      </mesh>
      <mesh position={[0, cabin.height + 8.9, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={false}>
        <coneGeometry args={[Math.max(cabin.width, cabin.depth) * 0.34, 3.4, 4]} />
        <meshBasicMaterial color="#f8fdff" />
      </mesh>
      <mesh position={[-doorWidth / 2 - 0.28, doorHeight / 2, cabin.depth / 2 + 0.12]} castShadow={false}>
        <boxGeometry args={[0.56, doorHeight, 0.62]} />
        <meshBasicMaterial color="#251a12" />
      </mesh>
      <mesh position={[doorWidth / 2 + 0.28, doorHeight / 2, cabin.depth / 2 + 0.12]} castShadow={false}>
        <boxGeometry args={[0.56, doorHeight, 0.62]} />
        <meshBasicMaterial color="#251a12" />
      </mesh>
      <mesh position={[0, doorHeight + 0.28, cabin.depth / 2 + 0.12]} castShadow={false}>
        <boxGeometry args={[doorWidth + 1.1, 0.56, 0.62]} />
        <meshBasicMaterial color="#251a12" />
      </mesh>
      <mesh position={[0, 3.25, backZ + 0.08]} castShadow={false}>
        <boxGeometry args={[doorWidth * 0.86, 5.1, 0.22]} />
        <meshBasicMaterial color="#251a12" />
      </mesh>
      {showDetails && (
        <>
          <MountainHutWallDetails
            width={cabin.width}
            depth={cabin.depth}
            height={cabin.height}
            floorY={0}
            frontZ={cabin.depth / 2 + 0.08}
            backZ={-cabin.depth / 2 - 0.08}
            doorWidth={doorWidth}
            doorHeight={doorHeight}
          />
          <MountainHutRoofDetails width={cabin.width} depth={cabin.depth} roofBaseY={cabin.height + 0.35} roofHeight={7.8} />
          <mesh position={[-cabin.width * 0.27, 5.9, cabin.depth / 2 + 0.16]} castShadow={false}>
            <boxGeometry args={[3.4, 2.8, 0.36]} />
            <meshBasicMaterial color={cabin.accentColor} transparent opacity={0.88} />
          </mesh>
          <RetroWindowDetails x={-cabin.width * 0.27} y={5.9} z={cabin.depth / 2 + 0.4} width={3.1} height={2.5} />
          <mesh position={[cabin.width * 0.27, 5.9, cabin.depth / 2 + 0.16]} castShadow={false}>
            <boxGeometry args={[3.4, 2.8, 0.36]} />
            <meshBasicMaterial color={cabin.accentColor} transparent opacity={0.88} />
          </mesh>
          <RetroWindowDetails x={cabin.width * 0.27} y={5.9} z={cabin.depth / 2 + 0.4} width={3.1} height={2.5} />
          <mesh position={[0, cabin.height + 2.4, cabin.depth * 0.18]} castShadow={false}>
            <boxGeometry args={[2.2, 5.4, 2.2]} />
            <meshBasicMaterial color="#3b2b1d" />
          </mesh>
          <mesh position={[0, cabin.height + 5.4, cabin.depth * 0.18]} castShadow={false}>
            <boxGeometry args={[3.2, 1.2, 3.2]} />
            <meshBasicMaterial color="#d8edf8" />
          </mesh>
          <mesh position={[0, cabin.height + 4.82, cabin.depth * 0.18 + 1.72]} castShadow={false}>
            <boxGeometry args={[3.55, 0.18, 0.2]} />
            <meshBasicMaterial color="#080504" transparent opacity={0.62} />
          </mesh>
        </>
      )}
    </group>
  );
}

function RetroMineshaftLantern({
  position,
  scale = 1,
  withLight = true,
  glowScale = 1,
  lightIntensity = 4.8,
  lightDistance = 22,
}: {
  position: [number, number, number];
  scale?: number;
  withLight?: boolean;
  glowScale?: number;
  lightIntensity?: number;
  lightDistance?: number;
}) {
  return (
    <group position={position} scale={[scale, scale, scale]}>
      <mesh position={[0, 0.78, 0.07]} castShadow={false} renderOrder={6}>
        <sphereGeometry args={[1.28 * glowScale, 8, 6]} />
        <meshBasicMaterial color="#ff9d36" transparent opacity={0.28} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.78, 0.12]} castShadow={false} renderOrder={7}>
        <sphereGeometry args={[0.74 * glowScale, 8, 6]} />
        <meshBasicMaterial color="#ffd56f" transparent opacity={0.38} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.78, 0]} castShadow={false}>
        <boxGeometry args={[0.82, 0.92, 0.82]} />
        <meshBasicMaterial color="#2a1b12" />
      </mesh>
      <mesh position={[0, 0.78, 0.04]} castShadow={false}>
        <boxGeometry args={[0.52, 0.62, 0.64]} />
        <meshBasicMaterial color="#ffc15d" transparent opacity={0.96} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.78, 0.08]} castShadow={false}>
        <boxGeometry args={[0.2, 0.72, 0.72]} />
        <meshBasicMaterial color="#fff0b2" transparent opacity={0.72} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.78, 0.42]} castShadow={false} renderOrder={8}>
        <boxGeometry args={[0.82 * glowScale, 0.92 * glowScale, 0.04]} />
        <meshBasicMaterial color="#ffcb62" transparent opacity={0.32} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.34, 0]} castShadow={false}>
        <boxGeometry args={[1.02, 0.22, 1.02]} />
        <meshBasicMaterial color="#51331f" />
      </mesh>
      <mesh position={[0, 0.22, 0]} castShadow={false}>
        <boxGeometry args={[0.92, 0.22, 0.92]} />
        <meshBasicMaterial color="#51331f" />
      </mesh>
      <mesh position={[0, 1.63, 0]} castShadow={false}>
        <boxGeometry args={[0.18, 0.42, 0.18]} />
        <meshBasicMaterial color="#1b120c" />
      </mesh>
      {withLight && <pointLight color="#ffb65b" intensity={lightIntensity} distance={lightDistance} decay={1.85} position={[0, 0.84, 0]} />}
    </group>
  );
}

function MountainMineshaftLightPole({
  position,
  direction = 1,
  withLight = false,
}: {
  position: [number, number, number];
  direction?: -1 | 1;
  withLight?: boolean;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 1.72, 0]} castShadow={false}>
        <boxGeometry args={[0.42, 3.44, 0.42]} />
        <meshBasicMaterial color="#22150d" />
      </mesh>
      <mesh position={[direction * 0.68, 3.28, 0]} castShadow={false}>
        <boxGeometry args={[1.62, 0.32, 0.32]} />
        <meshBasicMaterial color="#392414" />
      </mesh>
      <mesh position={[direction * 1.38, 2.94, 0]} castShadow={false}>
        <boxGeometry args={[0.18, 0.7, 0.18]} />
        <meshBasicMaterial color="#1b120c" />
      </mesh>
      <RetroMineshaftLantern position={[direction * 1.38, 1.72, 0]} scale={0.78} withLight={withLight} />
    </group>
  );
}

function MountainMineshaftWallHangingLantern({
  angle,
  y,
  index,
  withLight,
}: {
  angle: number;
  y: number;
  index: number;
  withLight: boolean;
}) {
  const radius = MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS - 0.72;

  return (
    <group position={[Math.sin(angle) * radius, y, Math.cos(angle) * radius]} rotation={[0, angle, 0]}>
      <mesh position={[0, 0.42, -0.08]} castShadow={false}>
        <boxGeometry args={[2.9, 0.68, 0.34]} />
        <meshBasicMaterial color="#1b1009" />
      </mesh>
      <mesh position={[0, 0.14, -0.92]} castShadow={false}>
        <boxGeometry args={[2.54, 0.34, 1.96]} />
        <meshBasicMaterial color={index % 2 === 0 ? "#53331d" : "#342113"} />
      </mesh>
      <mesh position={[0, -0.84, -1.84]} castShadow={false}>
        <boxGeometry args={[0.24, 1.62, 0.24]} />
        <meshBasicMaterial color="#0f0906" />
      </mesh>
      <mesh position={[0, -1.74, -1.84]} rotation={[0, 0, Math.PI / 4]} castShadow={false}>
        <torusGeometry args={[0.54, 0.08, 4, 8]} />
        <meshBasicMaterial color="#2a1a10" />
      </mesh>
      <RetroMineshaftLantern position={[0, -2.9, -1.84]} scale={1.02} glowScale={1.55} lightIntensity={8.8} lightDistance={34} withLight={withLight} />
    </group>
  );
}

function MountainMineshaftWallLanterns({
  bottomY,
  summitY,
  showDetails,
}: {
  bottomY: number;
  summitY: number;
  showDetails: boolean;
}) {
  if (!showDetails) return null;

  const topY = summitY - 8.2;
  const lowerY = bottomY + 14.5;
  const usableHeight = Math.max(36, topY - lowerY);

  return (
    <group name="mineshaft-wall-hanging-lanterns">
      {getCachedIndexRange(MOUNTAIN_VILLAGE_MINESHAFT_WALL_LANTERN_COUNT).map((index) => {
        const t = index / Math.max(1, MOUNTAIN_VILLAGE_MINESHAFT_WALL_LANTERN_COUNT - 1);
        const y = topY - t * usableHeight;
        const angle = -0.7 + index * MOUNTAIN_VILLAGE_MINESHAFT_GOLDEN_ANGLE;

        return <MountainMineshaftWallHangingLantern key={`wall-lantern-${index}`} angle={angle} y={y} index={index} withLight={index % 4 === 0} />;
      })}
    </group>
  );
}

function MountainMineshaftVillagerFigure({
  x,
  y,
  scale = 1,
  bodyColor,
  hatColor,
}: {
  x: number;
  y: number;
  scale?: number;
  bodyColor: string;
  hatColor: string;
}) {
  const z = -0.36;

  return (
    <group position={[x, y, z]} scale={[scale, scale, 1]}>
      <mesh position={[0, 0.74, 0]} castShadow={false}>
        <boxGeometry args={[0.46, 0.42, 0.08]} />
        <meshBasicMaterial color="#c88d68" />
      </mesh>
      <mesh position={[0, 0.28, 0.02]} castShadow={false}>
        <boxGeometry args={[0.58, 0.74, 0.08]} />
        <meshBasicMaterial color={bodyColor} />
      </mesh>
      <mesh position={[-0.4, 0.28, 0.02]} castShadow={false}>
        <boxGeometry args={[0.18, 0.58, 0.08]} />
        <meshBasicMaterial color="#3a2415" />
      </mesh>
      <mesh position={[0.4, 0.28, 0.02]} castShadow={false}>
        <boxGeometry args={[0.18, 0.58, 0.08]} />
        <meshBasicMaterial color="#3a2415" />
      </mesh>
      <mesh position={[0, 1.06, 0.03]} castShadow={false}>
        <boxGeometry args={[0.72, 0.22, 0.08]} />
        <meshBasicMaterial color={hatColor} />
      </mesh>
      <mesh position={[0, 1.24, 0.04]} castShadow={false}>
        <boxGeometry args={[0.46, 0.28, 0.08]} />
        <meshBasicMaterial color={hatColor} />
      </mesh>
      <mesh position={[-0.1, 0.82, 0.06]} castShadow={false}>
        <boxGeometry args={[0.08, 0.08, 0.06]} />
        <meshBasicMaterial color="#090604" />
      </mesh>
      <mesh position={[0.14, 0.82, 0.06]} castShadow={false}>
        <boxGeometry args={[0.08, 0.08, 0.06]} />
        <meshBasicMaterial color="#090604" />
      </mesh>
    </group>
  );
}

function MountainMineshaftVillagerPainting({
  variant,
}: {
  variant: number;
}) {
  const frameColor = variant % 2 === 0 ? "#5c3a20" : "#2e1d12";
  const canvasColor = ["#263345", "#473328", "#2f4638", "#3b2d4f"][variant % 4];
  const floorColor = ["#6d4a2e", "#4e3826", "#3f4f37", "#7b5730"][variant % 4];
  const moon = variant % 3 === 0;
  const groupScene = variant % 2 === 0;

  return (
    <group name="villager-wall-painting">
      <mesh castShadow={false}>
        <boxGeometry args={[6.8, 4.92, 0.28]} />
        <meshBasicMaterial color="#0b0705" />
      </mesh>
      <mesh position={[0, 0, -0.08]} castShadow={false}>
        <boxGeometry args={[6.28, 4.42, 0.18]} />
        <meshBasicMaterial color={frameColor} />
      </mesh>
      <mesh position={[0, 0, -0.2]} castShadow={false}>
        <boxGeometry args={[5.38, 3.48, 0.12]} />
        <meshBasicMaterial color={canvasColor} />
      </mesh>
      <mesh position={[0, -1.18, -0.29]} castShadow={false}>
        <boxGeometry args={[5.42, 1.1, 0.08]} />
        <meshBasicMaterial color={floorColor} />
      </mesh>
      <mesh position={[moon ? -1.92 : 1.78, 1.08, -0.31]} castShadow={false}>
        <boxGeometry args={[0.64, 0.64, 0.08]} />
        <meshBasicMaterial color={moon ? "#f4e5b0" : "#ffb347"} transparent opacity={0.9} />
      </mesh>
      {groupScene ? (
        <>
          <MountainMineshaftVillagerFigure x={-1.55} y={-0.78} scale={0.94} bodyColor="#8e1e24" hatColor="#d7a548" />
          <MountainMineshaftVillagerFigure x={0} y={-0.72} scale={1.08} bodyColor="#3a6b78" hatColor="#6f4528" />
          <MountainMineshaftVillagerFigure x={1.48} y={-0.82} scale={0.88} bodyColor="#5c6f35" hatColor="#a67642" />
        </>
      ) : (
        <>
          <MountainMineshaftVillagerFigure x={-0.72} y={-0.88} scale={1.22} bodyColor="#6d4a8e" hatColor="#d7a548" />
          <mesh position={[1.28, -0.34, -0.34]} castShadow={false}>
            <boxGeometry args={[0.82, 1.94, 0.08]} />
            <meshBasicMaterial color="#2a1a10" />
          </mesh>
          <mesh position={[1.28, 0.7, -0.32]} castShadow={false}>
            <boxGeometry args={[1.24, 0.34, 0.08]} />
            <meshBasicMaterial color="#d7a548" />
          </mesh>
          <mesh position={[1.28, 1.0, -0.3]} castShadow={false}>
            <boxGeometry args={[0.74, 0.58, 0.08]} />
            <meshBasicMaterial color="#9f2428" />
          </mesh>
        </>
      )}
      {[-2.56, 2.56].map((x) => (
        <mesh key={`painting-pin-${x}`} position={[x, 1.82, -0.38]} castShadow={false}>
          <boxGeometry args={[0.22, 0.22, 0.08]} />
          <meshBasicMaterial color="#d7a548" />
        </mesh>
      ))}
      {getCachedIndexRange(4).map((index) => (
        <mesh key={`painting-highlight-${index}`} position={[-2.1 + index * 1.35, 1.54 - (index % 2) * 0.36, -0.36]} castShadow={false}>
          <boxGeometry args={[0.92, 0.08, 0.06]} />
          <meshBasicMaterial color="#f6e2a8" transparent opacity={0.26} />
        </mesh>
      ))}
    </group>
  );
}

function MountainMineshaftWallPaintings({
  bottomY,
  summitY,
  showDetails,
}: {
  bottomY: number;
  summitY: number;
  showDetails: boolean;
}) {
  if (!showDetails) return null;

  const radius = MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS - 0.48;
  const usableHeight = Math.max(48, summitY - bottomY - 34);

  return (
    <group name="mineshaft-villager-wall-paintings">
      {getCachedIndexRange(MOUNTAIN_VILLAGE_MINESHAFT_WALL_PAINTING_COUNT).map((index) => {
        const angle = 0.38 + index * ((Math.PI * 2) / MOUNTAIN_VILLAGE_MINESHAFT_WALL_PAINTING_COUNT);
        const y = bottomY + 15 + ((index % 4) / 3) * Math.min(usableHeight, 86) + Math.floor(index / 4) * 6;

        return (
          <group key={`villager-painting-${index}`} position={[Math.sin(angle) * radius, y, Math.cos(angle) * radius]} rotation={[0, angle, 0]}>
            <MountainMineshaftVillagerPainting variant={index} />
          </group>
        );
      })}
    </group>
  );
}

function MountainMineshaftWallRopeLights({
  bottomY,
  summitY,
  showDetails,
}: {
  bottomY: number;
  summitY: number;
  showDetails: boolean;
}) {
  if (!showDetails) return null;

  const radius = MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS - 0.52;
  const topY = summitY - 6.2;
  const lowerY = bottomY + 8.4;
  const sequenceHeight = Math.max(30, topY - lowerY);

  return (
    <group name="mineshaft-wall-rope-lights">
      {MOUNTAIN_VILLAGE_MINESHAFT_WALL_FIBONACCI_SEQUENCE.map((lightCount, tierIndex) => {
        const t = tierIndex / Math.max(1, MOUNTAIN_VILLAGE_MINESHAFT_WALL_FIBONACCI_SEQUENCE.length - 1);
        const y = topY - t * sequenceHeight;
        const rowAngle = -0.25 + tierIndex * MOUNTAIN_VILLAGE_MINESHAFT_GOLDEN_ANGLE;

        return (
          <Fragment key={`rope-light-fibonacci-tier-${tierIndex}`}>
            {getCachedIndexRange(lightCount).map((lightIndex) => {
              const angle = rowAngle + (lightCount === 1 ? 0 : (Math.PI * 2 * lightIndex) / lightCount);
              const bulbScale = 1.06 + Math.min(0.38, tierIndex * 0.05);
              const glowColor = ["#fff0a8", "#ffd56f", "#ffb65b", "#ff8a3a"][lightIndex % 4];
              const hasLight = tierIndex < 2 && lightIndex === 0;

              return (
                <group key={`rope-fibonacci-light-${tierIndex}-${lightIndex}`} position={[Math.sin(angle) * radius, y, Math.cos(angle) * radius]} rotation={[0, angle, 0]}>
                  <mesh position={[0, 0, -0.14]} castShadow={false}>
                    <boxGeometry args={[2.08 * bulbScale, 0.24 * bulbScale, 0.16]} />
                    <meshBasicMaterial color="#160d08" />
                  </mesh>
                  <mesh position={[-0.66 * bulbScale, 0, -0.18]} castShadow={false}>
                    <boxGeometry args={[0.22 * bulbScale, 0.36 * bulbScale, 0.18]} />
                    <meshBasicMaterial color="#4f321f" />
                  </mesh>
                  <mesh position={[0.66 * bulbScale, 0, -0.18]} castShadow={false}>
                    <boxGeometry args={[0.22 * bulbScale, 0.36 * bulbScale, 0.18]} />
                    <meshBasicMaterial color="#4f321f" />
                  </mesh>
                  <mesh position={[0, 0, -0.28]} castShadow={false} renderOrder={9}>
                    <boxGeometry args={[0.92 * bulbScale, 0.92 * bulbScale, 0.1]} />
                    <meshBasicMaterial color={glowColor} transparent opacity={0.96} blending={THREE.AdditiveBlending} toneMapped={false} />
                  </mesh>
                  <mesh position={[0, 0, -0.36]} castShadow={false} renderOrder={8}>
                    <boxGeometry args={[2.75 * bulbScale, 2.75 * bulbScale, 0.04]} />
                    <meshBasicMaterial color={glowColor} transparent opacity={0.28} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
                  </mesh>
                  <mesh position={[0, 0, -0.42]} castShadow={false} renderOrder={7}>
                    <boxGeometry args={[4.1 * bulbScale, 4.1 * bulbScale, 0.035]} />
                    <meshBasicMaterial color={glowColor} transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
                  </mesh>
                  {hasLight && <pointLight color={glowColor} intensity={3.6} distance={20} decay={2} position={[0, 0, -1.1]} />}
                </group>
              );
            })}
          </Fragment>
        );
      })}
    </group>
  );
}

function MountainMineshaftBottomLightRing() {
  return (
    <group name="mineshaft-bottom-light-ring">
      {getCachedIndexRange(MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_LIGHT_COUNT).map((index) => {
        const angle = (index / MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_LIGHT_COUNT) * Math.PI * 2;
        const x = Math.sin(angle) * MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_LIGHT_RADIUS;
        const z = Math.cos(angle) * MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_LIGHT_RADIUS;

        return (
          <group key={`bottom-light-${index}`} position={[x, 0.08, z]} rotation={[0, angle + Math.PI, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} renderOrder={9}>
              <circleGeometry args={[3.4, 12]} />
              <meshBasicMaterial color="#ff9d36" transparent opacity={0.24} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0.12, 0]} castShadow={false}>
              <cylinderGeometry args={[1.55, 1.85, 0.24, 8]} />
              <meshBasicMaterial color="#20140d" />
            </mesh>
            <mesh position={[0, 0.42, 0]} castShadow={false}>
              <cylinderGeometry args={[1.1, 1.35, 0.46, 8]} />
              <meshBasicMaterial color={index % 2 === 0 ? "#5c3d24" : "#372315"} />
            </mesh>
            <mesh position={[0, 1.1, 0]} castShadow={false}>
              <boxGeometry args={[0.42, 1.35, 0.42]} />
              <meshBasicMaterial color="#1a100a" />
            </mesh>
            <RetroMineshaftLantern position={[0, 2.08, 0]} scale={0.72} withLight={index % 3 === 0} />
          </group>
        );
      })}
    </group>
  );
}

function MountainMineshaftBanquetChair({
  angle,
  index,
}: {
  angle: number;
  index: number;
}) {
  const x = Math.sin(angle) * MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_RADIUS;
  const z = Math.cos(angle) * MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_RADIUS;

  return (
    <group position={[x, 0, z]} rotation={[0, angle, 0]}>
      <mesh position={[0, 0.72, 0]} castShadow={false}>
        <boxGeometry args={[2.0, 0.38, 1.72]} />
        <meshBasicMaterial color={index % 2 === 0 ? "#6f4528" : "#55341e"} />
      </mesh>
      <mesh position={[0, 0.96, -0.12]} castShadow={false}>
        <boxGeometry args={[1.62, 0.22, 1.2]} />
        <meshBasicMaterial color="#8e1e24" />
      </mesh>
      <mesh position={[0, 1.86, 0.82]} castShadow={false}>
        <boxGeometry args={[2.18, 2.32, 0.42]} />
        <meshBasicMaterial color="#3d2617" />
      </mesh>
      <mesh position={[0, 2.0, 1.08]} castShadow={false}>
        <boxGeometry args={[1.54, 1.74, 0.18]} />
        <meshBasicMaterial color="#7b5332" />
      </mesh>
      <mesh position={[-1.24, 1.12, -0.08]} castShadow={false}>
        <boxGeometry args={[0.32, 0.98, 1.74]} />
        <meshBasicMaterial color="#2a1a10" />
      </mesh>
      <mesh position={[1.24, 1.12, -0.08]} castShadow={false}>
        <boxGeometry args={[0.32, 0.98, 1.74]} />
        <meshBasicMaterial color="#2a1a10" />
      </mesh>
      {[-0.74, 0.74].flatMap((legX) => [-0.5, 0.54].map((legZ) => (
        <mesh key={`chair-leg-${legX}-${legZ}`} position={[legX, 0.36, legZ]} castShadow={false}>
          <boxGeometry args={[0.24, 0.72, 0.24]} />
          <meshBasicMaterial color="#1b1009" />
        </mesh>
      )))}
      {[-0.72, 0, 0.72].map((barX) => (
        <mesh key={`chair-back-gold-${barX}`} position={[barX, 2.92, 1.1]} castShadow={false}>
          <boxGeometry args={[0.24, 0.36, 0.24]} />
          <meshBasicMaterial color="#d7a548" />
        </mesh>
      ))}
    </group>
  );
}

function MountainMineshaftKingsThrone() {
  return (
    <group position={[0, 0, MOUNTAIN_VILLAGE_MINESHAFT_THRONE_Z]} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, 0.28, -0.04]} castShadow={false}>
        <boxGeometry args={[5.2, 0.56, 3.8]} />
        <meshBasicMaterial color="#21140c" />
      </mesh>
      <mesh position={[0, 0.86, -0.28]} castShadow={false}>
        <boxGeometry args={[4.35, 0.72, 3.0]} />
        <meshBasicMaterial color="#704527" />
      </mesh>
      <mesh position={[0, 1.16, -0.42]} castShadow={false}>
        <boxGeometry args={[3.45, 0.24, 2.1]} />
        <meshBasicMaterial color="#8e1e24" />
      </mesh>
      <mesh position={[0, 2.46, 1.08]} castShadow={false}>
        <boxGeometry args={[4.55, 3.8, 0.72]} />
        <meshBasicMaterial color="#3a2415" />
      </mesh>
      <mesh position={[0, 2.56, 1.48]} castShadow={false}>
        <boxGeometry args={[3.18, 2.86, 0.22]} />
        <meshBasicMaterial color="#9f2428" />
      </mesh>
      {[-1.94, 1.94].map((side) => (
        <Fragment key={`throne-arm-${side}`}>
          <mesh position={[side, 1.28, -0.3]} castShadow={false}>
            <boxGeometry args={[0.62, 1.42, 3.12]} />
            <meshBasicMaterial color="#2b1a0f" />
          </mesh>
          <mesh position={[side, 2.12, -1.18]} castShadow={false}>
            <boxGeometry args={[0.78, 0.28, 1.28]} />
            <meshBasicMaterial color="#d7a548" />
          </mesh>
        </Fragment>
      ))}
      <mesh position={[0, 4.64, 1.1]} rotation={[0, Math.PI / 4, 0]} castShadow={false}>
        <coneGeometry args={[1.26, 1.16, 4]} />
        <meshBasicMaterial color="#e2b34c" />
      </mesh>
      {[-1.72, 0, 1.72].map((x, index) => (
        <mesh key={`throne-spire-${index}`} position={[x, 4.36 + (index === 1 ? 0.36 : 0), 1.12]} castShadow={false}>
          <boxGeometry args={[0.4, index === 1 ? 1.28 : 0.9, 0.42]} />
          <meshBasicMaterial color="#d7a548" />
        </mesh>
      ))}
      <mesh position={[0, 0.74, -2.45]} castShadow={false}>
        <boxGeometry args={[6.4, 0.16, 1.7]} />
        <meshBasicMaterial color="#68161d" />
      </mesh>
    </group>
  );
}

function MountainMineshaftBanquetTable() {
  const tableRadius = MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_TABLE_RADIUS;
  const plateAngles = [...MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_ANGLES, Math.PI];

  return (
    <group name="mineshaft-royal-banquet-table">
      <mesh position={[0, 1.2, 0]} castShadow={false}>
        <cylinderGeometry args={[1.55, 2.1, 1.75, 12]} />
        <meshBasicMaterial color="#3a2415" />
      </mesh>
      <mesh position={[0, 1.78, 0]} castShadow={false}>
        <cylinderGeometry args={[tableRadius, tableRadius * 0.96, 0.58, 20]} />
        <meshBasicMaterial color="#5e3a20" />
      </mesh>
      <mesh position={[0, 2.14, 0]} castShadow={false}>
        <cylinderGeometry args={[tableRadius * 1.05, tableRadius * 1.05, 0.22, 20]} />
        <meshBasicMaterial color="#2a1a10" />
      </mesh>
      {getCachedIndexRange(9).map((index) => {
        const z = -tableRadius * 0.72 + index * ((tableRadius * 1.44) / 8);
        const width = Math.sqrt(Math.max(0, tableRadius * tableRadius - z * z)) * 1.82;

        return (
          <mesh key={`table-plank-${index}`} position={[0, 2.28, z]} castShadow={false}>
            <boxGeometry args={[width, 0.08, 0.32]} />
            <meshBasicMaterial color={index % 2 === 0 ? "#8a5b34" : "#3c2415"} transparent opacity={0.76} />
          </mesh>
        );
      })}
      {getCachedIndexRange(6).map((index) => {
        const angle = (index / 6) * Math.PI * 2;
        return (
          <mesh key={`table-leg-${index}`} position={[Math.sin(angle) * 3.95, 0.92, Math.cos(angle) * 3.95]} castShadow={false}>
            <boxGeometry args={[0.42, 1.55, 0.42]} />
            <meshBasicMaterial color="#21140c" />
          </mesh>
        );
      })}
      <mesh position={[0, 2.7, 0]} scale={[2.35, 0.52, 1.22]} castShadow={false}>
        <sphereGeometry args={[1, 10, 6]} />
        <meshBasicMaterial color="#9a4f2c" />
      </mesh>
      <mesh position={[-1.86, 2.72, 0.12]} rotation={[0, 0, Math.PI / 2]} castShadow={false}>
        <cylinderGeometry args={[0.16, 0.16, 1.42, 8]} />
        <meshBasicMaterial color="#f1d8a0" />
      </mesh>
      <mesh position={[1.86, 2.72, 0.12]} rotation={[0, 0, Math.PI / 2]} castShadow={false}>
        <cylinderGeometry args={[0.16, 0.16, 1.42, 8]} />
        <meshBasicMaterial color="#f1d8a0" />
      </mesh>
      {[[-2.9, -1.3], [2.65, 1.45], [-0.9, 3.2], [1.34, -3.1]].map(([x, z], index) => (
        <group key={`banquet-bread-${index}`} position={[x, 2.5, z]} rotation={[0, index * 0.7, 0]}>
          <mesh scale={[1.18, 0.36, 0.62]} castShadow={false}>
            <sphereGeometry args={[1, 8, 5]} />
            <meshBasicMaterial color={index % 2 === 0 ? "#d29a4a" : "#b87833"} />
          </mesh>
          <mesh position={[0, 0.12, 0.18]} castShadow={false}>
            <boxGeometry args={[1.4, 0.08, 0.12]} />
            <meshBasicMaterial color="#fff0b2" transparent opacity={0.44} />
          </mesh>
        </group>
      ))}
      {[[-3.7, 1.7], [3.55, -1.55], [0.8, 3.9], [-1.2, -3.75]].map(([x, z], index) => (
        <group key={`fruit-bowl-${index}`} position={[x, 2.48, z]}>
          <mesh position={[0, -0.04, 0]} castShadow={false}>
            <cylinderGeometry args={[0.86, 0.7, 0.18, 10]} />
            <meshBasicMaterial color="#2b1a0f" />
          </mesh>
          {getCachedIndexRange(5).map((fruitIndex) => (
            <mesh key={`fruit-${fruitIndex}`} position={[(fruitIndex - 2) * 0.22, 0.18 + (fruitIndex % 2) * 0.12, Math.sin(fruitIndex) * 0.24]} scale={[0.24, 0.24, 0.24]} castShadow={false}>
              <sphereGeometry args={[1, 6, 4]} />
              <meshBasicMaterial color={["#b7202e", "#d6a43e", "#7aa34b", "#8a2b5f", "#efc55b"][(fruitIndex + index) % 5]} />
            </mesh>
          ))}
        </group>
      ))}
      {plateAngles.map((angle, index) => (
        <group key={`banquet-place-${index}`} position={[Math.sin(angle) * 4.5, 2.42, Math.cos(angle) * 4.5]} rotation={[0, angle, 0]}>
          <mesh castShadow={false}>
            <cylinderGeometry args={[0.82, 0.9, 0.08, 12]} />
            <meshBasicMaterial color="#d7cab2" />
          </mesh>
          <mesh position={[0, 0.09, -0.05]} scale={[0.48, 0.12, 0.32]} castShadow={false}>
            <sphereGeometry args={[1, 6, 4]} />
            <meshBasicMaterial color={index % 3 === 0 ? "#89422b" : "#c38a42"} />
          </mesh>
          <mesh position={[0.78, 0.2, -0.18]} castShadow={false}>
            <cylinderGeometry args={[0.16, 0.22, 0.42, 8]} />
            <meshBasicMaterial color="#b58b45" />
          </mesh>
        </group>
      ))}
      {[-1.8, 1.8].map((x, index) => (
        <group key={`table-candle-${index}`} position={[x, 2.54, index === 0 ? 2.2 : -2.2]}>
          <mesh position={[0, 0.3, 0]} castShadow={false}>
            <cylinderGeometry args={[0.16, 0.16, 0.6, 8]} />
            <meshBasicMaterial color="#f6e2a8" />
          </mesh>
          <mesh position={[0, 0.74, 0]} castShadow={false} renderOrder={8}>
            <sphereGeometry args={[0.34, 8, 5]} />
            <meshBasicMaterial color="#ffb347" transparent opacity={0.84} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function MountainMineshaftRoyalBanquet({ bottomY, showDetails }: { bottomY: number; showDetails: boolean }) {
  if (!showDetails) return null;

  return (
    <group name="mineshaft-bottom-royal-banquet" position={[0, bottomY, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]} renderOrder={8}>
        <circleGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS * 0.62, 40]} />
        <meshBasicMaterial color="#120b07" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <MountainMineshaftBottomLightRing />
      <MountainMineshaftBanquetTable />
      {MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_ANGLES.map((angle, index) => (
        <MountainMineshaftBanquetChair key={`banquet-chair-${index}`} angle={angle} index={index} />
      ))}
      <MountainMineshaftKingsThrone />
    </group>
  );
}

function MountainMineshaftMiniHut({ hut, ladder, showDetails }: { hut: MountainMineshaftHut; ladder?: MountainMineshaftLadder; showDetails: boolean }) {
  const { wallThickness, doorWidth, doorHeight, frontWallWidth, lintelHeight } = getMountainCabinDoorMetrics(hut);
  const frontZ = hut.depth / 2 - wallThickness / 2;
  const backZ = -hut.depth / 2 + wallThickness / 2;
  const platformZ = hut.depth / 2 + hut.platformDepth / 2 - 1.1;
  const floorY = 0.48;
  const ladderGapCenterX = getMountainMineshaftLadderLandingLocalX(hut, ladder);
  const platformPieces = getMountainMineshaftPlatformPieces(hut.platformWidth, ladderGapCenterX, MOUNTAIN_VILLAGE_MINESHAFT_LADDER_PLATFORM_GAP);
  const platformTopPieces = getMountainMineshaftPlatformPieces(
    hut.platformWidth * 0.94,
    ladderGapCenterX,
    MOUNTAIN_VILLAGE_MINESHAFT_LADDER_PLATFORM_GAP
  );
  const poleSide: -1 | 1 = ladderGapCenterX !== null && ladderGapCenterX > 0 ? -1 : 1;
  const platformPlankCount = 5;

  return (
    <group position={[hut.localX, hut.y, hut.localZ]} rotation={[0, hut.rotation, 0]}>
      {platformPieces.map((piece) => (
        <mesh key={`platform-${piece.key}`} position={[piece.centerX, 0.18, platformZ]} castShadow={false} receiveShadow>
          <boxGeometry args={[piece.width, 0.52, hut.platformDepth]} />
          <meshBasicMaterial color="#3f2b1c" />
        </mesh>
      ))}
      {platformTopPieces.map((piece) => (
        <mesh key={`platform-top-${piece.key}`} position={[piece.centerX, 0.56, platformZ]} castShadow={false} receiveShadow>
          <boxGeometry args={[piece.width, 0.22, hut.platformDepth * 0.88]} />
          <meshBasicMaterial color="#6d4a2e" />
        </mesh>
      ))}
      {showDetails && platformPieces.map((piece) => (
        <Fragment key={`platform-detail-${piece.key}`}>
          {[-1, 1].map((side) => (
            <mesh key={`platform-side-shadow-${side}`} position={[piece.centerX + side * piece.width * 0.47, 0.88, platformZ]} castShadow={false}>
              <boxGeometry args={[0.2, 0.12, hut.platformDepth * 0.92]} />
              <meshBasicMaterial color="#080504" transparent opacity={0.74} />
            </mesh>
          ))}
          {getCachedIndexRange(platformPlankCount).map((plankIndex) => {
            const z = platformZ - hut.platformDepth * 0.35 + plankIndex * ((hut.platformDepth * 0.7) / Math.max(1, platformPlankCount - 1));
            return (
              <mesh key={`plank-groove-${plankIndex}`} position={[piece.centerX, 0.73, z]} castShadow={false}>
                <boxGeometry args={[piece.width * 0.88, 0.07, 0.09]} />
                <meshBasicMaterial color={plankIndex % 2 === 0 ? "#2c1d13" : "#8a613b"} />
              </mesh>
            );
          })}
          <mesh position={[piece.centerX, 0.82, platformZ + hut.platformDepth * 0.46]} castShadow={false}>
            <boxGeometry args={[piece.width * 0.94, 0.22, 0.32]} />
            <meshBasicMaterial color="#8b6239" />
          </mesh>
          <mesh position={[piece.centerX, 0.8, platformZ - hut.platformDepth * 0.46]} castShadow={false}>
            <boxGeometry args={[piece.width * 0.94, 0.18, 0.24]} />
            <meshBasicMaterial color="#2c1d13" />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={`bolt-${side}`} position={[piece.centerX + side * piece.width * 0.34, 0.94, platformZ + hut.platformDepth * 0.38]} castShadow={false}>
              <boxGeometry args={[0.28, 0.1, 0.28]} />
              <meshBasicMaterial color="#d0a05d" />
            </mesh>
          ))}
        </Fragment>
      ))}
      {[-1, 1].map((side) => (
        <group key={`platform-support-${side}`} position={[side * hut.platformWidth * 0.38, -2.0, platformZ - hut.platformDepth * 0.1]} rotation={[0, 0, side * 0.28]}>
          <mesh castShadow={false}>
            <boxGeometry args={[0.58, 4.8, 0.58]} />
            <meshBasicMaterial color="#2d1e14" />
          </mesh>
          {showDetails && <RetroVerticalTimberDetails height={4.8} width={0.58} depth={0.58} bandColor="#8a5b34" />}
        </group>
      ))}
      {showDetails && (
        <>
          <MountainMineshaftLightPole
            position={[poleSide * hut.platformWidth * 0.33, 0.78, platformZ + hut.platformDepth * 0.26]}
            direction={poleSide}
          />
          <RetroMineshaftLantern position={[doorWidth / 2 + 1.35, 3.55 + floorY, frontZ + 0.34]} scale={0.62} withLight={false} />
        </>
      )}
      <mesh position={[0, hut.height / 2 + floorY, backZ - 0.42]} castShadow={false}>
        <boxGeometry args={[hut.width + 1.6, hut.height + 1.1, 0.7]} />
        <meshBasicMaterial color="#16100c" transparent opacity={0.88} />
      </mesh>
      {showDetails && (
        <mesh position={[0, floorY + 0.42, hut.depth / 2 + 0.28]} castShadow={false}>
          <boxGeometry args={[hut.width + 1.0, 0.18, 0.2]} />
          <meshBasicMaterial color="#060403" transparent opacity={0.86} />
        </mesh>
      )}
      <mesh position={[-hut.width / 2 + wallThickness / 2, hut.height / 2 + floorY, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[wallThickness, hut.height, hut.depth]} />
        <meshBasicMaterial color={hut.bodyColor} />
      </mesh>
      <mesh position={[hut.width / 2 - wallThickness / 2, hut.height / 2 + floorY, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[wallThickness, hut.height, hut.depth]} />
        <meshBasicMaterial color={hut.bodyColor} />
      </mesh>
      <mesh position={[0, hut.height / 2 + floorY, backZ]} castShadow={false} receiveShadow>
        <boxGeometry args={[hut.width, hut.height, wallThickness]} />
        <meshBasicMaterial color={hut.bodyColor} />
      </mesh>
      <mesh position={[-doorWidth / 2 - frontWallWidth / 2, hut.height / 2 + floorY, frontZ]} castShadow={false} receiveShadow>
        <boxGeometry args={[frontWallWidth, hut.height, wallThickness]} />
        <meshBasicMaterial color={hut.bodyColor} />
      </mesh>
      <mesh position={[doorWidth / 2 + frontWallWidth / 2, hut.height / 2 + floorY, frontZ]} castShadow={false} receiveShadow>
        <boxGeometry args={[frontWallWidth, hut.height, wallThickness]} />
        <meshBasicMaterial color={hut.bodyColor} />
      </mesh>
      <mesh position={[0, doorHeight + lintelHeight / 2 + floorY, frontZ]} castShadow={false} receiveShadow>
        <boxGeometry args={[doorWidth, lintelHeight, wallThickness]} />
        <meshBasicMaterial color={hut.bodyColor} />
      </mesh>
      <mesh position={[0, hut.height + 2.8 + floorY, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={false} receiveShadow>
        <coneGeometry args={[Math.max(hut.width, hut.depth) * 0.76, 6.2, 4]} />
        <meshBasicMaterial color={hut.roofColor} />
      </mesh>
      <mesh position={[0, hut.height + 6.0 + floorY, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={false}>
        <coneGeometry args={[Math.max(hut.width, hut.depth) * 0.3, 2.3, 4]} />
        <meshBasicMaterial color="#cfe6f3" />
      </mesh>
      <mesh position={[0, doorHeight / 2 + floorY, frontZ + 0.16]} castShadow={false}>
        <boxGeometry args={[doorWidth * 0.76, doorHeight * 0.78, 0.24]} />
        <meshBasicMaterial color="#1c130d" />
      </mesh>
      {showDetails && (
        <>
          <MountainHutWallDetails
            width={hut.width}
            depth={hut.depth}
            height={hut.height}
            floorY={floorY}
            frontZ={hut.depth / 2 + 0.08}
            backZ={-hut.depth / 2 - 0.08}
            doorWidth={doorWidth}
            doorHeight={doorHeight}
            compact
          />
          <MountainHutRoofDetails width={hut.width} depth={hut.depth} roofBaseY={hut.height + floorY + 0.25} roofHeight={5.2} compact />
          <mesh position={[-hut.width * 0.28, 4.6 + floorY, frontZ + 0.18]} castShadow={false}>
            <boxGeometry args={[2.0, 1.8, 0.26]} />
            <meshBasicMaterial color={hut.accentColor} transparent opacity={0.9} />
          </mesh>
          <RetroWindowDetails x={-hut.width * 0.28} y={4.6 + floorY} z={frontZ + 0.34} width={1.75} height={1.55} />
          <mesh position={[hut.width * 0.28, 4.6 + floorY, frontZ + 0.18]} castShadow={false}>
            <boxGeometry args={[2.0, 1.8, 0.26]} />
            <meshBasicMaterial color={hut.accentColor} transparent opacity={0.9} />
          </mesh>
          <RetroWindowDetails x={hut.width * 0.28} y={4.6 + floorY} z={frontZ + 0.34} width={1.75} height={1.55} />
          <mesh position={[0, 2.8, platformZ + hut.platformDepth * 0.28]} castShadow={false}>
            <sphereGeometry args={[0.78, 8, 5]} />
            <meshBasicMaterial color="#ffd47a" transparent opacity={0.86} />
          </mesh>
          <mesh position={[0, 2.08, platformZ + hut.platformDepth * 0.28]} castShadow={false}>
            <boxGeometry args={[1.16, 0.14, 1.16]} />
            <meshBasicMaterial color="#080504" transparent opacity={0.72} />
          </mesh>
        </>
      )}
    </group>
  );
}

function MountainMineshaftLadder({ ladder, showDetails }: { ladder: MountainMineshaftLadder; showDetails: boolean }) {
  const height = Math.max(4, ladder.endY - ladder.startY);
  const rungCount = Math.max(8, Math.min(48, Math.floor(height / 3.6)));
  const wrapCount = Math.max(3, Math.min(14, Math.floor(height / 7.5)));

  return (
    <group position={[ladder.localX, ladder.startY, ladder.localZ]} rotation={[0, ladder.rotation, 0]}>
      <mesh position={[-ladder.width / 2, height / 2, 0]} castShadow={false}>
        <boxGeometry args={[0.34, height, 0.28]} />
        <meshBasicMaterial color="#26180f" />
      </mesh>
      <mesh position={[ladder.width / 2, height / 2, 0]} castShadow={false}>
        <boxGeometry args={[0.34, height, 0.28]} />
        <meshBasicMaterial color="#26180f" />
      </mesh>
      {getCachedIndexRange(rungCount).map((index) => (
        <mesh key={`rung-${index}`} position={[0, 1.2 + index * ((height - 2.4) / Math.max(1, rungCount - 1)), 0.14]} castShadow={false}>
          <boxGeometry args={[ladder.width + 0.55, 0.24, 0.32]} />
          <meshBasicMaterial color={index % 2 === 0 ? "#4b3120" : "#5d4028"} />
        </mesh>
      ))}
      {showDetails && (
        <>
          <mesh position={[0, height / 2, -0.12]} castShadow={false}>
            <boxGeometry args={[ladder.width + 0.9, height * 0.94, 0.08]} />
            <meshBasicMaterial color="#050403" transparent opacity={0.22} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={`rail-highlight-${side}`} position={[side * ladder.width / 2 + side * 0.08, height / 2, 0.2]} castShadow={false}>
              <boxGeometry args={[0.1, height * 0.94, 0.08]} />
              <meshBasicMaterial color="#8a5b34" />
            </mesh>
          ))}
          {getCachedIndexRange(wrapCount).map((index) => {
            const y = 2 + index * ((height - 4) / Math.max(1, wrapCount - 1));
            return (
              <Fragment key={`ladder-wrap-${index}`}>
                <mesh position={[-ladder.width / 2, y, 0.05]} castShadow={false}>
                  <boxGeometry args={[0.64, 0.3, 0.42]} />
                  <meshBasicMaterial color={index % 2 === 0 ? "#a07743" : "#c09351"} />
                </mesh>
                <mesh position={[ladder.width / 2, y, 0.05]} castShadow={false}>
                  <boxGeometry args={[0.64, 0.3, 0.42]} />
                  <meshBasicMaterial color={index % 2 === 0 ? "#a07743" : "#c09351"} />
                </mesh>
              </Fragment>
            );
          })}
          {getCachedIndexRange(Math.min(10, Math.floor(rungCount / 2))).map((index) => {
            const rungIndex = index * 2;
            const y = 1.2 + rungIndex * ((height - 2.4) / Math.max(1, rungCount - 1));
            return (
              <mesh key={`rung-bright-edge-${index}`} position={[0, y + 0.12, 0.36]} castShadow={false}>
                <boxGeometry args={[ladder.width + 0.18, 0.07, 0.1]} />
                <meshBasicMaterial color="#b27a42" />
              </mesh>
            );
          })}
          {getCachedIndexRange(Math.min(12, Math.floor(rungCount / 2))).map((index) => {
            const rungIndex = index * 2 + 1;
            const y = 1.2 + rungIndex * ((height - 2.4) / Math.max(1, rungCount - 1));
            return (
              <mesh key={`rung-dark-edge-${index}`} position={[0, y - 0.12, 0.38]} castShadow={false}>
                <boxGeometry args={[ladder.width + 0.42, 0.08, 0.12]} />
                <meshBasicMaterial color="#090604" transparent opacity={0.72} />
              </mesh>
            );
          })}
          <mesh position={[0, height + 0.34, 0]} castShadow={false}>
            <boxGeometry args={[ladder.width + 1.2, 0.46, 0.46]} />
            <meshBasicMaterial color="#6f5131" />
          </mesh>
          <mesh position={[0, 0.34, 0]} castShadow={false}>
            <boxGeometry args={[ladder.width + 1.2, 0.46, 0.46]} />
            <meshBasicMaterial color="#6f5131" />
          </mesh>
        </>
      )}
    </group>
  );
}

function MountainMineshaftCatwalkRing({
  hut,
  ladder,
  nextLadder,
  showDetails,
}: {
  hut: MountainMineshaftHut;
  ladder?: MountainMineshaftLadder;
  nextLadder?: MountainMineshaftLadder;
  showDetails: boolean;
}) {
  const plankRadius = (MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS + MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS) / 2;
  const centerGuardRailRadius = MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS + 0.55;
  const centerGuardPostCount = MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_SEGMENTS * 2;
  const centerGuardRailSegmentLength = ((Math.PI * 2 * centerGuardRailRadius) / centerGuardPostCount) * 0.78;
  const lightPoleRadius = MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS + 0.95;
  const balconyGapHalfAngle = Math.min(0.52, Math.max(0.34, (hut.platformWidth * 0.38) / centerGuardRailRadius));
  const guardRailGaps = new Array<{ angle: number; halfAngle: number }>(1 + (ladder ? 1 : 0) + (nextLadder ? 1 : 0));
  let guardRailGapCount = 0;
  guardRailGaps[guardRailGapCount] = { angle: hut.angle, halfAngle: balconyGapHalfAngle };
  guardRailGapCount += 1;
  if (ladder) {
    guardRailGaps[guardRailGapCount] = {
      angle: ladder.angle,
      halfAngle: Math.min(0.5, Math.max(0.34, (ladder.width * 1.35) / centerGuardRailRadius)),
    };
    guardRailGapCount += 1;
  }
  if (nextLadder) {
    guardRailGaps[guardRailGapCount] = {
      angle: nextLadder.angle,
      halfAngle: Math.min(0.5, Math.max(0.34, (nextLadder.width * 1.35) / centerGuardRailRadius)),
    };
  }
  const isGuardRailOpening = (angle: number) => {
    for (let index = 0; index < guardRailGaps.length; index += 1) {
      const gap = guardRailGaps[index];
      if (absoluteAngleDeltaRadians(gap.angle, angle) < gap.halfAngle) {
        return true;
      }
    }
    return false;
  };

  return (
    <group name={`${hut.key}-catwalk`} position={[0, hut.y + 0.08, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow={false} receiveShadow>
        <ringGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS, MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS, 64]} />
        <meshBasicMaterial color="#47311f" side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, hut.angle]} position={[0, 0.05, 0]} castShadow={false} receiveShadow>
        <ringGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS + 1.1, MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS - 1.2, 64]} />
        <meshBasicMaterial color="#6b4a2d" side={THREE.DoubleSide} />
      </mesh>
      {showDetails && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.18, 0]} castShadow={false}>
            <ringGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS, MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS + 0.62, 64]} />
            <meshBasicMaterial color="#070504" side={THREE.DoubleSide} transparent opacity={0.7} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]} castShadow={false}>
            <ringGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS - 0.58, MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS, 64]} />
            <meshBasicMaterial color="#0d0805" side={THREE.DoubleSide} transparent opacity={0.54} />
          </mesh>
        </>
      )}
      {showDetails && getCachedIndexRange(MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_SEGMENTS).map((index) => {
        const angle = ((index + 0.5) / MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_SEGMENTS) * Math.PI * 2;
        return (
          <mesh key={`catwalk-plank-${index}`} position={[Math.sin(angle) * plankRadius, 0.22, Math.cos(angle) * plankRadius]} rotation={[0, angle, 0]} castShadow={false}>
            <boxGeometry args={[1.15, 0.24, MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS - MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS + 0.8]} />
            <meshBasicMaterial color={index % 2 === 0 ? "#7a5635" : "#5d3f28"} />
          </mesh>
        );
      })}
      {showDetails && getCachedIndexRange(MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_SEGMENTS).map((index) => {
        const angle = (index / MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_SEGMENTS) * Math.PI * 2;
        const radius = (MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS + MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS) / 2;

        return (
          <mesh key={`catwalk-dark-gap-${index}`} position={[Math.sin(angle) * radius, 0.33, Math.cos(angle) * radius]} rotation={[0, angle, 0]} castShadow={false}>
            <boxGeometry args={[0.16, 0.08, MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS - MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS + 1.0]} />
            <meshBasicMaterial color="#080504" transparent opacity={0.58} />
          </mesh>
        );
      })}
      {showDetails && getCachedIndexRange(MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_SEGMENTS).map((index) => {
        const angle = ((index + 0.5) / MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_SEGMENTS) * Math.PI * 2;
        if (isGuardRailOpening(angle)) return null;

        return (
          <mesh key={`catwalk-edge-block-${index}`} position={[Math.sin(angle) * centerGuardRailRadius, 0.46, Math.cos(angle) * centerGuardRailRadius]} rotation={[0, angle, 0]} castShadow={false}>
            <boxGeometry args={[0.68, 0.34, 0.54]} />
            <meshBasicMaterial color={index % 3 === 0 ? "#9b6a3b" : "#2f1e13"} />
          </mesh>
        );
      })}
      {showDetails && getCachedIndexRange(centerGuardPostCount).map((index) => {
        const angle = (index / centerGuardPostCount) * Math.PI * 2;
        if (isGuardRailOpening(angle)) return null;

        return (
          <mesh key={`catwalk-center-guard-post-${index}`} position={[Math.sin(angle) * centerGuardRailRadius, 1.18, Math.cos(angle) * centerGuardRailRadius]} rotation={[0, angle, 0]} castShadow={false}>
            <boxGeometry args={[0.42, 1.48, 0.42]} />
            <meshBasicMaterial color={index % 2 === 0 ? "#2b1c12" : "#4d301b"} />
          </mesh>
        );
      })}
      {showDetails && [0.86, 1.55, 2.08].map((height, railIndex) => (
        <Fragment key={`catwalk-center-guard-rail-row-${railIndex}`}>
          {getCachedIndexRange(centerGuardPostCount).map((index) => {
            const angle = ((index + 0.5) / centerGuardPostCount) * Math.PI * 2;
            if (isGuardRailOpening(angle)) return null;

            return (
              <mesh key={`rail-${index}`} position={[Math.sin(angle) * centerGuardRailRadius, height, Math.cos(angle) * centerGuardRailRadius]} rotation={[0, angle, 0]} castShadow={false}>
                <boxGeometry args={[centerGuardRailSegmentLength, 0.24, railIndex === 0 ? 0.32 : 0.28]} />
                <meshBasicMaterial color={railIndex === 1 ? "#8d6238" : "#24170f"} />
              </mesh>
            );
          })}
        </Fragment>
      ))}
      {showDetails && getCachedIndexRange(4).map((index) => {
        const angle = hut.angle + index * Math.PI / 2 + 0.38;
        const x = Math.sin(angle) * lightPoleRadius;
        const z = Math.cos(angle) * lightPoleRadius;

        return (
          <group key={`catwalk-light-pole-${index}`} position={[x, 0.78, z]} rotation={[0, angle + Math.PI / 2, 0]}>
            <mesh position={[0, 1.44, 0]} castShadow={false}>
              <boxGeometry args={[0.34, 2.88, 0.34]} />
              <meshBasicMaterial color="#25170e" />
            </mesh>
            <mesh position={[-0.62, 2.78, 0]} castShadow={false}>
              <boxGeometry args={[1.36, 0.26, 0.26]} />
              <meshBasicMaterial color="#4f321c" />
            </mesh>
            <mesh position={[-1.18, 2.48, 0]} castShadow={false}>
              <boxGeometry args={[0.16, 0.58, 0.16]} />
              <meshBasicMaterial color="#1b120c" />
            </mesh>
            <RetroMineshaftLantern position={[-1.18, 1.44, 0]} scale={0.62} withLight={false} />
          </group>
        );
      })}
    </group>
  );
}

function MountainMineshaftInterior({ layout, showDetails }: { layout: MountainVillageLayout; showDetails: boolean }) {
  return (
    <group name="mountain-village-mineshaft-wall-huts">
      {layout.interiorHuts.map((hut, index) => (
        <MountainMineshaftCatwalkRing
          key={`${hut.key}-catwalk-ring`}
          hut={hut}
          ladder={layout.interiorLadders[index]}
          nextLadder={layout.interiorLadders[index + 1]}
          showDetails={showDetails}
        />
      ))}
      {layout.interiorHuts.map((hut, index) => (
        <MountainMineshaftMiniHut key={hut.key} hut={hut} ladder={layout.interiorLadders[index]} showDetails={showDetails} />
      ))}
      {layout.interiorLadders.map((ladder) => (
        <MountainMineshaftLadder key={ladder.key} ladder={ladder} showDetails={showDetails} />
      ))}
    </group>
  );
}

function MountainMineshaftTopExitBridge({ ladder, summitY, showDetails }: { ladder: MountainMineshaftLadder; summitY: number; showDetails: boolean }) {
  const bridge = getMountainMineshaftExitBridgeFrame(ladder);
  const y = summitY + MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_Y_OFFSET;
  const plankCount = 9;

  return (
    <group name="mountain-village-mineshaft-top-exit" position={[bridge.x, y, bridge.z]} rotation={[0, bridge.angle, 0]}>
      <mesh castShadow={false} receiveShadow>
        <boxGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH, 0.58, bridge.length]} />
        <meshBasicMaterial color="#5d3f28" />
      </mesh>
      <mesh position={[0, 0.42, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH * 0.88, 0.2, bridge.length * 0.96]} />
        <meshBasicMaterial color="#8a653f" />
      </mesh>
      {showDetails && (
        <>
          {[-1, 1].map((side) => (
            <mesh key={`exit-bridge-edge-shadow-${side}`} position={[side * (MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH / 2 - 0.34), 0.72, 0]} castShadow={false}>
              <boxGeometry args={[0.24, 0.12, bridge.length * 0.98]} />
              <meshBasicMaterial color="#080504" transparent opacity={0.72} />
            </mesh>
          ))}
          {getCachedIndexRange(6).map((index) => {
            const z = -bridge.length * 0.42 + index * ((bridge.length * 0.84) / 5);

            return (
              <mesh key={`exit-bridge-dark-gap-${index}`} position={[0, 0.8, z]} castShadow={false}>
                <boxGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH * 0.84, 0.08, 0.14]} />
                <meshBasicMaterial color="#090604" transparent opacity={0.56} />
              </mesh>
            );
          })}
        </>
      )}
      {showDetails && getCachedIndexRange(plankCount).map((index) => {
        const z = -bridge.length / 2 + (index + 0.5) * (bridge.length / plankCount);
        return (
          <mesh key={`exit-plank-${index}`} position={[0, 0.64, z]} castShadow={false}>
            <boxGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH + 0.8, 0.16, 1.45]} />
            <meshBasicMaterial color={index % 2 === 0 ? "#9b7448" : "#6e4b2e"} />
          </mesh>
        );
      })}
      {[-1, 1].map((side) => (
        <Fragment key={`exit-side-${side}`}>
          <mesh position={[side * (MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH / 2 + 0.36), 1.38, 0]} castShadow={false}>
            <boxGeometry args={[0.36, 0.36, bridge.length * 0.92]} />
            <meshBasicMaterial color="#2b1c12" />
          </mesh>
          {showDetails && getCachedIndexRange(5).map((index) => {
            const z = -bridge.length * 0.38 + index * ((bridge.length * 0.76) / 4);
            return (
              <mesh key={`exit-post-${index}`} position={[side * (MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH / 2 + 0.36), 0.88, z]} castShadow={false}>
                <boxGeometry args={[0.46, 1.34, 0.46]} />
                <meshBasicMaterial color={index % 2 === 0 ? "#362315" : "#4e321d"} />
              </mesh>
            );
          })}
        </Fragment>
      ))}
      {showDetails && (
        <>
          <group position={[0, -1.12, -bridge.length * 0.26]} rotation={[0, 0, 0.22]}>
            <mesh castShadow={false}>
              <boxGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH * 0.76, 0.42, 0.6]} />
              <meshBasicMaterial color="#3a2719" />
            </mesh>
            <RetroHorizontalTimberDetails length={MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH * 0.76} height={0.42} depth={0.6} bandColor="#8a5b34" />
          </group>
          <group position={[0, -1.12, bridge.length * 0.26]} rotation={[0, 0, -0.22]}>
            <mesh castShadow={false}>
              <boxGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH * 0.76, 0.42, 0.6]} />
              <meshBasicMaterial color="#3a2719" />
            </mesh>
            <RetroHorizontalTimberDetails length={MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH * 0.76} height={0.42} depth={0.6} bandColor="#8a5b34" />
          </group>
          <RetroMineshaftLantern position={[0, 1.4, bridge.length / 2 - 3.0]} scale={0.7} withLight />
        </>
      )}
    </group>
  );
}

function MountainMineshaftOpening({ baseHeight, summitY, exitLadder, showDetails }: { baseHeight: number; summitY: number; exitLadder?: MountainMineshaftLadder; showDetails: boolean }) {
  const bottomY = baseHeight + MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_BASE_OFFSET;
  const shaftWallHeight = Math.max(32, summitY - bottomY + 1.2);
  const shaftWallY = bottomY + shaftWallHeight / 2 - 0.2;

  return (
    <group name="mountain-village-mineshaft">
      <mesh position={[0, shaftWallY, 0]} castShadow={false} renderOrder={3}>
        <cylinderGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS, MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS * 0.82, shaftWallHeight, 48, 1, true]} />
        <meshStandardMaterial color="#0b0908" roughness={1} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      <MountainMineshaftWallRopeLights bottomY={bottomY} summitY={summitY} showDetails={showDetails} />
      <MountainMineshaftWallLanterns bottomY={bottomY} summitY={summitY} showDetails={showDetails} />
      <MountainMineshaftWallPaintings bottomY={bottomY} summitY={summitY} showDetails={showDetails} />
      <mesh position={[0, bottomY - 0.28, 0]} receiveShadow={showDetails} renderOrder={4}>
        <cylinderGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS, MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS * 0.96, 0.56, 48]} />
        <meshStandardMaterial color="#342519" roughness={0.96} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, bottomY + 0.04, 0]} renderOrder={5}>
        <ringGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS * 0.28, MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS * 0.96, 48]} />
        <meshBasicMaterial color="#5c4932" transparent opacity={0.58} />
      </mesh>
      {showDetails && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, bottomY + 0.12, 0]} renderOrder={6}>
          <ringGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS * 0.7, MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS * 0.98, 48]} />
          <meshBasicMaterial color="#070504" transparent opacity={0.38} />
        </mesh>
      )}
      {showDetails && getCachedIndexRange(14).map((index) => {
        const angle = survivalHash01(9110, index, 3) * Math.PI * 2;
        const radius = lerpNumber(12.5, MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS - 4, Math.pow(survivalHash01(9120, index, 7), 0.7));
        const x = Math.sin(angle) * radius;
        const z = Math.cos(angle) * radius;
        const scale = lerpNumber(0.7, 1.8, survivalHash01(9130, index, 11));

        return (
          <mesh key={`mine-bottom-rock-${index}`} position={[x, bottomY + 0.12, z]} rotation={[0, angle, 0]} scale={[scale * 1.4, scale * 0.38, scale]} castShadow={false}>
            <boxGeometry args={[1.8, 0.65, 1.25]} />
            <meshStandardMaterial color={index % 3 === 0 ? "#4b4237" : index % 3 === 1 ? "#2f2b27" : "#66533c"} roughness={1} />
          </mesh>
        );
      })}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, bottomY - 0.08, 0]} renderOrder={4}>
        <circleGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS * 0.32, 36]} />
        <meshBasicMaterial color="#080605" transparent opacity={0.48} />
      </mesh>
      <MountainMineshaftRoyalBanquet bottomY={bottomY} showDetails={showDetails} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, summitY + 0.42, 0]} renderOrder={5}>
        <ringGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS, MOUNTAIN_VILLAGE_MINESHAFT_RIM_MID_RADIUS, 48]} />
        <meshBasicMaterial color="#3a281a" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, summitY + 0.5, 0]} renderOrder={6}>
        <ringGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_RIM_MID_RADIUS, MOUNTAIN_VILLAGE_MINESHAFT_RIM_OUTER_RADIUS, 48]} />
        <meshBasicMaterial color="#796650" />
      </mesh>
      {showDetails && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, summitY + 0.58, 0]} renderOrder={7}>
            <ringGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS, MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS + 2.4, 48]} />
            <meshBasicMaterial color="#050403" transparent opacity={0.58} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, summitY + 0.6, 0]} renderOrder={7}>
            <ringGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_RIM_OUTER_RADIUS - 1.35, MOUNTAIN_VILLAGE_MINESHAFT_RIM_OUTER_RADIUS, 48]} />
            <meshBasicMaterial color="#120c08" transparent opacity={0.42} />
          </mesh>
        </>
      )}
      {getCachedIndexRange(12).map((index) => {
        const angle = (Math.PI * 2 * index) / 12;
        if (exitLadder && absoluteAngleDeltaRadians(exitLadder.angle, angle) < 0.38) return null;

        const x = Math.sin(angle) * ((MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS + MOUNTAIN_VILLAGE_MINESHAFT_RIM_OUTER_RADIUS) / 2);
        const z = Math.cos(angle) * ((MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS + MOUNTAIN_VILLAGE_MINESHAFT_RIM_OUTER_RADIUS) / 2);
        return (
          <group key={`mine-rim-beam-${index}`} position={[x, summitY + 1.02, z]} rotation={[0, angle + Math.PI / 2, 0]}>
            <mesh castShadow={false}>
              <boxGeometry args={[3.4, 0.9, 9.5]} />
              <meshBasicMaterial color={index % 2 === 0 ? "#4b3421" : "#5e442d"} />
            </mesh>
            {showDetails && (
              <>
                {[-2.9, 0, 2.9].map((beamZ, bandIndex) => (
                  <mesh key={`rim-beam-band-${bandIndex}`} position={[0, 0.12, beamZ]} castShadow={false}>
                    <boxGeometry args={[3.76, 0.16, 0.24]} />
                    <meshBasicMaterial color={bandIndex === 1 ? "#a67642" : "#24170f"} />
                  </mesh>
                ))}
                <mesh position={[0, 0.54, 0]} castShadow={false}>
                  <boxGeometry args={[0.22, 0.12, 8.2]} />
                  <meshBasicMaterial color="#d2a46a" transparent opacity={0.52} />
                </mesh>
                <mesh position={[0, -0.52, 0]} castShadow={false}>
                  <boxGeometry args={[3.22, 0.16, 8.9]} />
                  <meshBasicMaterial color="#060403" transparent opacity={0.62} />
                </mesh>
              </>
            )}
          </group>
        );
      })}
      {exitLadder && <MountainMineshaftTopExitBridge ladder={exitLadder} summitY={summitY} showDetails={showDetails} />}
      {showDetails && getCachedIndexRange(4).map((index) => {
        const angle = index * Math.PI / 2 + Math.PI / 4;
        return (
          <group key={`mine-support-${index}`} rotation={[0, angle, 0]}>
            <group position={[-12, summitY + 8.2, 29]} rotation={[0, 0, -0.12]}>
              <mesh castShadow={false}>
                <boxGeometry args={[2.3, 15.5, 2.3]} />
                <meshBasicMaterial color="#392719" />
              </mesh>
              <RetroVerticalTimberDetails height={15.5} width={2.3} depth={2.3} bandColor="#a67642" lightColor="#8a5b34" />
            </group>
            <group position={[12, summitY + 8.2, 29]} rotation={[0, 0, 0.12]}>
              <mesh castShadow={false}>
                <boxGeometry args={[2.3, 15.5, 2.3]} />
                <meshBasicMaterial color="#392719" />
              </mesh>
              <RetroVerticalTimberDetails height={15.5} width={2.3} depth={2.3} bandColor="#a67642" lightColor="#8a5b34" />
            </group>
            <group position={[0, summitY + 16.2, 29]}>
              <mesh castShadow={false}>
                <boxGeometry args={[27.5, 2.4, 2.6]} />
                <meshBasicMaterial color="#513821" />
              </mesh>
              <RetroHorizontalTimberDetails length={27.5} height={2.4} depth={2.6} bandColor="#be8a4c" />
              {[-1, 1].map((side) => (
                <mesh key={`support-snow-cap-${side}`} position={[side * 8.7, 1.32, 0]} castShadow={false}>
                  <boxGeometry args={[5.1, 0.22, 1.88]} />
                  <meshBasicMaterial color="#e8f8ff" transparent opacity={0.7} />
                </mesh>
              ))}
            </group>
          </group>
        );
      })}
    </group>
  );
}

function MountainWaterfall({
  chunk,
  waterfall,
  summitY,
  showDetails,
}: {
  chunk: SurvivalChunkInfo;
  waterfall: MountainVillageWaterfall;
  summitY: number;
  showDetails: boolean;
}) {
  if (!showDetails) return null;

  return (
    <VisibleMountainWaterfall
      chunk={chunk}
      waterfall={waterfall}
      summitY={summitY}
    />
  );
}

function VisibleMountainWaterfall({
  chunk,
  waterfall,
  summitY,
}: {
  chunk: SurvivalChunkInfo;
  waterfall: MountainVillageWaterfall;
  summitY: number;
}) {
  const waterfallRef = useRef<THREE.Group>(null);
  const visibleRef = useRef(true);
  const lastVisibilityCheckAtRef = useRef(Number.NEGATIVE_INFINITY);

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime;
    if (elapsed - lastVisibilityCheckAtRef.current < MOUNTAIN_WATERFALL_VISIBILITY_CHECK_INTERVAL_SECONDS) return;
    lastVisibilityCheckAtRef.current = elapsed;

    const group = waterfallRef.current;
    if (!group) return;
    const nextVisible = !shouldHideMountainWaterfallForCamera(chunk, waterfall);
    if (visibleRef.current === nextVisible && group.visible === nextVisible) return;
    visibleRef.current = nextVisible;
    group.visible = nextVisible;
  });

  const surfaceOffset = 3.6;
  const outwardX = Math.sin(waterfall.angle) * surfaceOffset;
  const outwardZ = Math.cos(waterfall.angle) * surfaceOffset;
  const midX = (waterfall.topX + waterfall.bottomX) / 2 + outwardX;
  const midZ = (waterfall.topZ + waterfall.bottomZ) / 2 + outwardZ;
  const height = Math.max(18, waterfall.topY - waterfall.bottomY);
  const midY = waterfall.bottomY + height / 2;

  return (
    <group ref={waterfallRef} name="mountain-village-waterfall">
      <mesh position={[midX, midY, midZ]} rotation={[0, waterfall.angle, 0]}>
        <planeGeometry args={[waterfall.width, height]} />
        <meshBasicMaterial color="#89e9ff" transparent opacity={0.48} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[midX + outwardX * 0.18, midY + height * 0.04, midZ + outwardZ * 0.18]} rotation={[0, waterfall.angle, 0]}>
        <planeGeometry args={[waterfall.width * 0.36, height * 0.96]} />
        <meshBasicMaterial color="#effdff" transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {[-1, 1].map((side) => {
        const sideOffset = side * waterfall.width * 0.43;
        return (
          <mesh
            key={`mountain-fall-dark-edge-${side}`}
            position={[midX + Math.cos(waterfall.angle) * sideOffset, midY - height * 0.02, midZ - Math.sin(waterfall.angle) * sideOffset]}
            rotation={[0, waterfall.angle, 0]}
          >
            <planeGeometry args={[waterfall.width * 0.12, height * 0.92]} />
            <meshBasicMaterial color="#16596d" transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        );
      })}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[waterfall.topX * 0.74 + outwardX * 0.35, summitY + 0.98, waterfall.topZ * 0.74 + outwardZ * 0.35]} scale={[28, 9, 1]}>
        <circleGeometry args={[1, 18]} />
        <meshBasicMaterial color="#b9f1ff" transparent opacity={0.48} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[waterfall.bottomX + outwardX, waterfall.bottomY + 0.32, waterfall.bottomZ + outwardZ]} scale={[35, 24, 1]}>
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial color="#5bbbd4" transparent opacity={0.56} depthWrite={false} />
      </mesh>
      {getCachedIndexRange(10).map((index) => {
        const t = index / 9;
        const x = lerpNumber(waterfall.topX, waterfall.bottomX, t) + outwardX;
        const z = lerpNumber(waterfall.topZ, waterfall.bottomZ, t) + outwardZ;
        const y = lerpNumber(waterfall.topY, waterfall.bottomY, t);
        return (
          <mesh key={`mountain-fall-spray-${index}`} position={[x, y, z]} scale={[1.8 + (index % 3), 0.7, 1.8 + (index % 2)]} castShadow={false}>
            <sphereGeometry args={[1, 6, 4]} />
            <meshBasicMaterial color="#dffaff" transparent opacity={0.26} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

function MountainSnowCap({ summitY, showDetails }: { summitY: number; showDetails: boolean }) {
  if (!showDetails) return null;

  return (
    <group name="mountain-village-snow-cap">
      {getCachedIndexRange(28).map((index) => {
        const angle = (index * Math.PI * 2) / 28 + Math.sin(index * 1.83) * 0.14;
        const radius = MOUNTAIN_VILLAGE_MINESHAFT_RIM_OUTER_RADIUS + 9 + (index % 5) * 7.2 + Math.sin(index * 2.4) * 2.1;
        return (
          <mesh key={`summit-snow-drift-${index}`} rotation={[-Math.PI / 2, 0, angle]} position={[Math.sin(angle) * radius, summitY + 0.84, Math.cos(angle) * radius]} scale={[4.4 + (index % 4) * 1.7, 1.9 + (index % 3) * 0.85, 1]}>
            <circleGeometry args={[1, 12]} />
            <meshBasicMaterial color={index % 2 === 0 ? "#f8fdff" : "#cdeafa"} transparent opacity={0.46} />
          </mesh>
        );
      })}
    </group>
  );
}

function MountainVillageColliders({
  chunk,
  terrainColliderGeometry,
  layout,
  showInteriorColliders = true,
}: {
  chunk: SurvivalChunkInfo;
  terrainColliderGeometry: THREE.BufferGeometry;
  layout: MountainVillageLayout;
  showInteriorColliders?: boolean;
}) {
  if (!shouldBuildSurvivalChunkColliders(chunk)) return null;

  const dispatchLadderZone = (eventName: "wof-ladder-zone-enter" | "wof-ladder-zone-exit", id: string, event: any) => {
    if (event.other?.rigidBodyObject?.name !== "player") return;
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(eventName, { detail: { id } }));
  };
  const topExitLadder = layout.interiorLadders[layout.interiorLadders.length - 1];
  const topExitBridge = topExitLadder ? getMountainMineshaftExitBridgeFrame(topExitLadder) : null;
  const bottomY = layout.baseHeight + MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_BASE_OFFSET;

  return (
    <>
      <RigidBody type="fixed" colliders="trimesh" friction={0.38} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <mesh geometry={terrainColliderGeometry} dispose={null}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="trimesh" friction={0.82} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <mesh geometry={layout.trailColliderGeometry} dispose={null}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="trimesh" friction={0.72} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <mesh geometry={layout.summitColliderGeometry} dispose={null}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </RigidBody>
      {showInteriorColliders && (
        <>
          {topExitBridge && (
            <RigidBody type="fixed" colliders={false} friction={0.78} restitution={0} position={[chunk.x, 0, chunk.z]}>
              <CuboidCollider
                args={[MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH / 2, 0.36, topExitBridge.length / 2]}
                position={[topExitBridge.x, layout.summitY + MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_Y_OFFSET, topExitBridge.z]}
                rotation={[0, topExitBridge.angle, 0]}
              />
            </RigidBody>
          )}
          <RigidBody type="fixed" colliders={false} friction={0.7} restitution={0} position={[chunk.x, 0, chunk.z]}>
            <CuboidCollider
              args={[
                MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS * 0.82,
                0.42,
                MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS * 0.82,
              ]}
              position={[0, layout.baseHeight + MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_BASE_OFFSET - 0.42, 0]}
            />
          </RigidBody>
          <RigidBody type="fixed" colliders={false} friction={0.78} restitution={0} position={[chunk.x, 0, chunk.z]}>
            <CuboidCollider
              args={[MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_TABLE_RADIUS * 0.82, 1.18, MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_TABLE_RADIUS * 0.82]}
              position={[0, bottomY + 1.2, 0]}
            />
            <CuboidCollider
              args={[2.65, 2.2, 1.85]}
              position={[0, bottomY + 2.12, MOUNTAIN_VILLAGE_MINESHAFT_THRONE_Z]}
              rotation={[0, Math.PI, 0]}
            />
            {MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_ANGLES.map((angle, index) => (
              <CuboidCollider
                key={`banquet-chair-collider-${index}`}
                args={[1.18, 1.35, 1.05]}
                position={[
                  Math.sin(angle) * MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_RADIUS,
                  bottomY + 1.28,
                  Math.cos(angle) * MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_RADIUS,
                ]}
                rotation={[0, angle, 0]}
              />
            ))}
          </RigidBody>
          <RigidBody type="fixed" colliders={false} friction={0.78} restitution={0} position={[chunk.x, 0, chunk.z]}>
            {layout.interiorHuts.flatMap((hut) => {
              const midRadius = (MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS + MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS) / 2;
              const radialHalfWidth = (MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS - MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS) / 2;
              const arcHalfLength = ((Math.PI * 2 * midRadius) / MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_SEGMENTS) * 0.56;

              return getCachedIndexRange(MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_SEGMENTS).map((segmentIndex) => {
                const angle = ((segmentIndex + 0.5) / MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_SEGMENTS) * Math.PI * 2;

                return (
                  <CuboidCollider
                    key={`${hut.key}-catwalk-collider-${segmentIndex}`}
                    args={[arcHalfLength, 0.32, radialHalfWidth]}
                    position={[Math.sin(angle) * midRadius, hut.y, Math.cos(angle) * midRadius]}
                    rotation={[0, angle, 0]}
                  />
                );
              });
            })}
          </RigidBody>
          <RigidBody type="fixed" colliders={false} friction={0.78} restitution={0} position={[chunk.x, 0, chunk.z]}>
            {layout.interiorHuts.map((hut, index) => {
              const { wallThickness, doorWidth, doorHeight, frontWallWidth, lintelHeight } = getMountainCabinDoorMetrics(hut);
              const frontZ = hut.depth / 2 - wallThickness / 2;
              const backZ = -hut.depth / 2 + wallThickness / 2;
              const platformZ = hut.depth / 2 + hut.platformDepth / 2 - 1.1;
              const floorY = 0.48;
              const ladderGapCenterX = getMountainMineshaftLadderLandingLocalX(hut, layout.interiorLadders[index]);
              const platformPieces = getMountainMineshaftPlatformPieces(
                hut.platformWidth,
                ladderGapCenterX,
                MOUNTAIN_VILLAGE_MINESHAFT_LADDER_PLATFORM_GAP
              );

              return (
                <group key={`${hut.key}-colliders`} position={[hut.localX, hut.y, hut.localZ]} rotation={[0, hut.rotation, 0]}>
                  {platformPieces.map((piece) => (
                    <CuboidCollider
                      key={`${hut.key}-platform-collider-${piece.key}`}
                      args={[piece.width / 2, 0.45, hut.platformDepth / 2]}
                      position={[piece.centerX, 0, platformZ]}
                    />
                  ))}
                  <CuboidCollider args={[wallThickness / 2, hut.height / 2, hut.depth / 2]} position={[-hut.width / 2 + wallThickness / 2, hut.height / 2 + floorY, 0]} />
                  <CuboidCollider args={[wallThickness / 2, hut.height / 2, hut.depth / 2]} position={[hut.width / 2 - wallThickness / 2, hut.height / 2 + floorY, 0]} />
                  <CuboidCollider args={[hut.width / 2, hut.height / 2, wallThickness / 2]} position={[0, hut.height / 2 + floorY, backZ]} />
                  <CuboidCollider args={[frontWallWidth / 2, hut.height / 2, wallThickness / 2]} position={[-doorWidth / 2 - frontWallWidth / 2, hut.height / 2 + floorY, frontZ]} />
                  <CuboidCollider args={[frontWallWidth / 2, hut.height / 2, wallThickness / 2]} position={[doorWidth / 2 + frontWallWidth / 2, hut.height / 2 + floorY, frontZ]} />
                  <CuboidCollider args={[doorWidth / 2, lintelHeight / 2, wallThickness / 2]} position={[0, doorHeight + lintelHeight / 2 + floorY, frontZ]} />
                </group>
              );
            })}
          </RigidBody>
          {layout.interiorLadders.map((ladder) => {
            const height = Math.max(4, ladder.endY - ladder.startY);
            return (
              <RigidBody
                key={`${ladder.key}-sensor`}
                type="fixed"
                sensor
                colliders={false}
                name={`${ladder.key}-climb-zone`}
                position={[chunk.x + ladder.localX, ladder.startY + height / 2, chunk.z + ladder.localZ]}
                rotation={[0, ladder.rotation, 0]}
                onIntersectionEnter={(event) => dispatchLadderZone("wof-ladder-zone-enter", ladder.key, event)}
                onIntersectionExit={(event) => dispatchLadderZone("wof-ladder-zone-exit", ladder.key, event)}
              >
                <CuboidCollider args={[ladder.width / 2 + 0.9, height / 2, MOUNTAIN_VILLAGE_MINESHAFT_LADDER_SENSOR_DEPTH]} />
              </RigidBody>
            );
          })}
        </>
      )}
      <RigidBody type="fixed" colliders={false} friction={0.72} restitution={0} position={[chunk.x, 0, chunk.z]}>
        {layout.cabins.map((cabin) => {
          const { wallThickness, doorWidth, doorHeight, frontWallWidth, lintelHeight } = getMountainCabinDoorMetrics(cabin);
          const frontZ = cabin.depth / 2 - wallThickness / 2;
          const backZ = -cabin.depth / 2 + wallThickness / 2;

          return (
            <group key={`${cabin.key}-colliders`} position={[cabin.localX, layout.summitY, cabin.localZ]} rotation={[0, cabin.rotation, 0]}>
              <CuboidCollider args={[wallThickness / 2, cabin.height / 2, cabin.depth / 2]} position={[-cabin.width / 2 + wallThickness / 2, cabin.height / 2, 0]} />
              <CuboidCollider args={[wallThickness / 2, cabin.height / 2, cabin.depth / 2]} position={[cabin.width / 2 - wallThickness / 2, cabin.height / 2, 0]} />
              <CuboidCollider args={[cabin.width / 2, cabin.height / 2, wallThickness / 2]} position={[0, cabin.height / 2, backZ]} />
              <CuboidCollider args={[frontWallWidth / 2, cabin.height / 2, wallThickness / 2]} position={[-doorWidth / 2 - frontWallWidth / 2, cabin.height / 2, frontZ]} />
              <CuboidCollider args={[frontWallWidth / 2, cabin.height / 2, wallThickness / 2]} position={[doorWidth / 2 + frontWallWidth / 2, cabin.height / 2, frontZ]} />
              <CuboidCollider args={[doorWidth / 2, lintelHeight / 2, wallThickness / 2]} position={[0, doorHeight + lintelHeight / 2, frontZ]} />
            </group>
          );
        })}
      </RigidBody>
    </>
  );
}

export function SurvivalMountainVillage({
  chunk,
  terrainHeightForChunk,
  terrainColorAtWorld,
  villageBaseHeightForChunk,
}: {
  chunk: SurvivalChunkInfo;
  terrainHeightForChunk: SurvivalTerrainHeightForChunk;
  terrainColorAtWorld: SurvivalTerrainColorAtWorld;
  villageBaseHeightForChunk: SurvivalVillageBaseHeightForChunk;
}) {
  const baseHeight = useMemo(() => villageBaseHeightForChunk(chunk), [chunk, villageBaseHeightForChunk]);
  const showDetails = chunk.distance === 0;
  const detailPhase = useMountainVillageDetailPhase(showDetails, chunk.key);
  const showTrailAndCabinDetails = showDetails && detailPhase >= MOUNTAIN_VILLAGE_DETAIL_PHASE_TRAIL_AND_CABINS;
  const showMineshaftShell = showDetails && detailPhase >= MOUNTAIN_VILLAGE_DETAIL_PHASE_MINESHAFT_SHELL;
  const showMineshaftInterior = showDetails && detailPhase >= MOUNTAIN_VILLAGE_DETAIL_PHASE_MINESHAFT_INTERIOR;
  const showFinishingDetails = showDetails && detailPhase >= MOUNTAIN_VILLAGE_DETAIL_PHASE_FINISHING;
  const terrainGeometry = useMemo(
    () => makeMountainVillageTerrainGeometry(chunk, showMineshaftShell, showTrailAndCabinDetails, terrainHeightForChunk, terrainColorAtWorld, villageBaseHeightForChunk),
    [chunk, showMineshaftShell, showTrailAndCabinDetails, terrainColorAtWorld, terrainHeightForChunk, villageBaseHeightForChunk],
  );
  const hasColliders = shouldBuildSurvivalChunkColliders(chunk);
  const terrainColliderGeometry = useMemo(
    () => hasColliders ? makeMountainVillageTerrainColliderGeometry(chunk, showMineshaftShell, terrainHeightForChunk, villageBaseHeightForChunk) : null,
    [chunk, hasColliders, showMineshaftShell, terrainHeightForChunk, villageBaseHeightForChunk],
  );
  const includeMineshaftLayout = !showDetails || showMineshaftShell;
  const includeVillagerHutInfos = showFinishingDetails;
  const layout = useMemo(
    () => hasColliders
      ? makeMountainVillageLayout(chunk, baseHeight, terrainHeightForChunk, {
        includeMineshaftLayout,
        includeVillagerHutInfos,
      })
      : null,
    [chunk, baseHeight, hasColliders, includeMineshaftLayout, includeVillagerHutInfos, terrainHeightForChunk],
  );
  const terrainTexture = useMemo(() => getMountainVillageTerrainDetailTexture(), []);

  return (
    <>
      {layout && terrainColliderGeometry && (
        <MountainVillageColliders
          chunk={chunk}
          terrainColliderGeometry={terrainColliderGeometry}
          layout={layout}
          showInteriorColliders={!showDetails || detailPhase >= MOUNTAIN_VILLAGE_DETAIL_PHASE_MINESHAFT_INTERIOR}
        />
      )}
      <group name={`survival-mountain-village-${chunk.key}`} position={[chunk.x, 0, chunk.z]}>
        <mesh geometry={terrainGeometry} receiveShadow={showDetails} dispose={null}>
          <meshBasicMaterial map={terrainTexture} vertexColors color="#ffffff" />
        </mesh>
        <MountainSlopeGrass chunk={chunk} baseHeight={baseHeight} active={showDetails} terrainHeightForChunk={terrainHeightForChunk} terrainColorAtWorld={terrainColorAtWorld} />
        {layout && (
          <>
            <MountainCliffBreakup patches={layout.cliffPatches} showDetails={showTrailAndCabinDetails} />
            <MountainSnowCap summitY={layout.summitY} showDetails={showTrailAndCabinDetails} />
            <MountainVillageTrail layout={layout} showDetails={showTrailAndCabinDetails} />
            <MountainWaterfall chunk={chunk} waterfall={layout.waterfall} summitY={layout.summitY} showDetails={showTrailAndCabinDetails} />
            {showMineshaftShell && (
              <>
                <MountainMineshaftOpening
                  baseHeight={layout.baseHeight}
                  summitY={layout.summitY}
                  exitLadder={layout.interiorLadders[layout.interiorLadders.length - 1]}
                  showDetails={showMineshaftInterior}
                />
                {showMineshaftInterior && <MountainMineshaftInterior layout={layout} showDetails={showFinishingDetails} />}
              </>
            )}
            {layout.cabins.map((cabin) => (
              <MountainCabin key={cabin.key} cabin={cabin} summitY={layout.summitY} showDetails={showTrailAndCabinDetails} />
            ))}
          </>
        )}
      </group>
      {layout && showFinishingDetails && (
        <Villagers
          key={`survival-mountain-villagers-${chunk.key}`}
          huts={layout.hutInfos}
          name={`survival-mountain-villagers-${chunk.key}`}
        />
      )}
    </>
  );
}

