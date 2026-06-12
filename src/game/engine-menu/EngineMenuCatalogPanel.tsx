import type { PlaceableDefinition } from "../systems/placeables/placeableCatalog";
import { EngineMenuPlaceableCard } from "./EngineMenuPlaceableCard";

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
      <div className="mb-2 grid gap-2 border border-cyan-100/15 bg-black/24 p-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[9px] tracking-[0.22em] text-cyan-100/70">Catalog</div>
          <div data-testid="engine-placeable-count" className="text-[8px] tracking-[0.16em] text-cyan-100/40">
            {filteredPlaceables.length} shown
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <input
            data-testid="engine-placeable-search"
            className="min-w-0 flex-1 border border-cyan-100/20 bg-black/35 px-2 py-2 text-[9px] tracking-[0.14em] text-cyan-50 outline-none placeholder:text-cyan-100/25"
            value={searchQuery}
            placeholder="Search name, tag, id"
            maxLength={40}
            onChange={(event) => onSearchQueryChange(event.currentTarget.value)}
          />
          <button
            type="button"
            className="border border-cyan-100/25 bg-black/30 px-2 py-2 text-[8px] tracking-widest text-cyan-50/70 disabled:text-cyan-100/20"
            disabled={!searchQuery}
            onClick={onClearSearchQuery}
          >
            Clear
          </button>
        </div>
      </div>
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
    </div>
  );
}
