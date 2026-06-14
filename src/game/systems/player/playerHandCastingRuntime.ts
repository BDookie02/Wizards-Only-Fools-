import {
  hasRunePower,
  type HandType,
  type SpellType,
} from "../../../store/gameStore";
import { SELF_BUFF_SPELLS } from "./playerMovementConfig";

export const PLAYER_CASTING_HANDS: readonly HandType[] = ["left", "right"];

export type PlayerHandSpellState = {
  leftCurrentSpell: SpellType;
  rightCurrentSpell: SpellType;
};

export type PlayerHandRuneState = {
  leftRunePower: number;
  rightRunePower: number;
};

export type BooleanRef = {
  current: boolean;
};

export type PlayerCastReleaseRefs = {
  controllerGameplayArmed: BooleanRef;
  keyboardJumpWasPressed: BooleanRef;
  controllerJumpWasPressed: BooleanRef;
  controllerSprintWasPressed: BooleanRef;
  controllerSprintLatched: BooleanRef;
};

export type PlayerCastingHandsRef = {
  current: Record<HandType, boolean>;
};

export type PlayerHandTimersRef = {
  current: Record<HandType, number>;
};

export type PlayerHandChargingState = Record<HandType, boolean>;

export type PlayerCastingHandResetMode = "charging-or-active" | "charging-only";

export type PlayerHandChargePulseScheduler = {
  setHandCharging: (hand: HandType, charging: boolean) => void;
  setTimeout: (handler: () => void, timeoutMs: number) => number;
};

export type PlayerHealSpellFrameApplier = {
  clearToxicEffects: () => void;
  setHealth: (health: number) => void;
};

const PLAYER_QUICK_CAST_COOLDOWN_MS = 400;
const PLAYER_DEFAULT_CAST_COOLDOWN_MS = 1000;
const PLAYER_RELEASE_SUPPRESSED_SPELLS = new Set<SpellType>([
  "arcanebeam",
  "iceshard",
  "flamethrower",
  "healspell",
]);
const PLAYER_RELEASE_SELF_BUFF_SPELLS = new Set<SpellType>([
  "magicarmor",
  "speedboost",
  "jumpboost",
]);

export function getPlayerSpellForHand(state: PlayerHandSpellState, hand: HandType) {
  return hand === "right" ? state.rightCurrentSpell : state.leftCurrentSpell;
}

export function hasPlayerRunePowerForHand(state: PlayerHandRuneState, hand: HandType) {
  return hasRunePower(hand === "right" ? state.rightRunePower : state.leftRunePower);
}

export function getPlayerHandCastCooldownMs(spell: SpellType) {
  return spell === "iceshard" ? PLAYER_QUICK_CAST_COOLDOWN_MS : PLAYER_DEFAULT_CAST_COOLDOWN_MS;
}

export function canPlayerHandCastNow(
  lastFire: Record<HandType, number>,
  hand: HandType,
  spell: SpellType,
  nowMs: number,
) {
  return nowMs - lastFire[hand] >= getPlayerHandCastCooldownMs(spell);
}

export function isPlayerSelfBuffSpell(spell: SpellType) {
  return SELF_BUFF_SPELLS.has(spell);
}

export function isPlayerReleaseSuppressedSpell(spell: SpellType) {
  return PLAYER_RELEASE_SUPPRESSED_SPELLS.has(spell);
}

export function isPlayerReleaseSelfBuffSpell(spell: SpellType) {
  return PLAYER_RELEASE_SELF_BUFF_SPELLS.has(spell);
}

export function resetPlayerControllerAfterCastRelease(refs: PlayerCastReleaseRefs) {
  refs.controllerGameplayArmed.current = false;
  refs.keyboardJumpWasPressed.current = false;
  refs.controllerJumpWasPressed.current = false;
  refs.controllerSprintWasPressed.current = false;
  refs.controllerSprintLatched.current = false;
}

export function pulsePlayerHandCharging(
  hand: HandType,
  durationMs: number,
  scheduler: PlayerHandChargePulseScheduler,
) {
  scheduler.setHandCharging(hand, true);
  return scheduler.setTimeout(() => {
    scheduler.setHandCharging(hand, false);
  }, Math.max(0, durationMs));
}

