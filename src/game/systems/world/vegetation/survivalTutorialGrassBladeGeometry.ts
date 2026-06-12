import * as THREE from "three";
import { getSurvivalRestoredMeadowMask } from "../survival/survivalBiome";
import { lerpNumber, smoothstepRange, survivalHash01 } from "../survival/survivalMath";
import { getDormantGrassVectorLength3D } from "./survivalDormantGrassRuntime";
import {
  SURVIVAL_TUTORIAL_GRASS_AIR_RADIUS,
  SURVIVAL_TUTORIAL_GRASS_BLADE_DENSITY_DISTANCE,
  SURVIVAL_TUTORIAL_GRASS_CELL_SIZE,
  SURVIVAL_TUTORIAL_GRASS_EDGE_FADE,
  SURVIVAL_TUTORIAL_GRASS_GROUND_RADIUS,
  SURVIVAL_TUTORIAL_GRASS_MID_BLADE_BASE_COUNT,
  SURVIVAL_TUTORIAL_GRASS_MID_BLADE_EXTRA_COUNT,
  SURVIVAL_TUTORIAL_GRASS_NEAR_BLADE_BASE_COUNT,
  SURVIVAL_TUTORIAL_GRASS_NEAR_BLADE_EXTRA_COUNT,
  SURVIVAL_TUTORIAL_GRASS_NORMAL_UP_BIAS,
  type SurvivalTutorialGrassCell,
} from "./survivalTutorialGrassStreaming";
import {
  getSurvivalGrassBladeColor,
  getSurvivalLocalGrassPlacement,
  getSurvivalSmoothedTerrainColor,
} from "./survivalDormantGrassSurface";

const SURVIVAL_TUTORIAL_GRASS_BLADE_MEADOW_TOP_COLOR = new THREE.Color("#cdf76e");
const SURVIVAL_TUTORIAL_GRASS_BLADE_MEADOW_BODY_COLOR = new THREE.Color("#85dc4c");
const SURVIVAL_TUTORIAL_GRASS_BLADE_MEADOW_SHADOW_COLOR = new THREE.Color("#68bc3e");

