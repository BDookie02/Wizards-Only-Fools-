import { useEffect, useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sanitizePlayerName, useGameStore, PlayerState, SpellType, HandType, StatusEffectType } from "../store/gameStore";
import { socket } from "../lib/socket";
import { RigidBody, CapsuleCollider, BallCollider, RapierRigidBody } from "@react-three/rapier";
import { Html } from "@react-three/drei";
import { AvatarBillboard, normalizeCharacterCustomization } from "./PixelAvatar";

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function getPlayerDisplayName(player?: Pick<PlayerState, "id" | "playerName"> | null) {
  return sanitizePlayerName(player?.playerName || "") || `Wizard ${player?.id?.slice(0, 4).toUpperCase() || "????"}`;
}

function safeHexColor(value: string | undefined, fallback: string) {
  return value && HEX_COLOR_PATTERN.test(value) ? value : fallback;
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash || 1);
}

function RagdollPart({
  name,
  position,
  rotation,
  color,
  radius,
  halfHeight = 0,
  velocity,
  angularVelocity,
  shape,
}: {
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  color: string;
  radius: number;
  halfHeight?: number;
  velocity: { x: number; y: number; z: number };
  angularVelocity: { x: number; y: number; z: number };
  shape: "ball" | "capsule";
}) {
  const body = useRef<RapierRigidBody>(null);
  const hasAppliedImpulse = useRef(false);

  useEffect(() => {
    if (hasAppliedImpulse.current) return;
    hasAppliedImpulse.current = true;
    body.current?.setLinvel(velocity, true);
    body.current?.setAngvel(angularVelocity, true);
  }, [angularVelocity, velocity]);

  return (
    <RigidBody
      ref={body}
      name={name}
      type="dynamic"
      colliders={false}
      position={position}
      rotation={rotation}
      linearDamping={0.62}
      angularDamping={0.74}
      restitution={0.1}
      friction={1.25}
      canSleep
    >
      {shape === "ball" ? (
        <>
          <BallCollider args={[radius]} />
          <mesh castShadow>
            <sphereGeometry args={[radius, 10, 8]} />
            <meshStandardMaterial color={color} roughness={0.85} />
          </mesh>
        </>
      ) : (
        <>
          <CapsuleCollider args={[halfHeight, radius]} />
          <mesh castShadow>
            <capsuleGeometry args={[radius, halfHeight * 2, 4, 8]} />
            <meshStandardMaterial color={color} roughness={0.86} />
          </mesh>
        </>
      )}
    </RigidBody>
  );
}

