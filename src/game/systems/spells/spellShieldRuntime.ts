import * as THREE from "three";
import type { PlayerState, Projectile } from "../../../store/gameStore";

const SHIELD_FORWARD_AXIS = new THREE.Vector3(0, 0, 1);
const SHIELD_FLOAT_AMPLITUDE = 0.15;
const SHIELD_FLOAT_SPEED = 2;

export type ShieldPoint = {
  x: number;
  y: number;
  z: number;
};

export type DiscShieldRotationScratch = {
  direction: THREE.Vector3;
  quaternion: THREE.Quaternion;
  euler: THREE.Euler;
};

export function createDiscShieldRotationScratch(): DiscShieldRotationScratch {
  return {
    direction: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    euler: new THREE.Euler(),
  };
}

export function createShieldPoint(point: ShieldPoint): ShieldPoint {
  return {
    x: point.x,
    y: point.y,
    z: point.z,
  };
}

export function copyShieldPoint(source: ShieldPoint, target: ShieldPoint) {
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
  return target;
}

export function getDiscShieldRotation(
  direction: ShieldPoint,
  scratch: DiscShieldRotationScratch,
) {
  scratch.direction.set(direction.x, direction.y, direction.z);
  if (scratch.direction.lengthSq() <= 0.000001) {
    scratch.direction.copy(SHIELD_FORWARD_AXIS);
  } else {
    scratch.direction.normalize();
  }

  scratch.quaternion.setFromUnitVectors(SHIELD_FORWARD_AXIS, scratch.direction);
  return scratch.euler.setFromQuaternion(scratch.quaternion);
}

export function resolveOrbShieldTarget(
  projectile: Projectile,
  isLocalProjectile: boolean,
  cameraPosition: ShieldPoint,
  players: Record<string, PlayerState>,
  fallbackY: number,
  localPlayerPosition: ShieldPoint | undefined,
  target: ShieldPoint,
) {
  target.x = projectile.pos.x;
  target.y = fallbackY;
  target.z = projectile.pos.z;

  if (isLocalProjectile) {
    if (localPlayerPosition) {
      target.x = localPlayerPosition.x;
      target.y = localPlayerPosition.y;
      target.z = localPlayerPosition.z;
    } else {
      target.x = cameraPosition.x;
      target.z = cameraPosition.z;
    }
    return target;
  }

  const remotePlayer = players[projectile.creatorId];
  if (remotePlayer) {
    target.x = remotePlayer.pos[0];
    target.y = remotePlayer.pos[1];
    target.z = remotePlayer.pos[2];
  }

  return target;
}

export function writeFloatingShieldPoint(
  base: ShieldPoint,
  elapsedSeconds: number,
  target: ShieldPoint,
) {
  target.x = base.x;
  target.y = base.y + Math.sin(elapsedSeconds * SHIELD_FLOAT_SPEED) * SHIELD_FLOAT_AMPLITUDE;
  target.z = base.z;
  return target;
}
