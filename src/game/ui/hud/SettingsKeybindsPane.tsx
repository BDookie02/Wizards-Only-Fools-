import type { CSSProperties, RefObject } from "react";
import type { ControllerAction, ControllerButtonName } from "../../../store/gameStore";
import { controllerActionRows, controllerButtonLabels } from "../../systems/input/controllerSettingsConfig";
import { getPlatformDefaultLookSensitivity } from "../../systems/input/hudInputConfig";
import { keyboardKeybindRows } from "../../systems/input/keyboardKeybindGuide";
import { keybindArrowLookIndex, keybindControlStartIndex, keybindSensitivityStartIndex } from "./hudSettingsPanelConfig";
import { cn, focusedMenuClass, settingsCardClass, settingsHintClass, settingsTitleRowClass } from "./settingsPanelClassNames";
import {
  formatControllerLookSensitivityPercent,
  formatMouseSensitivityPercent,
  getDefaultControllerLookSensitivity,
} from "./settingsPanelRuntime";
import { SettingsRangeCard } from "./SettingsRangeCard";

type SettingsKeybindsPaneProps = {
  settingsScrollRef: RefObject<HTMLDivElement | null>;
  settingsScrollPanelStyle: CSSProperties;
  mouseSensitivity: number;
  setMouseSensitivity: (value: number) => void;
  controllerLookSensitivity: number;
  setControllerLookSensitivity: (value: number) => void;
  keyboardArrowLookEnabled: boolean;
  setKeyboardArrowLookEnabled: (enabled: boolean) => void;
  controllerBindings: Record<ControllerAction, ControllerButtonName>;
  remappingAction: ControllerAction | null;
  beginControllerRemap: (action: ControllerAction) => void;
  settingsFocus: (index: number) => boolean;
  setPauseMenuIndex: (index: number) => void;
};

export function SettingsKeybindsPane({
  settingsScrollRef,
  settingsScrollPanelStyle,
  mouseSensitivity,
  setMouseSensitivity,
  controllerLookSensitivity,
  setControllerLookSensitivity,
  keyboardArrowLookEnabled,
  setKeyboardArrowLookEnabled,
  controllerBindings,
  remappingAction,
  beginControllerRemap,
  settingsFocus,
  setPauseMenuIndex,
}: SettingsKeybindsPaneProps) {
  return (
    <div ref={settingsScrollRef} className="menu-scroll-panel w-full overflow-y-auto pr-1" style={settingsScrollPanelStyle}>
      <div className="settings-section-title mb-2 tracking-widest text-cyan-100/60">CONTROLS / REMAP</div>
      <div className="mb-2 grid gap-2 md:grid-cols-3">
        <SettingsRangeCard
          index={keybindSensitivityStartIndex}
          title="Look Sensitivity"
          valueText={formatMouseSensitivityPercent(mouseSensitivity)}
          accentClassName="accent-yellow-300"
          min={0.0005}
          max={0.006}
          step={0.0001}
          value={mouseSensitivity}
          onReset={() => setMouseSensitivity(getPlatformDefaultLookSensitivity())}
          onChange={setMouseSensitivity}
          isFocused={settingsFocus(keybindSensitivityStartIndex)}
          onFocus={() => setPauseMenuIndex(keybindSensitivityStartIndex)}
        />
        <SettingsRangeCard
          index={keybindSensitivityStartIndex + 1}
          title="Joystick Sensitivity"
          valueText={formatControllerLookSensitivityPercent(controllerLookSensitivity)}
          accentClassName="accent-cyan-300"
          min={0.8}
          max={6}
          step={0.01}
          value={controllerLookSensitivity}
          onReset={() => setControllerLookSensitivity(getDefaultControllerLookSensitivity())}
          onChange={setControllerLookSensitivity}
          isFocused={settingsFocus(keybindSensitivityStartIndex + 1)}
          onFocus={() => setPauseMenuIndex(keybindSensitivityStartIndex + 1)}
        />
        <button
          data-settings-index={keybindArrowLookIndex}
          className={cn(
            settingsCardClass,
            settingsFocus(keybindArrowLookIndex) ? focusedMenuClass : "border-cyan-300/25 bg-cyan-400/5 hover:border-cyan-200/70"
          )}
          onMouseEnter={() => setPauseMenuIndex(keybindArrowLookIndex)}
          onClick={() => setKeyboardArrowLookEnabled(!keyboardArrowLookEnabled)}
        >
          <div className={cn(settingsTitleRowClass, "text-cyan-100")}>
            <span>Arrow Key Look</span>
            <span className={keyboardArrowLookEnabled ? "text-lime-200" : "text-red-200"}>{keyboardArrowLookEnabled ? "Enabled" : "Disabled"}</span>
          </div>
          <div className={cn("mt-2 text-cyan-100/55", settingsHintClass)}>
            Uses keyboard arrows to turn and aim while the mouse is locked in-game.
          </div>
          <div className={cn("mt-1 text-cyan-100/45", settingsHintClass)}>Enter/A toggles, D-pad left/right toggles</div>
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-[0.82fr_1.18fr]">
        {keyboardKeybindRows.map((group) => (
          <div key={group.title} className="settings-card border border-cyan-300/25 bg-cyan-400/5 p-2">
            <div className="settings-section-title mb-1 border-b border-cyan-300/20 pb-1 tracking-[0.2em] text-cyan-100">{group.title}</div>
            <div className="flex flex-col gap-1">
              {group.rows.map(([action, bind]) => (
                <div key={`${group.title}-${action}`} className="settings-small-row grid grid-cols-[0.9fr_1.25fr] gap-2 leading-4">
                  <span className="truncate text-cyan-100/55">{action}</span>
                  <span className="text-right text-white/85">{bind}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="settings-card border border-cyan-300/25 bg-cyan-400/5 p-2">
          <div className="settings-section-title mb-1 border-b border-cyan-300/20 pb-1 tracking-[0.2em] text-cyan-100">Controller Remap</div>
          <div className="flex flex-col gap-1">
            {controllerActionRows.map((row, index) => {
              const settingIndex = keybindControlStartIndex + index;
              const isRemapping = remappingAction === row.action;
              return (
                <button
                  key={row.action}
                  data-settings-index={settingIndex}
                  className={cn(
                    "settings-control-row grid grid-cols-[1fr_auto] gap-2 border px-2 py-1 text-left leading-4 transition-all",
                    isRemapping
                      ? "border-pink-300 bg-pink-400/15 text-pink-50 shadow-[0_0_16px_rgba(244,114,182,0.45)]"
                      : settingsFocus(settingIndex)
                        ? focusedMenuClass
                        : "border-cyan-300/20 bg-black/25 text-cyan-100/85 hover:border-cyan-200/60"
                  )}
                  onMouseEnter={() => setPauseMenuIndex(settingIndex)}
                  onClick={() => beginControllerRemap(row.action)}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-cyan-50">{row.label}</span>
                    <span className="block truncate text-cyan-100/40">{isRemapping ? "Press any controller button..." : row.hint}</span>
                  </span>
                  <span className="self-center border border-yellow-200/50 bg-yellow-200/10 px-2 py-0.5 text-yellow-100">
                    {controllerButtonLabels[controllerBindings[row.action]]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
