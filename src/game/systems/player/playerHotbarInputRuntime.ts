import type { HandType } from "../../../store/gameStore";
import { getNumberSlotFromCode } from "../input/playerInputState";

export type PlayerKeyboardHotbarAction =
  | { type: "none" }
  | {
      type: "select";
      hand: HandType;
      slotIndex: number;
    };

export type PlayerWheelSpellAction =
  | { type: "none" }
  | {
      type: "next";
      hand: HandType;
    }
  | {
      type: "previous";
      hand: HandType;
    };

export type PlayerDirectionalHotbarAction = {
  hand: HandType;
  direction: 1 | -1;
};

export type PlayerHotbarActionStore = {
  nextSpell: (hand: HandType) => void;
  prevSpell: (hand: HandType) => void;
  selectHotbarSlot: (slotIndex: number, hand: HandType) => void;
  setActiveHand?: (hand: HandType) => void;
};

type PlayerHotbarActionOptions = {
  gameplayInputAllowed: boolean;
  isMagicArmed: boolean;
  isSpellMenuOpen: boolean;
  rightHandModifierHeld: boolean;
};

type PlayerKeyboardHotbarActionOptions = PlayerHotbarActionOptions & {
  health: number;
};

function getHotbarHand(rightHandModifierHeld: boolean): HandType {
  return rightHandModifierHeld ? "right" : "left";
}

function canUsePlayerHotbarAction(options: PlayerHotbarActionOptions) {
  return options.gameplayInputAllowed && options.isMagicArmed && !options.isSpellMenuOpen;
}

export function resolvePlayerKeyboardHotbarAction(
  code: string,
  options: PlayerKeyboardHotbarActionOptions,
): PlayerKeyboardHotbarAction {
  if (options.health <= 0 || !canUsePlayerHotbarAction(options)) return { type: "none" };

  const slotIndex = getNumberSlotFromCode(code);
  if (slotIndex === -1) return { type: "none" };

  return {
    type: "select",
    hand: getHotbarHand(options.rightHandModifierHeld),
    slotIndex,
  };
}

export function resolvePlayerWheelSpellAction(
  deltaY: number,
  options: PlayerHotbarActionOptions,
): PlayerWheelSpellAction {
  if (!canUsePlayerHotbarAction(options)) return { type: "none" };

  return {
    type: deltaY > 0 ? "next" : "previous",
    hand: getHotbarHand(options.rightHandModifierHeld),
  };
}

export function applyPlayerWheelSpellAction(
  action: PlayerWheelSpellAction,
  store: Pick<PlayerHotbarActionStore, "nextSpell" | "prevSpell">,
) {
  if (action.type === "next") {
    store.nextSpell(action.hand);
    return true;
  }
  if (action.type === "previous") {
    store.prevSpell(action.hand);
    return true;
  }
  return false;
}

export function applyPlayerDirectionalHotbarAction(
  action: PlayerDirectionalHotbarAction,
  store: Pick<PlayerHotbarActionStore, "nextSpell" | "prevSpell" | "setActiveHand">,
) {
  if (action.direction > 0) {
    store.nextSpell(action.hand);
  } else {
    store.prevSpell(action.hand);
  }
  store.setActiveHand?.(action.hand);
  return true;
}

export function applyPlayerKeyboardHotbarAction(
  action: PlayerKeyboardHotbarAction,
  store: Pick<PlayerHotbarActionStore, "selectHotbarSlot">,
) {
  if (action.type !== "select") return false;
  store.selectHotbarSlot(action.slotIndex, action.hand);
  return true;
}
