import React, { useMemo, useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RigidBody } from "@react-three/rapier";
import { getHutList } from "./Huts";
import { getNearbySurvivalDesertManaWells, getTerrainHeight, type SurvivalManaWellSource } from "./GameWorld";
import { RUNE_POWER_MAX, SURVIVAL_BLOCK_SIZE, useGameStore } from "../store/gameStore";
import { isMobilePerformanceMode } from "./performanceMode";
import { socket } from "../lib/socket";

export function Runes() {
  const [manaPulses, setManaPulses] = useState<{ id: number; playerId: string }[]>([]);
  const [desertWellSources, setDesertWellSources] = useState<SurvivalManaWellSource[]>([]);
  const lastWellChunkRef = useRef("");
  const hutPositions = useMemo(() => {
    return getHutList().map(h => ({
      id: h.id,
      x: h.x,
      y: h.y,
      z: h.z
    }));
  }, []);

  const [activeRunes, setActiveRunes] = useState<string[]>([]);
  const spawnManaPulse = (playerId = socket.id || "local") => {
    setManaPulses((current) => [...current.slice(-5), { id: performance.now() + Math.random(), playerId }]);
  };
  const broadcastManaPulse = () => {
    if (socket.connected) {
      const playerPos = (window as any).localPlayerPos;
      socket.emit("castSpell", {
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

  useEffect(() => {
    let previousRunes = new Set<string>();

    const cycleRunes = () => {
      // Find all huts that didn't have runes in the previous interval
      let availableHuts = hutPositions.filter((h) => !previousRunes.has(h.id));
      
      const targetCount = Math.floor(hutPositions.length * (2 / 3));

      // If availableHuts is smaller than targetCount because of some reason, add random huts to make up
      if (availableHuts.length < targetCount) {
         availableHuts = [...hutPositions];
      }
      
      // Shuffle availableHuts
      const shuffled = [...availableHuts].sort(() => Math.random() - 0.5);
      
      const newActive = shuffled.slice(0, targetCount).map((h) => h.id);
      
      setActiveRunes(newActive);
      previousRunes = new Set(newActive);
    };

    cycleRunes(); // initial
    const interval = setInterval(cycleRunes, 15000);
    return () => clearInterval(interval);
  }, [hutPositions]);

  useFrame(() => {
    const playerPos = (window as any).localPlayerPos as { x: number; z: number } | undefined;
    if (!playerPos) return;

    const chunkX = Math.floor((playerPos.x + SURVIVAL_BLOCK_SIZE / 2) / SURVIVAL_BLOCK_SIZE);
    const chunkZ = Math.floor((playerPos.z + SURVIVAL_BLOCK_SIZE / 2) / SURVIVAL_BLOCK_SIZE);
    const chunkKey = `${chunkX}:${chunkZ}`;
    if (chunkKey === lastWellChunkRef.current) return;

    lastWellChunkRef.current = chunkKey;
    setDesertWellSources(getNearbySurvivalDesertManaWells(playerPos.x, playerPos.z));
  });

  useEffect(() => {
    const handleRemoteManaPulse = (event: Event) => {
      const playerId = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (!playerId) return;
      spawnManaPulse(playerId);
    };

    window.addEventListener("manaPulse", handleRemoteManaPulse);
    return () => window.removeEventListener("manaPulse", handleRemoteManaPulse);
  }, []);

  const collectRune = (id: string) => {
    const didRecharge = rechargeMostEmptyManaBar();
    if (!didRecharge) return;

    showAndBroadcastManaPulse();
    setActiveRunes((prev) => prev.filter((r) => r !== id));
  };

  return (
    <group>
      <InfiniteManaSpawner onRecharge={showAndBroadcastManaPulse} />
      {desertWellSources.map((source) => (
        <InfiniteManaSpawner
          key={source.id}
          source={source}
          variant="well"
          onRecharge={showAndBroadcastManaPulse}
        />
      ))}
      {manaPulses.map((pulse) => (
        <ManaPickupPulse
          key={pulse.id}
          playerId={pulse.playerId}
          onDone={() => setManaPulses((current) => current.filter((item) => item.id !== pulse.id))}
        />
      ))}
      {activeRunes.map((id, index) => {
        const hut = hutPositions.find((h) => h.id === id);
        if (!hut) return null;
        return <Rune key={index} hut={hut} onCollect={() => collectRune(id)} />;
      })}
    </group>
  );
}

const runeGeometry = new THREE.OctahedronGeometry(0.4, 0);
const runeMaterial = new THREE.MeshStandardMaterial({ color: "#9400D3", emissive: "#9400D3", emissiveIntensity: 2, toneMapped: false });
const infiniteRuneMaterial = new THREE.MeshStandardMaterial({ color: "#ff4fd8", emissive: "#ff4fd8", emissiveIntensity: 3, toneMapped: false, transparent: true, opacity: 0.85 });

function isPlayerManaCollector(event: { other: { rigidBodyObject?: { name?: string } | null } }) {
  return event.other.rigidBodyObject?.name === "player";
}

function getManaPulseTargetPosition(playerId: string) {
  if (playerId === "local" || playerId === socket.id) {
    return (window as any).localPlayerPos as { x: number; y: number; z: number } | undefined;
  }

  const player = useGameStore.getState().players[playerId];
  if (!player) return undefined;
  return { x: player.pos[0], y: player.pos[1], z: player.pos[2] };
}

function ManaPickupPulse({ playerId, onDone }: { playerId: string; onDone: () => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRefs = useRef<THREE.Mesh[]>([]);
  const materialRefs = useRef<THREE.MeshBasicMaterial[]>([]);
  const startedAtRef = useRef(performance.now());
  const finishedRef = useRef(false);

  useFrame(() => {
    const group = groupRef.current;
    const playerPos = getManaPulseTargetPosition(playerId);
    if (group && playerPos) {
      group.position.set(playerPos.x, playerPos.y, playerPos.z);
      group.visible = true;
    } else if (group) {
      group.visible = false;
    }

    const progress = (performance.now() - startedAtRef.current) / 950;
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

function Rune({ hut, onCollect }: { hut: { id: string; x: number; y: number; z: number }; onCollect: () => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<any>(null);
  const startY = 0.6;

  useEffect(() => {
    if (bodyRef.current) {
        bodyRef.current.setTranslation({ x: hut.x, y: hut.y, z: hut.z }, true);
    }
  }, [hut.x, hut.y, hut.z]);

  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 2;
      ref.current.rotation.x += delta * 1.5;
      ref.current.position.y = Math.sin(state.clock.elapsedTime * 3) * 0.2;
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
  variant = "bonfire",
}: {
  onRecharge: () => void;
  source?: InfiniteManaSource;
  variant?: "bonfire" | "well";
}) {
  const ref = useRef<THREE.Group>(null);
  const cooldownRef = useRef(0);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const position = useMemo(() => {
    if (source) return source;
    const x = 11.5;
    const z = 31.5;
    return { id: "bonfire-mana-spawner", x, y: getTerrainHeight(x, z), z, radius: 2.6 };
  }, [source]);

  useFrame((state, delta) => {
    cooldownRef.current = Math.max(0, cooldownRef.current - delta);

    if (ref.current) {
      ref.current.rotation.y -= delta * (variant === "well" ? 0.72 : 1.4);
      ref.current.position.y = (variant === "well" ? 0.45 : 0.72) + Math.sin(state.clock.elapsedTime * 2.4) * 0.12;
      ref.current.scale.setScalar((variant === "well" ? 1.8 : 1) + Math.sin(state.clock.elapsedTime * 4) * 0.05);
    }

    const playerPos = (window as any).localPlayerPos;
    if (!playerPos || cooldownRef.current > 0) return;

    const distance = Math.hypot(playerPos.x - position.x, playerPos.z - position.z);
    if (distance < position.radius && rechargeMostEmptyManaBar()) {
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
