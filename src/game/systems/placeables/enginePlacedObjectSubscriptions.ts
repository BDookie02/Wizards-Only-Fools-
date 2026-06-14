import { subscribeEnginePlaceableEvent } from "./enginePlaceableEvents";
import type {
  EnginePlaceableNetworkDeleteDetail,
  EnginePlaceableNetworkSnapshotDetail,
  EnginePlaceableNetworkUpsertDetail,
} from "./enginePlacedObjectNetworkRuntime";
import type { EnginePlaceableRequestDetail } from "./placementRules";

export type EnginePlacedObjectDeleteDetail = {
  instanceId?: string;
};

export type EnginePlacedObjectSlotActionDetail = {
  slotId?: string;
  label?: string;
};

export type EnginePlacedObjectRuntimeEventHandlers = {
  onPreviewRequest: (event: { detail: EnginePlaceableRequestDetail | undefined }) => void;
  onPreviewClear: () => void;
  onClearPlacedObjects: () => void;
  onDeletePlacedObject: (event: { detail: EnginePlacedObjectDeleteDetail | undefined }) => void;
  onPlaceableRequest: (event: { detail: EnginePlaceableRequestDetail | undefined }) => void;
  onPlacedObjectListRequest: () => void;
  onPlacedObjectSlotListRequest: () => void;
  onSavePlacedObjectSlot: (event: { detail: EnginePlacedObjectSlotActionDetail | undefined }) => void;
  onLoadPlacedObjectSlot: (event: { detail: EnginePlacedObjectSlotActionDetail | undefined }) => void;
  onDeletePlacedObjectSlot: (event: { detail: EnginePlacedObjectSlotActionDetail | undefined }) => void;
  onNetworkUpsert: (event: { detail: EnginePlaceableNetworkUpsertDetail | undefined }) => void;
  onNetworkDelete: (event: { detail: EnginePlaceableNetworkDeleteDetail | undefined }) => void;
  onNetworkSnapshot: (event: { detail: EnginePlaceableNetworkSnapshotDetail | undefined }) => void;
};

export function subscribeEnginePlacedObjectRuntimeEvents(handlers: EnginePlacedObjectRuntimeEventHandlers) {
  const unsubscribers = [
    subscribeEnginePlaceableEvent("wof-engine-placeable-preview", handlers.onPreviewRequest),
    subscribeEnginePlaceableEvent("wof-engine-placeable-preview-clear", handlers.onPreviewClear),
    subscribeEnginePlaceableEvent("wof-engine-placeable-clear", handlers.onClearPlacedObjects),
    subscribeEnginePlaceableEvent("wof-engine-placeable-delete", handlers.onDeletePlacedObject),
    subscribeEnginePlaceableEvent("wof-engine-placeable-request", handlers.onPlaceableRequest),
    subscribeEnginePlaceableEvent("wof-engine-placeable-list-request", handlers.onPlacedObjectListRequest),
    subscribeEnginePlaceableEvent("wof-engine-placeable-slot-list-request", handlers.onPlacedObjectSlotListRequest),
    subscribeEnginePlaceableEvent("wof-engine-placeable-slot-save", handlers.onSavePlacedObjectSlot),
    subscribeEnginePlaceableEvent("wof-engine-placeable-slot-load", handlers.onLoadPlacedObjectSlot),
    subscribeEnginePlaceableEvent("wof-engine-placeable-slot-delete", handlers.onDeletePlacedObjectSlot),
    subscribeEnginePlaceableEvent("wof-engine-placeable-network-upsert", handlers.onNetworkUpsert),
    subscribeEnginePlaceableEvent("wof-engine-placeable-network-delete", handlers.onNetworkDelete),
    subscribeEnginePlaceableEvent("wof-engine-placeable-network-snapshot", handlers.onNetworkSnapshot),
  ];

  return () => {
    for (let index = 0; index < unsubscribers.length; index += 1) {
      unsubscribers[index]();
    }
  };
}
