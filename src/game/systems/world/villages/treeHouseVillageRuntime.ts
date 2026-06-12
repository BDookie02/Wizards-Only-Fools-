import * as THREE from "three";

export type TreeHouseSpec = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
};

export type TreeHouseTreePlacement = {
  pos: THREE.Vector3;
  angle: number;
};

export type TreeHouseRootColliderSpec = {
  position: [number, number, number];
  rotation: number;
};

export type TreeHouseSpanConnection = {
  startTree: number;
  startHouse: number;
  endTree: number;
  endHouse: number;
};

export type TreeHouseVillageLayout = {
  treePositions: TreeHouseTreePlacement[];
  houseBalconies: THREE.Vector3[][];
  treeBases: THREE.Vector3[];
};

export type TreeHouseSpanTransform = {
  length: number;
  position: THREE.Vector3;
  angleX: number;
  angleY: number;
};

export type TreeHouseSpiralStep = {
  index: number;
  position: [number, number, number];
  rotation: [number, number, number];
};

export type TreeHouseRopeRung = {
  index: number;
  position: [number, number, number];
};

export const TREE_HOUSE_SPECS: TreeHouseSpec[] = [
  { position: [6.5, 15, 6.5], rotation: [0, Math.PI / 4, 0], scale: 1.2 },
  { position: [-7, 22, 5], rotation: [0, -Math.PI / 6, 0], scale: 1.0 },
  { position: [-2, 28, -7.5], rotation: [0, Math.PI, 0], scale: 1.5 },
  { position: [8, 25, -4], rotation: [0, Math.PI / 2, 0], scale: 0.9 },
];

export const TREE_HOUSE_ROOT_COLLIDERS: TreeHouseRootColliderSpec[] = [
  { position: [4, 0, 4], rotation: Math.PI / 4 },
  { position: [-4, 0, -4], rotation: -Math.PI * 3 / 4 },
  { position: [-4, 0, 4], rotation: -Math.PI / 4 },
  { position: [4, 0, -4], rotation: Math.PI * 3 / 4 },
];

export const TREE_HOUSE_INTERNAL_ROPE_CONNECTIONS: [number, number][] = [
  [0, 1],
  [1, 3],
  [3, 2],
];

export const TREE_HOUSE_BRIDGE_CONNECTIONS: TreeHouseSpanConnection[] = [
  { startTree: 0, startHouse: 0, endTree: 1, endHouse: 0 },
  { startTree: 0, startHouse: 0, endTree: 2, endHouse: 0 },
  { startTree: 0, startHouse: 0, endTree: 3, endHouse: 0 },
  { startTree: 0, startHouse: 0, endTree: 4, endHouse: 0 },
  { startTree: 1, startHouse: 0, endTree: 2, endHouse: 0 },
  { startTree: 2, startHouse: 0, endTree: 4, endHouse: 0 },
  { startTree: 4, startHouse: 0, endTree: 3, endHouse: 0 },
  { startTree: 3, startHouse: 0, endTree: 1, endHouse: 0 },
  { startTree: 0, startHouse: 2, endTree: 1, endHouse: 1 },
  { startTree: 1, startHouse: 2, endTree: 3, endHouse: 3 },
  { startTree: 0, startHouse: 1, endTree: 2, endHouse: 0 },
  { startTree: 2, startHouse: 2, endTree: 4, endHouse: 3 },
  { startTree: 0, startHouse: 3, endTree: 4, endHouse: 1 },
];

const TREE_HOUSE_TREE_PLACEMENTS = [
  { position: [0, -0.5, 0] as [number, number, number], angle: 0 },
  { position: [25, -0.5, 20] as [number, number, number], angle: 1.2 },
  { position: [-28, -0.5, 15] as [number, number, number], angle: -0.5 },
  { position: [18, -0.5, -26] as [number, number, number], angle: 2.1 },
  { position: [-22, -0.5, -24] as [number, number, number], angle: 0.8 },
];

const TREE_HOUSE_Y_AXIS = new THREE.Vector3(0, 1, 0);
const treeHouseSpiralStepCache = new Map<string, readonly TreeHouseSpiralStep[]>();
const treeHouseRopeRungCache = new Map<string, readonly TreeHouseRopeRung[]>();

