import {
  ACID_DURATION_MS,
  ARMOR_MAX,
  POISON_DURATION_MS,
  RUNE_POWER_MAX,
  hasRunePower,
  type HandType,
  type SpellType,
} from "../../../store/gameStore";

export type GameplayHudOverlayStateInput = {
  leftRunePower: number;
  rightRunePower: number;
  health: number;
  armor: number;
  thrusterFuel: number;
  speedBoostUntil: number;
  jumpBoostUntil: number;
  slowUntil: number;
  sleepUntil: number;
  poisonUntil: number;
  acidUntil: number;
  magicGlassOrbUntil: number;
  buffClock: number;
};

export type GameplayHudOverlayState = {
  leftRuneReady: boolean;
  rightRuneReady: boolean;
  leftManaPercent: number;
  rightManaPercent: number;
  healthPercent: number;
  armorPercent: number;
  thrusterPercent: number;
  healthLabel: string;
  armorLabel: string;
  speedBoostSeconds: number;
  jumpBoostSeconds: number;
  slowSeconds: number;
  sleepSeconds: number;
  poisonSeconds: number;
  acidSeconds: number;
  glassOrbActive: boolean;
  poisonPercent: number;
  acidPercent: number;
  hasActiveBuff: boolean;
};

export const GAMEPLAY_HUD_MANA_METER_STYLE = {
  bottom: "calc(var(--hud-status-height) + 10px)",
  width: "min(clamp(220px, 72%, 400px), calc(100% - 32px))",
} as const;

export const GAMEPLAY_HUD_STATUS_BAR_STYLE = {
  height: "var(--hud-status-height)",
} as const;

export const GAMEPLAY_HUD_SPELL_LINE_STYLE = {
  fontSize: "clamp(0.52rem, 1.45vw, 1.05rem)",
} as const;

export function formatGameplayHudPercentWidth(percent: number) {
  return `${percent}%`;
}

export function getGameplayHudHandLabelTone(activeHand: HandType, hand: HandType) {
  if (activeHand !== hand) return "text-[#555]";
  return hand === "left" ? "text-yellow-300" : "text-fuchsia-300";
}

export function getGameplayHudHotkeySlotTone(hand: HandType, spell: SpellType, index: number, selectedIndex: number) {
  if (selectedIndex !== index) return "text-[#555]";
  if (hand === "left") {
    return spell === "lightning"
      ? "text-blue-300 drop-shadow-[1px_1px_0_theme(colors.black)] font-bold scale-110"
      : "text-yellow-400 drop-shadow-[1px_1px_0_theme(colors.black)] font-bold scale-110";
  }

  return "text-fuchsia-300 drop-shadow-[1px_1px_0_theme(colors.black)] font-bold scale-110";
}

export function getGameplayHudSecondsUntil(untilMs: number, nowMs: number) {
  return Math.ceil(Math.max(0, untilMs - nowMs) / 1000);
}

export function getGameplayHudRatioPercent(value: number, maxValue: number) {
  return (value / maxValue) * 100;
}

export function getGameplayHudDurationPercent(untilMs: number, nowMs: number, durationMs: number) {
  return Math.min(100, getGameplayHudRatioPercent(Math.max(0, untilMs - nowMs), durationMs));
}

export function resolveGameplayHudOverlayState(input: GameplayHudOverlayStateInput): GameplayHudOverlayState {
  const leftRuneReady = hasRunePower(input.leftRunePower);
  const rightRuneReady = hasRunePower(input.rightRunePower);
  const speedBoostSeconds = getGameplayHudSecondsUntil(input.speedBoostUntil, input.buffClock);
  const jumpBoostSeconds = getGameplayHudSecondsUntil(input.jumpBoostUntil, input.buffClock);
  const slowSeconds = getGameplayHudSecondsUntil(input.slowUntil, input.buffClock);
  const sleepSeconds = getGameplayHudSecondsUntil(input.sleepUntil, input.buffClock);
  const poisonSeconds = getGameplayHudSecondsUntil(input.poisonUntil, input.buffClock);
  const acidSeconds = getGameplayHudSecondsUntil(input.acidUntil, input.buffClock);
  const glassOrbActive = input.magicGlassOrbUntil > input.buffClock;

  return {
    leftRuneReady,
    rightRuneReady,
    leftManaPercent: getGameplayHudRatioPercent(input.leftRunePower, RUNE_POWER_MAX),
    rightManaPercent: getGameplayHudRatioPercent(input.rightRunePower, RUNE_POWER_MAX),
    healthPercent: getGameplayHudRatioPercent(input.health, 100),
    armorPercent: getGameplayHudRatioPercent(input.armor, ARMOR_MAX),
    thrusterPercent: input.thrusterFuel * 100,
    healthLabel: `${Math.round(input.health)}%`,
    armorLabel: `${Math.round(input.armor)}/${ARMOR_MAX}`,
    speedBoostSeconds,
    jumpBoostSeconds,
    slowSeconds,
    sleepSeconds,
    poisonSeconds,
    acidSeconds,
    glassOrbActive,
    poisonPercent: getGameplayHudDurationPercent(input.poisonUntil, input.buffClock, POISON_DURATION_MS),
    acidPercent: getGameplayHudDurationPercent(input.acidUntil, input.buffClock, ACID_DURATION_MS),
    hasActiveBuff:
      speedBoostSeconds > 0 ||
      jumpBoostSeconds > 0 ||
      slowSeconds > 0 ||
      sleepSeconds > 0 ||
      poisonSeconds > 0 ||
      acidSeconds > 0 ||
      glassOrbActive,
  };
}