function RemoteRagdoll({
  id,
  pos,
  yaw,
  character,
}: {
  id: string;
  pos: [number, number, number];
  yaw: number;
  character?: PlayerState["character"];
}) {
  const style = normalizeCharacterCustomization(character);
  const skinColor = safeHexColor(style.skinColor, "#d6cf91");
  const topColor = safeHexColor(style.topColor, "#3b82f6");
  const pantsColor = safeHexColor(style.pantsColor, "#334155");
  const shoesColor = safeHexColor(style.shoesColor, "#1f2937");
  const seed = useMemo(() => hashString(id), [id]);
  const tumble = useMemo(() => {
    const angle = yaw + ((seed % 17) - 8) * 0.045;
    const push = 1.3 + (seed % 7) * 0.12;
    return {
      vx: Math.sin(angle) * push,
      vz: -Math.cos(angle) * push,
      spinX: 1.4 + (seed % 5) * 0.25,
      spinY: 0.7 + (seed % 3) * 0.3,
      spinZ: 1.2 + (seed % 11) * 0.16,
    };
  }, [seed, yaw]);

  const baseX = pos[0];
  const baseY = pos[1];
  const baseZ = pos[2];
  const baseVelocity = { x: tumble.vx, y: 1.15, z: tumble.vz };

  return (
    <group>
      <RagdollPart
        name={`ragdoll_${id}_torso`}
        shape="capsule"
        color={topColor}
        radius={0.23}
        halfHeight={0.34}
        position={[baseX, baseY + 0.68, baseZ]}
        rotation={[Math.PI / 2.8, yaw, 0.35]}
        velocity={baseVelocity}
        angularVelocity={{ x: tumble.spinX, y: tumble.spinY, z: tumble.spinZ }}
      />
      <RagdollPart
        name={`ragdoll_${id}_head`}
        shape="ball"
        color={skinColor}
        radius={0.25}
        position={[baseX + Math.sin(yaw) * 0.08, baseY + 1.28, baseZ - Math.cos(yaw) * 0.08]}
        rotation={[0, yaw, 0]}
        velocity={{ x: tumble.vx * 1.25, y: 1.55, z: tumble.vz * 1.25 }}
        angularVelocity={{ x: tumble.spinZ, y: tumble.spinX, z: tumble.spinY }}
      />
      <RagdollPart
        name={`ragdoll_${id}_left_arm`}
        shape="capsule"
        color={skinColor}
        radius={0.075}
        halfHeight={0.28}
        position={[baseX - Math.cos(yaw) * 0.34, baseY + 0.72, baseZ - Math.sin(yaw) * 0.34]}
        rotation={[0.45, yaw, Math.PI / 2.2]}
        velocity={{ x: tumble.vx - 0.55, y: 1.1, z: tumble.vz }}
        angularVelocity={{ x: -tumble.spinY, y: tumble.spinZ, z: tumble.spinX }}
      />
      <RagdollPart
        name={`ragdoll_${id}_right_arm`}
        shape="capsule"
        color={skinColor}
        radius={0.075}
        halfHeight={0.28}
        position={[baseX + Math.cos(yaw) * 0.34, baseY + 0.72, baseZ + Math.sin(yaw) * 0.34]}
        rotation={[-0.45, yaw, -Math.PI / 2.2]}
        velocity={{ x: tumble.vx + 0.55, y: 1.18, z: tumble.vz }}
        angularVelocity={{ x: tumble.spinY, y: -tumble.spinZ, z: -tumble.spinX }}
      />
      <RagdollPart
        name={`ragdoll_${id}_left_leg`}
        shape="capsule"
        color={pantsColor}
        radius={0.09}
        halfHeight={0.34}
        position={[baseX - Math.cos(yaw) * 0.17, baseY + 0.18, baseZ - Math.sin(yaw) * 0.17]}
        rotation={[0.3, yaw, Math.PI / 12]}
        velocity={{ x: tumble.vx - 0.22, y: 0.85, z: tumble.vz }}
        angularVelocity={{ x: tumble.spinX * 0.8, y: tumble.spinZ, z: tumble.spinY }}
      />
      <RagdollPart
        name={`ragdoll_${id}_right_leg`}
        shape="capsule"
        color={pantsColor}
        radius={0.09}
        halfHeight={0.34}
        position={[baseX + Math.cos(yaw) * 0.17, baseY + 0.18, baseZ + Math.sin(yaw) * 0.17]}
        rotation={[-0.3, yaw, -Math.PI / 12]}
        velocity={{ x: tumble.vx + 0.22, y: 0.9, z: tumble.vz }}
        angularVelocity={{ x: -tumble.spinX * 0.8, y: tumble.spinZ, z: -tumble.spinY }}
      />
      <RagdollPart
        name={`ragdoll_${id}_left_foot`}
        shape="capsule"
        color={shoesColor}
        radius={0.07}
        halfHeight={0.16}
        position={[baseX - Math.cos(yaw) * 0.22, baseY - 0.17, baseZ - Math.sin(yaw) * 0.22]}
        rotation={[Math.PI / 2, yaw, 0]}
        velocity={{ x: tumble.vx - 0.16, y: 0.45, z: tumble.vz }}
        angularVelocity={{ x: tumble.spinY, y: tumble.spinX, z: tumble.spinZ }}
      />
      <RagdollPart
        name={`ragdoll_${id}_right_foot`}
        shape="capsule"
        color={shoesColor}
        radius={0.07}
        halfHeight={0.16}
        position={[baseX + Math.cos(yaw) * 0.22, baseY - 0.17, baseZ + Math.sin(yaw) * 0.22]}
        rotation={[Math.PI / 2, yaw, 0]}
        velocity={{ x: tumble.vx + 0.16, y: 0.45, z: tumble.vz }}
        angularVelocity={{ x: -tumble.spinY, y: tumble.spinX, z: -tumble.spinZ }}
      />
    </group>
  );
}

