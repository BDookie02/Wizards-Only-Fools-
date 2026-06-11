import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import { useSurvivalFeatureCount } from "../../../tools/qa/survivalFeatureCounters";
import {
  getSurvivalWaterLevelAtWorld,
  isSurvivalRestoredMeadowWaterSuppressed,
  survivalBiomeStyle,
} from "./survivalBiome";
import { survivalHash01 } from "./survivalMath";
import {
  getSurvivalShoreOpacityForBiome,
  getSurvivalWaterOpacityForBiome,
  makeSurvivalRiverSurfaceGeometry,
} from "./survivalRivers";
import { makeSurvivalLilyPads, makeSurvivalPonds } from "./survivalWaterFeatures";
import { SurvivalWaterfalls } from "./survivalWaterfallRendering";
import type { SurvivalChunkInfo } from "./survivalWorldConfig";

export type SurvivalTerrainHeightForWaterFeatures = (
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
) => number;

const SURVIVAL_POND_CIRCLE_GEOMETRY = new THREE.CircleGeometry(1, 16);
const SURVIVAL_LILY_PAD_GEOMETRY = new THREE.CircleGeometry(1, 10);
const SURVIVAL_LILY_PAD_MATERIAL = new THREE.MeshBasicMaterial({ color: "#69a33a" });
const survivalWaterFeatureMaterialCache = new Map<string, THREE.MeshBasicMaterial>();

function getCachedWaterFeatureMaterial(
  keyPrefix: string,
  color: string,
  opacity: number,
  options: {
    side?: THREE.Side;
    polygonOffset?: boolean;
    polygonOffsetFactor?: number;
  } = {},
) {
  const key = `${keyPrefix}:${color}:${opacity}:${options.side ?? "front"}:${options.polygonOffset ? 1 : 0}:${options.polygonOffsetFactor ?? 0}`;
  let material = survivalWaterFeatureMaterialCache.get(key);
  if (!material) {
    material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      side: options.side,
      polygonOffset: options.polygonOffset,
      polygonOffsetFactor: options.polygonOffsetFactor,
    });
    survivalWaterFeatureMaterialCache.set(key, material);
  }
  return material;
}

