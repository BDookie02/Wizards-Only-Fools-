import { create } from 'zustand';

export type SpellType = 'fireball' | 'iceshard' | 'arcanebeam' | 'healspell' | 'icespell' | 'ringsofpower' | 'lightning' | 'smokebomb' | 'portal' | 'blink' | 'grab' | 'tornado' | 'meteorshower' | 'flamethrower' | 'discshield' | 'orbshield' | 'kunai' | 'healingcrystals' | 'magicarmor' | 'jumpboost' | 'speedboost' | 'tungstonballsack' | 'sleep' | 'poison' | 'acid' | 'magicglassorb';
export type HandType = 'left' | 'right';
export type StatusEffectType = 'slow' | 'sleep' | 'poison' | 'acid';
export type ControllerButtonName = 'a' | 'b' | 'x' | 'y' | 'leftBumper' | 'rightBumper' | 'leftTrigger' | 'rightTrigger' | 'back' | 'start' | 'leftStick' | 'rightStick' | 'dpadUp' | 'dpadDown' | 'dpadLeft' | 'dpadRight';
export type ControllerAction = 'leftCast' | 'rightCast' | 'jump' | 'slide' | 'sprint' | 'inventory' | 'interact' | 'spellMenu' | 'map' | 'scoreboard' | 'pause' | 'menuSelect' | 'menuBack' | 'leftHotbar' | 'rightHotbar' | 'voicePushToTalk';
export type VoiceInputMode = 'openMic' | 'pushToTalk';
export type CharacterTopStyle = 'simple' | 'robe' | 'vest' | 'tunic';
export type CharacterPantsStyle = 'pants' | 'shorts' | 'skirt' | 'robe';
export type CharacterShoesStyle = 'boots' | 'shoes' | 'sandals' | 'barefoot';
export type CharacterHatStyle = 'none' | 'wizard' | 'floppy-wizard' | 'cap' | 'hood' | 'pharaoh';
export type CharacterHairStyle = 'none' | 'short' | 'bob' | 'spikes' | 'long';
export type CharacterFacialHairStyle = 'none' | 'mustache' | 'goatee' | 'beard';
export type CharacterEyeStyle = 'calm' | 'wide' | 'angry' | 'sleepy' | 'content' | 'dull' | 'sus' | 'sus-shadow' | 'terrified' | 'sad' | 'hard-shut' | 'done' | 'happy' | 'nervous' | 'nervous-teary';
export type CharacterMouthStyle = 'neutral' | 'smile' | 'frown' | 'open';
export type AvatarAnimation = 'idle' | 'walk' | 'sprint' | 'jump' | 'holding' | 'casting' | 'sleep' | 'damaged' | 'slide' | 'crouch' | 'crouchwalk' | 'grabbed' | 'startled' | 'angry' | 'meditate';
export type LobbyMessageTone = 'join' | 'death' | 'system';
export type GameMode = 'custom-lobby' | 'solo-survival' | 'multiplayer-survival';
export type LobbyMapPreset = 'classic-village' | 'treehouse-village' | 'duel-yard';
export type ExpandedMapPage = 'live' | 'world';
export type MapWaypoint = { x: number; z: number };
export type QuestNavigationTone = 'npc' | 'field' | 'brew' | 'realm' | 'turn-in';
export interface QuestNavigationTarget extends MapWaypoint {
  id: string;
  questId: string;
  npcId: string;
  label: string;
  detail: string;
  y: number;
  tone: QuestNavigationTone;
}
export type ManaSpawnRateSetting = 'low' | 'normal' | 'high';
export type EnemyDifficultySetting = 'normal' | 'hard' | 'nightmare';
export type SurvivalBiome = 'plains' | 'jungle' | 'desert' | 'swamp' | 'mushroom' | 'tallgrass';
export type QuestNpcRole = 'villager' | 'town-leader' | 'quest-giver';
export type SurvivalGameMode = Extract<GameMode, 'solo-survival' | 'multiplayer-survival'>;
export const ASPECT_RATIO_OPTIONS = ['16/9', '4/3', '21/9', 'Fill'] as const;
export type AspectRatioOption = typeof ASPECT_RATIO_OPTIONS[number];
export const DEFAULT_ASPECT_RATIO: AspectRatioOption = '16/9';
export const ASPECT_RATIO_STORAGE_KEY = 'wizards-only-fools-aspect-ratio';
export const QUEST_NPC_PROGRAMS_STORAGE_KEY = 'wizards-only-fools-quest-npc-programs';
export const QUEST_UNLOCKED_SPELLS_STORAGE_KEY = 'wizards-only-fools-quest-unlocked-spells';
export const QUEST_FLAGS_STORAGE_KEY = 'wizards-only-fools-quest-flags';
export const SURVIVAL_SAVE_STORAGE_KEY = 'wizards-only-fools-survival-save';
export const SURVIVAL_INVENTORY_STORAGE_KEY = 'wizards-only-fools-survival-inventory';

export interface QuestScriptPoint {
  id: string;
  title: string;
  dialog: string;
  eventScript: string;
}

export interface QuestNpcProgram {
  npcId: string;
  townId: string;
  hutId?: string;
  displayName: string;
  role: QuestNpcRole;
  theme?: string;
  position?: [number, number, number];
  greeting: string;
  scriptPoints: QuestScriptPoint[];
  updatedAt: number;
}

export interface QuestNpcEditorTarget {
  npcId: string;
  townId: string;
  hutId: string;
  defaultName: string;
  theme?: string;
  position: [number, number, number];
}

export type QuestFlagValue = string | boolean;

export type SpellQuestStatus = 'assigned' | 'completed';

export interface SpellQuestDefinition {
  id: string;
  spell: SpellType;
  title: string;
  objective: string;
  readyLine: string;
  incompleteLine: string;
  requiredFlag: string;
}

export interface QuestNpcDescriptor {
  npcId: string;
  townId: string;
  displayName: string;
}

export interface QuestNpcAssignment {
  npcId: string;
  townId: string;
  displayName: string;
  questId: string;
  spell: SpellType;
  status: SpellQuestStatus;
  assignedAt: number;
  completedAt?: number;
}

export type InventoryItemId =
  | 'darrel-leaves'
  | 'darrel-berries'
  | 'darrel-roots'
  | 'garden-draught'
  | 'healing-crystals';
export type InventoryItemCategory = 'quest' | 'material' | 'consumable';
export type DarrelIngredient = 'leaves' | 'berries' | 'roots';

export interface InventoryItemDefinition {
  id: InventoryItemId;
  name: string;
  description: string;
  category: InventoryItemCategory;
  maxStack: number;
}

export interface InventorySlot {
  id: InventoryItemId;
  quantity: number;
  acquiredAt: number;
}

export type InventoryRecord = Partial<Record<InventoryItemId, InventorySlot>>;

export interface QuestDialogChoice {
  id: string;
  label: string;
}

export interface QuestDialogSession {
  npcId: string;
  townId: string;
  displayName: string;
  line: string;
  choices: QuestDialogChoice[];
}

export interface LobbyRules {
  maxPlayers: number;
  friendlyFire: boolean;
  manaSpawnRate: ManaSpawnRateSetting;
  enemyDifficulty: EnemyDifficultySetting;
  mapPreset: LobbyMapPreset;
}

export interface SurvivalRules {
  maxPlayers: number;
  friendlyFire: boolean;
  manaSpawnRate: ManaSpawnRateSetting;
  enemyDifficulty: EnemyDifficultySetting;
}

export interface CharacterCustomization {
  skinColor: string;
  topColor: string;
  pantsColor: string;
  shoesColor: string;
  hatColor: string;
  hairColor: string;
  facialHairColor: string;
  topStyle: CharacterTopStyle;
  pantsStyle: CharacterPantsStyle;
  shoesStyle: CharacterShoesStyle;
  hatStyle: CharacterHatStyle;
  hairStyle: CharacterHairStyle;
  facialHairStyle: CharacterFacialHairStyle;
  eyeStyle: CharacterEyeStyle;
  mouthStyle: CharacterMouthStyle;
}

export interface SurvivalSaveProfile {
  version: 1;
  playerName: string;
  characterCustomization: CharacterCustomization;
  survivalLevel: number;
  survivalXp: number;
  questUnlockedSpells: SpellType[];
  questFlags: Record<string, QuestFlagValue>;
  spellQuestAssignments: Record<string, QuestNpcAssignment>;
  inventory: InventoryRecord;
  lastMode: SurvivalGameMode;
  savedAt: number;
}

export type SurvivalSaveUpdate = Partial<Pick<
  SurvivalSaveProfile,
  'playerName' | 'characterCustomization' | 'survivalLevel' | 'survivalXp' | 'questUnlockedSpells' | 'questFlags' | 'spellQuestAssignments' | 'inventory' | 'lastMode'
>>;

export const ALL_SPELLS: SpellType[] = ['fireball', 'iceshard', 'arcanebeam', 'healspell', 'icespell', 'ringsofpower', 'lightning', 'smokebomb', 'portal', 'blink', 'grab', 'tornado', 'meteorshower', 'flamethrower', 'discshield', 'orbshield', 'kunai', 'healingcrystals', 'magicarmor', 'jumpboost', 'speedboost', 'tungstonballsack', 'sleep', 'poison', 'acid', 'magicglassorb'];
export const SPELL_DISPLAY_NAMES: Record<SpellType, string> = {
  fireball: 'Fireball',
  iceshard: 'Biden Blast',
  arcanebeam: 'Hands',
  healspell: 'Heal',
  icespell: 'Plasma Snowball',
  ringsofpower: 'Rings of Power',
  lightning: 'Chidori',
  smokebomb: 'Smoke Bomb',
  portal: 'Portal',
  blink: 'Blink',
  grab: 'Grab',
  tornado: 'Tornado',
  meteorshower: 'Meteor Shower',
  flamethrower: 'Fire Breath',
  discshield: 'Disc Shield',
  orbshield: 'Orb Shield',
  kunai: 'Kunai',
  healingcrystals: 'Healing Crystals',
  magicarmor: 'Magic Armor',
  jumpboost: 'Jump Boost',
  speedboost: 'Speed Boost',
  tungstonballsack: 'Tungston',
  sleep: 'Sleep',
  poison: 'Poison',
  acid: 'Acid',
  magicglassorb: 'Magic Glass Orb',
};
const QUEST_RESERVED_SPELLS = new Set<SpellType>(['blink']);
const DARREL_QUEST_REWARD_SPELL: SpellType = 'healingcrystals';
const DARREL_QUEST_ACCEPTED_FLAG = 'darrel:healingcrystals:accepted';
const DARREL_LEAVES_FLAG = 'darrel:ingredient:leaves';
const DARREL_BERRIES_FLAG = 'darrel:ingredient:berries';
const DARREL_ROOTS_FLAG = 'darrel:ingredient:roots';
export const DARREL_POTION_FLAG = 'darrel:garden-draught';
export const DARREL_DRAGON_NPC_ID = 'darrel-spirit-dragon';
export const DARREL_DRAGON_WOKEN_FLAG = 'darrel:dragon:woken';
export const DARREL_DRAGON_PEACEFUL_FLAG = 'darrel:dragon:peaceful';
export const DARREL_DRAGON_FOUGHT_FLAG = 'darrel:dragon:fought';
export const DARREL_INVENTORY_ITEM_IDS: Record<DarrelIngredient | 'draught' | 'crystals', InventoryItemId> = {
  leaves: 'darrel-leaves',
  berries: 'darrel-berries',
  roots: 'darrel-roots',
  draught: 'garden-draught',
  crystals: 'healing-crystals',
};
export const INVENTORY_ITEM_DEFINITIONS: Record<InventoryItemId, InventoryItemDefinition> = {
  'darrel-leaves': {
    id: 'darrel-leaves',
    name: 'Leaves',
    description: 'Field leaves for Darrel\'s garden draught.',
    category: 'material',
    maxStack: 9,
  },
  'darrel-berries': {
    id: 'darrel-berries',
    name: 'Berries',
    description: 'Bright field berries for Darrel\'s garden draught.',
    category: 'material',
    maxStack: 9,
  },
  'darrel-roots': {
    id: 'darrel-roots',
    name: 'Roots',
    description: 'Fresh roots dug up in the fields.',
    category: 'material',
    maxStack: 9,
  },
  'garden-draught': {
    id: 'garden-draught',
    name: 'Garden Draught',
    description: 'A rough potion that folds the world toward the sacred garden.',
    category: 'consumable',
    maxStack: 3,
  },
  'healing-crystals': {
    id: 'healing-crystals',
    name: 'Healing Crystals',
    description: 'Crystals carried back from the spirit dragon.',
    category: 'quest',
    maxStack: 9,
  },
};
const SPELL_QUEST_COPY: Partial<Record<SpellType, Pick<SpellQuestDefinition, 'title' | 'objective' | 'readyLine' | 'incompleteLine'>>> = {
  fireball: {
    title: 'Coal for the Cold Hearth',
    objective: 'Bring proof that you lit a cold town hearth without burning the rafters.',
    readyLine: 'The hearth is breathing again. Fireball is yours.',
    incompleteLine: 'The hearth still needs a spark. Try again after the town marks the hearth lit.',
  },
  iceshard: {
    title: 'Frost in the Well',
    objective: 'Freeze the old well bucket so the water comes up clean.',
    readyLine: 'The well is clear and cold. Biden Blast is unlocked.',
    incompleteLine: 'The well water is still murky. Come back once the frost marker is set.',
  },
  arcanebeam: {
    title: 'Hands of the Clocktower',
    objective: 'Realign the clocktower hands before nightfall.',
    readyLine: 'The tower is keeping time again. Hands is unlocked.',
    incompleteLine: 'The clocktower is still crooked. Give it another try.',
  },
  healspell: {
    title: 'Bandages for the Road',
    objective: 'Help a wounded traveler recover near the village path.',
    readyLine: 'The traveler can stand again. Heal is unlocked.',
    incompleteLine: 'The traveler still needs help. Return when the recovery marker is set.',
  },
  icespell: {
    title: 'Snow in the Furnace',
    objective: 'Cool the furnace core without cracking the stone.',
    readyLine: 'The furnace is quiet. Plasma Snowball is unlocked.',
    incompleteLine: 'The furnace is still roaring. Try again once it is cooled.',
  },
  ringsofpower: {
    title: 'Three Lost Rings',
    objective: 'Recover the town rings from the edge of the graveyard.',
    readyLine: 'The rings are back on the shrine. Rings of Power is unlocked.',
    incompleteLine: 'The shrine still has empty grooves. Keep searching.',
  },
  lightning: {
    title: 'Storm Rod',
    objective: 'Charge the copper storm rod on the chapel roof.',
    readyLine: 'The rod hums with stormlight. Chidori is unlocked.',
    incompleteLine: 'The storm rod is still dull. It needs a charge first.',
  },
  smokebomb: {
    title: 'Vanishing Flour',
    objective: "Recover the baker's black flour from the cellar.",
    readyLine: 'The baker grins through the dust. Smoke Bomb is unlocked.',
    incompleteLine: 'No black flour yet. The cellar job is still open.',
  },
  portal: {
    title: 'Two Doorways',
    objective: 'Link the broken blue door to its twin outside town.',
    readyLine: 'Both doors blink at once. Portal is unlocked.',
    incompleteLine: 'Only one doorway is awake. Finish the link and return.',
  },
  grab: {
    title: 'Bell Rope Rescue',
    objective: 'Pull the jammed chapel bell rope free.',
    readyLine: 'The bell rings clean. Grab is unlocked.',
    incompleteLine: 'The bell rope is still stuck. Try again when it loosens.',
  },
  tornado: {
    title: 'Millwind',
    objective: 'Restart the windmill with a controlled spiral.',
    readyLine: 'The mill turns again. Tornado is unlocked.',
    incompleteLine: 'The windmill is still still. The spiral was not enough yet.',
  },
  meteorshower: {
    title: 'Sky Stones',
    objective: 'Collect three warm sky stones from the fields.',
    readyLine: 'The stones glow in a circle. Meteor Shower is unlocked.',
    incompleteLine: 'The circle is missing sky stones. Keep looking.',
  },
  flamethrower: {
    title: 'Ash Path',
    objective: 'Clear the bramble path without scorching the marker stones.',
    readyLine: 'The ash path is open. Fire Breath is unlocked.',
    incompleteLine: 'The brambles still block the path. Try another careful burn.',
  },
  discshield: {
    title: 'Slate Disc',
    objective: 'Repair the cracked slate disc above the schoolhouse door.',
    readyLine: 'The slate disc holds firm. Disc Shield is unlocked.',
    incompleteLine: 'The slate disc is still cracked. It needs more work.',
  },
  orbshield: {
    title: 'Glass Orchard',
    objective: 'Protect the glass fruit during the next village ambush.',
    readyLine: 'Not a single fruit broke. Orb Shield is unlocked.',
    incompleteLine: 'The orchard is not secure yet. Come back after it survives.',
  },
  kunai: {
    title: 'Needle Throw',
    objective: 'Win the old target board challenge behind the smithy.',
    readyLine: 'Every target is pinned. Kunai is unlocked.',
    incompleteLine: 'The target board is still laughing at you. Try again.',
  },
  healingcrystals: {
    title: 'The Sacred Garden Draught',
    objective: 'Gather 1 leaves, 1 berries, and 1 roots from the fields, brew the garden draught at a brewing station, then drink it to reach the sacred garden and bring back Healing Crystals.',
    readyLine: 'The spirit dragon sends you back with lemonade breath, lunch packed for the road, and Healing Crystals. Healing Crystals is unlocked.',
    incompleteLine: 'The garden draught is not finished yet: gather leaves, berries, and roots from the fields, brew it, and drink it when you are ready.',
  },
  magicarmor: {
    title: "Knight's Dent",
    objective: 'Straighten the dented armor on the town statue.',
    readyLine: 'The statue stands proud. Magic Armor is unlocked.',
    incompleteLine: 'The statue is still bent. Give it another try.',
  },
  jumpboost: {
    title: 'Roofline Errand',
    objective: 'Fetch the weather vane from the tallest roof.',
    readyLine: 'The weather vane spins again. Jump Boost is unlocked.',
    incompleteLine: 'The weather vane is still up there. Find a way onto the roof.',
  },
  speedboost: {
    title: 'Courier Trial',
    objective: 'Carry a sealed letter across town before the candle burns down.',
    readyLine: 'The wax is still warm. Speed Boost is unlocked.',
    incompleteLine: 'The candle burned too low. Run it again.',
  },
  tungstonballsack: {
    title: 'Heavy Favor',
    objective: 'Move the stubborn tungsten weight off the market road.',
    readyLine: 'The market road is clear. Tungston is unlocked.',
    incompleteLine: 'That weight has not moved. Bring a better trick.',
  },
  sleep: {
    title: 'Quiet Bell',
    objective: 'Silence the midnight bell so the town can rest.',
    readyLine: 'The town finally sleeps. Sleep is unlocked.',
    incompleteLine: 'The bell is still waking everyone. Try again at the tower.',
  },
  poison: {
    title: 'Bitter Roots',
    objective: 'Gather bitter roots from the swamp edge without touching the blue ones.',
    readyLine: 'The roots are sorted safely. Poison is unlocked.',
    incompleteLine: 'The root bundle is wrong. Sort it again.',
  },
  acid: {
    title: 'Locked Rust',
    objective: 'Melt the rust from the cemetery gate hinges.',
    readyLine: 'The gate opens without a scream. Acid is unlocked.',
    incompleteLine: 'The hinges are still rusted shut. Keep at it.',
  },
  magicglassorb: {
    title: 'Glass Eye',
    objective: 'Polish the scrying orb until it reflects the moon.',
    readyLine: 'The moon sits inside the glass. Magic Glass Orb is unlocked.',
    incompleteLine: 'The orb is still cloudy. Polish it again when the marker is ready.',
  },
};
export const SPELL_QUEST_DEFINITIONS: SpellQuestDefinition[] = ALL_SPELLS
  .filter((spell) => !QUEST_RESERVED_SPELLS.has(spell))
  .map((spell) => {
    const copy = SPELL_QUEST_COPY[spell];
    const displayName = SPELL_DISPLAY_NAMES[spell];
    return {
      id: `spellquest:${spell}`,
      spell,
      title: copy?.title ?? `${displayName} Trial`,
      objective: copy?.objective ?? `Finish a village task proving you are ready for ${displayName}.`,
      readyLine: copy?.readyLine ?? `${displayName} is unlocked.`,
      incompleteLine: copy?.incompleteLine ?? `This ${displayName} quest is not finished yet. Try again after the town marks it complete.`,
      requiredFlag: `spellquest:${spell}:ready`,
    };
  });
