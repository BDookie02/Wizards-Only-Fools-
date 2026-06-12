import { useEffect, useState } from "react";

export type RemoteStatusExpiries = {
  slowUntil: number;
  sleepUntil: number;
  poisonUntil: number;
  acidUntil: number;
};

export function getNextRemoteStatusExpiryMs(expiries: RemoteStatusExpiries, nowMs: number) {
  let nextExpiry = Number.POSITIVE_INFINITY;
  if (expiries.slowUntil > nowMs && expiries.slowUntil < nextExpiry) nextExpiry = expiries.slowUntil;
  if (expiries.sleepUntil > nowMs && expiries.sleepUntil < nextExpiry) nextExpiry = expiries.sleepUntil;
  if (expiries.poisonUntil > nowMs && expiries.poisonUntil < nextExpiry) nextExpiry = expiries.poisonUntil;
  if (expiries.acidUntil > nowMs && expiries.acidUntil < nextExpiry) nextExpiry = expiries.acidUntil;
  return nextExpiry;
}

export function getRemoteStatusClockDelayMs(
  expiries: RemoteStatusExpiries,
  nowMs: number,
  paddingMs = 24,
) {
  const nextExpiry = getNextRemoteStatusExpiryMs(expiries, nowMs);
  if (!Number.isFinite(nextExpiry)) return Number.POSITIVE_INFINITY;
  return Math.max(0, nextExpiry - nowMs + paddingMs);
}

export function getRemoteStatusClockNowMs() {
  return Date.now();
}

function hasAnyRemoteStatusExpiry(expiries: RemoteStatusExpiries) {
  return (
    expiries.slowUntil > 0 ||
    expiries.sleepUntil > 0 ||
    expiries.poisonUntil > 0 ||
    expiries.acidUntil > 0
  );
}

export function hasActiveRemoteStatusExpiry(expiries: RemoteStatusExpiries, nowMs: number) {
  return (
    expiries.slowUntil > nowMs ||
    expiries.sleepUntil > nowMs ||
    expiries.poisonUntil > nowMs ||
    expiries.acidUntil > nowMs
  );
}

export function useRemoteStatusClock(expiries: RemoteStatusExpiries, paddingMs = 24) {
  const hasTimedStatus = hasAnyRemoteStatusExpiry(expiries);
  const [clock, setClock] = useState(() => (hasTimedStatus ? getRemoteStatusClockNowMs() : 0));
  const effectiveClock = hasTimedStatus ? clock || getRemoteStatusClockNowMs() : 0;

  useEffect(() => {
    if (!hasTimedStatus) {
      if (clock !== 0) setClock(0);
      return undefined;
    }

    const now = getRemoteStatusClockNowMs();
    if (!hasActiveRemoteStatusExpiry(expiries, now)) {
      if (clock === 0 || Math.abs(clock - now) > 100) setClock(now);
      return undefined;
    }

    if (clock === 0 || Math.abs(clock - now) > 100) {
      setClock(now);
      return undefined;
    }

    const delay = getRemoteStatusClockDelayMs(expiries, now, paddingMs);
    if (!Number.isFinite(delay)) return undefined;

    const timeout = window.setTimeout(() => setClock(getRemoteStatusClockNowMs()), delay);
    return () => window.clearTimeout(timeout);
  }, [
    clock,
    expiries.acidUntil,
    expiries.poisonUntil,
    expiries.sleepUntil,
    expiries.slowUntil,
    hasTimedStatus,
    paddingMs,
  ]);

  return effectiveClock;
}
