import { cn, focusedMenuClass } from "./settingsPanelClassNames";

type SettingsTabButtonProps = {
  index: number;
  label: string;
  active: boolean;
  activeClassName: string;
  onSelect: () => void;
  isFocused: boolean;
  onFocus: () => void;
};

export function SettingsTabButton({
  index,
  label,
  active,
  activeClassName,
  onSelect,
  isFocused,
  onFocus,
}: SettingsTabButtonProps) {
  return (
    <button
      data-settings-index={index}
      className={cn(
        "settings-tab-button border px-2 py-1 text-left font-mono tracking-widest uppercase transition-all",
        active ? activeClassName : "border-gray-600 text-gray-300 hover:border-gray-400",
        isFocused ? focusedMenuClass : ""
      )}
      style={{ fontSize: "var(--settings-tab-font-size)" }}
      onMouseEnter={onFocus}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect();
      }}
    >
      {label}
    </button>
  );
}
