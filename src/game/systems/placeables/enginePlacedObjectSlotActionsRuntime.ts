import {
  deleteStoredEngineObjectSlot,
  getEnginePlacementSlotLabel,
  loadStoredEngineObjectsFromSlot,
  saveStoredEngineObjectSlot,
  type EnginePlacedObjectRecord,
  type EnginePlacedObjectSlotSummary,
} from "./enginePlacedObjectStorage";

type EnginePlacementStorageTarget = Parameters<typeof saveStoredEngineObjectSlot>[0];

export type EnginePlacedObjectSlotActionInput = {
  slotId?: unknown;
  label?: unknown;
} | undefined;

export type EnginePlacedObjectSlotSaveActionResult =
  | {
      ok: true;
      label: string;
      count: number;
      summary: EnginePlacedObjectSlotSummary;
    }
  | {
      ok: false;
      reason: string;
    };

export type EnginePlacedObjectSlotLoadActionResult =
  | {
      ok: true;
      label: string;
      count: number;
      objects: EnginePlacedObjectRecord[];
    }
  | {
      ok: false;
      label: string;
      reason: string;
    };

export type EnginePlacedObjectSlotDeleteActionResult =
  | {
      ok: true;
      label: string;
    }
  | {
      ok: false;
      label: string;
      reason: string;
    };

export function saveEnginePlacedObjectSlotAction(
  storage: EnginePlacementStorageTarget,
  detail: EnginePlacedObjectSlotActionInput,
  objects: EnginePlacedObjectRecord[]
): EnginePlacedObjectSlotSaveActionResult {
  const summary = saveStoredEngineObjectSlot(storage, detail?.slotId, detail?.label, objects);
  if (!summary) {
    return { ok: false, reason: "slot save failed" };
  }

  return {
    ok: true,
    label: `saved ${summary.label}`,
    count: summary.count,
    summary,
  };
}

export function loadEnginePlacedObjectSlotAction(
  storage: EnginePlacementStorageTarget,
  detail: EnginePlacedObjectSlotActionInput
): EnginePlacedObjectSlotLoadActionResult {
  const slotId = detail?.slotId;
  const label = getEnginePlacementSlotLabel(String(slotId ?? ""), detail?.label);
  const objects = loadStoredEngineObjectsFromSlot(storage, slotId);
  if (!objects) {
    return { ok: false, label, reason: `${label} is empty` };
  }

  return {
    ok: true,
    label: `loaded ${label}`,
    count: objects.length,
    objects,
  };
}

export function deleteEnginePlacedObjectSlotAction(
  storage: EnginePlacementStorageTarget,
  detail: EnginePlacedObjectSlotActionInput
): EnginePlacedObjectSlotDeleteActionResult {
  const slotId = detail?.slotId;
  const label = getEnginePlacementSlotLabel(String(slotId ?? ""), detail?.label);
  if (!deleteStoredEngineObjectSlot(storage, slotId)) {
    return { ok: false, label, reason: "slot delete failed" };
  }

  return { ok: true, label: `deleted ${label}` };
}
