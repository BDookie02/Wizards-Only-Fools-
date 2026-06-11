import { useGameStore } from "../../../store/gameStore";
import {
  isGamepadButtonPressed,
  type GamepadButtonName,
} from "./controllerInput";
import { isEditableTarget } from "./editableTargets";

const CONTROLLER_ARM_BUTTON_THRESHOLD = 0.35;

export type PlayerMovementKeyCode = keyof typeof keys;
export type TouchButtonName = "jump" | "slide" | "sprint";

export const keys = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  Space: false,
  ShiftLeft: false,
  KeyC: false,
  KeyQ: false,
  ControlLeft: false,
  ControlRight: false,
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
};

const PLAYER_MOVEMENT_KEY_CODES = Object.keys(keys) as PlayerMovementKeyCode[];
const CONTROLLER_RELEASE_BASE_BUTTONS: readonly GamepadButtonName[] = [
  "dpadUp",
  "dpadDown",
  "dpadLeft",
  "dpadRight",
];

export function areControllerGameplayButtonsReleased(gamepad: Gamepad | null, bindings: object) {
  if (!gamepad) return false;

  for (const button of CONTROLLER_RELEASE_BASE_BUTTONS) {
    if (isGamepadButtonPressed(gamepad, button, CONTROLLER_ARM_BUTTON_THRESHOLD)) {
      return false;
    }
  }

  const buttonBindings = bindings as Record<string, GamepadButtonName>;
  for (const key in buttonBindings) {
    if (!Object.prototype.hasOwnProperty.call(buttonBindings, key)) continue;
    if (isGamepadButtonPressed(gamepad, buttonBindings[key], CONTROLLER_ARM_BUTTON_THRESHOLD)) {
      return false;
    }
  }

  return true;
}

export function resetMovementKeys() {
  for (const key of PLAYER_MOVEMENT_KEY_CODES) {
    keys[key] = false;
  }
}

export function getNumberSlotFromCode(code: string) {
  if (code.length === 6 && code.startsWith("Digit")) {
    const digit = code.charCodeAt(5) - 48;
    if (digit === 0) return 9;
    if (digit >= 1 && digit <= 9) return digit - 1;
  }

  if (code.length === 7 && code.startsWith("Numpad")) {
    const digit = code.charCodeAt(6) - 48;
    if (digit === 0) return 9;
    if (digit >= 1 && digit <= 9) return digit - 1;
  }

  return -1;
}

export function isMeditationControl(code: string) {
  return code === "ControlLeft" || code === "ControlRight";
}

export function isMouseLookFallbackActive() {
  const state = useGameStore.getState();
  return document.documentElement.dataset.wizardsMouseLookFallback === "true" &&
    state.isGameLaunched &&
    !state.isPauseMenuOpen &&
    !state.isSpellMenuOpen &&
    !state.questDialogSession &&
    !state.isInventoryOpen &&
    !state.isMapExpanded &&
    !state.isScoreboardOpen &&
    state.health > 0;
}

export function isMouseGameplayInputActive() {
  return Boolean(document.pointerLockElement || isMouseLookFallbackActive());
}

function isKeyboardArrowLookInputActive() {
  const state = useGameStore.getState();
  return state.keyboardArrowLookEnabled &&
    state.isGameLaunched &&
    !state.isPauseMenuOpen &&
    !state.isSpellMenuOpen &&
    !state.questDialogSession &&
    !state.isInventoryOpen &&
    !state.isMapExpanded &&
    !state.isScoreboardOpen &&
    state.health > 0 &&
    (isMouseGameplayInputActive() || state.isTouchControlsActive);
}

function handleMovementKeyDown(e: KeyboardEvent) {
  if (isEditableTarget(e.target)) return;
  if (Object.prototype.hasOwnProperty.call(keys, e.code)) {
    keys[e.code as PlayerMovementKeyCode] = true;
    if (e.code.startsWith("Arrow") && isKeyboardArrowLookInputActive()) {
      e.preventDefault();
    }
  }
}

function handleMovementKeyUp(e: KeyboardEvent) {
  if (Object.prototype.hasOwnProperty.call(keys, e.code)) {
    keys[e.code as PlayerMovementKeyCode] = false;
  }
}

let movementKeyboardListenerCount = 0;
let removeMovementKeyboardListeners: (() => void) | null = null;

export function installMovementKeyboardListeners() {
  if (typeof window === "undefined") return () => {};

  movementKeyboardListenerCount += 1;
  if (!removeMovementKeyboardListeners) {
    window.addEventListener("keydown", handleMovementKeyDown);
    window.addEventListener("keyup", handleMovementKeyUp);
    removeMovementKeyboardListeners = () => {
      window.removeEventListener("keydown", handleMovementKeyDown);
      window.removeEventListener("keyup", handleMovementKeyUp);
      resetMovementKeys();
    };
  }

  return () => {
    movementKeyboardListenerCount = Math.max(0, movementKeyboardListenerCount - 1);
    if (movementKeyboardListenerCount !== 0 || !removeMovementKeyboardListeners) return;
    removeMovementKeyboardListeners();
    removeMovementKeyboardListeners = null;
  };
}
