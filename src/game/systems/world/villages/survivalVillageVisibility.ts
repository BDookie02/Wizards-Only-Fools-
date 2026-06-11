import {
  SURVIVAL_RENDER_RADIUS,
  type SurvivalChunkInfo,
} from "../survival/survivalWorldConfig";
import {
  getBrowserSurvivalPlayerPosition,
  getQaSurvivalUrlPlayerWorldPosition,
  getSurvivalChunkCoord,
} from "../survival/survivalPosition";
import { isSurvivalVillageSafeZoneAtWorld } from "../survival/survivalManaSources";

export function shouldRenderSurvivalMountainVillageShellChunk(chunk: SurvivalChunkInfo) {
  return chunk.villageKind === "mountain" && chunk.distance <= SURVIVAL_RENDER_RADIUS;
}

export function shouldRenderSurvivalFullVillageChunk(chunk: SurvivalChunkInfo) {
  if (!chunk.hasVillage) return false;
  if (shouldRenderSurvivalMountainVillageShellChunk(chunk)) return true;
  if (chunk.lod === "far") return false;

  const playerPosition = getBrowserSurvivalPlayerPosition() ?? getQaSurvivalUrlPlayerWorldPosition();
  if (!playerPosition) return chunk.distance === 0;

  const playerChunkX = getSurvivalChunkCoord(playerPosition.x);
  const playerChunkZ = getSurvivalChunkCoord(playerPosition.z);
  if (playerChunkX !== chunk.cx || playerChunkZ !== chunk.cz) return false;

  return isSurvivalVillageSafeZoneAtWorld(playerPosition.x, playerPosition.z, 0);
}
