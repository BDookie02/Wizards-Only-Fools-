import {
  DARREL_QUEST_CHUNK,
  LILY_COIL_QUEST_CHUNK,
  SURVIVAL_BLOCK_SIZE,
  getDarrelQuestSpawn,
  getLilyCoilQuestSpawn,
  useGameStore,
} from "../../../../store/gameStore";
import { getRuntimeRandomUnit } from "../../random/runtimeRandom";
import { readManualFastTravelSpawn } from "../../../tools/manualFastTravelSpawn";
import { getBaseVillageTerrainHeight } from "../terrain/BaseVillageTerrain";
import { QA_AUTHORED_VILLAGE_SAFE_LOCAL_Z, parseSurvivalChunkCoordsParam } from "./survivalPosition";

export type QaSurvivalSpawn = {
  key: string;
  position: [number, number, number];
  yaw?: number;
  pitch?: number;
};

type SurvivalSpawnOptions = {
  y?: number;
  localX?: number;
  localZ?: number;
  yaw?: number;
  pitch?: number;
};

type QaSurvivalChunkRoute = {
  cx: number;
  cz: number;
  key: string;
};

type SurvivalSpawnRouteSnapshot = {
  runKey: string;
  qaSpellDummies: boolean;
  qaSurvivalChunk: QaSurvivalChunkRoute | null;
  qaSurvivalWalk: boolean;
  qaQuestSpawn: string;
  spawnMountain: boolean;
  spawnGraveyard: boolean;
  disableMountainSpawn: boolean;
  disableSwampSpawn: boolean;
  disableGraveyardSpawn: boolean;
  disableDefaultQuestSpawn: boolean;
  y?: number;
  localX?: number;
  localZ?: number;
  yaw?: number;
  pitch?: number;
};

const TEMP_MOUNTAIN_VILLAGE_SPAWN_CHUNK: [number, number] = [3, 0];
const TEMP_MOUNTAIN_VILLAGE_SPAWN_Y = 86;
const TEMP_MOUNTAIN_VILLAGE_SPAWN_LOCAL_X = -36;
const TEMP_MOUNTAIN_VILLAGE_SPAWN_LOCAL_Z = 182;
const QA_SPELL_DUMMY_RANGE_CHUNK: [number, number] = [4, -3];
const QA_SPELL_DUMMY_RANGE_Y = 150;
const QA_SPELL_DUMMY_RANGE_LOCAL_Z = 214;
const TEMP_GRAVEYARD_VILLAGE_SPAWN_CHUNK: [number, number] = [5, 2];
const TEMP_GRAVEYARD_VILLAGE_SPAWN_Y = 92;
const TEMP_GRAVEYARD_VILLAGE_SPAWN_LOCAL_Z = 132;
const RANDOM_SURVIVAL_SPAWN_MIN_CHUNK_DISTANCE = 2;
const RANDOM_SURVIVAL_SPAWN_MAX_CHUNK_DISTANCE = 8;
const RANDOM_SURVIVAL_SPAWN_Y = 180;
const RANDOM_SURVIVAL_SPAWN_LOCAL_MIN = SURVIVAL_BLOCK_SIZE * 0.3;
const RANDOM_SURVIVAL_SPAWN_LOCAL_MAX = SURVIVAL_BLOCK_SIZE * 0.42;
const QA_BASE_VILLAGE_MIN_SPAWN_CLEARANCE = 48;
const RANDOM_SURVIVAL_RESERVED_CHUNKS: Array<[number, number]> = [
  [0, 0],
  [-3, -3],
  [4, -4],
  [0, -3],
  QA_SPELL_DUMMY_RANGE_CHUNK,
  TEMP_MOUNTAIN_VILLAGE_SPAWN_CHUNK,
  TEMP_GRAVEYARD_VILLAGE_SPAWN_CHUNK,
  [DARREL_QUEST_CHUNK.cx, DARREL_QUEST_CHUNK.cz],
  [LILY_COIL_QUEST_CHUNK.cx, LILY_COIL_QUEST_CHUNK.cz],
];

