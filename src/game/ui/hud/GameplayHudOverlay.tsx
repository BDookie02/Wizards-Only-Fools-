import { type HandType, type SpellType } from "../../../store/gameStore";
import { spellColors, spellNames } from "../../systems/spells/spellCatalog";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  GAMEPLAY_HUD_MANA_METER_STYLE,
  GAMEPLAY_HUD_SPELL_LINE_STYLE,
  GAMEPLAY_HUD_STATUS_BAR_STYLE,
  formatGameplayHudPercentWidth,
  getGameplayHudHandLabelTone,
  getGameplayHudHotkeySlotTone,
  resolveGameplayHudOverlayState,
} from "./gameplayHudOverlayRuntime";
import { hotkeyLabels } from "./hudHotkeyLabels";
import { useHudBuffClock } from "./useHudBuffClock";

type GameplayHudOverlayProps = {
  activeHand: HandType;
  isMagicArmed: boolean;
  leftCurrentSpell: SpellType;
  rightCurrentSpell: SpellType;
  leftHotbarSpells: SpellType[];
  rightHotbarSpells: SpellType[];
  leftSelectedHotbarIndex: number;
  rightSelectedHotbarIndex: number;
  leftRunePower: number;
  rightRunePower: number;
  health: number;
  armor: number;
  thrusterFuel: number;
  speedBoostUntil: number;
  jumpBoostUntil: number;
  slowUntil: number;
  sleepUntil: number;
  poisonUntil: number;
  acidUntil: number;
  magicGlassOrbUntil: number;
};

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function GameplayHudOverlay({
  activeHand,
  isMagicArmed,
  leftCurrentSpell,
  rightCurrentSpell,
  leftHotbarSpells,
  rightHotbarSpells,
  leftSelectedHotbarIndex,
  rightSelectedHotbarIndex,
  leftRunePower,
  rightRunePower,
  health,
  armor,
  thrusterFuel,
  speedBoostUntil,
  jumpBoostUntil,
  slowUntil,
  sleepUntil,
  poisonUntil,
  acidUntil,
  magicGlassOrbUntil,
}: GameplayHudOverlayProps) {
  const buffClock = useHudBuffClock({
    speedBoostUntil,
    jumpBoostUntil,
    slowUntil,
    sleepUntil,
    poisonUntil,
    acidUntil,
    magicGlassOrbUntil,
  });
  const hud = resolveGameplayHudOverlayState({
    leftRunePower,
    rightRunePower,
    health,
    armor,
    thrusterFuel,
    speedBoostUntil,
    jumpBoostUntil,
    slowUntil,
    sleepUntil,
    poisonUntil,
    acidUntil,
    magicGlassOrbUntil,
    buffClock,
  });

  return (
    <div data-wof-hud-qa="gameplay-hud" className="hud-shell absolute bottom-0 left-0 w-full z-50 pointer-events-none">
      <div
        data-wof-hud-qa="mana-meter"
        className="mana-meter absolute left-1/2 pointer-events-none"
        style={GAMEPLAY_HUD_MANA_METER_STYLE}
      >
        <div className="mana-meter-panel flex flex-col">
          <div className="mana-meter-title flex justify-center px-3 items-center text-[12px] text-[#a8a8a8] z-10 drop-shadow-[1px_1px_0_theme(colors.black)] font-mono pb-1 tracking-widest">
            <span>MANA</span>
          </div>
          <div className="mana-meter-bar w-full h-5 bg-black rounded-lg relative overflow-hidden box-content shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] flex gap-1">
            <div className="flex-1 relative bg-[#1a0e24]">
              <div
                className="absolute inset-y-0 left-0 bg-[#a855f7] shadow-[0_0_10px_rgba(168,85,247,0.8)] transition-all duration-300 ease-linear"
                style={{ width: formatGameplayHudPercentWidth(hud.leftManaPercent) }}
              />
            </div>
            <div className="w-[2px] bg-[#120c16] shrink-0" />
            <div className="flex-1 relative bg-[#1a0e24]">
              <div
                className="absolute inset-y-0 right-0 bg-[#a855f7] shadow-[0_0_10px_rgba(168,85,247,0.8)] transition-all duration-300 ease-linear"
                style={{ width: formatGameplayHudPercentWidth(hud.rightManaPercent) }}
              />
            </div>
          </div>
        </div>
      </div>

      <div data-wof-hud-qa="status-bar" className="w-full wizard-panel flex items-center justify-between px-2 sm:px-4 overflow-hidden pointer-events-auto border-t-[6px] border-[#5d466e]" style={GAMEPLAY_HUD_STATUS_BAR_STYLE}>
        <div className="hud-status-grid grid grid-cols-4 gap-1 sm:gap-2 md:gap-4 w-full h-full items-stretch p-1 sm:p-2">
          <div className="flex-1 flex flex-col items-center justify-center wizard-inset h-full overflow-hidden">
            <div className="hud-panel-title text-[#a8a8a8] text-[clamp(7px,1.2vw,12px)] mb-1 tracking-widest font-mono">GRIMOIRE</div>
            <div className="hud-hotkey-list flex w-full flex-col gap-1 px-1.5 sm:px-3 pb-1 text-[clamp(6px,1.05vw,11px)] font-sans">
              <div className="hud-hotkey-row flex items-center gap-2">
                <span className={cn("hud-hotkey-label w-5 text-[8px]", getGameplayHudHandLabelTone(activeHand, "left"))}>L</span>
                <div className="hud-hotkey-slots flex flex-1 justify-between gap-1">
                  {leftHotbarSpells.map((spell, index) => (
                    <div
                      key={`left-${spell}-${index}`}
                      className={cn(
                        "min-w-0 px-px transition-all duration-300",
                        getGameplayHudHotkeySlotTone("left", spell, index, leftSelectedHotbarIndex),
                      )}
                    >
                      {hotkeyLabels[index]}
                    </div>
                  ))}
                </div>
              </div>
              <div className="hud-hotkey-row flex items-center gap-2">
                <span className={cn("hud-hotkey-label w-5 text-[8px]", getGameplayHudHandLabelTone(activeHand, "right"))}>R</span>
                <div className="hud-hotkey-slots flex flex-1 justify-between gap-1">
                  {rightHotbarSpells.map((spell, index) => (
                    <div
                      key={`right-${spell}-${index}`}
                      className={cn(
                        "min-w-0 px-px transition-all duration-300",
                        getGameplayHudHotkeySlotTone("right", spell, index, rightSelectedHotbarIndex),
                      )}
                    >
                      {hotkeyLabels[index]}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center wizard-inset h-full overflow-hidden">
            <div className="hud-panel-title text-[clamp(8px,1.3vw,12px)] text-[#a8a8a8] mb-1 tracking-widest font-mono">SPELLS</div>
            {!isMagicArmed ? (
              <div
                className="hud-spell-line max-w-full truncate px-1 text-center font-mono leading-none text-cyan-100/65 drop-shadow-[2px_2px_0_theme(colors.black)]"
                style={GAMEPLAY_HUD_SPELL_LINE_STYLE}
              >
                MAGIC STOWED
              </div>
            ) : (
              <>
                <div
                  className={cn(
                    "hud-spell-line max-w-full truncate px-1 text-center leading-none drop-shadow-[2px_2px_0_theme(colors.black)] font-mono",
                    hud.leftRuneReady ? spellColors[leftCurrentSpell] : "text-[#555]",
                  )}
                  style={GAMEPLAY_HUD_SPELL_LINE_STYLE}
                >
                  L {hud.leftRuneReady ? spellNames[leftCurrentSpell] : "No Mana"}
                </div>
                <div
                  className={cn(
                    "hud-spell-line max-w-full truncate px-1 text-center leading-none drop-shadow-[2px_2px_0_theme(colors.black)] font-mono",
                    hud.rightRuneReady ? spellColors[rightCurrentSpell] : "text-[#555]",
                  )}
                  style={GAMEPLAY_HUD_SPELL_LINE_STYLE}
                >
                  R {hud.rightRuneReady ? spellNames[rightCurrentSpell] : "No Mana"}
                </div>
              </>
            )}
            {hud.hasActiveBuff && (
              <div className="hud-buff-list mt-1 flex max-w-full flex-wrap justify-center gap-1 text-[8px] leading-3 tracking-widest">
                {hud.speedBoostSeconds > 0 && <span className="border border-yellow-300/50 bg-yellow-500/15 px-1 text-yellow-200">SPD {hud.speedBoostSeconds}s</span>}
                {hud.jumpBoostSeconds > 0 && <span className="border border-lime-300/50 bg-lime-500/15 px-1 text-lime-200">JMP {hud.jumpBoostSeconds}s</span>}
                {hud.slowSeconds > 0 && <span className="border border-slate-300/50 bg-slate-500/20 px-1 text-slate-100">SLOW {hud.slowSeconds}s</span>}
                {hud.sleepSeconds > 0 && <span className="border border-sky-200/50 bg-sky-500/20 px-1 text-sky-100">SLEEP {hud.sleepSeconds}s</span>}
                {hud.poisonSeconds > 0 && <span className="border border-purple-300/50 bg-purple-500/20 px-1 text-purple-100">POISON {hud.poisonSeconds}s</span>}
                {hud.acidSeconds > 0 && <span className="border border-green-300/50 bg-green-500/20 px-1 text-green-100">ACID {hud.acidSeconds}s</span>}
                {hud.glassOrbActive && <span className="border border-cyan-100/50 bg-cyan-400/15 px-1 text-cyan-50">ORB</span>}
              </div>
            )}
          </div>

          <div className="hud-vitality-panel flex-1 flex flex-col items-center justify-center wizard-inset h-full px-2 sm:px-4">
            <div className="hud-panel-title text-[12px] text-[#a8a8a8] mb-1 tracking-widest font-mono">VITALITY</div>
            {(hud.poisonSeconds > 0 || hud.acidSeconds > 0) && (
              <div className="mb-1 flex w-full flex-col gap-0.5">
                {hud.poisonSeconds > 0 && (
                  <div className="relative h-2 w-full overflow-hidden border border-purple-300/45 bg-black shadow-[0_0_8px_rgba(168,85,247,0.45)]">
                    <div
                      className="absolute inset-y-0 left-0 bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.95)] transition-all duration-200"
                      style={{ width: formatGameplayHudPercentWidth(hud.poisonPercent) }}
                    />
                  </div>
                )}
                {hud.acidSeconds > 0 && (
                  <div className="relative h-2 w-full overflow-hidden border border-green-300/45 bg-black shadow-[0_0_8px_rgba(34,197,94,0.45)]">
                    <div
                      className="absolute inset-y-0 left-0 bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.95)] transition-all duration-200"
                      style={{ width: formatGameplayHudPercentWidth(hud.acidPercent) }}
                    />
                  </div>
                )}
              </div>
            )}
            <div className="hud-health-bar relative h-5 w-full overflow-hidden border border-red-300/55 bg-black shadow-[inset_0_0_8px_rgba(0,0,0,0.9),0_0_10px_rgba(239,68,68,0.3)]">
              <div
                className="absolute inset-y-0 left-0 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)] transition-all duration-200"
                style={{ width: formatGameplayHudPercentWidth(hud.healthPercent) }}
              />
              <div className="hud-bar-label absolute inset-0 flex items-center justify-between px-2 text-[9px] leading-none text-red-50 drop-shadow-[1px_1px_0_theme(colors.black)]">
                <span>HEALTH</span>
                <span>{hud.healthLabel}</span>
              </div>
            </div>
            <div className="hud-armor-bar relative mt-1 h-5 w-full overflow-hidden border border-sky-200/55 bg-black shadow-[inset_0_0_8px_rgba(0,0,0,0.9),0_0_10px_rgba(56,189,248,0.35)]">
              <div
                className="absolute inset-y-0 left-0 bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.95)] transition-all duration-200"
                style={{ width: formatGameplayHudPercentWidth(hud.armorPercent) }}
              />
              <div className="hud-bar-label absolute inset-0 flex items-center justify-between px-2 text-[9px] leading-none text-sky-50 drop-shadow-[1px_1px_0_theme(colors.black)]">
                <span>ARMOR</span>
                <span>{hud.armorLabel}</span>
              </div>
            </div>
          </div>

          <div className="hud-aether-panel flex-1 flex flex-col items-center justify-center wizard-inset h-full px-2 sm:px-4">
            <div className="hud-panel-title text-[12px] text-[#a8a8a8] mb-2 tracking-widest font-mono">AETHER</div>
            <div className="w-full">
              <div className="hud-aether-bar w-full h-6 bg-black border border-[#211627] relative overflow-hidden box-content shadow-[0_0_0_2px_#4a3359]">
                <div
                  className="absolute inset-y-0 left-0 bg-blue-500"
                  style={{ width: formatGameplayHudPercentWidth(hud.thrusterPercent) }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
