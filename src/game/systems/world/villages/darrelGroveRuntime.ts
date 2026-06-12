import * as THREE from "three";

export type DarrelBranchTransform = {
  length: number;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
};

const DARREL_BRANCH_UP = new THREE.Vector3(0, 1, 0);

export function getDarrelQuestGateNowMs() {
  return Date.now();
}

export function getDarrelBranchTransform(
  start: [number, number, number],
  end: [number, number, number],
): DarrelBranchTransform {
  const startVec = new THREE.Vector3(...start);
  const endVec = new THREE.Vector3(...end);
  const direction = new THREE.Vector3().subVectors(endVec, startVec);
  const length = direction.length();
  const midpoint = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
  const normalizedDirection = length > 0.0001 ? direction.clone().normalize() : DARREL_BRANCH_UP;
  const quaternion = new THREE.Quaternion().setFromUnitVectors(DARREL_BRANCH_UP, normalizedDirection);
  return { length, midpoint, quaternion };
}
