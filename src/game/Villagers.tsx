import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { CharacterCustomization, createDefaultQuestNpcProgram, type QuestFlagValue, type QuestNpcAssignment, type QuestNpcDescriptor, type QuestNpcEditorTarget, type QuestNpcProgram, type QuestNpcRole, useGameStore } from "../store/gameStore";
import { getHutList, type HutInfo } from "./systems/world/villages/baseVillageHutLayout";
import { AvatarBillboard, NPC_AVATAR_GROUND_LIFT, NPC_AVATAR_SCALE } from "./PixelAvatar";
import { isMobilePerformanceMode } from "./systems/input/performanceMode";
import { absoluteAngleDeltaRadians } from "./systems/math/angleMath";
import { getPublishedLocalPlayerPosition } from "./systems/player/playerEventBridge";
import { useLazyRef } from "./systems/react/useLazyRef";
import { getEpochMsFromRenderClock } from "./systems/rendering/renderClockEpoch";

interface VillagerInfo {
  id: string;
  hut: HutInfo;
  character: CharacterCustomization;
  x: number;
  y: number;
  z: number;
  baseYaw: number;
}

type AnchoredQuestNpcProgram = QuestNpcProgram & {
  position: [number, number, number];
};

interface ReactionState {
  startedAt: number;
  startledUntil: number;
  angryUntil: number;
}

type QuestVillagerInteractDetail = {
  source?: string;
  handled?: boolean;
};

const SKIN_COLORS = ["#f0d2b6", "#d7a77f", "#a86f4b", "#6f4632", "#d6cf91", "#e7c69b", "#b7785f", "#f5dfc8"];
const CLOTHING_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#f97316", "#0891b2", "#9333ea", "#475569", "#be123c", "#ca8a04", "#0f766e"];
const PANTS_COLORS = ["#1f2937", "#334155", "#292524", "#4b5563", "#312e81", "#3f3f46"];
const HAIR_COLORS = ["#2b1b12", "#5c4033", "#7c4a24", "#d6a85f", "#111827", "#f8fafc", "#8b5cf6"];
const EYE_STYLES: CharacterCustomization["eyeStyle"][] = ["calm", "content", "dull", "sus", "happy", "nervous"];
const MOUTH_STYLES: CharacterCustomization["mouthStyle"][] = ["neutral", "smile", "frown"];
const TOP_STYLES: CharacterCustomization["topStyle"][] = ["simple", "vest", "tunic"];
const PANTS_STYLES: CharacterCustomization["pantsStyle"][] = ["pants", "shorts", "skirt"];
const SHOES_STYLES: CharacterCustomization["shoesStyle"][] = ["boots", "shoes", "sandals", "barefoot"];
const HAIR_STYLES: CharacterCustomization["hairStyle"][] = ["none", "short", "bob", "spikes", "long"];
const FACIAL_HAIR_STYLES: CharacterCustomization["facialHairStyle"][] = ["none", "none", "none", "mustache", "goatee", "beard"];
const EGYPTIAN_LINEN_COLORS = ["#f8e7bf", "#ffe8a3", "#e9c46a", "#facc15"];
const EGYPTIAN_ACCENT_COLORS = ["#2563eb", "#0891b2", "#0f766e", "#1d4ed8"];
const EGYPTIAN_EYE_STYLES: CharacterCustomization["eyeStyle"][] = ["calm", "dull", "sus", "content"];
const EGYPTIAN_MOUTH_STYLES: CharacterCustomization["mouthStyle"][] = ["neutral", "frown", "smile"];
const SWAMP_CLOTHING_COLORS = ["#4d5b2a", "#5f6f33", "#3d4a24", "#6a5430", "#2f5138"];
const SWAMP_PANTS_COLORS = ["#2b2f1e", "#3d3522", "#26351f", "#4b3b24"];
const SWAMP_HAIR_COLORS = ["#23170e", "#3b2618", "#4b341f", "#182414"];
const EYE_LOCK_RADIUS = 18;
const EYE_LOCK_RADIUS_SQ = EYE_LOCK_RADIUS * EYE_LOCK_RADIUS;
const VILLAGER_SPATIAL_CELL_SIZE = 16;
const VILLAGER_INSIDE_CHECK_INTERVAL_MS = 80;
const VILLAGER_INSIDE_CHECK_MOVE_EPSILON_SQ = 0.04;
const VILLAGER_RUNTIME_TICK_INTERVAL_MS = 50;
const DEV_NPC_INTERACTION_RANGE = 9.5;
const DEV_NPC_CLOSE_RANGE = 3.75;
const DEV_NPC_AIM_RADIUS = 1.75;
const DARREL_REWARD_SPELL = "healingcrystals";
const DARREL_ACCEPTED_FLAG = "darrel:healingcrystals:accepted";
const DARREL_CHARACTER: CharacterCustomization = {
  skinColor: "#d7a77f",
  topColor: "#4c1d95",
  pantsColor: "#312e81",
  shoesColor: "#2c2116",
  hatColor: "#7f1d1d",
  hairColor: "#f8fafc",
  facialHairColor: "#f8fafc",
  topStyle: "robe",
  pantsStyle: "robe",
  shoesStyle: "boots",
  hatStyle: "floppy-wizard",
  hairStyle: "long",
  facialHairStyle: "beard",
  eyeStyle: "sus",
  mouthStyle: "frown",
};

let villagerAudioContext: AudioContext | null = null;
const devNpcRayOrigin = new THREE.Vector3();
const devNpcRayDirection = new THREE.Vector3();
const devNpcTargetCenter = new THREE.Vector3();
const devNpcTargetOffset = new THREE.Vector3();
const EMPTY_ANCHORED_QUEST_NPC_IDS: ReadonlySet<string> = new Set<string>();

export function getVillagerRuntimeNowMs() {
  return Date.now();
}

