import { dispatchEnginePlaceableEvent } from "./enginePlaceableEvents";
import { cloneEnginePlacedObjects } from "./enginePlacedObjectListRuntime";
import type { EnginePlaceableNetworkSnapshotDetail } from "./enginePlacedObjectNetworkRuntime";
import {
  loadStoredEngineObjectSlotSummaries,
  type EnginePlacedObjectRecord,
  type EnginePlacedObjectSlotSummary,
} from "./enginePlacedObjectStorage";

export type EnginePlacementResultDetail = {
  ok: boolean;
  label?: string;
  reason?: string;
  count?: number;
};

export type EnginePlacementPreviewResultDetail = EnginePlacementResultDetail & {
  x?: number;
  y?: number;
  z?: number;
  yaw?: number;
  gridSize?: number;
  snapped?: boolean;
};

type EnginePlacedObjectListDetail = {
  objects: EnginePlacedObjectRecord[];
};

type EnginePlacedObjectSlotListDetail = {
  slots: EnginePlacedObjectSlotSummary[];
};

export type WindowWithEnginePlaceables = Window & {
  wofEnginePlacedObjectCount?: number;
  wofEnginePlacedObjectSummary?: EnginePlacedObjectRecord[];
  wofEnginePlacedObjectSlots?: EnginePlacedObjectSlotSummary[];
  wofEnginePlaceableNetworkSnapshot?: EnginePlaceableNetworkSnapshotDetail;
  wofEnginePlacementPreview?: EnginePlacementPreviewResultDetail | null;
};

export function getEnginePlacementStorage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

export function publishEnginePlacementResult(detail: EnginePlacementResultDetail) {
  dispatchEnginePlaceableEvent("wof-engine-placeable-result", detail);
}

export function publishEnginePlacementPreviewResult(detail: EnginePlacementPreviewResultDetail) {
  const playerWindow = window as WindowWithEnginePlaceables;
  playerWindow.wofEnginePlacementPreview = detail;
  dispatchEnginePlaceableEvent("wof-engine-placeable-preview-result", detail);
}

export function publishEnginePlacedObjectList(objects: EnginePlacedObjectRecord[]) {
  const playerWindow = window as WindowWithEnginePlaceables;
  const summary = cloneEnginePlacedObjects(objects);
  playerWindow.wofEnginePlacedObjectCount = summary.length;
  playerWindow.wofEnginePlacedObjectSummary = summary;
  dispatchEnginePlaceableEvent<EnginePlacedObjectListDetail>("wof-engine-placeable-list", { objects: summary });
}

export function publishEnginePlacedObjectSlotList() {
  const playerWindow = window as WindowWithEnginePlaceables;
  const slots = loadStoredEngineObjectSlotSummaries(getEnginePlacementStorage());
  playerWindow.wofEnginePlacedObjectSlots = slots;
  dispatchEnginePlaceableEvent<EnginePlacedObjectSlotListDetail>("wof-engine-placeable-slots", { slots });
}
