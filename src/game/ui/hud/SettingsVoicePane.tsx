import type { CSSProperties, RefObject } from "react";
import type { VoiceInputMode } from "../../../store/gameStore";
import {
  voiceEnabledIndex,
  voiceInputModeIndex,
  voiceOutputVolumeIndex,
  voiceProximityRangeIndex,
  voicePushToTalkKeyIndex,
} from "./hudSettingsPanelConfig";
import { cn, focusedMenuClass, settingsCardClass, settingsHintClass, settingsTitleRowClass } from "./settingsPanelClassNames";
import {
  formatVoiceOutputVolumePercent,
  formatVoiceProximityRangeMeters,
  getDefaultVoiceOutputVolume,
  getDefaultVoiceProximityRange,
  getVoiceActivityLabel,
  getVoiceActivityMeterWidth,
  getVoiceEnabledLabel,
  getVoiceInputModeLabel,
  getVoicePushToTalkKeyLabel,
  getVoiceStatusText,
} from "./settingsPanelRuntime";
import { SettingsRangeCard } from "./SettingsRangeCard";

type SettingsVoicePaneProps = {
  settingsScrollRef: RefObject<HTMLDivElement | null>;
  settingsScrollPanelStyle: CSSProperties;
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
  settingsFocus: (index: number) => boolean;
  setPauseMenuIndex: (index: number) => void;
};