const QA_SURVIVAL_CHUNK_SPAWN_OPTIONS: Record<string, SurvivalSpawnOptions> = {
  "0,0": { y: 15, localX: 0, localZ: 30, yaw: 0 },
  "4,-4": { y: 150, localX: 0, localZ: QA_AUTHORED_VILLAGE_SAFE_LOCAL_Z, yaw: Math.PI },
  "0,-3": { y: 150, localX: 0, localZ: QA_AUTHORED_VILLAGE_SAFE_LOCAL_Z, yaw: Math.PI },
  "-3,-3": { y: 150, localX: 0, localZ: QA_AUTHORED_VILLAGE_SAFE_LOCAL_Z, yaw: Math.PI },
  "1,0": { y: 28, localX: 0, localZ: 24, yaw: 0 },
  "3,0": {
    y: TEMP_MOUNTAIN_VILLAGE_SPAWN_Y,
    localX: TEMP_MOUNTAIN_VILLAGE_SPAWN_LOCAL_X,
    localZ: TEMP_MOUNTAIN_VILLAGE_SPAWN_LOCAL_Z,
    yaw: 1.68,
  },
  "5,2": { y: 92, localX: 0, localZ: 132, yaw: 0 },
};

export const DEFAULT_PLAYER_SPAWN_POSITION: [number, number, number] = [0, 5, 30];
export const DEFAULT_FALL_RECOVERY_SPAWN_POSITION: [number, number, number] = [0, 15, 30];

let randomSurvivalSpawn: QaSurvivalSpawn | null = null;
let randomSurvivalSpawnMode: string | null = null;
let cachedSurvivalSpawnRouteSearch: string | null = null;
let cachedSurvivalSpawnRouteSnapshot: SurvivalSpawnRouteSnapshot | null = null;

function getSurvivalChunkSpawn(
  cx: number,
  cz: number,
  keyPrefix: string,
  options: SurvivalSpawnOptions = {},
): QaSurvivalSpawn {
  return {
    key: `${keyPrefix}:${cx},${cz}`,
    position: [
      cx * SURVIVAL_BLOCK_SIZE + (options.localX ?? 0),
      options.y ?? 140,
      cz * SURVIVAL_BLOCK_SIZE + (options.localZ ?? 214),
    ],
    yaw: options.yaw,
    pitch: options.pitch,
  };
}

function getQaSpellDummyRangeSpawn(runKey: string, sourceKey = "direct"): QaSurvivalSpawn {
  const [dummyCx, dummyCz] = QA_SPELL_DUMMY_RANGE_CHUNK;
  return getSurvivalChunkSpawn(dummyCx, dummyCz, `qa:spell-dummy-range:${sourceKey}:${runKey}`, {
    y: QA_SPELL_DUMMY_RANGE_Y,
    localZ: QA_SPELL_DUMMY_RANGE_LOCAL_Z,
    yaw: 0,
  });
}

