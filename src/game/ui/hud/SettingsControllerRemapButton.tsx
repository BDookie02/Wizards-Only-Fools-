import type { ControllerAction, ControllerButtonName } from "../../../store/gameStore";
import {
  controllerButtonLabels,
  type ControllerActionSettingsRow,
} from "../../systems/input/controllerSettingsConfig";
import { cn, focusedMenuClass } from "./settingsPanelClassNames";

type SettingsControllerRemapButtonProps = {
  row: ControllerActionSettingsRow;
  index: number;
  binding: ControllerButtonName;
  isRemapping: boolean;
  focused: boolean;
  onFocus: () => void;
  onRemap: (action: ControllerAction) => void;
};

export function SettingsControllerRemapButton({
  row,
  index,
  binding,
  isRemapping,
  focused,
  onFocus,
  onRemap,
}: SettingsControllerRemapButtonProps) {
  return (
    <button
      data-settings-index={index}
      className={cn(
        "settings-control-row grid grid-cols-[1fr_auto] gap-2 border px-2 py-1 text-left leading-4 transition-all",
        isRemapping
          ? "border-pink-300 bg-pink-400/15 text-pink-50 shadow-[0_0_16px_rgba(244,114,182,0.45)]"
          : focused
            ? focusedMenuClass
            : "border-cyan-300/20 bg-black/25 text-cyan-100/85 hover:border-cyan-200/60"
      )}
      onMouseEnter={onFocus}
      onClick={() => onRemap(row.action)}
    >
      <span className="min-w-0">
        <span className="block truncate text-cyan-50">{row.label}</span>
        <span className="block truncate text-cyan-100/40">{isRemapping ? "Press any controller button..." : row.hint}</span>
      </span>
      <span className="self-center border border-yellow-200/50 bg-yellow-200/10 px-2 py-0.5 text-yellow-100">
        {controllerButtonLabels[binding]}
      </span>
    </button>
  );
}
