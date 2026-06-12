import * as THREE from "three";
import { getSurvivalRestoredMeadowMask } from "../survival/survivalBiome";
import { clamp01, lerpNumber, smoothstepRange } from "../survival/survivalMath";
import {
  SURVIVAL_LOCAL_GRASS_CARPET_SEGMENTS,
  SURVIVAL_LOCAL_GRASS_CELL_SIZE,
  type SurvivalLocalGrassCell,
} from "./survivalLocalGrassStreaming";
import {
  getSurvivalChunkInfoAtWorld,
  getSurvivalGrassSurfaceHeightForChunk,
  getSurvivalLocalGrassPlacement,
  getSurvivalSmoothedTerrainColor,
} from "./survivalDormantGrassSurface";

const SURVIVAL_LOCAL_GRASS_CARPET_MEADOW_BASE_COLOR = new THREE.Color("#65c73d");
const SURVIVAL_LOCAL_GRASS_CARPET_MEADOW_TIP_COLOR = new THREE.Color("#a9e65b");
const SURVIVAL_LOCAL_GRASS_CARPET_MEADOW_SHADE_COLOR = new THREE.Color("#55b738");

export function makeSurvivalLocalGrassCarpetGeometry(cell: SurvivalLocalGrassCell) {
  const segments = SURVIVAL_LOCAL_GRASS_CARPET_SEGMENTS;
  const step = SURVIVAL_LOCAL_GRASS_CELL_SIZE / segments;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const vertexMap = new Map<string, number>();
  const meadowColor = new THREE.Color();
  const meadowShade = new THREE.Color();

  const addVertex = (gridX: number, gridZ: number) => {
    const key = `${gridX}:${gridZ}`;
    const existing = vertexMap.get(key);
    if (existing !== undefined) return existing;

    const x = gridX * step;
    const z = gridZ * step;
    const worldX = cell.x + x;
    const worldZ = cell.z + z;
    const chunk = getSurvivalChunkInfoAtWorld(worldX, worldZ);
    const localX = worldX - chunk.x;
    const localZ = worldZ - chunk.z;
    const y = getSurvivalGrassSurfaceHeightForChunk(chunk, localX, localZ) + 0.045;
    const terrainColor = getSurvivalSmoothedTerrainColor(worldX, worldZ, y);
    const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
    const meadowFiber = (
      Math.sin(worldX * 0.115 + worldZ * 0.041) +
      Math.cos(worldZ * 0.107 - worldX * 0.052) +
      Math.sin((worldX + worldZ) * 0.073)
    ) / 3;
    const meadowCluster = smoothstepRange(-0.42, 0.76, meadowFiber);
    meadowColor.copy(SURVIVAL_LOCAL_GRASS_CARPET_MEADOW_BASE_COLOR).lerp(SURVIVAL_LOCAL_GRASS_CARPET_MEADOW_TIP_COLOR, meadowCluster);
    if (meadowMask > 0.04) {
      meadowShade.copy(SURVIVAL_LOCAL_GRASS_CARPET_MEADOW_SHADE_COLOR).lerp(meadowColor, 0.64 + meadowMask * 0.24);
      terrainColor.lerp(meadowShade, 0.62 + meadowMask * 0.28);
    } else {
      terrainColor.lerp(meadowColor, meadowMask * 0.97);
    }
    terrainColor.multiplyScalar(lerpNumber(0.99, 1.08, meadowMask));
    terrainColor.r = clamp01(terrainColor.r);
    terrainColor.g = clamp01(terrainColor.g);
    terrainColor.b = clamp01(terrainColor.b);

    const vertexIndex = positions.length / 3;
    positions.push(worldX, y, worldZ);
    colors.push(terrainColor.r, terrainColor.g, terrainColor.b);
    uvs.push(worldX / 24, worldZ / 24);
    vertexMap.set(key, vertexIndex);
    return vertexIndex;
  };

  for (let z = 0; z < segments; z += 1) {
    for (let x = 0; x < segments; x += 1) {
      const centerWorldX = cell.x + (x + 0.5) * step;
      const centerWorldZ = cell.z + (z + 0.5) * step;
      const placement = getSurvivalLocalGrassPlacement(centerWorldX, centerWorldZ, 0.025, Math.min(1.2, step * 0.08), 0.34);
      if (!placement) continue;

      const a = addVertex(x, z);
      const b = addVertex(x + 1, z);
      const c = addVertex(x, z + 1);
      const d = addVertex(x + 1, z + 1);
      indices.push(a, c, b, b, c, d);
    }
  }

  if (indices.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}
