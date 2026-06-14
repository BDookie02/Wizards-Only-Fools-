import {
  getGamepadSelectionSnapshot,
  selectPrimaryGamepad,
} from "./controllerGamepadSelectionRuntime";
import {
  GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS,
  GAMEPAD_STICK_DEADZONE,
  GAMEPAD_TRIGGER_THRESHOLD,
  getGamepadScanNowMs,
  readGamepadStickAxesInto,
  type GamepadStickAxes,
} from "./controllerInputRuntime";

export {
  GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS,
  GAMEPAD_STICK_DEADZONE,
  GAMEPAD_TRIGGER_THRESHOLD,
  applyGamepadDeadzone,
  getGamepadAxis,
  getGamepadButtonValue,
  isGamepadButtonPressed,
  readGamepadStickAxesInto,
  type GamepadButtonName,
  type GamepadStickAxes,
  type GamepadStickName,
} from "./controllerInputRuntime";

const GAMEPAD_ACTIVITY_LEFT_STICK_SCRATCH: GamepadStickAxes = { x: 0, y: 0 };
const GAMEPAD_ACTIVITY_RIGHT_STICK_SCRATCH: GamepadStickAxes = { x: 0, y: 0 };

const NO_GAMEPAD_SCAN_CACHE_MS = GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS;
const PRIMARY_GAMEPAD_SCAN_CACHE_MS = 8;

let preferredGamepadIndex: number | null = null;
let cachedGamepadSignature = "";
let cachedPrimaryGamepadIndex: number | null = null;
let cachedPrimaryGamepadResult: Gamepad | null = null;
let cachedPrimaryGamepadScanAtMs = Number.NEGATIVE_INFINITY;
let lastNoGamepadScanAtMs = Number.NEGATIVE_INFINITY;
let gamepadCacheResetListenersInstalled = false;

function clearGamepadSelectionCache() {
  preferredGamepadIndex = null;
  cachedPrimaryGamepadIndex = null;
  cachedPrimaryGamepadResult = null;
  cachedPrimaryGamepadScanAtMs = Number.NEGATIVE_INFINITY;
  cachedGamepadSignature = "";
  lastNoGamepadScanAtMs = Number.NEGATIVE_INFINITY;
}

function cachePrimaryGamepadScan(gamepad: Gamepad | null, nowMs: number) {
  cachedPrimaryGamepadResult = gamepad;
  cachedPrimaryGamepadScanAtMs = nowMs;
  return gamepad;
}

function ensureGamepadCacheResetListeners() {
  if (gamepadCacheResetListenersInstalled || typeof window === "undefined") return;
  window.addEventListener("gamepadconnected", clearGamepadSelectionCache);
  window.addEventListener("gamepaddisconnected", clearGamepadSelectionCache);
  gamepadCacheResetListenersInstalled = true;
}

export function hasGamepadInput(gamepad: Gamepad | null, axisDeadzone = GAMEPAD_STICK_DEADZONE) {
  if (!gamepad) return false;

  readGamepadStickAxesInto(gamepad, "left", GAMEPAD_ACTIVITY_LEFT_STICK_SCRATCH, axisDeadzone);
  if (
    Math.abs(GAMEPAD_ACTIVITY_LEFT_STICK_SCRATCH.x) > 0 ||
    Math.abs(GAMEPAD_ACTIVITY_LEFT_STICK_SCRATCH.y) > 0
  ) {
    return true;
  }

  readGamepadStickAxesInto(gamepad, "right", GAMEPAD_ACTIVITY_RIGHT_STICK_SCRATCH, axisDeadzone);
  if (
    Math.abs(GAMEPAD_ACTIVITY_RIGHT_STICK_SCRATCH.x) > 0 ||
    Math.abs(GAMEPAD_ACTIVITY_RIGHT_STICK_SCRATCH.y) > 0
  ) {
    return true;
  }

  for (let index = 0; index < gamepad.buttons.length; index += 1) {
    const button = gamepad.buttons[index];
    if (button?.pressed || (button?.value ?? 0) >= GAMEPAD_TRIGGER_THRESHOLD) {
      return true;
    }
  }

  return false;
}

export function getPrimaryGamepad() {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") {
    return null;
  }

  ensureGamepadCacheResetListeners();
  const now = getGamepadScanNowMs();
  if (now - cachedPrimaryGamepadScanAtMs < PRIMARY_GAMEPAD_SCAN_CACHE_MS) {
    return cachedPrimaryGamepadResult;
  }

  if (now - lastNoGamepadScanAtMs < NO_GAMEPAD_SCAN_CACHE_MS) {
    return cachePrimaryGamepadScan(null, now);
  }

  const gamepads = navigator.getGamepads();
  const snapshot = getGamepadSelectionSnapshot(gamepads);
  if (snapshot.connectedCount === 0) {
    clearGamepadSelectionCache();
    lastNoGamepadScanAtMs = now;
    return cachePrimaryGamepadScan(null, now);
  }

  lastNoGamepadScanAtMs = Number.NEGATIVE_INFINITY;

  const selection = selectPrimaryGamepad({
    gamepads,
    snapshot,
    preferredGamepadIndex,
    cachedPrimaryGamepadIndex,
    cachedGamepadSignature,
  });
  preferredGamepadIndex = selection.preferredGamepadIndex;
  cachedPrimaryGamepadIndex = selection.cachedPrimaryGamepadIndex;
  cachedGamepadSignature = selection.cachedGamepadSignature;
  return cachePrimaryGamepadScan(selection.selectedGamepad, now);
}

export type ControllerPollScheduler = {
  schedule: (delayMs?: number) => void;
  cancel: () => void;
};

export function createControllerPollScheduler(callback: FrameRequestCallback): ControllerPollScheduler {
  let raf = 0;
  let timeout = 0;

  const cancel = () => {
    if (typeof window === "undefined") return;
    if (raf !== 0) {
      window.cancelAnimationFrame(raf);
      raf = 0;
    }
    if (timeout !== 0) {
      window.clearTimeout(timeout);
      timeout = 0;
    }
  };

  const schedule = (delayMs = 0) => {
    if (typeof window === "undefined") return;
    cancel();
    if (delayMs > 0) {
      timeout = window.setTimeout(() => {
        timeout = 0;
        raf = window.requestAnimationFrame(callback);
      }, delayMs);
      return;
    }

    raf = window.requestAnimationFrame(callback);
  };

  return { cancel, schedule };
}