export const HOTBAR_SIZE = 10;
export const RUNE_POWER_MAX = 60;
export const ARMOR_MAX = 50;
export const SPEED_BOOST_DURATION_MS = 12000;
export const JUMP_BOOST_DURATION_MS = 12000;
export const TUNGSTON_SLOW_DURATION_MS = 8000;
export const SLEEP_DURATION_MS = 8000;
export const POISON_DURATION_MS = 10000;
export const ACID_DURATION_MS = 10000;
export const TOXIC_DAMAGE_PER_SECOND = 5;
export const hasRunePower = (power: number) => power > 0;
export const DEFAULT_HOTBAR_SPELLS: SpellType[] = ALL_SPELLS.slice(0, HOTBAR_SIZE);
export const DEFAULT_RIGHT_HOTBAR_SPELLS: SpellType[] = ['iceshard', 'lightning', 'portal', 'grab', 'tornado', 'meteorshower', 'fireball', 'icespell', 'smokebomb', 'kunai'];
export const DEFAULT_MOUSE_SENSITIVITY = 0.002;
export const DEFAULT_MOBILE_LOOK_SENSITIVITY = DEFAULT_MOUSE_SENSITIVITY * 2;
export const CONTROLLER_LOOK_SENSITIVITY_100_PERCENT = 2.65;
export const DEFAULT_CONTROLLER_LOOK_SENSITIVITY = Number((CONTROLLER_LOOK_SENSITIVITY_100_PERCENT * 2).toFixed(2));
export const DEFAULT_KEYBOARD_ARROW_LOOK_ENABLED = true;
export const DEFAULT_VOICE_PUSH_TO_TALK_KEY = 'KeyV';
export const DEFAULT_VOICE_OUTPUT_VOLUME = 0.85;
export const DEFAULT_VOICE_PROXIMITY_RANGE = 28;
export const SURVIVAL_BLOCK_SIZE = 512;
export const DARREL_QUEST_CHUNK = { cx: 12, cz: -12 } as const;
export const LILY_COIL_QUEST_CHUNK = { cx: 48, cz: -48 } as const;
export const DARREL_QUEST_SPAWN = {
  x: DARREL_QUEST_CHUNK.cx * SURVIVAL_BLOCK_SIZE,
  y: 33.35,
  z: DARREL_QUEST_CHUNK.cz * SURVIVAL_BLOCK_SIZE - 52,
} as const;
export const DARREL_QUEST_SPAWN_YAW = Math.PI;
export const LILY_COIL_QUEST_SPAWN = {
  x: LILY_COIL_QUEST_CHUNK.cx * SURVIVAL_BLOCK_SIZE + 237.11,
  y: 72.15,
  z: LILY_COIL_QUEST_CHUNK.cz * SURVIVAL_BLOCK_SIZE - 20.54,
} as const;
export const LILY_COIL_QUEST_SPAWN_YAW = 3.055;
export const DARREL_QUEST_SPAWN_STORAGE_KEY = 'wizards-only-fools-darrel-quest-spawn';
export type DarrelQuestSpawnPoint = { x: number; y: number; z: number; yaw?: number };
export function getDarrelQuestSpawn(): DarrelQuestSpawnPoint {
  const fallback = { ...DARREL_QUEST_SPAWN, yaw: DARREL_QUEST_SPAWN_YAW };
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(DARREL_QUEST_SPAWN_STORAGE_KEY);
    if (!raw) return fallback;
    const value = JSON.parse(raw) as Partial<DarrelQuestSpawnPoint>;
    const x = Number(value.x);
    const y = Number(value.y);
    const z = Number(value.z);
    const yaw = Number(value.yaw);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return fallback;
    return {
      x,
      y,
      z,
      yaw: Number.isFinite(yaw) ? yaw : fallback.yaw,
    };
  } catch {
    return fallback;
  }
}
export function saveDarrelQuestSpawnOverride(point: DarrelQuestSpawnPoint) {
  const spawn = {
    x: Number(point.x),
    y: Number(point.y),
    z: Number(point.z),
    yaw: Number.isFinite(Number(point.yaw)) ? Number(point.yaw) : DARREL_QUEST_SPAWN_YAW,
  };
  if (!Number.isFinite(spawn.x) || !Number.isFinite(spawn.y) || !Number.isFinite(spawn.z)) return null;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(DARREL_QUEST_SPAWN_STORAGE_KEY, JSON.stringify(spawn));
  }
  return spawn;
}
export function clearDarrelQuestSpawnOverride() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(DARREL_QUEST_SPAWN_STORAGE_KEY);
  }
}
export function getLilyCoilQuestSpawn() {
  return { ...LILY_COIL_QUEST_SPAWN, yaw: LILY_COIL_QUEST_SPAWN_YAW };
}
export const DARREL_DRAGON_WORLD_POSITION = {
  x: DARREL_QUEST_CHUNK.cx * SURVIVAL_BLOCK_SIZE + 10,
  y: 43.25,
  z: DARREL_QUEST_CHUNK.cz * SURVIVAL_BLOCK_SIZE + 6,
} as const;
export const DARREL_FIELD_SEARCH_POSITION = {
  x: 0,
  y: 4,
  z: 360,
} as const;
export const DARREL_BREWING_STATION_HINT_POSITION = {
  x: -42,
  y: 2.6,
  z: -26,
} as const;
export const DARREL_HOME_TOWN_ID = 'base-village';
export const DARREL_HOME_HUT_ID = '-64--48';
export const DARREL_QUEST_NPC_ID = DARREL_HOME_HUT_ID;
export const DARREL_QUEST_NPC_POSITION: [number, number, number] = [
  -64,
  1.95,
  -49.25,
];
export const DAY_NIGHT_CYCLE_SECONDS = 600;
export const FORCED_DAY_ELAPSED_SECONDS = DAY_NIGHT_CYCLE_SECONDS * 0.07;
export const FORCED_NIGHT_ELAPSED_SECONDS = DAY_NIGHT_CYCLE_SECONDS * 0.57;
export const LOBBY_MAP_PRESETS: LobbyMapPreset[] = ['classic-village', 'treehouse-village', 'duel-yard'];
export const MANA_SPAWN_RATE_SETTINGS: ManaSpawnRateSetting[] = ['low', 'normal', 'high'];
export const ENEMY_DIFFICULTY_SETTINGS: EnemyDifficultySetting[] = ['normal', 'hard', 'nightmare'];
export const DEFAULT_LOBBY_RULES: LobbyRules = {
  maxPlayers: 8,
  friendlyFire: false,
  manaSpawnRate: 'normal',
  enemyDifficulty: 'normal',
  mapPreset: 'classic-village',
};
export const DEFAULT_SURVIVAL_RULES: SurvivalRules = {
  maxPlayers: 4,
  friendlyFire: false,
  manaSpawnRate: 'normal',
  enemyDifficulty: 'normal',
};
export const DEFAULT_CONTROLLER_BINDINGS: Record<ControllerAction, ControllerButtonName> = {
  leftCast: 'leftTrigger',
  rightCast: 'rightTrigger',
  jump: 'a',
  slide: 'b',
  sprint: 'leftStick',
  inventory: 'dpadRight',
  interact: 'x',
  spellMenu: 'dpadUp',
  map: 'dpadLeft',
  scoreboard: 'back',
  pause: 'start',
  menuSelect: 'a',
  menuBack: 'b',
  leftHotbar: 'leftBumper',
  rightHotbar: 'rightBumper',
  voicePushToTalk: 'rightStick',
};
export const DEFAULT_CHARACTER_CUSTOMIZATION: CharacterCustomization = {
  skinColor: '#d6cf91',
  topColor: '#7c3aed',
  pantsColor: '#334155',
  shoesColor: '#1f2937',
  hatColor: '#7c3aed',
  hairColor: '#3f2a1d',
  facialHairColor: '#3f2a1d',
  topStyle: 'simple',
  pantsStyle: 'pants',
  shoesStyle: 'boots',
  hatStyle: 'floppy-wizard',
  hairStyle: 'none',
  facialHairStyle: 'none',
  eyeStyle: 'calm',
  mouthStyle: 'neutral',
};

const CHARACTER_TOP_STYLE_OPTIONS: CharacterTopStyle[] = ['simple', 'robe', 'vest', 'tunic'];
const CHARACTER_PANTS_STYLE_OPTIONS: CharacterPantsStyle[] = ['pants', 'shorts', 'skirt', 'robe'];
const CHARACTER_SHOES_STYLE_OPTIONS: CharacterShoesStyle[] = ['boots', 'shoes', 'sandals', 'barefoot'];
const CHARACTER_HAT_STYLE_OPTIONS: CharacterHatStyle[] = ['none', 'wizard', 'floppy-wizard', 'cap', 'hood', 'pharaoh'];
const CHARACTER_HAIR_STYLE_OPTIONS: CharacterHairStyle[] = ['none', 'short', 'bob', 'spikes', 'long'];
const CHARACTER_FACIAL_HAIR_STYLE_OPTIONS: CharacterFacialHairStyle[] = ['none', 'mustache', 'goatee', 'beard'];
const CHARACTER_EYE_STYLE_OPTIONS: CharacterEyeStyle[] = ['calm', 'wide', 'angry', 'sleepy', 'content', 'dull', 'sus', 'sus-shadow', 'terrified', 'sad', 'hard-shut', 'done', 'happy', 'nervous', 'nervous-teary'];
const CHARACTER_MOUTH_STYLE_OPTIONS: CharacterMouthStyle[] = ['neutral', 'smile', 'frown', 'open'];

export interface PlayerState {
  id: string;
  playerName?: string;
  pos: [number, number, number];
  rot: [number, number, number];
  aimDir?: [number, number, number];
  anim: string;
  health: number;
  armor?: number;
  slowUntil?: number;
  sleepUntil?: number;
  poisonUntil?: number;
  acidUntil?: number;
  playerColor?: string;
  character?: CharacterCustomization;
  survivalLevel?: number;
  isSpeaking?: boolean;
}

export interface LobbyMessage {
  id: string;
  text: string;
  tone: LobbyMessageTone;
  createdAt: number;
}

export interface Projectile {
  id: string;
  creatorId: string;
  type: SpellType;
  pos: { x: number; y: number; z: number };
  dir: { x: number; y: number; z: number };
  createdAt: number;
  hand?: HandType;
  grabId?: string;
  grabPhase?: 'cast' | 'release';
}

interface GameStore {
  isGameLaunched: boolean;
  setGameLaunched: (launched: boolean) => void;
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;
  lobbyRules: LobbyRules;
  setLobbyRules: (updates: Partial<LobbyRules>) => void;
  survivalRules: SurvivalRules;
  setSurvivalRules: (updates: Partial<SurvivalRules>) => void;
  survivalSave: SurvivalSaveProfile | null;
  survivalLevel: number;
  survivalXp: number;
  createNewSurvivalSave: (profile: {
    playerName: string;
    characterCustomization?: Partial<CharacterCustomization>;
    mode?: SurvivalGameMode;
  }) => SurvivalSaveProfile | null;
  continueSurvivalSave: (mode?: SurvivalGameMode) => boolean;
  saveSurvivalProgress: (updates?: SurvivalSaveUpdate) => SurvivalSaveProfile | null;
  clearSurvivalSave: () => void;
  addSurvivalXp: (amount: number) => void;
  // Local Player
  health: number;
  maxHealth: number;
  setHealth: (h: number) => void;
  armor: number;
  setArmor: (a: number) => void;
  damagePlayer: (damage: number) => void;
  activateMagicArmor: () => void;
  speedBoostUntil: number;
  jumpBoostUntil: number;
  slowUntil: number;
  sleepUntil: number;
  poisonUntil: number;
  acidUntil: number;
  magicGlassOrbUntil: number;
  isAstralMeditating: boolean;
  astralMeditationStartedAt: number;
  survivalTimeOverrideSeconds: number | null;
  activateSpeedBoost: () => void;
  activateJumpBoost: () => void;
  activateMagicGlassOrb: () => void;
  setAstralMeditating: (active: boolean) => void;
  setSurvivalTimeOverrideSeconds: (seconds: number | null) => void;
  setStatusEffect: (effect: StatusEffectType, until: number) => void;
  applyStatusEffect: (effect: StatusEffectType, durationMs: number) => void;
  clearStatusEffect: (effect: StatusEffectType) => void;
  clearToxicEffects: () => void;
  thrusterFuel: number;
  setThrusterFuel: (f: number) => void;
  leftRunePower: number;
  rightRunePower: number;
  setLeftRunePower: (f: number) => void;
  setRightRunePower: (f: number) => void;
  currentSpell: SpellType;
  setSpell: (spell: SpellType, hand?: HandType) => void;
  hotbarSpells: SpellType[];
  selectedHotbarIndex: number;
  leftCurrentSpell: SpellType;
  rightCurrentSpell: SpellType;
  leftHotbarSpells: SpellType[];
  rightHotbarSpells: SpellType[];
  leftSelectedHotbarIndex: number;
  rightSelectedHotbarIndex: number;
  activeHand: HandType;
  setActiveHand: (hand: HandType) => void;
  isMagicArmed: boolean;
  setMagicArmed: (armed: boolean) => void;
  toggleMagicArmed: () => void;
  setHotbarSpell: (slotIndex: number, spell: SpellType, hand?: HandType) => void;
  selectHotbarSlot: (slotIndex: number, hand?: HandType) => void;
  isSpellMenuOpen: boolean;
  setSpellMenuOpen: (open: boolean) => void;
  toggleSpellMenu: () => void;
  isChargingSpell: boolean;
  setIsChargingSpell: (c: boolean) => void;
  chargingHand: HandType | null;
  setChargingHand: (hand: HandType | null) => void;
  chargingHands: Record<HandType, boolean>;
  setHandCharging: (hand: HandType, charging: boolean) => void;
  flashbangOpacity: number;
  setFlashbangOpacity: (o: number) => void;
  nextSpell: (hand?: HandType) => void;
  prevSpell: (hand?: HandType) => void;
  
