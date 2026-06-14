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

export type PlayerSelfBuffVelocity = {
  x: number;
  y: number;
  z: number;
};

export type PlayerSelfBuffCastPlanApplier = {
  setHandCharging: (hand: HandType, charging: boolean) => void;
  setTimeout: (handler: () => void, timeoutMs: number) => unknown;
  activateMagicArmor: () => void;
  activateSpeedBoost: () => void;
  activateJumpBoost: () => void;
  activateMagicGlassOrb: () => void;
  getJumpVelocity?: () => PlayerSelfBuffVelocity | null | undefined;
  setJumpVelocity?: (velocity: PlayerSelfBuffVelocity) => void;
  emitGameNetworkEvent: (eventName: "setArmor", value: number) => void;
  dispatchSelfBuffCast: (detail: SelfBuffCastEventDetail) => void;
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

export function applyPlayerSelfBuffCastPlan(
  plan: PlayerSelfBuffCastPlan | null,
  applier: PlayerSelfBuffCastPlanApplier,
) {
  if (!plan) return false;

  applier.setHandCharging(plan.hand, true);
  applier.setTimeout(() => {
    applier.setHandCharging(plan.hand, false);
  }, plan.chargeMs);

  if (plan.effect === "magicArmor") {
    applier.activateMagicArmor();
  } else if (plan.effect === "speedBoost") {
    applier.activateSpeedBoost();
  } else if (plan.effect === "jumpBoost") {
    applier.activateJumpBoost();
    const velocity = applier.getJumpVelocity?.();
    if (velocity && applier.setJumpVelocity) {
      applier.setJumpVelocity({
        x: velocity.x,
        y: Math.max(velocity.y, plan.jumpVelocityFloor ?? velocity.y),
        z: velocity.z,
      });
    }
  } else {
    applier.activateMagicGlassOrb();
  }

  if (typeof plan.armorNetworkValue === "number") {
    applier.emitGameNetworkEvent("setArmor", plan.armorNetworkValue);
  }
  applier.dispatchSelfBuffCast(plan.eventDetail);
  return true;
}
