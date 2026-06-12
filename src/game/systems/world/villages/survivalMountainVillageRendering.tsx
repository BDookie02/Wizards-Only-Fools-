import { Fragment, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { absoluteAngleDeltaRadians } from "../../math/angleMath";
import { getCachedIndexRange } from "../../rendering/indexRange";
import type { HutInfo } from "./baseVillageHutLayout";
import { Villagers } from "../../../Villagers";
import { shouldPublishCurrentMountainSlopeGrassTelemetry } from "../../../tools/qa/survivalQaTelemetryRoutes";
import { getMountainVillageTerrainDetailTexture } from "../terrain/survivalTerrainTextures";
import { shouldBuildSurvivalChunkColliders } from "../survival/survivalChunks";
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
  makeMountainVillageSummitColliderGeometry,
  makeMountainVillageTerrainColliderGeometry,
} from "./mountainVillageColliderGeometry";
import {
  MOUNTAIN_VILLAGE_DETAIL_PHASE_FINISHING,
  MOUNTAIN_VILLAGE_DETAIL_PHASE_MINESHAFT_INTERIOR,
  MOUNTAIN_VILLAGE_DETAIL_PHASE_MINESHAFT_SHELL,
  MOUNTAIN_VILLAGE_DETAIL_PHASE_TRAIL_AND_CABINS,
  useMountainVillageDetailPhase,
} from "./mountainVillageDetailPhase";
import {
  getMountainCabinDoorMetrics,
  makeMountainVillageCabins,
  makeMountainVillageCliffPatches,
  makeMountainVillageHutInfos,
  makeMountainVillageTrailPoints,
  makeMountainVillageTrailSegments,
  makeMountainVillageWaterfall,
  type MountainVillageCabin,
  type MountainVillageCliffPatch,
  type MountainVillageTrailPoint,
  type MountainVillageTrailSegment,
  type MountainVillageTrailSupport,
  type MountainVillageWaterfall,
} from "./mountainVillageLayoutRuntime";
import {
  MountainMineshaftLightPole,
  MountainMineshaftWallLanterns,
  RetroMineshaftLantern,
} from "./mountainVillageMineshaftLighting";
import {
  MountainMineshaftWallPaintings,
  MountainMineshaftWallRopeLights,
} from "./mountainVillageMineshaftWallDecor";
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
  makeMountainMineshaftHuts,
  makeMountainMineshaftLadders,
  type MountainMineshaftHut,
  type MountainMineshaftLadder,
} from "./mountainVillageMineshaftRuntime";
import {
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
  MOUNTAIN_VILLAGE_MINESHAFT_THRONE_Z,
  MOUNTAIN_VILLAGE_RADIUS,
  getMountainVillageHeight,
  getMountainVillageRadialLift,
  getMountainVillageSummitFlatMask,
} from "./mountainVillageTerrain";
import { getMountainVillageTerrainColorInto, makeMountainVillageTerrainGeometry } from "./mountainVillageTerrainGeometry";
import { makeMountainVillageTrailDeckGeometry, makeMountainVillageTrailSurfaceGeometry } from "./mountainVillageTrailGeometry";
import { getMountainWaterfallVisualDescriptors, shouldHideMountainWaterfallForCamera } from "./mountainVillageWaterfallRuntime";
import {
  MountainHutRoofDetails,
  MountainHutWallDetails,
  RetroWindowDetails,
  RetroHorizontalTimberDetails,
  RetroVerticalTimberDetails,
} from "./mountainVillageWoodDetails";

function shouldPublishMountainSlopeGrassTelemetry() {
  return shouldPublishCurrentMountainSlopeGrassTelemetry();
}

type SurvivalTerrainHeightForChunk = (chunk: SurvivalChunkInfo, localX: number, localZ: number) => number;
type SurvivalTerrainColorAtWorld = (worldX: number, worldZ: number, height: number) => THREE.Color;
type SurvivalVillageBaseHeightForChunk = (chunk: SurvivalChunkInfo) => number;

const MOUNTAIN_GRASS_BLADE_SOURCE_UP = new THREE.Vector3(0, 1, 0);
const MOUNTAIN_WATERFALL_VISIBILITY_CHECK_INTERVAL_SECONDS = 1 / 12;
const MOUNTAIN_RENDER_SIDES = [-1, 1] as const;
const MOUNTAIN_CATWALK_CENTER_RAIL_HEIGHTS = [0.86, 1.55, 2.08] as const;
const MOUNTAIN_EXIT_BRIDGE_BEAM_ZS = [-2.9, 0, 2.9] as const;
const MOUNTAIN_MINESHAFT_CHAIR_LEG_OFFSETS = [
  { x: -0.74, z: -0.5 },
  { x: -0.74, z: 0.54 },
  { x: 0.74, z: -0.5 },
  { x: 0.74, z: 0.54 },
] as const;
const MOUNTAIN_MINESHAFT_CHAIR_BACK_SPIRE_X = [-0.72, 0, 0.72] as const;
const MOUNTAIN_MINESHAFT_THRONE_ARM_SIDES = [-1.94, 1.94] as const;
const MOUNTAIN_MINESHAFT_THRONE_SPIRE_X = [-1.72, 0, 1.72] as const;

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

