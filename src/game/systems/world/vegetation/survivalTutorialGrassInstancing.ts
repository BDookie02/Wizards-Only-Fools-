import * as THREE from "three";
import {
  SURVIVAL_TUTORIAL_GRASS_CELL_SIZE,
  type SurvivalTutorialGrassCell,
} from "./survivalTutorialGrassStreaming";
import type { SurvivalTutorialGrassTuft } from "./survivalTutorialGrassTufts";
import {
  SURVIVAL_GRASS_BLADE_SOURCE_UP,
} from "./survivalDormantGrassRenderConstants";
import {
  ensureSurvivalInstancedMeshColors,
  finalizeSurvivalInstancedMesh,
  finalizeSurvivalInstancedMeshColors,
} from "./survivalInstancing";
import { getDormantGrassVectorLength2D } from "./survivalDormantGrassRuntime";

export type SurvivalTutorialGrassBounds = {
  x: number;
  z: number;
  radius: number;
};

export function getSurvivalTutorialGrassBatchBounds(
  cells: SurvivalTutorialGrassCell[],
): SurvivalTutorialGrassBounds {
  if (cells.length === 0) return { x: 0, z: 0, radius: 1 };

  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index];
    minX = Math.min(minX, cell.x);
    minZ = Math.min(minZ, cell.z);
    maxX = Math.max(maxX, cell.x + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE);
    maxZ = Math.max(maxZ, cell.z + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE);
  }

  const x = (minX + maxX) * 0.5;
  const z = (minZ + maxZ) * 0.5;
  return {
    x,
    z,
    radius: getDormantGrassVectorLength2D(maxX - minX, maxZ - minZ) * 0.62 + 18,
  };
}

export function getSurvivalTutorialGrassCellBounds(
  cell: SurvivalTutorialGrassCell,
): SurvivalTutorialGrassBounds {
  return {
    x: cell.x + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
    z: cell.z + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
    radius: SURVIVAL_TUTORIAL_GRASS_CELL_SIZE,
  };
}

export function uploadSurvivalTutorialGrassTufts(
  mesh: THREE.InstancedMesh,
  cell: SurvivalTutorialGrassCell,
  tufts: SurvivalTutorialGrassTuft[],
  dummy: THREE.Object3D,
  normal: THREE.Vector3,
) {
  ensureSurvivalInstancedMeshColors(mesh, tufts.length);
  for (let index = 0; index < tufts.length; index += 1) {
    const tuft = tufts[index];
    normal.set(tuft.normalX, tuft.normalY, tuft.normalZ).normalize();
    dummy.position
      .set(cell.x + tuft.x, tuft.y, cell.z + tuft.z)
      .addScaledVector(normal, 0.025);
    dummy.quaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, normal);
    dummy.rotateY(tuft.yaw);
    dummy.scale.set(tuft.width, tuft.height, tuft.width);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(index, tuft.color);
  }

  mesh.count = tufts.length;
  mesh.instanceMatrix.needsUpdate = true;
  finalizeSurvivalInstancedMeshColors(mesh);
  finalizeSurvivalInstancedMesh(
    mesh,
    cell.x + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
    cell.z + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
    SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 1.25,
    12,
  );
}
