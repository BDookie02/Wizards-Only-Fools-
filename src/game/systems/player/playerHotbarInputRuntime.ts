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
