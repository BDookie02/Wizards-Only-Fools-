import type { Projectile, StatusEffectType } from "../../../store/gameStore";

export const HEALING_CRYSTAL_RADIUS_SQ = 9;
export const HEALING_CRYSTAL_HEAL_PER_SECOND = 10;
export const HEALING_CRYSTAL_MAX_HEALTH = 100;
export const HEALING_CRYSTAL_TICK_MS = 50;

export type HealingRuntimeState = {
  health: number;
  poisonUntil: number;
  acidUntil: number;
};

export type HealingRuntimeResult = {
  inRange: boolean;
  clearedEffects: StatusEffectType[];
  nextHealth: number;
};

export type HealingPoint = {
  x: number;
  y: number;
  z: number;
};

export function isWithinHealingCrystalRadius(point: HealingPoint, projectile: Projectile) {
  const dx = point.x - projectile.pos.x;
  const dy = point.y - projectile.pos.y;
  const dz = point.z - projectile.pos.z;
  return dx * dx + dy * dy + dz * dz < HEALING_CRYSTAL_RADIUS_SQ;
}

export function getHealingCrystalTick(
  point: HealingPoint | undefined,
  projectile: Projectile,
  state: HealingRuntimeState,
  deltaSeconds: number,
  nowMs: number,
): HealingRuntimeResult {
  if (!point || !isWithinHealingCrystalRadius(point, projectile)) {
    return { inRange: false, clearedEffects: [], nextHealth: state.health };
  }

  const clearedEffects: StatusEffectType[] = [];
  if (state.poisonUntil > nowMs) clearedEffects.push("poison");
  if (state.acidUntil > nowMs) clearedEffects.push("acid");

  const nextHealth = state.health > 0
    ? Math.min(
      HEALING_CRYSTAL_MAX_HEALTH,
      state.health + HEALING_CRYSTAL_HEAL_PER_SECOND * deltaSeconds,
    )
    : state.health;

  return { inRange: true, clearedEffects, nextHealth };
}