function getNumericSearchParam(params: URLSearchParams, key: string) {
  const value = params.get(key);
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseQaSurvivalChunkRoute(chunkParam: string | null): QaSurvivalChunkRoute | null {
  if (!chunkParam) return null;
  let decodedChunkParam = chunkParam;
  try {
    decodedChunkParam = decodeURIComponent(chunkParam);
  } catch {
    decodedChunkParam = chunkParam;
  }

  const parsed = parseSurvivalChunkCoordsParam(decodedChunkParam);
  return parsed ? { ...parsed, key: decodedChunkParam } : null;
}

function getSurvivalSpawnRouteSnapshotFromSearch(search: string): SurvivalSpawnRouteSnapshot {
  if (search === cachedSurvivalSpawnRouteSearch && cachedSurvivalSpawnRouteSnapshot) {
    return cachedSurvivalSpawnRouteSnapshot;
  }

  const params = new URLSearchParams(search);
  const snapshot: SurvivalSpawnRouteSnapshot = {
    runKey: params.get("qaPerfRun") || params.get("qaReload") || "",
    qaSpellDummies: params.get("qaSpellDummies") === "1",
    qaSurvivalChunk: parseQaSurvivalChunkRoute(params.get("qaSurvivalChunk")),
    qaSurvivalWalk: params.get("qaSurvivalWalk") === "1",
    qaQuestSpawn: (params.get("qaQuestSpawn") || "").toLowerCase(),
    spawnMountain: params.get("spawnMountain") === "1",
    spawnGraveyard: params.get("spawnGraveyard") === "1",
    disableMountainSpawn: params.get("disableMountainSpawn") === "1",
    disableSwampSpawn: params.get("disableSwampSpawn") === "1",
    disableGraveyardSpawn: params.get("disableGraveyardSpawn") === "1",
    disableDefaultQuestSpawn: params.get("disableDefaultQuestSpawn") === "1",
    y: getNumericSearchParam(params, "qaSurvivalY"),
    localX: getNumericSearchParam(params, "qaSurvivalLocalX"),
    localZ: getNumericSearchParam(params, "qaSurvivalLocalZ"),
    yaw: getNumericSearchParam(params, "qaSurvivalYaw"),
    pitch: getNumericSearchParam(params, "qaSurvivalPitch"),
  };

  cachedSurvivalSpawnRouteSearch = search;
  cachedSurvivalSpawnRouteSnapshot = snapshot;
  return snapshot;
}

function getCurrentSurvivalSpawnRouteSnapshot(): SurvivalSpawnRouteSnapshot | null {
  if (typeof window === "undefined") return null;
  return getSurvivalSpawnRouteSnapshotFromSearch(window.location.search);
}

function getQaSurvivalUrlSpawnOptions(route: SurvivalSpawnRouteSnapshot, cx?: number, cz?: number) {
  const options: SurvivalSpawnOptions = {};
  const { y, localX, localZ, yaw, pitch } = route;
  const shouldRescueBadLongHaulEndpoint =
    cx === QA_SURVIVAL_BAD_LONG_HAUL_CHUNK.cx &&
    cz === QA_SURVIVAL_BAD_LONG_HAUL_CHUNK.cz &&
    localX !== undefined &&
    localZ !== undefined &&
    localX >= QA_SURVIVAL_BAD_LONG_HAUL_LOCAL_MIN_X &&
    localZ <= QA_SURVIVAL_BAD_LONG_HAUL_LOCAL_MAX_Z;

  if (y !== undefined) options.y = y;
  if (shouldRescueBadLongHaulEndpoint) {
    options.y = Math.max(options.y ?? QA_SURVIVAL_RESCUE_LONG_HAUL_Y, QA_SURVIVAL_RESCUE_LONG_HAUL_Y);
    options.localX = QA_SURVIVAL_RESCUE_LONG_HAUL_LOCAL_X;
    options.localZ = QA_SURVIVAL_RESCUE_LONG_HAUL_LOCAL_Z;
  } else {
    if (localX !== undefined) options.localX = localX;
    if (localZ !== undefined) options.localZ = localZ;
  }
  if (yaw !== undefined) options.yaw = yaw;
  if (pitch !== undefined) options.pitch = pitch;
  return options;
}

function getQaSurvivalChunkSpawnOptions(cx: number, cz: number) {
  return QA_SURVIVAL_CHUNK_SPAWN_OPTIONS[`${cx},${cz}`] ?? {};
}

function getQaSurvivalSpawnOptions(route: SurvivalSpawnRouteSnapshot, cx: number, cz: number) {
  const options = {
    ...getQaSurvivalChunkSpawnOptions(cx, cz),
    ...getQaSurvivalUrlSpawnOptions(route, cx, cz),
  };

  if (cx === 0 && cz === 0) {
    const localX = options.localX ?? 0;
    const localZ = options.localZ ?? 30;
    const minSafeY = getBaseVillageTerrainHeight(localX, localZ) + QA_BASE_VILLAGE_MIN_SPAWN_CLEARANCE;
    options.y = Math.max(options.y ?? minSafeY, minSafeY);
  }

  return options;
}

function isSurvivalGameMode(gameMode: string) {
  return gameMode === "solo-survival" || gameMode === "multiplayer-survival";
}

function getRandomUnit() {
  return getRuntimeRandomUnit();
}

function getRandomInteger(min: number, max: number) {
  return Math.floor(getRandomUnit() * (max - min + 1)) + min;
}

function getRandomSignedLocalSpawnOffset() {
  const magnitude = RANDOM_SURVIVAL_SPAWN_LOCAL_MIN +
    getRandomUnit() * (RANDOM_SURVIVAL_SPAWN_LOCAL_MAX - RANDOM_SURVIVAL_SPAWN_LOCAL_MIN);
  return (getRandomUnit() < 0.5 ? -1 : 1) * magnitude;
}

function isReservedSurvivalSpawnChunk(cx: number, cz: number) {
  for (let index = 0; index < RANDOM_SURVIVAL_RESERVED_CHUNKS.length; index++) {
    const [reservedCx, reservedCz] = RANDOM_SURVIVAL_RESERVED_CHUNKS[index];
    if (Math.abs(cx - reservedCx) <= 1 && Math.abs(cz - reservedCz) <= 1) return true;
  }
  return false;
}

function formatSurvivalSpawnKeyPart(x: number, y: number, z: number, yaw = 0) {
  return `${Number(x).toFixed(2)}:${Number(y).toFixed(2)}:${Number(z).toFixed(2)}:${Number(yaw).toFixed(2)}`;
}

function getRandomSurvivalSpawnChunk() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const cx = getRandomInteger(-RANDOM_SURVIVAL_SPAWN_MAX_CHUNK_DISTANCE, RANDOM_SURVIVAL_SPAWN_MAX_CHUNK_DISTANCE);
    const cz = getRandomInteger(-RANDOM_SURVIVAL_SPAWN_MAX_CHUNK_DISTANCE, RANDOM_SURVIVAL_SPAWN_MAX_CHUNK_DISTANCE);
    if (Math.max(Math.abs(cx), Math.abs(cz)) < RANDOM_SURVIVAL_SPAWN_MIN_CHUNK_DISTANCE) continue;
    if (isReservedSurvivalSpawnChunk(cx, cz)) continue;
    return { cx, cz };
  }

  return { cx: -RANDOM_SURVIVAL_SPAWN_MIN_CHUNK_DISTANCE, cz: RANDOM_SURVIVAL_SPAWN_MIN_CHUNK_DISTANCE };
}

