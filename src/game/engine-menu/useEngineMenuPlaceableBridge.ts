import { useEffect, useState } from "react";
import { dispatchEnginePlaceableEvent, subscribeEnginePlaceableEvent } from "../systems/placeables/enginePlaceableEvents";
import {
  hasEnginePlacedObjectSummaryId,
  type EnginePlacedObjectSlotSummary,
  type EnginePlacedObjectSummary,
} from "./engineMenuRuntime";

type EnginePlaceableListDetail = {
  objects?: EnginePlacedObjectSummary[];
};

type EnginePlaceableSlotListDetail = {
  slots?: EnginePlacedObjectSlotSummary[];
};

export type EnginePlaceableResultDetail = {
  ok?: boolean;
  label?: string;
  reason?: string;
};

export function getEngineMenuPlacementStatusText(detail: EnginePlaceableResultDetail | undefined) {
  if (!detail) return "";
  return detail.ok
    ? `Placed: ${detail.label ?? "object"}`
    : `Blocked: ${detail.reason ?? "invalid area"}`;
}

export function useEngineMenuPlaceableBridge(open: boolean) {
  const [placedObjects, setPlacedObjects] = useState<EnginePlacedObjectSummary[]>([]);
  const [selectedPlacedObjectId, setSelectedPlacedObjectId] = useState("");
  const [placementStatus, setPlacementStatus] = useState("");
  const [slotSummaries, setSlotSummaries] = useState<EnginePlacedObjectSlotSummary[]>([]);

  useEffect(() => {
    if (!open) return undefined;
    const unsubscribeObjects = subscribeEnginePlaceableEvent<EnginePlaceableListDetail>(
      "wof-engine-placeable-list",
      (event) => {
        setPlacedObjects(event.detail?.objects ?? []);
      },
    );
    const unsubscribeSlots = subscribeEnginePlaceableEvent<EnginePlaceableSlotListDetail>(
      "wof-engine-placeable-slots",
      (event) => {
        setSlotSummaries(event.detail?.slots ?? []);
      },
    );
    dispatchEnginePlaceableEvent("wof-engine-placeable-list-request", { source: "engine-menu" });
    dispatchEnginePlaceableEvent("wof-engine-placeable-slot-list-request", { source: "engine-menu" });
    return () => {
      unsubscribeObjects();
      unsubscribeSlots();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    return subscribeEnginePlaceableEvent<EnginePlaceableResultDetail>(
      "wof-engine-placeable-result",
      (event) => {
        setPlacementStatus(getEngineMenuPlacementStatusText(event.detail));
      },
    );
  }, [open]);

  useEffect(() => {
    if (!selectedPlacedObjectId) return;
    if (!hasEnginePlacedObjectSummaryId(placedObjects, selectedPlacedObjectId)) {
      setSelectedPlacedObjectId("");
    }
  }, [placedObjects, selectedPlacedObjectId]);

  return {
    placedObjects,
    placementStatus,
    selectedPlacedObjectId,
    setSelectedPlacedObjectId,
    slotSummaries,
  };
}
