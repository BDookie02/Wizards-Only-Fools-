import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { isMobilePerformanceMode } from "../../input/performanceMode";
import { useSurvivalAmbientInsectCount } from "../../../tools/qa/survivalFeatureCounters";
import { getSurvivalWaterLevelAtWorld } from "../survival/survivalBiome";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { makeSurvivalAmbientInsects } from "./survivalAmbientInsects";

const MOBILE_AMBIENT_INSECT_UPDATE_INTERVAL_SECONDS = 1 / 24;

const AMBIENT_INSECT_WING_GEOMETRY = new THREE.PlaneGeometry(1, 1, 1, 1);
const BUTTERFLY_LEFT_WING_MATERIAL = new THREE.MeshBasicMaterial({
  color: "#fef08a",
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.82,
  depthWrite: false,
  toneMapped: false,
});
const BUTTERFLY_RIGHT_WING_MATERIAL = new THREE.MeshBasicMaterial({
  color: "#bae6fd",
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.82,
  depthWrite: false,
  toneMapped: false,
});
const BEE_WING_MATERIAL = new THREE.MeshBasicMaterial({
  color: "#e0f2fe",
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.52,
  depthWrite: false,
  toneMapped: false,
});

export type SurvivalTerrainHeightForAmbientInsects = (
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
) => number;

