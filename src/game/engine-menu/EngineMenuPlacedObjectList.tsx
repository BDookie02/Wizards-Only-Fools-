import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { EnginePlacedObjectSummary } from "./engineMenuRuntime";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function EngineMenuPlacedObjectList({
  placedObjects,
  selectedPlacedObjectId,
  onSelectPlacedObjectId,
}: {
  placedObjects: EnginePlacedObjectSummary[];
  selectedPlacedObjectId: string;
  onSelectPlacedObjectId: (instanceId: string) => void;
}) {
  return (
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
  );
}
