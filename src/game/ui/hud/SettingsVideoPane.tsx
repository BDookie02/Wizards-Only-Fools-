import type { AspectRatioOption } from "../../../store/gameStore";
import { aspectRatioOptions, videoAspectStartIndex } from "./hudSettingsPanelConfig";
import { cn, focusedMenuClass } from "./settingsPanelClassNames";

type SettingsVideoPaneProps = {
  aspectRatio: AspectRatioOption;
  setAspectRatio: (ratio: AspectRatioOption | string) => void;
  settingsFocus: (index: number) => boolean;
  setPauseMenuIndex: (index: number) => void;
};

export function SettingsVideoPane({
  aspectRatio,
  setAspectRatio,
  settingsFocus,
  setPauseMenuIndex,
}: SettingsVideoPaneProps) {
  return (
    <div className="flex w-full flex-col gap-1">
      <div className="settings-section-title text-gray-400">Aspect Ratio</div>
      <div className="flex flex-col gap-1">
        {aspectRatioOptions.map((ratio, index) => {
          const settingIndex = index + videoAspectStartIndex;
          return (
            <button
              key={ratio}
              data-settings-index={settingIndex}
              className={cn(
                "settings-choice-button border px-2 py-0.5 text-left font-mono transition-all",
                aspectRatio === ratio ? "border-yellow-400 bg-yellow-400/10 text-yellow-400" : "border-gray-600 text-gray-300 hover:border-gray-400",
                settingsFocus(settingIndex) ? focusedMenuClass : ""
              )}
              style={{ fontSize: "var(--settings-body-font-size)" }}
              onMouseEnter={() => setPauseMenuIndex(settingIndex)}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (aspectRatio !== ratio) setAspectRatio(ratio);
              }}
            >
              {ratio}
            </button>
          );
        })}
      </div>
    </div>
  );
}
