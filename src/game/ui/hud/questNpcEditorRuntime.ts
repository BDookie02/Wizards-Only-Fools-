import {
  makeQuestScriptPointId,
  type QuestNpcEditorTarget,
  type QuestNpcProgram,
  type QuestNpcRole,
  type QuestScriptPoint,
} from "../../../store/gameStore";

export const questNpcRoles: QuestNpcRole[] = ["villager", "quest-giver", "town-leader"];

export const questEventPresetButtons = [
  { label: "RANDOM SPELL", line: "unlockRandomLockedSpell" },
  { label: "BLINK", line: "unlockSpell blink" },
  { label: "START QUEST", line: "startQuest town_01_quest" },
  { label: "COMPLETE", line: "completeQuest town_01_quest" },
  { label: "FLAG", line: "setFlag town_01_quests=1" },
  { label: "DARREL GROVE", line: "teleportQuestRealm darrel" },
  { label: "MESSAGE", line: "message Good work, wizard." },
] as const;

export type QuestEventBuilderKind = "message" | "startQuest" | "completeQuest" | "setFlag";

export function cloneQuestNpcProgram(program: QuestNpcProgram): QuestNpcProgram {
  const scriptPoints = new Array<QuestScriptPoint>(program.scriptPoints.length);
  for (let index = 0; index < program.scriptPoints.length; index += 1) {
    scriptPoints[index] = { ...program.scriptPoints[index] };
  }
  return {
    ...program,
    scriptPoints,
  };
}

export function getSelectedQuestScriptPoint(draft: QuestNpcProgram, selectedPointId: string | null) {
  for (let index = 0; index < draft.scriptPoints.length; index += 1) {
    const point = draft.scriptPoints[index];
    if (point.id === selectedPointId) return point;
  }
  return draft.scriptPoints[0];
}

export function getQuestScriptPointIndex(draft: QuestNpcProgram, point: QuestScriptPoint | undefined) {
  return point ? draft.scriptPoints.indexOf(point) : -1;
}

export function countQuestScriptPointEvents(point: QuestScriptPoint | undefined) {
  if (!point) return 0;
  let count = 0;
  let lineHasText = false;
  for (let index = 0; index < point.eventScript.length; index += 1) {
    const char = point.eventScript[index];
    if (char === "\n" || char === "\r") {
      if (lineHasText) count += 1;
      lineHasText = false;
      if (char === "\r" && point.eventScript[index + 1] === "\n") index += 1;
      continue;
    }
    if (!/\s/.test(char)) lineHasText = true;
  }
  return lineHasText ? count + 1 : count;
}

export function createQuestScriptPoint(pointCount: number): QuestScriptPoint {
  return {
    id: makeQuestScriptPointId(),
    title: `Point ${pointCount + 1}`,
    dialog: "",
    eventScript: "",
  };
}

export function duplicateQuestScriptPoint(point: QuestScriptPoint): QuestScriptPoint {
  return {
    ...point,
    id: makeQuestScriptPointId(),
    title: `${point.title || "Point"} Copy`.slice(0, 48),
  };
}

export function insertQuestScriptPointAfter(
  draft: QuestNpcProgram,
  selectedPointId: string,
  nextPoint: QuestScriptPoint,
) {
  let selectedIndex = -1;
  for (let index = 0; index < draft.scriptPoints.length; index += 1) {
    if (draft.scriptPoints[index].id === selectedPointId) {
      selectedIndex = index;
      break;
    }
  }
  if (selectedIndex < 0) {
    const scriptPoints = new Array<QuestScriptPoint>(draft.scriptPoints.length + 1);
    for (let index = 0; index < draft.scriptPoints.length; index += 1) {
      scriptPoints[index] = draft.scriptPoints[index];
    }
    scriptPoints[draft.scriptPoints.length] = nextPoint;
    return {
      ...draft,
      scriptPoints,
    };
  }

  const scriptPoints = new Array<QuestScriptPoint>(draft.scriptPoints.length + 1);
  for (let index = 0; index <= selectedIndex; index += 1) {
    scriptPoints[index] = draft.scriptPoints[index];
  }
  scriptPoints[selectedIndex + 1] = nextPoint;
  for (let index = selectedIndex + 1; index < draft.scriptPoints.length; index += 1) {
    scriptPoints[index + 1] = draft.scriptPoints[index];
  }
  return {
    ...draft,
    scriptPoints,
  };
}

