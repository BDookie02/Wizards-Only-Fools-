import * as THREE from "three";
import { survivalHash01 } from "../survival/survivalMath";
import {
  SURVIVAL_LOCAL_GRASS_CELL_SIZE,
  SURVIVAL_LOCAL_GRASS_SHORT_BLADES_PER_TUFT,
  type SurvivalLocalGrassCell,
} from "./survivalLocalGrassStreaming";
import type { SurvivalGroundGrassPatch } from "./survivalLocalGrassPatches";
import type { SurvivalLocalGrassBlade } from "./survivalLocalGrassBlades";
import {
  SURVIVAL_GRASS_BLADE_SOURCE_UP,
  SURVIVAL_GROUND_GRASS_SOURCE_NORMAL,
  SURVIVAL_WORLD_GRASS_BLADES_PER_TUFT,
} from "./survivalDormantGrassRenderConstants";
import {
  ensureSurvivalInstancedMeshColors,
  finalizeSurvivalInstancedMesh,
  finalizeSurvivalInstancedMeshColors,
} from "./survivalInstancing";

export function getSurvivalLocalShortGrassCapacity(shortBladeCount: number) {
  return Math.max(1, shortBladeCount * SURVIVAL_LOCAL_GRASS_SHORT_BLADES_PER_TUFT);
}

export function getSurvivalLocalTallGrassCapacity(tallBladeCount: number) {
  return Math.max(1, tallBladeCount * SURVIVAL_WORLD_GRASS_BLADES_PER_TUFT);
}

