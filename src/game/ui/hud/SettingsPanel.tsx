import { lazy, Suspense, type RefObject } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  type AspectRatioOption,
  type CharacterCustomization,
  type ControllerAction,
  type ControllerButtonName,
  type VoiceInputMode,
} from "../../../store/gameStore";
import { controllerActionRows, controllerButtonLabels } from "../../systems/input/controllerSettingsConfig";
import { getPlatformDefaultLookSensitivity } from "../../systems/input/hudInputConfig";
import { keyboardKeybindRows } from "../../systems/input/keyboardKeybindGuide";
import { characterColorPresets, characterColorRows, characterMouthRows, characterStyleRows } from "./characterCustomizationConfig";
import {
  getCharacterColorTextUpdate,
  getCharacterCustomizationUpdate,
  getNextCharacterColorUpdate,
  getNextCharacterStyleUpdate,
} from "./characterCustomizationRuntime";
import { formatCharacterOption } from "./hudSettingsUtils";
import {
  aspectRatioOptions,
  characterColorStartIndex,
  characterMouthStartIndex,
  characterStyleStartIndex,
  keybindArrowLookIndex,
  keybindControlStartIndex,
  keybindSensitivityStartIndex,
  settingsTabCount,
  videoAspectStartIndex,
  voiceEnabledIndex,
  voiceInputModeIndex,
  voiceOutputVolumeIndex,
  voiceProximityRangeIndex,
  voicePushToTalkKeyIndex,
  type SettingsPane,
} from "./hudSettingsPanelConfig";
import {
  formatControllerLookSensitivityPercent,
  formatMouseSensitivityPercent,
  formatVoiceOutputVolumePercent,
  formatVoiceProximityRangeMeters,
  getCharacterColorInputState,
  getCharacterOptionValue,
  getDefaultCharacterCustomization,
  getDefaultControllerLookSensitivity,
  getDefaultVoiceOutputVolume,
  getDefaultVoiceProximityRange,
  getSettingsBackIndex,
  getSettingsMenuStyle,
  getSettingsScrollPanelStyle,
  getVoiceActivityLabel,
  getVoiceActivityMeterWidth,
  getVoiceEnabledLabel,
  getVoiceInputModeLabel,
  getVoicePushToTalkKeyLabel,
  getVoiceStatusText,
  isSettingsIndexFocused,
} from "./settingsPanelRuntime";

const LazyCharacterPreview = lazy(() => import("./CharacterPreview").then((module) => ({ default: module.CharacterPreview })));

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const focusedMenuClass = "ring-2 ring-yellow-200 ring-offset-2 ring-offset-black shadow-[0_0_20px_rgba(250,204,21,0.55)] brightness-125";
const settingsCardClass = "settings-card border text-left transition-all";
const settingsTitleRowClass = "settings-card-title flex items-center justify-between gap-3 tracking-widest";
const settingsHintClass = "settings-card-hint leading-4 tracking-widest";

type SettingsPanelProps = {
  settingsPane: SettingsPane;
  setSettingsPane: (pane: SettingsPane) => void;
  pauseMenuIndex: number;
  setPauseMenuIndex: (index: number) => void;
  settingsScrollRef: RefObject<HTMLDivElement | null>;
  aspectRatio: AspectRatioOption;
  setAspectRatio: (ratio: AspectRatioOption | string) => void;
  mouseSensitivity: number;
  setMouseSensitivity: (value: number) => void;
  controllerLookSensitivity: number;
  setControllerLookSensitivity: (value: number) => void;
  keyboardArrowLookEnabled: boolean;
  setKeyboardArrowLookEnabled: (enabled: boolean) => void;
  controllerBindings: Record<ControllerAction, ControllerButtonName>;
  remappingAction: ControllerAction | null;
  beginControllerRemap: (action: ControllerAction) => void;
  voiceNeedsSecureOrigin: boolean;
  voiceChatEnabled: boolean;
  setVoiceChatEnabled: (enabled: boolean) => void;
  voiceInputMode: VoiceInputMode;
  toggleVoiceInputMode: () => void;
  voicePushToTalkKey: string;
  beginVoiceKeyRemap: () => void;
  remappingVoiceKey: boolean;
  voiceOutputVolume: number;
  setVoiceOutputVolume: (value: number) => void;
  voiceProximityRange: number;
  setVoiceProximityRange: (value: number) => void;
  isVoiceSpeaking: boolean;
  voiceStatus: string;
  voiceError: string;
  characterCustomization: CharacterCustomization;
  setCharacterCustomization: (updates: Partial<CharacterCustomization>) => void;
  onBack: () => void;
};

