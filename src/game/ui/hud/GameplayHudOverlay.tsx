import {
  ACID_DURATION_MS,
  ARMOR_MAX,
  POISON_DURATION_MS,
  RUNE_POWER_MAX,
  hasRunePower,
  type HandType,
  type SpellType,
} from "../../../store/gameStore";
import { spellColors, spellNames } from "../../systems/spells/spellCatalog";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
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

const hotkeyLabels = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

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
  const leftRuneReady = hasRunePower(leftRunePower);
  const rightRuneReady = hasRunePower(rightRunePower);
  const healthPercent = (health / 100) * 100;
  const armorPercent = (armor / ARMOR_MAX) * 100;
  const speedBoostSeconds = Math.ceil(Math.max(0, speedBoostUntil - buffClock) / 1000);
  const jumpBoostSeconds = Math.ceil(Math.max(0, jumpBoostUntil - buffClock) / 1000);
  const slowSeconds = Math.ceil(Math.max(0, slowUntil - buffClock) / 1000);
  const sleepSeconds = Math.ceil(Math.max(0, sleepUntil - buffClock) / 1000);
  const poisonSeconds = Math.ceil(Math.max(0, poisonUntil - buffClock) / 1000);
  const acidSeconds = Math.ceil(Math.max(0, acidUntil - buffClock) / 1000);
  const glassOrbActive = magicGlassOrbUntil > buffClock;
  const poisonPercent = Math.min(100, (Math.max(0, poisonUntil - buffClock) / POISON_DURATION_MS) * 100);
  const acidPercent = Math.min(100, (Math.max(0, acidUntil - buffClock) / ACID_DURATION_MS) * 100);
  const hasActiveBuff =
    speedBoostSeconds > 0 ||
    jumpBoostSeconds > 0 ||
    slowSeconds > 0 ||
    sleepSeconds > 0 ||
    poisonSeconds > 0 ||
    acidSeconds > 0 ||
    glassOrbActive;

  return (
    <div data-wof-hud-qa="gameplay-hud" className="hud-shell absolute bottom-0 left-0 w-full z-50 pointer-events-none">
      <div
        data-wof-hud-qa="mana-meter"
        className="mana-meter absolute left-1/2 pointer-events-none"
        style={{
          bottom: "calc(var(--hud-status-height) + 10px)",
          width: "min(clamp(220px, 72%, 400px), calc(100% - 32px))",
        }}
      >
        <div className="mana-meter-panel flex flex-col">
          <div className="mana-meter-title flex justify-center px-3 items-center text-[12px] text-[#a8a8a8] z-10 drop-shadow-[1px_1px_0_theme(colors.black)] font-mono pb-1 tracking-widest">
            <span>MANA</span>
          </div>
          <div className="mana-meter-bar w-full h-5 bg-black rounded-lg relative overflow-hidden box-content shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] flex gap-1">
            <div className="flex-1 relative bg-[#1a0e24]">
              <div
                className="absolute inset-y-0 left-0 bg-[#a855f7] shadow-[0_0_10px_rgba(168,85,247,0.8)] transition-all duration-300 ease-linear"
                style={{ width: `${(leftRunePower / RUNE_POWER_MAX) * 100}%` }}
              />
            </div>
            <div className="w-[2px] bg-[#120c16] shrink-0" />
            <div className="flex-1 relative bg-[#1a0e24]">
              <div
                className="absolute inset-y-0 right-0 bg-[#a855f7] shadow-[0_0_10px_rgba(168,85,247,0.8)] transition-all duration-300 ease-linear"
                style={{ width: `${(rightRunePower / RUNE_POWER_MAX) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div data-wof-hud-qa="status-bar" className="w-full wizard-panel flex items-center justify-between px-2 sm:px-4 overflow-hidden pointer-events-auto border-t-[6px] border-[#5d466e]" style={{ height: "var(--hud-status-height)" }}>
        <div className="hud-status-grid grid grid-cols-4 gap-1 sm:gap-2 md:gap-4 w-full h-full items-stretch p-1 sm:p-2">
          <div className="flex-1 flex flex-col items-center justify-center wizard-inset h-full overflow-hidden">
            <div className="hud-panel-title text-[#a8a8a8] text-[clamp(7px,1.2vw,12px)] mb-1 tracking-widest font-mono">GRIMOIRE</div>
            <div className="hud-hotkey-list flex w-full flex-col gap-1 px-1.5 sm:px-3 pb-1 text-[clamp(6px,1.05vw,11px)] font-sans">
              <div className="hud-hotkey-row flex items-center gap-2">
                <span className={cn("hud-hotkey-label w-5 text-[8px]", activeHand === "left" ? "text-yellow-300" : "text-[#555]")}>L</span>
                <div className="hud-hotkey-slots flex flex-1 justify-between gap-1">
                  {leftHotbarSpells.map((spell, index) => (
                    <div
                      key={`left-${spell}-${index}`}
                      className={cn(
                        "min-w-0 px-px transition-all duration-300",
                        leftSelectedHotbarIndex === index
                          ? spell === "lightning"
                            ? "text-blue-300 drop-shadow-[1px_1px_0_theme(colors.black)] font-bold scale-110"
                            : "text-yellow-400 drop-shadow-[1px_1px_0_theme(colors.black)] font-bold scale-110"
                          : "text-[#555]",
                      )}
                    >
                      {hotkeyLabels[index]}
                    </div>
                  ))}
                </div>
              </div>
              <div className="hud-hotkey-row flex items-center gap-2">
                <span className={cn("hud-hotkey-label w-5 text-[8px]", activeHand === "right" ? "text-fuchsia-300" : "text-[#555]")}>R</span>
                <div className="hud-hotkey-slots flex flex-1 justify-between gap-1">
                  {rightHotbarSpells.map((spell, index) => (
                    <div
                      key={`right-${spell}-${index}`}
                      className={cn(
                        "min-w-0 px-px transition-all duration-300",
                        rightSelectedHotbarIndex === index
                          ? "text-fuchsia-300 drop-shadow-[1px_1px_0_theme(colors.black)] font-bold scale-110"
                          : "text-[#555]",
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
                style={{ fontSize: "clamp(0.52rem, 1.45vw, 1.05rem)" }}
              >
                MAGIC STOWED
              </div>
            ) : (
              <>
                <div
                  className={cn(
                    "hud-spell-line max-w-full truncate px-1 text-center leading-none drop-shadow-[2px_2px_0_theme(colors.black)] font-mono",
                    leftRuneReady ? spellColors[leftCurrentSpell] : "text-[#555]",
                  )}
                  style={{ fontSize: "clamp(0.52rem, 1.45vw, 1.05rem)" }}
                >
                  L {leftRuneReady ? spellNames[leftCurrentSpell] : "No Mana"}
                </div>
                <div
                  className={cn(
                    "hud-spell-line max-w-full truncate px-1 text-center leading-none drop-shadow-[2px_2px_0_theme(colors.black)] font-mono",
                    rightRuneReady ? spellColors[rightCurrentSpell] : "text-[#555]",
                  )}
                  style={{ fontSize: "clamp(0.52rem, 1.45vw, 1.05rem)" }}
                >
                  R {rightRuneReady ? spellNames[rightCurrentSpell] : "No Mana"}
                </div>
              </>
            )}
            {hasActiveBuff && (
              <div className="hud-buff-list mt-1 flex max-w-full flex-wrap justify-center gap-1 text-[8px] leading-3 tracking-widest">
                {speedBoostSeconds > 0 && <span className="border border-yellow-300/50 bg-yellow-500/15 px-1 text-yellow-200">SPD {speedBoostSeconds}s</span>}
                {jumpBoostSeconds > 0 && <span className="border border-lime-300/50 bg-lime-500/15 px-1 text-lime-200">JMP {jumpBoostSeconds}s</span>}
                {slowSeconds > 0 && <span className="border border-slate-300/50 bg-slate-500/20 px-1 text-slate-100">SLOW {slowSeconds}s</span>}
                {sleepSeconds > 0 && <span className="border border-sky-200/50 bg-sky-500/20 px-1 text-sky-100">SLEEP {sleepSeconds}s</span>}
                {poisonSeconds > 0 && <span className="border border-purple-300/50 bg-purple-500/20 px-1 text-purple-100">POISON {poisonSeconds}s</span>}
                {acidSeconds > 0 && <span className="border border-green-300/50 bg-green-500/20 px-1 text-green-100">ACID {acidSeconds}s</span>}
                {glassOrbActive && <span className="border border-cyan-100/50 bg-cyan-400/15 px-1 text-cyan-50">ORB</span>}
              </div>
            )}
          </div>

          <div className="hud-vitality-panel flex-1 flex flex-col items-center justify-center wizard-inset h-full px-2 sm:px-4">
            <div className="hud-panel-title text-[12px] text-[#a8a8a8] mb-1 tracking-widest font-mono">VITALITY</div>
            {(poisonSeconds > 0 || acidSeconds > 0) && (
              <div className="mb-1 flex w-full flex-col gap-0.5">
                {poisonSeconds > 0 && (
                  <div className="relative h-2 w-full overflow-hidden border border-purple-300/45 bg-black shadow-[0_0_8px_rgba(168,85,247,0.45)]">
                    <div
                      className="absolute inset-y-0 left-0 bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.95)] transition-all duration-200"
                      style={{ width: `${poisonPercent}%` }}
                    />
                  </div>
                )}
                {acidSeconds > 0 && (
                  <div className="relative h-2 w-full overflow-hidden border border-green-300/45 bg-black shadow-[0_0_8px_rgba(34,197,94,0.45)]">
                    <div
                      className="absolute inset-y-0 left-0 bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.95)] transition-all duration-200"
                      style={{ width: `${acidPercent}%` }}
                    />
                  </div>
                )}
              </div>
            )}
            <div className="hud-health-bar relative h-5 w-full overflow-hidden border border-red-300/55 bg-black shadow-[inset_0_0_8px_rgba(0,0,0,0.9),0_0_10px_rgba(239,68,68,0.3)]">
              <div
                className="absolute inset-y-0 left-0 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)] transition-all duration-200"
                style={{ width: `${healthPercent}%` }}
              />
              <div className="hud-bar-label absolute inset-0 flex items-center justify-between px-2 text-[9px] leading-none text-red-50 drop-shadow-[1px_1px_0_theme(colors.black)]">
                <span>HEALTH</span>
                <span>{Math.round(health)}%</span>
              </div>
            </div>
            <div className="hud-armor-bar relative mt-1 h-5 w-full overflow-hidden border border-sky-200/55 bg-black shadow-[inset_0_0_8px_rgba(0,0,0,0.9),0_0_10px_rgba(56,189,248,0.35)]">
              <div
                className="absolute inset-y-0 left-0 bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.95)] transition-all duration-200"
                style={{ width: `${armorPercent}%` }}
              />
              <div className="hud-bar-label absolute inset-0 flex items-center justify-between px-2 text-[9px] leading-none text-sky-50 drop-shadow-[1px_1px_0_theme(colors.black)]">
                <span>ARMOR</span>
                <span>{Math.round(armor)}/{ARMOR_MAX}</span>
              </div>
            </div>
          </div>

          <div className="hud-aether-panel flex-1 flex flex-col items-center justify-center wizard-inset h-full px-2 sm:px-4">
            <div className="hud-panel-title text-[12px] text-[#a8a8a8] mb-2 tracking-widest font-mono">AETHER</div>
            <div className="w-full">
              <div className="hud-aether-bar w-full h-6 bg-black border border-[#211627] relative overflow-hidden box-content shadow-[0_0_0_2px_#4a3359]">
                <div
                  className="absolute inset-y-0 left-0 bg-blue-500"
                  style={{ width: `${thrusterFuel * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
