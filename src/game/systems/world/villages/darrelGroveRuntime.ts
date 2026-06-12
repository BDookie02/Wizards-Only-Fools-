import * as THREE from "three";

export type DarrelBranchTransform = {
  length: number;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
};

export type DarrelHillStairRamp = {
  angle: number;
  centerY: number;
  centerZ: number;
  halfThickness: number;
  length: number;
};

export type DarrelHillStep = {
  y: number;
  z: number;
  width: number;
  depth: number;
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

export function getDarrelHillStairRamp(
  startZ: number,
  endZ: number,
  startSurfaceY: number,
  endSurfaceY: number,
  halfThickness: number,
): DarrelHillStairRamp {
  const run = endZ - startZ;
  const rise = endSurfaceY - startSurfaceY;
  const angle = -Math.atan2(rise, run);
  return {
    angle,
    centerY: (startSurfaceY + endSurfaceY) / 2 - Math.cos(angle) * halfThickness,
    centerZ: (startZ + endZ) / 2,
    halfThickness,
    length: Math.sqrt(run * run + rise * rise),
  };
}

export function getDarrelHillSteps(entrySurfaceOffset: number, stepCount: number) {
  const safeStepCount = Math.max(1, Math.floor(stepCount));
  const steps = new Array<DarrelHillStep>(safeStepCount);
  for (let index = 0; index < safeStepCount; index += 1) {
    const progress = (index + 1) / safeStepCount;
    steps[index] = {
      y: entrySurfaceOffset * progress,
      z: -116 + index * 4.8,
      width: 34 - Math.min(index, 6) * 1.2,
      depth: 9,
    };
  }
  return steps;
}
