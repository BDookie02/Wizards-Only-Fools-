import type { AspectRatioOption } from "../../../store/gameStore";
import { aspectRatioOptions, videoAspectStartIndex } from "./hudSettingsPanelConfig";
import { SettingsAspectRatioButton } from "./SettingsAspectRatioButton";

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
            <SettingsAspectRatioButton
              key={ratio}
              index={settingIndex}
              ratio={ratio}
              active={aspectRatio === ratio}
              focused={settingsFocus(settingIndex)}
              onFocus={() => setPauseMenuIndex(settingIndex)}
              onSelect={setAspectRatio}
            />
          );
        })}
      </div>
    </div>
  );
}
