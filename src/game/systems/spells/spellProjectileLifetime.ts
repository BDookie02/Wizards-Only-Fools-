import { useCallback, useEffect, useRef } from "react";
import { useGameStore } from "../../../store/gameStore";

export function useProjectileLifetime(projectileId: string, lifetimeMs: number) {
  const removeProjectile = useGameStore(s => s.removeProjectile);
  const pendingRemovalTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const lifetimeTimeout = window.setTimeout(() => removeProjectile(projectileId), lifetimeMs);
    return () => {
      window.clearTimeout(lifetimeTimeout);
      if (pendingRemovalTimeoutRef.current !== null) {
        window.clearTimeout(pendingRemovalTimeoutRef.current);
        pendingRemovalTimeoutRef.current = null;
      }
    };
  }, [lifetimeMs, projectileId, removeProjectile]);

  return useCallback((delayMs = 0) => {
    if (pendingRemovalTimeoutRef.current !== null) return;
    pendingRemovalTimeoutRef.current = window.setTimeout(() => {
      pendingRemovalTimeoutRef.current = null;
      removeProjectile(projectileId);
    }, delayMs);
  }, [projectileId, removeProjectile]);
}
