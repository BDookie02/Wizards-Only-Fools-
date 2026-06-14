import { getBaseVillageTerrainHeight } from "../world/terrain/BaseVillageTerrain";
import { getSurvivalGrassSurfaceHeightAtWorld } from "../world/survival/survivalGrassSurface";
import type { EngineGroundHeightResolver } from "./enginePlacementPreviewRuntime";

export function getEnginePlacementGroundResolver(isSurvivalMode: boolean): EngineGroundHeightResolver {
  return isSurvivalMode ? getSurvivalGrassSurfaceHeightAtWorld : getBaseVillageTerrainHeight;
}
