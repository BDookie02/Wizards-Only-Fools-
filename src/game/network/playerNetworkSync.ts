import * as THREE from "three";
import type { HandType } from "../../store/gameStore";
import { emitGameNetworkEvent } from "./gameNetworkClient";
import { getMultiplayerPoseIntervalMs } from "./multiplayerSessionConfig";

const playerNetworkAimScratch = new THREE.Vector3();
const playerNetworkPoseAimScratch = new THREE.Vector3();

export type PlayerNetworkAnimation =
  | "sleep"
  | "grabbed"
  | "meditate"
  | "slide"
  | "crouchwalk"
  | "crouch"
  | "walk"
  | "holding"
  | "jump"
  | "casting"
  | "sprint";

export type PlayerNetworkSyncOptions = {
  activeGrabIds: Record<HandType, string | null>;
  camera: THREE.Camera;
  characterCustomization: unknown;
  chargingHands: Record<HandType, boolean>;
  climbingLadder: boolean;
  effectiveGrounded: boolean;
  hasMovementInput: boolean;
  isCrouching: boolean;
  isSliding: boolean;
  isSprinting: boolean;
  isVoiceSpeaking: boolean;
  pos: { x: number; y: number; z: number };
  sleepActive: boolean;
  survivalLevel: number;
  velocityY: number;
  yaw: number;
};

export type PlayerNetworkPoseSyncOptions = {
  aimDir?: { x: number; y: number; z: number };
  anim: PlayerNetworkAnimation;
  camera: THREE.Camera;
  characterCustomization: unknown;
  isVoiceSpeaking: boolean;
  pos: { x: number; y: number; z: number };
  survivalLevel: number;
  yaw: number;
};

export function getPlayerNetworkSyncInterval(activeGrabIds: Record<HandType, string | null>) {
  const isControllingGrab = activeGrabIds.left !== null || activeGrabIds.right !== null;
  return getMultiplayerPoseIntervalMs(isControllingGrab);
}

export function getPlayerNetworkAnimation(options: {
  chargingHands: Record<HandType, boolean>;
  climbingLadder: boolean;
  effectiveGrounded: boolean;
  hasMovementInput: boolean;
  isCrouching: boolean;
  isSliding: boolean;
  isSprinting: boolean;
  sleepActive: boolean;
  velocityY: number;
}): PlayerNetworkAnimation {
  const {
    chargingHands,
    climbingLadder,
    effectiveGrounded,
    hasMovementInput,
    isCrouching,
    isSliding,
    isSprinting,
    sleepActive,
    velocityY,
  } = options;
  const isCasting = chargingHands.left || chargingHands.right;

  if (sleepActive) return "sleep";
  if (isSliding) return "slide";
  if (isCrouching) return hasMovementInput ? "crouchwalk" : "crouch";
  if (climbingLadder) return hasMovementInput ? "walk" : "holding";
  if (velocityY < -1 || velocityY > 1 || !effectiveGrounded) return "jump";
  if (isCasting) return "casting";
  if (hasMovementInput) return isSprinting ? "sprint" : "walk";
  return "holding";
}

function emitGrabControlForHand(
  activeGrabIds: Record<HandType, string | null>,
  hand: HandType,
  camera: THREE.Camera,
  aimDir: THREE.Vector3,
) {
  const grabId = activeGrabIds[hand];
  if (!grabId) return;
  emitGameNetworkEvent("grabControl", {
    grabId,
    hand,
    origin: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    aimDir: { x: aimDir.x, y: aimDir.y, z: aimDir.z },
  });
}

export function emitPlayerNetworkSync(options: PlayerNetworkSyncOptions) {
  const {
    activeGrabIds,
    camera,
    characterCustomization,
    chargingHands,
    climbingLadder,
    effectiveGrounded,
    hasMovementInput,
    isCrouching,
    isSliding,
    isSprinting,
    isVoiceSpeaking,
    pos,
    sleepActive,
    survivalLevel,
    velocityY,
    yaw,
  } = options;
  const aimDir = playerNetworkAimScratch;
  camera.getWorldDirection(aimDir);
  const networkAnimation = getPlayerNetworkAnimation({
    chargingHands,
    climbingLadder,
    effectiveGrounded,
    hasMovementInput,
    isCrouching,
    isSliding,
    isSprinting,
    sleepActive,
    velocityY,
  });

  emitGrabControlForHand(activeGrabIds, "left", camera, aimDir);
  emitGrabControlForHand(activeGrabIds, "right", camera, aimDir);

  emitPlayerNetworkPoseSync({
    anim: networkAnimation,
    camera,
    characterCustomization,
    isVoiceSpeaking,
    pos,
    survivalLevel,
    yaw,
    aimDir,
  });
}

export function emitPlayerNetworkPoseSync(options: PlayerNetworkPoseSyncOptions) {
  const {
    aimDir: providedAimDir,
    anim,
    camera,
    characterCustomization,
    isVoiceSpeaking,
    pos,
    survivalLevel,
    yaw,
  } = options;
  const aimDir = providedAimDir ?? camera.getWorldDirection(playerNetworkPoseAimScratch);

  emitGameNetworkEvent("updateMe", {
    pos: [pos.x, pos.y, pos.z],
    rot: [camera.rotation.x, yaw, camera.rotation.z],
    aimDir: [aimDir.x, aimDir.y, aimDir.z],
    anim,
    character: characterCustomization,
    survivalLevel,
    isSpeaking: isVoiceSpeaking,
  });
}
