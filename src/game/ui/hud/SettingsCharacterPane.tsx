import { lazy, Suspense, type CSSProperties, type RefObject } from "react";
import { type CharacterCustomization } from "../../../store/gameStore";
import { characterColorPresets, characterColorRows, characterMouthRows, characterStyleRows } from "./characterCustomizationConfig";
import {
  getCharacterColorTextUpdate,
  getCharacterCustomizationUpdate,
  getNextCharacterColorUpdate,
  getNextCharacterStyleUpdate,
} from "./characterCustomizationRuntime";
import {
  characterColorStartIndex,
  characterMouthStartIndex,
  characterStyleStartIndex,
} from "./hudSettingsPanelConfig";
import { formatCharacterOption } from "./hudSettingsUtils";
import {
  getCharacterColorInputState,
  getCharacterOptionValue,
  getDefaultCharacterCustomization,
} from "./settingsPanelRuntime";
import {
  cn,
  focusedMenuClass,
  settingsHintClass,
} from "./settingsPanelClassNames";

const LazyCharacterPreview = lazy(() => import("./CharacterPreview").then((module) => ({ default: module.CharacterPreview })));

type SettingsCharacterPaneProps = {
  settingsScrollRef: RefObject<HTMLDivElement | null>;
  settingsScrollPanelStyle: CSSProperties;
  characterCustomization: CharacterCustomization;
  setCharacterCustomization: (updates: Partial<CharacterCustomization>) => void;
  settingsFocus: (index: number) => boolean;
  setPauseMenuIndex: (index: number) => void;
};