export function SettingsVoicePane({
  settingsScrollRef,
  settingsScrollPanelStyle,
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
  settingsFocus,
  setPauseMenuIndex,
}: SettingsVoicePaneProps) {
  return (
    <div ref={settingsScrollRef} className="menu-scroll-panel w-full overflow-y-auto pr-1" style={settingsScrollPanelStyle}>
      <div className="settings-section-title mb-2 tracking-widest text-emerald-100/65">PROXIMITY VOICE / MIC</div>
      {voiceNeedsSecureOrigin && (
        <div className={cn("settings-card mb-2 border border-yellow-300/60 bg-yellow-300/10 p-2 text-yellow-100", settingsHintClass)}>
          LAN mic access needs HTTPS. Restart with `npm run dev:https`, then join from the other PC using the HTTPS LAN URL.
        </div>
      )}
      <div className="grid gap-2 md:grid-cols-2">
        <button
          data-settings-index={voiceEnabledIndex}
          className={cn(settingsCardClass, settingsFocus(voiceEnabledIndex) ? focusedMenuClass : "border-emerald-300/25 bg-emerald-400/5 hover:border-emerald-200/70")}
          onMouseEnter={() => setPauseMenuIndex(voiceEnabledIndex)}
          onClick={() => setVoiceChatEnabled(!voiceChatEnabled)}
        >
          <div className={cn(settingsTitleRowClass, "text-emerald-50")}>
            <span>Voice Chat</span>
            <span className={voiceChatEnabled ? "text-lime-200" : "text-red-200"}>{getVoiceEnabledLabel(voiceChatEnabled)}</span>
          </div>
          <div className={cn("mt-2 text-emerald-100/45", settingsHintClass)}>
            Turns your microphone and nearby player voices on or off.
          </div>
        </button>

        <button
          data-settings-index={voiceInputModeIndex}
          className={cn(settingsCardClass, settingsFocus(voiceInputModeIndex) ? focusedMenuClass : "border-emerald-300/25 bg-emerald-400/5 hover:border-emerald-200/70")}
          onMouseEnter={() => setPauseMenuIndex(voiceInputModeIndex)}
          onClick={toggleVoiceInputMode}
        >
          <div className={cn(settingsTitleRowClass, "text-emerald-50")}>
            <span>Input Mode</span>
            <span className="text-yellow-100">{getVoiceInputModeLabel(voiceInputMode)}</span>
          </div>
          <div className={cn("mt-2 text-emerald-100/45", settingsHintClass)}>
            D-pad left/right or A toggles between open mic and press-to-talk.
          </div>
        </button>

        <button
          data-settings-index={voicePushToTalkKeyIndex}
          className={cn(
            settingsCardClass,
            remappingVoiceKey
              ? "border-pink-300 bg-pink-400/15 text-pink-50 shadow-[0_0_16px_rgba(244,114,182,0.45)]"
              : settingsFocus(voicePushToTalkKeyIndex)
                ? focusedMenuClass
                : "border-emerald-300/25 bg-emerald-400/5 hover:border-emerald-200/70"
          )}
          onMouseEnter={() => setPauseMenuIndex(voicePushToTalkKeyIndex)}
          onClick={beginVoiceKeyRemap}
        >
          <div className={cn(settingsTitleRowClass, "text-emerald-50")}>
            <span>Press-To-Talk Key</span>
            <span className="border border-yellow-200/50 bg-yellow-200/10 px-2 py-0.5 text-yellow-100">
              {getVoicePushToTalkKeyLabel(remappingVoiceKey, voicePushToTalkKey)}
            </span>
          </div>
          <div className={cn("mt-2 text-emerald-100/45", settingsHintClass)}>
            Controller press-to-talk is remapped from the Keybinds tab.
          </div>
        </button>

        <SettingsRangeCard
          index={voiceOutputVolumeIndex}
          title="Voice Volume"
          valueText={formatVoiceOutputVolumePercent(voiceOutputVolume)}
          accentClassName="accent-emerald-300"
          min={0}
          max={1}
          step={0.01}
          value={voiceOutputVolume}
          onReset={() => setVoiceOutputVolume(getDefaultVoiceOutputVolume())}
          onChange={setVoiceOutputVolume}
          isFocused={settingsFocus(voiceOutputVolumeIndex)}
          onFocus={() => setPauseMenuIndex(voiceOutputVolumeIndex)}
          hint="A resets, D-pad left/right adjusts"
        />

        <SettingsRangeCard
          index={voiceProximityRangeIndex}
          title="Proximity Range"
          valueText={formatVoiceProximityRangeMeters(voiceProximityRange)}
          accentClassName="accent-lime-300"
          min={8}
          max={64}
          step={1}
          value={voiceProximityRange}
          onReset={() => setVoiceProximityRange(getDefaultVoiceProximityRange())}
          onChange={setVoiceProximityRange}
          isFocused={settingsFocus(voiceProximityRangeIndex)}
          onFocus={() => setPauseMenuIndex(voiceProximityRangeIndex)}
          hint="Nearby voices fade out smoothly with distance."
        />

        <div className="settings-card border border-emerald-300/25 bg-black/30 p-3 text-left">
          <div className={cn(settingsTitleRowClass, "text-emerald-50")}>
            <span>Mic Status</span>
            <span className={isVoiceSpeaking ? "text-lime-200" : "text-emerald-100/45"}>{getVoiceActivityLabel(isVoiceSpeaking, voiceChatEnabled)}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden border border-emerald-200/30 bg-black">
            <div className={cn("h-full transition-all duration-100", isVoiceSpeaking ? "bg-lime-300 shadow-[0_0_12px_rgba(190,242,100,0.85)]" : "bg-emerald-900")} style={{ width: getVoiceActivityMeterWidth(isVoiceSpeaking, voiceChatEnabled) }} />
          </div>
          <div className={cn("mt-2 text-emerald-100/45", settingsHintClass)}>
            Speaking animation is driven by detected mic volume, then synced to other players.
          </div>
          <div className={cn("settings-status-line mt-2 border px-2 py-1 leading-4 tracking-widest", voiceError ? "border-red-300/50 bg-red-500/10 text-red-100" : "border-emerald-300/20 bg-emerald-400/5 text-emerald-100/65")}>
            {getVoiceStatusText(voiceError, voiceStatus)}
          </div>
        </div>
      </div>
    </div>
  );
}
