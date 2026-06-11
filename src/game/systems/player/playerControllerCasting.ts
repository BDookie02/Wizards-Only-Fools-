import type { HandType } from "../../../store/gameStore";
import { useGameStore } from "../../../store/gameStore";
import {
  createControllerPollScheduler,
  GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS,
  getPrimaryGamepad,
  isGamepadButtonPressed,
  type GamepadButtonName,
} from "../input/controllerInput";

export type PlayerControllerCastingLoopOptions = {
  canUseGameplayInput: () => boolean;
  requestQuestVillagerInteraction: () => boolean;
  startHandCast: (hand: HandType) => void;
  releaseHandCast: (hand: HandType) => void;
};

function updateControllerCastButtonForHand(
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

export function startPlayerControllerCastingLoop({
  canUseGameplayInput,
  requestQuestVillagerInteraction,
  startHandCast,
  releaseHandCast,
}: PlayerControllerCastingLoopOptions) {
  if (typeof window === "undefined") return () => {};

  const controllerCastingDown: Record<HandType, boolean> = { left: false, right: false };
  const controllerHotbarDown: Record<string, boolean> = {};
  const controllerHotbarRepeatAt: Record<string, number> = {};

  const consumeHotbarPress = (key: string, pressed: boolean) => {
    const wasPressed = controllerHotbarDown[key] ?? false;
    controllerHotbarDown[key] = pressed;
    return pressed && !wasPressed;
  };

  const consumeHotbarRepeat = (
    key: string,
    pressed: boolean,
    now: number,
    firstDelay = 300,
    repeatDelay = 150,
  ) => {
    const wasPressed = controllerHotbarDown[key] ?? false;
    controllerHotbarDown[key] = pressed;

    if (!pressed) {
      delete controllerHotbarRepeatAt[key];
      return false;
    }

    if (!wasPressed) {
      controllerHotbarRepeatAt[key] = now + firstDelay;
      return false;
    }

    if (now >= (controllerHotbarRepeatAt[key] ?? 0)) {
      controllerHotbarRepeatAt[key] = now + repeatDelay;
      return true;
    }

    return false;
  };

  const scrollControllerHand = (hand: HandType, direction: 1 | -1) => {
    const store = useGameStore.getState();
    if (direction > 0) {
      store.nextSpell(hand);
    } else {
      store.prevSpell(hand);
    }
    store.setActiveHand(hand);
  };

  let controllerCastingScheduler: ReturnType<typeof createControllerPollScheduler>;
  const pollControllerCasting = (now: number) => {
    const gamepad = getPrimaryGamepad();
    const store = useGameStore.getState();
    const magicArmed = store.isMagicArmed;
    const gameplayInputActive = Boolean(gamepad && canUseGameplayInput());
    const canUseCastButtons = gameplayInputActive && !store.isSpellMenuOpen;
    const leftCastPressed = canUseCastButtons && isGamepadButtonPressed(gamepad, store.controllerBindings.leftCast as GamepadButtonName);
    const rightCastPressed = canUseCastButtons && isGamepadButtonPressed(gamepad, store.controllerBindings.rightCast as GamepadButtonName);
    let castButtonInteractionHandled = false;
    castButtonInteractionHandled = updateControllerCastButtonForHand(
      "left",
      leftCastPressed,
      castButtonInteractionHandled,
      magicArmed,
      controllerCastingDown,
      requestQuestVillagerInteraction,
      startHandCast,
      releaseHandCast,
    );
    updateControllerCastButtonForHand(
      "right",
      rightCastPressed,
      castButtonInteractionHandled,
      magicArmed,
      controllerCastingDown,
      requestQuestVillagerInteraction,
      startHandCast,
      releaseHandCast,
    );

    if (gamepad && gameplayInputActive && !store.isSpellMenuOpen && magicArmed) {
      const leftBumperHeld = isGamepadButtonPressed(gamepad, store.controllerBindings.leftHotbar as GamepadButtonName);
      const rightBumperHeld = isGamepadButtonPressed(gamepad, store.controllerBindings.rightHotbar as GamepadButtonName);
      const dpadLeft = isGamepadButtonPressed(gamepad, "dpadLeft");
      const dpadRight = isGamepadButtonPressed(gamepad, "dpadRight");
      const leftBumperPressed = consumeHotbarPress("leftBumperHotbar", leftBumperHeld);
      const rightBumperPressed = consumeHotbarPress("rightBumperHotbar", rightBumperHeld);
      const leftHotbarPrevPressed = consumeHotbarRepeat("leftHotbarPrev", leftBumperHeld && dpadLeft, now);
      const leftHotbarNextPressed = consumeHotbarRepeat("leftHotbarNext", leftBumperHeld && dpadRight, now);
      const rightHotbarPrevPressed = consumeHotbarRepeat("rightHotbarPrev", rightBumperHeld && dpadLeft, now);
      const rightHotbarNextPressed = consumeHotbarRepeat("rightHotbarNext", rightBumperHeld && dpadRight, now);

      if (leftBumperPressed) {
        scrollControllerHand("left", dpadLeft ? -1 : 1);
      } else if (leftHotbarPrevPressed) {
        scrollControllerHand("left", -1);
      } else if (leftHotbarNextPressed) {
        scrollControllerHand("left", 1);
      }

      if (rightBumperPressed) {
        scrollControllerHand("right", dpadLeft ? -1 : 1);
      } else if (rightHotbarPrevPressed) {
        scrollControllerHand("right", -1);
      } else if (rightHotbarNextPressed) {
        scrollControllerHand("right", 1);
      }
    } else {
      for (const key in controllerHotbarDown) {
        if (!Object.prototype.hasOwnProperty.call(controllerHotbarDown, key)) continue;
        controllerHotbarDown[key] = false;
      }
      for (const key in controllerHotbarRepeatAt) {
        if (!Object.prototype.hasOwnProperty.call(controllerHotbarRepeatAt, key)) continue;
        delete controllerHotbarRepeatAt[key];
      }
    }

    controllerCastingScheduler.schedule(gamepad ? 0 : GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS);
  };

  controllerCastingScheduler = createControllerPollScheduler(pollControllerCasting);
  controllerCastingScheduler.schedule(0);
  return () => controllerCastingScheduler.cancel();
}
