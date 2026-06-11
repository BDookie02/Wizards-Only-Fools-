import {
  ACID_DURATION_MS,
  POISON_DURATION_MS,
  SLEEP_DURATION_MS,
  TUNGSTON_SLOW_DURATION_MS,
  type SpellType,
  type StatusEffectType,
} from "../../../store/gameStore";

export const STATUS_BOLT_SPEED = 56;

export type StatusSpellType = Extract<SpellType, "tungstonballsack" | "sleep" | "poison" | "acid">;

export type StatusSpellConfig = {
  effect: StatusEffectType;
  durationMs: number;
  color: string;
  glow: string;
  core: string;
  label: string;
};

export const STATUS_SPELL_CONFIG: Record<StatusSpellType, StatusSpellConfig> = {
  tungstonballsack: {
    effect: "slow",
    durationMs: TUNGSTON_SLOW_DURATION_MS,
    color: "#94a3b8",
    glow: "#475569",
    core: "#e2e8f0",
    label: "TUNGSTON",
  },
  sleep: {
    effect: "sleep",
    durationMs: SLEEP_DURATION_MS,
    color: "#7dd3fc",
    glow: "#1d4ed8",
    core: "#e0f2fe",
    label: "SLEEP",
  },
  poison: {
    effect: "poison",
    durationMs: POISON_DURATION_MS,
    color: "#a855f7",
    glow: "#581c87",
    core: "#f0abfc",
    label: "POISON",
  },
  acid: {
    effect: "acid",
    durationMs: ACID_DURATION_MS,
    color: "#22c55e",
    glow: "#166534",
    core: "#bbf7d0",
    label: "ACID",
  },
};

export function isStatusSpell(type: SpellType): type is StatusSpellType {
  return type === "tungstonballsack" || type === "sleep" || type === "poison" || type === "acid";
}
