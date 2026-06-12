import type * as THREE from "three";
import { getBrowserSurvivalPlayerPosition } from "../survival/survivalPosition";
import { clamp01 } from "../survival/survivalMath";

export type DormantGrassViewerPosition = {
  x: number;
  y: number;
  z: number;
};

export function copyInitialVisibleGrassCells<T>(cells: readonly T[], maxCount: number) {
  const count = Math.min(cells.length, maxCount);
  const visibleCells = new Array<T>(count);
  for (let index = 0; index < count; index += 1) {
    visibleCells[index] = cells[index];
  }
  return visibleCells;
}

export function getDormantGrassVectorLength2D(x: number, z: number) {
  return Math.sqrt(x * x + z * z);
}

export function getDormantGrassVectorLength3D(x: number, y: number, z: number) {
  return Math.sqrt(x * x + y * y + z * z);
}

export function clampDormantGrassColor(color: THREE.Color) {
  color.r = clamp01(color.r);
  color.g = clamp01(color.g);
  color.b = clamp01(color.b);
}

export function getSurvivalLocalGrassViewerPositionInto(
  camera: THREE.Camera,
  target: DormantGrassViewerPosition,
) {
  const localPlayer = getBrowserSurvivalPlayerPosition();
  if (localPlayer) {
    target.x = localPlayer.x;
    target.y = typeof localPlayer.y === "number" ? localPlayer.y : camera.position.y;
    target.z = localPlayer.z;
    return target;
  }

  target.x = camera.position.x;
  target.y = camera.position.y;
  target.z = camera.position.z;
  return target;
}
