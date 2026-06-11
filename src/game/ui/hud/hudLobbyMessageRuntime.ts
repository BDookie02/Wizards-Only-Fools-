export const HUD_LOBBY_MESSAGE_TTL_MS = 12000;

export type HudLobbyMessageLifetime = Readonly<{
  id: string;
  createdAt: number;
}>;

export function getExpiredLobbyMessageIds(
  messages: readonly HudLobbyMessageLifetime[],
  now: number,
  ttlMs = HUD_LOBBY_MESSAGE_TTL_MS,
) {
  const expired: string[] = [];
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (!Number.isFinite(message.createdAt)) continue;
    if (now - message.createdAt > ttlMs) expired.push(message.id);
  }
  return expired;
}

export function getNextLobbyMessageExpiry(
  messages: readonly HudLobbyMessageLifetime[],
  ttlMs = HUD_LOBBY_MESSAGE_TTL_MS,
) {
  let nextExpiry = Number.POSITIVE_INFINITY;
  for (let index = 0; index < messages.length; index += 1) {
    const createdAt = messages[index].createdAt;
    if (!Number.isFinite(createdAt)) continue;
    const expiry = createdAt + ttlMs;
    if (expiry < nextExpiry) nextExpiry = expiry;
  }
  return nextExpiry;
}

export function getLobbyMessageCleanupDelay(
  messages: readonly HudLobbyMessageLifetime[],
  now: number,
  ttlMs = HUD_LOBBY_MESSAGE_TTL_MS,
) {
  const nextExpiry = getNextLobbyMessageExpiry(messages, ttlMs);
  if (!Number.isFinite(nextExpiry)) return Number.POSITIVE_INFINITY;
  return Math.max(0, nextExpiry - now + 25);
}
