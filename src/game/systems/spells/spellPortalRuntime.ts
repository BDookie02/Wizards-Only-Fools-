export const PORTAL_TELEPORT_COOLDOWN_MS = 1000;

let lastPortalTeleportAtMs = 0;

export function getPortalTeleportNowMs() {
  return Date.now();
}

export function resetPortalTeleportCooldown() {
  lastPortalTeleportAtMs = 0;
}

export function tryReservePortalTeleport(nowMs = getPortalTeleportNowMs(), cooldownMs = PORTAL_TELEPORT_COOLDOWN_MS) {
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : 0;
  const safeCooldownMs = Number.isFinite(cooldownMs) ? Math.max(0, cooldownMs) : PORTAL_TELEPORT_COOLDOWN_MS;
  if (safeNowMs - lastPortalTeleportAtMs < safeCooldownMs) return false;
  lastPortalTeleportAtMs = safeNowMs;
  return true;
}
