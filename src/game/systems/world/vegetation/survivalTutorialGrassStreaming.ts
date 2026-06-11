export type SurvivalTutorialGrassCell = {
  key: string;
  cellX: number;
  cellZ: number;
  x: number;
  z: number;
  distance: number;
  densityDistance: number;
  lod: "near" | "mid";
};

export type SurvivalTutorialGrassCellBatch = {
  key: string;
  cells: SurvivalTutorialGrassCell[];
  distance: number;
  signature: string;
};

type SurvivalTutorialGrassCellOffset = {
  dx: number;
  dz: number;
  distance: number;
  densityDistance: number;
  lod: SurvivalTutorialGrassCell["lod"];
};

export const SURVIVAL_TUTORIAL_GRASS_CELL_SIZE = 58;
export const SURVIVAL_TUTORIAL_GRASS_GROUND_RADIUS = 324;
export const SURVIVAL_TUTORIAL_GRASS_AIR_RADIUS = 430;
export const SURVIVAL_TUTORIAL_GRASS_EDGE_FADE = 38;
export const SURVIVAL_TUTORIAL_GRASS_CELL_MARGIN = SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * Math.SQRT2 * 0.5;
export const SURVIVAL_TUTORIAL_GRASS_CENTER_HYSTERESIS = SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.72;
export const SURVIVAL_TUTORIAL_GRASS_CELL_MOUNT_INTERVAL_MS = 52;
export const SURVIVAL_TUTORIAL_GRASS_IDLE_TIMEOUT_MS = 260;
export const SURVIVAL_TUTORIAL_GRASS_INITIAL_CELL_MOUNT_COUNT = 10;
export const SURVIVAL_TUTORIAL_GRASS_STRAND_DISTANCE = 170;
export const SURVIVAL_TUTORIAL_GRASS_MID_STRAND_DISTANCE = 318;
export const SURVIVAL_TUTORIAL_GRASS_BLADE_DENSITY_DISTANCE = 215;
export const SURVIVAL_TUTORIAL_GRASS_NEAR_BLADE_BASE_COUNT = 420;
export const SURVIVAL_TUTORIAL_GRASS_NEAR_BLADE_EXTRA_COUNT = 1080;
export const SURVIVAL_TUTORIAL_GRASS_MID_BLADE_BASE_COUNT = 280;
export const SURVIVAL_TUTORIAL_GRASS_MID_BLADE_EXTRA_COUNT = 760;
export const SURVIVAL_TUTORIAL_GRASS_NORMAL_UP_BIAS = 0.86;
export const SURVIVAL_TUTORIAL_GRASS_BATCH_CELL_SPAN = 3;

function compareSurvivalTutorialGrassCellDistance(
  a: SurvivalTutorialGrassCell,
  b: SurvivalTutorialGrassCell,
) {
  return a.distance - b.distance;
}

function compareSurvivalTutorialGrassCellOffsetDistance(
  a: SurvivalTutorialGrassCellOffset,
  b: SurvivalTutorialGrassCellOffset,
) {
  return a.distance - b.distance;
}

function insertSurvivalTutorialGrassCellOffsetByDistance(
  offsets: SurvivalTutorialGrassCellOffset[],
  offset: SurvivalTutorialGrassCellOffset,
) {
  let insertIndex = offsets.length;
  while (
    insertIndex > 0 &&
    compareSurvivalTutorialGrassCellOffsetDistance(offset, offsets[insertIndex - 1]) < 0
  ) {
    offsets[insertIndex] = offsets[insertIndex - 1];
    insertIndex -= 1;
  }
  offsets[insertIndex] = offset;
}

function compareSurvivalTutorialGrassCellBatchDistance(
  a: SurvivalTutorialGrassCellBatch,
  b: SurvivalTutorialGrassCellBatch,
) {
  return a.distance - b.distance || a.key.localeCompare(b.key);
}

function compareSurvivalTutorialGrassCellBatchMember(
  a: SurvivalTutorialGrassCell,
  b: SurvivalTutorialGrassCell,
) {
  return a.distance - b.distance || a.key.localeCompare(b.key);
}

function sortSurvivalTutorialGrassCellsByDistanceIfNeeded(cells: SurvivalTutorialGrassCell[]) {
  for (let index = 1; index < cells.length; index += 1) {
    if (compareSurvivalTutorialGrassCellDistance(cells[index - 1], cells[index]) > 0) {
      cells.sort(compareSurvivalTutorialGrassCellDistance);
      break;
    }
  }
  return cells;
}

