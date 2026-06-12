import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { EngineMenuPlacementOptions, EnginePlacedObjectSummary } from "./engineMenuRuntime";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function EngineMenuPlacedObjectsPanel({
  placedObjects,
  selectedPlacedObject,
  selectedPlacedObjectId,
  onSelectPlacedObjectId,
  onPreviewPlacedObject,
  onMovePlacedObject,
  onDeletePlacedObject,
  makePlacementOptions,
}: {
  placedObjects: EnginePlacedObjectSummary[];
  selectedPlacedObject: EnginePlacedObjectSummary | null;
  selectedPlacedObjectId: string;
  onSelectPlacedObjectId: (instanceId: string) => void;
  onPreviewPlacedObject: (object: EnginePlacedObjectSummary, options: EngineMenuPlacementOptions) => void;
  onMovePlacedObject: (object: EnginePlacedObjectSummary, options: EngineMenuPlacementOptions) => void;
  onDeletePlacedObject: (instanceId: string) => void;
  makePlacementOptions: (overrides?: Partial<EngineMenuPlacementOptions>) => EngineMenuPlacementOptions;
}) {
  return (
    <div className="mt-3 border-t border-cyan-100/15 pt-2">
      <div className="text-[8px] tracking-[0.22em] text-cyan-100/70">Placed Objects</div>
      <div className="mt-2 flex max-h-28 flex-col gap-1 overflow-y-auto pr-1">
        {placedObjects.length === 0 ? (
          <div className="border border-cyan-100/10 bg-black/20 px-2 py-2 text-[7px] leading-4 tracking-[0.12em] text-cyan-100/35 normal-case">
            No editor objects placed.
          </div>
        ) : placedObjects.map((object, index) => {
          const selectedObject = selectedPlacedObjectId === object.instanceId;
          return (
            <button
              key={object.instanceId}
              type="button"
              data-testid={`engine-placed-object-${index}`}
              className={cn(
                "border px-2 py-2 text-left text-[7px] leading-4 tracking-[0.12em]",
                selectedObject
                  ? "border-yellow-200 bg-yellow-200/14 text-yellow-50"
                  : "border-cyan-100/15 bg-black/24 text-cyan-50/60 hover:border-cyan-100/40"
              )}
              onClick={() => onSelectPlacedObjectId(object.instanceId)}
            >
              <span className="block truncate text-[8px] tracking-widest">{object.label}</span>
              <span className="block text-cyan-100/42">
                X {Math.round(object.x)} Z {Math.round(object.z)}
              </span>
            </button>
          );
        })}
      </div>
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
    </div>
  );
}
