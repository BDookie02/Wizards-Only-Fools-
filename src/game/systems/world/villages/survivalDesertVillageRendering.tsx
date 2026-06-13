import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import { getCachedIndexRange } from "../../rendering/indexRange";
import { Villagers } from "../../../Villagers";
import { getDesertAdobeWallTexture, getDesertSandTexture } from "../terrain/survivalTerrainTextures";
import { isStrictSurvivalDesertTerrainAtWorld, isSurvivalRestoredMeadowWaterSuppressed } from "../survival/survivalBiome";
import { shouldBuildSurvivalChunkColliders, shouldRenderSurvivalChunkSkirt } from "../survival/survivalChunks";
import { SURVIVAL_VILLAGE_PAD_SEGMENTS, type SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { PLANT_EDGE_COLOR } from "../vegetation/SurvivalFoliagePrimitives";
import { useSurvivalFeatureCount } from "../../../tools/qa/survivalFeatureCounters";
import { DESERT_VILLAGE_RADIUS } from "./survivalDesertVillageTerrain";
import {
  getDesertClothesLineRenderDescriptor,
  makeDesertVillageLayout,
  type DesertVillageBuilding,
  type DesertVillageClothesLine,
  type DesertVillageFence,
  type DesertVillageLadder,
  type DesertVillageLayout,
  type DesertVillageMarketStall,
  type DesertVillagePalm,
  type DesertVillageStreetProp,
  type DesertVillageWallSegment,
} from "./survivalDesertVillageRuntime";

type GateSide = "north" | "south" | "east" | "west";

type SurvivalTerrainHeightForChunk = (chunk: SurvivalChunkInfo, localX: number, localZ: number) => number;
type SurvivalVillageBaseHeightForChunk = (chunk: SurvivalChunkInfo) => number;
type SurvivalVillagePadHeightForChunk = (chunk: SurvivalChunkInfo, localX: number, localZ: number, baseHeight?: number) => number;
type SurvivalVillageGeometryFactory = (chunk: SurvivalChunkInfo) => THREE.BufferGeometry;
function makeDesertVillageSurfaceStripGeometry(
  chunk: SurvivalChunkInfo,
  width: number,
  length: number,
  rotation: number,
  yOffset: number,
  villageBaseHeightForChunk: SurvivalVillageBaseHeightForChunk,
  villagePadHeightForChunk: SurvivalVillagePadHeightForChunk,
  lateralOffset = 0,
  lengthOffset = 0,
  lateralSegments = 2,
  lengthSegments = SURVIVAL_VILLAGE_PAD_SEGMENTS,
) {
  const baseHeight = villageBaseHeightForChunk(chunk);
  const geo = new THREE.PlaneGeometry(width, length, Math.max(1, lateralSegments), Math.max(1, lengthSegments));
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  for (let i = 0; i < pos.count; i += 1) {
    const stripX = pos.getX(i) + lateralOffset;
    const stripZ = pos.getZ(i) + lengthOffset;
    const localX = stripX * cos + stripZ * sin;
    const localZ = -stripX * sin + stripZ * cos;
    const height = villagePadHeightForChunk(chunk, localX, localZ, baseHeight);
    pos.setX(i, localX);
    pos.setY(i, height + yOffset);
    pos.setZ(i, localZ);
  }

  geo.computeVertexNormals();
  return geo;
}

const DESERT_FENCE_POST_OFFSETS = [-0.5, 0, 0.5] as const;
const DESERT_BUILDING_WALL_THICKNESS = 1.05;
const DESERT_BUILDING_DOOR_WIDTH = 5.4;
const DESERT_BUILDING_DOOR_HEIGHT = 7.25;
const DESERT_UNIT_BOX_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const DESERT_BUILDING_ROOF_MATERIAL = new THREE.MeshBasicMaterial({ color: "#6f3e22" });
const DESERT_BUILDING_OUTLINE_MATERIAL = new THREE.MeshBasicMaterial({ color: "#160d08", side: THREE.BackSide });
const DESERT_BUILDING_TRIM_MATERIAL = new THREE.MeshBasicMaterial({ color: "#1c1009" });
const DESERT_BUILDING_DOOR_MATERIAL = new THREE.MeshBasicMaterial({ color: "#3b2414" });
const DESERT_BUILDING_WINDOW_MATERIAL = new THREE.MeshBasicMaterial({ color: "#6ac7d6" });
const DESERT_BUILDING_FLOOR_MATERIAL = new THREE.MeshBasicMaterial({ color: "#70401f" });

function DesertVillageSurface({
  geometry,
  baseHeight,
  chunk,
  villageBaseHeightForChunk,
  villagePadHeightForChunk,
}: {
  geometry: THREE.BufferGeometry;
  baseHeight: number;
  chunk: SurvivalChunkInfo;
  villageBaseHeightForChunk: SurvivalVillageBaseHeightForChunk;
  villagePadHeightForChunk: SurvivalVillagePadHeightForChunk;
}) {
  const sandTexture = useMemo(() => getDesertSandTexture(), []);
  const hasMeadowOverlap = isSurvivalRestoredMeadowWaterSuppressed(chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.58);
  const isStrictDesertSurface = chunk.biome === "desert" &&
    isStrictSurvivalDesertTerrainAtWorld(chunk.x, chunk.z) &&
    !hasMeadowOverlap;
  const northSouthRoadGeometry = useMemo(
    () => makeDesertVillageSurfaceStripGeometry(chunk, 48, SURVIVAL_BLOCK_SIZE - 4, 0, 0.18, villageBaseHeightForChunk, villagePadHeightForChunk),
    [chunk, villageBaseHeightForChunk, villagePadHeightForChunk],
  );
  const eastWestRoadGeometry = useMemo(
    () => makeDesertVillageSurfaceStripGeometry(chunk, 48, SURVIVAL_BLOCK_SIZE - 4, Math.PI / 2, 0.18, villageBaseHeightForChunk, villagePadHeightForChunk),
    [chunk, villageBaseHeightForChunk, villagePadHeightForChunk],
  );
  const diagonalRoadAGeometry = useMemo(
    () => makeDesertVillageSurfaceStripGeometry(chunk, 26, 360, Math.PI / 4, 0.17, villageBaseHeightForChunk, villagePadHeightForChunk),
    [chunk, villageBaseHeightForChunk, villagePadHeightForChunk],
  );
  const diagonalRoadBGeometry = useMemo(
    () => makeDesertVillageSurfaceStripGeometry(chunk, 26, 360, -Math.PI / 4, 0.17, villageBaseHeightForChunk, villagePadHeightForChunk),
    [chunk, villageBaseHeightForChunk, villagePadHeightForChunk],
  );
  const sidewalkGeometries = useMemo(() => [
    { key: "north-south-left", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 7, SURVIVAL_BLOCK_SIZE - 4, 0, 0.22, villageBaseHeightForChunk, villagePadHeightForChunk, -30), opacity: 0.76 },
    { key: "north-south-right", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 7, SURVIVAL_BLOCK_SIZE - 4, 0, 0.22, villageBaseHeightForChunk, villagePadHeightForChunk, 30), opacity: 0.76 },
    { key: "east-west-left", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 7, SURVIVAL_BLOCK_SIZE - 4, Math.PI / 2, 0.22, villageBaseHeightForChunk, villagePadHeightForChunk, -30), opacity: 0.76 },
    { key: "east-west-right", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 7, SURVIVAL_BLOCK_SIZE - 4, Math.PI / 2, 0.22, villageBaseHeightForChunk, villagePadHeightForChunk, 30), opacity: 0.76 },
    { key: "diagonal-a-left", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 5, 360, Math.PI / 4, 0.2, villageBaseHeightForChunk, villagePadHeightForChunk, -18), opacity: 0.62 },
    { key: "diagonal-a-right", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 5, 360, Math.PI / 4, 0.2, villageBaseHeightForChunk, villagePadHeightForChunk, 18), opacity: 0.62 },
    { key: "diagonal-b-left", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 5, 360, -Math.PI / 4, 0.2, villageBaseHeightForChunk, villagePadHeightForChunk, -18), opacity: 0.62 },
    { key: "diagonal-b-right", geometry: makeDesertVillageSurfaceStripGeometry(chunk, 5, 360, -Math.PI / 4, 0.2, villageBaseHeightForChunk, villagePadHeightForChunk, 18), opacity: 0.62 },
  ], [chunk, villageBaseHeightForChunk, villagePadHeightForChunk]);

  if (!isStrictDesertSurface) {
    return null;
  }

  return (
    <group>
      <mesh geometry={geometry} receiveShadow dispose={null}>
        <meshBasicMaterial map={sandTexture} vertexColors />
      </mesh>
      <mesh geometry={geometry} receiveShadow dispose={null} renderOrder={1}>
        <meshBasicMaterial
          color="#d0a15c"
          transparent
          opacity={0.58}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.08, 0]}>
            <circleGeometry args={[66, 36]} />
            <meshBasicMaterial map={sandTexture} color="#d7a15c" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.16, 0]}>
            <ringGeometry args={[67, 74, 36]} />
            <meshBasicMaterial color="#4b3020" transparent opacity={0.66} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.1, 0]}>
            <ringGeometry args={[118, 128, 56]} />
            <meshBasicMaterial map={sandTexture} color="#cb8f4c" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.17, 0]}>
            <ringGeometry args={[110, 115, 56]} />
            <meshBasicMaterial color="#4b3020" transparent opacity={0.68} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.18, 0]}>
            <ringGeometry args={[131, 137, 56]} />
            <meshBasicMaterial color="#4b3020" transparent opacity={0.64} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.11, 0]}>
            <ringGeometry args={[188, 198, 72]} />
            <meshBasicMaterial map={sandTexture} color="#c28749" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.19, 0]}>
            <ringGeometry args={[180, 184, 72]} />
            <meshBasicMaterial color="#4b3020" transparent opacity={0.64} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.2, 0]}>
            <ringGeometry args={[202, 207, 72]} />
            <meshBasicMaterial color="#4b3020" transparent opacity={0.6} depthWrite={false} />
          </mesh>
          <mesh geometry={northSouthRoadGeometry}>
            <meshBasicMaterial map={sandTexture} color="#d49f5d" />
          </mesh>
          <mesh geometry={eastWestRoadGeometry}>
            <meshBasicMaterial map={sandTexture} color="#d49f5d" />
          </mesh>
          <mesh geometry={diagonalRoadAGeometry}>
            <meshBasicMaterial map={sandTexture} color="#c9884b" transparent opacity={0.78} />
          </mesh>
          <mesh geometry={diagonalRoadBGeometry}>
            <meshBasicMaterial map={sandTexture} color="#c9884b" transparent opacity={0.78} />
          </mesh>
          {sidewalkGeometries.map((sidewalk) => (
            <mesh key={sidewalk.key} geometry={sidewalk.geometry}>
              <meshBasicMaterial color="#3f281a" transparent opacity={sidewalk.opacity} depthWrite={false} />
            </mesh>
          ))}
    </group>
  );
}

