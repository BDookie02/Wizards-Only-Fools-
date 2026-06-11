import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { getDistanceToSegment2D } from "../survival/survivalMath";
import { getBrowserSurvivalPlayerPosition } from "../survival/survivalPosition";
import { MOUNTAIN_WATERFALL_CAMERA_HIDE_FAR } from "./mountainVillageTerrain";

export type MountainVillageWaterfallBounds = {
  topX: number;
  topZ: number;
  topY: number;
  bottomX: number;
  bottomZ: number;
  bottomY: number;
};

export function shouldHideMountainWaterfallForCamera(
  chunk: SurvivalChunkInfo,
  waterfall: MountainVillageWaterfallBounds,
) {
  const player = getBrowserSurvivalPlayerPosition();
  if (!player || typeof player.y !== "number") return false;

  const localX = player.x - chunk.x;
  const localZ = player.z - chunk.z;
  const distanceToFall = getDistanceToSegment2D(
    localX,
    localZ,
    waterfall.topX,
    waterfall.topZ,
    waterfall.bottomX,
    waterfall.bottomZ,
  );
  const isInsideFallHeight = player.y >= waterfall.bottomY - 16 && player.y <= waterfall.topY + 20;

  return isInsideFallHeight && distanceToFall < MOUNTAIN_WATERFALL_CAMERA_HIDE_FAR;
}
