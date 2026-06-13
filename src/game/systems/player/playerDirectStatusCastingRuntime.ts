import {
  type HandType,
  type SpellType,
} from "../../../store/gameStore";
import { STATUS_SPELL_CONFIG } from "../spells/statusSpellConfig";
import type { DirectStatusCastEventDetail } from "./playerEventBridge";

export const PLAYER_DIRECT_STATUS_HAND_CHARGE_MS = 160;

export type PlayerDirectStatusNetworkPayload = {
  targetId: string;
  effect: "slow" | "sleep" | "poison" | "acid";
  durationMs: number;
};

export type PlayerDirectStatusCastPlan = {
  spell: "tungstonballsack";
  hand: HandType;
  targetId: string;
  targetUpdate: {
    slowUntil: number;
  };
  networkPayload: PlayerDirectStatusNetworkPayload;
  eventDetail: DirectStatusCastEventDetail;
};

export function createPlayerDirectStatusCastPlan({
  spell,
  hand,
  targetId,
  nowMs,
}: {
  spell: SpellType;
  hand: HandType;
  targetId: string;
  nowMs: number;
}): PlayerDirectStatusCastPlan | null {
  if (spell !== "tungstonballsack") return null;

  const config = STATUS_SPELL_CONFIG.tungstonballsack;
  return {
    spell,
    hand,
    targetId,
    targetUpdate: {
      slowUntil: nowMs + config.durationMs,
    },
    networkPayload: {
      targetId,
      effect: config.effect,
      durationMs: config.durationMs,
    },
    eventDetail: { spell, hand, targetId },
  };
}
