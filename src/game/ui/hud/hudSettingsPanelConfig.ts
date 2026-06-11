import { ASPECT_RATIO_OPTIONS } from "../../../store/gameStore";
import { controllerActionRows } from "../../systems/input/controllerSettingsConfig";
import { characterColorRows, characterMouthRows, characterStyleRows } from "./characterCustomizationConfig";

export type SettingsPane = "video" | "keybinds" | "voice" | "character";

export const aspectRatioOptions = ASPECT_RATIO_OPTIONS;
export const pauseMenuItemCount = 4;
export const settingsTabCount = 4;
export const videoAspectStartIndex = settingsTabCount;
export const videoBackIndex = videoAspectStartIndex + aspectRatioOptions.length;
export const settingsVideoActionCount = videoBackIndex + 1;
export const settingsPaneOrder: SettingsPane[] = ["video", "keybinds", "voice", "character"];

export const keybindSensitivityStartIndex = settingsTabCount;
export const keybindArrowLookIndex = keybindSensitivityStartIndex + 2;
export const keybindControlStartIndex = keybindSensitivityStartIndex + 3;
export const keybindBackIndex = keybindControlStartIndex + controllerActionRows.length;
export const settingsKeybindActionCount = keybindBackIndex + 1;

export const voiceSettingsStartIndex = settingsTabCount;
export const voiceEnabledIndex = voiceSettingsStartIndex;
export const voiceInputModeIndex = voiceSettingsStartIndex + 1;
export const voicePushToTalkKeyIndex = voiceSettingsStartIndex + 2;
export const voiceOutputVolumeIndex = voiceSettingsStartIndex + 3;
export const voiceProximityRangeIndex = voiceSettingsStartIndex + 4;
export const voiceBackIndex = voiceSettingsStartIndex + 5;
export const settingsVoiceActionCount = voiceBackIndex + 1;

export const characterColorStartIndex = settingsTabCount;
export const characterStyleStartIndex = characterColorStartIndex + characterColorRows.length;
export const characterMouthStartIndex = characterStyleStartIndex + characterStyleRows.length;
export const characterBackIndex = characterMouthStartIndex + characterMouthRows.length;
export const settingsCharacterActionCount = characterBackIndex + 1;

export type SettingsPaneMetadata = {
  tabIndex: number;
  backIndex: number;
  actionCount: number;
};

export const settingsPaneMetadata: Record<SettingsPane, SettingsPaneMetadata> = {
  video: { tabIndex: 0, backIndex: videoBackIndex, actionCount: settingsVideoActionCount },
  keybinds: { tabIndex: 1, backIndex: keybindBackIndex, actionCount: settingsKeybindActionCount },
  voice: { tabIndex: 2, backIndex: voiceBackIndex, actionCount: settingsVoiceActionCount },
  character: { tabIndex: 3, backIndex: characterBackIndex, actionCount: settingsCharacterActionCount },
};

export function getSettingsActionCount(settingsPane: SettingsPane) {
  return settingsPaneMetadata[settingsPane].actionCount;
}

export function getSettingsBackIndexForPane(settingsPane: SettingsPane) {
  return settingsPaneMetadata[settingsPane].backIndex;
}

export function getSettingsPaneForTabIndex(index: number): SettingsPane | null {
  return index >= 0 && index < settingsPaneOrder.length ? settingsPaneOrder[index] : null;
}
