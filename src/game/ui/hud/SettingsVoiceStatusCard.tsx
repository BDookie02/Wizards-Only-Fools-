import { cn, settingsHintClass, settingsTitleRowClass } from "./settingsPanelClassNames";
import {
  getVoiceActivityLabel,
  getVoiceActivityMeterWidth,
  getVoiceStatusText,
} from "./settingsPanelRuntime";

type SettingsVoiceStatusCardProps = {
  isVoiceSpeaking: boolean;
  voiceChatEnabled: boolean;
  voiceStatus: string;
  voiceError: string;
};

export function SettingsVoiceStatusCard({
  isVoiceSpeaking,
  voiceChatEnabled,
  voiceStatus,
  voiceError,
}: SettingsVoiceStatusCardProps) {
  return (
    <div className="settings-card border border-emerald-300/25 bg-black/30 p-3 text-left">
      <div className={cn(settingsTitleRowClass, "text-emerald-50")}>
        <span>Mic Status</span>
        <span className={isVoiceSpeaking ? "text-lime-200" : "text-emerald-100/45"}>
          {getVoiceActivityLabel(isVoiceSpeaking, voiceChatEnabled)}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden border border-emerald-200/30 bg-black">
        <div
          className={cn(
            "h-full transition-all duration-100",
            isVoiceSpeaking ? "bg-lime-300 shadow-[0_0_12px_rgba(190,242,100,0.85)]" : "bg-emerald-900"
          )}
          style={{ width: getVoiceActivityMeterWidth(isVoiceSpeaking, voiceChatEnabled) }}
        />
      </div>
      <div className={cn("mt-2 text-emerald-100/45", settingsHintClass)}>
        Speaking animation is driven by detected mic volume, then synced to other players.
      </div>
      <div
        className={cn(
          "settings-status-line mt-2 border px-2 py-1 leading-4 tracking-widest",
          voiceError ? "border-red-300/50 bg-red-500/10 text-red-100" : "border-emerald-300/20 bg-emerald-400/5 text-emerald-100/65"
        )}
      >
        {getVoiceStatusText(voiceError, voiceStatus)}
      </div>
    </div>
  );
}
