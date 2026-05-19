import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody, CapsuleCollider, useRapier, RapierRigidBody, interactionGroups } from "@react-three/rapier";
import * as THREE from "three";
import { ARMOR_MAX, DEFAULT_CONTROLLER_LOOK_SENSITIVITY, DEFAULT_MOUSE_SENSITIVITY, HandType, SpellType, SURVIVAL_BLOCK_SIZE, TOXIC_DAMAGE_PER_SECOND, TUNGSTON_SLOW_DURATION_MS, hasRunePower, useGameStore } from "../store/gameStore";
import { socket } from "../lib/socket";
import { getGamepadAxis, getPrimaryGamepad, isGamepadButtonPressed, type GamepadButtonName } from "./controllerInput";
import { recordNavigationSample } from "./navigationRecorder";

const SPEED = 8;
const JUMP_FORCE = 8;
const BOOST_FORCE = 6; // black ops 3 style double jump boost
const SLIDE_SPEED = 18;
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
const PLAYER_SLIDE_CAMERA_HEIGHT = 0.12;
const SPELL_SPAWN_FORWARD_OFFSET = 1.55;
const SPELL_SPAWN_VERTICAL_OFFSET = 0.08;
const DIRECT_STATUS_TARGET_RANGE = 48;
const DIRECT_STATUS_TARGET_RADIUS = 1.85;
const VCLIP_VERTICAL_SPEED = 10;
const VCLIP_SPRINT_MULTIPLIER = 3.2;
const CONTROLLER_ARM_BUTTON_THRESHOLD = 0.35;
const ASTRAL_EXIT_HOLD_MS = 5000;
const PLAYER_MEDITATION_CAMERA_HEIGHT = 0.58;
const QA_SURVIVAL_WALK_DECISION_SECONDS = 3.2;
const QA_SURVIVAL_WALK_PROBE_DISTANCE = 11.5;
const QA_SURVIVAL_WALK_TURN_OPTIONS = [0, 0.42, -0.42, 0.84, -0.84, 1.32, -1.32, Math.PI * 0.72, -Math.PI * 0.72];
const QA_SURVIVAL_STUCK_CHECK_SECONDS = 1.25;
const GRAB_MAX_DURATION_MS = 6000;
const GRAB_DEFAULT_DISTANCE = 10;
const GRAB_FOLLOW_SPEED = 18;
const GRAB_THROW_SPEED = 42;
const SELF_BUFF_SPELLS = new Set<SpellType>(['magicarmor', 'jumpboost', 'speedboost', 'magicglassorb']);

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
    !state.isMapExpanded &&
    !state.isScoreboardOpen &&
    state.health > 0;
}

function isMouseGameplayInputActive() {
  return Boolean(document.pointerLockElement || isMouseLookFallbackActive());
}

