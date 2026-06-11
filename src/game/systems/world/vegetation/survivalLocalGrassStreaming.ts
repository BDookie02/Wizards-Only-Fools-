import { startTransition, useEffect, useState } from "react";
import * as THREE from "three";
import { survivalHash01 } from "../survival/survivalMath";

export type SurvivalLocalGrassCell = {
  key: string;
  cellX: number;
  cellZ: number;
  x: number;
  z: number;
  distance: number;
  densityDistance: number;
};

export const SURVIVAL_LOCAL_GRASS_REFERENCE_CELL_SIZE = 300;
export const SURVIVAL_LOCAL_GRASS_CELL_SIZE = 220;
export const SURVIVAL_LOCAL_GRASS_GROUND_RADIUS = 420;
export const SURVIVAL_LOCAL_GRASS_AIR_RADIUS = 620;
export const SURVIVAL_LOCAL_GRASS_EDGE_FADE = 140;
export const SURVIVAL_LOCAL_GRASS_HIGH_ALTITUDE_FADE_START = 200;
export const SURVIVAL_LOCAL_GRASS_HIGH_ALTITUDE_FADE_END = 420;
export const SURVIVAL_LOCAL_GRASS_CELL_AREA_SCALE = (SURVIVAL_LOCAL_GRASS_CELL_SIZE / SURVIVAL_LOCAL_GRASS_REFERENCE_CELL_SIZE) ** 2;
export const SURVIVAL_LOCAL_GRASS_GROUND_PATCHES_PER_CELL = 3600;
export const SURVIVAL_LOCAL_GRASS_SOLID_BLADES_PER_CELL = 22000;
export const SURVIVAL_LOCAL_GRASS_SHORT_TUFTS_PER_CELL = 11500;
export const SURVIVAL_LOCAL_GRASS_FLOWERS_PER_CELL = 1250;
export const SURVIVAL_LOCAL_GRASS_TALL_TUFTS_PER_CELL = 0;
export const SURVIVAL_LOCAL_GRASS_SHORT_BLADES_PER_TUFT = 2;
export const SURVIVAL_LOCAL_GRASS_CARPET_SEGMENTS = 48;
export const SURVIVAL_LOCAL_GRASS_DETAIL_RADIUS = SURVIVAL_LOCAL_GRASS_GROUND_RADIUS + 70;
export const SURVIVAL_LOCAL_GRASS_CARPET_OPACITY = 1;
export const SURVIVAL_LOCAL_GRASS_GROUND_PATCH_OPACITY = 0.78;
export const SURVIVAL_LOCAL_GRASS_DEFAULT_LIFT_COLOR = new THREE.Color("#7fb24a");
export const SURVIVAL_LOCAL_GRASS_MEADOW_LIFT_COLOR = new THREE.Color("#a7dc4a");
export const SURVIVAL_LOCAL_GRASS_MEADOW_SHADOW_COLOR = new THREE.Color("#4f9631");
export const SURVIVAL_LOCAL_GRASS_DESERT_LIFT_COLOR = new THREE.Color("#c0b861");
export const SURVIVAL_LOCAL_GRASS_SWAMP_LIFT_COLOR = new THREE.Color("#718043");
export const SURVIVAL_LOCAL_GRASS_CELL_MARGIN = SURVIVAL_LOCAL_GRASS_CELL_SIZE * Math.SQRT2 * 0.5;
export const SURVIVAL_LOCAL_GRASS_CENTER_HYSTERESIS = SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.72;
export const SURVIVAL_LOCAL_GRASS_GROUND_STREAM_RADIUS = SURVIVAL_LOCAL_GRASS_GROUND_RADIUS + SURVIVAL_LOCAL_GRASS_EDGE_FADE + SURVIVAL_LOCAL_GRASS_CELL_MARGIN;
export const SURVIVAL_LOCAL_GRASS_STREAM_RADIUS = SURVIVAL_LOCAL_GRASS_AIR_RADIUS + SURVIVAL_LOCAL_GRASS_EDGE_FADE * 1.55 + SURVIVAL_LOCAL_GRASS_CELL_MARGIN;
export const SURVIVAL_LOCAL_GRASS_RADIUS_BUCKET_SIZE = 96;
export const SURVIVAL_LOCAL_GRASS_INITIAL_CELL_MOUNT_COUNT = 1;
export const SURVIVAL_LOCAL_GRASS_CELL_MOUNT_INTERVAL_MS = 190;
export const SURVIVAL_LOCAL_GRASS_MOBILE_CELL_MOUNT_INTERVAL_MS = 300;

