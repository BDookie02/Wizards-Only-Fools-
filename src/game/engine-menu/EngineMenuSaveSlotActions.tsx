import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  formatEngineMenuSlotTime,
  type EnginePlacedObjectSlotSummary,
} from "./engineMenuRuntime";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type EngineMenuSaveSlotActionsProps = {
  selectedSlot: EnginePlacedObjectSlotSummary | null;
  slotLabel: string;
  onSlotLabelChange: (label: string) => void;
  onSaveSlot: () => void;
  onLoadSlot: () => void;
  onDeleteSlot: () => void;
};

export function EngineMenuSaveSlotActions({
  selectedSlot,
  slotLabel,
  onSlotLabelChange,
  onSaveSlot,
  onLoadSlot,
  onDeleteSlot,
}: EngineMenuSaveSlotActionsProps) {
  return (
    <>
      <input
        data-testid="engine-slot-label"
        className="mt-2 w-full border border-cyan-100/20 bg-black/35 px-2 py-2 text-[8px] tracking-[0.14em] text-cyan-50 outline-none placeholder:text-cyan-100/25"
        value={slotLabel}
        maxLength={36}
        placeholder="Slot label"
        onChange={(event) => onSlotLabelChange(event.target.value)}
      />
      <div className="mt-2 grid grid-cols-3 gap-1">
        <button
          type="button"
          data-testid="engine-save-slot"
          className="border border-emerald-200/40 bg-emerald-400/10 px-1.5 py-2 text-[7px] tracking-widest text-emerald-50/85 hover:bg-emerald-300/16"
          onClick={onSaveSlot}
        >
          Save
        </button>
        <button
          type="button"
          data-testid="engine-load-slot"
          className={cn(
            "border px-1.5 py-2 text-[7px] tracking-widest",
            selectedSlot
              ? "border-cyan-100/35 bg-cyan-300/10 text-cyan-50/85 hover:bg-cyan-300/16"
              : "border-cyan-100/10 bg-black/20 text-cyan-100/25"
          )}
          disabled={!selectedSlot}
          onClick={onLoadSlot}
        >
          Load
        </button>
        <button
          type="button"
          data-testid="engine-delete-slot"
          className={cn(
            "border px-1.5 py-2 text-[7px] tracking-widest",
            selectedSlot
              ? "border-red-200/40 bg-red-500/10 text-red-100/80 hover:bg-red-500/16"
              : "border-cyan-100/10 bg-black/20 text-cyan-100/25"
          )}
          disabled={!selectedSlot}
          onClick={onDeleteSlot}
        >
          Delete
        </button>
      </div>
      <div className="mt-1 truncate text-[6px] tracking-[0.12em] text-cyan-100/35 normal-case">
        {selectedSlot ? `Saved ${formatEngineMenuSlotTime(selectedSlot.savedAt)}` : "Empty slot selected"}
      </div>
    </>
  );
}