function DesertVillageBuildings({
  buildings,
  baseHeight,
  showDetails,
}: {
  buildings: DesertVillageBuilding[];
  baseHeight: number;
  showDetails: boolean;
}) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const roofRef = useRef<THREE.InstancedMesh>(null);
  const outlineBodyRef = useRef<THREE.InstancedMesh>(null);
  const outlineRoofRef = useRef<THREE.InstancedMesh>(null);
  const adobeTexture = useMemo(() => getDesertAdobeWallTexture(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const adobeMaterial = useMemo(() => new THREE.MeshBasicMaterial({ map: adobeTexture, color: "#b68145" }), [adobeTexture]);

  useEffect(() => {
    const bodyMesh = bodyRef.current;
    const roofMesh = roofRef.current;
    const outlineBodyMesh = outlineBodyRef.current;
    const outlineRoofMesh = outlineRoofRef.current;
    if (!bodyMesh || !roofMesh) return;

    for (let index = 0; index < buildings.length; index += 1) {
      const building = buildings[index];
      if (outlineBodyMesh) {
        dummy.position.set(building.localX, baseHeight + building.height / 2, building.localZ);
        dummy.rotation.set(0, building.rotation, 0);
        dummy.scale.set(building.width + 1.1, building.height + 0.75, building.depth + 1.1);
        dummy.updateMatrix();
        outlineBodyMesh.setMatrixAt(index, dummy.matrix);
      }

      dummy.position.set(building.localX, baseHeight + building.height / 2, building.localZ);
      dummy.rotation.set(0, building.rotation, 0);
      dummy.scale.set(building.width, building.height, building.depth);
      dummy.updateMatrix();
      bodyMesh.setMatrixAt(index, dummy.matrix);

      if (outlineRoofMesh) {
        dummy.position.set(building.localX, baseHeight + building.height + 0.75, building.localZ);
        dummy.rotation.set(0, building.rotation, 0);
        dummy.scale.set(building.width + 4.2, 2.05, building.depth + 4.2);
        dummy.updateMatrix();
        outlineRoofMesh.setMatrixAt(index, dummy.matrix);
      }

      dummy.position.set(building.localX, baseHeight + building.height + 0.75, building.localZ);
      dummy.rotation.set(0, building.rotation, 0);
      dummy.scale.set(building.width + 2.8, 1.5, building.depth + 2.8);
      dummy.updateMatrix();
      roofMesh.setMatrixAt(index, dummy.matrix);
    }

    bodyMesh.instanceMatrix.needsUpdate = true;
    roofMesh.instanceMatrix.needsUpdate = true;
    if (outlineBodyMesh) outlineBodyMesh.instanceMatrix.needsUpdate = true;
    if (outlineRoofMesh) outlineRoofMesh.instanceMatrix.needsUpdate = true;
  }, [baseHeight, buildings, dummy]);

  return (
    <>
      {!showDetails && (
        <>
          <instancedMesh ref={outlineBodyRef} args={[DESERT_UNIT_BOX_GEOMETRY, DESERT_BUILDING_OUTLINE_MATERIAL, buildings.length]} castShadow={false} receiveShadow={false} frustumCulled={false} />
          <instancedMesh ref={bodyRef} args={[DESERT_UNIT_BOX_GEOMETRY, adobeMaterial, buildings.length]} castShadow={false} receiveShadow frustumCulled={false} />
          <instancedMesh ref={outlineRoofRef} args={[DESERT_UNIT_BOX_GEOMETRY, DESERT_BUILDING_OUTLINE_MATERIAL, buildings.length]} castShadow={false} receiveShadow={false} frustumCulled={false} />
          <instancedMesh ref={roofRef} args={[DESERT_UNIT_BOX_GEOMETRY, DESERT_BUILDING_ROOF_MATERIAL, buildings.length]} castShadow={false} receiveShadow frustumCulled={false} />
        </>
      )}
      {showDetails && buildings.map((building) => {
        const wallThickness = Math.min(DESERT_BUILDING_WALL_THICKNESS, building.width * 0.16, building.depth * 0.16);
        const doorWidth = Math.min(DESERT_BUILDING_DOOR_WIDTH, building.width - wallThickness * 4);
        const doorHeight = Math.min(DESERT_BUILDING_DOOR_HEIGHT, building.height - 1.2);
        const frontWallWidth = Math.max(1.2, (building.width - doorWidth) / 2);
        const lintelHeight = Math.max(0.8, building.height - doorHeight);
        const windowY = Math.min(building.height - 2.3, 6.2);
        const sideWindowZ = building.depth * 0.22;
        const sideWindowWidth = Math.min(3.1, building.depth * 0.24);

        return (
        <group
          key={`${building.key}-details`}
          position={[building.localX, baseHeight, building.localZ]}
          rotation={[0, building.rotation, 0]}
        >
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_OUTLINE_MATERIAL} position={[0, building.height / 2, 0]} scale={[building.width + 1.1, building.height + 0.75, building.depth + 1.1]} castShadow={false} />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_OUTLINE_MATERIAL} position={[0, building.height + 0.75, 0]} scale={[building.width + 4.2, 2.05, building.depth + 4.2]} castShadow={false} />
          {[
            [-building.width / 2 - 0.08, building.depth / 2 + 0.08],
            [building.width / 2 + 0.08, building.depth / 2 + 0.08],
            [-building.width / 2 - 0.08, -building.depth / 2 - 0.08],
            [building.width / 2 + 0.08, -building.depth / 2 - 0.08],
          ].map(([x, z], index) => (
            <mesh key={`${building.key}-corner-outline-${index}`} geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_TRIM_MATERIAL} position={[x, building.height / 2, z]} scale={[0.62, building.height + 0.38, 0.62]} castShadow={false} />
          ))}
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_TRIM_MATERIAL} position={[0, building.height + 0.14, building.depth / 2 + 0.08]} scale={[building.width + 0.65, 0.36, 0.5]} castShadow={false} />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_TRIM_MATERIAL} position={[0, building.height + 0.14, -building.depth / 2 - 0.08]} scale={[building.width + 0.65, 0.36, 0.5]} castShadow={false} />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_TRIM_MATERIAL} position={[-building.width / 2 - 0.08, building.height + 0.14, 0]} scale={[0.5, 0.36, building.depth + 0.65]} castShadow={false} />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_TRIM_MATERIAL} position={[building.width / 2 + 0.08, building.height + 0.14, 0]} scale={[0.5, 0.36, building.depth + 0.65]} castShadow={false} />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_FLOOR_MATERIAL} position={[0, 0.08, 0]} scale={[building.width - wallThickness * 1.4, 0.16, building.depth - wallThickness * 1.4]} castShadow={false} receiveShadow />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={adobeMaterial} position={[-building.width / 2 + wallThickness / 2, building.height / 2, 0]} scale={[wallThickness, building.height, building.depth]} castShadow={false} receiveShadow />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={adobeMaterial} position={[building.width / 2 - wallThickness / 2, building.height / 2, 0]} scale={[wallThickness, building.height, building.depth]} castShadow={false} receiveShadow />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={adobeMaterial} position={[0, building.height / 2, -building.depth / 2 + wallThickness / 2]} scale={[building.width, building.height, wallThickness]} castShadow={false} receiveShadow />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={adobeMaterial} position={[-doorWidth / 2 - frontWallWidth / 2, building.height / 2, building.depth / 2 - wallThickness / 2]} scale={[frontWallWidth, building.height, wallThickness]} castShadow={false} receiveShadow />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={adobeMaterial} position={[doorWidth / 2 + frontWallWidth / 2, building.height / 2, building.depth / 2 - wallThickness / 2]} scale={[frontWallWidth, building.height, wallThickness]} castShadow={false} receiveShadow />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={adobeMaterial} position={[0, doorHeight + lintelHeight / 2, building.depth / 2 - wallThickness / 2]} scale={[doorWidth, lintelHeight, wallThickness]} castShadow={false} receiveShadow />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_ROOF_MATERIAL} position={[0, building.height + 0.75, 0]} scale={[building.width + 2.8, 1.5, building.depth + 2.8]} castShadow={false} receiveShadow />
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_DOOR_MATERIAL} position={[0, doorHeight / 2 - 0.25, building.depth / 2 + 0.16]} scale={[doorWidth * 0.82, doorHeight - 0.5, 0.34]} castShadow={false}>
          </mesh>
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_TRIM_MATERIAL} position={[-building.width * 0.28, windowY, building.depth / 2 + 0.14]} scale={[3.7, 3.0, 0.36]} castShadow={false}>
          </mesh>
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_WINDOW_MATERIAL} position={[-building.width * 0.28, windowY, building.depth / 2 + 0.2]} scale={[3.1, 2.4, 0.32]} castShadow={false}>
          </mesh>
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_TRIM_MATERIAL} position={[building.width * 0.28, windowY, building.depth / 2 + 0.14]} scale={[3.7, 3.0, 0.36]} castShadow={false}>
          </mesh>
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_WINDOW_MATERIAL} position={[building.width * 0.28, windowY, building.depth / 2 + 0.2]} scale={[3.1, 2.4, 0.32]} castShadow={false}>
          </mesh>
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_TRIM_MATERIAL} position={[-building.width / 2 - 0.16, windowY, sideWindowZ]} scale={[0.36, 2.9, sideWindowWidth + 0.62]} castShadow={false}>
          </mesh>
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_WINDOW_MATERIAL} position={[-building.width / 2 - 0.22, windowY, sideWindowZ]} scale={[0.32, 2.15, sideWindowWidth]} castShadow={false}>
          </mesh>
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_TRIM_MATERIAL} position={[building.width / 2 + 0.16, windowY, -sideWindowZ]} scale={[0.36, 2.9, sideWindowWidth + 0.62]} castShadow={false}>
          </mesh>
          <mesh geometry={DESERT_UNIT_BOX_GEOMETRY} material={DESERT_BUILDING_WINDOW_MATERIAL} position={[building.width / 2 + 0.22, windowY, -sideWindowZ]} scale={[0.32, 2.15, sideWindowWidth]} castShadow={false}>
          </mesh>
          {building.variant > 0.72 && (
            <mesh position={[0, building.height + 3.2, 0]} castShadow={false}>
              <sphereGeometry args={[Math.min(building.width, building.depth) * 0.32, 10, 6]} />
              <meshBasicMaterial color="#b88345" />
            </mesh>
          )}
        </group>
        );
      })}
    </>
  );
}

