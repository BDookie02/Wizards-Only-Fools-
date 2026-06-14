import {
  getGamepadSelectionSnapshot,
  selectPrimaryGamepad,
} from "./controllerGamepadSelectionRuntime";
import {
  GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS,
  GAMEPAD_STICK_DEADZONE,
  GAMEPAD_TRIGGER_THRESHOLD,
  getGamepadScanNowMs,
} from "./controllerInputRuntime";

export { hasGamepadInput } from "./controllerGamepadActivityRuntime";
export {
  createControllerPollScheduler,
  type ControllerPollScheduler,
} from "./controllerPollSchedulerRuntime";
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