function hashValue(seed: string, salt: number) {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function pick<T>(items: T[], seed: string, salt: number) {
  return items[Math.floor(hashValue(seed, salt) * items.length) % items.length];
}

function isEditableDomTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}

function getDefaultVillagerName(hut: HutInfo, index: number) {
  const townPrefix = hut.villagerTheme === "egyptian"
    ? "Dune"
    : hut.villagerTheme === "swamp"
      ? "Marsh"
      : "Town";
  return `${townPrefix} Villager ${index + 1}`;
}

function isDarrelName(value?: string | null) {
  if (!value) return false;
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalized === "darrel" || normalized === "darrell" || normalized.includes("darrel") || normalized.includes("darrell");
}

function isQuestFlagTruthy(value: QuestFlagValue | undefined) {
  return value === true || value === "true" || value === "completed" || value === "ready" || value === "1";
}

function isDarrelQuestAssignment(
  assignment: QuestNpcAssignment | undefined,
  questFlags: Record<string, QuestFlagValue>,
) {
  if (!assignment || assignment.spell !== DARREL_REWARD_SPELL) return false;
  return isDarrelName(assignment.npcId) ||
    isDarrelName(assignment.displayName) ||
    isQuestFlagTruthy(questFlags[DARREL_ACCEPTED_FLAG]);
}

