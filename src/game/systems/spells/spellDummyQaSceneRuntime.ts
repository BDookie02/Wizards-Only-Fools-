import type { Projectile, SpellType } from "../../../store/gameStore";
import {
  SPELL_DUMMY_MAX_HEALTH,
  SPELL_DUMMY_QA_DIRECT_FALLBACK_SPELLS,
  SPELL_DUMMY_RESPAWN_MS,
  getSpellDummyDamage,
  type SpellDummySnapshot,
} from "./spellDummyQa";

type VectorLike = { x: number; y: number; z: number };
type RandomSource = () => number;

export type SpellTestDummy = {
  id: string;
  label: string;
  position: { x: number; y: number; z: number };
  health: number;
  lastHitSpell?: SpellType;
  lastHitAt?: number;
  downUntil?: number;
};

export type ParsedSpellDummyHit = {
  id: string;
  projectileId: string;
  spell: SpellType;
  damage: number;
  at: number;
};

export type QaSpellDummyProjectilePlan = {
  projectile: Projectile;
  targetId: string;
  fallbackHit: boolean;
};

const SPELL_DUMMY_ROWS = [
  { id: "front", label: "Dummy A", distance: 14, side: 0 },
  { id: "left", label: "Dummy B", distance: 20, side: -7.5 },
  { id: "right", label: "Dummy C", distance: 20, side: 7.5 },
  { id: "back", label: "Dummy D", distance: 27, side: 0 },
] as const;

const QA_PROJECTILE_TOKEN_SCALE = 0x1000000;

export function getSpellDummyQaNowMs() {
  return Date.now();
}

function createQaSpellDummyProjectileId(spell: SpellType, nowMs: number, random: RandomSource = Math.random) {
  const unit = Math.min(0.999999999999, Math.max(0, random()));
  const token = Math.floor(unit * QA_PROJECTILE_TOKEN_SCALE).toString(36).padStart(4, "0").slice(0, 4);
  return `qa-dummy-${spell}-${nowMs.toString(36)}-${token}`;
}

export function makeSpellTestDummies(origin: { x: number; y: number; z: number }, yaw: number): SpellTestDummy[] {
  const forwardX = Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw);
  const rightZ = Math.sin(yaw);
  const baseY = origin.y + 2.05;
  const dummies: SpellTestDummy[] = new Array(SPELL_DUMMY_ROWS.length);

  for (let index = 0; index < SPELL_DUMMY_ROWS.length; index++) {
    const row = SPELL_DUMMY_ROWS[index];
    dummies[index] = {
      id: row.id,
      label: row.label,
      position: {
        x: origin.x + forwardX * row.distance + rightX * row.side,
        y: baseY,
        z: origin.z + forwardZ * row.distance + rightZ * row.side,
      },
      health: SPELL_DUMMY_MAX_HEALTH,
    };
  }

  return dummies;
}

export function preserveSpellDummyHealth(next: SpellTestDummy[], previous: SpellTestDummy[]) {
  if (next.length === 0 || previous.length === 0) return next;

  const preserved: SpellTestDummy[] = new Array(next.length);
  for (let nextIndex = 0; nextIndex < next.length; nextIndex++) {
    const dummy = next[nextIndex];
    let matched: SpellTestDummy | null = null;
    for (let previousIndex = 0; previousIndex < previous.length; previousIndex++) {
      const previousDummy = previous[previousIndex];
      if (previousDummy.id === dummy.id) {
        matched = previousDummy;
        break;
      }
    }
    preserved[nextIndex] = matched
      ? { ...dummy, health: matched.health, downUntil: matched.downUntil }
      : dummy;
  }
  return preserved;
}

export function parseSpellDummyHitDetail(detail: Record<string, unknown>, fallbackNowMs: number): ParsedSpellDummyHit | null {
  const id = String(detail.id ?? "");
  const damage = Math.max(0, Number(detail.damage) || 0);
  if (!id || damage <= 0) return null;

  const atCandidate = Number(detail.at);
  return {
    id,
    projectileId: typeof detail.projectileId === "string" ? detail.projectileId : "",
    spell: String(detail.spell || "fireball") as SpellType,
    damage,
    at: Number.isFinite(atCandidate) ? atCandidate : fallbackNowMs,
  };
}

export function reserveDirectFallbackSpellDummyHit(
  acceptedProjectileIds: Set<string>,
  hit: ParsedSpellDummyHit,
  maxEntries = 120,
) {
  if (!hit.projectileId || !SPELL_DUMMY_QA_DIRECT_FALLBACK_SPELLS.has(hit.spell)) return true;

  const hitKey = `${hit.id}:${hit.projectileId}`;
  if (acceptedProjectileIds.has(hitKey)) return false;
  if (acceptedProjectileIds.size >= maxEntries) acceptedProjectileIds.clear();
  acceptedProjectileIds.add(hitKey);
  return true;
}

function copySpellDummyPrefix(dummies: SpellTestDummy[], endIndex: number) {
  const next = new Array<SpellTestDummy>(endIndex);
  for (let index = 0; index < endIndex; index += 1) {
    next[index] = dummies[index];
  }
  return next;
}

