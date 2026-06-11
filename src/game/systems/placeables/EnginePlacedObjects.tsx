import { useEffect, useRef, useState } from "react";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import {
  emitEnginePlaceableNetworkDelete,
  emitEnginePlaceableNetworkSnapshot,
  emitEnginePlaceableNetworkUpsert,
  type EnginePlaceableNetworkObject,
} from "../../network/gameNetworkClient";
import {
  getLastKnownLocalPlayerPosition,
  getPublishedLastPlayerYaw,
} from "../player/playerEventBridge";
import { getBaseVillageTerrainHeight } from "../world/terrain/BaseVillageTerrain";
import { getSurvivalGrassSurfaceHeightAtWorld } from "../world/survival/survivalGrassSurface";
import { dispatchEnginePlaceableEvent, subscribeEnginePlaceableEvent } from "./enginePlaceableEvents";
import { findEnginePlacementCollision } from "./enginePlacementCollision";
import {
  MAX_ENGINE_PLACED_OBJECTS,
  deleteStoredEngineObjectSlot,
  getEnginePlacementSlotLabel,
  loadStoredEngineObjectSlotSummaries,
  loadStoredEngineObjectsFromSlot,
  loadStoredEngineObjects,
  saveStoredEngineObjectSlot,
  saveStoredEngineObjects,
  type EnginePlacedObjectRecord,
  type EnginePlacedObjectSlotSummary,
} from "./enginePlacedObjectStorage";
import { getPlaceableDefinition, type PlaceableDefinition } from "./placeableCatalog";
import { getPlaceableCollider, PlaceableModel } from "./PlaceableModel";
import {
  planEnginePlaceablePlacement,
  planTrainingSpellDummySpawn,
  type EnginePlaceableRequestDetail,
} from "./placementRules";

type EnginePlacedObject = EnginePlacedObjectRecord;

type EnginePlaceableNetworkUpsertDetail = {
  object?: EnginePlaceableNetworkObject;
  sourcePlayerId?: string;
};

type EnginePlaceableNetworkDeleteDetail = {
  instanceId?: string;
  sourcePlayerId?: string;
};

type EnginePlaceableNetworkSnapshotDetail = {
  objects?: EnginePlaceableNetworkObject[];
  sourcePlayerId?: string;
  receivedAt?: number;
};

type EnginePlacementPreview = {
  ok: boolean;
  placeableId: string;
  label: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  gridSize: number;
  snapped: boolean;
  reason?: string;
};

type EnginePlacementResultDetail = {
  ok: boolean;
  label?: string;
  reason?: string;
  count?: number;
};

type EnginePlacementPreviewResultDetail = EnginePlacementResultDetail & {
  x?: number;
  y?: number;
  z?: number;
  yaw?: number;
  gridSize?: number;
  snapped?: boolean;
};

type EnginePlacedObjectListDetail = {
  objects: EnginePlacedObject[];
};

type EnginePlacedObjectSlotListDetail = {
  slots: EnginePlacedObjectSlotSummary[];
};

type WindowWithPlayerSnapshot = Window & {
  wofEnginePlacedObjectCount?: number;
  wofEnginePlacedObjectSummary?: EnginePlacedObject[];
  wofEnginePlacedObjectSlots?: EnginePlacedObjectSlotSummary[];
  wofEnginePlaceableNetworkSnapshot?: EnginePlaceableNetworkSnapshotDetail;
  wofEnginePlacementPreview?: EnginePlacementPreviewResultDetail | null;
};

function publishEnginePlacementResult(detail: EnginePlacementResultDetail) {
  dispatchEnginePlaceableEvent("wof-engine-placeable-result", detail);
}

function publishEnginePlacementPreviewResult(detail: EnginePlacementPreviewResultDetail) {
  const playerWindow = window as WindowWithPlayerSnapshot;
  playerWindow.wofEnginePlacementPreview = detail;
  dispatchEnginePlaceableEvent("wof-engine-placeable-preview-result", detail);
}

function cloneEnginePlacedObjects(objects: EnginePlacedObject[]) {
  const cloned = new Array<EnginePlacedObject>(objects.length);
  for (let index = 0; index < objects.length; index += 1) {
    cloned[index] = { ...objects[index] };
  }
  return cloned;
}

