import { useEffect, useRef, useState } from "react";
import {
  emitEnginePlaceableNetworkDelete,
  emitEnginePlaceableNetworkSnapshot,
  emitEnginePlaceableNetworkUpsert,
} from "../../network/gameNetworkClient";
import { makeRuntimeRandomId } from "../random/runtimeRandom";
import { dispatchEnginePlaceableEvent } from "./enginePlaceableEvents";
import { findEnginePlacementCollision } from "./enginePlacementCollision";
import {
  appendEnginePlacedObjectBounded,
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
  applyReplicatedEnginePlacedObjectDelete,
  applyReplicatedEnginePlacedObjectSnapshot,
  applyReplicatedEnginePlacedObjectUpsert,
  type EnginePlaceableNetworkDeleteDetail,
  type EnginePlaceableNetworkSnapshotDetail,
  type EnginePlaceableNetworkUpsertDetail,
} from "./enginePlacedObjectNetworkRuntime";
import {
  deleteEnginePlacedObjectSlotAction,
  loadEnginePlacedObjectSlotAction,
  saveEnginePlacedObjectSlotAction,
} from "./enginePlacedObjectSlotActionsRuntime";
import {
  getEnginePlacementStorage,
  publishEnginePlacedObjectList,
  publishEnginePlacedObjectSlotList,
  publishEnginePlacementPreviewResult,
  publishEnginePlacementResult,
  type WindowWithEnginePlaceables,
} from "./enginePlacedObjectPublishRuntime";
import {
  subscribeEnginePlacedObjectRuntimeEvents,
  type EnginePlacedObjectDeleteDetail,
  type EnginePlacedObjectSlotActionDetail,
} from "./enginePlacedObjectSubscriptions";
import { getEnginePlacementGroundResolver } from "./enginePlacementGroundRuntime";
import { getEnginePlacementPlayerSnapshot } from "./enginePlacementPlayerSnapshotRuntime";
import { planEnginePlacementPreview } from "./enginePlacementPreviewRuntime";
import {
  MAX_ENGINE_PLACED_OBJECTS,
  loadStoredEngineObjects,
  saveStoredEngineObjects,
  type EnginePlacedObjectRecord,
} from "./enginePlacedObjectStorage";
import { getPlaceableDefinition } from "./placeableCatalog";
import {
  planEnginePlaceablePlacement,
  planTrainingSpellDummySpawn,
  type EnginePlaceableRequestDetail,
} from "./placementRules";

type EnginePlacedObject = EnginePlacedObjectRecord;

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
    const getGroundY = getEnginePlacementGroundResolver(isSurvivalMode);
    const handlePreviewRequest = (event: { detail: EnginePlaceableRequestDetail | undefined }) => {
      const detail = event.detail;
      const placeableId = String(detail?.placeableId ?? "");
      const placeable = getPlaceableDefinition(placeableId);
      if (!placeable) {
        setPreview(null);
        publishEnginePlacementPreviewResult({ ok: false, reason: "unknown placeable" });
        return;
      }

      const playerSnapshot = getEnginePlacementPlayerSnapshot(detail);
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
    const handleDeletePlacedObject = (event: { detail: EnginePlacedObjectDeleteDetail | undefined }) => {
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

      const playerSnapshot = getEnginePlacementPlayerSnapshot(detail);

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
    const handleSavePlacedObjectSlot = (event: { detail: EnginePlacedObjectSlotActionDetail | undefined }) => {
      const result = saveEnginePlacedObjectSlotAction(getEnginePlacementStorage(), event.detail, objectsRef.current);
      if (result.ok === false) {
        publishEnginePlacementResult({ ok: false, reason: result.reason });
        return;
      }
      publishEnginePlacementResult({ ok: true, label: result.label, count: result.count });
      publishEnginePlacedObjectSlotList();
    };
    const handleLoadPlacedObjectSlot = (event: { detail: EnginePlacedObjectSlotActionDetail | undefined }) => {
      const result = loadEnginePlacedObjectSlotAction(getEnginePlacementStorage(), event.detail);
      if (result.ok === false) {
        publishEnginePlacementResult({ ok: false, reason: result.reason });
        publishEnginePlacedObjectSlotList();
        return;
      }
      commitEnginePlacedObjects(result.objects);
      setPreview(null);
      publishEnginePlacementResult({ ok: true, label: result.label, count: result.count });
      publishEnginePlacedObjectSlotList();
      emitEnginePlaceableNetworkSnapshot(result.objects);
    };
    const handleDeletePlacedObjectSlot = (event: { detail: EnginePlacedObjectSlotActionDetail | undefined }) => {
      const result = deleteEnginePlacedObjectSlotAction(getEnginePlacementStorage(), event.detail);
      if (result.ok === false) {
        publishEnginePlacementResult({ ok: false, reason: result.reason });
        return;
      }
      publishEnginePlacementResult({ ok: true, label: result.label });
      publishEnginePlacedObjectSlotList();
    };
    const handleNetworkUpsert = (event: { detail: EnginePlaceableNetworkUpsertDetail | undefined }) => {
      const result = applyReplicatedEnginePlacedObjectUpsert(objectsRef.current, event.detail);
      if (result.ok === false) return;
      commitEnginePlacedObjects(result.objects);
      publishEnginePlacementResult({ ok: true, label: `synced ${result.object.label}` });
    };
    const handleNetworkDelete = (event: { detail: EnginePlaceableNetworkDeleteDetail | undefined }) => {
      const result = applyReplicatedEnginePlacedObjectDelete(objectsRef.current, event.detail);
      if (result.ok === false) return;
      commitEnginePlacedObjects(result.objects);
      publishEnginePlacementResult({ ok: true, label: `synced delete ${result.object.label}` });
    };
    const handleNetworkSnapshot = (event: { detail: EnginePlaceableNetworkSnapshotDetail | undefined }) => {
      const result = applyReplicatedEnginePlacedObjectSnapshot(event.detail);
      if (Number.isFinite(result.receivedAt)) {
        appliedNetworkSnapshotAtRef.current = Number(result.receivedAt);
      }
      commitEnginePlacedObjects(result.objects);
      setPreview(null);
      publishEnginePlacementResult({ ok: true, label: "synced placement snapshot", count: result.objects.length });
    };
    const pendingNetworkSnapshot = (window as WindowWithEnginePlaceables).wofEnginePlaceableNetworkSnapshot;
    if (
      Number.isFinite(pendingNetworkSnapshot?.receivedAt) &&
      Number(pendingNetworkSnapshot?.receivedAt) !== appliedNetworkSnapshotAtRef.current
    ) {
      handleNetworkSnapshot({ detail: pendingNetworkSnapshot });
    }

    return subscribeEnginePlacedObjectRuntimeEvents({
      onPreviewRequest: handlePreviewRequest,
      onPreviewClear: handlePreviewClear,
      onClearPlacedObjects: handleClearPlacedObjects,
      onDeletePlacedObject: handleDeletePlacedObject,
      onPlaceableRequest: handlePlaceableRequest,
      onPlacedObjectListRequest: handlePlacedObjectListRequest,
      onPlacedObjectSlotListRequest: handlePlacedObjectSlotListRequest,
      onSavePlacedObjectSlot: handleSavePlacedObjectSlot,
      onLoadPlacedObjectSlot: handleLoadPlacedObjectSlot,
      onDeletePlacedObjectSlot: handleDeletePlacedObjectSlot,
      onNetworkUpsert: handleNetworkUpsert,
      onNetworkDelete: handleNetworkDelete,
      onNetworkSnapshot: handleNetworkSnapshot,
    });
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
