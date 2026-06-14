import type { EnginePlacementPreview } from "./EnginePlacedObjectVisuals";
import { findEnginePlacementCollision } from "./enginePlacementCollision";
import type { EnginePlacementPreviewResultDetail } from "./enginePlacedObjectPublishRuntime";
import type { EnginePlacedObjectRecord } from "./enginePlacedObjectStorage";
import { getPlaceableDefinition, type PlaceableDefinition } from "./placeableCatalog";
import {
  planEnginePlaceablePlacement,
  planTrainingSpellDummySpawn,
  type EnginePlaceableRequestDetail,
  type EnginePlacementPlayerSnapshot,
} from "./placementRules";

export type EngineGroundHeightResolver = (x: number, z: number) => number;

export function getInvalidEnginePlacementPreviewFallback(
  placeable: PlaceableDefinition,
  getGroundY: EngineGroundHeightResolver,
  detail: EnginePlaceableRequestDetail | undefined,
  playerSnapshot: EnginePlacementPlayerSnapshot,
  reason: string,
  y?: number,
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

export function planEnginePlacementPreview(
  placeable: PlaceableDefinition,
  getGroundY: EngineGroundHeightResolver,
  detail: EnginePlaceableRequestDetail | undefined,
  playerSnapshot: EnginePlacementPlayerSnapshot,
): EnginePlacementPreview {
  if (placeable.id === "training-spell-dummy") {
    const spawnPlan = planTrainingSpellDummySpawn(detail, playerSnapshot);
    if (spawnPlan.ok === false) {
      return getInvalidEnginePlacementPreviewFallback(placeable, getGroundY, detail, playerSnapshot, spawnPlan.reason);
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
    return getInvalidEnginePlacementPreviewFallback(placeable, getGroundY, detail, playerSnapshot, placementPlan.reason, placementPlan.y);
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

export type EnginePlacementPreviewActionResult = {
  preview: EnginePlacementPreview | null;
  result: EnginePlacementPreviewResultDetail;
};

export function planEnginePlacementPreviewAction(
  currentObjects: EnginePlacedObjectRecord[],
  getGroundY: EngineGroundHeightResolver,
  detail: EnginePlaceableRequestDetail | undefined,
  playerSnapshot: EnginePlacementPlayerSnapshot
): EnginePlacementPreviewActionResult {
  const placeableId = String(detail?.placeableId ?? "");
  const placeable = getPlaceableDefinition(placeableId);
  if (!placeable) {
    return {
      preview: null,
      result: { ok: false, reason: "unknown placeable" },
    };
  }

  const preview = planEnginePlacementPreview(placeable, getGroundY, detail, playerSnapshot);
  if (!preview.ok) {
    return { preview, result: preview };
  }

  const collision = findEnginePlacementCollision(
    placeable,
    preview.x,
    preview.z,
    currentObjects,
    detail?.replaceInstanceId,
    preview.yaw
  );
  if (!collision) {
    return { preview, result: preview };
  }

  const blockedPreview: EnginePlacementPreview = {
    ...preview,
    ok: false,
    reason: `overlaps ${collision.label}`,
  };
  return { preview: blockedPreview, result: blockedPreview };
}
