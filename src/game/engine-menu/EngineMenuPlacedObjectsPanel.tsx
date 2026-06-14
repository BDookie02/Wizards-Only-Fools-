import type { EngineMenuPlacementOptions, EnginePlacedObjectSummary } from "./engineMenuRuntime";
import { EngineMenuPlacedObjectActions } from "./EngineMenuPlacedObjectActions";
import { EngineMenuPlacedObjectList } from "./EngineMenuPlacedObjectList";

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
      <EngineMenuPlacedObjectList
        placedObjects={placedObjects}
        selectedPlacedObjectId={selectedPlacedObjectId}
        onSelectPlacedObjectId={onSelectPlacedObjectId}
      />
      <EngineMenuPlacedObjectActions
        selectedPlacedObject={selectedPlacedObject}
        onPreviewPlacedObject={onPreviewPlacedObject}
        onMovePlacedObject={onMovePlacedObject}
        onDeletePlacedObject={onDeletePlacedObject}
        makePlacementOptions={makePlacementOptions}
      />
    </div>
  );
}
