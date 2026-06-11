import type { QuestNpcEditorTarget } from "../../../store/gameStore";

export function isQuestNpcEditorTarget(value: unknown): value is QuestNpcEditorTarget {
  if (typeof value !== "object" || value === null) return false;
  const target = value as Partial<QuestNpcEditorTarget>;
  return typeof target.npcId === "string" &&
    typeof target.townId === "string" &&
    typeof target.hutId === "string" &&
    typeof target.defaultName === "string" &&
    Array.isArray(target.position) &&
    target.position.length === 3 &&
    target.position.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate));
}
