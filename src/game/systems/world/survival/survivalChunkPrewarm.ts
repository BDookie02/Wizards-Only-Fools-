import {
  SURVIVAL_ALL_TERRAIN_SKIRT_EDGES,
  makeSurvivalTerrainCollisionGeometry,
  makeSurvivalTerrainGeometry,
  makeSurvivalTerrainSkirtGeometry,
} from "../terrain/survivalTerrainGeometry";
import type { SurvivalChunkInfo } from "./survivalWorldConfig";
import { getSurvivalTerrainHeightForChunk } from "./survivalTerrainSurface";
import { makeSurvivalRiverSurfaceGeometry } from "./survivalRivers";
import {
  shouldBuildSurvivalChunkColliders,
  shouldRenderSurvivalTerrainSkirt,
} from "./survivalChunks";

export function prewarmSurvivalChunkGeometry(chunk: SurvivalChunkInfo) {
  makeSurvivalTerrainGeometry(chunk);
  if (shouldBuildSurvivalChunkColliders(chunk)) {
    makeSurvivalTerrainCollisionGeometry(chunk);
  }
  if (shouldRenderSurvivalTerrainSkirt(chunk)) {
    makeSurvivalTerrainSkirtGeometry(chunk, SURVIVAL_ALL_TERRAIN_SKIRT_EDGES);
  }
  if (chunk.hasRiver) {
    makeSurvivalRiverSurfaceGeometry(chunk, getSurvivalTerrainHeightForChunk);
  }
}