function hasEnginePlacedObjectId(objects: EnginePlacedObject[], instanceId: string) {
  for (let index = 0; index < objects.length; index += 1) {
    if (objects[index].instanceId === instanceId) return true;
  }
  return false;
}

function findEnginePlacedObjectById(objects: EnginePlacedObject[], instanceId: string) {
  for (let index = 0; index < objects.length; index += 1) {
    const object = objects[index];
    if (object.instanceId === instanceId) return object;
  }
  return undefined;
}

function removeEnginePlacedObjectById(objects: EnginePlacedObject[], instanceId: string) {
  let removed = false;
  const next: EnginePlacedObject[] = [];
  for (let index = 0; index < objects.length; index += 1) {
    const object = objects[index];
    if (object.instanceId === instanceId) {
      removed = true;
      continue;
    }
    next.push(object);
  }
  return removed ? next : objects;
}

function replaceEnginePlacedObjectById(objects: EnginePlacedObject[], instanceId: string, replacement: EnginePlacedObject) {
  let replaced = false;
  const next = new Array<EnginePlacedObject>(objects.length);
  for (let index = 0; index < objects.length; index += 1) {
    const object = objects[index];
    if (object.instanceId === instanceId) {
      next[index] = replacement;
      replaced = true;
    } else {
      next[index] = object;
    }
  }
  return replaced ? next : objects;
}

function appendEnginePlacedObjectBounded(objects: EnginePlacedObject[], object: EnginePlacedObject) {
  const existingCount = Math.min(objects.length, MAX_ENGINE_PLACED_OBJECTS - 1);
  const next = new Array<EnginePlacedObject>(existingCount + 1);
  const startIndex = Math.max(0, objects.length - existingCount);
  for (let index = 0; index < existingCount; index += 1) {
    next[index] = objects[startIndex + index];
  }
  next[existingCount] = object;
  return next;
}

function publishEnginePlacedObjectList(objects: EnginePlacedObject[]) {
  const playerWindow = window as WindowWithPlayerSnapshot;
  const summary = cloneEnginePlacedObjects(objects);
  playerWindow.wofEnginePlacedObjectCount = summary.length;
  playerWindow.wofEnginePlacedObjectSummary = summary;
  dispatchEnginePlaceableEvent<EnginePlacedObjectListDetail>("wof-engine-placeable-list", { objects: summary });
}

function publishEnginePlacedObjectSlotList() {
  const playerWindow = window as WindowWithPlayerSnapshot;
  const slots = loadStoredEngineObjectSlotSummaries(getEnginePlacementStorage());
  playerWindow.wofEnginePlacedObjectSlots = slots;
  dispatchEnginePlaceableEvent<EnginePlacedObjectSlotListDetail>("wof-engine-placeable-slots", { slots });
}

function getPlayerSnapshot(detail?: EnginePlaceableRequestDetail) {
  const playerPosition = getLastKnownLocalPlayerPosition();
  const playerYaw = Number(getPublishedLastPlayerYaw() ?? detail?.yaw ?? 0);
  return { position: playerPosition, yaw: playerYaw };
}

function getEnginePlacementStorage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

