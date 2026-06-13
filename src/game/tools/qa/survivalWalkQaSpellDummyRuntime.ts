import type { QaSpellDummySnapshot, QaSurvivalIntent, QaSurvivalWalkMode } from "./survivalWalkQa";
import {
  QA_DUMMY_REANCHOR_COOLDOWN_SECONDS,
  QA_DUMMY_REANCHOR_DISTANCE,
  QA_SPELL_DUMMY_COMBAT_CAST_MAX_INTERVAL,
  QA_SPELL_DUMMY_COMBAT_CAST_MIN_INTERVAL,
  QA_SURVIVAL_COMBAT_CAST_MAX_INTERVAL,
  QA_SURVIVAL_COMBAT_CAST_MIN_INTERVAL,
  QA_SURVIVAL_COMBAT_TARGET_RANGE,
  QA_SURVIVAL_PRACTICE_CAST_MAX_INTERVAL,
  QA_SURVIVAL_PRACTICE_CAST_MIN_INTERVAL,
  randomRangeFromNoise,
  survivalishTurnNoise,
} from "./survivalWalkQa";

export const QA_WALK_SPELL_DUMMY_EXPANDED_TARGET_RANGE_MULTIPLIER = 1.35;
export const QA_WALK_SPELL_DUMMY_REANCHOR_DEFAULT_SPAWN_OFFSET = 8;
export const QA_WALK_SPELL_DUMMY_REANCHOR_RECOVERY_SPAWN_OFFSET = 14;

export function getQaWalkNextCombatCastAt({
  elapsedSeconds,
  x,
  z,
  combatSpellIndex,
  minimumSeconds = QA_SURVIVAL_COMBAT_CAST_MIN_INTERVAL,
  qaSpellDummyRunActive,
}: {
  elapsedSeconds: number;
  x: number;
  z: number;
  combatSpellIndex: number;
  minimumSeconds?: number;
  qaSpellDummyRunActive: boolean;
}) {
  const minInterval = qaSpellDummyRunActive
    ? Math.min(minimumSeconds, QA_SPELL_DUMMY_COMBAT_CAST_MIN_INTERVAL)
    : minimumSeconds;
  const maxInterval = qaSpellDummyRunActive
    ? QA_SPELL_DUMMY_COMBAT_CAST_MAX_INTERVAL
    : QA_SURVIVAL_COMBAT_CAST_MAX_INTERVAL;

  return elapsedSeconds + randomRangeFromNoise(
    survivalishTurnNoise(x + 211, z - 173, elapsedSeconds + combatSpellIndex),
    minInterval,
    maxInterval,
  );
}

export function getQaWalkNextPracticeCastAt({
  elapsedSeconds,
  x,
  z,
  practiceSpellIndex,
  minimumSeconds = QA_SURVIVAL_PRACTICE_CAST_MIN_INTERVAL,
}: {
  elapsedSeconds: number;
  x: number;
  z: number;
  practiceSpellIndex: number;
  minimumSeconds?: number;
}) {
  return elapsedSeconds + randomRangeFromNoise(
    survivalishTurnNoise(x - 419, z + 283, elapsedSeconds + practiceSpellIndex),
    minimumSeconds,
    QA_SURVIVAL_PRACTICE_CAST_MAX_INTERVAL,
  );
}

export function resolveQaWalkSpellDummyTargets({
  spellDummies,
  playerPosition,
  activeIntent,
  activeIntentDistance,
  qaSpellDummyRunActive,
  combatTargetRange = QA_SURVIVAL_COMBAT_TARGET_RANGE,
  dummyReanchorDistance = QA_DUMMY_REANCHOR_DISTANCE,
  expandedTargetRangeMultiplier = QA_WALK_SPELL_DUMMY_EXPANDED_TARGET_RANGE_MULTIPLIER,
}: {
  spellDummies: readonly QaSpellDummySnapshot[];
  playerPosition: { x: number; z: number };
  activeIntent: QaSurvivalIntent | null;
  activeIntentDistance: number;
  qaSpellDummyRunActive: boolean;
  combatTargetRange?: number;
  dummyReanchorDistance?: number;
  expandedTargetRangeMultiplier?: number;
}) {
  let nearestSpellDummy: QaSpellDummySnapshot | null = null;
  let nearestSpellDummyDistanceSq = Number.POSITIVE_INFINITY;
  let nearestAnySpellDummy: QaSpellDummySnapshot | null = null;
  let nearestAnySpellDummyDistanceSq = Number.POSITIVE_INFINITY;
  let activeSpellDummyTarget: QaSpellDummySnapshot | null = null;
  let activeSpellDummyTargetDistanceSq = Number.POSITIVE_INFINITY;
  const combatTargetRangeSq = combatTargetRange * combatTargetRange;
  const dummyReanchorDistanceSq = dummyReanchorDistance * dummyReanchorDistance;
  const expandedCombatTargetRangeSq = combatTargetRangeSq * expandedTargetRangeMultiplier * expandedTargetRangeMultiplier;
  const activeSpellDummyId = activeIntent?.kind === "spell-dummy" ? activeIntent.id : null;

  for (const dummy of spellDummies) {
    const distanceX = dummy.position.x - playerPosition.x;
    const distanceZ = dummy.position.z - playerPosition.z;
    const distanceSq = distanceX * distanceX + distanceZ * distanceZ;
    if (distanceSq < nearestAnySpellDummyDistanceSq) {
      nearestAnySpellDummyDistanceSq = distanceSq;
      nearestAnySpellDummy = dummy;
    }
    if (distanceSq <= combatTargetRangeSq && distanceSq < nearestSpellDummyDistanceSq) {
      nearestSpellDummyDistanceSq = distanceSq;
      nearestSpellDummy = dummy;
    }
    if (activeSpellDummyId && dummy.id === activeSpellDummyId) {
      activeSpellDummyTarget = dummy;
      activeSpellDummyTargetDistanceSq = distanceSq;
    }
  }

  const combatSpellDummy = activeSpellDummyTarget && activeSpellDummyTargetDistanceSq <= expandedCombatTargetRangeSq
    ? activeSpellDummyTarget
    : nearestSpellDummy;
  const activeDummyTooFar = qaSpellDummyRunActive &&
    activeIntent?.kind === "spell-dummy" &&
    activeIntentDistance > dummyReanchorDistance;

  return {
    activeDummyTooFar,
    activeSpellDummyTarget,
    activeSpellDummyTargetDistanceSq,
    combatSpellDummy,
    combatTargetRangeSq,
    dummyReanchorDistanceSq,
    nearestAnySpellDummy,
    nearestAnySpellDummyDistanceSq,
    nearestSpellDummy,
    nearestSpellDummyDistanceSq,
  };
}