function sortSurvivalTutorialGrassCellBatchesByDistanceIfNeeded(
  batches: SurvivalTutorialGrassCellBatch[],
) {
  for (let index = 1; index < batches.length; index += 1) {
    if (compareSurvivalTutorialGrassCellBatchDistance(batches[index - 1], batches[index]) > 0) {
      batches.sort(compareSurvivalTutorialGrassCellBatchDistance);
      break;
    }
  }
  return batches;
}

function sortSurvivalTutorialGrassBatchCellsIfNeeded(cells: SurvivalTutorialGrassCell[]) {
  for (let index = 1; index < cells.length; index += 1) {
    if (compareSurvivalTutorialGrassCellBatchMember(cells[index - 1], cells[index]) > 0) {
      cells.sort(compareSurvivalTutorialGrassCellBatchMember);
      break;
    }
  }
  return cells;
}

const survivalTutorialGrassReconcileTargetMap = new Map<string, SurvivalTutorialGrassCell>();
const survivalTutorialGrassReconcileSeenKeys = new Set<string>();
const survivalTutorialGrassBatchMap = new Map<string, SurvivalTutorialGrassCellBatch>();
let cachedSurvivalTutorialGrassCellOffsets: SurvivalTutorialGrassCellOffset[] | null = null;

function getSurvivalTutorialGrassCellOffsets() {
  if (cachedSurvivalTutorialGrassCellOffsets) return cachedSurvivalTutorialGrassCellOffsets;

  const streamRadius = SURVIVAL_TUTORIAL_GRASS_AIR_RADIUS + SURVIVAL_TUTORIAL_GRASS_EDGE_FADE + SURVIVAL_TUTORIAL_GRASS_CELL_MARGIN;
  const renderRadius = Math.ceil(streamRadius / SURVIVAL_TUTORIAL_GRASS_CELL_SIZE);
  const halfCellSize = SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5;
  const streamLimit = streamRadius + halfCellSize;
  const streamLimitSq = streamLimit * streamLimit;
  const offsets: SurvivalTutorialGrassCellOffset[] = [];

  for (let dz = -renderRadius; dz <= renderRadius; dz += 1) {
    for (let dx = -renderRadius; dx <= renderRadius; dx += 1) {
      const distanceX = dx * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
      const distanceZ = dz * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
      const distanceSq = distanceX * distanceX + distanceZ * distanceZ;
      if (distanceSq > streamLimitSq) continue;
      const distance = Math.sqrt(distanceSq);
      insertSurvivalTutorialGrassCellOffsetByDistance(offsets, {
        dx,
        dz,
        distance,
        densityDistance: Math.max(0, distance - halfCellSize),
        lod: distance < SURVIVAL_TUTORIAL_GRASS_STRAND_DISTANCE ? "near" : "mid",
      });
    }
  }

  cachedSurvivalTutorialGrassCellOffsets = offsets;
  return offsets;
}

export function getSurvivalTutorialGrassCellCoord(value: number) {
  return Math.floor(value / SURVIVAL_TUTORIAL_GRASS_CELL_SIZE);
}

export function makeSurvivalTutorialGrassCells(centerCellX: number, centerCellZ: number): SurvivalTutorialGrassCell[] {
  const cells: SurvivalTutorialGrassCell[] = [];

  const offsets = getSurvivalTutorialGrassCellOffsets();
  for (let index = 0; index < offsets.length; index += 1) {
    const offset = offsets[index];
    const cellX = centerCellX + offset.dx;
    const cellZ = centerCellZ + offset.dz;
    cells.push({
      key: `tutorial-grass-${cellX}:${cellZ}`,
      cellX,
      cellZ,
      x: cellX * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE,
      z: cellZ * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE,
      distance: offset.distance,
      densityDistance: offset.densityDistance,
      lod: offset.lod,
    });
  }

  return cells;
}

