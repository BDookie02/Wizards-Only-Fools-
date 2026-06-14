import type { EnginePlaceableNetworkObject } from "../../network/gameNetworkClient";
import {
  appendEnginePlacedObjectBounded,
  findEnginePlacedObjectById,
  hasEnginePlacedObjectId,
  removeEnginePlacedObjectById,
  replaceEnginePlacedObjectById,
} from "./enginePlacedObjectListRuntime";
import type { EnginePlacedObjectRecord } from "./enginePlacedObjectStorage";
import { MAX_ENGINE_PLACED_OBJECTS } from "./enginePlacedObjectStorage";
import { getPlaceableDefinition } from "./placeableCatalog";

export type EnginePlaceableNetworkUpsertDetail = {
  object?: EnginePlaceableNetworkObject;
  sourcePlayerId?: string;
};

export type EnginePlaceableNetworkDeleteDetail = {
  instanceId?: string;
  sourcePlayerId?: string;
};

export type EnginePlaceableNetworkSnapshotDetail = {
  objects?: EnginePlaceableNetworkObject[];
  sourcePlayerId?: string;
  receivedAt?: number;
};

export function normalizeReplicatedEnginePlacedObject(value: unknown): EnginePlacedObjectRecord | null {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Partial<EnginePlacedObjectRecord>
    : null;
  if (!record) return null;
  const placeable = getPlaceableDefinition(String(record.placeableId ?? ""));
  if (!placeable) return null;
  const x = Number(record.x);
  const y = Number(record.y);
  const z = Number(record.z);
  const yaw = Number(record.yaw);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(yaw)) {
    return null;
  }
  return {
    instanceId: String(record.instanceId || `engine-${placeable.id}`),
    placeableId: placeable.id,
    label: String(record.label || placeable.name),
    x,
    y,
    z,
    yaw,
  };
}

export type EnginePlacedObjectNetworkUpsertResult =
  | {
      ok: true;
      object: EnginePlacedObjectRecord;
      objects: EnginePlacedObjectRecord[];
    }
  | {
      ok: false;
    };

export type EnginePlacedObjectNetworkDeleteResult =
  | {
      ok: true;
      object: EnginePlacedObjectRecord;
      objects: EnginePlacedObjectRecord[];
    }
  | {
      ok: false;
    };

export type EnginePlacedObjectNetworkSnapshotResult = {
  receivedAt?: number;
  objects: EnginePlacedObjectRecord[];
};

export function applyReplicatedEnginePlacedObjectUpsert(
  currentObjects: EnginePlacedObjectRecord[],
  detail: EnginePlaceableNetworkUpsertDetail | undefined
): EnginePlacedObjectNetworkUpsertResult {
  const object = normalizeReplicatedEnginePlacedObject(detail?.object);
  if (!object) return { ok: false };

  const nextObjects = hasEnginePlacedObjectId(currentObjects, object.instanceId)
    ? replaceEnginePlacedObjectById(currentObjects, object.instanceId, object)
    : appendEnginePlacedObjectBounded(currentObjects, object);
  return { ok: true, object, objects: nextObjects };
}

export function applyReplicatedEnginePlacedObjectDelete(
  currentObjects: EnginePlacedObjectRecord[],
  detail: EnginePlaceableNetworkDeleteDetail | undefined
): EnginePlacedObjectNetworkDeleteResult {
  const instanceId = String(detail?.instanceId ?? "");
  if (!instanceId) return { ok: false };

  const object = findEnginePlacedObjectById(currentObjects, instanceId);
  if (!object) return { ok: false };

  return {
    ok: true,
    object,
    objects: removeEnginePlacedObjectById(currentObjects, instanceId),
  };
}

export function applyReplicatedEnginePlacedObjectSnapshot(
  detail: EnginePlaceableNetworkSnapshotDetail | undefined
): EnginePlacedObjectNetworkSnapshotResult {
  const incomingObjects = detail?.objects ?? [];
  const objects: EnginePlacedObjectRecord[] = [];
  for (let index = 0; index < incomingObjects.length && objects.length < MAX_ENGINE_PLACED_OBJECTS; index += 1) {
    const object = normalizeReplicatedEnginePlacedObject(incomingObjects[index]);
    if (object) objects.push(object);
  }

  if (Number.isFinite(detail?.receivedAt)) {
    return { receivedAt: Number(detail?.receivedAt), objects };
  }
  return { objects };
}
