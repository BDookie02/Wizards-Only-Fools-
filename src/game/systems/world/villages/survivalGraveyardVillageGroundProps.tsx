import { Fragment, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getCachedIndexRange } from "../../rendering/indexRange";
import { finalizeSurvivalInstancedMesh } from "../vegetation/survivalInstancing";
import type { GraveyardFenceSegment, GraveyardPathStone } from "./survivalGraveyardVillageLayout";
import { GRAVEYARD_VILLAGE_RADIUS } from "./survivalGraveyardVillageTerrain";

const GRAVEYARD_FENCE_POST_OFFSETS = [-0.48, 0.48] as const;

export function GraveyardSpikedFence({ segments, showDetails }: { segments: GraveyardFenceSegment[]; showDetails: boolean }) {
  return (
    <group name="graveyard-black-spiked-fence">
      {segments.map((segment) => (
        <group key={segment.key} position={[segment.localX, segment.localY, segment.localZ]} rotation={[0, segment.rotation, 0]}>
          <mesh position={[0, -0.46, 0]} castShadow={false} receiveShadow>
            <boxGeometry args={[segment.length + 2.1, 1.08, 1.28]} />
            <meshBasicMaterial color="#050505" />
          </mesh>
          <mesh position={[0, 0.38, 0]} castShadow={false}>
            <boxGeometry args={[segment.length + 1.4, 0.76, 1.05]} />
            <meshBasicMaterial color="#020202" />
          </mesh>
          <mesh position={[0, 7.42, 0]} castShadow={false}>
            <boxGeometry args={[segment.length, 0.58, 0.52]} />
            <meshBasicMaterial color="#050505" />
          </mesh>
          <mesh position={[0, 4.95, 0]} castShadow={false}>
            <boxGeometry args={[segment.length, 0.48, 0.42]} />
            <meshBasicMaterial color="#080808" />
          </mesh>
          <mesh position={[0, 2.52, 0]} castShadow={false}>
            <boxGeometry args={[segment.length, 0.42, 0.36]} />
            <meshBasicMaterial color="#111111" />
          </mesh>
          {GRAVEYARD_FENCE_POST_OFFSETS.map((offset) => (
            <mesh key={`post-${offset}`} position={[offset * segment.length, 5.05, 0]} castShadow={false}>
              <boxGeometry args={[1.18, 10.1, 1.18]} />
              <meshBasicMaterial color="#080808" />
            </mesh>
          ))}
          {showDetails && getCachedIndexRange(3).map((index) => {
            const x = -segment.length * 0.32 + index * (segment.length * 0.64 / 2);
            return (
              <Fragment key={`spike-${index}`}>
                <mesh position={[x, 4.78, 0]} castShadow={false}>
                  <boxGeometry args={[0.5, 8.2, 0.5]} />
                  <meshBasicMaterial color="#0c0c0c" />
                </mesh>
                <mesh position={[x, 9.85, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={false}>
                  <coneGeometry args={[0.72, 2.15, 4]} />
                  <meshBasicMaterial color="#030303" />
                </mesh>
                <mesh position={[x + 0.14, 8.8, -0.24]} castShadow={false}>
                  <boxGeometry args={[0.16, 1.4, 0.12]} />
                  <meshBasicMaterial color="#333333" />
                </mesh>
              </Fragment>
            );
          })}
        </group>
      ))}
    </group>
  );
}

export function GraveyardPathStones({ stones, showDetails }: { stones: GraveyardPathStone[]; showDetails: boolean }) {
  const pathStoneRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const mesh = pathStoneRef.current;
    if (!mesh) return;

    for (let index = 0; index < stones.length; index += 1) {
      const stone = stones[index];
      dummy.position.set(stone.localX, stone.localY, stone.localZ);
      dummy.rotation.set(-Math.PI / 2, 0, stone.rotation);
      dummy.scale.set(stone.width, stone.depth, 0.12);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.count = stones.length;
    finalizeSurvivalInstancedMesh(mesh, 0, 0, GRAVEYARD_VILLAGE_RADIUS + 36, 12);
  }, [dummy, stones]);

  if (!showDetails || stones.length === 0) return null;

  return (
    <group name="graveyard-path-stones">
      <instancedMesh ref={pathStoneRef} args={[undefined, undefined, Math.max(1, stones.length)]} castShadow={false} renderOrder={2}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#caccbf" transparent opacity={0.68} />
      </instancedMesh>
    </group>
  );
}
