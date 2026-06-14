import { makeRuntimeRandomId } from "../random/runtimeRandom";
import { findEnginePlacementCollision } from "./enginePlacementCollision";
import {
  appendEnginePlacedObjectBounded,
  hasEnginePlacedObjectId,
  replaceEnginePlacedObjectById,
} from "./enginePlacedObjectListRuntime";
import type { EnginePlacementPreview } from "./EnginePlacedObjectVisuals";
import {
  MAX_ENGINE_PLACED_OBJECTS,
  type EnginePlacedObjectRecord,
} from "./enginePlacedObjectStorage";
import { getPlaceableDefinition } from "./placeableCatalog";
import {
  planEnginePlaceablePlacement,
  planTrainingSpellDummySpawn,
  type EngineGroundHeightResolver,
  type EnginePlaceableRequestDetail,
  type EnginePlacementPlayerSnapshot,
  type EngineTrainingDummySpawnPlan,
} from "./placementRules";

type EnginePlacementActionResultDetail = {
  ok: boolean;
  label?: string;
  reason?: string;
  count?: number;
};

type EngineTrainingDummySpawn = Extract<EngineTrainingDummySpawnPlan, { ok: true }>;

export type EnginePlacedObjectPlacementActionResult =
  | {
      kind: "error";
      result: EnginePlacementActionResultDetail & { ok: false };
      preview?: EnginePlacementPreview;
    }
  | {
      kind: "training-dummy";
      result: EnginePlacementActionResultDetail & { ok: true; label: string };
      spawn: EngineTrainingDummySpawn;
    }
  | {
      kind: "place-object";
      result: EnginePlacementActionResultDetail & { ok: true; label: string; count: number };
      object: EnginePlacedObjectRecord;
      objects: EnginePlacedObjectRecord[];
      preview: EnginePlacementPreview;
    };

export function planEnginePlacedObjectPlacementAction(
  currentObjects: EnginePlacedObjectRecord[],
  getGroundY: EngineGroundHeightResolver,
  detail: EnginePlaceableRequestDetail | undefined,
  playerSnapshot: EnginePlacementPlayerSnapshot
): EnginePlacedObjectPlacementActionResult {
  const placeableId = String(detail?.placeableId ?? "");
  const placeable = getPlaceableDefinition(placeableId);
  if (!placeable) {
    return { kind: "error", result: { ok: false, reason: "unknown placeable" } };
  }

  if (placeable.id === "training-spell-dummy") {
    const spawn = planTrainingSpellDummySpawn(detail, playerSnapshot);
    if (spawn.ok === false) {
      return {
        kind: "error",
        result: { ok: false, label: placeable.name, reason: spawn.reason },
      };
    }
    return {
      kind: "training-dummy",
      result: { ok: true, label: placeable.name },
      spawn,
    };
  }

  const placementPlan = planEnginePlaceablePlacement(placeable, getGroundY, detail, playerSnapshot);
  if (placementPlan.ok === false) {
    return {
      kind: "error",
      result: { ok: false, label: placeable.name, reason: placementPlan.reason },
    };
  }

  const collision = findEnginePlacementCollision(
    placeable,
    placementPlan.x,
    placementPlan.z,
    currentObjects,
    detail?.replaceInstanceId,
    placementPlan.yaw
  );
  if (collision) {
    const reason = `overlaps ${collision.label}`;
    return {
      kind: "error",
      result: { ok: false, label: placeable.name, reason },
      preview: {
        ok: false,
        placeableId: placeable.id,
        label: placeable.name,
        x: placementPlan.x,
        y: placementPlan.y,
        z: placementPlan.z,
        yaw: placementPlan.yaw,
        gridSize: placementPlan.gridSize,
        snapped: placementPlan.snapped,
        reason,
      },
    };
  }

  const object: EnginePlacedObjectRecord = {
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
  const objects = replacingObject
    ? replaceEnginePlacedObjectById(currentObjects, String(replaceInstanceId), object)
    : appendEnginePlacedObjectBounded(currentObjects, object);

  return {
    kind: "place-object",
    result: {
      ok: true,
      label: replacingObject ? `moved ${placeable.name}` : placeable.name,
      count: replacingObject ? currentObjects.length : Math.min(currentObjects.length + 1, MAX_ENGINE_PLACED_OBJECTS),
    },
    object,
    objects,
    preview: {
      ok: true,
      placeableId: placeable.id,
      label: placeable.name,
      x: placementPlan.x,
      y: placementPlan.y,
      z: placementPlan.z,
      yaw: placementPlan.yaw,
      gridSize: placementPlan.gridSize,
      snapped: placementPlan.snapped,
    },
  };
}
