import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  PLACEABLE_CATALOG,
  type PlaceableCategory,
  type PlaceableDefinition,
} from "../systems/placeables/placeableCatalog";
import { getDefaultPlaceableGridSize } from "../systems/placeables/placementRules";
import { dispatchEnginePlaceableEvent } from "../systems/placeables/enginePlaceableEvents";
import {
  createEngineMenuPlacementOptions,
  createEngineMenuSlotLookup,
  getEngineMenuSlotLabel,
  getEnginePlaceableCategoryCounts,
  getFilteredEnginePlaceables,
  getSelectedEnginePlaceable,
  getSelectedEnginePlacedObject,
  getSelectedEngineSlot,
  normalizeEnginePlaceableSearchQuery,
  type EngineMenuPlacementOptions,
  type EnginePlacedObjectSummary,
} from "./engineMenuRuntime";
import { EngineMenuCatalogPanel } from "./EngineMenuCatalogPanel";
import { EngineMenuCategorySidebar } from "./EngineMenuCategorySidebar";
import { EngineMenuPlacedObjectsPanel } from "./EngineMenuPlacedObjectsPanel";
import { EngineMenuPlacementPanel } from "./EngineMenuPlacementPanel";
import { EngineMenuSaveSlotsPanel } from "./EngineMenuSaveSlotsPanel";
import { EngineMenuSystemsPanel } from "./EngineMenuSystemsPanel";
import { useEngineMenuPlaceableBridge } from "./useEngineMenuPlaceableBridge";

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
  const [activeCategory, setActiveCategory] = useState<PlaceableCategory>("huts");
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(2);
  const [yaw, setYaw] = useState(0);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("slot-1");
  const [slotLabel, setSlotLabel] = useState("Slot 1");
  const [searchQuery, setSearchQuery] = useState("");
  const {
    placedObjects,
    placementStatus,
    selectedPlacedObjectId,
    setSelectedPlacedObjectId,
    slotSummaries,
  } = useEngineMenuPlaceableBridge(open);
  const normalizedSearchQuery = normalizeEnginePlaceableSearchQuery(searchQuery);
  const placementState = useMemo(() => ({
    snapToGrid,
    gridSize,
    yaw,
  }), [gridSize, snapToGrid, yaw]);
  const categoryCounts = useMemo(
    () => getEnginePlaceableCategoryCounts(PLACEABLE_CATALOG, normalizedSearchQuery),
    [normalizedSearchQuery],
  );
  const filteredPlaceables = useMemo(
    () => getFilteredEnginePlaceables(PLACEABLE_CATALOG, activeCategory, normalizedSearchQuery),
    [activeCategory, normalizedSearchQuery],
  );
  const selectedPlaceable = useMemo(
    () => getSelectedEnginePlaceable(PLACEABLE_CATALOG, selectedId),
    [selectedId]
  );
  const selectedPlacedObject = useMemo(
    () => getSelectedEnginePlacedObject(placedObjects, selectedPlacedObjectId),
    [placedObjects, selectedPlacedObjectId]
  );
  const slotLookup = useMemo(
    () => createEngineMenuSlotLookup(slotSummaries),
    [slotSummaries],
  );
  const selectedSlot = useMemo(
    () => getSelectedEngineSlot(slotLookup, selectedSlotId),
    [selectedSlotId, slotLookup]
  );

  const makePlacementOptions = (overrides?: Partial<EngineMenuPlacementOptions>): EngineMenuPlacementOptions => (
    createEngineMenuPlacementOptions(placementState, overrides)
  );

  const previewPlaceable = (placeable: PlaceableDefinition, overrides?: Partial<EngineMenuPlacementOptions>) => {
    const defaultGridSize = getDefaultPlaceableGridSize(placeable);
    const nextGridSize = overrides?.gridSize ?? (gridSize > 0 ? gridSize : defaultGridSize);
    onPreviewPlaceable(placeable, makePlacementOptions({ gridSize: nextGridSize, ...overrides }));
  };

  const rotateSelected = (delta: number) => {
    const nextYaw = yaw + delta;
    setYaw(nextYaw);
    if (selectedPlaceable) {
      previewPlaceable(selectedPlaceable, { yaw: nextYaw });
    }
  };

  const selectGridSize = (nextGridSize: number) => {
    setGridSize(nextGridSize);
    if (selectedPlaceable) {
      previewPlaceable(selectedPlaceable, { gridSize: nextGridSize });
    }
  };

  const toggleSnapToGrid = () => {
    const nextSnap = !snapToGrid;
    setSnapToGrid(nextSnap);
    if (selectedPlaceable) {
      previewPlaceable(selectedPlaceable, { snapToGrid: nextSnap });
    }
  };

  const selectSlot = (slotId: string) => {
    setSelectedSlotId(slotId);
    setSlotLabel(getSelectedEngineSlot(slotLookup, slotId)?.label ?? getEngineMenuSlotLabel(slotId));
  };

  const requestSlotSave = () => {
    dispatchEnginePlaceableEvent("wof-engine-placeable-slot-save", {
      source: "engine-menu",
      slotId: selectedSlotId,
      label: slotLabel || getEngineMenuSlotLabel(selectedSlotId),
    });
  };

  const requestSlotLoad = () => {
    dispatchEnginePlaceableEvent("wof-engine-placeable-slot-load", {
      source: "engine-menu",
      slotId: selectedSlotId,
      label: selectedSlot?.label ?? slotLabel,
    });
  };

  const requestSlotDelete = () => {
    dispatchEnginePlaceableEvent("wof-engine-placeable-slot-delete", {
      source: "engine-menu",
      slotId: selectedSlotId,
      label: selectedSlot?.label ?? slotLabel,
    });
  };

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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-100/25 px-3 py-2">
          <div>
            <div className="text-[10px] tracking-[0.3em] text-cyan-100/60">Dev Mode</div>
            <div className="text-[clamp(1rem,2.5vmin,1.45rem)] tracking-[0.18em] text-cyan-50">Game Engine Menu</div>
          </div>
          <button
            type="button"
            className="border border-cyan-100/50 bg-cyan-300/10 px-3 py-2 text-[10px] tracking-widest text-cyan-50 hover:bg-cyan-200/20"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="grid min-h-0 min-w-0 grid-cols-[160px_minmax(0,1fr)_220px] gap-3 overflow-hidden p-3">
          <EngineMenuCategorySidebar
            activeCategory={activeCategory}
            categoryCounts={categoryCounts}
            onSelectCategory={setActiveCategory}
          />

          <EngineMenuCatalogPanel
            filteredPlaceables={filteredPlaceables}
            selectedId={selectedId}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onClearSearchQuery={() => setSearchQuery("")}
            onPreviewPlaceable={previewPlaceable}
          />

          <div className="hidden min-h-0 min-w-0 max-w-full grid-rows-[minmax(0,1.45fr)_minmax(0,1fr)] gap-2 overflow-hidden border border-cyan-100/20 bg-black/24 p-2 lg:grid">
            <EngineMenuPlacementPanel
              selectedPlaceable={selectedPlaceable}
              placementStatus={placementStatus}
              gridSize={gridSize}
              snapToGrid={snapToGrid}
              onSelectGridSize={selectGridSize}
              onRotateSelected={rotateSelected}
              onToggleSnapToGrid={toggleSnapToGrid}
              onPlaceSelected={() => selectedPlaceable && onSelectPlaceable(selectedPlaceable, makePlacementOptions())}
              onClearPlaceables={onClearPlaceables}
            >
              <EngineMenuPlacedObjectsPanel
                placedObjects={placedObjects}
                selectedPlacedObject={selectedPlacedObject}
                selectedPlacedObjectId={selectedPlacedObjectId}
                onSelectPlacedObjectId={setSelectedPlacedObjectId}
                onPreviewPlacedObject={onPreviewPlacedObject}
                onMovePlacedObject={onMovePlacedObject}
                onDeletePlacedObject={onDeletePlacedObject}
                makePlacementOptions={makePlacementOptions}
              />
              <EngineMenuSaveSlotsPanel
                slotSummaries={slotSummaries}
                slotLookup={slotLookup}
                selectedSlot={selectedSlot}
                selectedSlotId={selectedSlotId}
                slotLabel={slotLabel}
                onSelectSlot={selectSlot}
                onSlotLabelChange={setSlotLabel}
                onSaveSlot={requestSlotSave}
                onLoadSlot={requestSlotLoad}
                onDeleteSlot={requestSlotDelete}
              />
            </EngineMenuPlacementPanel>

            <EngineMenuSystemsPanel />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-cyan-100/20 px-3 py-2 text-[8px] tracking-[0.2em] text-cyan-100/45">
          <span>L toggles this menu when dev mode is on</span>
          <span>/engine opens it from command console</span>
          <span>Click an item to preview, then place selected</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