function isDarrelVillagerIdentity({
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

function getQuestVillagerDisplayName(
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

function getQuestTownId(name: string, hut: HutInfo) {
  if (name && name !== "villagers") return name;
  return hut.villagerTheme ? `${hut.villagerTheme}-town` : "base-village";
}

function getTargetedVillager(camera: THREE.Camera, villagerCells: Map<string, VillagerInfo[]>) {
  camera.getWorldPosition(devNpcRayOrigin);
  camera.getWorldDirection(devNpcRayDirection);

  let bestVillager: VillagerInfo | null = null;
  let bestScore = Infinity;
  const searchRadiusCells = Math.ceil(DEV_NPC_INTERACTION_RANGE / VILLAGER_SPATIAL_CELL_SIZE) + 1;

  visitNearbyVillagers(villagerCells, devNpcRayOrigin.x, devNpcRayOrigin.z, searchRadiusCells, (villager) => {
    devNpcTargetCenter.set(villager.x, villager.y + 1.7, villager.z);
    devNpcTargetOffset.subVectors(devNpcTargetCenter, devNpcRayOrigin);
    const distance = devNpcTargetOffset.length();
    if (distance > DEV_NPC_INTERACTION_RANGE) return;

    const forwardDistance = devNpcRayDirection.dot(devNpcTargetOffset);
    if (forwardDistance <= 0) return;

    const lateralDistance = Math.sqrt(Math.max(0, distance * distance - forwardDistance * forwardDistance));
    const closeEnough = distance <= DEV_NPC_CLOSE_RANGE;
    const aimedEnough = lateralDistance <= DEV_NPC_AIM_RADIUS + distance * 0.035;
    if (!closeEnough && !aimedEnough) return;

    const score = lateralDistance * 2.3 + distance * 0.12 + (closeEnough ? -1.1 : 0);
    if (score < bestScore) {
      bestScore = score;
      bestVillager = villager;
    }
  });

  return bestVillager;
}

function makeVillagerCharacter(hut: HutInfo, index: number): CharacterCustomization {
  const seed = `${hut.id}:${hut.hutType}:${hut.colorIndex}:${index}`;
  if (hut.villagerTheme === "egyptian") {
    const accentColor = pick(EGYPTIAN_ACCENT_COLORS, seed, 20);
    const linenColor = pick(EGYPTIAN_LINEN_COLORS, seed, 21);
    const hairColor = pick(["#0b0b0f", "#171717", "#2b1b12"], seed, 22);
    const hasRoyalLook = hashValue(seed, 23) > 0.35;

    return {
      skinColor: pick(["#c68656", "#b8734a", "#d79a63", "#a8643f", "#e0b07a"], seed, 24),
      topColor: hasRoyalLook ? accentColor : linenColor,
      pantsColor: hasRoyalLook ? linenColor : "#facc15",
      shoesColor: "#7c4a24",
      hatColor: accentColor,
      hairColor,
      facialHairColor: hairColor,
      topStyle: hasRoyalLook ? "tunic" : "robe",
      pantsStyle: hashValue(seed, 25) > 0.45 ? "skirt" : "robe",
      shoesStyle: hashValue(seed, 26) > 0.5 ? "sandals" : "barefoot",
      hatStyle: hasRoyalLook ? "pharaoh" : "none",
      hairStyle: hasRoyalLook ? "none" : "bob",
      facialHairStyle: hashValue(seed, 27) > 0.68 ? "goatee" : "none",
      eyeStyle: pick(EGYPTIAN_EYE_STYLES, seed, 28),
      mouthStyle: pick(EGYPTIAN_MOUTH_STYLES, seed, 29),
    };
  }

  if (hut.villagerTheme === "swamp") {
    const topColor = pick(SWAMP_CLOTHING_COLORS, seed, 31);
    const hairColor = pick(SWAMP_HAIR_COLORS, seed, 32);

    return {
      skinColor: pick(["#d1aa7c", "#b9845d", "#8e5f43", "#c79069", "#d6bc8b"], seed, 33),
      topColor,
      pantsColor: pick(SWAMP_PANTS_COLORS, seed, 34),
      shoesColor: "#2c2116",
      hatColor: topColor,
      hairColor,
      facialHairColor: hairColor,
      topStyle: pick(["simple", "vest", "tunic"], seed, 35) as CharacterCustomization["topStyle"],
      pantsStyle: pick(["pants", "shorts", "skirt"], seed, 36) as CharacterCustomization["pantsStyle"],
      shoesStyle: pick(["boots", "sandals", "barefoot"], seed, 37) as CharacterCustomization["shoesStyle"],
      hatStyle: "none",
      hairStyle: pick(["short", "bob", "long", "spikes"], seed, 38) as CharacterCustomization["hairStyle"],
      facialHairStyle: pick(FACIAL_HAIR_STYLES, seed, 39),
      eyeStyle: pick(["calm", "dull", "sus", "nervous"], seed, 40) as CharacterCustomization["eyeStyle"],
      mouthStyle: pick(["neutral", "frown", "smile"], seed, 41) as CharacterCustomization["mouthStyle"],
    };
  }

  const topColor = pick(CLOTHING_COLORS, seed, 1);
  const hairColor = pick(HAIR_COLORS, seed, 2);

  return {
    skinColor: pick(SKIN_COLORS, seed, 3),
    topColor,
    pantsColor: pick(PANTS_COLORS, seed, 4),
    shoesColor: pick(PANTS_COLORS, seed, 5),
    hatColor: topColor,
    hairColor,
    facialHairColor: hairColor,
    topStyle: pick(TOP_STYLES, seed, 6),
    pantsStyle: pick(PANTS_STYLES, seed, 7),
    shoesStyle: pick(SHOES_STYLES, seed, 8),
    hatStyle: "none",
    hairStyle: pick(HAIR_STYLES, seed, 9),
    facialHairStyle: pick(FACIAL_HAIR_STYLES, seed, 10),
    eyeStyle: pick(EYE_STYLES, seed, 11),
    mouthStyle: pick(MOUTH_STYLES, seed, 12),
  };
}

function makeVillager(hut: HutInfo, index: number): VillagerInfo {
  const doorDirX = Math.sin(hut.rotation);
  const doorDirZ = Math.cos(hut.rotation);
  const sideDirX = Math.cos(hut.rotation);
  const sideDirZ = -Math.sin(hut.rotation);
  const backOffset = hut.villagerBackOffset ?? (hut.isMushroom ? -1.25 : -2.1);
  const sideOffset = hut.villagerSideOffset ?? 0;

  return {
    id: hut.id,
    hut,
    character: makeVillagerCharacter(hut, index),
    x: hut.x + doorDirX * backOffset + sideDirX * sideOffset,
    y: hut.y + (hut.villagerYOffset ?? 0.95),
    z: hut.z + doorDirZ * backOffset + sideDirZ * sideOffset,
    baseYaw: hut.rotation,
  };
}

function hasQuestNpcAnchor(program: QuestNpcProgram | undefined): program is AnchoredQuestNpcProgram {
  return Array.isArray(program?.position) &&
    program.position.length === 3 &&
    program.position.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate));
}

function normalizeQuestNpcTheme(theme?: string): HutInfo["villagerTheme"] {
  if (theme === "egyptian" || theme === "swamp") return theme;
  return "village";
}

function makeQuestNpcEditorTarget(
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

function anchorQuestNpcProgram(
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

function makePersistentQuestNpcVillager(program: AnchoredQuestNpcProgram, index: number): VillagerInfo {
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

function sameSet(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

function getVillagerCellKey(x: number, z: number) {
  return `${Math.floor(x / VILLAGER_SPATIAL_CELL_SIZE)}:${Math.floor(z / VILLAGER_SPATIAL_CELL_SIZE)}`;
}

function visitNearbyVillagers(
  cells: Map<string, VillagerInfo[]>,
  x: number,
  z: number,
  radiusCells: number,
  visit: (villager: VillagerInfo) => void,
) {
  const centerCellX = Math.floor(x / VILLAGER_SPATIAL_CELL_SIZE);
  const centerCellZ = Math.floor(z / VILLAGER_SPATIAL_CELL_SIZE);

  for (let cellX = centerCellX - radiusCells; cellX <= centerCellX + radiusCells; cellX++) {
    for (let cellZ = centerCellZ - radiusCells; cellZ <= centerCellZ + radiusCells; cellZ++) {
      const bucket = cells.get(`${cellX}:${cellZ}`);
      if (!bucket) continue;
      for (const villager of bucket) {
        visit(villager);
      }
    }
  }
}

function isPlayerInsideHut(playerPos: THREE.Vector3, villager: VillagerInfo) {
  const hut = villager.hut;
  const dx = playerPos.x - hut.x;
  const dz = playerPos.z - hut.z;
  const interiorHeight = hut.interiorHeight ?? 9.5;
  const verticalInside = playerPos.y > hut.y - 1.2 && playerPos.y < hut.y + interiorHeight;
  if (!verticalInside) return false;

  if (hut.isMushroom) {
    return dx * dx + dz * dz < 5.35 * 5.35;
  }

  const cos = Math.cos(-hut.rotation);
  const sin = Math.sin(-hut.rotation);
  const localX = dx * cos - dz * sin;
  const localZ = dx * sin + dz * cos;
  const halfWidth = hut.interiorWidth ? hut.interiorWidth / 2 : 7.35;
  const halfDepth = hut.interiorDepth ? hut.interiorDepth / 2 : 7.35;
  return Math.abs(localX) < halfWidth && Math.abs(localZ) < halfDepth;
}

function angleDistance(a: number, b: number) {
  return absoluteAngleDeltaRadians(a, b);
}

function getReactionCount(reactions: Record<string, ReactionState>) {
  let count = 0;
  for (const id in reactions) {
    if (Object.prototype.hasOwnProperty.call(reactions, id)) count += 1;
  }
  return count;
}

function getNearestPlayerFacingYaw(villager: VillagerInfo) {
  let bestDistanceSq = EYE_LOCK_RADIUS_SQ;
  let bestYaw: number | null = null;

  const considerPosition = (x: number, y: number, z: number) => {
    if (Math.abs(y - villager.y) > 7) return;
    const dx = x - villager.x;
    const dz = z - villager.z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq >= bestDistanceSq) return;
    bestDistanceSq = distanceSq;
    bestYaw = Math.atan2(dx, -dz);
  };

  const localPlayerPos = getPublishedLocalPlayerPosition();
  if (localPlayerPos) {
    considerPosition(localPlayerPos.x, localPlayerPos.y, localPlayerPos.z);
  }

  const remotePlayers = useGameStore.getState().players;
  for (const playerId in remotePlayers) {
    const player = remotePlayers[playerId];
    if (player.health <= 0) continue;
    considerPosition(player.pos[0], player.pos[1], player.pos[2]);
  }

  return bestYaw;
}

function playVillagerYelp(volume: number) {
  if (typeof window === "undefined") return;

  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;

  try {
    const ctx = villagerAudioContext ?? new AudioContextCtor();
    villagerAudioContext = ctx;
    void ctx.resume();

    const now = ctx.currentTime + 0.01;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const safeVolume = THREE.MathUtils.clamp(volume, 0.12, 0.8);

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(760, now);
    oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
    oscillator.frequency.exponentialRampToValueAtTime(520, now + 0.24);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18 * safeVolume, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.31);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  } catch {
    // Audio can still be blocked before the first user gesture; the villager reaction should continue visually.
  }
}

function QuestNpcDevMarker({ role }: { role: QuestNpcRole }) {
  const color = role === "town-leader"
    ? "#facc15"
    : role === "quest-giver"
      ? "#67e8f9"
      : "#a7f3d0";

  return (
    <group position={[0, 2.42, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow={false}>
        <torusGeometry args={[0.34, 0.035, 6, 18]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} toneMapped={false} />
      </mesh>
      {role === "town-leader" && (
        <mesh position={[0, 0.2, 0]} castShadow={false}>
          <coneGeometry args={[0.28, 0.36, 5]} />
          <meshBasicMaterial color={color} transparent opacity={0.95} toneMapped={false} />
        </mesh>
      )}
      {role === "quest-giver" && (
        <mesh position={[0, 0.03, 0]} castShadow={false}>
          <octahedronGeometry args={[0.2, 0]} />
          <meshBasicMaterial color={color} transparent opacity={0.95} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

const VillagerNpc = memo(function VillagerNpc({
  villager,
  reaction,
  clockMs,
  isPlayerInside,
  isQuestDevModeEnabled,
  questRole,
  isDarrel,
}: {
  villager: VillagerInfo;
  reaction?: ReactionState;
  clockMs: number;
  isPlayerInside: boolean;
  isQuestDevModeEnabled: boolean;
  questRole: QuestNpcRole;
  isDarrel: boolean;
}) {
  const [lookYaw, setLookYaw] = useState(villager.baseYaw);
  const lookYawRef = useRef(villager.baseYaw);
  const lastLookUpdateRef = useRef(Number.NEGATIVE_INFINITY);
  const lookUpdateInterval = useMemo(
    () => (isMobilePerformanceMode() ? 220 : 140) + hashValue(villager.id, 0x51a7) * 90,
    [villager.id],
  );
  const phase = reaction && clockMs < reaction.startledUntil ? "startled" : isPlayerInside || (reaction && clockMs < reaction.angryUntil) ? "angry" : "idle";
  const jumpProgress = reaction ? THREE.MathUtils.clamp((clockMs - reaction.startedAt) / 650, 0, 1) : 1;
  const jumpOffset = phase === "startled" ? Math.sin(jumpProgress * Math.PI) * 0.55 : 0;
  const baseCharacter = isDarrel ? DARREL_CHARACTER : villager.character;
  const character = useMemo<CharacterCustomization>(() => {
    if (phase === "startled") {
      return { ...baseCharacter, eyeStyle: "terrified", mouthStyle: "open" };
    }
    if (phase === "angry") {
      return { ...baseCharacter, eyeStyle: "angry", mouthStyle: "frown" };
    }
    return baseCharacter;
  }, [baseCharacter, phase]);

  useFrame((state) => {
    const now = state.clock.elapsedTime * 1000;
    if (now - lastLookUpdateRef.current < lookUpdateInterval) return;
    lastLookUpdateRef.current = now;

    const targetYaw = getNearestPlayerFacingYaw(villager) ?? villager.baseYaw;
    if (angleDistance(targetYaw, lookYawRef.current) < 0.045) return;

    lookYawRef.current = targetYaw;
    setLookYaw(targetYaw);
  });

  return (
    <group
      position={[villager.x, villager.y + NPC_AVATAR_GROUND_LIFT + jumpOffset, villager.z]}
      scale={[NPC_AVATAR_SCALE, NPC_AVATAR_SCALE, NPC_AVATAR_SCALE]}
    >
      {isDarrel && (
        <Html center distanceFactor={8} position={[0, 2.82, 0]} style={{ pointerEvents: "none" }}>
          <div className="rounded border border-yellow-200/80 bg-black/70 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-yellow-100 shadow-[0_0_12px_rgba(250,204,21,0.55)]">
            Darrel
          </div>
        </Html>
      )}
      <AvatarBillboard character={character} animation={phase} yaw={lookYaw} health={100} blinkSeed={`villager:${villager.id}`} />
      {isQuestDevModeEnabled && <QuestNpcDevMarker role={questRole} />}
    </group>
  );
}, (previous, next) => (
  previous.villager === next.villager &&
  previous.reaction === next.reaction &&
  previous.clockMs === next.clockMs &&
  previous.isPlayerInside === next.isPlayerInside &&
  previous.isQuestDevModeEnabled === next.isQuestDevModeEnabled &&
  previous.questRole === next.questRole &&
  previous.isDarrel === next.isDarrel
));

export function Villagers({
  huts,
  name = "villagers",
}: {
  huts?: HutInfo[];
  name?: string;
} = {}) {
  const { camera } = useThree();
  const isQuestDevModeEnabled = useGameStore((state) => state.isQuestDevModeEnabled);
  const questNpcPrograms = useGameStore((state) => state.questNpcPrograms);
  const spellQuestAssignments = useGameStore((state) => state.spellQuestAssignments);
  const questFlags = useGameStore((state) => state.questFlags);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const defaultHuts = useMemo(() => getHutList(), []);
  const activeHuts = huts ?? defaultHuts;
  const savedDarrelId = useMemo(() => {
    for (const assignmentId in spellQuestAssignments) {
      const assignment = spellQuestAssignments[assignmentId];
      if (isDarrelQuestAssignment(assignment, questFlags) && assignment.npcId) return assignment.npcId;
    }

    for (const npcId in questNpcPrograms) {
      const program = questNpcPrograms[npcId];
      if (isDarrelName(program.displayName) || isDarrelName(program.npcId)) return program.npcId;
    }

    return null;
  }, [questFlags, questNpcPrograms, spellQuestAssignments]);
  const [claimedDarrelHutId, setClaimedDarrelHutId] = useState<string | null>(null);
  const claimedDarrelHutIdRef = useRef<string | null>(null);
  const darrelHutId = savedDarrelId ?? claimedDarrelHutId;
  const anchoredQuestNpcIds = useMemo<ReadonlySet<string>>(() => {
    let ids: Set<string> | null = null;
    for (const npcId in questNpcPrograms) {
      const program = questNpcPrograms[npcId];
      if (hasQuestNpcAnchor(program)) {
        ids ??= new Set<string>();
        ids.add(program.npcId);
      }
    }
    return ids ?? EMPTY_ANCHORED_QUEST_NPC_IDS;
  }, [questNpcPrograms]);
  const generatedVillagers = useMemo(() => {
    const nextVillagers = new Array<VillagerInfo>(activeHuts.length);
    for (let index = 0; index < activeHuts.length; index += 1) {
      nextVillagers[index] = makeVillager(activeHuts[index], index);
    }
    return nextVillagers;
  }, [activeHuts]);
  const villagers = useMemo(() => {
    if (anchoredQuestNpcIds.size === 0) return generatedVillagers;

    const visibleVillagers: VillagerInfo[] = [];
    for (let index = 0; index < generatedVillagers.length; index += 1) {
      const villager = generatedVillagers[index];
      if (!anchoredQuestNpcIds.has(villager.id)) visibleVillagers.push(villager);
    }
    return visibleVillagers;
  }, [anchoredQuestNpcIds, generatedVillagers]);
  const villagerCells = useMemo(() => {
    const cells = new Map<string, VillagerInfo[]>();
    for (const villager of villagers) {
      const key = getVillagerCellKey(villager.hut.x, villager.hut.z);
      const bucket = cells.get(key);
      if (bucket) {
        bucket.push(villager);
      } else {
        cells.set(key, [villager]);
      }
    }
    return cells;
  }, [villagers]);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => new Set());
  const [insideHutId, setInsideHutId] = useState<string | null>(null);
  const [clockMs, setClockMs] = useState(0);
  const [reactions, setReactions] = useState<Record<string, ReactionState>>({});
  const visibleIdsRef = useRef(visibleIds);
  const visibleIdsScratchRef = useLazyRef(() => new Set<string>());
  const insideHutIdRef = useRef<string | null>(null);
  const reactionsRef = useRef(reactions);
  const reactionCountRef = useRef(0);
  const lastTriggeredRef = useRef<Record<string, number>>({});
  const lastQuestInteractionRef = useRef<Record<string, number>>({});
  const lastVisibilityUpdateRef = useRef(0);
  const lastInsideCheckAtRef = useRef(Number.NEGATIVE_INFINITY);
  const lastInsideCheckPositionRef = useLazyRef(() => new THREE.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY));
  const lastReactionTickRef = useRef(0);
  const lastVillagerRuntimeTickAtRef = useRef(Number.NEGATIVE_INFINITY);
  const villagerRuntimeEpochOffsetRef = useRef<number | null>(null);
  const latestFrameClockMsRef = useRef(0);
  const cameraPositionRef = useLazyRef(() => new THREE.Vector3());
  const renderDistance = mobilePerformanceMode ? 58 : 90;

  useEffect(() => {
    visibleIdsRef.current = visibleIds;
  }, [visibleIds]);

  useEffect(() => {
    reactionsRef.current = reactions;
    reactionCountRef.current = getReactionCount(reactions);
  }, [reactions]);

  useEffect(() => {
    if (savedDarrelId) {
      claimedDarrelHutIdRef.current = null;
      setClaimedDarrelHutId(null);
    }
  }, [savedDarrelId]);

  useEffect(() => {
    claimedDarrelHutIdRef.current = claimedDarrelHutId;
  }, [claimedDarrelHutId]);

  useEffect(() => {
    const store = useGameStore.getState();
    for (let index = 0; index < generatedVillagers.length; index += 1) {
      const villager = generatedVillagers[index];
      const existingProgram = questNpcPrograms[villager.id];
      const assignment = spellQuestAssignments[villager.id];
      if ((!existingProgram && !assignment) || hasQuestNpcAnchor(existingProgram)) continue;

      const villagerIndex = activeHuts.indexOf(villager.hut);
      const defaultName = getQuestVillagerDisplayName(
        name,
        villager.hut,
        villagerIndex,
        existingProgram?.displayName,
        assignment,
        questFlags,
        darrelHutId,
      );
      const target = makeQuestNpcEditorTarget(name, villager, defaultName);
      store.upsertQuestNpcProgram(anchorQuestNpcProgram(existingProgram, target));
    }
  }, [activeHuts, darrelHutId, generatedVillagers, name, questFlags, questNpcPrograms, spellQuestAssignments]);

  const claimDarrelVillager = useCallback((villager: VillagerInfo, announce = true) => {
    claimedDarrelHutIdRef.current = villager.id;
    setClaimedDarrelHutId(villager.id);

    const store = useGameStore.getState();
    store.upsertQuestNpcProgram(createDefaultQuestNpcProgram({
      npcId: villager.id,
      townId: getQuestTownId(name, villager.hut),
      hutId: villager.hut.id,
      defaultName: "Darrel",
      theme: villager.hut.villagerTheme ?? "village",
      position: [villager.x, villager.y, villager.z],
    }));
    if (announce) {
      store.addLobbyMessage(`Darrel assigned to hut ${villager.hut.id}.`, "system");
    }
  }, [name]);

  useEffect(() => {
    if (!isQuestDevModeEnabled) return undefined;

    const openTargetedNpcEditor = (event: MouseEvent) => {
      if (event.button !== 2 || isEditableDomTarget(event.target)) return;

      const store = useGameStore.getState();
      if (
        store.questNpcEditorTarget ||
        store.questDialogSession ||
        store.isInventoryOpen ||
        store.isPauseMenuOpen ||
        store.isSpellMenuOpen ||
        store.isMapExpanded ||
        store.isScoreboardOpen ||
        store.health <= 0
      ) {
        return;
      }

      const villager = getTargetedVillager(camera, villagerCells);
      if (!villager) return;
      const villagerIndex = activeHuts.indexOf(villager.hut);
      const defaultName = getQuestVillagerDisplayName(
        name,
        villager.hut,
        villagerIndex,
        store.questNpcPrograms[villager.id]?.displayName,
        store.spellQuestAssignments[villager.id],
        store.questFlags,
        darrelHutId,
      );

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      document.documentElement.classList.remove("wizards-mouse-gameplay-active");
      delete document.documentElement.dataset.wizardsMouseLookFallback;
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }

      store.openQuestNpcEditor(makeQuestNpcEditorTarget(name, villager, defaultName));
      store.addLobbyMessage(`Editing ${villager.id}`, "system");
      window.dispatchEvent(new Event("command-console-opened"));
    };

    const suppressTargetedNpcContextMenu = (event: MouseEvent) => {
      if (getTargetedVillager(camera, villagerCells)) {
        event.preventDefault();
      }
    };

    window.addEventListener("mousedown", openTargetedNpcEditor, true);
    window.addEventListener("contextmenu", suppressTargetedNpcContextMenu, true);
    return () => {
      window.removeEventListener("mousedown", openTargetedNpcEditor, true);
      window.removeEventListener("contextmenu", suppressTargetedNpcContextMenu, true);
    };
  }, [activeHuts, camera, darrelHutId, isQuestDevModeEnabled, name, villagerCells]);

  useEffect(() => {
    const interactWithTargetedVillager = (event: Event) => {
      const store = useGameStore.getState();
      const detail = (event as CustomEvent<QuestVillagerInteractDetail>).detail;
      if (detail?.handled) return;
      const isSurvivalMode = store.gameMode === "solo-survival" || store.gameMode === "multiplayer-survival";
      if (
        !isSurvivalMode ||
        store.isQuestDevModeEnabled ||
        store.questNpcEditorTarget ||
        store.questDialogSession ||
        store.isInventoryOpen ||
        store.isPauseMenuOpen ||
        store.isSpellMenuOpen ||
        store.isMapExpanded ||
        store.isScoreboardOpen ||
        store.health <= 0
      ) {
        return;
      }

      const villager = getTargetedVillager(camera, villagerCells);
      if (!villager) return;

      if (detail) {
        detail.handled = true;
      }

      const now = getVillagerRuntimeNowMs();
      latestFrameClockMsRef.current = now;
      if (now - (lastQuestInteractionRef.current[villager.id] ?? 0) < 700) return;
      lastQuestInteractionRef.current[villager.id] = now;

      setClockMs(now);
      setReactions((current) => ({
        ...current,
        [villager.id]: {
          startedAt: now,
          startledUntil: now + 520,
          angryUntil: now + 2400,
        },
      }));
      playVillagerYelp(0.42);

      const villagerIndex = activeHuts.indexOf(villager.hut);
      const displayName = getQuestVillagerDisplayName(
        name,
        villager.hut,
        villagerIndex,
        store.questNpcPrograms[villager.id]?.displayName,
        store.spellQuestAssignments[villager.id],
        store.questFlags,
        darrelHutId,
      );
      const target = makeQuestNpcEditorTarget(name, villager, displayName);
      const existingProgram = store.questNpcPrograms[villager.id];
      if (!hasQuestNpcAnchor(existingProgram)) {
        store.upsertQuestNpcProgram(anchorQuestNpcProgram(existingProgram, target));
      }
      const descriptor: QuestNpcDescriptor = {
        npcId: villager.id,
        townId: target.townId,
        displayName,
      };
      store.interactWithQuestVillager(descriptor, { announce: true });
    };

    window.addEventListener("quest-villager-interact", interactWithTargetedVillager);
    return () => window.removeEventListener("quest-villager-interact", interactWithTargetedVillager);
  }, [activeHuts, camera, darrelHutId, name, villagerCells]);

  useEffect(() => {
    const claimDarrelHere = () => {
      const targetedVillager = getTargetedVillager(camera, villagerCells);
      let insideVillager: VillagerInfo | null = null;
      if (insideHutIdRef.current) {
        for (let index = 0; index < villagers.length; index += 1) {
          const villager = villagers[index];
          if (villager.id !== insideHutIdRef.current) continue;
          insideVillager = villager;
          break;
        }
      }
      const villager = targetedVillager ?? insideVillager;
      const store = useGameStore.getState();

      if (!villager) {
        store.addLobbyMessage("No villager or occupied hut found for Darrel.", "system");
        return;
      }

      claimDarrelVillager(villager, true);
    };

    window.addEventListener("quest-claim-darrel-here", claimDarrelHere);
    return () => window.removeEventListener("quest-claim-darrel-here", claimDarrelHere);
  }, [camera, claimDarrelVillager, villagerCells, villagers]);

  useFrame(({ clock }) => {
    const now = getEpochMsFromRenderClock(clock.elapsedTime, villagerRuntimeEpochOffsetRef);
    if (now - lastVillagerRuntimeTickAtRef.current < VILLAGER_RUNTIME_TICK_INTERVAL_MS) return;
    lastVillagerRuntimeTickAtRef.current = now;
    latestFrameClockMsRef.current = now;
    camera.getWorldPosition(cameraPositionRef.current);
    const playerPos = cameraPositionRef.current;

    const lastInsideCheckPosition = lastInsideCheckPositionRef.current;
    const shouldCheckInside =
      now - lastInsideCheckAtRef.current >= VILLAGER_INSIDE_CHECK_INTERVAL_MS ||
      playerPos.distanceToSquared(lastInsideCheckPosition) >= VILLAGER_INSIDE_CHECK_MOVE_EPSILON_SQ;
    if (shouldCheckInside) {
      lastInsideCheckAtRef.current = now;
      lastInsideCheckPosition.copy(playerPos);

      let enteredVillager: VillagerInfo | null = null;
      let enteredDistanceSq = Infinity;
      visitNearbyVillagers(villagerCells, playerPos.x, playerPos.z, 2, (villager) => {
        if (!isPlayerInsideHut(playerPos, villager)) return;
        const dx = playerPos.x - villager.hut.x;
        const dz = playerPos.z - villager.hut.z;
        const distanceSq = dx * dx + dz * dz;
        if (distanceSq < enteredDistanceSq) {
          enteredDistanceSq = distanceSq;
          enteredVillager = villager;
        }
      });

      const nextInsideId = enteredVillager?.id ?? null;
      if (
        enteredVillager &&
        !savedDarrelId &&
        !claimedDarrelHutIdRef.current
      ) {
        claimDarrelVillager(enteredVillager, false);
      }

      if (nextInsideId !== insideHutIdRef.current) {
        insideHutIdRef.current = nextInsideId;
        setInsideHutId(nextInsideId);

        if (enteredVillager && now - (lastTriggeredRef.current[enteredVillager.id] ?? 0) > 900) {
          lastTriggeredRef.current[enteredVillager.id] = now;
          setClockMs(now);
          setReactions((current) => ({
            ...current,
            [enteredVillager.id]: {
              startedAt: now,
              startledUntil: now + 680,
              angryUntil: now + 3200,
            },
          }));

          const distance = Math.sqrt(enteredDistanceSq);
          playVillagerYelp(1 - distance / 9);
        }
      }
    }

    if (now - lastVisibilityUpdateRef.current > 350) {
      lastVisibilityUpdateRef.current = now;
      const renderDistanceSq = renderDistance * renderDistance;
      const visibilityRadiusCells = Math.ceil(renderDistance / VILLAGER_SPATIAL_CELL_SIZE) + 1;
      const nextVisible = visibleIdsScratchRef.current;
      nextVisible.clear();

      visitNearbyVillagers(villagerCells, playerPos.x, playerPos.z, visibilityRadiusCells, (villager) => {
        const dx = playerPos.x - villager.x;
        const dz = playerPos.z - villager.z;
        if (dx * dx + dz * dz < renderDistanceSq || reactionsRef.current[villager.id]) {
          nextVisible.add(villager.id);
        }
      });

      if (!sameSet(nextVisible, visibleIdsRef.current)) {
        setVisibleIds(new Set(nextVisible));
      }
    }

    if (reactionCountRef.current > 0 && now - lastReactionTickRef.current > 80) {
      lastReactionTickRef.current = now;
      setClockMs(now);
      setReactions((current) => {
        let changed = false;
        const next: Record<string, ReactionState> = {};
        for (const id in current) {
          const reaction = current[id];
          if (reaction.angryUntil > now || insideHutIdRef.current === id) {
            next[id] = reaction;
          } else {
            changed = true;
          }
        }
        return changed ? next : current;
      });
    }
  });

  return (
    <group name={name}>
      {villagers.map((villager) => {
        if (!visibleIds.has(villager.id)) return null;
        const reaction = reactions[villager.id];
        const isPlayerInside = insideHutId === villager.id;
        const isDarrel = isDarrelVillagerIdentity({
          name,
          hut: villager.hut,
          programName: questNpcPrograms[villager.id]?.displayName,
          assignment: spellQuestAssignments[villager.id],
          questFlags,
          fallbackDarrelId: darrelHutId,
        });
        const questRole = isQuestDevModeEnabled
          ? isDarrel ? "quest-giver" : questNpcPrograms[villager.id]?.role ?? "villager"
          : "villager";
        return (
          <VillagerNpc
            key={villager.id}
            villager={villager}
            reaction={reaction}
            clockMs={reaction || isPlayerInside ? clockMs : 0}
            isPlayerInside={isPlayerInside}
            isQuestDevModeEnabled={isQuestDevModeEnabled}
            questRole={questRole}
            isDarrel={isDarrel}
          />
        );
      })}
    </group>
  );
}

export function PersistentQuestNpcs() {
  const { camera } = useThree();
  const isQuestDevModeEnabled = useGameStore((state) => state.isQuestDevModeEnabled);
  const questNpcPrograms = useGameStore((state) => state.questNpcPrograms);
  const spellQuestAssignments = useGameStore((state) => state.spellQuestAssignments);
  const questFlags = useGameStore((state) => state.questFlags);
  const questNpcs = useMemo(() => {
    const nextQuestNpcs: VillagerInfo[] = [];
    for (const npcId in questNpcPrograms) {
      const program = questNpcPrograms[npcId];
      if (hasQuestNpcAnchor(program)) {
        nextQuestNpcs.push(makePersistentQuestNpcVillager(program, nextQuestNpcs.length));
      }
    }
    return nextQuestNpcs;
  }, [questNpcPrograms]);
  const questNpcCells = useMemo(() => {
    const cells = new Map<string, VillagerInfo[]>();
    for (const villager of questNpcs) {
      const key = getVillagerCellKey(villager.x, villager.z);
      const bucket = cells.get(key);
      if (bucket) {
        bucket.push(villager);
      } else {
        cells.set(key, [villager]);
      }
    }
    return cells;
  }, [questNpcs]);
  const [clockMs, setClockMs] = useState(0);
  const [reactions, setReactions] = useState<Record<string, ReactionState>>({});
  const lastQuestInteractionRef = useRef<Record<string, number>>({});
  const lastReactionTickRef = useRef(0);
  const questNpcReactionEpochOffsetRef = useRef<number | null>(null);
  const hasReactions = useMemo(() => getReactionCount(reactions) > 0, [reactions]);

  useEffect(() => {
    if (!isQuestDevModeEnabled) return undefined;

    const openPersistentNpcEditor = (event: MouseEvent) => {
      if (event.button !== 2 || isEditableDomTarget(event.target)) return;

      const store = useGameStore.getState();
      if (
        store.questNpcEditorTarget ||
        store.questDialogSession ||
        store.isInventoryOpen ||
        store.isPauseMenuOpen ||
        store.isSpellMenuOpen ||
        store.isMapExpanded ||
        store.isScoreboardOpen ||
        store.health <= 0
      ) {
        return;
      }

      const villager = getTargetedVillager(camera, questNpcCells);
      if (!villager) return;
      const program = store.questNpcPrograms[villager.id];
      const defaultName = program?.displayName ?? "Quest NPC";

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      document.documentElement.classList.remove("wizards-mouse-gameplay-active");
      delete document.documentElement.dataset.wizardsMouseLookFallback;
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }

      store.openQuestNpcEditor({
        npcId: villager.id,
        townId: program?.townId ?? "quest-npcs",
        hutId: program?.hutId ?? villager.hut.id,
        defaultName,
        theme: program?.theme ?? villager.hut.villagerTheme ?? "village",
        position: [villager.x, villager.y, villager.z],
      });
      store.addLobbyMessage(`Editing ${villager.id}`, "system");
      window.dispatchEvent(new Event("command-console-opened"));
    };

    const suppressPersistentNpcContextMenu = (event: MouseEvent) => {
      if (getTargetedVillager(camera, questNpcCells)) {
        event.preventDefault();
      }
    };

    window.addEventListener("mousedown", openPersistentNpcEditor, true);
    window.addEventListener("contextmenu", suppressPersistentNpcContextMenu, true);
    return () => {
      window.removeEventListener("mousedown", openPersistentNpcEditor, true);
      window.removeEventListener("contextmenu", suppressPersistentNpcContextMenu, true);
    };
  }, [camera, isQuestDevModeEnabled, questNpcCells]);

  useEffect(() => {
    const interactWithPersistentNpc = (event: Event) => {
      const detail = (event as CustomEvent<QuestVillagerInteractDetail>).detail;
      if (detail?.handled) return;

      const store = useGameStore.getState();
      const isSurvivalMode = store.gameMode === "solo-survival" || store.gameMode === "multiplayer-survival";
      if (
        !isSurvivalMode ||
        store.isQuestDevModeEnabled ||
        store.questNpcEditorTarget ||
        store.questDialogSession ||
        store.isInventoryOpen ||
        store.isPauseMenuOpen ||
        store.isSpellMenuOpen ||
        store.isMapExpanded ||
        store.isScoreboardOpen ||
        store.health <= 0
      ) {
        return;
      }

      const villager = getTargetedVillager(camera, questNpcCells);
      if (!villager) return;
      const program = store.questNpcPrograms[villager.id];
      if (!program) return;

      if (detail) {
        detail.handled = true;
      }

      const now = getVillagerRuntimeNowMs();
      if (now - (lastQuestInteractionRef.current[villager.id] ?? 0) < 700) return;
      lastQuestInteractionRef.current[villager.id] = now;

      setClockMs(now);
      setReactions((current) => ({
        ...current,
        [villager.id]: {
          startedAt: now,
          startledUntil: now + 520,
          angryUntil: now + 2400,
        },
      }));
      playVillagerYelp(0.42);

      const descriptor: QuestNpcDescriptor = {
        npcId: villager.id,
        townId: program.townId,
        displayName: program.displayName,
      };
      store.interactWithQuestVillager(descriptor, { announce: true });
    };

    window.addEventListener("quest-villager-interact", interactWithPersistentNpc);
    return () => window.removeEventListener("quest-villager-interact", interactWithPersistentNpc);
  }, [camera, questNpcCells]);

  useFrame(({ clock }) => {
    if (!hasReactions) {
      lastReactionTickRef.current = 0;
      return;
    }

    const now = getEpochMsFromRenderClock(clock.elapsedTime, questNpcReactionEpochOffsetRef);
    if (now - lastReactionTickRef.current <= 80) return;
    lastReactionTickRef.current = now;
    setClockMs(now);
    setReactions((current) => {
      let changed = false;
      const next: Record<string, ReactionState> = {};
      for (const id in current) {
        const reaction = current[id];
        if (reaction.angryUntil > now) {
          next[id] = reaction;
        } else {
          changed = true;
        }
      }
      return changed ? next : current;
    });
  });

  return (
    <group name="persistent-quest-npcs">
      {questNpcs.map((villager) => {
        const program = questNpcPrograms[villager.id];
        const reaction = reactions[villager.id];
        const assignment = spellQuestAssignments[villager.id];
        const isDarrel = isDarrelVillagerIdentity({
          name: "persistent-quest-npcs",
          hut: villager.hut,
          programName: program?.displayName,
          assignment,
          questFlags,
          fallbackDarrelId: null,
        });
        return (
          <VillagerNpc
            key={villager.id}
            villager={villager}
            reaction={reaction}
            clockMs={reaction ? clockMs : 0}
            isPlayerInside={false}
            isQuestDevModeEnabled={isQuestDevModeEnabled}
            questRole={isDarrel ? "quest-giver" : program?.role ?? "villager"}
            isDarrel={isDarrel}
          />
        );
      })}
    </group>
  );
}
