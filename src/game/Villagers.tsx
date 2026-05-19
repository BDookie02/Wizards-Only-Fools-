import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CharacterCustomization, useGameStore } from "../store/gameStore";
import { getHutList, type HutInfo } from "./Huts";
import { AvatarBillboard, NPC_AVATAR_GROUND_LIFT, NPC_AVATAR_SCALE } from "./PixelAvatar";
import { isMobilePerformanceMode } from "./performanceMode";

interface VillagerInfo {
  id: string;
  hut: HutInfo;
  character: CharacterCustomization;
  x: number;
  y: number;
  z: number;
  baseYaw: number;
}

interface ReactionState {
  startedAt: number;
  startledUntil: number;
  angryUntil: number;
}

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

let villagerAudioContext: AudioContext | null = null;

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
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
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

  const localPlayerPos = (window as any).localPlayerPos;
  if (localPlayerPos) {
    considerPosition(localPlayerPos.x, localPlayerPos.y, localPlayerPos.z);
  }

  const remotePlayers = useGameStore.getState().players;
  for (const player of Object.values(remotePlayers)) {
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

const VillagerNpc = memo(function VillagerNpc({
  villager,
  reaction,
  clockMs,
  isPlayerInside,
}: {
  villager: VillagerInfo;
  reaction?: ReactionState;
  clockMs: number;
  isPlayerInside: boolean;
}) {
  const [lookYaw, setLookYaw] = useState(villager.baseYaw);
  const lookYawRef = useRef(villager.baseYaw);
  const lastLookUpdateRef = useRef(0);
  const lookUpdateInterval = useMemo(() => (isMobilePerformanceMode() ? 220 : 140) + Math.random() * 90, []);
  const phase = reaction && clockMs < reaction.startledUntil ? "startled" : isPlayerInside || (reaction && clockMs < reaction.angryUntil) ? "angry" : "idle";
  const jumpProgress = reaction ? THREE.MathUtils.clamp((clockMs - reaction.startedAt) / 650, 0, 1) : 1;
  const jumpOffset = phase === "startled" ? Math.sin(jumpProgress * Math.PI) * 0.55 : 0;
  const character = useMemo<CharacterCustomization>(() => {
    if (phase === "startled") {
      return { ...villager.character, eyeStyle: "terrified", mouthStyle: "open" };
    }
    if (phase === "angry") {
      return { ...villager.character, eyeStyle: "angry", mouthStyle: "frown" };
    }
    return villager.character;
  }, [phase, villager.character]);

  useFrame(() => {
    const now = performance.now();
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
      <AvatarBillboard character={character} animation={phase} yaw={lookYaw} health={100} />
    </group>
  );
}, (previous, next) => (
  previous.villager === next.villager &&
  previous.reaction === next.reaction &&
  previous.clockMs === next.clockMs &&
  previous.isPlayerInside === next.isPlayerInside
));

export function Villagers({
  huts,
  name = "villagers",
}: {
  huts?: HutInfo[];
  name?: string;
} = {}) {
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const defaultHuts = useMemo(() => getHutList(), []);
  const activeHuts = huts ?? defaultHuts;
  const villagers = useMemo(() => activeHuts.map((hut, index) => makeVillager(hut, index)), [activeHuts]);
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
  const [clockMs, setClockMs] = useState(() => performance.now());
  const [reactions, setReactions] = useState<Record<string, ReactionState>>({});
  const visibleIdsRef = useRef(visibleIds);
  const insideHutIdRef = useRef<string | null>(null);
  const reactionsRef = useRef(reactions);
  const lastTriggeredRef = useRef<Record<string, number>>({});
  const lastVisibilityUpdateRef = useRef(0);
  const lastReactionTickRef = useRef(0);
  const cameraPositionRef = useRef(new THREE.Vector3());
  const renderDistance = mobilePerformanceMode ? 58 : 90;

  useEffect(() => {
    visibleIdsRef.current = visibleIds;
  }, [visibleIds]);

  useEffect(() => {
    reactionsRef.current = reactions;
  }, [reactions]);

  useFrame((state) => {
    const now = performance.now();
    state.camera.getWorldPosition(cameraPositionRef.current);
    const playerPos = cameraPositionRef.current;

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

    if (now - lastVisibilityUpdateRef.current > 350) {
      lastVisibilityUpdateRef.current = now;
      const renderDistanceSq = renderDistance * renderDistance;
      const visibilityRadiusCells = Math.ceil(renderDistance / VILLAGER_SPATIAL_CELL_SIZE) + 1;
      const nextVisible = new Set<string>();

      visitNearbyVillagers(villagerCells, playerPos.x, playerPos.z, visibilityRadiusCells, (villager) => {
        const dx = playerPos.x - villager.x;
        const dz = playerPos.z - villager.z;
        if (dx * dx + dz * dz < renderDistanceSq || reactionsRef.current[villager.id]) {
          nextVisible.add(villager.id);
        }
      });

      if (!sameSet(nextVisible, visibleIdsRef.current)) {
        setVisibleIds(nextVisible);
      }
    }

    if (Object.keys(reactionsRef.current).length > 0 && now - lastReactionTickRef.current > 80) {
      lastReactionTickRef.current = now;
      setClockMs(now);
      setReactions((current) => {
        let changed = false;
        const next: Record<string, ReactionState> = {};
        for (const [id, reaction] of Object.entries(current)) {
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
        return (
          <VillagerNpc
            key={villager.id}
            villager={villager}
            reaction={reaction}
            clockMs={reaction || isPlayerInside ? clockMs : 0}
            isPlayerInside={isPlayerInside}
          />
        );
      })}
    </group>
  );
}