  isMapExpanded: boolean;
  expandedMapPage: ExpandedMapPage;
  mapWaypoint: MapWaypoint | null;
  toggleMap: () => void;
  setExpandedMapPage: (page: ExpandedMapPage) => void;
  setMapWaypoint: (waypoint: MapWaypoint) => void;
  clearMapWaypoint: () => void;
  isPauseMenuOpen: boolean;
  setPauseMenuOpen: (open: boolean) => void;
  isScoreboardOpen: boolean;
  setScoreboardOpen: (open: boolean) => void;
  isInventoryOpen: boolean;
  setInventoryOpen: (open: boolean) => void;
  toggleInventory: () => void;
  inventory: InventoryRecord;
  addInventoryItem: (itemId: InventoryItemId, quantity?: number) => void;
  removeInventoryItem: (itemId: InventoryItemId, quantity?: number) => boolean;
  collectDarrelIngredient: (ingredient: DarrelIngredient) => string[];
  brewDarrelGardenDraught: () => string[];
  drinkDarrelGardenDraught: () => string[];
  isVClipEnabled: boolean;
  setVClipEnabled: (enabled: boolean) => void;
  isTouchControlsActive: boolean;
  setTouchControlsActive: (active: boolean) => void;
  isControllerGameplayActive: boolean;
  setControllerGameplayActive: (active: boolean) => void;
  keyboardArrowLookEnabled: boolean;
  setKeyboardArrowLookEnabled: (enabled: boolean) => void;
  mouseSensitivity: number;
  controllerLookSensitivity: number;
  setMouseSensitivity: (value: number) => void;
  setControllerLookSensitivity: (value: number) => void;
  controllerBindings: Record<ControllerAction, ControllerButtonName>;
  setControllerBinding: (action: ControllerAction, button: ControllerButtonName) => void;
  voiceChatEnabled: boolean;
  voiceInputMode: VoiceInputMode;
  voicePushToTalkKey: string;
  voiceOutputVolume: number;
  voiceProximityRange: number;
  isVoiceSpeaking: boolean;
  voiceStatus: string;
  voiceError: string;
  setVoiceChatEnabled: (enabled: boolean) => void;
  setVoiceInputMode: (mode: VoiceInputMode) => void;
  setVoicePushToTalkKey: (code: string) => void;
  setVoiceOutputVolume: (value: number) => void;
  setVoiceProximityRange: (value: number) => void;
  setVoiceSpeaking: (speaking: boolean) => void;
  setVoiceStatus: (status: string) => void;
  setVoiceError: (error: string) => void;
  characterCustomization: CharacterCustomization;
  setCharacterCustomization: (updates: Partial<CharacterCustomization>) => void;
  localPlayerName: string;
  setLocalPlayerName: (name: string) => void;
  lobbyMessages: LobbyMessage[];
  addLobbyMessage: (text: string, tone?: LobbyMessageTone) => void;
  removeLobbyMessage: (id: string) => void;
  aspectRatio: AspectRatioOption;
  setAspectRatio: (ratio: AspectRatioOption | string) => void;
  isQuestDevModeEnabled: boolean;
  setQuestDevModeEnabled: (enabled: boolean) => void;
  questNpcEditorTarget: QuestNpcEditorTarget | null;
  openQuestNpcEditor: (target: QuestNpcEditorTarget) => void;
  closeQuestNpcEditor: () => void;
  questNpcPrograms: Record<string, QuestNpcProgram>;
  upsertQuestNpcProgram: (program: QuestNpcProgram) => void;
  removeQuestNpcProgram: (npcId: string) => void;
  questDialogSession: QuestDialogSession | null;
  closeQuestDialog: () => void;
  chooseQuestDialogChoice: (choiceId: string) => void;
  questUnlockedSpells: SpellType[];
  questFlags: Record<string, QuestFlagValue>;
  spellQuestAssignments: Record<string, QuestNpcAssignment>;
  interactWithQuestVillager: (npc: QuestNpcDescriptor, options?: { announce?: boolean }) => string[];
  openDarrelDragonDialog: () => string[];
  completeAssignedSpellQuest: (npcId: string) => string[];
  completeDarrelGroveQuestReturn: (npcId?: string) => string[];
  runQuestScriptPoint: (npcId: string, scriptPointId: string) => string[];
  // Network Players
  players: Record<string, PlayerState>;
  setPlayers: (players: PlayerState[]) => void;
  addPlayer: (p: PlayerState) => void;
  removePlayer: (id: string) => void;
  updatePlayer: (id: string, data: Partial<PlayerState>) => void;
  respawn: () => void;

  // Projectiles
  projectiles: Projectile[];
  addProjectile: (p: Projectile) => void;
  removeProjectile: (id: string) => void;
  // Portals
  portals: { id: string; pos: { x: number; y: number; z: number } }[];
  addPortal: (portal: { id: string; pos: { x: number; y: number; z: number } }) => void;
  removePortal: (id: string) => void;
}

const normalizeHotbarIndex = (slotIndex: number) => ((slotIndex % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
const getHandKey = (hand: HandType) => hand === 'right' ? 'right' : 'left';
export const PLAYER_NAME_STORAGE_KEY = 'wizards-only-fools-player-name';

export function sanitizeAspectRatio(value: string | null | undefined): AspectRatioOption {
  return ASPECT_RATIO_OPTIONS.includes(value as AspectRatioOption)
    ? (value as AspectRatioOption)
    : DEFAULT_ASPECT_RATIO;
}

export function getSurvivalDifficultyMultiplier(playerCount: number, baseDifficulty: EnemyDifficultySetting = 'normal') {
  const baseMultiplier = baseDifficulty === 'nightmare' ? 1.7 : baseDifficulty === 'hard' ? 1.3 : 1;
  const playerMultiplier = 1 + Math.max(0, playerCount - 1) * 0.32;
  return Number((baseMultiplier * playerMultiplier).toFixed(2));
}

export function sanitizePlayerName(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .slice(0, 18);
}

function getInitialPlayerName() {
  if (typeof window === 'undefined') return '';
  return sanitizePlayerName(window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || '');
}

function getInitialAspectRatio() {
  if (typeof window === 'undefined') return DEFAULT_ASPECT_RATIO;

  try {
    return sanitizeAspectRatio(window.localStorage.getItem(ASPECT_RATIO_STORAGE_KEY));
  } catch {
    return DEFAULT_ASPECT_RATIO;
  }
}

function makeLobbyMessage(text: string, tone: LobbyMessageTone = 'system'): LobbyMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    tone,
    createdAt: Date.now(),
  };
}

function makeQuestId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeQuestScriptPointId() {
  return makeQuestId('point');
}

export function createDefaultQuestNpcProgram(target: QuestNpcEditorTarget): QuestNpcProgram {
  if (isDarrelQuestNpc({ npcId: target.npcId, displayName: target.defaultName })) {
    return {
      npcId: target.npcId,
      townId: target.townId,
      hutId: target.hutId,
      displayName: 'Darrel',
      role: 'quest-giver',
      theme: target.theme,
      position: target.position,
      greeting: 'Who are you what do you want!',
      scriptPoints: [
        {
          id: makeQuestScriptPointId(),
          title: 'Opening',
          dialog: 'Darrel: Who are you what do you want!\n\nPlayer choices:\n- None of your business.\n- What kind of wizard has only 2 spells?',
          eventScript: 'message Darrel opens with a hard stare.',
        },
        {
          id: makeQuestScriptPointId(),
          title: 'Jerk Response',
          dialog: 'Player: None of your business.\n\nDarrel: Then my business is none of yours. Try again when you remember how doors work.',
          eventScript: 'message Darrel did not appreciate that.',
        },
        {
          id: makeQuestScriptPointId(),
          title: 'Scripted Response',
          dialog: 'Player: What kind of wizard has only 2 spells?\n\nDarrel: A pitiful one. Fine. I have a job that might make you slightly less embarrassing.',
          eventScript: `setFlag ${DARREL_QUEST_ACCEPTED_FLAG}=true\nstartQuest spellquest:${DARREL_QUEST_REWARD_SPELL}\nmessage Darrel offers the Sacred Garden job.`,
        },
        {
          id: makeQuestScriptPointId(),
          title: 'Job Brief',
          dialog: 'Darrel: Travel to the sacred garden in an alternate dimension. Supposedly there is a spirit dragon there. Bring back healing crystals.\n\nFirst you need a garden draught. Go out into the fields, gather 1 leaves, 1 berries, and 1 roots, then brew it at any brewing station.',
          eventScript: `setFlag ${DARREL_LEAVES_FLAG}=needed\nsetFlag ${DARREL_BERRIES_FLAG}=needed\nsetFlag ${DARREL_ROOTS_FLAG}=needed\nsetFlag ${DARREL_POTION_FLAG}=needed\nmessage Search the fields for leaves, berries, and roots.`,
        },
        {
          id: makeQuestScriptPointId(),
          title: 'Potion Drink',
          dialog: 'The garden draught tastes like a wet lawn and a dare. Reality folds toward the sacred garden.',
          eventScript: `setFlag ${DARREL_POTION_FLAG}=drunk\nteleportDarrelQuest darrel-grove`,
        },
        {
          id: makeQuestScriptPointId(),
          title: 'Sleeping Dragon Encounter',
          dialog: 'Spirit Dragon: Hm? State your business, little wizard.\n\nPlayer choices:\n- Fight and take the Healing Crystals by force.\n- Peacefully ask for crystals for Darrel and yourself.',
          eventScript: `setFlag ${DARREL_DRAGON_WOKEN_FLAG}=true\nmessage The Spirit Dragon wakes inside the garden house.`,
        },
      ],
      updatedAt: Date.now(),
    };
  }

  return {
    npcId: target.npcId,
    townId: target.townId,
    hutId: target.hutId,
    displayName: target.defaultName,
    role: 'villager',
    theme: target.theme,
    position: target.position,
    greeting: 'The villager watches you carefully, waiting for the next line of the quest.',
    scriptPoints: [
      {
        id: makeQuestScriptPointId(),
        title: 'Greeting',
        dialog: 'Need something, wizard?',
        eventScript: 'message Quest scriptpoint reached',
      },
    ],
    updatedAt: Date.now(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getStoredJson(key: string): unknown {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quest authoring should still work during the current session if storage is unavailable.
  }
}

function removeStoredValue(key: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable in private/restricted browser modes.
  }
}

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function sanitizeHexColor(value: unknown, fallback: string) {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value.trim())
    ? value.trim()
    : fallback;
}

function chooseCharacterOption<T extends string>(value: unknown, options: T[], fallback: T): T {
  return typeof value === 'string' && options.includes(value as T)
    ? value as T
    : fallback;
}

function sanitizeCharacterCustomization(value: unknown): CharacterCustomization {
  const record = isRecord(value) ? value : {};
  const topColor = sanitizeHexColor(record.topColor, DEFAULT_CHARACTER_CUSTOMIZATION.topColor);

  return {
    skinColor: sanitizeHexColor(record.skinColor, DEFAULT_CHARACTER_CUSTOMIZATION.skinColor),
    topColor,
    pantsColor: sanitizeHexColor(record.pantsColor, DEFAULT_CHARACTER_CUSTOMIZATION.pantsColor),
    shoesColor: sanitizeHexColor(record.shoesColor, DEFAULT_CHARACTER_CUSTOMIZATION.shoesColor),
    hatColor: sanitizeHexColor(record.hatColor, topColor),
    hairColor: sanitizeHexColor(record.hairColor, DEFAULT_CHARACTER_CUSTOMIZATION.hairColor),
    facialHairColor: sanitizeHexColor(record.facialHairColor, DEFAULT_CHARACTER_CUSTOMIZATION.facialHairColor),
    topStyle: chooseCharacterOption(record.topStyle, CHARACTER_TOP_STYLE_OPTIONS, DEFAULT_CHARACTER_CUSTOMIZATION.topStyle),
    pantsStyle: chooseCharacterOption(record.pantsStyle, CHARACTER_PANTS_STYLE_OPTIONS, DEFAULT_CHARACTER_CUSTOMIZATION.pantsStyle),
    shoesStyle: chooseCharacterOption(record.shoesStyle, CHARACTER_SHOES_STYLE_OPTIONS, DEFAULT_CHARACTER_CUSTOMIZATION.shoesStyle),
    hatStyle: chooseCharacterOption(record.hatStyle, CHARACTER_HAT_STYLE_OPTIONS, DEFAULT_CHARACTER_CUSTOMIZATION.hatStyle),
    hairStyle: chooseCharacterOption(record.hairStyle, CHARACTER_HAIR_STYLE_OPTIONS, DEFAULT_CHARACTER_CUSTOMIZATION.hairStyle),
    facialHairStyle: chooseCharacterOption(record.facialHairStyle, CHARACTER_FACIAL_HAIR_STYLE_OPTIONS, DEFAULT_CHARACTER_CUSTOMIZATION.facialHairStyle),
    eyeStyle: chooseCharacterOption(record.eyeStyle, CHARACTER_EYE_STYLE_OPTIONS, DEFAULT_CHARACTER_CUSTOMIZATION.eyeStyle),
    mouthStyle: chooseCharacterOption(record.mouthStyle, CHARACTER_MOUTH_STYLE_OPTIONS, DEFAULT_CHARACTER_CUSTOMIZATION.mouthStyle),
  };
}

function sanitizeQuestUnlockedSpellList(value: unknown): SpellType[] {
  const storedSpells = Array.isArray(value) ? value : [];
  const unlocked = storedSpells.filter((spell): spell is SpellType => (
    typeof spell === 'string' && ALL_SPELLS.includes(spell as SpellType)
  ));
  return Array.from(new Set<SpellType>(['blink', ...unlocked]));
}

function sanitizeQuestFlagRecord(raw: unknown): Record<string, QuestFlagValue> {
  if (!isRecord(raw)) return {};

  const flags: Record<string, QuestFlagValue> = {};
  Object.entries(raw).forEach(([key, value]) => {
    if (!key.trim()) return;
    if (typeof value === 'boolean' || typeof value === 'string') {
      flags[key.trim().slice(0, 80)] = typeof value === 'string' ? value.slice(0, 180) : value;
    }
  });
  return flags;
}

function isInventoryItemId(value: unknown): value is InventoryItemId {
  return typeof value === 'string' && value in INVENTORY_ITEM_DEFINITIONS;
}

function sanitizeInventoryRecord(raw: unknown): InventoryRecord {
  if (!isRecord(raw)) return {};

  const inventory: InventoryRecord = {};
  Object.entries(raw).forEach(([fallbackId, value]) => {
    if (!isRecord(value)) return;
    const itemId = isInventoryItemId(value.id) ? value.id : isInventoryItemId(fallbackId) ? fallbackId : null;
    if (!itemId) return;

    const definition = INVENTORY_ITEM_DEFINITIONS[itemId];
    const quantity = sanitizeInteger(value.quantity, 0, 0, definition.maxStack);
    if (quantity <= 0) return;

    inventory[itemId] = {
      id: itemId,
      quantity,
      acquiredAt: sanitizeInteger(value.acquiredAt, Date.now(), 0, Date.now()),
    };
  });

  return inventory;
}

function getInventoryQuantity(inventory: InventoryRecord, itemId: InventoryItemId) {
  return inventory[itemId]?.quantity ?? 0;
}

function addInventoryQuantity(inventory: InventoryRecord, itemId: InventoryItemId, quantity = 1): InventoryRecord {
  const definition = INVENTORY_ITEM_DEFINITIONS[itemId];
  const current = inventory[itemId];
  const nextQuantity = Math.max(0, Math.min(definition.maxStack, (current?.quantity ?? 0) + Math.max(0, Math.floor(quantity))));
  if (nextQuantity <= 0) {
    const nextInventory = { ...inventory };
    delete nextInventory[itemId];
    return nextInventory;
  }
  return {
    ...inventory,
    [itemId]: {
      id: itemId,
      quantity: nextQuantity,
      acquiredAt: current?.acquiredAt ?? Date.now(),
    },
  };
}

function removeInventoryQuantity(inventory: InventoryRecord, itemId: InventoryItemId, quantity = 1): InventoryRecord | null {
  const currentQuantity = getInventoryQuantity(inventory, itemId);
  const removal = Math.max(0, Math.floor(quantity));
  if (removal <= 0 || currentQuantity < removal) return null;

  const nextInventory = { ...inventory };
  const nextQuantity = currentQuantity - removal;
  if (nextQuantity <= 0) {
    delete nextInventory[itemId];
  } else {
    nextInventory[itemId] = {
      id: itemId,
      quantity: nextQuantity,
      acquiredAt: nextInventory[itemId]?.acquiredAt ?? Date.now(),
    };
  }
  return nextInventory;
}

function getSpellQuestDefinition(spellOrQuestId: SpellType | string): SpellQuestDefinition | null {
  return SPELL_QUEST_DEFINITIONS.find((quest) => (
    quest.spell === spellOrQuestId || quest.id === spellOrQuestId
  )) ?? null;
}