function SleepZzz() {
  const group = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    group.current.position.y = 0.42 + Math.sin(t * 2.2) * 0.08;
    group.current.position.x = Math.sin(t * 1.4) * 0.12;
  });

  return (
    <group ref={group} position={[0, 0.42, -1.05]}>
      <Html center className="pointer-events-none select-none">
        <div className="flex flex-col items-center gap-0.5 text-sky-100 drop-shadow-[0_0_10px_rgba(125,211,252,0.9)]">
          <span className="text-[10px] font-black uppercase tracking-[0.22em] opacity-60">z</span>
          <span className="text-xs font-black uppercase tracking-[0.24em] opacity-80">zz</span>
          <span className="rounded border border-sky-200/70 bg-slate-950/70 px-2 py-1 text-sm font-black uppercase tracking-[0.28em] shadow-[0_0_14px_rgba(125,211,252,0.7)]">
            zzzz
          </span>
        </div>
      </Html>
    </group>
  );
}

function RemotePlayer({ id }: { id: string }) {
  const health = useGameStore(s => s.players[id]?.health);
  const pos = useGameStore(s => s.players[id]?.pos ?? ([0, 0, 0] as [number, number, number]));
  const armor = useGameStore(s => s.players[id]?.armor ?? 0);
  const slowUntil = useGameStore(s => s.players[id]?.slowUntil ?? 0);
  const sleepUntil = useGameStore(s => s.players[id]?.sleepUntil ?? 0);
  const poisonUntil = useGameStore(s => s.players[id]?.poisonUntil ?? 0);
  const acidUntil = useGameStore(s => s.players[id]?.acidUntil ?? 0);
  const character = useGameStore(s => s.players[id]?.character);
  const animation = useGameStore(s => s.players[id]?.anim ?? "idle");
  const yaw = useGameStore(s => s.players[id]?.rot?.[1] ?? 0);
  const isSpeaking = useGameStore(s => s.players[id]?.isSpeaking ?? false);
  const [clock, setClock] = useState(() => Date.now());
  const group = useRef<THREE.Group>(null);
  const rigidBody = useRef<any>(null);
  const targetPosition = useRef(new THREE.Vector3());
  const playerRadius = 0.5;
  const playerHalfHeight = 0.65;
  const isSlowed = slowUntil > clock;
  const isSleeping = sleepUntil > clock;
  const isPoisoned = poisonUntil > clock;
  const isAcidic = acidUntil > clock;
  const isDead = (health ?? 100) <= 0;
  const displayAnimation = isSleeping ? "sleep" : animation;

  useEffect(() => {
    if (!isSlowed && !isSleeping && !isPoisoned && !isAcidic) return;

    const interval = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [isAcidic, isPoisoned, isSleeping, isSlowed]);

  useFrame(() => {
    const player = useGameStore.getState().players[id];
    if (!group.current || !player) return;
    // Interpolate towards target position and rotation
    targetPosition.current.fromArray(player.pos);
    group.current.position.lerp(targetPosition.current, 0.3);
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, player.rot[1], 0.3);
    
    if (rigidBody.current) {
        // keep rigid body synced with the exact visual location of the player
        rigidBody.current.setTranslation(group.current.position, true);
    }
  });

  if (isDead) {
    return <RemoteRagdoll id={id} pos={pos} yaw={yaw} character={character} />;
  }

  return (
    <group ref={group}>
      <RigidBody ref={rigidBody} name={`remote_player_${id}`} type="kinematicPosition" colliders={false}>
          <CapsuleCollider args={[playerHalfHeight, playerRadius]} />
      </RigidBody>
      <AvatarBillboard
        character={character}
        animation={displayAnimation}
        yaw={yaw}
        health={health ?? 100}
        isSpeaking={isSpeaking}
        pose={isSleeping ? "floor" : "standing"}
      />
      {armor > 0 && !isSleeping && (
        <mesh position={[0, 0, 0]}>
          <capsuleGeometry args={[playerRadius + 0.08, playerHalfHeight * 2 + 0.05, 8, 16]} />
          <meshBasicMaterial color="#4dc3ff" transparent opacity={0.2} depthWrite={false} />
        </mesh>
      )}
      {(isPoisoned || isAcidic) && !isSleeping && (
        <mesh position={[0, 0, 0]}>
          <capsuleGeometry args={[playerRadius + 0.14, playerHalfHeight * 2 + 0.12, 8, 16]} />
          <meshBasicMaterial
            color={isPoisoned ? "#a855f7" : "#22c55e"}
            transparent
            opacity={0.25}
            depthWrite={false}
          />
        </mesh>
      )}
      {isSlowed && (
        <group position={[0, -0.82, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.68, 0.06, 6, 18]} />
            <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.25} />
          </mesh>
          <mesh position={[0.42, 0.05, 0.15]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.35} />
          </mesh>
          <mesh position={[-0.35, 0.04, -0.2]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.35} />
          </mesh>
        </group>
      )}
      {isSleeping && (
        <SleepZzz />
      )}
    </group>
  );
}

