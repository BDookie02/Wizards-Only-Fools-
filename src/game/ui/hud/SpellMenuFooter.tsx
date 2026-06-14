import { type HandType, type SpellType } from "../../../store/gameStore";
import { spellNames } from "../../systems/spells/spellCatalog";
import { hotkeyLabels } from "./spellMenuRuntime";

type SpellMenuFooterProps = {
  bindingHand: HandType;
  bindingSelectedIndex: number;
  highlightedSpell: SpellType;
};

export function SpellMenuFooter({
  bindingHand,
  bindingSelectedIndex,
  highlightedSpell,
}: SpellMenuFooterProps) {
  return (
    <div className="spell-menu-footer relative mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-cyan-300/30 pt-3 text-[9px] tracking-widest text-cyan-100/70">
      <span>ARROWS/WHEEL/D-PAD SELECT SPELL</span>
      <span>PRESS 1-0 OR A TO BIND, HOLD Q OR LB/RB CHOOSE HAND</span>
      <span>
        HIGHLIGHTED: {bindingHand.toUpperCase()} {hotkeyLabels[bindingSelectedIndex]} / {spellNames[highlightedSpell]}
      </span>
    </div>
  );
}
