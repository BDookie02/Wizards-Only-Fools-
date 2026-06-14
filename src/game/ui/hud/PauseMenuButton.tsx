import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const PAUSE_FOCUSED_MENU_CLASS =
  "ring-2 ring-yellow-200 ring-offset-2 ring-offset-black shadow-[0_0_20px_rgba(250,204,21,0.55)] brightness-125";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type PauseMenuButtonProps = {
  index: number;
  label: string;
  hint: string;
  focused: boolean;
  onFocus: () => void;
  onSelect: () => void;
};

export function PauseMenuButton({ index, label, hint, focused, onFocus, onSelect }: PauseMenuButtonProps) {
  return (
    <button
      type="button"
      data-menu-index={index}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onMouseEnter={onFocus}
      className={cn(
        "pause-menu-button wizard-panel w-full cursor-pointer border-2 border-purple-300/45 bg-[#15081f]/80 px-5 py-3 text-left font-mono uppercase tracking-widest text-white shadow-[6px_6px_0_rgba(0,0,0,0.65)] transition-all hover:brightness-125",
        focused ? PAUSE_FOCUSED_MENU_CLASS : "",
      )}
    >
      <span className="pause-menu-button-label block font-bold text-yellow-100">{label}</span>
      <span className="pause-menu-button-hint mt-1 block normal-case text-cyan-100/70">{hint}</span>
    </button>
  );
}
