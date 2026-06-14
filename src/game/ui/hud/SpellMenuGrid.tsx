import { type HandType, type SpellType } from "../../../store/gameStore";
import {
  getSpellMenuAssignedSlot,
  getSpellMenuIndex,
  getSpellMenuSpellNavIndex,
  type SpellMenuHotbarSlotLookup,
} from "./spellMenuRuntime";
import { SpellMenuCard } from "./SpellMenuCard";

type SpellMenuGridProps = {
  visibleSpells: readonly SpellType[];
  menuSpellIndex: number;
  controllerFocusIndex: number;
  bindingHand: HandType;
  bindingSelectedIndex: number;
  leftHotbarSlotLookup: SpellMenuHotbarSlotLookup;
  rightHotbarSlotLookup: SpellMenuHotbarSlotLookup;
  bindingHotbarSlotLookup: SpellMenuHotbarSlotLookup;
  leftCurrentSpell: SpellType;
  rightCurrentSpell: SpellType;
  onFocusNav: (navIndex: number) => void;
  onAssignSpell: (slotIndex: number, spell: SpellType) => void;
};

export function SpellMenuGrid({
  visibleSpells,
  menuSpellIndex,
  controllerFocusIndex,
  bindingHand,
  bindingSelectedIndex,
  leftHotbarSlotLookup,
  rightHotbarSlotLookup,
  bindingHotbarSlotLookup,
  leftCurrentSpell,
  rightCurrentSpell,
  onFocusNav,
  onAssignSpell,
}: SpellMenuGridProps) {
  return (
    <div className="spell-menu-grid grid grid-cols-3 gap-2 md:grid-cols-5">
      {visibleSpells.map((spell) => {
        const index = getSpellMenuIndex(spell);
        const navIndex = getSpellMenuSpellNavIndex(index);
        const isHighlighted = index === menuSpellIndex;
        const isControllerFocused = controllerFocusIndex === navIndex;
        const leftAssignedSlot = getSpellMenuAssignedSlot(leftHotbarSlotLookup, spell);
        const rightAssignedSlot = getSpellMenuAssignedSlot(rightHotbarSlotLookup, spell);
        const assignedSlot = getSpellMenuAssignedSlot(bindingHotbarSlotLookup, spell);
        const isCurrent = spell === leftCurrentSpell || spell === rightCurrentSpell;

        return (
          <SpellMenuCard
            key={spell}
            spell={spell}
            spellIndex={index}
            navIndex={navIndex}
            bindingHand={bindingHand}
            assignedSlot={assignedSlot}
            leftAssignedSlot={leftAssignedSlot}
            rightAssignedSlot={rightAssignedSlot}
            highlighted={isHighlighted}
            focused={isControllerFocused}
            current={isCurrent}
            onFocusCard={() => onFocusNav(navIndex)}
            onSelectCard={() => {
              onFocusNav(navIndex);
              onAssignSpell(bindingSelectedIndex, spell);
            }}
          />
        );
      })}
    </div>
  );
}
