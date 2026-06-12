import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  ENGINE_MENU_SLOT_IDS,
  formatEngineMenuSlotTime,
  getEngineMenuSlotLabel,
  getSelectedEngineSlot,
  type EnginePlacedObjectSlotLookup,
  type EnginePlacedObjectSlotSummary,
} from "./engineMenuRuntime";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function EngineMenuSaveSlotsPanel({
  slotSummaries,
  slotLookup,
  selectedSlot,
  selectedSlotId,
  slotLabel,
  onSelectSlot,
  onSlotLabelChange,
  onSaveSlot,
  onLoadSlot,
  onDeleteSlot,
}: {
  slotSummaries: EnginePlacedObjectSlotSummary[];
  slotLookup: EnginePlacedObjectSlotLookup;
  selectedSlot: EnginePlacedObjectSlotSummary | null;
  selectedSlotId: string;
  slotLabel: string;
  onSelectSlot: (slotId: string) => void;
  onSlotLabelChange: (label: string) => void;
  onSaveSlot: () => void;
  onLoadSlot: () => void;
  onDeleteSlot: () => void;
}) {
  return (
    <div className="mt-3 border-t border-cyan-100/15 pt-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[8px] tracking-[0.22em] text-cyan-100/70">Save Slots</div>
        <div className="text-[7px] tracking-[0.16em] text-cyan-100/35">
          {slotSummaries.length}/{ENGINE_MENU_SLOT_IDS.length}
        </div>
      </div>
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
    </div>
  );
}
