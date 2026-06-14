import {
  RUNE_POWER_MAX,
  SURVIVAL_BLOCK_SIZE,
  getActiveQuestNavigationTargets,
  useGameStore,
  type QuestDialogSession,
  type SpellType,
} from "../../../store/gameStore";
import {
  getCurrentQaRouteParam,
} from "./qaRouteTelemetry";
import { isCurrentSpellDummyQaRouteEnabled } from "./spellDummyQaRoutes";
import {
  angleDeltaRadians,
  lerpAngleRadians,
  moveAngleTowardsRadians,
  normalizeAngleRadians,
} from "../../systems/math/angleMath";

export {
  angleDeltaRadians,
  lerpAngleRadians,
  moveAngleTowardsRadians,
  normalizeAngleRadians,
};

export type QaSurvivalWalkMode = "travel" | "route" | "inspect" | "avoid" | "recover" | "tube" | "approach" | "act";
export type QaSurvivalIntentKind = "roam" | "mana-flower" | "spell-dummy" | "quest-target" | "darrel-dragon" | "landmark";
export type QaSurvivalRouteWaypoint = { id: string; x: number; z: number };

export interface QaSurvivalWalkInputState {
  forward: number;
  strafe: number;
  sprint: boolean;
  mode: QaSurvivalWalkMode;
}

export interface QaSurvivalIntent {
  kind: QaSurvivalIntentKind;
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  expiresAt: number;
  observeUntil?: number;
  lastActionAt?: number;
}

export interface QaSpellDummySnapshot {
  id: string;
  position: { x: number; y: number; z: number };
  health: number;
}

export interface QaManaFlowerSnapshot {
  id: string;
  x: number;
  y: number;
  z: number;
  radius?: number;
}

export const QA_SURVIVAL_CROSS_MAP_ROUTE: QaSurvivalRouteWaypoint[] = [
  { id: "meadow-east-rise", x: SURVIVAL_BLOCK_SIZE * 5 - 120, z: SURVIVAL_BLOCK_SIZE * -3 - 36 },
  { id: "east-wilds", x: SURVIVAL_BLOCK_SIZE * 6 - 80, z: SURVIVAL_BLOCK_SIZE * -3 + 110 },
  { id: "desert-edge", x: SURVIVAL_BLOCK_SIZE * 6 - 110, z: SURVIVAL_BLOCK_SIZE * -4 + 128 },
  { id: "south-meadow-route", x: SURVIVAL_BLOCK_SIZE * 4 + 120, z: SURVIVAL_BLOCK_SIZE * -4 + 150 },
  { id: "north-meadow-return", x: SURVIVAL_BLOCK_SIZE * 4 - 170, z: SURVIVAL_BLOCK_SIZE * -2 - 92 },
  { id: "meadow-start-loop", x: SURVIVAL_BLOCK_SIZE * 4 - 299, z: SURVIVAL_BLOCK_SIZE * -3 - 35 },
];

export const QA_SURVIVAL_LONG_HAUL_ROUTE: QaSurvivalRouteWaypoint[] = [
  { id: "long-haul-point-b", x: SURVIVAL_BLOCK_SIZE * 6 + 160, z: SURVIVAL_BLOCK_SIZE * -5 + 170 },
  { id: "long-haul-point-a", x: SURVIVAL_BLOCK_SIZE * 2 - 240, z: SURVIVAL_BLOCK_SIZE * -2 + 180 },
];

const EMPTY_QA_SURVIVAL_ROUTE: QaSurvivalRouteWaypoint[] = [];
let cachedQaSurvivalRouteSearch = "";
let cachedQaSurvivalRouteWaypoints = EMPTY_QA_SURVIVAL_ROUTE;

