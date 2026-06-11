import { dispatchEnginePlaceableEvent } from "../../systems/placeables/enginePlaceableEvents";

export type EnginePlaceableSelection = { id: string };

export type EnginePlaceableOptions = {
  source?: string;
  snapToGrid?: boolean;
  gridSize?: number;
  yaw?: number;
  x?: number;
  y?: number;
  z?: number;
  replaceInstanceId?: string;
};

export type EnginePlacedObjectSelection = {
  instanceId: string;
  placeableId: string;
  label: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
};

export function buildHudEnginePlaceableDetail(placeable: EnginePlaceableSelection | string, options?: EnginePlaceableOptions) {
  const placeableId = typeof placeable === "string" ? placeable : placeable.id;
  if (!placeableId) return null;

  return {
    placeableId,
    source: options?.source ?? "hud",
    snapToGrid: options?.snapToGrid,
    gridSize: options?.gridSize,
    yaw: options?.yaw,
    x: options?.x,
    y: options?.y,
    z: options?.z,
    replaceInstanceId: options?.replaceInstanceId,
  };
}

export function previewHudEnginePlaceable(
  placeable: EnginePlaceableSelection | string,
  options: EnginePlaceableOptions | undefined,
  setSelectedId: (placeableId: string) => void,
) {
  const detail = buildHudEnginePlaceableDetail(placeable, options);
  if (!detail) return false;

  setSelectedId(detail.placeableId);
  dispatchEnginePlaceableEvent("wof-engine-placeable-preview", detail);
  return true;
}

export function requestHudEnginePlaceable(
  placeable: EnginePlaceableSelection | string,
  options: EnginePlaceableOptions | undefined,
  setSelectedId: (placeableId: string) => void,
) {
  const detail = buildHudEnginePlaceableDetail(placeable, options);
  if (!detail) return false;

  setSelectedId(detail.placeableId);
  dispatchEnginePlaceableEvent("wof-engine-placeable-request", detail);
  return true;
}

export function clearHudEnginePlaceables() {
  dispatchEnginePlaceableEvent("wof-engine-placeable-clear", { source: "hud" });
}

export function previewHudEnginePlacedObject(
  object: EnginePlacedObjectSelection,
  options: EnginePlaceableOptions | undefined,
  setSelectedId: (placeableId: string) => void,
) {
  return previewHudEnginePlaceable(
    object.placeableId,
    {
      ...options,
      source: options?.source ?? "hud-edit",
      x: options?.x ?? object.x,
      y: options?.y ?? object.y,
      z: options?.z ?? object.z,
      yaw: options?.yaw ?? object.yaw,
      replaceInstanceId: object.instanceId,
    },
    setSelectedId,
  );
}

export function moveHudEnginePlacedObject(
  object: EnginePlacedObjectSelection,
  options: EnginePlaceableOptions | undefined,
  setSelectedId: (placeableId: string) => void,
) {
  return requestHudEnginePlaceable(
    object.placeableId,
    {
      ...options,
      source: options?.source ?? "hud-edit",
      replaceInstanceId: object.instanceId,
    },
    setSelectedId,
  );
}

export function deleteHudEnginePlacedObject(instanceId: string) {
  if (!instanceId) return false;
  dispatchEnginePlaceableEvent("wof-engine-placeable-delete", { instanceId, source: "hud-edit" });
  return true;
}
