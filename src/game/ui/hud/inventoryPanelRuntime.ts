import {
  INVENTORY_ITEM_DEFINITIONS,
  SPELL_QUEST_DEFINITIONS,
  type AvatarAnimation,
  type InventoryItemDefinition,
  type InventoryItemId,
  type InventoryRecord,
  type QuestFlagValue,
  type QuestNpcAssignment,
  type SpellType,
} from "../../../store/gameStore";

export const inventoryBackpackSlotCount = 27;
export const inventoryQuickSlotCount = 9;

export type InventoryHudPlayerState = {
  isMoving: boolean;
  isSprinting: boolean;
  isSliding: boolean;
  isCrouching: boolean;
  isGrounded: boolean;
  isMeditating: boolean;
};

export type InventoryControllerMoveDetail = {
  direction: 1 | -1;
};

export type ActiveQuestEntry = {
  assignment: QuestNpcAssignment;
  definition: NonNullable<ReturnType<typeof getQuestDefinitionForAssignment>>;
};

export type InventoryEntry = {
  definition: InventoryItemDefinition;
  quantity: number;
};

export type InventorySlotLayout = {
  backpackSlots: Array<InventoryEntry | null>;
  quickSlots: Array<InventoryEntry | null>;
};

export type InventoryQuestProgressRow = {
  label: string;
  done: boolean;
};

export type InventoryKeyboardAction =
  | { type: "toggle-quest-journal" }
  | { type: "move-quest"; direction: 1 | -1 }
  | { type: "open-quest-journal" }
  | { type: "close-quest-journal" }
  | { type: "close-inventory" };

type InventoryQuestDefinition = (typeof SPELL_QUEST_DEFINITIONS)[number];

type InventoryQuestDefinitionLookupEntry = {
  definition: InventoryQuestDefinition;
  index: number;
};

const inventoryItemOrder: readonly InventoryItemId[] = [
  "darrel-leaves",
  "darrel-berries",
  "darrel-roots",
  "garden-draught",
  "healing-crystals",
];

const questDefinitionById = new Map<string, InventoryQuestDefinitionLookupEntry>();
const questDefinitionBySpell = new Map<SpellType, InventoryQuestDefinitionLookupEntry>();

for (let index = 0; index < SPELL_QUEST_DEFINITIONS.length; index += 1) {
  const definition = SPELL_QUEST_DEFINITIONS[index];
  if (!questDefinitionById.has(definition.id)) {
    questDefinitionById.set(definition.id, { definition, index });
  }
  if (!questDefinitionBySpell.has(definition.spell)) {
    questDefinitionBySpell.set(definition.spell, { definition, index });
  }
}

export function getInventoryPreviewAnimation(playerState: InventoryHudPlayerState): AvatarAnimation {
  if (playerState.isMeditating) return "meditate";
  if (playerState.isSliding) return "slide";
  if (playerState.isCrouching) return playerState.isMoving ? "crouchwalk" : "crouch";
  if (!playerState.isGrounded) return "jump";
  if (playerState.isSprinting) return "sprint";
  if (playerState.isMoving) return "walk";
  return "holding";
}

export function isInventoryQuestFlagTruthy(value: QuestFlagValue | undefined) {
  return value === true || value === "true" || value === "completed" || value === "ready" || value === "1";
}

export function getQuestDefinitionForAssignment(assignment: QuestNpcAssignment) {
  const questIdMatch = questDefinitionById.get(assignment.questId);
  const spellMatch = questDefinitionBySpell.get(assignment.spell);
  if (!questIdMatch) return spellMatch?.definition ?? null;
  if (!spellMatch) return questIdMatch.definition;
  return questIdMatch.index <= spellMatch.index ? questIdMatch.definition : spellMatch.definition;
}

export function isQuestSpellAlreadyUnlocked(spells: readonly SpellType[], spell: SpellType) {
  for (const unlockedSpell of spells) {
    if (unlockedSpell === spell) return true;
  }
  return false;
}

