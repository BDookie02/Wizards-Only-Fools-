import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import {
  BASE_VILLAGE_APRON_DISTANCE,
  BASE_VILLAGE_EXIT_BLEND_DISTANCE,
  BASE_VILLAGE_EXIT_HEIGHT,
  BASE_VILLAGE_HALF_SIZE,
  SURVIVAL_TERRAIN_COLOR_SAMPLES,
  type SurvivalChunkInfo,
} from "./survivalWorldConfig";
import {
  getBiomeTerrainHeight,
  getSurvivalBiomeWeightValuesInto,
  getSurvivalBiomeWeights,
  getSurvivalRestoredMeadowMask,
  getSurvivalTerrainColorInto,
  survivalBiomes,
  isStrictSurvivalDesertTerrainAtWorld,
  isSurvivalRestoredMeadowWaterSuppressed,
} from "./survivalBiome";
import { getSurvivalRiverCarveAtWorld } from "./survivalRivers";
import { getSurvivalTownRouteMask } from "./survivalRoutes";
import { configureSurvivalManaSourceResolvers } from "./survivalManaSources";
import {
  SURVIVAL_GRAVEYARD_PAD_FLAT_RADIUS as GRAVEYARD_PAD_FLAT_RADIUS,
  SPECIAL_SURVIVAL_VILLAGE_CHUNKS,
} from "../villages/survivalVillageRegistry";
import { DESERT_VILLAGE_PAD_FLAT_RADIUS } from "../villages/survivalDesertVillageTerrain";
import {
  getGraveyardGateClearingMask,
  getGraveyardLocalSurfaceHeight,
} from "../villages/survivalGraveyardVillageTerrain";
import {
  getSurvivalVillageBaseHeight as getSurvivalVillageBaseHeightWithResolvers,
  getSurvivalVillagePadHeight as getSurvivalVillagePadHeightWithResolvers,
  makeSurvivalVillagePadGeometry as makeSurvivalVillagePadGeometryWithResolvers,
  makeSurvivalVillagePadSkirtGeometry as makeSurvivalVillagePadSkirtGeometryWithResolvers,
} from "../villages/survivalVillagePad";
import { clamp01, lerpNumber, smoothstepRange } from "./survivalMath";

const survivalSmoothedTerrainSampleColor = new THREE.Color();
const survivalRenderedRestoredGroundColor = new THREE.Color("#4f9631");
const survivalRenderedRestoredLiftColor = new THREE.Color("#5fa836");
const survivalRenderedRestoredShadowColor = new THREE.Color("#3f7d28");
const survivalRenderedRestoredGroundScratch = new THREE.Color();
const survivalRawTerrainHeightBiomeWeights = new Array<number>(survivalBiomes.length).fill(0);
type SurvivalHeightMaskSample = { mask: number; height: number };
const survivalGraveyardExteriorApronScratch: SurvivalHeightMaskSample = { mask: 0, height: 0 };
const survivalGraveyardGateApproachScratch: SurvivalHeightMaskSample = { mask: 0, height: 0 };

export function getSurvivalSmoothedTerrainColorInto(
  worldX: number,
  worldZ: number,
  height: number,
  target: THREE.Color,
) {
  target.setRGB(0, 0, 0);
  let totalWeight = 0;

  for (let index = 0; index < SURVIVAL_TERRAIN_COLOR_SAMPLES.length; index += 1) {
    const [offsetX, offsetZ, weight] = SURVIVAL_TERRAIN_COLOR_SAMPLES[index];
    const sampleX = worldX + offsetX;
    const sampleZ = worldZ + offsetZ;
    const sampleHeight = offsetX === 0 && offsetZ === 0
      ? height
      : getSurvivalRawTerrainHeightAtWorld(sampleX, sampleZ);
    const sample = getSurvivalTerrainColorInto(sampleX, sampleZ, sampleHeight, survivalSmoothedTerrainSampleColor);
    target.r += sample.r * weight;
    target.g += sample.g * weight;
    target.b += sample.b * weight;
    totalWeight += weight;
  }

  if (totalWeight > 0) {
    target.multiplyScalar(1 / totalWeight);
  }
  return target;
}

export function getSurvivalSmoothedTerrainColor(worldX: number, worldZ: number, height: number) {
  return getSurvivalSmoothedTerrainColorInto(worldX, worldZ, height, new THREE.Color());
}

