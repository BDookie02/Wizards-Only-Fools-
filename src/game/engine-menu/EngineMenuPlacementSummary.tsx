import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { PlaceableDefinition } from "../systems/placeables/placeableCatalog";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type EngineMenuPlacementSummaryProps = {
  selectedPlaceable: PlaceableDefinition | null;
  placementStatus: string;
};

export function EngineMenuPlacementSummary({
  selectedPlaceable,
  placementStatus,
}: EngineMenuPlacementSummaryProps) {
  return (
    <>
      <div className="text-[10px] tracking-[0.24em] text-yellow-100">Placement</div>
      <div className="mt-2 min-h-[36px] text-[8px] leading-4 tracking-[0.13em] text-cyan-50/70 normal-case">
        {selectedPlaceable ? selectedPlaceable.name : "Select an object to preview it on the grid."}
      </div>
      {selectedPlaceable && (
        <div
          data-testid="engine-selected-placeable-meta"
          className="mt-2 grid gap-1 border border-cyan-100/15 bg-black/22 p-2 text-[7px] leading-4 tracking-[0.12em] text-cyan-100/50 normal-case"
        >
          <div className="truncate uppercase tracking-[0.16em] text-cyan-100/65">{selectedPlaceable.id}</div>
          <div>Footprint {selectedPlaceable.footprintRadius} / slope {selectedPlaceable.maxSlopeDelta} / yaw {selectedPlaceable.yawMode}</div>
          <div className="truncate">Tags: {selectedPlaceable.tags.join(", ")}</div>
        </div>
      )}
      <div
        data-testid="engine-placement-status"
        className={cn(
          "mt-2 min-h-[28px] border px-2 py-1.5 text-[7px] leading-4 tracking-[0.12em] normal-case",
          placementStatus.toLowerCase().startsWith("blocked")
            ? "border-red-200/30 bg-red-500/8 text-red-100/80"
            : "border-cyan-100/15 bg-black/20 text-cyan-100/55"
        )}
      >
        {placementStatus || "Ready"}
      </div>
    </>
  );
}
