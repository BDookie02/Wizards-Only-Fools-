import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type PauseRuleButtonProps = {
  index: number;
  label: string;
  value: string;
  hint: string;
  focused: boolean;
  onFocus: () => void;
  onStep: (direction: 1 | -1) => void;
};

export function PauseRuleButton({ index, label, value, hint, focused, onFocus, onStep }: PauseRuleButtonProps) {
  return (
    <button
      type="button"
      data-menu-index={index}
      onClick={(event) => {
        event.stopPropagation();
        onStep(1);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onStep(-1);
      }}
      onMouseEnter={onFocus}
      className={cn(
        "pause-rule-button grid w-full grid-cols-[minmax(100px,0.75fr)_minmax(110px,1fr)] items-center gap-3 border-2 bg-black/45 px-3 py-2 text-left transition-all hover:border-yellow-200",
        focused ? "border-yellow-200 shadow-[0_0_18px_rgba(250,204,21,0.35)]" : "border-cyan-100/30",
      )}
    >
      <span className="pause-rule-label text-cyan-100/70">{label}</span>
      <span className="pause-rule-value font-bold text-white">{value}</span>
      <span className="pause-rule-hint col-span-2 normal-case text-cyan-100/45">{hint}</span>
    </button>
  );
}
