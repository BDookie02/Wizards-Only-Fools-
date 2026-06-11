import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import { getLastKnownLocalPlayerPosition } from "../../player/playerEventBridge";

export type SurvivalWorldPosition = {
  x: number;
  z: number;
};

export type SurvivalPlayerWorldPosition = SurvivalWorldPosition & {
  y?: number;
};

export type SurvivalChunkCoords = {
  cx: number;
  cz: number;
};

export const QA_AUTHORED_VILLAGE_SAFE_LOCAL_Z = 214;

export function getSurvivalChunkCoord(value: number) {
  return Math.floor((value + SURVIVAL_BLOCK_SIZE / 2) / SURVIVAL_BLOCK_SIZE);
}

export function parseSurvivalChunkCoordsParam(value: string | null): SurvivalChunkCoords | null {
  if (!value) return null;
  const commaIndex = value.indexOf(",");
  if (commaIndex < 0) return null;

  const cx = Number(value.slice(0, commaIndex).trim());
  const cz = Number(value.slice(commaIndex + 1).trim());
  if (!Number.isFinite(cx) || !Number.isFinite(cz)) return null;
  return { cx, cz };
}

export function getQaSurvivalChunkInitialWorldCenter(cx: number, cz: number): SurvivalWorldPosition {
  const key = `${cx},${cz}`;
  const options: Record<string, { localX?: number; localZ?: number }> = {
    "0,0": { localX: 0, localZ: 30 },
    "4,-4": { localX: 0, localZ: QA_AUTHORED_VILLAGE_SAFE_LOCAL_Z },
    "0,-3": { localX: 0, localZ: QA_AUTHORED_VILLAGE_SAFE_LOCAL_Z },
    "-3,-3": { localX: 0, localZ: QA_AUTHORED_VILLAGE_SAFE_LOCAL_Z },
    "1,0": { localX: 0, localZ: 24 },
    "3,0": { localX: -36, localZ: 182 },
    "5,2": { localX: 0, localZ: 132 },
    "12,-12": { localX: 0, localZ: 116 },
  };
  const offset = options[key];

  return {
    x: cx * SURVIVAL_BLOCK_SIZE + (offset?.localX ?? 0),
    z: cz * SURVIVAL_BLOCK_SIZE + (offset?.localZ ?? 214),
  };
}

export function getQaSurvivalUrlPlayerWorldPosition(): SurvivalWorldPosition | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const qaChunk = parseSurvivalChunkCoordsParam(params.get("qaSurvivalChunk"));
  if (!qaChunk) return null;
  const { cx, cz } = qaChunk;

  const fallback = getQaSurvivalChunkInitialWorldCenter(cx, cz);
  const localX = Number(params.get("qaSurvivalLocalX"));
  const localZ = Number(params.get("qaSurvivalLocalZ"));

  return {
    x: cx * SURVIVAL_BLOCK_SIZE + (Number.isFinite(localX) ? localX : fallback.x - cx * SURVIVAL_BLOCK_SIZE),
    z: cz * SURVIVAL_BLOCK_SIZE + (Number.isFinite(localZ) ? localZ : fallback.z - cz * SURVIVAL_BLOCK_SIZE),
  };
}

export function getBrowserSurvivalPlayerPosition(): SurvivalPlayerWorldPosition | null {
  const candidate = getLastKnownLocalPlayerPosition();
  if (candidate) return { x: candidate.x, y: candidate.y, z: candidate.z };
  return null;
}

function isLikelyStaleQaOriginPosition(
  livePosition: SurvivalPlayerWorldPosition | null,
  qaPosition: SurvivalWorldPosition | null,
) {
  if (!livePosition || !qaPosition) return false;
  const liveNearDefaultOrigin = livePosition.x * livePosition.x + livePosition.z * livePosition.z < 4;
  const dx = qaPosition.x - livePosition.x;
  const dz = qaPosition.z - livePosition.z;
  const qaAwayFromLive = dx * dx + dz * dz > 64;
  return liveNearDefaultOrigin && qaAwayFromLive;
}

export function getInitialSurvivalLocalGrassCenter(): SurvivalWorldPosition {
  const qaPosition = getQaSurvivalUrlPlayerWorldPosition();
  const localPlayer = getBrowserSurvivalPlayerPosition();
  if (isLikelyStaleQaOriginPosition(localPlayer, qaPosition)) return qaPosition!;
  if (localPlayer) return { x: localPlayer.x, z: localPlayer.z };
  if (qaPosition) return qaPosition;

  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("qaSpellDummies") === "1") {
      return getQaSurvivalChunkInitialWorldCenter(4, -3);
    }
    const qaChunk = parseSurvivalChunkCoordsParam(params.get("qaSurvivalChunk"));
    if (qaChunk) {
      return getQaSurvivalChunkInitialWorldCenter(qaChunk.cx, qaChunk.cz);
    }
  }

  return { x: 0, z: 0 };
}

export function getCurrentSurvivalPlayerWorldPosition(): SurvivalWorldPosition | null {
  const qaPosition = getQaSurvivalUrlPlayerWorldPosition();
  const livePosition = getBrowserSurvivalPlayerPosition();
  if (isLikelyStaleQaOriginPosition(livePosition, qaPosition)) {
    return qaPosition;
  }
  if (livePosition) {
    return { x: livePosition.x, z: livePosition.z };
  }
  return qaPosition;
}

export function getCurrentSurvivalPlayerChunkCoords(): SurvivalChunkCoords | null {
  const playerPosition = getCurrentSurvivalPlayerWorldPosition();
  return playerPosition
    ? {
      cx: getSurvivalChunkCoord(playerPosition.x),
      cz: getSurvivalChunkCoord(playerPosition.z),
    }
    : null;
}