function normalizeReplicatedEnginePlacedObject(value: unknown): EnginePlacedObject | null {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Partial<EnginePlacedObject>
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

function getInvalidPreviewFallback(
  placeable: PlaceableDefinition,
  getGroundY: (x: number, z: number) => number,
  detail: EnginePlaceableRequestDetail | undefined,
  playerSnapshot: ReturnType<typeof getPlayerSnapshot>,
  reason: string,
  y?: number
): EnginePlacementPreview {
  const distance = Math.max(7, placeable.footprintRadius + 4);
  const fallbackX = Number(detail?.x ?? (Number(playerSnapshot.position?.x) + Math.sin(playerSnapshot.yaw) * distance));
  const fallbackZ = Number(detail?.z ?? (Number(playerSnapshot.position?.z) - Math.cos(playerSnapshot.yaw) * distance));
  const safeX = Number.isFinite(fallbackX) ? fallbackX : 0;
  const safeZ = Number.isFinite(fallbackZ) ? fallbackZ : 0;
  const groundY = Number.isFinite(y) ? Number(y) : getGroundY(safeX, safeZ);
  return {
    ok: false,
    placeableId: placeable.id,
    label: placeable.name,
    x: safeX,
    y: Number.isFinite(groundY) ? groundY : Number(playerSnapshot.position?.y ?? 0),
    z: safeZ,
    yaw: Number.isFinite(detail?.yaw) ? Number(detail?.yaw) : playerSnapshot.yaw,
    gridSize: 1,
    snapped: false,
    reason,
  };
}

function planEnginePlacementPreview(
  placeable: PlaceableDefinition,
  getGroundY: (x: number, z: number) => number,
  detail: EnginePlaceableRequestDetail | undefined,
  playerSnapshot: ReturnType<typeof getPlayerSnapshot>
): EnginePlacementPreview {
  if (placeable.id === "training-spell-dummy") {
    const spawnPlan = planTrainingSpellDummySpawn(detail, playerSnapshot);
    if (spawnPlan.ok === false) {
      return getInvalidPreviewFallback(placeable, getGroundY, detail, playerSnapshot, spawnPlan.reason);
    }
    return {
      ok: true,
      placeableId: placeable.id,
      label: placeable.name,
      x: spawnPlan.x,
      y: spawnPlan.y,
      z: spawnPlan.z,
      yaw: spawnPlan.yaw,
      gridSize: Number(detail?.gridSize ?? 1),
      snapped: Boolean(detail?.snapToGrid ?? true),
    };
  }

  const placementPlan = planEnginePlaceablePlacement(placeable, getGroundY, detail, playerSnapshot);
  if (placementPlan.ok === false) {
    return getInvalidPreviewFallback(placeable, getGroundY, detail, playerSnapshot, placementPlan.reason, placementPlan.y);
  }
  return {
    ok: true,
    placeableId: placeable.id,
    label: placeable.name,
    x: placementPlan.x,
    y: placementPlan.y,
    z: placementPlan.z,
    yaw: placementPlan.yaw,
    gridSize: placementPlan.gridSize,
    snapped: placementPlan.snapped,
  };
}

function EnginePlacedObjectVisual({ object }: { object: EnginePlacedObject }) {
  const placeable = getPlaceableDefinition(object.placeableId);
  if (!placeable) return null;

  const position: [number, number, number] = [object.x, object.y, object.z];
  const rotation: [number, number, number] = [0, object.yaw, 0];
  const collider = getPlaceableCollider(placeable);

  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation={rotation}>
      {collider.kind === "cylinder"
        ? <CylinderCollider args={collider.args} position={collider.position} />
        : <CuboidCollider args={collider.args} position={collider.position} />
      }
      <PlaceableModel placeable={placeable} name={object.instanceId} />
    </RigidBody>
  );
}

function EnginePlacementPreviewVisual({ preview }: { preview: EnginePlacementPreview }) {
  const placeable = getPlaceableDefinition(preview.placeableId);
  if (!placeable) return null;

  const color = preview.ok ? "#22c55e" : "#ef4444";
  const gridSize = Math.max(0.5, preview.gridSize || 1);
  const gridSpan = Math.max(gridSize * 4, placeable.footprintRadius * 2.4);
  const gridDivisions = Math.max(2, Math.min(16, Math.round(gridSpan / gridSize)));

  return (
    <group
      name={preview.ok ? "engine-placement-preview-valid" : "engine-placement-preview-invalid"}
      position={[preview.x, preview.y + 0.05, preview.z]}
      rotation={[0, preview.yaw, 0]}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[placeable.footprintRadius, 48]} />
        <meshBasicMaterial color={color} transparent opacity={preview.ok ? 0.18 : 0.24} depthWrite={false} toneMapped={false} />
      </mesh>
      <gridHelper args={[gridSpan, gridDivisions, color, color]} position={[0, 0.04, 0]} />
      <PlaceableModel placeable={placeable} name="engine-placement-preview-model" opacity={preview.ok ? 0.42 : 0.22} />
    </group>
  );
}