window.addEventListener("keydown", (e) => {
  if (isEditableTarget(e.target)) return;
  if (keys.hasOwnProperty(e.code)) {
    keys[e.code as keyof typeof keys] = true;
    if (
      e.code.startsWith("Arrow") &&
      useGameStore.getState().keyboardArrowLookEnabled &&
      (isMouseGameplayInputActive() || useGameStore.getState().isTouchControlsActive)
    ) {
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
};

const TEMP_MOUNTAIN_VILLAGE_SPAWN_CHUNK: [number, number] = [3, 0];
const TEMP_MOUNTAIN_VILLAGE_SPAWN_Y = 270;
const TEMP_MOUNTAIN_VILLAGE_SPAWN_LOCAL_Z = 62;
const DEFAULT_PLAYER_SPAWN_POSITION: [number, number, number] = [0, 5, 30];
const DEFAULT_FALL_RECOVERY_SPAWN_POSITION: [number, number, number] = [0, 15, 30];

function getSurvivalChunkSpawn(
  cx: number,
  cz: number,
  keyPrefix: string,
  options: { y?: number; localZ?: number } = {}
): QaSurvivalSpawn {
  return {
    key: `${keyPrefix}:${cx},${cz}`,
    position: [
      cx * SURVIVAL_BLOCK_SIZE,
      options.y ?? 140,
      cz * SURVIVAL_BLOCK_SIZE + (options.localZ ?? 214),
    ],
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
        return getSurvivalChunkSpawn(cx, cz, `qa:${decodedChunkParam}:${runKey}`);
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

  const gameMode = useGameStore.getState().gameMode;
  const shouldSpawnAtMountainVillage = (
    params.get("qaSurvival") === "1"
    || params.get("spawnMountain") === "1"
    || gameMode === "solo-survival"
    || gameMode === "multiplayer-survival"
  );
  if (!shouldSpawnAtMountainVillage) return null;

  const [cx, cz] = TEMP_MOUNTAIN_VILLAGE_SPAWN_CHUNK;
  return getSurvivalChunkSpawn(cx, cz, "temp-mountain-village", {
    y: TEMP_MOUNTAIN_VILLAGE_SPAWN_Y,
    localZ: TEMP_MOUNTAIN_VILLAGE_SPAWN_LOCAL_Z,
  });
}

function getPlayerSpawnOverride(): QaSurvivalSpawn | null {
  return getTemporaryMountainVillageSpawn() ?? getQaSurvivalSpawnFromUrl();
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

export function PlayerController() {
  const rigidBody = useRef<RapierRigidBody>(null);
  const { rapier, world } = useRapier();
  const { camera } = useThree();
  const getHealth = () => useGameStore.getState().health;
  const initialPlayerPosition = useMemo(() => getInitialPlayerPosition(), []);
  const qaSurvivalWalkEnabled = useMemo(() => isQaSurvivalWalkEnabled(), []);
  const forcedSpawnKey = useRef<string | null>(null);
  const qaWalkStartTime = useRef<number | null>(null);
  const qaWalkYaw = useRef<number | null>(null);
  const qaWalkLastDecisionAt = useRef(0);
  const qaWalkLastProgressAt = useRef(0);
  const qaWalkLastProgressPos = useRef(new THREE.Vector3());

  const [jumps, setJumps] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const slideTimer = useRef(0);
  const lastSlideTime = useRef(0);
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
  const controllerLookEuler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const controllerGameplayArmed = useRef(false);
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

  const clearToxicEffectsWithNetwork = () => {
    const state = useGameStore.getState();
    const now = Date.now();
    if (state.poisonUntil <= now && state.acidUntil <= now) return;

    state.clearToxicEffects();
    if (socket.id) {
      socket.emit("clearStatusEffect", { targetId: socket.id, effects: ["poison", "acid"] });
    }
  };

  useEffect(() => {
    const cameraEuler = new THREE.Euler(0, 0, 0, "YXZ");
    const maxPitch = Math.PI / 2;

    const handleMouseMove = (event: MouseEvent) => {
      if (!isMouseGameplayInputActive()) return;

      cameraEuler.setFromQuaternion(camera.quaternion);
      const mouseSensitivity = useGameStore.getState().mouseSensitivity || DEFAULT_MOUSE_SENSITIVITY;
      cameraEuler.y -= event.movementX * mouseSensitivity;
      cameraEuler.x -= event.movementY * mouseSensitivity;
      cameraEuler.x = THREE.MathUtils.clamp(cameraEuler.x, -maxPitch, maxPitch);
      camera.quaternion.setFromEuler(cameraEuler);
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

    const onMeditationKeyDown = (e: KeyboardEvent) => {
      if (!isMeditationControl(e.code) || isEditableTarget(e.target)) return;
      const store = useGameStore.getState();
      if (store.isPauseMenuOpen || store.isSpellMenuOpen || store.isMapExpanded || store.isScoreboardOpen || store.health <= 0) return;

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
      if (useGameStore.getState().isSpellMenuOpen) return;
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
      if (e.button === 0 || e.button === 2) {
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
      if (direction > 0) {
        store.nextSpell(hand);
      } else {
        store.prevSpell(hand);
      }
      store.setActiveHand(hand);
    };
    
    // Wheel to switch spells
    const onWheel = (e: WheelEvent) => {
      if (useGameStore.getState().isSpellMenuOpen) return;
      if (!canUseGameplayInput()) return;
      const hand: HandType = keys.KeyQ ? 'right' : 'left';
      if (e.deltaY > 0) useGameStore.getState().nextSpell(hand);
      else useGameStore.getState().prevSpell(hand);
    };

    const onHotbarKeyDown = (e: KeyboardEvent) => {
      const store = useGameStore.getState();
      if (store.isSpellMenuOpen || store.health <= 0) return;
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
      const canCast = Boolean(gamepad && canUseGameplayInput() && !store.isSpellMenuOpen);
      const nextState: Record<HandType, boolean> = {
        left: canCast && isGamepadButtonPressed(gamepad, store.controllerBindings.leftCast as GamepadButtonName),
        right: canCast && isGamepadButtonPressed(gamepad, store.controllerBindings.rightCast as GamepadButtonName),
      };

      (["left", "right"] as HandType[]).forEach((hand) => {
        if (nextState[hand] && !controllerCastingDown[hand]) {
          startHandCast(hand);
        } else if (!nextState[hand] && controllerCastingDown[hand]) {
          releaseHandCast(hand);
        }
        controllerCastingDown[hand] = nextState[hand];
      });

      if (gamepad && canUseGameplayInput() && !store.isSpellMenuOpen) {
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
      rigidBody.current.setTranslation(e.detail, true);
      rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
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
      !storeState.isMapExpanded &&
      !storeState.isScoreboardOpen &&
      !astralActive &&
      storeState.health > 0
    );
    if (!controllerGameplayRequested) {
      controllerGameplayArmed.current = false;
    } else if (controllerModeReady && !controllerGameplayArmed.current && areControllerGameplayButtonsReleased(gamepad, storeState.controllerBindings)) {
      controllerGameplayArmed.current = true;
      controllerJumpWasPressed.current = false;
      controllerSprintWasPressed.current = false;
    }
    const controllerInputActive = controllerModeReady && controllerGameplayArmed.current;
    const gameplayInputActive = Boolean(mouseGameplayRequested || storeState.isTouchControlsActive || controllerInputActive);
    (window as any).localPlayerPos = pos;
    (window as any).localPlayerRigidBody = rigidBody.current;

    const spawnOverride = getPlayerSpawnOverride();
    if (spawnOverride && forcedSpawnKey.current !== spawnOverride.key) {
      const [spawnX, spawnY, spawnZ] = spawnOverride.position;
      rigidBody.current.setTranslation({ x: spawnX, y: spawnY, z: spawnZ }, true);
      rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rigidBody.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      camera.position.set(spawnX, spawnY + PLAYER_CAMERA_HEIGHT, spawnZ);
      qaWalkStartTime.current = null;
      qaWalkYaw.current = null;
      qaWalkLastDecisionAt.current = 0;
      qaWalkLastProgressAt.current = 0;
      qaWalkLastProgressPos.current.set(spawnX, spawnY, spawnZ);
      forcedSpawnKey.current = spawnOverride.key;
      (window as any).localPlayerPos = { x: spawnX, y: spawnY, z: spawnZ };
      window.dispatchEvent(new CustomEvent("player-moved", { detail: { x: spawnX, y: spawnY, z: spawnZ, angle: 0, isMoving: false, grounded: false } }));
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
        detail: { isMoving: false, isSprinting: false, isSliding: false, isGrounded: false, isMeditating: false }
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
          isSpeaking: storeState.isVoiceSpeaking
        });
      }
      return;
    }

    if (astralActive) {
      if (isSliding) setIsSliding(false);
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
        detail: { isMoving: false, isSprinting: false, isSliding: false, isGrounded: true, isMeditating: true }
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
          isSpeaking: storeState.isVoiceSpeaking
        });
      }
      return;
    }

    if (!storeState.isSpellMenuOpen && gameplayInputActive && !sleepActive) {
      const lookX = controllerInputActive ? getGamepadAxis(gamepad, 2) : 0;
      const lookY = controllerInputActive ? getGamepadAxis(gamepad, 3) : 0;
      if (lookX !== 0 || lookY !== 0) {
        const cameraEuler = controllerLookEuler.current;
        cameraEuler.setFromQuaternion(camera.quaternion);
        const lookSensitivity = storeState.controllerLookSensitivity || DEFAULT_CONTROLLER_LOOK_SENSITIVITY;
        cameraEuler.y -= lookX * lookSensitivity * delta;
        cameraEuler.x -= lookY * lookSensitivity * CONTROLLER_LOOK_VERTICAL_MULTIPLIER * delta;
        cameraEuler.x = THREE.MathUtils.clamp(cameraEuler.x, -Math.PI / 2, Math.PI / 2);
        camera.quaternion.setFromEuler(cameraEuler);
      }

      if (storeState.isTouchControlsActive && (touchLookDelta.current.x !== 0 || touchLookDelta.current.y !== 0)) {
        const cameraEuler = controllerLookEuler.current;
        cameraEuler.setFromQuaternion(camera.quaternion);
        const touchLookSensitivity = storeState.mouseSensitivity || DEFAULT_MOUSE_SENSITIVITY;
        cameraEuler.y -= touchLookDelta.current.x * touchLookSensitivity;
        cameraEuler.x -= touchLookDelta.current.y * touchLookSensitivity;
        cameraEuler.x = THREE.MathUtils.clamp(cameraEuler.x, -Math.PI / 2, Math.PI / 2);
        camera.quaternion.setFromEuler(cameraEuler);
        touchLookDelta.current.x = 0;
        touchLookDelta.current.y = 0;
      }

      if (
        storeState.keyboardArrowLookEnabled &&
        mouseGameplayRequested &&
        !storeState.isPauseMenuOpen &&
        !storeState.isMapExpanded &&
        !storeState.isScoreboardOpen
      ) {
        const arrowLookX = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
        const arrowLookY = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
        if (arrowLookX !== 0 || arrowLookY !== 0) {
          const cameraEuler = controllerLookEuler.current;
          cameraEuler.setFromQuaternion(camera.quaternion);
          const keyboardLookSensitivity = ((storeState.mouseSensitivity || DEFAULT_MOUSE_SENSITIVITY) / DEFAULT_MOUSE_SENSITIVITY) * KEYBOARD_ARROW_LOOK_SPEED;
          cameraEuler.y -= arrowLookX * keyboardLookSensitivity * delta;
          cameraEuler.x -= arrowLookY * keyboardLookSensitivity * KEYBOARD_ARROW_LOOK_VERTICAL_MULTIPLIER * delta;
          cameraEuler.x = THREE.MathUtils.clamp(cameraEuler.x, -Math.PI / 2, Math.PI / 2);
          camera.quaternion.setFromEuler(cameraEuler);
        }
      }
    }

    const qaWalkActive = qaSurvivalWalkEnabled && (storeState.gameMode === "solo-survival" || storeState.gameMode === "multiplayer-survival");
    if (qaWalkActive && !storeState.isSpellMenuOpen && !sleepActive) {
      if (qaWalkStartTime.current === null) {
        qaWalkStartTime.current = state.clock.elapsedTime;
      }

      const elapsed = state.clock.elapsedTime - qaWalkStartTime.current;
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
      const waypointRadius = maxLocalDistance > SURVIVAL_BLOCK_SIZE * 0.36 ? 42 : 118;
      const waypointAngle = elapsed * 0.28 + Math.sin(elapsed * 0.13 + chunkCenterX * 0.001) * 0.65;
      const waypointX = chunkCenterX + Math.sin(waypointAngle) * waypointRadius;
      const waypointZ = chunkCenterZ + Math.cos(waypointAngle) * waypointRadius;
      const desiredYaw = Math.atan2(waypointX - pos.x, -(waypointZ - pos.z));

      const probeClearance = (yaw: number, distance: number) => {
        const ray = new rapier.Ray(
          { x: pos.x, y: pos.y + 0.42, z: pos.z },
          { x: Math.sin(yaw), y: 0, z: -Math.cos(yaw) },
        );
        // @ts-ignore - rapier exposes the collider predicate in this overload.
        const hit = world.castRay(ray, distance, true, undefined, undefined, undefined, undefined, (collider) => collider.parent()?.handle !== rigidBody.current?.handle);
        return hit ? hit.timeOfImpact : distance;
      };

      const forwardClearance = probeClearance(qaWalkYaw.current, QA_SURVIVAL_WALK_PROBE_DISTANCE);
      const needsDecision =
        forwardClearance < QA_SURVIVAL_WALK_PROBE_DISTANCE * 0.72 ||
        elapsed - qaWalkLastDecisionAt.current > QA_SURVIVAL_WALK_DECISION_SECONDS;

      if (needsDecision) {
        const wander = Math.sin(elapsed * 0.37 + pos.x * 0.006 + pos.z * 0.004) * 0.34;
        let bestYaw = desiredYaw;
        let bestScore = -Infinity;

        QA_SURVIVAL_WALK_TURN_OPTIONS.forEach((turn, index) => {
          const candidateYaw = desiredYaw + turn + (index === 0 ? wander : 0);
          const center = probeClearance(candidateYaw, QA_SURVIVAL_WALK_PROBE_DISTANCE);
          const left = probeClearance(candidateYaw + 0.34, QA_SURVIVAL_WALK_PROBE_DISTANCE * 0.62);
          const right = probeClearance(candidateYaw - 0.34, QA_SURVIVAL_WALK_PROBE_DISTANCE * 0.62);
          const turnPenalty = Math.abs(turn) * 1.25;
          const directionAgreement = Math.cos(candidateYaw - desiredYaw) * 2.4;
          const score = center * 1.45 + Math.min(left, right) * 0.72 - turnPenalty + directionAgreement + (index === 0 ? 1.6 : 0);
          if (score > bestScore) {
            bestScore = score;
            bestYaw = candidateYaw;
          }
        });

        qaWalkYaw.current = bestYaw;
        qaWalkLastDecisionAt.current = elapsed;
      } else {
        qaWalkYaw.current = lerpAngleRadians(qaWalkYaw.current, desiredYaw, 1 - Math.exp(-delta * 0.72));
        qaWalkYaw.current += Math.sin(elapsed * 0.41) * delta * 0.08;
      }

      if (elapsed - qaWalkLastProgressAt.current > QA_SURVIVAL_STUCK_CHECK_SECONDS) {
        const progressDistance = Math.hypot(
          pos.x - qaWalkLastProgressPos.current.x,
          pos.z - qaWalkLastProgressPos.current.z,
        );
        if (progressDistance < 1.75) {
          qaWalkYaw.current += Math.PI * (0.62 + survivalishTurnNoise(pos.x, pos.z, elapsed) * 0.42);
          qaWalkLastDecisionAt.current = elapsed;
        }
        qaWalkLastProgressAt.current = elapsed;
        qaWalkLastProgressPos.current.set(pos.x, pos.y, pos.z);
      }

      const yaw = qaWalkYaw.current;
      const pitch = -0.04 + Math.sin(elapsed * 0.62) * 0.035;
      controllerLookEuler.current.set(pitch, yaw, 0);
      camera.quaternion.setFromEuler(controllerLookEuler.current);
    }

    if (storeState.isSpellMenuOpen) {
      rigidBody.current.setLinvel({ x: 0, y: vclipActive ? 0 : velocity.y, z: 0 }, true);
      window.dispatchEvent(new CustomEvent('player-state', { 
        detail: { isMoving: false, isSprinting: false, isSliding: false, isGrounded: true, isMeditating: false } 
      }));
      return;
    }

    const chargingHands = storeState.chargingHands;

    (["left", "right"] as HandType[]).forEach((hand) => {
      const handSpell = hand === 'right' ? storeState.rightCurrentSpell : storeState.leftCurrentSpell;
      const handOffset = hand === 'right' ? -1.15 : 1.15;
      const runePower = hand === 'right' ? storeState.rightRunePower : storeState.leftRunePower;
      const runeReady = hasRunePower(runePower);

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

    if (sleepActive) {
      if (isSliding) setIsSliding(false);
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
    const controllerSlideHeld = controllerInputActive && isGamepadButtonPressed(gamepad, storeState.controllerBindings.slide as GamepadButtonName);
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
    const touchSprintHeld = storeState.isTouchControlsActive && touchButtons.current.sprint;
    const touchSprintPressed = touchSprintHeld && !touchSprintWasPressed.current;
    touchSprintWasPressed.current = touchSprintHeld;
    const jumpHeld = keys.Space || controllerJumpHeld || touchJumpHeld;
    const jumpRequested = keys.Space || controllerJumpPressed || touchJumpPressed;
    const descendHeld = keys.KeyC || controllerSlideHeld || touchSlideHeld;
    const slideHeld = !vclipActive && descendHeld;
    const verticalInput = vclipActive ? (jumpHeld ? 1 : 0) - (descendHeld ? 1 : 0) : 0;

    frontVector.set(0, 0, (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0) + controllerMoveZ + touchMoveZ - (qaWalkActive ? 1 : 0));
    sideVector.set((keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0) - controllerMoveX - touchMoveX, 0, 0);
    direction.subVectors(frontVector, sideVector);
    const hasPlanarMovementInput = direction.lengthSq() > 0;
    const hasMovementInput = !sleepActive && (hasPlanarMovementInput || verticalInput !== 0);
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
    const isSprinting = hasMovementInput && (keys.ShiftLeft || controllerSprintLatched.current || touchSprintLatched.current || qaWalkActive) && !isSliding;

    const boostedSpeed = SPEED * (speedBoostActive ? SPEED_BOOST_MULTIPLIER : 1) * (slowActive ? TUNGSTON_SLOW_MULTIPLIER : 1);
    const slideSpeed = SLIDE_SPEED * (slowActive ? TUNGSTON_SLOW_MULTIPLIER : 1);
    const sprintMultiplier = vclipActive ? VCLIP_SPRINT_MULTIPLIER : 1.6;
    const currentSpeed = sleepActive ? 0 : isSliding ? slideSpeed : (isSprinting ? boostedSpeed * sprintMultiplier : boostedSpeed);

    if (hasPlanarMovementInput) {
      direction.normalize().multiplyScalar(currentSpeed).applyEuler(camera.rotation);
    } else {
      direction.set(0, 0, 0);
    }

    if (vclipActive) {
      if (isSliding) setIsSliding(false);
      direction.y += verticalInput * VCLIP_VERTICAL_SPEED * (isSprinting ? VCLIP_SPRINT_MULTIPLIER : 1);
    }
    
    if (pullFrames.current > 0) {
      direction.x += pullVelocity.current.x;
      direction.z += pullVelocity.current.z;
      velocity.y = pullVelocity.current.y;
      pullFrames.current--;
    }
    
    // Check ground (raycast)
    const ray = new rapier.Ray({ x: pos.x, y: pos.y - PLAYER_FOOT_OFFSET + 0.1, z: pos.z }, { x: 0, y: -1, z: 0 });
    const hit = vclipActive
      ? null
      // Use filterPredicate to ignore the player's own colliders.
      // @ts-ignore
      : world.castRay(ray, 0.25, true, undefined, undefined, undefined, undefined, (collider) => collider.parent()?.handle !== rigidBody.current?.handle);
    const grounded = !vclipActive && hit !== null && hit.timeOfImpact < 0.2;
    
    // Dispatch player state for HUD animations
    window.dispatchEvent(new CustomEvent('player-state', { 
      detail: { 
        isMoving: hasMovementInput, 
        isSprinting: isSprinting, 
        isSliding: isSliding,
        isGrounded: grounded,
        isMeditating: false
      } 
    }));

    // Dispatch position for UI and Ripples
    window.dispatchEvent(new CustomEvent('player-moved', { detail: { x: pos.x, y: pos.y, z: pos.z, angle: yaw, isMoving: hasMovementInput, grounded } }));

    const navAimDir = new THREE.Vector3();
    camera.getWorldDirection(navAimDir);
    recordNavigationSample({
      gameMode: storeState.gameMode,
      pos: [pos.x, pos.y, pos.z],
      rot: [camera.rotation.x, yaw, camera.rotation.z],
      aimDir: [navAimDir.x, navAimDir.y, navAimDir.z],
      velocity: [direction.x, vclipActive ? direction.y : velocity.y, direction.z],
      input: {
        forward: THREE.MathUtils.clamp((keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) - controllerMoveZ - touchMoveZ + (qaWalkActive ? 1 : 0), -1, 1),
        strafe: THREE.MathUtils.clamp((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + controllerMoveX + touchMoveX, -1, 1),
        sprint: isSprinting,
        jump: jumpHeld,
        slide: slideHeld,
        vclip: vclipActive,
      },
      state: {
        grounded,
        moving: hasMovementInput,
        sliding: isSliding,
        sprinting: isSprinting,
        spellMenuOpen: storeState.isSpellMenuOpen,
      },
    });

    if (!vclipActive && grounded && velocity.y <= 0.1) {
      setJumps(0);
      if (slideHeld && !isSliding && velocity.x * velocity.x + velocity.z * velocity.z > 2) {
        if (Date.now() - lastSlideTime.current >= 2000) {
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
    rigidBody.current.setLinvel({
      x: direction.x,
      y: vclipActive ? direction.y : velocity.y,
      z: direction.z
    }, true);

    const fuel = useGameStore.getState().thrusterFuel;
    let newFuel = fuel;

    if (!jumpHeld) {
      thrusterLocked.current = false;
    }

    // Jump & Thruster logic
    if (!vclipActive && !sleepActive && jumpHeld) {
      if (grounded && velocity.y <= 0.1) {
        if (jumpRequested) {
          rigidBody.current.setLinvel({ x: velocity.x, y: JUMP_FORCE * (jumpBoostActive ? JUMP_BOOST_MULTIPLIER : 1), z: velocity.z }, true);
          keys.Space = false; // consume keyboard jump
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

    if (!vclipActive && grounded) {
      if (newFuel < 1.0) {
        newFuel = Math.min(1.0, newFuel + delta * 0.4); // 2.5 seconds to recharge fully
      }
    }

    if (newFuel !== fuel) {
      useGameStore.getState().setThrusterFuel(newFuel);
    }

    // Update Camera position (attached to body)
    // Adjust y for crouch
    const targetY = isSliding ? pos.y + PLAYER_SLIDE_CAMERA_HEIGHT : pos.y + PLAYER_CAMERA_HEIGHT;
    camera.position.lerp(new THREE.Vector3(pos.x, targetY, pos.z), 0.2);
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
          : (velocity.y < -1 || velocity.y > 1 || !grounded)
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
