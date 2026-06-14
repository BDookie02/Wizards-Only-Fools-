export type InventoryControllerMoveDetail = {
  direction: 1 | -1;
};

export type SpellMenuControllerDirection = "up" | "down" | "left" | "right";

export type SpellMenuControllerNavigateDetail = {
  direction: SpellMenuControllerDirection;
};

function dispatchHudControllerEvent(event: Event) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return false;
  return window.dispatchEvent(event);
}

function createHudControllerCustomEvent<T>(type: string, detail: T) {
  if (typeof window !== "undefined" && typeof window.CustomEvent === "function") {
    return new window.CustomEvent<T>(type, { detail });
  }
  if (typeof document !== "undefined" && typeof document.createEvent === "function") {
    const event = document.createEvent("CustomEvent");
    event.initCustomEvent(type, false, false, detail);
    return event as CustomEvent<T>;
  }
  return new Event(type) as CustomEvent<T>;
}

export function dispatchInventoryControllerMove(direction: 1 | -1) {
  return dispatchHudControllerEvent(
    createHudControllerCustomEvent<InventoryControllerMoveDetail>("inventory-controller-move", { direction }),
  );
}

export function dispatchInventoryControllerSelect() {
  return dispatchHudControllerEvent(new Event("inventory-controller-select"));
}

export function dispatchInventoryControllerBack() {
  const detail = { handled: false };
  dispatchHudControllerEvent(createHudControllerCustomEvent("inventory-controller-back", detail));
  return detail.handled;
}

export function dispatchSpellMenuControllerScroll(delta: number) {
  return dispatchHudControllerEvent(createHudControllerCustomEvent("spell-menu-controller-scroll", delta));
}

export function dispatchSpellMenuControllerNavigate(direction: SpellMenuControllerDirection) {
  return dispatchHudControllerEvent(
    createHudControllerCustomEvent<SpellMenuControllerNavigateDetail>("spell-menu-controller-navigate", { direction }),
  );
}

export function dispatchSpellMenuControllerSelect() {
  return dispatchHudControllerEvent(new Event("spell-menu-controller-select"));
}
