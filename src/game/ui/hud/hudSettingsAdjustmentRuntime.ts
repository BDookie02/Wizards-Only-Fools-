import {
  keybindArrowLookIndex,
  keybindSensitivityStartIndex,
  voiceEnabledIndex,
  voiceInputModeIndex,
  voiceOutputVolumeIndex,
  voiceProximityRangeIndex,
  type SettingsPane,
} from "./hudSettingsPanelConfig";

export type HudFocusedSettingAdjustmentAction =
  | { type: "lobby-map" }
  | { type: "lobby-max-players" }
  | { type: "lobby-difficulty" }
  | { type: "lobby-mana-rate" }
  | { type: "survival-max-players" }
  | { type: "survival-difficulty" }
  | { type: "survival-mana-rate" }
  | { type: "mouse-sensitivity"; direction: 1 | -1 }
  | { type: "controller-look-sensitivity"; direction: 1 | -1 }
  | { type: "keyboard-arrow-look" }
  | { type: "voice-enabled" }
  | { type: "voice-input-mode" }
  | { type: "voice-output-volume"; direction: 1 | -1 }
  | { type: "voice-proximity-range"; direction: 1 | -1 }
  | { type: "character-step"; direction: 1 | -1 };

export function resolveHudFocusedSettingAdjustment({
  direction,
  pauseMenuIndex,
  settingsPane,
  showVideoMenu,
  startMenuStage,
}: {
  direction: 1 | -1;
  pauseMenuIndex: number;
  settingsPane: SettingsPane;
  showVideoMenu: boolean;
  startMenuStage: string;
}): HudFocusedSettingAdjustmentAction | null {
  if (!showVideoMenu) {
    if (startMenuStage === "custom-lobby") {
      if (pauseMenuIndex === 0) return { type: "lobby-map" };
      if (pauseMenuIndex === 1) return { type: "lobby-max-players" };
      if (pauseMenuIndex === 2) return { type: "lobby-difficulty" };
      if (pauseMenuIndex === 3) return { type: "lobby-mana-rate" };
    }

    if (startMenuStage === "survival-options") {
      if (pauseMenuIndex === 0) return { type: "survival-max-players" };
      if (pauseMenuIndex === 1) return { type: "survival-difficulty" };
      if (pauseMenuIndex === 2) return { type: "survival-mana-rate" };
    }

    return null;
  }

  if (settingsPane === "keybinds") {
    if (pauseMenuIndex === keybindSensitivityStartIndex) {
      return { type: "mouse-sensitivity", direction };
    }
    if (pauseMenuIndex === keybindSensitivityStartIndex + 1) {
      return { type: "controller-look-sensitivity", direction };
    }
    if (pauseMenuIndex === keybindArrowLookIndex) {
      return { type: "keyboard-arrow-look" };
    }
  }

  if (settingsPane === "voice") {
    if (pauseMenuIndex === voiceEnabledIndex) return { type: "voice-enabled" };
    if (pauseMenuIndex === voiceInputModeIndex) return { type: "voice-input-mode" };
    if (pauseMenuIndex === voiceOutputVolumeIndex) return { type: "voice-output-volume", direction };
    if (pauseMenuIndex === voiceProximityRangeIndex) return { type: "voice-proximity-range", direction };
  }

  if (settingsPane === "character") {
    return { type: "character-step", direction };
  }

  return null;
}