export function SurvivalWaterFeatures({
  chunk,
  terrainHeightForChunk,
  grassSystemEnabled,
}: {
  chunk: SurvivalChunkInfo;
  terrainHeightForChunk: SurvivalTerrainHeightForWaterFeatures;
  grassSystemEnabled: boolean;
}) {
  const pondShoreRef = useRef<THREE.InstancedMesh>(null);
  const pondWaterRef = useRef<THREE.InstancedMesh>(null);
  const lilyPadRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const style = survivalBiomeStyle[chunk.biome];
  const waterOpacity = getSurvivalWaterOpacityForBiome(chunk.biome);
  const shoreOpacity = getSurvivalShoreOpacityForBiome(chunk.biome);
  const riverMaterial = getCachedWaterFeatureMaterial("river", style.water, waterOpacity, {
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const pondShoreMaterial = getCachedWaterFeatureMaterial(
    "pond-shore",
    chunk.biome === "desert" ? "#d5bb76" : "#4a6d3a",
    shoreOpacity,
  );
  const pondWaterMaterial = getCachedWaterFeatureMaterial(
    "pond-water",
    style.water,
    Math.min(0.7, waterOpacity + 0.08),
  );
  const suppressRestoredMeadowWater = grassSystemEnabled &&
    isSurvivalRestoredMeadowWaterSuppressed(chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 1.36);
  const waterfallResolvers = useMemo(() => ({
    getTerrainHeightForChunk: terrainHeightForChunk,
    getWaterLevelAtWorld: getSurvivalWaterLevelAtWorld,
    isRestoredMeadowWaterSuppressed: isSurvivalRestoredMeadowWaterSuppressed,
  }), [terrainHeightForChunk]);
  const riverGeometry = useMemo(
    () => chunk.hasRiver && !suppressRestoredMeadowWater
      ? makeSurvivalRiverSurfaceGeometry(chunk, terrainHeightForChunk)
      : null,
    [chunk, suppressRestoredMeadowWater, terrainHeightForChunk],
  );

  const ponds = useMemo(
    () => suppressRestoredMeadowWater ? [] : makeSurvivalPonds(chunk),
    [chunk, suppressRestoredMeadowWater],
  );

  const lilyPads = useMemo(
    () => makeSurvivalLilyPads(chunk),
    [chunk],
  );

  useSurvivalFeatureCount("waterPonds", chunk.key, ponds.length);
  useSurvivalFeatureCount("lilyPads", chunk.key, lilyPads.length);

  useEffect(() => {
    const shoreMesh = pondShoreRef.current;
    if (shoreMesh) {
      for (let index = 0; index < ponds.length; index += 1) {
        const pond = ponds[index];
        dummy.position.set(chunk.x + pond.localX, pond.y - 0.04, chunk.z + pond.localZ);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(pond.radiusX + 7, pond.radiusZ + 7, 1);
        dummy.updateMatrix();
        shoreMesh.setMatrixAt(index, dummy.matrix);
      }
      shoreMesh.count = ponds.length;
      shoreMesh.instanceMatrix.needsUpdate = true;
      shoreMesh.frustumCulled = false;
    }

    const waterMesh = pondWaterRef.current;
    if (waterMesh) {
      for (let index = 0; index < ponds.length; index += 1) {
        const pond = ponds[index];
        dummy.position.set(chunk.x + pond.localX, pond.y, chunk.z + pond.localZ);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(pond.radiusX, pond.radiusZ, 1);
        dummy.updateMatrix();
        waterMesh.setMatrixAt(index, dummy.matrix);
      }
      waterMesh.count = ponds.length;
      waterMesh.instanceMatrix.needsUpdate = true;
      waterMesh.frustumCulled = false;
    }

    const lilyMesh = lilyPadRef.current;
    if (lilyMesh) {
      for (let index = 0; index < lilyPads.length; index += 1) {
        const pad = lilyPads[index];
        dummy.position.set(
          chunk.x + pad.localX,
          getSurvivalWaterLevelAtWorld(chunk.x + pad.localX, chunk.z + pad.localZ) + 0.24,
          chunk.z + pad.localZ,
        );
        dummy.rotation.set(-Math.PI / 2, 0, survivalHash01(chunk.cx, chunk.cz, pad.scale) * Math.PI);
        dummy.scale.set(pad.scale * 1.35, pad.scale, 1);
        dummy.updateMatrix();
        lilyMesh.setMatrixAt(index, dummy.matrix);
      }
      lilyMesh.count = lilyPads.length;
      lilyMesh.instanceMatrix.needsUpdate = true;
      lilyMesh.frustumCulled = false;
    }
  }, [chunk, dummy, lilyPads, ponds]);

  return (
    <group name={`survival-water-${chunk.key}`}>
      {riverGeometry && (
        <mesh geometry={riverGeometry} renderOrder={-1} dispose={null}>
          <primitive attach="material" object={riverMaterial} />
        </mesh>
      )}

      {ponds.length > 0 && (
        <>
          <instancedMesh ref={pondShoreRef} args={[undefined, undefined, Math.max(1, ponds.length)]} renderOrder={-2} frustumCulled={false}>
            <primitive attach="geometry" object={SURVIVAL_POND_CIRCLE_GEOMETRY} />
            <primitive attach="material" object={pondShoreMaterial} />
          </instancedMesh>
          <instancedMesh ref={pondWaterRef} args={[undefined, undefined, Math.max(1, ponds.length)]} renderOrder={-1} frustumCulled={false}>
            <primitive attach="geometry" object={SURVIVAL_POND_CIRCLE_GEOMETRY} />
            <primitive attach="material" object={pondWaterMaterial} />
          </instancedMesh>
        </>
      )}

      {lilyPads.length > 0 && (
        <instancedMesh ref={lilyPadRef} args={[undefined, undefined, Math.max(1, lilyPads.length)]} renderOrder={1} frustumCulled={false}>
          <primitive attach="geometry" object={SURVIVAL_LILY_PAD_GEOMETRY} />
          <primitive attach="material" object={SURVIVAL_LILY_PAD_MATERIAL} />
        </instancedMesh>
      )}
      <SurvivalWaterfalls chunk={chunk} resolvers={waterfallResolvers} />
    </group>
  );
}
