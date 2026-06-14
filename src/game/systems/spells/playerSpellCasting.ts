import * as THREE from "three";
import type {
  HandType,
  PlayerState,
  Projectile,
  SpellType,
} from "../../../store/gameStore";
import {
  DIRECT_STATUS_TARGET_RADIUS,
  DIRECT_STATUS_TARGET_RANGE,
  SPELL_SPAWN_FORWARD_OFFSET,
  SPELL_SPAWN_VERTICAL_OFFSET,
} from "../player/playerMovementConfig";

export type SpellLaunch = {
  spawnPos: { x: number; y: number; z: number };
  realDir: THREE.Vector3;
};

export type SpellLaunchScratch = SpellLaunch & {
  lateral: THREE.Vector3;
};

export type SpellAimRay = {
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  radius?: number;
};

export type RemoteSpellTarget = {
  id: string;
  distance: number;
};

export type RemoteSpellTargetScratch = {
  playerCenter: THREE.Vector3;
  rayDir: THREE.Vector3;
  toPlayer: THREE.Vector3;
  closestPoint: THREE.Vector3;
  flatDir: THREE.Vector3;
  flatToPlayer: THREE.Vector3;
};

export type PlayerSpellVectorPayload = {
  x: number;
  y: number;
  z: number;
};

export type PlayerSpellCastNetworkPayload = {
  type: SpellType;
  pos: PlayerSpellVectorPayload;
  dir: PlayerSpellVectorPayload;
  hand: HandType;
};

export type PlayerSpellBlinkBody = {
  setTranslation(position: PlayerSpellVectorPayload, wakeUp?: boolean): void;
};

export type PlayerSpellBlinkTeleportResult = {
  applied: boolean;
  offset: ReturnType<typeof getBlinkTeleportOffset> | null;
  position: PlayerSpellVectorPayload;
};

export type PlayerReleasedSpellProjectileResult = {
  networkPayload: PlayerSpellCastNetworkPayload;
  projectile: Projectile;
};

export type PlayerSpellProjectileNetworkCastResult = {
  projectile: Projectile;
};

export type PlayerReleasedSpellLaunchOptions = {
  type: SpellType;
  hand: HandType;
  camera: THREE.Camera;
  playerPosition: PlayerSpellVectorPayload;
  direction: THREE.Vector3;
  flatDirection: THREE.Vector3;
  target: SpellLaunchScratch;
  footOffset: number;
};

export type PlayerImmediateSpellProjectileCastOptions = {
  type: SpellType;
  hand: HandType;
  camera: THREE.Camera;
  direction: THREE.Vector3;
  target: SpellLaunchScratch;
  addProjectile: (projectile: Projectile) => void;
  createdAt: number;
  creatorId: string;
  emitGameNetworkEvent: (eventName: string, ...args: unknown[]) => unknown;
  id?: string;
};

export const WIDE_STATUS_AIM_RADIUS = DIRECT_STATUS_TARGET_RADIUS * 1.35;
const PROJECTILE_TOKEN_SCALE = 0x100000000;

type RandomSource = () => number;

function createRandomToken(random: RandomSource, length = 7) {
  const unit = THREE.MathUtils.clamp(random(), 0, 0.999999999999);
  return Math.floor(unit * PROJECTILE_TOKEN_SCALE).toString(36).padStart(length, "0").slice(0, length);
}

function getHandHorizontalOffset(hand: HandType) {
  return hand === "left" ? 1.15 : -1.15;
}

export function createPlayerSpellProjectileId(random: RandomSource = Math.random) {
  return `spell-${createRandomToken(random)}`;
}

export function createPlayerGrabProjectileId(
  playerId: string,
  hand: HandType,
  nowMs: number,
  random: RandomSource = Math.random,
) {
  return `${playerId}-${hand}-grab-${nowMs}-${createRandomToken(random, 5)}`;
}

export function createQaWalkPracticeProjectileId(
  spell: string,
  nowMs: number,
  random: RandomSource = Math.random,
) {
  return `qa-walk-practice-${spell}-${nowMs.toString(36)}-${createRandomToken(random, 5)}`;
}

