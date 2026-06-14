import {
  GAMEPAD_TRIGGER_THRESHOLD,
  applyGamepadDeadzone,
} from "./controllerInputRuntime";

export type GamepadSelectionSnapshot = {
  connectedCount: number;
  connectedGamepad: Gamepad | null;
  hasUsefulTimestamp: boolean;
  signature: string;
};

export type PrimaryGamepadSelectionOptions = {
  gamepads: readonly (Gamepad | null)[];
  snapshot: GamepadSelectionSnapshot;
  preferredGamepadIndex: number | null;
  cachedPrimaryGamepadIndex: number | null;
  cachedGamepadSignature: string;
  activeGamepadActivityThreshold?: number;
};

export type PrimaryGamepadSelectionResult = {
  selectedGamepad: Gamepad | null;
  preferredGamepadIndex: number | null;
  cachedPrimaryGamepadIndex: number | null;
  cachedGamepadSignature: string;
};

export function getConnectedGamepadByIndex(gamepads: readonly (Gamepad | null)[], gamepadIndex: number) {
  for (let index = 0; index < gamepads.length; index += 1) {
    const gamepad = gamepads[index];
    if (gamepad?.connected && gamepad.index === gamepadIndex) return gamepad;
  }
  return null;
}

export function getGamepadSelectionSnapshot(gamepads: readonly (Gamepad | null)[]): GamepadSelectionSnapshot {
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

export function getGamepadActivity(gamepad: Gamepad) {
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

export function selectPrimaryGamepad({
  gamepads,
  snapshot,
  preferredGamepadIndex,
  cachedPrimaryGamepadIndex,
  cachedGamepadSignature,
  activeGamepadActivityThreshold = 0.02,
}: PrimaryGamepadSelectionOptions): PrimaryGamepadSelectionResult {
  if (snapshot.connectedCount === 0) {
    return {
      selectedGamepad: null,
      preferredGamepadIndex: null,
      cachedPrimaryGamepadIndex: null,
      cachedGamepadSignature: "",
    };
  }

  if (snapshot.connectedCount === 1 && snapshot.connectedGamepad) {
    return {
      selectedGamepad: snapshot.connectedGamepad,
      preferredGamepadIndex: snapshot.connectedGamepad.index,
      cachedPrimaryGamepadIndex: snapshot.connectedGamepad.index,
      cachedGamepadSignature: snapshot.signature,
    };
  }

  if (
    snapshot.hasUsefulTimestamp &&
    cachedPrimaryGamepadIndex !== null &&
    cachedGamepadSignature === snapshot.signature
  ) {
    const cachedGamepad = getConnectedGamepadByIndex(gamepads, cachedPrimaryGamepadIndex);
    if (cachedGamepad) {
      return {
        selectedGamepad: cachedGamepad,
        preferredGamepadIndex,
        cachedPrimaryGamepadIndex,
        cachedGamepadSignature,
      };
    }
  }

  let fallbackGamepad: Gamepad | null = null;
  let standardGamepad: Gamepad | null = null;
  let preferredGamepad: Gamepad | null = null;
  let activeGamepad: Gamepad | null = null;
  let activeGamepadActivity = activeGamepadActivityThreshold;

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
  const nextPreferredGamepadIndex = selectedGamepad?.index ?? null;

  return {
    selectedGamepad,
    preferredGamepadIndex: nextPreferredGamepadIndex,
    cachedPrimaryGamepadIndex: nextPreferredGamepadIndex,
    cachedGamepadSignature: snapshot.hasUsefulTimestamp ? snapshot.signature : "",
  };
}
