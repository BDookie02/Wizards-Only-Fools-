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
  makeMountainVillageCabins,
  makeMountainVillageCliffPatches,
  makeMountainVillageHutInfos,
  makeMountainVillageWaterfall,
  type MountainVillageCabin,
  type MountainVillageCliffPatch,
  type MountainVillageWaterfall,
} from "./mountainVillageLayoutRuntime";
import {
  getMountainMineshaftBanquetColliderDetails,
  getMountainMineshaftBottomRocks,
  getMountainMineshaftCatwalkDescriptors,
  getMountainMineshaftCatwalkColliderDetails,
  getMountainMineshaftCatwalkLightPoles,
  getMountainMineshaftExitBridgeDetails,
  getMountainMineshaftExitBridgeFrame,
  getMountainMineshaftLadderLandingLocalX,
  getMountainMineshaftLadderDetails,
  getMountainMineshaftPlatformDetails,
  getMountainMineshaftPlatformPieces,
  getMountainMineshaftRimBeams,
  getMountainMineshaftRoyalBanquetDescriptors,
  getMountainMineshaftSummitSnowDrifts,
  getMountainMineshaftSupportFrames,
  getMountainMineshaftWallDecorDescriptors,
  makeMountainMineshaftHuts,
  makeMountainMineshaftLadders,
  type MountainMineshaftHut,
  type MountainMineshaftLadder,
} from "./mountainVillageMineshaftRuntime";
import {
  MOUNTAIN_VILLAGE_EDGE_BLEND_START,
  MOUNTAIN_VILLAGE_HEIGHT,
  MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_BASE_OFFSET,
  MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_SEGMENTS,
  MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH,
  MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_Y_OFFSET,
  MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_LADDER_PLATFORM_GAP,
  MOUNTAIN_VILLAGE_MINESHAFT_LADDER_SENSOR_DEPTH,
  MOUNTAIN_VILLAGE_MINESHAFT_RIM_MID_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_RIM_OUTER_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_TERRAIN_CUT_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_THRONE_Z,
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
import { getMountainWaterfallVisualDescriptors, shouldHideMountainWaterfallForCamera } from "./mountainVillageWaterfallRuntime";

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
const MOUNTAIN_RENDER_SIDES = [-1, 1] as const;
const MOUNTAIN_TIMBER_GRAIN_OFFSETS = [-0.27, 0.26] as const;
const MOUNTAIN_HORIZONTAL_GRAIN_OFFSETS = [-0.2, 0.22] as const;
const MOUNTAIN_DOOR_STRAP_HEIGHT_RATIOS = [0.31, 0.64] as const;
const MOUNTAIN_MINESHAFT_ENTRY_POST_XS = [-2.56, 2.56] as const;
const MOUNTAIN_CATWALK_CENTER_RAIL_HEIGHTS = [0.86, 1.55, 2.08] as const;
const MOUNTAIN_EXIT_BRIDGE_BEAM_ZS = [-2.9, 0, 2.9] as const;
const MOUNTAIN_RETRO_WOOD_DARK_COLORS = ["#0a0604", "#1a100a", "#2f1d11", "#4d301b"] as const;
const MOUNTAIN_RETRO_WOOD_LIGHT_COLORS = ["#1b1009", "#3c2415", "#704627", "#b47a3f"] as const;
const MOUNTAIN_MINESHAFT_CHAIR_LEG_OFFSETS = [
  { x: -0.74, z: -0.5 },
  { x: -0.74, z: 0.54 },
  { x: 0.74, z: -0.5 },
  { x: 0.74, z: 0.54 },
] as const;
const MOUNTAIN_MINESHAFT_CHAIR_BACK_SPIRE_X = [-0.72, 0, 0.72] as const;
const MOUNTAIN_MINESHAFT_THRONE_ARM_SIDES = [-1.94, 1.94] as const;
const MOUNTAIN_MINESHAFT_THRONE_SPIRE_X = [-1.72, 0, 1.72] as const;

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

const EMPTY_MOUNTAIN_SLOPE_GRASS_TUFTS: MountainSlopeGrassTuft[] = [];
const EMPTY_MOUNTAIN_MINESHAFT_HUTS: MountainMineshaftHut[] = [];
const EMPTY_MOUNTAIN_MINESHAFT_LADDERS: MountainMineshaftLadder[] = [];
const EMPTY_MOUNTAIN_HUT_INFOS: HutInfo[] = [];

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
      : EMPTY_MOUNTAIN_SLOPE_GRASS_TUFTS,
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
  const cabins = makeMountainVillageCabins(chunk);
  const includeMineshaftLayout = options.includeMineshaftLayout ?? true;
  const interiorHuts = includeMineshaftLayout
    ? makeMountainMineshaftHuts(chunk, baseHeight, summitY)
    : EMPTY_MOUNTAIN_MINESHAFT_HUTS;
  const interiorLadders = includeMineshaftLayout
    ? makeMountainMineshaftLadders(chunk, baseHeight, interiorHuts, summitY)
    : EMPTY_MOUNTAIN_MINESHAFT_LADDERS;
  const hutInfos = (options.includeVillagerHutInfos ?? true)
    ? makeMountainVillageHutInfos(chunk, summitY, cabins, interiorHuts)
    : EMPTY_MOUNTAIN_HUT_INFOS;
  const waterfall = makeMountainVillageWaterfall(chunk, baseHeight, terrainHeightForChunk);

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
            {MOUNTAIN_RENDER_SIDES.map((side) => (
              <mesh key={`timber-bolt-${side}`} position={[side * width * 0.32, y + 0.01, z + 0.07]} castShadow={false}>
                <boxGeometry args={[0.18, 0.18, 0.12]} />
                <meshBasicMaterial color="#d7a85e" />
              </mesh>
            ))}
          </Fragment>
        );
      })}
      {MOUNTAIN_TIMBER_GRAIN_OFFSETS.map((offset, index) => (
        <mesh key={`timber-grain-${index}`} position={[offset * width, 0, z + 0.04]} castShadow={false}>
          <boxGeometry args={[0.08, height * 0.86, 0.08]} />
          <meshBasicMaterial color={index === 0 ? darkColor : lightColor} transparent opacity={0.82} />
        </mesh>
      ))}
      <RetroPixelWoodTexture width={width * 0.82} height={height * 0.86} z={z + 0.12} count={Math.max(5, Math.min(14, Math.floor(height / 2.8)))} seed={Math.floor(height + width * 5)} dark />
      {MOUNTAIN_RENDER_SIDES.map((side) => (
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
      {MOUNTAIN_HORIZONTAL_GRAIN_OFFSETS.map((offset, index) => (
        <mesh key={`horizontal-grain-${index}`} position={[0, offset * height, z + 0.04]} castShadow={false}>
          <boxGeometry args={[length * 0.86, 0.08, 0.08]} />
          <meshBasicMaterial color={darkColor} transparent opacity={index === 0 ? 0.72 : 0.46} />
        </mesh>
      ))}
      <RetroPixelWoodTexture width={length * 0.86} height={height * 0.86} z={z + 0.12} count={Math.max(6, Math.min(16, Math.floor(length / 2.8)))} seed={Math.floor(length + height * 9)} dark />
      {MOUNTAIN_RENDER_SIDES.map((side) => (
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
  const colors = dark ? MOUNTAIN_RETRO_WOOD_DARK_COLORS : MOUNTAIN_RETRO_WOOD_LIGHT_COLORS;

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
      {MOUNTAIN_DOOR_STRAP_HEIGHT_RATIOS.map((heightRatio, index) => (
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
      {MOUNTAIN_RENDER_SIDES.map((side) => (
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
      <Fragment>
        <mesh position={[0, lowerBandY, frontZ + 0.24]} castShadow={false}>
          <boxGeometry args={[width + 0.58, 0.32, 0.2]} />
          <meshBasicMaterial color="#2b1c12" />
        </mesh>
        <mesh position={[0, lowerBandY, backZ - 0.18]} castShadow={false}>
          <boxGeometry args={[width + 0.28, 0.24, 0.18]} />
          <meshBasicMaterial color="#2b1c12" />
        </mesh>
      </Fragment>
      <Fragment>
        <mesh position={[0, upperBandY, frontZ + 0.24]} castShadow={false}>
          <boxGeometry args={[width + 0.58, 0.32, 0.2]} />
          <meshBasicMaterial color="#805832" />
        </mesh>
        <mesh position={[0, upperBandY, backZ - 0.18]} castShadow={false}>
          <boxGeometry args={[width + 0.28, 0.24, 0.18]} />
          <meshBasicMaterial color="#2b1c12" />
        </mesh>
      </Fragment>
      {MOUNTAIN_RENDER_SIDES.map((side) => (
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
      {MOUNTAIN_RENDER_SIDES.map((side) => (
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
      {MOUNTAIN_RENDER_SIDES.map((side) => (
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
                {MOUNTAIN_RENDER_SIDES.map((side) => (
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
  position,
  rotation,
  index,
  withLight,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  index: number;
  withLight: boolean;
}) {
  return (
    <group position={position} rotation={rotation}>
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

  const { lanterns } = getMountainMineshaftWallDecorDescriptors({ bottomY, summitY });

  return (
    <group name="mineshaft-wall-hanging-lanterns">
      {lanterns.map((lantern) => (
        <MountainMineshaftWallHangingLantern
          key={`wall-lantern-${lantern.index}`}
          position={lantern.position}
          rotation={lantern.rotation}
          index={lantern.index}
          withLight={lantern.withLight}
        />
      ))}
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
      {MOUNTAIN_MINESHAFT_ENTRY_POST_XS.map((x) => (
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

  const { paintings } = getMountainMineshaftWallDecorDescriptors({ bottomY, summitY });

  return (
    <group name="mineshaft-villager-wall-paintings">
      {paintings.map((painting) => (
        <group key={`villager-painting-${painting.index}`} position={painting.position} rotation={painting.rotation}>
          <MountainMineshaftVillagerPainting variant={painting.variant} />
        </group>
      ))}
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

  const { ropeLights } = getMountainMineshaftWallDecorDescriptors({ bottomY, summitY });

  return (
    <group name="mineshaft-wall-rope-lights">
      {ropeLights.map((light) => (
        <group key={light.key} position={light.position} rotation={light.rotation}>
          <mesh position={[0, 0, -0.14]} castShadow={false}>
            <boxGeometry args={[2.08 * light.bulbScale, 0.24 * light.bulbScale, 0.16]} />
            <meshBasicMaterial color="#160d08" />
          </mesh>
          <mesh position={[-0.66 * light.bulbScale, 0, -0.18]} castShadow={false}>
            <boxGeometry args={[0.22 * light.bulbScale, 0.36 * light.bulbScale, 0.18]} />
            <meshBasicMaterial color="#4f321f" />
          </mesh>
          <mesh position={[0.66 * light.bulbScale, 0, -0.18]} castShadow={false}>
            <boxGeometry args={[0.22 * light.bulbScale, 0.36 * light.bulbScale, 0.18]} />
            <meshBasicMaterial color="#4f321f" />
          </mesh>
          <mesh position={[0, 0, -0.28]} castShadow={false} renderOrder={9}>
            <boxGeometry args={[0.92 * light.bulbScale, 0.92 * light.bulbScale, 0.1]} />
            <meshBasicMaterial color={light.glowColor} transparent opacity={0.96} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, -0.36]} castShadow={false} renderOrder={8}>
            <boxGeometry args={[2.75 * light.bulbScale, 2.75 * light.bulbScale, 0.04]} />
            <meshBasicMaterial color={light.glowColor} transparent opacity={0.28} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, -0.42]} castShadow={false} renderOrder={7}>
            <boxGeometry args={[4.1 * light.bulbScale, 4.1 * light.bulbScale, 0.035]} />
            <meshBasicMaterial color={light.glowColor} transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          {light.hasLight && <pointLight color={light.glowColor} intensity={3.6} distance={20} decay={2} position={[0, 0, -1.1]} />}
        </group>
      ))}
    </group>
  );
}

function MountainMineshaftBottomLightRing() {
  const { bottomLights } = getMountainMineshaftRoyalBanquetDescriptors();

  return (
    <group name="mineshaft-bottom-light-ring">
      {bottomLights.map((light) => (
        <group key={`bottom-light-${light.index}`} position={light.position} rotation={light.rotation}>
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
            <meshBasicMaterial color={light.bodyColor} />
          </mesh>
          <mesh position={[0, 1.1, 0]} castShadow={false}>
            <boxGeometry args={[0.42, 1.35, 0.42]} />
            <meshBasicMaterial color="#1a100a" />
          </mesh>
          <RetroMineshaftLantern position={[0, 2.08, 0]} scale={0.72} withLight={light.withLight} />
        </group>
      ))}
    </group>
  );
}

function MountainMineshaftBanquetChair({
  chair,
}: {
  chair: ReturnType<typeof getMountainMineshaftRoyalBanquetDescriptors>["chairs"][number];
}) {
  return (
    <group position={chair.position} rotation={chair.rotation}>
      <mesh position={[0, 0.72, 0]} castShadow={false}>
        <boxGeometry args={[2.0, 0.38, 1.72]} />
        <meshBasicMaterial color={chair.seatColor} />
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
      {MOUNTAIN_MINESHAFT_CHAIR_LEG_OFFSETS.map(({ x: legX, z: legZ }) => (
        <mesh key={`chair-leg-${legX}-${legZ}`} position={[legX, 0.36, legZ]} castShadow={false}>
          <boxGeometry args={[0.24, 0.72, 0.24]} />
          <meshBasicMaterial color="#1b1009" />
        </mesh>
      ))}
      {MOUNTAIN_MINESHAFT_CHAIR_BACK_SPIRE_X.map((barX) => (
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
      {MOUNTAIN_MINESHAFT_THRONE_ARM_SIDES.map((side) => (
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
      {MOUNTAIN_MINESHAFT_THRONE_SPIRE_X.map((x, index) => (
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
  const { table } = getMountainMineshaftRoyalBanquetDescriptors();

  return (
    <group name="mineshaft-royal-banquet-table">
      <mesh position={[0, 1.2, 0]} castShadow={false}>
        <cylinderGeometry args={[1.55, 2.1, 1.75, 12]} />
        <meshBasicMaterial color="#3a2415" />
      </mesh>
      <mesh position={[0, 1.78, 0]} castShadow={false}>
        <cylinderGeometry args={[table.radius, table.radius * 0.96, 0.58, 20]} />
        <meshBasicMaterial color="#5e3a20" />
      </mesh>
      <mesh position={[0, 2.14, 0]} castShadow={false}>
        <cylinderGeometry args={[table.radius * 1.05, table.radius * 1.05, 0.22, 20]} />
        <meshBasicMaterial color="#2a1a10" />
      </mesh>
      {table.planks.map((plank) => (
        <mesh key={`table-plank-${plank.index}`} position={[0, 2.28, plank.z]} castShadow={false}>
          <boxGeometry args={[plank.width, 0.08, 0.32]} />
          <meshBasicMaterial color={plank.color} transparent opacity={0.76} />
        </mesh>
      ))}
      {table.legs.map((leg) => (
        <mesh key={`table-leg-${leg.index}`} position={leg.position} castShadow={false}>
          <boxGeometry args={[0.42, 1.55, 0.42]} />
          <meshBasicMaterial color="#21140c" />
        </mesh>
      ))}
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
      {table.breads.map((bread) => (
        <group key={`banquet-bread-${bread.index}`} position={bread.position} rotation={bread.rotation}>
          <mesh scale={[1.18, 0.36, 0.62]} castShadow={false}>
            <sphereGeometry args={[1, 8, 5]} />
            <meshBasicMaterial color={bread.color} />
          </mesh>
          <mesh position={[0, 0.12, 0.18]} castShadow={false}>
            <boxGeometry args={[1.4, 0.08, 0.12]} />
            <meshBasicMaterial color="#fff0b2" transparent opacity={0.44} />
          </mesh>
        </group>
      ))}
      {table.fruitBowls.map((bowl) => (
        <group key={`fruit-bowl-${bowl.index}`} position={bowl.position}>
          <mesh position={[0, -0.04, 0]} castShadow={false}>
            <cylinderGeometry args={[0.86, 0.7, 0.18, 10]} />
            <meshBasicMaterial color="#2b1a0f" />
          </mesh>
          {bowl.fruits.map((fruit) => (
            <mesh key={`fruit-${fruit.index}`} position={fruit.position} scale={[0.24, 0.24, 0.24]} castShadow={false}>
              <sphereGeometry args={[1, 6, 4]} />
              <meshBasicMaterial color={fruit.color} />
            </mesh>
          ))}
        </group>
      ))}
      {table.plates.map((plate) => (
        <group key={`banquet-place-${plate.index}`} position={plate.position} rotation={plate.rotation}>
          <mesh castShadow={false}>
            <cylinderGeometry args={[0.82, 0.9, 0.08, 12]} />
            <meshBasicMaterial color="#d7cab2" />
          </mesh>
          <mesh position={[0, 0.09, -0.05]} scale={[0.48, 0.12, 0.32]} castShadow={false}>
            <sphereGeometry args={[1, 6, 4]} />
            <meshBasicMaterial color={plate.foodColor} />
          </mesh>
          <mesh position={[0.78, 0.2, -0.18]} castShadow={false}>
            <cylinderGeometry args={[0.16, 0.22, 0.42, 8]} />
            <meshBasicMaterial color="#b58b45" />
          </mesh>
        </group>
      ))}
      {table.candles.map((candle) => (
        <group key={`table-candle-${candle.index}`} position={candle.position}>
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

  const { chairs } = getMountainMineshaftRoyalBanquetDescriptors();

  return (
    <group name="mineshaft-bottom-royal-banquet" position={[0, bottomY, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]} renderOrder={8}>
        <circleGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS * 0.62, 40]} />
        <meshBasicMaterial color="#120b07" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <MountainMineshaftBottomLightRing />
      <MountainMineshaftBanquetTable />
      {chairs.map((chair) => (
        <MountainMineshaftBanquetChair key={`banquet-chair-${chair.index}`} chair={chair} />
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
  const platformDetails = getMountainMineshaftPlatformDetails({
    platformPieces,
    platformZ,
    platformDepth: hut.platformDepth,
    platformWidth: hut.platformWidth,
    poleSide,
    plankCount: 5,
  });

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
      {showDetails && platformDetails.pieces.map((pieceDetails) => (
        <Fragment key={`platform-detail-${pieceDetails.key}`}>
          {pieceDetails.sideShadows.map((shadow) => (
            <mesh key={`platform-side-shadow-${shadow.side}`} position={shadow.position} castShadow={false}>
              <boxGeometry args={[0.2, 0.12, hut.platformDepth * 0.92]} />
              <meshBasicMaterial color="#080504" transparent opacity={0.74} />
            </mesh>
          ))}
          {pieceDetails.plankGrooves.map((groove) => (
            <mesh key={`plank-groove-${groove.index}`} position={groove.position} castShadow={false}>
              <boxGeometry args={[groove.width, 0.07, 0.09]} />
              <meshBasicMaterial color={groove.color} />
            </mesh>
          ))}
          <mesh position={pieceDetails.frontRail.position} castShadow={false}>
            <boxGeometry args={[pieceDetails.frontRail.width, 0.22, 0.32]} />
            <meshBasicMaterial color="#8b6239" />
          </mesh>
          <mesh position={pieceDetails.backRail.position} castShadow={false}>
            <boxGeometry args={[pieceDetails.backRail.width, 0.18, 0.24]} />
            <meshBasicMaterial color="#2c1d13" />
          </mesh>
          {pieceDetails.bolts.map((bolt) => (
            <mesh key={`bolt-${bolt.side}`} position={bolt.position} castShadow={false}>
              <boxGeometry args={[0.28, 0.1, 0.28]} />
              <meshBasicMaterial color="#d0a05d" />
            </mesh>
          ))}
        </Fragment>
      ))}
      {platformDetails.supports.map((support) => (
        <group key={`platform-support-${support.side}`} position={support.position} rotation={support.rotation}>
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
            position={platformDetails.lightPole.position}
            direction={platformDetails.lightPole.direction}
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
  const ladderDetails = getMountainMineshaftLadderDetails({ height, width: ladder.width });

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
      {ladderDetails.rungs.map((rung) => (
        <mesh key={`rung-${rung.index}`} position={rung.position} castShadow={false}>
          <boxGeometry args={[ladder.width + 0.55, 0.24, 0.32]} />
          <meshBasicMaterial color={rung.color} />
        </mesh>
      ))}
      {showDetails && (
        <>
          <mesh position={[0, height / 2, -0.12]} castShadow={false}>
            <boxGeometry args={[ladder.width + 0.9, height * 0.94, 0.08]} />
            <meshBasicMaterial color="#050403" transparent opacity={0.22} />
          </mesh>
          {MOUNTAIN_RENDER_SIDES.map((side) => (
            <mesh key={`rail-highlight-${side}`} position={[side * ladder.width / 2 + side * 0.08, height / 2, 0.2]} castShadow={false}>
              <boxGeometry args={[0.1, height * 0.94, 0.08]} />
              <meshBasicMaterial color="#8a5b34" />
            </mesh>
          ))}
          {ladderDetails.wraps.map((wrap) => (
            <Fragment key={`ladder-wrap-${wrap.index}`}>
              <mesh position={wrap.leftPosition} castShadow={false}>
                <boxGeometry args={[0.64, 0.3, 0.42]} />
                <meshBasicMaterial color={wrap.color} />
              </mesh>
              <mesh position={wrap.rightPosition} castShadow={false}>
                <boxGeometry args={[0.64, 0.3, 0.42]} />
                <meshBasicMaterial color={wrap.color} />
              </mesh>
            </Fragment>
          ))}
          {ladderDetails.brightEdges.map((edge) => (
            <mesh key={`rung-bright-edge-${edge.index}`} position={edge.position} castShadow={false}>
              <boxGeometry args={[ladder.width + 0.18, 0.07, 0.1]} />
              <meshBasicMaterial color="#b27a42" />
            </mesh>
          ))}
          {ladderDetails.darkEdges.map((edge) => (
            <mesh key={`rung-dark-edge-${edge.index}`} position={edge.position} castShadow={false}>
              <boxGeometry args={[ladder.width + 0.42, 0.08, 0.12]} />
              <meshBasicMaterial color="#090604" transparent opacity={0.72} />
            </mesh>
          ))}
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
  const catwalkDescriptors = useMemo(
    () =>
      getMountainMineshaftCatwalkDescriptors({
        segments: MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_SEGMENTS,
        innerRadius: MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS,
        outerRadius: MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS,
      }),
    [],
  );
  const lightPoles = useMemo(
    () => getMountainMineshaftCatwalkLightPoles(hut.angle, catwalkDescriptors.lightPoleRadius),
    [hut.angle, catwalkDescriptors.lightPoleRadius],
  );
  const centerGuardRailRadius = catwalkDescriptors.centerGuardRailRadius;
  const centerGuardRailSegmentLength = catwalkDescriptors.centerGuardRailSegmentLength;
  const balconyGapHalfAngle = Math.min(0.52, Math.max(0.34, (hut.platformWidth * 0.38) / centerGuardRailRadius));
  const ladderGapHalfAngle = ladder
    ? Math.min(0.5, Math.max(0.34, (ladder.width * 1.35) / centerGuardRailRadius))
    : 0;
  const nextLadderGapHalfAngle = nextLadder
    ? Math.min(0.5, Math.max(0.34, (nextLadder.width * 1.35) / centerGuardRailRadius))
    : 0;
  const isGuardRailOpening = (angle: number) => {
    if (absoluteAngleDeltaRadians(hut.angle, angle) < balconyGapHalfAngle) return true;
    if (ladder && absoluteAngleDeltaRadians(ladder.angle, angle) < ladderGapHalfAngle) return true;
    return Boolean(nextLadder && absoluteAngleDeltaRadians(nextLadder.angle, angle) < nextLadderGapHalfAngle);
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
      {showDetails && catwalkDescriptors.planks.map((plank) => {
        return (
          <mesh key={`catwalk-plank-${plank.index}`} position={plank.position} rotation={plank.rotation} castShadow={false}>
            <boxGeometry args={[1.15, 0.24, MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS - MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS + 0.8]} />
            <meshBasicMaterial color={plank.index % 2 === 0 ? "#7a5635" : "#5d3f28"} />
          </mesh>
        );
      })}
      {showDetails && catwalkDescriptors.darkGaps.map((darkGap) => {
        return (
          <mesh key={`catwalk-dark-gap-${darkGap.index}`} position={darkGap.position} rotation={darkGap.rotation} castShadow={false}>
            <boxGeometry args={[0.16, 0.08, MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS - MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS + 1.0]} />
            <meshBasicMaterial color="#080504" transparent opacity={0.58} />
          </mesh>
        );
      })}
      {showDetails && catwalkDescriptors.edgeBlocks.map((edgeBlock) => {
        if (isGuardRailOpening(edgeBlock.angle)) return null;

        return (
          <mesh key={`catwalk-edge-block-${edgeBlock.index}`} position={edgeBlock.position} rotation={edgeBlock.rotation} castShadow={false}>
            <boxGeometry args={[0.68, 0.34, 0.54]} />
            <meshBasicMaterial color={edgeBlock.index % 3 === 0 ? "#9b6a3b" : "#2f1e13"} />
          </mesh>
        );
      })}
      {showDetails && catwalkDescriptors.guardPosts.map((guardPost) => {
        if (isGuardRailOpening(guardPost.angle)) return null;

        return (
          <mesh key={`catwalk-center-guard-post-${guardPost.index}`} position={guardPost.position} rotation={guardPost.rotation} castShadow={false}>
            <boxGeometry args={[0.42, 1.48, 0.42]} />
            <meshBasicMaterial color={guardPost.index % 2 === 0 ? "#2b1c12" : "#4d301b"} />
          </mesh>
        );
      })}
      {showDetails && MOUNTAIN_CATWALK_CENTER_RAIL_HEIGHTS.map((height, railIndex) => (
        <Fragment key={`catwalk-center-guard-rail-row-${railIndex}`}>
          {catwalkDescriptors.railSegments.map((railSegment) => {
            if (isGuardRailOpening(railSegment.angle)) return null;

            return (
              <mesh key={`rail-${railSegment.index}`} position={[railSegment.position[0], height, railSegment.position[2]]} rotation={railSegment.rotation} castShadow={false}>
                <boxGeometry args={[centerGuardRailSegmentLength, 0.24, railIndex === 0 ? 0.32 : 0.28]} />
                <meshBasicMaterial color={railIndex === 1 ? "#8d6238" : "#24170f"} />
              </mesh>
            );
          })}
        </Fragment>
      ))}
      {showDetails && lightPoles.map((lightPole) => {
        return (
          <group key={`catwalk-light-pole-${lightPole.index}`} position={lightPole.position} rotation={lightPole.rotation}>
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
  const exitDetails = getMountainMineshaftExitBridgeDetails({
    length: bridge.length,
    width: MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH,
  });
  const y = summitY + MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_Y_OFFSET;

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
          {exitDetails.edgeShadows.map((edge) => (
            <mesh key={`exit-bridge-edge-shadow-${edge.side}`} position={edge.position} castShadow={false}>
              <boxGeometry args={[0.24, 0.12, bridge.length * 0.98]} />
              <meshBasicMaterial color="#080504" transparent opacity={0.72} />
            </mesh>
          ))}
          {exitDetails.darkGaps.map((gap) => (
            <mesh key={`exit-bridge-dark-gap-${gap.index}`} position={[0, 0.8, gap.z]} castShadow={false}>
              <boxGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH * 0.84, 0.08, 0.14]} />
              <meshBasicMaterial color="#090604" transparent opacity={0.56} />
            </mesh>
          ))}
        </>
      )}
      {showDetails && exitDetails.planks.map((plank) => (
        <mesh key={`exit-plank-${plank.index}`} position={[0, 0.64, plank.z]} castShadow={false}>
          <boxGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH + 0.8, 0.16, 1.45]} />
          <meshBasicMaterial color={plank.color} />
        </mesh>
      ))}
      {exitDetails.sideRails.map((rail) => (
        <Fragment key={`exit-side-${rail.side}`}>
          <mesh position={rail.position} castShadow={false}>
            <boxGeometry args={[0.36, 0.36, bridge.length * 0.92]} />
            <meshBasicMaterial color="#2b1c12" />
          </mesh>
          {showDetails && rail.posts.map((post) => (
            <mesh key={`exit-post-${post.side}-${post.index}`} position={post.position} castShadow={false}>
              <boxGeometry args={[0.46, 1.34, 0.46]} />
              <meshBasicMaterial color={post.color} />
            </mesh>
          ))}
        </Fragment>
      ))}
      {showDetails && (
        <>
          {exitDetails.supports.map((support) => (
            <group key={`exit-support-${support.key}`} position={support.position} rotation={support.rotation}>
              <mesh castShadow={false}>
                <boxGeometry args={[exitDetails.supportLength, 0.42, 0.6]} />
                <meshBasicMaterial color="#3a2719" />
              </mesh>
              <RetroHorizontalTimberDetails length={exitDetails.supportLength} height={0.42} depth={0.6} bandColor="#8a5b34" />
            </group>
          ))}
          <RetroMineshaftLantern position={exitDetails.lanternPosition} scale={0.7} withLight />
        </>
      )}
    </group>
  );
}

function MountainMineshaftOpening({ baseHeight, summitY, exitLadder, showDetails }: { baseHeight: number; summitY: number; exitLadder?: MountainMineshaftLadder; showDetails: boolean }) {
  const bottomY = baseHeight + MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_BASE_OFFSET;
  const shaftWallHeight = Math.max(32, summitY - bottomY + 1.2);
  const shaftWallY = bottomY + shaftWallHeight / 2 - 0.2;
  const rimBeams = useMemo(
    () =>
      getMountainMineshaftRimBeams({
        count: 12,
        holeRadius: MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS,
        outerRadius: MOUNTAIN_VILLAGE_MINESHAFT_RIM_OUTER_RADIUS,
    }),
    [],
  );
  const bottomRocks = useMemo(
    () =>
      getMountainMineshaftBottomRocks({
        count: 14,
        bottomRadius: MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS,
      }),
    [],
  );
  const supportFrames = useMemo(() => getMountainMineshaftSupportFrames({ count: 4 }), []);

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
      {showDetails && bottomRocks.map((rock) => (
        <mesh key={`mine-bottom-rock-${rock.index}`} position={[rock.x, bottomY + 0.12, rock.z]} rotation={rock.rotation} scale={rock.scale} castShadow={false}>
          <boxGeometry args={[1.8, 0.65, 1.25]} />
          <meshStandardMaterial color={rock.color} roughness={1} />
        </mesh>
      ))}
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
      {rimBeams.map((beam) => {
        if (exitLadder && absoluteAngleDeltaRadians(exitLadder.angle, beam.angle) < 0.38) return null;

        return (
          <group key={`mine-rim-beam-${beam.index}`} position={[beam.x, summitY + 1.02, beam.z]} rotation={beam.rotation}>
            <mesh castShadow={false}>
              <boxGeometry args={[3.4, 0.9, 9.5]} />
              <meshBasicMaterial color={beam.index % 2 === 0 ? "#4b3421" : "#5e442d"} />
            </mesh>
            {showDetails && (
              <>
                {MOUNTAIN_EXIT_BRIDGE_BEAM_ZS.map((beamZ, bandIndex) => (
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
      {showDetails && supportFrames.map((frame) => (
        <group key={`mine-support-${frame.index}`} rotation={frame.rotation}>
          {frame.posts.map((post) => (
            <group
              key={`mine-support-post-${post.side}`}
              position={[post.positionOffset[0], summitY + post.positionOffset[1], post.positionOffset[2]]}
              rotation={post.rotation}
            >
              <mesh castShadow={false}>
                <boxGeometry args={[2.3, 15.5, 2.3]} />
                <meshBasicMaterial color="#392719" />
              </mesh>
              <RetroVerticalTimberDetails height={15.5} width={2.3} depth={2.3} bandColor="#a67642" lightColor="#8a5b34" />
            </group>
          ))}
          <group position={[frame.topBeamPositionOffset[0], summitY + frame.topBeamPositionOffset[1], frame.topBeamPositionOffset[2]]}>
            <mesh castShadow={false}>
              <boxGeometry args={[27.5, 2.4, 2.6]} />
              <meshBasicMaterial color="#513821" />
            </mesh>
            <RetroHorizontalTimberDetails length={27.5} height={2.4} depth={2.6} bandColor="#be8a4c" />
            {frame.snowCaps.map((snowCap) => (
              <mesh key={`support-snow-cap-${snowCap.side}`} position={snowCap.position} castShadow={false}>
                <boxGeometry args={[5.1, 0.22, 1.88]} />
                <meshBasicMaterial color="#e8f8ff" transparent opacity={0.7} />
              </mesh>
            ))}
          </group>
        </group>
      ))}
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

  const waterfallVisuals = getMountainWaterfallVisualDescriptors({ waterfall, summitY });

  return (
    <group ref={waterfallRef} name="mountain-village-waterfall">
      <mesh position={waterfallVisuals.mainFall.position} rotation={waterfallVisuals.mainFall.rotation}>
        <planeGeometry args={[waterfallVisuals.mainFall.width, waterfallVisuals.mainFall.height]} />
        <meshBasicMaterial color="#89e9ff" transparent opacity={0.48} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={waterfallVisuals.brightFall.position} rotation={waterfallVisuals.brightFall.rotation}>
        <planeGeometry args={[waterfallVisuals.brightFall.width, waterfallVisuals.brightFall.height]} />
        <meshBasicMaterial color="#effdff" transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {waterfallVisuals.darkEdges.map((edge) => (
        <mesh
          key={`mountain-fall-dark-edge-${edge.side}`}
          position={edge.position}
          rotation={edge.rotation}
        >
          <planeGeometry args={[edge.width, edge.height]} />
          <meshBasicMaterial color="#16596d" transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      <mesh rotation={waterfallVisuals.topFoam.rotation} position={waterfallVisuals.topFoam.position} scale={waterfallVisuals.topFoam.scale}>
        <circleGeometry args={[1, 18]} />
        <meshBasicMaterial color="#b9f1ff" transparent opacity={0.48} depthWrite={false} />
      </mesh>
      <mesh rotation={waterfallVisuals.bottomFoam.rotation} position={waterfallVisuals.bottomFoam.position} scale={waterfallVisuals.bottomFoam.scale}>
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial color="#5bbbd4" transparent opacity={0.56} depthWrite={false} />
      </mesh>
      {waterfallVisuals.sprayPuffs.map((spray) => (
        <mesh key={`mountain-fall-spray-${spray.index}`} position={spray.position} scale={spray.scale} castShadow={false}>
          <sphereGeometry args={[1, 6, 4]} />
          <meshBasicMaterial color="#dffaff" transparent opacity={0.26} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function MountainSnowCap({ summitY, showDetails }: { summitY: number; showDetails: boolean }) {
  if (!showDetails) return null;

  const snowDrifts = getMountainMineshaftSummitSnowDrifts();

  return (
    <group name="mountain-village-snow-cap">
      {snowDrifts.map((drift) => (
        <mesh
          key={`summit-snow-drift-${drift.index}`}
          rotation={drift.rotation}
          position={[drift.positionXZ[0], summitY + drift.yOffset, drift.positionXZ[1]]}
          scale={drift.scale}
        >
          <circleGeometry args={[1, 12]} />
          <meshBasicMaterial color={drift.color} transparent opacity={0.46} />
        </mesh>
      ))}
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
  const banquetColliderDetails = getMountainMineshaftBanquetColliderDetails();
  const catwalkColliderDetails = getMountainMineshaftCatwalkColliderDetails({
    segments: MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_SEGMENTS,
    innerRadius: MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS,
    outerRadius: MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS,
  });

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
              args={banquetColliderDetails.table.args}
              position={[
                banquetColliderDetails.table.positionOffset[0],
                bottomY + banquetColliderDetails.table.positionOffset[1],
                banquetColliderDetails.table.positionOffset[2],
              ]}
            />
            <CuboidCollider
              args={banquetColliderDetails.throne.args}
              position={[
                banquetColliderDetails.throne.positionOffset[0],
                bottomY + banquetColliderDetails.throne.positionOffset[1],
                banquetColliderDetails.throne.positionOffset[2],
              ]}
              rotation={banquetColliderDetails.throne.rotation}
            />
            {banquetColliderDetails.chairs.map((chair) => (
              <CuboidCollider
                key={`banquet-chair-collider-${chair.index}`}
                args={chair.args}
                position={[
                  chair.positionOffset[0],
                  bottomY + chair.positionOffset[1],
                  chair.positionOffset[2],
                ]}
                rotation={chair.rotation}
              />
            ))}
          </RigidBody>
          <RigidBody type="fixed" colliders={false} friction={0.78} restitution={0} position={[chunk.x, 0, chunk.z]}>
            {layout.interiorHuts.map((hut) => (
              <Fragment key={`${hut.key}-catwalk-colliders`}>
                {catwalkColliderDetails.segments.map((segment) => (
                  <CuboidCollider
                    key={`${hut.key}-catwalk-collider-${segment.index}`}
                    args={catwalkColliderDetails.args}
                    position={[segment.positionOffset[0], hut.y + segment.positionOffset[1], segment.positionOffset[2]]}
                    rotation={segment.rotation}
                  />
                ))}
              </Fragment>
            ))}
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

