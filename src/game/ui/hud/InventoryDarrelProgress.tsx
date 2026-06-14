import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { QuestFlagValue } from "../../../store/gameStore";
import { getDarrelQuestProgressRows } from "./inventoryPanelRuntime";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function InventoryDarrelProgress({ questFlags }: { questFlags: Record<string, QuestFlagValue> }) {
  const stepRows = getDarrelQuestProgressRows(questFlags);

  return (
    <div className="mt-3 grid gap-1.5">
      {stepRows.map(({ label, done }) => (
        <div
          key={label}
          className="flex min-w-0 flex-wrap items-center justify-between gap-2 border border-emerald-100/20 bg-black/25 px-2 py-1.5 text-[10px] uppercase tracking-[0.14em] text-emerald-50/75"
        >
          <span className="min-w-0 break-words">{label}</span>
          <span className={cn("shrink-0", done ? "text-yellow-100" : "text-emerald-100/40")}>
            {done ? "Done" : "Needed"}
          </span>
        </div>
      ))}
    </div>
  );
}
