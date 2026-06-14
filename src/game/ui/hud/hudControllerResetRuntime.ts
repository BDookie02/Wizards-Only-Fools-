import {
  resetHudControllerInventoryHoldState,
  resetHudControllerMagicHoldState,
  type HudControllerInventoryHoldRefs,
  type HudControllerMagicHoldRefs,
} from "./hudControllerHoldRuntime";
import type { HudControllerButtonsRef, HudControllerRepeatRef } from "./hudControllerRepeatRuntime";

export type HudControllerTransientResetRefs = HudControllerInventoryHoldRefs &
  HudControllerMagicHoldRefs & {
    controllerButtonsRef: HudControllerButtonsRef;
    controllerRepeatRef: HudControllerRepeatRef;
  };

export function resetHudControllerButtonState(
  controllerButtonsRef: HudControllerButtonsRef,
  controllerRepeatRef: HudControllerRepeatRef,
) {
  controllerButtonsRef.current = {};
  controllerRepeatRef.current = {};
}

export function resetHudControllerTransientState({
  controllerButtonsRef,
  controllerRepeatRef,
  controllerInventoryHoldStartedAtRef,
  controllerInventoryTapEligibleRef,
  controllerInventoryIgnoreUntilReleaseRef,
  controllerMagicHoldStartedAtRef,
  controllerMagicHoldConsumedRef,
}: HudControllerTransientResetRefs) {
  resetHudControllerButtonState(controllerButtonsRef, controllerRepeatRef);
  resetHudControllerInventoryHoldState({
    controllerInventoryHoldStartedAtRef,
    controllerInventoryTapEligibleRef,
    controllerInventoryIgnoreUntilReleaseRef,
  });
  resetHudControllerMagicHoldState({
    controllerMagicHoldStartedAtRef,
    controllerMagicHoldConsumedRef,
  });
}
