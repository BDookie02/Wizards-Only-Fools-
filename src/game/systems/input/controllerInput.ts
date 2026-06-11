export type GamepadButtonName =
  | "a"
  | "b"
  | "x"
  | "y"
  | "leftBumper"
  | "rightBumper"
  | "leftTrigger"
  | "rightTrigger"
  | "back"
  | "start"
  | "leftStick"
  | "rightStick"
  | "dpadUp"
  | "dpadDown"
  | "dpadLeft"
  | "dpadRight";

const BUTTON_INDEX: Record<GamepadButtonName, number> = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
  leftBumper: 4,
  rightBumper: 5,
  leftTrigger: 6,
  rightTrigger: 7,
  back: 8,
  start: 9,
  leftStick: 10,
  rightStick: 11,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
};

export const GAMEPAD_STICK_DEADZONE = 0.22;
export const GAMEPAD_TRIGGER_THRESHOLD = 0.45;
export const GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS = 120;

const NO_GAMEPAD_SCAN_CACHE_MS = GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS;
const PRIMARY_GAMEPAD_SCAN_CACHE_MS = 8;

let preferredGamepadIndex: number | null = null;
let cachedGamepadSignature = "";
let cachedPrimaryGamepadIndex: number | null = null;
let cachedPrimaryGamepadResult: Gamepad | null = null;
let cachedPrimaryGamepadScanAtMs = Number.NEGATIVE_INFINITY;
let lastNoGamepadScanAtMs = Number.NEGATIVE_INFINITY;
let gamepadCacheResetListenersInstalled = false;

function getGamepadScanNowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

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

function getGamepadActivity(gamepad: Gamepad) {
  let axisActivity = 0;
  for (let index = 0; index < gamepad.axes.length; index += 1) {
    axisActivity += Math.abs(applyGamepadDeadzone(gamepad.axes[index] ?? 0, 0.18));
  }

  let buttonActivity = 0;
  for (let index = 0; index < gamepad.buttons.length; index += 1) {
    const button = gamepad.buttons[index];
    if (button.pressed || button.value >= GAMEPAD_TRIGGER_THRESHOLD) {
      buttonActivity += 1;
    }
  }

  return axisActivity + buttonActivity;
}

function getConnectedGamepadByIndex(gamepads: readonly (Gamepad | null)[], gamepadIndex: number) {
  for (let index = 0; index < gamepads.length; index += 1) {
    const gamepad = gamepads[index];
    if (gamepad?.connected && gamepad.index === gamepadIndex) return gamepad;
  }
  return null;
}

function getGamepadSignature(gamepads: readonly (Gamepad | null)[]) {
  let connectedCount = 0;
  let connectedGamepad: Gamepad | null = null;
  let hasUsefulTimestamp = false;

  for (let index = 0; index < gamepads.length; index += 1) {
    const gamepad = gamepads[index];
    if (!gamepad?.connected) continue;

    connectedCount += 1;
    connectedGamepad = gamepad;

    const timestamp = Number.isFinite(gamepad.timestamp) ? gamepad.timestamp : 0;
    if (timestamp > 0) hasUsefulTimestamp = true;
  }

  let signature = "";
  if (connectedCount > 1) {
    for (let index = 0; index < gamepads.length; index += 1) {
      const gamepad = gamepads[index];
      if (!gamepad?.connected) continue;
      const timestamp = Number.isFinite(gamepad.timestamp) ? gamepad.timestamp : 0;
      signature += `${gamepad.index}:${gamepad.mapping}:${timestamp};`;
    }
  }

  return {
    connectedCount,
    connectedGamepad,
    hasUsefulTimestamp,
    signature,
  };
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
  const snapshot = getGamepadSignature(gamepads);
  if (snapshot.connectedCount === 0) {
    clearGamepadSelectionCache();
    lastNoGamepadScanAtMs = now;
    return cachePrimaryGamepadScan(null, now);
  }

  lastNoGamepadScanAtMs = Number.NEGATIVE_INFINITY;

  if (snapshot.connectedCount === 1 && snapshot.connectedGamepad) {
    preferredGamepadIndex = snapshot.connectedGamepad.index;
    cachedPrimaryGamepadIndex = snapshot.connectedGamepad.index;
    cachedGamepadSignature = snapshot.signature;
    return cachePrimaryGamepadScan(snapshot.connectedGamepad, now);
  }

  if (
    snapshot.hasUsefulTimestamp &&
    cachedPrimaryGamepadIndex !== null &&
    cachedGamepadSignature === snapshot.signature
  ) {
    const cachedGamepad = getConnectedGamepadByIndex(gamepads, cachedPrimaryGamepadIndex);
    if (cachedGamepad) return cachePrimaryGamepadScan(cachedGamepad, now);
  }

  let fallbackGamepad: Gamepad | null = null;
  let standardGamepad: Gamepad | null = null;
  let preferredGamepad: Gamepad | null = null;
  let activeGamepad: Gamepad | null = null;
  let activeGamepadActivity = 0.02;

  for (let index = 0; index < gamepads.length; index += 1) {
    const gamepad = gamepads[index];
    if (!gamepad?.connected) continue;

    fallbackGamepad ??= gamepad;
    if (gamepad.mapping === "standard") {
      standardGamepad ??= gamepad;
    }
    if (preferredGamepadIndex !== null && gamepad.index === preferredGamepadIndex) {
      preferredGamepad = gamepad;
    }

    const activity = getGamepadActivity(gamepad);
    if (activity > activeGamepadActivity) {
      activeGamepadActivity = activity;
      activeGamepad = gamepad;
    }
  }

  const selectedGamepad = activeGamepad ?? preferredGamepad ?? standardGamepad ?? fallbackGamepad;
  if (activeGamepad) {
    preferredGamepadIndex = activeGamepad.index;
  } else if (selectedGamepad) {
    preferredGamepadIndex = selectedGamepad.index;
  }

  cachedPrimaryGamepadIndex = selectedGamepad?.index ?? null;
  cachedGamepadSignature = snapshot.hasUsefulTimestamp ? snapshot.signature : "";
  return cachePrimaryGamepadScan(selectedGamepad, now);
}

export function applyGamepadDeadzone(value: number, deadzone = GAMEPAD_STICK_DEADZONE) {
  const magnitude = Math.abs(value);
  if (magnitude <= deadzone) return 0;
  return Math.sign(value) * ((magnitude - deadzone) / (1 - deadzone));
}

export function getGamepadAxis(gamepad: Gamepad | null, axisIndex: number, deadzone = GAMEPAD_STICK_DEADZONE) {
  if (!gamepad) return 0;
  return applyGamepadDeadzone(gamepad.axes[axisIndex] ?? 0, deadzone);
}

export function getGamepadButtonValue(gamepad: Gamepad | null, button: GamepadButtonName) {
  if (!gamepad) return 0;
  return gamepad.buttons[BUTTON_INDEX[button]]?.value ?? 0;
}

export function isGamepadButtonPressed(
  gamepad: Gamepad | null,
  button: GamepadButtonName,
  threshold = GAMEPAD_TRIGGER_THRESHOLD
) {
  if (!gamepad) return false;
  const gamepadButton = gamepad.buttons[BUTTON_INDEX[button]];
  return Boolean(gamepadButton?.pressed || (gamepadButton?.value ?? 0) >= threshold);
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
