import type { HandType, SpellType } from "../../../store/gameStore";
import {
  QA_SURVIVAL_COMBAT_FOCUS_SECONDS,
  QA_SURVIVAL_COMBAT_SPELL_SEQUENCE,
  QA_SURVIVAL_PRACTICE_SPELL_SEQUENCE,
  QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE,
  QA_SURVIVAL_WALK_BLOCKED_CLEARANCE,
  type QaSpellDummySnapshot,
  type QaSurvivalIntentKind,
  type QaSurvivalWalkMode,
} from "./survivalWalkQa";

export type QaWalkPracticeVectorPayload = {
  x: number;
  y: number;
  z: number;
};

export const QA_WALK_PRACTICE_DEFAULT_CHARGE_MS = 220;
export const QA_WALK_PRACTICE_ARCANE_CHARGE_MS = 420;
export const QA_WALK_PRACTICE_LIGHTNING_TARGET_DISTANCE = 26;
export const QA_WALK_PRACTICE_GROUND_Y_OFFSET = 0.2;

export function getQaWalkPracticeCastHand(castIndex: number): HandType {
  return castIndex % 2 === 0 ? "right" : "left";
}

export function getQaWalkPracticeCastChargeMs(spell: SpellType) {
  return spell === "arcanebeam"
    ? QA_WALK_PRACTICE_ARCANE_CHARGE_MS
    : QA_WALK_PRACTICE_DEFAULT_CHARGE_MS;
}

export function resolveQaWalkPracticeProjectilePosition({
  spell,
  playerPos,
  spawnPos,
  flatDir,
  footOffset,
}: {
  spell: SpellType;
  playerPos: QaWalkPracticeVectorPayload;
  spawnPos: QaWalkPracticeVectorPayload;
  flatDir: QaWalkPracticeVectorPayload;
  footOffset: number;
}): QaWalkPracticeVectorPayload {
  if (spell !== "lightning") {
    return {
      x: spawnPos.x,
      y: spawnPos.y,
      z: spawnPos.z,
    };
  }

  return {
    x: playerPos.x + flatDir.x * QA_WALK_PRACTICE_LIGHTNING_TARGET_DISTANCE,
    y: playerPos.y - footOffset + QA_WALK_PRACTICE_GROUND_Y_OFFSET,
    z: playerPos.z + flatDir.z * QA_WALK_PRACTICE_LIGHTNING_TARGET_DISTANCE,
  };
}

export function resolveQaWalkCombatCastDecision({
  combatSpellDummy,
  combatSpellIndex,
  elapsedSeconds,
  lastCombatCastAt,
  mode,
  nextCombatCastAt,
  playerPosition,
  combatFocusSeconds = QA_SURVIVAL_COMBAT_FOCUS_SECONDS,
  minCastGapSeconds = 1.2,
  spellSequence = QA_SURVIVAL_COMBAT_SPELL_SEQUENCE,
}: {
  combatSpellDummy: QaSpellDummySnapshot | null;
  combatSpellIndex: number;
  elapsedSeconds: number;
  lastCombatCastAt: number;
  mode: QaSurvivalWalkMode;
  nextCombatCastAt: number;
  playerPosition: { x: number; z: number };
  combatFocusSeconds?: number;
  minCastGapSeconds?: number;
  spellSequence?: SpellType[];
}) {
  if (
    !combatSpellDummy ||
    (mode !== "travel" && mode !== "approach" && mode !== "act") ||
    elapsedSeconds < nextCombatCastAt ||
    elapsedSeconds - lastCombatCastAt <= minCastGapSeconds ||
    spellSequence.length <= 0
  ) {
    return null;
  }

  return {
    aimYaw: Math.atan2(combatSpellDummy.position.x - playerPosition.x, -(combatSpellDummy.position.z - playerPosition.z)),
    combatFocusUntil: elapsedSeconds + combatFocusSeconds,
    nextCombatSpellIndex: combatSpellIndex + 1,
    spell: spellSequence[combatSpellIndex % spellSequence.length],
    targetId: combatSpellDummy.id,
  };
}

export function resolveQaWalkPracticeCastDecision({
  activeIntentKind,
  combatSpellDummyActive,
  currentYaw,
  elapsedSeconds,
  forwardClearance,
  mode,
  nextPracticeCastAt,
  practiceSpellIndex,
  viewClearance,
  blockedClearance = QA_SURVIVAL_WALK_BLOCKED_CLEARANCE,
  combatFocusSeconds = QA_SURVIVAL_COMBAT_FOCUS_SECONDS,
  spellSequence = QA_SURVIVAL_PRACTICE_SPELL_SEQUENCE,
  viewBlockedClearance = QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE,
}: {
  activeIntentKind: QaSurvivalIntentKind | null;
  combatSpellDummyActive: boolean;
  currentYaw: number;
  elapsedSeconds: number;
  forwardClearance: number;
  mode: QaSurvivalWalkMode;
  nextPracticeCastAt: number;
  practiceSpellIndex: number;
  viewClearance: number;
  blockedClearance?: number;
  combatFocusSeconds?: number;
  spellSequence?: SpellType[];
  viewBlockedClearance?: number;
}) {
  if (
    combatSpellDummyActive ||
    (activeIntentKind !== null && activeIntentKind !== "landmark") ||
    mode !== "travel" ||
    elapsedSeconds < nextPracticeCastAt ||
    forwardClearance <= blockedClearance ||
    viewClearance <= viewBlockedClearance ||
    spellSequence.length <= 0
  ) {
    return null;
  }

  return {
    combatFocusUntil: elapsedSeconds + combatFocusSeconds * 0.72,
    combatTargetYaw: currentYaw,
    nextPracticeSpellIndex: practiceSpellIndex + 1,
    spell: spellSequence[practiceSpellIndex % spellSequence.length],
  };
}
