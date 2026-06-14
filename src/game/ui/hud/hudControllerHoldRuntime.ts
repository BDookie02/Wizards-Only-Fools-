import { CONTROLLER_INVENTORY_HOLD_MS, MAGIC_UNARM_HOLD_MS } from "../../systems/input/hudInputConfig";

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

export function markHudControllerInventoryIgnoreUntilRelease({
  controllerInventoryHoldStartedAtRef,
  controllerInventoryTapEligibleRef,
  controllerInventoryIgnoreUntilReleaseRef,
}: HudControllerInventoryHoldRefs) {
  controllerInventoryIgnoreUntilReleaseRef.current = true;
  controllerInventoryHoldStartedAtRef.current = null;
  controllerInventoryTapEligibleRef.current = false;
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
