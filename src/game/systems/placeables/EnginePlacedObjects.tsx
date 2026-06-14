import { useEffect, useRef, useState } from "react";
import {
  emitEnginePlaceableNetworkDelete,
  emitEnginePlaceableNetworkSnapshot,
  emitEnginePlaceableNetworkUpsert,
} from "../../network/gameNetworkClient";
import {
  getLastKnownLocalPlayerPosition,
  getPublishedLastPlayerYaw,
} from "../player/playerEventBridge";
import { makeRuntimeRandomId } from "../random/runtimeRandom";
import { getBaseVillageTerrainHeight } from "../world/terrain/BaseVillageTerrain";
import { getSurvivalGrassSurfaceHeightAtWorld } from "../world/survival/survivalGrassSurface";
import { dispatchEnginePlaceableEvent, subscribeEnginePlaceableEvent } from "./enginePlaceableEvents";
import { findEnginePlacementCollision } from "./enginePlacementCollision";
import {
  appendEnginePlacedObjectBounded,
  cloneEnginePlacedObjects,
  findEnginePlacedObjectById,
  hasEnginePlacedObjectId,
  removeEnginePlacedObjectById,
  replaceEnginePlacedObjectById,
} from "./enginePlacedObjectListRuntime";
import {
  EnginePlacedObjectVisual,
  EnginePlacementPreviewVisual,
  type EnginePlacementPreview,
} from "./EnginePlacedObjectVisuals";
import {
  normalizeReplicatedEnginePlacedObject,
  type EnginePlaceableNetworkDeleteDetail,
  type EnginePlaceableNetworkSnapshotDetail,
  type EnginePlaceableNetworkUpsertDetail,
} from "./enginePlacedObjectNetworkRuntime";
import { planEnginePlacementPreview } from "./enginePlacementPreviewRuntime";
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
import { getPlaceableDefinition } from "./placeableCatalog";
import {
  planEnginePlaceablePlacement,
  planTrainingSpellDummySpawn,
  type EnginePlaceableRequestDetail,
} from "./placementRules";

type EnginePlacedObject = EnginePlacedObjectRecord;

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

export function EnginePlacedObjects({ isSurvivalMode }: { isSurvivalMode: boolean }) {
  const [objects, setObjects] = useState<EnginePlacedObject[]>(() => loadStoredEngineObjects(getEnginePlacementStorage()));
  const [preview, setPreview] = useState<EnginePlacementPreview | null>(null);
  const objectsRef = useRef(objects);
  const appliedNetworkSnapshotAtRef = useRef(0);

  const commitEnginePlacedObjects = (nextObjects: EnginePlacedObject[]) => {
    objectsRef.current = nextObjects;
    setObjects(nextObjects);
  };

  useEffect(() => {
    objectsRef.current = objects;
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
        const collision = findEnginePlacementCollision(placeable, previewPlan.x, previewPlan.z, objectsRef.current, detail?.replaceInstanceId, previewPlan.yaw);
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
      commitEnginePlacedObjects([]);
      publishEnginePlacementResult({ ok: true, label: "cleared placements", count: 0 });
      emitEnginePlaceableNetworkSnapshot([]);
    };
    const handleDeletePlacedObject = (event: { detail: { instanceId?: string } | undefined }) => {
      const instanceId = String(event.detail?.instanceId ?? "");
      if (!instanceId) {
        publishEnginePlacementResult({ ok: false, reason: "missing placed object" });
        return;
      }
      const currentObjects = objectsRef.current;
      const object = findEnginePlacedObjectById(currentObjects, instanceId);
      if (!object) {
        publishEnginePlacementResult({ ok: false, reason: "placed object not found" });
        return;
      }
      commitEnginePlacedObjects(removeEnginePlacedObjectById(currentObjects, instanceId));
      publishEnginePlacementResult({ ok: true, label: `deleted ${object.label}`, count: Math.max(0, currentObjects.length - 1) });
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

      const currentObjects = objectsRef.current;
      const collision = findEnginePlacementCollision(placeable, placementPlan.x, placementPlan.z, currentObjects, detail?.replaceInstanceId, placementPlan.yaw);
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
        instanceId: detail?.replaceInstanceId || makeRuntimeRandomId(`engine-${placeable.id}`, 5),
        placeableId: placeable.id,
        label: placeable.name,
        x: placementPlan.x,
        y: placementPlan.y,
        z: placementPlan.z,
        yaw: placementPlan.yaw,
      };
      const replaceInstanceId = detail?.replaceInstanceId;
      const replacingObject = Boolean(replaceInstanceId && hasEnginePlacedObjectId(currentObjects, replaceInstanceId));
      const nextObjects = replacingObject
        ? replaceEnginePlacedObjectById(currentObjects, String(replaceInstanceId), object)
        : appendEnginePlacedObjectBounded(currentObjects, object);
      commitEnginePlacedObjects(nextObjects);
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
        count: replacingObject ? currentObjects.length : Math.min(currentObjects.length + 1, MAX_ENGINE_PLACED_OBJECTS),
      });
      emitEnginePlaceableNetworkUpsert(object);
    };
    const handlePlacedObjectListRequest = () => {
      publishEnginePlacedObjectList(objectsRef.current);
    };
    const handlePlacedObjectSlotListRequest = () => {
      publishEnginePlacedObjectSlotList();
    };
    const handleSavePlacedObjectSlot = (event: { detail: { slotId?: string; label?: string } | undefined }) => {
      const summary = saveStoredEngineObjectSlot(
        getEnginePlacementStorage(),
        event.detail?.slotId,
        event.detail?.label,
        objectsRef.current
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
      commitEnginePlacedObjects(loadedObjects);
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
      const currentObjects = objectsRef.current;
      const nextObjects = hasEnginePlacedObjectId(currentObjects, object.instanceId)
        ? replaceEnginePlacedObjectById(currentObjects, object.instanceId, object)
        : appendEnginePlacedObjectBounded(currentObjects, object);
      commitEnginePlacedObjects(nextObjects);
      publishEnginePlacementResult({ ok: true, label: `synced ${object.label}` });
    };
    const handleNetworkDelete = (event: { detail: EnginePlaceableNetworkDeleteDetail | undefined }) => {
      const instanceId = String(event.detail?.instanceId ?? "");
      if (!instanceId) return;
      const currentObjects = objectsRef.current;
      const object = findEnginePlacedObjectById(currentObjects, instanceId);
      if (!object) return;
      commitEnginePlacedObjects(removeEnginePlacedObjectById(currentObjects, instanceId));
      publishEnginePlacementResult({ ok: true, label: `synced delete ${object.label}` });
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
      commitEnginePlacedObjects(nextObjects);
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
  }, [isSurvivalMode]);

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
