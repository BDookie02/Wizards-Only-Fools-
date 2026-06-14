import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { EngineMenuPlacementOptions, EnginePlacedObjectSummary } from "./engineMenuRuntime";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function EngineMenuPlacedObjectActions({
  selectedPlacedObject,
  onPreviewPlacedObject,
  onMovePlacedObject,
  onDeletePlacedObject,
  makePlacementOptions,
}: {
  selectedPlacedObject: EnginePlacedObjectSummary | null;
  onPreviewPlacedObject: (object: EnginePlacedObjectSummary, options: EngineMenuPlacementOptions) => void;
  onMovePlacedObject: (object: EnginePlacedObjectSummary, options: EngineMenuPlacementOptions) => void;
  onDeletePlacedObject: (instanceId: string) => void;
  makePlacementOptions: (overrides?: Partial<EngineMenuPlacementOptions>) => EngineMenuPlacementOptions;
}) {
  return (
    <div className="mt-2 grid grid-cols-3 gap-1">
      <button
        type="button"
        data-testid="engine-preview-placed-object"
        className={cn(
          "border px-1.5 py-2 text-[7px] tracking-widest",
          selectedPlacedObject
            ? "border-cyan-100/35 bg-black/30 text-cyan-50/75"
            : "border-cyan-100/10 bg-black/20 text-cyan-100/25"
        )}
        disabled={!selectedPlacedObject}
        onClick={() => selectedPlacedObject && onPreviewPlacedObject(selectedPlacedObject, makePlacementOptions({
          x: selectedPlacedObject.x,
          y: selectedPlacedObject.y,
          z: selectedPlacedObject.z,
          yaw: selectedPlacedObject.yaw,
          replaceInstanceId: selectedPlacedObject.instanceId,
        }))}
      >
        Preview
      </button>
      <button
        type="button"
        data-testid="engine-move-placed-object"
        className={cn(
          "border px-1.5 py-2 text-[7px] tracking-widest",
          selectedPlacedObject
            ? "border-yellow-200/60 bg-yellow-200/12 text-yellow-50"
            : "border-cyan-100/10 bg-black/20 text-cyan-100/25"
        )}
        disabled={!selectedPlacedObject}
        onClick={() => selectedPlacedObject && onMovePlacedObject(selectedPlacedObject, makePlacementOptions({
          replaceInstanceId: selectedPlacedObject.instanceId,
        }))}
      >
        Move
      </button>
      <button
        type="button"
        data-testid="engine-delete-placed-object"
        className={cn(
          "border px-1.5 py-2 text-[7px] tracking-widest",
          selectedPlacedObject
            ? "border-red-200/40 bg-red-500/10 text-red-100/80"
            : "border-cyan-100/10 bg-black/20 text-cyan-100/25"
        )}
        disabled={!selectedPlacedObject}
        onClick={() => selectedPlacedObject && onDeletePlacedObject(selectedPlacedObject.instanceId)}
      >
        Delete
      </button>
    </div>
  );
}
