import { lazy, Suspense, type CSSProperties, type RefObject } from "react";
import { type CharacterCustomization } from "../../../store/gameStore";
import { characterColorRows, characterMouthRows, characterStyleRows } from "./characterCustomizationConfig";
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
import {
  getCharacterColorInputState,
  getCharacterOptionValue,
  getDefaultCharacterCustomization,
} from "./settingsPanelRuntime";
import { SettingsCharacterColorRow } from "./SettingsCharacterColorRow";
import { SettingsCharacterOptionButton } from "./SettingsCharacterOptionButton";
import {
  cn,
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
                  <SettingsCharacterColorRow
                    key={row.key}
                    row={row}
                    index={settingIndex}
                    colorInput={colorInput}
                    focused={settingsFocus(settingIndex)}
                    onFocus={() => setPauseMenuIndex(settingIndex)}
                    onCycle={cycleCharacterColor}
                    onColorFieldChange={updateCharacterField}
                    onColorTextChange={updateCharacterColorText}
                  />
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
                  <SettingsCharacterOptionButton
                    key={row.key}
                    row={row}
                    index={settingIndex}
                    value={currentValue}
                    focused={settingsFocus(settingIndex)}
                    idleClassName="border-cyan-300/20 bg-black/25 text-cyan-100/85 hover:border-cyan-200/60"
                    labelClassName="text-cyan-50"
                    valueClassName="border-yellow-200/50 bg-yellow-200/10 text-yellow-100"
                    onFocus={() => setPauseMenuIndex(settingIndex)}
                    onSelect={() => cycleCharacterStyle(row.key, row.options, 1)}
                  />
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
                  <SettingsCharacterOptionButton
                    key={row.key}
                    row={row}
                    index={settingIndex}
                    value={currentValue}
                    focused={settingsFocus(settingIndex)}
                    idleClassName="border-yellow-200/25 bg-black/30 text-yellow-100/85 hover:border-yellow-100/70"
                    labelClassName="text-yellow-50"
                    valueClassName="border-pink-200/50 bg-pink-200/10 text-pink-100"
                    onFocus={() => setPauseMenuIndex(settingIndex)}
                    onSelect={() => cycleCharacterStyle(row.key, row.options, 1)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
