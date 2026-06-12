import * as THREE from "three";
import type { SurvivalBotwGrassBladeInstance } from "./survivalBotwGrassConfig";
import { SURVIVAL_GRASS_BLADE_SOURCE_UP } from "./survivalBotwGrassPlacement";

export type SurvivalBotwGrassUploadScratch = {
  dummy: THREE.Object3D;
  normal: THREE.Vector3;
  normalQuaternion: THREE.Quaternion;
  yawQuaternion: THREE.Quaternion;
  color: THREE.Color;
};

export function createSurvivalBotwGrassUploadScratch(): SurvivalBotwGrassUploadScratch {
  return {
    dummy: new THREE.Object3D(),
    normal: new THREE.Vector3(),
    normalQuaternion: new THREE.Quaternion(),
    yawQuaternion: new THREE.Quaternion(),
    color: new THREE.Color(),
  };
}

export function uploadSurvivalBotwGrassBladeInstanceRange(
  mesh: THREE.InstancedMesh,
  bladeInstances: SurvivalBotwGrassBladeInstance[],
  start: number,
  end: number,
  scratch: SurvivalBotwGrassUploadScratch,
) {
  const uploadDummy = scratch.dummy;
  const uploadNormal = scratch.normal;
  const uploadNormalQuaternion = scratch.normalQuaternion;
  const uploadYawQuaternion = scratch.yawQuaternion;
  const uploadColor = scratch.color;
  for (let index = start; index < end; index += 1) {
    const instance = bladeInstances[index];
    uploadNormal.set(instance.normalX, instance.normalY, instance.normalZ).normalize();
    uploadNormalQuaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, uploadNormal);
    uploadYawQuaternion.setFromAxisAngle(SURVIVAL_GRASS_BLADE_SOURCE_UP, instance.yaw);
    uploadDummy.position.set(instance.x, instance.y, instance.z);
    uploadDummy.quaternion.copy(uploadNormalQuaternion).multiply(uploadYawQuaternion);
    uploadDummy.scale.set(instance.width, instance.height, instance.width);
    uploadDummy.updateMatrix();
    mesh.setMatrixAt(index, uploadDummy.matrix);
    mesh.setColorAt(index, uploadColor.setRGB(instance.colorR, instance.colorG, instance.colorB));
  }
}
