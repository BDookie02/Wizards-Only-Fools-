export type DevFastTravelSpawn = { x: number; y: number; z: number; yaw?: number };

export type ManualFastTravelSpawn = DevFastTravelSpawn & {
  key: string;
  until: number;
};

const MANUAL_FAST_TRAVEL_SPAWN_TTL_MS = 30 * 60 * 1000;

type WindowWithManualFastTravelSpawn = Window & {
  __wofManualFastTravelSpawn?: ManualFastTravelSpawn;
};

export function makeManualFastTravelSpawn(
  spawn: DevFastTravelSpawn,
  nowMs: number,
  ttlMs = MANUAL_FAST_TRAVEL_SPAWN_TTL_MS,
): ManualFastTravelSpawn {
  return {
    key: `manual-fast-travel:${nowMs.toString(36)}:${spawn.x.toFixed(2)}:${spawn.y.toFixed(2)}:${spawn.z.toFixed(2)}`,
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    yaw: Number.isFinite(spawn.yaw) ? spawn.yaw : undefined,
    until: nowMs + ttlMs,
  };
}

export function publishManualFastTravelSpawn(spawn: DevFastTravelSpawn, nowMs: number) {
  const manualSpawn = makeManualFastTravelSpawn(spawn, nowMs);
  if (typeof window !== "undefined") {
    (window as WindowWithManualFastTravelSpawn).__wofManualFastTravelSpawn = manualSpawn;
  }
  return manualSpawn;
}

export function readManualFastTravelSpawn(nowMs = Date.now()): ManualFastTravelSpawn | null {
  if (typeof window === "undefined") return null;
  const manual = (window as WindowWithManualFastTravelSpawn).__wofManualFastTravelSpawn;
  if (!manual || typeof manual !== "object" || Number(manual.until) <= nowMs) return null;

  const x = Number(manual.x);
  const y = Number(manual.y);
  const z = Number(manual.z);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;

  const yaw = Number(manual.yaw);
  return {
    key: typeof manual.key === "string" ? manual.key : `manual-fast-travel:${x.toFixed(2)}:${y.toFixed(2)}:${z.toFixed(2)}`,
    x,
    y,
    z,
    yaw: Number.isFinite(yaw) ? yaw : undefined,
    until: Number(manual.until),
  };
}
