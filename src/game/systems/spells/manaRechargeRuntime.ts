import type { SurvivalManaFlowerSource } from "../world/survival/survivalManaSources";

export const MANA_FLOWER_RESPAWN_MS = 142000;
export const MANA_SOURCE_RECONCILE_INTERVAL_MS = 250;
export const BASE_RUNE_SOURCE_CYCLE_INTERVAL_MS = 15000;
export const RUNE_POWER_DECAY_INTERVAL_MS = 1000;

export type RuneHutSource = {
  id: string;
  x: number;
  y: number;
  z: number;
};

export type ManaFlowerCooldowns = Record<string, number>;

export type RunePowerState = {
  leftRunePower: number;
  rightRunePower: number;
};

export type RunePowerDecayResult = RunePowerState & {
  leftChanged: boolean;
  rightChanged: boolean;
};

const RUNE_ACTIVE_RATIO = 2 / 3;
let manaRenderClockEpochOffsetMs: number | null = null;

export type BaseVillageRuneSourceVisibilityInput = {
  isSurvivalMode: boolean;
  playerX?: number;
  playerZ?: number;
  blockSize: number;
  baseChunkRadius?: number;
};

export function shouldShowBaseVillageRuneSources({
  isSurvivalMode,
  playerX,
  playerZ,
  blockSize,
  baseChunkRadius = 0,
}: BaseVillageRuneSourceVisibilityInput) {
  if (!isSurvivalMode) return true;
  if (!Number.isFinite(playerX) || !Number.isFinite(playerZ) || blockSize <= 0) return false;

  const chunkX = Math.floor(((playerX as number) + blockSize / 2) / blockSize);
  const chunkZ = Math.floor(((playerZ as number) + blockSize / 2) / blockSize);
  return Math.abs(chunkX) <= baseChunkRadius && Math.abs(chunkZ) <= baseChunkRadius;
}

export function pickActiveRuneIds(
  hutPositions: readonly RuneHutSource[],
  previousRuneIds: ReadonlySet<string>,
  random = Math.random,
) {
  const targetCount = Math.floor(hutPositions.length * RUNE_ACTIVE_RATIO);
  const availableHuts: RuneHutSource[] = [];

  for (let index = 0; index < hutPositions.length; index += 1) {
    const hut = hutPositions[index];
    if (!previousRuneIds.has(hut.id)) availableHuts.push(hut);
  }

  const pool = availableHuts.length < targetCount ? hutPositions.slice() : availableHuts;
  const limit = Math.min(targetCount, pool.length);
  const selected = new Array<string>(limit);

  for (let index = 0; index < limit; index += 1) {
    const swapIndex = index + Math.floor(random() * (pool.length - index));
    const picked = pool[swapIndex];
    pool[swapIndex] = pool[index];
    pool[index] = picked;
    selected[index] = picked.id;
  }

  return selected;
}

export function getDecayedRunePower(state: RunePowerState): RunePowerDecayResult | null {
  const leftRunePower = Math.max(0, state.leftRunePower - 1);
  const rightRunePower = Math.max(0, state.rightRunePower - 1);
  const leftChanged = leftRunePower !== state.leftRunePower;
  const rightChanged = rightRunePower !== state.rightRunePower;
  if (!leftChanged && !rightChanged) return null;
  return {
    leftRunePower,
    rightRunePower,
    leftChanged,
    rightChanged,
  };
}

export function getEpochMsFromManaRenderClock(elapsedSeconds: number, sampledEpochNow?: number) {
  const elapsedMs = elapsedSeconds * 1000;
  if (!Number.isFinite(elapsedMs)) return sampledEpochNow ?? Date.now();

  if (manaRenderClockEpochOffsetMs === null) {
    manaRenderClockEpochOffsetMs = (sampledEpochNow ?? Date.now()) - elapsedMs;
  }

  return manaRenderClockEpochOffsetMs + elapsedMs;
}

export function shouldReconcileManaSources(
  elapsedMs: number,
  lastReconcileAtMs: number,
  intervalMs = MANA_SOURCE_RECONCILE_INTERVAL_MS,
) {
  return !Number.isFinite(lastReconcileAtMs) || elapsedMs - lastReconcileAtMs >= intervalMs;
}

export function resetManaRenderClockEpochForTests() {
  manaRenderClockEpochOffsetMs = null;
}

export function pruneManaFlowerCooldowns(current: ManaFlowerCooldowns, now: number) {
  let hasExpired = false;
  for (const id in current) {
    if (current[id] <= now) {
      hasExpired = true;
      break;
    }
  }

  if (!hasExpired) return current;

  const next: ManaFlowerCooldowns = {};
  for (const id in current) {
    const until = current[id];
    if (until > now) next[id] = until;
  }
  return next;
}

export function getNextManaFlowerCooldownExpiry(current: ManaFlowerCooldowns) {
  let nextExpiry = Number.POSITIVE_INFINITY;
  for (const id in current) {
    const until = current[id];
    if (Number.isFinite(until) && until < nextExpiry) nextExpiry = until;
  }
  return nextExpiry;
}

export function getReadyManaFlowerCount(
  sources: readonly SurvivalManaFlowerSource[],
  cooldowns: ManaFlowerCooldowns,
  now: number,
) {
  let readyCount = 0;
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index];
    if ((cooldowns[source.id] ?? 0) <= now) readyCount += 1;
  }
  return readyCount;
}

export function getManaFlowerSample(sources: readonly SurvivalManaFlowerSource[]) {
  let sample = "";
  const limit = Math.min(4, sources.length);
  for (let index = 0; index < limit; index += 1) {
    const source = sources[index];
    if (sample) sample += "|";
    sample += `${source.id}:${Math.round(source.x)},${Math.round(source.y)},${Math.round(source.z)}`;
  }
  return sample;
}

export function getManaFlowerCooldownSummary(cooldowns: ManaFlowerCooldowns, now: number) {
  let summary = "";
  for (const id in cooldowns) {
    if (summary) summary += "|";
    summary += `${id}:${Math.max(0, Math.ceil((cooldowns[id] - now) / 1000))}`;
  }
  return summary;
}

export function publishManaFlowerQaDataset(
  sources: readonly SurvivalManaFlowerSource[],
  cooldowns: ManaFlowerCooldowns,
  now: number,
) {
  if (typeof document === "undefined") return;

  (window as any).__wofManaFlowerSources = sources;
  const root = document.documentElement;
  root.dataset.wofManaFlowerCount = String(sources.length);
  root.dataset.wofManaFlowerReady = String(getReadyManaFlowerCount(sources, cooldowns, now));
  root.dataset.wofManaFlowerSample = getManaFlowerSample(sources);
  root.dataset.wofManaFlowerCooldowns = getManaFlowerCooldownSummary(cooldowns, now);
}
