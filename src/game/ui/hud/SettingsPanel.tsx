import { type RefObject } from "react";
import {
  type AspectRatioOption,
  type CharacterCustomization,
  type ControllerAction,
  type ControllerButtonName,
  type VoiceInputMode,
} from "../../../store/gameStore";
import {
  settingsPaneMetadata,
  type SettingsPane,
} from "./hudSettingsPanelConfig";
import {
  getSettingsBackIndex,
  getSettingsMenuStyle,
  getSettingsScrollPanelStyle,
  isSettingsIndexFocused,
} from "./settingsPanelRuntime";
import {
  cn,
  focusedMenuClass,
  settingsTabButtons,
} from "./settingsPanelClassNames";
import { SettingsCharacterPane } from "./SettingsCharacterPane";
import { SettingsKeybindsPane } from "./SettingsKeybindsPane";
import { SettingsTabButton } from "./SettingsTabButton";
import { SettingsVideoPane } from "./SettingsVideoPane";
import { SettingsVoicePane } from "./SettingsVoicePane";

type SettingsPanelProps = {
  settingsPane: SettingsPane;
  setSettingsPane: (pane: SettingsPane) => void;
  pauseMenuIndex: number;
  setPauseMenuIndex: (index: number) => void;
  settingsScrollRef: RefObject<HTMLDivElement | null>;
  aspectRatio: AspectRatioOption;
  setAspectRatio: (ratio: AspectRatioOption | string) => void;
  mouseSensitivity: number;
  setMouseSensitivity: (value: number) => void;
  controllerLookSensitivity: number;
  setControllerLookSensitivity: (value: number) => void;
  keyboardArrowLookEnabled: boolean;
  setKeyboardArrowLookEnabled: (enabled: boolean) => void;
  controllerBindings: Record<ControllerAction, ControllerButtonName>;
  remappingAction: ControllerAction | null;
  beginControllerRemap: (action: ControllerAction) => void;
  voiceNeedsSecureOrigin: boolean;
  voiceChatEnabled: boolean;
  setVoiceChatEnabled: (enabled: boolean) => void;
  voiceInputMode: VoiceInputMode;
  toggleVoiceInputMode: () => void;
  voicePushToTalkKey: string;
  beginVoiceKeyRemap: () => void;
  remappingVoiceKey: boolean;
  voiceOutputVolume: number;
  setVoiceOutputVolume: (value: number) => void;
  voiceProximityRange: number;
  setVoiceProximityRange: (value: number) => void;
  isVoiceSpeaking: boolean;
  voiceStatus: string;
  voiceError: string;
  characterCustomization: CharacterCustomization;
  setCharacterCustomization: (updates: Partial<CharacterCustomization>) => void;
  onBack: () => void;
};

