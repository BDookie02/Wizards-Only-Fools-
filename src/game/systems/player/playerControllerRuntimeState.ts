import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { HandType } from "../../../store/gameStore";
import type { TouchButtonName } from "../input/playerInputState";
import { createRemoteSpellTargetScratch } from "../spells/playerSpellCasting";
import { createPlayerSolidColliderFilter } from "./playerCameraRuntime";
import {
  createPlayerControllerGamepadLookInput,
  createPlayerControllerGamepadMovementInput,
} from "./playerControllerGamepadRuntime";
import type { PlayerRapierQueryOptions } from "./playerRapierQueryRuntime";
import {
  createLilyCoilTubeFrame,
  createLilyCoilTubeNearestScratch,
} from "../world/villages/lilyCoilTubeMotion";
import type { PlayerScreenShakeState } from "./playerScreenShakeRuntime";
import type { PlayerToxicDamageState } from "./playerToxicDamageRuntime";

export type GrabbedPlayerState = {
  casterId: string;
  grabId?: string;
  dir: THREE.Vector3;
  origin: THREE.Vector3;
  distance: number;
  lastControlAt: number;
  until: number;
};

export function usePlayerControllerRuntimeState() {
  const activeLadderZones = useRef(new Set<string>());
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
  const screenShake = useRef<PlayerScreenShakeState>({ strength: 0, until: 0, duration: 1 });
  const toxicDamageState = useRef<PlayerToxicDamageState>({ damageBuffer: 0, lastSyncAt: 0 });
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
  const controllerGamepadArmingRefs = useMemo(() => ({
    controllerGameplayArmed,
    keyboardJumpWasPressed,
    controllerJumpWasPressed,
    controllerSprintWasPressed,
  }), []);
  const controllerGamepadMovementRefs = useMemo(() => ({
    jumpWasPressed: controllerJumpWasPressed,
    sprintWasPressed: controllerSprintWasPressed,
  }), []);
  const controllerGamepadLookInput = useMemo(createPlayerControllerGamepadLookInput, []);
  const controllerGamepadMovementInput = useMemo(createPlayerControllerGamepadMovementInput, []);
  const touchMove = useRef({ x: 0, y: 0 });
  const touchLookDelta = useRef({ x: 0, y: 0 });
  const touchButtons = useRef<Record<TouchButtonName, boolean>>({ jump: false, slide: false, sprint: false });
  const touchJumpWasPressed = useRef(false);
  const touchSprintWasPressed = useRef(false);
  const touchSprintLatched = useRef(false);
  const astralExitHoldStartedAt = useRef<number | null>(null);
  const astralExitArmed = useRef(false);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const frontVector = useMemo(() => new THREE.Vector3(), []);
  const sideVector = useMemo(() => new THREE.Vector3(), []);
  const grabbedCasterAnchor = useMemo(() => new THREE.Vector3(), []);
  const grabbedHoldPoint = useMemo(() => new THREE.Vector3(), []);
  const grabbedCurrentPosition = useMemo(() => new THREE.Vector3(), []);
  const screenShakeForward = useMemo(() => new THREE.Vector3(), []);
  const screenShakeRight = useMemo(() => new THREE.Vector3(), []);
  const screenShakeUp = useMemo(() => new THREE.Vector3(), []);
  const frameForward = useMemo(() => new THREE.Vector3(), []);
  const qaPosition = useMemo(() => new THREE.Vector3(), []);
  const throwDirection = useMemo(() => new THREE.Vector3(), []);
  const spellAimOrigin = useMemo(() => new THREE.Vector3(), []);
  const spellLaunchOrigin = useMemo(() => new THREE.Vector3(), []);
  const spellDirection = useMemo(() => new THREE.Vector3(), []);
  const spellFlatDirection = useMemo(() => new THREE.Vector3(), []);
  const spellLateral = useMemo(() => new THREE.Vector3(), []);
  const spellTargetScratch = useMemo(createRemoteSpellTargetScratch, []);
  const grabReleaseDirection = useMemo(() => new THREE.Vector3(), []);
  const spellLaunchScratch = useMemo(() => ({
    spawnPos: { x: 0, y: 0, z: 0 },
    realDir: new THREE.Vector3(),
    lateral: new THREE.Vector3(),
  }), []);
  const tubeCameraForward = useMemo(() => new THREE.Vector3(), []);
  const tubeCameraRight = useMemo(() => new THREE.Vector3(), []);
  const tubeSurfaceForward = useMemo(() => new THREE.Vector3(), []);
  const tubeSurfaceRight = useMemo(() => new THREE.Vector3(), []);
  const tubeCurrentRadial = useMemo(() => new THREE.Vector3(), []);
  const tubeCurrentPlayerUp = useMemo(() => new THREE.Vector3(), []);
  const tubeCurrentAroundSurface = useMemo(() => new THREE.Vector3(), []);
  const tubeMoveDirection = useMemo(() => new THREE.Vector3(), []);
  const tubeRadial = useMemo(() => new THREE.Vector3(), []);
  const tubePlayerUp = useMemo(() => new THREE.Vector3(), []);
  const tubeAroundSurface = useMemo(() => new THREE.Vector3(), []);
  const tubeBodyPosition = useMemo(() => new THREE.Vector3(), []);
  const tubeCameraPosition = useMemo(() => new THREE.Vector3(), []);
  const tubeForward = useMemo(() => new THREE.Vector3(), []);
  const tubeLookDirection = useMemo(() => new THREE.Vector3(), []);
  const tubeUpRotation = useMemo(() => new THREE.Quaternion(), []);
  const lilyCoilNearestScratch = useMemo(createLilyCoilTubeNearestScratch, []);
  const lilyCoilCurrentFrame = useMemo(createLilyCoilTubeFrame, []);
  const lilyCoilNextFrame = useMemo(createLilyCoilTubeFrame, []);
  const lilyCoilLookFrame = useMemo(createLilyCoilTubeFrame, []);
  const navigationAimDirection = useMemo(() => new THREE.Vector3(), []);
  const cameraTargetPosition = useRef(new THREE.Vector3());
  const playerSolidColliderFilter = useMemo(createPlayerSolidColliderFilter, []);
  const playerQueryOptions = useMemo<PlayerRapierQueryOptions>(() => ({}), []);

  return {
    activeLadderZones,
    slideTimer,
    lastSlideTime,
    crouchHoldStartedAt,
    lastGroundedAt,
    lastBoostTime,
    thrusterLocked,
    lastNetworkSync,
    flamethrowerTimers,
    activeCastingHands,
    activeGrabIds,
    grabTimeouts,
    grabbedState,
    pullVelocity,
    pullFrames,
    screenShake,
    toxicDamageState,
    lilyCoilTubeState,
    controllerLookEuler,
    controllerGameplayArmed,
    keyboardJumpWasPressed,
    controllerJumpWasPressed,
    controllerSprintWasPressed,
    controllerSprintLatched,
    controllerGamepadArmingRefs,
    controllerGamepadMovementRefs,
    controllerGamepadLookInput,
    controllerGamepadMovementInput,
    touchMove,
    touchLookDelta,
    touchButtons,
    touchJumpWasPressed,
    touchSprintWasPressed,
    touchSprintLatched,
    astralExitHoldStartedAt,
    astralExitArmed,
    direction,
    frontVector,
    sideVector,
    grabbedCasterAnchor,
    grabbedHoldPoint,
    grabbedCurrentPosition,
    screenShakeForward,
    screenShakeRight,
    screenShakeUp,
    frameForward,
    qaPosition,
    throwDirection,
    spellAimOrigin,
    spellLaunchOrigin,
    spellDirection,
    spellFlatDirection,
    spellLateral,
    spellTargetScratch,
    spellLaunchScratch,
    grabReleaseDirection,
    tubeCameraForward,
    tubeCameraRight,
    tubeSurfaceForward,
    tubeSurfaceRight,
    tubeCurrentRadial,
    tubeCurrentPlayerUp,
    tubeCurrentAroundSurface,
    tubeMoveDirection,
    tubeRadial,
    tubePlayerUp,
    tubeAroundSurface,
    tubeBodyPosition,
    tubeCameraPosition,
    tubeForward,
    tubeLookDirection,
    tubeUpRotation,
    lilyCoilNearestScratch,
    lilyCoilCurrentFrame,
    lilyCoilNextFrame,
    lilyCoilLookFrame,
    navigationAimDirection,
    cameraTargetPosition,
    playerSolidColliderFilter,
    playerQueryOptions,
  };
}
