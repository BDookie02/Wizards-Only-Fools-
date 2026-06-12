import * as THREE from "three";
import { lerpNumber } from "../survival/survivalMath";

export type DesertVillageClothesLine = {
  key: string;
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  y: number;
  colors: [string, string, string];
};

export type DesertClothesLineClothDescriptor = {
  key: string;
  color: string;
  height: number;
  position: [number, number, number];
  rotation: [number, number, number];
};

export type DesertClothesLineRenderDescriptor = {
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  cloths: DesertClothesLineClothDescriptor[];
};

const DESERT_CLOTHESLINE_UP = new THREE.Vector3(0, 1, 0);
const DESERT_CLOTH_START_T = 0.26;
const DESERT_CLOTH_STEP_T = 0.24;
const DESERT_CLOTH_DROP = 1.45;

export function getDesertClothesLineRenderDescriptor(
  line: DesertVillageClothesLine,
  baseHeight: number,
): DesertClothesLineRenderDescriptor {
  const start = new THREE.Vector3(line.startX, baseHeight + line.y, line.startZ);
  const end = new THREE.Vector3(line.endX, baseHeight + line.y - 0.6, line.endZ);
  const direction = new THREE.Vector3().subVectors(end, start);
  const directionLength = direction.length();
  const length = Math.max(0.1, directionLength);
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const normalizedDirection = directionLength > 0.0001
    ? direction.clone().normalize()
    : DESERT_CLOTHESLINE_UP;
  const quaternion = new THREE.Quaternion().setFromUnitVectors(DESERT_CLOTHESLINE_UP, normalizedDirection);
  const yaw = Math.atan2(direction.x, direction.z);
  const cloths = new Array<DesertClothesLineClothDescriptor>(line.colors.length);

  for (let index = 0; index < line.colors.length; index += 1) {
    const t = DESERT_CLOTH_START_T + index * DESERT_CLOTH_STEP_T;
    cloths[index] = {
      key: `${line.key}-cloth-${index}`,
      color: line.colors[index],
      height: 2.8 + (index % 2) * 0.65,
      position: [
        lerpNumber(start.x, end.x, t),
        lerpNumber(start.y, end.y, t) - DESERT_CLOTH_DROP,
        lerpNumber(start.z, end.z, t),
      ],
      rotation: [0, yaw, 0],
    };
  }

  return { midpoint, quaternion, length, cloths };
}
