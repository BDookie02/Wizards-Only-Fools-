import { lerpNumber, clamp01, smoothstepRange } from "../survival/survivalMath";

export const GRAVEYARD_VILLAGE_RADIUS = 238;
const GRAVEYARD_PATH_WIDTH = 35;
export const GRAVEYARD_RING_PATH_RADIUS = 88;
const GRAVEYARD_RING_PATH_WIDTH = 20;
export const GRAVEYARD_FENCE_RADIUS = 246;

const CHAPEL_CENTER_HALF_WIDTH = 54;
const CHAPEL_CENTER_HALF_DEPTH = 82;
const CHAPEL_SIDE_WING_HALF_WIDTH = 34;
const CHAPEL_SIDE_WING_HALF_DEPTH = 57;
const CHAPEL_SIDE_WING_CENTER_X = CHAPEL_CENTER_HALF_WIDTH + CHAPEL_SIDE_WING_HALF_WIDTH;
const CHAPEL_OUTER_HALF_WIDTH = CHAPEL_SIDE_WING_CENTER_X + CHAPEL_SIDE_WING_HALF_WIDTH;
const CHAPEL_EXIT_HALF_WIDTH = 12;
const CHAPEL_SIDE_EXIT_HALF_WIDTH = 11;
const CHAPEL_REAR_EXIT_CENTER_X = 33;
const CHAPEL_REAR_EXIT_HALF_WIDTH = 8.5;
const CHAPEL_FOUNDATION_FEATHER = 10;

export function getGraveyardLocalRadius(localX: number, localZ: number) {
  return Math.sqrt(localX * localX + localZ * localZ);
}

export function getGraveyardLocalRadiusSq(localX: number, localZ: number) {
  return localX * localX + localZ * localZ;
}

function getSoftRectMask(
  localX: number,
  localZ: number,
  centerX: number,
  centerZ: number,
  halfWidth: number,
  halfDepth: number,
  feather = CHAPEL_FOUNDATION_FEATHER,
) {
  return Math.min(
    1 - smoothstepRange(halfWidth, halfWidth + feather, Math.abs(localX - centerX)),
    1 - smoothstepRange(halfDepth, halfDepth + feather, Math.abs(localZ - centerZ)),
  );
}

function getGraveyardChapelFootprintMask(localX: number, localZ: number) {
  const centralHall = getSoftRectMask(localX, localZ, 0, 0, CHAPEL_CENTER_HALF_WIDTH, CHAPEL_CENTER_HALF_DEPTH);
  const westWing = getSoftRectMask(localX, localZ, -CHAPEL_SIDE_WING_CENTER_X, 0, CHAPEL_SIDE_WING_HALF_WIDTH, CHAPEL_SIDE_WING_HALF_DEPTH);
  const eastWing = getSoftRectMask(localX, localZ, CHAPEL_SIDE_WING_CENTER_X, 0, CHAPEL_SIDE_WING_HALF_WIDTH, CHAPEL_SIDE_WING_HALF_DEPTH);
  return Math.max(centralHall, westWing, eastWing);
}

function getGraveyardGateEntryMask(localX: number, localZ: number) {
  const absX = Math.abs(localX);
  const absZ = Math.abs(localZ);
  const northSouthGate =
    (1 - smoothstepRange(82, 154, absX)) *
    smoothstepRange(88, 146, absZ) *
    (1 - smoothstepRange(GRAVEYARD_FENCE_RADIUS + 28, GRAVEYARD_FENCE_RADIUS + 184, absZ));
  const eastWestGate =
    (1 - smoothstepRange(82, 154, absZ)) *
    smoothstepRange(88, 146, absX) *
    (1 - smoothstepRange(GRAVEYARD_FENCE_RADIUS + 28, GRAVEYARD_FENCE_RADIUS + 184, absX));
  return clamp01(Math.max(northSouthGate, eastWestGate));
}

export function getGraveyardGateClearingMask(localX: number, localZ: number) {
  const absX = Math.abs(localX);
  const absZ = Math.abs(localZ);
  const northSouthShoulder =
    (1 - smoothstepRange(214, 306, absX)) *
    smoothstepRange(48, 104, absZ) *
    (1 - smoothstepRange(GRAVEYARD_FENCE_RADIUS + 116, GRAVEYARD_FENCE_RADIUS + 270, absZ));
  const eastWestShoulder =
    (1 - smoothstepRange(214, 306, absZ)) *
    smoothstepRange(48, 104, absX) *
    (1 - smoothstepRange(GRAVEYARD_FENCE_RADIUS + 116, GRAVEYARD_FENCE_RADIUS + 270, absX));
  return clamp01(Math.max(getGraveyardGateEntryMask(localX, localZ), northSouthShoulder, eastWestShoulder));
}

export function getGraveyardChapelFoundationMask(localX: number, localZ: number) {
  return getGraveyardChapelFootprintMask(localX, localZ);
}

