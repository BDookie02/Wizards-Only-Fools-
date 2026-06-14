import { type SpellType } from "../../../store/gameStore";
import { SpellMenuHotbarColumn } from "./SpellMenuHotbarColumn";
import {
  SpellMenuSpellPanel,
  type SpellMenuSpellPanelProps,
} from "./SpellMenuSpellPanel";

type SpellMenuLoadoutLayoutProps = SpellMenuSpellPanelProps & {
  leftHotbarSpells: SpellType[];
  rightHotbarSpells: SpellType[];
  leftSelectedHotbarIndex: number;
  rightSelectedHotbarIndex: number;
  onFocusSlot: (navIndex: number) => void;
};

export function SpellMenuLoadoutLayout({
  leftHotbarSpells,
  rightHotbarSpells,
  leftSelectedHotbarIndex,
  rightSelectedHotbarIndex,
  bindingHand,
  controllerFocusIndex,
  onFocusSlot,
  ...spellPanelProps
}: SpellMenuLoadoutLayoutProps) {
  return (
    <div className="spell-menu-layout relative mt-3 grid grid-cols-[78px_minmax(0,1fr)_78px] gap-2">
      <SpellMenuHotbarColumn
        hand="left"
        spells={leftHotbarSpells}
        selectedIndex={leftSelectedHotbarIndex}
        bindingHand={bindingHand}
        controllerFocusIndex={controllerFocusIndex}
        onFocusSlot={onFocusSlot}
      />

      <SpellMenuSpellPanel
        {...spellPanelProps}
        bindingHand={bindingHand}
        controllerFocusIndex={controllerFocusIndex}
      />

      <SpellMenuHotbarColumn
        hand="right"
        spells={rightHotbarSpells}
        selectedIndex={rightSelectedHotbarIndex}
        bindingHand={bindingHand}
        controllerFocusIndex={controllerFocusIndex}
        onFocusSlot={onFocusSlot}
      />
    </div>
  );
}
