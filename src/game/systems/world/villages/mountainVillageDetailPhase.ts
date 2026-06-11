import { useEffect, useState } from "react";

export const MOUNTAIN_VILLAGE_DETAIL_PHASE_TRAIL_AND_CABINS = 1;
export const MOUNTAIN_VILLAGE_DETAIL_PHASE_MINESHAFT_SHELL = 2;
export const MOUNTAIN_VILLAGE_DETAIL_PHASE_MINESHAFT_INTERIOR = 3;
export const MOUNTAIN_VILLAGE_DETAIL_PHASE_FINISHING = 4;

export function useMountainVillageDetailPhase(active: boolean, chunkKey: string) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!active) {
      setPhase(0);
      return;
    }

    setPhase(0);
    const trailAndCabins = window.setTimeout(() => setPhase(MOUNTAIN_VILLAGE_DETAIL_PHASE_TRAIL_AND_CABINS), 140);
    const mineshaftShell = window.setTimeout(() => setPhase(MOUNTAIN_VILLAGE_DETAIL_PHASE_MINESHAFT_SHELL), 520);
    const mineshaftInterior = window.setTimeout(() => setPhase(MOUNTAIN_VILLAGE_DETAIL_PHASE_MINESHAFT_INTERIOR), 1100);
    const villagers = window.setTimeout(() => setPhase(MOUNTAIN_VILLAGE_DETAIL_PHASE_FINISHING), 1700);
    return () => {
      window.clearTimeout(trailAndCabins);
      window.clearTimeout(mineshaftShell);
      window.clearTimeout(mineshaftInterior);
      window.clearTimeout(villagers);
    };
  }, [active, chunkKey]);

  return phase;
}
