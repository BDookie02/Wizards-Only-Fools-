import React, { useCallback, useMemo, useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BallCollider, RigidBody } from "@react-three/rapier";
import { getHutList } from "./systems/world/villages/baseVillageHutLayout";
import { areSurvivalManaSourceResolversConfigured, getNearbySurvivalDesertManaWells, getNearbySurvivalManaFlowers, type SurvivalManaFlowerSource, type SurvivalManaWellSource } from "./systems/world/survival/survivalManaSources";
import { getBaseVillageTerrainHeight as getTerrainHeight } from "./systems/world/terrain/BaseVillageTerrain";
import {
  BASE_RUNE_SOURCE_CYCLE_INTERVAL_MS,
  MANA_FLOWER_RESPAWN_MS,
  getEpochMsFromManaRenderClock,
  getNextManaFlowerCooldownExpiry,
  pickActiveRuneIds,
  pruneManaFlowerCooldowns,
  publishManaFlowerQaDataset,
  shouldHideCurrentManaFlowersForQa,
  shouldReconcileManaSources,
  shouldShowBaseVillageRuneSources,
} from "./systems/spells/manaRechargeRuntime";
import { RUNE_POWER_MAX, SURVIVAL_BLOCK_SIZE, useGameStore } from "../store/gameStore";
import { isMobilePerformanceMode } from "./systems/input/performanceMode";
import {
  emitGameNetworkEvent,
  getLocalNetworkPlayerId,
  isLocalPresencePlayerId,
  isNetworkConnected,
} from "./network/gameNetworkClient";
import { getPublishedLocalPlayerPosition, type PlayerPositionLike } from "./systems/player/playerEventBridge";

type PlayerPositionRef = React.MutableRefObject<PlayerPositionLike | undefined>;
type BaseRuneHutPosition = { id: string; x: number; y: number; z: number };
const MOBILE_MANA_VISUAL_UPDATE_INTERVAL_SECONDS = 1 / 24;
const MOBILE_MANA_PULSE_VISUAL_UPDATE_INTERVAL_SECONDS = 1 / 30;
const MOBILE_RUNE_SOURCE_VISUAL_UPDATE_INTERVAL_SECONDS = 1 / 24;

function findBaseRuneHutPositionById(hutPositions: readonly BaseRuneHutPosition[], id: string) {
  for (let index = 0; index < hutPositions.length; index += 1) {
    const hut = hutPositions[index];
    if (hut.id === id) return hut;
  }
  return null;
}