function compareSurvivalLocalGrassCellDistance(
  a: SurvivalLocalGrassCell,
  b: SurvivalLocalGrassCell,
) {
  return a.distance - b.distance;
}

function sortSurvivalLocalGrassCellsByDistanceIfNeeded(cells: SurvivalLocalGrassCell[]) {
  for (let index = 1; index < cells.length; index += 1) {
    if (compareSurvivalLocalGrassCellDistance(cells[index - 1], cells[index]) > 0) {
      cells.sort(compareSurvivalLocalGrassCellDistance);
      break;
    }
  }
  return cells;
}

export function getSurvivalLocalGrassCellCoord(value: number) {
  return Math.floor(value / SURVIVAL_LOCAL_GRASS_CELL_SIZE);
}

export function makeSurvivalLocalGrassCells(
  centerCellX: number,
  centerCellZ: number,
  streamRadius = SURVIVAL_LOCAL_GRASS_GROUND_STREAM_RADIUS,
): SurvivalLocalGrassCell[] {
  const cells: SurvivalLocalGrassCell[] = [];
  const centerX = (centerCellX + 0.5) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
  const centerZ = (centerCellZ + 0.5) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
  const safeStreamRadius = Math.max(SURVIVAL_LOCAL_GRASS_CELL_SIZE, streamRadius);
  const renderRadius = Math.ceil(safeStreamRadius / SURVIVAL_LOCAL_GRASS_CELL_SIZE);
  const halfCellSize = SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.5;
  const safeStreamRadiusSq = safeStreamRadius * safeStreamRadius;

  for (let dz = -renderRadius; dz <= renderRadius; dz += 1) {
    for (let dx = -renderRadius; dx <= renderRadius; dx += 1) {
      const cellX = centerCellX + dx;
      const cellZ = centerCellZ + dz;
      const x = cellX * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
      const z = cellZ * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
      const centerDistanceX = x + halfCellSize - centerX;
      const centerDistanceZ = z + halfCellSize - centerZ;
      const distanceSq = centerDistanceX * centerDistanceX + centerDistanceZ * centerDistanceZ;
      if (distanceSq > safeStreamRadiusSq) continue;
      const distance = Math.sqrt(distanceSq);
      const densityDistanceX = Math.max(0, Math.abs(x + halfCellSize - centerX) - halfCellSize);
      const densityDistanceZ = Math.max(0, Math.abs(z + halfCellSize - centerZ) - halfCellSize);
      const densityDistance = densityDistanceX > 0 || densityDistanceZ > 0
        ? Math.sqrt(densityDistanceX * densityDistanceX + densityDistanceZ * densityDistanceZ)
        : 0;

      cells.push({ key: `${cellX}:${cellZ}`, cellX, cellZ, x, z, distance, densityDistance });
    }
  }

  return cells.sort(compareSurvivalLocalGrassCellDistance);
}

