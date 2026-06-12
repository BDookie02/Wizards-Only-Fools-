import { useMemo } from "react";
import * as THREE from "three";
import { Villagers } from "../../../Villagers";
import { getMountainVillageTerrainDetailTexture } from "../terrain/survivalTerrainTextures";
import { shouldBuildSurvivalChunkColliders } from "../survival/survivalChunks";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { makeMountainVillageTerrainColliderGeometry } from "./mountainVillageColliderGeometry";
import {
  MOUNTAIN_VILLAGE_DETAIL_PHASE_FINISHING,
  MOUNTAIN_VILLAGE_DETAIL_PHASE_MINESHAFT_INTERIOR,
  MOUNTAIN_VILLAGE_DETAIL_PHASE_MINESHAFT_SHELL,
  MOUNTAIN_VILLAGE_DETAIL_PHASE_TRAIL_AND_CABINS,
  useMountainVillageDetailPhase,
} from "./mountainVillageDetailPhase";
import { MountainCabinView } from "./mountainVillageCabinView";
import { MountainMineshaftOpeningView } from "./mountainVillageMineshaftOpening";
import { getMountainVillageTerrainColorInto, makeMountainVillageTerrainGeometry } from "./mountainVillageTerrainGeometry";
import { MountainVillageTrailView } from "./mountainVillageTrailView";
import { MountainWaterfallView } from "./mountainVillageWaterfallView";
import { MountainSnowCapView } from "./mountainVillageSnowCap";
import { MountainSlopeGrassView } from "./mountainVillageSlopeGrassView";
import { makeMountainVillageLayout } from "./mountainVillageSceneLayout";
import { MountainVillageColliders } from "./mountainVillageColliders";
import { MountainCliffBreakupView } from "./mountainVillageCliffBreakup";
import { MountainMineshaftInteriorView } from "./mountainVillageMineshaftInterior";

type SurvivalTerrainHeightForChunk = (chunk: SurvivalChunkInfo, localX: number, localZ: number) => number;
type SurvivalTerrainColorAtWorld = (worldX: number, worldZ: number, height: number) => THREE.Color;
type SurvivalVillageBaseHeightForChunk = (chunk: SurvivalChunkInfo) => number;

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
            <MountainCliffBreakupView patches={layout.cliffPatches} showDetails={showTrailAndCabinDetails} />
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
                {showMineshaftInterior && <MountainMineshaftInteriorView layout={layout} showDetails={showFinishingDetails} />}
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