function getGraveyardChapelWalkMask(localX: number, localZ: number) {
  const absX = Math.abs(localX);
  const absZ = Math.abs(localZ);
  const southExit = (
    1 - smoothstepRange(28, 44, absX)
  ) * smoothstepRange(CHAPEL_CENTER_HALF_DEPTH - 18, CHAPEL_CENTER_HALF_DEPTH - 2, localZ) * (
    1 - smoothstepRange(132, 162, localZ)
  );
  const rearSideExitX = Math.max(
    1 - smoothstepRange(CHAPEL_REAR_EXIT_HALF_WIDTH + 5, CHAPEL_REAR_EXIT_HALF_WIDTH + 19, Math.abs(localX - CHAPEL_REAR_EXIT_CENTER_X)),
    1 - smoothstepRange(CHAPEL_REAR_EXIT_HALF_WIDTH + 5, CHAPEL_REAR_EXIT_HALF_WIDTH + 19, Math.abs(localX + CHAPEL_REAR_EXIT_CENTER_X)),
  );
  const northSideExits = rearSideExitX * smoothstepRange(
    CHAPEL_CENTER_HALF_DEPTH - 18,
    CHAPEL_CENTER_HALF_DEPTH - 2,
    -localZ,
  ) * (
    1 - smoothstepRange(132, 162, -localZ)
  );
  const eastWestExits = (
    1 - smoothstepRange(28, 44, absZ)
  ) * smoothstepRange(CHAPEL_OUTER_HALF_WIDTH - 18, CHAPEL_OUTER_HALF_WIDTH - 2, absX) * (
    1 - smoothstepRange(174, 206, absX)
  );
  return Math.max(southExit, northSideExits, eastWestExits);
}

export function getGraveyardChapelMask(localX: number, localZ: number) {
  return Math.max(getGraveyardChapelFoundationMask(localX, localZ), getGraveyardChapelWalkMask(localX, localZ));
}

function getGraveyardPathMask(localX: number, localZ: number) {
  const absX = Math.abs(localX);
  const absZ = Math.abs(localZ);
  const radius = getGraveyardLocalRadius(localX, localZ);
  const crossPath = Math.max(
    1 - smoothstepRange(GRAVEYARD_PATH_WIDTH * 0.5, GRAVEYARD_PATH_WIDTH * 0.78, absX),
    1 - smoothstepRange(GRAVEYARD_PATH_WIDTH * 0.5, GRAVEYARD_PATH_WIDTH * 0.78, absZ),
  );
  const ringPath = 1 - smoothstepRange(GRAVEYARD_RING_PATH_WIDTH * 0.42, GRAVEYARD_RING_PATH_WIDTH * 0.78, Math.abs(radius - GRAVEYARD_RING_PATH_RADIUS));
  return Math.max(crossPath, ringPath, getGraveyardChapelWalkMask(localX, localZ), getGraveyardGateEntryMask(localX, localZ) * 0.92);
}

export function getGraveyardEffectivePathMask(localX: number, localZ: number) {
  const pathMask = getGraveyardPathMask(localX, localZ);
  const chapelFoundationMask = getGraveyardChapelFoundationMask(localX, localZ);
  return pathMask * (1 - chapelFoundationMask * 0.98);
}

export function getGraveyardLocalSurfaceHeight(
  localX: number,
  localZ: number,
  chunkCx: number,
  chunkCz: number,
  baseHeight: number,
) {
  const radius = getGraveyardLocalRadius(localX, localZ);
  const gateEntryMask = getGraveyardGateEntryMask(localX, localZ);
  const gateClearingMask = getGraveyardGateClearingMask(localX, localZ);
  const hillA = Math.sin(localX * 0.035 + chunkCx * 1.7) * Math.cos(localZ * 0.028 - chunkCz * 1.3);
  const hillB = Math.sin((localX + localZ) * 0.023 + 2.4) * 0.58;
  const moundRing = Math.pow(smoothstepRange(42, GRAVEYARD_VILLAGE_RADIUS, radius) * (1 - smoothstepRange(GRAVEYARD_VILLAGE_RADIUS - 34, GRAVEYARD_VILLAGE_RADIUS, radius)), 0.9);
  const pathMask = getGraveyardEffectivePathMask(localX, localZ);
  const chapelMask = getGraveyardChapelMask(localX, localZ);
  const hills = (hillA * 4.6 + hillB * 2.8 + moundRing * 5.8) * (1 - pathMask * 0.78) * (1 - chapelMask * 0.98) * (1 - gateClearingMask);
  const gateFlattenMask = Math.max(gateEntryMask * 0.96, gateClearingMask * 0.9);
  return lerpNumber(baseHeight + hills - pathMask * 0.38, baseHeight - 0.46, gateFlattenMask);
}