export function getSurvivalLocalGrassHysteresisCell(
  current: { cellX: number; cellZ: number },
  worldX: number,
  worldZ: number,
) {
  let cellX = current.cellX;
  let cellZ = current.cellZ;
  let localX = worldX - (cellX + 0.5) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;
  let localZ = worldZ - (cellZ + 0.5) * SURVIVAL_LOCAL_GRASS_CELL_SIZE;

  while (localX > SURVIVAL_LOCAL_GRASS_CENTER_HYSTERESIS) {
    cellX += 1;
    localX -= SURVIVAL_LOCAL_GRASS_CELL_SIZE;
  }
  while (localX < -SURVIVAL_LOCAL_GRASS_CENTER_HYSTERESIS) {
    cellX -= 1;
    localX += SURVIVAL_LOCAL_GRASS_CELL_SIZE;
  }
  while (localZ > SURVIVAL_LOCAL_GRASS_CENTER_HYSTERESIS) {
    cellZ += 1;
    localZ -= SURVIVAL_LOCAL_GRASS_CELL_SIZE;
  }
  while (localZ < -SURVIVAL_LOCAL_GRASS_CENTER_HYSTERESIS) {
    cellZ -= 1;
    localZ += SURVIVAL_LOCAL_GRASS_CELL_SIZE;
  }

  return { cellX, cellZ };
}

export function getSurvivalLocalGrassStreamRadius(radius: number, fadeWidth: number) {
  const rawRadius = radius + fadeWidth;
  return Math.min(
    SURVIVAL_LOCAL_GRASS_STREAM_RADIUS,
    Math.ceil(rawRadius / SURVIVAL_LOCAL_GRASS_RADIUS_BUCKET_SIZE) * SURVIVAL_LOCAL_GRASS_RADIUS_BUCKET_SIZE,
  );
}

export function reconcileSurvivalLocalGrassVisibleCells(
  previousCells: SurvivalLocalGrassCell[],
  targetCells: SurvivalLocalGrassCell[],
  addCount: number,
) {
  const targetMap = new Map<string, SurvivalLocalGrassCell>();
  for (const cell of targetCells) {
    targetMap.set(cell.key, cell);
  }
  const nextCells: SurvivalLocalGrassCell[] = [];
  const seenKeys = new Set<string>();

  for (const cell of previousCells) {
    const nextCell = targetMap.get(cell.key);
    if (!nextCell || seenKeys.has(nextCell.key)) continue;
    nextCells.push(nextCell);
    seenKeys.add(nextCell.key);
  }

  let remainingAdditions = Math.max(0, addCount);
  for (const cell of targetCells) {
    if (seenKeys.has(cell.key)) continue;
    nextCells.push(cell);
    seenKeys.add(cell.key);
    remainingAdditions -= 1;
    if (remainingAdditions <= 0) break;
  }

  const orderedNextCells = sortSurvivalLocalGrassCellsByDistanceIfNeeded(nextCells);
  let unchanged = previousCells.length === orderedNextCells.length;
  if (unchanged) {
    for (let index = 0; index < previousCells.length; index += 1) {
      if (previousCells[index] !== orderedNextCells[index]) {
        unchanged = false;
        break;
      }
    }
  }

  return unchanged ? previousCells : orderedNextCells;
}

export function useSurvivalLocalGrassCellLoadStage(cell: SurvivalLocalGrassCell) {
  const [stage, setStage] = useState(() => (typeof window === "undefined" ? 4 : 0));

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    setStage(0);
    const isInnerCell = cell.distance <= SURVIVAL_LOCAL_GRASS_CELL_SIZE * 1.15;
    const jitter = survivalHash01(cell.cellX, cell.cellZ, 24610) * (isInnerCell ? 520 : 1150);
    const baseDelay = isInnerCell ? 620 : 1320;
    const distanceDelay = Math.max(0, cell.distance - SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.45) * 1.55;
    const firstDetailTimer = window.setTimeout(() => {
      startTransition(() => setStage(2));
    }, baseDelay + jitter * 0.35);
    const fullDetailTimer = window.setTimeout(() => {
      startTransition(() => setStage(4));
    }, baseDelay + 1350 + distanceDelay + jitter);

    return () => {
      window.clearTimeout(firstDetailTimer);
      window.clearTimeout(fullDetailTimer);
    };
  }, [cell.cellX, cell.cellZ, cell.distance]);

  return stage;
}
