import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo } from "react";
import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import { useSurvivalFeatureCount } from "../../../tools/qa/survivalFeatureCounters";
import { shouldBuildSurvivalChunkColliders } from "../survival/survivalChunks";
import { survivalHash01 } from "../survival/survivalMath";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { supportsRoofForest } from "../vegetation/survivalTreeVisuals";

export type SurvivalHobbitHutSurfaceQuality = {
  y: number;
  heightRange: number;
  normal: THREE.Vector3;
};

export type SurvivalHobbitHutSurfaceResolver = (
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  footprintRadius: number,
  sampleDistance: number,
  target?: SurvivalHobbitHutSurfaceQuality,
) => SurvivalHobbitHutSurfaceQuality;

export type SurvivalHobbitHutTerrainHeightResolver = (
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
) => number;

export type SurvivalHobbitHutWaterLevelResolver = (worldX: number, worldZ: number) => number;

type SurvivalHobbitHut = {
  key: string;
  localX: number;
  localZ: number;
  y: number;
  yaw: number;
  scale: number;
  variant: number;
};

const HOBBIT_HUT_BACK_PLANK_XS = [-4.25, -2.55, -0.85, 0.85, 2.55, 4.25] as const;
const HOBBIT_HUT_FRONT_POST_XS = [-4.76, 4.76] as const;
const HOBBIT_HUT_SMOKE_INDICES = [0, 1, 2] as const;
const HOBBIT_HUT_ROOF_LEAF_XS = [-4.9, -2.9, 3.0, 5.2] as const;

function HobbitHutColliders({ hut, chunk }: { hut: SurvivalHobbitHut; chunk: SurvivalChunkInfo }) {
  if (!shouldBuildSurvivalChunkColliders(chunk)) return null;

  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={[chunk.x + hut.localX, hut.y, chunk.z + hut.localZ]}
      rotation={[0, hut.yaw, 0]}
      name={`survival-hobbit-hut-collider-${hut.key}`}
    >
      <CuboidCollider args={[6.8 * hut.scale, 3.2 * hut.scale, 4.6 * hut.scale]} position={[0, 2.9 * hut.scale, 0.8 * hut.scale]} />
    </RigidBody>
  );
}

