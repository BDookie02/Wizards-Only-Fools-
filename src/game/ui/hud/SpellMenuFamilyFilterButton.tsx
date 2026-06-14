import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  getSpellMenuFamilyNavIndex,
  spellFamilyLabels,
  type SpellFamilyFilter,
} from "./spellMenuRuntime";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type SpellMenuFamilyFilterButtonProps = {
  family: SpellFamilyFilter;
  active: boolean;
  count: number;
  controllerFocusIndex: number;
  onFocusNav: (navIndex: number) => void;
  onSelectFamily: (family: SpellFamilyFilter, navIndex: number) => void;
};

export function SpellMenuFamilyFilterButton({
  family,
  active,
  count,
  controllerFocusIndex,
  onFocusNav,
  onSelectFamily,
}: SpellMenuFamilyFilterButtonProps) {
  const navIndex = getSpellMenuFamilyNavIndex(family);
  const focused = controllerFocusIndex === navIndex;

  return (
    <button
      type="button"
      data-testid={`spell-family-${family}`}
      data-spell-menu-nav-index={navIndex}
      aria-pressed={active}
      className={cn(
        "spell-menu-family-filter min-w-0 border px-2 py-1 text-[8px] tracking-widest transition-all",
        active
          ? "border-yellow-200 bg-yellow-200/15 text-yellow-50 shadow-[0_0_12px_rgba(250,204,21,0.28)]"
          : "border-cyan-300/25 bg-cyan-300/5 text-cyan-100/75 hover:border-cyan-200/70 hover:text-cyan-50",
        focused ? "ring-2 ring-white shadow-[0_0_16px_rgba(255,255,255,0.65)]" : ""
      )}
      onFocus={() => onFocusNav(navIndex)}
      onMouseEnter={() => onFocusNav(navIndex)}
      onClick={() => onSelectFamily(family, navIndex)}
    >
      <span>{spellFamilyLabels[family]}</span>
      <span className="spell-menu-family-count ml-1 text-cyan-100/45">{count}</span>
    </button>
  );
}
