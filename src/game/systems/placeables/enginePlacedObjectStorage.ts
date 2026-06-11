import { getPlaceableDefinition } from "./placeableCatalog";

export const ENGINE_PLACED_OBJECTS_STORAGE_KEY = "wof-engine-placed-objects-v1";
export const ENGINE_PLACED_OBJECTS_SLOT_META_KEY = "wof-engine-placed-object-slots-v1";
export const ENGINE_PLACED_OBJECTS_SLOT_KEY_PREFIX = "wof-engine-placed-objects-slot-v1:";
export const MAX_ENGINE_PLACED_OBJECTS = 64;
export const MAX_ENGINE_PLACED_OBJECT_SLOTS = 6;

export type EnginePlacedObjectRecord = {
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

type EnginePlacementStorageLike = {
  getItem?: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
};

const slotSummarySeenScratch = new Set<string>();

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function appendBoundedStoredEngineObject(
  objects: EnginePlacedObjectRecord[],
  object: EnginePlacedObjectRecord
) {
  if (objects.length < MAX_ENGINE_PLACED_OBJECTS) {
    objects.push(object);
    return;
  }

  for (let index = 1; index < MAX_ENGINE_PLACED_OBJECTS; index += 1) {
    objects[index - 1] = objects[index];
  }
  objects[MAX_ENGINE_PLACED_OBJECTS - 1] = object;
}

function copyLastStoredEngineObjects(objects: EnginePlacedObjectRecord[]) {
  if (objects.length <= MAX_ENGINE_PLACED_OBJECTS) return objects;
  const startIndex = objects.length - MAX_ENGINE_PLACED_OBJECTS;
  const savedObjects = new Array<EnginePlacedObjectRecord>(MAX_ENGINE_PLACED_OBJECTS);
  for (let index = 0; index < MAX_ENGINE_PLACED_OBJECTS; index += 1) {
    savedObjects[index] = objects[startIndex + index];
  }
  return savedObjects;
}

function copyFirstStoredSlotSummaries(summaries: EnginePlacedObjectSlotSummary[]) {
  if (summaries.length <= MAX_ENGINE_PLACED_OBJECT_SLOTS) return summaries;
  const savedSummaries = new Array<EnginePlacedObjectSlotSummary>(MAX_ENGINE_PLACED_OBJECT_SLOTS);
  for (let index = 0; index < MAX_ENGINE_PLACED_OBJECT_SLOTS; index += 1) {
    savedSummaries[index] = summaries[index];
  }
  return savedSummaries;
}

function insertStoredSlotSummaryBySavedAt(
  summaries: EnginePlacedObjectSlotSummary[],
  summary: EnginePlacedObjectSlotSummary
) {
  let insertIndex = summaries.length;
  while (insertIndex > 0 && summary.savedAt > summaries[insertIndex - 1].savedAt) {
    summaries[insertIndex] = summaries[insertIndex - 1];
    insertIndex -= 1;
  }
  summaries[insertIndex] = summary;
}

function sanitizeStoredEngineObjects(parsed: unknown): EnginePlacedObjectRecord[] {
  if (!Array.isArray(parsed)) return [];
  const objects: EnginePlacedObjectRecord[] = [];
  for (let index = 0; index < parsed.length; index += 1) {
    const object = parsed[index];
    const placeableId = String(object?.placeableId ?? "");
    const placeable = getPlaceableDefinition(placeableId);
    if (!placeable) continue;
    const x = Number(object?.x);
    const y = Number(object?.y);
    const z = Number(object?.z);
    const yaw = Number(object?.yaw);
    if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(z) || !isFiniteNumber(yaw)) continue;
    appendBoundedStoredEngineObject(objects, {
      instanceId: String(object?.instanceId || `engine-${placeableId}-${index}`),
      placeableId,
      label: String(object?.label || placeable.name),
      x,
      y,
      z,
      yaw,
    });
  }
  return objects;
}