function DesertVillageLadder({ ladder, baseHeight }: { ladder: DesertVillageLadder; baseHeight: number }) {
  const rungCount = Math.max(4, Math.floor(ladder.height / 1.7));

  return (
    <group position={[ladder.localX, baseHeight, ladder.localZ]} rotation={[0, ladder.rotation, 0]}>
      <mesh position={[-ladder.width / 2, ladder.height / 2, 0]} castShadow={false}>
        <boxGeometry args={[0.26, ladder.height, 0.22]} />
        <meshBasicMaterial color="#2d1b10" />
      </mesh>
      <mesh position={[ladder.width / 2, ladder.height / 2, 0]} castShadow={false}>
        <boxGeometry args={[0.26, ladder.height, 0.22]} />
        <meshBasicMaterial color="#2d1b10" />
      </mesh>
      {getCachedIndexRange(rungCount).map((index) => (
        <mesh key={index} position={[0, 1.15 + index * ((ladder.height - 2.3) / Math.max(1, rungCount - 1)), 0.08]} castShadow={false}>
          <boxGeometry args={[ladder.width + 0.36, 0.22, 0.28]} />
          <meshBasicMaterial color="#442917" />
        </mesh>
      ))}
    </group>
  );
}

function DesertVillageFence({ fence, baseHeight }: { fence: DesertVillageFence; baseHeight: number }) {
  return (
    <group position={[fence.localX, baseHeight, fence.localZ]} rotation={[0, fence.rotation, 0]}>
      {DESERT_FENCE_POST_OFFSETS.map((offset) => (
        <mesh key={offset} position={[offset * fence.length, 1.7, 0]} castShadow={false}>
          <boxGeometry args={[0.66, 3.4, 0.58]} />
          <meshBasicMaterial color="#2f1d12" />
        </mesh>
      ))}
      <mesh position={[0, 1.55, 0]} castShadow={false}>
        <boxGeometry args={[fence.length, 0.38, 0.38]} />
        <meshBasicMaterial color="#442917" />
      </mesh>
      <mesh position={[0, 2.72, 0]} castShadow={false}>
        <boxGeometry args={[fence.length, 0.34, 0.34]} />
        <meshBasicMaterial color="#352014" />
      </mesh>
    </group>
  );
}

