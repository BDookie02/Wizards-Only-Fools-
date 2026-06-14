import {
  GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS,
  isGamepadButtonPressed,
  type GamepadButtonName,
} from "../../systems/input/controllerInput";
import { CONTROLLER_INVENTORY_HOLD_MS, MAGIC_UNARM_HOLD_MS } from "../../systems/input/hudInputConfig";
import type { HudControllerButtonsRef, HudControllerRepeatRef } from "./hudControllerRepeatRuntime";
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

type Ref<T> = {
  current: T;
};

export type HudControllerInventoryHoldRefs = {
  controllerInventoryHoldStartedAtRef: Ref<number | null>;
  controllerInventoryTapEligibleRef: Ref<boolean>;
  controllerInventoryIgnoreUntilReleaseRef: Ref<boolean>;
};

export type HudControllerMagicHoldRefs = {
  controllerMagicHoldStartedAtRef: Ref<number | null>;
  controllerMagicHoldConsumedRef: Ref<boolean>;
};

export type HudControllerLastSeenRef = Ref<number>;

export type HudControllerInventoryHoldAction = "none" | "openInventory";

export type HudControllerInventoryHoldUpdateOptions = {
  refs: HudControllerInventoryHoldRefs;
  now: number;
  inventoryHeld: boolean;
  isStandingStillForInventory: boolean;
  canUseControllerInventoryShortcut: boolean;
  holdMs?: number;
};

export type HudControllerMagicHoldAction = "none" | "interact";

export type HudControllerMagicHoldUpdateOptions = {
  refs: HudControllerMagicHoldRefs;
  now: number;
  interactHeld: boolean;
  canUseControllerMagic: boolean;
  toggleMagicArmed: () => boolean;
  holdMs?: number;
};

export type HudControllerBlockedSurfaceAction =
  | { type: "none" }
  | {
      type: "interrupt";
      nextPollMs: number;
      resetTransientState: boolean;
      clearScoreboardSource: boolean;
    };

export type HudControllerBlockedSurfaceActionOptions = {
  questNpcEditorOpen: boolean;
  questDialogOpen: boolean;
  nextPollMs?: number;
};

export type HudControllerMissingGamepadAction = {
  pauseGameplay: boolean;
  nextPollMs: number;
  resetTransientState: boolean;
  clearScoreboardSource: boolean;
};

export type HudControllerMissingGamepadActionOptions = {
  controllerGameplayActive: boolean;
  controllerLastSeenAtRef: HudControllerLastSeenRef;
  now: number;
  nextPollMs?: number;
  disconnectPauseMs?: number;
};

export type HudControllerGameplayActivationAction =
  | { type: "none" }
  | {
      type: "activate";
      releaseTouchControls: boolean;
      setControllerGameplayActive: boolean;
      dispatchControllerGameplayStarted: boolean;
      nextInputMode: "controller";
    };

export type HudControllerGameplayActivationActionOptions = {
  isGameLaunched: boolean;
  hasLocalPlayerName: boolean;
  hasActiveGamepadInput: boolean;
  isTouchControlsActive: boolean;
  isControllerGameplayActive: boolean;
  lastGameplayInputMode: string;
};

export type HudControllerRemapAction =
  | { type: "none" }
  | { type: "cancel" }
  | { type: "capture"; button: string };

export type HudControllerRemapActionOptions = {
  gamepad: Gamepad;
  now: number;
  remapReadyAt: number;
  menuBackButton: string;
  controllerButtonOptions: readonly string[];
};

const HUD_CONTROLLER_DISCONNECT_PAUSE_MS = 1200;

export function markHudControllerInventoryIgnoreUntilRelease({
  controllerInventoryHoldStartedAtRef,
  controllerInventoryTapEligibleRef,
  controllerInventoryIgnoreUntilReleaseRef,
}: HudControllerInventoryHoldRefs) {
  controllerInventoryIgnoreUntilReleaseRef.current = true;
  controllerInventoryHoldStartedAtRef.current = null;
  controllerInventoryTapEligibleRef.current = false;
}

export function getHudControllerBlockedSurfaceAction({
  questNpcEditorOpen,
  questDialogOpen,
  nextPollMs = GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS,
}: HudControllerBlockedSurfaceActionOptions): HudControllerBlockedSurfaceAction {
  if (!questNpcEditorOpen && !questDialogOpen) return { type: "none" };

  return {
    type: "interrupt",
    nextPollMs,
    resetTransientState: true,
    clearScoreboardSource: true,
  };
}

export function updateHudControllerMissingGamepadAction({
  controllerGameplayActive,
  controllerLastSeenAtRef,
  now,
  nextPollMs = GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS,
  disconnectPauseMs = HUD_CONTROLLER_DISCONNECT_PAUSE_MS,
}: HudControllerMissingGamepadActionOptions): HudControllerMissingGamepadAction {
  let pauseGameplay = false;

  if (controllerGameplayActive) {
    if (controllerLastSeenAtRef.current === 0) {
      controllerLastSeenAtRef.current = now;
    } else if (now - controllerLastSeenAtRef.current > disconnectPauseMs) {
      pauseGameplay = true;
      controllerLastSeenAtRef.current = 0;
    }
  } else {
    controllerLastSeenAtRef.current = 0;
  }

  return {
    pauseGameplay,
    nextPollMs,
    resetTransientState: true,
    clearScoreboardSource: true,
  };
}

export function markHudControllerGamepadSeen(controllerLastSeenAtRef: HudControllerLastSeenRef, now: number) {
  controllerLastSeenAtRef.current = now;
}