function getRandomSurvivalWorldSpawn(): QaSurvivalSpawn | null {
  const gameMode = useGameStore.getState().gameMode;
  if (!isSurvivalGameMode(gameMode)) {
    randomSurvivalSpawn = null;
    randomSurvivalSpawnMode = null;
    return null;
  }

  if (randomSurvivalSpawn && randomSurvivalSpawnMode === gameMode) {
    return randomSurvivalSpawn;
  }

  const { cx, cz } = getRandomSurvivalSpawnChunk();
  const localX = getRandomSignedLocalSpawnOffset();
  const localZ = getRandomSignedLocalSpawnOffset();
  const rollKey = `${Date.now().toString(36)}-${Math.floor(getRandomUnit() * 0xffffff).toString(36)}`;
  randomSurvivalSpawn = getSurvivalChunkSpawn(cx, cz, `random-survival:${gameMode}:${rollKey}`, {
    y: RANDOM_SURVIVAL_SPAWN_Y,
    localX,
    localZ,
  });
  randomSurvivalSpawnMode = gameMode;
  return randomSurvivalSpawn;
}

function getManualFastTravelSpawn(): QaSurvivalSpawn | null {
  const manual = readManualFastTravelSpawn();
  if (!manual) return null;

  return {
    key: manual.key,
    position: [manual.x, manual.y, manual.z],
    yaw: manual.yaw,
  };
}

function getQaSurvivalSpawnFromRoute(route: SurvivalSpawnRouteSnapshot | null): QaSurvivalSpawn | null {
  if (import.meta.env.DEV && route) {
    const { runKey } = route;
    if (route.qaSpellDummies) {
      return getQaSpellDummyRangeSpawn(runKey);
    }

    if (route.qaSurvivalChunk) {
      const { cx, cz, key: decodedChunkParam } = route.qaSurvivalChunk;
        const isDarrelQuestChunk = cx === DARREL_QUEST_CHUNK.cx && cz === DARREL_QUEST_CHUNK.cz;
        const questSpawn = route.qaQuestSpawn;
        const isDarrelQuestRun = questSpawn === "darrel" || questSpawn === "darrel-grove";
        if (isDarrelQuestChunk || isDarrelQuestRun) {
          if (route.qaSurvivalWalk) {
            return getSurvivalChunkSpawn(cx, cz, `qa:darrel-open-walk-spawn:${decodedChunkParam}:${runKey}`, {
              y: 38,
              localX: QA_DARREL_GROVE_CLEARING_LOCAL_X,
              localZ: QA_DARREL_GROVE_CLEARING_LOCAL_Z,
              yaw: -Math.PI * 0.35,
            });
          }

          const darrelSpawn = getDarrelQuestSpawn();
          const spawnKey = formatSurvivalSpawnKeyPart(darrelSpawn.x, darrelSpawn.y, darrelSpawn.z, darrelSpawn.yaw ?? 0);
          return {
            key: `qa:darrel-quest-spawn:${decodedChunkParam}:${runKey}:${spawnKey}`,
            position: [darrelSpawn.x, darrelSpawn.y, darrelSpawn.z],
            yaw: darrelSpawn.yaw,
          };
        }
        const isLilyCoilQuestChunk = cx === LILY_COIL_QUEST_CHUNK.cx && cz === LILY_COIL_QUEST_CHUNK.cz;
        const isLilyCoilQuestRun = questSpawn === "lily" || questSpawn === "lily-coil" || questSpawn === "coil";
        if (isLilyCoilQuestChunk || isLilyCoilQuestRun) {
          const coilSpawn = getLilyCoilQuestSpawn();
          return {
            key: `qa:lily-coil-spawn:${decodedChunkParam}:${runKey}`,
            position: [coilSpawn.x, coilSpawn.y, coilSpawn.z],
            yaw: coilSpawn.yaw,
          };
        }
        if (route.qaSpellDummies) {
          return getQaSpellDummyRangeSpawn(runKey, decodedChunkParam);
        }
        return getSurvivalChunkSpawn(cx, cz, `qa:${decodedChunkParam}:${runKey}`, {
          ...getQaSurvivalSpawnOptions(route, cx, cz),
        });
    }
  }

  return null;
}

