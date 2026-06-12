import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  PLACEABLE_CATALOG,
  PLACEABLE_CATEGORIES,
  PLACEABLE_CATEGORY_LABELS,
  type PlaceableCategory,
  type PlaceableDefinition,
} from "../systems/placeables/placeableCatalog";
import { getDefaultPlaceableGridSize } from "../systems/placeables/placementRules";
import { dispatchEnginePlaceableEvent, subscribeEnginePlaceableEvent } from "../systems/placeables/enginePlaceableEvents";
import { GAME_SYSTEM_CATALOG } from "../systems/systemCatalog";
import {
  createEngineMenuPlacementOptions,
  createEngineMenuSlotLookup,
  ENGINE_MENU_SLOT_IDS,
  formatEngineMenuSlotTime,
  getEngineMenuSlotLabel,
  getEnginePlaceableCategoryCounts,
  getFilteredEnginePlaceables,
  getSelectedEnginePlaceable,
  getSelectedEnginePlacedObject,
  getSelectedEngineSlot,
  hasEnginePlacedObjectSummaryId,
  normalizeEnginePlaceableSearchQuery,
  type EngineMenuPlacementOptions,
  type EnginePlacedObjectSlotSummary,
  type EnginePlacedObjectSummary,
} from "./engineMenuRuntime";
import { EngineMenuPlaceableCard } from "./EngineMenuPlaceableCard";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ENGINE_GRID_SIZE_OPTIONS = [1, 2, 4, 8] as const;

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
  const [placedObjects, setPlacedObjects] = useState<EnginePlacedObjectSummary[]>([]);
  const [selectedPlacedObjectId, setSelectedPlacedObjectId] = useState("");
  const [placementStatus, setPlacementStatus] = useState("");
  const [slotSummaries, setSlotSummaries] = useState<EnginePlacedObjectSlotSummary[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("slot-1");
  const [slotLabel, setSlotLabel] = useState("Slot 1");
  const [searchQuery, setSearchQuery] = useState("");
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

  useEffect(() => {
    if (!open) return undefined;
    const unsubscribeObjects = subscribeEnginePlaceableEvent<{ objects?: EnginePlacedObjectSummary[] }>(
      "wof-engine-placeable-list",
      (event) => {
        setPlacedObjects(event.detail?.objects ?? []);
      },
    );
    const unsubscribeSlots = subscribeEnginePlaceableEvent<{ slots?: EnginePlacedObjectSlotSummary[] }>(
      "wof-engine-placeable-slots",
      (event) => {
        setSlotSummaries(event.detail?.slots ?? []);
      },
    );
    dispatchEnginePlaceableEvent("wof-engine-placeable-list-request", { source: "engine-menu" });
    dispatchEnginePlaceableEvent("wof-engine-placeable-slot-list-request", { source: "engine-menu" });
    return () => {
      unsubscribeObjects();
      unsubscribeSlots();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    return subscribeEnginePlaceableEvent<{ ok?: boolean; label?: string; reason?: string }>(
      "wof-engine-placeable-result",
      (event) => {
        const detail = event.detail;
        if (!detail) return;
        setPlacementStatus(detail.ok
          ? `Placed: ${detail.label ?? "object"}`
          : `Blocked: ${detail.reason ?? "invalid area"}`);
      },
    );
  }, [open]);

  useEffect(() => {
    if (!selectedPlacedObjectId) return;
    if (!hasEnginePlacedObjectSummaryId(placedObjects, selectedPlacedObjectId)) {
      setSelectedPlacedObjectId("");
    }
  }, [placedObjects, selectedPlacedObjectId]);

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
          <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto pr-1">
            {PLACEABLE_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                className={cn(
                  "border px-3 py-2 text-left text-[10px] tracking-widest transition",
                  activeCategory === category
                    ? "border-yellow-200 bg-yellow-200/12 text-yellow-50"
                    : "border-cyan-100/25 bg-black/25 text-cyan-50/75 hover:border-cyan-100/55"
                )}
                onClick={() => setActiveCategory(category)}
              >
                <span className="flex items-center justify-between gap-2">
                  <span>{PLACEABLE_CATEGORY_LABELS[category]}</span>
                  <span className="text-[8px] text-cyan-100/45">{categoryCounts[category]}</span>
                </span>
              </button>
            ))}
          </div>

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
                  onChange={(event) => setSearchQuery(event.currentTarget.value)}
                />
                <button
                  type="button"
                  className="border border-cyan-100/25 bg-black/30 px-2 py-2 text-[8px] tracking-widest text-cyan-50/70 disabled:text-cyan-100/20"
                  disabled={!searchQuery}
                  onClick={() => setSearchQuery("")}
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
                  onPreviewPlaceable={previewPlaceable}
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

          <div className="hidden min-h-0 min-w-0 max-w-full grid-rows-[minmax(0,1.45fr)_minmax(0,1fr)] gap-2 overflow-hidden border border-cyan-100/20 bg-black/24 p-2 lg:grid">
            <div className="min-h-0 min-w-0 overflow-y-auto border border-yellow-100/25 bg-yellow-200/8 p-2">
              <div className="text-[10px] tracking-[0.24em] text-yellow-100">Placement</div>
              <div className="mt-2 min-h-[36px] text-[8px] leading-4 tracking-[0.13em] text-cyan-50/70 normal-case">
                {selectedPlaceable ? selectedPlaceable.name : "Select an object to preview it on the grid."}
              </div>
              {selectedPlaceable && (
                <div
                  data-testid="engine-selected-placeable-meta"
                  className="mt-2 grid gap-1 border border-cyan-100/15 bg-black/22 p-2 text-[7px] leading-4 tracking-[0.12em] text-cyan-100/50 normal-case"
                >
                  <div className="truncate uppercase tracking-[0.16em] text-cyan-100/65">{selectedPlaceable.id}</div>
                  <div>Footprint {selectedPlaceable.footprintRadius} / slope {selectedPlaceable.maxSlopeDelta} / yaw {selectedPlaceable.yawMode}</div>
                  <div className="truncate">Tags: {selectedPlaceable.tags.join(", ")}</div>
                </div>
              )}
              <div
                data-testid="engine-placement-status"
                className={cn(
                  "mt-2 min-h-[28px] border px-2 py-1.5 text-[7px] leading-4 tracking-[0.12em] normal-case",
                  placementStatus.toLowerCase().startsWith("blocked")
                    ? "border-red-200/30 bg-red-500/8 text-red-100/80"
                    : "border-cyan-100/15 bg-black/20 text-cyan-100/55"
                )}
              >
                {placementStatus || "Ready"}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {ENGINE_GRID_SIZE_OPTIONS.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={cn(
                      "border px-2 py-2 text-[8px] tracking-widest",
                      gridSize === size
                        ? "border-yellow-200 bg-yellow-200/18 text-yellow-50"
                        : "border-cyan-100/25 bg-black/30 text-cyan-50/70"
                    )}
                    onClick={() => selectGridSize(size)}
                  >
                    Grid {size}
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className="border border-cyan-100/25 bg-black/30 px-2 py-2 text-[8px] tracking-widest text-cyan-50/75"
                  onClick={() => rotateSelected(-Math.PI / 8)}
                >
                  Rotate -
                </button>
                <button
                  type="button"
                  className={cn(
                    "border px-2 py-2 text-[8px] tracking-widest",
                    snapToGrid
                      ? "border-emerald-200 bg-emerald-200/12 text-emerald-50"
                      : "border-cyan-100/25 bg-black/30 text-cyan-50/75"
                  )}
                  onClick={toggleSnapToGrid}
                >
                  Snap {snapToGrid ? "On" : "Off"}
                </button>
                <button
                  type="button"
                  className="border border-cyan-100/25 bg-black/30 px-2 py-2 text-[8px] tracking-widest text-cyan-50/75"
                  onClick={() => rotateSelected(Math.PI / 8)}
                >
                  Rotate +
                </button>
              </div>
              <button
                type="button"
                data-testid="engine-place-selected"
                className={cn(
                  "mt-3 w-full border px-3 py-2 text-[9px] tracking-[0.18em]",
                  selectedPlaceable
                    ? "border-yellow-200 bg-yellow-200/18 text-yellow-50 hover:bg-yellow-200/25"
                    : "border-cyan-100/15 bg-black/20 text-cyan-100/30"
                )}
                disabled={!selectedPlaceable}
                onClick={() => selectedPlaceable && onSelectPlaceable(selectedPlaceable, makePlacementOptions())}
              >
                Place Selected
              </button>
              <button
                type="button"
                data-testid="engine-clear-placed-objects"
                className="mt-2 w-full border border-red-200/30 bg-red-500/8 px-3 py-2 text-[8px] tracking-[0.18em] text-red-100/80 hover:bg-red-500/14"
                onClick={onClearPlaceables}
              >
                Clear Placed
              </button>
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
                        onClick={() => setSelectedPlacedObjectId(object.instanceId)}
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
              <div className="mt-3 border-t border-cyan-100/15 pt-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[8px] tracking-[0.22em] text-cyan-100/70">Save Slots</div>
                  <div className="text-[7px] tracking-[0.16em] text-cyan-100/35">
                    {slotSummaries.length}/{ENGINE_MENU_SLOT_IDS.length}
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1">
                  {ENGINE_MENU_SLOT_IDS.map((slotId) => {
                    const summary = getSelectedEngineSlot(slotLookup, slotId);
                    const selectedSlotButton = selectedSlotId === slotId;
                    return (
                      <button
                        key={slotId}
                        type="button"
                        data-testid={`engine-slot-${slotId}`}
                        className={cn(
                          "min-h-[44px] border px-1.5 py-1.5 text-left tracking-[0.12em]",
                          selectedSlotButton
                            ? "border-yellow-200 bg-yellow-200/14 text-yellow-50"
                            : "border-cyan-100/15 bg-black/24 text-cyan-50/60 hover:border-cyan-100/40"
                        )}
                        onClick={() => selectSlot(slotId)}
                      >
                        <span className="block truncate text-[7px] tracking-widest">{summary?.label ?? getEngineMenuSlotLabel(slotId)}</span>
                        <span className="block text-[6px] text-cyan-100/42">
                          {summary ? `${summary.count} saved` : "Empty"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <input
                  data-testid="engine-slot-label"
                  className="mt-2 w-full border border-cyan-100/20 bg-black/35 px-2 py-2 text-[8px] tracking-[0.14em] text-cyan-50 outline-none placeholder:text-cyan-100/25"
                  value={slotLabel}
                  maxLength={36}
                  placeholder="Slot label"
                  onChange={(event) => setSlotLabel(event.target.value)}
                />
                <div className="mt-2 grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    data-testid="engine-save-slot"
                    className="border border-emerald-200/40 bg-emerald-400/10 px-1.5 py-2 text-[7px] tracking-widest text-emerald-50/85 hover:bg-emerald-300/16"
                    onClick={requestSlotSave}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    data-testid="engine-load-slot"
                    className={cn(
                      "border px-1.5 py-2 text-[7px] tracking-widest",
                      selectedSlot
                        ? "border-cyan-100/35 bg-cyan-300/10 text-cyan-50/85 hover:bg-cyan-300/16"
                        : "border-cyan-100/10 bg-black/20 text-cyan-100/25"
                    )}
                    disabled={!selectedSlot}
                    onClick={requestSlotLoad}
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    data-testid="engine-delete-slot"
                    className={cn(
                      "border px-1.5 py-2 text-[7px] tracking-widest",
                      selectedSlot
                        ? "border-red-200/40 bg-red-500/10 text-red-100/80 hover:bg-red-500/16"
                        : "border-cyan-100/10 bg-black/20 text-cyan-100/25"
                    )}
                    disabled={!selectedSlot}
                    onClick={requestSlotDelete}
                  >
                    Delete
                  </button>
                </div>
                <div className="mt-1 truncate text-[6px] tracking-[0.12em] text-cyan-100/35 normal-case">
                  {selectedSlot ? `Saved ${formatEngineMenuSlotTime(selectedSlot.savedAt)}` : "Empty slot selected"}
                </div>
              </div>
            </div>

            <div className="min-h-0 min-w-0 overflow-hidden">
              <div className="mb-2 text-[10px] tracking-[0.24em] text-cyan-100">Systems</div>
              <div className="flex max-h-full flex-col gap-2 overflow-y-auto pr-1">
              {GAME_SYSTEM_CATALOG.map((system) => (
                <div key={system.id} className="border border-cyan-100/15 bg-cyan-200/5 p-2">
                  <div className="text-[9px] tracking-widest text-yellow-100">{system.name}</div>
                  <div className="mt-1 break-words text-[7px] leading-4 tracking-[0.12em] text-cyan-100/55 normal-case">
                    {system.responsibility}
                  </div>
                  <div className="mt-1 truncate text-[7px] tracking-[0.14em] text-cyan-100/35">
                    {system.extractionTarget}
                  </div>
                </div>
              ))}
              </div>
            </div>
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
