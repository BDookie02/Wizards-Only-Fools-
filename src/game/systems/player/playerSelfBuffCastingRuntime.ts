import {
  type HandType,
  type SpellType,
} from "../../../store/gameStore";
import type { SelfBuffCastEventDetail } from "./playerEventBridge";

export const PLAYER_SELF_BUFF_HAND_CHARGE_MS = 180;

export type PlayerSelfBuffStoreEffect =
  | "magicArmor"
  | "speedBoost"
  | "jumpBoost"
  | "magicGlassOrb";

export type PlayerSelfBuffCastPlan = {
  spell: SpellType;
  hand: HandType;
  chargeMs: number;
  effect: PlayerSelfBuffStoreEffect;
  eventDetail: SelfBuffCastEventDetail;
  armorNetworkValue?: number;
  jumpVelocityFloor?: number;
};

export function resolvePlayerSelfBuffCastPlan({
  spell,
  hand,
  armorMax,
  jumpVelocityFloor,
}: {
  spell: SpellType;
  hand: HandType;
  armorMax: number;
  jumpVelocityFloor: number;
}): PlayerSelfBuffCastPlan | null {
  if (spell === "magicarmor") {
    return {
      spell,
      hand,
      chargeMs: PLAYER_SELF_BUFF_HAND_CHARGE_MS,
      effect: "magicArmor",
      eventDetail: { spell, hand, armor: armorMax },
      armorNetworkValue: armorMax,
    };
  }

  if (spell === "speedboost") {
    return {
      spell,
      hand,
      chargeMs: PLAYER_SELF_BUFF_HAND_CHARGE_MS,
      effect: "speedBoost",
      eventDetail: { spell, hand },
    };
  }

  if (spell === "jumpboost") {
    return {
      spell,
      hand,
      chargeMs: PLAYER_SELF_BUFF_HAND_CHARGE_MS,
      effect: "jumpBoost",
      eventDetail: { spell, hand },
      jumpVelocityFloor,
    };
  }

  if (spell === "magicglassorb") {
    return {
      spell,
      hand,
      chargeMs: PLAYER_SELF_BUFF_HAND_CHARGE_MS,
      effect: "magicGlassOrb",
      eventDetail: { spell, hand },
    };
  }

  return null;
}
