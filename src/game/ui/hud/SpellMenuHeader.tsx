import { SPELL_MENU_NAV_CLOSE_INDEX } from "./spellMenuRuntime";
import { SpellMenuCloseButton } from "./SpellMenuCloseButton";

type SpellMenuHeaderProps = {
  controllerFocusIndex: number;
  onFocusClose: (navIndex: number) => void;
  onClose: () => void;
};

export function SpellMenuHeader({
  controllerFocusIndex,
  onFocusClose,
  onClose,
}: SpellMenuHeaderProps) {
  return (
    <div className="spell-menu-header sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-cyan-300/40 bg-[#12071f]/95 pb-3 backdrop-blur-[2px]">
      <div className="min-w-0">
        <div className="spell-menu-kicker text-[10px] tracking-[0.4em] text-cyan-300/80">ARCANE LOADOUT</div>
        <div className="spell-menu-title mt-2 text-2xl text-white drop-shadow-[0_0_8px_rgba(103,232,249,0.9)]">SPELL BOOK</div>
      </div>
      <SpellMenuCloseButton
        focused={controllerFocusIndex === SPELL_MENU_NAV_CLOSE_INDEX}
        onFocusClose={() => onFocusClose(SPELL_MENU_NAV_CLOSE_INDEX)}
        onClose={onClose}
      />
    </div>
  );
}
