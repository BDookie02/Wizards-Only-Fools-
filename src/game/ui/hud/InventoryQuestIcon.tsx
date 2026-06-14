import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function InventoryQuestIcon({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center border bg-black shadow-[inset_0_0_0_2px_rgba(255,255,255,0.05)] sm:h-14 sm:w-14",
        active ? "border-yellow-100/80" : "border-emerald-100/35",
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" className="h-8 w-8 sm:h-12 sm:w-12" role="img">
        <rect x="0" y="0" width="48" height="48" fill="#000000" />
        <path
          d="M12 9h19c3.6 0 6 2.2 6 5.6v22.7c0 .9-.7 1.7-1.7 1.7H15.8c-3.6 0-6-2.2-6-5.6V12c0-1.7 1.4-3 3.2-3Z"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3.2"
          strokeLinejoin="round"
        />
        <path d="M17 16h14M17 23h12M17 30h8" stroke="#ffffff" strokeWidth="3" strokeLinecap="square" />
        <path d="M32 10v27M12 36h23" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="square" />
        <path d="M34 18h7l-3.5 6 3.5 6h-7" fill="#ffffff" />
      </svg>
    </span>
  );
}
