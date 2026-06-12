import { useEffect } from "react";
import {
  getExpiredLobbyMessageIds,
  getHudLobbyMessageCleanupNowMs,
  getLobbyMessageCleanupDelay,
  type HudLobbyMessageLifetime,
} from "./hudLobbyMessageRuntime";

export function useHudLobbyMessageCleanup(
  messages: readonly HudLobbyMessageLifetime[],
  removeMessage: (id: string) => void,
  nowProvider: () => number = getHudLobbyMessageCleanupNowMs,
) {
  useEffect(() => {
    if (messages.length === 0) return;

    const delay = getLobbyMessageCleanupDelay(messages, nowProvider());
    if (!Number.isFinite(delay)) return;

    const timeout = window.setTimeout(() => {
      const expiredIds = getExpiredLobbyMessageIds(messages, nowProvider());
      for (let index = 0; index < expiredIds.length; index += 1) {
        removeMessage(expiredIds[index]);
      }
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [messages, nowProvider, removeMessage]);
}
