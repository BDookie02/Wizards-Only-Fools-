export const MULTIPLAYER_MAX_PLAYERS_PER_ROOM = 32;
export const MULTIPLAYER_MIN_CUSTOM_LOBBY_PLAYERS = 2;
export const MULTIPLAYER_MIN_SURVIVAL_PLAYERS = 1;
export const MULTIPLAYER_DEFAULT_CUSTOM_LOBBY_MAX_PLAYERS = 8;
export const MULTIPLAYER_DEFAULT_SURVIVAL_MAX_PLAYERS = 4;

export const MULTIPLAYER_POSE_SYNC_RATE_HZ = 15;
export const MULTIPLAYER_HIGH_PRIORITY_POSE_SYNC_RATE_HZ = 30;
export const MULTIPLAYER_SERVER_SEND_RATE_HZ = 30;
export const MULTIPLAYER_CLIENT_INPUT_SAMPLE_RATE_HZ = 60;

export const MULTIPLAYER_SERVER_EVENT_BUDGETS = Object.freeze({
  join: Object.freeze({ windowMs: 1000, maxEvents: 6 }),
  updateMe: Object.freeze({ windowMs: 1000, maxEvents: 45 }),
  castSpell: Object.freeze({ windowMs: 1000, maxEvents: 20 }),
  manaPulse: Object.freeze({ windowMs: 1000, maxEvents: 12 }),
  setArmor: Object.freeze({ windowMs: 1000, maxEvents: 12 }),
  applyStatusEffect: Object.freeze({ windowMs: 1000, maxEvents: 24 }),
  clearStatusEffect: Object.freeze({ windowMs: 1000, maxEvents: 24 }),
  damageHealth: Object.freeze({ windowMs: 1000, maxEvents: 30 }),
  enginePlaceableDelete: Object.freeze({ windowMs: 1000, maxEvents: 30 }),
  enginePlaceableSnapshot: Object.freeze({ windowMs: 1000, maxEvents: 6 }),
  enginePlaceableUpsert: Object.freeze({ windowMs: 1000, maxEvents: 20 }),
  hitPlayer: Object.freeze({ windowMs: 1000, maxEvents: 30 }),
  grabControl: Object.freeze({ windowMs: 1000, maxEvents: 72 }),
  grabRelease: Object.freeze({ windowMs: 1000, maxEvents: 72 }),
  voiceAnswer: Object.freeze({ windowMs: 1000, maxEvents: 16 }),
  voiceIceCandidate: Object.freeze({ windowMs: 1000, maxEvents: 120 }),
  voiceOffer: Object.freeze({ windowMs: 1000, maxEvents: 16 }),
});

export const MULTIPLAYER_JOIN_REJECTION_REASONS = Object.freeze({
  NAME_REQUIRED: "name-required",
  ROOM_FULL: "room-full",
  ROOM_REQUIRED: "room-required",
});

export const MULTIPLAYER_PLATFORM_BUDGETS = Object.freeze({
  pc: Object.freeze({
    targetFps: 60,
    maxRemotePlayers: MULTIPLAYER_MAX_PLAYERS_PER_ROOM - 1,
    maxPoseHz: MULTIPLAYER_HIGH_PRIORITY_POSE_SYNC_RATE_HZ,
  }),
  android: Object.freeze({
    targetFps: 60,
    maxRemotePlayers: MULTIPLAYER_MAX_PLAYERS_PER_ROOM - 1,
    maxPoseHz: MULTIPLAYER_POSE_SYNC_RATE_HZ,
  }),
  ios: Object.freeze({
    targetFps: 60,
    maxRemotePlayers: MULTIPLAYER_MAX_PLAYERS_PER_ROOM - 1,
    maxPoseHz: MULTIPLAYER_POSE_SYNC_RATE_HZ,
  }),
});

export function getMultiplayerPoseIntervalMs(highPriority = false) {
  const hz = highPriority ? MULTIPLAYER_HIGH_PRIORITY_POSE_SYNC_RATE_HZ : MULTIPLAYER_POSE_SYNC_RATE_HZ;
  return 1000 / hz;
}

export function canRoomAcceptPlayer(playerCount) {
  return Number.isFinite(playerCount) && playerCount < MULTIPLAYER_MAX_PLAYERS_PER_ROOM;
}

export function getServerEventBudget(eventName) {
  return MULTIPLAYER_SERVER_EVENT_BUDGETS[eventName] || null;
}
