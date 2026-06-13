import {
  getDecayedRunePower,
  RUNE_POWER_DECAY_INTERVAL_MS,
  type RunePowerState,
} from "../../systems/spells/manaRechargeRuntime";

export const HUD_RUNE_POWER_DECAY_INTERVAL_MS = RUNE_POWER_DECAY_INTERVAL_MS;

export type HudRunePowerDecayTimerId = number;

export function shouldRunHudRunePowerDecay({
  controllerGameplayActive,
  hasRunePowerToDecay,
  isLocked,
  touchGameplayActive,
}: {
  controllerGameplayActive: boolean;
  hasRunePowerToDecay: boolean;
  isLocked: boolean;
  touchGameplayActive: boolean;
}) {
  return hasRunePowerToDecay && (isLocked || touchGameplayActive || controllerGameplayActive);
}

export function applyHudRunePowerDecay(
  state: RunePowerState,
  {
    setLeftRunePower,
    setRightRunePower,
  }: {
    setLeftRunePower: (value: number) => void;
    setRightRunePower: (value: number) => void;
  },
) {
  const decay = getDecayedRunePower(state);
  if (!decay) return null;

  if (decay.leftChanged) setLeftRunePower(decay.leftRunePower);
  if (decay.rightChanged) setRightRunePower(decay.rightRunePower);
  return decay;
}

export function installHudRunePowerDecayLoop({
  clearTimer,
  getState,
  intervalMs = HUD_RUNE_POWER_DECAY_INTERVAL_MS,
  setLeftRunePower,
  setRightRunePower,
  setTimer,
}: {
  clearTimer: (timerId: HudRunePowerDecayTimerId) => void;
  getState: () => RunePowerState;
  intervalMs?: number;
  setLeftRunePower: (value: number) => void;
  setRightRunePower: (value: number) => void;
  setTimer: (callback: () => void, delayMs: number) => HudRunePowerDecayTimerId;
}) {
  let cancelled = false;
  let decayTimer: HudRunePowerDecayTimerId | null = null;

  const decayRunePower = () => {
    if (cancelled) return;
    applyHudRunePowerDecay(getState(), { setLeftRunePower, setRightRunePower });
    decayTimer = setTimer(decayRunePower, intervalMs);
  };

  decayTimer = setTimer(decayRunePower, intervalMs);

  return () => {
    cancelled = true;
    if (decayTimer !== null) {
      clearTimer(decayTimer);
      decayTimer = null;
    }
  };
}
