import type { PlaceableDefinition } from "./placeableCatalog";

export type EngineGroundHeightResolver = (x: number, z: number) => number;

export type EnginePlaceableRequestDetail = {
  placeableId?: string;
  x?: number;
  y?: number;
  z?: number;
  yaw?: number;
  source?: string;
  snapToGrid?: boolean;
  gridSize?: number;
  replaceInstanceId?: string;
};

export type EnginePlacementPlayerSnapshot = {
  position?: { x?: number; y?: number; z?: number };
  yaw: number;
};

export type EnginePlacementPlan =
  | {
      ok: true;
      x: number;
      y: number;
      z: number;
      yaw: number;
      gridSize: number;
      snapped: boolean;
    }
  | {
      ok: false;
      reason: string;
      y?: number;
    };

export type EngineTrainingDummySpawnPlan =
  | {
      ok: true;
      x: number;
      y: number;
      z: number;
      yaw: number;
      count: number;
    }
  | {
      ok: false;
      reason: string;
    };

const DEFAULT_PLAYER_PLACEMENT_DISTANCE = 7;
const TRAINING_DUMMY_PLACEMENT_DISTANCE = 8;

export function getDefaultPlaceableGridSize(placeable: PlaceableDefinition) {
  if (placeable.category === "props" || placeable.category === "nature" || placeable.category === "magic") {
    return 1;
  }
  return 2;
}

function sanitizeGridSize(value: unknown, fallback: number) {
  const gridSize = Number(value);
  if (!Number.isFinite(gridSize) || gridSize <= 0) return fallback;
  return Math.min(16, Math.max(0.25, gridSize));
}

export function snapEnginePlacementCoordinate(value: number, gridSize: number) {
  if (!Number.isFinite(value) || !Number.isFinite(gridSize) || gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

function getStablePlacementYawUnit(placeable: PlaceableDefinition, x: number, z: number) {
  let hash = 2166136261;
  const key = `${placeable.id}:${Math.round(x * 100)}:${Math.round(z * 100)}`;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

export function getEnginePlacementYaw(placeable: PlaceableDefinition, playerYaw: number, x = 0, z = 0) {
  if (placeable.yawMode === "fixed") return 0;
  if (placeable.yawMode === "random") {
    return (getStablePlacementYawUnit(placeable, x, z) * 2 - 1) * Math.PI;
  }
  return Number.isFinite(playerYaw) ? playerYaw : 0;
}

export function validateEnginePlacementSurface(
  placeable: PlaceableDefinition,
  getGroundY: EngineGroundHeightResolver,
  x: number,
  z: number
): EnginePlacementPlan {
  const centerY = getGroundY(x, z);
  if (!Number.isFinite(centerY)) {
    return { ok: false, reason: "terrain height unavailable", y: 0 };
  }

  const sampleRadius = Math.max(2.5, placeable.footprintRadius * 0.72);
  let minY = centerY;
  let maxY = centerY;
  let validSampleCount = 1;

  const eastY = getGroundY(x + sampleRadius, z);
  if (Number.isFinite(eastY)) {
    validSampleCount += 1;
    if (eastY < minY) minY = eastY;
    if (eastY > maxY) maxY = eastY;
  }

  const westY = getGroundY(x - sampleRadius, z);
  if (Number.isFinite(westY)) {
    validSampleCount += 1;
    if (westY < minY) minY = westY;
    if (westY > maxY) maxY = westY;
  }

  const southY = getGroundY(x, z + sampleRadius);
  if (Number.isFinite(southY)) {
    validSampleCount += 1;
    if (southY < minY) minY = southY;
    if (southY > maxY) maxY = southY;
  }

  const northY = getGroundY(x, z - sampleRadius);
  if (Number.isFinite(northY)) {
    validSampleCount += 1;
    if (northY < minY) minY = northY;
    if (northY > maxY) maxY = northY;
  }

  if (validSampleCount < 5) {
    return { ok: false, reason: "terrain height unavailable", y: centerY };
  }

  if (maxY - minY > placeable.maxSlopeDelta) {
    return { ok: false, reason: "too steep for that object", y: centerY };
  }

  return {
    ok: true,
    x,
    y: centerY + (placeable.heightOffset ?? 0),
    z,
    yaw: 0,
    gridSize: getDefaultPlaceableGridSize(placeable),
    snapped: false,
  };
}

export function planEnginePlaceablePlacement(
  placeable: PlaceableDefinition,
  getGroundY: EngineGroundHeightResolver,
  detail: EnginePlaceableRequestDetail | undefined,
  snapshot: EnginePlacementPlayerSnapshot
): EnginePlacementPlan {
  const distance = Math.max(DEFAULT_PLAYER_PLACEMENT_DISTANCE, placeable.footprintRadius + 4);
  const sourceX = Number(detail?.x ?? (Number(snapshot.position?.x) + Math.sin(snapshot.yaw) * distance));
  const sourceZ = Number(detail?.z ?? (Number(snapshot.position?.z) - Math.cos(snapshot.yaw) * distance));

  if (!Number.isFinite(sourceX) || !Number.isFinite(sourceZ)) {
    return { ok: false, reason: "player position unavailable" };
  }

  const gridSize = sanitizeGridSize(detail?.gridSize, getDefaultPlaceableGridSize(placeable));
  const snapToGrid = detail?.snapToGrid ?? true;
  const x = snapToGrid ? snapEnginePlacementCoordinate(sourceX, gridSize) : sourceX;
  const z = snapToGrid ? snapEnginePlacementCoordinate(sourceZ, gridSize) : sourceZ;
  const surface = validateEnginePlacementSurface(placeable, getGroundY, x, z);
  if (!surface.ok) return surface;

  return {
    ok: true,
    x,
    y: surface.y,
    z,
    yaw: Number.isFinite(detail?.yaw) ? Number(detail?.yaw) : getEnginePlacementYaw(placeable, snapshot.yaw, x, z),
    gridSize,
    snapped: snapToGrid,
  };
}

export function planTrainingSpellDummySpawn(
  detail: EnginePlaceableRequestDetail | undefined,
  snapshot: EnginePlacementPlayerSnapshot
): EngineTrainingDummySpawnPlan {
  const originX = Number(detail?.x ?? snapshot.position?.x);
  const originY = Number(detail?.y ?? snapshot.position?.y);
  const originZ = Number(detail?.z ?? snapshot.position?.z);
  if (!Number.isFinite(originX) || !Number.isFinite(originY) || !Number.isFinite(originZ)) {
    return { ok: false, reason: "player position unavailable" };
  }

  return {
    ok: true,
    x: originX + Math.sin(snapshot.yaw) * TRAINING_DUMMY_PLACEMENT_DISTANCE,
    y: originY,
    z: originZ - Math.cos(snapshot.yaw) * TRAINING_DUMMY_PLACEMENT_DISTANCE,
    yaw: snapshot.yaw,
    count: 1,
  };
}
