import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ENGINE_GRID_SIZE_OPTIONS = [1, 2, 4, 8] as const;

type EngineMenuPlacementControlsProps = {
  gridSize: number;
  snapToGrid: boolean;
  canPlaceSelected: boolean;
  onSelectGridSize: (gridSize: number) => void;
  onRotateSelected: (delta: number) => void;
  onToggleSnapToGrid: () => void;
  onPlaceSelected: () => void;
  onClearPlaceables: () => void;
};

export function EngineMenuPlacementControls({
  gridSize,
  snapToGrid,
  canPlaceSelected,
  onSelectGridSize,
  onRotateSelected,
  onToggleSnapToGrid,
  onPlaceSelected,
  onClearPlaceables,
}: EngineMenuPlacementControlsProps) {
  return (
    <>
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
          canPlaceSelected
            ? "border-yellow-200 bg-yellow-200/18 text-yellow-50 hover:bg-yellow-200/25"
            : "border-cyan-100/15 bg-black/20 text-cyan-100/30"
        )}
        disabled={!canPlaceSelected}
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
    </>
  );
}
