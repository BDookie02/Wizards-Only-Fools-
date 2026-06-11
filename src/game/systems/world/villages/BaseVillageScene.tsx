import { useEffect, useMemo } from "react";
import { Bushes } from "../../../Bushes";
import { Campfire } from "../../../Campfire";
import { Huts } from "../../../Huts";
import { TreeHouseVillage } from "../../../TreeHouseVillage";
import { Villagers } from "../../../Villagers";
import { WaterRipples } from "../../../WaterRipples";
import { BaseVillageTerrain, getBaseVillageTerrainHeight } from "../terrain/BaseVillageTerrain";
import { getSurvivalTerrainDetailTexture } from "../terrain/survivalTerrainTextures";
import { ClosedArenaWalls, VillagePerimeterWalls } from "./VillagePerimeterWalls";
import { getVillageWallTexture } from "./villageWallTexture";

type BaseVillageSceneProps = {
  isSurvivalMode: boolean;
  renderBaseVillageContent: boolean;
  showBaseVillagePeople: boolean;
  showBaseVillageProps: boolean;
  showBaseVillageTreeHouse: boolean;
};

export function BaseVillageScene({
  isSurvivalMode,
  renderBaseVillageContent,
  showBaseVillagePeople,
  showBaseVillageProps,
  showBaseVillageTreeHouse,
}: BaseVillageSceneProps) {
  const groundTexture = useMemo(() => {
    const tex = getSurvivalTerrainDetailTexture().clone();
    tex.repeat.set(128, 128);
    tex.needsUpdate = true;
    return tex;
  }, []);
  const wallTexture = useMemo(() => getVillageWallTexture(), []);

  useEffect(() => () => groundTexture.dispose(), [groundTexture]);

  return (
    <>
      {showBaseVillageProps && <Campfire position={[8, getBaseVillageTerrainHeight(8, 30), 30]} />}

      {isSurvivalMode && renderBaseVillageContent && <VillagePerimeterWalls wallTexture={wallTexture} />}

      {!isSurvivalMode && <ClosedArenaWalls wallTexture={wallTexture} />}

      {showBaseVillageProps && <Bushes />}

      {renderBaseVillageContent && <BaseVillageTerrain terrainTexture={groundTexture} />}

      {showBaseVillageProps && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]} renderOrder={-2}>
          <planeGeometry args={[512, 512]} />
          <meshStandardMaterial color="#2d5a88" transparent opacity={0.8} />
        </mesh>
      )}

      {showBaseVillageProps && <Huts />}
      {showBaseVillagePeople && <Villagers />}
      {showBaseVillagePeople && <WaterRipples />}
      {showBaseVillageTreeHouse && <TreeHouseVillage />}
    </>
  );
}
