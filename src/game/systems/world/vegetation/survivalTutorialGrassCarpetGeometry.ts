import * as THREE from "three";
import { getSurvivalRestoredMeadowMask } from "../survival/survivalBiome";
import { clamp01, smoothstepRange } from "../survival/survivalMath";
import {
  SURVIVAL_TUTORIAL_GRASS_CELL_SIZE,
  type SurvivalTutorialGrassCell,
} from "./survivalTutorialGrassStreaming";
import {
  getSurvivalChunkInfoAtWorld,
  getSurvivalGrassSurfaceBiome,
  getSurvivalGrassSurfaceHeightAtWorld,
  getSurvivalGrassSurfaceHeightForChunk,
  getSurvivalLocalGrassPlacement,
  getSurvivalSmoothedTerrainColor,
} from "./survivalDormantGrassSurface";

const SURVIVAL_TUTORIAL_GRASS_CARPET_MEADOW_DARK_COLOR = new THREE.Color("#5fbe38");
const SURVIVAL_TUTORIAL_GRASS_CARPET_MEADOW_LIGHT_COLOR = new THREE.Color("#a9e85c");

export function makeSurvivalTutorialGrassCarpetGeometry(cell: SurvivalTutorialGrassCell) {
  const segments = cell.lod === "near" ? 14 : 7;
  const step = SURVIVAL_TUTORIAL_GRASS_CELL_SIZE / segments;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const color = new THREE.Color();

  const getSurfaceY = (worldX: number, worldZ: number) => {
    const chunk = getSurvivalChunkInfoAtWorld(worldX, worldZ);
    return getSurvivalGrassSurfaceHeightForChunk(chunk, worldX - chunk.x, worldZ - chunk.z) + 0.072;
  };

  const pushVertex = (worldX: number, worldZ: number, y: number, vertexColor: THREE.Color) => {
    const vertexIndex = positions.length / 3;
    positions.push(worldX, y, worldZ);
    colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
    uvs.push(worldX / 18, worldZ / 18);
    return vertexIndex;
  };

  for (let row = 0; row < segments; row += 1) {
    for (let col = 0; col < segments; col += 1) {
      const centerWorldX = cell.x + (col + 0.5) * step;
      const centerWorldZ = cell.z + (row + 0.5) * step;
      const placement = getSurvivalLocalGrassPlacement(centerWorldX, centerWorldZ, 0.025, Math.min(1.2, step * 0.12), 0.34);
      const meadowMask = getSurvivalRestoredMeadowMask(centerWorldX, centerWorldZ);
      if (!placement && meadowMask <= 0.18) continue;
      const terrainY = placement?.terrainY ?? getSurvivalGrassSurfaceHeightAtWorld(centerWorldX, centerWorldZ);
      const biome = placement?.biome ?? getSurvivalGrassSurfaceBiome(
        getSurvivalChunkInfoAtWorld(centerWorldX, centerWorldZ).biome,
        centerWorldX,
        centerWorldZ,
        terrainY,
      );
      const noise = (
        Math.sin(centerWorldX * 0.12 + centerWorldZ * 0.04) +
        Math.cos(centerWorldZ * 0.1 - centerWorldX * 0.06)
      ) * 0.5;
      const terrainColor = getSurvivalSmoothedTerrainColor(centerWorldX, centerWorldZ, terrainY);
      color.copy(SURVIVAL_TUTORIAL_GRASS_CARPET_MEADOW_DARK_COLOR).lerp(
        SURVIVAL_TUTORIAL_GRASS_CARPET_MEADOW_LIGHT_COLOR,
        0.36 + smoothstepRange(-0.8, 1.0, noise) * 0.42,
      );
      color.lerp(terrainColor, biome === "desert" ? 0.4 : 0.12 * (1 - meadowMask));
      color.multiplyScalar(biome === "desert" ? 0.92 : 1.06);
      color.r = clamp01(color.r);
      color.g = clamp01(color.g);
      color.b = clamp01(color.b);

      const x0 = cell.x + col * step;
      const z0 = cell.z + row * step;
      const x1 = x0 + step;
      const z1 = z0 + step;
      const y00 = getSurfaceY(x0, z0);
      const y10 = getSurfaceY(x1, z0);
      const y01 = getSurfaceY(x0, z1);
      const y11 = getSurfaceY(x1, z1);

      const a = pushVertex(x0, z0, y00, color);
      const b = pushVertex(x1, z0, y10, color);
      const c = pushVertex(x0, z1, y01, color);
      const d = pushVertex(x1, z1, y11, color);
      indices.push(a, c, b, b, c, d);
    }
  }

  if (indices.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
