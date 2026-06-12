import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { CharacterCustomization, createDefaultQuestNpcProgram, type QuestNpcDescriptor, type QuestNpcRole, useGameStore } from "../store/gameStore";
import { getHutList, type HutInfo } from "./systems/world/villages/baseVillageHutLayout";
import { playVillagerYelp } from "./systems/world/villages/villagerAudioRuntime";
import { DARREL_CHARACTER, hashValue, makeVillager, type VillagerInfo } from "./systems/world/villages/villagerCharacterRuntime";
import { anchorQuestNpcProgram, getQuestTownId, getQuestVillagerDisplayName, hasQuestNpcAnchor, isDarrelName, isDarrelQuestAssignment, isDarrelVillagerIdentity, makePersistentQuestNpcVillager, makeQuestNpcEditorTarget } from "./systems/world/villages/villagerQuestRuntime";
import { angleDistance, getNearestPlayerFacingYaw, getTargetedVillager, getVillagerCellKey, isPlayerInsideHut, sameSet, VILLAGER_SPATIAL_CELL_SIZE, visitNearbyVillagers } from "./systems/world/villages/villagerSpatialRuntime";
import { AvatarBillboard, NPC_AVATAR_GROUND_LIFT, NPC_AVATAR_SCALE } from "./PixelAvatar";
import { isMobilePerformanceMode } from "./systems/input/performanceMode";
import { useLazyRef } from "./systems/react/useLazyRef";
import { getEpochMsFromRenderClock } from "./systems/rendering/renderClockEpoch";
import { getVillagerRuntimeNowMs } from "./systems/world/villages/villagerRuntime";

interface ReactionState {
  startedAt: number;
  startledUntil: number;
  angryUntil: number;
}

type QuestVillagerInteractDetail = {
  source?: string;
  handled?: boolean;
};

const VILLAGER_INSIDE_CHECK_INTERVAL_MS = 80;
const VILLAGER_INSIDE_CHECK_MOVE_EPSILON_SQ = 0.04;
const VILLAGER_RUNTIME_TICK_INTERVAL_MS = 50;
const EMPTY_ANCHORED_QUEST_NPC_IDS: ReadonlySet<string> = new Set<string>();

function isEditableDomTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}

function getReactionCount(reactions: Record<string, ReactionState>) {
  let count = 0;
  for (const id in reactions) {
    if (Object.prototype.hasOwnProperty.call(reactions, id)) count += 1;
  }
  return count;
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
