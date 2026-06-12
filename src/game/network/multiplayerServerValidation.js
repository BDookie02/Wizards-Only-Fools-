export const MULTIPLAYER_MAX_ACTION_ORIGIN_DISTANCE = 160;
export const MULTIPLAYER_MAX_DAMAGE_TARGET_DISTANCE = 180;
export const MULTIPLAYER_MAX_STATUS_TARGET_DISTANCE = 96;

function getFiniteCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getPlayerPoseCoordinate(player, index) {
  if (!player || !Array.isArray(player.pos)) return null;
  return getFiniteCoordinate(player.pos[index]);
}

export function getServerValidationNowMs() {
  return Date.now();
}

export function markServerPlayerPose(player, now = getServerValidationNowMs()) {
  if (!player) return player;
  player.lastPoseAt = now;
  return player;
}

export function isServerActionOriginNearPlayer(
  player,
  origin,
  maxDistance = MULTIPLAYER_MAX_ACTION_ORIGIN_DISTANCE,
) {
  if (!origin || !player?.lastPoseAt) return true;
  const playerX = getPlayerPoseCoordinate(player, 0);
  const playerY = getPlayerPoseCoordinate(player, 1);
  const playerZ = getPlayerPoseCoordinate(player, 2);
  const originX = getFiniteCoordinate(origin.x);
  const originY = getFiniteCoordinate(origin.y);
  const originZ = getFiniteCoordinate(origin.z);
  if (
    playerX === null ||
    playerY === null ||
    playerZ === null ||
    originX === null ||
    originY === null ||
    originZ === null
  ) {
    return false;
  }

  const maxDistanceNumber = Math.max(0, Number(maxDistance) || 0);
  const maxDistanceSq = maxDistanceNumber * maxDistanceNumber;
  const deltaX = originX - playerX;
  const deltaY = originY - playerY;
  const deltaZ = originZ - playerZ;
  return deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ <= maxDistanceSq;
}

export function isServerDamageTargetAllowed(
  attacker,
  target,
  attackerId = "",
  targetId = "",
  maxDistance = MULTIPLAYER_MAX_DAMAGE_TARGET_DISTANCE,
) {
  if (!attacker || !target) return false;
  if (attackerId && targetId && attackerId === targetId) return true;
  const attackerX = getPlayerPoseCoordinate(attacker, 0);
  const attackerY = getPlayerPoseCoordinate(attacker, 1);
  const attackerZ = getPlayerPoseCoordinate(attacker, 2);
  const targetX = getPlayerPoseCoordinate(target, 0);
  const targetY = getPlayerPoseCoordinate(target, 1);
  const targetZ = getPlayerPoseCoordinate(target, 2);
  if (
    attackerX === null ||
    attackerY === null ||
    attackerZ === null ||
    targetX === null ||
    targetY === null ||
    targetZ === null
  ) {
    return false;
  }
  const maxDistanceNumber = Math.max(0, Number(maxDistance) || 0);
  const maxDistanceSq = maxDistanceNumber * maxDistanceNumber;
  const deltaX = attackerX - targetX;
  const deltaY = attackerY - targetY;
  const deltaZ = attackerZ - targetZ;
  return deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ <= maxDistanceSq;
}
