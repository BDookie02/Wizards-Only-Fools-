import type { AspectRatioOption, ControllerAction } from "../../../store/gameStore";
import { controllerActionRows } from "../../systems/input/controllerSettingsConfig";
import type { HudStartMenuAction } from "./hudLaunchRulesRuntime";
import { resolveHudStartMenuAction } from "./hudLaunchRulesRuntime";
import type { StartMenuStage } from "./PauseStartMenuContent";
import {
  aspectRatioOptions,
  getSettingsPaneForTabIndex,
  keybindArrowLookIndex,
  keybindBackIndex,
  keybindControlStartIndex,
  keybindSensitivityStartIndex,
  videoAspectStartIndex,
  videoBackIndex,
  voiceEnabledIndex,
  voiceInputModeIndex,
  voiceOutputVolumeIndex,
  voiceProximityRangeIndex,
  voicePushToTalkKeyIndex,
  type SettingsPane,
} from "./hudSettingsPanelConfig";

export type HudPauseMenuAction =
  | { type: "select-settings-pane"; settingsPane: SettingsPane }
  | { type: "select-aspect-ratio"; aspectRatio: AspectRatioOption }
  | { type: "reset-mouse-sensitivity" }
  | { type: "reset-controller-look-sensitivity" }
  | { type: "toggle-keyboard-arrow-look" }
  | { type: "begin-controller-remap"; action: ControllerAction }
  | { type: "toggle-voice-enabled" }
  | { type: "toggle-voice-input-mode" }
  | { type: "begin-voice-key-remap" }
  | { type: "reset-voice-output-volume" }
  | { type: "reset-voice-proximity-range" }
  | { type: "character-step" }
  | { type: "close-settings-menu" }
  | { type: "start-menu-action"; action: HudStartMenuAction }
  | { type: "close-pause-menu" }
  | { type: "join-invite" }
  | { type: "copy-invite" }
  | { type: "open-settings-menu" };

export type HudPauseMenuActionOptions = {
  index: number;
  isMultiplayerMode: boolean;
  settingsPane: SettingsPane;
  showVideoMenu: boolean;
  startMenuStage: StartMenuStage;
};

export function resolveHudPauseMenuAction({
  index,
  isMultiplayerMode,
  settingsPane,
  showVideoMenu,
  startMenuStage,
}: HudPauseMenuActionOptions): HudPauseMenuAction {
  if (showVideoMenu) {
    const selectedSettingsPane = getSettingsPaneForTabIndex(index);
    if (selectedSettingsPane) {
      return { type: "select-settings-pane", settingsPane: selectedSettingsPane };
    }

    if (settingsPane === "video" && index >= videoAspectStartIndex && index < videoBackIndex) {
      return { type: "select-aspect-ratio", aspectRatio: aspectRatioOptions[index - videoAspectStartIndex] };
    }

    if (settingsPane === "keybinds") {
      if (index === keybindSensitivityStartIndex) return { type: "reset-mouse-sensitivity" };
      if (index === keybindSensitivityStartIndex + 1) return { type: "reset-controller-look-sensitivity" };
      if (index === keybindArrowLookIndex) return { type: "toggle-keyboard-arrow-look" };
      if (index >= keybindControlStartIndex && index < keybindBackIndex) {
        return { type: "begin-controller-remap", action: controllerActionRows[index - keybindControlStartIndex].action };
      }
    }

    if (settingsPane === "voice") {
      if (index === voiceEnabledIndex) return { type: "toggle-voice-enabled" };
      if (index === voiceInputModeIndex) return { type: "toggle-voice-input-mode" };
      if (index === voicePushToTalkKeyIndex) return { type: "begin-voice-key-remap" };
      if (index === voiceOutputVolumeIndex) return { type: "reset-voice-output-volume" };
      if (index === voiceProximityRangeIndex) return { type: "reset-voice-proximity-range" };
    }

    if (settingsPane === "character") return { type: "character-step" };
    return { type: "close-settings-menu" };
  }

  const startMenuAction = resolveHudStartMenuAction(startMenuStage, index);
  if (startMenuAction) return { type: "start-menu-action", action: startMenuAction };
  if (index === 0) return { type: "close-pause-menu" };
  if (!isMultiplayerMode) return { type: "open-settings-menu" };
  if (index === 1) return { type: "join-invite" };
  if (index === 2) return { type: "copy-invite" };
  return { type: "open-settings-menu" };
}
