import type { CSSProperties } from "react";
import {
  CONTROLLER_LOOK_SENSITIVITY_100_PERCENT,
  DEFAULT_CHARACTER_CUSTOMIZATION,
  DEFAULT_CONTROLLER_LOOK_SENSITIVITY,
  DEFAULT_MOUSE_SENSITIVITY,
  DEFAULT_VOICE_OUTPUT_VOLUME,
  DEFAULT_VOICE_PROXIMITY_RANGE,
  type CharacterCustomization,
  type VoiceInputMode,
} from "../../../store/gameStore";
import { formatKeyboardCode, isValidHexColor, normalizeHexInput } from "./hudSettingsUtils";
import {
  getSettingsBackIndexForPane,
  type SettingsPane,
} from "./hudSettingsPanelConfig";

export type CharacterColorInputState = {
  rawValue: string;
  normalizedValue: string;
  fallbackValue: string;
  pickerValue: string;
  valid: boolean;
};

export function isSettingsIndexFocused(pauseMenuIndex: number, index: number) {
  return pauseMenuIndex === index;
}

export function getSettingsBackIndex(settingsPane: SettingsPane) {
  return getSettingsBackIndexForPane(settingsPane);
}

const settingsMenuStyles: Record<SettingsPane, CSSProperties> = {
  video: {
    width: "min(520px, calc(100cqw - 24px))",
    maxHeight: "calc(100cqh - 20px)",
    padding: "clamp(0.35rem, 1.2cqh, 0.9rem)",
  },
  keybinds: {
    width: "min(920px, calc(100cqw - 24px))",
    maxHeight: "calc(100cqh - 20px)",
    padding: "clamp(0.35rem, 1.2cqh, 0.9rem)",
  },
  voice: {
    width: "min(720px, calc(100cqw - 24px))",
    maxHeight: "calc(100cqh - 20px)",
    padding: "clamp(0.35rem, 1.2cqh, 0.9rem)",
  },
  character: {
    width: "min(920px, calc(100cqw - 24px))",
    maxHeight: "calc(100cqh - 20px)",
    padding: "clamp(0.35rem, 1.2cqh, 0.9rem)",
  },
};

const defaultSettingsScrollPanelStyle: CSSProperties = {
  maxHeight: "max(128px, calc(100cqh - 148px))",
};

const characterSettingsScrollPanelStyle: CSSProperties = {
  maxHeight: "max(128px, calc(100cqh - 150px))",
};

export function getSettingsMenuStyle(settingsPane: SettingsPane): CSSProperties {
  return settingsMenuStyles[settingsPane];
}

export function getSettingsScrollPanelStyle(settingsPane: SettingsPane): CSSProperties {
  return settingsPane === "character" ? characterSettingsScrollPanelStyle : defaultSettingsScrollPanelStyle;
}

export function formatMouseSensitivityPercent(mouseSensitivity: number) {
  return `${Math.round((mouseSensitivity / DEFAULT_MOUSE_SENSITIVITY) * 100)}%`;
}

export function formatControllerLookSensitivityPercent(controllerLookSensitivity: number) {
  return `${Math.round((controllerLookSensitivity / CONTROLLER_LOOK_SENSITIVITY_100_PERCENT) * 100)}%`;
}

export function getDefaultControllerLookSensitivity() {
  return DEFAULT_CONTROLLER_LOOK_SENSITIVITY;
}

export function getVoiceEnabledLabel(enabled: boolean) {
  return enabled ? "Enabled" : "Disabled";
}

export function getVoiceInputModeLabel(inputMode: VoiceInputMode) {
  return inputMode === "pushToTalk" ? "Press To Talk" : "Open Mic";
}

export function getVoicePushToTalkKeyLabel(remappingVoiceKey: boolean, voicePushToTalkKey: string) {
  return remappingVoiceKey ? "Press Key..." : formatKeyboardCode(voicePushToTalkKey);
}

export function formatVoiceOutputVolumePercent(voiceOutputVolume: number) {
  return `${Math.round(voiceOutputVolume * 100)}%`;
}

export function getDefaultVoiceOutputVolume() {
  return DEFAULT_VOICE_OUTPUT_VOLUME;
}

export function formatVoiceProximityRangeMeters(voiceProximityRange: number) {
  return `${Math.round(voiceProximityRange)}m`;
}

export function getDefaultVoiceProximityRange() {
  return DEFAULT_VOICE_PROXIMITY_RANGE;
}

export function getVoiceActivityLabel(isVoiceSpeaking: boolean, voiceChatEnabled: boolean) {
  if (isVoiceSpeaking) return "Talking";
  return voiceChatEnabled ? "Quiet" : "Off";
}

export function getVoiceActivityMeterWidth(isVoiceSpeaking: boolean, voiceChatEnabled: boolean) {
  if (isVoiceSpeaking) return "100%";
  return voiceChatEnabled ? "32%" : "0%";
}

export function getVoiceStatusText(voiceError: string, voiceStatus: string) {
  return voiceError ? `ERROR: ${voiceError}` : `STATUS: ${voiceStatus}`;
}

export function getDefaultCharacterCustomization() {
  return { ...DEFAULT_CHARACTER_CUSTOMIZATION };
}

export function getCharacterColorInputState(
  characterCustomization: CharacterCustomization,
  key: keyof CharacterCustomization,
): CharacterColorInputState {
  const rawValue = String(characterCustomization[key] ?? "");
  const normalizedValue = normalizeHexInput(rawValue);
  const fallbackValue = String(DEFAULT_CHARACTER_CUSTOMIZATION[key] ?? "#ffffff");
  const valid = isValidHexColor(normalizedValue);
  const pickerValue = valid ? normalizedValue : fallbackValue;
  return { rawValue, normalizedValue, fallbackValue, pickerValue, valid };
}

export function getCharacterOptionValue(
  characterCustomization: CharacterCustomization,
  key: keyof CharacterCustomization,
  fallback: string,
) {
  return String(characterCustomization[key] ?? fallback);
}
