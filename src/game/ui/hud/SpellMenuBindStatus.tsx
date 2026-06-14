import { type HandType, type SpellType } from "../../../store/gameStore";
import { spellNames } from "../../systems/spells/spellCatalog";
import { hotkeyLabels } from "./spellMenuRuntime";

type SpellMenuBindStatusProps = {
  bindingHand: HandType;
  bindingSelectedIndex: number;
  leftCurrentSpell: SpellType;
  rightCurrentSpell: SpellType;
};

export function SpellMenuBindStatus({
  bindingHand,
  bindingSelectedIndex,
  leftCurrentSpell,
  rightCurrentSpell,
}: SpellMenuBindStatusProps) {
  return (
    <div className="spell-menu-bind-status mb-2 grid grid-cols-3 gap-2 text-[8px] tracking-widest text-cyan-100/70">
      <div className="min-w-0 border border-cyan-300/20 bg-cyan-300/5 px-2 py-1.5">
        <div className="text-cyan-200/60">BINDING</div>
        <div className="truncate text-cyan-50">
          {bindingHand.toUpperCase()} SLOT {hotkeyLabels[bindingSelectedIndex]}
        </div>
      </div>
      <div className="min-w-0 border border-yellow-200/20 bg-yellow-200/5 px-2 py-1.5">
        <div className="text-yellow-100/60">LEFT</div>
        <div className="truncate text-yellow-50">{spellNames[leftCurrentSpell]}</div>
      </div>
      <div className="min-w-0 border border-fuchsia-200/20 bg-fuchsia-200/5 px-2 py-1.5">
        <div className="text-fuchsia-100/60">RIGHT</div>
        <div className="truncate text-fuchsia-50">{spellNames[rightCurrentSpell]}</div>
      </div>
    </div>
  );
}