export function SettingsCharacterPane({
  settingsScrollRef,
  settingsScrollPanelStyle,
  characterCustomization,
  setCharacterCustomization,
  settingsFocus,
  setPauseMenuIndex,
}: SettingsCharacterPaneProps) {
  const updateCharacterField = (key: keyof CharacterCustomization, value: string) => {
    setCharacterCustomization(getCharacterCustomizationUpdate(key, value));
  };
  const updateCharacterColorText = (key: keyof CharacterCustomization, value: string) => {
    setCharacterCustomization(getCharacterColorTextUpdate(key, value));
  };
  const cycleCharacterColor = (key: keyof CharacterCustomization, direction: 1 | -1) => {
    setCharacterCustomization(getNextCharacterColorUpdate(characterCustomization, key, direction));
  };
  const cycleCharacterStyle = (key: keyof CharacterCustomization, options: string[], direction: 1 | -1) => {
    setCharacterCustomization(getNextCharacterStyleUpdate(characterCustomization, key, options, direction));
  };

  return (
    <div ref={settingsScrollRef} className="menu-scroll-panel w-full overflow-y-auto pr-1" style={settingsScrollPanelStyle}>
      <div className="settings-section-title mb-2 tracking-widest text-pink-100/65">CHARACTER CUSTOMIZATION / BASE SPRITE</div>
      <div className="character-menu-grid grid gap-3">
        <div className="settings-card character-preview-card border border-pink-300/25 bg-pink-400/5 p-2">
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-pink-300/20 pb-1">
            <div className="settings-section-title tracking-[0.2em] text-pink-100">Live Character View</div>
            <button
              className="settings-mini-button border border-yellow-200/40 bg-yellow-200/10 px-2 py-1 tracking-widest text-yellow-100 hover:bg-yellow-200/20"
              onClick={() => setCharacterCustomization(getDefaultCharacterCustomization())}
            >
              Reset Base
            </button>
          </div>
          <Suspense fallback={null}>
            <LazyCharacterPreview character={characterCustomization} />
          </Suspense>
          <div className={cn("mt-2 text-pink-100/50", settingsHintClass)}>
            Placeholder clothes and hair are procedural today; later sprite sheets can slot into these same style categories.
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="settings-card border border-pink-300/25 bg-pink-400/5 p-2">
            <div className="settings-section-title mb-2 border-b border-pink-300/20 pb-1 tracking-[0.2em] text-pink-100">Colors</div>
            <div className="character-control-grid grid gap-1.5">
              {characterColorRows.map((row, index) => {
                const settingIndex = characterColorStartIndex + index;
                const colorInput = getCharacterColorInputState(characterCustomization, row.key);
                return (
                  <div
                    key={row.key}
                    role="button"
                    tabIndex={0}
                    data-settings-index={settingIndex}
                    className={cn("settings-card border bg-black/25 p-1.5 transition-all", settingsFocus(settingIndex) ? focusedMenuClass : "border-pink-300/20 hover:border-pink-200/60")}
                    onMouseEnter={() => setPauseMenuIndex(settingIndex)}
                    onClick={() => cycleCharacterColor(row.key, 1)}
                  >
                    <div className="settings-small-row mb-1 flex items-center justify-between gap-2 tracking-widest">
                      <span className="text-pink-50">{row.label}</span>
                      <span className={colorInput.valid ? "text-pink-100/50" : "text-red-200"}>{row.hint}</span>
                    </div>
                    <div className="grid grid-cols-[34px_1fr] gap-1">
                      <input
                        aria-label={`${row.label} color picker`}
                        className="h-8 w-8 cursor-pointer border border-pink-200/40 bg-black"
                        type="color"
                        value={colorInput.pickerValue}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateCharacterField(row.key, e.currentTarget.value)}
                      />
                      <input
                        aria-label={`${row.label} hex color`}
                        className={cn("settings-hex-input min-w-0 border bg-black/55 px-2 tracking-widest outline-none", colorInput.valid ? "border-pink-300/25 text-pink-50 focus:border-yellow-200" : "border-red-300/70 text-red-100")}
                        value={colorInput.rawValue}
                        spellCheck={false}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateCharacterColorText(row.key, e.currentTarget.value)}
                      />
                    </div>
                    <div className="mt-1 grid grid-cols-[18px_1fr_18px] items-center gap-1">
                      <button
                        className="settings-nudge-button border border-pink-200/30 bg-pink-200/10 text-pink-50 hover:bg-pink-200/20"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          cycleCharacterColor(row.key, -1);
                        }}
                      >
                        &lt;
                      </button>
                      <div className="flex min-w-0 justify-center gap-1">
                        {characterColorPresets.map((preset) => (
                          <span
                            key={`${row.key}-${preset}`}
                            className={cn("h-3 w-3 border", colorInput.pickerValue.toLowerCase() === preset.toLowerCase() ? "border-yellow-200 shadow-[0_0_8px_rgba(250,204,21,0.75)]" : "border-white/20")}
                            style={{ backgroundColor: preset }}
                          />
                        ))}
                      </div>
                      <button
                        className="settings-nudge-button border border-pink-200/30 bg-pink-200/10 text-pink-50 hover:bg-pink-200/20"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          cycleCharacterColor(row.key, 1);
                        }}
                      >
                        &gt;
                      </button>
                    </div>
                    <div className={cn("mt-1 text-pink-100/45", settingsHintClass)}>
                      Controller: A or D-pad left/right cycles presets. Keyboard/mouse: type exact hex.
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="settings-card border border-cyan-300/25 bg-cyan-400/5 p-2">
            <div className="settings-section-title mb-2 border-b border-cyan-300/20 pb-1 tracking-[0.2em] text-cyan-100">Body, Hair & Eyes</div>
            <div className="character-control-grid grid gap-1.5">
              {characterStyleRows.map((row, index) => {
                const settingIndex = characterStyleStartIndex + index;
                const currentValue = getCharacterOptionValue(characterCustomization, row.key, row.options[0]);
                return (
                  <button
                    key={row.key}
                    data-settings-index={settingIndex}
                    className={cn("settings-control-row grid grid-cols-[1fr_auto] gap-2 border px-2 py-1.5 text-left leading-4 transition-all", settingsFocus(settingIndex) ? focusedMenuClass : "border-cyan-300/20 bg-black/25 text-cyan-100/85 hover:border-cyan-200/60")}
                    onMouseEnter={() => setPauseMenuIndex(settingIndex)}
                    onClick={() => cycleCharacterStyle(row.key, row.options, 1)}
                  >
                    <span className="truncate text-cyan-50">{row.label}</span>
                    <span className="border border-yellow-200/50 bg-yellow-200/10 px-2 py-0.5 text-yellow-100">
                      {formatCharacterOption(currentValue)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="settings-card border border-yellow-200/30 bg-yellow-200/10 p-2 shadow-[0_0_18px_rgba(250,204,21,0.08)]">
            <div className="settings-section-title mb-2 border-b border-yellow-200/25 pb-1 tracking-[0.2em] text-yellow-100">Mouth</div>
            <div className="character-control-grid grid gap-1.5">
              {characterMouthRows.map((row, index) => {
                const settingIndex = characterMouthStartIndex + index;
                const currentValue = getCharacterOptionValue(characterCustomization, row.key, row.options[0]);
                return (
                  <button
                    key={row.key}
                    data-settings-index={settingIndex}
                    className={cn("settings-control-row grid grid-cols-[1fr_auto] gap-2 border px-2 py-1.5 text-left leading-4 transition-all", settingsFocus(settingIndex) ? focusedMenuClass : "border-yellow-200/25 bg-black/30 text-yellow-100/85 hover:border-yellow-100/70")}
                    onMouseEnter={() => setPauseMenuIndex(settingIndex)}
                    onClick={() => cycleCharacterStyle(row.key, row.options, 1)}
                  >
                    <span className="truncate text-yellow-50">{row.label}</span>
                    <span className="border border-pink-200/50 bg-pink-200/10 px-2 py-0.5 text-pink-100">
                      {formatCharacterOption(currentValue)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
