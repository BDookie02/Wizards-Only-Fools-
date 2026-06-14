import { cn, focusedMenuClass } from "./settingsPanelClassNames";

type SettingsBackButtonProps = {
  index: number;
  focused: boolean;
  onFocus: () => void;
  onBack: () => void;
};

export function SettingsBackButton({
  index,
  focused,
  onFocus,
  onBack,
}: SettingsBackButtonProps) {
  return (
    <button
      data-settings-index={index}
      className={cn(
        "mt-1 w-full border-[3px] border-gray-600 bg-gray-800 px-5 py-0.5 font-mono tracking-widest text-white uppercase transition-all hover:bg-gray-700",
        focused ? focusedMenuClass : ""
      )}
      style={{ fontSize: "var(--settings-body-font-size)" }}
      onMouseEnter={onFocus}
      onClick={onBack}
    >
      Back
    </button>
  );
}
