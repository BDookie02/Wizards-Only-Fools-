import type { CSSProperties, RefObject } from "react";
import type { VoiceInputMode } from "../../../store/gameStore";
import {
  voiceEnabledIndex,
  voiceInputModeIndex,
  voiceOutputVolumeIndex,
  voiceProximityRangeIndex,
  voicePushToTalkKeyIndex,
} from "./hudSettingsPanelConfig";
import { cn, settingsHintClass, settingsTitleRowClass } from "./settingsPanelClassNames";
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
import { SettingsVoiceActionCard } from "./SettingsVoiceActionCard";

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
        <SettingsVoiceActionCard
          index={voiceEnabledIndex}
          title="Voice Chat"
          valueText={getVoiceEnabledLabel(voiceChatEnabled)}
          valueClassName={voiceChatEnabled ? "text-lime-200" : "text-red-200"}
          hint="Turns your microphone and nearby player voices on or off."
          focused={settingsFocus(voiceEnabledIndex)}
          onFocus={() => setPauseMenuIndex(voiceEnabledIndex)}
          onSelect={() => setVoiceChatEnabled(!voiceChatEnabled)}
        />

        <SettingsVoiceActionCard
          index={voiceInputModeIndex}
          title="Input Mode"
          valueText={getVoiceInputModeLabel(voiceInputMode)}
          valueClassName="text-yellow-100"
          hint="D-pad left/right or A toggles between open mic and press-to-talk."
          focused={settingsFocus(voiceInputModeIndex)}
          onFocus={() => setPauseMenuIndex(voiceInputModeIndex)}
          onSelect={toggleVoiceInputMode}
        />

        <SettingsVoiceActionCard
          index={voicePushToTalkKeyIndex}
          title="Press-To-Talk Key"
          valueText={getVoicePushToTalkKeyLabel(remappingVoiceKey, voicePushToTalkKey)}
          valueClassName="border border-yellow-200/50 bg-yellow-200/10 px-2 py-0.5 text-yellow-100"
          hint="Controller press-to-talk is remapped from the Keybinds tab."
          focused={settingsFocus(voicePushToTalkKeyIndex)}
          remapping={remappingVoiceKey}
          onFocus={() => setPauseMenuIndex(voicePushToTalkKeyIndex)}
          onSelect={beginVoiceKeyRemap}
        />

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
