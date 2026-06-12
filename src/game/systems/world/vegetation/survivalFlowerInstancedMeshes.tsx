import type { Ref } from "react";
import * as THREE from "three";
import {
  applySurvivalLocalGrassShader,
  type SurvivalLocalGrassFadeUniforms,
} from "./survivalGrassShader";
import { HIDE_FROM_MINIMAP } from "./SurvivalFoliagePrimitives";

export type SurvivalFlowerInstancedMeshesProps = {
  stemRef: Ref<THREE.InstancedMesh>;
  starBloomRef: Ref<THREE.InstancedMesh>;
  roundBloomRef: Ref<THREE.InstancedMesh>;
  bellBloomRef: Ref<THREE.InstancedMesh>;
  puffBloomRef: Ref<THREE.InstancedMesh>;
  centerRef: Ref<THREE.InstancedMesh>;
  flowerCapacity: number;
  starFlowerCapacity: number;
  roundFlowerCapacity: number;
  bellFlowerCapacity: number;
  puffFlowerCapacity: number;
  flowerStarGeometry: THREE.BufferGeometry;
  fadeUniforms: SurvivalLocalGrassFadeUniforms;
  hideFromMinimap?: boolean;
};

export function SurvivalFlowerInstancedMeshes({
  stemRef,
  starBloomRef,
  roundBloomRef,
  bellBloomRef,
  puffBloomRef,
  centerRef,
  flowerCapacity,
  starFlowerCapacity,
  roundFlowerCapacity,
  bellFlowerCapacity,
  puffFlowerCapacity,
  flowerStarGeometry,
  fadeUniforms,
  hideFromMinimap = false,
}: SurvivalFlowerInstancedMeshesProps) {
  const minimapUserData = hideFromMinimap ? HIDE_FROM_MINIMAP : undefined;

  return (
    <>
      <instancedMesh ref={stemRef} args={[undefined, undefined, flowerCapacity]} renderOrder={4.2} frustumCulled userData={minimapUserData}>
        <cylinderGeometry args={[1, 1, 1, 4]} />
        <meshBasicMaterial
          color="#3f7d2e"
          transparent
          opacity={0.92}
          depthWrite={false}
          toneMapped={false}
          onBeforeCompile={(shader) => {
            applySurvivalLocalGrassShader(shader, fadeUniforms);
          }}
        />
      </instancedMesh>
      <instancedMesh ref={starBloomRef} args={[undefined, undefined, starFlowerCapacity]} renderOrder={4.35} frustumCulled userData={minimapUserData}>
        <primitive object={flowerStarGeometry} attach="geometry" />
        <meshBasicMaterial
          color="#ffffff"
          side={THREE.DoubleSide}
          transparent
          opacity={0.98}
          depthWrite={false}
          depthTest
          toneMapped={false}
          onBeforeCompile={(shader) => {
            applySurvivalLocalGrassShader(shader, fadeUniforms, "", 2, 12);
          }}
        />
      </instancedMesh>
      <instancedMesh ref={roundBloomRef} args={[undefined, undefined, roundFlowerCapacity]} renderOrder={4.35} frustumCulled userData={minimapUserData}>
        <octahedronGeometry args={[0.5, 0]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.98}
          depthWrite={false}
          depthTest
          toneMapped={false}
          onBeforeCompile={(shader) => {
            applySurvivalLocalGrassShader(shader, fadeUniforms, "", 2, 12);
          }}
        />
      </instancedMesh>
      <instancedMesh ref={bellBloomRef} args={[undefined, undefined, bellFlowerCapacity]} renderOrder={4.35} frustumCulled userData={minimapUserData}>
        <coneGeometry args={[0.5, 1, 6]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.98}
          depthWrite={false}
          depthTest
          toneMapped={false}
          onBeforeCompile={(shader) => {
            applySurvivalLocalGrassShader(shader, fadeUniforms, "", 2, 12);
          }}
        />
      </instancedMesh>
      <instancedMesh ref={puffBloomRef} args={[undefined, undefined, puffFlowerCapacity]} renderOrder={4.35} frustumCulled userData={minimapUserData}>
        <sphereGeometry args={[0.5, 6, 5]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.96}
          depthWrite={false}
          depthTest
          toneMapped={false}
          onBeforeCompile={(shader) => {
            applySurvivalLocalGrassShader(shader, fadeUniforms, "", 2, 12);
          }}
        />
      </instancedMesh>
      <instancedMesh ref={centerRef} args={[undefined, undefined, flowerCapacity]} renderOrder={4.45} frustumCulled userData={minimapUserData}>
        <sphereGeometry args={[0.5, 5, 4]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.94}
          depthWrite={false}
          depthTest
          toneMapped={false}
          onBeforeCompile={(shader) => {
            applySurvivalLocalGrassShader(shader, fadeUniforms, "", 2, 12);
          }}
        />
      </instancedMesh>
    </>
  );
}