export function createPlayerSpellProjectilePayload({
  id,
  creatorId,
  type,
  pos,
  dir,
  createdAt,
  hand,
}: {
  id: string;
  creatorId: string;
  type: SpellType;
  pos: PlayerSpellVectorPayload;
  dir: PlayerSpellVectorPayload;
  createdAt: number;
  hand: HandType;
}): Projectile {
  return {
    id,
    creatorId,
    type,
    pos,
    dir,
    createdAt,
    hand,
  };
}

export function createPlayerSpellCastNetworkPayload({
  type,
  pos,
  dir,
  hand,
}: PlayerSpellCastNetworkPayload): PlayerSpellCastNetworkPayload {
  return {
    type,
    pos,
    dir,
    hand,
  };
}

export function applyPlayerReleasedSpellProjectile({
  addProjectile,
  createdAt,
  creatorId,
  dir,
  emitGameNetworkEvent,
  hand,
  id,
  pos,
  type,
}: {
  addProjectile: (projectile: Projectile) => void;
  createdAt: number;
  creatorId: string;
  dir: PlayerSpellVectorPayload;
  emitGameNetworkEvent: (eventName: string, ...args: unknown[]) => unknown;
  hand: HandType;
  id?: string;
  pos: PlayerSpellVectorPayload;
  type: SpellType;
}): PlayerReleasedSpellProjectileResult {
  const networkPayload = createPlayerSpellCastNetworkPayload({
    type,
    pos,
    dir,
    hand,
  });
  const projectile = createPlayerSpellProjectilePayload({
    id: id ?? createPlayerSpellProjectileId(),
    creatorId,
    type,
    pos,
    dir,
    createdAt,
    hand,
  });
  emitGameNetworkEvent("castSpell", networkPayload);
  addProjectile(projectile);
  return { networkPayload, projectile };
}

export function applyPlayerSpellProjectileNetworkCast({
  addProjectile,
  createdAt,
  creatorId,
  dir,
  emitGameNetworkEvent,
  hand,
  id,
  pos,
  type,
}: {
  addProjectile: (projectile: Projectile) => void;
  createdAt: number;
  creatorId: string;
  dir: PlayerSpellVectorPayload;
  emitGameNetworkEvent: (eventName: string, ...args: unknown[]) => unknown;
  hand: HandType;
  id?: string;
  pos: PlayerSpellVectorPayload;
  type: SpellType;
}): PlayerSpellProjectileNetworkCastResult {
  const projectile = createPlayerSpellProjectilePayload({
    id: id ?? createPlayerSpellProjectileId(),
    creatorId,
    type,
    pos,
    dir,
    createdAt,
    hand,
  });
  emitGameNetworkEvent("castSpell", projectile);
  addProjectile(projectile);
  return { projectile };
}

export function getBlinkTeleportOffset(
  random: RandomSource = Math.random,
  minDistance = 20,
  maxDistance = 60,
) {
  const angle = random() * Math.PI * 2;
  const distance = minDistance + random() * Math.max(0, maxDistance - minDistance);
  return {
    angle,
    distance,
    x: Math.cos(angle) * distance,
    z: Math.sin(angle) * distance,
  };
}

export function applyPlayerBlinkTeleport({
  body,
  position,
  random,
  upwardOffset = 10,
}: {
  body: PlayerSpellBlinkBody | null | undefined;
  position: PlayerSpellVectorPayload;
  random?: RandomSource;
  upwardOffset?: number;
}): PlayerSpellBlinkTeleportResult {
  const offset = getBlinkTeleportOffset(random);
  const teleportPosition = {
    x: position.x + offset.x,
    y: position.y + upwardOffset,
    z: position.z + offset.z,
  };
  if (!body) {
    return { applied: false, offset, position: teleportPosition };
  }
  body.setTranslation(teleportPosition, true);
  return { applied: true, offset, position: teleportPosition };
}

export function applyFlamethrowerSpreadInto(
  dir: THREE.Vector3,
  random: RandomSource = Math.random,
  spread = 0.15,
) {
  dir.x += (random() - 0.5) * spread;
  dir.y += (random() - 0.5) * spread;
  dir.z += (random() - 0.5) * spread;
  return dir.normalize();
}

export function createPlayerSpellLaunchScratch(): SpellLaunchScratch {
  return {
    spawnPos: { x: 0, y: 0, z: 0 },
    realDir: new THREE.Vector3(),
    lateral: new THREE.Vector3(),
  };
}