function DesertClothesLine({ line, baseHeight }: { line: DesertVillageClothesLine; baseHeight: number }) {
  const rope = useMemo(() => getDesertClothesLineRenderDescriptor(line, baseHeight), [baseHeight, line]);

  return (
    <group>
      <mesh position={rope.midpoint} quaternion={rope.quaternion} castShadow={false}>
        <cylinderGeometry args={[0.08, 0.08, rope.length, 5]} />
        <meshBasicMaterial color="#4a2d18" />
      </mesh>
      {rope.cloths.map((cloth) => (
        <mesh key={cloth.key} position={cloth.position} rotation={cloth.rotation} castShadow={false}>
          <boxGeometry args={[2.8, cloth.height, 0.12]} />
          <meshBasicMaterial color={cloth.color} />
        </mesh>
      ))}
    </group>
  );
}

function DesertStreetProp({ prop, baseHeight }: { prop: DesertVillageStreetProp; baseHeight: number }) {
  if (prop.kind === "barrel") {
    return (
      <group position={[prop.localX, baseHeight, prop.localZ]} rotation={[0, prop.rotation, 0]} scale={[prop.scale, prop.scale, prop.scale]}>
        <mesh position={[0, 1.55, 0]} castShadow={false}>
          <cylinderGeometry args={[1.25, 1.45, 3.1, 8]} />
          <meshBasicMaterial color="#4a2a17" />
        </mesh>
        <mesh position={[0, 2.55, 0]} castShadow={false}>
          <cylinderGeometry args={[1.48, 1.48, 0.22, 8]} />
          <meshBasicMaterial color="#1d120b" />
        </mesh>
        <mesh position={[0, 0.62, 0]} castShadow={false}>
          <cylinderGeometry args={[1.42, 1.42, 0.22, 8]} />
          <meshBasicMaterial color="#1d120b" />
        </mesh>
      </group>
    );
  }

  if (prop.kind === "crate") {
    return (
      <group position={[prop.localX, baseHeight, prop.localZ]} rotation={[0, prop.rotation, 0]} scale={[prop.scale, prop.scale, prop.scale]}>
        <mesh position={[0, 1.35, 0]} castShadow={false} receiveShadow>
          <boxGeometry args={[2.85, 2.7, 2.85]} />
          <meshBasicMaterial color="#3d2414" />
        </mesh>
        <mesh position={[0, 1.38, 1.48]} castShadow={false}>
          <boxGeometry args={[3.05, 0.28, 0.26]} />
          <meshBasicMaterial color="#21140b" />
        </mesh>
        <mesh position={[0, 1.38, -1.48]} castShadow={false}>
          <boxGeometry args={[3.05, 0.28, 0.26]} />
          <meshBasicMaterial color="#21140b" />
        </mesh>
        <mesh position={[1.48, 1.38, 0]} castShadow={false}>
          <boxGeometry args={[0.26, 0.28, 3.05]} />
          <meshBasicMaterial color="#21140b" />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[prop.localX, baseHeight + 0.58 * prop.scale, prop.localZ]} rotation={[0, prop.rotation, 0]} scale={[prop.scale * 1.35, prop.scale * 0.72, prop.scale]}>
      <mesh castShadow={false} receiveShadow>
        <sphereGeometry args={[1.55, 8, 5]} />
        <meshBasicMaterial color="#c7a46b" />
      </mesh>
      <mesh position={[0.2, 1.05, 0]} scale={[0.78, 0.22, 0.55]} castShadow={false}>
        <sphereGeometry args={[0.9, 7, 4]} />
        <meshBasicMaterial color="#dfc18a" />
      </mesh>
    </group>
  );
}

