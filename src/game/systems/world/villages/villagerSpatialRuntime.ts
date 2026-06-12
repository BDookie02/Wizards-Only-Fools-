import * as THREE from "three";
import { useGameStore } from "../../../../store/gameStore";
import { absoluteAngleDeltaRadians } from "../../math/angleMath";
import { getPublishedLocalPlayerPosition } from "../../player/playerEventBridge";
import { type VillagerInfo } from "./villagerCharacterRuntime";

const EYE_LOCK_RADIUS = 18;
const EYE_LOCK_RADIUS_SQ = EYE_LOCK_RADIUS * EYE_LOCK_RADIUS;
export const VILLAGER_SPATIAL_CELL_SIZE = 16;
const DEV_NPC_INTERACTION_RANGE = 9.5;
const DEV_NPC_CLOSE_RANGE = 3.75;
const DEV_NPC_AIM_RADIUS = 1.75;

const devNpcRayOrigin = new THREE.Vector3();
const devNpcRayDirection = new THREE.Vector3();
const devNpcTargetCenter = new THREE.Vector3();
const devNpcTargetOffset = new THREE.Vector3();

export function getTargetedVillager(camera: THREE.Camera, villagerCells: Map<string, VillagerInfo[]>) {
  camera.getWorldPosition(devNpcRayOrigin);
  camera.getWorldDirection(devNpcRayDirection);

  let bestVillager: VillagerInfo | null = null;
  let bestScore = Infinity;
  const searchRadiusCells = Math.ceil(DEV_NPC_INTERACTION_RANGE / VILLAGER_SPATIAL_CELL_SIZE) + 1;

  visitNearbyVillagers(villagerCells, devNpcRayOrigin.x, devNpcRayOrigin.z, searchRadiusCells, (villager) => {
    devNpcTargetCenter.set(villager.x, villager.y + 1.7, villager.z);
    devNpcTargetOffset.subVectors(devNpcTargetCenter, devNpcRayOrigin);
    const distance = devNpcTargetOffset.length();
    if (distance > DEV_NPC_INTERACTION_RANGE) return;

    const forwardDistance = devNpcRayDirection.dot(devNpcTargetOffset);
    if (forwardDistance <= 0) return;

    const lateralDistance = Math.sqrt(Math.max(0, distance * distance - forwardDistance * forwardDistance));
    const closeEnough = distance <= DEV_NPC_CLOSE_RANGE;
    const aimedEnough = lateralDistance <= DEV_NPC_AIM_RADIUS + distance * 0.035;
    if (!closeEnough && !aimedEnough) return;

    const score = lateralDistance * 2.3 + distance * 0.12 + (closeEnough ? -1.1 : 0);
    if (score < bestScore) {
      bestScore = score;
      bestVillager = villager;
    }
  });

  return bestVillager;
}

export function sameSet(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

export function getVillagerCellKey(x: number, z: number) {
  return `${Math.floor(x / VILLAGER_SPATIAL_CELL_SIZE)}:${Math.floor(z / VILLAGER_SPATIAL_CELL_SIZE)}`;
}

export function visitNearbyVillagers(
  cells: Map<string, VillagerInfo[]>,
  x: number,
  z: number,
  radiusCells: number,
  visit: (villager: VillagerInfo) => void,
) {
  const centerCellX = Math.floor(x / VILLAGER_SPATIAL_CELL_SIZE);
  const centerCellZ = Math.floor(z / VILLAGER_SPATIAL_CELL_SIZE);

  for (let cellX = centerCellX - radiusCells; cellX <= centerCellX + radiusCells; cellX++) {
    for (let cellZ = centerCellZ - radiusCells; cellZ <= centerCellZ + radiusCells; cellZ++) {
      const bucket = cells.get(`${cellX}:${cellZ}`);
      if (!bucket) continue;
      for (const villager of bucket) {
        visit(villager);
      }
    }
  }
}

export function isPlayerInsideHut(playerPos: THREE.Vector3, villager: VillagerInfo) {
  const hut = villager.hut;
  const dx = playerPos.x - hut.x;
  const dz = playerPos.z - hut.z;
  const interiorHeight = hut.interiorHeight ?? 9.5;
  const verticalInside = playerPos.y > hut.y - 1.2 && playerPos.y < hut.y + interiorHeight;
  if (!verticalInside) return false;

  if (hut.isMushroom) {
    return dx * dx + dz * dz < 5.35 * 5.35;
  }

  const cos = Math.cos(-hut.rotation);
  const sin = Math.sin(-hut.rotation);
  const localX = dx * cos - dz * sin;
  const localZ = dx * sin + dz * cos;
  const halfWidth = hut.interiorWidth ? hut.interiorWidth / 2 : 7.35;
  const halfDepth = hut.interiorDepth ? hut.interiorDepth / 2 : 7.35;
  return Math.abs(localX) < halfWidth && Math.abs(localZ) < halfDepth;
}

export function angleDistance(a: number, b: number) {
  return absoluteAngleDeltaRadians(a, b);
}

export function getNearestPlayerFacingYaw(villager: VillagerInfo) {
  let bestDistanceSq = EYE_LOCK_RADIUS_SQ;
  let bestYaw: number | null = null;

  const considerPosition = (x: number, y: number, z: number) => {
    if (Math.abs(y - villager.y) > 7) return;
    const dx = x - villager.x;
    const dz = z - villager.z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq >= bestDistanceSq) return;
    bestDistanceSq = distanceSq;
    bestYaw = Math.atan2(dx, -dz);
  };

  const localPlayerPos = getPublishedLocalPlayerPosition();
  if (localPlayerPos) {
    considerPosition(localPlayerPos.x, localPlayerPos.y, localPlayerPos.z);
  }

  const remotePlayers = useGameStore.getState().players;
  for (const playerId in remotePlayers) {
    const player = remotePlayers[playerId];
    if (player.health <= 0) continue;
    considerPosition(player.pos[0], player.pos[1], player.pos[2]);
  }

  return bestYaw;
}