export function uploadSurvivalLocalGrassGroundPatches(
  mesh: THREE.InstancedMesh,
  cell: SurvivalLocalGrassCell,
  groundPatches: SurvivalGroundGrassPatch[],
  dummy: THREE.Object3D,
  normal: THREE.Vector3,
) {
  ensureSurvivalInstancedMeshColors(mesh, groundPatches.length);
  for (let index = 0; index < groundPatches.length; index += 1) {
    const patch = groundPatches[index];
    normal.set(patch.normalX, patch.normalY, patch.normalZ).normalize();
    dummy.position.set(cell.x + patch.x, patch.y, cell.z + patch.z);
    dummy.quaternion.setFromUnitVectors(SURVIVAL_GROUND_GRASS_SOURCE_NORMAL, normal);
    dummy.rotateZ(patch.yaw);
    dummy.scale.set(patch.width, patch.depth, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(index, patch.color);
  }

  mesh.count = groundPatches.length;
  mesh.instanceMatrix.needsUpdate = true;
  finalizeSurvivalInstancedMeshColors(mesh);
  finalizeSurvivalInstancedMesh(
    mesh,
    cell.x + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.5,
    cell.z + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.5,
    SURVIVAL_LOCAL_GRASS_CELL_SIZE,
    32,
  );
}

export function uploadSurvivalLocalShortGrassBlades(
  mesh: THREE.InstancedMesh,
  cell: SurvivalLocalGrassCell,
  shortBlades: SurvivalLocalGrassBlade[],
  dummy: THREE.Object3D,
  normal: THREE.Vector3,
  bladeBase: THREE.Vector3,
) {
  ensureSurvivalInstancedMeshColors(mesh, getSurvivalLocalShortGrassCapacity(shortBlades.length));
  let shortInstance = 0;
  for (let bladeIndex = 0; bladeIndex < shortBlades.length; bladeIndex += 1) {
    const blade = shortBlades[bladeIndex];
    for (let tuftIndex = 0; tuftIndex < SURVIVAL_LOCAL_GRASS_SHORT_BLADES_PER_TUFT; tuftIndex += 1) {
      const scatterAngle = survivalHash01(cell.cellX + tuftIndex, cell.cellZ - tuftIndex, 17840 + bladeIndex) * Math.PI * 2;
      const yaw = blade.yaw
        + scatterAngle * 0.12
        + tuftIndex * (Math.PI / SURVIVAL_LOCAL_GRASS_SHORT_BLADES_PER_TUFT)
        + (bladeIndex % 6) * 0.07;
      const spread = SURVIVAL_LOCAL_GRASS_SHORT_BLADES_PER_TUFT > 1
        ? survivalHash01(cell.cellX - tuftIndex, cell.cellZ + tuftIndex, 17860 + bladeIndex) * 0.48
        : 0;
      const heightJitter = 0.9 + survivalHash01(cell.cellX + tuftIndex, cell.cellZ - tuftIndex, 17800 + bladeIndex) * 0.24;
      const widthJitter = 0.92 + survivalHash01(cell.cellX - tuftIndex, cell.cellZ + tuftIndex, 17900 + bladeIndex) * 0.34;
      const bladeHeight = blade.height * heightJitter;
      normal.set(blade.normalX, blade.normalY, blade.normalZ).normalize();
      bladeBase.set(
        cell.x + blade.x + Math.sin(scatterAngle) * spread,
        blade.y,
        cell.z + blade.z + Math.cos(scatterAngle) * spread,
      );

      dummy.position.copy(bladeBase).addScaledVector(normal, bladeHeight * 0.5);
      dummy.quaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, normal);
      dummy.rotateY(yaw);
      dummy.rotateX(blade.tilt * 0.5);
      dummy.rotateZ(Math.sin(yaw + blade.tilt) * 0.18);
      dummy.scale.set(blade.width * widthJitter, bladeHeight, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(shortInstance, dummy.matrix);
      mesh.setColorAt(shortInstance, blade.color);
      shortInstance += 1;
    }
  }

  mesh.count = shortInstance;
  mesh.instanceMatrix.needsUpdate = true;
  finalizeSurvivalInstancedMeshColors(mesh);
  finalizeSurvivalInstancedMesh(
    mesh,
    cell.x + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.5,
    cell.z + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.5,
    SURVIVAL_LOCAL_GRASS_CELL_SIZE,
    24,
  );
}

export function uploadSurvivalLocalTallGrassBlades(
  mesh: THREE.InstancedMesh,
  cell: SurvivalLocalGrassCell,
  tallBlades: SurvivalLocalGrassBlade[],
  dummy: THREE.Object3D,
  normal: THREE.Vector3,
  bladeBase: THREE.Vector3,
) {
  ensureSurvivalInstancedMeshColors(mesh, getSurvivalLocalTallGrassCapacity(tallBlades.length));
  let instance = 0;
  for (let bladeIndex = 0; bladeIndex < tallBlades.length; bladeIndex += 1) {
    const blade = tallBlades[bladeIndex];
    for (let tuftIndex = 0; tuftIndex < SURVIVAL_WORLD_GRASS_BLADES_PER_TUFT; tuftIndex += 1) {
      const radial = (tuftIndex / SURVIVAL_WORLD_GRASS_BLADES_PER_TUFT) * Math.PI * 2;
      const yaw = blade.yaw + radial + (bladeIndex % 5) * 0.09;
      const spread = blade.width * (0.12 + tuftIndex * 0.06);
      const heightJitter = 0.76 + survivalHash01(cell.cellX + tuftIndex, cell.cellZ - tuftIndex, 16700 + bladeIndex) * 0.38;
      const widthJitter = 0.88 + survivalHash01(cell.cellX - tuftIndex, cell.cellZ + tuftIndex, 16800 + bladeIndex) * 0.48;
      const bladeHeight = blade.height * heightJitter;
      normal.set(blade.normalX, blade.normalY, blade.normalZ).normalize();
      bladeBase.set(
        cell.x + blade.x + Math.sin(yaw) * spread,
        blade.y,
        cell.z + blade.z + Math.cos(yaw) * spread,
      );

      dummy.position.copy(bladeBase).addScaledVector(normal, bladeHeight * 0.48);
      dummy.quaternion.setFromUnitVectors(SURVIVAL_GRASS_BLADE_SOURCE_UP, normal);
      dummy.rotateY(yaw);
      dummy.rotateX(blade.tilt * 0.32);
      dummy.rotateZ(Math.sin(yaw + blade.tilt) * 0.1);
      dummy.scale.set(blade.width * widthJitter, bladeHeight, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(instance, dummy.matrix);
      mesh.setColorAt(instance, blade.color);
      instance += 1;
    }
  }

  mesh.count = instance;
  mesh.instanceMatrix.needsUpdate = true;
  finalizeSurvivalInstancedMeshColors(mesh);
  finalizeSurvivalInstancedMesh(
    mesh,
    cell.x + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.5,
    cell.z + SURVIVAL_LOCAL_GRASS_CELL_SIZE * 0.5,
    SURVIVAL_LOCAL_GRASS_CELL_SIZE,
    28,
  );
}
