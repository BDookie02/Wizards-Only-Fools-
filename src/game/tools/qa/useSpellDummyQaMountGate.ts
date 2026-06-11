import { useCallback, useEffect, useMemo, useState } from "react";
import { isCurrentQaTelemetryRouteEnabled } from "./qaRouteTelemetry";

const SPELL_DUMMY_QA_FALLBACK_MOUNT_DELAY_MS = 650;

export function useSpellDummyQaMountGate() {
  const spellDummyQaRequested = useMemo(() => isCurrentQaTelemetryRouteEnabled(["spellDummies"]), []);
  const [shouldMountSpellDummyQa, setShouldMountSpellDummyQa] = useState(false);

  useEffect(() => {
    if (!spellDummyQaRequested) return;
    const timeout = window.setTimeout(
      () => setShouldMountSpellDummyQa(true),
      SPELL_DUMMY_QA_FALLBACK_MOUNT_DELAY_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [spellDummyQaRequested]);

  const mountSpellDummyQaNow = useCallback(() => {
    if (spellDummyQaRequested) setShouldMountSpellDummyQa(true);
  }, [spellDummyQaRequested]);

  return {
    mountSpellDummyQaNow,
    shouldMountSpellDummyQa,
  };
}
