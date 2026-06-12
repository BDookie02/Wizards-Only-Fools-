import * as THREE from "three";
import type { SurvivalBotwFlowerInstance } from "./survivalBotwGrassConfig";
import { SURVIVAL_GRASS_BLADE_SOURCE_UP } from "./survivalBotwGrassPlacement";
import {
  ensureSurvivalInstancedMeshColors,
  finalizeSurvivalInstancedMeshColors,
} from "./survivalInstancing";

export type SurvivalBotwFlowerUploadScratch = {
  dummy: THREE.Object3D;
  normal: THREE.Vector3;
  forward: THREE.Vector3;
  right: THREE.Vector3;
  basis: THREE.Matrix4;
  color: THREE.Color;
};

export type SurvivalBotwFlowerUploadParams = {
  stemMesh: THREE.InstancedMesh;
  leafMesh: THREE.InstancedMesh;
  starMesh: THREE.InstancedMesh;
  roundMesh: THREE.InstancedMesh;
  bellMesh: THREE.InstancedMesh;
  puffMesh: THREE.InstancedMesh;
  flowers: SurvivalBotwFlowerInstance[];
  starFlowers: SurvivalBotwFlowerInstance[];
  roundFlowers: SurvivalBotwFlowerInstance[];
  bellFlowers: SurvivalBotwFlowerInstance[];
  puffFlowers: SurvivalBotwFlowerInstance[];
  center: { x: number; z: number };
  scratch: SurvivalBotwFlowerUploadScratch;
};

export function clearSurvivalBotwFlowerMesh(mesh: THREE.InstancedMesh) {
  mesh.count = 0;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
}

export function uploadSurvivalBotwFlowerInstances({
  stemMesh,
  leafMesh,
  starMesh,
  roundMesh,
  bellMesh,
  puffMesh,
  flowers,
  starFlowers,
  roundFlowers,
  bellFlowers,
  puffFlowers,
  center,
  scratch,
}: SurvivalBotwFlowerUploadParams) {
  clearSurvivalBotwFlowerMesh(starMesh);
  clearSurvivalBotwFlowerMesh(roundMesh);
  clearSurvivalBotwFlowerMesh(bellMesh);
  clearSurvivalBotwFlowerMesh(puffMesh);

  const { dummy, normal, forward, right, basis, color } = scratch;
  for (let index = 0; index < flowers.length; index += 1) {
    const flower = flowers[index];
    normal.set(flower.normalX, flower.normalY, flower.normalZ).normalize();

    dummy.position
      .set(flower.x, flower.y, flower.z)
      .addScaledVector(normal, flower.stemHeight * 0.5);
    dummy.quaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, normal);
    dummy.rotateY(flower.yaw);
    dummy.scale.set(flower.stemRadius, flower.stemHeight, flower.stemRadius);
    dummy.updateMatrix();
    stemMesh.setMatrixAt(index, dummy.matrix);
  }

  ensureSurvivalInstancedMeshColors(leafMesh, flowers.length * 2);
  let leafInstance = 0;
  for (let index = 0; index < flowers.length; index += 1) {
    const flower = flowers[index];
    normal.set(flower.normalX, flower.normalY, flower.normalZ).normalize();

    for (let leafSide = 0; leafSide < flower.leafCount; leafSide += 1) {
      const side = leafSide === 0 ? -1 : 1;
      dummy.position
        .set(flower.x, flower.y, flower.z)
        .addScaledVector(normal, flower.stemHeight * flower.leafHeight);
      dummy.quaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, normal);
      dummy.rotateY(flower.yaw + side * (0.92 + flower.leafYawOffset));
      dummy.rotateZ(side * -0.42);
      dummy.scale.set(flower.leafWidth, flower.leafLength, 1);
      dummy.updateMatrix();
      leafMesh.setMatrixAt(leafInstance, dummy.matrix);
      leafMesh.setColorAt(
        leafInstance,
        color.setRGB(flower.leafColorR, flower.leafColorG, flower.leafColorB),
      );
      leafInstance += 1;
    }
  }

  const writeReadableFlowerHeads = (
    mesh: THREE.InstancedMesh,
    groupedFlowers: SurvivalBotwFlowerInstance[],
    widthScale: number,
    heightScale: number,
  ) => {
    ensureSurvivalInstancedMeshColors(mesh, groupedFlowers.length);
    let headInstance = 0;
    for (let index = 0; index < groupedFlowers.length; index += 1) {
      const flower = groupedFlowers[index];
      normal.set(flower.normalX, flower.normalY, flower.normalZ).normalize();
      const batchBloomBoost = flower.largeBloomAmount ?? 0;
      const blossomY = flower.stemHeight + Math.max(0.06, flower.bloomHeight) * 0.05 + 0.08 + batchBloomBoost * 0.08;
      const headWidth = Math.min(1.35, flower.bloomWidth * (widthScale * 1.08 + batchBloomBoost * 0.08));
      const headHeight = Math.min(1.28, flower.bloomHeight * (heightScale * 1.04 + batchBloomBoost * 0.08));
      const bloomYaw = flower.yaw;

      forward.set(center.x - flower.x, 0, center.z - flower.z);
      if (forward.lengthSq() < 0.0001) {
        forward.set(Math.sin(bloomYaw), 0, Math.cos(bloomYaw));
      }
      forward
        .addScaledVector(normal, -forward.dot(normal))
        .normalize();
      right.crossVectors(normal, forward);
      if (right.lengthSq() < 0.0001) {
        right.set(Math.cos(bloomYaw), 0, -Math.sin(bloomYaw));
      } else {
        right.normalize();
      }
      basis.makeBasis(right, normal, forward);
      dummy.position
        .set(flower.x, flower.y, flower.z)
        .addScaledVector(normal, blossomY);
      dummy.quaternion.setFromRotationMatrix(basis);
      dummy.rotateZ(bloomYaw * 0.18);
      dummy.scale.set(headWidth, headHeight, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(headInstance, dummy.matrix);
      mesh.setColorAt(
        headInstance,
        color.setRGB(flower.colorR, flower.colorG, flower.colorB),
      );
      headInstance += 1;
    }
    mesh.count = headInstance;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.needsUpdate = true;
    finalizeSurvivalInstancedMeshColors(mesh);
  };

  stemMesh.count = flowers.length;
  leafMesh.count = leafInstance;
  stemMesh.frustumCulled = false;
  leafMesh.frustumCulled = false;
  stemMesh.instanceMatrix.needsUpdate = true;
  leafMesh.instanceMatrix.needsUpdate = true;
  writeReadableFlowerHeads(starMesh, starFlowers, 0.72, 0.76);
  writeReadableFlowerHeads(roundMesh, roundFlowers, 0.66, 0.68);
  writeReadableFlowerHeads(bellMesh, bellFlowers, 0.6, 0.68);
  writeReadableFlowerHeads(puffMesh, puffFlowers, 0.68, 0.7);
  finalizeSurvivalInstancedMeshColors(leafMesh);

  let largeFlowerCount = 0;
  for (let index = 0; index < flowers.length; index += 1) {
    const flower = flowers[index];
    if ((flower.largeBloomAmount ?? 0) > 0.12) largeFlowerCount += 1;
  }

  return {
    flowerCount: flowers.length,
    largeFlowerCount,
    leafCount: leafInstance,
  };
}
