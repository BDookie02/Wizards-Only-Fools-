import { useMemo } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { shouldBuildSurvivalChunkColliders } from "../survival/survivalChunks";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import {
  CHAPEL_CENTER_PEW_COLLIDERS,
  CHAPEL_POPE_TARGET,
  getChapelSideWingPewLayout,
  getYawForPewFacingTarget,
} from "./survivalGraveyardChapelLayout";
import {
  CHAPEL_CENTER_HALF_DEPTH,
  CHAPEL_CENTER_HALF_WIDTH,
  CHAPEL_SIDE_WING_CENTER_X,
  CHAPEL_SIDE_WING_HALF_DEPTH,
  CHAPEL_SIDE_WING_HALF_WIDTH,
  getChapelWallSegments,
  makeChapelRampColliderGeometry,
} from "./survivalGraveyardChapelStructure";
import type { GraveyardFenceSegment } from "./survivalGraveyardVillageLayout";

export type GraveyardVillageColliderSummary = {
  rigidBodyCount: number;
  foundationColliderCount: number;
  centerPewColliderCount: number;
  sideWingPewColliderCount: number;
  altarColliderCount: number;
  wallColliderCount: number;
  towerColliderCount: number;
  fenceColliderCount: number;
  cuboidColliderCount: number;
};

export function getGraveyardVillageColliderSummary(fenceSegmentCount: number): GraveyardVillageColliderSummary {
  const foundationColliderCount = 3;
  const centerPewColliderCount = CHAPEL_CENTER_PEW_COLLIDERS.length;
  const sideWingPewColliderCount = getChapelSideWingPewLayout().length;
  const altarColliderCount = 2;
  const wallColliderCount = getChapelWallSegments().length;
  const towerColliderCount = 8;
  const fenceColliderCount = Math.max(0, Math.floor(fenceSegmentCount));
  return {
    rigidBodyCount: 3,
    foundationColliderCount,
    centerPewColliderCount,
    sideWingPewColliderCount,
    altarColliderCount,
    wallColliderCount,
    towerColliderCount,
    fenceColliderCount,
    cuboidColliderCount:
      foundationColliderCount
      + centerPewColliderCount
      + sideWingPewColliderCount
      + altarColliderCount
      + wallColliderCount
      + towerColliderCount
      + fenceColliderCount,
  };
}

export function GraveyardVillageColliders({
  chunk,
  baseHeight,
  groundGeometry,
  fenceSegments,
}: {
  chunk: SurvivalChunkInfo;
  baseHeight: number;
  groundGeometry: THREE.BufferGeometry;
  fenceSegments: GraveyardFenceSegment[];
}) {
  const rampColliderGeometry = useMemo(() => makeChapelRampColliderGeometry(baseHeight), [baseHeight]);
  const sideWingPews = useMemo(() => getChapelSideWingPewLayout(), []);
  if (!shouldBuildSurvivalChunkColliders(chunk)) return null;

  return (
    <>
      <RigidBody type="fixed" colliders="trimesh" friction={0.5} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <mesh geometry={groundGeometry} dispose={null}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="trimesh" friction={0.82} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <mesh geometry={rampColliderGeometry} dispose={null}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders={false} friction={0.55} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <CuboidCollider args={[CHAPEL_CENTER_HALF_WIDTH, 0.58, CHAPEL_CENTER_HALF_DEPTH]} position={[0, baseHeight + 0.56, 0]} />
        <CuboidCollider args={[CHAPEL_SIDE_WING_HALF_WIDTH, 0.56, CHAPEL_SIDE_WING_HALF_DEPTH]} position={[-CHAPEL_SIDE_WING_CENTER_X, baseHeight + 0.54, 0]} />
        <CuboidCollider args={[CHAPEL_SIDE_WING_HALF_WIDTH, 0.56, CHAPEL_SIDE_WING_HALF_DEPTH]} position={[CHAPEL_SIDE_WING_CENTER_X, baseHeight + 0.54, 0]} />
        {CHAPEL_CENTER_PEW_COLLIDERS.map((pew) => (
          <CuboidCollider
            key={pew.key}
            args={[9.5, 1.75, 2.55]}
            position={[pew.x, baseHeight + 2.65, pew.z]}
          />
        ))}
        {sideWingPews.map((pew) => (
          <CuboidCollider
            key={`chapel-side-pew-collider-${pew.key}`}
            args={[pew.width / 2 + 0.9, 1.75, 2.65]}
            position={[pew.x, baseHeight + 2.65, pew.z]}
            rotation={[0, getYawForPewFacingTarget(pew.x, pew.z, CHAPEL_POPE_TARGET.x, CHAPEL_POPE_TARGET.z), 0]}
          />
        ))}
        <CuboidCollider args={[11.2, 2.9, 4.7]} position={[0, baseHeight + 3.9, -68]} />
        <CuboidCollider args={[4.35, 3.05, 3.45]} position={[30, baseHeight + 4.05, -54]} />
        {getChapelWallSegments().map((wall) => (
          <CuboidCollider
            key={`chapel-wall-collider-${wall.key}`}
            args={[wall.size[0] / 2, wall.size[1] / 2, wall.size[2] / 2]}
            position={[wall.position[0], baseHeight + wall.position[1], wall.position[2]]}
          />
        ))}
        <CuboidCollider args={[1.3, 33.2, 21]} position={[-17.3, baseHeight + 33.2, CHAPEL_CENTER_HALF_DEPTH - 20]} />
        <CuboidCollider args={[1.3, 33.2, 21]} position={[17.3, baseHeight + 33.2, CHAPEL_CENTER_HALF_DEPTH - 20]} />
        <CuboidCollider args={[2.7, 33.2, 1.3]} position={[-13.7, baseHeight + 33.2, CHAPEL_CENTER_HALF_DEPTH - 3.5]} />
        <CuboidCollider args={[2.7, 33.2, 1.3]} position={[13.7, baseHeight + 33.2, CHAPEL_CENTER_HALF_DEPTH - 3.5]} />
        <CuboidCollider args={[2.7, 33.2, 1.2]} position={[-13.7, baseHeight + 33.2, CHAPEL_CENTER_HALF_DEPTH - 40.5]} />
        <CuboidCollider args={[2.7, 33.2, 1.2]} position={[13.7, baseHeight + 33.2, CHAPEL_CENTER_HALF_DEPTH - 40.5]} />
        <CuboidCollider args={[11, 20, 1.3]} position={[0, baseHeight + 46.4, CHAPEL_CENTER_HALF_DEPTH - 3.5]} />
        <CuboidCollider args={[11, 20, 1.2]} position={[0, baseHeight + 46.4, CHAPEL_CENTER_HALF_DEPTH - 40.5]} />
        {fenceSegments.map((segment) => (
          <group key={`${segment.key}-collider`} position={[segment.localX, 0, segment.localZ]} rotation={[0, segment.rotation, 0]}>
            <CuboidCollider args={[(segment.length + 3.2) / 2, 7.2, 1.8]} position={[0, segment.localY + 5.6, 0]} />
          </group>
        ))}
      </RigidBody>
    </>
  );
}