export function applyPlayerHealSpellFrame({
  applier,
  charging,
  deltaSeconds,
  health,
  healPerSecond = 2,
  spell,
}: {
  applier: PlayerHealSpellFrameApplier;
  charging: boolean;
  deltaSeconds: number;
  health: number;
  healPerSecond?: number;
  spell: SpellType;
}) {
  if (spell !== "healspell" || !charging) {
    return {
      applied: false,
      health,
    };
  }

  const nextHealth = Math.min(100, health + healPerSecond * deltaSeconds);
  applier.clearToxicEffects();
  applier.setHealth(nextHealth);
  return {
    applied: true,
    health: nextHealth,
  };
}

export function clearPlayerCastingHandState(
  activeCastingHands: PlayerCastingHandsRef,
  hand: HandType,
  setHandCharging: (hand: HandType, charging: boolean) => void,
) {
  activeCastingHands.current[hand] = false;
  setHandCharging(hand, false);
}

export function resetPlayerCastingHandRuntime({
  activeCastingHands,
  chargingHands,
  flamethrowerTimers,
  hand,
  setHandCharging,
  mode = "charging-or-active",
}: {
  activeCastingHands: PlayerCastingHandsRef;
  chargingHands: PlayerHandChargingState;
  flamethrowerTimers: PlayerHandTimersRef;
  hand: HandType;
  setHandCharging: (hand: HandType, charging: boolean) => void;
  mode?: PlayerCastingHandResetMode;
}) {
  const shouldClear =
    chargingHands[hand] || (mode === "charging-or-active" && activeCastingHands.current[hand]);
  if (shouldClear) {
    clearPlayerCastingHandState(activeCastingHands, hand, setHandCharging);
  }
  flamethrowerTimers.current[hand] = 0;
  return shouldClear;
}

export function resetPlayerCastingHandsRuntime({
  activeCastingHands,
  chargingHands,
  flamethrowerTimers,
  hands,
  setHandCharging,
  mode = "charging-or-active",
}: {
  activeCastingHands: PlayerCastingHandsRef;
  chargingHands: PlayerHandChargingState;
  flamethrowerTimers: PlayerHandTimersRef;
  hands: readonly HandType[];
  setHandCharging: (hand: HandType, charging: boolean) => void;
  mode?: PlayerCastingHandResetMode;
}) {
  for (let handIndex = 0; handIndex < hands.length; handIndex += 1) {
    resetPlayerCastingHandRuntime({
      activeCastingHands,
      chargingHands,
      flamethrowerTimers,
      hand: hands[handIndex],
      setHandCharging,
      mode,
    });
  }
}

export function resetPlayerCastingHandFrameGate({
  activeCastingHands,
  chargingHands,
  flamethrowerTimers,
  hand,
  isMagicArmed,
  runeReady,
  setHandCharging,
}: {
  activeCastingHands: PlayerCastingHandsRef;
  chargingHands: PlayerHandChargingState;
  flamethrowerTimers: PlayerHandTimersRef;
  hand: HandType;
  isMagicArmed: boolean;
  runeReady: boolean;
  setHandCharging: (hand: HandType, charging: boolean) => void;
}) {
  if (!isMagicArmed) {
    resetPlayerCastingHandRuntime({
      activeCastingHands,
      chargingHands,
      flamethrowerTimers,
      hand,
      setHandCharging,
    });
    return true;
  }

  if (!runeReady) {
    resetPlayerCastingHandRuntime({
      activeCastingHands,
      chargingHands,
      flamethrowerTimers,
      hand,
      mode: "charging-only",
      setHandCharging,
    });
    return true;
  }

  return false;
}

export function stopPlayerCastingHands(
  hands: readonly HandType[],
  handlers: {
    emitGrabRelease: (hand: HandType) => void;
    stopHandCasting: (hand: HandType) => void;
  },
) {
  for (let handIndex = 0; handIndex < hands.length; handIndex += 1) {
    const hand = hands[handIndex];
    handlers.emitGrabRelease(hand);
    handlers.stopHandCasting(hand);
  }
}
