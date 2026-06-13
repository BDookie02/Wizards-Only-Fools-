import type { HandType } from "../../../store/gameStore";

export type PlayerControllerButtonDownState = Record<string, boolean>;
export type PlayerControllerButtonRepeatState = Record<string, number>;

export type PlayerControllerHotbarAction = {
  hand: HandType;
  direction: 1 | -1;
};

export function handlePlayerControllerCastButtonForHand(
  hand: HandType,
  pressed: boolean,
  interactionHandled: boolean,
  magicArmed: boolean,
  controllerCastingDown: Record<HandType, boolean>,
  requestQuestVillagerInteraction: () => boolean,
  startHandCast: (hand: HandType) => void,
  releaseHandCast: (hand: HandType) => void,
) {
  if (interactionHandled) {
    controllerCastingDown[hand] = pressed;
    return true;
  }

  if (pressed && !controllerCastingDown[hand] && requestQuestVillagerInteraction()) {
    controllerCastingDown[hand] = true;
    return true;
  }

  const shouldCast = magicArmed && pressed;
  if (shouldCast && !controllerCastingDown[hand]) {
    startHandCast(hand);
  } else if (!shouldCast && controllerCastingDown[hand]) {
    releaseHandCast(hand);
  }
  controllerCastingDown[hand] = pressed;
  return false;
}

export function consumePlayerControllerHotbarPress(
  buttonDown: PlayerControllerButtonDownState,
  key: string,
  pressed: boolean,
) {
  const wasPressed = buttonDown[key] ?? false;
  buttonDown[key] = pressed;
  return pressed && !wasPressed;
}

export function consumePlayerControllerHotbarRepeat(
  buttonDown: PlayerControllerButtonDownState,
  repeatAt: PlayerControllerButtonRepeatState,
  key: string,
  pressed: boolean,
  now: number,
  firstDelay = 300,
  repeatDelay = 150,
) {
  const wasPressed = buttonDown[key] ?? false;
  buttonDown[key] = pressed;

  if (!pressed) {
    delete repeatAt[key];
    return false;
  }

  if (!wasPressed) {
    repeatAt[key] = now + firstDelay;
    return false;
  }

  if (now >= (repeatAt[key] ?? 0)) {
    repeatAt[key] = now + repeatDelay;
    return true;
  }

  return false;
}

export function resetPlayerControllerHotbarTracking(
  buttonDown: PlayerControllerButtonDownState,
  repeatAt: PlayerControllerButtonRepeatState,
) {
  for (const key in buttonDown) {
    if (!Object.prototype.hasOwnProperty.call(buttonDown, key)) continue;
    buttonDown[key] = false;
  }
  for (const key in repeatAt) {
    if (!Object.prototype.hasOwnProperty.call(repeatAt, key)) continue;
    delete repeatAt[key];
  }
}

export type PlayerControllerHotbarResolutionOptions = {
  buttonDown: PlayerControllerButtonDownState;
  repeatAt: PlayerControllerButtonRepeatState;
  now: number;
  leftBumperHeld: boolean;
  rightBumperHeld: boolean;
  dpadLeft: boolean;
  dpadRight: boolean;
};

export function resolvePlayerControllerHotbarActions({
  buttonDown,
  repeatAt,
  now,
  leftBumperHeld,
  rightBumperHeld,
  dpadLeft,
  dpadRight,
}: PlayerControllerHotbarResolutionOptions) {
  const actions: PlayerControllerHotbarAction[] = [];
  const leftBumperPressed = consumePlayerControllerHotbarPress(buttonDown, "leftBumperHotbar", leftBumperHeld);
  const rightBumperPressed = consumePlayerControllerHotbarPress(buttonDown, "rightBumperHotbar", rightBumperHeld);
  const leftHotbarPrevPressed = consumePlayerControllerHotbarRepeat(buttonDown, repeatAt, "leftHotbarPrev", leftBumperHeld && dpadLeft, now);
  const leftHotbarNextPressed = consumePlayerControllerHotbarRepeat(buttonDown, repeatAt, "leftHotbarNext", leftBumperHeld && dpadRight, now);
  const rightHotbarPrevPressed = consumePlayerControllerHotbarRepeat(buttonDown, repeatAt, "rightHotbarPrev", rightBumperHeld && dpadLeft, now);
  const rightHotbarNextPressed = consumePlayerControllerHotbarRepeat(buttonDown, repeatAt, "rightHotbarNext", rightBumperHeld && dpadRight, now);

  if (leftBumperPressed) {
    actions.push({ hand: "left", direction: dpadLeft ? -1 : 1 });
  } else if (leftHotbarPrevPressed) {
    actions.push({ hand: "left", direction: -1 });
  } else if (leftHotbarNextPressed) {
    actions.push({ hand: "left", direction: 1 });
  }

  if (rightBumperPressed) {
    actions.push({ hand: "right", direction: dpadLeft ? -1 : 1 });
  } else if (rightHotbarPrevPressed) {
    actions.push({ hand: "right", direction: -1 });
  } else if (rightHotbarNextPressed) {
    actions.push({ hand: "right", direction: 1 });
  }

  return actions;
}
