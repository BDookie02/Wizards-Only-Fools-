import { createPortal } from "react-dom";
import type { PlaceableDefinition } from "../systems/placeables/placeableCatalog";
import type { EngineMenuPlacementOptions, EnginePlacedObjectSummary } from "./engineMenuRuntime";
import { EngineMenuCatalogPanel } from "./EngineMenuCatalogPanel";
import { EngineMenuCategorySidebar } from "./EngineMenuCategorySidebar";
import { EngineMenuFooter } from "./EngineMenuFooter";
import { EngineMenuHeader } from "./EngineMenuHeader";
import { EngineMenuPlacedObjectsPanel } from "./EngineMenuPlacedObjectsPanel";
import { EngineMenuPlacementPanel } from "./EngineMenuPlacementPanel";
import { EngineMenuSaveSlotsPanel } from "./EngineMenuSaveSlotsPanel";
import { EngineMenuSystemsPanel } from "./EngineMenuSystemsPanel";
import { useEngineMenuController } from "./useEngineMenuController";

export function EngineMenu({
  open,
  selectedId,
  onPreviewPlaceable,
  onSelectPlaceable,
  onPreviewPlacedObject,
  onMovePlacedObject,
  onDeletePlacedObject,
  onClearPlaceables,
  onClose,
}: {
  open: boolean;
  selectedId?: string;
  onPreviewPlaceable: (placeable: PlaceableDefinition, options: EngineMenuPlacementOptions) => void;
  onSelectPlaceable: (placeable: PlaceableDefinition, options: EngineMenuPlacementOptions) => void;
  onPreviewPlacedObject: (object: EnginePlacedObjectSummary, options: EngineMenuPlacementOptions) => void;
  onMovePlacedObject: (object: EnginePlacedObjectSummary, options: EngineMenuPlacementOptions) => void;
  onDeletePlacedObject: (instanceId: string) => void;
  onClearPlaceables: () => void;
  onClose: () => void;
}) {
  const engineMenu = useEngineMenuController({
    open,
    selectedId,
    onPreviewPlaceable,
    onSelectPlaceable,
  });

  if (!open) return null;

  return createPortal(
    <div
      data-testid="engine-menu"
      data-wof-hud-qa="engine-menu"
      className="fixed inset-0 z-[230] flex items-center justify-center bg-black/78 px-3 py-3 font-mono uppercase text-white pointer-events-auto"
      style={{ width: "var(--app-vw, 100dvw)", height: "var(--app-vh, 100dvh)" }}
      onMouseDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
    >
      <div className="engine-menu-panel grid h-[min(92dvh,760px)] w-[min(94vw,1080px)] grid-rows-[auto_1fr_auto] overflow-hidden border-2 border-cyan-100/55 bg-[#071017]/96 shadow-[0_0_42px_rgba(34,211,238,0.28)]">
        <EngineMenuHeader onClose={onClose} />

        <div className="grid min-h-0 min-w-0 grid-cols-[160px_minmax(0,1fr)_220px] gap-3 overflow-hidden p-3">
          <EngineMenuCategorySidebar
            activeCategory={engineMenu.activeCategory}
            categoryCounts={engineMenu.categoryCounts}
            onSelectCategory={engineMenu.setActiveCategory}
          />

          <EngineMenuCatalogPanel
            filteredPlaceables={engineMenu.filteredPlaceables}
            selectedId={selectedId}
            searchQuery={engineMenu.searchQuery}
            onSearchQueryChange={engineMenu.setSearchQuery}
            onClearSearchQuery={() => engineMenu.setSearchQuery("")}
            onPreviewPlaceable={engineMenu.previewPlaceable}
          />

          <div className="hidden min-h-0 min-w-0 max-w-full grid-rows-[minmax(0,1.45fr)_minmax(0,1fr)] gap-2 overflow-hidden border border-cyan-100/20 bg-black/24 p-2 lg:grid">
            <EngineMenuPlacementPanel
              selectedPlaceable={engineMenu.selectedPlaceable}
              placementStatus={engineMenu.placementStatus}
              gridSize={engineMenu.gridSize}
              snapToGrid={engineMenu.snapToGrid}
              onSelectGridSize={engineMenu.selectGridSize}
              onRotateSelected={engineMenu.rotateSelected}
              onToggleSnapToGrid={engineMenu.toggleSnapToGrid}
              onPlaceSelected={engineMenu.placeSelected}
              onClearPlaceables={onClearPlaceables}
            >
              <EngineMenuPlacedObjectsPanel
                placedObjects={engineMenu.placedObjects}
                selectedPlacedObject={engineMenu.selectedPlacedObject}
                selectedPlacedObjectId={engineMenu.selectedPlacedObjectId}
                onSelectPlacedObjectId={engineMenu.setSelectedPlacedObjectId}
                onPreviewPlacedObject={onPreviewPlacedObject}
                onMovePlacedObject={onMovePlacedObject}
                onDeletePlacedObject={onDeletePlacedObject}
                makePlacementOptions={engineMenu.makePlacementOptions}
              />
              <EngineMenuSaveSlotsPanel
                slotSummaries={engineMenu.slotSummaries}
                slotLookup={engineMenu.slotLookup}
                selectedSlot={engineMenu.selectedSlot}
                selectedSlotId={engineMenu.selectedSlotId}
                slotLabel={engineMenu.slotLabel}
                onSelectSlot={engineMenu.selectSlot}
                onSlotLabelChange={engineMenu.setSlotLabel}
                onSaveSlot={engineMenu.requestSlotSave}
                onLoadSlot={engineMenu.requestSlotLoad}
                onDeleteSlot={engineMenu.requestSlotDelete}
              />
            </EngineMenuPlacementPanel>

            <EngineMenuSystemsPanel />
          </div>
        </div>

        <EngineMenuFooter />
      </div>
    </div>,
    document.body
  );
}
