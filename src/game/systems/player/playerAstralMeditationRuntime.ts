import { isEditableTarget } from "../input/editableTargets";
import { isMeditationControl, keys } from "../input/playerInputState";
import {
  isPlayerGameplayBlocked,
  type PlayerGameplayInputGateState,
} from "./playerGameplayInputGate";
import { ASTRAL_EXIT_HOLD_MS } from "./playerMovementConfig";

type MutableRef<T> = { current: T };

export type PlayerAstralMeditationState = PlayerGameplayInputGateState & {
  setAstralMeditating: (active: boolean) => void;
};

export type PlayerAstralMeditationKeyOptions = {
  state: PlayerAstralMeditationState;
  astralExitHoldStartedAt: MutableRef<number | null>;
  astralExitArmed: MutableRef<boolean>;
  stopAllCasting: () => void;
  resetMovementKeys: () => void;
  getNowMs: () => number;
};

export function handlePlayerMeditationKeyDown(
  event: KeyboardEvent,
  {
    state,
    astralExitHoldStartedAt,
    astralExitArmed,
    stopAllCasting,
    resetMovementKeys,
    getNowMs,
  }: PlayerAstralMeditationKeyOptions,
) {
  if (!isMeditationControl(event.code) || isEditableTarget(event.target)) return false;
  if (isPlayerGameplayBlocked(state, {
    blockSpellMenu: true,
    blockQuestEditor: true,
    astralActive: false,
  })) {
    return false;
  }

  event.preventDefault();
  if (!state.isAstralMeditating) {
    stopAllCasting();
    resetMovementKeys();
    state.setAstralMeditating(true);
    astralExitHoldStartedAt.current = null;
    astralExitArmed.current = false;
    return true;
  }

  if (!astralExitArmed.current) return true;
  if (astralExitHoldStartedAt.current === null) {
    astralExitHoldStartedAt.current = getNowMs();
  }
  return true;
}

export function handlePlayerMeditationKeyUp(
  event: KeyboardEvent,
  {
    state,
    astralExitHoldStartedAt,
    astralExitArmed,
  }: Pick<PlayerAstralMeditationKeyOptions, "state" | "astralExitHoldStartedAt" | "astralExitArmed">,
) {
  if (!isMeditationControl(event.code)) return false;
  if (!keys.ControlLeft && !keys.ControlRight) {
    astralExitHoldStartedAt.current = null;
    if (state.isAstralMeditating) {
      astralExitArmed.current = true;
    }
  }
  return true;
}

export function updatePlayerMeditationExitHold(
  state: PlayerAstralMeditationState,
  nowMs: number,
  astralExitHoldStartedAt: MutableRef<number | null>,
) {
  if (state.isAstralMeditating && astralExitHoldStartedAt.current !== null && nowMs - astralExitHoldStartedAt.current >= ASTRAL_EXIT_HOLD_MS) {
    state.setAstralMeditating(false);
    astralExitHoldStartedAt.current = null;
    return false;
  }
  return state.isAstralMeditating;
}
