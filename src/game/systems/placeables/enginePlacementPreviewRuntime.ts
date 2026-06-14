import type { EnginePlacementPreview } from "./EnginePlacedObjectVisuals";
import type { PlaceableDefinition } from "./placeableCatalog";
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