export function getSurvivalRenderedTerrainColorInto(
  worldX: number,
  worldZ: number,
  height: number,
  target: THREE.Color,
) {
  const color = getSurvivalSmoothedTerrainColorInto(worldX, worldZ, height, target);
  const restoredMeadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ);
  if (restoredMeadowMask > 0.02) {
    const fineShade = Math.sin(worldX * 0.17 + worldZ * 0.29) * 0.016 +
      Math.cos(worldZ * 0.23 - worldX * 0.11) * 0.012;
    const grassBlend = smoothstepRange(0.02, 0.18, restoredMeadowMask);
    const terrainFiber = smoothstepRange(-0.62, 0.9, Math.sin(worldX * 0.063 + worldZ * 0.041));
    const restoredGround = survivalRenderedRestoredGroundScratch
      .copy(survivalRenderedRestoredGroundColor)
      .lerp(survivalRenderedRestoredShadowColor, smoothstepRange(0.72, 1, 1 - terrainFiber) * 0.24)
      .lerp(survivalRenderedRestoredLiftColor, terrainFiber * 0.22);
    color.lerp(restoredGround, grassBlend * 0.96);
    color.multiplyScalar(0.9 + fineShade);
    color.r = clamp01(color.r);
    color.g = clamp01(color.g);
    color.b = clamp01(color.b);
  }
  return color;
}

function getBaseVillageTransitionMask(worldX: number, worldZ: number) {
  const absX = Math.abs(worldX);
  const absZ = Math.abs(worldZ);
  const maxAbs = Math.max(absX, absZ);
  const minAbs = Math.min(absX, absZ);
  if (maxAbs < BASE_VILLAGE_HALF_SIZE - 0.5) return 0;

  const edgeApron = 1 - smoothstepRange(
    BASE_VILLAGE_HALF_SIZE + 4,
    BASE_VILLAGE_HALF_SIZE + BASE_VILLAGE_APRON_DISTANCE,
    maxAbs,
  );
  const gateRoadMask = 1 - smoothstepRange(18, 58, minAbs);
  const wallApronMask = 1 - smoothstepRange(
    BASE_VILLAGE_HALF_SIZE + 18,
    BASE_VILLAGE_HALF_SIZE + 108,
    maxAbs,
  );

  return clamp01(edgeApron * Math.max(gateRoadMask, wallApronMask));
}

export function getSurvivalRawTerrainHeightAtWorld(worldX: number, worldZ: number) {
  const weights = getSurvivalBiomeWeightValuesInto(worldX, worldZ, survivalRawTerrainHeightBiomeWeights);
  let height = 0;
  for (let index = 0; index < survivalBiomes.length; index += 1) {
    const weight = weights[index] ?? 0;
    if (weight <= 0) continue;
    height += getBiomeTerrainHeight(survivalBiomes[index], worldX, worldZ) * weight;
  }
  return height;
}

function writeGraveyardExteriorApronAtWorld(
  worldX: number,
  worldZ: number,
  target: SurvivalHeightMaskSample,
) {
  target.mask = 0;
  target.height = 0;
  const apronDistance = 220;

  for (let index = 0; index < SPECIAL_SURVIVAL_VILLAGE_CHUNKS.length; index += 1) {
    const village = SPECIAL_SURVIVAL_VILLAGE_CHUNKS[index];
    if (village.kind !== "graveyard") continue;

    const centerX = village.cx * SURVIVAL_BLOCK_SIZE;
    const centerZ = village.cz * SURVIVAL_BLOCK_SIZE;
    const localX = worldX - centerX;
    const localZ = worldZ - centerZ;
    const radiusSq = localX * localX + localZ * localZ;
    const minRadius = GRAVEYARD_PAD_FLAT_RADIUS - 4;
    const maxRadius = GRAVEYARD_PAD_FLAT_RADIUS + apronDistance;
    if (radiusSq < minRadius * minRadius || radiusSq > maxRadius * maxRadius) continue;
    const radius = Math.sqrt(radiusSq);
    const outsideDistance = radius - GRAVEYARD_PAD_FLAT_RADIUS;
    if (outsideDistance < -4 || outsideDistance > apronDistance) continue;

    const apronMask = 1 - smoothstepRange(0, apronDistance, Math.max(0, outsideDistance));
    if (apronMask <= target.mask) continue;

    const baseHeight = getSurvivalRawTerrainHeightAtWorld(centerX, centerZ);
    const edgeScale = radius > GRAVEYARD_PAD_FLAT_RADIUS ? GRAVEYARD_PAD_FLAT_RADIUS / radius : 1;
    const edgeLocalX = localX * edgeScale;
    const edgeLocalZ = localZ * edgeScale;

    target.mask = apronMask;
    target.height = getGraveyardLocalSurfaceHeight(edgeLocalX, edgeLocalZ, village.cx, village.cz, baseHeight);
  }

  return target;
}

function writeGraveyardGateApproachAtWorld(
  worldX: number,
  worldZ: number,
  target: SurvivalHeightMaskSample,
) {
  target.mask = 0;
  target.height = 0;

  for (let index = 0; index < SPECIAL_SURVIVAL_VILLAGE_CHUNKS.length; index += 1) {
    const village = SPECIAL_SURVIVAL_VILLAGE_CHUNKS[index];
    if (village.kind !== "graveyard") continue;

    const centerX = village.cx * SURVIVAL_BLOCK_SIZE;
    const centerZ = village.cz * SURVIVAL_BLOCK_SIZE;
    const localX = worldX - centerX;
    const localZ = worldZ - centerZ;
    const gateMask = getGraveyardGateClearingMask(localX, localZ);
    if (gateMask <= target.mask) continue;

    target.mask = gateMask;
    target.height = getSurvivalRawTerrainHeightAtWorld(centerX, centerZ) - 0.46;
  }

  return target;
}

