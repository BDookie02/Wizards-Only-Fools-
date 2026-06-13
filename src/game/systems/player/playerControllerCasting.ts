import type { HandType } from "../../../store/gameStore";
import { useGameStore } from "../../../store/gameStore";
import {
  createControllerPollScheduler,
  GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS,
  getPrimaryGamepad,
  isGamepadButtonPressed,
  type GamepadButtonName,
} from "../input/controllerInput";
import {
  handlePlayerControllerCastButtonForHand,
  resetPlayerControllerHotbarTracking,
  resolvePlayerControllerHotbarActions,
} from "./playerControllerCastingRuntime";

export type PlayerControllerCastingLoopOptions = {
  canUseGameplayInput: () => boolean;
  requestQuestVillagerInteraction: () => boolean;
  startHandCast: (hand: HandType) => void;
  releaseHandCast: (hand: HandType) => void;
};

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
    castButtonInteractionHandled = handlePlayerControllerCastButtonForHand(
      "left",
      leftCastPressed,
      castButtonInteractionHandled,
      magicArmed,
      controllerCastingDown,
      requestQuestVillagerInteraction,
      startHandCast,
      releaseHandCast,
    );
    handlePlayerControllerCastButtonForHand(
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

      const hotbarActions = resolvePlayerControllerHotbarActions({
        buttonDown: controllerHotbarDown,
        repeatAt: controllerHotbarRepeatAt,
        now,
        leftBumperHeld,
        rightBumperHeld,
        dpadLeft,
        dpadRight,
      });
      for (const action of hotbarActions) {
        scrollControllerHand(action.hand, action.direction);
      }
    } else {
      resetPlayerControllerHotbarTracking(controllerHotbarDown, controllerHotbarRepeatAt);
    }

    controllerCastingScheduler.schedule(gamepad ? 0 : GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS);
  };

  controllerCastingScheduler = createControllerPollScheduler(pollControllerCasting);
  controllerCastingScheduler.schedule(0);
  return () => controllerCastingScheduler.cancel();
}
