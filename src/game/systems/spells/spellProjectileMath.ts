import * as THREE from "three";
import type { HandType, Projectile } from "../../../store/gameStore";
import { createSeededRandom } from "../random/seededRandom";

const UNIT_Y = new THREE.Vector3(0, 1, 0);

export type AimDirectionPlayer = {
  aimDir?: [number, number, number];
  rot?: [number, number, number];
};

export type CylinderBetweenScratch = {
  segment: THREE.Vector3;
};

export const getSeededRandom = createSeededRandom;

export function createCylinderBetweenScratch(): CylinderBetweenScratch {
  return {
    segment: new THREE.Vector3(),
  };
}

const DEFAULT_CYLINDER_BETWEEN_SCRATCH = createCylinderBetweenScratch();

export function getAimDirectionFromRotationInto(rot: [number, number, number] | undefined, target: THREE.Vector3) {
  if (!rot) return target.set(0, 0, -1);

  const pitch = THREE.MathUtils.clamp(rot[0] ?? 0, -1.35, 1.35);
  const yaw = rot[1] ?? 0;
  return target.set(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  ).normalize();
}

export function getAimDirectionFromRotation(rot?: [number, number, number]) {
  return getAimDirectionFromRotationInto(rot, new THREE.Vector3());
}

export function getPlayerAimDirectionInto(player: AimDirectionPlayer | undefined, target: THREE.Vector3) {
  if (player?.aimDir) {
    return target.set(player.aimDir[0], player.aimDir[1], player.aimDir[2]).normalize();
  }

  return getAimDirectionFromRotationInto(player?.rot, target);
}

export function getPlayerAimDirection(player?: AimDirectionPlayer) {
  return getPlayerAimDirectionInto(player, new THREE.Vector3());
}

export function getProjectileHand(projectile: Projectile): HandType {
  return projectile.hand === "right" ? "right" : "left";
}

export function setCylinderBetween(
  mesh: THREE.Mesh | null,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  scratch = DEFAULT_CYLINDER_BETWEEN_SCRATCH,
) {
  if (!mesh) return;

  const segment = scratch.segment.subVectors(end, start);
  const length = segment.length();
  if (length <= 0.001) return;

  const direction = segment.normalize();
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UNIT_Y, direction);
  mesh.scale.set(radius, length, radius);
}
