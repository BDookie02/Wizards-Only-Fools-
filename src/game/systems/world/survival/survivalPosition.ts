import { LILY_COIL_QUEST_CHUNK, SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
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

type SurvivalPositionRouteSnapshot = {
  qaSpellDummies: boolean;
  qaSurvivalChunk: SurvivalChunkCoords | null;
  qaSurvivalUrlPosition: SurvivalWorldPosition | null;
  qaQuestSpawn: string;
};

export const QA_AUTHORED_VILLAGE_SAFE_LOCAL_Z = 214;

let cachedSurvivalPositionRouteSearch: string | null = null;
let cachedSurvivalPositionRouteSnapshot: SurvivalPositionRouteSnapshot | null = null;

export function getSurvivalChunkCoord(value: number) {
  return Math.floor((value + SURVIVAL_BLOCK_SIZE / 2) / SURVIVAL_BLOCK_SIZE);
}

function getSurvivalChunkCoordsForWorldPosition(position: SurvivalWorldPosition): SurvivalChunkCoords {
  return {
    cx: getSurvivalChunkCoord(position.x),
    cz: getSurvivalChunkCoord(position.z),
  };
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

function getQaSurvivalUrlPlayerWorldPositionFromParams(
  qaChunk: SurvivalChunkCoords | null,
  params: URLSearchParams,
): SurvivalWorldPosition | null {
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

function getSurvivalPositionRouteSnapshotFromSearch(search: string): SurvivalPositionRouteSnapshot {
  if (search === cachedSurvivalPositionRouteSearch && cachedSurvivalPositionRouteSnapshot) {
    return cachedSurvivalPositionRouteSnapshot;
  }

  const params = new URLSearchParams(search);
  const qaSurvivalChunk = parseSurvivalChunkCoordsParam(params.get("qaSurvivalChunk"));
  const snapshot: SurvivalPositionRouteSnapshot = {
    qaSpellDummies: params.get("qaSpellDummies") === "1",
    qaSurvivalChunk,
    qaSurvivalUrlPosition: getQaSurvivalUrlPlayerWorldPositionFromParams(qaSurvivalChunk, params),
    qaQuestSpawn: (params.get("qaQuestSpawn") || "").toLowerCase(),
  };

  cachedSurvivalPositionRouteSearch = search;
  cachedSurvivalPositionRouteSnapshot = snapshot;
  return snapshot;
}

function getCurrentSurvivalPositionRouteSnapshot(): SurvivalPositionRouteSnapshot | null {
  if (typeof window === "undefined") return null;
  return getSurvivalPositionRouteSnapshotFromSearch(window.location.search);
}

export function getQaSurvivalUrlPlayerWorldPosition(): SurvivalWorldPosition | null {
  return getCurrentSurvivalPositionRouteSnapshot()?.qaSurvivalUrlPosition ?? null;
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
  const route = getCurrentSurvivalPositionRouteSnapshot();
  const qaPosition = route?.qaSurvivalUrlPosition ?? null;
  const localPlayer = getBrowserSurvivalPlayerPosition();
  if (isLikelyStaleQaOriginPosition(localPlayer, qaPosition)) return qaPosition!;
  if (localPlayer) return { x: localPlayer.x, z: localPlayer.z };
  if (qaPosition) return qaPosition;

  if (route) {
    if (route.qaSpellDummies) {
      return getQaSurvivalChunkInitialWorldCenter(4, -3);
    }
    if (route.qaSurvivalChunk) {
      return getQaSurvivalChunkInitialWorldCenter(route.qaSurvivalChunk.cx, route.qaSurvivalChunk.cz);
    }
  }

  return { x: 0, z: 0 };
}

export function getInitialSurvivalCenterChunkCoords(): SurvivalChunkCoords {
  const route = getCurrentSurvivalPositionRouteSnapshot();
  if (route) {
    if (route.qaSpellDummies) {
      return getSurvivalChunkCoordsForWorldPosition(getQaSurvivalChunkInitialWorldCenter(4, -3));
    }

    const qaChunk = route.qaSurvivalChunk;
    if (qaChunk) {
      const center = route.qaSurvivalUrlPosition
        ?? getQaSurvivalChunkInitialWorldCenter(qaChunk.cx, qaChunk.cz);
      return getSurvivalChunkCoordsForWorldPosition(center);
    }

    const questSpawn = route.qaQuestSpawn;
    if (questSpawn === "lily" || questSpawn === "lily-coil" || questSpawn === "coil") {
      return { cx: LILY_COIL_QUEST_CHUNK.cx, cz: LILY_COIL_QUEST_CHUNK.cz };
    }

    const localPlayerPos = getBrowserSurvivalPlayerPosition();
    if (localPlayerPos) {
      return getSurvivalChunkCoordsForWorldPosition(localPlayerPos);
    }
  }

  return { cx: 0, cz: 0 };
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
  return playerPosition ? getSurvivalChunkCoordsForWorldPosition(playerPosition) : null;
}