export function applySpellDummyHit(dummies: SpellTestDummy[], hit: ParsedSpellDummyHit) {
  let next: SpellTestDummy[] | null = null;
  for (let index = 0; index < dummies.length; index++) {
    const dummy = dummies[index];
    if (dummy.id !== hit.id) {
      if (next) next.push(dummy);
      continue;
    }

    const nextHealth = Math.max(0, dummy.health - hit.damage);
    const updated = {
      ...dummy,
      health: nextHealth,
      lastHitSpell: hit.spell,
      lastHitAt: hit.at,
      downUntil: nextHealth <= 0 ? hit.at + SPELL_DUMMY_RESPAWN_MS : undefined,
    };
    if (!next) next = copySpellDummyPrefix(dummies, index);
    next.push(updated);
  }
  return next ?? dummies;
}

export function getNextSpellDummyRespawnAt(dummies: SpellTestDummy[]) {
  let nextRespawnAt: number | null = null;
  for (let index = 0; index < dummies.length; index++) {
    const downUntil = dummies[index].downUntil;
    if (!downUntil) continue;
    nextRespawnAt = nextRespawnAt === null ? downUntil : Math.min(nextRespawnAt, downUntil);
  }
  return nextRespawnAt;
}

export function respawnExpiredSpellDummies(dummies: SpellTestDummy[], nowMs: number) {
  let next: SpellTestDummy[] | null = null;
  for (let index = 0; index < dummies.length; index++) {
    const dummy = dummies[index];
    if (!dummy.downUntil || dummy.downUntil > nowMs) {
      if (next) next.push(dummy);
      continue;
    }

    if (!next) next = copySpellDummyPrefix(dummies, index);
    next.push({ ...dummy, health: SPELL_DUMMY_MAX_HEALTH, downUntil: undefined });
  }
  return next ?? dummies;
}

function findQaSpellDummyTarget(dummies: SpellTestDummy[], targetId: string) {
  let fallback: SpellTestDummy | null = null;
  for (let index = 0; index < dummies.length; index++) {
    const dummy = dummies[index];
    if (dummy.health <= 0) continue;
    if (!fallback) fallback = dummy;
    if (dummy.id === targetId) return dummy;
  }
  return fallback ?? dummies[0] ?? null;
}

export function makeQaSpellDummyProjectilePlan(options: {
  creatorId: string;
  dummies: SpellTestDummy[];
  nowMs: number;
  origin: VectorLike;
  random?: RandomSource;
  spell: SpellType;
  targetId?: string;
}): QaSpellDummyProjectilePlan | null {
  const { creatorId, dummies, nowMs, origin, random, spell } = options;
  if (getSpellDummyDamage(spell) <= 0) return null;

  const target = findQaSpellDummyTarget(dummies, options.targetId ?? "front");
  if (!target) return null;

  const startX = origin.x;
  const startY = origin.y + 1.45;
  const startZ = origin.z;
  const dirX = target.position.x - startX;
  const dirY = target.position.y - startY;
  const dirZ = target.position.z - startZ;
  const lenSq = dirX * dirX + dirY * dirY + dirZ * dirZ;
  const invLen = lenSq < 0.001 ? 0 : 1 / Math.sqrt(lenSq);
  const normalizedDir = invLen > 0
    ? { x: dirX * invLen, y: dirY * invLen, z: dirZ * invLen }
    : { x: 0, y: 0, z: -1 };
  const castAtTarget = spell === "lightning" || spell === "tornado" || spell === "meteorshower";
  const pos = castAtTarget
    ? { x: target.position.x, y: target.position.y - 1.5, z: target.position.z }
    : {
      x: startX + normalizedDir.x * 1.8,
      y: startY + normalizedDir.y * 1.8,
      z: startZ + normalizedDir.z * 1.8,
    };

  return {
    projectile: {
      id: createQaSpellDummyProjectileId(spell, nowMs, random),
      creatorId,
      type: spell,
      pos,
      dir: normalizedDir,
      createdAt: nowMs,
      hand: "right",
    },
    targetId: target.id,
    fallbackHit: SPELL_DUMMY_QA_DIRECT_FALLBACK_SPELLS.has(spell),
  };
}

export function publishSpellDummySnapshot(dummies: SpellTestDummy[]) {
  if (typeof window === "undefined") return;

  const snapshots: SpellDummySnapshot[] = new Array(dummies.length);
  let healthSummary = "";
  let aliveCount = 0;
  for (let index = 0; index < dummies.length; index++) {
    const dummy = dummies[index];
    snapshots[index] = {
      id: dummy.id,
      label: dummy.label,
      position: dummy.position,
      radius: 1.7,
      health: dummy.health,
    };
    if (index > 0) healthSummary += "|";
    healthSummary += `${dummy.id}:${Math.round(dummy.health)}`;
    if (dummy.health > 0) aliveCount += 1;
  }
  (window as any).__wofSpellDummies = snapshots;
  document.documentElement.dataset.wofSpellDummyHealth = healthSummary;
  document.documentElement.dataset.wofSpellDummyAlive = String(aliveCount);
}
