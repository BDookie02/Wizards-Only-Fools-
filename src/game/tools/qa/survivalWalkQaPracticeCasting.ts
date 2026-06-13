import type { HandType, SpellType } from "../../../store/gameStore";

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
