import { MathUtils } from "three";
import type { MutableRefObject } from "react";
import { type HandType, useGameStore } from "../../../store/gameStore";
import type { TouchButtonName } from "../input/playerInputState";

type PlayerTouchVectorRef = MutableRefObject<{ x: number; y: number }>;
type PlayerTouchButtonRef = MutableRefObject<Record<TouchButtonName, boolean>>;

export type PlayerTouchCastEvent = {
  hand: HandType;
  phase: "start" | "release";
};

function getPlayerTouchEventDetail(event: Event) {
  return (event as CustomEvent).detail ?? {};
}

function isPlayerTouchButton(button: unknown): button is TouchButtonName {
  return button === "jump" || button === "slide" || button === "sprint";
}

export function applyPlayerTouchControlEvent(
  event: Event,
  touchMove: PlayerTouchVectorRef,
  touchLookDelta: PlayerTouchVectorRef,
  touchButtons: PlayerTouchButtonRef,
) {
  const detail = getPlayerTouchEventDetail(event);
  if (detail.type === "move") {
    touchMove.current.x = MathUtils.clamp(Number(detail.x) || 0, -1, 1);
    touchMove.current.y = MathUtils.clamp(Number(detail.y) || 0, -1, 1);
    return;
  }

  if (detail.type === "look") {
    touchLookDelta.current.x += MathUtils.clamp(Number(detail.dx) || 0, -80, 80);
    touchLookDelta.current.y += MathUtils.clamp(Number(detail.dy) || 0, -80, 80);
    return;
  }

  if (detail.type === "button" && isPlayerTouchButton(detail.button)) {
    touchButtons.current[detail.button] = Boolean(detail.pressed);
  }
}

export function readPlayerTouchCastEvent(event: Event): PlayerTouchCastEvent {
  const detail = getPlayerTouchEventDetail(event);
  return {
    hand: detail.hand === "right" ? "right" : "left",
    phase: detail.phase === "start" ? "start" : "release",
  };
}

export function applyPlayerTouchHotbarEvent(event: Event) {
  const detail = getPlayerTouchEventDetail(event);
  const hand: HandType = detail.hand === "right" ? "right" : "left";
  const direction = Number(detail.direction) >= 0 ? 1 : -1;
  const store = useGameStore.getState();
  if (store.questDialogSession || store.isInventoryOpen) return;
  if (direction > 0) {
    store.nextSpell(hand);
  } else {
    store.prevSpell(hand);
  }
  store.setActiveHand(hand);
}
