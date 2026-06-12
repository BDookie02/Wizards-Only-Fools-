import * as THREE from "three";
import {
  ensureSurvivalInstancedMeshColors,
  finalizeSurvivalInstancedMesh,
  finalizeSurvivalInstancedMeshColors,
} from "./survivalInstancing";

const SURVIVAL_FLOWER_SOURCE_UP = new THREE.Vector3(0, 1, 0);

export type SurvivalInstancedFlower = {
  x: number;
  y: number;
  z: number;
  worldX?: number;
  worldZ?: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  yaw: number;
  stemHeight: number;
  stemRadius: number;
  bloomSize: number;
  color: string;
  bloomType?: "star" | "round" | "bell" | "puff";
  bloomWidth?: number;
  bloomHeight?: number;
  centerSize?: number;
  centerColor?: string;
};

type SurvivalFlowerBloomType = NonNullable<SurvivalInstancedFlower["bloomType"]>;

export type SurvivalFlowerInstancingParams<T extends SurvivalInstancedFlower> = {
  stemMesh: THREE.InstancedMesh;
  starMesh: THREE.InstancedMesh;
  roundMesh: THREE.InstancedMesh;
  bellMesh: THREE.InstancedMesh;
  puffMesh: THREE.InstancedMesh;
  centerMesh: THREE.InstancedMesh;
  flowers: T[];
  starFlowers: T[];
  roundFlowers: T[];
  bellFlowers: T[];
  puffFlowers: T[];
  dummy: THREE.Object3D;
  normal: THREE.Vector3;
  boundsX: number;
  boundsZ: number;
  boundsRadius: number;
  boundsPadding?: number;
  baseX?: number;
  baseZ?: number;
  useWorldCoordinates?: boolean;
};

function getSurvivalFlowerWorldX(flower: SurvivalInstancedFlower, baseX: number, useWorldCoordinates: boolean) {
  return useWorldCoordinates ? flower.worldX ?? baseX + flower.x : baseX + flower.x;
}

function getSurvivalFlowerWorldZ(flower: SurvivalInstancedFlower, baseZ: number, useWorldCoordinates: boolean) {
  return useWorldCoordinates ? flower.worldZ ?? baseZ + flower.z : baseZ + flower.z;
}

export function uploadSurvivalFlowerInstances<T extends SurvivalInstancedFlower>({
  stemMesh,
  starMesh,
  roundMesh,
  bellMesh,
  puffMesh,
  centerMesh,
  flowers,
  starFlowers,
  roundFlowers,
  bellFlowers,
  puffFlowers,
  dummy,
  normal,
  boundsX,
  boundsZ,
  boundsRadius,
  boundsPadding = 18,
  baseX = 0,
  baseZ = 0,
  useWorldCoordinates = false,
}: SurvivalFlowerInstancingParams<T>) {
  const flowerColor = new THREE.Color();
  const finalizeFlowerMesh = (mesh: THREE.InstancedMesh) => {
    finalizeSurvivalInstancedMesh(mesh, boundsX, boundsZ, boundsRadius, boundsPadding);
  };
  const writeBloomInstances = (
    mesh: THREE.InstancedMesh,
    bloomFlowers: T[],
    type: SurvivalFlowerBloomType,
  ) => {
    ensureSurvivalInstancedMeshColors(mesh, bloomFlowers.length);
    for (let index = 0; index < bloomFlowers.length; index += 1) {
      const flower = bloomFlowers[index];
      normal.set(flower.normalX, flower.normalY, flower.normalZ).normalize();
      const bloomWidth = flower.bloomWidth ?? flower.bloomSize;
      const bloomHeight = flower.bloomHeight ?? flower.bloomSize;

      dummy.position
        .set(
          getSurvivalFlowerWorldX(flower, baseX, useWorldCoordinates),
          flower.y,
          getSurvivalFlowerWorldZ(flower, baseZ, useWorldCoordinates),
        )
        .addScaledVector(normal, flower.stemHeight + Math.max(0.08, bloomHeight) * 0.32 + 0.2);
      dummy.quaternion.setFromUnitVectors(SURVIVAL_FLOWER_SOURCE_UP, normal);
      dummy.rotateY(flower.yaw);
      if (type === "star") {
        dummy.scale.set(bloomWidth, 1, bloomWidth);
      } else if (type === "bell") {
        dummy.scale.set(bloomWidth * 0.74, bloomHeight, bloomWidth * 0.74);
      } else {
        dummy.scale.set(bloomWidth, bloomHeight, bloomWidth);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, flowerColor.set(flower.color));
    }
    mesh.count = bloomFlowers.length;
    mesh.instanceMatrix.needsUpdate = true;
    finalizeSurvivalInstancedMeshColors(mesh);
    finalizeFlowerMesh(mesh);
  };

  ensureSurvivalInstancedMeshColors(centerMesh, flowers.length);
  for (let index = 0; index < flowers.length; index += 1) {
    const flower = flowers[index];
    const worldX = getSurvivalFlowerWorldX(flower, baseX, useWorldCoordinates);
    const worldZ = getSurvivalFlowerWorldZ(flower, baseZ, useWorldCoordinates);
    normal.set(flower.normalX, flower.normalY, flower.normalZ).normalize();

    dummy.position
      .set(worldX, flower.y, worldZ)
      .addScaledVector(normal, flower.stemHeight * 0.5);
    dummy.quaternion.setFromUnitVectors(SURVIVAL_FLOWER_SOURCE_UP, normal);
    dummy.rotateY(flower.yaw);
    dummy.scale.set(flower.stemRadius, flower.stemHeight, flower.stemRadius);
    dummy.updateMatrix();
    stemMesh.setMatrixAt(index, dummy.matrix);

    dummy.position
      .set(worldX, flower.y, worldZ)
      .addScaledVector(normal, flower.stemHeight + Math.max(0.08, flower.bloomHeight ?? flower.bloomSize) * 0.34 + 0.2);
    dummy.quaternion.setFromUnitVectors(SURVIVAL_FLOWER_SOURCE_UP, normal);
    dummy.rotateY(flower.yaw);
    dummy.scale.setScalar(flower.centerSize ?? flower.bloomSize * 0.12);
    dummy.updateMatrix();
    centerMesh.setMatrixAt(index, dummy.matrix);
    centerMesh.setColorAt(index, flowerColor.set(flower.centerColor ?? "#facc15"));
  }

  stemMesh.count = flowers.length;
  centerMesh.count = flowers.length;
  stemMesh.instanceMatrix.needsUpdate = true;
  centerMesh.instanceMatrix.needsUpdate = true;
  writeBloomInstances(starMesh, starFlowers, "star");
  writeBloomInstances(roundMesh, roundFlowers, "round");
  writeBloomInstances(bellMesh, bellFlowers, "bell");
  writeBloomInstances(puffMesh, puffFlowers, "puff");
  finalizeSurvivalInstancedMeshColors(centerMesh);
  finalizeFlowerMesh(stemMesh);
  finalizeFlowerMesh(centerMesh);
}
