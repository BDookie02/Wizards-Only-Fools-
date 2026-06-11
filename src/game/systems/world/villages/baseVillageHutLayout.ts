import { getBaseVillageTerrainHeight as getTerrainHeight } from "../terrain/BaseVillageTerrain";

export interface HutInfo {
  id: string;
  x: number;
  y: number;
  z: number;
  hutType: number;
  colorIndex: number;
  rotation: number;
  hasPath: boolean;
  pathRot: number;
  isMushroom: boolean;
  interiorWidth?: number;
  interiorDepth?: number;
  interiorHeight?: number;
  villagerBackOffset?: number;
  villagerSideOffset?: number;
  villagerYOffset?: number;
  villagerTheme?: "village" | "egyptian" | "swamp";
}

export const isRoadCell = (x: number, z: number) => {
  const absX = Math.abs(x);
  const absZ = Math.abs(z);
  const R = Math.sqrt(x * x + z * z);
  const isRoad = absX < 24 || absZ < 24;
  const isCentralPlaza = R < 45;
  const isPath = ((absX >= 24 && absX < 48) && R > 60 && R < 125) || ((absZ >= 24 && absZ < 48) && R > 60 && R < 125);
  return isRoad || isCentralPlaza || isPath;
};

export const isBlockingCell = (x: number, z: number) => {
  const absX = Math.abs(x);
  const absZ = Math.abs(z);
  const R = Math.sqrt(x * x + z * z);

  if (absX >= 230 || absZ >= 230) return false;

  const isMoat = (R > 30 && R < 70) || (R > 112 && R < 158);
  if (isRoadCell(x, z) || isMoat) return false;

  const treePositions = [
    [0, 0],
    [25, 20],
    [-28, 15],
    [18, -26],
    [-22, -24],
  ];
  for (const [tx, tz] of treePositions) {
    if (Math.abs(x - tx) < 20 && Math.abs(z - tz) < 20) {
      return false;
    }
  }

  const cx = Math.floor((x + 256) / 16);
  const cz = Math.floor((z + 256) / 16);
  const hash = Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453;
  return hash - Math.floor(hash) <= 0.65;
};

export const isHutCell = (x: number, z: number) => {
  return isBlockingCell(x, z);
};

export const getHutList = (): HutInfo[] => {
  const list: HutInfo[] = [];
  for (let x = -240; x <= 240; x += 16) {
    for (let z = -240; z <= 240; z += 16) {
      if (isHutCell(x, z)) {
        const cx = Math.floor((x + 256) / 16);
        const cz = Math.floor((z + 256) / 16);
        const uniqueHash = Math.sin(cx * 3.123 + cz * 4.412) * 1000;
        const hashVal = uniqueHash - Math.floor(uniqueHash);

        let hutType = 0;
        if (hashVal > 0.5) hutType = 0;
        else if (hashVal > 0.33) hutType = 1;
        else if (hashVal > 0.16) hutType = 2;
        else hutType = 3;

        const colorIndex = Math.floor(Math.abs(uniqueHash * 1000)) % 4;

        const blockedZPos = isBlockingCell(x, z + 16);
        const blockedXPos = isBlockingCell(x + 16, z);
        const blockedZNeg = isBlockingCell(x, z - 16);
        const blockedXNeg = isBlockingCell(x - 16, z);

        const validRotations = [];
        if (!blockedZPos) validRotations.push(0);
        if (!blockedXPos) validRotations.push(Math.PI / 2);
        if (!blockedZNeg) validRotations.push(Math.PI);
        if (!blockedXNeg) validRotations.push(-Math.PI / 2);

        if (validRotations.length === 0) continue;

        const roadRotations = [];
        if (isRoadCell(x, z + 16)) roadRotations.push(0);
        if (isRoadCell(x + 16, z)) roadRotations.push(Math.PI / 2);
        if (isRoadCell(x, z - 16)) roadRotations.push(Math.PI);
        if (isRoadCell(x - 16, z)) roadRotations.push(-Math.PI / 2);

        let rotation = 0;
        let hasPath = false;
        let pathRot = 0;

        if (roadRotations.length > 0) {
          rotation = roadRotations[Math.floor(Math.abs(uniqueHash * 100)) % roadRotations.length];
          hasPath = true;
          pathRot = rotation;
        } else {
          rotation = validRotations[Math.floor(Math.abs(uniqueHash * 100)) % validRotations.length];
        }

        const y = getTerrainHeight(x, z);

        list.push({ id: `${x}-${z}`, x, y, z, hutType, colorIndex, rotation, hasPath, pathRot, isMushroom: hutType === 0 });
      }
    }
  }
  return list;
};