export function sanitizeEnginePlacementSlotId(slotId: unknown) {
  const normalized = String(slotId ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  if (!normalized) return "slot-1";
  return normalized.slice(0, 32);
}

export function getEnginePlacementSlotLabel(slotId: string, label?: unknown) {
  const trimmed = String(label ?? "").trim();
  if (trimmed) return trimmed.slice(0, 36);
  const match = slotId.match(/^slot-(\d+)$/);
  return match ? `Slot ${match[1]}` : slotId;
}

function getEnginePlacementSlotStorageKey(slotId: string) {
  return `${ENGINE_PLACED_OBJECTS_SLOT_KEY_PREFIX}${sanitizeEnginePlacementSlotId(slotId)}`;
}

function sanitizeSlotSummary(value: unknown): EnginePlacedObjectSlotSummary | null {
  const record = value && typeof value === "object" ? value as { slotId?: unknown; label?: unknown; count?: unknown; savedAt?: unknown } : {};
  const slotId = sanitizeEnginePlacementSlotId(record.slotId);
  const count = Number(record.count);
  const savedAt = Number(record.savedAt);
  if (!Number.isFinite(count) || count < 0 || !Number.isFinite(savedAt) || savedAt <= 0) return null;
  return {
    slotId,
    label: getEnginePlacementSlotLabel(slotId, record.label),
    count: Math.min(MAX_ENGINE_PLACED_OBJECTS, Math.floor(count)),
    savedAt,
  };
}

export function loadStoredEngineObjects(storage: EnginePlacementStorageLike | null | undefined): EnginePlacedObjectRecord[] {
  try {
    const raw = storage?.getItem?.(ENGINE_PLACED_OBJECTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return sanitizeStoredEngineObjects(parsed);
  } catch {
    return [];
  }
}

export function saveStoredEngineObjects(storage: EnginePlacementStorageLike | null | undefined, objects: EnginePlacedObjectRecord[]) {
  try {
    storage?.setItem?.(ENGINE_PLACED_OBJECTS_STORAGE_KEY, JSON.stringify(copyLastStoredEngineObjects(objects)));
    return Boolean(storage?.setItem);
  } catch {
    return false;
  }
}

export function loadStoredEngineObjectSlotSummaries(storage: EnginePlacementStorageLike | null | undefined): EnginePlacedObjectSlotSummary[] {
  try {
    const raw = storage?.getItem?.(ENGINE_PLACED_OBJECTS_SLOT_META_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const summaries: EnginePlacedObjectSlotSummary[] = [];
    const seen = slotSummarySeenScratch;
    seen.clear();
    for (let index = 0; index < parsed.length; index += 1) {
      const summary = sanitizeSlotSummary(parsed[index]);
      if (!summary || seen.has(summary.slotId)) continue;
      seen.add(summary.slotId);
      insertStoredSlotSummaryBySavedAt(summaries, summary);
    }
    seen.clear();
    if (summaries.length > MAX_ENGINE_PLACED_OBJECT_SLOTS) {
      summaries.length = MAX_ENGINE_PLACED_OBJECT_SLOTS;
    }
    return summaries;
  } catch {
    slotSummarySeenScratch.clear();
    return [];
  }
}

function saveStoredEngineObjectSlotSummaries(
  storage: EnginePlacementStorageLike | null | undefined,
  summaries: EnginePlacedObjectSlotSummary[]
) {
  try {
    storage?.setItem?.(
      ENGINE_PLACED_OBJECTS_SLOT_META_KEY,
      JSON.stringify(copyFirstStoredSlotSummaries(summaries))
    );
    return Boolean(storage?.setItem);
  } catch {
    return false;
  }
}

function removeStoredEngineObjectSlotSummary(
  summaries: EnginePlacedObjectSlotSummary[],
  slotId: string
) {
  const next: EnginePlacedObjectSlotSummary[] = [];
  for (let index = 0; index < summaries.length; index += 1) {
    const summary = summaries[index];
    if (summary.slotId !== slotId) next.push(summary);
  }
  return next;
}

function prependStoredEngineObjectSlotSummary(
  summary: EnginePlacedObjectSlotSummary,
  summaries: EnginePlacedObjectSlotSummary[]
) {
  const next = new Array<EnginePlacedObjectSlotSummary>(summaries.length + 1);
  next[0] = summary;
  for (let index = 0; index < summaries.length; index += 1) {
    next[index + 1] = summaries[index];
  }
  return next;
}

export function saveStoredEngineObjectSlot(
  storage: EnginePlacementStorageLike | null | undefined,
  slotIdValue: unknown,
  labelValue: unknown,
  objects: EnginePlacedObjectRecord[]
) {
  const slotId = sanitizeEnginePlacementSlotId(slotIdValue);
  const label = getEnginePlacementSlotLabel(slotId, labelValue);
  const savedObjects = copyLastStoredEngineObjects(objects);
  const savedAt = Date.now();
  try {
    storage?.setItem?.(getEnginePlacementSlotStorageKey(slotId), JSON.stringify(savedObjects));
    const currentSummaries = removeStoredEngineObjectSlotSummary(loadStoredEngineObjectSlotSummaries(storage), slotId);
    const nextSummary: EnginePlacedObjectSlotSummary = {
      slotId,
      label,
      count: savedObjects.length,
      savedAt,
    };
    saveStoredEngineObjectSlotSummaries(storage, prependStoredEngineObjectSlotSummary(nextSummary, currentSummaries));
    return nextSummary;
  } catch {
    return null;
  }
}

export function loadStoredEngineObjectsFromSlot(
  storage: EnginePlacementStorageLike | null | undefined,
  slotIdValue: unknown
): EnginePlacedObjectRecord[] | null {
  const slotId = sanitizeEnginePlacementSlotId(slotIdValue);
  try {
    const raw = storage?.getItem?.(getEnginePlacementSlotStorageKey(slotId));
    if (!raw) return null;
    return sanitizeStoredEngineObjects(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function deleteStoredEngineObjectSlot(storage: EnginePlacementStorageLike | null | undefined, slotIdValue: unknown) {
  const slotId = sanitizeEnginePlacementSlotId(slotIdValue);
  try {
    storage?.removeItem?.(getEnginePlacementSlotStorageKey(slotId));
    const summaries = removeStoredEngineObjectSlotSummary(loadStoredEngineObjectSlotSummaries(storage), slotId);
    saveStoredEngineObjectSlotSummaries(storage, summaries);
    return true;
  } catch {
    return false;
  }
}