export function getHudControllerGameplayActivationAction({
  isGameLaunched,
  hasLocalPlayerName,
  hasActiveGamepadInput,
  isTouchControlsActive,
  isControllerGameplayActive,
  lastGameplayInputMode,
}: HudControllerGameplayActivationActionOptions): HudControllerGameplayActivationAction {
  if (!isGameLaunched || !hasLocalPlayerName || !hasActiveGamepadInput) {
    return { type: "none" };
  }

  if (
    !isTouchControlsActive &&
    isControllerGameplayActive &&
    lastGameplayInputMode === "controller"
  ) {
    return { type: "none" };
  }

  const setControllerGameplayActive = !isControllerGameplayActive;
  return {
    type: "activate",
    releaseTouchControls: isTouchControlsActive,
    setControllerGameplayActive,
    dispatchControllerGameplayStarted: setControllerGameplayActive,
    nextInputMode: "controller",
  };
}

export function getHudControllerRemapAction({
  gamepad,
  now,
  remapReadyAt,
  menuBackButton,
  controllerButtonOptions,
}: HudControllerRemapActionOptions): HudControllerRemapAction {
  if (now < remapReadyAt) return { type: "none" };

  if (isGamepadButtonPressed(gamepad, menuBackButton as GamepadButtonName)) {
    return { type: "cancel" };
  }

  for (let index = 0; index < controllerButtonOptions.length; index += 1) {
    const button = controllerButtonOptions[index];
    if (!isGamepadButtonPressed(gamepad, button as GamepadButtonName)) continue;
    return { type: "capture", button };
  }

  return { type: "none" };
}

export function updateHudControllerInventoryHold({
  refs,
  now,
  inventoryHeld,
  isStandingStillForInventory,
  canUseControllerInventoryShortcut,
  holdMs = CONTROLLER_INVENTORY_HOLD_MS,
}: HudControllerInventoryHoldUpdateOptions): HudControllerInventoryHoldAction {
  const {
    controllerInventoryHoldStartedAtRef,
    controllerInventoryTapEligibleRef,
    controllerInventoryIgnoreUntilReleaseRef,
  } = refs;

  if (controllerInventoryIgnoreUntilReleaseRef.current) {
    controllerInventoryHoldStartedAtRef.current = null;
    controllerInventoryTapEligibleRef.current = false;
    if (!inventoryHeld) {
      controllerInventoryIgnoreUntilReleaseRef.current = false;
    }
    return "none";
  }

  if (inventoryHeld) {
    if (isStandingStillForInventory && canUseControllerInventoryShortcut) {
      if (controllerInventoryHoldStartedAtRef.current === null) {
        controllerInventoryHoldStartedAtRef.current = now;
        controllerInventoryTapEligibleRef.current = true;
      } else if (now - controllerInventoryHoldStartedAtRef.current >= holdMs) {
        controllerInventoryTapEligibleRef.current = false;
      }
    } else {
      controllerInventoryTapEligibleRef.current = false;
    }
    return "none";
  }

  if (controllerInventoryHoldStartedAtRef.current !== null) {
    const holdDuration = now - controllerInventoryHoldStartedAtRef.current;
    const shouldOpenInventory =
      controllerInventoryTapEligibleRef.current &&
      holdDuration < holdMs &&
      isStandingStillForInventory &&
      canUseControllerInventoryShortcut;
    resetHudControllerInventoryHoldState(refs);
    return shouldOpenInventory ? "openInventory" : "none";
  }

  return "none";
}

export function updateHudControllerMagicHold({
  refs,
  now,
  interactHeld,
  canUseControllerMagic,
  toggleMagicArmed,
  holdMs = MAGIC_UNARM_HOLD_MS,
}: HudControllerMagicHoldUpdateOptions): HudControllerMagicHoldAction {
  const { controllerMagicHoldStartedAtRef, controllerMagicHoldConsumedRef } = refs;

  if (interactHeld) {
    if (canUseControllerMagic) {
      if (controllerMagicHoldStartedAtRef.current === null) {
        controllerMagicHoldStartedAtRef.current = now;
        controllerMagicHoldConsumedRef.current = false;
      } else if (!controllerMagicHoldConsumedRef.current && now - controllerMagicHoldStartedAtRef.current >= holdMs) {
        controllerMagicHoldConsumedRef.current = toggleMagicArmed();
      }
    } else {
      resetHudControllerMagicHoldState(refs);
    }
    return "none";
  }

  if (controllerMagicHoldStartedAtRef.current !== null) {
    const holdDuration = now - controllerMagicHoldStartedAtRef.current;
    const shouldInteract =
      !controllerMagicHoldConsumedRef.current &&
      holdDuration < holdMs &&
      canUseControllerMagic;
    resetHudControllerMagicHoldState(refs);
    return shouldInteract ? "interact" : "none";
  }

  return "none";
}

export function resetHudControllerButtonState(
  controllerButtonsRef: HudControllerButtonsRef,
  controllerRepeatRef: HudControllerRepeatRef,
) {
  controllerButtonsRef.current = {};
  controllerRepeatRef.current = {};
}

export function resetHudControllerInventoryHoldState({
  controllerInventoryHoldStartedAtRef,
  controllerInventoryTapEligibleRef,
  controllerInventoryIgnoreUntilReleaseRef,
}: HudControllerInventoryHoldRefs) {
  controllerInventoryHoldStartedAtRef.current = null;
  controllerInventoryTapEligibleRef.current = false;
  controllerInventoryIgnoreUntilReleaseRef.current = false;
}

export function resetHudControllerMagicHoldState({
  controllerMagicHoldStartedAtRef,
  controllerMagicHoldConsumedRef,
}: HudControllerMagicHoldRefs) {
  controllerMagicHoldStartedAtRef.current = null;
  controllerMagicHoldConsumedRef.current = false;
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
