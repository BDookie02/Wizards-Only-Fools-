import type { CharacterCustomization } from "../../../store/gameStore";
import { characterColorPresets, type CharacterColorRow } from "./characterCustomizationConfig";
import { cn, focusedMenuClass, settingsHintClass } from "./settingsPanelClassNames";
import type { CharacterColorInputState } from "./settingsPanelRuntime";

type SettingsCharacterColorRowProps = {
  row: CharacterColorRow;
  index: number;
  colorInput: CharacterColorInputState;
  focused: boolean;
  onFocus: () => void;
  onCycle: (key: keyof CharacterCustomization, direction: 1 | -1) => void;
  onColorFieldChange: (key: keyof CharacterCustomization, value: string) => void;
  onColorTextChange: (key: keyof CharacterCustomization, value: string) => void;
};

export function SettingsCharacterColorRow({
  row,
  index,
  colorInput,
  focused,
  onFocus,
  onCycle,
  onColorFieldChange,
  onColorTextChange,
}: SettingsCharacterColorRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      data-settings-index={index}
      className={cn(
        "settings-card border bg-black/25 p-1.5 transition-all",
        focused ? focusedMenuClass : "border-pink-300/20 hover:border-pink-200/60"
      )}
      onMouseEnter={onFocus}
      onClick={() => onCycle(row.key, 1)}
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
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onColorFieldChange(row.key, event.currentTarget.value)}
        />
        <input
          aria-label={`${row.label} hex color`}
          className={cn(
            "settings-hex-input min-w-0 border bg-black/55 px-2 tracking-widest outline-none",
            colorInput.valid ? "border-pink-300/25 text-pink-50 focus:border-yellow-200" : "border-red-300/70 text-red-100"
          )}
          value={colorInput.rawValue}
          spellCheck={false}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onColorTextChange(row.key, event.currentTarget.value)}
        />
      </div>
      <div className="mt-1 grid grid-cols-[18px_1fr_18px] items-center gap-1">
        <button
          className="settings-nudge-button border border-pink-200/30 bg-pink-200/10 text-pink-50 hover:bg-pink-200/20"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onCycle(row.key, -1);
          }}
        >
          &lt;
        </button>
        <div className="flex min-w-0 justify-center gap-1">
          {characterColorPresets.map((preset) => (
            <span
              key={`${row.key}-${preset}`}
              className={cn(
                "h-3 w-3 border",
                colorInput.pickerValue.toLowerCase() === preset.toLowerCase()
                  ? "border-yellow-200 shadow-[0_0_8px_rgba(250,204,21,0.75)]"
                  : "border-white/20"
              )}
              style={{ backgroundColor: preset }}
            />
          ))}
        </div>
        <button
          className="settings-nudge-button border border-pink-200/30 bg-pink-200/10 text-pink-50 hover:bg-pink-200/20"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onCycle(row.key, 1);
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
}