export function SettingsPanel({
  settingsPane,
  setSettingsPane,
  pauseMenuIndex,
  setPauseMenuIndex,
  settingsScrollRef,
  aspectRatio,
  setAspectRatio,
  mouseSensitivity,
  setMouseSensitivity,
  controllerLookSensitivity,
  setControllerLookSensitivity,
  keyboardArrowLookEnabled,
  setKeyboardArrowLookEnabled,
  controllerBindings,
  remappingAction,
  beginControllerRemap,
  voiceNeedsSecureOrigin,
  voiceChatEnabled,
  setVoiceChatEnabled,
  voiceInputMode,
  toggleVoiceInputMode,
  voicePushToTalkKey,
  beginVoiceKeyRemap,
  remappingVoiceKey,
  voiceOutputVolume,
  setVoiceOutputVolume,
  voiceProximityRange,
  setVoiceProximityRange,
  isVoiceSpeaking,
  voiceStatus,
  voiceError,
  characterCustomization,
  setCharacterCustomization,
  onBack,
}: SettingsPanelProps) {
  const settingsMenuStyle = getSettingsMenuStyle(settingsPane);
  const settingsScrollPanelStyle = getSettingsScrollPanelStyle(settingsPane);
  const settingsFocus = (index: number) => isSettingsIndexFocused(pauseMenuIndex, index);
  const selectPane = (pane: SettingsPane, index: number) => {
    setSettingsPane(pane);
    setPauseMenuIndex(index);
  };
  const settingsBackIndex = getSettingsBackIndex(settingsPane);

  return (
    <div
      data-wof-hud-qa="settings-panel"
      className="settings-panel pointer-events-auto flex flex-col items-center gap-2 border-[3px] border-purple-500 bg-[#120c16] shadow-[0_0_28px_rgba(168,85,247,0.28)]"
      style={settingsMenuStyle}
    >
      <h2 className="settings-panel-title font-bold tracking-widest text-white" style={{ fontSize: "var(--settings-title-font-size)", marginBottom: "clamp(0.05rem, 0.45vmin, 0.5rem)" }}>
        SETTINGS
      </h2>

      <div className="settings-tab-grid grid w-full grid-cols-4 gap-2">
        {settingsTabButtons.map(({ pane, label, activeClassName }) => {
          const tabIndex = settingsPaneMetadata[pane].tabIndex;
          return (
            <SettingsTabButton
              key={pane}
              index={tabIndex}
              label={label}
              active={settingsPane === pane}
              activeClassName={activeClassName}
              isFocused={settingsFocus(tabIndex)}
              onFocus={() => setPauseMenuIndex(tabIndex)}
              onSelect={() => selectPane(pane, tabIndex)}
            />
          );
        })}
      </div>

      {settingsPane === "video" ? (
        <SettingsVideoPane
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          settingsFocus={settingsFocus}
          setPauseMenuIndex={setPauseMenuIndex}
        />
      ) : settingsPane === "keybinds" ? (
        <SettingsKeybindsPane
          settingsScrollRef={settingsScrollRef}
          settingsScrollPanelStyle={settingsScrollPanelStyle}
          mouseSensitivity={mouseSensitivity}
          setMouseSensitivity={setMouseSensitivity}
          controllerLookSensitivity={controllerLookSensitivity}
          setControllerLookSensitivity={setControllerLookSensitivity}
          keyboardArrowLookEnabled={keyboardArrowLookEnabled}
          setKeyboardArrowLookEnabled={setKeyboardArrowLookEnabled}
          controllerBindings={controllerBindings}
          remappingAction={remappingAction}
          beginControllerRemap={beginControllerRemap}
          settingsFocus={settingsFocus}
          setPauseMenuIndex={setPauseMenuIndex}
        />
      ) : settingsPane === "voice" ? (
        <SettingsVoicePane
          settingsScrollRef={settingsScrollRef}
          settingsScrollPanelStyle={settingsScrollPanelStyle}
          voiceNeedsSecureOrigin={voiceNeedsSecureOrigin}
          voiceChatEnabled={voiceChatEnabled}
          setVoiceChatEnabled={setVoiceChatEnabled}
          voiceInputMode={voiceInputMode}
          toggleVoiceInputMode={toggleVoiceInputMode}
          voicePushToTalkKey={voicePushToTalkKey}
          beginVoiceKeyRemap={beginVoiceKeyRemap}
          remappingVoiceKey={remappingVoiceKey}
          voiceOutputVolume={voiceOutputVolume}
          setVoiceOutputVolume={setVoiceOutputVolume}
          voiceProximityRange={voiceProximityRange}
          setVoiceProximityRange={setVoiceProximityRange}
          isVoiceSpeaking={isVoiceSpeaking}
          voiceStatus={voiceStatus}
          voiceError={voiceError}
          settingsFocus={settingsFocus}
          setPauseMenuIndex={setPauseMenuIndex}
        />
      ) : (
        <SettingsCharacterPane
          settingsScrollRef={settingsScrollRef}
          settingsScrollPanelStyle={settingsScrollPanelStyle}
          characterCustomization={characterCustomization}
          setCharacterCustomization={setCharacterCustomization}
          settingsFocus={settingsFocus}
          setPauseMenuIndex={setPauseMenuIndex}
        />
      )}

      <button
        data-settings-index={settingsBackIndex}
        className={cn(
          "mt-1 w-full border-[3px] border-gray-600 bg-gray-800 px-5 py-0.5 font-mono tracking-widest text-white uppercase transition-all hover:bg-gray-700",
          settingsFocus(settingsBackIndex) ? focusedMenuClass : ""
        )}
        style={{ fontSize: "var(--settings-body-font-size)" }}
        onMouseEnter={() => setPauseMenuIndex(settingsBackIndex)}
        onClick={onBack}
      >
        Back
      </button>
    </div>
  );
}