function ActiveSurvivalAmbientInsects({
  chunk,
  butterflies,
  bees,
  mobilePerformanceMode,
}: {
  chunk: SurvivalChunkInfo;
  butterflies: ReturnType<typeof makeSurvivalAmbientInsects>;
  bees: ReturnType<typeof makeSurvivalAmbientInsects>;
  mobilePerformanceMode: boolean;
}) {
  const butterflyLeftWingRef = useRef<THREE.InstancedMesh>(null);
  const butterflyRightWingRef = useRef<THREE.InstancedMesh>(null);
  const beeWingRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const cameraRight = useMemo(() => new THREE.Vector3(1, 0, 0), []);
  const cameraUp = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const lastUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);

  useFrame(({ clock, camera }) => {
    const time = clock.elapsedTime;
    if (
      mobilePerformanceMode &&
      time - lastUpdateAtRef.current < MOBILE_AMBIENT_INSECT_UPDATE_INTERVAL_SECONDS
    ) {
      return;
    }
    lastUpdateAtRef.current = time;

    cameraRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    cameraUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    const butterflyLeftWing = butterflyLeftWingRef.current;
    const butterflyRightWing = butterflyRightWingRef.current;
    const beeWing = beeWingRef.current;

    for (let index = 0; index < butterflies.length; index += 1) {
      const butterfly = butterflies[index];
      const orbit = time * butterfly.speed + butterfly.phase;
      position.set(
        chunk.x + butterfly.x + Math.cos(orbit) * butterfly.orbitRadius,
        butterfly.y + butterfly.height + Math.sin(time * 1.9 + butterfly.wobble) * 0.55,
        chunk.z + butterfly.z + Math.sin(orbit * 0.83) * butterfly.orbitRadius * 0.72,
      );
      const flap = Math.sin(time * (9.2 + butterfly.size) + butterfly.phase);
      const flapAmount = Math.abs(flap);
      const wingOffset = butterfly.size * (0.34 + flapAmount * 0.18);

      if (butterflyLeftWing) {
        dummy.position.copy(position).addScaledVector(cameraRight, -wingOffset);
        dummy.quaternion.copy(camera.quaternion);
        dummy.rotateZ(-0.34 - flapAmount * 0.5);
        dummy.scale.set(butterfly.size * 0.82, butterfly.size * 0.58, 1);
        dummy.updateMatrix();
        butterflyLeftWing.setMatrixAt(index, dummy.matrix);
      }
      if (butterflyRightWing) {
        dummy.position.copy(position).addScaledVector(cameraRight, wingOffset);
        dummy.quaternion.copy(camera.quaternion);
        dummy.rotateZ(0.34 + flapAmount * 0.5);
        dummy.scale.set(butterfly.size * 0.82, butterfly.size * 0.58, 1);
        dummy.updateMatrix();
        butterflyRightWing.setMatrixAt(index, dummy.matrix);
      }
    }

    if (butterflyLeftWing) {
      butterflyLeftWing.count = butterflies.length;
      butterflyLeftWing.instanceMatrix.needsUpdate = true;
      butterflyLeftWing.frustumCulled = false;
    }
    if (butterflyRightWing) {
      butterflyRightWing.count = butterflies.length;
      butterflyRightWing.instanceMatrix.needsUpdate = true;
      butterflyRightWing.frustumCulled = false;
    }

    for (let index = 0; index < bees.length; index += 1) {
      const bee = bees[index];
      const orbit = time * bee.speed + bee.phase;
      position.set(
        chunk.x + bee.x + Math.cos(orbit) * bee.orbitRadius,
        bee.y + bee.height + Math.sin(time * 4.1 + bee.wobble) * 0.28,
        chunk.z + bee.z + Math.sin(orbit * 1.17) * bee.orbitRadius * 0.62,
      );

      if (beeWing) {
        dummy.position.copy(position).addScaledVector(cameraUp, bee.size * 0.22);
        dummy.quaternion.copy(camera.quaternion);
        dummy.rotateZ(Math.sin(time * 24 + bee.phase) * 0.18);
        dummy.scale.set(bee.size * 0.72, bee.size * 0.34, 1);
        dummy.updateMatrix();
        beeWing.setMatrixAt(index, dummy.matrix);
      }
    }

    if (beeWing) {
      beeWing.count = bees.length;
      beeWing.instanceMatrix.needsUpdate = true;
      beeWing.frustumCulled = false;
    }
  });

  return (
    <group name={`survival-ambient-insects-${chunk.key}`}>
      <instancedMesh ref={butterflyLeftWingRef} args={[undefined, undefined, Math.max(1, butterflies.length)]} renderOrder={15} frustumCulled={false}>
        <primitive attach="geometry" object={AMBIENT_INSECT_WING_GEOMETRY} />
        <primitive attach="material" object={BUTTERFLY_LEFT_WING_MATERIAL} />
      </instancedMesh>
      <instancedMesh ref={butterflyRightWingRef} args={[undefined, undefined, Math.max(1, butterflies.length)]} renderOrder={15} frustumCulled={false}>
        <primitive attach="geometry" object={AMBIENT_INSECT_WING_GEOMETRY} />
        <primitive attach="material" object={BUTTERFLY_RIGHT_WING_MATERIAL} />
      </instancedMesh>
      <instancedMesh ref={beeWingRef} args={[undefined, undefined, Math.max(1, bees.length)]} renderOrder={17} frustumCulled={false}>
        <primitive attach="geometry" object={AMBIENT_INSECT_WING_GEOMETRY} />
        <primitive attach="material" object={BEE_WING_MATERIAL} />
      </instancedMesh>
    </group>
  );
}

export function SurvivalAmbientInsects({
  chunk,
  getTerrainHeightForChunk,
}: {
  chunk: SurvivalChunkInfo;
  getTerrainHeightForChunk: SurvivalTerrainHeightForAmbientInsects;
}) {
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const insectResolvers = useMemo(() => ({
    getTerrainHeightForChunk,
    getWaterLevelAtWorld: getSurvivalWaterLevelAtWorld,
  }), [getTerrainHeightForChunk]);
  const butterflies = useMemo(
    () => makeSurvivalAmbientInsects(chunk, mobilePerformanceMode, "butterfly", insectResolvers),
    [chunk, insectResolvers, mobilePerformanceMode],
  );
  const bees = useMemo(
    () => makeSurvivalAmbientInsects(chunk, mobilePerformanceMode, "bee", insectResolvers),
    [chunk, insectResolvers, mobilePerformanceMode],
  );

  useSurvivalAmbientInsectCount(chunk.key, butterflies.length, bees.length);

  if (butterflies.length === 0 && bees.length === 0) return null;

  return (
    <ActiveSurvivalAmbientInsects
      chunk={chunk}
      butterflies={butterflies}
      bees={bees}
      mobilePerformanceMode={mobilePerformanceMode}
    />
  );
}
