import { create } from 'zustand';

export type SpellType = 'fireball' | 'iceshard' | 'arcanebeam' | 'healspell' | 'icespell' | 'ringsofpower' | 'lightning' | 'smokebomb' | 'portal' | 'blink' | 'grab' | 'tornado' | 'meteorshower' | 'flamethrower' | 'discshield' | 'orbshield' | 'kunai' | 'healingcrystals' | 'magicarmor' | 'jumpboost' | 'speedboost' | 'tungstonballsack' | 'sleep' | 'poison' | 'acid' | 'magicglassorb';
export type HandType = 'left' | 'right';
export type StatusEffectType = 'slow' | 'sleep' | 'poison' | 'acid';
export type ControllerButtonName = 'a' | 'b' | 'x' | 'y' | 'leftBumper' | 'rightBumper' | 'leftTrigger' | 'rightTrigger' | 'back' | 'start' | 'leftStick' | 'rightStick' | 'dpadUp' | 'dpadDown' | 'dpadLeft' | 'dpadRight';
export type ControllerAction = 'leftCast' | 'rightCast' | 'jump' | 'slide' | 'sprint' | 'spellMenu' | 'map' | 'scoreboard' | 'pause' | 'menuSelect' | 'menuBack' | 'leftHotbar' | 'rightHotbar' | 'voicePushToTalk';
export type VoiceInputMode = 'openMic' | 'pushToTalk';
export type CharacterTopStyle = 'simple' | 'robe' | 'vest' | 'tunic';
export type CharacterPantsStyle = 'pants' | 'shorts' | 'skirt' | 'robe';
export type CharacterShoesStyle = 'boots' | 'shoes' | 'sandals' | 'barefoot';
export type CharacterHatStyle = 'none' | 'wizard' | 'floppy-wizard' | 'cap' | 'hood' | 'pharaoh';
export type CharacterHairStyle = 'none' | 'short' | 'bob' | 'spikes' | 'long';
export type CharacterFacialHairStyle = 'none' | 'mustache' | 'goatee' | 'beard';
export type CharacterEyeStyle = 'calm' | 'wide' | 'angry' | 'sleepy' | 'content' | 'dull' | 'sus' | 'sus-shadow' | 'terrified' | 'sad' | 'hard-shut' | 'done' | 'happy' | 'nervous' | 'nervous-teary';
export type CharacterMouthStyle = 'neutral' | 'smile' | 'frown' | 'open';
export type AvatarAnimation = 'idle' | 'walk' | 'sprint' | 'jump' | 'holding' | 'casting' | 'sleep' | 'damaged' | 'slide' | 'grabbed' | 'startled' | 'angry' | 'meditate';
export type LobbyMessageTone = 'join' | 'death' | 'system';
export type GameMode = 'custom-lobby' | 'solo-survival' | 'multiplayer-survival';
export type LobbyMapPreset = 'classic-village' | 'treehouse-village' | 'duel-yard';
export type ManaSpawnRateSetting = 'low' | 'normal' | 'high';
export type EnemyDifficultySetting = 'normal' | 'hard' | 'nightmare';
export type SurvivalBiome = 'plains' | 'jungle' | 'desert' | 'swamp' | 'mushroom';
export const ASPECT_RATIO_OPTIONS = ['16/9', '4/3', '21/9', 'Fill'] as const;
export type AspectRatioOption = typeof ASPECT_RATIO_OPTIONS[number];
export const DEFAULT_ASPECT_RATIO: AspectRatioOption = '16/9';
export const ASPECT_RATIO_STORAGE_KEY = 'wizards-only-fools-aspect-ratio';

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

export const ALL_SPELLS: SpellType[] = ['fireball', 'iceshard', 'arcanebeam', 'healspell', 'icespell', 'ringsofpower', 'lightning', 'smokebomb', 'portal', 'blink', 'grab', 'tornado', 'meteorshower', 'flamethrower', 'discshield', 'orbshield', 'kunai', 'healingcrystals', 'magicarmor', 'jumpboost', 'speedboost', 'tungstonballsack', 'sleep', 'poison', 'acid', 'magicglassorb'];
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
export const DEFAULT_CONTROLLER_LOOK_SENSITIVITY = 2.65;
export const DEFAULT_VOICE_PUSH_TO_TALK_KEY = 'KeyV';
export const DEFAULT_VOICE_OUTPUT_VOLUME = 0.85;
export const DEFAULT_VOICE_PROXIMITY_RANGE = 28;
export const SURVIVAL_BLOCK_SIZE = 512;
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
  spellMenu: 'x',
  map: 'y',
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
  toggleMap: () => void;
  isPauseMenuOpen: boolean;
  setPauseMenuOpen: (open: boolean) => void;
  isScoreboardOpen: boolean;
  setScoreboardOpen: (open: boolean) => void;
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

export const useGameStore = create<GameStore>((set, get) => ({
  isGameLaunched: false,
  setGameLaunched: (launched) => set({ isGameLaunched: launched }),
  gameMode: 'custom-lobby',
  setGameMode: (mode) => set({ gameMode: mode }),
  lobbyRules: { ...DEFAULT_LOBBY_RULES },
  setLobbyRules: (updates) => set((state) => ({ lobbyRules: { ...state.lobbyRules, ...updates } })),
  survivalRules: { ...DEFAULT_SURVIVAL_RULES },
  setSurvivalRules: (updates) => set((state) => ({ survivalRules: { ...state.survivalRules, ...updates } })),
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
  toggleMap: () => set((state) => ({ isMapExpanded: !state.isMapExpanded })),
  isPauseMenuOpen: false,
  setPauseMenuOpen: (open) => set({ isPauseMenuOpen: open }),
  isScoreboardOpen: false,
  setScoreboardOpen: (open) => set({ isScoreboardOpen: open }),
  isVClipEnabled: false,
  setVClipEnabled: (enabled) => set({ isVClipEnabled: enabled }),
  isTouchControlsActive: false,
  setTouchControlsActive: (active) => set({ isTouchControlsActive: active }),
  isControllerGameplayActive: false,
  setControllerGameplayActive: (active) => set({ isControllerGameplayActive: active }),
  keyboardArrowLookEnabled: false,
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
  characterCustomization: { ...DEFAULT_CHARACTER_CUSTOMIZATION },
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

    return { characterCustomization: nextCustomization };
  }),
  localPlayerName: getInitialPlayerName(),
  setLocalPlayerName: (name) => {
    const sanitized = sanitizePlayerName(name);
    if (typeof window !== 'undefined') {
      if (sanitized) {
        window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, sanitized);
      } else {
        window.localStorage.removeItem(PLAYER_NAME_STORAGE_KEY);
      }
    }
    set({ localPlayerName: sanitized });
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