export function EnginePlacedObjects({ isSurvivalMode }: { isSurvivalMode: boolean }) {
  const [objects, setObjects] = useState<EnginePlacedObject[]>(() => loadStoredEngineObjects(getEnginePlacementStorage()));
  const [preview, setPreview] = useState<EnginePlacementPreview | null>(null);
  const appliedNetworkSnapshotAtRef = useRef(0);

  useEffect(() => {
    saveStoredEngineObjects(getEnginePlacementStorage(), objects);
    publishEnginePlacedObjectList(objects);
  }, [objects]);

  useEffect(() => {
    const getGroundY = isSurvivalMode ? getSurvivalGrassSurfaceHeightAtWorld : getBaseVillageTerrainHeight;
    const handlePreviewRequest = (event: { detail: EnginePlaceableRequestDetail | undefined }) => {
      const detail = event.detail;
      const placeableId = String(detail?.placeableId ?? "");
      const placeable = getPlaceableDefinition(placeableId);
      if (!placeable) {
        setPreview(null);
        publishEnginePlacementPreviewResult({ ok: false, reason: "unknown placeable" });
        return;
      }

      const playerSnapshot = getPlayerSnapshot(detail);
      const previewPlan = planEnginePlacementPreview(placeable, getGroundY, detail, playerSnapshot);
      if (previewPlan.ok) {
        const collision = findEnginePlacementCollision(placeable, previewPlan.x, previewPlan.z, objects, detail?.replaceInstanceId, previewPlan.yaw);
        if (collision) {
          previewPlan.ok = false;
          previewPlan.reason = `overlaps ${collision.label}`;
        }
      }
      setPreview(previewPlan);
      publishEnginePlacementPreviewResult(previewPlan);
    };
    const handlePreviewClear = () => {
      setPreview(null);
      publishEnginePlacementPreviewResult({ ok: false, reason: "preview cleared" });
    };
    const handleClearPlacedObjects = () => {
      setObjects([]);
      publishEnginePlacementResult({ ok: true, label: "cleared placements", count: 0 });
      emitEnginePlaceableNetworkSnapshot([]);
    };
    const handleDeletePlacedObject = (event: { detail: { instanceId?: string } | undefined }) => {
      const instanceId = String(event.detail?.instanceId ?? "");
      if (!instanceId) {
        publishEnginePlacementResult({ ok: false, reason: "missing placed object" });
        return;
      }
      const object = findEnginePlacedObjectById(objects, instanceId);
      if (!object) {
        publishEnginePlacementResult({ ok: false, reason: "placed object not found" });
        return;
      }
      setObjects((current) => removeEnginePlacedObjectById(current, instanceId));
      publishEnginePlacementResult({ ok: true, label: `deleted ${object.label}`, count: Math.max(0, objects.length - 1) });
      emitEnginePlaceableNetworkDelete(instanceId);
    };
    const handlePlaceableRequest = (event: { detail: EnginePlaceableRequestDetail | undefined }) => {
      const detail = event.detail;
      const placeableId = String(detail?.placeableId ?? "");
      const placeable = getPlaceableDefinition(placeableId);
      if (!placeable) {
        publishEnginePlacementResult({ ok: false, reason: "unknown placeable" });
        return;
      }

      const playerSnapshot = getPlayerSnapshot(detail);

      if (placeable.id === "training-spell-dummy") {
        const spawnPlan = planTrainingSpellDummySpawn(detail, playerSnapshot);
        if (spawnPlan.ok === false) {
          publishEnginePlacementResult({ ok: false, label: placeable.name, reason: spawnPlan.reason });
          return;
        }
        dispatchEnginePlaceableEvent("wof-spawn-spell-dummies", {
          x: spawnPlan.x,
          y: spawnPlan.y,
          z: spawnPlan.z,
          yaw: spawnPlan.yaw,
          count: spawnPlan.count,
        });
        publishEnginePlacementResult({ ok: true, label: placeable.name });
        return;
      }

      const placementPlan = planEnginePlaceablePlacement(placeable, getGroundY, detail, playerSnapshot);
      if (placementPlan.ok === false) {
        publishEnginePlacementResult({ ok: false, label: placeable.name, reason: placementPlan.reason });
        return;
      }

      const collision = findEnginePlacementCollision(placeable, placementPlan.x, placementPlan.z, objects, detail?.replaceInstanceId, placementPlan.yaw);
      if (collision) {
        publishEnginePlacementResult({ ok: false, label: placeable.name, reason: `overlaps ${collision.label}` });
        setPreview({
          ok: false,
          placeableId: placeable.id,
          label: placeable.name,
          x: placementPlan.x,
          y: placementPlan.y,
          z: placementPlan.z,
          yaw: placementPlan.yaw,
          gridSize: placementPlan.gridSize,
          snapped: placementPlan.snapped,
          reason: `overlaps ${collision.label}`,
        });
        return;
      }

      const object: EnginePlacedObject = {
        instanceId: detail?.replaceInstanceId || `engine-${placeable.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        placeableId: placeable.id,
        label: placeable.name,
        x: placementPlan.x,
        y: placementPlan.y,
        z: placementPlan.z,
        yaw: placementPlan.yaw,
      };
      const replaceInstanceId = detail?.replaceInstanceId;
      const replacingObject = Boolean(replaceInstanceId && hasEnginePlacedObjectId(objects, replaceInstanceId));
      if (replacingObject) {
        setObjects((current) => replaceEnginePlacedObjectById(current, String(replaceInstanceId), object));
      } else {
        setObjects((current) => appendEnginePlacedObjectBounded(current, object));
      }
      setPreview({
        ok: true,
        placeableId: placeable.id,
        label: placeable.name,
        x: placementPlan.x,
        y: placementPlan.y,
        z: placementPlan.z,
        yaw: placementPlan.yaw,
        gridSize: placementPlan.gridSize,
        snapped: placementPlan.snapped,
      });
      publishEnginePlacementResult({
        ok: true,
        label: replacingObject ? `moved ${placeable.name}` : placeable.name,
        count: replacingObject ? objects.length : Math.min(objects.length + 1, MAX_ENGINE_PLACED_OBJECTS),
      });
      emitEnginePlaceableNetworkUpsert(object);
    };
    const handlePlacedObjectListRequest = () => {
      publishEnginePlacedObjectList(objects);
    };
    const handlePlacedObjectSlotListRequest = () => {
      publishEnginePlacedObjectSlotList();
    };
    const handleSavePlacedObjectSlot = (event: { detail: { slotId?: string; label?: string } | undefined }) => {
      const summary = saveStoredEngineObjectSlot(
        getEnginePlacementStorage(),
        event.detail?.slotId,
        event.detail?.label,
        objects
      );
      if (!summary) {
        publishEnginePlacementResult({ ok: false, reason: "slot save failed" });
        return;
      }
      publishEnginePlacementResult({ ok: true, label: `saved ${summary.label}`, count: summary.count });
      publishEnginePlacedObjectSlotList();
    };
    const handleLoadPlacedObjectSlot = (event: { detail: { slotId?: string; label?: string } | undefined }) => {
      const slotId = event.detail?.slotId;
      const loadedObjects = loadStoredEngineObjectsFromSlot(getEnginePlacementStorage(), slotId);
      const label = getEnginePlacementSlotLabel(String(slotId ?? ""), event.detail?.label);
      if (!loadedObjects) {
        publishEnginePlacementResult({ ok: false, reason: `${label} is empty` });
        publishEnginePlacedObjectSlotList();
        return;
      }
      setObjects(loadedObjects);
      setPreview(null);
      publishEnginePlacementResult({ ok: true, label: `loaded ${label}`, count: loadedObjects.length });
      publishEnginePlacedObjectSlotList();
      emitEnginePlaceableNetworkSnapshot(loadedObjects);
    };
    const handleDeletePlacedObjectSlot = (event: { detail: { slotId?: string; label?: string } | undefined }) => {
      const slotId = event.detail?.slotId;
      const label = getEnginePlacementSlotLabel(String(slotId ?? ""), event.detail?.label);
      if (!deleteStoredEngineObjectSlot(getEnginePlacementStorage(), slotId)) {
        publishEnginePlacementResult({ ok: false, reason: "slot delete failed" });
        return;
      }
      publishEnginePlacementResult({ ok: true, label: `deleted ${label}` });
      publishEnginePlacedObjectSlotList();
    };
    const handleNetworkUpsert = (event: { detail: EnginePlaceableNetworkUpsertDetail | undefined }) => {
      const object = normalizeReplicatedEnginePlacedObject(event.detail?.object);
      if (!object) return;
      setObjects((current) => {
        if (hasEnginePlacedObjectId(current, object.instanceId)) {
          return replaceEnginePlacedObjectById(current, object.instanceId, object);
        }
        return appendEnginePlacedObjectBounded(current, object);
      });
      publishEnginePlacementResult({ ok: true, label: `synced ${object.label}` });
    };
    const handleNetworkDelete = (event: { detail: EnginePlaceableNetworkDeleteDetail | undefined }) => {
      const instanceId = String(event.detail?.instanceId ?? "");
      if (!instanceId) return;
      let deletedLabel = "";
      setObjects((current) => {
        const object = findEnginePlacedObjectById(current, instanceId);
        if (!object) return current;
        deletedLabel = object.label;
        return removeEnginePlacedObjectById(current, instanceId);
      });
      if (deletedLabel) {
        publishEnginePlacementResult({ ok: true, label: `synced delete ${deletedLabel}` });
      }
    };
    const handleNetworkSnapshot = (event: { detail: EnginePlaceableNetworkSnapshotDetail | undefined }) => {
      if (Number.isFinite(event.detail?.receivedAt)) {
        appliedNetworkSnapshotAtRef.current = Number(event.detail?.receivedAt);
      }
      const incomingObjects = event.detail?.objects ?? [];
      const nextObjects: EnginePlacedObject[] = [];
      for (let index = 0; index < incomingObjects.length && nextObjects.length < MAX_ENGINE_PLACED_OBJECTS; index += 1) {
        const object = normalizeReplicatedEnginePlacedObject(incomingObjects[index]);
        if (object) nextObjects.push(object);
      }
      setObjects(nextObjects);
      setPreview(null);
      publishEnginePlacementResult({ ok: true, label: "synced placement snapshot", count: nextObjects.length });
    };
    const pendingNetworkSnapshot = (window as WindowWithPlayerSnapshot).wofEnginePlaceableNetworkSnapshot;
    if (
      Number.isFinite(pendingNetworkSnapshot?.receivedAt) &&
      Number(pendingNetworkSnapshot?.receivedAt) !== appliedNetworkSnapshotAtRef.current
    ) {
      handleNetworkSnapshot({ detail: pendingNetworkSnapshot });
    }

    const unsubscribePreview = subscribeEnginePlaceableEvent("wof-engine-placeable-preview", handlePreviewRequest);
    const unsubscribePreviewClear = subscribeEnginePlaceableEvent("wof-engine-placeable-preview-clear", handlePreviewClear);
    const unsubscribeClear = subscribeEnginePlaceableEvent("wof-engine-placeable-clear", handleClearPlacedObjects);
    const unsubscribeDelete = subscribeEnginePlaceableEvent("wof-engine-placeable-delete", handleDeletePlacedObject);
    const unsubscribeRequest = subscribeEnginePlaceableEvent("wof-engine-placeable-request", handlePlaceableRequest);
    const unsubscribeListRequest = subscribeEnginePlaceableEvent("wof-engine-placeable-list-request", handlePlacedObjectListRequest);
    const unsubscribeSlotListRequest = subscribeEnginePlaceableEvent("wof-engine-placeable-slot-list-request", handlePlacedObjectSlotListRequest);
    const unsubscribeSlotSave = subscribeEnginePlaceableEvent("wof-engine-placeable-slot-save", handleSavePlacedObjectSlot);
    const unsubscribeSlotLoad = subscribeEnginePlaceableEvent("wof-engine-placeable-slot-load", handleLoadPlacedObjectSlot);
    const unsubscribeSlotDelete = subscribeEnginePlaceableEvent("wof-engine-placeable-slot-delete", handleDeletePlacedObjectSlot);
    const unsubscribeNetworkUpsert = subscribeEnginePlaceableEvent("wof-engine-placeable-network-upsert", handleNetworkUpsert);
    const unsubscribeNetworkDelete = subscribeEnginePlaceableEvent("wof-engine-placeable-network-delete", handleNetworkDelete);
    const unsubscribeNetworkSnapshot = subscribeEnginePlaceableEvent("wof-engine-placeable-network-snapshot", handleNetworkSnapshot);
    return () => {
      unsubscribePreview();
      unsubscribePreviewClear();
      unsubscribeClear();
      unsubscribeDelete();
      unsubscribeRequest();
      unsubscribeListRequest();
      unsubscribeSlotListRequest();
      unsubscribeSlotSave();
      unsubscribeSlotLoad();
      unsubscribeSlotDelete();
      unsubscribeNetworkUpsert();
      unsubscribeNetworkDelete();
      unsubscribeNetworkSnapshot();
    };
  }, [isSurvivalMode, objects]);

  if (objects.length === 0 && !preview) return null;

  return (
    <group name="engine-placed-objects">
      {preview && <EnginePlacementPreviewVisual preview={preview} />}
      {objects.map((object) => (
        <EnginePlacedObjectVisual key={object.instanceId} object={object} />
      ))}
    </group>
  );
}
