import { Fragment, useMemo } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import type { HutInfo } from "./baseVillageHutLayout";
import { Villagers } from "../../../Villagers";
import { getMountainVillageTerrainDetailTexture } from "../terrain/survivalTerrainTextures";
import { shouldBuildSurvivalChunkColliders } from "../survival/survivalChunks";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
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
  type MountainVillageWaterfall,
} from "./mountainVillageLayoutRuntime";
import { MountainMineshaftCatwalkRingView } from "./mountainVillageMineshaftCatwalk";
import { MountainMineshaftMiniHutView } from "./mountainVillageMineshaftHut";
import { MountainMineshaftLadderView } from "./mountainVillageMineshaftLadder";
import { MountainMineshaftOpeningView } from "./mountainVillageMineshaftOpening";
import {
  getMountainMineshaftBanquetColliderDetails,
  getMountainMineshaftCatwalkColliderDetails,
  getMountainMineshaftExitBridgeFrame,
  getMountainMineshaftLadderLandingLocalX,
  getMountainMineshaftPlatformPieces,
  makeMountainMineshaftHuts,
  makeMountainMineshaftLadders,
  type MountainMineshaftHut,
  type MountainMineshaftLadder,
} from "./mountainVillageMineshaftRuntime";
import {
  MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_BASE_OFFSET,
  MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_SEGMENTS,
  MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH,
  MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_Y_OFFSET,
  MOUNTAIN_VILLAGE_MINESHAFT_LADDER_PLATFORM_GAP,
  MOUNTAIN_VILLAGE_MINESHAFT_LADDER_SENSOR_DEPTH,
  getMountainVillageHeight,
  getMountainVillageRadialLift,
  getMountainVillageSummitFlatMask,
} from "./mountainVillageTerrain";
import { getMountainVillageTerrainColorInto, makeMountainVillageTerrainGeometry } from "./mountainVillageTerrainGeometry";
import { makeMountainVillageTrailDeckGeometry, makeMountainVillageTrailSurfaceGeometry } from "./mountainVillageTrailGeometry";
import { MountainVillageTrailView } from "./mountainVillageTrailView";
import { MountainWaterfallView } from "./mountainVillageWaterfallView";
import { MountainSnowCapView } from "./mountainVillageSnowCap";
import { MountainSlopeGrassView } from "./mountainVillageSlopeGrassView";

type SurvivalTerrainHeightForChunk = (chunk: SurvivalChunkInfo, localX: number, localZ: number) => number;
type SurvivalTerrainColorAtWorld = (worldX: number, worldZ: number, height: number) => THREE.Color;
type SurvivalVillageBaseHeightForChunk = (chunk: SurvivalChunkInfo) => number;

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

const EMPTY_MOUNTAIN_MINESHAFT_HUTS: MountainMineshaftHut[] = [];
const EMPTY_MOUNTAIN_MINESHAFT_LADDERS: MountainMineshaftLadder[] = [];
const EMPTY_MOUNTAIN_HUT_INFOS: HutInfo[] = [];

type MountainVillageLayoutOptions = {
  includeMineshaftLayout?: boolean;
  includeVillagerHutInfos?: boolean;
};

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
        <MountainSlopeGrassView chunk={chunk} baseHeight={baseHeight} active={showDetails} terrainHeightForChunk={terrainHeightForChunk} terrainColorAtWorld={terrainColorAtWorld} />
        {layout && (
          <>
            <MountainCliffBreakup patches={layout.cliffPatches} showDetails={showTrailAndCabinDetails} />
            <MountainSnowCapView summitY={layout.summitY} showDetails={showTrailAndCabinDetails} />
            <MountainVillageTrailView
              trailSegments={layout.trailSegments}
              trailDeckGeometry={layout.trailDeckGeometry}
              trailTopGeometry={layout.trailTopGeometry}
              showDetails={showTrailAndCabinDetails}
            />
            <MountainWaterfallView chunk={chunk} waterfall={layout.waterfall} summitY={layout.summitY} showDetails={showTrailAndCabinDetails} />
            {showMineshaftShell && (
              <>
                <MountainMineshaftOpeningView
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