export function getTreeHouseSpiralSteps(radius: number, height: number, steps: number) {
  const safeSteps = Math.max(1, Math.floor(steps));
  const key = `${radius}:${height}:${safeSteps}`;
  const cached = treeHouseSpiralStepCache.get(key);
  if (cached) return cached;

  const denominator = Math.max(1, safeSteps - 1);
  const descriptors = new Array<TreeHouseSpiralStep>(safeSteps);
  for (let index = 0; index < safeSteps; index += 1) {
    const t = index / denominator;
    const y = t * height;
    const angle = t * Math.PI * 4;
    descriptors[index] = {
      index,
      position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
      rotation: [0, -angle, 0],
    };
  }

  treeHouseSpiralStepCache.set(key, descriptors);
  return descriptors;
}

export function getTreeHouseRopeRungs(length: number, rungStep: number) {
  const safeLength = Number.isFinite(length) ? Math.max(0, length) : 0;
  const safeRungStep = Number.isFinite(rungStep) ? Math.max(0.001, rungStep) : 1;
  const rungCount = Math.floor(safeLength / safeRungStep);
  const key = `${safeLength}:${safeRungStep}:${rungCount}`;
  const cached = treeHouseRopeRungCache.get(key);
  if (cached) return cached;

  const descriptors = new Array<TreeHouseRopeRung>(rungCount);
  for (let index = 0; index < rungCount; index += 1) {
    descriptors[index] = {
      index,
      position: [0, 0, -safeLength / 2 + index * safeRungStep + safeRungStep * 0.5],
    };
  }

  treeHouseRopeRungCache.set(key, descriptors);
  return descriptors;
}

export function getTreeHouseSpanTransform(start: THREE.Vector3, end: THREE.Vector3): TreeHouseSpanTransform {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const distXZ = Math.sqrt(dx * dx + dz * dz);
  return {
    length,
    position: new THREE.Vector3((start.x + end.x) * 0.5, (start.y + end.y) * 0.5, (start.z + end.z) * 0.5),
    angleY: Math.atan2(dx, dz),
    angleX: Math.atan2(dy, distXZ),
  };
}

export function buildTreeHouseVillageLayout(): TreeHouseVillageLayout {
  const treePositions = new Array<TreeHouseTreePlacement>(TREE_HOUSE_TREE_PLACEMENTS.length);
  for (let treeIndex = 0; treeIndex < TREE_HOUSE_TREE_PLACEMENTS.length; treeIndex += 1) {
    const tree = TREE_HOUSE_TREE_PLACEMENTS[treeIndex];
    treePositions[treeIndex] = {
      pos: new THREE.Vector3(...tree.position),
      angle: tree.angle,
    };
  }

  const houseLocalPositions = new Array<THREE.Vector3>(TREE_HOUSE_SPECS.length);
  for (let houseIndex = 0; houseIndex < TREE_HOUSE_SPECS.length; houseIndex += 1) {
    houseLocalPositions[houseIndex] = new THREE.Vector3(...TREE_HOUSE_SPECS[houseIndex].position);
  }

  const houseBalconies = new Array<THREE.Vector3[]>(treePositions.length);
  for (let treeIndex = 0; treeIndex < treePositions.length; treeIndex += 1) {
    const tree = treePositions[treeIndex];
    const positions = new Array<THREE.Vector3>(houseLocalPositions.length);
    for (let houseIndex = 0; houseIndex < houseLocalPositions.length; houseIndex += 1) {
      const houseSpec = TREE_HOUSE_SPECS[houseIndex];
      const pos = houseLocalPositions[houseIndex].clone();
      pos.applyAxisAngle(TREE_HOUSE_Y_AXIS, tree.angle);
      pos.add(tree.pos);
      pos.y -= 2.5 * houseSpec.scale;
      positions[houseIndex] = pos;
    }
    houseBalconies[treeIndex] = positions;
  }

  const treeBases = new Array<THREE.Vector3>(treePositions.length);
  for (let treeIndex = 0; treeIndex < treePositions.length; treeIndex += 1) {
    const tree = treePositions[treeIndex];
    treeBases[treeIndex] = new THREE.Vector3(tree.pos.x, 0, tree.pos.z);
  }
  return { treePositions, houseBalconies, treeBases };
}