// Spells
interface ActiveSpell {
  id: string; // unique
  creatorId: string;
  type: SpellType;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  damage: number;
  life: number;
  hand?: HandType;
}

export function NetworkManager() {
  const playerIdsStr = useGameStore(s => Object.keys(s.players).join(','));
  const playerIds = useMemo(() => playerIdsStr.split(',').filter(Boolean), [playerIdsStr]);
  
  const setPlayers = useGameStore(s => s.setPlayers);
  const addPlayer = useGameStore(s => s.addPlayer);
  const removePlayer = useGameStore(s => s.removePlayer);
  const updatePlayer = useGameStore(s => s.updatePlayer);
  const setCharacterCustomization = useGameStore(s => s.setCharacterCustomization);
  const localPlayerName = useGameStore(s => s.localPlayerName);
  const survivalLevel = useGameStore(s => s.survivalLevel);
  const addLobbyMessage = useGameStore(s => s.addLobbyMessage);
  const health = useGameStore(s => s.health);
  const setStatusEffect = useGameStore(s => s.setStatusEffect);
  const respawnLocalPlayer = useGameStore(s => s.respawn);

  const [room, setRoom] = useState("");
  const [spells, setSpells] = useState<ActiveSpell[]>([]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const urlParams = url.searchParams;
    const r = urlParams.get("room")?.trim() ?? "";
    if (!r) {
      setRoom("");
      if (socket.connected) socket.disconnect();
      addLobbyMessage("Enter an invite code to create or join a multiplayer lobby", "system");
      return;
    }
    setRoom(r);

    const playerName = sanitizePlayerName(localPlayerName);
    if (!playerName) {
      if (socket.connected) socket.disconnect();
      return;
    }

    const handleRoomState = (s: PlayerState[]) => {
      const localPlayer = s.find(p => p.id === socket.id);
      if (localPlayer?.character) {
        setCharacterCustomization(localPlayer.character);
      }
      setPlayers(s.filter(p => p.id !== socket.id)); // exclude self
      addLobbyMessage(`You joined ${r} as ${getPlayerDisplayName(localPlayer ?? { id: socket.id || "", playerName })}`, "system");
    };

    const handleJoinRejected = ({ reason }: { reason?: string }) => {
      const message = reason === "name-required"
        ? "Set a wizard name before joining a lobby"
        : "Enter an invite code before joining a lobby";
      setPlayers([]);
      addLobbyMessage(message, "system");
      socket.disconnect();
    };

    const handlePlayerJoined = (p: PlayerState) => {
      addPlayer(p);
      addLobbyMessage(`${getPlayerDisplayName(p)} joined the lobby`, "join");
    };

    const handlePlayerLeft = (id: string) => {
      removePlayer(id);
    };

    const handlePlayerMoved = (p: {id: string} & Partial<PlayerState>) => {
      updatePlayer(p.id, p);
    };

    const handlePlayerHealth = ({ id, health }: { id: string; health: number }) => {
      if (id === socket.id) {
        useGameStore.getState().setHealth(health);
      } else {
        updatePlayer(id, { health });
      }
    };

    const handlePlayerArmor = ({ id, armor }: { id: string; armor: number }) => {
      if (id === socket.id) {
        useGameStore.getState().setArmor(armor);
      } else {
        updatePlayer(id, { armor });
      }
    };

    const handlePlayerStatusEffect = ({ id, effect, until }: { id: string; effect: StatusEffectType; until: number }) => {
      if (id === socket.id) {
        setStatusEffect(effect, until);
      } else {
        updatePlayer(id, { [`${effect}Until`]: until } as Partial<PlayerState>);
      }
    };

    const handlePlayerStatusCleared = ({ id, effects }: { id: string; effects: StatusEffectType[] }) => {
      const safeEffects = Array.isArray(effects) ? effects : [];
      if (id === socket.id) {
        safeEffects.forEach((effect) => useGameStore.getState().clearStatusEffect(effect));
      } else {
        const updates = safeEffects.reduce((acc, effect) => ({ ...acc, [`${effect}Until`]: 0 }), {} as Partial<PlayerState>);
        updatePlayer(id, updates);
      }
    };

    const handlePlayerRespawn = ({ id, pos }: { id: string; pos: [number, number, number] }) => {
      if (id === socket.id) {
        respawnLocalPlayer();
        window.dispatchEvent(new CustomEvent("teleportPlayer", {
          detail: { x: pos[0], y: pos[1], z: pos[2] },
        }));
      } else {
        updatePlayer(id, {
          pos,
          health: 100,
          armor: 0,
          slowUntil: 0,
          sleepUntil: 0,
          poisonUntil: 0,
          acidUntil: 0,
        });
      }
    };

    const handlePlayerDied = ({ id, playerName: diedName }: { id: string; playerName?: string }) => {
      const player = id === socket.id
        ? { id, playerName }
        : useGameStore.getState().players[id] ?? { id, playerName: diedName };
      if (id === socket.id) {
        useGameStore.getState().setHealth(0);
      } else {
        updatePlayer(id, { health: 0 });
      }
      addLobbyMessage(id === socket.id ? "You were defeated" : `${getPlayerDisplayName(player)} was defeated`, "death");
    };

    const handleSpellCasted = ({ id, type, pos, dir, hand, grabId, grabPhase }: any) => {
      if (type === "__manaPulseAura") {
        window.dispatchEvent(new CustomEvent("manaPulse", { detail: { id } }));
        return;
      }

      const projectileId = type === "grab" && grabPhase === "cast" && grabId
        ? grabId
        : Math.random().toString(36).substring(7);

      useGameStore.getState().addProjectile({
        id: projectileId,
        creatorId: id,
        type,
        pos,
        dir,
        createdAt: Date.now(),
        hand: hand === "right" ? "right" : "left",
        grabId,
        grabPhase
      });
    };

    const handleManaPulse = ({ id }: { id?: string }) => {
      if (!id) return;
      window.dispatchEvent(new CustomEvent("manaPulse", { detail: { id } }));
    };

    const handleGrabControl = (data: any) => {
      window.dispatchEvent(new CustomEvent("grabControl", { detail: data }));
    };

    const handleGrabRelease = (data: any) => {
      window.dispatchEvent(new CustomEvent("releaseGrabPlayer", { detail: {
        casterId: data.id,
        grabId: data.grabId,
        dir: data.aimDir ?? data.dir,
        origin: data.origin,
      }}));
    };

    socket.on("roomState", handleRoomState);
    socket.on("joinRejected", handleJoinRejected);
    socket.on("playerJoined", handlePlayerJoined);
    socket.on("playerLeft", handlePlayerLeft);
    socket.on("playerMoved", handlePlayerMoved);
    socket.on("playerHealth", handlePlayerHealth);
    socket.on("playerArmor", handlePlayerArmor);
    socket.on("playerStatusEffect", handlePlayerStatusEffect);
    socket.on("playerStatusCleared", handlePlayerStatusCleared);
    socket.on("playerRespawn", handlePlayerRespawn);
    socket.on("playerDied", handlePlayerDied);
    socket.on("spellCasted", handleSpellCasted);
    socket.on("manaPulse", handleManaPulse);
    socket.on("grabControl", handleGrabControl);
    socket.on("grabRelease", handleGrabRelease);

    socket.connect();
    socket.emit("join", { roomCode: r, playerName, survivalLevel });

    return () => {
      socket.off("roomState", handleRoomState);
      socket.off("joinRejected", handleJoinRejected);
      socket.off("playerJoined", handlePlayerJoined);
      socket.off("playerLeft", handlePlayerLeft);
      socket.off("playerMoved", handlePlayerMoved);
      socket.off("playerHealth", handlePlayerHealth);
      socket.off("playerArmor", handlePlayerArmor);
      socket.off("playerStatusEffect", handlePlayerStatusEffect);
      socket.off("playerStatusCleared", handlePlayerStatusCleared);
      socket.off("playerRespawn", handlePlayerRespawn);
      socket.off("playerDied", handlePlayerDied);
      socket.off("spellCasted", handleSpellCasted);
      socket.off("manaPulse", handleManaPulse);
      socket.off("grabControl", handleGrabControl);
      socket.off("grabRelease", handleGrabRelease);
      socket.disconnect();
    };
  }, [addLobbyMessage, addPlayer, localPlayerName, removePlayer, setCharacterCustomization, setPlayers, setStatusEffect, survivalLevel, updatePlayer]);

  return (
    <>
      {playerIds.map(id => (
        <RemotePlayer key={id} id={id} />
      ))}
    </>
  );
}
