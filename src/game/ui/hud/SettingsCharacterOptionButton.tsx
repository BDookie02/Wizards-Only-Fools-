import { type CharacterStyleRow } from "./characterCustomizationConfig";
import { formatCharacterOption } from "./hudSettingsUtils";
import { cn, focusedMenuClass } from "./settingsPanelClassNames";

type SettingsCharacterOptionButtonProps = {
  row: CharacterStyleRow;
  index: number;
  value: string;
  focused: boolean;
  idleClassName: string;
  labelClassName: string;
  valueClassName: string;
  onFocus: () => void;
  onSelect: () => void;
};

export function SettingsCharacterOptionButton({
  row,
  index,
  value,
  focused,
  idleClassName,
  labelClassName,
  valueClassName,
  onFocus,
  onSelect,
}: SettingsCharacterOptionButtonProps) {
  return (
    <button
      data-settings-index={index}
      className={cn(
        "settings-control-row grid grid-cols-[1fr_auto] gap-2 border px-2 py-1.5 text-left leading-4 transition-all",
        focused ? focusedMenuClass : idleClassName
      )}
      onMouseEnter={onFocus}
      onClick={onSelect}
    >
      <span className={cn("truncate", labelClassName)}>{row.label}</span>
      <span className={cn("border px-2 py-0.5", valueClassName)}>{formatCharacterOption(value)}</span>
    </button>
  );
}
