import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody, CapsuleCollider, useRapier, RapierRigidBody, interactionGroups } from "@react-three/rapier";
import * as THREE from "three";
import { ARMOR_MAX, DARREL_DRAGON_WORLD_POSITION, DARREL_QUEST_CHUNK, DEFAULT_CONTROLLER_LOOK_SENSITIVITY, DEFAULT_MOUSE_SENSITIVITY, HandType, LILY_COIL_QUEST_CHUNK, RUNE_POWER_MAX, SpellType, SURVIVAL_BLOCK_SIZE, TOXIC_DAMAGE_PER_SECOND, TUNGSTON_SLOW_DURATION_MS, getActiveQuestNavigationTargets, getDarrelQuestSpawn, getLilyCoilQuestSpawn, hasRunePower, useGameStore, type QuestDialogSession, type QuestNavigationTarget } from "../store/gameStore";
import { socket } from "../lib/socket";
import { getGamepadAxis, getPrimaryGamepad, isGamepadButtonPressed, type GamepadButtonName } from "./controllerInput";
import { recordNavigationSample } from "./navigationRecorder";

const SPEED = 8;
const JUMP_FORCE = 8;
const BOOST_FORCE = 6; // black ops 3 style double jump boost
const SLIDE_SPEED = 18;
const CROUCH_HOLD_MS = 3000;
const CROUCH_SPEED_MULTIPLIER = 0.44;
const SPEED_BOOST_MULTIPLIER = 2;
const JUMP_BOOST_MULTIPLIER = 2;
const TUNGSTON_SLOW_MULTIPLIER = 0.35;
const CONTROLLER_LOOK_VERTICAL_MULTIPLIER = 0.78;
const KEYBOARD_ARROW_LOOK_SPEED = 2.65;
const KEYBOARD_ARROW_LOOK_VERTICAL_MULTIPLIER = 0.78;
const PLAYER_COLLIDER_HALF_HEIGHT = 0.65;
const PLAYER_COLLIDER_RADIUS = 0.5;
const PLAYER_FOOT_OFFSET = PLAYER_COLLIDER_HALF_HEIGHT + PLAYER_COLLIDER_RADIUS;
const PLAYER_CAMERA_HEIGHT = 1.08;
const PLAYER_SLIDE_CAMERA_HEIGHT = 0.52;
const PLAYER_CROUCH_CAMERA_HEIGHT = 0.52;
const FLOOR_RECOVERY_RAY_UP = 96;
const FLOOR_RECOVERY_RAY_DOWN = 188;
const FLOOR_RECOVERY_TRIGGER_DEPTH = 0.04;
const FLOOR_RECOVERY_MAX_LIFT = 96;
const FLOOR_RECOVERY_VERTICAL_SETTLE = 0.08;
const FLOOR_DEEP_RECOVERY_TRIGGER_Y = -12;
const FLOOR_DEEP_RECOVERY_RAY_UP = 260;
const FLOOR_DEEP_RECOVERY_RAY_DOWN = 420;
const FLOOR_DEEP_RECOVERY_MAX_LIFT = 320;
const GROUND_PROBE_ORIGIN_LIFT = 0.3;
const GROUND_PROBE_CAST_DISTANCE = 0.76;
const GROUND_PROBE_MAX_TOI = 0.68;
const GROUND_COYOTE_MS = 180;
const GROUND_JUMP_MAX_UPWARD_VELOCITY = 1.6;
const GROUND_PROBE_EDGE_RADIUS = PLAYER_COLLIDER_RADIUS * 0.58;
const GROUND_PROBE_DIAGONAL_RADIUS = PLAYER_COLLIDER_RADIUS * 0.42;
const GROUND_PROBE_OFFSETS = [
  { x: 0, z: 0 },
  { x: GROUND_PROBE_EDGE_RADIUS, z: 0 },
  { x: -GROUND_PROBE_EDGE_RADIUS, z: 0 },
  { x: 0, z: GROUND_PROBE_EDGE_RADIUS },
  { x: 0, z: -GROUND_PROBE_EDGE_RADIUS },
  { x: GROUND_PROBE_DIAGONAL_RADIUS, z: GROUND_PROBE_DIAGONAL_RADIUS },
  { x: -GROUND_PROBE_DIAGONAL_RADIUS, z: GROUND_PROBE_DIAGONAL_RADIUS },
  { x: GROUND_PROBE_DIAGONAL_RADIUS, z: -GROUND_PROBE_DIAGONAL_RADIUS },
  { x: -GROUND_PROBE_DIAGONAL_RADIUS, z: -GROUND_PROBE_DIAGONAL_RADIUS },
] as const;
const CAMERA_WALL_CLEARANCE = 0.64;
const CAMERA_WALL_PUSH_MAX = 0.54;
const CAMERA_WALL_INSIDE_EXTRA = 0.12;
const CAMERA_WALL_MIN_HORIZONTAL_PUSH_SQ = 0.0009;
const CAMERA_WALL_MAX_VERTICAL_SEPARATION = 2.4;
const CAMERA_TERRAIN_EYE_CLEARANCE = 0.42;
const CAMERA_TERRAIN_RAY_UP = 3.8;
const CAMERA_TERRAIN_RAY_DOWN = 7.2;
const CAMERA_TERRAIN_MAX_BODY_LIFT = 4.8;
const CAMERA_TERRAIN_MAX_SURFACE_ABOVE_BODY = PLAYER_CAMERA_HEIGHT + 0.95;
const SLIDE_START_MIN_SPEED_SQ = 0.55;
const SLIDE_RESTART_COOLDOWN_MS = 250;
const SPELL_SPAWN_FORWARD_OFFSET = 1.55;
const SPELL_SPAWN_VERTICAL_OFFSET = 0.08;
const DIRECT_STATUS_TARGET_RANGE = 48;
const DIRECT_STATUS_TARGET_RADIUS = 1.85;
const VCLIP_VERTICAL_SPEED = 10;
const VCLIP_SPRINT_MULTIPLIER = 3.2;
const LADDER_CLIMB_SPEED = 8.4;
const LADDER_IDLE_HOLD_SPEED = 0;
const CONTROLLER_ARM_BUTTON_THRESHOLD = 0.35;
const ASTRAL_EXIT_HOLD_MS = 5000;
const PLAYER_MEDITATION_CAMERA_HEIGHT = 0.58;
const QA_SURVIVAL_WALK_DECISION_MIN_SECONDS = 1.55;
const QA_SURVIVAL_WALK_DECISION_MAX_SECONDS = 4.25;
const QA_SURVIVAL_WALK_PROBE_DISTANCE = 13.5;
const QA_SURVIVAL_WALK_SIDE_PROBE_DISTANCE = 7.5;
const QA_SURVIVAL_WALK_LOOKAHEAD_DISTANCE = 42;
const QA_SURVIVAL_WALK_TURN_OPTIONS = [0, 0.28, -0.28, 0.62, -0.62, 1.08, -1.08, Math.PI * 0.72, -Math.PI * 0.72];
const QA_SURVIVAL_WALK_ESCAPE_TURNS = [0.45, -0.45, 0.82, -0.82, 1.25, -1.25, Math.PI * 0.62, -Math.PI * 0.62, Math.PI];
const QA_SURVIVAL_WALK_PROBE_HEIGHTS = [-0.28, 0.32, 0.92];
const QA_SURVIVAL_STUCK_CHECK_SECONDS = 1.4;
const QA_SURVIVAL_WALK_MIN_PROGRESS = 3.2;
const QA_SURVIVAL_WALK_MIN_TOWARD_PROGRESS = 1.05;
const QA_SURVIVAL_WALK_BLOCKED_CLEARANCE = 8.5;
const QA_SURVIVAL_WALK_TURN_IN_PLACE_ERROR = 0.32;
const QA_SURVIVAL_WALK_SOFT_CLEARANCE = 11.8;
const QA_SURVIVAL_WALK_SOFT_LOOKAHEAD = 28;
const QA_SURVIVAL_LOW_SPEED_TRIGGER_SECONDS = 0.68;
const QA_SURVIVAL_LOW_SPEED_THRESHOLD = 1.15;
const QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE = 5.2;
const QA_SURVIVAL_VIEW_SOFT_CLEARANCE = 12.5;
const QA_SURVIVAL_OVERHEAD_PROBE_DISTANCE = 4.8;
const QA_SURVIVAL_OVERHEAD_BLOCKED_CLEARANCE = 1.45;
const QA_SURVIVAL_OVERHEAD_SOFT_CLEARANCE = 2.6;
const QA_SURVIVAL_LOOK_TURN_RATE = 1.28;
const QA_SURVIVAL_RECOVERY_TURN_RATE = 3.65;
const QA_SURVIVAL_RECOVERY_MIN_SECONDS = 1.15;
const QA_SURVIVAL_RECOVERY_MAX_SECONDS = 2.55;
const QA_SURVIVAL_RECOVERY_REVERSE_SECONDS = 0.46;
const QA_SURVIVAL_RECOVERY_CLEAR_EXIT_SECONDS = 0.38;
const QA_SURVIVAL_RECOVERY_CLEAR_EXIT_DISTANCE = 10.6;
const QA_SURVIVAL_RECOVERY_MIN_ESCAPE_DISTANCE = 4.2;
const QA_SURVIVAL_RECOVERY_REVERSE_STUCK_SECONDS = 1.65;
const QA_SURVIVAL_RECOVERY_NUDGE_SECONDS = 2.15;
const QA_SURVIVAL_RECOVERY_NUDGE_DISTANCE = 6.5;
const QA_SURVIVAL_WAYPOINT_MIN_DISTANCE = 72;
const QA_SURVIVAL_WAYPOINT_MAX_DISTANCE = 168;
const QA_SURVIVAL_ROUTE_REACH_DISTANCE = 38;
const QA_SURVIVAL_ROUTE_WAYPOINT_SECONDS = 34;
const QA_SURVIVAL_ROUTE_BLOCKED_DWELL_SECONDS = 0.34;
const QA_SURVIVAL_ROUTE_YAW_SMOOTH_RATE = 3.2;
const QA_SURVIVAL_ROUTE_YAW_SNAP_DELTA = 1.1;
const QA_SURVIVAL_CROSS_MAP_ROUTE: QaSurvivalRouteWaypoint[] = [
  { id: "meadow-east-rise", x: SURVIVAL_BLOCK_SIZE * 5 - 120, z: SURVIVAL_BLOCK_SIZE * -3 - 36 },
  { id: "east-wilds", x: SURVIVAL_BLOCK_SIZE * 6 - 80, z: SURVIVAL_BLOCK_SIZE * -3 + 110 },
  { id: "desert-edge", x: SURVIVAL_BLOCK_SIZE * 6 - 110, z: SURVIVAL_BLOCK_SIZE * -4 + 128 },
  { id: "south-meadow-route", x: SURVIVAL_BLOCK_SIZE * 4 + 120, z: SURVIVAL_BLOCK_SIZE * -4 + 150 },
  { id: "north-meadow-return", x: SURVIVAL_BLOCK_SIZE * 4 - 170, z: SURVIVAL_BLOCK_SIZE * -2 - 92 },
  { id: "meadow-start-loop", x: SURVIVAL_BLOCK_SIZE * 4 - 299, z: SURVIVAL_BLOCK_SIZE * -3 - 35 },
];
const QA_SURVIVAL_LONG_HAUL_ROUTE: QaSurvivalRouteWaypoint[] = [
  { id: "long-haul-point-b", x: SURVIVAL_BLOCK_SIZE * 6 + 160, z: SURVIVAL_BLOCK_SIZE * -5 + 170 },
  { id: "long-haul-point-a", x: SURVIVAL_BLOCK_SIZE * 2 - 240, z: SURVIVAL_BLOCK_SIZE * -2 + 180 },
];
const QA_SURVIVAL_BAD_LONG_HAUL_CHUNK = { cx: 8, cz: -6 };
const QA_SURVIVAL_BAD_LONG_HAUL_LOCAL_MIN_X = 120;
const QA_SURVIVAL_BAD_LONG_HAUL_LOCAL_MAX_Z = -120;
const QA_SURVIVAL_RESCUE_LONG_HAUL_LOCAL_X = -180;
const QA_SURVIVAL_RESCUE_LONG_HAUL_LOCAL_Z = 160;
const QA_SURVIVAL_RESCUE_LONG_HAUL_Y = 80;
const QA_BASE_VILLAGE_ROAD_HALF_WIDTH = 13.5;
const QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT = 190;
const QA_DARREL_GROVE_CLEARING_LOCAL_X = 86;
const QA_DARREL_GROVE_CLEARING_LOCAL_Z = 170;
const QA_DARREL_GROVE_RESCUE_Y = 38;
const QA_DARREL_GROVE_DRAGON_SIDE_APPROACH_X = 92;
const QA_DARREL_GROVE_DRAGON_SIDE_APPROACH_Z = 58;
const QA_DARREL_GROVE_DRAGON_SIDE_STAIR_X = 42;
const QA_DARREL_GROVE_DRAGON_SIDE_STAIR_Z = -50;
const QA_DARREL_GROVE_DRAGON_DOOR_Z = -18;
const QA_SURVIVAL_INSPECTION_MIN_INTERVAL = 3.8;
const QA_SURVIVAL_INSPECTION_MAX_INTERVAL = 8.6;
const QA_SURVIVAL_INSPECTION_MIN_SECONDS = 1.15;
const QA_SURVIVAL_INSPECTION_MAX_SECONDS = 2.35;
const QA_SURVIVAL_COMBAT_CAST_MIN_INTERVAL = 7.4;
const QA_SURVIVAL_COMBAT_CAST_MAX_INTERVAL = 12.8;
const QA_SPELL_DUMMY_COMBAT_CAST_MIN_INTERVAL = 1.15;
const QA_SPELL_DUMMY_COMBAT_CAST_MAX_INTERVAL = 2.35;
const QA_SURVIVAL_COMBAT_FOCUS_SECONDS = 0.62;
const QA_SURVIVAL_COMBAT_TARGET_RANGE = 96;
const QA_SURVIVAL_PRACTICE_CAST_MIN_INTERVAL = 9.4;
const QA_SURVIVAL_PRACTICE_CAST_MAX_INTERVAL = 15.6;
const QA_SURVIVAL_COMBAT_SPELL_SEQUENCE: SpellType[] = [
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
const QA_SURVIVAL_PRACTICE_SPELL_SEQUENCE: SpellType[] = [
  "fireball",
  "iceshard",
  "arcanebeam",
  "ringsofpower",
  "lightning",
  "poison",
];
const QA_INTENT_REPLAN_MIN_SECONDS = 2.1;
const QA_INTENT_REPLAN_MAX_SECONDS = 5.8;
const QA_INTENT_MANA_RANGE = 560;
const QA_INTENT_MANA_LOW_THRESHOLD = RUNE_POWER_MAX * 0.72;
const QA_INTENT_MANA_COLLECT_RADIUS = 5.8;
const QA_INTENT_DUMMY_RANGE = 260;
const QA_INTENT_DUMMY_TEST_RANGE = 980;
const QA_INTENT_DUMMY_KEEP_DISTANCE = 33;
const QA_INTENT_DUMMY_CLOSE_DISTANCE = 20;
const QA_DUMMY_REANCHOR_DISTANCE = 56;
const QA_DUMMY_REANCHOR_COOLDOWN_SECONDS = 14;
const QA_INTENT_QUEST_RANGE = 760;
const QA_INTENT_INTERACT_DISTANCE = 28;
const QA_INTENT_INTERACT_COOLDOWN_SECONDS = 2.4;
const QA_INTENT_OBSERVE_SECONDS = 1.25;
const QA_INTENT_INTEREST_STALE_SECONDS = 12;
const QA_DARREL_GROVE_DRAGON_INTEREST_SCORE = 78;
const QA_DARREL_GROVE_DRAGON_INTENT_SECONDS = 90;
const QA_DARREL_GROVE_DRAGON_INTERACT_DISTANCE = 42;
const QA_DARREL_GROVE_DRAGON_STEP_JUMP_DISTANCE = 128;
const GRAB_MAX_DURATION_MS = 6000;
const GRAB_DEFAULT_DISTANCE = 10;
const GRAB_FOLLOW_SPEED = 18;
const GRAB_THROW_SPEED = 42;
const SELF_BUFF_SPELLS = new Set<SpellType>(['magicarmor', 'jumpboost', 'speedboost', 'magicglassorb']);
const WORLD_UP = new THREE.Vector3(0, 1, 0);

type QaSurvivalWalkMode = "travel" | "route" | "inspect" | "avoid" | "recover" | "tube" | "approach" | "act";
type QaSurvivalIntentKind = "roam" | "mana-flower" | "spell-dummy" | "quest-target" | "darrel-dragon" | "landmark";
type QaSurvivalRouteWaypoint = { id: string; x: number; z: number };

interface QaSurvivalWalkInputState {
  forward: number;
  strafe: number;
  sprint: boolean;
  mode: QaSurvivalWalkMode;
}

interface QaSpellDummySnapshot {
  id: string;
  position: { x: number; y: number; z: number };
  health: number;
}

interface QaManaFlowerSnapshot {
  id: string;
  x: number;
  y: number;
  z: number;
  radius?: number;
}

interface QaSurvivalIntent {
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

function areControllerGameplayButtonsReleased(gamepad: Gamepad | null, bindings: object) {
  if (!gamepad) return false;

  const watchedButtons = new Set<GamepadButtonName>([
    "dpadUp",
    "dpadDown",
    "dpadLeft",
    "dpadRight",
  ]);

  Object.values(bindings as Record<string, GamepadButtonName>).forEach((button) => {
    watchedButtons.add(button);
  });

  for (const button of watchedButtons) {
    if (isGamepadButtonPressed(gamepad, button, CONTROLLER_ARM_BUTTON_THRESHOLD)) {
      return false;
    }
  }

  return true;
}

// Basic keyboard state
const keys = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  Space: false,
  ShiftLeft: false,
  KeyC: false,
  KeyQ: false,
  ControlLeft: false,
  ControlRight: false,
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}

function resetMovementKeys() {
  (Object.keys(keys) as Array<keyof typeof keys>).forEach((key) => {
    keys[key] = false;
  });
}

function getNumberSlotFromCode(code: string) {
  if (code === "Digit0") return 9;
  const match = code.match(/^Digit([1-9])$/);
  return match ? Number(match[1]) - 1 : -1;
}

function isMeditationControl(code: string) {
  return code === "ControlLeft" || code === "ControlRight";
}

function isMouseLookFallbackActive() {
  const state = useGameStore.getState();
  return document.documentElement.dataset.wizardsMouseLookFallback === "true" &&
    state.isGameLaunched &&
    !state.isPauseMenuOpen &&
    !state.isSpellMenuOpen &&
    !state.questDialogSession &&
    !state.isInventoryOpen &&
    !state.isMapExpanded &&
    !state.isScoreboardOpen &&
    state.health > 0;
}

function isMouseGameplayInputActive() {
  return Boolean(document.pointerLockElement || isMouseLookFallbackActive());
}

function isKeyboardArrowLookInputActive() {
  const state = useGameStore.getState();
  return state.keyboardArrowLookEnabled &&
    state.isGameLaunched &&
    !state.isPauseMenuOpen &&
    !state.isSpellMenuOpen &&
    !state.questDialogSession &&
    !state.isInventoryOpen &&
    !state.isMapExpanded &&
    !state.isScoreboardOpen &&
    state.health > 0 &&
    (isMouseGameplayInputActive() || state.isTouchControlsActive);
}

window.addEventListener("keydown", (e) => {
  if (isEditableTarget(e.target)) return;
  if (keys.hasOwnProperty(e.code)) {
    keys[e.code as keyof typeof keys] = true;
    if (e.code.startsWith("Arrow") && isKeyboardArrowLookInputActive()) {
      e.preventDefault();
    }
  }
});
window.addEventListener("keyup", (e) => {
  if (keys.hasOwnProperty(e.code)) keys[e.code as keyof typeof keys] = false;
});

type GrabbedPlayerState = {
  casterId: string;
  grabId?: string;
  dir: THREE.Vector3;
  origin: THREE.Vector3;
  distance: number;
  lastControlAt: number;
  until: number;
};

type TouchButtonName = 'jump' | 'slide' | 'sprint';

function getAimDirectionFromRotation(rot?: [number, number, number]) {
  if (!rot) return new THREE.Vector3(0, 0, -1);

  const pitch = THREE.MathUtils.clamp(rot[0] ?? 0, -1.35, 1.35);
  const yaw = rot[1] ?? 0;
  return new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch)
  ).normalize();
}

function getPlayerAimDirection(player?: { aimDir?: [number, number, number]; rot?: [number, number, number] }) {
  if (player?.aimDir) {
    return new THREE.Vector3(player.aimDir[0], player.aimDir[1], player.aimDir[2]).normalize();
  }

  return getAimDirectionFromRotation(player?.rot);
}

type QaSurvivalSpawn = {
  key: string;
  position: [number, number, number];
  yaw?: number;
  pitch?: number;
};

const TEMP_MOUNTAIN_VILLAGE_SPAWN_CHUNK: [number, number] = [3, 0];
const TEMP_MOUNTAIN_VILLAGE_SPAWN_Y = 86;
const TEMP_MOUNTAIN_VILLAGE_SPAWN_LOCAL_X = -36;
const TEMP_MOUNTAIN_VILLAGE_SPAWN_LOCAL_Z = 182;
const QA_SPELL_DUMMY_RANGE_CHUNK: [number, number] = [4, -3];
const QA_SPELL_DUMMY_RANGE_Y = 150;
const QA_SPELL_DUMMY_RANGE_LOCAL_Z = 214;
const TEMP_GRAVEYARD_VILLAGE_SPAWN_CHUNK: [number, number] = [5, 2];
const TEMP_GRAVEYARD_VILLAGE_SPAWN_Y = 92;
const TEMP_GRAVEYARD_VILLAGE_SPAWN_LOCAL_Z = 132;
const RANDOM_SURVIVAL_SPAWN_MIN_CHUNK_DISTANCE = 2;
const RANDOM_SURVIVAL_SPAWN_MAX_CHUNK_DISTANCE = 8;
const RANDOM_SURVIVAL_SPAWN_Y = 180;
const RANDOM_SURVIVAL_SPAWN_LOCAL_MIN = SURVIVAL_BLOCK_SIZE * 0.3;
const RANDOM_SURVIVAL_SPAWN_LOCAL_MAX = SURVIVAL_BLOCK_SIZE * 0.42;
const RANDOM_SURVIVAL_RESERVED_CHUNKS: Array<[number, number]> = [
  [0, 0],
  [-3, -3],
  [4, -4],
  [0, -3],
  QA_SPELL_DUMMY_RANGE_CHUNK,
  TEMP_MOUNTAIN_VILLAGE_SPAWN_CHUNK,
  TEMP_GRAVEYARD_VILLAGE_SPAWN_CHUNK,
  [DARREL_QUEST_CHUNK.cx, DARREL_QUEST_CHUNK.cz],
  [LILY_COIL_QUEST_CHUNK.cx, LILY_COIL_QUEST_CHUNK.cz],
];
const DEFAULT_PLAYER_SPAWN_POSITION: [number, number, number] = [0, 5, 30];
const DEFAULT_FALL_RECOVERY_SPAWN_POSITION: [number, number, number] = [0, 15, 30];
const LILY_COIL_TUBE_PATH_RADIUS = 238;
const LILY_COIL_TUBE_START_Y = 108;
const LILY_COIL_TUBE_RISE = 520;
const LILY_COIL_TUBE_TURNS = 3.15;
const LILY_COIL_TUBE_START_ANGLE = -Math.PI / 2;
const LILY_COIL_TUBE_RADIUS = 76;
const LILY_COIL_TUBE_PLAYER_RADIUS = LILY_COIL_TUBE_RADIUS - PLAYER_FOOT_OFFSET;
const LILY_COIL_TUBE_ANGLE_RATE = Math.PI * 2 * LILY_COIL_TUBE_TURNS;
const LILY_COIL_TUBE_PATH_LENGTH = Math.hypot(
  LILY_COIL_TUBE_PATH_RADIUS * LILY_COIL_TUBE_ANGLE_RATE,
  LILY_COIL_TUBE_RISE,
);
const LILY_COIL_TUBE_JUMP_FORCE = 18;
const LILY_COIL_TUBE_JUMP_GRAVITY = 38;
const LILY_COIL_TUBE_MAX_JUMP_OFFSET = 18;
const QA_LILY_COIL_TUBE_FORWARD = 0.78;
const QA_LILY_COIL_TUBE_STRAFE = 0.24;
const QA_LILY_COIL_TUBE_LOOK_AHEAD_T = 0.048;
const QA_LILY_COIL_TUBE_REVERSE_EDGE_T = 0.94;
const QA_LILY_COIL_TUBE_RESTART_EDGE_T = 0.045;
let randomSurvivalSpawn: QaSurvivalSpawn | null = null;
let randomSurvivalSpawnMode: string | null = null;

function getSurvivalChunkSpawn(
  cx: number,
  cz: number,
  keyPrefix: string,
  options: { y?: number; localX?: number; localZ?: number; yaw?: number; pitch?: number } = {}
): QaSurvivalSpawn {
  return {
    key: `${keyPrefix}:${cx},${cz}`,
    position: [
      cx * SURVIVAL_BLOCK_SIZE + (options.localX ?? 0),
      options.y ?? 140,
      cz * SURVIVAL_BLOCK_SIZE + (options.localZ ?? 214),
    ],
    yaw: options.yaw,
    pitch: options.pitch,
  };
}

function getNumericSearchParam(params: URLSearchParams, key: string) {
  const value = params.get(key);
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getQaSurvivalUrlSpawnOptions(params: URLSearchParams, cx?: number, cz?: number) {
  const options: { y?: number; localX?: number; localZ?: number; yaw?: number; pitch?: number } = {};
  const y = getNumericSearchParam(params, "qaSurvivalY");
  const localX = getNumericSearchParam(params, "qaSurvivalLocalX");
  const localZ = getNumericSearchParam(params, "qaSurvivalLocalZ");
  const yaw = getNumericSearchParam(params, "qaSurvivalYaw");
  const pitch = getNumericSearchParam(params, "qaSurvivalPitch");
  const shouldRescueBadLongHaulEndpoint =
    cx === QA_SURVIVAL_BAD_LONG_HAUL_CHUNK.cx &&
    cz === QA_SURVIVAL_BAD_LONG_HAUL_CHUNK.cz &&
    localX !== undefined &&
    localZ !== undefined &&
    localX >= QA_SURVIVAL_BAD_LONG_HAUL_LOCAL_MIN_X &&
    localZ <= QA_SURVIVAL_BAD_LONG_HAUL_LOCAL_MAX_Z;

  if (y !== undefined) options.y = y;
  if (shouldRescueBadLongHaulEndpoint) {
    options.y = Math.max(options.y ?? QA_SURVIVAL_RESCUE_LONG_HAUL_Y, QA_SURVIVAL_RESCUE_LONG_HAUL_Y);
    options.localX = QA_SURVIVAL_RESCUE_LONG_HAUL_LOCAL_X;
    options.localZ = QA_SURVIVAL_RESCUE_LONG_HAUL_LOCAL_Z;
  } else {
    if (localX !== undefined) options.localX = localX;
    if (localZ !== undefined) options.localZ = localZ;
  }
  if (yaw !== undefined) options.yaw = yaw;
  if (pitch !== undefined) options.pitch = pitch;
  return options;
}

function getQaSurvivalChunkSpawnOptions(cx: number, cz: number) {
  const key = `${cx},${cz}`;
  const options: Record<string, { y?: number; localX?: number; localZ?: number; yaw?: number }> = {
    "0,0": { y: 15, localX: 0, localZ: 30, yaw: 0 },
    "4,-4": { y: 150, localX: 0, localZ: 306, yaw: Math.PI },
    "0,-3": { y: 150, localX: 0, localZ: 306, yaw: Math.PI },
    "-3,-3": { y: 150, localX: 0, localZ: 306, yaw: Math.PI },
    "1,0": { y: 28, localX: 0, localZ: 24, yaw: 0 },
    "3,0": { y: TEMP_MOUNTAIN_VILLAGE_SPAWN_Y, localX: TEMP_MOUNTAIN_VILLAGE_SPAWN_LOCAL_X, localZ: TEMP_MOUNTAIN_VILLAGE_SPAWN_LOCAL_Z, yaw: 1.68 },
    "5,2": { y: 92, localX: 0, localZ: 132, yaw: 0 },
  };
  return options[key] ?? {};
}

function isSurvivalGameMode(gameMode: string) {
  return gameMode === "solo-survival" || gameMode === "multiplayer-survival";
}

function getLilyCoilTubeFrame(t: number) {
  const clampedT = THREE.MathUtils.clamp(t, 0, 1);
  const angle = LILY_COIL_TUBE_START_ANGLE + LILY_COIL_TUBE_ANGLE_RATE * clampedT;
  const center = new THREE.Vector3(
    LILY_COIL_QUEST_CHUNK.cx * SURVIVAL_BLOCK_SIZE + Math.cos(angle) * LILY_COIL_TUBE_PATH_RADIUS,
    LILY_COIL_TUBE_START_Y + LILY_COIL_TUBE_RISE * clampedT,
    LILY_COIL_QUEST_CHUNK.cz * SURVIVAL_BLOCK_SIZE + Math.sin(angle) * LILY_COIL_TUBE_PATH_RADIUS,
  );
  const tangent = new THREE.Vector3(
    -Math.sin(angle) * LILY_COIL_TUBE_PATH_RADIUS * LILY_COIL_TUBE_ANGLE_RATE,
    LILY_COIL_TUBE_RISE,
    Math.cos(angle) * LILY_COIL_TUBE_PATH_RADIUS * LILY_COIL_TUBE_ANGLE_RATE,
  ).normalize();
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(tangent, -tangent.y);
  if (up.lengthSq() < 0.0001) up.set(1, 0, 0);
  up.normalize();
  const side = new THREE.Vector3().crossVectors(tangent, up).normalize();
  return { center, tangent, up, side };
}

function getNearestLilyCoilTubeState(position: THREE.Vector3) {
  let bestT = 0;
  let bestDistanceSq = Infinity;
  const samples = 180;
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    const frame = getLilyCoilTubeFrame(t);
    const distanceSq = frame.center.distanceToSquared(position);
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestT = t;
    }
  }

  const frame = getLilyCoilTubeFrame(bestT);
  const offset = position.clone().sub(frame.center);
  const upAmount = offset.dot(frame.up);
  const sideAmount = offset.dot(frame.side);
  const surfaceAngle = Math.hypot(upAmount, sideAmount) > 0.01
    ? Math.atan2(sideAmount, upAmount)
    : Math.PI;
  return { t: bestT, surfaceAngle };
}