function SurvivalHobbitHutModel({ hut, chunk }: { hut: SurvivalHobbitHut; chunk: SurvivalChunkInfo }) {
  const scale = hut.scale;
  const roofGreen = chunk.biome === "jungle"
    ? "#1d5a2c"
    : chunk.biome === "mushroom"
      ? "#8e4aa2"
      : "#3f7734";
  const roofDark = chunk.biome === "jungle"
    ? "#123d20"
    : chunk.biome === "mushroom"
      ? "#5d336f"
      : "#2d5d29";
  const earthColor = chunk.biome === "jungle"
    ? "#3a2416"
    : chunk.biome === "mushroom"
      ? "#4a3158"
      : "#4d311f";
  const plankColor = chunk.biome === "jungle"
    ? "#5a341e"
    : chunk.biome === "mushroom"
      ? "#70446f"
      : "#6a4125";

  return (
    <group
      name={hut.key}
      position={[chunk.x + hut.localX, hut.y, chunk.z + hut.localZ]}
      rotation={[0, hut.yaw, 0]}
      scale={[scale, scale, scale]}
    >
      <mesh position={[0, 2.7, 0.7]} scale={[10.8, 4.6, 8.2]} castShadow={false}>
        <dodecahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={earthColor} />
      </mesh>
      <mesh position={[0, 4.35, 0.1]} scale={[10.4, 2.25, 7.8]} castShadow={false}>
        <dodecahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={roofGreen} />
      </mesh>
      <mesh position={[0, 5.25, -0.2]} scale={[7.4, 0.72, 5.8]} castShadow={false}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={roofDark} />
      </mesh>
      <mesh position={[0, 2.95, -7.48]} castShadow={false}>
        <boxGeometry args={[10.2, 5.9, 0.52]} />
        <meshBasicMaterial color="#2c1b13" />
      </mesh>
      {HOBBIT_HUT_BACK_PLANK_XS.map((x) => (
        <mesh key={x} position={[x, 3.0, -7.82]} castShadow={false}>
          <boxGeometry args={[1.06, 5.25, 0.42]} />
          <meshBasicMaterial color={plankColor} />
        </mesh>
      ))}
      <mesh position={[0, 2.54, -8.08]} castShadow={false}>
        <boxGeometry args={[3.32, 4.42, 0.54]} />
        <meshBasicMaterial color="#1c120d" />
      </mesh>
      <mesh position={[0, 2.58, -8.12]} castShadow={false}>
        <boxGeometry args={[2.35, 3.22, 0.58]} />
        <meshBasicMaterial color="#ef6d1b" transparent opacity={0.68} />
      </mesh>
      <mesh position={[0, 4.96, -8.18]} rotation={[0, 0, Math.PI / 2]} castShadow={false}>
        <cylinderGeometry args={[0.34, 0.34, 8.6, 6]} />
        <meshBasicMaterial color="#5a321c" />
      </mesh>
      {HOBBIT_HUT_FRONT_POST_XS.map((x) => (
        <mesh key={x} position={[x, 2.98, -8.16]} castShadow={false}>
          <cylinderGeometry args={[0.34, 0.34, 5.28, 6]} />
          <meshBasicMaterial color="#5a321c" />
        </mesh>
      ))}
      <mesh position={[-5.9, 0.13, -10.2]} rotation={[-Math.PI / 2, 0, hut.variant * Math.PI]} castShadow={false}>
        <planeGeometry args={[7.8, 9.5]} />
        <meshBasicMaterial color="#5b3b22" transparent opacity={0.78} />
      </mesh>
      <mesh position={[3.95, 7.05, -1.55]} castShadow={false}>
        <boxGeometry args={[1.45, 4.2, 1.45]} />
        <meshBasicMaterial color="#47301f" />
      </mesh>
      {HOBBIT_HUT_SMOKE_INDICES.map((smoke) => (
        <mesh key={smoke} position={[4.12 + smoke * 0.62, 10.0 + smoke * 1.35, -1.55 - smoke * 0.34]} scale={[1 + smoke * 0.38, 0.72 + smoke * 0.18, 1 + smoke * 0.32]} castShadow={false}>
          <dodecahedronGeometry args={[0.7, 0]} />
          <meshBasicMaterial color="#d5d0c2" transparent opacity={0.28 - smoke * 0.06} />
        </mesh>
      ))}
      {HOBBIT_HUT_ROOF_LEAF_XS.map((x, index) => (
        <mesh key={x} position={[x, 5.45 + index * 0.18, -6.25 + (index % 2) * 0.7]} rotation={[0.18, index * 0.7, -0.12]} castShadow={false}>
          <planeGeometry args={[1.1, 2.8]} />
          <meshBasicMaterial color={index % 2 === 0 ? "#4d9a3e" : "#6fb64a"} side={THREE.DoubleSide} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export function SurvivalHobbitHuts({
  chunk,
  getSurfaceQuality,
  terrainHeightForChunk,
  getWaterLevelAtWorld,
}: {
  chunk: SurvivalChunkInfo;
  getSurfaceQuality: SurvivalHobbitHutSurfaceResolver;
  terrainHeightForChunk: SurvivalHobbitHutTerrainHeightResolver;
  getWaterLevelAtWorld: SurvivalHobbitHutWaterLevelResolver;
}) {
  const surfaceQualityScratch = useMemo<SurvivalHobbitHutSurfaceQuality>(() => ({
    y: 0,
    heightRange: 0,
    normal: new THREE.Vector3(),
  }), []);
  const huts = useMemo<SurvivalHobbitHut[]>(() => {
    if (chunk.lod !== "near" || !supportsRoofForest(chunk.biome) || chunk.hasVillage) return [];
    const spawnRoll = survivalHash01(chunk.cx, chunk.cz, 7310);
    const shouldSpawn = chunk.biome === "jungle"
      ? spawnRoll > 0.68
      : chunk.biome === "mushroom"
        ? spawnRoll > 0.72
        : spawnRoll > 0.74;
    if (!shouldSpawn) return [];

    const generated: SurvivalHobbitHut[] = [];
    for (let index = 0; index < 10 && generated.length < 1; index += 1) {
      const localX = (survivalHash01(chunk.cx, chunk.cz, 7360 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.72;
      const localZ = (survivalHash01(chunk.cx, chunk.cz, 7410 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.72;
      if (Math.min(Math.abs(localX), Math.abs(localZ)) < 54) continue;

      const worldX = chunk.x + localX;
      const worldZ = chunk.z + localZ;
      const surfaceQuality = getSurfaceQuality(chunk, localX, localZ, 13.5, 7.2, surfaceQualityScratch);
      if (surfaceQuality.normal.y < 0.82 || surfaceQuality.heightRange > 5.8) continue;
      const y = surfaceQuality.y;
      const waterY = getWaterLevelAtWorld(worldX, worldZ);
      if (y < waterY + 0.42) continue;

      const yNorth = terrainHeightForChunk(chunk, localX, localZ - 7);
      const ySouth = terrainHeightForChunk(chunk, localX, localZ + 7);
      const yEast = terrainHeightForChunk(chunk, localX + 7, localZ);
      const yWest = terrainHeightForChunk(chunk, localX - 7, localZ);
      if (Math.max(yNorth, ySouth, yEast, yWest) - Math.min(yNorth, ySouth, yEast, yWest) > 7.5) continue;

      generated.push({
        key: `${chunk.key}-hobbit-hut-${index}`,
        localX,
        localZ,
        y,
        yaw: survivalHash01(chunk.cx, chunk.cz, 7460 + index) * Math.PI * 2,
        scale: 1.12 + survivalHash01(chunk.cx, chunk.cz, 7510 + index) * 0.38,
        variant: survivalHash01(chunk.cx, chunk.cz, 7560 + index),
      });
    }

    return generated;
  }, [chunk, getSurfaceQuality, terrainHeightForChunk, getWaterLevelAtWorld, surfaceQualityScratch]);

  useSurvivalFeatureCount("hobbitHuts", `survival-hobbit-huts-${chunk.key}`, huts.length);

  if (huts.length === 0) return null;

  return (
    <>
      {huts.map((hut) => (
        <group key={hut.key}>
          <SurvivalHobbitHutModel hut={hut} chunk={chunk} />
          <HobbitHutColliders hut={hut} chunk={chunk} />
        </group>
      ))}
    </>
  );
}