function DesertVillageDressing({
  layout,
  baseHeight,
  showDetails,
}: {
  layout: DesertVillageLayout;
  baseHeight: number;
  showDetails: boolean;
}) {
  if (!showDetails) return null;

  return (
    <>
      {layout.fences.map((fence) => (
        <DesertVillageFence key={fence.key} fence={fence} baseHeight={baseHeight} />
      ))}
      {layout.ladders.map((ladder) => (
        <DesertVillageLadder key={ladder.key} ladder={ladder} baseHeight={baseHeight} />
      ))}
      {layout.clothesLines.map((line) => (
        <DesertClothesLine key={line.key} line={line} baseHeight={baseHeight} />
      ))}
      {layout.streetProps.map((prop) => (
        <DesertStreetProp key={prop.key} prop={prop} baseHeight={baseHeight} />
      ))}
    </>
  );
}

function DesertMarketStall({ stall, baseHeight }: { stall: DesertVillageMarketStall; baseHeight: number }) {
  return (
    <group position={[stall.localX, baseHeight, stall.localZ]} rotation={[0, stall.rotation, 0]}>
      <mesh position={[0, 2.4, 0]} castShadow={false}>
        <boxGeometry args={[10, 4.8, 5.5]} />
        <meshBasicMaterial color="#80512a" />
      </mesh>
      <mesh position={[0, 5.4, 0]} castShadow={false}>
        <boxGeometry args={[12.5, 1.1, 7.2]} />
        <meshBasicMaterial color={stall.color} />
      </mesh>
      <mesh position={[0, 5.95, 0]} rotation={[0, 0, 0.16]} castShadow={false}>
        <boxGeometry args={[13.5, 0.7, 7.8]} />
        <meshBasicMaterial color={stall.color} />
      </mesh>
    </group>
  );
}

