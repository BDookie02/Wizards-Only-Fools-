import type { AspectRatioOption } from "../../../store/gameStore";
import { cn, focusedMenuClass } from "./settingsPanelClassNames";

type SettingsAspectRatioButtonProps = {
  index: number;
  ratio: AspectRatioOption;
  active: boolean;
  focused: boolean;
  onFocus: () => void;
  onSelect: (ratio: AspectRatioOption) => void;
};

export function SettingsAspectRatioButton({
  index,
  ratio,
  active,
  focused,
  onFocus,
  onSelect,
}: SettingsAspectRatioButtonProps) {
  return (
    <button
      data-settings-index={index}
      className={cn(
        "settings-choice-button border px-2 py-0.5 text-left font-mono transition-all",
        active ? "border-yellow-400 bg-yellow-400/10 text-yellow-400" : "border-gray-600 text-gray-300 hover:border-gray-400",
        focused ? focusedMenuClass : ""
      )}
      style={{ fontSize: "var(--settings-body-font-size)" }}
      onMouseEnter={onFocus}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!active) onSelect(ratio);
      }}
    >
      {ratio}
    </button>
  );
}
