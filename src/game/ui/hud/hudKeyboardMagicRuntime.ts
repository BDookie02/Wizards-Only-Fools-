import { MAGIC_UNARM_HOLD_MS } from "../../systems/input/hudInputConfig";

type Ref<T> = { current: T };

export type HudKeyboardMagicHoldTimerId = number;

export type HudKeyboardMagicHoldRefs = {
  keyboardMagicHoldStartedAtRef: Ref<number | null>;
  keyboardMagicHoldTimeoutRef: Ref<HudKeyboardMagicHoldTimerId | null>;
  keyboardMagicHoldConsumedRef: Ref<boolean>;
};

export type HudKeyboardHandModifierAction =
  | { type: "none" }
  | { type: "activateRightHand" }
  | { type: "releaseRightHand"; resetBindingHand: boolean };

export function clearHudKeyboardMagicHoldState({
  clearTimer,
  keyboardMagicHoldConsumedRef,
  keyboardMagicHoldStartedAtRef,
  keyboardMagicHoldTimeoutRef,
}: HudKeyboardMagicHoldRefs & {
  clearTimer: (timerId: HudKeyboardMagicHoldTimerId) => void;
}) {
  if (keyboardMagicHoldTimeoutRef.current !== null) {
    clearTimer(keyboardMagicHoldTimeoutRef.current);
    keyboardMagicHoldTimeoutRef.current = null;
  }
  keyboardMagicHoldStartedAtRef.current = null;
  keyboardMagicHoldConsumedRef.current = false;
}

export function startHudKeyboardMagicHold({
  clearTimer,
  eventTimeStamp,
  holdMs = MAGIC_UNARM_HOLD_MS,
  keyboardMagicHoldConsumedRef,
  keyboardMagicHoldStartedAtRef,
  keyboardMagicHoldTimeoutRef,
  onHold,
  repeat,
  setTimer,
}: HudKeyboardMagicHoldRefs & {
  clearTimer: (timerId: HudKeyboardMagicHoldTimerId) => void;
  eventTimeStamp: number;
  holdMs?: number;
  onHold: () => boolean;
  repeat: boolean;
  setTimer: (callback: () => void, delayMs: number) => HudKeyboardMagicHoldTimerId;
}) {
  if (repeat || keyboardMagicHoldStartedAtRef.current !== null) return false;

  keyboardMagicHoldStartedAtRef.current = eventTimeStamp;
  keyboardMagicHoldConsumedRef.current = false;
  if (keyboardMagicHoldTimeoutRef.current !== null) {
    clearTimer(keyboardMagicHoldTimeoutRef.current);
  }
  keyboardMagicHoldTimeoutRef.current = setTimer(() => {
    keyboardMagicHoldTimeoutRef.current = null;
    if (keyboardMagicHoldStartedAtRef.current === null || keyboardMagicHoldConsumedRef.current) return;
    if (onHold()) {
      keyboardMagicHoldConsumedRef.current = true;
    }
  }, holdMs);
  return true;
}

export function resolveHudKeyboardMagicHoldRelease({
  consumed,
  eventTimeStamp,
  holdMs = MAGIC_UNARM_HOLD_MS,
  holdStartedAt,
}: {
  consumed: boolean;
  eventTimeStamp: number;
  holdMs?: number;
  holdStartedAt: number | null;
}) {
  if (holdStartedAt === null) {
    return {
      handled: false,
      openSpellMenu: false,
    };
  }

  return {
    handled: true,
    openSpellMenu: !consumed && eventTimeStamp - holdStartedAt < holdMs,
  };
}

export function resolveHudKeyboardHandModifierKeyDownAction({
  blocked,
  code,
  repeat,
}: {
  blocked: boolean;
  code: string;
  repeat: boolean;
}): HudKeyboardHandModifierAction {
  if (blocked || code !== "KeyQ" || repeat) return { type: "none" };
  return { type: "activateRightHand" };
}

export function resolveHudKeyboardHandModifierKeyUpAction({
  blocked,
  code,
  spellMenuOpen,
}: {
  blocked: boolean;
  code: string;
  spellMenuOpen: boolean;
}): HudKeyboardHandModifierAction {
  if (blocked || code !== "KeyQ") return { type: "none" };
  return { type: "releaseRightHand", resetBindingHand: !spellMenuOpen };
}
