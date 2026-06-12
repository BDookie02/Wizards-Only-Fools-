import { useMemo } from "react";
import * as THREE from "three";
import { getSurvivalTerrainDetailTexture } from "../terrain/survivalTerrainTextures";
import { shouldRenderSurvivalChunkSkirt } from "../survival/survivalChunks";
import { useGraveyardLoadStage } from "../survival/survivalLoadStage";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { useSurvivalFeatureCount } from "../../../tools/qa/survivalFeatureCounters";
import { makeGraveyardLayout } from "./survivalGraveyardVillageLayout";
import { GraveyardCatholicChapel } from "./survivalGraveyardChapelView";
import { GraveyardVillageColliders } from "./survivalGraveyardVillageColliders";
import { GraveyardPathStones, GraveyardSpikedFence } from "./survivalGraveyardVillageGroundProps";
import { GraveyardTombs } from "./survivalGraveyardVillageTombs";
import {
  getGraveyardVillageHeight,
  makeGraveyardVillageTerrainGeometry,
  makeGraveyardVillageTerrainSkirtGeometry,
  type SurvivalTerrainColorAtWorld,
  type SurvivalTerrainHeightForChunk,
  type SurvivalVillageBaseHeightForChunk,
} from "./survivalGraveyardVillageGeometry";

export function SurvivalGraveyardVillage({
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
  const graveyardLoadStage = useGraveyardLoadStage(chunk);
  const baseHeight = useMemo(() => villageBaseHeightForChunk(chunk), [chunk, villageBaseHeightForChunk]);
  const terrainGeometry = useMemo(
    () => makeGraveyardVillageTerrainGeometry(chunk, terrainHeightForChunk, terrainColorAtWorld, villageBaseHeightForChunk),
    [chunk, terrainColorAtWorld, terrainHeightForChunk, villageBaseHeightForChunk],
  );
  const hasTerrainSkirt = shouldRenderSurvivalChunkSkirt(chunk);
  const terrainSkirtGeometry = useMemo(
    () => hasTerrainSkirt
      ? makeGraveyardVillageTerrainSkirtGeometry(chunk, terrainHeightForChunk, terrainColorAtWorld, villageBaseHeightForChunk)
      : null,
    [chunk, hasTerrainSkirt, terrainColorAtWorld, terrainHeightForChunk, villageBaseHeightForChunk],
  );
  const terrainDetailTexture = useMemo(() => getSurvivalTerrainDetailTexture(), []);
  const showNearDetails = chunk.distance === 0;
  const showPathStones = showNearDetails && graveyardLoadStage >= 1;
  const showFenceDetails = showNearDetails && graveyardLoadStage >= 2;
  const showTombDetails = showNearDetails && graveyardLoadStage >= 3;
  const showChapelDetails = showNearDetails && graveyardLoadStage >= 4;
  const showChapelShell = !showNearDetails || graveyardLoadStage >= 2;
  const layout = useMemo(
    () => makeGraveyardLayout(
      chunk,
      baseHeight,
      showPathStones,
      (localX, localZ) => getGraveyardVillageHeight(chunk, localX, localZ, terrainHeightForChunk, baseHeight),
    ),
    [chunk, baseHeight, showPathStones, terrainHeightForChunk],
  );

  useSurvivalFeatureCount("graveyardTombs", chunk.key, showTombDetails ? layout.tombs.length : Math.ceil(layout.tombs.length / 4));
  useSurvivalFeatureCount("graveyardFenceSegments", chunk.key, layout.fenceSegments.length);
  useSurvivalFeatureCount("graveyardPathStones", chunk.key, showPathStones ? layout.pathStones.length : 0);

  return (
    <>
      <GraveyardVillageColliders chunk={chunk} baseHeight={baseHeight} groundGeometry={terrainGeometry} fenceSegments={layout.fenceSegments} />
      <group name={`survival-graveyard-village-${chunk.key}`} position={[chunk.x, 0, chunk.z]}>
        {terrainSkirtGeometry && (
          <mesh geometry={terrainSkirtGeometry} dispose={null}>
            <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
          </mesh>
        )}
        <mesh geometry={terrainGeometry} dispose={null} receiveShadow={showNearDetails}>
          <meshStandardMaterial vertexColors map={terrainDetailTexture} roughness={1} metalness={0} />
        </mesh>
        <GraveyardPathStones stones={layout.pathStones} showDetails={showPathStones} />
        <GraveyardSpikedFence segments={layout.fenceSegments} showDetails={showFenceDetails} />
        <GraveyardTombs tombs={layout.tombs} showDetails={showTombDetails} />
        {showChapelShell && <GraveyardCatholicChapel baseHeight={baseHeight} showDetails={showChapelDetails} />}
      </group>
    </>
  );
}

