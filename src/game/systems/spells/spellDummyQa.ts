import type * as THREE from "three";
import type { Projectile, SpellType } from "../../../store/gameStore";
import { getLastKnownLocalPlayerPosition } from "../player/playerEventBridge";

type VectorLike = { x: number; y: number; z: number };

export const SPELL_DUMMY_NAME_PREFIX = "spell_dummy_";
export const SPELL_DUMMY_MAX_HEALTH = 120;
export const SPELL_DUMMY_RESPAWN_MS = 1800;
export const SPELL_DUMMY_QA_FALLBACK_DELAY_MS = 340;

const SPELL_DUMMY_DAMAGE: Partial<Record<SpellType, number>> = {
  fireball: 24,
  iceshard: 34,
  arcanebeam: 34,
  ringsofpower: 22,
  lightning: 32,
  flamethrower: 6,
  kunai: 18,
  tornado: 12,
  meteorshower: 30,
  sleep: 5,
  poison: 7,
  acid: 9,
};

export const SPELL_DUMMY_QA_SEQUENCE: SpellType[] = [
  "fireball",
  "iceshard",
  "arcanebeam",
  "ringsofpower",
  "kunai",
  "flamethrower",
  "lightning",
  "poison",
  "acid",
  "sleep",
  "tornado",
  "meteorshower",
];

export const SPELL_DUMMY_QA_DIRECT_FALLBACK_SPELLS = new Set<SpellType>([
  "fireball",
  "iceshard",
  "arcanebeam",
  "ringsofpower",
  "flamethrower",
  "kunai",
  "sleep",
  "poison",
  "acid",
]);

export type SpellDummySnapshot = {
  id: string;
  label: string;
  position: { x: number; y: number; z: number };
  radius: number;
  health: number;
};

export type QaSpellDummySpawnRequest = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  preserveHealth?: boolean;
};

export type QaSpellDummyCastRequest = {
  spell: SpellType;
  targetId: string;
};

export function getCollisionObjectName(event: any) {
  return event?.rigidBodyObject?.name
    || event?.colliderObject?.name
    || event?.other?.rigidBodyObject?.name
    || event?.other?.colliderObject?.name
    || "";
}

function getSpellDummyIdFromObjectName(objectName?: string | null) {
  if (!objectName || !objectName.startsWith(SPELL_DUMMY_NAME_PREFIX)) return null;
  return objectName.slice(SPELL_DUMMY_NAME_PREFIX.length);
}

export function getSpellDummyDamage(type: SpellType) {
  return SPELL_DUMMY_DAMAGE[type] ?? 0;
}

export function dispatchQaSpellDummySpawn(detail: QaSpellDummySpawnRequest) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("wof-spawn-spell-dummies", { detail }));
}

export function dispatchQaSpellCastAtDummy(detail: QaSpellDummyCastRequest) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("wof-qa-cast-spell-at-dummy", { detail }));
}

export function publishSpellDummyHit(dummyId: string, projectile: Projectile, damage = getSpellDummyDamage(projectile.type)) {
  if (!dummyId || damage <= 0 || typeof window === "undefined") return false;

  window.dispatchEvent(new CustomEvent("wof-spell-dummy-hit", {
    detail: {
      id: dummyId,
      projectileId: projectile.id,
      spell: projectile.type,
      damage,
      at: Date.now(),
    },
  }));
  return true;
}

export function publishSpellDummyCollisionHit(event: any, projectile: Projectile, damage?: number) {
  const dummyId = getSpellDummyIdFromObjectName(getCollisionObjectName(event));
  return dummyId ? publishSpellDummyHit(dummyId, projectile, damage) : false;
}

export function publishSpellDummyHitscan(projectile: Projectile, origin: THREE.Vector3, direction: THREE.Vector3, range: number, radius = 2.5, damage?: number) {
  if (typeof window === "undefined") return false;

  const dummies = ((window as any).__wofSpellDummies ?? []) as SpellDummySnapshot[];
  const directionLenSq = direction.x * direction.x + direction.y * direction.y + direction.z * direction.z;
  if (directionLenSq <= 0 || range <= 0) return false;
  const directionScale = range / Math.sqrt(directionLenSq);
  const lineX = direction.x * directionScale;
  const lineY = direction.y * directionScale;
  const lineZ = direction.z * directionScale;
  const lineLenSq = lineX * lineX + lineY * lineY + lineZ * lineZ;
  if (lineLenSq <= 0) return false;

  let hit = false;
  for (let index = 0; index < dummies.length; index++) {
    const dummy = dummies[index];
    if (!dummy || dummy.health <= 0) continue;
    const toTargetX = dummy.position.x - origin.x;
    const toTargetY = dummy.position.y - origin.y;
    const toTargetZ = dummy.position.z - origin.z;
    const t = Math.min(1, Math.max(0, (toTargetX * lineX + toTargetY * lineY + toTargetZ * lineZ) / lineLenSq));
    const projectionX = origin.x + lineX * t;
    const projectionY = origin.y + lineY * t;
    const projectionZ = origin.z + lineZ * t;
    const dx = projectionX - dummy.position.x;
    const dy = projectionY - dummy.position.y;
    const dz = projectionZ - dummy.position.z;
    const hitRadius = radius + dummy.radius;
    if (dx * dx + dy * dy + dz * dz <= hitRadius * hitRadius) {
      hit = publishSpellDummyHit(dummy.id, projectile, damage) || hit;
    }
  }
  return hit;
}

export function publishSpellDummyAreaHit(projectile: Projectile, center: VectorLike, radius: number, damage?: number) {
  if (typeof window === "undefined") return false;

  const dummies = ((window as any).__wofSpellDummies ?? []) as SpellDummySnapshot[];
  let hit = false;
  for (let index = 0; index < dummies.length; index++) {
    const dummy = dummies[index];
    if (!dummy || dummy.health <= 0) continue;
    const dx = dummy.position.x - center.x;
    const dy = dummy.position.y - center.y;
    const dz = dummy.position.z - center.z;
    const hitRadius = radius + dummy.radius;
    if (dx * dx + dy * dy + dz * dz <= hitRadius * hitRadius) {
      hit = publishSpellDummyHit(dummy.id, projectile, damage) || hit;
    }
  }
  return hit;
}

export function getCurrentSpellDummyOrigin() {
  const pos = getLastKnownLocalPlayerPosition() || { x: 0, y: 18, z: 96 };
  return {
    x: Number(pos.x) || 0,
    y: Number(pos.y) || 18,
    z: Number(pos.z) || 96,
  };
}