function sanitizeSpellQuestAssignments(raw: unknown): Record<string, QuestNpcAssignment> {
  if (!isRecord(raw)) return {};

  const assignments: Record<string, QuestNpcAssignment> = {};
  Object.entries(raw).forEach(([fallbackNpcId, value]) => {
    if (!isRecord(value)) return;
    const npcId = typeof value.npcId === 'string' && value.npcId.trim()
      ? value.npcId.trim().slice(0, 96)
      : fallbackNpcId.trim().slice(0, 96);
    const townId = typeof value.townId === 'string' && value.townId.trim()
      ? value.townId.trim().slice(0, 96)
      : 'unknown-town';
    const displayName = typeof value.displayName === 'string' && value.displayName.trim()
      ? value.displayName.trim().slice(0, 42)
      : 'Villager';
    const spell = typeof value.spell === 'string' && ALL_SPELLS.includes(value.spell as SpellType)
      ? value.spell as SpellType
      : null;
    const definition = spell ? getSpellQuestDefinition(spell) : null;
    if (!npcId || !spell || !definition) return;

    const assignedAt = sanitizeInteger(value.assignedAt, Date.now(), 0, Date.now());
    const completedAt = sanitizeInteger(value.completedAt, 0, 0, Date.now());
    const status: SpellQuestStatus = value.status === 'completed' ? 'completed' : 'assigned';
    assignments[npcId] = {
      npcId,
      townId,
      displayName,
      questId: definition.id,
      spell,
      status,
      assignedAt,
      ...(status === 'completed' && completedAt > 0 ? { completedAt } : {}),
    };
  });

  return assignments;
}

function isQuestFlagTruthy(value: QuestFlagValue | undefined) {
  return value === true || value === 'true' || value === 'completed' || value === 'ready' || value === '1';
}

function normalizeQuestLookupValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isDarrelQuestNpc(npc: Pick<QuestNpcDescriptor, 'npcId' | 'displayName'>) {
  const npcId = normalizeQuestLookupValue(npc.npcId);
  const displayName = normalizeQuestLookupValue(npc.displayName);
  return displayName === 'darrel' || displayName === 'darrell' || npcId.includes('darrel') || npcId.includes('darrell');
}

function isAcceptedDarrelQuestAssignment(
  assignment: Pick<QuestNpcAssignment, 'spell' | 'npcId' | 'displayName'>,
  questFlags: Record<string, QuestFlagValue>,
) {
  return assignment.spell === DARREL_QUEST_REWARD_SPELL && (
    isDarrelQuestNpc(assignment) ||
    isQuestFlagTruthy(questFlags[DARREL_QUEST_ACCEPTED_FLAG])
  );
}

function findAcceptedDarrelQuestAssignment(
  assignments: Record<string, QuestNpcAssignment>,
  questFlags: Record<string, QuestFlagValue>,
) {
  return Object.values(assignments).find((assignment) => (
    isAcceptedDarrelQuestAssignment(assignment, questFlags)
  ));
}

function makeSpellQuestAssignment(npc: QuestNpcDescriptor, quest: SpellQuestDefinition): QuestNpcAssignment {
  return {
    npcId: npc.npcId,
    townId: npc.townId,
    displayName: npc.displayName,
    questId: quest.id,
    spell: quest.spell,
    status: 'assigned',
    assignedAt: Date.now(),
  };
}

function pickSpellQuestForNpc(
  npc: QuestNpcDescriptor,
  questUnlockedSpells: SpellType[],
  assignments: Record<string, QuestNpcAssignment>,
): { quest: SpellQuestDefinition; fixedReward: boolean } | null {
  if (isDarrelQuestNpc(npc)) {
    const darrelQuest = getSpellQuestDefinition(DARREL_QUEST_REWARD_SPELL);
    if (darrelQuest) return { quest: darrelQuest, fixedReward: true };
  }

  const quest = pickAvailableSpellQuest(questUnlockedSpells, assignments);
  return quest ? { quest, fixedReward: false } : null;
}

function isSpellQuestReady(quest: SpellQuestDefinition, questFlags: Record<string, QuestFlagValue>) {
  return isQuestFlagTruthy(questFlags[quest.requiredFlag]) || questFlags[`quest:${quest.id}`] === 'completed';
}

function hasDarrelIngredient(questFlags: Record<string, QuestFlagValue>, ingredient: DarrelIngredient) {
  const flag = ingredient === 'leaves'
    ? DARREL_LEAVES_FLAG
    : ingredient === 'berries'
      ? DARREL_BERRIES_FLAG
      : DARREL_ROOTS_FLAG;
  const value = questFlags[flag];
  return value === 'gathered' || value === 'brewed' || value === 'drunk' || isQuestFlagTruthy(value);
}

function getQuestNpcNavigationPosition(
  assignment: Pick<QuestNpcAssignment, 'npcId' | 'displayName'>,
  questNpcPrograms: Record<string, QuestNpcProgram>,
) {
  const program = questNpcPrograms[assignment.npcId];
  if (program?.position) {
    const [x, y, z] = program.position;
    return { x, y: y + 5.5, z };
  }

  if (isDarrelQuestNpc(assignment)) {
    const [x, y, z] = DARREL_QUEST_NPC_POSITION;
    return { x, y: y + 5.5, z };
  }

  return null;
}

function getDarrelNavigationTarget(
  assignment: QuestNpcAssignment,
  quest: SpellQuestDefinition,
  questFlags: Record<string, QuestFlagValue>,
  questNpcPrograms: Record<string, QuestNpcProgram>,
): QuestNavigationTarget {
  const turnInPosition = getQuestNpcNavigationPosition(assignment, questNpcPrograms) ?? {
    x: DARREL_QUEST_NPC_POSITION[0],
    y: DARREL_QUEST_NPC_POSITION[1] + 5.5,
    z: DARREL_QUEST_NPC_POSITION[2],
  };
  const base = {
    questId: quest.id,
    npcId: assignment.npcId,
  };

  if (isSpellQuestReady(quest, questFlags)) {
    return {
      ...base,
      id: `${assignment.npcId}:${quest.id}:turn-in`,
      label: 'Return to Darrel',
      detail: 'Bring the Healing Crystals back to Darrel.',
      tone: 'turn-in',
      ...turnInPosition,
    };
  }

  const potionState = questFlags[DARREL_POTION_FLAG];
  if (potionState === 'drunk' || questFlags['quest:darrel-grove'] === 'started') {
    return {
      ...base,
      id: `${assignment.npcId}:${quest.id}:spirit-dragon`,
      label: 'Spirit Dragon',
      detail: 'Find the sleeping dragon inside the garden house.',
      tone: 'realm',
      ...DARREL_DRAGON_WORLD_POSITION,
    };
  }

  const missingIngredients = (['leaves', 'berries', 'roots'] as DarrelIngredient[])
    .filter((ingredient) => !hasDarrelIngredient(questFlags, ingredient));
  if (missingIngredients.length > 0) {
    return {
      ...base,
      id: `${assignment.npcId}:${quest.id}:fields`,
      label: 'The Fields',
      detail: `Gather ${missingIngredients.join(', ')} for Darrel's garden draught.`,
      tone: 'field',
      ...DARREL_FIELD_SEARCH_POSITION,
    };
  }

  if (potionState !== 'brewed') {
    return {
      ...base,
      id: `${assignment.npcId}:${quest.id}:brew`,
      label: 'Brew Garden Draught',
      detail: 'Use a brewing station to make Darrel\'s garden draught.',
      tone: 'brew',
      ...DARREL_BREWING_STATION_HINT_POSITION,
    };
  }

  return {
    ...base,
    id: `${assignment.npcId}:${quest.id}:drink`,
    label: 'Drink Garden Draught',
    detail: 'Drink the garden draught from your inventory to enter the sacred garden.',
    tone: 'realm',
    ...turnInPosition,
  };
}

export function getActiveQuestNavigationTargets({
  spellQuestAssignments,
  questFlags,
  questUnlockedSpells,
  questNpcPrograms,
}: {
  spellQuestAssignments: Record<string, QuestNpcAssignment>;
  questFlags: Record<string, QuestFlagValue>;
  questUnlockedSpells: SpellType[];
  questNpcPrograms: Record<string, QuestNpcProgram>;
}): QuestNavigationTarget[] {
  return Object.values(spellQuestAssignments)
    .filter((assignment) => assignment.status !== 'completed' && !questUnlockedSpells.includes(assignment.spell))
    .sort((a, b) => a.assignedAt - b.assignedAt)
    .map((assignment) => {
      const quest = getSpellQuestDefinition(assignment.questId) ?? getSpellQuestDefinition(assignment.spell);
      if (!quest) return null;

      if (isAcceptedDarrelQuestAssignment(assignment, questFlags)) {
        return getDarrelNavigationTarget(assignment, quest, questFlags, questNpcPrograms);
      }

      const position = getQuestNpcNavigationPosition(assignment, questNpcPrograms);
      if (!position) return null;
      const ready = isSpellQuestReady(quest, questFlags);
      return {
        id: `${assignment.npcId}:${quest.id}:${ready ? 'turn-in' : 'quest-giver'}`,
        questId: quest.id,
        npcId: assignment.npcId,
        label: ready ? `Turn in ${SPELL_DISPLAY_NAMES[assignment.spell]}` : quest.title,
        detail: ready ? `Return to ${assignment.displayName}.` : quest.objective,
        tone: ready ? 'turn-in' : 'npc',
        ...position,
      } satisfies QuestNavigationTarget;
    })
    .filter((target): target is QuestNavigationTarget => target !== null);
}

function releaseQuestDialogControls() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  window.dispatchEvent(new Event('command-console-opened'));
  document.documentElement.classList.remove('wizards-mouse-gameplay-active');
  delete document.documentElement.dataset.wizardsMouseLookFallback;
  if (document.pointerLockElement) {
    document.exitPointerLock();
  }
}

function makeDarrelStartedFlags(quest: SpellQuestDefinition, questFlags: Record<string, QuestFlagValue>) {
  return {
    ...questFlags,
    [DARREL_QUEST_ACCEPTED_FLAG]: true,
    [DARREL_LEAVES_FLAG]: questFlags[DARREL_LEAVES_FLAG] ?? 'needed',
    [DARREL_BERRIES_FLAG]: questFlags[DARREL_BERRIES_FLAG] ?? 'needed',
    [DARREL_ROOTS_FLAG]: questFlags[DARREL_ROOTS_FLAG] ?? 'needed',
    [DARREL_POTION_FLAG]: questFlags[DARREL_POTION_FLAG] ?? 'needed',
    [`quest:${quest.id}`]: questFlags[`quest:${quest.id}`] === 'completed' ? 'completed' : 'started',
  };
}

function getDarrelQuestDialogSession(
  npc: QuestNpcDescriptor,
  questUnlockedSpells: SpellType[],
  questFlags: Record<string, QuestFlagValue>,
  assignments: Record<string, QuestNpcAssignment>
): QuestDialogSession {
  const quest = getSpellQuestDefinition(DARREL_QUEST_REWARD_SPELL);
  const assignment = assignments[npc.npcId];
  const hasCompletedQuest = questUnlockedSpells.includes(DARREL_QUEST_REWARD_SPELL) ||
    (assignment?.spell === DARREL_QUEST_REWARD_SPELL && assignment.status === 'completed') ||
    (quest ? questFlags[`quest:${quest.id}`] === 'completed' : false);

  if (hasCompletedQuest) {
    return {
      ...npc,
      line: 'Darrel: You got the Healing Crystals. Try not to make the spell look bad.',
      choices: [{ id: 'darrel-close', label: 'Leave Darrel alone' }],
    };
  }

  const hasAcceptedQuest = assignment?.spell === DARREL_QUEST_REWARD_SPELL ||
    isQuestFlagTruthy(questFlags[DARREL_QUEST_ACCEPTED_FLAG]) ||
    (quest ? questFlags[`quest:${quest.id}`] === 'started' : false);

  if (hasAcceptedQuest) {
    return {
      ...npc,
      line: 'Darrel: The job is still open. Go to the fields, gather 1 leaves, 1 berries, and 1 roots. Brew the garden draught at a brewing station, drink it, and try not to act shocked when the spirit dragon offers lunch instead of a fight.',
      choices: [{ id: 'darrel-close', label: 'I will get the ingredients' }],
    };
  }

  return {
    ...npc,
    line: 'Darrel: Who are you what do you want!',
    choices: [
      { id: 'darrel-jerk', label: 'None of your business.' },
      { id: 'darrel-two-spells', label: 'What kind of wizard has only 2 spells?' },
    ],
  };
}

function completeAssignmentsForSpell(
  assignments: Record<string, QuestNpcAssignment>,
  spell: SpellType,
  completedAt = Date.now()
) {
  let changed = false;
  const next: Record<string, QuestNpcAssignment> = {};
  Object.entries(assignments).forEach(([npcId, assignment]) => {
    if (assignment.spell === spell && assignment.status !== 'completed') {
      changed = true;
      next[npcId] = { ...assignment, status: 'completed', completedAt };
    } else {
      next[npcId] = assignment;
    }
  });
  return changed ? next : assignments;
}

function pickAvailableSpellQuest(
  questUnlockedSpells: SpellType[],
  assignments: Record<string, QuestNpcAssignment>
): SpellQuestDefinition | null {
  const activeAssignedSpells = new Set(
    Object.values(assignments)
      .filter((assignment) => assignment.status !== 'completed')
      .map((assignment) => assignment.spell)
  );
  const unassignedLocked = SPELL_QUEST_DEFINITIONS.filter((quest) => (
    !questUnlockedSpells.includes(quest.spell) && !activeAssignedSpells.has(quest.spell)
  ));
  const locked = SPELL_QUEST_DEFINITIONS.filter((quest) => !questUnlockedSpells.includes(quest.spell));
  const pool = unassignedLocked.length > 0 ? unassignedLocked : locked;
  return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
}

function sanitizeSurvivalMode(value: unknown): SurvivalGameMode {
  return value === 'multiplayer-survival' ? 'multiplayer-survival' : 'solo-survival';
}

function sanitizeInteger(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.floor(value)))
    : fallback;
}

export function getSurvivalLevelXpTarget(level: number) {
  return Math.max(100, Math.floor(Math.max(1, level) * 125));
}

function resolveSurvivalLevel(level: number, xp: number) {
  let nextLevel = sanitizeInteger(level, 1, 1, 999);
  let nextXp = sanitizeInteger(xp, 0, 0, 99999999);

  while (nextXp >= getSurvivalLevelXpTarget(nextLevel) && nextLevel < 999) {
    nextXp -= getSurvivalLevelXpTarget(nextLevel);
    nextLevel += 1;
  }

  return { level: nextLevel, xp: nextXp };
}

function normalizeQuestRole(value: unknown): QuestNpcRole {
  return value === 'town-leader' || value === 'quest-giver' || value === 'villager'
    ? value
    : 'villager';
}

function sanitizeQuestScriptPoint(value: unknown, index: number): QuestScriptPoint {
  const record = isRecord(value) ? value : {};
  const id = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : makeQuestScriptPointId();
  const title = typeof record.title === 'string' && record.title.trim() ? record.title.trim().slice(0, 48) : `Point ${index + 1}`;
  const dialog = typeof record.dialog === 'string' ? record.dialog.slice(0, 900) : '';
  const eventScript = typeof record.eventScript === 'string' ? record.eventScript.slice(0, 900) : '';
  return { id, title, dialog, eventScript };
}

function sanitizeQuestNpcProgram(value: QuestNpcProgram | Record<string, unknown>): QuestNpcProgram | null {
  if (!isRecord(value)) return null;
  const npcId = typeof value.npcId === 'string' ? value.npcId.trim() : '';
  if (!npcId) return null;
  const townId = typeof value.townId === 'string' && value.townId.trim() ? value.townId.trim() : 'unknown-town';
  const hutId = typeof value.hutId === 'string' && value.hutId.trim() ? value.hutId.trim().slice(0, 96) : undefined;
  const displayName = typeof value.displayName === 'string' && value.displayName.trim() ? value.displayName.trim().slice(0, 42) : 'Quest NPC';
  const theme = typeof value.theme === 'string' && value.theme.trim() ? value.theme.trim().slice(0, 48) : undefined;
  const rawPosition = Array.isArray(value.position) ? value.position : [];
  const position = rawPosition.length === 3 && rawPosition.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate))
    ? rawPosition as [number, number, number]
    : undefined;
  const greeting = typeof value.greeting === 'string' ? value.greeting.slice(0, 900) : '';
  const rawPoints = Array.isArray(value.scriptPoints) ? value.scriptPoints : [];
  const scriptPoints = rawPoints.length > 0
    ? rawPoints.map(sanitizeQuestScriptPoint).slice(0, 24)
    : [{
      id: makeQuestScriptPointId(),
      title: 'Greeting',
      dialog: '',
      eventScript: '',
    }];

  return {
    npcId,
    townId,
    hutId,
    displayName,
    role: normalizeQuestRole(value.role),
    theme,
    position,
    greeting,
    scriptPoints,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : Date.now(),
  };
}

function isDarrelQuestNpcPosition(position: QuestNpcProgram['position']) {
  return Array.isArray(position) &&
    position.length === 3 &&
    position.every((coordinate, index) => Math.abs(coordinate - DARREL_QUEST_NPC_POSITION[index]) < 0.01);
}

