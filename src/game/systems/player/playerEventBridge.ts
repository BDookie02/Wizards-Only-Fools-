import type { HandType, SpellType } from "../../../store/gameStore";

export type PlayerStateEventDetail = {
  isMoving: boolean;
  isSprinting: boolean;
  isSliding: boolean;
  isCrouching: boolean;
  isGrounded: boolean;
  isMeditating: boolean;
};

export type PlayerMovedEventDetail = {
  x: number;
  y: number;
  z: number;
  angle: number;
  isMoving: boolean;
  grounded: boolean;
};

export type PlayerPositionLike = {
  x: number;
  y: number;
  z: number;
};

export type PlayerRigidBodyLike = {
  translation(): PlayerPositionLike;
  setLinvel?(velocity: PlayerPositionLike, wakeUp?: boolean): void;
};

export type SelfBuffCastEventDetail = {
  spell: SpellType;
  hand: HandType;
  armor?: number;
};

export type DirectStatusCastEventDetail = {
  spell: SpellType;
  hand: HandType;
  targetId: string;
};

export type ReleaseGrabPlayerEventDetail = {
  casterId: string;
  grabId: string;
  dir: { x: number; y: number; z: number };
  origin: PlayerPositionLike;
};

export type QuestVillagerInteractionDetail = {
  source: string;
  handled: boolean;
};

type PlayerWindowGlobals = Window & typeof globalThis & {
  __wofLastPlayerPosition?: PlayerPositionLike;
  __wofLastPlayerYaw?: number;
  localPlayerRigidBody?: unknown;
  localPlayerPos?: PlayerPositionLike;
  remotePlayersPositions?: Record<string, PlayerPositionLike | undefined>;
};

const publishedLocalPlayerPosition: PlayerPositionLike = { x: 0, y: 0, z: 0 };
const rememberedLocalPlayerPosition: PlayerPositionLike = { x: 0, y: 0, z: 0 };

function isPlayerPositionLike(position: unknown): position is PlayerPositionLike {
  if (!position || typeof position !== "object") return false;
  const candidate = position as Partial<PlayerPositionLike>;
  return (
    typeof candidate.x === "number" &&
    typeof candidate.y === "number" &&
    typeof candidate.z === "number"
  );
}

export function dispatchPlayerState(detail: PlayerStateEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("player-state", { detail }));
}

export function dispatchPlayerMoved(detail: PlayerMovedEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("player-moved", { detail }));
}

export function dispatchSelfBuffCast(detail: SelfBuffCastEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("self-buff-cast", { detail }));
}

export function dispatchDirectStatusCast(detail: DirectStatusCastEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("direct-status-cast", { detail }));
}

export function dispatchReleaseGrabPlayer(detail: ReleaseGrabPlayerEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("releaseGrabPlayer", { detail }));
}

export function dispatchQuestVillagerInteraction(source: string) {
  const detail: QuestVillagerInteractionDetail = { source, handled: false };
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("quest-villager-interact", { detail }));
  }
  return detail;
}

export function publishLocalPlayerPosition(position: PlayerPositionLike, options: { rememberLast?: boolean } = {}) {
  if (typeof window === "undefined") return;
  publishedLocalPlayerPosition.x = position.x;
  publishedLocalPlayerPosition.y = position.y;
  publishedLocalPlayerPosition.z = position.z;
  const playerWindow = window as PlayerWindowGlobals;
  playerWindow.localPlayerPos = publishedLocalPlayerPosition;
  if (options.rememberLast) {
    rememberedLocalPlayerPosition.x = position.x;
    rememberedLocalPlayerPosition.y = position.y;
    rememberedLocalPlayerPosition.z = position.z;
    playerWindow.__wofLastPlayerPosition = rememberedLocalPlayerPosition;
  }
}

export function getPublishedLocalPlayerPosition(): PlayerPositionLike | undefined {
  if (typeof window === "undefined") return undefined;
  const playerWindow = window as PlayerWindowGlobals;
  const position = playerWindow.localPlayerPos;
  if (isPlayerPositionLike(position)) {
    return position;
  }
  return undefined;
}

export function getLastKnownLocalPlayerPosition(): PlayerPositionLike | undefined {
  if (typeof window === "undefined") return undefined;
  const playerWindow = window as PlayerWindowGlobals;
  const position = playerWindow.localPlayerPos ?? playerWindow.__wofLastPlayerPosition;
  if (isPlayerPositionLike(position)) {
    return position;
  }
  return undefined;
}

export function getPublishedRemotePlayerPosition(playerId: string): PlayerPositionLike | undefined {
  if (typeof window === "undefined") return undefined;
  const position = (window as PlayerWindowGlobals).remotePlayersPositions?.[playerId];
  if (isPlayerPositionLike(position)) {
    return position;
  }
  return undefined;
}

export function publishLastPlayerYaw(yaw: number) {
  if (typeof window === "undefined" || !Number.isFinite(yaw)) return;
  (window as PlayerWindowGlobals).__wofLastPlayerYaw = yaw;
}

export function getPublishedLastPlayerYaw(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const yaw = (window as PlayerWindowGlobals).__wofLastPlayerYaw;
  return Number.isFinite(yaw) ? yaw : undefined;
}

export function publishLastTeleportPosition(position: PlayerPositionLike) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.wofLastTeleportX = String(Math.round(position.x));
  document.documentElement.dataset.wofLastTeleportY = String(Math.round(position.y));
  document.documentElement.dataset.wofLastTeleportZ = String(Math.round(position.z));
}

export function publishLocalPlayerRigidBody(rigidBody: unknown) {
  if (typeof window === "undefined") return;
  (window as PlayerWindowGlobals).localPlayerRigidBody = rigidBody;
}

export function getPublishedLocalPlayerRigidBody(): PlayerRigidBodyLike | undefined {
  if (typeof window === "undefined") return undefined;
  const rigidBody = (window as PlayerWindowGlobals).localPlayerRigidBody;
  if (!rigidBody || typeof rigidBody !== "object") return undefined;
  const candidate = rigidBody as Partial<PlayerRigidBodyLike>;
  if (typeof candidate.translation !== "function") return undefined;
  if (candidate.setLinvel !== undefined && typeof candidate.setLinvel !== "function") return undefined;
  return candidate as PlayerRigidBodyLike;
}
