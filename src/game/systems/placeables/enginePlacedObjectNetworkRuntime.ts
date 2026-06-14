import type { EnginePlaceableNetworkObject } from "../../network/gameNetworkClient";
import type { EnginePlacedObjectRecord } from "./enginePlacedObjectStorage";
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