export function getSurvivalTerrainHeightForChunk(chunk: SurvivalChunkInfo, localX: number, localZ: number) {
  const worldX = chunk.x + localX;
  const worldZ = chunk.z + localZ;
  let height = getSurvivalRawTerrainHeightAtWorld(worldX, worldZ);

  const riverCarve = getSurvivalRiverCarveAtWorld(worldX, worldZ);
  const restoredMeadowRiverSuppression = isSurvivalRestoredMeadowWaterSuppressed(worldX, worldZ, 96)
    ? 1
    : smoothstepRange(0.02, 0.18, getSurvivalRestoredMeadowMask(worldX, worldZ));
  const riverCarveStrength = riverCarve.strength * (1 - restoredMeadowRiverSuppression);
  if (riverCarveStrength > 0) {
    height = lerpNumber(height, Math.min(height, riverCarve.bed), riverCarveStrength);
  }

  const gateRoadDistance = Math.min(Math.abs(worldX), Math.abs(worldZ));
  const gateRoadMask = 1 - smoothstepRange(14, 46, gateRoadDistance);
  if (gateRoadMask > 0) {
    const travelAxis = Math.abs(worldX) < Math.abs(worldZ) ? worldZ : worldX;
    const distanceFromVillageEdge = Math.max(0, Math.abs(travelAxis) - BASE_VILLAGE_HALF_SIZE);
    const villageEdgeBlend = 1 - smoothstepRange(
      0,
      BASE_VILLAGE_EXIT_BLEND_DISTANCE,
      distanceFromVillageEdge,
    );
    const wildernessRoadHeight = 2.1 + Math.sin(travelAxis * 0.009) * 0.42;
    const roadHeight = lerpNumber(wildernessRoadHeight, BASE_VILLAGE_EXIT_HEIGHT, villageEdgeBlend);
    height = lerpNumber(height, roadHeight, gateRoadMask * 0.88);
  }

  const baseTransitionMask = getBaseVillageTransitionMask(worldX, worldZ);
  if (baseTransitionMask > 0) {
    height = lerpNumber(height, BASE_VILLAGE_EXIT_HEIGHT, baseTransitionMask);
  }

  const graveyardGateApproach = writeGraveyardGateApproachAtWorld(worldX, worldZ, survivalGraveyardGateApproachScratch);
  if (graveyardGateApproach.mask > 0) {
    height = lerpNumber(height, graveyardGateApproach.height, graveyardGateApproach.mask * 0.99);
  }

  const graveyardApron = writeGraveyardExteriorApronAtWorld(worldX, worldZ, survivalGraveyardExteriorApronScratch);
  if (graveyardApron.mask > 0) {
    height = lerpNumber(height, graveyardApron.height, graveyardApron.mask);
  }

  const townRouteMask = getSurvivalTownRouteMask(worldX, worldZ);
  if (townRouteMask > 0 && isStrictSurvivalDesertTerrainAtWorld(worldX, worldZ)) {
    const restoredMeadowRouteSuppression = smoothstepRange(0.001, 0.08, getSurvivalRestoredMeadowMask(worldX, worldZ));
    height -= smoothstepRange(0.72, 1, townRouteMask) * 0.06 * (1 - restoredMeadowRouteSuppression);
  }

  return height;
}

export function getSurvivalVillageBaseHeight(chunk: SurvivalChunkInfo) {
  return getSurvivalVillageBaseHeightWithResolvers(chunk, getSurvivalTerrainHeightForChunk);
}

configureSurvivalManaSourceResolvers({
  terrainHeightForChunk: getSurvivalTerrainHeightForChunk,
  villageBaseHeightForChunk: getSurvivalVillageBaseHeight,
});

const survivalVillagePadResolvers = {
  flatRadius: DESERT_VILLAGE_PAD_FLAT_RADIUS,
  terrainHeightForChunk: getSurvivalTerrainHeightForChunk,
  terrainColorAtWorld: getSurvivalSmoothedTerrainColor,
  terrainColorAtWorldInto: getSurvivalSmoothedTerrainColorInto,
};

export function getSurvivalVillagePadHeight(
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  baseHeight = getSurvivalVillageBaseHeight(chunk),
) {
  return getSurvivalVillagePadHeightWithResolvers(
    chunk,
    localX,
    localZ,
    survivalVillagePadResolvers,
    baseHeight,
  );
}

export function makeSurvivalVillagePadGeometry(chunk: SurvivalChunkInfo) {
  return makeSurvivalVillagePadGeometryWithResolvers(chunk, survivalVillagePadResolvers);
}

export function makeSurvivalVillagePadSkirtGeometry(chunk: SurvivalChunkInfo) {
  return makeSurvivalVillagePadSkirtGeometryWithResolvers(chunk, survivalVillagePadResolvers);
}
