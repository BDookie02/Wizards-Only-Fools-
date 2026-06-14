import {
  resetHudControllerInventoryHoldState,
  resetHudControllerMagicHoldState,
  type HudControllerInventoryHoldRefs,
  type HudControllerMagicHoldRefs,
} from "./hudControllerHoldRuntime";
import type { HudControllerButtonsRef, HudControllerRepeatRef } from "./hudControllerRepeatRuntime";
export {
  getHudControllerBlockedSurfaceAction,
  getHudControllerGameplayActivationAction,
  getHudControllerRemapAction,
  markHudControllerGamepadSeen,
  updateHudControllerMissingGamepadAction,
  type HudControllerBlockedSurfaceAction,
  type HudControllerBlockedSurfaceActionOptions,
  type HudControllerGameplayActivationAction,
  type HudControllerGameplayActivationActionOptions,
  type HudControllerLastSeenRef,
  type HudControllerMissingGamepadAction,
  type HudControllerMissingGamepadActionOptions,
  type HudControllerRemapAction,
  type HudControllerRemapActionOptions,
} from "./hudControllerConnectionRuntime";
export {
  dispatchInventoryControllerBack,
  dispatchInventoryControllerMove,
  dispatchInventoryControllerSelect,
  dispatchSpellMenuControllerNavigate,
  dispatchSpellMenuControllerScroll,
  dispatchSpellMenuControllerSelect,
  type InventoryControllerMoveDetail,
  type SpellMenuControllerDirection,
  type SpellMenuControllerNavigateDetail,
} from "./hudControllerEventRuntime";
export {
  markHudControllerInventoryIgnoreUntilRelease,
  resetHudControllerInventoryHoldState,
  resetHudControllerMagicHoldState,
  updateHudControllerInventoryHold,
  updateHudControllerMagicHold,
  type HudControllerInventoryHoldAction,
  type HudControllerInventoryHoldRefs,
  type HudControllerInventoryHoldUpdateOptions,
  type HudControllerMagicHoldAction,
  type HudControllerMagicHoldRefs,
  type HudControllerMagicHoldUpdateOptions,
} from "./hudControllerHoldRuntime";
export {
  createHudControllerInputSnapshot,
  readHudControllerInputSnapshot,
  readHudControllerInputSnapshotInto,
  type HudControllerBindings,
  type HudControllerInputSnapshot,
} from "./hudControllerInputSnapshotRuntime";
export {
  consumeHudControllerPress,
  consumeHudControllerRepeat,
  type HudControllerButtonsRef,
  type HudControllerRepeatRef,
} from "./hudControllerRepeatRuntime";
export {
  getHudControllerDevFastTravelAction,
  getHudControllerGameplayStartAction,
  getHudControllerInventoryPanelAction,
  getHudControllerPauseMenuAction,
  getHudControllerSpellMenuAction,
  readHudControllerOverlayRepeats,
  type HudControllerDevFastTravelAction,
  type HudControllerDevFastTravelActionOptions,
  type HudControllerGameplayStartAction,
  type HudControllerGameplayStartActionOptions,
  type HudControllerInventoryPanelAction,
  type HudControllerInventoryPanelActionOptions,
  type HudControllerOverlayRepeatOptions,
  type HudControllerOverlayRepeatReader,
  type HudControllerOverlayRepeats,
  type HudControllerPauseMenuAction,
  type HudControllerPauseMenuActionOptions,
  type HudControllerSpellMenuAction,
  type HudControllerSpellMenuActionOptions,
} from "./hudControllerMenuActionRuntime";
export {
  canOpenControllerDevFastTravelMenu,
  canUseControllerInventory,
  canUseControllerMagicShortcut,
  canUseControllerMapShortcut,
  getHudControllerDevFastTravelOpenAction,
  getHudControllerOverlayScrollAction,
  getHudControllerScoreboardSourceActive,
  hasHudControllerGameplaySignal,
  isStandingStillForControllerInventory,
  type HudControllerDevFastTravelGateOptions,
  type HudControllerDevFastTravelOpenActionOptions,
  type HudControllerGameplaySignalOptions,
  type HudControllerInventoryGateOptions,
  type HudControllerInventoryStandstillOptions,
  type HudControllerMagicGateOptions,
  type HudControllerMapGateOptions,
  type HudControllerOverlayScrollAction,
  type HudControllerOverlayScrollOptions,
  type HudControllerPressReader,
  type HudControllerScoreboardSourceOptions,
} from "./hudControllerShortcutRuntime";

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
}: HudControllerInventoryHoldRefs & HudControllerMagicHoldRefs & {
  controllerButtonsRef: HudControllerButtonsRef;
  controllerRepeatRef: HudControllerRepeatRef;
}) {
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
