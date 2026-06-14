import type { PlaceableDefinition } from "../systems/placeables/placeableCatalog";
import { EngineMenuPlaceableCard } from "./EngineMenuPlaceableCard";

type EngineMenuPlaceableGridProps = {
  filteredPlaceables: PlaceableDefinition[];
  selectedId?: string;
  onPreviewPlaceable: (placeable: PlaceableDefinition) => void;
};

export function EngineMenuPlaceableGrid({
  filteredPlaceables,
  selectedId,
  onPreviewPlaceable,
}: EngineMenuPlaceableGridProps) {
  return (
    <div className="min-h-0 min-w-0 overflow-y-auto">
      <div className="engine-placeable-grid grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-2">
        {filteredPlaceables.map((placeable) => (
          <EngineMenuPlaceableCard
            key={placeable.id}
            placeable={placeable}
            selected={selectedId === placeable.id}
            onPreviewPlaceable={onPreviewPlaceable}
          />
        ))}
        {filteredPlaceables.length === 0 && (
          <div className="col-span-full border border-cyan-100/15 bg-black/24 px-3 py-5 text-center text-[9px] tracking-[0.16em] text-cyan-100/45 normal-case">
            No placeables match this category and search.
          </div>
        )}
      </div>
    </div>
  );
}