export function createRemoteSpellTargetScratch(): RemoteSpellTargetScratch {
  return {
    playerCenter: new THREE.Vector3(),
    rayDir: new THREE.Vector3(),
    toPlayer: new THREE.Vector3(),
    closestPoint: new THREE.Vector3(),
    flatDir: new THREE.Vector3(),
    flatToPlayer: new THREE.Vector3(),
  };
}

export function getPlayerSpellLaunchInto(
  hand: HandType,
  camera: THREE.Camera,
  dir: THREE.Vector3,
  target: SpellLaunchScratch,
  aimFromCrosshair = true,
  lateralOverride?: THREE.Vector3,
): SpellLaunch {
  const lateral = target.lateral;
  if (lateralOverride && lateralOverride.lengthSq() > 0.0001) {
    lateral.copy(lateralOverride).normalize();
  } else {
    lateral.crossVectors(camera.up, dir).normalize();
  }
  const horizontalOffset = getHandHorizontalOffset(hand);
  const camPos = camera.position;
  const spawnPos = target.spawnPos;
  spawnPos.x = camPos.x + dir.x * SPELL_SPAWN_FORWARD_OFFSET + lateral.x * horizontalOffset;
  spawnPos.y = camPos.y + SPELL_SPAWN_VERTICAL_OFFSET + dir.y * SPELL_SPAWN_FORWARD_OFFSET;
  spawnPos.z = camPos.z + dir.z * SPELL_SPAWN_FORWARD_OFFSET + lateral.z * horizontalOffset;
  const realDir = aimFromCrosshair
    ? target.realDir.set(
      camPos.x + dir.x * 50 - spawnPos.x,
      camPos.y + dir.y * 50 - spawnPos.y,
      camPos.z + dir.z * 50 - spawnPos.z,
    ).normalize()
    : target.realDir.copy(dir);

  return target;
}

export function getPlayerSpellLaunch(
  hand: HandType,
  camera: THREE.Camera,
  dir: THREE.Vector3,
  aimFromCrosshair = true,
  lateralOverride?: THREE.Vector3,
): SpellLaunch {
  return getPlayerSpellLaunchInto(
    hand,
    camera,
    dir,
    createPlayerSpellLaunchScratch(),
    aimFromCrosshair,
    lateralOverride,
  );
}

export function getPlayerReleasedSpellLaunchInto({
  type,
  hand,
  camera,
  playerPosition,
  direction,
  flatDirection,
  target,
  footOffset,
}: PlayerReleasedSpellLaunchOptions): SpellLaunch {
  camera.getWorldDirection(direction);
  const launch = getPlayerSpellLaunchInto(hand, camera, direction, target);

  if (type !== "tornado" && type !== "meteorshower") {
    return launch;
  }

  const summonDirection = flatDirection.set(direction.x, 0, direction.z);
  if (summonDirection.lengthSq() < 0.001) {
    summonDirection.set(0, 0, -1);
  }
  summonDirection.normalize();

  const summonDistance = type === "meteorshower" ? 32 : 22;
  launch.spawnPos.x = playerPosition.x + summonDirection.x * summonDistance;
  launch.spawnPos.y = playerPosition.y - footOffset + 0.2;
  launch.spawnPos.z = playerPosition.z + summonDirection.z * summonDistance;
  launch.realDir.copy(summonDirection);
  return launch;
}

export function applyPlayerImmediateSpellProjectileCast({
  type,
  hand,
  camera,
  direction,
  target,
  addProjectile,
  createdAt,
  creatorId,
  emitGameNetworkEvent,
  id,
}: PlayerImmediateSpellProjectileCastOptions): PlayerSpellProjectileNetworkCastResult {
  camera.getWorldDirection(direction);
  const { spawnPos, realDir } = getPlayerSpellLaunchInto(hand, camera, direction, target);
  return applyPlayerSpellProjectileNetworkCast({
    addProjectile,
    createdAt,
    creatorId,
    dir: { x: realDir.x, y: realDir.y, z: realDir.z },
    emitGameNetworkEvent,
    hand,
    id,
    pos: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
    type,
  });
}

export function findAimedRemotePlayer(
  players: Record<string, PlayerState>,
  rays: SpellAimRay[],
): RemoteSpellTarget | null {
  return findAimedRemotePlayerInto(players, rays, defaultRemoteSpellTargetScratch);
}

