import type { ReactNode } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { PlaceableDefinition } from "../systems/placeables/placeableCatalog";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ENGINE_GRID_SIZE_OPTIONS = [1, 2, 4, 8] as const;

export function EngineMenuPlacementPanel({
  selectedPlaceable,
  placementStatus,
  gridSize,
  snapToGrid,
  onSelectGridSize,
  onRotateSelected,
  onToggleSnapToGrid,
  onPlaceSelected,
  onClearPlaceables,
  children,
}: {
  selectedPlaceable: PlaceableDefinition | null;
  placementStatus: string;
  gridSize: number;
  snapToGrid: boolean;
  onSelectGridSize: (gridSize: number) => void;
  onRotateSelected: (delta: number) => void;
  onToggleSnapToGrid: () => void;
  onPlaceSelected: () => void;
  onClearPlaceables: () => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-0 min-w-0 overflow-y-auto border border-yellow-100/25 bg-yellow-200/8 p-2">
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
      <div className="mt-3 grid grid-cols-2 gap-2">
        {ENGINE_GRID_SIZE_OPTIONS.map((size) => (
          <button
            key={size}
            type="button"
            className={cn(
              "border px-2 py-2 text-[8px] tracking-widest",
              gridSize === size
                ? "border-yellow-200 bg-yellow-200/18 text-yellow-50"
                : "border-cyan-100/25 bg-black/30 text-cyan-50/70"
            )}
            onClick={() => onSelectGridSize(size)}
          >
            Grid {size}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button
          type="button"
          className="border border-cyan-100/25 bg-black/30 px-2 py-2 text-[8px] tracking-widest text-cyan-50/75"
          onClick={() => onRotateSelected(-Math.PI / 8)}
        >
          Rotate -
        </button>
        <button
          type="button"
          className={cn(
            "border px-2 py-2 text-[8px] tracking-widest",
            snapToGrid
              ? "border-emerald-200 bg-emerald-200/12 text-emerald-50"
              : "border-cyan-100/25 bg-black/30 text-cyan-50/75"
          )}
          onClick={onToggleSnapToGrid}
        >
          Snap {snapToGrid ? "On" : "Off"}
        </button>
        <button
          type="button"
          className="border border-cyan-100/25 bg-black/30 px-2 py-2 text-[8px] tracking-widest text-cyan-50/75"
          onClick={() => onRotateSelected(Math.PI / 8)}
        >
          Rotate +
        </button>
      </div>
      <button
        type="button"
        data-testid="engine-place-selected"
        className={cn(
          "mt-3 w-full border px-3 py-2 text-[9px] tracking-[0.18em]",
          selectedPlaceable
            ? "border-yellow-200 bg-yellow-200/18 text-yellow-50 hover:bg-yellow-200/25"
            : "border-cyan-100/15 bg-black/20 text-cyan-100/30"
        )}
        disabled={!selectedPlaceable}
        onClick={onPlaceSelected}
      >
        Place Selected
      </button>
      <button
        type="button"
        data-testid="engine-clear-placed-objects"
        className="mt-2 w-full border border-red-200/30 bg-red-500/8 px-3 py-2 text-[8px] tracking-[0.18em] text-red-100/80 hover:bg-red-500/14"
        onClick={onClearPlaceables}
      >
        Clear Placed
      </button>
      {children}
    </div>
  );
}
