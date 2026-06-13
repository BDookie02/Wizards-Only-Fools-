import { cn, focusedMenuClass, settingsCardClass, settingsHintClass, settingsTitleRowClass } from "./settingsPanelClassNames";

type SettingsRangeCardProps = {
  index: number;
  title: string;
  valueText: string;
  accentClassName: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onReset: () => void;
  onChange: (value: number) => void;
  isFocused: boolean;
  onFocus: () => void;
  hint?: string;
};

export function SettingsRangeCard({
  index,
  title,
  valueText,
  accentClassName,
  min,
  max,
  step,
  value,
  onReset,
  onChange,
  isFocused,
  onFocus,
  hint = "A resets, D-pad left/right adjusts",
}: SettingsRangeCardProps) {
  return (
    <div
      data-settings-index={index}
      className={cn(
        settingsCardClass,
        isFocused ? focusedMenuClass : "border-cyan-300/25 bg-cyan-400/5"
      )}
      onMouseEnter={onFocus}
      onClick={onReset}
    >
      <div className={cn(settingsTitleRowClass, "text-cyan-100")}>
        <span>{title}</span>
        <span>{valueText}</span>
      </div>
      <input
        className={cn("mt-2 w-full", accentClassName)}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      <div className={cn("mt-1 text-cyan-100/45", settingsHintClass)}>{hint}</div>
    </div>
  );
}
