export type PlayerToxicDamageState = {
  damageBuffer: number;
  lastSyncAt: number;
};

export type PlayerToxicDamageFrameInput = {
  acidUntil: number;
  connectedPlayerId: string | null;
  deltaSeconds: number;
  health: number;
  nowMs: number;
  poisonUntil: number;
  syncIntervalMs?: number;
  toxicDamagePerSecond: number;
};

export type PlayerToxicDamageFrameResult = {
  active: boolean;
  health: number;
  syncDamage: number;
};

export type PlayerToxicDamageFrameApplication = {
  applied: boolean;
  health: number;
  shouldStopFrame: boolean;
};

export type PlayerToxicDamageFrameApplier = {
  connectedPlayerId: string | null;
  emitGameNetworkEvent: (eventName: "damageHealth", playerId: string, amount: number) => unknown;
  setHealth: (health: number) => void;
};

export type PlayerClearToxicEffectsPlanInput = {
  acidUntil: number;
  connectedPlayerId: string | null;
  nowMs: number;
  poisonUntil: number;
};

export type PlayerClearToxicEffectsPlan = {
  shouldClear: boolean;
  networkPayload: {
    targetId: string;
    effects: string[];
  } | null;
};

export type PlayerClearToxicEffectsPlanApplier = {
  clearToxicEffects: () => void;
  emitGameNetworkEvent: (
    eventName: "clearStatusEffect",
    payload: NonNullable<PlayerClearToxicEffectsPlan["networkPayload"]>,
  ) => void;
};

const DEFAULT_TOXIC_DAMAGE_SYNC_INTERVAL_MS = 500;
const PLAYER_TOXIC_EFFECTS_TO_CLEAR = ["poison", "acid"] as const;

export function getPlayerToxicDamagePerSecond(
  poisonUntil: number,
  acidUntil: number,
  nowMs: number,
  toxicDamagePerSecond: number,
) {
  return (
    (poisonUntil > nowMs ? toxicDamagePerSecond : 0) +
    (acidUntil > nowMs ? toxicDamagePerSecond : 0)
  );
}

export function updatePlayerToxicDamageFrame(
  state: PlayerToxicDamageState,
  input: PlayerToxicDamageFrameInput,
): PlayerToxicDamageFrameResult {
  const toxicDps = getPlayerToxicDamagePerSecond(
    input.poisonUntil,
    input.acidUntil,
    input.nowMs,
    input.toxicDamagePerSecond,
  );

  if (toxicDps <= 0) {
    state.damageBuffer = 0;
    state.lastSyncAt = input.nowMs;
    return {
      active: false,
      health: input.health,
      syncDamage: 0,
    };
  }

  const health = Math.max(0, input.health - toxicDps * input.deltaSeconds);
  state.damageBuffer += input.health - health;

  const syncIntervalMs = input.syncIntervalMs ?? DEFAULT_TOXIC_DAMAGE_SYNC_INTERVAL_MS;
  const shouldSync = Boolean(
    input.connectedPlayerId &&
    state.damageBuffer > 0 &&
    (input.nowMs - state.lastSyncAt >= syncIntervalMs || health <= 0),
  );
  const syncDamage = shouldSync ? state.damageBuffer : 0;

  if (shouldSync) {
    state.damageBuffer = 0;
    state.lastSyncAt = input.nowMs;
  }

  return {
    active: true,
    health,
    syncDamage,
  };
}

export function applyPlayerToxicDamageFrameResult(
  frame: PlayerToxicDamageFrameResult,
  applier: PlayerToxicDamageFrameApplier,
): PlayerToxicDamageFrameApplication {
  if (!frame.active) {
    return {
      applied: false,
      health: frame.health,
      shouldStopFrame: false,
    };
  }

  applier.setHealth(frame.health);
  if (applier.connectedPlayerId && frame.syncDamage > 0) {
    applier.emitGameNetworkEvent("damageHealth", applier.connectedPlayerId, frame.syncDamage);
  }
  return {
    applied: true,
    health: frame.health,
    shouldStopFrame: frame.health <= 0,
  };
}

export function createPlayerClearToxicEffectsPlan(
  input: PlayerClearToxicEffectsPlanInput,
): PlayerClearToxicEffectsPlan {
  if (input.poisonUntil <= input.nowMs && input.acidUntil <= input.nowMs) {
    return {
      shouldClear: false,
      networkPayload: null,
    };
  }

  return {
    shouldClear: true,
    networkPayload: input.connectedPlayerId
      ? {
          targetId: input.connectedPlayerId,
          effects: [...PLAYER_TOXIC_EFFECTS_TO_CLEAR],
        }
      : null,
  };
}

export function applyPlayerClearToxicEffectsPlan(
  plan: PlayerClearToxicEffectsPlan,
  applier: PlayerClearToxicEffectsPlanApplier,
) {
  if (!plan.shouldClear) return false;

  applier.clearToxicEffects();
  if (plan.networkPayload) {
    applier.emitGameNetworkEvent("clearStatusEffect", plan.networkPayload);
  }
  return true;
}
