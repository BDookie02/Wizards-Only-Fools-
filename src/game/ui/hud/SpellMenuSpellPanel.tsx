import { type HandType, type SpellType } from "../../../store/gameStore";
import {
  type SpellFamilyFilter,
  type SpellMenuHotbarSlotLookup,
} from "./spellMenuRuntime";
import { SpellMenuBindStatus } from "./SpellMenuBindStatus";
import { SpellMenuFilterRow } from "./SpellMenuFilterRow";
import { SpellMenuGrid } from "./SpellMenuGrid";

export type SpellMenuSpellPanelProps = {
  bindingHand: HandType;
  bindingSelectedIndex: number;
  leftCurrentSpell: SpellType;
  rightCurrentSpell: SpellType;
  activeFamily: SpellFamilyFilter;
  familyCounts: Record<SpellFamilyFilter, number>;
  visibleSpells: readonly SpellType[];
  menuSpellIndex: number;
  controllerFocusIndex: number;
  leftHotbarSlotLookup: SpellMenuHotbarSlotLookup;
  rightHotbarSlotLookup: SpellMenuHotbarSlotLookup;
  bindingHotbarSlotLookup: SpellMenuHotbarSlotLookup;
  onFilterFocusNav: (navIndex: number) => void;
  onSelectFamily: (family: SpellFamilyFilter, navIndex: number) => void;
  onFocusNav: (navIndex: number) => void;
  onAssignSpell: (slotIndex: number, spell: SpellType) => void;
};

export function SpellMenuSpellPanel({
  bindingHand,
  bindingSelectedIndex,
  leftCurrentSpell,
  rightCurrentSpell,
  activeFamily,
  familyCounts,
  visibleSpells,
  menuSpellIndex,
  controllerFocusIndex,
  leftHotbarSlotLookup,
  rightHotbarSlotLookup,
  bindingHotbarSlotLookup,
  onFilterFocusNav,
  onSelectFamily,
  onFocusNav,
  onAssignSpell,
}: SpellMenuSpellPanelProps) {
  return (
    <div className="spell-menu-spell-panel min-w-0 border border-cyan-300/20 bg-black/10 p-2">
      <SpellMenuBindStatus
        bindingHand={bindingHand}
        bindingSelectedIndex={bindingSelectedIndex}
        leftCurrentSpell={leftCurrentSpell}
        rightCurrentSpell={rightCurrentSpell}
      />

      <SpellMenuFilterRow
        activeFamily={activeFamily}
        familyCounts={familyCounts}
        controllerFocusIndex={controllerFocusIndex}
        visibleCount={visibleSpells.length}
        onFocusNav={onFilterFocusNav}
        onSelectFamily={onSelectFamily}
      />

      <SpellMenuGrid
        visibleSpells={visibleSpells}
        menuSpellIndex={menuSpellIndex}
        controllerFocusIndex={controllerFocusIndex}
        bindingHand={bindingHand}
        bindingSelectedIndex={bindingSelectedIndex}
        leftHotbarSlotLookup={leftHotbarSlotLookup}
        rightHotbarSlotLookup={rightHotbarSlotLookup}
        bindingHotbarSlotLookup={bindingHotbarSlotLookup}
        leftCurrentSpell={leftCurrentSpell}
        rightCurrentSpell={rightCurrentSpell}
        onFocusNav={onFocusNav}
        onAssignSpell={onAssignSpell}
      />
    </div>
  );
}
