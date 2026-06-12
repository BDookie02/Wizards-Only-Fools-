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
import { MountainCabinView } from "./mountainVillageCabinView";
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
import { MountainMineshaftRoyalBanquet } from "./mountainVillageMineshaftBanquet";
import { MountainMineshaftCatwalkRingView } from "./mountainVillageMineshaftCatwalk";
import { MountainMineshaftTopExitBridgeView } from "./mountainVillageMineshaftExitBridge";
import { MountainMineshaftMiniHutView } from "./mountainVillageMineshaftHut";
import { MountainMineshaftLadderView } from "./mountainVillageMineshaftLadder";
import { MountainMineshaftWallLanterns } from "./mountainVillageMineshaftLighting";
import {
  MountainMineshaftWallPaintings,
  MountainMineshaftWallRopeLights,
} from "./mountainVillageMineshaftWallDecor";
import {
  getMountainMineshaftBanquetColliderDetails,
  getMountainMineshaftBottomRocks,
  getMountainMineshaftCatwalkColliderDetails,
  getMountainMineshaftExitBridgeFrame,
  getMountainMineshaftLadderLandingLocalX,
  getMountainMineshaftPlatformPieces,
  getMountainMineshaftRimBeams,
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
  MOUNTAIN_VILLAGE_RADIUS,
  getMountainVillageHeight,
  getMountainVillageRadialLift,
  getMountainVillageSummitFlatMask,
} from "./mountainVillageTerrain";
import { getMountainVillageTerrainColorInto, makeMountainVillageTerrainGeometry } from "./mountainVillageTerrainGeometry";
import { makeMountainVillageTrailDeckGeometry, makeMountainVillageTrailSurfaceGeometry } from "./mountainVillageTrailGeometry";
import { getMountainWaterfallVisualDescriptors, shouldHideMountainWaterfallForCamera } from "./mountainVillageWaterfallRuntime";
import {
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
const MOUNTAIN_EXIT_BRIDGE_BEAM_ZS = [-2.9, 0, 2.9] as const;

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

function MountainMineshaftInterior({ layout, showDetails }: { layout: MountainVillageLayout; showDetails: boolean }) {
  return (
    <group name="mountain-village-mineshaft-wall-huts">
      {layout.interiorHuts.map((hut, index) => (
        <MountainMineshaftCatwalkRingView
          key={`${hut.key}-catwalk-ring`}
          hut={hut}
          ladder={layout.interiorLadders[index]}
          nextLadder={layout.interiorLadders[index + 1]}
          showDetails={showDetails}
        />
      ))}
      {layout.interiorHuts.map((hut, index) => (
        <MountainMineshaftMiniHutView key={hut.key} hut={hut} ladder={layout.interiorLadders[index]} showDetails={showDetails} />
      ))}
      {layout.interiorLadders.map((ladder) => (
        <MountainMineshaftLadderView key={ladder.key} ladder={ladder} showDetails={showDetails} />
      ))}
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
      {exitLadder && <MountainMineshaftTopExitBridgeView ladder={exitLadder} summitY={summitY} showDetails={showDetails} />}
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
              <MountainCabinView key={cabin.key} cabin={cabin} summitY={layout.summitY} showDetails={showTrailAndCabinDetails} />
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