export function makeSurvivalTutorialGrassBladeGeometry(cell: SurvivalTutorialGrassCell) {
  const cellMeadowMask = getSurvivalRestoredMeadowMask(
    cell.x + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
    cell.z + SURVIVAL_TUTORIAL_GRASS_CELL_SIZE * 0.5,
  );
  const distanceFade = 1 - smoothstepRange(
    SURVIVAL_TUTORIAL_GRASS_GROUND_RADIUS,
    SURVIVAL_TUTORIAL_GRASS_AIR_RADIUS + SURVIVAL_TUTORIAL_GRASS_EDGE_FADE,
    cell.densityDistance,
  );
  const nearDensity = 1 - smoothstepRange(30, SURVIVAL_TUTORIAL_GRASS_BLADE_DENSITY_DISTANCE, cell.densityDistance);
  const restoredDensityBoost = lerpNumber(
    1,
    cell.lod === "near" ? 1.34 : 1.68,
    smoothstepRange(0.06, 0.36, cellMeadowMask),
  );
  const targetCount = Math.round(
    (cell.lod === "near"
      ? SURVIVAL_TUTORIAL_GRASS_NEAR_BLADE_BASE_COUNT + SURVIVAL_TUTORIAL_GRASS_NEAR_BLADE_EXTRA_COUNT * nearDensity
      : SURVIVAL_TUTORIAL_GRASS_MID_BLADE_BASE_COUNT + SURVIVAL_TUTORIAL_GRASS_MID_BLADE_EXTRA_COUNT * distanceFade) *
      restoredDensityBoost,
  );
  if (targetCount <= 0) return null;

  const gridSize = Math.max(2, Math.ceil(Math.sqrt(targetCount * 1.18)));
  const attempts = gridSize * gridSize;
  const sampleOffset = Math.floor(survivalHash01(cell.cellX, cell.cellZ, 45200) * attempts);
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const bendWeights: number[] = [];
  const indices: number[] = [];
  const baseColor = new THREE.Color();
  const midColor = new THREE.Color();
  const tipColor = new THREE.Color();
  const cardMidColor = new THREE.Color();
  let placed = 0;

  const pushVertex = (
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    color: THREE.Color,
    bendWeight: number,
    u: number,
    v: number,
  ) => {
    positions.push(x, y, z);
    normals.push(nx, ny, nz);
    colors.push(color.r, color.g, color.b);
    uvs.push(u, v);
    bendWeights.push(bendWeight);
  };

  for (let index = 0; index < attempts && placed < targetCount; index += 1) {
    const sampleIndex = (sampleOffset + index * 2029) % attempts;
    const col = sampleIndex % gridSize;
    const row = Math.floor(sampleIndex / gridSize);
    const jitterX = 0.08 + survivalHash01(cell.cellX + col, cell.cellZ - row, 45240 + index) * 0.84;
    const jitterZ = 0.08 + survivalHash01(cell.cellX - row, cell.cellZ + col, 45280 + index) * 0.84;
    const localX = ((col + jitterX) / gridSize) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
    const localZ = ((row + jitterZ) / gridSize) * SURVIVAL_TUTORIAL_GRASS_CELL_SIZE;
    const worldX = cell.x + localX;
    const worldZ = cell.z + localZ;
    const meadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
    const footprint = lerpNumber(cell.lod === "near" ? 0.08 : 0.22, 0.025, meadowMask);
    const placement = getSurvivalLocalGrassPlacement(worldX, worldZ, 0.02, footprint, lerpNumber(0.48, 0.32, meadowMask));
    if (!placement) continue;

    const terrainY = placement.terrainY;
    const biome = placement.biome;
    const variant = survivalHash01(cell.cellX, cell.cellZ, 45320 + index);
    const heightRoll = survivalHash01(cell.cellX, cell.cellZ, 45360 + index);
    const widthRoll = survivalHash01(cell.cellX, cell.cellZ, 45400 + index);
    const colorRoll = survivalHash01(cell.cellX, cell.cellZ, 45440 + index);
    const yaw = survivalHash01(cell.cellX, cell.cellZ, 45480 + index) * Math.PI * 2;
    const yaw2 = yaw + Math.PI * 0.5 + (survivalHash01(cell.cellX, cell.cellZ, 45520 + index) - 0.5) * 0.42;
    const normalX = placement.normal.x;
    const normalY = placement.normal.y;
    const normalZ = placement.normal.z;
    const litNormalX = normalX * (1 - SURVIVAL_TUTORIAL_GRASS_NORMAL_UP_BIAS);
    const litNormalY = normalY * (1 - SURVIVAL_TUTORIAL_GRASS_NORMAL_UP_BIAS) + SURVIVAL_TUTORIAL_GRASS_NORMAL_UP_BIAS;
    const litNormalZ = normalZ * (1 - SURVIVAL_TUTORIAL_GRASS_NORMAL_UP_BIAS);
    const litNormalLength = getDormantGrassVectorLength3D(litNormalX, litNormalY, litNormalZ) || 1;
    const nx = litNormalX / litNormalLength;
    const ny = litNormalY / litNormalLength;
    const nz = litNormalZ / litNormalLength;

    let sideX = Math.cos(yaw);
    let sideY = 0;
    let sideZ = Math.sin(yaw);
    let sideDot = sideX * normalX + sideY * normalY + sideZ * normalZ;
    sideX -= normalX * sideDot;
    sideY -= normalY * sideDot;
    sideZ -= normalZ * sideDot;
    let sideLength = getDormantGrassVectorLength3D(sideX, sideY, sideZ);
    if (sideLength < 0.001) {
      sideX = 1;
      sideY = 0;
      sideZ = 0;
      sideLength = 1;
    }
    sideX /= sideLength;
    sideY /= sideLength;
    sideZ /= sideLength;

    let bendX = Math.cos(yaw2);
    let bendY = 0;
    let bendZ = Math.sin(yaw2);
    const bendDot = bendX * normalX + bendY * normalY + bendZ * normalZ;
    bendX -= normalX * bendDot;
    bendY -= normalY * bendDot;
    bendZ -= normalZ * bendDot;
    const bendLength = getDormantGrassVectorLength3D(bendX, bendY, bendZ) || 1;
    bendX /= bendLength;
    bendY /= bendLength;
    bendZ /= bendLength;

    const meadowHeight = lerpNumber(0.95, 1.13, meadowMask);
    const height = (
      cell.lod === "near"
        ? lerpNumber(0.48, 0.86, heightRoll)
        : lerpNumber(0.44, 0.78, heightRoll)
    ) * meadowHeight;
    const halfWidth = (
      cell.lod === "near"
        ? lerpNumber(0.16, 0.34, widthRoll)
        : lerpNumber(0.18, 0.38, widthRoll)
    ) * lerpNumber(0.95, 1.12, meadowMask);
    const lean = height * lerpNumber(0.08, 0.26, survivalHash01(cell.cellX, cell.cellZ, 45560 + index));
    const baseY = terrainY + 0.028;
    const terrainTint = getSurvivalSmoothedTerrainColor(worldX, worldZ, terrainY);
    baseColor.copy(getSurvivalGrassBladeColor(biome, worldX, worldZ, terrainY, variant));
    if (biome !== "desert" && biome !== "swamp") {
      baseColor.lerp(SURVIVAL_TUTORIAL_GRASS_BLADE_MEADOW_BODY_COLOR, 0.48 + meadowMask * 0.42);
      baseColor.lerp(SURVIVAL_TUTORIAL_GRASS_BLADE_MEADOW_TOP_COLOR, colorRoll * meadowMask * 0.16);
    }
    baseColor.lerp(terrainTint, biome === "desert" ? 0.25 : 0.015);
    baseColor.multiplyScalar(1.06 + colorRoll * 0.16);
    midColor.copy(baseColor).lerp(SURVIVAL_TUTORIAL_GRASS_BLADE_MEADOW_BODY_COLOR, 0.42 + meadowMask * 0.18);
    tipColor.copy(baseColor).lerp(SURVIVAL_TUTORIAL_GRASS_BLADE_MEADOW_TOP_COLOR, 0.52 + meadowMask * 0.28);
    baseColor.lerp(SURVIVAL_TUTORIAL_GRASS_BLADE_MEADOW_SHADOW_COLOR, 0.035 + (1 - normalY) * 0.045);

    const pushGrassCard = (
      cardSideX: number,
      cardSideY: number,
      cardSideZ: number,
      widthScale: number,
      heightScale: number,
      colorOffset: number,
    ) => {
      const cardHalfWidth = halfWidth * widthScale;
      const cardTopHalfWidth = cardHalfWidth * 0.3;
      const cardTipX = worldX + bendX * lean * heightScale + normalX * height * 0.08 * heightScale;
      const cardTipY = baseY + normalY * height * heightScale + bendY * lean * heightScale;
      const cardTipZ = worldZ + bendZ * lean * heightScale + normalZ * height * 0.08 * heightScale;
      cardMidColor.copy(midColor).lerp(tipColor, colorOffset);
      const vertexBase = positions.length / 3;

      pushVertex(
        worldX - cardSideX * cardHalfWidth,
        baseY - cardSideY * cardHalfWidth,
        worldZ - cardSideZ * cardHalfWidth,
        nx,
        ny,
        nz,
        baseColor,
        0,
        0,
        0,
      );
      pushVertex(
        worldX + cardSideX * cardHalfWidth,
        baseY + cardSideY * cardHalfWidth,
        worldZ + cardSideZ * cardHalfWidth,
        nx,
        ny,
        nz,
        baseColor,
        0,
        1,
        0,
      );
      pushVertex(
        cardTipX - cardSideX * cardTopHalfWidth,
        cardTipY - cardSideY * cardTopHalfWidth,
        cardTipZ - cardSideZ * cardTopHalfWidth,
        nx,
        ny,
        nz,
        cardMidColor,
        1,
        0,
        1,
      );
      pushVertex(
        cardTipX + cardSideX * cardTopHalfWidth,
        cardTipY + cardSideY * cardTopHalfWidth,
        cardTipZ + cardSideZ * cardTopHalfWidth,
        nx,
        ny,
        nz,
        tipColor,
        1,
        1,
        1,
      );
      indices.push(
        vertexBase,
        vertexBase + 2,
        vertexBase + 1,
        vertexBase + 1,
        vertexBase + 2,
        vertexBase + 3,
      );
    };

    pushGrassCard(sideX, sideY, sideZ, 1, 1, 0.18);
    if (
      (cell.lod === "near" && survivalHash01(cell.cellX, cell.cellZ, 45620 + index) > 0.58) ||
      survivalHash01(cell.cellX, cell.cellZ, 45660 + index) > 0.82
    ) {
      let crossSideX = bendX;
      let crossSideY = bendY;
      let crossSideZ = bendZ;
      const crossSideDot = crossSideX * normalX + crossSideY * normalY + crossSideZ * normalZ;
      crossSideX -= normalX * crossSideDot;
      crossSideY -= normalY * crossSideDot;
      crossSideZ -= normalZ * crossSideDot;
      const crossSideLength = getDormantGrassVectorLength3D(crossSideX, crossSideY, crossSideZ) || 1;
      crossSideX /= crossSideLength;
      crossSideY /= crossSideLength;
      crossSideZ /= crossSideLength;
      pushGrassCard(crossSideX, crossSideY, crossSideZ, 0.72, 0.9, 0.34);
    }
    placed += 1;
  }

  if (indices.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("grassBendWeight", new THREE.Float32BufferAttribute(bendWeights, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
