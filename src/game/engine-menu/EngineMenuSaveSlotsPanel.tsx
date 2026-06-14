import {
  ENGINE_MENU_SLOT_IDS,
  type EnginePlacedObjectSlotLookup,
  type EnginePlacedObjectSlotSummary,
} from "./engineMenuRuntime";
import { EngineMenuSaveSlotActions } from "./EngineMenuSaveSlotActions";
import { EngineMenuSaveSlotGrid } from "./EngineMenuSaveSlotGrid";

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
      <EngineMenuSaveSlotGrid
        slotLookup={slotLookup}
        selectedSlotId={selectedSlotId}
        onSelectSlot={onSelectSlot}
      />
      <EngineMenuSaveSlotActions
        selectedSlot={selectedSlot}
        slotLabel={slotLabel}
        onSlotLabelChange={onSlotLabelChange}
        onSaveSlot={onSaveSlot}
        onLoadSlot={onLoadSlot}
        onDeleteSlot={onDeleteSlot}
      />
    </div>
  );
}
