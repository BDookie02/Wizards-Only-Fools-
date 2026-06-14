import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { type HandType, type SpellType } from "../../../store/gameStore";
import { spellNames } from "../../systems/spells/spellCatalog";
import {
  getSpellMenuHotbarNavIndex,
  hotkeyLabels,
} from "./spellMenuRuntime";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type SpellMenuHotbarColumnProps = {
  hand: HandType;
  spells: SpellType[];
  selectedIndex: number;
  bindingHand: HandType;
  controllerFocusIndex: number;
  onFocusSlot: (navIndex: number) => void;
};

export function SpellMenuHotbarColumn({
  hand,
  spells,
  selectedIndex,
  bindingHand,
  controllerFocusIndex,
  onFocusSlot,
}: SpellMenuHotbarColumnProps) {
  return (
    <div
      className={cn(
        "spell-menu-hotbar-column relative min-w-0 border p-1.5 shadow-[0_0_22px_rgba(8,47,73,0.75),inset_0_0_20px_rgba(34,211,238,0.12)]",
        hand === "right"
          ? "border-fuchsia-300/55 bg-fuchsia-950/55"
          : "border-yellow-200/55 bg-yellow-950/45",
        bindingHand === hand ? "ring-1 ring-white/70" : ""
      )}
    >
      <div
        className={cn(
          "border-b pb-1 text-center text-[8px] tracking-[0.25em]",
          hand === "right" ? "border-fuchsia-300/35 text-fuchsia-100" : "border-yellow-200/35 text-yellow-100"
        )}
      >
        {hand === "left" ? "LEFT" : "RIGHT"}
      </div>
      <div className="mt-1.5 flex flex-col gap-1">
        {spells.map((spell, index) => {
          const navIndex = getSpellMenuHotbarNavIndex(hand, index);
          const isControllerFocused = controllerFocusIndex === navIndex;
          return (
            <button
              key={`${hand}-${spell}-${index}`}
              data-spell-menu-nav-index={navIndex}
              className={cn(
                "spell-menu-hotbar-slot grid h-8 min-w-0 grid-cols-[16px_1fr] items-center gap-1 border bg-black/45 px-1 text-left transition-all",
                selectedIndex === index
                  ? hand === "right"
                    ? "border-fuchsia-200 bg-fuchsia-300/20 text-fuchsia-50 shadow-[0_0_14px_rgba(217,70,239,0.65)]"
                    : "border-yellow-200 bg-yellow-200/20 text-yellow-50 shadow-[0_0_14px_rgba(253,224,71,0.55)]"
                  : hand === "right"
                    ? "border-fuchsia-300/25 text-fuchsia-100/75 hover:border-fuchsia-200/80"
                    : "border-yellow-200/25 text-yellow-100/75 hover:border-yellow-100/80",
                bindingHand === hand ? "brightness-125" : "",
                isControllerFocused ? "ring-2 ring-white shadow-[0_0_16px_rgba(255,255,255,0.65)]" : ""
              )}
              onMouseEnter={() => onFocusSlot(navIndex)}
              onFocus={() => onFocusSlot(navIndex)}
              onClick={() => onFocusSlot(navIndex)}
            >
              <div className="text-center text-[9px] text-white/80">{hotkeyLabels[index]}</div>
              <div className="truncate text-[7px] leading-3">{spellNames[spell]}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
