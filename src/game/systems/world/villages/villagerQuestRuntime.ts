import {
  createDefaultQuestNpcProgram,
  type QuestFlagValue,
  type QuestNpcAssignment,
  type QuestNpcEditorTarget,
  type QuestNpcProgram,
} from "../../../../store/gameStore";
import { type HutInfo } from "./baseVillageHutLayout";
import { makeVillagerCharacter, type VillagerInfo } from "./villagerCharacterRuntime";
import { getVillagerRuntimeNowMs } from "./villagerRuntime";

export type AnchoredQuestNpcProgram = QuestNpcProgram & {
  position: [number, number, number];
};

export const DARREL_REWARD_SPELL = "healingcrystals";
export const DARREL_ACCEPTED_FLAG = "darrel:healingcrystals:accepted";

function getDefaultVillagerName(hut: HutInfo, index: number) {
  const townPrefix = hut.villagerTheme === "egyptian"
    ? "Dune"
    : hut.villagerTheme === "swamp"
      ? "Marsh"
      : "Town";
  return `${townPrefix} Villager ${index + 1}`;
}

export function isDarrelName(value?: string | null) {
  if (!value) return false;
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalized === "darrel" || normalized === "darrell" || normalized.includes("darrel") || normalized.includes("darrell");
}

function isQuestFlagTruthy(value: QuestFlagValue | undefined) {
  return value === true || value === "true" || value === "completed" || value === "ready" || value === "1";
}

export function isDarrelQuestAssignment(
  assignment: QuestNpcAssignment | undefined,
  questFlags: Record<string, QuestFlagValue>,
) {
  if (!assignment || assignment.spell !== DARREL_REWARD_SPELL) return false;
  return isDarrelName(assignment.npcId) ||
    isDarrelName(assignment.displayName) ||
    isQuestFlagTruthy(questFlags[DARREL_ACCEPTED_FLAG]);
}

export function isDarrelVillagerIdentity({
  name,
  hut,
  programName,
  assignment,
  questFlags,
  fallbackDarrelId,
}: {
  name: string;
  hut: HutInfo;
  programName?: string;
  assignment?: QuestNpcAssignment;
  questFlags: Record<string, QuestFlagValue>;
  fallbackDarrelId?: string | null;
}) {
  return hut.id === fallbackDarrelId ||
    isDarrelName(programName) ||
    isDarrelName(assignment?.displayName) ||
    isDarrelName(name) ||
    isDarrelName(hut.id) ||
    isDarrelQuestAssignment(assignment, questFlags);
}

export function getQuestVillagerDisplayName(
  name: string,
  hut: HutInfo,
  index: number,
  programName?: string,
  assignment?: QuestNpcAssignment,
  questFlags: Record<string, QuestFlagValue> = {},
  fallbackDarrelId?: string | null,
) {
  if (isDarrelVillagerIdentity({ name, hut, programName, assignment, questFlags, fallbackDarrelId })) {
    return "Darrel";
  }
  return programName ?? assignment?.displayName ?? getDefaultVillagerName(hut, index);
}

export function getQuestTownId(name: string, hut: HutInfo) {
  if (name && name !== "villagers") return name;
  return hut.villagerTheme ? `${hut.villagerTheme}-town` : "base-village";
}

export function hasQuestNpcAnchor(program: QuestNpcProgram | undefined): program is AnchoredQuestNpcProgram {
  return Array.isArray(program?.position) &&
    program.position.length === 3 &&
    program.position.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate));
}

function normalizeQuestNpcTheme(theme?: string): HutInfo["villagerTheme"] {
  if (theme === "egyptian" || theme === "swamp") return theme;
  return "village";
}

export function makeQuestNpcEditorTarget(
  name: string,
  villager: VillagerInfo,
  defaultName: string,
): QuestNpcEditorTarget {
  return {
    npcId: villager.id,
    townId: getQuestTownId(name, villager.hut),
    hutId: villager.hut.id,
    defaultName,
    theme: villager.hut.villagerTheme ?? "village",
    position: [villager.x, villager.y, villager.z],
  };
}

export function anchorQuestNpcProgram(
  existingProgram: QuestNpcProgram | undefined,
  target: QuestNpcEditorTarget,
) {
  const baseProgram = existingProgram ?? createDefaultQuestNpcProgram(target);
  return {
    ...baseProgram,
    npcId: target.npcId,
    townId: target.townId,
    hutId: target.hutId,
    theme: target.theme,
    position: target.position,
    updatedAt: getVillagerRuntimeNowMs(),
  };
}

function makePersistentQuestNpcHut(program: AnchoredQuestNpcProgram): HutInfo {
  const [x, y, z] = program.position;
  return {
    id: program.hutId ?? program.npcId,
    x,
    y: y - 0.95,
    z,
    hutType: 90,
    colorIndex: 0,
    rotation: 0,
    hasPath: false,
    pathRot: 0,
    isMushroom: false,
    interiorWidth: 9,
    interiorDepth: 9,
    interiorHeight: 8,
    villagerYOffset: 0.95,
    villagerTheme: normalizeQuestNpcTheme(program.theme),
  };
}

export function makePersistentQuestNpcVillager(program: AnchoredQuestNpcProgram, index: number): VillagerInfo {
  const [x, y, z] = program.position;
  const hut = makePersistentQuestNpcHut(program);
  return {
    id: program.npcId,
    hut,
    character: makeVillagerCharacter(hut, index),
    x,
    y,
    z,
    baseYaw: hut.rotation,
  };
}
