import { startTransition, useEffect, useRef, useState } from "react";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import { getPublishedLocalPlayerPosition } from "../../player/playerEventBridge";

export const BASE_VILLAGE_STREAM_DISTANCE = SURVIVAL_BLOCK_SIZE * 1.45;

type PlayerPositionDetail = {
  x?: number;
  z?: number;
};

function useBaseVillageDetailPhase(active: boolean) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!active) {
      setPhase(0);
      return undefined;
    }

    setPhase(0);
    const props = window.setTimeout(() => startTransition(() => setPhase(1)), 140);
    const people = window.setTimeout(() => startTransition(() => setPhase(2)), 520);
    const treeHouse = window.setTimeout(() => startTransition(() => setPhase(3)), 980);
    return () => {
      window.clearTimeout(props);
      window.clearTimeout(people);
      window.clearTimeout(treeHouse);
    };
  }, [active]);

  return phase;
}

export function useBaseVillageRenderState(isSurvivalMode: boolean) {
  const [isNearBaseVillage, setIsNearBaseVillage] = useState(true);
  const isNearBaseVillageRef = useRef(true);
  const renderBaseVillageContent = !isSurvivalMode || isNearBaseVillage;
  const baseVillageDetailPhase = useBaseVillageDetailPhase(isSurvivalMode && renderBaseVillageContent);

  useEffect(() => {
    if (!isSurvivalMode) {
      isNearBaseVillageRef.current = true;
      setIsNearBaseVillage((current) => current === true ? current : true);
      return undefined;
    }

    const updateBaseVillageVisibility = (detail?: PlayerPositionDetail) => {
      const localPlayer = getPublishedLocalPlayerPosition();
      const x = Number(detail?.x ?? localPlayer?.x ?? 0);
      const z = Number(detail?.z ?? localPlayer?.z ?? 0);
      const nearBaseVillage = Math.max(Math.abs(x), Math.abs(z)) < BASE_VILLAGE_STREAM_DISTANCE;
      if (isNearBaseVillageRef.current === nearBaseVillage) return;
      isNearBaseVillageRef.current = nearBaseVillage;
      setIsNearBaseVillage(nearBaseVillage);
    };

    updateBaseVillageVisibility();

    const handlePlayerMove = (event: Event) => {
      updateBaseVillageVisibility((event as CustomEvent<PlayerPositionDetail>).detail);
    };

    window.addEventListener("player-moved", handlePlayerMove);
    return () => window.removeEventListener("player-moved", handlePlayerMove);
  }, [isSurvivalMode]);

  return {
    baseVillageDetailPhase,
    isNearBaseVillage,
    renderBaseVillageContent,
    showBaseVillageProps: renderBaseVillageContent && (!isSurvivalMode || baseVillageDetailPhase >= 1),
    showBaseVillagePeople: renderBaseVillageContent && (!isSurvivalMode || baseVillageDetailPhase >= 2),
    showBaseVillageTreeHouse: renderBaseVillageContent && (!isSurvivalMode || baseVillageDetailPhase >= 3),
  };
}