export function Runes() {
  const [manaPulses, setManaPulses] = useState<{ id: number; playerId: string }[]>([]);
  const manaPulseIdRef = useRef(0);
  const [desertWellSources, setDesertWellSources] = useState<SurvivalManaWellSource[]>([]);
  const [manaFlowerSources, setManaFlowerSources] = useState<SurvivalManaFlowerSource[]>([]);
  const [collectedManaFlowers, setCollectedManaFlowers] = useState<Record<string, number>>({});
  const gameMode = useGameStore(s => s.gameMode);
  const manaSpawnRate = useGameStore(s => s.survivalRules.manaSpawnRate);
  const isSurvivalMode = gameMode === "solo-survival" || gameMode === "multiplayer-survival";
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const hideManaFlowersForQa = useMemo(() => shouldHideCurrentManaFlowersForQa(), []);
  const lastWellChunkRef = useRef("");
  const hutPositions = useMemo(() => {
    const huts = getHutList();
    const positions = new Array<BaseRuneHutPosition>(huts.length);
    for (let index = 0; index < huts.length; index += 1) {
      const hut = huts[index];
      positions[index] = {
        id: hut.id,
        x: hut.x,
        y: hut.y,
        z: hut.z
      };
    }
    return positions;
  }, []);

  const [activeRunes, setActiveRunes] = useState<string[]>([]);
  const [baseRuneSourcesVisible, setBaseRuneSourcesVisible] = useState(() => !isSurvivalMode);
  const baseRuneSourcesVisibleRef = useRef(baseRuneSourcesVisible);
  const latestManaEpochMsRef = useRef(0);
  const latestPlayerPositionRef = useRef<PlayerPositionLike | undefined>(undefined);
  const lastManaSourceReconcileAtRef = useRef(Number.NEGATIVE_INFINITY);
  const previousActiveRunesRef = useRef<Set<string>>(new Set());
  const lastBaseRuneCycleAtRef = useRef(Number.NEGATIVE_INFINITY);
  const getLatestManaEpochMs = () => latestManaEpochMsRef.current || Date.now();
  const setBaseRuneSourcesVisibility = useCallback((nextVisible: boolean) => {
    if (baseRuneSourcesVisibleRef.current === nextVisible) return;
    baseRuneSourcesVisibleRef.current = nextVisible;
    setBaseRuneSourcesVisible(nextVisible);
  }, []);
  const spawnManaPulse = (playerId = getLocalNetworkPlayerId()) => {
    const id = manaPulseIdRef.current;
    manaPulseIdRef.current += 1;
    setManaPulses((current) => {
      const maxPreviousPulses = 5;
      const startIndex = Math.max(0, current.length - maxPreviousPulses);
      const nextPulses = new Array<{ id: number; playerId: string }>(current.length - startIndex + 1);
      let writeIndex = 0;
      for (let index = startIndex; index < current.length; index += 1) {
        nextPulses[writeIndex] = current[index];
        writeIndex += 1;
      }
      nextPulses[writeIndex] = { id, playerId };
      return nextPulses;
    });
  };
  const broadcastManaPulse = () => {
    if (isNetworkConnected()) {
      const playerPos = latestPlayerPositionRef.current ?? getPublishedLocalPlayerPosition();
      emitGameNetworkEvent("castSpell", {
        type: "__manaPulseAura",
        pos: playerPos ? { x: playerPos.x, y: playerPos.y, z: playerPos.z } : { x: 0, y: 0, z: 0 },
        dir: { x: 0, y: 1, z: 0 },
      });
    }
  };
  const showAndBroadcastManaPulse = () => {
    spawnManaPulse();
    broadcastManaPulse();
  };

  const cycleBaseRuneSources = useCallback((nowMs: number) => {
    if (!baseRuneSourcesVisible) {
      return;
    }

    if (
      lastBaseRuneCycleAtRef.current !== Number.NEGATIVE_INFINITY &&
      nowMs - lastBaseRuneCycleAtRef.current < BASE_RUNE_SOURCE_CYCLE_INTERVAL_MS
    ) {
      return;
    }

    const newActive = pickActiveRuneIds(hutPositions, previousActiveRunesRef.current);
    setActiveRunes(newActive);
    previousActiveRunesRef.current.clear();
    for (let index = 0; index < newActive.length; index += 1) {
      previousActiveRunesRef.current.add(newActive[index]);
    }
    lastBaseRuneCycleAtRef.current = nowMs;
  }, [baseRuneSourcesVisible, hutPositions]);

  useEffect(() => {
    if (baseRuneSourcesVisible) {
      lastBaseRuneCycleAtRef.current = Number.NEGATIVE_INFINITY;
      return;
    }

    lastBaseRuneCycleAtRef.current = Number.NEGATIVE_INFINITY;
    previousActiveRunesRef.current.clear();
    setActiveRunes((current) => (current.length === 0 ? current : []));
  }, [baseRuneSourcesVisible, hutPositions]);

  const reconcileManaSources = useCallback((nowMs: number) => {
    latestManaEpochMsRef.current = nowMs;
    const playerPos = getPublishedLocalPlayerPosition() ?? latestPlayerPositionRef.current;
    latestPlayerPositionRef.current = playerPos;

    setBaseRuneSourcesVisibility(shouldShowBaseVillageRuneSources({
      isSurvivalMode,
      playerX: playerPos?.x,
      playerZ: playerPos?.z,
      blockSize: SURVIVAL_BLOCK_SIZE,
    }));
    if (!playerPos) return;

    const chunkX = Math.floor((playerPos.x + SURVIVAL_BLOCK_SIZE / 2) / SURVIVAL_BLOCK_SIZE);
    const chunkZ = Math.floor((playerPos.z + SURVIVAL_BLOCK_SIZE / 2) / SURVIVAL_BLOCK_SIZE);
    if (!isSurvivalMode) {
      const chunkKey = `${gameMode}:mana-disabled`;
      if (chunkKey === lastWellChunkRef.current) return;

      lastWellChunkRef.current = chunkKey;
      setDesertWellSources([]);
      setManaFlowerSources([]);
      return;
    }

    if (!areSurvivalManaSourceResolversConfigured()) return;

    const chunkKey = `${gameMode}:${manaSpawnRate}:${hideManaFlowersForQa ? "hide" : "show"}:${chunkX}:${chunkZ}`;
    if (chunkKey === lastWellChunkRef.current) return;

    lastWellChunkRef.current = chunkKey;
    setDesertWellSources(getNearbySurvivalDesertManaWells(playerPos.x, playerPos.z));
    setManaFlowerSources(
      !hideManaFlowersForQa
        ? getNearbySurvivalManaFlowers(playerPos.x, playerPos.z, manaSpawnRate)
        : [],
    );
  }, [gameMode, hideManaFlowersForQa, isSurvivalMode, manaSpawnRate, setBaseRuneSourcesVisibility]);

  useFrame(({ clock }) => {
    const nowMs = getEpochMsFromManaRenderClock(clock.elapsedTime);
    latestManaEpochMsRef.current = nowMs;
    cycleBaseRuneSources(nowMs);
    if (!shouldReconcileManaSources(nowMs, lastManaSourceReconcileAtRef.current)) return;
    lastManaSourceReconcileAtRef.current = nowMs;
    reconcileManaSources(nowMs);
  });

  useEffect(() => {
    const nextExpiry = getNextManaFlowerCooldownExpiry(collectedManaFlowers);
    if (!Number.isFinite(nextExpiry)) return;

    const delay = Math.max(0, Math.min(MANA_FLOWER_RESPAWN_MS, nextExpiry - getLatestManaEpochMs() + 50));
    const timeout = window.setTimeout(() => {
      setCollectedManaFlowers((current) => pruneManaFlowerCooldowns(current, getLatestManaEpochMs()));
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [collectedManaFlowers]);

  useEffect(() => {
    const handleRemoteManaPulse = (event: Event) => {
      const playerId = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (!playerId) return;
      spawnManaPulse(playerId);
    };

    window.addEventListener("manaPulse", handleRemoteManaPulse);
    return () => window.removeEventListener("manaPulse", handleRemoteManaPulse);
  }, []);

  useEffect(() => {
    publishManaFlowerQaDataset(manaFlowerSources, collectedManaFlowers, getLatestManaEpochMs());
  }, [collectedManaFlowers, manaFlowerSources]);

  const collectRune = (id: string) => {
    const didRecharge = rechargeMostEmptyManaBar();
    if (!didRecharge) return;

    showAndBroadcastManaPulse();
    setActiveRunes((prev) => {
      let removeIndex = -1;
      for (let index = 0; index < prev.length; index += 1) {
        if (prev[index] === id) {
          removeIndex = index;
          break;
        }
      }
      if (removeIndex === -1) return prev;
      const nextRunes = new Array<string>(prev.length - 1);
      let writeIndex = 0;
      for (let index = 0; index < prev.length; index += 1) {
        if (index === removeIndex) continue;
        nextRunes[writeIndex] = prev[index];
        writeIndex += 1;
      }
      return nextRunes;
    });
  };

  const collectManaFlower = (id: string, now: number) => {
    const didRecharge = rechargeMostEmptyManaBar();
    if (!didRecharge) return false;

    showAndBroadcastManaPulse();
    setCollectedManaFlowers((current) => ({
      ...current,
      [id]: now + MANA_FLOWER_RESPAWN_MS,
    }));
    if (typeof document !== "undefined") {
      document.documentElement.dataset.wofManaFlowerLastCollect = id;
    }
    return true;
  };

  return (
    <group>
      {baseRuneSourcesVisible && (
        <InfiniteManaSpawner
          playerPositionRef={latestPlayerPositionRef}
          onRecharge={showAndBroadcastManaPulse}
        />
      )}
      {desertWellSources.map((source) => (
        <InfiniteManaSpawner
          key={source.id}
          source={source}
          variant="well"
          playerPositionRef={latestPlayerPositionRef}
          onRecharge={showAndBroadcastManaPulse}
        />
      ))}
      {manaFlowerSources.map((source) => (
        <ManaFlower
          key={source.id}
          source={source}
          collectedUntil={collectedManaFlowers[source.id] ?? 0}
          playerPositionRef={latestPlayerPositionRef}
          onCollect={(now) => collectManaFlower(source.id, now)}
        />
      ))}
      {manaPulses.map((pulse) => (
        <ManaPickupPulse
          key={pulse.id}
          playerId={pulse.playerId}
          playerPositionRef={latestPlayerPositionRef}
          mobilePerformanceMode={mobilePerformanceMode}
          onDone={() => setManaPulses((current) => {
            let removeIndex = -1;
            for (let index = 0; index < current.length; index += 1) {
              if (current[index].id === pulse.id) {
                removeIndex = index;
                break;
              }
            }
            if (removeIndex === -1) return current;
            const nextPulses = new Array<{ id: number; playerId: string }>(current.length - 1);
            let writeIndex = 0;
            for (let index = 0; index < current.length; index += 1) {
              if (index === removeIndex) continue;
              nextPulses[writeIndex] = current[index];
              writeIndex += 1;
            }
            return nextPulses;
          })}
        />
      ))}
      {baseRuneSourcesVisible && activeRunes.map((id) => {
        const hut = findBaseRuneHutPositionById(hutPositions, id);
        if (!hut) return null;
        return <Rune key={id} hut={hut} mobilePerformanceMode={mobilePerformanceMode} onCollect={() => collectRune(id)} />;
      })}
    </group>
  );
}

const runeGeometry = new THREE.OctahedronGeometry(0.4, 0);
const runeMaterial = new THREE.MeshStandardMaterial({ color: "#9400D3", emissive: "#9400D3", emissiveIntensity: 2, toneMapped: false });
const infiniteRuneMaterial = new THREE.MeshStandardMaterial({ color: "#ff4fd8", emissive: "#ff4fd8", emissiveIntensity: 3, toneMapped: false, transparent: true, opacity: 0.85 });
const manaFlowerStemGeometry = new THREE.CylinderGeometry(0.09, 0.14, 1, 6);
const manaFlowerLeafGeometry = new THREE.ConeGeometry(0.26, 0.72, 5);
const manaFlowerStemMaterial = new THREE.MeshBasicMaterial({ color: "#52c15d", toneMapped: false });
const manaFlowerLeafMaterial = new THREE.MeshBasicMaterial({ color: "#72dd6f", toneMapped: false });
let cachedManaFlowerBillboardTexture: THREE.CanvasTexture | null = null;

function getManaFlowerBillboardTexture() {
  if (cachedManaFlowerBillboardTexture) return cachedManaFlowerBillboardTexture;
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createRadialGradient(64, 66, 4, 64, 66, 54);
  gradient.addColorStop(0, "rgba(244, 114, 255, 0.42)");
  gradient.addColorStop(0.52, "rgba(168, 85, 247, 0.2)");
  gradient.addColorStop(1, "rgba(168, 85, 247, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let petal = 0; petal < 7; petal += 1) {
    const angle = (petal / 7) * Math.PI * 2 - Math.PI * 0.5;
    const x = 64 + Math.cos(angle) * 24;
    const y = 66 + Math.sin(angle) * 22;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const petalGradient = ctx.createLinearGradient(-16, 0, 18, 0);
    petalGradient.addColorStop(0, "rgba(252, 231, 243, 0.9)");
    petalGradient.addColorStop(0.5, "rgba(244, 114, 182, 0.96)");
    petalGradient.addColorStop(1, "rgba(168, 85, 247, 0.88)");
    ctx.fillStyle = petalGradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, 21, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = "rgba(254, 240, 138, 0.98)";
  ctx.beginPath();
  ctx.arc(64, 66, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
  ctx.beginPath();
  ctx.arc(60, 61, 4, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.premultiplyAlpha = true;
  texture.needsUpdate = true;
  cachedManaFlowerBillboardTexture = texture;
  return texture;
}

function isPlayerManaCollector(event: { other: { rigidBodyObject?: { name?: string } | null } }) {
  return event.other.rigidBodyObject?.name === "player";
}

function getManaPulseTargetPosition(playerId: string, playerPositionRef: PlayerPositionRef) {
  if (isLocalPresencePlayerId(playerId)) {
    return playerPositionRef.current;
  }

  const player = useGameStore.getState().players[playerId];
  if (!player) return undefined;
  return { x: player.pos[0], y: player.pos[1], z: player.pos[2] };
}

function ManaPickupPulse({
  playerId,
  playerPositionRef,
  mobilePerformanceMode,
  onDone,
}: {
  playerId: string;
  playerPositionRef: PlayerPositionRef;
  mobilePerformanceMode: boolean;
  onDone: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRefs = useRef<THREE.Mesh[]>([]);
  const materialRefs = useRef<THREE.MeshBasicMaterial[]>([]);
  const startedClockAtRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const lastMobileVisualUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    if (startedClockAtRef.current === null) {
      startedClockAtRef.current = elapsed;
    }
    if (
      mobilePerformanceMode &&
      elapsed - lastMobileVisualUpdateAtRef.current < MOBILE_MANA_PULSE_VISUAL_UPDATE_INTERVAL_SECONDS
    ) {
      return;
    }
    lastMobileVisualUpdateAtRef.current = elapsed;

    const group = groupRef.current;
    const playerPos = getManaPulseTargetPosition(playerId, playerPositionRef);
    if (group && playerPos) {
      group.position.set(playerPos.x, playerPos.y, playerPos.z);
      group.visible = true;
    } else if (group) {
      group.visible = false;
    }

    const progress = (elapsed - startedClockAtRef.current) / 0.95;
    if (progress >= 1 && !finishedRef.current) {
      finishedRef.current = true;
      onDone();
      return;
    }

    for (let index = 0; index < ringRefs.current.length; index++) {
      const ringProgress = THREE.MathUtils.clamp(progress * 1.18 - index * 0.1, 0, 1);
      const mesh = ringRefs.current[index];
      const material = materialRefs.current[index];
      if (!mesh || !material) continue;

      mesh.position.y = 2.25 - ringProgress * 2.15;
      mesh.scale.setScalar(1 + Math.sin(ringProgress * Math.PI) * 0.38 + index * 0.06);
      material.opacity = Math.max(0, 0.62 * (1 - ringProgress) * (1 - index * 0.16));
    }
  });

  return (
    <group ref={groupRef} name="mana_pickup_pulse" visible={false}>
      {[0, 1, 2].map((index) => (
        <mesh
          key={index}
          ref={(node) => {
            if (node) ringRefs.current[index] = node;
          }}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.62 + index * 0.08, 0.026, 6, 28]} />
          <meshBasicMaterial
            ref={(material) => {
              if (material) materialRefs.current[index] = material;
            }}
            color={index === 0 ? "#f0abfc" : "#a855f7"}
            transparent
            opacity={0.62}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function rechargeMostEmptyManaBar() {
  const state = useGameStore.getState();
  const leftNeed = RUNE_POWER_MAX - state.leftRunePower;
  const rightNeed = RUNE_POWER_MAX - state.rightRunePower;

  if (leftNeed <= 0 && rightNeed <= 0) return false;

  if (leftNeed >= rightNeed) {
    state.setLeftRunePower(RUNE_POWER_MAX);
  } else {
    state.setRightRunePower(RUNE_POWER_MAX);
  }

  return true;
}

function Rune({
  hut,
  mobilePerformanceMode,
  onCollect,
}: {
  hut: { id: string; x: number; y: number; z: number };
  mobilePerformanceMode: boolean;
  onCollect: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<any>(null);
  const lastMobileVisualUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);
  const startY = 0.6;

  useEffect(() => {
    if (bodyRef.current) {
        bodyRef.current.setTranslation({ x: hut.x, y: hut.y, z: hut.z }, true);
    }
  }, [hut.x, hut.y, hut.z]);

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;
    const previousVisualUpdateAt = lastMobileVisualUpdateAtRef.current;
    if (
      mobilePerformanceMode &&
      elapsed - previousVisualUpdateAt < MOBILE_RUNE_SOURCE_VISUAL_UPDATE_INTERVAL_SECONDS
    ) {
      return;
    }
    lastMobileVisualUpdateAtRef.current = elapsed;
    const visualDelta = previousVisualUpdateAt === Number.NEGATIVE_INFINITY
      ? delta
      : elapsed - previousVisualUpdateAt;
    if (ref.current) {
      ref.current.rotation.y += visualDelta * 2;
      ref.current.rotation.x += visualDelta * 1.5;
      ref.current.position.y = Math.sin(elapsed * 3) * 0.2;
    }
  });

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders="hull"
      sensor
      position={[hut.x, hut.y, hut.z]}
      onIntersectionEnter={(e) => {
        if (isPlayerManaCollector(e)) {
          onCollect();
        }
      }}
    >
      <group position={[0, startY, 0]}>
         <mesh ref={ref} castShadow geometry={runeGeometry} material={runeMaterial} />
      </group>
    </RigidBody>
  );
}

function ManaFlower({
  source,
  collectedUntil,
  playerPositionRef,
  onCollect,
}: {
  source: SurvivalManaFlowerSource;
  collectedUntil: number;
  playerPositionRef: PlayerPositionRef;
  onCollect: (now: number) => boolean;
}) {
  const headRef = useRef<THREE.Sprite>(null);
  const glowRef = useRef<THREE.Sprite>(null);
  const collectedUntilRef = useRef(collectedUntil);
  const latestEpochMsRef = useRef(0);
  const lastMobileVisualUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const headTexture = useMemo(() => getManaFlowerBillboardTexture(), []);
  const radiusSq = useMemo(() => source.radius * source.radius, [source.radius]);
  const ready = collectedUntil <= 0;

  useEffect(() => {
    collectedUntilRef.current = collectedUntil;
  }, [collectedUntil]);

  const getLatestEpochMs = () => latestEpochMsRef.current || getEpochMsFromManaRenderClock(0);

  const tryCollect = (now = getLatestEpochMs()) => {
    if (collectedUntilRef.current > now) return;
    if (onCollect(now)) {
      collectedUntilRef.current = now + MANA_FLOWER_RESPAWN_MS;
    }
  };

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;
    const previousVisualUpdateAt = lastMobileVisualUpdateAtRef.current;
    const shouldUpdateVisuals =
      !mobilePerformanceMode ||
      elapsed - previousVisualUpdateAt >= MOBILE_MANA_VISUAL_UPDATE_INTERVAL_SECONDS;
    if (shouldUpdateVisuals) {
      lastMobileVisualUpdateAtRef.current = elapsed;
      const visualDelta = previousVisualUpdateAt === Number.NEGATIVE_INFINITY
        ? delta
        : elapsed - previousVisualUpdateAt;
      const head = headRef.current;
      const glow = glowRef.current;
      const localHeadY = source.stemHeight + 0.46 + Math.sin(elapsed * 2.9 + source.x * 0.01) * 0.06;
      const pulse = 1 + Math.sin(elapsed * 2.4 + source.x * 0.01) * 0.045;
      if (head) {
        head.position.y = localHeadY;
        head.scale.set(source.headScale * 1.42 * pulse, source.headScale * 1.42 * pulse, 1);
        const material = head.material as THREE.SpriteMaterial;
        material.rotation += visualDelta * 0.28;
      }
      if (glow) {
        glow.position.y = localHeadY;
        glow.scale.set(source.headScale * 2.05 * pulse, source.headScale * 2.05 * pulse, 1);
      }
    }

    const now = getEpochMsFromManaRenderClock(elapsed);
    latestEpochMsRef.current = now;
    if (collectedUntilRef.current > now) return;
    const playerPos = playerPositionRef.current;
    if (!playerPos) return;
    const dx = playerPos.x - source.x;
    const dz = playerPos.z - source.z;
    if (dx * dx + dz * dz < radiusSq) {
      tryCollect(now);
    }
  });

  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={[source.x, source.y, source.z]}
      name={source.id}
    >
      <BallCollider
        args={[source.radius]}
        position={[0, source.stemHeight * 0.6, 0]}
      sensor
      onIntersectionEnter={(event) => {
        if (isPlayerManaCollector(event)) {
          tryCollect();
        }
      }}
      />
      <group name="wilderness-mana-flower">
        <mesh
          castShadow={!mobilePerformanceMode}
          geometry={manaFlowerStemGeometry}
          material={manaFlowerStemMaterial}
          position={[0, source.stemHeight * 0.5, 0]}
          scale={[1, source.stemHeight, 1]}
        />
        {[0, 1, 2].map((leaf) => (
          <mesh
            key={leaf}
            castShadow={false}
            geometry={manaFlowerLeafGeometry}
            material={manaFlowerLeafMaterial}
            position={[
              Math.sin(leaf * Math.PI * 0.72) * 0.18,
              source.stemHeight * (0.34 + leaf * 0.13),
              Math.cos(leaf * Math.PI * 0.72) * 0.18,
            ]}
            rotation={[0.9, leaf * Math.PI * 0.72, 0.35]}
            scale={[0.72, 0.72, 0.72]}
          />
        ))}
        {ready && (
          <>
            <sprite
              ref={headRef}
              position={[0, source.stemHeight + 0.46, 0]}
              scale={[source.headScale * 1.42, source.headScale * 1.42, 1]}
              renderOrder={7}
            >
              <spriteMaterial
                map={headTexture ?? undefined}
                color="#ffffff"
                transparent
                opacity={0.96}
                depthWrite={false}
                depthTest
                toneMapped={false}
              />
            </sprite>
            <sprite
              ref={glowRef}
              position={[0, source.stemHeight + 0.46, 0]}
              scale={[source.headScale * 2.05, source.headScale * 2.05, 1]}
              renderOrder={6.9}
            >
              <spriteMaterial
                map={headTexture ?? undefined}
                color="#f0abfc"
                transparent
                opacity={0.18}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                depthTest
                toneMapped={false}
              />
            </sprite>
          </>
        )}
      </group>
    </RigidBody>
  );
}

type InfiniteManaSource = {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
};

function InfiniteManaSpawner({
  onRecharge,
  source,
  playerPositionRef,
  variant = "bonfire",
}: {
  onRecharge: () => void;
  source?: InfiniteManaSource;
  playerPositionRef: PlayerPositionRef;
  variant?: "bonfire" | "well";
}) {
  const ref = useRef<THREE.Group>(null);
  const cooldownRef = useRef(0);
  const lastMobileVisualUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const position = useMemo(() => {
    if (source) return source;
    const x = 11.5;
    const z = 31.5;
    return { id: "bonfire-mana-spawner", x, y: getTerrainHeight(x, z), z, radius: 2.6 };
  }, [source]);
  const radiusSq = useMemo(() => position.radius * position.radius, [position.radius]);

  useFrame((state, delta) => {
    cooldownRef.current = Math.max(0, cooldownRef.current - delta);

    const elapsed = state.clock.elapsedTime;
    const previousVisualUpdateAt = lastMobileVisualUpdateAtRef.current;
    const shouldUpdateVisuals =
      !mobilePerformanceMode ||
      elapsed - previousVisualUpdateAt >= MOBILE_MANA_VISUAL_UPDATE_INTERVAL_SECONDS;
    if (ref.current && shouldUpdateVisuals) {
      lastMobileVisualUpdateAtRef.current = elapsed;
      const visualDelta = previousVisualUpdateAt === Number.NEGATIVE_INFINITY
        ? delta
        : elapsed - previousVisualUpdateAt;
      ref.current.rotation.y -= visualDelta * (variant === "well" ? 0.72 : 1.4);
      ref.current.position.y = (variant === "well" ? 0.45 : 0.72) + Math.sin(elapsed * 2.4) * 0.12;
      ref.current.scale.setScalar((variant === "well" ? 1.8 : 1) + Math.sin(elapsed * 4) * 0.05);
    }

    const playerPos = playerPositionRef.current;
    if (!playerPos || cooldownRef.current > 0) return;

    const dx = playerPos.x - position.x;
    const dz = playerPos.z - position.z;
    if (dx * dx + dz * dz < radiusSq && rechargeMostEmptyManaBar()) {
      onRecharge();
      cooldownRef.current = 0.55;
    }
  });

  const handleRecharge = () => {
    if (rechargeMostEmptyManaBar()) {
      onRecharge();
      cooldownRef.current = 0.55;
    }
  };

  return (
    <RigidBody
      type="fixed"
      colliders="hull"
      sensor
      position={[position.x, position.y, position.z]}
      name={position.id}
      onIntersectionEnter={(e) => {
        if (isPlayerManaCollector(e)) {
          handleRecharge();
        }
      }}
    >
      <group ref={ref}>
        {variant === "bonfire" && <mesh castShadow geometry={runeGeometry} material={infiniteRuneMaterial} />}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[variant === "well" ? 1.85 : 0.78, variant === "well" ? 0.05 : 0.035, mobilePerformanceMode ? 6 : 8, mobilePerformanceMode ? 14 : 24]} />
          <meshBasicMaterial color={variant === "well" ? "#c084fc" : "#ffd6fb"} transparent opacity={variant === "well" ? 0.48 : 0.65} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        {variant === "well" && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.4, mobilePerformanceMode ? 12 : 20]} />
            <meshBasicMaterial color="#a855f7" transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        )}
        {!mobilePerformanceMode && <pointLight color="#ff4fd8" intensity={variant === "well" ? 2 : 3} distance={variant === "well" ? 10 : 7} />}
      </group>
    </RigidBody>
  );
}
