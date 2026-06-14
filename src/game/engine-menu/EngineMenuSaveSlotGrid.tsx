import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  ENGINE_MENU_SLOT_IDS,
  getEngineMenuSlotLabel,
  getSelectedEngineSlot,
  type EnginePlacedObjectSlotLookup,
} from "./engineMenuRuntime";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type EngineMenuSaveSlotGridProps = {
  slotLookup: EnginePlacedObjectSlotLookup;
  selectedSlotId: string;
  onSelectSlot: (slotId: string) => void;
};

export function EngineMenuSaveSlotGrid({
  slotLookup,
  selectedSlotId,
  onSelectSlot,
}: EngineMenuSaveSlotGridProps) {
  return (
    <div className="mt-2 grid grid-cols-3 gap-1">
      {ENGINE_MENU_SLOT_IDS.map((slotId) => {
        const summary = getSelectedEngineSlot(slotLookup, slotId);
        const selectedSlotButton = selectedSlotId === slotId;
        return (
          <button
            key={slotId}
            type="button"
            data-testid={`engine-slot-${slotId}`}
            className={cn(
              "min-h-[44px] border px-1.5 py-1.5 text-left tracking-[0.12em]",
              selectedSlotButton
                ? "border-yellow-200 bg-yellow-200/14 text-yellow-50"
                : "border-cyan-100/15 bg-black/24 text-cyan-50/60 hover:border-cyan-100/40"
            )}
            onClick={() => onSelectSlot(slotId)}
          >
            <span className="block truncate text-[7px] tracking-widest">{summary?.label ?? getEngineMenuSlotLabel(slotId)}</span>
            <span className="block text-[6px] text-cyan-100/42">
              {summary ? `${summary.count} saved` : "Empty"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
