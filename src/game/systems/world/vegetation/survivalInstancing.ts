import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";

export function finalizeSurvivalInstancedMesh(
  mesh: THREE.InstancedMesh,
  centerX = 0,
  centerZ = 0,
  radius = SURVIVAL_BLOCK_SIZE,
  centerY = 48,
) {
  mesh.frustumCulled = true;
  mesh.instanceMatrix.needsUpdate = true;
  const sphere = mesh.boundingSphere ?? new THREE.Sphere();
  sphere.center.set(centerX, centerY, centerZ);
  sphere.radius = Math.max(radius, 1);
  mesh.boundingSphere = sphere;
}

export function ensureSurvivalInstancedMeshColors(mesh: THREE.InstancedMesh, count: number) {
  const safeCount = Math.max(1, count);
  if (!mesh.instanceColor || mesh.instanceColor.count < safeCount) {
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(safeCount * 3), 3);
  }
}

export function finalizeSurvivalInstancedMeshColors(mesh: THREE.InstancedMesh) {
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  if (Array.isArray(mesh.material)) {
    for (let index = 0; index < mesh.material.length; index += 1) {
      mesh.material[index].needsUpdate = true;
    }
  } else {
    mesh.material.needsUpdate = true;
  }
}

export function markSurvivalInstancedAttributeRange(
  attribute: THREE.BufferAttribute | THREE.InstancedBufferAttribute,
  offset: number,
  count: number,
) {
  const rangedAttribute = attribute as THREE.BufferAttribute & {
    addUpdateRange?: (start: number, count: number) => void;
    updateRange?: { offset: number; count: number };
  };
  const safeOffset = Math.max(0, Math.floor(offset));
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount <= 0) return;

  if (typeof rangedAttribute.addUpdateRange === "function") {
    rangedAttribute.addUpdateRange(safeOffset, safeCount);
  } else if (rangedAttribute.updateRange) {
    rangedAttribute.updateRange.offset = safeOffset;
    rangedAttribute.updateRange.count = safeCount;
  }
  rangedAttribute.needsUpdate = true;
}

export function markSurvivalInstancedMeshRange(mesh: THREE.InstancedMesh, startIndex: number, count: number) {
  if (count <= 0) return;
  markSurvivalInstancedAttributeRange(mesh.instanceMatrix, startIndex * 16, count * 16);
  if (mesh.instanceColor) {
    markSurvivalInstancedAttributeRange(mesh.instanceColor, startIndex * 3, count * 3);
  }
}
