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

const DEFAULT_TOXIC_DAMAGE_SYNC_INTERVAL_MS = 500;

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