function isInLilyCoilTubeChunk(position: THREE.Vector3, gameMode: string) {
  if (!isSurvivalGameMode(gameMode)) return false;
  const centerX = LILY_COIL_QUEST_CHUNK.cx * SURVIVAL_BLOCK_SIZE;
  const centerZ = LILY_COIL_QUEST_CHUNK.cz * SURVIVAL_BLOCK_SIZE;
  const horizontalDistance = Math.hypot(position.x - centerX, position.z - centerZ);
  return horizontalDistance < LILY_COIL_TUBE_PATH_RADIUS + LILY_COIL_TUBE_RADIUS + 145 &&
    position.y > -80 &&
    position.y < LILY_COIL_TUBE_START_Y + LILY_COIL_TUBE_RISE + LILY_COIL_TUBE_RADIUS + 120;
}

function getRandomUnit() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] / 0xffffffff;
  }

  return Math.random();
}

function getRandomInteger(min: number, max: number) {
  return Math.floor(getRandomUnit() * (max - min + 1)) + min;
}

function getRandomSignedLocalSpawnOffset() {
  const magnitude = RANDOM_SURVIVAL_SPAWN_LOCAL_MIN +
    getRandomUnit() * (RANDOM_SURVIVAL_SPAWN_LOCAL_MAX - RANDOM_SURVIVAL_SPAWN_LOCAL_MIN);
  return (getRandomUnit() < 0.5 ? -1 : 1) * magnitude;
}

function isReservedSurvivalSpawnChunk(cx: number, cz: number) {
  return RANDOM_SURVIVAL_RESERVED_CHUNKS.some(([reservedCx, reservedCz]) => (
    Math.abs(cx - reservedCx) <= 1 && Math.abs(cz - reservedCz) <= 1
  ));
}

function getRandomSurvivalSpawnChunk() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const cx = getRandomInteger(-RANDOM_SURVIVAL_SPAWN_MAX_CHUNK_DISTANCE, RANDOM_SURVIVAL_SPAWN_MAX_CHUNK_DISTANCE);
    const cz = getRandomInteger(-RANDOM_SURVIVAL_SPAWN_MAX_CHUNK_DISTANCE, RANDOM_SURVIVAL_SPAWN_MAX_CHUNK_DISTANCE);
    if (Math.max(Math.abs(cx), Math.abs(cz)) < RANDOM_SURVIVAL_SPAWN_MIN_CHUNK_DISTANCE) continue;
    if (isReservedSurvivalSpawnChunk(cx, cz)) continue;
    return { cx, cz };
  }

  return { cx: -RANDOM_SURVIVAL_SPAWN_MIN_CHUNK_DISTANCE, cz: RANDOM_SURVIVAL_SPAWN_MIN_CHUNK_DISTANCE };
}

function getRandomSurvivalWorldSpawn(): QaSurvivalSpawn | null {
  const gameMode = useGameStore.getState().gameMode;
  if (!isSurvivalGameMode(gameMode)) {
    randomSurvivalSpawn = null;
    randomSurvivalSpawnMode = null;
    return null;
  }

  if (randomSurvivalSpawn && randomSurvivalSpawnMode === gameMode) {
    return randomSurvivalSpawn;
  }

  const { cx, cz } = getRandomSurvivalSpawnChunk();
  const localX = getRandomSignedLocalSpawnOffset();
  const localZ = getRandomSignedLocalSpawnOffset();
  const rollKey = `${Date.now().toString(36)}-${Math.floor(getRandomUnit() * 0xffffff).toString(36)}`;
  randomSurvivalSpawn = getSurvivalChunkSpawn(cx, cz, `random-survival:${gameMode}:${rollKey}`, {
    y: RANDOM_SURVIVAL_SPAWN_Y,
    localX,
    localZ,
  });
  randomSurvivalSpawnMode = gameMode;
  return randomSurvivalSpawn;
}

function getManualFastTravelSpawn(): QaSurvivalSpawn | null {
  if (typeof window === "undefined") return null;

  const manual = (window as any).__wofManualFastTravelSpawn;
  if (!manual || typeof manual !== "object") return null;
  if (Number(manual.until) <= Date.now()) return null;

  const x = Number(manual.x);
  const y = Number(manual.y);
  const z = Number(manual.z);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;

  const yaw = Number(manual.yaw);
  return {
    key: typeof manual.key === "string" ? manual.key : `manual-fast-travel:${x.toFixed(2)}:${y.toFixed(2)}:${z.toFixed(2)}`,
    position: [x, y, z],
    yaw: Number.isFinite(yaw) ? yaw : undefined,
  };
}

function getQaSurvivalSpawnFromUrl(): QaSurvivalSpawn | null {
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const chunkParam = params.get("qaSurvivalChunk");
    if (chunkParam) {
      const decodedChunkParam = (() => {
        try {
          return decodeURIComponent(chunkParam);
        } catch {
          return chunkParam;
        }
      })();
      const [cx, cz] = decodedChunkParam.split(",").map((value) => Number(value.trim()));
      if (Number.isFinite(cx) && Number.isFinite(cz)) {
        const runKey = params.get("qaPerfRun") || params.get("qaReload") || "";
        const normalizedRunKey = runKey.toLowerCase();
        const isDarrelQuestChunk = cx === DARREL_QUEST_CHUNK.cx && cz === DARREL_QUEST_CHUNK.cz;
        const isDarrelQuestRun = normalizedRunKey.includes("darrel");
        if (isDarrelQuestChunk || isDarrelQuestRun) {
          if (params.get("qaSurvivalWalk") === "1") {
            return getSurvivalChunkSpawn(cx, cz, `qa:darrel-open-walk-spawn:${decodedChunkParam}:${runKey}`, {
              y: 38,
              localX: QA_DARREL_GROVE_CLEARING_LOCAL_X,
              localZ: QA_DARREL_GROVE_CLEARING_LOCAL_Z,
              yaw: -Math.PI * 0.35,
            });
          }

          const darrelSpawn = getDarrelQuestSpawn();
          const spawnKey = [darrelSpawn.x, darrelSpawn.y, darrelSpawn.z, darrelSpawn.yaw ?? 0]
            .map((value) => Number(value).toFixed(2))
            .join(":");
          return {
            key: `qa:darrel-quest-spawn:${decodedChunkParam}:${runKey}:${spawnKey}`,
            position: [darrelSpawn.x, darrelSpawn.y, darrelSpawn.z],
            yaw: darrelSpawn.yaw,
          };
        }
        const isLilyCoilQuestChunk = cx === LILY_COIL_QUEST_CHUNK.cx && cz === LILY_COIL_QUEST_CHUNK.cz;
        const isLilyCoilQuestRun = normalizedRunKey.includes("lily") || normalizedRunKey.includes("coil");
        if (isLilyCoilQuestChunk || isLilyCoilQuestRun) {
          const coilSpawn = getLilyCoilQuestSpawn();
          return {
            key: `qa:lily-coil-spawn:${decodedChunkParam}:${runKey}`,
            position: [coilSpawn.x, coilSpawn.y, coilSpawn.z],
            yaw: coilSpawn.yaw,
          };
        }
        if (params.get("qaSpellDummies") === "1") {
          const [dummyCx, dummyCz] = QA_SPELL_DUMMY_RANGE_CHUNK;
          return getSurvivalChunkSpawn(dummyCx, dummyCz, `qa:spell-dummy-range:${decodedChunkParam}:${runKey}`, {
            y: QA_SPELL_DUMMY_RANGE_Y,
            localZ: QA_SPELL_DUMMY_RANGE_LOCAL_Z,
            yaw: 0,
          });
        }
        return getSurvivalChunkSpawn(cx, cz, `qa:${decodedChunkParam}:${runKey}`, {
          ...getQaSurvivalChunkSpawnOptions(cx, cz),
          ...getQaSurvivalUrlSpawnOptions(params, cx, cz),
        });
      }
    }
  }

  return null;
}

function getTemporaryMountainVillageSpawn(): QaSurvivalSpawn | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  if (
    params.get("disableMountainSpawn") === "1"
    || params.get("disableSwampSpawn") === "1"
  ) return null;

  const shouldSpawnAtMountainVillage = params.get("spawnMountain") === "1";
  if (!shouldSpawnAtMountainVillage) return null;

  const [cx, cz] = TEMP_MOUNTAIN_VILLAGE_SPAWN_CHUNK;
  return getSurvivalChunkSpawn(cx, cz, "temp-mountain-village", {
    y: TEMP_MOUNTAIN_VILLAGE_SPAWN_Y,
    localX: TEMP_MOUNTAIN_VILLAGE_SPAWN_LOCAL_X,
    localZ: TEMP_MOUNTAIN_VILLAGE_SPAWN_LOCAL_Z,
    yaw: 1.68,
  });
}

function getTemporaryGraveyardVillageSpawn(): QaSurvivalSpawn | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  if (params.get("disableGraveyardSpawn") === "1") return null;

  const shouldSpawnAtGraveyardVillage = params.get("spawnGraveyard") === "1";
  if (!shouldSpawnAtGraveyardVillage) return null;

  const [cx, cz] = TEMP_GRAVEYARD_VILLAGE_SPAWN_CHUNK;
  return getSurvivalChunkSpawn(cx, cz, "temp-graveyard-village", {
    y: TEMP_GRAVEYARD_VILLAGE_SPAWN_Y,
    localZ: TEMP_GRAVEYARD_VILLAGE_SPAWN_LOCAL_Z,
  });
}

function getTemporaryDefaultSurvivalSpawn(): QaSurvivalSpawn | null {
  const gameMode = useGameStore.getState().gameMode;
  if (!isSurvivalGameMode(gameMode)) return null;
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("disableDefaultQuestSpawn") === "1") return null;
  }

  const spawn = getLilyCoilQuestSpawn();
  const spawnKey = [spawn.x, spawn.y, spawn.z, spawn.yaw ?? 0]
    .map((value) => Number(value).toFixed(2))
    .join(":");
  return {
    key: `default-survival-lily-coil:${gameMode}:${spawnKey}`,
    position: [spawn.x, spawn.y, spawn.z],
    yaw: spawn.yaw,
  };
}

function getPlayerSpawnOverride(): QaSurvivalSpawn | null {
  return getManualFastTravelSpawn()
    ?? getTemporaryMountainVillageSpawn()
    ?? getTemporaryGraveyardVillageSpawn()
    ?? getQaSurvivalSpawnFromUrl()
    ?? getTemporaryDefaultSurvivalSpawn()
    ?? getRandomSurvivalWorldSpawn();
}

function getPlayerSpawnPosition(fallbackPosition = DEFAULT_PLAYER_SPAWN_POSITION): [number, number, number] {
  return getPlayerSpawnOverride()?.position ?? fallbackPosition;
}

function getInitialPlayerPosition(): [number, number, number] {
  return getPlayerSpawnPosition();
}

function isQaSurvivalWalkEnabled() {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("qaSurvivalWalk") === "1";
}

function getQaSurvivalWalkStartDelaySeconds() {
  if (!import.meta.env.DEV || typeof window === "undefined") return 0;
  const params = new URLSearchParams(window.location.search);
  const rawDelay = params.get("qaSurvivalWalkDelay") ?? params.get("qaWalkDelay") ?? "0";
  const delayMs = Number(rawDelay);
  if (!Number.isFinite(delayMs) || delayMs <= 0) return 0;
  return THREE.MathUtils.clamp(delayMs / 1000, 0, 60);
}

function getQaSurvivalRouteWaypoints() {
  if (!import.meta.env.DEV || typeof window === "undefined") return [] as QaSurvivalRouteWaypoint[];
  const params = new URLSearchParams(window.location.search);
  const route = (params.get("qaSurvivalRoute") || params.get("qaRoute") || "").toLowerCase();
  if (!route || route === "off" || route === "0") return [];
  if (route.includes("long") || route.includes("point") || route === "ab" || route === "a-b") {
    return QA_SURVIVAL_LONG_HAUL_ROUTE;
  }
  return QA_SURVIVAL_CROSS_MAP_ROUTE;
}

function isQaSpellDummyRunEnabled() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("qaSpellDummies") === "1";
}

function survivalishTurnNoise(x: number, z: number, time: number) {
  const n = Math.sin(x * 12.9898 + z * 78.233 + time * 4.719) * 43758.5453;
  return n - Math.floor(n);
}

function getQaSurvivalChunkCenter(value: number) {
  return Math.floor((value + SURVIVAL_BLOCK_SIZE / 2) / SURVIVAL_BLOCK_SIZE) * SURVIVAL_BLOCK_SIZE;
}

function lerpAngleRadians(from: number, to: number, alpha: number) {
  return from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * alpha;
}