function getTemporaryMountainVillageSpawn(route: SurvivalSpawnRouteSnapshot | null): QaSurvivalSpawn | null {
  if (!route) return null;
  if (
    route.disableMountainSpawn
    || route.disableSwampSpawn
  ) return null;

  if (!route.spawnMountain) return null;

  const [cx, cz] = TEMP_MOUNTAIN_VILLAGE_SPAWN_CHUNK;
  return getSurvivalChunkSpawn(cx, cz, "temp-mountain-village", {
    y: TEMP_MOUNTAIN_VILLAGE_SPAWN_Y,
    localX: TEMP_MOUNTAIN_VILLAGE_SPAWN_LOCAL_X,
    localZ: TEMP_MOUNTAIN_VILLAGE_SPAWN_LOCAL_Z,
    yaw: 1.68,
  });
}

function getTemporaryGraveyardVillageSpawn(route: SurvivalSpawnRouteSnapshot | null): QaSurvivalSpawn | null {
  if (!route || route.disableGraveyardSpawn) return null;

  if (!route.spawnGraveyard) return null;

  const [cx, cz] = TEMP_GRAVEYARD_VILLAGE_SPAWN_CHUNK;
  return getSurvivalChunkSpawn(cx, cz, "temp-graveyard-village", {
    y: TEMP_GRAVEYARD_VILLAGE_SPAWN_Y,
    localZ: TEMP_GRAVEYARD_VILLAGE_SPAWN_LOCAL_Z,
  });
}

function getTemporaryDefaultSurvivalSpawn(route: SurvivalSpawnRouteSnapshot | null): QaSurvivalSpawn | null {
  const gameMode = useGameStore.getState().gameMode;
  if (!isSurvivalGameMode(gameMode)) return null;
  if (route?.disableDefaultQuestSpawn) return null;

  const spawn = getLilyCoilQuestSpawn();
  const spawnKey = formatSurvivalSpawnKeyPart(spawn.x, spawn.y, spawn.z, spawn.yaw ?? 0);
  return {
    key: `default-survival-lily-coil:${gameMode}:${spawnKey}`,
    position: [spawn.x, spawn.y, spawn.z],
    yaw: spawn.yaw,
  };
}

export function getPlayerSpawnOverride(): QaSurvivalSpawn | null {
  const route = getCurrentSurvivalSpawnRouteSnapshot();
  return getManualFastTravelSpawn()
    ?? getTemporaryMountainVillageSpawn(route)
    ?? getTemporaryGraveyardVillageSpawn(route)
    ?? getQaSurvivalSpawnFromRoute(route)
    ?? getTemporaryDefaultSurvivalSpawn(route)
    ?? getRandomSurvivalWorldSpawn();
}

export function getPlayerSpawnPosition(
  fallbackPosition = DEFAULT_PLAYER_SPAWN_POSITION,
): [number, number, number] {
  return getPlayerSpawnOverride()?.position ?? fallbackPosition;
}

export function getInitialPlayerPosition(): [number, number, number] {
  return getPlayerSpawnPosition();
}

const QA_SURVIVAL_BAD_LONG_HAUL_CHUNK = { cx: 8, cz: -6 };
const QA_SURVIVAL_BAD_LONG_HAUL_LOCAL_MIN_X = 120;
const QA_SURVIVAL_BAD_LONG_HAUL_LOCAL_MAX_Z = -120;
const QA_SURVIVAL_RESCUE_LONG_HAUL_LOCAL_X = -180;
const QA_SURVIVAL_RESCUE_LONG_HAUL_LOCAL_Z = 160;
const QA_SURVIVAL_RESCUE_LONG_HAUL_Y = 80;
const QA_DARREL_GROVE_CLEARING_LOCAL_X = 86;
const QA_DARREL_GROVE_CLEARING_LOCAL_Z = 170;
