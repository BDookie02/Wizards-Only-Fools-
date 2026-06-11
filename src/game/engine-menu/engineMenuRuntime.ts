import {
  PLACEABLE_CATEGORIES,
  type PlaceableCategory,
  type PlaceableDefinition,
} from "../systems/placeables/placeableCatalog";

export type EngineMenuPlacementOptions = {
  source: string;
  snapToGrid: boolean;
  gridSize: number;
  yaw: number;
  x?: number;
  y?: number;
  z?: number;
  replaceInstanceId?: string;
};

export type EngineMenuPlacementState = {
  snapToGrid: boolean;
  gridSize: number;
  yaw: number;
};

export type EnginePlacedObjectSummary = {
  instanceId: string;
  placeableId: string;
  label: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
};

export type EnginePlacedObjectSlotSummary = {
  slotId: string;
  label: string;
  count: number;
  savedAt: number;
};

export const ENGINE_MENU_SLOT_IDS = ["slot-1", "slot-2", "slot-3", "slot-4", "slot-5", "slot-6"] as const;

export function normalizeEnginePlaceableSearchQuery(query: string) {
  return query.trim().toLowerCase();
}

export function getEngineMenuSlotLabel(slotId: string) {
  const match = slotId.match(/^slot-(\d+)$/);
  return match ? `Slot ${match[1]}` : slotId;
}

export function formatEngineMenuSlotTime(savedAt: number) {
  if (!Number.isFinite(savedAt) || savedAt <= 0) return "Empty";
  return new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function createEngineMenuPlacementOptions(
  state: EngineMenuPlacementState,
  overrides?: Partial<EngineMenuPlacementOptions>,
): EngineMenuPlacementOptions {
  return {
    source: "engine-menu",
    snapToGrid: state.snapToGrid,
    gridSize: state.gridSize,
    yaw: state.yaw,
    ...overrides,
  };
}

function getPlaceableSearchText(placeable: PlaceableDefinition) {
  return `${placeable.id} ${placeable.name} ${placeable.description} ${placeable.tags.join(" ")}`.toLowerCase();
}

function matchesPlaceableSearch(placeable: PlaceableDefinition, normalizedSearchQuery: string) {
  return !normalizedSearchQuery || getPlaceableSearchText(placeable).includes(normalizedSearchQuery);
}

export function getEnginePlaceableCategoryCounts(
  placeables: readonly PlaceableDefinition[],
  normalizedSearchQuery: string,
) {
  const counts = {} as Record<PlaceableCategory, number>;
  for (const category of PLACEABLE_CATEGORIES) {
    counts[category] = 0;
  }
  for (const placeable of placeables) {
    if (matchesPlaceableSearch(placeable, normalizedSearchQuery)) {
      counts[placeable.category] += 1;
    }
  }
  return counts;
}

export function getFilteredEnginePlaceables(
  placeables: readonly PlaceableDefinition[],
  activeCategory: PlaceableCategory,
  normalizedSearchQuery: string,
) {
  const filtered: PlaceableDefinition[] = [];
  for (const placeable of placeables) {
    if (placeable.category !== activeCategory) continue;
    if (!matchesPlaceableSearch(placeable, normalizedSearchQuery)) continue;
    filtered.push(placeable);
  }
  return filtered;
}

export function getSelectedEnginePlaceable(
  placeables: readonly PlaceableDefinition[],
  selectedId: string | undefined,
) {
  if (!selectedId) return null;
  for (const placeable of placeables) {
    if (placeable.id === selectedId) return placeable;
  }
  return null;
}

export function getSelectedEnginePlacedObject(
  placedObjects: readonly EnginePlacedObjectSummary[],
  selectedPlacedObjectId: string,
) {
  if (!selectedPlacedObjectId) return null;
  for (const object of placedObjects) {
    if (object.instanceId === selectedPlacedObjectId) return object;
  }
  return null;
}

export function getSelectedEngineSlot(
  slotSummaries: readonly EnginePlacedObjectSlotSummary[],
  selectedSlotId: string,
) {
  for (const slot of slotSummaries) {
    if (slot.slotId === selectedSlotId) return slot;
  }
  return null;
}