function getInitialQuestNpcPrograms(): Record<string, QuestNpcProgram> {
  const raw = getStoredJson(QUEST_NPC_PROGRAMS_STORAGE_KEY);
  const programs: Record<string, QuestNpcProgram> = {};
  if (isRecord(raw)) {
    Object.values(raw).forEach((value) => {
      const program = sanitizeQuestNpcProgram(value as Record<string, unknown>);
      if (program) programs[program.npcId] = program;
    });
  }

  const existingDarrel = Object.values(programs).find((program) => isDarrelQuestNpc(program));
  Object.values(programs).forEach((program) => {
    if (program.npcId !== DARREL_QUEST_NPC_ID && isDarrelQuestNpc(program)) {
      delete programs[program.npcId];
    }
  });

  const homeDarrel = programs[DARREL_QUEST_NPC_ID];
  const darrelSource = existingDarrel ?? homeDarrel;
  const needsDarrelAnchor = !homeDarrel ||
    !isDarrelQuestNpcPosition(homeDarrel.position) ||
    homeDarrel.townId !== DARREL_HOME_TOWN_ID ||
    homeDarrel.hutId !== DARREL_HOME_HUT_ID ||
    homeDarrel.displayName !== 'Darrel' ||
    homeDarrel.role !== 'quest-giver';
  if (needsDarrelAnchor || existingDarrel?.npcId !== DARREL_QUEST_NPC_ID) {
    const defaultDarrel = createDefaultQuestNpcProgram({
      npcId: DARREL_QUEST_NPC_ID,
      townId: DARREL_HOME_TOWN_ID,
      hutId: DARREL_HOME_HUT_ID,
      defaultName: 'Darrel',
      theme: 'village',
      position: DARREL_QUEST_NPC_POSITION,
    });
    const anchoredDarrel = sanitizeQuestNpcProgram({
      ...defaultDarrel,
      ...darrelSource,
      npcId: DARREL_QUEST_NPC_ID,
      townId: DARREL_HOME_TOWN_ID,
      hutId: DARREL_HOME_HUT_ID,
      displayName: 'Darrel',
      role: 'quest-giver',
      theme: 'village',
      position: DARREL_QUEST_NPC_POSITION,
      updatedAt: darrelSource?.updatedAt ?? Date.now(),
    });
    if (anchoredDarrel) programs[DARREL_QUEST_NPC_ID] = anchoredDarrel;
    setStoredJson(QUEST_NPC_PROGRAMS_STORAGE_KEY, programs);
  }

  return programs;
}

function getInitialQuestUnlockedSpells(): SpellType[] {
  return sanitizeQuestUnlockedSpellList(getStoredJson(QUEST_UNLOCKED_SPELLS_STORAGE_KEY));
}

function getInitialQuestFlags(): Record<string, QuestFlagValue> {
  return sanitizeQuestFlagRecord(getStoredJson(QUEST_FLAGS_STORAGE_KEY));
}

function getInitialInventory(): InventoryRecord {
  return sanitizeInventoryRecord(getStoredJson(SURVIVAL_INVENTORY_STORAGE_KEY));
}

function buildSurvivalSaveProfile(value: {
  playerName: string;
  characterCustomization: unknown;
  survivalLevel?: unknown;
  survivalXp?: unknown;
  questUnlockedSpells?: unknown;
  questFlags?: unknown;
  spellQuestAssignments?: unknown;
  inventory?: unknown;
  lastMode?: unknown;
}): SurvivalSaveProfile | null {
  const playerName = sanitizePlayerName(value.playerName);
  if (playerName.length < 2) return null;
  const resolvedLevel = resolveSurvivalLevel(
    sanitizeInteger(value.survivalLevel, 1, 1, 999),
    sanitizeInteger(value.survivalXp, 0, 0, 99999999)
  );

  return {
    version: 1,
    playerName,
    characterCustomization: sanitizeCharacterCustomization(value.characterCustomization),
    survivalLevel: resolvedLevel.level,
    survivalXp: resolvedLevel.xp,
    questUnlockedSpells: sanitizeQuestUnlockedSpellList(value.questUnlockedSpells),
    questFlags: sanitizeQuestFlagRecord(value.questFlags),
    spellQuestAssignments: sanitizeSpellQuestAssignments(value.spellQuestAssignments),
    inventory: sanitizeInventoryRecord(value.inventory),
    lastMode: sanitizeSurvivalMode(value.lastMode),
    savedAt: Date.now(),
  };
}

function sanitizeSurvivalSaveProfile(value: unknown): SurvivalSaveProfile | null {
  if (!isRecord(value)) return null;
  const profile = buildSurvivalSaveProfile({
    playerName: typeof value.playerName === 'string' ? value.playerName : '',
    characterCustomization: isRecord(value.characterCustomization) ? value.characterCustomization : {},
    survivalLevel: value.survivalLevel,
    survivalXp: value.survivalXp,
    questUnlockedSpells: value.questUnlockedSpells,
    questFlags: value.questFlags,
    spellQuestAssignments: value.spellQuestAssignments,
    inventory: value.inventory,
    lastMode: value.lastMode,
  });

  if (!profile) return null;
  return {
    ...profile,
    savedAt: sanitizeInteger(value.savedAt, profile.savedAt, 0, Date.now()),
  };
}

function getInitialSurvivalSave(): SurvivalSaveProfile | null {
  return sanitizeSurvivalSaveProfile(getStoredJson(SURVIVAL_SAVE_STORAGE_KEY));
}

function persistSurvivalSave(profile: SurvivalSaveProfile) {
  setStoredJson(SURVIVAL_SAVE_STORAGE_KEY, profile);
  setStoredJson(QUEST_UNLOCKED_SPELLS_STORAGE_KEY, profile.questUnlockedSpells);
  setStoredJson(QUEST_FLAGS_STORAGE_KEY, profile.questFlags);
  setStoredJson(SURVIVAL_INVENTORY_STORAGE_KEY, profile.inventory);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, profile.playerName);
    } catch {
      // The in-memory save still works for this run if localStorage rejects writes.
    }
  }
}

function normalizeQuestEventCommand(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseQuestEventLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return null;
  const match = trimmed.match(/^([a-zA-Z][a-zA-Z0-9_-]*)(?:\s*[:=]\s*|\s+)?(.*)$/);
  if (!match) return null;
  return {
    command: normalizeQuestEventCommand(match[1]),
    value: (match[2] ?? '').trim(),
  };
}

function getSpellFromQuestValue(value: string): SpellType | null {
  const normalized = normalizeQuestLookupValue(value);
  return ALL_SPELLS.find((spell) => spell.toLowerCase() === normalized) ?? null;
}

function getQuestTeleportDestination(value: string) {
  const normalized = normalizeQuestLookupValue(value);
  if (!normalized || normalized === 'lilycoil' || normalized === 'coil' || normalized === 'springcoil' || normalized === 'purplecoil') {
    const spawn = getLilyCoilQuestSpawn();
    return {
      id: 'lily-coil',
      label: 'Lily Coil',
      position: { x: spawn.x, y: spawn.y, z: spawn.z },
      yaw: spawn.yaw,
    };
  }
  if (normalized === 'darrel' || normalized === 'darrelgrove' || normalized === 'grove') {
    const spawn = getDarrelQuestSpawn();
    return {
      id: 'darrel-grove',
      label: "Darrel's Grove",
      position: { x: spawn.x, y: spawn.y, z: spawn.z },
      yaw: spawn.yaw,
    };
  }

  return null;
}

function getCurrentQuestReturnPosition() {
  if (typeof window === 'undefined') return null;
  const position = (window as unknown as { localPlayerPos?: { x?: unknown; y?: unknown; z?: unknown } }).localPlayerPos;
  const x = Number(position?.x);
  const y = Number(position?.y);
  const z = Number(position?.z);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return { x, y: y + 1.5, z };
}

function parseQuestFlagAssignment(value: string) {
  const equalIndex = value.indexOf('=');
  if (equalIndex >= 0) {
    return {
      key: value.slice(0, equalIndex).trim(),
      value: value.slice(equalIndex + 1).trim() || 'true',
    };
  }

  const [key = '', ...rest] = value.split(/\s+/);
  return {
    key: key.trim(),
    value: rest.join(' ').trim() || 'true',
  };
}

const initialSurvivalSave = getInitialSurvivalSave();
const initialLocalPlayerName = initialSurvivalSave?.playerName ?? getInitialPlayerName();
const initialCharacterCustomization = initialSurvivalSave?.characterCustomization ?? { ...DEFAULT_CHARACTER_CUSTOMIZATION };
const initialQuestUnlockedSpells = initialSurvivalSave?.questUnlockedSpells ?? getInitialQuestUnlockedSpells();
const initialQuestFlags = initialSurvivalSave?.questFlags ?? getInitialQuestFlags();
const initialSpellQuestAssignments = initialSurvivalSave?.spellQuestAssignments ?? {};
const initialInventory = initialSurvivalSave?.inventory ?? getInitialInventory();