export const QA_SURVIVAL_WALK_DECISION_MIN_SECONDS = 1.55;
export const QA_SURVIVAL_WALK_DECISION_MAX_SECONDS = 4.25;
export const QA_SURVIVAL_WALK_PROBE_DISTANCE = 13.5;
export const QA_SURVIVAL_WALK_SIDE_PROBE_DISTANCE = 7.5;
export const QA_SURVIVAL_WALK_LOOKAHEAD_DISTANCE = 42;
export const QA_SURVIVAL_WALK_TURN_OPTIONS = [0, 0.28, -0.28, 0.62, -0.62, 1.08, -1.08, Math.PI * 0.72, -Math.PI * 0.72];
export const QA_SURVIVAL_WALK_ESCAPE_TURNS = [0.45, -0.45, 0.82, -0.82, 1.25, -1.25, Math.PI * 0.62, -Math.PI * 0.62, Math.PI];
export const QA_SURVIVAL_WALK_PROBE_HEIGHTS = [-0.28, 0.32, 0.92];
export const QA_SURVIVAL_STUCK_CHECK_SECONDS = 1.4;
export const QA_SURVIVAL_WALK_MIN_PROGRESS = 3.2;
export const QA_SURVIVAL_WALK_MIN_TOWARD_PROGRESS = 1.05;
export const QA_SURVIVAL_WALK_BLOCKED_CLEARANCE = 8.5;
export const QA_SURVIVAL_WALK_TURN_IN_PLACE_ERROR = 0.32;
export const QA_SURVIVAL_WALK_SOFT_CLEARANCE = 11.8;
export const QA_SURVIVAL_WALK_SOFT_LOOKAHEAD = 28;
export const QA_SURVIVAL_LOW_SPEED_TRIGGER_SECONDS = 0.68;
export const QA_SURVIVAL_LOW_SPEED_THRESHOLD = 1.15;
export const QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE = 5.2;
export const QA_SURVIVAL_VIEW_SOFT_CLEARANCE = 12.5;
export const QA_SURVIVAL_OVERHEAD_PROBE_DISTANCE = 4.8;
export const QA_SURVIVAL_OVERHEAD_BLOCKED_CLEARANCE = 1.45;
export const QA_SURVIVAL_OVERHEAD_SOFT_CLEARANCE = 2.6;
export const QA_SURVIVAL_LOOK_TURN_RATE = 1.28;
export const QA_SURVIVAL_RECOVERY_TURN_RATE = 3.65;
export const QA_SURVIVAL_RECOVERY_MIN_SECONDS = 1.15;
export const QA_SURVIVAL_RECOVERY_MAX_SECONDS = 2.55;
export const QA_SURVIVAL_RECOVERY_REVERSE_SECONDS = 0.46;
export const QA_SURVIVAL_RECOVERY_CLEAR_EXIT_SECONDS = 0.38;
export const QA_SURVIVAL_RECOVERY_CLEAR_EXIT_DISTANCE = 10.6;
export const QA_SURVIVAL_RECOVERY_MIN_ESCAPE_DISTANCE = 4.2;
export const QA_SURVIVAL_RECOVERY_REVERSE_STUCK_SECONDS = 1.65;
export const QA_SURVIVAL_RECOVERY_NUDGE_SECONDS = 2.15;
export const QA_SURVIVAL_RECOVERY_NUDGE_DISTANCE = 6.5;
export const QA_SURVIVAL_WAYPOINT_MIN_DISTANCE = 72;
export const QA_SURVIVAL_WAYPOINT_MAX_DISTANCE = 168;
export const QA_SURVIVAL_ROUTE_REACH_DISTANCE = 38;
export const QA_SURVIVAL_ROUTE_WAYPOINT_SECONDS = 34;
export const QA_SURVIVAL_ROUTE_BLOCKED_DWELL_SECONDS = 0.34;
export const QA_SURVIVAL_ROUTE_YAW_SMOOTH_RATE = 3.2;
export const QA_SURVIVAL_ROUTE_YAW_SNAP_DELTA = 1.1;
export const QA_BASE_VILLAGE_ROAD_HALF_WIDTH = 13.5;
export const QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT = 190;
export const QA_DARREL_GROVE_CLEARING_LOCAL_X = 86;
export const QA_DARREL_GROVE_CLEARING_LOCAL_Z = 170;
export const QA_DARREL_GROVE_RESCUE_Y = 38;
export const QA_DARREL_GROVE_DRAGON_SIDE_APPROACH_X = 92;
export const QA_DARREL_GROVE_DRAGON_SIDE_APPROACH_Z = 58;
export const QA_DARREL_GROVE_DRAGON_SIDE_STAIR_X = 42;
export const QA_DARREL_GROVE_DRAGON_SIDE_STAIR_Z = -50;
export const QA_DARREL_GROVE_DRAGON_DOOR_Z = -18;
export const QA_SURVIVAL_INSPECTION_MIN_INTERVAL = 3.8;
export const QA_SURVIVAL_INSPECTION_MAX_INTERVAL = 8.6;
export const QA_SURVIVAL_INSPECTION_MIN_SECONDS = 1.15;
export const QA_SURVIVAL_INSPECTION_MAX_SECONDS = 2.35;
export const QA_SURVIVAL_COMBAT_CAST_MIN_INTERVAL = 7.4;
export const QA_SURVIVAL_COMBAT_CAST_MAX_INTERVAL = 12.8;
export const QA_SPELL_DUMMY_COMBAT_CAST_MIN_INTERVAL = 1.15;
export const QA_SPELL_DUMMY_COMBAT_CAST_MAX_INTERVAL = 2.35;
export const QA_SURVIVAL_COMBAT_FOCUS_SECONDS = 0.62;
export const QA_SURVIVAL_COMBAT_TARGET_RANGE = 96;
export const QA_SURVIVAL_PRACTICE_CAST_MIN_INTERVAL = 9.4;
export const QA_SURVIVAL_PRACTICE_CAST_MAX_INTERVAL = 15.6;
export const QA_SURVIVAL_COMBAT_SPELL_SEQUENCE: SpellType[] = [
  "fireball",
  "iceshard",
  "arcanebeam",
  "ringsofpower",
  "lightning",
  "acid",
  "sleep",
  "kunai",
  "poison",
];
export const QA_SURVIVAL_PRACTICE_SPELL_SEQUENCE: SpellType[] = [
  "fireball",
  "iceshard",
  "arcanebeam",
  "ringsofpower",
  "lightning",
  "poison",
];
export const QA_INTENT_REPLAN_MIN_SECONDS = 2.1;
export const QA_INTENT_REPLAN_MAX_SECONDS = 5.8;
export const QA_INTENT_MANA_RANGE = 560;
export const QA_INTENT_MANA_LOW_THRESHOLD = RUNE_POWER_MAX * 0.72;
export const QA_INTENT_MANA_COLLECT_RADIUS = 5.8;
export const QA_INTENT_DUMMY_RANGE = 260;
export const QA_INTENT_DUMMY_TEST_RANGE = 980;
export const QA_INTENT_DUMMY_KEEP_DISTANCE = 33;
export const QA_INTENT_DUMMY_CLOSE_DISTANCE = 20;
export const QA_DUMMY_REANCHOR_DISTANCE = 56;
export const QA_DUMMY_REANCHOR_COOLDOWN_SECONDS = 14;
export const QA_INTENT_QUEST_RANGE = 760;
export const QA_INTENT_INTERACT_DISTANCE = 28;
export const QA_INTENT_INTERACT_COOLDOWN_SECONDS = 2.4;
export const QA_INTENT_OBSERVE_SECONDS = 1.25;
export const QA_INTENT_INTEREST_STALE_SECONDS = 12;
export const QA_DARREL_GROVE_DRAGON_INTEREST_SCORE = 78;
export const QA_DARREL_GROVE_DRAGON_INTENT_SECONDS = 90;
export const QA_DARREL_GROVE_DRAGON_INTERACT_DISTANCE = 42;
export const QA_DARREL_GROVE_DRAGON_STEP_JUMP_DISTANCE = 128;

