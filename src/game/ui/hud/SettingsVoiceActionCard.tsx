import { cn, focusedMenuClass, settingsCardClass, settingsHintClass, settingsTitleRowClass } from "./settingsPanelClassNames";

type SettingsVoiceActionCardProps = {
  index: number;
  title: string;
  valueText: string;
  hint: string;
  focused: boolean;
  remapping?: boolean;
  valueClassName?: string;
  onFocus: () => void;
  onSelect: () => void;
};

export function SettingsVoiceActionCard({
  index,
  title,
  valueText,
  hint,
  focused,
  remapping = false,
  valueClassName,
  onFocus,
  onSelect,
}: SettingsVoiceActionCardProps) {
  return (
    <button
      data-settings-index={index}
      className={cn(
        settingsCardClass,
        remapping
          ? "border-pink-300 bg-pink-400/15 text-pink-50 shadow-[0_0_16px_rgba(244,114,182,0.45)]"
          : focused
            ? focusedMenuClass
            : "border-emerald-300/25 bg-emerald-400/5 hover:border-emerald-200/70"
      )}
      onMouseEnter={onFocus}
      onClick={onSelect}
    >
      <div className={cn(settingsTitleRowClass, "text-emerald-50")}>
        <span>{title}</span>
        <span className={valueClassName}>{valueText}</span>
      </div>
      <div className={cn("mt-2 text-emerald-100/45", settingsHintClass)}>{hint}</div>
    </button>
  );
}