export function getActiveInventoryQuestEntries(
  spellQuestAssignments: Record<string, QuestNpcAssignment>,
  questUnlockedSpells: readonly SpellType[],
) {
  const entries: ActiveQuestEntry[] = [];
  for (const assignmentId in spellQuestAssignments) {
    if (!Object.prototype.hasOwnProperty.call(spellQuestAssignments, assignmentId)) continue;
    const assignment = spellQuestAssignments[assignmentId];
    const definition = getQuestDefinitionForAssignment(assignment);
    if (
      !definition ||
      assignment.status === "completed" ||
      isQuestSpellAlreadyUnlocked(questUnlockedSpells, assignment.spell)
    ) {
      continue;
    }
    entries.push({ assignment, definition });
  }
  return entries;
}

export function getSelectedInventoryQuestEntry(entries: readonly ActiveQuestEntry[], selectedQuestIndex: number) {
  return entries[selectedQuestIndex] ?? entries[0] ?? null;
}

export function clampInventoryQuestIndex(index: number, count: number) {
  return Math.min(index, Math.max(0, count - 1));
}

export function getNextInventoryQuestIndex(index: number, direction: 1 | -1, count: number) {
  return count > 0 ? (index + direction + count) % count : 0;
}

export function getInventoryKeyboardAction(code: string, isQuestJournalOpen: boolean): InventoryKeyboardAction | null {
  if (code === "KeyJ") return { type: "toggle-quest-journal" };
  if (isQuestJournalOpen && (code === "ArrowDown" || code === "ArrowUp")) {
    return { type: "move-quest", direction: code === "ArrowDown" ? 1 : -1 };
  }
  if (code === "Enter" && !isQuestJournalOpen) return { type: "open-quest-journal" };
  if (code !== "Escape" && code !== "KeyI") return null;
  return { type: isQuestJournalOpen ? "close-quest-journal" : "close-inventory" };
}

export function getInventoryEntries(inventory: InventoryRecord) {
  const entries: InventoryEntry[] = [];
  for (const itemId of inventoryItemOrder) {
    const quantity = inventory[itemId]?.quantity ?? 0;
    if (quantity <= 0) continue;
    entries.push({ definition: INVENTORY_ITEM_DEFINITIONS[itemId], quantity });
  }
  return entries;
}

export function getInventorySlotLayout(entries: readonly InventoryEntry[]): InventorySlotLayout {
  const backpackSlots: Array<InventoryEntry | null> = new Array(inventoryBackpackSlotCount);
  const quickSlots: Array<InventoryEntry | null> = new Array(inventoryQuickSlotCount);
  for (let index = 0; index < inventoryBackpackSlotCount; index += 1) {
    backpackSlots[index] = entries[index] ?? null;
  }
  for (let index = 0; index < inventoryQuickSlotCount; index += 1) {
    quickSlots[index] = entries[inventoryBackpackSlotCount + index] ?? null;
  }
  return { backpackSlots, quickSlots };
}

export function getInventoryQuestStatus(
  entry: ActiveQuestEntry | null,
  questFlags: Record<string, QuestFlagValue>,
) {
  if (!entry) return "No active quest selected.";
  const requiredReady = isInventoryQuestFlagTruthy(questFlags[entry.definition.requiredFlag]);
  const questState = questFlags[`quest:${entry.definition.id}`];
  if (questState === "completed") return "Complete";
  if (requiredReady || questState === "ready") return "Ready to turn in";
  if (questState === "started" || entry.assignment.status === "assigned") return "In progress";
  return "Discovered";
}

export function getDarrelQuestProgressRows(questFlags: Record<string, QuestFlagValue>) {
  const rows: InventoryQuestProgressRow[] = [
    { label: "Leaves", done: isInventoryQuestStepDone(questFlags["darrel:ingredient:leaves"]) },
    { label: "Berries", done: isInventoryQuestStepDone(questFlags["darrel:ingredient:berries"]) },
    { label: "Roots", done: isInventoryQuestStepDone(questFlags["darrel:ingredient:roots"]) },
    { label: "Garden Draught", done: isInventoryQuestStepDone(questFlags["darrel:garden-draught"]) },
  ];
  return rows;
}

function isInventoryQuestStepDone(value: QuestFlagValue | undefined) {
  return value === "gathered" || value === "brewed" || value === "drunk" || isInventoryQuestFlagTruthy(value);
}
