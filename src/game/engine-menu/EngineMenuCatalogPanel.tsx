import type { PlaceableDefinition } from "../systems/placeables/placeableCatalog";
import { EngineMenuCatalogSearchBar } from "./EngineMenuCatalogSearchBar";
import { EngineMenuPlaceableGrid } from "./EngineMenuPlaceableGrid";

export function EngineMenuCatalogPanel({
  filteredPlaceables,
  selectedId,
  searchQuery,
  onSearchQueryChange,
  onClearSearchQuery,
  onPreviewPlaceable,
}: {
  filteredPlaceables: PlaceableDefinition[];
  selectedId?: string;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onClearSearchQuery: () => void;
  onPreviewPlaceable: (placeable: PlaceableDefinition) => void;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden pr-1">
      <EngineMenuCatalogSearchBar
        shownCount={filteredPlaceables.length}
        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
        onClearSearchQuery={onClearSearchQuery}
      />
      <EngineMenuPlaceableGrid
        filteredPlaceables={filteredPlaceables}
        selectedId={selectedId}
        onPreviewPlaceable={onPreviewPlaceable}
      />
    </div>
  );
}