export function isSurvivalGameMode(gameMode: string) {
  return gameMode === "solo-survival" || gameMode === "multiplayer-survival";
}

export function isQaSurvivalWalkEnabled() {
  return import.meta.env.DEV && getCurrentQaRouteParam("qaSurvivalWalk") === "1";
}

export function getQaSurvivalWalkStartDelaySeconds() {
  if (!import.meta.env.DEV) return 0;
  const rawDelay = getCurrentQaRouteParam("qaSurvivalWalkDelay") ?? getCurrentQaRouteParam("qaWalkDelay") ?? "0";
  const delayMs = Number(rawDelay);
  if (!Number.isFinite(delayMs) || delayMs <= 0) return 0;
  return Math.min(60, Math.max(0, delayMs / 1000));
}

export function resolveQaSurvivalRouteWaypoints(rawRoute: string | null | undefined) {
  const route = (rawRoute ?? "").toLowerCase();
  if (!route || route === "off" || route === "0") return EMPTY_QA_SURVIVAL_ROUTE;
  if (route.includes("long") || route.includes("point") || route === "ab" || route === "a-b") {
    return QA_SURVIVAL_LONG_HAUL_ROUTE;
  }
  return QA_SURVIVAL_CROSS_MAP_ROUTE;
}

export function getQaSurvivalRouteWaypoints() {
  if (!import.meta.env.DEV || typeof window === "undefined") return EMPTY_QA_SURVIVAL_ROUTE;
  const search = window.location.search;
  if (search === cachedQaSurvivalRouteSearch) return cachedQaSurvivalRouteWaypoints;
  cachedQaSurvivalRouteSearch = search;
  cachedQaSurvivalRouteWaypoints = resolveQaSurvivalRouteWaypoints(
    getCurrentQaRouteParam("qaSurvivalRoute") ?? getCurrentQaRouteParam("qaRoute"),
  );
  return cachedQaSurvivalRouteWaypoints;
}

export function survivalishTurnNoise(x: number, z: number, time: number) {
  const n = Math.sin(x * 12.9898 + z * 78.233 + time * 4.719) * 43758.5453;
  return n - Math.floor(n);
}

export function randomRangeFromNoise(seed: number, min: number, max: number) {
  return min + Math.min(1, Math.max(0, seed)) * (max - min);
}

