import { useFrame } from "@react-three/fiber";
import { RigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGameStore } from "../../../../store/gameStore";
import { getQaSurvivalTimeOverrideSeconds } from "../../rendering/sky/survivalSkyCycleMath";
import {
  shouldBuildSurvivalChunkColliders,
  shouldRenderSurvivalTerrainSkirt,
} from "../survival/survivalChunks";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import {
  getSurvivalTerrainCollisionSegments,
  getSurvivalVisibleTerrainSkirtEdges,
  hasAnySurvivalTerrainSkirtEdge,
  makeSurvivalTerrainCollisionGeometry,
  makeSurvivalTerrainGeometry,
  makeSurvivalTerrainSkirtGeometry,
} from "./survivalTerrainGeometry";
import {
  applySurvivalTerrainTintToRegisteredMaterials,
  registerSurvivalTerrainTintMaterial,
} from "./survivalTerrainTint";
import { getSurvivalTerrainDetailTextureForChunk } from "./survivalTerrainTextures";

export function SurvivalTerrainTintRuntime({
  mobilePerformanceMode,
}: {
  mobilePerformanceMode: boolean;
}) {
  const lastTerrainTintUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);
  const survivalTimeOverrideSeconds = useGameStore(s => s.survivalTimeOverrideSeconds);
  const qaSurvivalTimeOverrideSeconds = useMemo(() => getQaSurvivalTimeOverrideSeconds(), []);

  useFrame(({ clock }) => {
    if (mobilePerformanceMode && clock.elapsedTime - lastTerrainTintUpdateAtRef.current < 1 / 30) return;
    lastTerrainTintUpdateAtRef.current = clock.elapsedTime;
    applySurvivalTerrainTintToRegisteredMaterials(
      clock.elapsedTime,
      survivalTimeOverrideSeconds,
      qaSurvivalTimeOverrideSeconds,
    );
  });

  return null;
}

export function SurvivalTerrain({
  chunk,
  visibleChunkKeys,
}: {
  chunk: SurvivalChunkInfo;
  visibleChunkKeys?: ReadonlySet<string>;
}) {
  const terrainMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const terrainSkirtMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const terrainGeometry = useMemo(
    () => makeSurvivalTerrainGeometry(chunk),
    [chunk.key, chunk.lod],
  );
  const skirtEdges = useMemo(
    () => getSurvivalVisibleTerrainSkirtEdges(chunk, visibleChunkKeys),
    [chunk.cx, chunk.cz, visibleChunkKeys],
  );
  const hasSkirt = shouldRenderSurvivalTerrainSkirt(chunk) && hasAnySurvivalTerrainSkirtEdge(skirtEdges);
  const terrainSkirtGeometry = useMemo(
    () => hasSkirt ? makeSurvivalTerrainSkirtGeometry(chunk, skirtEdges) : null,
    [chunk.key, chunk.lod, hasSkirt, skirtEdges],
  );
  const hasCollision = shouldBuildSurvivalChunkColliders(chunk);
  const terrainCollisionSegments = hasCollision ? getSurvivalTerrainCollisionSegments(chunk) : 0;
  const terrainCollisionGeometry = useMemo(
    () => hasCollision ? makeSurvivalTerrainCollisionGeometry(chunk) : null,
    [chunk.key, chunk.lod, hasCollision, terrainCollisionSegments],
  );
  const terrainTexture = useMemo(() => getSurvivalTerrainDetailTextureForChunk(chunk), [chunk.biome]);

  useEffect(() => {
    const cleanups: Array<() => void> = [];
    if (terrainMaterialRef.current) {
      cleanups.push(registerSurvivalTerrainTintMaterial(terrainMaterialRef.current));
    }
    if (terrainSkirtMaterialRef.current) {
      cleanups.push(registerSurvivalTerrainTintMaterial(terrainSkirtMaterialRef.current));
    }
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [terrainGeometry, terrainSkirtGeometry]);

  const terrainMesh = (
    <>
      <mesh geometry={terrainGeometry} receiveShadow={hasCollision} dispose={null}>
        <meshBasicMaterial
          ref={terrainMaterialRef}
          map={terrainTexture}
          vertexColors
          side={THREE.DoubleSide}
          color="#ffffff"
          depthWrite
        />
      </mesh>
      {terrainSkirtGeometry && (
        <mesh geometry={terrainSkirtGeometry} dispose={null}>
          <meshBasicMaterial ref={terrainSkirtMaterialRef} vertexColors side={THREE.DoubleSide} color="#ffffff" />
        </mesh>
      )}
    </>
  );

  if (!hasCollision) {
    return <group position={[chunk.x, 0, chunk.z]}>{terrainMesh}</group>;
  }

  return (
    <group>
      <group position={[chunk.x, 0, chunk.z]}>{terrainMesh}</group>
      {terrainCollisionGeometry && <RigidBody type="fixed" colliders="trimesh" friction={0.2} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <mesh geometry={terrainCollisionGeometry} dispose={null}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </RigidBody>}
    </group>
  );
}
