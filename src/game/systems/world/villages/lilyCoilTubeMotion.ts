import * as THREE from "three";
import { LILY_COIL_QUEST_CHUNK, SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";

export const LILY_COIL_TUBE_PATH_RADIUS = 238;
export const LILY_COIL_TUBE_START_Y = 108;
export const LILY_COIL_TUBE_RISE = 520;
export const LILY_COIL_TUBE_TURNS = 3.15;
export const LILY_COIL_TUBE_START_ANGLE = -Math.PI / 2;
export const LILY_COIL_TUBE_RADIUS = 76;
export const LILY_COIL_TUBE_ANGLE_RATE = Math.PI * 2 * LILY_COIL_TUBE_TURNS;
const LILY_COIL_TUBE_HORIZONTAL_PATH = LILY_COIL_TUBE_PATH_RADIUS * LILY_COIL_TUBE_ANGLE_RATE;
export const LILY_COIL_TUBE_PATH_LENGTH = Math.sqrt(
  LILY_COIL_TUBE_HORIZONTAL_PATH * LILY_COIL_TUBE_HORIZONTAL_PATH +
  LILY_COIL_TUBE_RISE * LILY_COIL_TUBE_RISE,
);
export const LILY_COIL_TUBE_JUMP_FORCE = 18;
export const LILY_COIL_TUBE_JUMP_GRAVITY = 38;
export const LILY_COIL_TUBE_MAX_JUMP_OFFSET = 18;

export type LilyCoilTubeFrame = {
  center: THREE.Vector3;
  tangent: THREE.Vector3;
  up: THREE.Vector3;
  side: THREE.Vector3;
};

export type LilyCoilTubeNearestScratch = {
  frame: LilyCoilTubeFrame;
  offset: THREE.Vector3;
  result: {
    t: number;
    surfaceAngle: number;
  };
};

function isSurvivalGameMode(gameMode: string) {
  return gameMode === "solo-survival" || gameMode === "multiplayer-survival";
}

export function getLilyCoilTubePlayerRadius(playerFootOffset: number) {
  return LILY_COIL_TUBE_RADIUS - playerFootOffset;
}

export function createLilyCoilTubeFrame(): LilyCoilTubeFrame {
  return {
    center: new THREE.Vector3(),
    tangent: new THREE.Vector3(),
    up: new THREE.Vector3(),
    side: new THREE.Vector3(),
  };
}

export function createLilyCoilTubeNearestScratch(): LilyCoilTubeNearestScratch {
  return {
    frame: createLilyCoilTubeFrame(),
    offset: new THREE.Vector3(),
    result: { t: 0, surfaceAngle: Math.PI },
  };
}

export function getLilyCoilTubeFrameInto(t: number, target: LilyCoilTubeFrame) {
  const clampedT = THREE.MathUtils.clamp(t, 0, 1);
  const angle = LILY_COIL_TUBE_START_ANGLE + LILY_COIL_TUBE_ANGLE_RATE * clampedT;
  target.center.set(
    LILY_COIL_QUEST_CHUNK.cx * SURVIVAL_BLOCK_SIZE + Math.cos(angle) * LILY_COIL_TUBE_PATH_RADIUS,
    LILY_COIL_TUBE_START_Y + LILY_COIL_TUBE_RISE * clampedT,
    LILY_COIL_QUEST_CHUNK.cz * SURVIVAL_BLOCK_SIZE + Math.sin(angle) * LILY_COIL_TUBE_PATH_RADIUS,
  );
  target.tangent.set(
    -Math.sin(angle) * LILY_COIL_TUBE_PATH_RADIUS * LILY_COIL_TUBE_ANGLE_RATE,
    LILY_COIL_TUBE_RISE,
    Math.cos(angle) * LILY_COIL_TUBE_PATH_RADIUS * LILY_COIL_TUBE_ANGLE_RATE,
  ).normalize();
  target.up.set(0, 1, 0).addScaledVector(target.tangent, -target.tangent.y);
  if (target.up.lengthSq() < 0.0001) target.up.set(1, 0, 0);
  target.up.normalize();
  target.side.crossVectors(target.tangent, target.up).normalize();
  return target;
}

export function getLilyCoilTubeFrame(t: number) {
  return getLilyCoilTubeFrameInto(t, createLilyCoilTubeFrame());
}

export function getNearestLilyCoilTubeState(position: THREE.Vector3, scratch = createLilyCoilTubeNearestScratch()) {
  let bestT = 0;
  let bestDistanceSq = Infinity;
  const samples = 180;
  const centerX = LILY_COIL_QUEST_CHUNK.cx * SURVIVAL_BLOCK_SIZE;
  const centerZ = LILY_COIL_QUEST_CHUNK.cz * SURVIVAL_BLOCK_SIZE;
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    const angle = LILY_COIL_TUBE_START_ANGLE + LILY_COIL_TUBE_ANGLE_RATE * t;
    const sampleX = centerX + Math.cos(angle) * LILY_COIL_TUBE_PATH_RADIUS;
    const sampleY = LILY_COIL_TUBE_START_Y + LILY_COIL_TUBE_RISE * t;
    const sampleZ = centerZ + Math.sin(angle) * LILY_COIL_TUBE_PATH_RADIUS;
    const dx = sampleX - position.x;
    const dy = sampleY - position.y;
    const dz = sampleZ - position.z;
    const distanceSq = dx * dx + dy * dy + dz * dz;
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestT = t;
    }
  }

  const frame = getLilyCoilTubeFrameInto(bestT, scratch.frame);
  const offset = scratch.offset.copy(position).sub(frame.center);
  const upAmount = offset.dot(frame.up);
  const sideAmount = offset.dot(frame.side);
  const surfaceRadiusSq = upAmount * upAmount + sideAmount * sideAmount;
  const surfaceAngle = surfaceRadiusSq > 0.0001
    ? Math.atan2(sideAmount, upAmount)
    : Math.PI;
  scratch.result.t = bestT;
  scratch.result.surfaceAngle = surfaceAngle;
  return scratch.result;
}

export function isInLilyCoilTubeChunk(position: THREE.Vector3, gameMode: string) {
  if (!isSurvivalGameMode(gameMode)) return false;
  const centerX = LILY_COIL_QUEST_CHUNK.cx * SURVIVAL_BLOCK_SIZE;
  const centerZ = LILY_COIL_QUEST_CHUNK.cz * SURVIVAL_BLOCK_SIZE;
  const dx = position.x - centerX;
  const dz = position.z - centerZ;
  const horizontalLimit = LILY_COIL_TUBE_PATH_RADIUS + LILY_COIL_TUBE_RADIUS + 145;
  return dx * dx + dz * dz < horizontalLimit * horizontalLimit &&
    position.y > -80 &&
    position.y < LILY_COIL_TUBE_START_Y + LILY_COIL_TUBE_RISE + LILY_COIL_TUBE_RADIUS + 120;
}
