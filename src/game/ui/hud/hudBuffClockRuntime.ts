export type HudBuffClockExpiries = {
  speedBoostUntil: number;
  jumpBoostUntil: number;
  slowUntil: number;
  sleepUntil: number;
  poisonUntil: number;
  acidUntil: number;
  magicGlassOrbUntil: number;
};

export function hasActiveHudBuff(expiries: HudBuffClockExpiries, nowMs: number) {
  return expiries.speedBoostUntil > nowMs ||
    expiries.jumpBoostUntil > nowMs ||
    expiries.slowUntil > nowMs ||
    expiries.sleepUntil > nowMs ||
    expiries.poisonUntil > nowMs ||
    expiries.acidUntil > nowMs ||
    expiries.magicGlassOrbUntil > nowMs;
}

export function hasAnyHudBuffExpiry(expiries: HudBuffClockExpiries) {
  return expiries.speedBoostUntil > 0 ||
    expiries.jumpBoostUntil > 0 ||
    expiries.slowUntil > 0 ||
    expiries.sleepUntil > 0 ||
    expiries.poisonUntil > 0 ||
    expiries.acidUntil > 0 ||
    expiries.magicGlassOrbUntil > 0;
}

export function getHudBuffClockNowMs() {
  return Date.now();
}

function getNextVisibleSecondBoundaryMs(expiresAtMs: number, nowMs: number) {
  const remainingMs = expiresAtMs - nowMs;
  if (remainingMs <= 0) return Number.POSITIVE_INFINITY;
  const visibleSeconds = Math.ceil(remainingMs / 1000);
  return expiresAtMs - Math.max(0, visibleSeconds - 1) * 1000;
}

export function getNextHudBuffDisplayUpdateMs(expiries: HudBuffClockExpiries, nowMs: number) {
  let nextUpdate = Number.POSITIVE_INFINITY;
  const speedBoundary = getNextVisibleSecondBoundaryMs(expiries.speedBoostUntil, nowMs);
  if (speedBoundary < nextUpdate) nextUpdate = speedBoundary;
  const jumpBoundary = getNextVisibleSecondBoundaryMs(expiries.jumpBoostUntil, nowMs);
  if (jumpBoundary < nextUpdate) nextUpdate = jumpBoundary;
  const slowBoundary = getNextVisibleSecondBoundaryMs(expiries.slowUntil, nowMs);
  if (slowBoundary < nextUpdate) nextUpdate = slowBoundary;
  const sleepBoundary = getNextVisibleSecondBoundaryMs(expiries.sleepUntil, nowMs);
  if (sleepBoundary < nextUpdate) nextUpdate = sleepBoundary;
  const poisonBoundary = getNextVisibleSecondBoundaryMs(expiries.poisonUntil, nowMs);
  if (poisonBoundary < nextUpdate) nextUpdate = poisonBoundary;
  const acidBoundary = getNextVisibleSecondBoundaryMs(expiries.acidUntil, nowMs);
  if (acidBoundary < nextUpdate) nextUpdate = acidBoundary;
  if (expiries.magicGlassOrbUntil > nowMs && expiries.magicGlassOrbUntil < nextUpdate) {
    nextUpdate = expiries.magicGlassOrbUntil;
  }
  return nextUpdate;
}

export function getHudBuffClockDelayMs(
  expiries: HudBuffClockExpiries,
  nowMs: number,
  paddingMs = 24,
) {
  const nextUpdate = getNextHudBuffDisplayUpdateMs(expiries, nowMs);
  if (!Number.isFinite(nextUpdate)) return Number.POSITIVE_INFINITY;
  return Math.max(0, nextUpdate - nowMs + paddingMs);
}
