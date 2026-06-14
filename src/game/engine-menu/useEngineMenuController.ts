import { useMemo, useState } from "react";
import {
  PLACEABLE_CATALOG,
  type PlaceableCategory,
  type PlaceableDefinition,
} from "../systems/placeables/placeableCatalog";
import { dispatchEnginePlaceableEvent } from "../systems/placeables/enginePlaceableEvents";
import { getDefaultPlaceableGridSize } from "../systems/placeables/placementRules";
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
} from "./engineMenuRuntime";
import { useEngineMenuPlaceableBridge } from "./useEngineMenuPlaceableBridge";

type UseEngineMenuControllerOptions = {
  open: boolean;
  selectedId?: string;
  onPreviewPlaceable: (placeable: PlaceableDefinition, options: EngineMenuPlacementOptions) => void;
  onSelectPlaceable: (placeable: PlaceableDefinition, options: EngineMenuPlacementOptions) => void;
};

export function useEngineMenuController({
  open,
  selectedId,
  onPreviewPlaceable,
  onSelectPlaceable,
}: UseEngineMenuControllerOptions) {
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
    [selectedId],
  );
  const selectedPlacedObject = useMemo(
    () => getSelectedEnginePlacedObject(placedObjects, selectedPlacedObjectId),
    [placedObjects, selectedPlacedObjectId],
  );
  const slotLookup = useMemo(
    () => createEngineMenuSlotLookup(slotSummaries),
    [slotSummaries],
  );
  const selectedSlot = useMemo(
    () => getSelectedEngineSlot(slotLookup, selectedSlotId),
    [selectedSlotId, slotLookup],
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

  const placeSelected = () => {
    if (selectedPlaceable) {
      onSelectPlaceable(selectedPlaceable, makePlacementOptions());
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

  return {
    activeCategory,
    categoryCounts,
    filteredPlaceables,
    gridSize,
    makePlacementOptions,
    placeSelected,
    placedObjects,
    placementStatus,
    previewPlaceable,
    requestSlotDelete,
    requestSlotLoad,
    requestSlotSave,
    rotateSelected,
    searchQuery,
    selectGridSize,
    selectSlot,
    selectedPlaceable,
    selectedPlacedObject,
    selectedPlacedObjectId,
    selectedSlot,
    selectedSlotId,
    setActiveCategory,
    setSearchQuery,
    setSelectedPlacedObjectId,
    setSlotLabel,
    slotLabel,
    slotLookup,
    slotSummaries,
    snapToGrid,
    toggleSnapToGrid,
  };
}
