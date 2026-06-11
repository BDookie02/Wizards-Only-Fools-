import { useEffect, useState } from "react";
import {
  getHudBuffClockDelayMs,
  hasAnyHudBuffExpiry,
  hasActiveHudBuff,
  type HudBuffClockExpiries,
} from "./hudBuffClockRuntime";

export function useHudBuffClock(expiries: HudBuffClockExpiries, wakePaddingMs = 24) {
  const hasTimedBuff = hasAnyHudBuffExpiry(expiries);
  const [clock, setClock] = useState(() => (hasTimedBuff ? Date.now() : 0));
  const effectiveClock = hasTimedBuff ? clock || Date.now() : 0;

  useEffect(() => {
    if (!hasTimedBuff) {
      if (clock !== 0) setClock(0);
      return undefined;
    }

    const now = Date.now();
    if (!hasActiveHudBuff(expiries, now)) {
      if (clock === 0 || Math.abs(clock - now) > 100) setClock(now);
      return undefined;
    }

    if (clock === 0 || Math.abs(clock - now) > 100) {
      setClock(now);
      return undefined;
    }

    const delay = getHudBuffClockDelayMs(expiries, now, wakePaddingMs);
    if (!Number.isFinite(delay)) return undefined;

    const timeout = window.setTimeout(() => setClock(Date.now()), delay);
    return () => window.clearTimeout(timeout);
  }, [
    clock,
    expiries.acidUntil,
    expiries.jumpBoostUntil,
    expiries.magicGlassOrbUntil,
    expiries.poisonUntil,
    expiries.sleepUntil,
    expiries.slowUntil,
    expiries.speedBoostUntil,
    hasTimedBuff,
    wakePaddingMs,
  ]);

  return effectiveClock;
}