export function moveQuestScriptPointById(
  draft: QuestNpcProgram,
  selectedPointId: string,
  direction: -1 | 1,
) {
  let currentIndex = -1;
  for (let index = 0; index < draft.scriptPoints.length; index += 1) {
    if (draft.scriptPoints[index].id === selectedPointId) {
      currentIndex = index;
      break;
    }
  }
  const targetIndex = currentIndex + direction;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= draft.scriptPoints.length) {
    return draft;
  }

  const nextPoints = new Array<QuestScriptPoint>(draft.scriptPoints.length);
  for (let index = 0; index < draft.scriptPoints.length; index += 1) {
    nextPoints[index] = draft.scriptPoints[index];
  }
  const currentPoint = nextPoints[currentIndex];
  nextPoints[currentIndex] = nextPoints[targetIndex];
  nextPoints[targetIndex] = currentPoint;
  return { ...draft, scriptPoints: nextPoints };
}

export function appendQuestEventScriptLine(currentScript: string, line: string) {
  const cleanedLine = line.trim();
  if (!cleanedLine) return currentScript;
  const trimmedScript = currentScript.trimEnd();
  return trimmedScript ? `${trimmedScript}\n${cleanedLine}` : cleanedLine;
}

export function buildQuestEventLine(
  kind: QuestEventBuilderKind,
  options: { message: string; questId: string; flag: string },
) {
  if (kind === "message") {
    return `message ${options.message.trim() || "Good work, wizard."}`;
  }
  if (kind === "setFlag") {
    return `setFlag ${options.flag.trim() || "town_01_quests=1"}`;
  }
  return `${kind} ${options.questId.trim() || "town_01_quest"}`;
}

export function removeQuestScriptPointById(
  draft: QuestNpcProgram,
  selectedPointId: string,
  selectedIndex: number,
) {
  if (draft.scriptPoints.length <= 1) return null;
  const nextPoints: QuestScriptPoint[] = [];
  for (let index = 0; index < draft.scriptPoints.length; index += 1) {
    const point = draft.scriptPoints[index];
    if (point.id !== selectedPointId) nextPoints.push(point);
  }
  return {
    scriptPoints: nextPoints,
    nextSelectedPointId: nextPoints[Math.max(0, selectedIndex - 1)]?.id ?? nextPoints[0]?.id ?? null,
  };
}

export function sanitizeQuestNpcProgramDraft(
  draft: QuestNpcProgram,
  target: QuestNpcEditorTarget,
): QuestNpcProgram {
  const cleanedName = draft.displayName.trim() || target.defaultName;
  const cleanedGreeting = draft.greeting.trim();
  const cleanedPoints = new Array<QuestScriptPoint>(draft.scriptPoints.length);
  for (let index = 0; index < draft.scriptPoints.length; index += 1) {
    const point = draft.scriptPoints[index];
    cleanedPoints[index] = {
      ...point,
      title: point.title.trim() || `Point ${index + 1}`,
      dialog: point.dialog.trim(),
      eventScript: point.eventScript.trim(),
    };
  }

  return {
    ...draft,
    displayName: cleanedName,
    greeting: cleanedGreeting,
    scriptPoints: cleanedPoints,
    updatedAt: Date.now(),
  };
}

export function getQuestDialogPreviewLine(
  selectedPoint: QuestScriptPoint,
  greeting: string,
) {
  return selectedPoint.dialog || greeting || "Need something, wizard?";
}

export function formatQuestScriptPointEventSummary(
  selectedPoint: QuestScriptPoint,
  selectedIndex: number,
  eventCount: number,
) {
  return `${selectedPoint.title || `Point ${selectedIndex + 1}`} - ${eventCount} event${eventCount === 1 ? "" : "s"}`;
}