export function shouldReanchorQaWalkSpellDummy({
  activeDummyTooFar,
  elapsedSeconds,
  lastDummyReanchorAt,
  mode,
  nearestAnySpellDummy,
  nearestAnySpellDummyDistanceSq,
  qaSpellDummyHits,
  qaSpellDummyRunActive,
  dummyReanchorDistanceSq = QA_DUMMY_REANCHOR_DISTANCE * QA_DUMMY_REANCHOR_DISTANCE,
  reanchorCooldownSeconds = QA_DUMMY_REANCHOR_COOLDOWN_SECONDS,
}: {
  activeDummyTooFar: boolean;
  elapsedSeconds: number;
  lastDummyReanchorAt: number;
  mode: QaSurvivalWalkMode;
  nearestAnySpellDummy: QaSpellDummySnapshot | null;
  nearestAnySpellDummyDistanceSq: number;
  qaSpellDummyHits: number;
  qaSpellDummyRunActive: boolean;
  dummyReanchorDistanceSq?: number;
  reanchorCooldownSeconds?: number;
}) {
  if (!qaSpellDummyRunActive || !nearestAnySpellDummy) return false;
  if (elapsedSeconds - lastDummyReanchorAt <= reanchorCooldownSeconds) return false;

  const nearestBeyondAnchorDistance = nearestAnySpellDummyDistanceSq > dummyReanchorDistanceSq;
  const needsFreshDummy = qaSpellDummyHits <= 0 || nearestBeyondAnchorDistance || activeDummyTooFar;
  const recoveryAllowsReanchor = (mode === "recover" || mode === "avoid") && nearestBeyondAnchorDistance;

  return needsFreshDummy && (nearestBeyondAnchorDistance || activeDummyTooFar || recoveryAllowsReanchor);
}

export function getQaWalkSpellDummyReanchorSpawnOffset(mode: QaSurvivalWalkMode) {
  return mode === "recover" || mode === "avoid"
    ? QA_WALK_SPELL_DUMMY_REANCHOR_RECOVERY_SPAWN_OFFSET
    : QA_WALK_SPELL_DUMMY_REANCHOR_DEFAULT_SPAWN_OFFSET;
}

export function resolveQaWalkSpellDummyReanchorPlan({
  currentYaw,
  elapsedSeconds,
  mode,
  nearestAnySpellDummyDistanceSq,
  nextCombatCastAt,
  playerPosition,
  qaSpellDummyHits,
  recoveryYaw,
}: {
  currentYaw: number;
  elapsedSeconds: number;
  mode: QaSurvivalWalkMode;
  nearestAnySpellDummyDistanceSq: number;
  nextCombatCastAt: number;
  playerPosition: { x: number; y: number; z: number };
  qaSpellDummyHits: number;
  recoveryYaw: number | null;
}) {
  const yawForSpawn = mode === "recover" && recoveryYaw
    ? recoveryYaw
    : currentYaw;
  const spawnForwardX = Math.sin(yawForSpawn);
  const spawnForwardZ = -Math.cos(yawForSpawn);
  const spawnOffset = getQaWalkSpellDummyReanchorSpawnOffset(mode);
  return {
    actionLabel: `dummy-reanchor:${Math.round(Math.sqrt(nearestAnySpellDummyDistanceSq))}`,
    nextCombatCastAt: Math.min(nextCombatCastAt || Infinity, elapsedSeconds + 0.6),
    spawn: {
      x: playerPosition.x + spawnForwardX * spawnOffset,
      y: playerPosition.y + 0.2,
      z: playerPosition.z + spawnForwardZ * spawnOffset,
      yaw: yawForSpawn,
      preserveHealth: qaSpellDummyHits > 0,
    },
  };
}