export function getQaSurvivalChunkCenter(value: number) {
  return Math.floor((value + SURVIVAL_BLOCK_SIZE / 2) / SURVIVAL_BLOCK_SIZE) * SURVIVAL_BLOCK_SIZE;
}

export function publishQaPlayerPosition(position: { x: number; y: number; z: number }) {
  if (typeof document === "undefined") return;
  const roundedX = Math.round(position.x);
  const roundedY = Math.round(position.y);
  const roundedZ = Math.round(position.z);
  const chunkX = Math.floor((position.x + SURVIVAL_BLOCK_SIZE / 2) / SURVIVAL_BLOCK_SIZE);
  const chunkZ = Math.floor((position.z + SURVIVAL_BLOCK_SIZE / 2) / SURVIVAL_BLOCK_SIZE);
  document.documentElement.dataset.wofPlayerX = String(roundedX);
  document.documentElement.dataset.wofPlayerY = String(roundedY);
  document.documentElement.dataset.wofPlayerZ = String(roundedZ);
  document.documentElement.dataset.wofPlayerPosition = `${roundedX},${roundedY},${roundedZ}`;
  document.documentElement.dataset.wofSurvivalChunk = `${chunkX},${chunkZ}`;
}

export function isQaSpellDummyRunEnabled() {
  return isCurrentSpellDummyQaRouteEnabled();
}

export function getQaSpellDummies(target?: QaSpellDummySnapshot[]) {
  const ready = target ?? [];
  ready.length = 0;
  if (typeof window === "undefined") return ready;
  const snapshots = ((window as any).__wofSpellDummies ?? []) as Partial<QaSpellDummySnapshot>[];
  for (let index = 0; index < snapshots.length; index += 1) {
    const dummy = snapshots[index];
    if (
      typeof dummy?.id !== "string" ||
      !dummy.position ||
      !Number.isFinite(dummy.position.x) ||
      !Number.isFinite(dummy.position.y) ||
      !Number.isFinite(dummy.position.z) ||
      Number(dummy.health) <= 0
    ) continue;
    ready.push(dummy as QaSpellDummySnapshot);
  }
  return ready;
}

export function getQaManaFlowerCooldowns(target?: Map<string, number>) {
  const cooldowns = target ?? new Map<string, number>();
  cooldowns.clear();
  if (typeof document === "undefined") return cooldowns;

  const raw = document.documentElement.dataset.wofManaFlowerCooldowns ?? "";
  let start = 0;
  while (start <= raw.length) {
    const nextBreak = raw.indexOf("|", start);
    const end = nextBreak === -1 ? raw.length : nextBreak;
    const entry = raw.slice(start, end);
    const splitIndex = entry.lastIndexOf(":");
    if (splitIndex > 0) {
      const id = entry.slice(0, splitIndex);
      const seconds = Number(entry.slice(splitIndex + 1));
      if (id && Number.isFinite(seconds) && seconds > 0) {
        cooldowns.set(id, seconds);
      }
    }
    if (nextBreak === -1) break;
    start = nextBreak + 1;
  }
  return cooldowns;
}

export function getReadyQaManaFlowers(target?: QaManaFlowerSnapshot[], cooldownTarget?: Map<string, number>) {
  const ready = target ?? [];
  ready.length = 0;
  if (typeof window === "undefined") return ready;
  const cooldowns = getQaManaFlowerCooldowns(cooldownTarget);
  const sources = ((window as any).__wofManaFlowerSources ?? []) as Partial<QaManaFlowerSnapshot>[];
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index];
    if (
      typeof source?.id !== "string" ||
      cooldowns.has(source.id) ||
      !Number.isFinite(source.x) ||
      !Number.isFinite(source.y) ||
      !Number.isFinite(source.z)
    ) continue;
    ready.push(source as QaManaFlowerSnapshot);
  }
  return ready;
}

export function getQuestNavigationIntentTargets() {
  const state = useGameStore.getState();
  return getActiveQuestNavigationTargets({
    spellQuestAssignments: state.spellQuestAssignments,
    questFlags: state.questFlags,
    questUnlockedSpells: state.questUnlockedSpells,
    questNpcPrograms: state.questNpcPrograms,
  });
}

export function pickQaQuestDialogChoice(session: QuestDialogSession) {
  const priorities = [
    "darrel-two-spells",
    "darrel-accept-job",
    "darrel-dragon-peace",
    "darrel-close",
  ];
  for (const id of priorities) {
    for (let index = 0; index < session.choices.length; index += 1) {
      const choice = session.choices[index];
      if (choice.id === id) return choice;
    }
  }
  for (let index = 0; index < session.choices.length; index += 1) {
    const choice = session.choices[index];
    if (!choice.id.includes("fight") && !choice.id.includes("jerk")) return choice;
  }
  return session.choices[0] ?? null;
}