export function findAimedRemotePlayerInto(
  players: Record<string, PlayerState>,
  rays: SpellAimRay[],
  scratch: RemoteSpellTargetScratch,
): RemoteSpellTarget | null {
  let bestTargetId = "";
  let bestTargetDistance = Number.POSITIVE_INFINITY;
  const { playerCenter, rayDir, toPlayer, closestPoint } = scratch;

  for (const playerId in players) {
    const player = players[playerId];
    if (!player || player.health <= 0) continue;

    playerCenter.set(player.pos[0], player.pos[1] + 0.85, player.pos[2]);
    for (let rayIndex = 0; rayIndex < rays.length; rayIndex++) {
      const ray = rays[rayIndex];
      rayDir.copy(ray.dir).normalize();
      toPlayer.copy(playerCenter).sub(ray.origin);
      const projectedDistance = toPlayer.dot(rayDir);
      if (projectedDistance <= 1.25 || projectedDistance > DIRECT_STATUS_TARGET_RANGE) continue;

      closestPoint.copy(ray.origin).addScaledVector(rayDir, projectedDistance);
      const allowedMiss = ray.radius ?? DIRECT_STATUS_TARGET_RADIUS;
      if (playerCenter.distanceToSquared(closestPoint) > allowedMiss * allowedMiss) continue;

      if (projectedDistance < bestTargetDistance) {
        bestTargetId = playerId;
        bestTargetDistance = projectedDistance;
      }
    }
  }

  return bestTargetId ? { id: bestTargetId, distance: bestTargetDistance } : null;
}

export function findRemotePlayerInAimCone(
  players: Record<string, PlayerState>,
  origin: THREE.Vector3,
  dir: THREE.Vector3,
): RemoteSpellTarget | null {
  return findRemotePlayerInAimConeInto(players, origin, dir, defaultRemoteSpellTargetScratch);
}

export function findRemotePlayerInAimConeInto(
  players: Record<string, PlayerState>,
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  scratch: RemoteSpellTargetScratch,
): RemoteSpellTarget | null {
  const { playerCenter, toPlayer, flatDir, flatToPlayer } = scratch;
  flatDir.set(dir.x, 0, dir.z);
  if (flatDir.lengthSq() < 0.001) return null;
  flatDir.normalize();

  let bestTargetId = "";
  let bestTargetScore = Number.POSITIVE_INFINITY;
  const minDistanceSq = 1.25 * 1.25;
  const maxDistanceSq = DIRECT_STATUS_TARGET_RANGE * DIRECT_STATUS_TARGET_RANGE;
  for (const playerId in players) {
    const player = players[playerId];
    if (!player || player.health <= 0) continue;

    playerCenter.set(player.pos[0], player.pos[1] + 0.85, player.pos[2]);
    toPlayer.copy(playerCenter).sub(origin);
    flatToPlayer.set(toPlayer.x, 0, toPlayer.z);
    const flatDistanceSq = flatToPlayer.lengthSq();
    if (flatDistanceSq <= minDistanceSq || flatDistanceSq > maxDistanceSq) continue;

    const flatDistance = Math.sqrt(flatDistanceSq);
    flatToPlayer.multiplyScalar(1 / flatDistance);
    const alignment = flatToPlayer.dot(flatDir);
    if (alignment < 0.9) continue;

    const forwardDistance = flatDistance * alignment;
    const lateralMissSq = Math.max(0, flatDistanceSq - forwardDistance * forwardDistance);
    const verticalMiss = Math.abs(toPlayer.y);
    const allowedLateralMiss = THREE.MathUtils.clamp(2.4 + forwardDistance * 0.08, 2.4, 5.6);
    if (lateralMissSq > allowedLateralMiss * allowedLateralMiss || verticalMiss > 9) continue;

    const lateralMiss = Math.sqrt(lateralMissSq);
    const score = forwardDistance + lateralMiss * 2.5 + verticalMiss * 0.5;
    if (score < bestTargetScore) {
      bestTargetId = playerId;
      bestTargetScore = score;
    }
  }

  return bestTargetId ? { id: bestTargetId, distance: bestTargetScore } : null;
}

const defaultRemoteSpellTargetScratch = createRemoteSpellTargetScratch();
