import type { GameMode, SurvivalGameMode } from "../../../store/gameStore";

export const HUD_SURVIVAL_AUTOSAVE_INTERVAL_MS = 15000;

export type HudSurvivalAutosaveTimerId = number;

export function isHudSurvivalGameMode(mode: GameMode): mode is SurvivalGameMode {
  return mode === "solo-survival" || mode === "multiplayer-survival";
}

export function shouldRunHudSurvivalAutosave({
  isGameLaunched,
  hasSurvivalSave,
  survivalMode,
}: {
  isGameLaunched: boolean;
  hasSurvivalSave: boolean;
  survivalMode: SurvivalGameMode | null;
}) {
  return isGameLaunched && hasSurvivalSave && survivalMode !== null;
}

export function installHudSurvivalAutosaveLoop({
  save,
  setTimer,
  clearTimer,
  intervalMs = HUD_SURVIVAL_AUTOSAVE_INTERVAL_MS,
}: {
  save: () => void;
  setTimer: (callback: () => void, delayMs: number) => HudSurvivalAutosaveTimerId;
  clearTimer: (timerId: HudSurvivalAutosaveTimerId) => void;
  intervalMs?: number;
}) {
  let cancelled = false;
  let autosaveTimer: HudSurvivalAutosaveTimerId | null = null;

  const scheduleAutosave = () => {
    autosaveTimer = setTimer(() => {
      if (cancelled) return;
      save();
      scheduleAutosave();
    }, intervalMs);
  };

  scheduleAutosave();

  return () => {
    cancelled = true;
    if (autosaveTimer !== null) {
      clearTimer(autosaveTimer);
      autosaveTimer = null;
    }
  };
}