function DesertPalm({ palm }: { palm: DesertVillagePalm }) {
  return (
    <group position={[palm.localX, palm.localY, palm.localZ]} rotation={[0, palm.rotation, 0]} scale={[palm.scale, palm.scale, palm.scale]}>
      <mesh position={[0, 12.4, 0]} rotation={[0.12, 0, 0.08]} castShadow={false}>
        <cylinderGeometry args={[0.95, 1.42, 24.8, 6]} />
        <meshBasicMaterial color="#6b3f20" />
      </mesh>
      {getCachedIndexRange(9).map((index) => {
        const angle = (Math.PI * 2 * index) / 9;
        return (
          <group key={index} position={[Math.sin(angle) * 4.2, 25.2, Math.cos(angle) * 4.2]} rotation={[0.5, angle, 0.18]}>
            <mesh scale={[0.79, 0.23, 8.34]} castShadow={false} renderOrder={3}>
              <dodecahedronGeometry args={[1, 0]} />
              <meshBasicMaterial color={PLANT_EDGE_COLOR} wireframe transparent opacity={0.42} depthWrite={false} />
            </mesh>
            <mesh scale={[0.775, 0.22, 8.25]} castShadow={false}>
              <dodecahedronGeometry args={[1, 0]} />
              <meshBasicMaterial color={index % 2 === 0 ? "#2f7a3f" : "#3e8f48"} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[-1.15, 22.6, 0.95]} castShadow={false}>
        <sphereGeometry args={[0.72, 6, 4]} />
        <meshBasicMaterial color="#8b5c21" />
      </mesh>
      <mesh position={[0.25, 22.1, 1.15]} castShadow={false}>
        <sphereGeometry args={[0.62, 6, 4]} />
        <meshBasicMaterial color="#a06a28" />
      </mesh>
      <mesh position={[1.25, 22.8, 0.5]} castShadow={false}>
        <sphereGeometry args={[0.58, 6, 4]} />
        <meshBasicMaterial color="#7f4d1f" />
      </mesh>
    </group>
  );
}

function DesertVillageGateArch({ side, baseHeight }: { side: GateSide; baseHeight: number }) {
  const z = side === "north" ? -DESERT_VILLAGE_RADIUS : side === "south" ? DESERT_VILLAGE_RADIUS : 0;
  const x = side === "east" ? DESERT_VILLAGE_RADIUS : side === "west" ? -DESERT_VILLAGE_RADIUS : 0;
  const isNorthSouth = side === "north" || side === "south";
  const adobeTexture = useMemo(() => getDesertAdobeWallTexture(), []);
  const trim = "#e1bd78";

  if (isNorthSouth) {
    return (
      <group>
        <mesh position={[-36, baseHeight + 8.2, z]} castShadow={false} receiveShadow>
          <boxGeometry args={[10, 16.4, 12]} />
          <meshBasicMaterial map={adobeTexture} />
        </mesh>
        <mesh position={[36, baseHeight + 8.2, z]} castShadow={false} receiveShadow>
          <boxGeometry args={[10, 16.4, 12]} />
          <meshBasicMaterial map={adobeTexture} />
        </mesh>
        <mesh position={[0, baseHeight + 18.4, z]} castShadow={false} receiveShadow>
          <boxGeometry args={[84, 5.6, 12]} />
          <meshBasicMaterial map={adobeTexture} />
        </mesh>
        <mesh position={[0, baseHeight + 22.2, z]} castShadow={false}>
          <boxGeometry args={[34, 4.8, 12]} />
          <meshBasicMaterial color={trim} />
        </mesh>
      </group>
    );
  }

  return (
    <group>
      <mesh position={[x, baseHeight + 8.2, -36]} castShadow={false} receiveShadow>
        <boxGeometry args={[12, 16.4, 10]} />
        <meshBasicMaterial map={adobeTexture} />
      </mesh>
      <mesh position={[x, baseHeight + 8.2, 36]} castShadow={false} receiveShadow>
        <boxGeometry args={[12, 16.4, 10]} />
        <meshBasicMaterial map={adobeTexture} />
      </mesh>
      <mesh position={[x, baseHeight + 18.4, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[12, 5.6, 84]} />
        <meshBasicMaterial map={adobeTexture} />
      </mesh>
      <mesh position={[x, baseHeight + 22.2, 0]} castShadow={false}>
        <boxGeometry args={[12, 4.8, 34]} />
        <meshBasicMaterial color={trim} />
      </mesh>
    </group>
  );
}

function DesertVillageWallVisuals({
  wallSegments,
  baseHeight,
}: {
  wallSegments: DesertVillageWallSegment[];
  baseHeight: number;
}) {
  const wallRef = useRef<THREE.InstancedMesh>(null);
  const adobeTexture = useMemo(() => getDesertAdobeWallTexture(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const wallMesh = wallRef.current;
    if (!wallMesh) return;

    for (let index = 0; index < wallSegments.length; index += 1) {
      const segment = wallSegments[index];
      dummy.position.set(segment.localX, baseHeight + segment.height / 2, segment.localZ);
      dummy.rotation.set(0, segment.rotation, 0);
      dummy.scale.set(segment.width, segment.height, segment.depth);
      dummy.updateMatrix();
      wallMesh.setMatrixAt(index, dummy.matrix);
    }

    wallMesh.instanceMatrix.needsUpdate = true;
  }, [baseHeight, dummy, wallSegments]);

  return (
    <>
      <instancedMesh ref={wallRef} args={[undefined, undefined, wallSegments.length]} castShadow={false} receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial map={adobeTexture} />
      </instancedMesh>
      <DesertVillageGateArch side="north" baseHeight={baseHeight} />
      <DesertVillageGateArch side="south" baseHeight={baseHeight} />
      <DesertVillageGateArch side="east" baseHeight={baseHeight} />
      <DesertVillageGateArch side="west" baseHeight={baseHeight} />
    </>
  );
}

function DesertVillageWell({ baseHeight }: { baseHeight: number }) {
  return (
    <group name="desert-village-well">
      <mesh position={[0, baseHeight + 3.5, 0]} castShadow={false} receiveShadow>
        <cylinderGeometry args={[28, 31, 7, 20]} />
        <meshBasicMaterial color="#9a6b3e" />
      </mesh>
      <mesh position={[0, baseHeight + 7.25, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow={false}>
        <circleGeometry args={[22, 20]} />
        <meshBasicMaterial color="#3aa0b8" transparent opacity={0.86} />
      </mesh>
      <mesh position={[0, baseHeight + 8.15, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow={false}>
        <ringGeometry args={[27.5, 32, 20]} />
        <meshBasicMaterial color="#d5aa64" />
      </mesh>
      <mesh position={[-18, baseHeight + 16, 0]} castShadow={false}>
        <boxGeometry args={[3.4, 17, 3.4]} />
        <meshBasicMaterial color="#7a4a2b" />
      </mesh>
      <mesh position={[18, baseHeight + 16, 0]} castShadow={false}>
        <boxGeometry args={[3.4, 17, 3.4]} />
        <meshBasicMaterial color="#7a4a2b" />
      </mesh>
      <mesh position={[0, baseHeight + 25.2, 0]} castShadow={false}>
        <boxGeometry args={[45, 4.2, 5]} />
        <meshBasicMaterial color="#704026" />
      </mesh>
    </group>
  );
}

function DesertVillageColliders({
  chunk,
  baseHeight,
  layout,
  groundGeometry,
  detailsReady,
}: {
  chunk: SurvivalChunkInfo;
  baseHeight: number;
  layout: DesertVillageLayout;
  groundGeometry: THREE.BufferGeometry;
  detailsReady: boolean;
}) {
  if (!shouldBuildSurvivalChunkColliders(chunk)) return null;

  return (
    <>
      <RigidBody type="fixed" colliders="trimesh" friction={0.25} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <mesh geometry={groundGeometry} dispose={null}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </RigidBody>
      {detailsReady && <RigidBody type="fixed" colliders={false} friction={0.25} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <CylinderCollider args={[3.5, 31]} position={[0, baseHeight + 3.5, 0]} />
        <CuboidCollider args={[1.7, 8.5, 1.7]} position={[-18, baseHeight + 16, 0]} />
        <CuboidCollider args={[1.7, 8.5, 1.7]} position={[18, baseHeight + 16, 0]} />
        <CuboidCollider args={[22.5, 2.1, 2.5]} position={[0, baseHeight + 25.2, 0]} />
        {layout.wallSegments.map((segment) => (
          <CuboidCollider
            key={`${segment.key}-collider`}
            args={[segment.width / 2, segment.height / 2, segment.depth / 2]}
            position={[segment.localX, baseHeight + segment.height / 2, segment.localZ]}
            rotation={[0, segment.rotation, 0]}
          />
        ))}
        {layout.buildings.map((building) => {
          const wallThickness = Math.min(DESERT_BUILDING_WALL_THICKNESS, building.width * 0.16, building.depth * 0.16);
          const doorWidth = Math.min(DESERT_BUILDING_DOOR_WIDTH, building.width - wallThickness * 4);
          const doorHeight = Math.min(DESERT_BUILDING_DOOR_HEIGHT, building.height - 1.2);
          const frontWallWidth = Math.max(1.2, (building.width - doorWidth) / 2);
          const lintelHeight = Math.max(0.8, building.height - doorHeight);

          return (
            <group key={`${building.key}-colliders`} position={[building.localX, baseHeight, building.localZ]} rotation={[0, building.rotation, 0]}>
              <CuboidCollider
                args={[wallThickness / 2, building.height / 2, building.depth / 2]}
                position={[-building.width / 2 + wallThickness / 2, building.height / 2, 0]}
              />
              <CuboidCollider
                args={[wallThickness / 2, building.height / 2, building.depth / 2]}
                position={[building.width / 2 - wallThickness / 2, building.height / 2, 0]}
              />
              <CuboidCollider
                args={[building.width / 2, building.height / 2, wallThickness / 2]}
                position={[0, building.height / 2, -building.depth / 2 + wallThickness / 2]}
              />
              <CuboidCollider
                args={[frontWallWidth / 2, building.height / 2, wallThickness / 2]}
                position={[-doorWidth / 2 - frontWallWidth / 2, building.height / 2, building.depth / 2 - wallThickness / 2]}
              />
              <CuboidCollider
                args={[frontWallWidth / 2, building.height / 2, wallThickness / 2]}
                position={[doorWidth / 2 + frontWallWidth / 2, building.height / 2, building.depth / 2 - wallThickness / 2]}
              />
              <CuboidCollider
                args={[doorWidth / 2, lintelHeight / 2, wallThickness / 2]}
                position={[0, doorHeight + lintelHeight / 2, building.depth / 2 - wallThickness / 2]}
              />
            </group>
          );
        })}
        {layout.fences.map((fence) => (
          <group key={`${fence.key}-colliders`} position={[fence.localX, baseHeight, fence.localZ]} rotation={[0, fence.rotation, 0]}>
            {DESERT_FENCE_POST_OFFSETS.map((offset) => (
              <CuboidCollider key={`${fence.key}-post-${offset}`} args={[0.33, 1.7, 0.29]} position={[offset * fence.length, 1.7, 0]} />
            ))}
            <CuboidCollider args={[fence.length / 2, 0.19, 0.19]} position={[0, 1.55, 0]} />
            <CuboidCollider args={[fence.length / 2, 0.17, 0.17]} position={[0, 2.72, 0]} />
          </group>
        ))}
        {layout.streetProps.map((prop) => {
          if (prop.kind === "barrel") {
            return (
              <CylinderCollider
                key={`${prop.key}-collider`}
                args={[1.55 * prop.scale, 1.48 * prop.scale]}
                position={[prop.localX, baseHeight + 1.55 * prop.scale, prop.localZ]}
              />
            );
          }

          if (prop.kind === "crate") {
            return (
              <CuboidCollider
                key={`${prop.key}-collider`}
                args={[1.525 * prop.scale, 1.35 * prop.scale, 1.525 * prop.scale]}
                position={[prop.localX, baseHeight + 1.35 * prop.scale, prop.localZ]}
                rotation={[0, prop.rotation, 0]}
              />
            );
          }

          return (
            <CuboidCollider
              key={`${prop.key}-collider`}
              args={[1.75 * prop.scale, 0.58 * prop.scale, 1.2 * prop.scale]}
              position={[prop.localX, baseHeight + 0.58 * prop.scale, prop.localZ]}
              rotation={[0, prop.rotation, 0]}
            />
          );
        })}
        {layout.marketStalls.map((stall) => (
          <group key={`${stall.key}-colliders`} position={[stall.localX, baseHeight, stall.localZ]} rotation={[0, stall.rotation, 0]}>
            <CuboidCollider args={[5, 2.4, 2.75]} position={[0, 2.4, 0]} />
            <CuboidCollider args={[6.75, 0.55, 3.9]} position={[0, 5.95, 0]} />
          </group>
        ))}
        {layout.palms.map((palm) => (
          <CylinderCollider
            key={`${palm.key}-trunk-collider`}
            args={[12.4 * palm.scale, 1.42 * palm.scale]}
            position={[palm.localX, palm.localY + 12.4 * palm.scale, palm.localZ]}
          />
        ))}
      </RigidBody>}
    </>
  );
}

export function SurvivalDesertVillage({
  chunk,
  terrainHeightForChunk,
  villageBaseHeightForChunk,
  villagePadHeightForChunk,
  makeVillagePadGeometry,
  makeVillagePadSkirtGeometry,
}: {
  chunk: SurvivalChunkInfo;
  terrainHeightForChunk: SurvivalTerrainHeightForChunk;
  villageBaseHeightForChunk: SurvivalVillageBaseHeightForChunk;
  villagePadHeightForChunk: SurvivalVillagePadHeightForChunk;
  makeVillagePadGeometry: SurvivalVillageGeometryFactory;
  makeVillagePadSkirtGeometry: SurvivalVillageGeometryFactory;
}) {
  const [phase, setPhase] = useState(() => (typeof window === "undefined" ? 3 : 0));
  const villageBaseHeight = useMemo(() => villageBaseHeightForChunk(chunk), [chunk, villageBaseHeightForChunk]);
  const villagePadGeometry = useMemo(() => makeVillagePadGeometry(chunk), [chunk, makeVillagePadGeometry]);
  const hasVillagePadSkirt = shouldRenderSurvivalChunkSkirt(chunk);
  const villagePadSkirtGeometry = useMemo(
    () => hasVillagePadSkirt ? makeVillagePadSkirtGeometry(chunk) : null,
    [chunk, hasVillagePadSkirt, makeVillagePadSkirtGeometry]
  );
  const villagePadCollisionGeometry = useMemo(() => makeVillagePadGeometry(chunk), [chunk, makeVillagePadGeometry]);
  const layout = useMemo(
    () => makeDesertVillageLayout(chunk, villageBaseHeight, terrainHeightForChunk),
    [chunk, terrainHeightForChunk, villageBaseHeight],
  );
  useSurvivalFeatureCount(
    "desertVillageBuildings",
    `survival-desert-village-buildings-${chunk.key}`,
    phase >= 2 ? layout.buildings.length : 0,
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    setPhase(0);
    const collisionAndWalls = window.setTimeout(() => {
      startTransition(() => setPhase(1));
    }, 90);
    const buildings = window.setTimeout(() => {
      startTransition(() => setPhase(2));
    }, 280);
    const dressing = window.setTimeout(() => {
      startTransition(() => setPhase(3));
    }, 620);

    return () => {
      window.clearTimeout(collisionAndWalls);
      window.clearTimeout(buildings);
      window.clearTimeout(dressing);
    };
  }, [chunk.key]);

  return (
    <>
      <DesertVillageColliders
        chunk={chunk}
        baseHeight={villageBaseHeight}
        layout={layout}
        groundGeometry={villagePadCollisionGeometry}
        detailsReady={phase >= 1}
      />
      <group name={`survival-desert-village-${chunk.key}`} position={[chunk.x, 0, chunk.z]}>
        {villagePadSkirtGeometry && (
          <mesh geometry={villagePadSkirtGeometry} dispose={null}>
            <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
          </mesh>
        )}
        <DesertVillageSurface
          geometry={villagePadGeometry}
          baseHeight={villageBaseHeight}
          chunk={chunk}
          villageBaseHeightForChunk={villageBaseHeightForChunk}
          villagePadHeightForChunk={villagePadHeightForChunk}
        />
        {phase >= 1 && <DesertVillageWallVisuals wallSegments={layout.wallSegments} baseHeight={villageBaseHeight} />}
        {phase >= 2 && <DesertVillageBuildings
          buildings={layout.buildings}
          baseHeight={villageBaseHeight}
          showDetails={chunk.distance === 0}
        />}
        {phase >= 3 && <DesertVillageDressing
          layout={layout}
          baseHeight={villageBaseHeight}
          showDetails={chunk.distance === 0}
        />}
        {phase >= 1 && <DesertVillageWell baseHeight={villageBaseHeight} />}
        {phase >= 3 && layout.marketStalls.map((stall) => (
          <DesertMarketStall key={stall.key} stall={stall} baseHeight={villageBaseHeight} />
        ))}
        {phase >= 3 && layout.palms.map((palm) => (
          <DesertPalm key={palm.key} palm={palm} />
        ))}
      </group>
      {phase >= 3 && chunk.distance === 0 && (
        <Villagers
          key={`survival-desert-villagers-${chunk.key}`}
          huts={layout.huts}
          name={`survival-desert-villagers-${chunk.key}`}
        />
      )}
    </>
  );
}