export function getSurvivalTutorialGrassHysteresisCell(
  current: { cellX: number; cellZ: number },
  worldX: number,
  worldZ: number,
) {
  let cellX = current.cellX;
  let cellZ = current.cellZ;
  let localX = worldX - (cellX + 0.5) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
  let localZ = worldZ - (cellZ + 0.5) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;

  while (localX > SURVIVAL_TUTORIAL_GRASS_CENTER_HYSTERESIS) {
    cellX += 1;
    localX -= SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
  }
  while (localX < -SURVIVAL_TUTORIAL_GRASS_CENTER_HYSTERESIS) {
    cellX -= 1;
    localX += SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
  }
  while (localZ > SURVIVAL_TUTORIAL_GRASS_CENTER_HYSTERESIS) {
    cellZ += 1;
    localZ -= SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
  }
  while (localZ < -SURVIVAL_TUTORIAL_GRASS_CENTER_HYSTERESIS) {
    cellZ -= 1;
    localZ += SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
  }

  return { cellX, cellZ };
}

export function reconcileSurvivalTutorialGrassVisibleCells(
  previousCells: SurvivalTutorialGrassCell[],
  targetCells: SurvivalTutorialGrassCell[],
  addCount: number,
) {
  const targetMap = survivalTutorialGrassReconcileTargetMap;
  const seenKeys = survivalTutorialGrassReconcileSeenKeys;
  targetMap.clear();
  seenKeys.clear();

  for (const cell of targetCells) {
    targetMap.set(cell.key, cell);
  }
  const nextCells: SurvivalTutorialGrassCell[] = [];
  let remainingWork = Math.max(0, addCount);

  for (const cell of previousCells) {
    const nextCell = targetMap.get(cell.key);
    if (!nextCell || seenKeys.has(nextCell.key)) continue;

    if (cell.lod === nextCell.lod) {
      if (
        cell.distance === nextCell.distance &&
        cell.densityDistance === nextCell.densityDistance
      ) {
        nextCells.push(cell);
      } else {
        nextCells.push({
          ...cell,
          distance: nextCell.distance,
          densityDistance: nextCell.densityDistance,
        });
      }
    } else if (remainingWork > 0) {
      nextCells.push(nextCell);
      remainingWork -= 1;
    } else {
      nextCells.push({
        ...cell,
        distance: nextCell.distance,
        densityDistance: nextCell.densityDistance,
      });
    }
    seenKeys.add(nextCell.key);
  }

  for (const cell of targetCells) {
    if (seenKeys.has(cell.key)) continue;
    nextCells.push(cell);
    seenKeys.add(cell.key);
    remainingWork -= 1;
    if (remainingWork <= 0) break;
  }

  const orderedNextCells = sortSurvivalTutorialGrassCellsByDistanceIfNeeded(nextCells);
  let unchanged = previousCells.length === orderedNextCells.length;
  if (unchanged) {
    for (let index = 0; index < previousCells.length; index += 1) {
      if (previousCells[index] !== orderedNextCells[index]) {
        unchanged = false;
        break;
      }
    }
  }

  const result = unchanged ? previousCells : orderedNextCells;
  targetMap.clear();
  seenKeys.clear();
  return result;
}

export function getSurvivalTutorialGrassCellBatchSignature(cells: SurvivalTutorialGrassCell[]) {
  let signature = "";
  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index];
    if (index > 0) signature += "|";
    signature += `${cell.key}:${cell.lod}:${Math.round(cell.densityDistance / 8)}`;
  }
  return signature;
}

export function makeSurvivalTutorialGrassCellBatches(cells: SurvivalTutorialGrassCell[]) {
  const batches = survivalTutorialGrassBatchMap;
  batches.clear();

  for (const cell of cells) {
    const batchX = Math.floor(cell.cellX / SURVIVAL_TUTORIAL_GRASS_BATCH_CELL_SPAN);
    const batchZ = Math.floor(cell.cellZ / SURVIVAL_TUTORIAL_GRASS_BATCH_CELL_SPAN);
    const key = `tutorial-grass-batch-${batchX}:${batchZ}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = { key, cells: [], distance: cell.distance, signature: "" };
      batches.set(key, batch);
    }

    batch.cells.push(cell);
    batch.distance = Math.min(batch.distance, cell.distance);
  }

  const sortedBatches: SurvivalTutorialGrassCellBatch[] = [];
  for (const batch of batches.values()) {
    sortSurvivalTutorialGrassBatchCellsIfNeeded(batch.cells);
    batch.signature = getSurvivalTutorialGrassCellBatchSignature(batch.cells);
    sortedBatches.push(batch);
  }

  const result = sortSurvivalTutorialGrassCellBatchesByDistanceIfNeeded(sortedBatches);
  batches.clear();
  return result;
}
