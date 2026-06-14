import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { SPELL_MENU_NAV_CLOSE_INDEX } from "./spellMenuRuntime";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type SpellMenuCloseButtonProps = {
  focused: boolean;
  onFocusClose: () => void;
  onClose: () => void;
};

export function SpellMenuCloseButton({
  focused,
  onFocusClose,
  onClose,
}: SpellMenuCloseButtonProps) {
  return (
    <button
      data-testid="spell-menu-close"
      data-spell-menu-nav-index={SPELL_MENU_NAV_CLOSE_INDEX}
      className={cn(
        "spell-menu-close-button border border-cyan-300/70 bg-cyan-300/10 px-3 py-2 text-[10px] tracking-widest text-cyan-100 hover:bg-cyan-200/20",
        focused ? "ring-2 ring-white shadow-[0_0_16px_rgba(255,255,255,0.65)]" : ""
      )}
      onFocus={onFocusClose}
      onMouseEnter={onFocusClose}
      onClick={onClose}
    >
      E CLOSE
    </button>
  );
}