export const useGameStore = create<GameStore>((set, get) => ({
  isGameLaunched: false,
  setGameLaunched: (launched) => set({ isGameLaunched: launched }),
  gameMode: 'custom-lobby',
  setGameMode: (mode) => set({ gameMode: mode }),
  lobbyRules: { ...DEFAULT_LOBBY_RULES },
  setLobbyRules: (updates) => set((state) => ({ lobbyRules: { ...state.lobbyRules, ...updates } })),
  survivalRules: { ...DEFAULT_SURVIVAL_RULES },
  setSurvivalRules: (updates) => set((state) => ({ survivalRules: { ...state.survivalRules, ...updates } })),
  survivalSave: initialSurvivalSave,
  survivalLevel: initialSurvivalSave?.survivalLevel ?? 1,
  survivalXp: initialSurvivalSave?.survivalXp ?? 0,
  createNewSurvivalSave: ({ playerName, characterCustomization, mode = 'solo-survival' }) => {
    const profile = buildSurvivalSaveProfile({
      playerName,
      characterCustomization: characterCustomization ?? get().characterCustomization,
      survivalLevel: 1,
      survivalXp: 0,
      questUnlockedSpells: ['blink'],
      questFlags: {},
      spellQuestAssignments: {},
      inventory: {},
      lastMode: mode,
    });
    if (!profile) return null;

    persistSurvivalSave(profile);
    set({
      survivalSave: profile,
      survivalLevel: profile.survivalLevel,
      survivalXp: profile.survivalXp,
      localPlayerName: profile.playerName,
      characterCustomization: profile.characterCustomization,
      questUnlockedSpells: profile.questUnlockedSpells,
      questFlags: profile.questFlags,
      spellQuestAssignments: profile.spellQuestAssignments,
      inventory: profile.inventory,
      health: 100,
      armor: 0,
      leftRunePower: 0,
      rightRunePower: 0,
      thrusterFuel: 1,
      speedBoostUntil: 0,
      jumpBoostUntil: 0,
      slowUntil: 0,
      sleepUntil: 0,
      poisonUntil: 0,
      acidUntil: 0,
      magicGlassOrbUntil: 0,
    });
    return profile;
  },
  continueSurvivalSave: (mode) => {
    const state = get();
    const sourceProfile = state.survivalSave ?? getInitialSurvivalSave();
    if (!sourceProfile) return false;
    const profile = buildSurvivalSaveProfile({
      ...sourceProfile,
      playerName: sourceProfile.playerName,
      characterCustomization: sourceProfile.characterCustomization,
      spellQuestAssignments: sourceProfile.spellQuestAssignments,
      inventory: sourceProfile.inventory,
      lastMode: mode ?? sourceProfile.lastMode,
    });
    if (!profile) return false;

    persistSurvivalSave(profile);
    set({
      survivalSave: profile,
      survivalLevel: profile.survivalLevel,
      survivalXp: profile.survivalXp,
      localPlayerName: profile.playerName,
      characterCustomization: profile.characterCustomization,
      questUnlockedSpells: profile.questUnlockedSpells,
      questFlags: profile.questFlags,
      spellQuestAssignments: profile.spellQuestAssignments,
      inventory: profile.inventory,
    });
    return true;
  },
  saveSurvivalProgress: (updates = {}) => {
    const state = get();
    const baseProfile = state.survivalSave;
    const lastMode = updates.lastMode ?? (
      state.gameMode === 'solo-survival' || state.gameMode === 'multiplayer-survival'
        ? state.gameMode
        : baseProfile?.lastMode ?? 'solo-survival'
    );
    const profile = buildSurvivalSaveProfile({
      playerName: updates.playerName ?? state.localPlayerName ?? baseProfile?.playerName ?? '',
      characterCustomization: updates.characterCustomization ?? state.characterCustomization,
      survivalLevel: updates.survivalLevel ?? state.survivalLevel,
      survivalXp: updates.survivalXp ?? state.survivalXp,
      questUnlockedSpells: updates.questUnlockedSpells ?? state.questUnlockedSpells,
      questFlags: updates.questFlags ?? state.questFlags,
      spellQuestAssignments: updates.spellQuestAssignments ?? state.spellQuestAssignments,
      inventory: updates.inventory ?? state.inventory,
      lastMode,
    });
    if (!profile) return null;

    persistSurvivalSave(profile);
    set({
      survivalSave: profile,
      survivalLevel: profile.survivalLevel,
      survivalXp: profile.survivalXp,
      localPlayerName: profile.playerName,
      characterCustomization: profile.characterCustomization,
      questUnlockedSpells: profile.questUnlockedSpells,
      questFlags: profile.questFlags,
      spellQuestAssignments: profile.spellQuestAssignments,
      inventory: profile.inventory,
    });
    return profile;
  },
  clearSurvivalSave: () => {
    removeStoredValue(SURVIVAL_SAVE_STORAGE_KEY);
    removeStoredValue(QUEST_UNLOCKED_SPELLS_STORAGE_KEY);
    removeStoredValue(QUEST_FLAGS_STORAGE_KEY);
    removeStoredValue(SURVIVAL_INVENTORY_STORAGE_KEY);
    set({
      survivalSave: null,
      survivalLevel: 1,
      survivalXp: 0,
      questUnlockedSpells: ['blink'],
      questFlags: {},
      spellQuestAssignments: {},
      inventory: {},
    });
  },
  addSurvivalXp: (amount) => {
    const state = get();
    const resolved = resolveSurvivalLevel(state.survivalLevel, state.survivalXp + Math.max(0, Math.floor(amount)));
    set({
      survivalLevel: resolved.level,
      survivalXp: resolved.xp,
    });
    get().saveSurvivalProgress({
      survivalLevel: resolved.level,
      survivalXp: resolved.xp,
    });
  },
  health: 100,
  maxHealth: 100,
  setHealth: (h) => set({ health: Math.max(0, Math.min(100, h)) }),
  armor: 0,
  setArmor: (a) => set({ armor: Math.max(0, Math.min(ARMOR_MAX, a)) }),
  damagePlayer: (damage) => set((state) => {
    const incomingDamage = Math.max(0, damage);
    const armorDamage = Math.min(state.armor, incomingDamage);
    const healthDamage = incomingDamage - armorDamage;

    return {
      armor: Math.max(0, state.armor - armorDamage),
      health: Math.max(0, Math.min(100, state.health - healthDamage)),
    };
  }),
  activateMagicArmor: () => set({ armor: ARMOR_MAX }),
  speedBoostUntil: 0,
  jumpBoostUntil: 0,
  slowUntil: 0,
  sleepUntil: 0,
  poisonUntil: 0,
  acidUntil: 0,
  magicGlassOrbUntil: 0,
  isAstralMeditating: false,
  astralMeditationStartedAt: 0,
  survivalTimeOverrideSeconds: null,
  activateSpeedBoost: () => set({ speedBoostUntil: Date.now() + SPEED_BOOST_DURATION_MS }),
  activateJumpBoost: () => set({ jumpBoostUntil: Date.now() + JUMP_BOOST_DURATION_MS }),
  activateMagicGlassOrb: () => set({ magicGlassOrbUntil: Number.MAX_SAFE_INTEGER }),
  setAstralMeditating: (active) => set({
    isAstralMeditating: active,
    astralMeditationStartedAt: active ? Date.now() : 0,
    isChargingSpell: active ? false : get().isChargingSpell,
    chargingHand: active ? null : get().chargingHand,
    chargingHands: active ? { left: false, right: false } : get().chargingHands,
  }),
  setSurvivalTimeOverrideSeconds: (seconds) => set({
    survivalTimeOverrideSeconds: seconds === null ? null : Math.max(0, seconds),
  }),
  setStatusEffect: (effect, until) => set(() => {
    const clampedUntil = Math.max(0, until);
    if (effect === 'slow') return { slowUntil: clampedUntil };
    if (effect === 'sleep') return { sleepUntil: clampedUntil };
    if (effect === 'poison') return { poisonUntil: clampedUntil };
    return { acidUntil: clampedUntil };
  }),
  applyStatusEffect: (effect, durationMs) => {
    const until = Date.now() + Math.max(0, durationMs);
    get().setStatusEffect(effect, until);
  },
  clearStatusEffect: (effect) => get().setStatusEffect(effect, 0),
  clearToxicEffects: () => set({ poisonUntil: 0, acidUntil: 0 }),
  thrusterFuel: 1.0,
  setThrusterFuel: (f) => set({ thrusterFuel: f }),
  leftRunePower: 0,
  rightRunePower: 0,
  setLeftRunePower: (f) => set({ leftRunePower: Math.max(0, Math.min(RUNE_POWER_MAX, f)) }),
  setRightRunePower: (f) => set({ rightRunePower: Math.max(0, Math.min(RUNE_POWER_MAX, f)) }),
  currentSpell: 'fireball',
  leftCurrentSpell: 'fireball',
  rightCurrentSpell: 'iceshard',
  activeHand: 'left',
  setActiveHand: (hand) => set((state) => ({
    activeHand: hand,
    currentSpell: hand === 'right' ? state.rightCurrentSpell : state.leftCurrentSpell,
  })),
  setSpell: (spell, handArg) => set((state) => {
    const hand = getHandKey(handArg ?? state.activeHand);
    const hotbar = hand === 'right' ? state.rightHotbarSpells : state.leftHotbarSpells;
    const hotbarIndex = hotbar.indexOf(spell);

    if (hand === 'right') {
      return {
        rightCurrentSpell: spell,
        rightSelectedHotbarIndex: hotbarIndex === -1 ? state.rightSelectedHotbarIndex : hotbarIndex,
        currentSpell: state.activeHand === 'right' ? spell : state.currentSpell,
      };
    }

    return {
      currentSpell: state.activeHand === 'left' ? spell : state.currentSpell,
      leftCurrentSpell: spell,
      selectedHotbarIndex: hotbarIndex === -1 ? state.leftSelectedHotbarIndex : hotbarIndex,
      leftSelectedHotbarIndex: hotbarIndex === -1 ? state.leftSelectedHotbarIndex : hotbarIndex,
    };
  }),
  hotbarSpells: DEFAULT_HOTBAR_SPELLS,
  leftHotbarSpells: DEFAULT_HOTBAR_SPELLS,
  rightHotbarSpells: DEFAULT_RIGHT_HOTBAR_SPELLS,
  selectedHotbarIndex: 0,
  leftSelectedHotbarIndex: 0,
  rightSelectedHotbarIndex: 0,
  setHotbarSpell: (slotIndex, spell, handArg) => set((state) => {
    const normalizedIndex = normalizeHotbarIndex(slotIndex);
    const hand = getHandKey(handArg ?? state.activeHand);

    if (hand === 'right') {
      const rightHotbarSpells = [...state.rightHotbarSpells];
      rightHotbarSpells[normalizedIndex] = spell;

      return {
        rightHotbarSpells,
        rightCurrentSpell: normalizedIndex === state.rightSelectedHotbarIndex ? spell : state.rightCurrentSpell,
        currentSpell: state.activeHand === 'right' && normalizedIndex === state.rightSelectedHotbarIndex ? spell : state.currentSpell,
      };
    }

    const leftHotbarSpells = [...state.leftHotbarSpells];
    leftHotbarSpells[normalizedIndex] = spell;

    return {
      hotbarSpells: leftHotbarSpells,
      leftHotbarSpells,
      currentSpell: state.activeHand === 'left' && normalizedIndex === state.leftSelectedHotbarIndex ? spell : state.currentSpell,
      leftCurrentSpell: normalizedIndex === state.leftSelectedHotbarIndex ? spell : state.leftCurrentSpell,
    };
  }),
  selectHotbarSlot: (slotIndex, handArg) => {
    const normalizedIndex = normalizeHotbarIndex(slotIndex);
    const hand = getHandKey(handArg ?? get().activeHand);
    const state = get();

    if (hand === 'right') {
      const spell = state.rightHotbarSpells[normalizedIndex];
      set({
        activeHand: 'right',
        rightSelectedHotbarIndex: normalizedIndex,
        rightCurrentSpell: spell,
        currentSpell: spell,
      });
      return;
    }

    const spell = state.leftHotbarSpells[normalizedIndex];
    set({
      activeHand: 'left',
      hotbarSpells: state.leftHotbarSpells,
      selectedHotbarIndex: normalizedIndex,
      leftSelectedHotbarIndex: normalizedIndex,
      leftCurrentSpell: spell,
      currentSpell: spell,
    });
  },
  isMagicArmed: true,
  setMagicArmed: (armed) => set({
    isMagicArmed: armed,
    ...(!armed ? {
      isChargingSpell: false,
      chargingHand: null,
      chargingHands: { left: false, right: false },
    } : {}),
  }),
  toggleMagicArmed: () => set((state) => {
    const isMagicArmed = !state.isMagicArmed;
    return {
      isMagicArmed,
      ...(!isMagicArmed ? {
        isChargingSpell: false,
        chargingHand: null,
        chargingHands: { left: false, right: false },
      } : {}),
    };
  }),
  isSpellMenuOpen: false,
  setSpellMenuOpen: (open) => set({
    isSpellMenuOpen: open,
    isChargingSpell: open ? false : get().isChargingSpell,
    chargingHand: open ? null : get().chargingHand,
    chargingHands: open ? { left: false, right: false } : get().chargingHands,
  }),
  toggleSpellMenu: () => set((state) => ({
    isSpellMenuOpen: !state.isSpellMenuOpen,
    isChargingSpell: state.isSpellMenuOpen ? state.isChargingSpell : false,
    chargingHand: state.isSpellMenuOpen ? state.chargingHand : null,
    chargingHands: state.isSpellMenuOpen ? state.chargingHands : { left: false, right: false },
  })),
  isChargingSpell: false,
  chargingHands: { left: false, right: false },
  setIsChargingSpell: (c) => set((state) => {
    if (!c) {
      return {
        isChargingSpell: false,
        chargingHand: null,
        chargingHands: { left: false, right: false },
      };
    }

    const hand = state.chargingHand ?? state.activeHand;
    return {
      isChargingSpell: true,
      chargingHand: hand,
      chargingHands: { ...state.chargingHands, [hand]: true },
    };
  }),
  chargingHand: null,
  setChargingHand: (hand) => set({ chargingHand: hand, activeHand: hand ?? get().activeHand }),
  setHandCharging: (hand, charging) => set((state) => {
    const chargingHands = { ...state.chargingHands, [hand]: charging };
    const fallbackChargingHand = chargingHands.right ? 'right' : chargingHands.left ? 'left' : null;

    return {
      chargingHands,
      isChargingSpell: chargingHands.left || chargingHands.right,
      chargingHand: charging ? hand : state.chargingHand === hand ? fallbackChargingHand : state.chargingHand,
      activeHand: charging ? hand : state.activeHand,
    };
  }),
  flashbangOpacity: 0,
  setFlashbangOpacity: (o) => set({ flashbangOpacity: o }),
  nextSpell: (handArg) => {
    const state = get();
    const hand = getHandKey(handArg ?? state.activeHand);

    if (hand === 'right') {
      const nextIndex = normalizeHotbarIndex(state.rightSelectedHotbarIndex + 1);
      set({
        activeHand: 'right',
        rightSelectedHotbarIndex: nextIndex,
        rightCurrentSpell: state.rightHotbarSpells[nextIndex],
        currentSpell: state.rightHotbarSpells[nextIndex],
      });
      return;
    }

    const nextIndex = normalizeHotbarIndex(state.leftSelectedHotbarIndex + 1);
    set({
      activeHand: 'left',
      selectedHotbarIndex: nextIndex,
      leftSelectedHotbarIndex: nextIndex,
      leftCurrentSpell: state.leftHotbarSpells[nextIndex],
      currentSpell: state.leftHotbarSpells[nextIndex],
    });
  },
  prevSpell: (handArg) => {
    const state = get();
    const hand = getHandKey(handArg ?? state.activeHand);

    if (hand === 'right') {
      const prevIndex = normalizeHotbarIndex(state.rightSelectedHotbarIndex - 1);
      set({
        activeHand: 'right',
        rightSelectedHotbarIndex: prevIndex,
        rightCurrentSpell: state.rightHotbarSpells[prevIndex],
        currentSpell: state.rightHotbarSpells[prevIndex],
      });
      return;
    }

    const prevIndex = normalizeHotbarIndex(state.leftSelectedHotbarIndex - 1);
    set({
      activeHand: 'left',
      selectedHotbarIndex: prevIndex,
      leftSelectedHotbarIndex: prevIndex,
      leftCurrentSpell: state.leftHotbarSpells[prevIndex],
      currentSpell: state.leftHotbarSpells[prevIndex],
    });
  },

  isMapExpanded: false,
  expandedMapPage: 'live',
  mapWaypoint: null,
  toggleMap: () => set((state) => {
    const isMapExpanded = !state.isMapExpanded;
    return {
      isMapExpanded,
      expandedMapPage: isMapExpanded ? 'live' : state.expandedMapPage,
    };
  }),
  setExpandedMapPage: (page) => set({ expandedMapPage: page }),
  setMapWaypoint: (waypoint) => set({ mapWaypoint: waypoint }),
  clearMapWaypoint: () => set({ mapWaypoint: null }),
  isPauseMenuOpen: false,
  setPauseMenuOpen: (open) => set({ isPauseMenuOpen: open }),
  isScoreboardOpen: false,
  setScoreboardOpen: (open) => set({ isScoreboardOpen: open }),
  isInventoryOpen: false,
  setInventoryOpen: (open) => set({
    isInventoryOpen: open,
    ...(open ? {
      isChargingSpell: false,
      chargingHand: null,
      chargingHands: { left: false, right: false },
      isTouchControlsActive: false,
      isControllerGameplayActive: false,
    } : {}),
  }),
  toggleInventory: () => set((state) => ({
    isInventoryOpen: !state.isInventoryOpen,
    ...(!state.isInventoryOpen ? {
      isChargingSpell: false,
      chargingHand: null,
      chargingHands: { left: false, right: false },
      isTouchControlsActive: false,
      isControllerGameplayActive: false,
    } : {}),
  })),
  inventory: initialInventory,
  addInventoryItem: (itemId, quantity = 1) => {
    const state = get();
    const inventory = addInventoryQuantity(state.inventory, itemId, quantity);
    set({ inventory });
    setStoredJson(SURVIVAL_INVENTORY_STORAGE_KEY, inventory);
    if (get().survivalSave) {
      get().saveSurvivalProgress({ inventory });
    }
  },
  removeInventoryItem: (itemId, quantity = 1) => {
    const state = get();
    const inventory = removeInventoryQuantity(state.inventory, itemId, quantity);
    if (!inventory) return false;
    set({ inventory });
    setStoredJson(SURVIVAL_INVENTORY_STORAGE_KEY, inventory);
    if (get().survivalSave) {
      get().saveSurvivalProgress({ inventory });
    }
    return true;
  },
  collectDarrelIngredient: (ingredient) => {
    const state = get();
    if (state.gameMode !== 'solo-survival' && state.gameMode !== 'multiplayer-survival') {
      const message = 'Darrel ingredients can only be gathered in survival mode.';
      state.addLobbyMessage(message, 'system');
      return [message];
    }

    const quest = getSpellQuestDefinition(DARREL_QUEST_REWARD_SPELL);
    const hasDarrelQuest = isQuestFlagTruthy(state.questFlags[DARREL_QUEST_ACCEPTED_FLAG]) ||
      Object.values(state.spellQuestAssignments).some((assignment) => assignment.spell === DARREL_QUEST_REWARD_SPELL && assignment.status !== 'completed');
    if (!quest || !hasDarrelQuest) {
      const message = 'Darrel has not offered the garden draught job yet.';
      state.addLobbyMessage(message, 'system');
      return [message];
    }

    const itemId = DARREL_INVENTORY_ITEM_IDS[ingredient];
    if (getInventoryQuantity(state.inventory, itemId) >= 1) {
      const message = `${INVENTORY_ITEM_DEFINITIONS[itemId].name} already gathered.`;
      state.addLobbyMessage(message, 'system');
      return [message];
    }

    const flagKey = ingredient === 'leaves'
      ? DARREL_LEAVES_FLAG
      : ingredient === 'berries'
        ? DARREL_BERRIES_FLAG
        : DARREL_ROOTS_FLAG;
    const inventory = addInventoryQuantity(state.inventory, itemId, 1);
    const questFlags = {
      ...state.questFlags,
      [DARREL_QUEST_ACCEPTED_FLAG]: true,
      [flagKey]: 'gathered' as QuestFlagValue,
      [`quest:${quest.id}`]: 'started' as QuestFlagValue,
    };
    const message = `Gathered ${INVENTORY_ITEM_DEFINITIONS[itemId].name} from the fields.`;

    set({ inventory, questFlags });
    setStoredJson(SURVIVAL_INVENTORY_STORAGE_KEY, inventory);
    setStoredJson(QUEST_FLAGS_STORAGE_KEY, questFlags);
    if (get().survivalSave) {
      get().saveSurvivalProgress({ inventory, questFlags });
    }
    get().addLobbyMessage(message, 'system');
    return [message];
  },
  brewDarrelGardenDraught: () => {
    const state = get();
    const quest = getSpellQuestDefinition(DARREL_QUEST_REWARD_SPELL);
    const hasDarrelQuest = isQuestFlagTruthy(state.questFlags[DARREL_QUEST_ACCEPTED_FLAG]) ||
      Object.values(state.spellQuestAssignments).some((assignment) => assignment.spell === DARREL_QUEST_REWARD_SPELL && assignment.status !== 'completed');
    if (!quest || !hasDarrelQuest) {
      const message = 'Darrel has not offered the garden draught job yet.';
      state.addLobbyMessage(message, 'system');
      return [message];
    }

    const missingIngredients = (['leaves', 'berries', 'roots'] as DarrelIngredient[]).filter((ingredient) => (
      getInventoryQuantity(state.inventory, DARREL_INVENTORY_ITEM_IDS[ingredient]) < 1
    ));
    if (missingIngredients.length > 0) {
      const message = `Missing ${missingIngredients.join(', ')} for the garden draught.`;
      state.addLobbyMessage(message, 'system');
      return [message];
    }

    let inventory = state.inventory;
    (['leaves', 'berries', 'roots'] as DarrelIngredient[]).forEach((ingredient) => {
      const nextInventory = removeInventoryQuantity(inventory, DARREL_INVENTORY_ITEM_IDS[ingredient], 1);
      if (nextInventory) inventory = nextInventory;
    });
    inventory = addInventoryQuantity(inventory, DARREL_INVENTORY_ITEM_IDS.draught, 1);
    const questFlags = {
      ...state.questFlags,
      [DARREL_LEAVES_FLAG]: 'brewed' as QuestFlagValue,
      [DARREL_BERRIES_FLAG]: 'brewed' as QuestFlagValue,
      [DARREL_ROOTS_FLAG]: 'brewed' as QuestFlagValue,
      [DARREL_POTION_FLAG]: 'brewed' as QuestFlagValue,
      [`quest:${quest.id}`]: 'started' as QuestFlagValue,
    };
    const message = 'Brewed the garden draught.';

    set({ inventory, questFlags });
    setStoredJson(SURVIVAL_INVENTORY_STORAGE_KEY, inventory);
    setStoredJson(QUEST_FLAGS_STORAGE_KEY, questFlags);
    if (get().survivalSave) {
      get().saveSurvivalProgress({ inventory, questFlags });
    }
    get().addLobbyMessage(message, 'system');
    return [message];
  },
  drinkDarrelGardenDraught: () => {
    const state = get();
    const quest = getSpellQuestDefinition(DARREL_QUEST_REWARD_SPELL);
    if (!quest) return [];
    if (getInventoryQuantity(state.inventory, DARREL_INVENTORY_ITEM_IDS.draught) < 1) {
      const message = 'No garden draught in inventory.';
      state.addLobbyMessage(message, 'system');
      return [message];
    }

    const inventory = removeInventoryQuantity(state.inventory, DARREL_INVENTORY_ITEM_IDS.draught, 1);
    if (!inventory) return [];

    const questFlags = {
      ...state.questFlags,
      [DARREL_POTION_FLAG]: 'drunk' as QuestFlagValue,
      [`quest:${quest.id}`]: 'started' as QuestFlagValue,
    };
    const matchingAssignment = Object.values(state.spellQuestAssignments).find((assignment) => (
      isAcceptedDarrelQuestAssignment(assignment, questFlags)
    ));
    const message = 'The garden draught pulls you toward the sacred garden.';

    set({ inventory, questFlags, isInventoryOpen: false });
    setStoredJson(SURVIVAL_INVENTORY_STORAGE_KEY, inventory);
    setStoredJson(QUEST_FLAGS_STORAGE_KEY, questFlags);
    if (get().survivalSave) {
      get().saveSurvivalProgress({ inventory, questFlags });
    }

    if (typeof window !== 'undefined') {
      if (matchingAssignment?.npcId) {
        (window as unknown as { __darrelQuestNpcId?: string }).__darrelQuestNpcId = matchingAssignment.npcId;
      }
      const returnPosition = getCurrentQuestReturnPosition();
      if (returnPosition) {
        (window as unknown as { __darrelQuestReturnPosition?: { x: number; y: number; z: number } }).__darrelQuestReturnPosition = returnPosition;
      }
      window.dispatchEvent(new CustomEvent('teleportPlayer', {
        detail: getDarrelQuestSpawn(),
      }));
    }

    get().addLobbyMessage(message, 'system');
    return [message];
  },
  isVClipEnabled: false,
  setVClipEnabled: (enabled) => set({ isVClipEnabled: enabled }),
  isTouchControlsActive: false,
  setTouchControlsActive: (active) => set({ isTouchControlsActive: active }),
  isControllerGameplayActive: false,
  setControllerGameplayActive: (active) => set({ isControllerGameplayActive: active }),
  keyboardArrowLookEnabled: DEFAULT_KEYBOARD_ARROW_LOOK_ENABLED,
  setKeyboardArrowLookEnabled: (enabled) => set({ keyboardArrowLookEnabled: enabled }),
  mouseSensitivity: DEFAULT_MOUSE_SENSITIVITY,
  controllerLookSensitivity: DEFAULT_CONTROLLER_LOOK_SENSITIVITY,
  setMouseSensitivity: (value) => set({ mouseSensitivity: Math.max(0.0005, Math.min(0.006, value)) }),
  setControllerLookSensitivity: (value) => set({ controllerLookSensitivity: Math.max(0.8, Math.min(6, value)) }),
  controllerBindings: { ...DEFAULT_CONTROLLER_BINDINGS },
  setControllerBinding: (action, button) => set((state) => ({
    controllerBindings: { ...state.controllerBindings, [action]: button },
  })),
  voiceChatEnabled: false,
  voiceInputMode: 'openMic',
  voicePushToTalkKey: DEFAULT_VOICE_PUSH_TO_TALK_KEY,
  voiceOutputVolume: DEFAULT_VOICE_OUTPUT_VOLUME,
  voiceProximityRange: DEFAULT_VOICE_PROXIMITY_RANGE,
  isVoiceSpeaking: false,
  voiceStatus: 'Off',
  voiceError: '',
  setVoiceChatEnabled: (enabled) => set({ voiceChatEnabled: enabled }),
  setVoiceInputMode: (mode) => set({ voiceInputMode: mode }),
  setVoicePushToTalkKey: (code) => set({ voicePushToTalkKey: code || DEFAULT_VOICE_PUSH_TO_TALK_KEY }),
  setVoiceOutputVolume: (value) => set({ voiceOutputVolume: Math.max(0, Math.min(1, value)) }),
  setVoiceProximityRange: (value) => set({ voiceProximityRange: Math.max(8, Math.min(64, value)) }),
  setVoiceSpeaking: (speaking) => set((state) => state.isVoiceSpeaking === speaking ? state : { isVoiceSpeaking: speaking }),
  setVoiceStatus: (status) => set((state) => state.voiceStatus === status ? state : { voiceStatus: status }),
  setVoiceError: (error) => set((state) => state.voiceError === error ? state : { voiceError: error }),
  characterCustomization: initialCharacterCustomization,
  setCharacterCustomization: (updates) => set((state) => {
    const nextCustomization = {
      ...state.characterCustomization,
      ...updates,
    };
    const matchingOutfitColor = updates.topColor ?? updates.hatColor;
    if (matchingOutfitColor) {
      nextCustomization.topColor = matchingOutfitColor;
      nextCustomization.hatColor = matchingOutfitColor;
    } else {
      nextCustomization.hatColor = nextCustomization.topColor;
    }

    let survivalSave = state.survivalSave;
    if (survivalSave) {
      const profile = buildSurvivalSaveProfile({
        ...survivalSave,
        playerName: state.localPlayerName || survivalSave.playerName,
        characterCustomization: nextCustomization,
      });
      if (profile) {
        survivalSave = profile;
        persistSurvivalSave(profile);
      }
    }

    return { characterCustomization: nextCustomization, survivalSave };
  }),
  localPlayerName: initialLocalPlayerName,
  setLocalPlayerName: (name) => {
    const sanitized = sanitizePlayerName(name);
    if (typeof window !== 'undefined') {
      if (sanitized) {
        window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, sanitized);
      } else {
        window.localStorage.removeItem(PLAYER_NAME_STORAGE_KEY);
      }
    }
    set((state) => {
      let survivalSave = state.survivalSave;
      if (survivalSave && sanitized.length >= 2) {
        const profile = buildSurvivalSaveProfile({
          ...survivalSave,
          playerName: sanitized,
          characterCustomization: state.characterCustomization,
        });
        if (profile) {
          survivalSave = profile;
          persistSurvivalSave(profile);
        }
      }
      return { localPlayerName: sanitized, survivalSave };
    });
  },
  lobbyMessages: [],
  addLobbyMessage: (text, tone = 'system') => set((state) => {
    const now = Date.now();
    const recentlyShown = state.lobbyMessages.some((message) =>
      message.text === text &&
      message.tone === tone &&
      now - message.createdAt < 4500
    );
    if (recentlyShown) return state;
    return {
      lobbyMessages: [...state.lobbyMessages, makeLobbyMessage(text, tone)].slice(-4),
    };
  }),
  removeLobbyMessage: (id) => set((state) => ({
    lobbyMessages: state.lobbyMessages.filter((message) => message.id !== id),
  })),

  aspectRatio: getInitialAspectRatio(),
  setAspectRatio: (ratio) => {
    const nextAspectRatio = sanitizeAspectRatio(ratio);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(ASPECT_RATIO_STORAGE_KEY, nextAspectRatio);
      } catch {
        // Storage can be unavailable in private/restricted browser modes.
      }
    }
    set({ aspectRatio: nextAspectRatio });
  },

  isQuestDevModeEnabled: false,
  setQuestDevModeEnabled: (enabled) => set({ isQuestDevModeEnabled: enabled }),
  questNpcEditorTarget: null,
  openQuestNpcEditor: (target) => set({
    questNpcEditorTarget: target,
    questDialogSession: null,
    isChargingSpell: false,
    chargingHand: null,
    chargingHands: { left: false, right: false },
  }),
  closeQuestNpcEditor: () => set({ questNpcEditorTarget: null }),
  questNpcPrograms: getInitialQuestNpcPrograms(),
  upsertQuestNpcProgram: (program) => {
    const sanitized = sanitizeQuestNpcProgram({ ...program, updatedAt: Date.now() });
    if (!sanitized) return;
    set((state) => {
      const questNpcPrograms = {
        ...state.questNpcPrograms,
        [sanitized.npcId]: sanitized,
      };
      setStoredJson(QUEST_NPC_PROGRAMS_STORAGE_KEY, questNpcPrograms);
      return { questNpcPrograms };
    });
  },
  removeQuestNpcProgram: (npcId) => set((state) => {
    const questNpcPrograms = { ...state.questNpcPrograms };
    delete questNpcPrograms[npcId];
    setStoredJson(QUEST_NPC_PROGRAMS_STORAGE_KEY, questNpcPrograms);
    return { questNpcPrograms };
  }),
  questDialogSession: null,
  closeQuestDialog: () => set({ questDialogSession: null }),
  chooseQuestDialogChoice: (choiceId) => {
    const state = get();
    const session = state.questDialogSession;
    if (!session) return;

    if (choiceId === 'darrel-dragon-fight') {
      const questFlags = {
        ...state.questFlags,
        [DARREL_DRAGON_WOKEN_FLAG]: true,
        [DARREL_DRAGON_FOUGHT_FLAG]: true,
      };
      const line = 'Player: I will fight you and take the Healing Crystals by force, killing you and taking control of this realm for myself.\n\nSpirit Dragon: That was a whole villain speech for someone standing in my living room. Adorable. Take a nap.';
      set({
        questFlags,
        armor: 0,
        health: 0,
        questDialogSession: {
          ...session,
          displayName: 'Spirit Dragon',
          line,
          choices: [{ id: 'darrel-close', label: 'Respawn and reconsider' }],
        },
      });
      setStoredJson(QUEST_FLAGS_STORAGE_KEY, questFlags);
      if (get().survivalSave) {
        get().saveSurvivalProgress({ questFlags });
      }
      get().addLobbyMessage('Spirit Dragon: villain speech detected. Nap administered.', 'system');
      return;
    }

    if (choiceId === 'darrel-dragon-peace') {
      const quest = getSpellQuestDefinition(DARREL_QUEST_REWARD_SPELL);
      if (!quest) {
        set({
          questDialogSession: {
            ...session,
            line: 'Spirit Dragon: I would help, but the crystal quest paperwork has wandered off.',
            choices: [{ id: 'darrel-close', label: 'Close' }],
          },
        });
        return;
      }

      const matchingAssignment = findAcceptedDarrelQuestAssignment(state.spellQuestAssignments, state.questFlags);
      const targetNpcId = matchingAssignment?.npcId ?? (typeof window !== 'undefined'
        ? (window as unknown as { __darrelQuestNpcId?: string }).__darrelQuestNpcId
        : undefined) ?? DARREL_QUEST_NPC_ID;
      const program = state.questNpcPrograms[targetNpcId];
      const npc: QuestNpcDescriptor = {
        npcId: targetNpcId,
        townId: program?.townId ?? DARREL_HOME_TOWN_ID,
        displayName: 'Darrel',
      };
      const assignment = matchingAssignment ?? makeSpellQuestAssignment(npc, quest);
      const completedAssignment: QuestNpcAssignment = {
        ...assignment,
        npcId: targetNpcId,
        townId: npc.townId,
        displayName: 'Darrel',
        status: 'completed',
        completedAt: Date.now(),
      };
      const questUnlockedSpells = Array.from(new Set([...state.questUnlockedSpells, DARREL_QUEST_REWARD_SPELL]));
      const questFlags = {
        ...state.questFlags,
        [DARREL_DRAGON_WOKEN_FLAG]: true,
        [DARREL_DRAGON_PEACEFUL_FLAG]: true,
        [quest.requiredFlag]: true,
        [`quest:${quest.id}`]: 'completed' as QuestFlagValue,
        'quest:darrel-grove': 'completed' as QuestFlagValue,
      };
      const spellQuestAssignments = {
        ...state.spellQuestAssignments,
        [targetNpcId]: completedAssignment,
      };
      const inventory = addInventoryQuantity(state.inventory, DARREL_INVENTORY_ITEM_IDS.crystals, 2);
      const line = 'Player: I need Healing Crystals for a friend in need, and for myself.\n\nSpirit Dragon: Oh good. I thought you had come to slay me and steal my Healing Crystals, but you are a good man and I would be glad to call you my friend.\n\nSpirit Dragon: Here, have some soft tacos and lemonade. I grabbed you enough crystals for Darrel and for your own spellwork.';

      set({
        questUnlockedSpells,
        questFlags,
        spellQuestAssignments,
        inventory,
        questDialogSession: {
          ...session,
          displayName: 'Spirit Dragon',
          line,
          choices: [{ id: 'darrel-close', label: 'Thank the dragon' }],
        },
      });
      setStoredJson(QUEST_UNLOCKED_SPELLS_STORAGE_KEY, questUnlockedSpells);
      setStoredJson(QUEST_FLAGS_STORAGE_KEY, questFlags);
      setStoredJson(SURVIVAL_INVENTORY_STORAGE_KEY, inventory);
      if (get().survivalSave) {
        get().saveSurvivalProgress({ questUnlockedSpells, questFlags, spellQuestAssignments, inventory });
      }
      get().addLobbyMessage('Healing Crystals unlocked. The Spirit Dragon packed tacos and lemonade.', 'system');
      return;
    }

    if (choiceId === 'darrel-close') {
      set({ questDialogSession: null });
      return;
    }

    if (choiceId === 'darrel-jerk') {
      set({
        questDialogSession: {
          ...session,
          line: 'Player: None of your business.\n\nDarrel: Then my business is none of yours. Try again when you remember how doors work.',
          choices: [
            { id: 'darrel-two-spells', label: 'What kind of wizard has only 2 spells?' },
            { id: 'darrel-close', label: 'Leave' },
          ],
        },
      });
      return;
    }

    if (choiceId === 'darrel-two-spells') {
      set({
        questDialogSession: {
          ...session,
          line: 'Player: What kind of wizard has only 2 spells?\n\nDarrel: A pitiful one. Fine. I have a job if you want a spell. Travel to the sacred garden in an alternate dimension, face the spirit dragon, and bring back healing crystals.\n\nDarrel: First you need a garden draught. Go to the fields, gather 1 leaves, 1 berries, and 1 roots. Brew it at any brewing station you own, buy, craft, or find in a village. Drink it, and it will send you where you need to go.',
          choices: [
            { id: 'darrel-accept-job', label: 'Take the job' },
            { id: 'darrel-close', label: 'Not right now' },
          ],
        },
      });
      return;
    }

    if (choiceId !== 'darrel-accept-job') return;

    const quest = getSpellQuestDefinition(DARREL_QUEST_REWARD_SPELL);
    if (!quest) {
      set({
        questDialogSession: {
          ...session,
          line: 'Darrel: The spell paperwork vanished. Annoying. Try again after the quest list is fixed.',
          choices: [{ id: 'darrel-close', label: 'Close' }],
        },
      });
      return;
    }

    const npc: QuestNpcDescriptor = {
      npcId: session.npcId,
      townId: session.townId,
      displayName: session.displayName,
    };
    const existingAssignment = state.spellQuestAssignments[npc.npcId];
    const assignment = existingAssignment?.spell === DARREL_QUEST_REWARD_SPELL
      ? {
        ...existingAssignment,
        displayName: npc.displayName,
        townId: npc.townId,
      }
      : makeSpellQuestAssignment(npc, quest);
    const questFlags = makeDarrelStartedFlags(quest, state.questFlags);
    const spellQuestAssignments = {
      ...state.spellQuestAssignments,
      [npc.npcId]: assignment,
    };
    const questDialogSession: QuestDialogSession = {
      ...session,
      line: 'Darrel: Good. Leaves, berries, roots. One of each, all from the fields. Brew the garden draught at a brewing station, drink it, and it will take you to the sacred garden.\n\nDarrel: The spirit dragon is supposed to fight you. If it offers lemonade, that is probably normal. Bring back the Healing Crystals.',
      choices: [{ id: 'darrel-close', label: 'Head to the fields' }],
    };

    set({
      questFlags,
      spellQuestAssignments,
      questDialogSession,
    });
    setStoredJson(QUEST_FLAGS_STORAGE_KEY, questFlags);
    if (get().survivalSave) {
      get().saveSurvivalProgress({ questFlags, spellQuestAssignments });
    }
    get().addLobbyMessage('Darrel: job accepted - gather leaves, berries, and roots in the fields.', 'system');
  },
  questUnlockedSpells: initialQuestUnlockedSpells,
  questFlags: initialQuestFlags,
  spellQuestAssignments: initialSpellQuestAssignments,
  interactWithQuestVillager: (npc, options = {}) => {
    const state = get();
    if (state.gameMode !== 'solo-survival' && state.gameMode !== 'multiplayer-survival') {
      return [];
    }

    const shouldAnnounce = options.announce !== false;
    const messages: string[] = [];
    let questUnlockedSpells = [...state.questUnlockedSpells];
    let questFlags = { ...state.questFlags };
    let spellQuestAssignments = { ...state.spellQuestAssignments };
    let inventory = state.inventory;
    let assignment = spellQuestAssignments[npc.npcId];
    let isNewAssignment = false;
    const isDarrelNpc = isDarrelQuestNpc(npc) ||
      (assignment ? isAcceptedDarrelQuestAssignment(assignment, questFlags) : false);

    if (isDarrelNpc) {
      const darrelNpc = { ...npc, displayName: 'Darrel' };
      const questDialogSession = getDarrelQuestDialogSession(darrelNpc, questUnlockedSpells, questFlags, spellQuestAssignments);
      set({
        questDialogSession,
        isChargingSpell: false,
        chargingHand: null,
        chargingHands: { left: false, right: false },
        isTouchControlsActive: false,
        isControllerGameplayActive: false,
      });
      releaseQuestDialogControls();
      return [questDialogSession.line];
    }

    if (
      assignment &&
      isDarrelQuestNpc(npc) &&
      assignment.spell !== DARREL_QUEST_REWARD_SPELL &&
      !questUnlockedSpells.includes(DARREL_QUEST_REWARD_SPELL)
    ) {
      const darrelQuest = getSpellQuestDefinition(DARREL_QUEST_REWARD_SPELL);
      if (darrelQuest) {
        assignment = makeSpellQuestAssignment(npc, darrelQuest);
        spellQuestAssignments[npc.npcId] = assignment;
        questFlags[`quest:${darrelQuest.id}`] = 'started';
        isNewAssignment = true;
        messages.push(`${npc.displayName}: grove trial opened - ${darrelQuest.title}.`);
      }
    }

    if (!assignment) {
      const pickedQuest = pickSpellQuestForNpc(npc, questUnlockedSpells, spellQuestAssignments);
      if (!pickedQuest) {
        const message = `${npc.displayName}: You already know every spell quest I can offer.`;
        if (shouldAnnounce) state.addLobbyMessage(message, 'system');
        return [message];
      }
      const { quest, fixedReward } = pickedQuest;

      assignment = makeSpellQuestAssignment(npc, quest);
      spellQuestAssignments[npc.npcId] = assignment;
      questFlags[`quest:${quest.id}`] = 'started';
      isNewAssignment = true;
      if (!questUnlockedSpells.includes(assignment.spell)) {
        messages.push(`${npc.displayName}: ${fixedReward ? 'grove trial opened' : 'mystery box opened'} - ${quest.title}.`);
      }
    }

    const quest = getSpellQuestDefinition(assignment.spell);
    if (!quest) {
      messages.push(`${npc.displayName}: this quest points at a missing spell.`);
    } else if (assignment.status === 'completed' || questUnlockedSpells.includes(assignment.spell)) {
      assignment = {
        ...assignment,
        displayName: npc.displayName,
        townId: npc.townId,
        status: 'completed',
        completedAt: assignment.completedAt ?? Date.now(),
      };
      spellQuestAssignments[npc.npcId] = assignment;
      messages.push(`${npc.displayName}: ${SPELL_DISPLAY_NAMES[assignment.spell]} is already yours.`);
    } else if (isSpellQuestReady(quest, questFlags)) {
      questUnlockedSpells = Array.from(new Set([...questUnlockedSpells, assignment.spell]));
      questFlags[quest.requiredFlag] = true;
      questFlags[`quest:${quest.id}`] = 'completed';
      assignment = {
        ...assignment,
        displayName: npc.displayName,
        townId: npc.townId,
        status: 'completed',
        completedAt: Date.now(),
      };
      spellQuestAssignments[npc.npcId] = assignment;
      messages.push(`${npc.displayName}: ${quest.readyLine}`);
    } else if (!isNewAssignment) {
      messages.push(`${npc.displayName}: ${quest.title}.`);
      messages.push(quest.incompleteLine);
    }

    if (quest && assignment.status !== 'completed' && isNewAssignment) {
      messages.push(quest.objective);
      messages.push(quest.incompleteLine);
    }

    set({ questUnlockedSpells, questFlags, spellQuestAssignments });
    setStoredJson(QUEST_UNLOCKED_SPELLS_STORAGE_KEY, questUnlockedSpells);
    setStoredJson(QUEST_FLAGS_STORAGE_KEY, questFlags);
    if (get().survivalSave) {
      get().saveSurvivalProgress({ questUnlockedSpells, questFlags, spellQuestAssignments });
    }
    if (shouldAnnounce) {
      messages.forEach((message) => get().addLobbyMessage(message, 'system'));
    }
    return messages;
  },
  openDarrelDragonDialog: () => {
    const state = get();
    const quest = getSpellQuestDefinition(DARREL_QUEST_REWARD_SPELL);
    if (!quest) return [];

    const hasDrunkPotion = state.questFlags[DARREL_POTION_FLAG] === 'drunk' ||
      state.questFlags['quest:darrel-grove'] === 'started';
    const alreadyCompleted = state.questUnlockedSpells.includes(DARREL_QUEST_REWARD_SPELL) ||
      state.questFlags[`quest:${quest.id}`] === 'completed';

    const questFlags = {
      ...state.questFlags,
      [DARREL_DRAGON_WOKEN_FLAG]: true,
      ...(hasDrunkPotion || alreadyCompleted
        ? {
          'quest:darrel-grove': state.questFlags['quest:darrel-grove'] === 'completed' || alreadyCompleted
            ? 'completed' as QuestFlagValue
            : 'started' as QuestFlagValue,
        }
        : {}),
    };
    const line = alreadyCompleted
      ? 'Spirit Dragon: Back already? I still have lemonade, but I am guarding the tacos from myself.'
      : hasDrunkPotion
        ? 'Spirit Dragon: Hm? State your business, little wizard.'
        : 'Spirit Dragon: You do not smell like Darrel\'s garden draught. If Darrel sent you, drink the potion first and come back properly.';
    const questDialogSession: QuestDialogSession = {
      npcId: DARREL_DRAGON_NPC_ID,
      townId: 'darrel-grove',
      displayName: 'Spirit Dragon',
      line,
      choices: alreadyCompleted || !hasDrunkPotion
        ? [{ id: 'darrel-close', label: 'Leave the dragon in peace' }]
        : [
          { id: 'darrel-dragon-fight', label: 'Fight and take the Healing Crystals by force.' },
          { id: 'darrel-dragon-peace', label: 'Peacefully ask for crystals for Darrel and yourself.' },
        ],
    };

    set({
      questFlags,
      questDialogSession,
      isChargingSpell: false,
      chargingHand: null,
      chargingHands: { left: false, right: false },
      isTouchControlsActive: false,
      isControllerGameplayActive: false,
    });
    setStoredJson(QUEST_FLAGS_STORAGE_KEY, questFlags);
    if (get().survivalSave) {
      get().saveSurvivalProgress({ questFlags });
    }
    releaseQuestDialogControls();
    return [questDialogSession.line];
  },
  completeAssignedSpellQuest: (npcId) => {
    const state = get();
    const assignment = state.spellQuestAssignments[npcId];
    if (!assignment) {
      const message = `No spell quest assigned to ${npcId}`;
      state.addLobbyMessage(message, 'system');
      return [message];
    }

    const quest = getSpellQuestDefinition(assignment.spell);
    if (!quest) {
      const message = `Missing quest definition for ${assignment.spell}`;
      state.addLobbyMessage(message, 'system');
      return [message];
    }

    if (!isSpellQuestReady(quest, state.questFlags)) {
      const message = `${assignment.displayName}: ${quest.incompleteLine}`;
      state.addLobbyMessage(message, 'system');
      return [message];
    }

    const completedAssignment = {
      ...assignment,
      status: 'completed' as SpellQuestStatus,
      completedAt: Date.now(),
    };
    const questUnlockedSpells = Array.from(new Set([...state.questUnlockedSpells, assignment.spell]));
    const questFlags = {
      ...state.questFlags,
      [quest.requiredFlag]: true,
      [`quest:${quest.id}`]: 'completed' as QuestFlagValue,
    };
    const spellQuestAssignments = {
      ...state.spellQuestAssignments,
      [npcId]: completedAssignment,
    };
    const inventory = assignment.spell === DARREL_QUEST_REWARD_SPELL
      ? addInventoryQuantity(state.inventory, DARREL_INVENTORY_ITEM_IDS.crystals, 1)
      : state.inventory;
    const message = `${assignment.displayName}: ${quest.readyLine}`;

    set({ questUnlockedSpells, questFlags, spellQuestAssignments, inventory });
    setStoredJson(QUEST_UNLOCKED_SPELLS_STORAGE_KEY, questUnlockedSpells);
    setStoredJson(QUEST_FLAGS_STORAGE_KEY, questFlags);
    if (inventory !== state.inventory) {
      setStoredJson(SURVIVAL_INVENTORY_STORAGE_KEY, inventory);
    }
    if (get().survivalSave) {
      get().saveSurvivalProgress({ questUnlockedSpells, questFlags, spellQuestAssignments, inventory });
    }
    get().addLobbyMessage(message, 'system');
    return [message];
  },
  completeDarrelGroveQuestReturn: (npcId) => {
    const state = get();
    const quest = getSpellQuestDefinition(DARREL_QUEST_REWARD_SPELL);
    if (!quest) return [];

    const matchingAssignment = Object.values(state.spellQuestAssignments).find((assignment) => (
      isAcceptedDarrelQuestAssignment(assignment, state.questFlags)
    ));
    const targetNpcId = npcId || matchingAssignment?.npcId;
    if (!targetNpcId) return [];

    const program = state.questNpcPrograms[targetNpcId];
    const npc: QuestNpcDescriptor = {
      npcId: targetNpcId,
      townId: program?.townId ?? 'darrel-grove',
      displayName: 'Darrel',
    };
    if (!isDarrelQuestNpc(npc) && matchingAssignment?.npcId !== targetNpcId) return [];

    const currentAssignment = state.spellQuestAssignments[targetNpcId];
    const assignment = !currentAssignment || currentAssignment.spell !== DARREL_QUEST_REWARD_SPELL
      ? makeSpellQuestAssignment(npc, quest)
      : {
        ...currentAssignment,
        displayName: npc.displayName,
        townId: npc.townId,
      };

    if (assignment.status === 'completed' || state.questUnlockedSpells.includes(assignment.spell)) {
      const message = `${assignment.displayName}: ${SPELL_DISPLAY_NAMES[assignment.spell]} is already yours.`;
      state.addLobbyMessage(message, 'system');
      return [message];
    }

    const completedAssignment = {
      ...assignment,
      status: 'completed' as SpellQuestStatus,
      completedAt: Date.now(),
    };
    const questUnlockedSpells = Array.from(new Set([...state.questUnlockedSpells, DARREL_QUEST_REWARD_SPELL]));
    const questFlags = {
      ...state.questFlags,
      [quest.requiredFlag]: true,
      [`quest:${quest.id}`]: 'completed' as QuestFlagValue,
      'quest:darrel-grove': 'completed' as QuestFlagValue,
    };
    const spellQuestAssignments = {
      ...state.spellQuestAssignments,
      [targetNpcId]: completedAssignment,
    };
    const inventory = addInventoryQuantity(state.inventory, DARREL_INVENTORY_ITEM_IDS.crystals, 1);
    const message = `${completedAssignment.displayName}: ${quest.readyLine}`;

    set({ questUnlockedSpells, questFlags, spellQuestAssignments, inventory });
    setStoredJson(QUEST_UNLOCKED_SPELLS_STORAGE_KEY, questUnlockedSpells);
    setStoredJson(QUEST_FLAGS_STORAGE_KEY, questFlags);
    setStoredJson(SURVIVAL_INVENTORY_STORAGE_KEY, inventory);
    if (get().survivalSave) {
      get().saveSurvivalProgress({ questUnlockedSpells, questFlags, spellQuestAssignments, inventory });
    }
    get().addLobbyMessage(message, 'system');
    return [message];
  },
  runQuestScriptPoint: (npcId, scriptPointId) => {
    const state = get();
    const program = state.questNpcPrograms[npcId];
    const scriptPoint = program?.scriptPoints.find((point) => point.id === scriptPointId);
    if (!program || !scriptPoint) return ['Quest scriptpoint not found'];

    const parsedEvents = scriptPoint.eventScript
      .split(/\r?\n/)
      .map(parseQuestEventLine)
      .filter((event): event is { command: string; value: string } => event !== null);

    if (parsedEvents.length === 0) {
      const message = `${program.displayName}: no events on ${scriptPoint.title}`;
      state.addLobbyMessage(message, 'system');
      return [message];
    }

    const messages: string[] = [];
    let questUnlockedSpells = [...state.questUnlockedSpells];
    let questFlags = { ...state.questFlags };
    let spellQuestAssignments = { ...state.spellQuestAssignments };
    let inventory = state.inventory;

    parsedEvents.forEach(({ command, value }) => {
      if (command === 'unlockspell' || command === 'spellunlock') {
        const spell = getSpellFromQuestValue(value);
        if (!spell) {
          messages.push(`Unknown spell: ${value || 'blank'}`);
          return;
        }
        if (!questUnlockedSpells.includes(spell)) {
          questUnlockedSpells = [...questUnlockedSpells, spell];
          messages.push(`Unlocked ${spell}`);
        } else {
          messages.push(`${spell} already unlocked`);
        }
        spellQuestAssignments = completeAssignmentsForSpell(spellQuestAssignments, spell);
        if (spell === DARREL_QUEST_REWARD_SPELL) {
          inventory = addInventoryQuantity(inventory, DARREL_INVENTORY_ITEM_IDS.crystals, 1);
        }
        return;
      }

      if (command === 'unlockrandomlockedspell' || command === 'randomlockedspell' || command === 'gambleunlock' || command === 'gamblespell') {
        const lockedSpells = ALL_SPELLS.filter((spell) => !questUnlockedSpells.includes(spell));
        if (lockedSpells.length === 0) {
          messages.push('No locked spells remain');
          return;
        }
        const spell = lockedSpells[Math.floor(Math.random() * lockedSpells.length)];
        questUnlockedSpells = [...questUnlockedSpells, spell];
        spellQuestAssignments = completeAssignmentsForSpell(spellQuestAssignments, spell);
        messages.push(`Gamble unlocked ${spell}`);
        return;
      }

      if (command === 'setspellquestready' || command === 'spellquestready' || command === 'readyassignedspellquest') {
        const targetNpcId = value || npcId;
        const assignment = spellQuestAssignments[targetNpcId];
        if (!assignment) {
          messages.push(`No spell quest assigned to ${targetNpcId}`);
          return;
        }
        const quest = getSpellQuestDefinition(assignment.spell);
        if (!quest) {
          messages.push(`Missing quest definition for ${assignment.spell}`);
          return;
        }
        questFlags[quest.requiredFlag] = true;
        questFlags[`quest:${quest.id}`] = 'ready';
        messages.push(`${SPELL_DISPLAY_NAMES[assignment.spell]} quest ready`);
        return;
      }

      if (command === 'completeassignedspellquest' || command === 'completespellquest') {
        const targetNpcId = value || npcId;
        const assignment = spellQuestAssignments[targetNpcId];
        if (!assignment) {
          messages.push(`No spell quest assigned to ${targetNpcId}`);
          return;
        }
        const quest = getSpellQuestDefinition(assignment.spell);
        if (!quest) {
          messages.push(`Missing quest definition for ${assignment.spell}`);
          return;
        }
        questFlags[quest.requiredFlag] = true;
        questFlags[`quest:${quest.id}`] = 'completed';
        questUnlockedSpells = Array.from(new Set([...questUnlockedSpells, assignment.spell]));
        spellQuestAssignments[targetNpcId] = {
          ...assignment,
          status: 'completed',
          completedAt: Date.now(),
        };
        if (assignment.spell === DARREL_QUEST_REWARD_SPELL) {
          inventory = addInventoryQuantity(inventory, DARREL_INVENTORY_ITEM_IDS.crystals, 1);
        }
        messages.push(`${assignment.displayName}: ${quest.readyLine}`);
        return;
      }

      if (command === 'teleportquestrealm' || command === 'teleportquestworld' || command === 'teleportdarrelquest' || command === 'darrelquest') {
        const destination = getQuestTeleportDestination(value);
        if (!destination) {
          messages.push(`Unknown quest realm: ${value || 'blank'}`);
          return;
        }
        if (typeof window !== 'undefined') {
          if (destination.id === 'darrel-grove') {
            const npc: QuestNpcDescriptor = {
              npcId,
              townId: program.townId,
              displayName: program.displayName,
            };
            const quest = getSpellQuestDefinition(DARREL_QUEST_REWARD_SPELL);
            if (quest && isDarrelQuestNpc(npc)) {
              const assignment = spellQuestAssignments[npcId];
              if (!assignment || assignment.spell !== DARREL_QUEST_REWARD_SPELL) {
                spellQuestAssignments[npcId] = makeSpellQuestAssignment(npc, quest);
                messages.push(`${program.displayName}: grove trial opened - ${quest.title}.`);
              }
              questFlags = makeDarrelStartedFlags(quest, questFlags);
            }
            (window as unknown as { __darrelQuestNpcId?: string }).__darrelQuestNpcId = npcId;
          }
          const returnPosition = getCurrentQuestReturnPosition();
          if (returnPosition) {
            (window as unknown as { __darrelQuestReturnPosition?: { x: number; y: number; z: number } }).__darrelQuestReturnPosition = returnPosition;
          }
          window.dispatchEvent(new CustomEvent('teleportPlayer', {
            detail: { ...destination.position, yaw: destination.yaw },
          }));
          messages.push(`Transported to ${destination.label}`);
        } else {
          messages.push(`${destination.label} teleport is only available in-game`);
        }
        return;
      }

      if (command === 'startquest') {
        if (!value) {
          messages.push('startQuest needs a quest id');
          return;
        }
        questFlags[`quest:${value}`] = 'started';
        messages.push(`Started quest ${value}`);
        return;
      }

      if (command === 'completequest') {
        if (!value) {
          messages.push('completeQuest needs a quest id');
          return;
        }
        questFlags[`quest:${value}`] = 'completed';
        messages.push(`Completed quest ${value}`);
        return;
      }

      if (command === 'setflag') {
        const assignment = parseQuestFlagAssignment(value);
        if (!assignment.key) {
          messages.push('setFlag needs key=value');
          return;
        }
        questFlags[assignment.key] = assignment.value === 'true' ? true : assignment.value === 'false' ? false : assignment.value;
        messages.push(`Set ${assignment.key}`);
        return;
      }

      if (command === 'message' || command === 'say') {
        if (value) messages.push(value);
        return;
      }

      messages.push(`Unknown event: ${command}`);
    });

    questUnlockedSpells = Array.from(new Set(questUnlockedSpells));
    set({ questUnlockedSpells, questFlags, spellQuestAssignments, inventory });
    setStoredJson(QUEST_UNLOCKED_SPELLS_STORAGE_KEY, questUnlockedSpells);
    setStoredJson(QUEST_FLAGS_STORAGE_KEY, questFlags);
    if (inventory !== state.inventory) {
      setStoredJson(SURVIVAL_INVENTORY_STORAGE_KEY, inventory);
    }
    if (get().survivalSave) {
      get().saveSurvivalProgress({ questUnlockedSpells, questFlags, spellQuestAssignments, inventory });
    }
    messages.forEach((message) => get().addLobbyMessage(message, 'system'));
    return messages;
  },

  players: {},
  setPlayers: (players) => {
    const pl = { ...get().players };
    players.forEach(p => pl[p.id] = p);
    set({ players: pl });
  },
  addPlayer: (p) => set((state) => ({ players: { ...state.players, [p.id]: p } })),
  removePlayer: (id) => set((state) => {
    const p = { ...state.players };
    delete p[id];
    return { players: p };
  }),
  updatePlayer: (id, data) => set((state) => {
    if (!state.players[id]) return state;
    return { players: { ...state.players, [id]: { ...state.players[id], ...data } } };
  }),
  respawn: () => set({
    health: 100,
    armor: 0,
    leftRunePower: 0,
    rightRunePower: 0,
    thrusterFuel: 1,
    speedBoostUntil: 0,
    jumpBoostUntil: 0,
    slowUntil: 0,
    sleepUntil: 0,
    poisonUntil: 0,
    acidUntil: 0,
    magicGlassOrbUntil: 0,
    isAstralMeditating: false,
    astralMeditationStartedAt: 0,
    isVClipEnabled: false,
  }),

  projectiles: [],
  addProjectile: (p) => set((state) => {
    const existingIndex = state.projectiles.findIndex(projectile => projectile.id === p.id);
    if (existingIndex === -1) {
      return { projectiles: [...state.projectiles, p] };
    }

    return {
      projectiles: state.projectiles.map((projectile, index) => index === existingIndex ? p : projectile),
    };
  }),
  removeProjectile: (id) => set((state) => ({ projectiles: state.projectiles.filter(p => p.id !== id) })),

  portals: [],
  addPortal: (portal) => set((state) => {
    if (state.portals.length >= 2) return state; // Do not spawn more than 2
    return { portals: [...state.portals, portal] };
  }),
  removePortal: (id) => set((state) => ({ portals: state.portals.filter(p => p.id !== id) })),
}));