type TabButtonProps = {
  index: number;
  label: string;
  active: boolean;
  activeClassName: string;
  onSelect: () => void;
  isFocused: boolean;
  onFocus: () => void;
};

function TabButton({ index, label, active, activeClassName, onSelect, isFocused, onFocus }: TabButtonProps) {
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

type RangeCardProps = {
  index: number;
  title: string;
  valueText: string;
  accentClassName: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onReset: () => void;
  onChange: (value: number) => void;
  isFocused: boolean;
  onFocus: () => void;
  hint?: string;
};

function RangeCard({
  index,
  title,
  valueText,
  accentClassName,
  min,
  max,
  step,
  value,
  onReset,
  onChange,
  isFocused,
  onFocus,
  hint = "A resets, D-pad left/right adjusts",
}: RangeCardProps) {
  return (
    <div
      data-settings-index={index}
      className={cn(
        settingsCardClass,
        isFocused ? focusedMenuClass : "border-cyan-300/25 bg-cyan-400/5"
      )}
      onMouseEnter={onFocus}
      onClick={onReset}
    >
      <div className={cn(settingsTitleRowClass, "text-cyan-100")}>
        <span>{title}</span>
        <span>{valueText}</span>
      </div>
      <input
        className={cn("mt-2 w-full", accentClassName)}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
      <div className={cn("mt-1 text-cyan-100/45", settingsHintClass)}>{hint}</div>
    </div>
  );
}

export function SettingsPanel({
  settingsPane,
  setSettingsPane,
  pauseMenuIndex,
  setPauseMenuIndex,
  settingsScrollRef,
  aspectRatio,
  setAspectRatio,
  mouseSensitivity,
  setMouseSensitivity,
  controllerLookSensitivity,
  setControllerLookSensitivity,
  keyboardArrowLookEnabled,
  setKeyboardArrowLookEnabled,
  controllerBindings,
  remappingAction,
  beginControllerRemap,
  voiceNeedsSecureOrigin,
  voiceChatEnabled,
  setVoiceChatEnabled,
  voiceInputMode,
  toggleVoiceInputMode,
  voicePushToTalkKey,
  beginVoiceKeyRemap,
  remappingVoiceKey,
  voiceOutputVolume,
  setVoiceOutputVolume,
  voiceProximityRange,
  setVoiceProximityRange,
  isVoiceSpeaking,
  voiceStatus,
  voiceError,
  characterCustomization,
  setCharacterCustomization,
  onBack,
}: SettingsPanelProps) {
  const settingsMenuStyle = getSettingsMenuStyle(settingsPane);
  const settingsScrollPanelStyle = getSettingsScrollPanelStyle(settingsPane);
  const settingsFocus = (index: number) => isSettingsIndexFocused(pauseMenuIndex, index);
  const selectPane = (pane: SettingsPane, index: number) => {
    setSettingsPane(pane);
    setPauseMenuIndex(index);
  };
  const settingsBackIndex = getSettingsBackIndex(settingsPane);
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
    <div
      data-wof-hud-qa="settings-panel"
      className="settings-panel pointer-events-auto flex flex-col items-center gap-2 border-[3px] border-purple-500 bg-[#120c16] shadow-[0_0_28px_rgba(168,85,247,0.28)]"
      style={settingsMenuStyle}
    >
      <h2 className="settings-panel-title font-bold tracking-widest text-white" style={{ fontSize: "var(--settings-title-font-size)", marginBottom: "clamp(0.05rem, 0.45vmin, 0.5rem)" }}>
        SETTINGS
      </h2>

      <div className="settings-tab-grid grid w-full grid-cols-4 gap-2">
        <TabButton index={0} label="Video" active={settingsPane === "video"} activeClassName="border-yellow-400 bg-yellow-400/10 text-yellow-300" isFocused={settingsFocus(0)} onFocus={() => setPauseMenuIndex(0)} onSelect={() => selectPane("video", 0)} />
        <TabButton index={1} label="Keybinds" active={settingsPane === "keybinds"} activeClassName="border-cyan-300 bg-cyan-300/10 text-cyan-100" isFocused={settingsFocus(1)} onFocus={() => setPauseMenuIndex(1)} onSelect={() => selectPane("keybinds", 1)} />
        <TabButton index={2} label="Voice" active={settingsPane === "voice"} activeClassName="border-emerald-300 bg-emerald-300/10 text-emerald-100" isFocused={settingsFocus(2)} onFocus={() => setPauseMenuIndex(2)} onSelect={() => selectPane("voice", 2)} />
        <TabButton index={3} label="Character" active={settingsPane === "character"} activeClassName="border-pink-300 bg-pink-300/10 text-pink-100" isFocused={settingsFocus(3)} onFocus={() => setPauseMenuIndex(3)} onSelect={() => selectPane("character", 3)} />
      </div>

      {settingsPane === "video" ? (
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
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (aspectRatio !== ratio) setAspectRatio(ratio);
                  }}
                >
                  {ratio}
                </button>
              );
            })}
          </div>
        </div>
      ) : settingsPane === "keybinds" ? (
        <div ref={settingsScrollRef} className="menu-scroll-panel w-full overflow-y-auto pr-1" style={settingsScrollPanelStyle}>
          <div className="settings-section-title mb-2 tracking-widest text-cyan-100/60">CONTROLS / REMAP</div>
          <div className="mb-2 grid gap-2 md:grid-cols-3">
            <RangeCard
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
            <RangeCard
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
      ) : settingsPane === "voice" ? (
        <div ref={settingsScrollRef} className="menu-scroll-panel w-full overflow-y-auto pr-1" style={settingsScrollPanelStyle}>
          <div className="settings-section-title mb-2 tracking-widest text-emerald-100/65">PROXIMITY VOICE / MIC</div>
          {voiceNeedsSecureOrigin && (
            <div className={cn("settings-card mb-2 border border-yellow-300/60 bg-yellow-300/10 p-2 text-yellow-100", settingsHintClass)}>
              LAN mic access needs HTTPS. Restart with `npm run dev:https`, then join from the other PC using the HTTPS LAN URL.
            </div>
          )}
          <div className="grid gap-2 md:grid-cols-2">
            <button
              data-settings-index={voiceEnabledIndex}
              className={cn(settingsCardClass, settingsFocus(voiceEnabledIndex) ? focusedMenuClass : "border-emerald-300/25 bg-emerald-400/5 hover:border-emerald-200/70")}
              onMouseEnter={() => setPauseMenuIndex(voiceEnabledIndex)}
              onClick={() => setVoiceChatEnabled(!voiceChatEnabled)}
            >
              <div className={cn(settingsTitleRowClass, "text-emerald-50")}>
                <span>Voice Chat</span>
                <span className={voiceChatEnabled ? "text-lime-200" : "text-red-200"}>{getVoiceEnabledLabel(voiceChatEnabled)}</span>
              </div>
              <div className={cn("mt-2 text-emerald-100/45", settingsHintClass)}>
                Turns your microphone and nearby player voices on or off.
              </div>
            </button>

            <button
              data-settings-index={voiceInputModeIndex}
              className={cn(settingsCardClass, settingsFocus(voiceInputModeIndex) ? focusedMenuClass : "border-emerald-300/25 bg-emerald-400/5 hover:border-emerald-200/70")}
              onMouseEnter={() => setPauseMenuIndex(voiceInputModeIndex)}
              onClick={toggleVoiceInputMode}
            >
              <div className={cn(settingsTitleRowClass, "text-emerald-50")}>
                <span>Input Mode</span>
                <span className="text-yellow-100">{getVoiceInputModeLabel(voiceInputMode)}</span>
              </div>
              <div className={cn("mt-2 text-emerald-100/45", settingsHintClass)}>
                D-pad left/right or A toggles between open mic and press-to-talk.
              </div>
            </button>

            <button
              data-settings-index={voicePushToTalkKeyIndex}
              className={cn(
                settingsCardClass,
                remappingVoiceKey
                  ? "border-pink-300 bg-pink-400/15 text-pink-50 shadow-[0_0_16px_rgba(244,114,182,0.45)]"
                  : settingsFocus(voicePushToTalkKeyIndex)
                    ? focusedMenuClass
                    : "border-emerald-300/25 bg-emerald-400/5 hover:border-emerald-200/70"
              )}
              onMouseEnter={() => setPauseMenuIndex(voicePushToTalkKeyIndex)}
              onClick={beginVoiceKeyRemap}
            >
              <div className={cn(settingsTitleRowClass, "text-emerald-50")}>
                <span>Press-To-Talk Key</span>
                <span className="border border-yellow-200/50 bg-yellow-200/10 px-2 py-0.5 text-yellow-100">
                  {getVoicePushToTalkKeyLabel(remappingVoiceKey, voicePushToTalkKey)}
                </span>
              </div>
              <div className={cn("mt-2 text-emerald-100/45", settingsHintClass)}>
                Controller press-to-talk is remapped from the Keybinds tab.
              </div>
            </button>

            <RangeCard
              index={voiceOutputVolumeIndex}
              title="Voice Volume"
              valueText={formatVoiceOutputVolumePercent(voiceOutputVolume)}
              accentClassName="accent-emerald-300"
              min={0}
              max={1}
              step={0.01}
              value={voiceOutputVolume}
              onReset={() => setVoiceOutputVolume(getDefaultVoiceOutputVolume())}
              onChange={setVoiceOutputVolume}
              isFocused={settingsFocus(voiceOutputVolumeIndex)}
              onFocus={() => setPauseMenuIndex(voiceOutputVolumeIndex)}
              hint="A resets, D-pad left/right adjusts"
            />

            <RangeCard
              index={voiceProximityRangeIndex}
              title="Proximity Range"
              valueText={formatVoiceProximityRangeMeters(voiceProximityRange)}
              accentClassName="accent-lime-300"
              min={8}
              max={64}
              step={1}
              value={voiceProximityRange}
              onReset={() => setVoiceProximityRange(getDefaultVoiceProximityRange())}
              onChange={setVoiceProximityRange}
              isFocused={settingsFocus(voiceProximityRangeIndex)}
              onFocus={() => setPauseMenuIndex(voiceProximityRangeIndex)}
              hint="Nearby voices fade out smoothly with distance."
            />

            <div className="settings-card border border-emerald-300/25 bg-black/30 p-3 text-left">
              <div className={cn(settingsTitleRowClass, "text-emerald-50")}>
                <span>Mic Status</span>
                <span className={isVoiceSpeaking ? "text-lime-200" : "text-emerald-100/45"}>{getVoiceActivityLabel(isVoiceSpeaking, voiceChatEnabled)}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden border border-emerald-200/30 bg-black">
                <div className={cn("h-full transition-all duration-100", isVoiceSpeaking ? "bg-lime-300 shadow-[0_0_12px_rgba(190,242,100,0.85)]" : "bg-emerald-900")} style={{ width: getVoiceActivityMeterWidth(isVoiceSpeaking, voiceChatEnabled) }} />
              </div>
              <div className={cn("mt-2 text-emerald-100/45", settingsHintClass)}>
                Speaking animation is driven by detected mic volume, then synced to other players.
              </div>
              <div className={cn("settings-status-line mt-2 border px-2 py-1 leading-4 tracking-widest", voiceError ? "border-red-300/50 bg-red-500/10 text-red-100" : "border-emerald-300/20 bg-emerald-400/5 text-emerald-100/65")}>
                {getVoiceStatusText(voiceError, voiceStatus)}
              </div>
            </div>
          </div>
        </div>
      ) : (
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
      )}

      <button
        data-settings-index={settingsBackIndex}
        className={cn(
          "mt-1 w-full border-[3px] border-gray-600 bg-gray-800 px-5 py-0.5 font-mono tracking-widest text-white uppercase transition-all hover:bg-gray-700",
          settingsFocus(settingsBackIndex) ? focusedMenuClass : ""
        )}
        style={{ fontSize: "var(--settings-body-font-size)" }}
        onMouseEnter={() => setPauseMenuIndex(settingsBackIndex)}
        onClick={onBack}
      >
        Back
      </button>
    </div>
  );
}