function angleDeltaRadians(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function moveAngleTowardsRadians(from: number, to: number, maxStep: number) {
  const delta = angleDeltaRadians(from, to);
  return from + THREE.MathUtils.clamp(delta, -maxStep, maxStep);
}

function randomRangeFromNoise(seed: number, min: number, max: number) {
  return min + THREE.MathUtils.clamp(seed, 0, 1) * (max - min);
}

function getQaSpellDummies() {
  if (typeof window === "undefined") return [] as QaSpellDummySnapshot[];
  const snapshots = ((window as any).__wofSpellDummies ?? []) as Partial<QaSpellDummySnapshot>[];
  return snapshots.filter((dummy): dummy is QaSpellDummySnapshot => (
    typeof dummy?.id === "string" &&
    Boolean(dummy.position) &&
    Number.isFinite(dummy.position?.x) &&
    Number.isFinite(dummy.position?.y) &&
    Number.isFinite(dummy.position?.z) &&
    Number(dummy.health) > 0
  ));
}

function getQaManaFlowerCooldowns() {
  const cooldowns = new Map<string, number>();
  if (typeof document === "undefined") return cooldowns;

  const raw = document.documentElement.dataset.wofManaFlowerCooldowns ?? "";
  raw.split("|").forEach((entry) => {
    const splitIndex = entry.lastIndexOf(":");
    if (splitIndex <= 0) return;
    const id = entry.slice(0, splitIndex);
    const seconds = Number(entry.slice(splitIndex + 1));
    if (id && Number.isFinite(seconds) && seconds > 0) {
      cooldowns.set(id, seconds);
    }
  });
  return cooldowns;
}

function getReadyQaManaFlowers() {
  if (typeof window === "undefined") return [] as QaManaFlowerSnapshot[];
  const cooldowns = getQaManaFlowerCooldowns();
  const sources = ((window as any).__wofManaFlowerSources ?? []) as Partial<QaManaFlowerSnapshot>[];
  return sources.filter((source): source is QaManaFlowerSnapshot => (
    typeof source?.id === "string" &&
    !cooldowns.has(source.id) &&
    Number.isFinite(source.x) &&
    Number.isFinite(source.y) &&
    Number.isFinite(source.z)
  ));
}

function getQuestNavigationIntentTargets() {
  const state = useGameStore.getState();
  return getActiveQuestNavigationTargets({
    spellQuestAssignments: state.spellQuestAssignments,
    questFlags: state.questFlags,
    questUnlockedSpells: state.questUnlockedSpells,
    questNpcPrograms: state.questNpcPrograms,
  });
}

function pickQaQuestDialogChoice(session: QuestDialogSession) {
  const priorities = [
    "darrel-two-spells",
    "darrel-accept-job",
    "darrel-dragon-peace",
    "darrel-close",
  ];
  for (const id of priorities) {
    const choice = session.choices.find((candidate) => candidate.id === id);
    if (choice) return choice;
  }
  return session.choices.find((choice) => !choice.id.includes("fight") && !choice.id.includes("jerk"))
    ?? session.choices[0]
    ?? null;
}

function publishQaPlayerPosition(position: { x: number; y: number; z: number }) {
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

export function PlayerController() {
  const rigidBody = useRef<RapierRigidBody>(null);
  const { rapier, world } = useRapier();
  const { camera } = useThree();
  const getHealth = () => useGameStore.getState().health;
  const initialPlayerPosition = useMemo(() => getInitialPlayerPosition(), []);
  const qaSurvivalWalkEnabled = useMemo(() => isQaSurvivalWalkEnabled(), []);
  const qaSurvivalWalkStartDelaySeconds = useMemo(() => getQaSurvivalWalkStartDelaySeconds(), []);
  const forcedSpawnKey = useRef<string | null>(null);
  const qaWalkStartTime = useRef<number | null>(null);
  const qaWalkYaw = useRef<number | null>(null);
  const qaWalkLastDecisionAt = useRef(0);
  const qaWalkLastProgressAt = useRef(0);
  const qaWalkLastProgressPos = useRef(new THREE.Vector3());
  const qaWalkInputState = useRef<QaSurvivalWalkInputState>({ forward: 0, strafe: 0, sprint: false, mode: "travel" });
  const qaWalkWaypoint = useRef({ x: 0, z: 0, expiresAt: 0 });
  const qaWalkNextDecisionAt = useRef(0);
  const qaWalkInspectUntil = useRef(0);
  const qaWalkNextInspectAt = useRef(0);
  const qaWalkInspectYaw = useRef(0);
  const qaWalkNextCombatCastAt = useRef(0);
  const qaWalkCombatFocusUntil = useRef(0);
  const qaWalkCombatTargetYaw = useRef(0);
  const qaWalkCombatSpellIndex = useRef(0);
  const qaWalkLastCombatCastAt = useRef(0);
  const qaWalkNextPracticeCastAt = useRef(0);
  const qaWalkPracticeSpellIndex = useRef(0);
  const qaWalkJumpHeldUntil = useRef(0);
  const qaWalkJumpWasPressed = useRef(false);
  const qaWalkRecoveryStartedAt = useRef(0);
  const qaWalkRecoveryUntil = useRef(0);
  const qaWalkRecoveryYaw = useRef(0);
  const qaWalkRecoveryStrafe = useRef(0);
  const qaWalkRecoveryStartPos = useRef(new THREE.Vector3());
  const qaWalkLastUnstickNudgeAt = useRef(0);
  const qaWalkStuckStrikes = useRef(0);
  const qaWalkLowSpeedStartedAt = useRef(0);
  const qaWalkLilyTubeDirection = useRef(1);
  const qaWalkIntent = useRef<QaSurvivalIntent | null>(null);
  const qaWalkNextIntentAt = useRef(0);
  const qaWalkLastInteractionAt = useRef(0);
  const qaWalkInterestMemory = useRef<Record<string, number>>({});
  const qaWalkLastDialogActionAt = useRef(0);
  const qaWalkLastTelemetryAt = useRef(0);
  const qaWalkLastTelemetryPos = useRef(new THREE.Vector3());
  const qaWalkLastDummyReanchorAt = useRef(0);
  const qaWalkRouteIndex = useRef(0);
  const qaWalkRouteSmoothedYaw = useRef<number | null>(null);
  const qaWalkRouteTargetId = useRef<string | null>(null);
  const qaWalkRouteBlockedSince = useRef(0);
  const activeLadderZones = useRef(new Set<string>());

  const resetQaWalkRecovery = () => {
    qaWalkRecoveryStartedAt.current = 0;
    qaWalkRecoveryUntil.current = 0;
    qaWalkRecoveryYaw.current = 0;
    qaWalkRecoveryStrafe.current = 0;
    qaWalkRecoveryStartPos.current.set(0, 0, 0);
    qaWalkLastUnstickNudgeAt.current = 0;
    qaWalkStuckStrikes.current = 0;
    qaWalkLowSpeedStartedAt.current = 0;
    qaWalkRouteBlockedSince.current = 0;
  };

  const [jumps, setJumps] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const [isCrouching, setIsCrouching] = useState(false);
  const slideTimer = useRef(0);
  const lastSlideTime = useRef(0);
  const crouchHoldStartedAt = useRef<number | null>(null);
  const lastGroundedAt = useRef(0);
  const lastBoostTime = useRef(0);
  const thrusterLocked = useRef(false);
  const lastNetworkSync = useRef(0);
  const flamethrowerTimers = useRef<Record<HandType, number>>({ left: 0, right: 0 });
  const activeCastingHands = useRef<Record<HandType, boolean>>({ left: false, right: false });
  const activeGrabIds = useRef<Record<HandType, string | null>>({ left: null, right: null });
  const grabTimeouts = useRef<Record<HandType, number | null>>({ left: null, right: null });
  const grabbedState = useRef<GrabbedPlayerState | null>(null);
  const pullVelocity = useRef(new THREE.Vector3());
  const pullFrames = useRef(0);
  const screenShake = useRef({ strength: 0, until: 0, duration: 1 });
  const toxicDamageBuffer = useRef(0);
  const lastToxicDamageSync = useRef(Date.now());
  const lilyCoilTubeState = useRef({
    t: 0,
    surfaceAngle: Math.PI,
    jumpOffset: 0,
    jumpVelocity: 0,
    lastUp: new THREE.Vector3(0, 1, 0),
    active: false,
  });
  const controllerLookEuler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const controllerGameplayArmed = useRef(false);
  const keyboardJumpWasPressed = useRef(false);
  const controllerJumpWasPressed = useRef(false);
  const controllerSprintWasPressed = useRef(false);
  const controllerSprintLatched = useRef(false);
  const touchMove = useRef({ x: 0, y: 0 });
  const touchLookDelta = useRef({ x: 0, y: 0 });
  const touchButtons = useRef<Record<TouchButtonName, boolean>>({ jump: false, slide: false, sprint: false });
  const touchJumpWasPressed = useRef(false);
  const touchSprintWasPressed = useRef(false);
  const touchSprintLatched = useRef(false);
  const astralExitHoldStartedAt = useRef<number | null>(null);
  const astralExitArmed = useRef(false);

  const direction = new THREE.Vector3();
  const frontVector = new THREE.Vector3();
  const sideVector = new THREE.Vector3();
  const cameraRollForward = new THREE.Vector3();
  const cameraRollActualUp = new THREE.Vector3();
  const cameraRollRight = new THREE.Vector3();
  const cameraRollExpectedUp = new THREE.Vector3();
  const cameraAntiClipProbe = useRef(new THREE.Vector3());
  const cameraAntiClipPush = useRef(new THREE.Vector3());
  const cameraTargetPosition = useRef(new THREE.Vector3());

  const isCharging = useGameStore(s => s.isChargingSpell);
  const chargingHands = useGameStore(s => s.chargingHands);
  const leftCurrentSpell = useGameStore(s => s.leftCurrentSpell);
  const rightCurrentSpell = useGameStore(s => s.rightCurrentSpell);
  const isVClipEnabled = useGameStore(s => s.isVClipEnabled);
  const isAstralMeditating = useGameStore(s => s.isAstralMeditating);
  const showHealGlow = isCharging && (
    (leftCurrentSpell === 'healspell' && chargingHands.left) ||
    (rightCurrentSpell === 'healspell' && chargingHands.right)
  );

  const hasCameraRollAgainstWorldUp = () => {
    if (Math.abs(camera.up.x) > 0.001 || Math.abs(camera.up.y - 1) > 0.001 || Math.abs(camera.up.z) > 0.001) {
      return true;
    }

    camera.getWorldDirection(cameraRollForward).normalize();
    cameraRollRight.crossVectors(cameraRollForward, WORLD_UP);
    if (cameraRollRight.lengthSq() < 0.0001) {
      return false;
    }

    cameraRollRight.normalize();
    cameraRollExpectedUp.crossVectors(cameraRollRight, cameraRollForward).normalize();
    cameraRollActualUp.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
    return cameraRollActualUp.angleTo(cameraRollExpectedUp) > 0.01;
  };

  const resetLilyCoilCameraState = (yawOverride?: number, pitchOverride?: number) => {
    const tubeState = lilyCoilTubeState.current;
    tubeState.active = false;
    tubeState.jumpOffset = 0;
    tubeState.jumpVelocity = 0;
    tubeState.lastUp.set(0, 1, 0);
    (window as any).__wofLilyCoilTubeState = null;

    const lookDir = new THREE.Vector3();
    camera.getWorldDirection(lookDir);
    const horizontalLength = Math.hypot(lookDir.x, lookDir.z);
    const yaw = Number.isFinite(yawOverride)
      ? Number(yawOverride)
      : horizontalLength > 0.0001
        ? Math.atan2(lookDir.x, -lookDir.z)
        : controllerLookEuler.current.y;
    const pitch = Number.isFinite(pitchOverride)
      ? THREE.MathUtils.clamp(Number(pitchOverride), -1.45, 1.45)
      : Number.isFinite(yawOverride)
        ? 0
        : THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(lookDir.y, -1, 1)), -1.45, 1.45);

    camera.up.set(0, 1, 0);
    controllerLookEuler.current.set(pitch, yaw, 0);
    camera.quaternion.setFromEuler(controllerLookEuler.current);
    return yaw;
  };

  const clearToxicEffectsWithNetwork = () => {
    const state = useGameStore.getState();
    const now = Date.now();
    if (state.poisonUntil <= now && state.acidUntil <= now) return;

    state.clearToxicEffects();
    if (socket.id) {
      socket.emit("clearStatusEffect", { targetId: socket.id, effects: ["poison", "acid"] });
    }
  };

  const applyCameraLookDelta = (yawDelta: number, pitchDelta: number) => {
    if (yawDelta === 0 && pitchDelta === 0) return;

    if (lilyCoilTubeState.current.active) {
      if (yawDelta !== 0) {
        const yawAxis = camera.up.clone().normalize();
        camera.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(yawAxis, yawDelta));
      }
      if (pitchDelta !== 0) {
        const rightAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
        camera.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(rightAxis, pitchDelta));
      }
      controllerLookEuler.current.setFromQuaternion(camera.quaternion);
      return;
    }

    const cameraEuler = controllerLookEuler.current;
    cameraEuler.setFromQuaternion(camera.quaternion);
    cameraEuler.y += yawDelta;
    cameraEuler.x = THREE.MathUtils.clamp(cameraEuler.x + pitchDelta, -Math.PI / 2, Math.PI / 2);
    camera.quaternion.setFromEuler(cameraEuler);
  };

  useEffect(() => {
    const handleLadderEnter = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) activeLadderZones.current.add(id);
    };
    const handleLadderExit = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) activeLadderZones.current.delete(id);
    };

    window.addEventListener("wof-ladder-zone-enter", handleLadderEnter);
    window.addEventListener("wof-ladder-zone-exit", handleLadderExit);
    return () => {
      window.removeEventListener("wof-ladder-zone-enter", handleLadderEnter);
      window.removeEventListener("wof-ladder-zone-exit", handleLadderExit);
      activeLadderZones.current.clear();
    };
  }, []);

  useEffect(() => {
    let fallbackMousePosition: { x: number; y: number } | null = null;

    const handleMouseMove = (event: MouseEvent) => {
      const pointerLocked = document.pointerLockElement !== null;
      const fallbackActive = !pointerLocked && isMouseLookFallbackActive();
      if (!pointerLocked && !fallbackActive) {
        fallbackMousePosition = null;
        return;
      }

      let movementX = event.movementX;
      let movementY = event.movementY;
      if (fallbackActive) {
        const previousMousePosition = fallbackMousePosition;
        fallbackMousePosition = { x: event.clientX, y: event.clientY };
        const clientMovementX = previousMousePosition ? event.clientX - previousMousePosition.x : 0;
        const clientMovementY = previousMousePosition ? event.clientY - previousMousePosition.y : 0;
        if (!Number.isFinite(movementX) || movementX === 0) movementX = clientMovementX;
        if (!Number.isFinite(movementY) || movementY === 0) movementY = clientMovementY;
        movementX = THREE.MathUtils.clamp(movementX, -96, 96);
        movementY = THREE.MathUtils.clamp(movementY, -96, 96);
      } else {
        fallbackMousePosition = null;
      }

      if (movementX === 0 && movementY === 0) return;

      const mouseSensitivity = useGameStore.getState().mouseSensitivity || DEFAULT_MOUSE_SENSITIVITY;
      applyCameraLookDelta(-movementX * mouseSensitivity, -movementY * mouseSensitivity);
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [camera]);

  const throwGrabbedPlayer = (overrideDir?: THREE.Vector3) => {
    const grabbed = grabbedState.current;
    if (!rigidBody.current || !grabbed) return;

    const throwDir = (overrideDir ?? grabbed.dir).clone().normalize();
    rigidBody.current.setLinvel({
      x: throwDir.x * GRAB_THROW_SPEED,
      y: THREE.MathUtils.clamp(throwDir.y * GRAB_THROW_SPEED, -18, 26),
      z: throwDir.z * GRAB_THROW_SPEED,
    }, true);
    grabbedState.current = null;
  };

  const applyScreenShake = () => {
    const shake = screenShake.current;
    if (shake.strength <= 0) return;

    const shakeNow = Date.now();
    if (shake.until <= shakeNow) {
      screenShake.current = { strength: 0, until: 0, duration: 1 };
      return;
    }

    const remaining = Math.max(0, (shake.until - shakeNow) / Math.max(1, shake.duration));
    const amplitude = shake.strength * remaining * remaining;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const right = new THREE.Vector3().crossVectors(camera.up, forward).normalize();
    const up = camera.up.clone().normalize();
    camera.position.addScaledVector(right, (Math.random() - 0.5) * amplitude);
    camera.position.addScaledVector(up, (Math.random() - 0.5) * amplitude * 0.65);
  };

  useEffect(() => {
    const lastFire: Record<HandType, number> = { left: 0, right: 0 };
    const armControllerAfterRelease = () => {
      controllerGameplayArmed.current = false;
      keyboardJumpWasPressed.current = false;
      controllerJumpWasPressed.current = false;
      controllerSprintWasPressed.current = false;
      controllerSprintLatched.current = false;
    };
    const canUseGameplayInput = () => {
      const state = useGameStore.getState();
      const controllerGameplayReady = state.isControllerGameplayActive && controllerGameplayArmed.current;
      return Boolean(isMouseGameplayInputActive() || state.isTouchControlsActive || controllerGameplayReady) &&
        !state.isPauseMenuOpen &&
        !state.isMapExpanded &&
        !state.isScoreboardOpen &&
        !state.questNpcEditorTarget &&
        !state.questDialogSession &&
        !state.isInventoryOpen &&
        !state.isAstralMeditating &&
        state.health > 0;
    };

    const getSpellForHand = (hand: HandType) => {
      const state = useGameStore.getState();
      return hand === 'right' ? state.rightCurrentSpell : state.leftCurrentSpell;
    };

    const handHasRunePower = (hand: HandType) => {
      const state = useGameStore.getState();
      return hasRunePower(hand === 'right' ? state.rightRunePower : state.leftRunePower);
    };

    const castSelfBuffSpell = (hand: HandType, spell: SpellType) => {
      const store = useGameStore.getState();
      store.setHandCharging(hand, true);
      window.setTimeout(() => {
        useGameStore.getState().setHandCharging(hand, false);
      }, 180);

      if (spell === 'magicarmor') {
        store.activateMagicArmor();
        socket.emit("setArmor", ARMOR_MAX);
        window.dispatchEvent(new CustomEvent("self-buff-cast", { detail: { spell, hand, armor: ARMOR_MAX } }));
        return true;
      }

      if (spell === 'speedboost') {
        store.activateSpeedBoost();
        window.dispatchEvent(new CustomEvent("self-buff-cast", { detail: { spell, hand } }));
        return true;
      }

      if (spell === 'jumpboost') {
        store.activateJumpBoost();
        const velocity = rigidBody.current?.linvel();
        if (velocity && rigidBody.current) {
          rigidBody.current.setLinvel({
            x: velocity.x,
            y: Math.max(velocity.y, JUMP_FORCE * JUMP_BOOST_MULTIPLIER),
            z: velocity.z,
          }, true);
        }
        window.dispatchEvent(new CustomEvent("self-buff-cast", { detail: { spell, hand } }));
        return true;
      }

      if (spell === 'magicglassorb') {
        store.activateMagicGlassOrb();
        window.dispatchEvent(new CustomEvent("self-buff-cast", { detail: { spell, hand } }));
        return true;
      }

      return false;
    };

    const getHandHorizontalOffset = (hand: HandType) => hand === 'left' ? 1.15 : -1.15;

    const getSpellLaunch = (hand: HandType, dir: THREE.Vector3, aimFromCrosshair = true) => {
      const lateral = new THREE.Vector3().crossVectors(camera.up, dir).normalize();
      const horizontalOffset = getHandHorizontalOffset(hand);
      const camPos = camera.position.clone();
      const spawnPos = {
        x: camPos.x + dir.x * SPELL_SPAWN_FORWARD_OFFSET + lateral.x * horizontalOffset,
        y: camPos.y + SPELL_SPAWN_VERTICAL_OFFSET + dir.y * SPELL_SPAWN_FORWARD_OFFSET,
        z: camPos.z + dir.z * SPELL_SPAWN_FORWARD_OFFSET + lateral.z * horizontalOffset,
      };
      const targetPos = camPos.clone().add(dir.clone().multiplyScalar(50));
      const realDir = aimFromCrosshair
        ? new THREE.Vector3(targetPos.x - spawnPos.x, targetPos.y - spawnPos.y, targetPos.z - spawnPos.z).normalize()
        : dir.clone();

      return { spawnPos, realDir };
    };

    const findAimedRemotePlayer = (
      rays: Array<{ origin: THREE.Vector3; dir: THREE.Vector3; radius?: number }>,
    ) => {
      let target: null | { id: string; distance: number } = null;

      Object.entries(useGameStore.getState().players).forEach(([playerId, player]) => {
        if (!player || player.health <= 0) return;

        const playerCenter = new THREE.Vector3(player.pos[0], player.pos[1] + 0.85, player.pos[2]);
        rays.forEach((ray) => {
          const rayDir = ray.dir.clone().normalize();
          const toPlayer = playerCenter.clone().sub(ray.origin);
          const projectedDistance = toPlayer.dot(rayDir);
          if (projectedDistance <= 1.25 || projectedDistance > DIRECT_STATUS_TARGET_RANGE) return;

          const closestPoint = ray.origin.clone().add(rayDir.multiplyScalar(projectedDistance));
          const missDistance = playerCenter.distanceTo(closestPoint);
          if (missDistance > (ray.radius ?? DIRECT_STATUS_TARGET_RADIUS)) return;

          if (!target || projectedDistance < target.distance) {
            target = { id: playerId, distance: projectedDistance };
          }
        });
      });

      return target;
    };

    const findRemotePlayerInAimCone = (origin: THREE.Vector3, dir: THREE.Vector3) => {
      const flatDir = new THREE.Vector3(dir.x, 0, dir.z);
      if (flatDir.lengthSq() < 0.001) return null;
      flatDir.normalize();

      let target: null | { id: string; score: number } = null;
      Object.entries(useGameStore.getState().players).forEach(([playerId, player]) => {
        if (!player || player.health <= 0) return;

        const playerCenter = new THREE.Vector3(player.pos[0], player.pos[1] + 0.85, player.pos[2]);
        const toPlayer = playerCenter.sub(origin);
        const flatToPlayer = new THREE.Vector3(toPlayer.x, 0, toPlayer.z);
        const flatDistance = flatToPlayer.length();
        if (flatDistance <= 1.25 || flatDistance > DIRECT_STATUS_TARGET_RANGE) return;

        flatToPlayer.normalize();
        const alignment = flatToPlayer.dot(flatDir);
        if (alignment < 0.9) return;

        const forwardDistance = flatDistance * alignment;
        const lateralMiss = Math.sqrt(Math.max(0, flatDistance * flatDistance - forwardDistance * forwardDistance));
        const verticalMiss = Math.abs(toPlayer.y);
        const allowedLateralMiss = THREE.MathUtils.clamp(2.4 + forwardDistance * 0.08, 2.4, 5.6);
        if (lateralMiss > allowedLateralMiss || verticalMiss > 9) return;

        const score = forwardDistance + lateralMiss * 2.5 + verticalMiss * 0.5;
        if (!target || score < target.score) {
          target = { id: playerId, score };
        }
      });

      return target ? { id: target.id, distance: target.score } : null;
    };

    const castDirectTungston = (hand: HandType) => {
      const store = useGameStore.getState();
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      dir.normalize();
      const { spawnPos, realDir } = getSpellLaunch(hand, dir);

      store.setHandCharging(hand, true);
      window.setTimeout(() => {
        useGameStore.getState().setHandCharging(hand, false);
      }, 160);

      const target = findAimedRemotePlayer([
        { origin: camera.position.clone(), dir, radius: DIRECT_STATUS_TARGET_RADIUS },
        {
          origin: new THREE.Vector3(spawnPos.x, spawnPos.y, spawnPos.z),
          dir: realDir,
          radius: DIRECT_STATUS_TARGET_RADIUS * 1.35,
        },
      ]) ?? findRemotePlayerInAimCone(camera.position.clone(), dir);
      if (!target) {
        return false;
      }

      const until = Date.now() + TUNGSTON_SLOW_DURATION_MS;
      store.updatePlayer(target.id, { slowUntil: until });
      socket.emit("applyStatusEffect", {
        targetId: target.id,
        effect: "slow",
        durationMs: TUNGSTON_SLOW_DURATION_MS,
      });
      window.dispatchEvent(new CustomEvent("direct-status-cast", { detail: { spell: "tungstonballsack", hand, targetId: target.id } }));
      return true;
    };

    const stopHandCasting = (hand: HandType) => {
      activeCastingHands.current[hand] = false;
      useGameStore.getState().setHandCharging(hand, false);
    };

    const emitGrabRelease = (hand: HandType) => {
      const grabId = activeGrabIds.current[hand];
      if (!grabId) return;

      if (grabTimeouts.current[hand] !== null) {
        window.clearTimeout(grabTimeouts.current[hand]!);
        grabTimeouts.current[hand] = null;
      }

      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const { spawnPos, realDir } = getSpellLaunch(hand, dir);
      const releaseProjectile = {
        id: `${grabId}-release-${Date.now()}`,
        creatorId: socket.id || "local",
        type: 'grab' as const,
        pos: spawnPos,
        dir: { x: realDir.x, y: realDir.y, z: realDir.z },
        createdAt: Date.now(),
        hand,
        grabId,
        grabPhase: 'release' as const,
      };

      activeGrabIds.current[hand] = null;
      socket.emit("castSpell", releaseProjectile);
      socket.emit("grabRelease", {
        grabId,
        hand,
        origin: spawnPos,
        aimDir: releaseProjectile.dir,
      });
      useGameStore.getState().addProjectile(releaseProjectile);
      window.dispatchEvent(new CustomEvent('releaseGrabPlayer', {
        detail: { casterId: socket.id || "local", grabId, dir: releaseProjectile.dir, origin: spawnPos }
      }));
    };

    const stopAllCasting = () => {
      (["left", "right"] as HandType[]).forEach((hand) => {
        emitGrabRelease(hand);
        stopHandCasting(hand);
      });
    };

    const requestQuestVillagerInteraction = () => {
      const detail = { source: "cast", handled: false };
      window.dispatchEvent(new CustomEvent("quest-villager-interact", { detail }));
      return detail.handled;
    };

    const onMeditationKeyDown = (e: KeyboardEvent) => {
      if (!isMeditationControl(e.code) || isEditableTarget(e.target)) return;
      const store = useGameStore.getState();
      if (store.isPauseMenuOpen || store.isSpellMenuOpen || store.questNpcEditorTarget || store.questDialogSession || store.isInventoryOpen || store.isMapExpanded || store.isScoreboardOpen || store.health <= 0) return;

      e.preventDefault();
      if (!store.isAstralMeditating) {
        stopAllCasting();
        resetMovementKeys();
        store.setAstralMeditating(true);
        astralExitHoldStartedAt.current = null;
        astralExitArmed.current = false;
        return;
      }

      if (!astralExitArmed.current) return;
      if (astralExitHoldStartedAt.current === null) {
        astralExitHoldStartedAt.current = Date.now();
      }
    };

    const onMeditationKeyUp = (e: KeyboardEvent) => {
      if (!isMeditationControl(e.code)) return;
      if (!keys.ControlLeft && !keys.ControlRight) {
        astralExitHoldStartedAt.current = null;
        if (useGameStore.getState().isAstralMeditating) {
          astralExitArmed.current = true;
        }
      }
    };
    
    const startHandCast = (hand: HandType) => {
      // Must be locked to shoot
      if (useGameStore.getState().isSpellMenuOpen || !useGameStore.getState().isMagicArmed) return;
      if (!canUseGameplayInput()) return;
      if (useGameStore.getState().sleepUntil > Date.now()) return;
      if (getHealth() <= 0) {
        const now = Date.now();
        if (now - Math.max(lastFire.left, lastFire.right) > 1000) { // simple debounce so they don't instarespawn
          useGameStore.getState().respawn();
          
          if (rigidBody.current) {
            const [spawnX, spawnY, spawnZ] = getPlayerSpawnPosition();
            rigidBody.current.setTranslation({ x: spawnX, y: spawnY, z: spawnZ }, true);
            rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
            camera.position.set(spawnX, spawnY + PLAYER_CAMERA_HEIGHT, spawnZ);
          }
        }
        return;
      }

      const spell = getSpellForHand(hand);
      if (!handHasRunePower(hand)) {
        stopHandCasting(hand);
        return;
      }
      if (activeCastingHands.current[hand]) return;

      const now = Date.now();
      if (now - lastFire[hand] < (spell === 'iceshard' ? 400 : 1000)) return;

      if (SELF_BUFF_SPELLS.has(spell)) {
        lastFire[hand] = now;
        castSelfBuffSpell(hand, spell);
        return;
      }

      activeCastingHands.current[hand] = true;
      useGameStore.getState().setHandCharging(hand, true);

      if (spell === 'grab') {
        const r = rigidBody.current;
        if (!r) {
          stopHandCasting(hand);
          return;
        }

        lastFire[hand] = now;
        const d = new THREE.Vector3();
        camera.getWorldDirection(d);
        const { spawnPos, realDir } = getSpellLaunch(hand, d);
        const grabId = `${socket.id || "local"}-${hand}-grab-${now}-${Math.random().toString(36).slice(2, 7)}`;
        const projectile = {
          id: grabId,
          creatorId: socket.id || "local",
          type: 'grab' as const,
          pos: spawnPos,
          dir: { x: realDir.x, y: realDir.y, z: realDir.z },
          createdAt: Date.now(),
          hand,
          grabId,
          grabPhase: 'cast' as const,
        };

        activeGrabIds.current[hand] = grabId;
        if (grabTimeouts.current[hand] !== null) {
          window.clearTimeout(grabTimeouts.current[hand]!);
        }
        grabTimeouts.current[hand] = window.setTimeout(() => {
          emitGrabRelease(hand);
          stopHandCasting(hand);
        }, GRAB_MAX_DURATION_MS);

        socket.emit("castSpell", projectile);
        socket.emit("grabControl", {
          grabId,
          hand,
          origin: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          aimDir: { x: d.x, y: d.y, z: d.z },
        });
        useGameStore.getState().addProjectile(projectile);
        return;
      }

      if (spell === 'iceshard' || spell === 'arcanebeam') {
        const r = rigidBody.current;
        if (r) {
          lastFire[hand] = now;
          const d = new THREE.Vector3();
          camera.getWorldDirection(d);
          const { spawnPos, realDir } = getSpellLaunch(hand, d);

          const proj = {
            id: Math.random().toString(36).substring(7),
            creatorId: socket.id || "local",
            type: spell as string,
            pos: spawnPos,
            dir: { x: realDir.x, y: realDir.y, z: realDir.z },
            createdAt: Date.now(),
            hand
          };
          
          socket.emit("castSpell", proj);
          useGameStore.getState().addProjectile(proj as any);
        }
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (useGameStore.getState().questNpcEditorTarget || useGameStore.getState().questDialogSession || useGameStore.getState().isInventoryOpen) return;
      if (e.button === 0 || e.button === 2) {
        if (canUseGameplayInput() && requestQuestVillagerInteraction()) {
          e.preventDefault();
          return;
        }
        startHandCast(e.button === 2 ? 'right' : 'left');
      }
    };

    const releaseHandCast = (hand: HandType) => {
      if (useGameStore.getState().isSpellMenuOpen) {
        stopAllCasting();
        return;
      }
      if (!activeCastingHands.current[hand]) return;
      const currentSpell = getSpellForHand(hand);
      stopHandCasting(hand);

      if (currentSpell === 'grab') {
        emitGrabRelease(hand);
        return;
      }

      if (!useGameStore.getState().isMagicArmed) return;
      
      if (!canUseGameplayInput() || getHealth() <= 0) return;

      if (currentSpell === 'arcanebeam' || currentSpell === 'iceshard' || currentSpell === 'flamethrower' || currentSpell === 'healspell') return;
      if (!handHasRunePower(hand)) return;

      lastFire[hand] = Date.now();

      if (currentSpell === 'tungstonballsack') {
        castDirectTungston(hand);
        return;
      }

      if (currentSpell === 'magicarmor') {
        castSelfBuffSpell(hand, currentSpell);
        return;
      }

      if (currentSpell === 'speedboost') {
        castSelfBuffSpell(hand, currentSpell);
        return;
      }

      if (currentSpell === 'jumpboost') {
        castSelfBuffSpell(hand, currentSpell);
        return;
      }

      // Shoot!
      const r = rigidBody.current;
      if (!r) return;
      const pos = r.translation();
      
      // Calculate forward direction from camera
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      
      let { spawnPos, realDir } = getSpellLaunch(hand, dir);

      if (currentSpell === 'tornado' || currentSpell === 'meteorshower') {
        const flatDir = new THREE.Vector3(dir.x, 0, dir.z);
        if (flatDir.lengthSq() < 0.001) flatDir.set(0, 0, -1);
        flatDir.normalize();
        const summonDistance = currentSpell === 'meteorshower' ? 32 : 22;
        const groundY = pos.y - PLAYER_FOOT_OFFSET + 0.2;
        spawnPos = {
          x: pos.x + flatDir.x * summonDistance,
          y: groundY,
          z: pos.z + flatDir.z * summonDistance,
        };
        realDir = flatDir;
      }
      
      if (currentSpell === 'blink') {
        // Teleports player to a random location nearby
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 40;
        r.setTranslation({
          x: pos.x + Math.cos(angle) * dist,
          y: pos.y + 10, // A bit higher for longer distances
          z: pos.z + Math.sin(angle) * dist
        }, true);
      }

      socket.emit("castSpell", {
        type: currentSpell,
        pos: spawnPos,
        dir: { x: realDir.x, y: realDir.y, z: realDir.z },
        hand
      });
      
      useGameStore.getState().addProjectile({
        id: Math.random().toString(36).substring(7),
        creatorId: socket.id || "local",
        type: currentSpell,
        pos: spawnPos,
        dir: { x: realDir.x, y: realDir.y, z: realDir.z },
        createdAt: Date.now(),
        hand
      });
    };

    const onMouseUp = (e: MouseEvent) => {
      if (useGameStore.getState().questNpcEditorTarget || useGameStore.getState().questDialogSession || useGameStore.getState().isInventoryOpen) return;
      if (e.button === 0 || e.button === 2) {
        releaseHandCast(e.button === 2 ? 'right' : 'left');
      }
    };

    const onMobileControl = (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      if (detail.type === 'move') {
        touchMove.current.x = THREE.MathUtils.clamp(Number(detail.x) || 0, -1, 1);
        touchMove.current.y = THREE.MathUtils.clamp(Number(detail.y) || 0, -1, 1);
        return;
      }

      if (detail.type === 'look') {
        touchLookDelta.current.x += THREE.MathUtils.clamp(Number(detail.dx) || 0, -80, 80);
        touchLookDelta.current.y += THREE.MathUtils.clamp(Number(detail.dy) || 0, -80, 80);
        return;
      }

      if (detail.type === 'button' && ['jump', 'slide', 'sprint'].includes(detail.button)) {
        touchButtons.current[detail.button as TouchButtonName] = Boolean(detail.pressed);
      }
    };

    const onMobileCast = (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      const hand: HandType = detail.hand === 'right' ? 'right' : 'left';
      if (detail.phase === 'start') {
        startHandCast(hand);
      } else {
        releaseHandCast(hand);
      }
    };

    const onMobileHotbar = (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      const hand: HandType = detail.hand === 'right' ? 'right' : 'left';
      const direction = Number(detail.direction) >= 0 ? 1 : -1;
      const store = useGameStore.getState();
      if (store.questDialogSession || store.isInventoryOpen) return;
      if (direction > 0) {
        store.nextSpell(hand);
      } else {
        store.prevSpell(hand);
      }
      store.setActiveHand(hand);
    };
    
    // Wheel to switch spells
    const onWheel = (e: WheelEvent) => {
      const store = useGameStore.getState();
      if (store.isSpellMenuOpen || !store.isMagicArmed) return;
      if (!canUseGameplayInput()) return;
      const hand: HandType = keys.KeyQ ? 'right' : 'left';
      if (e.deltaY > 0) store.nextSpell(hand);
      else store.prevSpell(hand);
    };

    const onHotbarKeyDown = (e: KeyboardEvent) => {
      const store = useGameStore.getState();
      if (store.isSpellMenuOpen || !store.isMagicArmed || store.health <= 0) return;
      if (!canUseGameplayInput()) return;

      const slotIndex = getNumberSlotFromCode(e.code);
      if (slotIndex === -1) return;

      e.preventDefault();
      store.selectHotbarSlot(slotIndex, keys.KeyQ ? 'right' : 'left');
    };

    const onContextMenu = (e: MouseEvent) => {
      if (canUseGameplayInput()) {
        e.preventDefault();
      }
    };

    const controllerCastingDown: Record<HandType, boolean> = { left: false, right: false };
    const controllerHotbarDown: Record<string, boolean> = {};
    const controllerHotbarRepeatAt: Record<string, number> = {};
    const consumeHotbarPress = (key: string, pressed: boolean) => {
      const wasPressed = controllerHotbarDown[key] ?? false;
      controllerHotbarDown[key] = pressed;
      return pressed && !wasPressed;
    };
    const consumeHotbarRepeat = (key: string, pressed: boolean, firstDelay = 300, repeatDelay = 150) => {
      const now = performance.now();
      const wasPressed = controllerHotbarDown[key] ?? false;
      controllerHotbarDown[key] = pressed;

      if (!pressed) {
        delete controllerHotbarRepeatAt[key];
        return false;
      }

      if (!wasPressed) {
        controllerHotbarRepeatAt[key] = now + firstDelay;
        return false;
      }

      if (now >= (controllerHotbarRepeatAt[key] ?? 0)) {
        controllerHotbarRepeatAt[key] = now + repeatDelay;
        return true;
      }

      return false;
    };
    const scrollControllerHand = (hand: HandType, direction: 1 | -1) => {
      const store = useGameStore.getState();
      if (direction > 0) {
        store.nextSpell(hand);
      } else {
        store.prevSpell(hand);
      }
      store.setActiveHand(hand);
    };
    const pollControllerCasting = () => {
      const gamepad = getPrimaryGamepad();
      const store = useGameStore.getState();
      const canUseCastButtons = Boolean(gamepad && canUseGameplayInput() && !store.isSpellMenuOpen);
      const physicalCastState: Record<HandType, boolean> = {
        left: canUseCastButtons && isGamepadButtonPressed(gamepad, store.controllerBindings.leftCast as GamepadButtonName),
        right: canUseCastButtons && isGamepadButtonPressed(gamepad, store.controllerBindings.rightCast as GamepadButtonName),
      };

      let castButtonInteractionHandled = false;
      (["left", "right"] as HandType[]).forEach((hand) => {
        if (castButtonInteractionHandled) {
          controllerCastingDown[hand] = physicalCastState[hand];
          return;
        }

        if (physicalCastState[hand] && !controllerCastingDown[hand] && requestQuestVillagerInteraction()) {
          castButtonInteractionHandled = true;
          controllerCastingDown[hand] = true;
          return;
        }

        const shouldCast = store.isMagicArmed && physicalCastState[hand];
        if (shouldCast && !controllerCastingDown[hand]) {
          startHandCast(hand);
        } else if (!shouldCast && controllerCastingDown[hand]) {
          releaseHandCast(hand);
        }
        controllerCastingDown[hand] = physicalCastState[hand];
      });

      if (gamepad && canUseGameplayInput() && !store.isSpellMenuOpen && store.isMagicArmed) {
        const leftBumperHeld = isGamepadButtonPressed(gamepad, store.controllerBindings.leftHotbar as GamepadButtonName);
        const rightBumperHeld = isGamepadButtonPressed(gamepad, store.controllerBindings.rightHotbar as GamepadButtonName);
        const dpadLeft = isGamepadButtonPressed(gamepad, "dpadLeft");
        const dpadRight = isGamepadButtonPressed(gamepad, "dpadRight");
        const leftBumperPressed = consumeHotbarPress("leftBumperHotbar", leftBumperHeld);
        const rightBumperPressed = consumeHotbarPress("rightBumperHotbar", rightBumperHeld);
        const leftHotbarPrevPressed = consumeHotbarRepeat("leftHotbarPrev", leftBumperHeld && dpadLeft);
        const leftHotbarNextPressed = consumeHotbarRepeat("leftHotbarNext", leftBumperHeld && dpadRight);
        const rightHotbarPrevPressed = consumeHotbarRepeat("rightHotbarPrev", rightBumperHeld && dpadLeft);
        const rightHotbarNextPressed = consumeHotbarRepeat("rightHotbarNext", rightBumperHeld && dpadRight);

        if (leftBumperPressed) {
          scrollControllerHand("left", dpadLeft ? -1 : 1);
        } else if (leftHotbarPrevPressed) {
          scrollControllerHand("left", -1);
        } else if (leftHotbarNextPressed) {
          scrollControllerHand("left", 1);
        }

        if (rightBumperPressed) {
          scrollControllerHand("right", dpadLeft ? -1 : 1);
        } else if (rightHotbarPrevPressed) {
          scrollControllerHand("right", -1);
        } else if (rightHotbarNextPressed) {
          scrollControllerHand("right", 1);
        }
      } else {
        Object.keys(controllerHotbarDown).forEach((key) => {
          controllerHotbarDown[key] = false;
        });
        Object.keys(controllerHotbarRepeatAt).forEach((key) => {
          delete controllerHotbarRepeatAt[key];
        });
      }

      controllerCastingRaf = window.requestAnimationFrame(pollControllerCasting);
    };
    let controllerCastingRaf = window.requestAnimationFrame(pollControllerCasting);

    const onTeleport = (e: any) => {
      if (!rigidBody.current) return;
      const detail = e.detail ?? {};
      const teleportPosition = {
        x: Number(detail.x),
        y: Number(detail.y),
        z: Number(detail.z),
      };
      if (!Number.isFinite(teleportPosition.x) || !Number.isFinite(teleportPosition.y) || !Number.isFinite(teleportPosition.z)) return;
      rigidBody.current.setTranslation(teleportPosition, true);
      rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rigidBody.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      camera.position.set(teleportPosition.x, teleportPosition.y + PLAYER_CAMERA_HEIGHT, teleportPosition.z);
      const yaw = Number(detail.yaw);
      const resolvedYaw = resetLilyCoilCameraState(Number.isFinite(yaw) ? yaw : undefined);
      qaWalkStartTime.current = null;
      qaWalkYaw.current = null;
      qaWalkLastDecisionAt.current = 0;
      qaWalkLastProgressAt.current = 0;
      qaWalkLastProgressPos.current.set(teleportPosition.x, teleportPosition.y, teleportPosition.z);
      qaWalkInputState.current = { forward: 0, strafe: 0, sprint: false, mode: "travel" };
      qaWalkJumpHeldUntil.current = 0;
      qaWalkCombatFocusUntil.current = 0;
      qaWalkNextCombatCastAt.current = 0;
      qaWalkNextPracticeCastAt.current = 0;
      qaWalkIntent.current = null;
      qaWalkNextIntentAt.current = 0;
      qaWalkRouteIndex.current = 0;
      qaWalkRouteSmoothedYaw.current = null;
      qaWalkRouteTargetId.current = null;
      resetQaWalkRecovery();
      const manualFastTravelKey = `manual-fast-travel:${Date.now().toString(36)}:${teleportPosition.x.toFixed(2)}:${teleportPosition.y.toFixed(2)}:${teleportPosition.z.toFixed(2)}`;
      (window as any).__wofManualFastTravelSpawn = {
        key: manualFastTravelKey,
        x: teleportPosition.x,
        y: teleportPosition.y,
        z: teleportPosition.z,
        yaw: Number.isFinite(yaw) ? yaw : undefined,
        until: Date.now() + 30 * 60 * 1000,
      };
      forcedSpawnKey.current = manualFastTravelKey;
      (window as any).localPlayerPos = teleportPosition;
      (window as any).__wofLastPlayerPosition = teleportPosition;
      publishQaPlayerPosition(teleportPosition);
      document.documentElement.dataset.wofLastTeleportX = String(Math.round(teleportPosition.x));
      document.documentElement.dataset.wofLastTeleportY = String(Math.round(teleportPosition.y));
      document.documentElement.dataset.wofLastTeleportZ = String(Math.round(teleportPosition.z));
      window.dispatchEvent(new CustomEvent("player-moved", {
        detail: {
          ...teleportPosition,
          angle: resolvedYaw,
          isMoving: false,
          grounded: false,
        }
      }));
    };

    const onPull = (e: any) => {
      pullVelocity.current.copy(e.detail);
      pullFrames.current = 15; // apply for 15 frames
    };

    const onScreenShake = (e: any) => {
      const detail = e.detail ?? {};
      const strength = THREE.MathUtils.clamp(Number(detail.strength) || 0.25, 0.02, 1.2);
      const duration = THREE.MathUtils.clamp(Number(detail.duration) || 320, 80, 1200);
      screenShake.current = {
        strength: Math.max(screenShake.current.strength, strength),
        until: Date.now() + duration,
        duration,
      };
    };

    const onGrabPlayer = (e: any) => {
      const detail = e.detail ?? {};
      const casterId = detail.casterId;
      if (!casterId || casterId === (socket.id || "local")) return;

      const dir = new THREE.Vector3(detail.dir?.x ?? 0, detail.dir?.y ?? 0, detail.dir?.z ?? -1).normalize();
      const origin = new THREE.Vector3(detail.origin?.x ?? camera.position.x, detail.origin?.y ?? camera.position.y, detail.origin?.z ?? camera.position.z);
      grabbedState.current = {
        casterId,
        grabId: detail.grabId,
        dir,
        origin,
        distance: Math.max(4, Math.min(36, detail.distance ?? GRAB_DEFAULT_DISTANCE)),
        lastControlAt: Date.now(),
        until: Date.now() + GRAB_MAX_DURATION_MS,
      };
    };

    const onGrabControl = (e: any) => {
      const grabbed = grabbedState.current;
      const detail = e.detail ?? {};
      if (!grabbed) return;

      const casterId = detail.id ?? detail.casterId;
      const sameGrab = detail.grabId && grabbed.grabId === detail.grabId;
      const sameCaster = casterId && grabbed.casterId === casterId;
      if (!sameGrab && !sameCaster) return;

      const aimDir = detail.aimDir ?? detail.dir;
      const origin = detail.origin;
      if (aimDir) {
        grabbed.dir.set(aimDir.x ?? 0, aimDir.y ?? 0, aimDir.z ?? -1).normalize();
      }
      if (origin) {
        grabbed.origin.set(origin.x ?? grabbed.origin.x, origin.y ?? grabbed.origin.y, origin.z ?? grabbed.origin.z);
      }
      grabbed.lastControlAt = Date.now();
    };

    const onReleaseGrabPlayer = (e: any) => {
      const grabbed = grabbedState.current;
      if (!grabbed) return;

      const detail = e.detail ?? {};
      const sameGrab = detail.grabId && grabbed.grabId === detail.grabId;
      const sameCaster = detail.casterId && grabbed.casterId === detail.casterId;
      if (!sameGrab && !sameCaster) return;

      const releaseDir = new THREE.Vector3(detail.dir?.x ?? grabbed.dir.x, detail.dir?.y ?? grabbed.dir.y, detail.dir?.z ?? grabbed.dir.z).normalize();
      throwGrabbedPlayer(releaseDir);
    };

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mobile-control", onMobileControl);
    window.addEventListener("mobile-cast", onMobileCast);
    window.addEventListener("mobile-hotbar", onMobileHotbar);
    window.addEventListener("wheel", onWheel);
    window.addEventListener("keydown", onMeditationKeyDown);
    window.addEventListener("keyup", onMeditationKeyUp);
    window.addEventListener("keydown", onHotbarKeyDown);
    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("teleportPlayer", onTeleport);
    window.addEventListener("pullPlayer", onPull);
    window.addEventListener("screenShake", onScreenShake);
    window.addEventListener("grabPlayer", onGrabPlayer);
    window.addEventListener("grabControl", onGrabControl);
    window.addEventListener("releaseGrabPlayer", onReleaseGrabPlayer);
    window.addEventListener("command-console-opened", resetMovementKeys);
    window.addEventListener("controller-gameplay-started", armControllerAfterRelease);
    return () => {
      stopAllCasting();
      (["left", "right"] as HandType[]).forEach((hand) => {
        if (grabTimeouts.current[hand] !== null) {
          window.clearTimeout(grabTimeouts.current[hand]!);
          grabTimeouts.current[hand] = null;
        }
      });
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mobile-control", onMobileControl);
      window.removeEventListener("mobile-cast", onMobileCast);
      window.removeEventListener("mobile-hotbar", onMobileHotbar);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onMeditationKeyDown);
      window.removeEventListener("keyup", onMeditationKeyUp);
      window.removeEventListener("keydown", onHotbarKeyDown);
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("teleportPlayer", onTeleport);
      window.removeEventListener("pullPlayer", onPull);
      window.removeEventListener("screenShake", onScreenShake);
      window.removeEventListener("grabPlayer", onGrabPlayer);
      window.removeEventListener("grabControl", onGrabControl);
      window.removeEventListener("releaseGrabPlayer", onReleaseGrabPlayer);
      window.removeEventListener("command-console-opened", resetMovementKeys);
      window.removeEventListener("controller-gameplay-started", armControllerAfterRelease);
      window.cancelAnimationFrame(controllerCastingRaf);
    };
  }, [camera]);

  useFrame((state, delta) => {
    if (!rigidBody.current) return;
    let health = getHealth();
    if (health <= 0) return;

    const storeState = useGameStore.getState();
    const velocity = rigidBody.current.linvel();
    const pos = rigidBody.current.translation();
    const nowMs = Date.now();
    const gamepad = getPrimaryGamepad();
    const sleepActive = storeState.sleepUntil > nowMs;
    const slowActive = storeState.slowUntil > nowMs;
    const vclipActive = storeState.isVClipEnabled;
    let astralActive = storeState.isAstralMeditating;
    if (astralActive && astralExitHoldStartedAt.current !== null && nowMs - astralExitHoldStartedAt.current >= ASTRAL_EXIT_HOLD_MS) {
      useGameStore.getState().setAstralMeditating(false);
      astralExitHoldStartedAt.current = null;
      astralActive = false;
    }
    const mouseGameplayRequested = isMouseGameplayInputActive();
    const controllerGameplayRequested = storeState.isControllerGameplayActive || mouseGameplayRequested;
    const controllerModeReady = Boolean(
      gamepad &&
      controllerGameplayRequested &&
      !storeState.isPauseMenuOpen &&
      !storeState.isSpellMenuOpen &&
      !storeState.questDialogSession &&
      !storeState.isInventoryOpen &&
      !storeState.isMapExpanded &&
      !storeState.isScoreboardOpen &&
      !astralActive &&
      storeState.health > 0
    );
    if (!controllerGameplayRequested) {
      controllerGameplayArmed.current = false;
    } else if (controllerModeReady && !controllerGameplayArmed.current && areControllerGameplayButtonsReleased(gamepad, storeState.controllerBindings)) {
      controllerGameplayArmed.current = true;
      keyboardJumpWasPressed.current = false;
      controllerJumpWasPressed.current = false;
      controllerSprintWasPressed.current = false;
    }
    const controllerInputActive = controllerModeReady && controllerGameplayArmed.current;
    const gameplayInputActive = Boolean(mouseGameplayRequested || storeState.isTouchControlsActive || controllerInputActive);
    const survivalModeActive = isSurvivalGameMode(storeState.gameMode);
    const isSolidWorldCollider = (collider: any) => {
      const parent = typeof collider.parent === "function" ? collider.parent() : null;
      const isSensor = typeof collider.isSensor === "function" ? collider.isSensor() : collider.isSensor === true;
      return parent?.handle !== rigidBody.current?.handle && !isSensor;
    };
    const resolveCameraWallPush = (
      bodyPos: { x: number; y: number; z: number },
      eyeY: number,
      cameraHeight: number,
    ) => {
      const probe = cameraAntiClipProbe.current.set(bodyPos.x, eyeY, bodyPos.z);
      const projection = world.projectPoint(
        probe,
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        isSolidWorldCollider,
      );
      let nextX = bodyPos.x;
      let nextY = bodyPos.y;
      let nextZ = bodyPos.z;
      let nextEyeY = eyeY;
      let moved = false;
      const push = cameraAntiClipPush.current;
      if (projection) {
        const verticalSeparation = Math.abs(projection.point.y - probe.y);
        if (verticalSeparation <= CAMERA_WALL_MAX_VERTICAL_SEPARATION) {
          if (projection.isInside) {
            push.set(
              projection.point.x - probe.x,
              0,
              projection.point.z - probe.z,
            );
          } else {
            push.set(
              probe.x - projection.point.x,
              0,
              probe.z - projection.point.z,
            );
          }

          const horizontalDistanceSq = push.lengthSq();
          if (horizontalDistanceSq >= CAMERA_WALL_MIN_HORIZONTAL_PUSH_SQ) {
            const horizontalDistance = Math.sqrt(horizontalDistanceSq);
            if (projection.isInside || horizontalDistance < CAMERA_WALL_CLEARANCE) {
              const pushDistance = projection.isInside
                ? Math.min(CAMERA_WALL_PUSH_MAX, horizontalDistance + CAMERA_WALL_INSIDE_EXTRA)
                : Math.min(CAMERA_WALL_PUSH_MAX, CAMERA_WALL_CLEARANCE - horizontalDistance);
              if (pushDistance > 0) {
                push.multiplyScalar(pushDistance / horizontalDistance);
                nextX += push.x;
                nextZ += push.z;
                moved = true;
              }
            }
          }
        }

        if (projection.isInside) {
          const targetEyeY = projection.point.y + CAMERA_TERRAIN_EYE_CLEARANCE;
          const lift = targetEyeY - nextEyeY;
          if (lift > FLOOR_RECOVERY_TRIGGER_DEPTH && lift < CAMERA_TERRAIN_MAX_BODY_LIFT) {
            nextY += lift;
            nextEyeY += lift;
            moved = true;
          }
        }
      }

      if (survivalModeActive) {
        const terrainProbeY = nextEyeY + CAMERA_TERRAIN_RAY_UP;
        const terrainRay = new rapier.Ray(
          { x: nextX, y: terrainProbeY, z: nextZ },
          { x: 0, y: -1, z: 0 },
        );
        // @ts-ignore - rapier exposes the collider predicate in this overload.
        const terrainHit = world.castRay(
          terrainRay,
          CAMERA_TERRAIN_RAY_UP + CAMERA_TERRAIN_RAY_DOWN,
          true,
          undefined,
          undefined,
          undefined,
          undefined,
          isSolidWorldCollider,
        );
        if (terrainHit) {
          const surfaceY = terrainProbeY - terrainHit.timeOfImpact;
          const surfaceAboveBody = surfaceY - nextY;
          const targetEyeY = surfaceY + CAMERA_TERRAIN_EYE_CLEARANCE;
          const lift = targetEyeY - nextEyeY;
          if (
            lift > FLOOR_RECOVERY_TRIGGER_DEPTH &&
            lift < CAMERA_TERRAIN_MAX_BODY_LIFT &&
            surfaceAboveBody > -PLAYER_FOOT_OFFSET &&
            surfaceAboveBody < CAMERA_TERRAIN_MAX_SURFACE_ABOVE_BODY
          ) {
            nextY += lift;
            nextEyeY = nextY + cameraHeight;
            moved = true;
          }
        }
      }

      if (!moved) return null;

      rigidBody.current?.setTranslation({ x: nextX, y: nextY, z: nextZ }, true);
      if (nextY > bodyPos.y + FLOOR_RECOVERY_TRIGGER_DEPTH) {
        rigidBody.current?.setLinvel({ x: velocity.x, y: Math.max(0, velocity.y), z: velocity.z }, true);
      }
      return { x: nextX, y: nextY, z: nextZ, eyeY: nextEyeY };
    };
    (window as any).localPlayerPos = pos;
    (window as any).__wofLastPlayerPosition = {
      x: pos.x,
      y: pos.y,
      z: pos.z,
    };
    (window as any).localPlayerRigidBody = rigidBody.current;
    publishQaPlayerPosition(pos);

    const spawnOverride = getPlayerSpawnOverride();
    if (spawnOverride && forcedSpawnKey.current !== spawnOverride.key) {
      const [spawnX, spawnY, spawnZ] = spawnOverride.position;
      rigidBody.current.setTranslation({ x: spawnX, y: spawnY, z: spawnZ }, true);
      rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rigidBody.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      camera.position.set(spawnX, spawnY + PLAYER_CAMERA_HEIGHT, spawnZ);
      const spawnYaw = Number(spawnOverride.yaw);
      const spawnPitch = Number(spawnOverride.pitch);
      const resolvedYaw = resetLilyCoilCameraState(
        Number.isFinite(spawnYaw) ? spawnYaw : undefined,
        Number.isFinite(spawnPitch) ? spawnPitch : undefined,
      );
      qaWalkStartTime.current = null;
      qaWalkYaw.current = null;
      qaWalkLastDecisionAt.current = 0;
      qaWalkLastProgressAt.current = 0;
      qaWalkLastProgressPos.current.set(spawnX, spawnY, spawnZ);
      qaWalkInputState.current = { forward: 0, strafe: 0, sprint: false, mode: "travel" };
      qaWalkJumpHeldUntil.current = 0;
      qaWalkCombatFocusUntil.current = 0;
      qaWalkNextCombatCastAt.current = 0;
      qaWalkNextPracticeCastAt.current = 0;
      qaWalkIntent.current = null;
      qaWalkNextIntentAt.current = 0;
      qaWalkRouteIndex.current = 0;
      qaWalkRouteSmoothedYaw.current = null;
      qaWalkRouteTargetId.current = null;
      resetQaWalkRecovery();
      forcedSpawnKey.current = spawnOverride.key;
      (window as any).localPlayerPos = { x: spawnX, y: spawnY, z: spawnZ };
      (window as any).__wofLastPlayerPosition = { x: spawnX, y: spawnY, z: spawnZ };
      publishQaPlayerPosition({ x: spawnX, y: spawnY, z: spawnZ });
      window.dispatchEvent(new CustomEvent("player-moved", { detail: { x: spawnX, y: spawnY, z: spawnZ, angle: resolvedYaw, isMoving: false, grounded: false } }));
      return;
    }

    const poisonActive = storeState.poisonUntil > nowMs;
    const acidActive = storeState.acidUntil > nowMs;
    const toxicDps = (poisonActive ? TOXIC_DAMAGE_PER_SECOND : 0) + (acidActive ? TOXIC_DAMAGE_PER_SECOND : 0);
    if (toxicDps > 0) {
      const toxicDamage = toxicDps * delta;
      health = Math.max(0, health - toxicDamage);
      useGameStore.getState().setHealth(health);

      toxicDamageBuffer.current += toxicDamage;
      if (socket.id && toxicDamageBuffer.current > 0 && (nowMs - lastToxicDamageSync.current >= 500 || health <= 0)) {
        socket.emit("damageHealth", socket.id, toxicDamageBuffer.current);
        toxicDamageBuffer.current = 0;
        lastToxicDamageSync.current = nowMs;
      }

      if (health <= 0) return;
    } else {
      toxicDamageBuffer.current = 0;
      lastToxicDamageSync.current = nowMs;
    }

    const activeGrab = grabbedState.current;
    if (activeGrab) {
      if (isCrouching) setIsCrouching(false);
      crouchHoldStartedAt.current = null;
      if (nowMs >= activeGrab.until) {
        throwGrabbedPlayer();
        return;
      }

      const caster = storeState.players[activeGrab.casterId];
      const hasRecentControl = nowMs - activeGrab.lastControlAt < 450;
      const liveAimDir = hasRecentControl ? activeGrab.dir : caster ? getPlayerAimDirection(caster) : activeGrab.dir;
      activeGrab.dir.copy(liveAimDir);

      const casterAnchor = hasRecentControl
        ? activeGrab.origin.clone()
        : caster
          ? new THREE.Vector3(caster.pos[0], caster.pos[1] + PLAYER_CAMERA_HEIGHT, caster.pos[2])
          : activeGrab.origin.clone();
      const holdPoint = casterAnchor.add(liveAimDir.clone().multiplyScalar(activeGrab.distance));
      const currentPos = new THREE.Vector3(pos.x, pos.y, pos.z);
      const followAlpha = 1 - Math.exp(-GRAB_FOLLOW_SPEED * delta);
      const nextGrabPos = currentPos.lerp(holdPoint, followAlpha);

      rigidBody.current.setTranslation(nextGrabPos, true);
      rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      camera.position.lerp(new THREE.Vector3(nextGrabPos.x, nextGrabPos.y + PLAYER_CAMERA_HEIGHT, nextGrabPos.z), 0.55);
      applyScreenShake();
      (window as any).localPlayerPos = { x: nextGrabPos.x, y: nextGrabPos.y, z: nextGrabPos.z };

      const fwd = new THREE.Vector3();
      camera.getWorldDirection(fwd);
      const yaw = Math.atan2(fwd.x, -fwd.z);
      window.dispatchEvent(new CustomEvent('player-state', {
        detail: { isMoving: false, isSprinting: false, isSliding: false, isCrouching: false, isGrounded: false, isMeditating: false }
      }));
      window.dispatchEvent(new CustomEvent('player-moved', { detail: { x: nextGrabPos.x, y: nextGrabPos.y, z: nextGrabPos.z, angle: yaw, isMoving: false, grounded: false } }));

      const now = Date.now();
      if (now - lastNetworkSync.current > 1000 / 30) {
        lastNetworkSync.current = now;
        const aimDir = new THREE.Vector3();
        camera.getWorldDirection(aimDir);
        socket.emit("updateMe", {
          pos: [nextGrabPos.x, nextGrabPos.y, nextGrabPos.z],
          rot: [camera.rotation.x, yaw, camera.rotation.z],
          aimDir: [aimDir.x, aimDir.y, aimDir.z],
          anim: "grabbed",
          character: storeState.characterCustomization,
          survivalLevel: storeState.survivalLevel,
          isSpeaking: storeState.isVoiceSpeaking
        });
      }
      return;
    }

    if (astralActive) {
      if (isSliding) setIsSliding(false);
      if (isCrouching) setIsCrouching(false);
      crouchHoldStartedAt.current = null;
      (["left", "right"] as HandType[]).forEach((hand) => {
        if (activeCastingHands.current[hand] || storeState.chargingHands[hand]) {
          activeCastingHands.current[hand] = false;
          useGameStore.getState().setHandCharging(hand, false);
        }
        flamethrowerTimers.current[hand] = 0;
      });

      rigidBody.current.setLinvel({ x: 0, y: vclipActive ? 0 : velocity.y, z: 0 }, true);
      camera.position.lerp(new THREE.Vector3(pos.x, pos.y + PLAYER_MEDITATION_CAMERA_HEIGHT, pos.z), 0.18);
      applyScreenShake();
      (window as any).localPlayerPos = pos;

      const fwd = new THREE.Vector3();
      camera.getWorldDirection(fwd);
      const yaw = Math.atan2(fwd.x, -fwd.z);
      const aimDir = new THREE.Vector3();
      camera.getWorldDirection(aimDir);

      window.dispatchEvent(new CustomEvent('player-state', {
        detail: { isMoving: false, isSprinting: false, isSliding: false, isCrouching: false, isGrounded: true, isMeditating: true }
      }));
      window.dispatchEvent(new CustomEvent('player-moved', { detail: { x: pos.x, y: pos.y, z: pos.z, angle: yaw, isMoving: false, grounded: true } }));

      const now = Date.now();
      if (now - lastNetworkSync.current > 1000 / 15) {
        lastNetworkSync.current = now;
        socket.emit("updateMe", {
          pos: [pos.x, pos.y, pos.z],
          rot: [camera.rotation.x, yaw, camera.rotation.z],
          aimDir: [aimDir.x, aimDir.y, aimDir.z],
          anim: "meditate",
          character: storeState.characterCustomization,
          survivalLevel: storeState.survivalLevel,
          isSpeaking: storeState.isVoiceSpeaking
        });
      }
      return;
    }

    if (!storeState.isSpellMenuOpen && !storeState.questDialogSession && !storeState.isInventoryOpen && gameplayInputActive && !sleepActive) {
      const lookX = controllerInputActive ? getGamepadAxis(gamepad, 2) : 0;
      const lookY = controllerInputActive ? getGamepadAxis(gamepad, 3) : 0;
      if (lookX !== 0 || lookY !== 0) {
        const lookSensitivity = storeState.controllerLookSensitivity || DEFAULT_CONTROLLER_LOOK_SENSITIVITY;
        applyCameraLookDelta(
          -lookX * lookSensitivity * delta,
          -lookY * lookSensitivity * CONTROLLER_LOOK_VERTICAL_MULTIPLIER * delta,
        );
      }

      if (storeState.isTouchControlsActive && (touchLookDelta.current.x !== 0 || touchLookDelta.current.y !== 0)) {
        const touchLookSensitivity = storeState.mouseSensitivity || DEFAULT_MOUSE_SENSITIVITY;
        applyCameraLookDelta(
          -touchLookDelta.current.x * touchLookSensitivity,
          -touchLookDelta.current.y * touchLookSensitivity,
        );
        touchLookDelta.current.x = 0;
        touchLookDelta.current.y = 0;
      }

      if (
        storeState.keyboardArrowLookEnabled &&
        (mouseGameplayRequested || storeState.isTouchControlsActive) &&
        !storeState.isPauseMenuOpen &&
        !storeState.isSpellMenuOpen &&
        !storeState.questDialogSession &&
        !storeState.isInventoryOpen &&
        !storeState.isMapExpanded &&
        !storeState.isScoreboardOpen
      ) {
        const arrowLookX = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
        const arrowLookY = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
        if (arrowLookX !== 0 || arrowLookY !== 0) {
          const keyboardLookSensitivity = ((storeState.mouseSensitivity || DEFAULT_MOUSE_SENSITIVITY) / DEFAULT_MOUSE_SENSITIVITY) * KEYBOARD_ARROW_LOOK_SPEED;
          applyCameraLookDelta(
            -arrowLookX * keyboardLookSensitivity * delta,
            -arrowLookY * keyboardLookSensitivity * KEYBOARD_ARROW_LOOK_VERTICAL_MULTIPLIER * delta,
          );
        }
      }
    }

    const qaSurvivalModeActive = storeState.gameMode === "solo-survival" || storeState.gameMode === "multiplayer-survival";
    if (qaSurvivalWalkEnabled && qaSurvivalModeActive && storeState.questDialogSession && nowMs - qaWalkLastDialogActionAt.current > 1250) {
      const choice = pickQaQuestDialogChoice(storeState.questDialogSession);
      qaWalkLastDialogActionAt.current = nowMs;
      if (choice) {
        useGameStore.getState().chooseQuestDialogChoice(choice.id);
        if (typeof document !== "undefined") {
          document.documentElement.dataset.wofQaWalkAction = `dialog:${choice.id}`;
        }
      } else {
        useGameStore.getState().closeQuestDialog();
        if (typeof document !== "undefined") {
          document.documentElement.dataset.wofQaWalkAction = "dialog:close";
        }
      }
    }

    const qaWalkActive = qaSurvivalWalkEnabled && !storeState.questDialogSession && !storeState.isInventoryOpen && qaSurvivalModeActive;
    if (qaWalkActive && storeState.isSpellMenuOpen && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("qaHideMenu") === "1" || params.get("qaSurvivalWalk") === "1") {
        storeState.setSpellMenuOpen(false);
      }
    }
    if (qaWalkActive && !useGameStore.getState().isSpellMenuOpen && !sleepActive) {
      if (qaWalkStartTime.current === null) {
        qaWalkStartTime.current = state.clock.elapsedTime;
        qaWalkWaypoint.current.expiresAt = 0;
        qaWalkNextDecisionAt.current = 0;
        qaWalkInspectUntil.current = 0;
        qaWalkCombatFocusUntil.current = 0;
        qaWalkNextCombatCastAt.current = 0;
        qaWalkLastCombatCastAt.current = 0;
        qaWalkNextPracticeCastAt.current = 0;
        qaWalkIntent.current = null;
        qaWalkNextIntentAt.current = 0;
        qaWalkRouteIndex.current = 0;
        qaWalkRouteSmoothedYaw.current = null;
        qaWalkRouteTargetId.current = null;
        qaWalkLastTelemetryAt.current = 0;
        qaWalkLastTelemetryPos.current.set(pos.x, pos.y, pos.z);
        qaWalkLastDummyReanchorAt.current = 0;
        resetQaWalkRecovery();
        qaWalkNextInspectAt.current = randomRangeFromNoise(
          survivalishTurnNoise(pos.x, pos.z, state.clock.elapsedTime),
          QA_SURVIVAL_INSPECTION_MIN_INTERVAL,
          QA_SURVIVAL_INSPECTION_MAX_INTERVAL,
        );
      }

      const elapsed = state.clock.elapsedTime - qaWalkStartTime.current;
      const qaTravelElapsed = Math.max(0, elapsed - qaSurvivalWalkStartDelaySeconds);
      if (qaSurvivalWalkStartDelaySeconds > 0 && elapsed < qaSurvivalWalkStartDelaySeconds) {
        qaWalkInputState.current = { forward: 0, strafe: 0, sprint: false, mode: "travel" };
        if (typeof document !== "undefined") {
          document.documentElement.dataset.wofQaWalkMode = "delay";
          document.documentElement.dataset.wofQaWalkForward = "0.00";
          document.documentElement.dataset.wofQaWalkStrafe = "0.00";
          document.documentElement.dataset.wofQaWalkSprint = "0";
          document.documentElement.dataset.wofQaWalkAction = `delay:${Math.max(0, qaSurvivalWalkStartDelaySeconds - elapsed).toFixed(1)}`;
        }
        return;
      }
      const currentForward = new THREE.Vector3();
      camera.getWorldDirection(currentForward);
      const currentYaw = Math.atan2(currentForward.x, -currentForward.z);
      if (qaWalkYaw.current === null) {
        qaWalkYaw.current = currentYaw;
        qaWalkLastProgressAt.current = elapsed;
        qaWalkLastProgressPos.current.set(pos.x, pos.y, pos.z);
      }

      const chunkCenterX = getQaSurvivalChunkCenter(pos.x);
      const chunkCenterZ = getQaSurvivalChunkCenter(pos.z);
      const localFromCenterX = pos.x - chunkCenterX;
      const localFromCenterZ = pos.z - chunkCenterZ;
      const maxLocalDistance = Math.max(Math.abs(localFromCenterX), Math.abs(localFromCenterZ));
      const qaPosition = new THREE.Vector3(pos.x, pos.y, pos.z);
      const lilyCoilTubeQaActive = isInLilyCoilTubeChunk(qaPosition, storeState.gameMode);
      const lilyCoilTubeTravelState = lilyCoilTubeQaActive ? getNearestLilyCoilTubeState(qaPosition) : null;
      const qaSpellDummyRunActive = isQaSpellDummyRunEnabled();
      const qaRouteWaypoints = getQaSurvivalRouteWaypoints();
      const qaRouteActive = qaRouteWaypoints.length > 0 && !lilyCoilTubeQaActive && !qaSpellDummyRunActive;
      if (qaRouteActive && typeof document !== "undefined") {
        const grassUploadProgress = document.documentElement.dataset.wofBotwGrassUploadProgress;
        const grassUploadRatio = Number(document.documentElement.dataset.wofBotwGrassUploadRatio || 0);
        const progressMatch = grassUploadProgress?.match(/^(\d+)\/(\d+)$/);
        const uploadedGrassCount = progressMatch ? Number(progressMatch[1]) : 0;
        const expectedGrassCount = progressMatch ? Number(progressMatch[2]) : 0;
        const grassReady =
          grassUploadRatio >= 0.98 ||
          (expectedGrassCount > 0 && uploadedGrassCount >= expectedGrassCount);
        if (!grassReady && qaTravelElapsed < 12) {
          qaWalkInputState.current = { forward: 0, strafe: 0, sprint: false, mode: "travel" };
          document.documentElement.dataset.wofQaWalkMode = "warmup";
          document.documentElement.dataset.wofQaWalkForward = "0.00";
          document.documentElement.dataset.wofQaWalkStrafe = "0.00";
          document.documentElement.dataset.wofQaWalkSprint = "0";
          document.documentElement.dataset.wofQaWalkAction = "grass-warmup";
          return;
        }
      }
      if (lilyCoilTubeTravelState) {
        if (qaWalkLilyTubeDirection.current >= 0 && lilyCoilTubeTravelState.t > QA_LILY_COIL_TUBE_REVERSE_EDGE_T) {
          qaWalkLilyTubeDirection.current = -1;
        } else if (qaWalkLilyTubeDirection.current < 0 && lilyCoilTubeTravelState.t < QA_LILY_COIL_TUBE_RESTART_EDGE_T) {
          qaWalkLilyTubeDirection.current = 1;
        }
      }
      const setLilyCoilTubeWaypoint = () => {
        if (!lilyCoilTubeQaActive) return false;
        const nearestTube = lilyCoilTubeTravelState ?? getNearestLilyCoilTubeState(qaPosition);
        const noise = survivalishTurnNoise(pos.x + 317, pos.z - 241, elapsed * 0.21);
        const direction = qaWalkLilyTubeDirection.current >= 0 ? 1 : -1;
        const targetT = THREE.MathUtils.clamp(
          nearestTube.t + direction * (QA_LILY_COIL_TUBE_LOOK_AHEAD_T + (noise - 0.5) * 0.014),
          0.02,
          0.98,
        );
        const targetFrame = getLilyCoilTubeFrame(targetT);
        qaWalkWaypoint.current = {
          x: targetFrame.center.x,
          z: targetFrame.center.z,
          expiresAt: elapsed + randomRangeFromNoise(noise, 2.4, 4.1),
        };
        return true;
      };
      const isBaseVillageQaArea =
        Math.abs(chunkCenterX) < 1 &&
        Math.abs(chunkCenterZ) < 1 &&
        Math.max(Math.abs(pos.x), Math.abs(pos.z)) < QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT + 54;
      const isDarrelGroveQaArea =
        Math.abs(chunkCenterX - DARREL_QUEST_CHUNK.cx * SURVIVAL_BLOCK_SIZE) < 1 &&
        Math.abs(chunkCenterZ - DARREL_QUEST_CHUNK.cz * SURVIVAL_BLOCK_SIZE) < 1;
      const setDarrelGroveWaypoint = () => {
        if (!isDarrelGroveQaArea) return false;

        const noiseA = survivalishTurnNoise(pos.x + 73, pos.z - 29, elapsed * 0.31);
        const noiseB = survivalishTurnNoise(pos.x - 111, pos.z + 53, elapsed * 0.27);
        const orbit = noiseA * Math.PI * 2;
        const radiusX = randomRangeFromNoise(noiseB, 26, 72);
        const radiusZ = randomRangeFromNoise(noiseA, 14, 42);
        const localTargetX = THREE.MathUtils.clamp(
          QA_DARREL_GROVE_CLEARING_LOCAL_X + Math.cos(orbit) * radiusX,
          -118,
          146,
        );
        const localTargetZ = THREE.MathUtils.clamp(
          QA_DARREL_GROVE_CLEARING_LOCAL_Z + Math.sin(orbit) * radiusZ,
          152,
          218,
        );
        qaWalkWaypoint.current = {
          x: chunkCenterX + localTargetX,
          z: chunkCenterZ + localTargetZ,
          expiresAt: elapsed + randomRangeFromNoise(noiseB, 4.6, 7.4),
        };
        return true;
      };
      const getDarrelGroveRescuePosition = () => {
        if (!isDarrelGroveQaArea) return null;
        const followingDarrelDragonRoute = qaWalkIntent.current?.kind === "darrel-dragon";
        const inRiverBridgePocket =
          localFromCenterZ > 72 &&
          localFromCenterZ < 148 &&
          Math.abs(localFromCenterX) < 142;
        const underHouseOrRoof =
          localFromCenterZ > -64 &&
          localFromCenterZ < 72 &&
          Math.abs(localFromCenterX) < 96;
        const belowClearWalkingSurface = pos.y < 12;
        if (followingDarrelDragonRoute && !belowClearWalkingSurface) return null;
        if (!inRiverBridgePocket && !underHouseOrRoof && !belowClearWalkingSurface) return null;
        return {
          x: chunkCenterX + QA_DARREL_GROVE_CLEARING_LOCAL_X,
          y: QA_DARREL_GROVE_RESCUE_Y,
          z: chunkCenterZ + QA_DARREL_GROVE_CLEARING_LOCAL_Z,
        };
      };
      const getDarrelDragonRouteAssistPosition = () => {
        if (!isDarrelGroveQaArea || qaWalkIntent.current?.kind !== "darrel-dragon") return null;
        const inSideSnagPocket =
          Math.abs(localFromCenterX) > 58 &&
          Math.abs(localFromCenterX) < 112 &&
          localFromCenterZ > 36 &&
          localFromCenterZ < 82 &&
          pos.y > 12;
        const inPorchSnagPocket =
          Math.abs(localFromCenterX) > 18 &&
          Math.abs(localFromCenterX) < 48 &&
          localFromCenterZ > -62 &&
          localFromCenterZ < -34 &&
          pos.y > 24;
        if (inPorchSnagPocket || inSideSnagPocket) {
          return {
            x: chunkCenterX,
            y: QA_DARREL_GROVE_RESCUE_Y,
            z: chunkCenterZ + QA_DARREL_GROVE_DRAGON_DOOR_Z,
          };
        }
        return null;
      };
      const setBaseVillageRoadWaypoint = () => {
        if (!isBaseVillageQaArea) return false;

        const absX = Math.abs(pos.x);
        const absZ = Math.abs(pos.z);
        const onVerticalRoad = absX <= QA_BASE_VILLAGE_ROAD_HALF_WIDTH;
        const onHorizontalRoad = absZ <= QA_BASE_VILLAGE_ROAD_HALF_WIDTH;
        const noise = survivalishTurnNoise(pos.x + 19, pos.z - 37, elapsed * 0.41);
        const distance = randomRangeFromNoise(
          survivalishTurnNoise(pos.x - 27, pos.z + 11, elapsed * 0.23),
          QA_SURVIVAL_WAYPOINT_MIN_DISTANCE * 0.68,
          QA_SURVIVAL_WAYPOINT_MAX_DISTANCE * 0.72,
        );
        let targetX = pos.x;
        let targetZ = pos.z;

        if (!onVerticalRoad && !onHorizontalRoad) {
          if (absX < absZ) {
            targetX = 0;
            targetZ = THREE.MathUtils.clamp(pos.z, -QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT, QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT);
          } else {
            targetX = THREE.MathUtils.clamp(pos.x, -QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT, QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT);
            targetZ = 0;
          }
        } else if (onVerticalRoad && (!onHorizontalRoad || noise < 0.58)) {
          const forwardZ = -Math.cos(qaWalkYaw.current ?? currentYaw);
          const direction = pos.z > QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT * 0.7
            ? -1
            : pos.z < -QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT * 0.7
              ? 1
              : (Math.abs(forwardZ) > 0.22 ? Math.sign(forwardZ) : (noise > 0.5 ? 1 : -1));
          targetX = 0;
          targetZ = THREE.MathUtils.clamp(pos.z + direction * distance, -QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT, QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT);
        } else {
          const forwardX = Math.sin(qaWalkYaw.current ?? currentYaw);
          const direction = pos.x > QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT * 0.7
            ? -1
            : pos.x < -QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT * 0.7
              ? 1
              : (Math.abs(forwardX) > 0.22 ? Math.sign(forwardX) : (noise > 0.5 ? 1 : -1));
          targetX = THREE.MathUtils.clamp(pos.x + direction * distance, -QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT, QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT);
          targetZ = 0;
        }

        qaWalkWaypoint.current = {
          x: targetX,
          z: targetZ,
          expiresAt: elapsed + randomRangeFromNoise(noise, 4.8, 8.2),
        };
        return true;
      };
      const getBaseVillageRoadRescuePosition = () => {
        if (!isBaseVillageQaArea) return null;
        const absX = Math.abs(pos.x);
        const absZ = Math.abs(pos.z);
        if (absX <= QA_BASE_VILLAGE_ROAD_HALF_WIDTH || absZ <= QA_BASE_VILLAGE_ROAD_HALF_WIDTH) return null;
        if (absX < absZ) {
          return {
            x: 0,
            y: pos.y + 0.28,
            z: THREE.MathUtils.clamp(pos.z, -QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT, QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT),
          };
        }
        return {
          x: THREE.MathUtils.clamp(pos.x, -QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT, QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT),
          y: pos.y + 0.28,
          z: 0,
        };
      };
      const setRouteWaypoint = () => {
        if (!qaRouteActive) return false;
        qaWalkIntent.current = null;
        qaWalkInspectUntil.current = 0;
        qaWalkNextInspectAt.current = elapsed + 999;

        let target = qaRouteWaypoints[qaWalkRouteIndex.current % qaRouteWaypoints.length];
        let guard = 0;
        while (
          guard < qaRouteWaypoints.length &&
          Math.hypot(target.x - pos.x, target.z - pos.z) < QA_SURVIVAL_ROUTE_REACH_DISTANCE
        ) {
          qaWalkRouteIndex.current = (qaWalkRouteIndex.current + 1) % qaRouteWaypoints.length;
          target = qaRouteWaypoints[qaWalkRouteIndex.current % qaRouteWaypoints.length];
          guard += 1;
        }

        qaWalkWaypoint.current = {
          x: target.x,
          z: target.z,
          expiresAt: elapsed + QA_SURVIVAL_ROUTE_WAYPOINT_SECONDS,
        };
        return true;
      };
      const intentDistance = (intent: QaSurvivalIntent | null) => intent
        ? Math.hypot(intent.x - pos.x, intent.z - pos.z)
        : Number.POSITIVE_INFINITY;
      const getIntentMoveTarget = (intent: QaSurvivalIntent) => {
        if (intent.kind !== "darrel-dragon" || !isDarrelGroveQaArea) return intent;

        const localX = pos.x - chunkCenterX;
        const localZ = pos.z - chunkCenterZ;
        const routeSide = localX >= 0 ? 1 : -1;
        const stage = (x: number, z: number) => ({
          x: chunkCenterX + x,
          y: intent.y,
          z: chunkCenterZ + z,
        });

        if (localZ > QA_DARREL_GROVE_DRAGON_SIDE_APPROACH_Z + 14) {
          return stage(
            routeSide * QA_DARREL_GROVE_DRAGON_SIDE_APPROACH_X,
            QA_DARREL_GROVE_DRAGON_SIDE_APPROACH_Z,
          );
        }
        if (
          Math.abs(localX) > QA_DARREL_GROVE_DRAGON_SIDE_STAIR_X + 12 ||
          localZ < QA_DARREL_GROVE_DRAGON_SIDE_STAIR_Z - 16
        ) {
          return stage(
            routeSide * QA_DARREL_GROVE_DRAGON_SIDE_STAIR_X,
            QA_DARREL_GROVE_DRAGON_SIDE_STAIR_Z,
          );
        }
        if (Math.abs(localX) > 18 || localZ < QA_DARREL_GROVE_DRAGON_DOOR_Z - 8) {
          return stage(0, QA_DARREL_GROVE_DRAGON_DOOR_Z);
        }
        return intent;
      };
      const intentCompletionDistance = (intent: QaSurvivalIntent) => {
        if (intent.kind === "mana-flower") {
          const flowerRadius = getReadyQaManaFlowers().find((flower) => flower.id === intent.id)?.radius ?? 0;
          return Math.max(QA_INTENT_MANA_COLLECT_RADIUS, 1.2 + flowerRadius);
        }
        if (intent.kind === "spell-dummy") return QA_INTENT_DUMMY_KEEP_DISTANCE;
        if (intent.kind === "darrel-dragon") return QA_DARREL_GROVE_DRAGON_INTERACT_DISTANCE;
        return QA_INTENT_INTERACT_DISTANCE;
      };
      const setIntentWaypoint = (intent: QaSurvivalIntent) => {
        qaWalkWaypoint.current = {
          x: intent.x,
          z: intent.z,
          expiresAt: Math.min(intent.expiresAt, elapsed + 3.8),
        };
      };
      const makeIntent = (
        kind: QaSurvivalIntentKind,
        id: string,
        label: string,
        target: { x: number; y: number; z: number },
        durationSeconds = QA_INTENT_INTEREST_STALE_SECONDS,
      ): QaSurvivalIntent => ({
        kind,
        id,
        label,
        x: target.x,
        y: target.y,
        z: target.z,
        expiresAt: elapsed + durationSeconds,
        observeUntil: elapsed + QA_INTENT_OBSERVE_SECONDS,
      });
      const scoreInterest = (id: string, score: number) => {
        const lastSeen = qaWalkInterestMemory.current[id] ?? -Infinity;
        return elapsed - lastSeen < QA_INTENT_INTEREST_STALE_SECONDS ? score - 16 : score;
      };
      const maybeChooseIntent = (force = false) => {
        const spellDummiesForIntent = getQaSpellDummies();
        const shouldPrioritizeDummies = qaSpellDummyRunActive && spellDummiesForIntent.some((dummy) => dummy.health > 0);
        const current = qaWalkIntent.current;
        const currentDummy = current?.kind === "spell-dummy"
          ? spellDummiesForIntent.find((dummy) => dummy.id === current.id)
          : null;
        const abandonCurrentDummy = qaSpellDummyRunActive && current?.kind === "spell-dummy" && (
          !currentDummy ||
          currentDummy.health <= 38 ||
          intentDistance(current) > QA_SURVIVAL_COMBAT_TARGET_RANGE * 1.05
        );
        if (
          current &&
          elapsed < current.expiresAt &&
          intentDistance(current) > intentCompletionDistance(current) &&
          !(shouldPrioritizeDummies && current.kind === "mana-flower") &&
          !abandonCurrentDummy
        ) {
          setIntentWaypoint(current);
          return current;
        }

        let bestIntent: QaSurvivalIntent | null = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        const consider = (intent: QaSurvivalIntent, score: number) => {
          const adjustedScore = scoreInterest(`${intent.kind}:${intent.id}`, score);
          if (adjustedScore > bestScore) {
            bestIntent = intent;
            bestScore = adjustedScore;
          }
        };

        const lowestRunePower = Math.min(storeState.leftRunePower, storeState.rightRunePower);
        const needsMana = shouldPrioritizeDummies ? false : lowestRunePower < QA_INTENT_MANA_LOW_THRESHOLD;
        getReadyQaManaFlowers().forEach((flower) => {
          if (shouldPrioritizeDummies && !needsMana) return;
          const distance = Math.hypot(flower.x - pos.x, flower.z - pos.z);
          if (distance > QA_INTENT_MANA_RANGE) return;
          const urgency = needsMana ? 46 : 14;
          consider(
            makeIntent("mana-flower", flower.id, "mana flower", { x: flower.x, y: flower.y, z: flower.z }, needsMana ? 15 : 8),
            urgency - distance / 26,
          );
        });

        spellDummiesForIntent.forEach((dummy) => {
          const distance = Math.hypot(dummy.position.x - pos.x, dummy.position.z - pos.z);
          const dummyIntentRange = qaSpellDummyRunActive ? QA_INTENT_DUMMY_TEST_RANGE : QA_INTENT_DUMMY_RANGE;
          if (distance > dummyIntentRange) return;
          const healthScore = THREE.MathUtils.clamp(dummy.health / 7, 0, 18);
          const woundedPenalty = qaSpellDummyRunActive && dummy.health <= 38 ? 20 : 0;
          consider(
            makeIntent("spell-dummy", dummy.id, `dummy ${Math.round(dummy.health)}`, dummy.position, qaSpellDummyRunActive ? 24 : 10),
            (qaSpellDummyRunActive ? 104 - distance / 16 : 52 - distance / 9) + healthScore - woundedPenalty,
          );
        });

        getQuestNavigationIntentTargets().forEach((target: QuestNavigationTarget) => {
          const distance = Math.hypot(target.x - pos.x, target.z - pos.z);
          if (distance > QA_INTENT_QUEST_RANGE) return;
          consider(
            makeIntent("quest-target", target.id, target.label, { x: target.x, y: target.y, z: target.z }, 18),
            42 - distance / 22,
          );
        });

        if (isDarrelGroveQaArea) {
          const dragonDistance = Math.hypot(DARREL_DRAGON_WORLD_POSITION.x - pos.x, DARREL_DRAGON_WORLD_POSITION.z - pos.z);
          consider(
            makeIntent("darrel-dragon", "darrel-dragon", "spirit dragon", DARREL_DRAGON_WORLD_POSITION, QA_DARREL_GROVE_DRAGON_INTENT_SECONDS),
            QA_DARREL_GROVE_DRAGON_INTEREST_SCORE - dragonDistance / 14,
          );
        }

        if (!bestIntent || bestScore < 8) {
          qaWalkIntent.current = null;
          return null;
        }

        qaWalkIntent.current = bestIntent;
        qaWalkNextIntentAt.current = elapsed + randomRangeFromNoise(
          survivalishTurnNoise(bestIntent.x, bestIntent.z, elapsed),
          QA_INTENT_REPLAN_MIN_SECONDS,
          QA_INTENT_REPLAN_MAX_SECONDS,
        );
        qaWalkInterestMemory.current[`${bestIntent.kind}:${bestIntent.id}`] = elapsed;
        setIntentWaypoint(bestIntent);
        return bestIntent;
      };
      const chooseNewWaypoint = (preferCenter = false) => {
        if (setLilyCoilTubeWaypoint()) return;
        if (setRouteWaypoint()) return;
        const shouldPrioritizeDummyIntent = qaSpellDummyRunActive && getQaSpellDummies().length > 0;
        if ((!preferCenter || shouldPrioritizeDummyIntent) && maybeChooseIntent(shouldPrioritizeDummyIntent || elapsed >= qaWalkNextIntentAt.current)) return;
        if (setDarrelGroveWaypoint()) return;
        if (setBaseVillageRoadWaypoint()) return;

        const noiseA = survivalishTurnNoise(pos.x + elapsed * 3.7, pos.z - elapsed * 2.9, elapsed * 0.31);
        const noiseB = survivalishTurnNoise(pos.x - 41.7, pos.z + 19.3, elapsed * 0.23);
        const noiseC = survivalishTurnNoise(pos.x + 7.9, pos.z - 13.1, elapsed * 0.17);
        const edgePressure = THREE.MathUtils.clamp((maxLocalDistance - SURVIVAL_BLOCK_SIZE * 0.34) / (SURVIVAL_BLOCK_SIZE * 0.18), 0, 1);
        const centerYaw = Math.atan2(chunkCenterX - pos.x, -(chunkCenterZ - pos.z));
        const roamYaw = (qaWalkYaw.current ?? currentYaw) + (noiseA - 0.5) * 1.85;
        const waypointYaw = preferCenter || edgePressure > 0
          ? lerpAngleRadians(roamYaw, centerYaw, preferCenter ? 0.82 : edgePressure * 0.72)
          : roamYaw;
        const distance = randomRangeFromNoise(noiseB, QA_SURVIVAL_WAYPOINT_MIN_DISTANCE, QA_SURVIVAL_WAYPOINT_MAX_DISTANCE);
        const sideOffset = (noiseC - 0.5) * 70;
        const forwardX = Math.sin(waypointYaw);
        const forwardZ = -Math.cos(waypointYaw);
        const rightX = Math.cos(waypointYaw);
        const rightZ = Math.sin(waypointYaw);
        qaWalkWaypoint.current = {
          x: pos.x + forwardX * distance + rightX * sideOffset,
          z: pos.z + forwardZ * distance + rightZ * sideOffset,
          expiresAt: elapsed + randomRangeFromNoise(noiseC, 6.5, 13.5),
        };
      };

      const setForwardQaWaypoint = (yaw: number, distance = QA_SURVIVAL_WAYPOINT_MIN_DISTANCE * 1.15) => {
        qaWalkWaypoint.current = {
          x: pos.x + Math.sin(yaw) * distance,
          z: pos.z - Math.cos(yaw) * distance,
          expiresAt: elapsed + 5.8,
        };
      };

      const waypointDistance = Math.hypot(qaWalkWaypoint.current.x - pos.x, qaWalkWaypoint.current.z - pos.z);
      if (
        elapsed >= qaWalkWaypoint.current.expiresAt ||
        waypointDistance < (qaRouteActive ? QA_SURVIVAL_ROUTE_REACH_DISTANCE : 18) ||
        (!qaRouteActive && maxLocalDistance > SURVIVAL_BLOCK_SIZE * 0.48)
      ) {
        chooseNewWaypoint(!qaRouteActive && maxLocalDistance > SURVIVAL_BLOCK_SIZE * 0.48);
      }
      if (qaRouteActive) {
        qaWalkIntent.current = null;
      }
      let activeIntent = !qaRouteActive && qaWalkIntent.current && elapsed < qaWalkIntent.current.expiresAt ? qaWalkIntent.current : null;
      if (!activeIntent && qaWalkIntent.current) {
        qaWalkIntent.current = null;
      }
      if (!activeIntent && qaSpellDummyRunActive && getQaSpellDummies().length > 0) {
        activeIntent = maybeChooseIntent(true);
      }
      if (
        activeIntent?.kind === "mana-flower" &&
        qaSpellDummyRunActive &&
        getQaSpellDummies().some((dummy) => dummy.health > 0)
      ) {
        qaWalkIntent.current = null;
        qaWalkNextIntentAt.current = 0;
        activeIntent = maybeChooseIntent(true);
      }
      if (activeIntent?.kind === "spell-dummy") {
        const liveDummy = getQaSpellDummies().find((dummy) => dummy.id === activeIntent?.id);
        if (liveDummy) {
          activeIntent = {
            ...activeIntent,
            x: liveDummy.position.x,
            y: liveDummy.position.y,
            z: liveDummy.position.z,
          };
          qaWalkIntent.current = activeIntent;
        } else if (qaSpellDummyRunActive) {
          qaWalkIntent.current = null;
          qaWalkNextIntentAt.current = 0;
          activeIntent = maybeChooseIntent(true);
        }
      }
      const activeIntentDistance = intentDistance(activeIntent);

      if (
        !lilyCoilTubeQaActive &&
        !qaRouteActive &&
        !qaWalkIntent.current &&
        (!qaSpellDummyRunActive || getQaSpellDummies().length <= 0) &&
        elapsed >= qaWalkNextInspectAt.current &&
        elapsed >= qaWalkInspectUntil.current &&
        elapsed > qaWalkRecoveryUntil.current + 2.5 &&
        qaWalkStuckStrikes.current <= 1
      ) {
        const inspectNoise = survivalishTurnNoise(pos.x + 103, pos.z - 59, elapsed);
        qaWalkInspectUntil.current = elapsed + randomRangeFromNoise(
          inspectNoise,
          QA_SURVIVAL_INSPECTION_MIN_SECONDS,
          QA_SURVIVAL_INSPECTION_MAX_SECONDS,
        );
        qaWalkInspectYaw.current = (qaWalkYaw.current ?? currentYaw) + randomRangeFromNoise(inspectNoise, -0.85, 0.85);
        qaWalkNextInspectAt.current = qaWalkInspectUntil.current + randomRangeFromNoise(
          survivalishTurnNoise(pos.x - 17, pos.z + 97, elapsed * 0.4),
          QA_SURVIVAL_INSPECTION_MIN_INTERVAL,
          QA_SURVIVAL_INSPECTION_MAX_INTERVAL,
        );
      }

      let desiredYaw = Math.atan2(qaWalkWaypoint.current.x - pos.x, -(qaWalkWaypoint.current.z - pos.z));
      let lilyCoilTubeTravelYaw: number | null = null;
      if (lilyCoilTubeTravelState) {
        const direction = qaWalkLilyTubeDirection.current >= 0 ? 1 : -1;
        const lookT = THREE.MathUtils.clamp(
          lilyCoilTubeTravelState.t + direction * QA_LILY_COIL_TUBE_LOOK_AHEAD_T,
          0.02,
          0.98,
        );
        const lookFrame = getLilyCoilTubeFrame(lookT);
        const travelTangent = lookFrame.tangent.clone().multiplyScalar(direction).normalize();
        lilyCoilTubeTravelYaw = Math.atan2(travelTangent.x, -travelTangent.z);
        desiredYaw = lilyCoilTubeTravelYaw;
      }

      const probeClearance = (yaw: number, distance: number) => {
        let clearance = distance;
        for (const height of QA_SURVIVAL_WALK_PROBE_HEIGHTS) {
          const ray = new rapier.Ray(
            { x: pos.x, y: pos.y + height, z: pos.z },
            { x: Math.sin(yaw), y: 0, z: -Math.cos(yaw) },
          );
          // @ts-ignore - rapier exposes the collider predicate in this overload.
          const hit = world.castRay(ray, distance, true, undefined, undefined, undefined, undefined, isSolidWorldCollider);
          if (hit) clearance = Math.min(clearance, hit.timeOfImpact);
        }
        return clearance;
      };

      const probeViewClearance = (yaw: number, distance: number) => {
        const ray = new rapier.Ray(
          { x: pos.x, y: pos.y + PLAYER_CAMERA_HEIGHT * 0.86, z: pos.z },
          { x: Math.sin(yaw), y: 0, z: -Math.cos(yaw) },
        );
        // @ts-ignore - rapier exposes the collider predicate in this overload.
        const hit = world.castRay(ray, distance, true, undefined, undefined, undefined, undefined, isSolidWorldCollider);
        return hit ? hit.timeOfImpact : distance;
      };

      const probeOverheadClearance = () => {
        const ray = new rapier.Ray(
          { x: pos.x, y: pos.y + PLAYER_CAMERA_HEIGHT * 0.34, z: pos.z },
          { x: 0, y: 1, z: 0 },
        );
        // @ts-ignore - rapier exposes the collider predicate in this overload.
        const hit = world.castRay(ray, QA_SURVIVAL_OVERHEAD_PROBE_DISTANCE, true, undefined, undefined, undefined, undefined, isSolidWorldCollider);
        return hit ? hit.timeOfImpact : QA_SURVIVAL_OVERHEAD_PROBE_DISTANCE;
      };

      const scoreCandidateYaw = (candidateYaw: number, turn: number) => {
        const center = probeClearance(candidateYaw, QA_SURVIVAL_WALK_PROBE_DISTANCE);
        const left = probeClearance(candidateYaw + 0.34, QA_SURVIVAL_WALK_SIDE_PROBE_DISTANCE);
        const right = probeClearance(candidateYaw - 0.34, QA_SURVIVAL_WALK_SIDE_PROBE_DISTANCE);
        const lookAhead = probeClearance(candidateYaw, QA_SURVIVAL_WALK_LOOKAHEAD_DISTANCE);
        const directionAgreement = Math.cos(candidateYaw - desiredYaw) * 3.15;
        const turnPenalty = Math.abs(turn) * 0.85;
        const deadEndPenalty = lookAhead < QA_SURVIVAL_WALK_LOOKAHEAD_DISTANCE * 0.42 ? 16 : 0;
        return {
          yaw: candidateYaw,
          center,
          left,
          right,
          lookAhead,
          score: center * 1.15 + Math.min(left, right) * 0.72 + Math.min(lookAhead, 32) * 0.58 + directionAgreement - turnPenalty - deadEndPenalty,
        };
      };

      const findEscapeYaw = (baseYaw: number, preferYaw: number) => {
        let best = {
          yaw: baseYaw + Math.PI,
          center: 0,
          left: 0,
          right: 0,
          lookAhead: 0,
          score: Number.NEGATIVE_INFINITY,
        };
        const evaluate = (candidateYaw: number, preferWeight: number) => {
          const center = probeClearance(candidateYaw, QA_SURVIVAL_WALK_PROBE_DISTANCE * 1.15);
          const left = probeClearance(candidateYaw + 0.42, QA_SURVIVAL_WALK_SIDE_PROBE_DISTANCE * 1.1);
          const right = probeClearance(candidateYaw - 0.42, QA_SURVIVAL_WALK_SIDE_PROBE_DISTANCE * 1.1);
          const lookAhead = probeClearance(candidateYaw, QA_SURVIVAL_WALK_LOOKAHEAD_DISTANCE);
          const desiredBias = Math.cos(candidateYaw - preferYaw) * preferWeight;
          const currentTurn = Math.abs(angleDeltaRadians(baseYaw, candidateYaw));
          const turnPenalty = currentTurn > 2.75 ? 0.25 : currentTurn * 0.08;
          const deadEndPenalty = lookAhead < QA_SURVIVAL_WALK_LOOKAHEAD_DISTANCE * 0.36 ? 12 : 0;
          const score = center * 1.55 + Math.min(left, right) * 0.84 + Math.max(left, right) * 0.18 + Math.min(lookAhead, 34) * 0.64 + desiredBias - turnPenalty - deadEndPenalty;
          if (score > best.score) {
            best = { yaw: candidateYaw, center, left, right, lookAhead, score };
          }
        };

        evaluate(preferYaw, 1.45);
        evaluate(baseYaw + Math.PI, 0.35);
        QA_SURVIVAL_WALK_ESCAPE_TURNS.forEach((turn) => evaluate(baseYaw + turn, 0.75));
        QA_SURVIVAL_WALK_TURN_OPTIONS.forEach((turn) => evaluate(preferYaw + turn, 1.05));
        return best;
      };

      const beginQaWalkRecovery = (aggressive = false) => {
        if (aggressive) chooseNewWaypoint(true);
        const baseYaw = qaWalkYaw.current ?? currentYaw;
        const preferYaw = Math.atan2(qaWalkWaypoint.current.x - pos.x, -(qaWalkWaypoint.current.z - pos.z));
        const escape = findEscapeYaw(baseYaw, preferYaw);
        const durationNoise = survivalishTurnNoise(pos.x + 31, pos.z - 83, elapsed + qaWalkStuckStrikes.current * 1.7);
        const strikeBonus = Math.min(qaWalkStuckStrikes.current, 4) * 0.22;
        qaWalkRecoveryStartedAt.current = elapsed;
        qaWalkRecoveryStartPos.current.set(pos.x, pos.y, pos.z);
        qaWalkRecoveryUntil.current = elapsed + randomRangeFromNoise(
          durationNoise,
          QA_SURVIVAL_RECOVERY_MIN_SECONDS + strikeBonus,
          QA_SURVIVAL_RECOVERY_MAX_SECONDS + strikeBonus,
        );
        qaWalkRecoveryYaw.current = escape.yaw;
        const strafe = THREE.MathUtils.clamp((escape.right - escape.left) * 0.12, -0.72, 0.72);
        qaWalkRecoveryStrafe.current = Math.abs(strafe) > 0.12
          ? strafe
          : (survivalishTurnNoise(pos.x - 7, pos.z + 19, elapsed) > 0.5 ? 0.46 : -0.46);
        qaWalkInspectUntil.current = 0;
        qaWalkLastDecisionAt.current = elapsed;
        qaWalkNextDecisionAt.current = elapsed + randomRangeFromNoise(durationNoise, 1.15, 2.35);
      };

      const measuredForwardClearance = probeClearance(qaWalkYaw.current, QA_SURVIVAL_WALK_PROBE_DISTANCE);
      const measuredForwardLookAhead = probeClearance(qaWalkYaw.current, QA_SURVIVAL_WALK_LOOKAHEAD_DISTANCE);
      const measuredViewClearance = probeViewClearance(qaWalkYaw.current, QA_SURVIVAL_VIEW_SOFT_CLEARANCE);
      const measuredOverheadClearance = probeOverheadClearance();
      const forwardClearance = lilyCoilTubeQaActive ? QA_SURVIVAL_WALK_PROBE_DISTANCE : measuredForwardClearance;
      const forwardLookAhead = lilyCoilTubeQaActive ? QA_SURVIVAL_WALK_LOOKAHEAD_DISTANCE : measuredForwardLookAhead;
      const viewClearance = lilyCoilTubeQaActive ? QA_SURVIVAL_VIEW_SOFT_CLEARANCE : measuredViewClearance;
      const overheadClearance = lilyCoilTubeQaActive ? QA_SURVIVAL_OVERHEAD_PROBE_DISTANCE : measuredOverheadClearance;
      const routeHardBlocked = qaRouteActive && (
        forwardClearance < QA_SURVIVAL_WALK_BLOCKED_CLEARANCE ||
        viewClearance < QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE ||
        overheadClearance < QA_SURVIVAL_OVERHEAD_BLOCKED_CLEARANCE
      );
      const routeSoftBlocked = qaRouteActive && (
        routeHardBlocked ||
        forwardLookAhead < QA_SURVIVAL_WALK_SOFT_LOOKAHEAD * 0.72 ||
        forwardClearance < QA_SURVIVAL_WALK_SOFT_CLEARANCE * 0.86
      );
      if (routeSoftBlocked) {
        if (qaWalkRouteBlockedSince.current <= 0) {
          qaWalkRouteBlockedSince.current = elapsed;
        }
      } else {
        qaWalkRouteBlockedSince.current = 0;
      }
      const routeBlockDwelled = qaRouteActive &&
        qaWalkRouteBlockedSince.current > 0 &&
        elapsed - qaWalkRouteBlockedSince.current >= QA_SURVIVAL_ROUTE_BLOCKED_DWELL_SECONDS;
      let mode: QaSurvivalWalkMode = qaRouteActive ? "route" : "travel";
      let targetYaw = desiredYaw
        + Math.sin(elapsed * 0.43 + pos.x * 0.002) * 0.14
        + Math.sin(elapsed * 0.91 + pos.z * 0.0014) * 0.05;
      let forwardAmount = 0.58 + Math.sin(elapsed * 0.47 + pos.z * 0.001) * 0.12;
      let strafeAmount = Math.sin(elapsed * 0.62 + pos.x * 0.003 + pos.z * 0.002) * 0.16;
      let recoveryReason = "";
      let sprint = forwardClearance > QA_SURVIVAL_WALK_PROBE_DISTANCE * 0.68
        && forwardLookAhead > QA_SURVIVAL_WALK_SOFT_LOOKAHEAD
        && viewClearance > QA_SURVIVAL_VIEW_SOFT_CLEARANCE * 0.72
        && Math.sin(elapsed * 0.29 + pos.x * 0.0017) > -0.18;
      if (qaRouteActive) {
        const routeTarget = qaRouteWaypoints[qaWalkRouteIndex.current % qaRouteWaypoints.length];
        const routeTargetChanged = routeTarget?.id !== qaWalkRouteTargetId.current;
        const routeYaw = qaWalkRouteSmoothedYaw.current;
        const routeYawDelta = routeYaw === null ? 0 : Math.abs(angleDeltaRadians(routeYaw, desiredYaw));
        if (routeTargetChanged || routeYaw === null || routeYawDelta > QA_SURVIVAL_ROUTE_YAW_SNAP_DELTA) {
          qaWalkRouteSmoothedYaw.current = desiredYaw;
          qaWalkRouteTargetId.current = routeTarget?.id ?? null;
        } else {
          qaWalkRouteSmoothedYaw.current = lerpAngleRadians(
            routeYaw,
            desiredYaw,
            1 - Math.exp(-QA_SURVIVAL_ROUTE_YAW_SMOOTH_RATE * delta),
          );
        }
        targetYaw = qaWalkRouteSmoothedYaw.current;
        forwardAmount = 0.92;
        strafeAmount = 0;
        sprint = forwardClearance > QA_SURVIVAL_WALK_BLOCKED_CLEARANCE * 1.35 &&
          forwardLookAhead > QA_SURVIVAL_WALK_SOFT_LOOKAHEAD * 0.82 &&
          viewClearance > QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE * 1.35 &&
          overheadClearance > QA_SURVIVAL_OVERHEAD_BLOCKED_CLEARANCE;
      } else {
        qaWalkRouteSmoothedYaw.current = null;
        qaWalkRouteTargetId.current = null;
      }
      if (lilyCoilTubeTravelYaw !== null) {
        const tubeDirection = qaWalkLilyTubeDirection.current >= 0 ? 1 : -1;
        targetYaw = lilyCoilTubeTravelYaw + Math.sin(elapsed * 0.48 + pos.y * 0.006) * 0.1;
        forwardAmount = tubeDirection * (QA_LILY_COIL_TUBE_FORWARD + Math.sin(elapsed * 0.21 + pos.x * 0.001) * 0.06);
        strafeAmount = Math.sin(elapsed * 0.53 + (lilyCoilTubeTravelState?.t ?? 0) * 22) * QA_LILY_COIL_TUBE_STRAFE;
        sprint = true;
      }

      const needsDecision = !lilyCoilTubeQaActive && (qaRouteActive
        ? routeBlockDwelled
        : (
          forwardClearance < QA_SURVIVAL_WALK_PROBE_DISTANCE * 0.72 ||
          forwardLookAhead < QA_SURVIVAL_WALK_LOOKAHEAD_DISTANCE * 0.48 ||
          viewClearance < QA_SURVIVAL_VIEW_SOFT_CLEARANCE * 0.68 ||
          overheadClearance < QA_SURVIVAL_OVERHEAD_SOFT_CLEARANCE ||
          elapsed >= qaWalkNextDecisionAt.current ||
          elapsed - qaWalkLastDecisionAt.current > QA_SURVIVAL_WALK_DECISION_MAX_SECONDS
        )
      );

      if (needsDecision) {
        let best = scoreCandidateYaw(targetYaw, 0);

        QA_SURVIVAL_WALK_TURN_OPTIONS.forEach((turn, index) => {
          const candidateYaw = desiredYaw + turn + (index === 0 ? Math.sin(elapsed * 0.37) * 0.22 : 0);
          const candidate = scoreCandidateYaw(candidateYaw, turn);
          if (candidate.score > best.score) {
            best = candidate;
          }
        });

        targetYaw = best.yaw;
        strafeAmount = qaRouteActive
          ? 0
          : THREE.MathUtils.clamp((best.right - best.left) * 0.09, -0.62, 0.62) + strafeAmount * 0.35;
        qaWalkLastDecisionAt.current = elapsed;
        qaWalkNextDecisionAt.current = elapsed + randomRangeFromNoise(
          survivalishTurnNoise(pos.x - 3.5, pos.z + 8.25, elapsed),
          QA_SURVIVAL_WALK_DECISION_MIN_SECONDS,
          QA_SURVIVAL_WALK_DECISION_MAX_SECONDS,
        );
      }

      if (
        !lilyCoilTubeQaActive &&
        (
          forwardClearance < QA_SURVIVAL_WALK_BLOCKED_CLEARANCE ||
          viewClearance < QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE ||
          overheadClearance < QA_SURVIVAL_OVERHEAD_BLOCKED_CLEARANCE
        ) &&
        (!qaRouteActive || (routeHardBlocked && routeBlockDwelled)) &&
        elapsed >= qaWalkRecoveryUntil.current - 0.08
      ) {
        recoveryReason = overheadClearance < QA_SURVIVAL_OVERHEAD_BLOCKED_CLEARANCE
          ? "overhead"
          : viewClearance < QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE
            ? "view-blocked"
            : "clearance";
        beginQaWalkRecovery(forwardClearance < 2.4 || viewClearance < 2.2 || overheadClearance < QA_SURVIVAL_OVERHEAD_BLOCKED_CLEARANCE);
      }

      if (elapsed < qaWalkInspectUntil.current) {
        mode = "inspect";
        targetYaw = qaWalkInspectYaw.current + Math.sin(elapsed * 1.35) * 0.18;
        forwardAmount = 0;
        strafeAmount = 0;
        sprint = false;
      } else if (
        elapsed < qaWalkRecoveryUntil.current ||
        (
          forwardClearance < QA_SURVIVAL_WALK_BLOCKED_CLEARANCE &&
          (!qaRouteActive || (routeHardBlocked && routeBlockDwelled))
        )
      ) {
        mode = "recover";
        targetYaw = qaWalkRecoveryYaw.current || targetYaw;
        strafeAmount = forwardClearance < QA_SURVIVAL_WALK_BLOCKED_CLEARANCE ? 0 : qaWalkRecoveryStrafe.current;
        const recoveryAge = Math.max(0, elapsed - qaWalkRecoveryStartedAt.current);
        const recoveryDistance = Math.hypot(
          pos.x - qaWalkRecoveryStartPos.current.x,
          pos.z - qaWalkRecoveryStartPos.current.z,
        );
        const yawError = Math.abs(angleDeltaRadians(qaWalkYaw.current ?? currentYaw, targetYaw));
        const darrelRouteAssistPosition = getDarrelDragonRouteAssistPosition();
        const darrelRescuePosition = getDarrelGroveRescuePosition();
        const roadRescuePosition = qaWalkStuckStrikes.current >= 4 ? getBaseVillageRoadRescuePosition() : null;
        if (darrelRouteAssistPosition && elapsed > qaWalkLastUnstickNudgeAt.current + 0.9) {
          const escapeYaw = Math.atan2(
            DARREL_DRAGON_WORLD_POSITION.x - darrelRouteAssistPosition.x,
            -(DARREL_DRAGON_WORLD_POSITION.z - darrelRouteAssistPosition.z),
          );
          rigidBody.current?.setTranslation(darrelRouteAssistPosition, true);
          rigidBody.current?.setLinvel({ x: 0, y: 0, z: 0 }, true);
          camera.position.set(darrelRouteAssistPosition.x, darrelRouteAssistPosition.y + PLAYER_CAMERA_HEIGHT, darrelRouteAssistPosition.z);
          (window as any).localPlayerPos = darrelRouteAssistPosition;
          (window as any).__wofLastPlayerPosition = darrelRouteAssistPosition;
          publishQaPlayerPosition(darrelRouteAssistPosition);
          qaWalkLastUnstickNudgeAt.current = elapsed;
          qaWalkRecoveryStartPos.current.set(darrelRouteAssistPosition.x, darrelRouteAssistPosition.y, darrelRouteAssistPosition.z);
          qaWalkRecoveryStartedAt.current = elapsed;
          qaWalkRecoveryUntil.current = elapsed + 0.18;
          qaWalkRecoveryYaw.current = Number.isFinite(escapeYaw) ? escapeYaw : targetYaw;
          setForwardQaWaypoint(qaWalkRecoveryYaw.current);
          targetYaw = qaWalkRecoveryYaw.current;
          forwardAmount = 0;
          strafeAmount = 0;
          recoveryReason = "darrel-route-assist";
        } else if (darrelRescuePosition && elapsed > qaWalkLastUnstickNudgeAt.current + 0.9) {
          const escapeYaw = Math.atan2(darrelRescuePosition.x - pos.x, -(darrelRescuePosition.z - pos.z));
          rigidBody.current?.setTranslation(darrelRescuePosition, true);
          rigidBody.current?.setLinvel({ x: 0, y: 0, z: 0 }, true);
          camera.position.set(darrelRescuePosition.x, darrelRescuePosition.y + PLAYER_CAMERA_HEIGHT, darrelRescuePosition.z);
          (window as any).localPlayerPos = darrelRescuePosition;
          (window as any).__wofLastPlayerPosition = darrelRescuePosition;
          publishQaPlayerPosition(darrelRescuePosition);
          qaWalkLastUnstickNudgeAt.current = elapsed;
          qaWalkRecoveryStartPos.current.set(darrelRescuePosition.x, darrelRescuePosition.y, darrelRescuePosition.z);
          qaWalkRecoveryStartedAt.current = elapsed;
          qaWalkRecoveryUntil.current = elapsed + QA_SURVIVAL_RECOVERY_MIN_SECONDS;
          qaWalkRecoveryYaw.current = Number.isFinite(escapeYaw) ? escapeYaw : targetYaw;
          setForwardQaWaypoint(qaWalkRecoveryYaw.current);
          targetYaw = qaWalkRecoveryYaw.current;
          forwardAmount = 0;
          strafeAmount = 0;
          recoveryReason = "darrel-grove-rescue";
        } else if (roadRescuePosition && elapsed > qaWalkLastUnstickNudgeAt.current + 1.1) {
          const escapeYaw = Math.atan2(roadRescuePosition.x - pos.x, -(roadRescuePosition.z - pos.z));
          rigidBody.current?.setTranslation(roadRescuePosition, true);
          rigidBody.current?.setLinvel({ x: 0, y: 0, z: 0 }, true);
          camera.position.set(roadRescuePosition.x, roadRescuePosition.y + PLAYER_CAMERA_HEIGHT, roadRescuePosition.z);
          (window as any).localPlayerPos = roadRescuePosition;
          (window as any).__wofLastPlayerPosition = roadRescuePosition;
          publishQaPlayerPosition(roadRescuePosition);
          qaWalkLastUnstickNudgeAt.current = elapsed;
          qaWalkRecoveryStartPos.current.set(roadRescuePosition.x, roadRescuePosition.y, roadRescuePosition.z);
          qaWalkRecoveryStartedAt.current = elapsed;
          qaWalkRecoveryUntil.current = elapsed + QA_SURVIVAL_RECOVERY_MIN_SECONDS;
          qaWalkRecoveryYaw.current = Number.isFinite(escapeYaw) ? escapeYaw : targetYaw;
          setForwardQaWaypoint(qaWalkRecoveryYaw.current);
          targetYaw = qaWalkRecoveryYaw.current;
          forwardAmount = 0;
          strafeAmount = 0;
          recoveryReason = "base-road-rescue";
        } else if (
          qaWalkStuckStrikes.current >= 3 &&
          recoveryAge > QA_SURVIVAL_RECOVERY_NUDGE_SECONDS &&
          recoveryDistance < QA_SURVIVAL_RECOVERY_MIN_ESCAPE_DISTANCE * 0.62 &&
          elapsed > qaWalkLastUnstickNudgeAt.current + 1.1
        ) {
          const escape = findEscapeYaw((qaWalkYaw.current ?? currentYaw) + Math.PI, desiredYaw);
          const nudgeDistance = QA_SURVIVAL_RECOVERY_NUDGE_DISTANCE + Math.min(qaWalkStuckStrikes.current, 6) * 0.8;
          const nudgedPosition = {
            x: pos.x + Math.sin(escape.yaw) * nudgeDistance,
            y: pos.y + 0.18,
            z: pos.z - Math.cos(escape.yaw) * nudgeDistance,
          };
          rigidBody.current?.setTranslation(nudgedPosition, true);
          rigidBody.current?.setLinvel({ x: 0, y: 0, z: 0 }, true);
          camera.position.set(nudgedPosition.x, nudgedPosition.y + PLAYER_CAMERA_HEIGHT, nudgedPosition.z);
          (window as any).localPlayerPos = nudgedPosition;
          (window as any).__wofLastPlayerPosition = nudgedPosition;
          publishQaPlayerPosition(nudgedPosition);
          qaWalkLastUnstickNudgeAt.current = elapsed;
          qaWalkRecoveryStartPos.current.set(nudgedPosition.x, nudgedPosition.y, nudgedPosition.z);
          qaWalkRecoveryStartedAt.current = elapsed;
          qaWalkRecoveryUntil.current = elapsed + QA_SURVIVAL_RECOVERY_MIN_SECONDS;
          qaWalkRecoveryYaw.current = escape.yaw;
          setForwardQaWaypoint(escape.yaw);
          targetYaw = escape.yaw;
          forwardAmount = 0;
          strafeAmount = 0;
          recoveryReason = "unstick-nudge";
        } else if (recoveryAge < QA_SURVIVAL_RECOVERY_REVERSE_SECONDS || forwardClearance < 2.4) {
          forwardAmount = -0.32;
        } else if (
          recoveryDistance < QA_SURVIVAL_RECOVERY_MIN_ESCAPE_DISTANCE &&
          recoveryAge < QA_SURVIVAL_RECOVERY_REVERSE_STUCK_SECONDS
        ) {
          forwardAmount = -0.32;
          strafeAmount = qaWalkRecoveryStrafe.current;
        } else if (
          recoveryAge > QA_SURVIVAL_RECOVERY_CLEAR_EXIT_SECONDS &&
          forwardClearance > QA_SURVIVAL_RECOVERY_CLEAR_EXIT_DISTANCE &&
          recoveryDistance >= QA_SURVIVAL_RECOVERY_MIN_ESCAPE_DISTANCE
        ) {
          const escapeYaw = qaWalkRecoveryYaw.current || targetYaw;
          qaWalkRecoveryUntil.current = elapsed;
          qaWalkStuckStrikes.current = Math.max(0, qaWalkStuckStrikes.current - 1);
          setForwardQaWaypoint(escapeYaw);
          mode = "travel";
          targetYaw = escapeYaw;
          forwardAmount = 0.62;
          strafeAmount = qaWalkRecoveryStrafe.current * 0.22;
          recoveryReason = "clear-exit";
        } else if (forwardClearance < QA_SURVIVAL_WALK_BLOCKED_CLEARANCE * 0.62) {
          forwardAmount = 0;
          strafeAmount = 0;
        } else if (yawError > QA_SURVIVAL_WALK_TURN_IN_PLACE_ERROR) {
          forwardAmount = 0;
          strafeAmount = 0;
        } else {
          forwardAmount = forwardClearance < QA_SURVIVAL_WALK_BLOCKED_CLEARANCE ? 0.22 : 0.56;
        }
        sprint = false;
        if (state.clock.elapsedTime > qaWalkJumpHeldUntil.current + 2.1 && yawError < 0.55 && forwardClearance > 1.6 && forwardClearance < 4.2) {
          qaWalkJumpHeldUntil.current = state.clock.elapsedTime + 0.16;
        }
      } else if (
        !qaRouteActive &&
        (
          forwardClearance < QA_SURVIVAL_WALK_PROBE_DISTANCE * 0.72 ||
          viewClearance < QA_SURVIVAL_VIEW_SOFT_CLEARANCE * 0.72 ||
          overheadClearance < QA_SURVIVAL_OVERHEAD_SOFT_CLEARANCE
        )
      ) {
        mode = "avoid";
        const avoidYawError = Math.abs(angleDeltaRadians(qaWalkYaw.current ?? currentYaw, targetYaw));
        if (avoidYawError > QA_SURVIVAL_WALK_TURN_IN_PLACE_ERROR) {
          forwardAmount = 0;
          strafeAmount = 0;
        } else {
          forwardAmount = viewClearance < QA_SURVIVAL_VIEW_SOFT_CLEARANCE * 0.58 ? 0.18 : 0.38;
          if (overheadClearance < QA_SURVIVAL_OVERHEAD_SOFT_CLEARANCE) {
            forwardAmount = Math.min(forwardAmount, 0.22);
          }
          strafeAmount = THREE.MathUtils.clamp(strafeAmount + Math.sign(Math.sin(elapsed * 1.7 + pos.x * 0.01)) * 0.18, -0.58, 0.58);
        }
        sprint = false;
      }

      if (activeIntent && mode === "travel") {
        const intentMoveTarget = getIntentMoveTarget(activeIntent);
        const intentMoveDistance = Math.hypot(intentMoveTarget.x - pos.x, intentMoveTarget.z - pos.z);
        const intentYaw = Math.atan2(intentMoveTarget.x - pos.x, -(intentMoveTarget.z - pos.z));
        targetYaw = intentYaw + Math.sin(elapsed * 0.76 + activeIntent.x * 0.001) * 0.045;
        const closeEnough = activeIntentDistance <= intentCompletionDistance(activeIntent);
        mode = closeEnough ? "act" : "approach";
        sprint = !closeEnough && activeIntentDistance > 72 && activeIntent.kind !== "quest-target" && activeIntent.kind !== "darrel-dragon";
        if (activeIntent.kind === "spell-dummy") {
          if (qaSpellDummyRunActive) {
            mode = "act";
            forwardAmount = activeIntentDistance < QA_INTENT_DUMMY_CLOSE_DISTANCE ? -0.04 : 0;
            strafeAmount = Math.sin(elapsed * 2.15 + activeIntent.x * 0.01) * 0.04;
            sprint = false;
          } else if (activeIntentDistance < QA_INTENT_DUMMY_CLOSE_DISTANCE) {
            forwardAmount = -0.18;
          } else if (activeIntentDistance > QA_INTENT_DUMMY_KEEP_DISTANCE) {
            forwardAmount = 0.42;
          } else {
            forwardAmount = 0.04;
          }
          if (!qaSpellDummyRunActive) {
            strafeAmount = Math.sin(elapsed * 2.15 + activeIntent.x * 0.01) * 0.24;
          }
        } else if (closeEnough) {
          forwardAmount = activeIntent.kind === "mana-flower" ? 0.08 : 0;
          strafeAmount = Math.sin(elapsed * 1.4 + activeIntent.z * 0.006) * 0.1;
        } else {
          forwardAmount = THREE.MathUtils.clamp(intentMoveDistance / 130, 0.34, 0.72);
          strafeAmount *= 0.35;
        }
        const intentYawError = Math.abs(angleDeltaRadians(qaWalkYaw.current ?? currentYaw, targetYaw));
        const turnBeforeAdvanceThreshold = forwardClearance < QA_SURVIVAL_WALK_SOFT_CLEARANCE
          ? QA_SURVIVAL_WALK_TURN_IN_PLACE_ERROR * 0.74
          : QA_SURVIVAL_WALK_TURN_IN_PLACE_ERROR * 1.45;
        if (!closeEnough && intentYawError > turnBeforeAdvanceThreshold) {
          forwardAmount = 0;
          strafeAmount *= 0.35;
          sprint = false;
        }
        if (
          activeIntent.kind === "darrel-dragon" &&
          activeIntentDistance < QA_DARREL_GROVE_DRAGON_STEP_JUMP_DISTANCE &&
          state.clock.elapsedTime > qaWalkJumpHeldUntil.current + 0.9 &&
          (Math.hypot(velocity.x, velocity.z) < QA_SURVIVAL_LOW_SPEED_THRESHOLD || intentMoveDistance < 34)
        ) {
          qaWalkJumpHeldUntil.current = state.clock.elapsedTime + 0.18;
        }
        if (activeIntent.observeUntil && elapsed < activeIntent.observeUntil) {
          forwardAmount *= 0.34;
          sprint = false;
        }
        if (
          (activeIntent.kind === "quest-target" || activeIntent.kind === "darrel-dragon") &&
          activeIntentDistance <= intentCompletionDistance(activeIntent) &&
          elapsed - qaWalkLastInteractionAt.current > QA_INTENT_INTERACT_COOLDOWN_SECONDS
        ) {
          const detail = { source: "qa-walk", handled: false };
          window.dispatchEvent(new CustomEvent("quest-villager-interact", { detail }));
          qaWalkLastInteractionAt.current = elapsed;
          if (typeof document !== "undefined") {
            document.documentElement.dataset.wofQaWalkAction = detail.handled
              ? `interact:${activeIntent.kind}:${activeIntent.id}`
              : `observe:${activeIntent.kind}:${activeIntent.id}`;
          }
        }
        if (
          activeIntent.kind === "mana-flower" &&
          typeof document !== "undefined" &&
          document.documentElement.dataset.wofManaFlowerLastCollect === activeIntent.id
        ) {
          document.documentElement.dataset.wofQaWalkAction = `collect:${activeIntent.id}`;
          qaWalkIntent.current = null;
          qaWalkNextIntentAt.current = elapsed + 0.8;
        }
      }

      const scheduleNextCombatCast = (minimumSeconds = QA_SURVIVAL_COMBAT_CAST_MIN_INTERVAL) => {
        const minInterval = qaSpellDummyRunActive
          ? Math.min(minimumSeconds, QA_SPELL_DUMMY_COMBAT_CAST_MIN_INTERVAL)
          : minimumSeconds;
        const maxInterval = qaSpellDummyRunActive
          ? QA_SPELL_DUMMY_COMBAT_CAST_MAX_INTERVAL
          : QA_SURVIVAL_COMBAT_CAST_MAX_INTERVAL;
        qaWalkNextCombatCastAt.current = elapsed + randomRangeFromNoise(
          survivalishTurnNoise(pos.x + 211, pos.z - 173, elapsed + qaWalkCombatSpellIndex.current),
          minInterval,
          maxInterval,
        );
      };

      const scheduleNextPracticeCast = (minimumSeconds = QA_SURVIVAL_PRACTICE_CAST_MIN_INTERVAL) => {
        qaWalkNextPracticeCastAt.current = elapsed + randomRangeFromNoise(
          survivalishTurnNoise(pos.x - 419, pos.z + 283, elapsed + qaWalkPracticeSpellIndex.current),
          minimumSeconds,
          QA_SURVIVAL_PRACTICE_CAST_MAX_INTERVAL,
        );
      };

      const castQaPracticeSpell = (spell: SpellType) => {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        if (dir.lengthSq() < 0.001) dir.set(0, 0, -1);
        dir.normalize();

        const hand: HandType = qaWalkPracticeSpellIndex.current % 2 === 0 ? "right" : "left";
        const lateral = new THREE.Vector3().crossVectors(camera.up, dir).normalize();
        const handOffset = hand === "right" ? -1.15 : 1.15;
        const camPos = camera.position.clone();
        const spawnPos = {
          x: camPos.x + dir.x * SPELL_SPAWN_FORWARD_OFFSET + lateral.x * handOffset,
          y: camPos.y + SPELL_SPAWN_VERTICAL_OFFSET + dir.y * SPELL_SPAWN_FORWARD_OFFSET,
          z: camPos.z + dir.z * SPELL_SPAWN_FORWARD_OFFSET + lateral.z * handOffset,
        };
        const flatDir = new THREE.Vector3(dir.x, 0, dir.z);
        if (flatDir.lengthSq() < 0.001) flatDir.set(0, 0, -1);
        flatDir.normalize();
        const castAtTarget = spell === "lightning";
        const projectilePos = castAtTarget
          ? {
            x: pos.x + flatDir.x * 26,
            y: pos.y - PLAYER_FOOT_OFFSET + 0.2,
            z: pos.z + flatDir.z * 26,
          }
          : spawnPos;
        const projectile = {
          id: `qa-walk-practice-${spell}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          creatorId: socket.id || "local",
          type: spell,
          pos: projectilePos,
          dir: { x: dir.x, y: dir.y, z: dir.z },
          createdAt: Date.now(),
          hand,
        };

        const store = useGameStore.getState();
        store.setHandCharging(hand, true);
        window.setTimeout(() => {
          useGameStore.getState().setHandCharging(hand, false);
        }, spell === "arcanebeam" ? 420 : 220);
        socket.emit("castSpell", projectile);
        store.addProjectile(projectile as any);
        if (typeof document !== "undefined") {
          document.documentElement.dataset.wofQaWalkPracticeCast = spell;
        }
      };

      if (qaWalkNextCombatCastAt.current <= 0) {
        scheduleNextCombatCast(QA_SURVIVAL_COMBAT_CAST_MIN_INTERVAL * 0.55);
      }
      if (qaWalkNextPracticeCastAt.current <= 0) {
        scheduleNextPracticeCast(QA_SURVIVAL_PRACTICE_CAST_MIN_INTERVAL * 0.45);
      }

      const spellDummies = getQaSpellDummies();
      const nearestSpellDummy = spellDummies
        .map((dummy) => ({
          dummy,
          distance: Math.hypot(dummy.position.x - pos.x, dummy.position.z - pos.z),
        }))
        .filter((entry) => entry.distance <= QA_SURVIVAL_COMBAT_TARGET_RANGE)
        .sort((a, b) => a.distance - b.distance)[0];
      const activeSpellDummyTarget = activeIntent?.kind === "spell-dummy"
        ? spellDummies
          .map((dummy) => ({
            dummy,
            distance: Math.hypot(dummy.position.x - pos.x, dummy.position.z - pos.z),
          }))
          .find((entry) => entry.dummy.id === activeIntent.id)
        : null;
      const combatSpellDummy = activeSpellDummyTarget && activeSpellDummyTarget.distance <= QA_SURVIVAL_COMBAT_TARGET_RANGE * 1.35
        ? activeSpellDummyTarget
        : nearestSpellDummy;
      const nearestAnySpellDummy = spellDummies
        .map((dummy) => ({
          dummy,
          distance: Math.hypot(dummy.position.x - pos.x, dummy.position.z - pos.z),
        }))
        .sort((a, b) => a.distance - b.distance)[0];
      const qaSpellDummyHits = typeof document !== "undefined"
        ? Number(document.documentElement.dataset.wofSpellDummyHits || 0)
        : 0;
      const activeDummyTooFar = qaSpellDummyRunActive &&
        activeIntent?.kind === "spell-dummy" &&
        activeIntentDistance > QA_DUMMY_REANCHOR_DISTANCE;

      if (
        qaSpellDummyRunActive &&
        nearestAnySpellDummy &&
        (qaSpellDummyHits <= 0 || nearestAnySpellDummy.distance > QA_DUMMY_REANCHOR_DISTANCE || activeDummyTooFar) &&
        (
          nearestAnySpellDummy.distance > QA_DUMMY_REANCHOR_DISTANCE ||
          activeDummyTooFar ||
          ((mode === "recover" || mode === "avoid") && nearestAnySpellDummy.distance > QA_DUMMY_REANCHOR_DISTANCE)
        ) &&
        elapsed - qaWalkLastDummyReanchorAt.current > QA_DUMMY_REANCHOR_COOLDOWN_SECONDS
      ) {
        const yawForSpawn = mode === "recover" && qaWalkRecoveryYaw.current
          ? qaWalkRecoveryYaw.current
          : qaWalkYaw.current ?? currentYaw;
        const spawnForwardX = Math.sin(yawForSpawn);
        const spawnForwardZ = -Math.cos(yawForSpawn);
        const spawnOffset = mode === "recover" || mode === "avoid" ? 14 : 8;
        window.dispatchEvent(new CustomEvent("wof-spawn-spell-dummies", {
          detail: {
            x: pos.x + spawnForwardX * spawnOffset,
            y: pos.y + 0.2,
            z: pos.z + spawnForwardZ * spawnOffset,
            yaw: yawForSpawn,
            preserveHealth: qaSpellDummyHits > 0,
          },
        }));
        qaWalkLastDummyReanchorAt.current = elapsed;
        qaWalkIntent.current = null;
        qaWalkNextIntentAt.current = 0;
        qaWalkNextCombatCastAt.current = Math.min(qaWalkNextCombatCastAt.current || Infinity, elapsed + 0.6);
        qaWalkStuckStrikes.current = 0;
        if (typeof document !== "undefined") {
          document.documentElement.dataset.wofQaWalkAction = `dummy-reanchor:${Math.round(nearestAnySpellDummy.distance)}`;
        }
      }

      if (
        combatSpellDummy &&
        (mode === "travel" || mode === "approach" || mode === "act") &&
        elapsed >= qaWalkNextCombatCastAt.current &&
        elapsed - qaWalkLastCombatCastAt.current > 1.2
      ) {
        const aimYaw = Math.atan2(combatSpellDummy.dummy.position.x - pos.x, -(combatSpellDummy.dummy.position.z - pos.z));
        const spell = QA_SURVIVAL_COMBAT_SPELL_SEQUENCE[qaWalkCombatSpellIndex.current % QA_SURVIVAL_COMBAT_SPELL_SEQUENCE.length];
        qaWalkCombatSpellIndex.current += 1;
        qaWalkLastCombatCastAt.current = elapsed;
        qaWalkCombatFocusUntil.current = elapsed + QA_SURVIVAL_COMBAT_FOCUS_SECONDS;
        qaWalkCombatTargetYaw.current = aimYaw;
        window.dispatchEvent(new CustomEvent("wof-qa-cast-spell-at-dummy", {
          detail: { spell, targetId: combatSpellDummy.dummy.id },
        }));
        if (typeof document !== "undefined") {
          document.documentElement.dataset.wofQaWalkAction = `cast:${spell}:${combatSpellDummy.dummy.id}`;
        }
        scheduleNextCombatCast();
      }

      if (qaSpellDummyRunActive && activeIntent?.kind === "spell-dummy" && rigidBody.current) {
        const currentLinvel = rigidBody.current.linvel();
        const horizontalSpeed = Math.hypot(currentLinvel.x, currentLinvel.z);
        if (horizontalSpeed > 0.35) {
          rigidBody.current.setLinvel({ x: 0, y: currentLinvel.y, z: 0 }, true);
        }
      }

      if (
        !combatSpellDummy &&
        (!activeIntent || activeIntent.kind === "landmark") &&
        mode === "travel" &&
        elapsed >= qaWalkNextPracticeCastAt.current &&
        forwardClearance > QA_SURVIVAL_WALK_BLOCKED_CLEARANCE &&
        viewClearance > QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE
      ) {
        const spell = QA_SURVIVAL_PRACTICE_SPELL_SEQUENCE[qaWalkPracticeSpellIndex.current % QA_SURVIVAL_PRACTICE_SPELL_SEQUENCE.length];
        qaWalkPracticeSpellIndex.current += 1;
        castQaPracticeSpell(spell);
        qaWalkCombatFocusUntil.current = elapsed + QA_SURVIVAL_COMBAT_FOCUS_SECONDS * 0.72;
        qaWalkCombatTargetYaw.current = qaWalkYaw.current ?? currentYaw;
        scheduleNextPracticeCast();
      }

      if (combatSpellDummy && (mode === "travel" || mode === "approach" || mode === "act") && elapsed < qaWalkCombatFocusUntil.current) {
        mode = activeIntent?.kind === "spell-dummy" ? "act" : "inspect";
        targetYaw = qaWalkCombatTargetYaw.current + Math.sin(elapsed * 2.4) * 0.05;
        forwardAmount = qaSpellDummyRunActive ? 0 : 0.06;
        strafeAmount = Math.sin(elapsed * 3.1) * (qaSpellDummyRunActive ? 0.035 : 0.1);
        sprint = false;
      } else if (mode === "route") {
        if (
          forwardClearance < QA_SURVIVAL_WALK_BLOCKED_CLEARANCE ||
          viewClearance < QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE ||
          overheadClearance < QA_SURVIVAL_OVERHEAD_BLOCKED_CLEARANCE
        ) {
          forwardAmount = Math.min(forwardAmount, 0.22);
          sprint = false;
        } else if (
          forwardClearance < QA_SURVIVAL_WALK_SOFT_CLEARANCE ||
          forwardLookAhead < QA_SURVIVAL_WALK_SOFT_LOOKAHEAD
        ) {
          forwardAmount = Math.min(forwardAmount, 0.72);
          sprint = false;
        }
      } else if (mode === "travel") {
        const clearanceEase = THREE.MathUtils.clamp(
          (forwardClearance - QA_SURVIVAL_WALK_BLOCKED_CLEARANCE) / Math.max(1, QA_SURVIVAL_WALK_SOFT_CLEARANCE - QA_SURVIVAL_WALK_BLOCKED_CLEARANCE),
          0.32,
          1,
        );
        const lookAheadEase = THREE.MathUtils.clamp(
          (forwardLookAhead - QA_SURVIVAL_WALK_SOFT_LOOKAHEAD) / Math.max(1, QA_SURVIVAL_WALK_LOOKAHEAD_DISTANCE - QA_SURVIVAL_WALK_SOFT_LOOKAHEAD),
          0.38,
          1,
        );
        const humanThrottle = Math.min(clearanceEase, lookAheadEase);
        forwardAmount *= humanThrottle;
        if (humanThrottle < 0.72) sprint = false;
      }

      const planarSpeed = Math.hypot(velocity.x, velocity.z);
      const expectingMovement = mode !== "inspect" && forwardAmount > 0.18;
      if (!lilyCoilTubeQaActive && expectingMovement && planarSpeed < QA_SURVIVAL_LOW_SPEED_THRESHOLD) {
        if (qaWalkLowSpeedStartedAt.current <= 0) {
          qaWalkLowSpeedStartedAt.current = elapsed;
        } else if (elapsed - qaWalkLowSpeedStartedAt.current > QA_SURVIVAL_LOW_SPEED_TRIGGER_SECONDS) {
          qaWalkStuckStrikes.current = Math.min(qaWalkStuckStrikes.current + 1, 6);
          mode = "recover";
          recoveryReason = "low-speed";
          beginQaWalkRecovery(true);
          targetYaw = qaWalkRecoveryYaw.current;
          strafeAmount = 0;
          forwardAmount = -0.24;
          sprint = false;
          qaWalkLowSpeedStartedAt.current = elapsed;
        }
      } else {
        qaWalkLowSpeedStartedAt.current = 0;
      }

      if (!lilyCoilTubeQaActive && mode !== "inspect" && mode !== "act" && elapsed - qaWalkLastProgressAt.current > QA_SURVIVAL_STUCK_CHECK_SECONDS) {
        const progressDistance = Math.hypot(
          pos.x - qaWalkLastProgressPos.current.x,
          pos.z - qaWalkLastProgressPos.current.z,
        );
        const previousWaypointDistance = Math.hypot(
          qaWalkWaypoint.current.x - qaWalkLastProgressPos.current.x,
          qaWalkWaypoint.current.z - qaWalkLastProgressPos.current.z,
        );
        const towardProgress = previousWaypointDistance - waypointDistance;
        const clearLane = forwardClearance > QA_SURVIVAL_WALK_PROBE_DISTANCE * 0.88;
        const movingClearly = planarSpeed > QA_SURVIVAL_LOW_SPEED_THRESHOLD * 1.35;
        if (
          progressDistance < QA_SURVIVAL_WALK_MIN_PROGRESS ||
          (!clearLane && towardProgress < QA_SURVIVAL_WALK_MIN_TOWARD_PROGRESS)
        ) {
          qaWalkStuckStrikes.current = Math.min(qaWalkStuckStrikes.current + 1, 6);
          mode = "recover";
          recoveryReason = progressDistance < QA_SURVIVAL_WALK_MIN_PROGRESS ? "progress" : "blocked-progress";
          beginQaWalkRecovery(true);
          targetYaw = qaWalkRecoveryYaw.current;
          strafeAmount = 0;
          forwardAmount = qaWalkStuckStrikes.current > 1 ? -0.24 : 0;
          sprint = false;
        } else if (!qaRouteActive && clearLane && movingClearly && towardProgress < -QA_SURVIVAL_WALK_MIN_TOWARD_PROGRESS) {
          setForwardQaWaypoint(qaWalkYaw.current ?? currentYaw);
        } else if (progressDistance > QA_SURVIVAL_WALK_MIN_PROGRESS * 1.55) {
          qaWalkStuckStrikes.current = 0;
        }
        qaWalkLastProgressAt.current = elapsed;
        qaWalkLastProgressPos.current.set(pos.x, pos.y, pos.z);
      }

      const turnRate = mode === "recover"
        ? QA_SURVIVAL_RECOVERY_TURN_RATE
        : mode === "inspect"
          ? QA_SURVIVAL_LOOK_TURN_RATE * 0.72
          : QA_SURVIVAL_LOOK_TURN_RATE;
      const yaw = moveAngleTowardsRadians(qaWalkYaw.current, targetYaw, turnRate * delta);
      qaWalkYaw.current = yaw;
      const pitch = mode === "inspect"
        ? -0.02 + Math.sin(elapsed * 1.18) * 0.1
        : -0.045 + Math.sin(elapsed * 0.62) * 0.032;
      const cameraYaw = lilyCoilTubeQaActive ? yaw : -yaw;
      controllerLookEuler.current.set(pitch, cameraYaw, 0);
      camera.quaternion.setFromEuler(controllerLookEuler.current);

      const inputMode: QaSurvivalWalkMode = lilyCoilTubeQaActive ? "tube" : mode;
      qaWalkInputState.current = {
        forward: THREE.MathUtils.clamp(forwardAmount, inputMode === "tube" ? -1 : -0.28, 1),
        strafe: THREE.MathUtils.clamp(strafeAmount, -0.72, 0.72),
        sprint,
        mode: inputMode,
      };
      const movingInOpenLane = !lilyCoilTubeQaActive &&
        planarSpeed > QA_SURVIVAL_LOW_SPEED_THRESHOLD * 2.2 &&
        forwardClearance > QA_SURVIVAL_WALK_SOFT_CLEARANCE &&
        forwardLookAhead > QA_SURVIVAL_WALK_SOFT_LOOKAHEAD &&
        viewClearance > QA_SURVIVAL_VIEW_SOFT_CLEARANCE * 0.82;
      if (movingInOpenLane && qaWalkStuckStrikes.current > 0) {
        qaWalkStuckStrikes.current = Math.max(0, qaWalkStuckStrikes.current - 2);
        if (mode === "recover") {
          qaWalkRecoveryUntil.current = Math.min(qaWalkRecoveryUntil.current, elapsed + 0.18);
        }
      }
      if (typeof document !== "undefined") {
        const telemetryDt = qaWalkLastTelemetryAt.current > 0 ? elapsed - qaWalkLastTelemetryAt.current : 0;
        const telemetryMove = telemetryDt > 0
          ? Math.hypot(
            pos.x - qaWalkLastTelemetryPos.current.x,
            pos.y - qaWalkLastTelemetryPos.current.y,
            pos.z - qaWalkLastTelemetryPos.current.z,
          )
          : 0;
        const positionJumpAbnormality = telemetryDt > 0 &&
          telemetryMove > Math.max(36, planarSpeed * Math.max(telemetryDt, 0.016) * 3 + 18);
        qaWalkLastTelemetryAt.current = elapsed;
        qaWalkLastTelemetryPos.current.set(pos.x, pos.y, pos.z);
        const activeRouteWaypoint = qaRouteActive
          ? qaRouteWaypoints[qaWalkRouteIndex.current % qaRouteWaypoints.length]
          : null;
        const intentLabel = activeIntent
          ? `${activeIntent.kind}:${activeIntent.id}:${Math.round(activeIntentDistance)}`
          : activeRouteWaypoint
            ? `route:${activeRouteWaypoint.id}:${Math.round(waypointDistance)}`
            : "roam";
        const recoveryAbnormality = recoveryReason && !["clear-exit", "progress"].includes(recoveryReason) && qaWalkStuckStrikes.current >= 2
          ? `recovery:${recoveryReason}`
          : "";
        const abnormality = recoveryAbnormality
          ? recoveryAbnormality
          : positionJumpAbnormality
            ? `position-jump:${Math.round(telemetryMove)}`
            : qaWalkStuckStrikes.current >= 3 && !movingInOpenLane
            ? "stuck-strikes"
              : overheadClearance < QA_SURVIVAL_OVERHEAD_BLOCKED_CLEARANCE
                ? "low-overhead"
                : !lilyCoilTubeQaActive && expectingMovement && planarSpeed < QA_SURVIVAL_LOW_SPEED_THRESHOLD * 0.65
                  ? "slow-input"
                  : forwardClearance < QA_SURVIVAL_WALK_BLOCKED_CLEARANCE
                    ? "low-clearance"
                    : viewClearance < QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE
                      ? "low-view"
                      : "";
        document.documentElement.dataset.wofQaWalkMode = inputMode;
        document.documentElement.dataset.wofQaWalkForward = qaWalkInputState.current.forward.toFixed(2);
        document.documentElement.dataset.wofQaWalkStrafe = qaWalkInputState.current.strafe.toFixed(2);
        document.documentElement.dataset.wofQaWalkSprint = sprint ? "1" : "0";
        document.documentElement.dataset.wofQaWalkClearance = forwardClearance.toFixed(1);
        document.documentElement.dataset.wofQaWalkViewClearance = viewClearance.toFixed(1);
        document.documentElement.dataset.wofQaWalkOverheadClearance = overheadClearance.toFixed(1);
        document.documentElement.dataset.wofQaWalkSpeed = planarSpeed.toFixed(2);
        document.documentElement.dataset.wofQaWalkYawError = Math.abs(angleDeltaRadians(yaw, targetYaw)).toFixed(2);
        document.documentElement.dataset.wofQaWalkStuckStrikes = String(qaWalkStuckStrikes.current);
        document.documentElement.dataset.wofQaWalkWaypoint = `${Math.round(qaWalkWaypoint.current.x)},${Math.round(qaWalkWaypoint.current.z)}`;
        document.documentElement.dataset.wofQaWalkPosition = `${pos.x.toFixed(1)},${pos.y.toFixed(1)},${pos.z.toFixed(1)}`;
        document.documentElement.dataset.wofQaWalkLocalPosition = `${(pos.x - chunkCenterX).toFixed(1)},${(pos.y).toFixed(1)},${(pos.z - chunkCenterZ).toFixed(1)}`;
        document.documentElement.dataset.wofQaWalkRecoveryReason = recoveryReason;
        document.documentElement.dataset.wofQaWalkCombat = elapsed < qaWalkCombatFocusUntil.current ? "1" : "0";
        document.documentElement.dataset.wofQaWalkIntent = intentLabel;
        if (activeRouteWaypoint) {
          document.documentElement.dataset.wofQaWalkRoute = activeRouteWaypoint.id;
          document.documentElement.dataset.wofQaWalkRouteIndex = String(qaWalkRouteIndex.current % qaRouteWaypoints.length);
        } else {
          delete document.documentElement.dataset.wofQaWalkRoute;
          delete document.documentElement.dataset.wofQaWalkRouteIndex;
        }
        document.documentElement.dataset.wofQaWalkTargetDistance = Number.isFinite(activeIntentDistance)
          ? activeIntentDistance.toFixed(1)
          : waypointDistance.toFixed(1);
        document.documentElement.dataset.wofQaWalkObserved = [
          `mana:${getReadyQaManaFlowers().length}`,
          `dummies:${spellDummies.length}`,
          `quests:${getQuestNavigationIntentTargets().length}`,
        ].join("|");
        document.documentElement.dataset.wofQaWalkAbnormality = abnormality;
        if (lilyCoilTubeTravelState) {
          document.documentElement.dataset.wofQaWalkLilyT = lilyCoilTubeTravelState.t.toFixed(3);
          document.documentElement.dataset.wofQaWalkLilyDirection = qaWalkLilyTubeDirection.current >= 0 ? "1" : "-1";
        } else {
          delete document.documentElement.dataset.wofQaWalkLilyT;
          delete document.documentElement.dataset.wofQaWalkLilyDirection;
        }
      }
    } else if (!qaWalkActive) {
      qaWalkStartTime.current = null;
      qaWalkYaw.current = null;
      qaWalkInputState.current = { forward: 0, strafe: 0, sprint: false, mode: "travel" };
      qaWalkJumpHeldUntil.current = 0;
      qaWalkCombatFocusUntil.current = 0;
      qaWalkNextCombatCastAt.current = 0;
      qaWalkNextPracticeCastAt.current = 0;
      qaWalkIntent.current = null;
      qaWalkNextIntentAt.current = 0;
      qaWalkRouteIndex.current = 0;
      qaWalkRouteSmoothedYaw.current = null;
      qaWalkRouteTargetId.current = null;
      qaWalkLastTelemetryAt.current = 0;
      qaWalkLastDummyReanchorAt.current = 0;
      resetQaWalkRecovery();
      if (typeof document !== "undefined") {
        delete document.documentElement.dataset.wofQaWalkRoute;
        delete document.documentElement.dataset.wofQaWalkRouteIndex;
      }
    }

    if (storeState.isSpellMenuOpen || storeState.questDialogSession || storeState.isInventoryOpen) {
      if (isCrouching) setIsCrouching(false);
      crouchHoldStartedAt.current = null;
      rigidBody.current.setLinvel({ x: 0, y: vclipActive ? 0 : velocity.y, z: 0 }, true);
      window.dispatchEvent(new CustomEvent('player-state', {
        detail: { isMoving: false, isSprinting: false, isSliding: false, isCrouching: false, isGrounded: true, isMeditating: false }
      }));
      return;
    }

    const chargingHands = storeState.chargingHands;

    (["left", "right"] as HandType[]).forEach((hand) => {
      const handSpell = hand === 'right' ? storeState.rightCurrentSpell : storeState.leftCurrentSpell;
      const handOffset = hand === 'right' ? -1.15 : 1.15;
      const runePower = hand === 'right' ? storeState.rightRunePower : storeState.leftRunePower;
      const runeReady = hasRunePower(runePower);

      if (!storeState.isMagicArmed) {
        if (chargingHands[hand] || activeCastingHands.current[hand]) {
          activeCastingHands.current[hand] = false;
          useGameStore.getState().setHandCharging(hand, false);
        }
        flamethrowerTimers.current[hand] = 0;
        return;
      }

      if (!runeReady) {
        if (chargingHands[hand]) {
          activeCastingHands.current[hand] = false;
          useGameStore.getState().setHandCharging(hand, false);
        }
        flamethrowerTimers.current[hand] = 0;
        return;
      }

      if (handSpell === 'healspell' && chargingHands[hand]) {
        clearToxicEffectsWithNetwork();
        health = Math.min(100, health + (2 * delta));
        useGameStore.getState().setHealth(health);
      }

      if (handSpell === 'flamethrower' && chargingHands[hand] && gameplayInputActive) {
        flamethrowerTimers.current[hand] += delta;
        if (flamethrowerTimers.current[hand] <= 0.05) return;

        flamethrowerTimers.current[hand] = 0;
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const left = new THREE.Vector3().crossVectors(camera.up, dir).normalize();
        
        dir.x += (Math.random() - 0.5) * 0.15;
        dir.y += (Math.random() - 0.5) * 0.15;
        dir.z += (Math.random() - 0.5) * 0.15;
        dir.normalize();

        const camPos = camera.position.clone();
        const spawnPos = { 
          x: camPos.x + dir.x * SPELL_SPAWN_FORWARD_OFFSET + left.x * handOffset, 
          y: camPos.y + SPELL_SPAWN_VERTICAL_OFFSET + dir.y * SPELL_SPAWN_FORWARD_OFFSET, 
          z: camPos.z + dir.z * SPELL_SPAWN_FORWARD_OFFSET + left.z * handOffset 
        };

        const projectile = {
          id: Math.random().toString(36).substring(7),
          creatorId: socket.id || "local",
          type: 'flamethrower',
          pos: spawnPos,
          dir: { x: dir.x, y: dir.y, z: dir.z },
          createdAt: Date.now(),
          hand
        };
        
        socket.emit("castSpell", projectile);
        useGameStore.getState().addProjectile(projectile as any);
      }
    });

    // Calculate robust yaw angle
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    const yaw = Math.atan2(fwd.x, -fwd.z);
    (window as any).__wofLastPlayerYaw = yaw;

    if (sleepActive) {
      if (isSliding) setIsSliding(false);
      if (isCrouching) setIsCrouching(false);
      crouchHoldStartedAt.current = null;
      (["left", "right"] as HandType[]).forEach((hand) => {
        if (activeCastingHands.current[hand] || storeState.chargingHands[hand]) {
          activeCastingHands.current[hand] = false;
          useGameStore.getState().setHandCharging(hand, false);
        }
        flamethrowerTimers.current[hand] = 0;
      });
    }

    // Movement calculation
    const controllerMoveX = controllerInputActive ? getGamepadAxis(gamepad, 0) : 0;
    const controllerMoveZ = controllerInputActive ? getGamepadAxis(gamepad, 1) : 0;
    const touchMoveX = storeState.isTouchControlsActive ? touchMove.current.x : 0;
    const touchMoveZ = storeState.isTouchControlsActive ? touchMove.current.y : 0;
    const qaWalkForwardInput = qaWalkActive ? qaWalkInputState.current.forward : 0;
    const qaWalkStrafeInput = qaWalkActive ? qaWalkInputState.current.strafe : 0;
    const qaWalkSprintHeld = qaWalkActive && qaWalkInputState.current.sprint;
    const controllerSlideHeld = controllerInputActive && isGamepadButtonPressed(gamepad, storeState.controllerBindings.slide as GamepadButtonName);
    const keyboardJumpHeld = keys.Space;
    const keyboardJumpPressed = keyboardJumpHeld && !keyboardJumpWasPressed.current;
    keyboardJumpWasPressed.current = keyboardJumpHeld;
    const controllerJumpHeld = controllerInputActive && isGamepadButtonPressed(gamepad, storeState.controllerBindings.jump as GamepadButtonName);
    const controllerJumpPressed = controllerJumpHeld && !controllerJumpWasPressed.current;
    controllerJumpWasPressed.current = controllerJumpHeld;
    const controllerSprintHeld = controllerInputActive && isGamepadButtonPressed(gamepad, storeState.controllerBindings.sprint as GamepadButtonName);
    const controllerSprintPressed = controllerSprintHeld && !controllerSprintWasPressed.current;
    controllerSprintWasPressed.current = controllerSprintHeld;
    const touchSlideHeld = storeState.isTouchControlsActive && touchButtons.current.slide;
    const touchJumpHeld = storeState.isTouchControlsActive && touchButtons.current.jump;
    const touchJumpPressed = touchJumpHeld && !touchJumpWasPressed.current;
    touchJumpWasPressed.current = touchJumpHeld;
    const qaJumpHeld = qaWalkActive && state.clock.elapsedTime < qaWalkJumpHeldUntil.current;
    const qaJumpPressed = qaJumpHeld && !qaWalkJumpWasPressed.current;
    qaWalkJumpWasPressed.current = qaJumpHeld;
    const touchSprintHeld = storeState.isTouchControlsActive && touchButtons.current.sprint;
    const touchSprintPressed = touchSprintHeld && !touchSprintWasPressed.current;
    touchSprintWasPressed.current = touchSprintHeld;
    const jumpHeld = keyboardJumpHeld || controllerJumpHeld || touchJumpHeld || qaJumpHeld;
    const jumpRequested = keyboardJumpPressed || controllerJumpPressed || touchJumpPressed || qaJumpPressed;
    const descendHeld = keys.KeyC || controllerSlideHeld || touchSlideHeld;
    const crouchInputHeld = !vclipActive && !sleepActive && (keys.KeyC || controllerSlideHeld);
    const verticalInput = vclipActive ? (jumpHeld ? 1 : 0) - (descendHeld ? 1 : 0) : 0;
    const forwardInput = THREE.MathUtils.clamp((keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) - controllerMoveZ - touchMoveZ + qaWalkForwardInput, -1, 1);
    const ladderActive = !vclipActive && !sleepActive && activeLadderZones.current.size > 0;
    const ladderVerticalInput = ladderActive
      ? THREE.MathUtils.clamp(forwardInput + (jumpHeld ? 1 : 0) - (descendHeld ? 1 : 0), -1, 1)
      : 0;

    frontVector.set(0, 0, (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0) + controllerMoveZ + touchMoveZ - qaWalkForwardInput);
    sideVector.set((keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0) - controllerMoveX - touchMoveX - qaWalkStrafeInput, 0, 0);
    direction.subVectors(frontVector, sideVector);
    const hasPlanarMovementInput = direction.lengthSq() > 0;
    const hasMovementInput = !sleepActive && (hasPlanarMovementInput || verticalInput !== 0 || ladderVerticalInput !== 0);
    if (!hasMovementInput) {
      controllerSprintLatched.current = false;
      touchSprintLatched.current = false;
    } else if (controllerSprintPressed) {
      controllerSprintLatched.current = true;
    } else if (touchSprintPressed) {
      touchSprintLatched.current = true;
    }

    const speedBoostActive = storeState.speedBoostUntil > nowMs;
    const jumpBoostActive = storeState.jumpBoostUntil > nowMs;
    const isSprinting = hasMovementInput && (keys.ShiftLeft || controllerSprintLatched.current || touchSprintLatched.current || qaWalkSprintHeld) && !isSliding && !isCrouching;
    const slideInputHeld = !vclipActive && descendHeld && !isCrouching;
    const slideHeld = slideInputHeld && (isSliding || isSprinting || hasPlanarMovementInput);

    const boostedSpeed = SPEED * (speedBoostActive ? SPEED_BOOST_MULTIPLIER : 1) * (slowActive ? TUNGSTON_SLOW_MULTIPLIER : 1);
    const slideSpeed = SLIDE_SPEED * (slowActive ? TUNGSTON_SLOW_MULTIPLIER : 1);
    const sprintMultiplier = vclipActive ? VCLIP_SPRINT_MULTIPLIER : 1.6;
    const currentSpeed = sleepActive
      ? 0
      : isSliding
        ? slideSpeed
        : isCrouching
          ? boostedSpeed * CROUCH_SPEED_MULTIPLIER
          : (isSprinting ? boostedSpeed * sprintMultiplier : boostedSpeed);

    const playerPosition = new THREE.Vector3(pos.x, pos.y, pos.z);
    const lilyCoilTubeActive =
      !vclipActive &&
      !sleepActive &&
      !astralActive &&
      !grabbedState.current &&
      isInLilyCoilTubeChunk(playerPosition, storeState.gameMode);

    if (lilyCoilTubeActive) {
      const tubeState = lilyCoilTubeState.current;
      const shouldAlignTubeView = !tubeState.active;
      if (shouldAlignTubeView) {
        const nearest = getNearestLilyCoilTubeState(playerPosition);
        tubeState.t = nearest.t;
        tubeState.surfaceAngle = nearest.surfaceAngle;
        tubeState.jumpOffset = 0;
        tubeState.jumpVelocity = 0;
        tubeState.active = true;
      }

      let tubeSliding = isSliding;
      const tubeSlideHeld = slideInputHeld && hasPlanarMovementInput;
      const tubeGroundedBeforeMove = tubeState.jumpOffset <= 0.025 && tubeState.jumpVelocity <= 0;
      if (tubeGroundedBeforeMove && tubeSlideHeld && !tubeSliding) {
        if (Date.now() - lastSlideTime.current >= SLIDE_RESTART_COOLDOWN_MS) {
          tubeSliding = true;
          setIsSliding(true);
          slideTimer.current = 1.0;
          lastSlideTime.current = Date.now();
        }
      }
      if (tubeSliding) {
        slideTimer.current -= delta;
        if (slideTimer.current <= 0 || !tubeSlideHeld) {
          tubeSliding = false;
          setIsSliding(false);
        }
      }

      const tubeMoveSpeed = (tubeSliding ? slideSpeed : currentSpeed) * 4.8;
      const tubeStrafeInput = THREE.MathUtils.clamp(
        (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + controllerMoveX + touchMoveX + qaWalkStrafeInput,
        -1,
        1,
      );
      const qaTubeAutoPilot = qaWalkActive && qaWalkInputState.current.mode === "tube";
      const currentFrame = getLilyCoilTubeFrame(tubeState.t);
      const currentRadial = currentFrame.up.clone()
        .multiplyScalar(Math.cos(tubeState.surfaceAngle))
        .addScaledVector(currentFrame.side, Math.sin(tubeState.surfaceAngle))
        .normalize();
      const currentPlayerUp = currentRadial.clone().multiplyScalar(-1);
      const currentAroundSurface = currentFrame.up.clone()
        .multiplyScalar(-Math.sin(tubeState.surfaceAngle))
        .addScaledVector(currentFrame.side, Math.cos(tubeState.surfaceAngle))
        .normalize();
      const cameraForward = new THREE.Vector3();
      camera.getWorldDirection(cameraForward);
      const cameraRight = new THREE.Vector3().crossVectors(cameraForward, currentPlayerUp);
      if (cameraRight.lengthSq() < 0.0001) cameraRight.copy(currentAroundSurface);
      cameraRight.normalize();
      const surfaceForward = cameraForward
        .clone()
        .addScaledVector(currentPlayerUp, -cameraForward.dot(currentPlayerUp));
      if (surfaceForward.lengthSq() < 0.0001) surfaceForward.copy(currentFrame.tangent);
      surfaceForward.normalize();
      const surfaceRight = cameraRight
        .clone()
        .addScaledVector(currentPlayerUp, -cameraRight.dot(currentPlayerUp));
      if (surfaceRight.lengthSq() < 0.0001) surfaceRight.copy(currentAroundSurface);
      surfaceRight.normalize();
      let tubePathInput: number;
      let tubeSurfaceInput: number;
      if (qaTubeAutoPilot) {
        tubePathInput = THREE.MathUtils.clamp(qaWalkInputState.current.forward, -1, 1);
        tubeSurfaceInput = THREE.MathUtils.clamp(qaWalkInputState.current.strafe, -0.72, 0.72);
      } else {
        const tubeMoveDirection = surfaceForward
          .multiplyScalar(forwardInput)
          .addScaledVector(surfaceRight, tubeStrafeInput);
        if (tubeMoveDirection.lengthSq() > 1) tubeMoveDirection.normalize();
        tubePathInput = THREE.MathUtils.clamp(tubeMoveDirection.dot(currentFrame.tangent), -1, 1);
        tubeSurfaceInput = THREE.MathUtils.clamp(tubeMoveDirection.dot(currentAroundSurface), -1, 1);
      }

      tubeState.t = THREE.MathUtils.clamp(
        tubeState.t + (tubePathInput * tubeMoveSpeed * delta) / LILY_COIL_TUBE_PATH_LENGTH,
        0,
        1,
      );
      tubeState.surfaceAngle += tubeSurfaceInput * (tubeMoveSpeed / Math.max(8, LILY_COIL_TUBE_PLAYER_RADIUS)) * delta;
      tubeState.surfaceAngle = Math.atan2(Math.sin(tubeState.surfaceAngle), Math.cos(tubeState.surfaceAngle));

      const frame = getLilyCoilTubeFrame(tubeState.t);
      const radial = frame.up.clone()
        .multiplyScalar(Math.cos(tubeState.surfaceAngle))
        .addScaledVector(frame.side, Math.sin(tubeState.surfaceAngle))
        .normalize();
      const playerUp = radial.clone().multiplyScalar(-1);
      const aroundSurface = frame.up.clone()
        .multiplyScalar(-Math.sin(tubeState.surfaceAngle))
        .addScaledVector(frame.side, Math.cos(tubeState.surfaceAngle))
        .normalize();
      const tubeGrounded = tubeState.jumpOffset <= 0.025 && tubeState.jumpVelocity <= 0;
      const fuel = useGameStore.getState().thrusterFuel;
      let newFuel = fuel;
      if (!jumpHeld) {
        thrusterLocked.current = false;
      }
      if (jumpRequested && tubeGrounded) {
        tubeState.jumpVelocity = LILY_COIL_TUBE_JUMP_FORCE * (jumpBoostActive ? JUMP_BOOST_MULTIPLIER : 1);
        setJumps(1);
        thrusterLocked.current = false;
      } else if (jumpHeld && !tubeGrounded && newFuel > 0 && !thrusterLocked.current) {
        tubeState.jumpVelocity += 35 * (jumpBoostActive ? JUMP_BOOST_MULTIPLIER : 1) * delta;
        newFuel = Math.max(0, newFuel - delta * 0.8);
        if (newFuel === 0) {
          thrusterLocked.current = true;
        }
      }
      if (tubeState.jumpOffset > 0 || tubeState.jumpVelocity > 0) {
        tubeState.jumpVelocity -= LILY_COIL_TUBE_JUMP_GRAVITY * delta;
        tubeState.jumpOffset = THREE.MathUtils.clamp(
          tubeState.jumpOffset + tubeState.jumpVelocity * delta,
          0,
          LILY_COIL_TUBE_MAX_JUMP_OFFSET,
        );
        if (tubeState.jumpOffset <= 0) {
          tubeState.jumpOffset = 0;
          tubeState.jumpVelocity = 0;
        }
      }
      if (tubeGrounded && newFuel < 1.0) {
        newFuel = Math.min(1.0, newFuel + delta * 0.4);
      }
      if (newFuel !== fuel) {
        useGameStore.getState().setThrusterFuel(newFuel);
      }
      const tubeAirborne = tubeState.jumpOffset > 0.025;
      const tubeBodyPosition = frame.center
        .clone()
        .addScaledVector(radial, LILY_COIL_TUBE_PLAYER_RADIUS)
        .addScaledVector(playerUp, tubeState.jumpOffset);
      const tubeCameraHeight = tubeSliding
        ? PLAYER_SLIDE_CAMERA_HEIGHT
        : isCrouching
          ? PLAYER_CROUCH_CAMERA_HEIGHT
          : PLAYER_CAMERA_HEIGHT;
      const tubeCameraPosition = tubeBodyPosition.clone().addScaledVector(playerUp, tubeCameraHeight);
      const tubeForward = frame.tangent.clone().multiplyScalar(forwardInput < -0.1 ? -1 : 1).normalize();

      rigidBody.current.setTranslation({ x: tubeBodyPosition.x, y: tubeBodyPosition.y, z: tubeBodyPosition.z }, true);
      rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      if (qaTubeAutoPilot) {
        const qaTubeLook = frame.tangent.clone()
          .multiplyScalar(tubePathInput >= -0.05 ? 1 : -1)
          .addScaledVector(aroundSurface, tubeSurfaceInput * 0.18)
          .addScaledVector(playerUp, -0.035 + Math.sin(state.clock.elapsedTime * 0.73) * 0.035);
        if (qaTubeLook.lengthSq() < 0.001) qaTubeLook.copy(frame.tangent);
        qaTubeLook.normalize();
        tubeState.lastUp.copy(playerUp);
        camera.up.copy(playerUp);
        camera.position.copy(tubeCameraPosition);
        camera.lookAt(tubeCameraPosition.clone().add(qaTubeLook));
        controllerLookEuler.current.setFromQuaternion(camera.quaternion);
      } else {
        if (!shouldAlignTubeView) {
          const upRotation = new THREE.Quaternion().setFromUnitVectors(tubeState.lastUp, playerUp);
          camera.quaternion.premultiply(upRotation);
          controllerLookEuler.current.setFromQuaternion(camera.quaternion);
        }
        tubeState.lastUp.copy(playerUp);
        camera.up.copy(playerUp);
        camera.position.copy(tubeCameraPosition);
      }
      if (shouldAlignTubeView && !qaTubeAutoPilot) {
        camera.lookAt(tubeCameraPosition.clone().add(tubeForward));
        controllerLookEuler.current.setFromQuaternion(camera.quaternion);
      }
      if (!tubeAirborne) setJumps(0);
      if (isCrouching) setIsCrouching(false);
      crouchHoldStartedAt.current = null;

      const tubeAimDir = new THREE.Vector3();
      camera.getWorldDirection(tubeAimDir);
      const tubeYaw = Math.atan2(tubeAimDir.x, -tubeAimDir.z);
      (window as any).__wofLastPlayerYaw = tubeYaw;
      (window as any).localPlayerPos = { x: tubeBodyPosition.x, y: tubeBodyPosition.y, z: tubeBodyPosition.z };
      (window as any).__wofLastPlayerPosition = {
        x: tubeBodyPosition.x,
        y: tubeBodyPosition.y,
        z: tubeBodyPosition.z,
      };
      (window as any).__wofLilyCoilTubeState = {
        t: tubeState.t,
        surfaceAngle: tubeState.surfaceAngle,
      };

      const tubeMoving = hasMovementInput || Math.abs(tubeSurfaceInput) > 0.05 || Math.abs(forwardInput) > 0.05;
      window.dispatchEvent(new CustomEvent('player-state', {
        detail: {
          isMoving: tubeMoving,
          isSprinting: isSprinting && !tubeSliding,
          isSliding: tubeSliding,
          isCrouching: false,
          isGrounded: !tubeAirborne,
          isMeditating: false,
        },
      }));
      window.dispatchEvent(new CustomEvent('player-moved', {
        detail: {
          x: tubeBodyPosition.x,
          y: tubeBodyPosition.y,
          z: tubeBodyPosition.z,
          angle: tubeYaw,
          isMoving: tubeMoving,
          grounded: !tubeAirborne,
        },
      }));
      recordNavigationSample({
        gameMode: storeState.gameMode,
        pos: [tubeBodyPosition.x, tubeBodyPosition.y, tubeBodyPosition.z],
        rot: [camera.rotation.x, tubeYaw, camera.rotation.z],
        aimDir: [tubeAimDir.x, tubeAimDir.y, tubeAimDir.z],
        velocity: [
          frame.tangent.x * tubePathInput * tubeMoveSpeed + aroundSurface.x * tubeSurfaceInput * tubeMoveSpeed,
          frame.tangent.y * tubePathInput * tubeMoveSpeed + aroundSurface.y * tubeSurfaceInput * tubeMoveSpeed + playerUp.y * tubeState.jumpVelocity,
          frame.tangent.z * tubePathInput * tubeMoveSpeed + aroundSurface.z * tubeSurfaceInput * tubeMoveSpeed,
        ],
        input: {
          forward: forwardInput,
          strafe: tubeStrafeInput,
          sprint: isSprinting,
          jump: jumpHeld,
          slide: tubeSlideHeld,
          vclip: false,
        },
        state: {
          grounded: !tubeAirborne,
          moving: tubeMoving,
          sliding: tubeSliding,
          sprinting: isSprinting && !tubeSliding,
          spellMenuOpen: storeState.isSpellMenuOpen,
        },
      });

      const now = Date.now();
      if (now - lastNetworkSync.current > 1000 / 15) {
        lastNetworkSync.current = now;
        socket.emit("updateMe", {
          pos: [tubeBodyPosition.x, tubeBodyPosition.y, tubeBodyPosition.z],
          rot: [camera.rotation.x, tubeYaw, camera.rotation.z],
          aimDir: [tubeAimDir.x, tubeAimDir.y, tubeAimDir.z],
          anim: tubeAirborne ? "jump" : tubeSliding ? "slide" : tubeMoving ? isSprinting ? "sprint" : "walk" : "holding",
          character: storeState.characterCustomization,
          survivalLevel: storeState.survivalLevel,
          isSpeaking: storeState.isVoiceSpeaking,
        });
      }
      return;
    }

    const staleLilyCoilRoll = hasCameraRollAgainstWorldUp();
    if (lilyCoilTubeState.current.active || staleLilyCoilRoll) {
      resetLilyCoilCameraState();
    }

    if (hasPlanarMovementInput) {
      if (direction.lengthSq() > 1) {
        direction.normalize();
      }
      direction.multiplyScalar(currentSpeed).applyEuler(camera.rotation);
    } else {
      direction.set(0, 0, 0);
    }

    if (vclipActive) {
      if (isSliding) setIsSliding(false);
      direction.y += verticalInput * VCLIP_VERTICAL_SPEED * (isSprinting ? VCLIP_SPRINT_MULTIPLIER : 1);
    }

    if (ladderActive && ladderVerticalInput !== 0) {
      direction.x *= 0.22;
      direction.z *= 0.22;
    }
    
    if (pullFrames.current > 0) {
      direction.x += pullVelocity.current.x;
      direction.z += pullVelocity.current.z;
      velocity.y = pullVelocity.current.y;
      pullFrames.current--;
    }
    
    // Check ground with a small footprint instead of a single center ray.
    let nearestGroundToi = Number.POSITIVE_INFINITY;
    if (!vclipActive) {
      for (const offset of GROUND_PROBE_OFFSETS) {
        const ray = new rapier.Ray(
          {
            x: pos.x + offset.x,
            y: pos.y - PLAYER_FOOT_OFFSET + GROUND_PROBE_ORIGIN_LIFT,
            z: pos.z + offset.z,
          },
          { x: 0, y: -1, z: 0 },
        );
        // Use filterPredicate to ignore the player's own colliders.
        // @ts-ignore
        const groundHit = world.castRay(
          ray,
          GROUND_PROBE_CAST_DISTANCE,
          true,
          undefined,
          undefined,
          undefined,
          undefined,
          isSolidWorldCollider,
        );
        if (groundHit && groundHit.timeOfImpact < nearestGroundToi) {
          nearestGroundToi = groundHit.timeOfImpact;
        }
      }
    }
    const hasGroundHit = nearestGroundToi < GROUND_PROBE_MAX_TOI;
    if (hasGroundHit) lastGroundedAt.current = nowMs;
    let grounded = !vclipActive && (
      hasGroundHit ||
      (velocity.y <= 0.1 && nowMs - lastGroundedAt.current <= GROUND_COYOTE_MS)
    );
    const climbingLadder = ladderActive && !vclipActive;
    let effectiveGrounded = grounded || climbingLadder;
    const crouchAllowed =
      crouchInputHeld &&
      effectiveGrounded &&
      !climbingLadder &&
      !jumpHeld &&
      !isSliding &&
      !isSprinting &&
      Math.abs(velocity.y) < 0.35;

    if (crouchAllowed) {
      if (crouchHoldStartedAt.current === null) {
        crouchHoldStartedAt.current = nowMs;
      } else if (!isCrouching && nowMs - crouchHoldStartedAt.current >= CROUCH_HOLD_MS) {
        setIsCrouching(true);
      }
    } else {
      crouchHoldStartedAt.current = null;
      if (isCrouching) setIsCrouching(false);
    }

    const survivalDeepRecoveryNeeded = survivalModeActive && pos.y < FLOOR_DEEP_RECOVERY_TRIGGER_Y;
    const survivalSurfaceRecoveryNeeded = survivalModeActive && !hasGroundHit;
    if (!vclipActive && !climbingLadder && !hasGroundHit && (velocity.y < -0.35 || survivalDeepRecoveryNeeded || survivalSurfaceRecoveryNeeded) && !jumpHeld && !grabbedState.current) {
      const recoverToFloor = (floorY: number, maxLift: number) => {
        const correctedY = floorY + PLAYER_FOOT_OFFSET + FLOOR_RECOVERY_VERTICAL_SETTLE;
        const lift = correctedY - pos.y;
        if (lift <= FLOOR_RECOVERY_TRIGGER_DEPTH || lift >= maxLift) return false;

        rigidBody.current.setTranslation({ x: pos.x, y: correctedY, z: pos.z }, true);
        rigidBody.current.setLinvel({ x: velocity.x, y: 0, z: velocity.z }, true);
        camera.position.set(pos.x, correctedY + (isSliding ? PLAYER_SLIDE_CAMERA_HEIGHT : isCrouching ? PLAYER_CROUCH_CAMERA_HEIGHT : PLAYER_CAMERA_HEIGHT), pos.z);
        (window as any).localPlayerPos = { x: pos.x, y: correctedY, z: pos.z };
        window.dispatchEvent(new CustomEvent('player-state', {
          detail: { isMoving: hasMovementInput, isSprinting, isSliding: false, isCrouching, isGrounded: true, isMeditating: false }
        }));
        window.dispatchEvent(new CustomEvent('player-moved', { detail: { x: pos.x, y: correctedY, z: pos.z, angle: yaw, isMoving: hasMovementInput, grounded: true } }));
        if (isSliding) setIsSliding(false);
        setJumps(0);
        return true;
      };

      const recoveryRayOriginY = pos.y + FLOOR_RECOVERY_RAY_UP;
      const recoveryRay = new rapier.Ray(
        { x: pos.x, y: recoveryRayOriginY, z: pos.z },
        { x: 0, y: -1, z: 0 },
      );
      // @ts-ignore - rapier exposes the collider predicate in this overload.
      const recoveryHit = world.castRay(
        recoveryRay,
        FLOOR_RECOVERY_RAY_UP + FLOOR_RECOVERY_RAY_DOWN,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        isSolidWorldCollider,
      );

      if (recoveryHit) {
        const floorY = recoveryRayOriginY - recoveryHit.timeOfImpact;
        if (recoverToFloor(floorY, FLOOR_RECOVERY_MAX_LIFT)) return;
      }

      if (survivalDeepRecoveryNeeded) {
        const deepRecoveryRayOriginY = pos.y + FLOOR_DEEP_RECOVERY_RAY_UP;
        const deepRecoveryRay = new rapier.Ray(
          { x: pos.x, y: deepRecoveryRayOriginY, z: pos.z },
          { x: 0, y: -1, z: 0 },
        );
        // @ts-ignore - rapier exposes the collider predicate in this overload.
        const deepRecoveryHit = world.castRay(
          deepRecoveryRay,
          FLOOR_DEEP_RECOVERY_RAY_UP + FLOOR_DEEP_RECOVERY_RAY_DOWN,
          true,
          undefined,
          undefined,
          undefined,
          undefined,
          isSolidWorldCollider,
        );

        if (deepRecoveryHit) {
          const floorY = deepRecoveryRayOriginY - deepRecoveryHit.timeOfImpact;
          if (recoverToFloor(floorY, FLOOR_DEEP_RECOVERY_MAX_LIFT)) return;
        }
      }
    }
    
    // Dispatch player state for HUD animations
    window.dispatchEvent(new CustomEvent('player-state', { 
      detail: { 
        isMoving: hasMovementInput, 
        isSprinting: isSprinting, 
        isSliding: isSliding,
        isCrouching: isCrouching,
        isGrounded: effectiveGrounded,
        isMeditating: false
      } 
    }));

    // Dispatch position for UI and Ripples
    window.dispatchEvent(new CustomEvent('player-moved', { detail: { x: pos.x, y: pos.y, z: pos.z, angle: yaw, isMoving: hasMovementInput, grounded: effectiveGrounded } }));

    const navAimDir = new THREE.Vector3();
    camera.getWorldDirection(navAimDir);
    recordNavigationSample({
      gameMode: storeState.gameMode,
      pos: [pos.x, pos.y, pos.z],
      rot: [camera.rotation.x, yaw, camera.rotation.z],
      aimDir: [navAimDir.x, navAimDir.y, navAimDir.z],
      velocity: [direction.x, vclipActive ? direction.y : velocity.y, direction.z],
      input: {
        forward: THREE.MathUtils.clamp((keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) - controllerMoveZ - touchMoveZ + qaWalkForwardInput, -1, 1),
        strafe: THREE.MathUtils.clamp((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + controllerMoveX + touchMoveX + qaWalkStrafeInput, -1, 1),
        sprint: isSprinting,
        jump: jumpHeld,
        slide: slideHeld,
        vclip: vclipActive,
      },
      state: {
        grounded: effectiveGrounded,
        moving: hasMovementInput,
        sliding: isSliding,
        sprinting: isSprinting,
        spellMenuOpen: storeState.isSpellMenuOpen,
      },
    });

    if (!vclipActive && effectiveGrounded) {
      setJumps(0);
      const planarVelocitySq = velocity.x * velocity.x + velocity.z * velocity.z;
      if (slideHeld && !isSliding && (hasPlanarMovementInput || planarVelocitySq > SLIDE_START_MIN_SPEED_SQ)) {
        if (Date.now() - lastSlideTime.current >= SLIDE_RESTART_COOLDOWN_MS) {
          setIsSliding(true);
          slideTimer.current = 1.0; // slide for up to 1s
          lastSlideTime.current = Date.now();
        }
      }
    }

    if (!vclipActive && isSliding) {
      slideTimer.current -= delta;
      if (slideTimer.current <= 0 || !slideHeld) {
        setIsSliding(false);
      }
    }

    // Applying x/z movement
    const ladderVelocityY = ladderVerticalInput === 0 ? LADDER_IDLE_HOLD_SPEED : ladderVerticalInput * LADDER_CLIMB_SPEED;
    rigidBody.current.setLinvel({
      x: direction.x,
      y: vclipActive ? direction.y : climbingLadder ? ladderVelocityY : velocity.y,
      z: direction.z
    }, true);

    const fuel = useGameStore.getState().thrusterFuel;
    let newFuel = fuel;

    if (!jumpHeld) {
      thrusterLocked.current = false;
    }

    // Jump & Thruster logic
    if (!vclipActive && !sleepActive && !climbingLadder && jumpHeld) {
      if (grounded && velocity.y <= GROUND_JUMP_MAX_UPWARD_VELOCITY) {
        if (jumpRequested) {
          rigidBody.current.setLinvel({ x: velocity.x, y: JUMP_FORCE * (jumpBoostActive ? JUMP_BOOST_MULTIPLIER : 1), z: velocity.z }, true);
          setJumps(1);
          thrusterLocked.current = false; // reset lock
        }
      } else if (!grounded && fuel > 0 && !thrusterLocked.current) {
        // Continuous thrust!
        rigidBody.current.applyImpulse({ x: 0, y: 35 * (jumpBoostActive ? JUMP_BOOST_MULTIPLIER : 1) * delta, z: 0 }, true);
        newFuel = Math.max(0, fuel - delta * 0.8); // 1.25 seconds of continuous thrust
        if (newFuel === 0) {
          thrusterLocked.current = true;
        }
      }
    }

    if (!vclipActive && effectiveGrounded) {
      if (newFuel < 1.0) {
        newFuel = Math.min(1.0, newFuel + delta * 0.4); // 2.5 seconds to recharge fully
      }
    }

    if (newFuel !== fuel) {
      useGameStore.getState().setThrusterFuel(newFuel);
    }

    // Update Camera position (attached to body)
    // Adjust y for crouch
    const cameraHeight = isSliding
      ? PLAYER_SLIDE_CAMERA_HEIGHT
      : isCrouching
        ? PLAYER_CROUCH_CAMERA_HEIGHT
        : PLAYER_CAMERA_HEIGHT;
    const targetY = pos.y + cameraHeight;
    const cameraClearancePosition = (!vclipActive && !climbingLadder)
      ? resolveCameraWallPush(pos, targetY, cameraHeight)
      : null;
    const cameraBasePosition = cameraClearancePosition ?? pos;
    const resolvedTargetY = cameraClearancePosition?.eyeY ?? targetY;
    camera.position.lerp(cameraTargetPosition.current.set(cameraBasePosition.x, resolvedTargetY, cameraBasePosition.z), 0.2);
    applyScreenShake();

    // Fall logic
    if (!vclipActive && pos.y < -50) {
      const [spawnX, spawnY, spawnZ] = getPlayerSpawnPosition(DEFAULT_FALL_RECOVERY_SPAWN_POSITION);
      rigidBody.current.setTranslation({ x: spawnX, y: spawnY, z: spawnZ }, true);
      rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      camera.position.set(spawnX, spawnY + PLAYER_CAMERA_HEIGHT, spawnZ);
    }

    // Sync network
    const now = Date.now();
    const isControllingGrab = activeGrabIds.current.left !== null || activeGrabIds.current.right !== null;
    const syncInterval = isControllingGrab ? 1000 / 30 : 1000 / 15;
    if (now - lastNetworkSync.current > syncInterval) {
      lastNetworkSync.current = now;
      const aimDir = new THREE.Vector3();
      camera.getWorldDirection(aimDir);
      const isCasting = storeState.chargingHands.left || storeState.chargingHands.right;
      const networkAnimation = sleepActive
        ? "sleep"
        : isSliding
          ? "slide"
          : isCrouching
            ? (hasMovementInput ? "crouchwalk" : "crouch")
          : climbingLadder
            ? (hasMovementInput ? "walk" : "holding")
          : (velocity.y < -1 || velocity.y > 1 || !effectiveGrounded)
            ? "jump"
            : isCasting
              ? "casting"
              : hasMovementInput
                ? isSprinting ? "sprint" : "walk"
                : "holding";
      (["left", "right"] as HandType[]).forEach((hand) => {
        const grabId = activeGrabIds.current[hand];
        if (!grabId) return;
        socket.emit("grabControl", {
          grabId,
          hand,
          origin: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          aimDir: { x: aimDir.x, y: aimDir.y, z: aimDir.z },
        });
      });
      socket.emit("updateMe", {
        pos: [pos.x, pos.y, pos.z],
        rot: [camera.rotation.x, yaw, camera.rotation.z],
        aimDir: [aimDir.x, aimDir.y, aimDir.z],
        anim: networkAnimation,
        character: storeState.characterCustomization,
        survivalLevel: storeState.survivalLevel,
        isSpeaking: storeState.isVoiceSpeaking
      });
    }
  });

  return (
    <>
      <RigidBody name="player" ref={rigidBody} collisionGroups={interactionGroups(1, [0])} colliders={false} mass={1} type="dynamic" position={initialPlayerPosition} enabledRotations={[false, false, false]} friction={0} restitution={0} ccd={true} gravityScale={isVClipEnabled ? 0 : 1}>
        {/* Collider height depends on whether sliding. But dynamic collider resizing can be tricky in Rapier. */}
        {/* We'll just stick to a fixed capsule and lower our camera, simple solution */}
        {!isVClipEnabled && <CapsuleCollider args={[PLAYER_COLLIDER_HALF_HEIGHT, PLAYER_COLLIDER_RADIUS]} friction={0} restitution={0} />}
        <pointLight 
          color="#ffd700" 
          intensity={showHealGlow ? 40 : 0} 
          distance={25} 
          decay={2}
          position={[0, 1, 0]}
        />
      </RigidBody>
    </>
  );
}
