import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { type HandType, type SpellType } from "../../../store/gameStore";
import { spellColors, spellNames } from "../../systems/spells/spellCatalog";
import {
  getSpellMenuFamilyForSpell,
  hotkeyLabels,
  spellFamilyLabels,
} from "./spellMenuRuntime";
import { SpellThumbnail } from "./SpellThumbnail";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type SpellMenuCardProps = {
  spell: SpellType;
  spellIndex: number;
  navIndex: number;
  bindingHand: HandType;
  assignedSlot: number;
  leftAssignedSlot: number;
  rightAssignedSlot: number;
  highlighted: boolean;
  focused: boolean;
  current: boolean;
  onFocusCard: () => void;
  onSelectCard: () => void;
};

export function SpellMenuCard({
  spell,
  spellIndex,
  navIndex,
  bindingHand,
  assignedSlot,
  leftAssignedSlot,
  rightAssignedSlot,
  highlighted,
  focused,
  current,
  onFocusCard,
  onSelectCard,
}: SpellMenuCardProps) {
  const familyLabel = spellFamilyLabels[getSpellMenuFamilyForSpell(spell)];

  return (
    <button
      data-spell-index={spellIndex}
      data-spell-menu-nav-index={navIndex}
      className={cn(
        "spell-menu-card group relative min-h-[84px] min-w-0 border p-1.5 text-left transition-all",
        highlighted
          ? "border-yellow-200 bg-yellow-200/10 text-yellow-100 shadow-[0_0_20px_rgba(250,204,21,0.45)]"
          : "border-cyan-300/30 bg-cyan-400/5 text-cyan-100 hover:border-cyan-200/80 hover:bg-cyan-300/10",
        current ? "ring-1 ring-white/70" : "",
        focused ? "ring-2 ring-white shadow-[0_0_18px_rgba(255,255,255,0.7)]" : ""
      )}
      onMouseEnter={onFocusCard}
      onFocus={onFocusCard}
      onClick={onSelectCard}
    >
      <div className="spell-menu-card-badges mb-1 flex min-w-0 items-center justify-between gap-1 text-[6px] tracking-widest">
        <span className="truncate text-cyan-100/45">{familyLabel}</span>
        {current && <span className="text-white/75">ACTIVE</span>}
      </div>
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "spell-menu-thumb relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border border-cyan-200/30",
            spell === "portal" ? "bg-indigo-300/10" : "bg-cyan-300/5"
          )}
        >
          <SpellThumbnail spell={spell} animate={highlighted} deferRank={spellIndex} />
        </div>
        <div className="min-w-0">
          <div className={cn("truncate text-[8px] leading-4", spellColors[spell])}>{spellNames[spell]}</div>
          <div className="text-[8px] tracking-widest text-cyan-100/60">
            {assignedSlot === -1 ? "UNBOUND" : `${bindingHand.toUpperCase()} ${hotkeyLabels[assignedSlot]}`}
          </div>
          <div className="text-[7px] tracking-widest text-cyan-100/35">
            {leftAssignedSlot === -1 ? "" : `L${hotkeyLabels[leftAssignedSlot]} `}
            {rightAssignedSlot === -1 ? "" : `R${hotkeyLabels[rightAssignedSlot]}`}
          </div>
        </div>
      </div>
      <div className="mt-3 h-[2px] bg-cyan-200/20">
        <div className={cn("h-full transition-all", highlighted ? "w-full bg-yellow-200" : "w-1/3 bg-cyan-300/70")} />
      </div>
    </button>
  );
}
