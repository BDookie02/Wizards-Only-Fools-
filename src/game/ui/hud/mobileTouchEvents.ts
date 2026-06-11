import type { HandType } from "../../../store/gameStore";

const MOBILE_GAMEPLAY_BUTTONS = ["jump", "slide", "sprint"] as const;

export type MobileGameplayButton = typeof MOBILE_GAMEPLAY_BUTTONS[number];
export type MobileCastPhase = "start" | "end";

export function emitMobileControl(detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent("mobile-control", { detail }));
}

export function emitMobileHotbar(hand: HandType, direction: 1 | -1) {
  window.dispatchEvent(new CustomEvent("mobile-hotbar", { detail: { hand, direction } }));
}

export function emitMobileCast(hand: HandType, phase: MobileCastPhase) {
  window.dispatchEvent(new CustomEvent("mobile-cast", { detail: { hand, phase } }));
}

export function releaseMobileGameplayInputs() {
  emitMobileControl({ type: "move", x: 0, y: 0 });
  for (let index = 0; index < MOBILE_GAMEPLAY_BUTTONS.length; index++) {
    const button = MOBILE_GAMEPLAY_BUTTONS[index];
    emitMobileControl({ type: "button", button, pressed: false });
  }
  emitMobileCast("left", "end");
  emitMobileCast("right", "end");
}
