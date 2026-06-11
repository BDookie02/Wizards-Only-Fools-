import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE, type SurvivalBiome } from "../../../../store/gameStore";
import {
  SURVIVAL_BIOME_BLEND_INNER_RADIUS,
  SURVIVAL_BIOME_BLEND_OUTER_RADIUS,
  SURVIVAL_BIOME_BLEND_POWER,
  SURVIVAL_BIOME_HEX_RADIUS,
} from "./survivalWorldConfig";
import { clamp01, hexToRgb, lerpNumber, smoothstep01, smoothstepRange, survivalHash01 } from "./survivalMath";

export const SURVIVAL_BOTW_GRASS_STRICT_DESERT_WEIGHT = 0.9;

export const survivalBiomeStyle: Record<SurvivalBiome, { ground: string; accent: string; water: string }> = {
  plains: { ground: "#477f2c", accent: "#5fa43a", water: "#2e72a8" },
  jungle: { ground: "#27652d", accent: "#124822", water: "#196d6f" },
  desert: { ground: "#d3ad62", accent: "#aa7c31", water: "#4ea7b6" },
  swamp: { ground: "#385333", accent: "#667638", water: "#245f62" },
  mushroom: { ground: "#5b477c", accent: "#c865d6", water: "#496eb6" },
  tallgrass: { ground: "#47892d", accent: "#64ad39", water: "#3a8f9e" },
};

export const survivalBiomes: SurvivalBiome[] = ["plains", "jungle", "desert", "swamp", "mushroom", "tallgrass"];

const SURVIVAL_BIOME_INDEX: Record<SurvivalBiome, number> = {
  plains: 0,
  jungle: 1,
  desert: 2,
  swamp: 3,
  mushroom: 4,
  tallgrass: 5,
};
const SURVIVAL_BIOME_COUNT = survivalBiomes.length;
const survivalTerrainColorBiomeWeights = new Array<number>(SURVIVAL_BIOME_COUNT).fill(0);
const survivalWaterLevelBiomeWeights = new Array<number>(SURVIVAL_BIOME_COUNT).fill(0);
const survivalStrictDesertBiomeWeights = new Array<number>(SURVIVAL_BIOME_COUNT).fill(0);

const SURVIVAL_RESTORED_MEADOW_CENTERS: ReadonlyArray<readonly [number, number]> = [
  [3, -3],
  [3, -4],
  [4, -3],
  [5, -3],
  [4, -4],
  [5, -4],
  [6, -3],
  [6, -4],
];

const survivalBiomeElevation: Record<SurvivalBiome, {
  base: number;
  hills: number;
  ridges: number;
  mountains: number;
  valleys: number;
  detail: number;
  waterLevel: number;
}> = {
  plains: { base: 3.2, hills: 24, ridges: 19, mountains: 38, valleys: 15, detail: 2.1, waterLevel: 1.55 },
  jungle: { base: 6.4, hills: 34, ridges: 27, mountains: 58, valleys: 20, detail: 2.9, waterLevel: 2.25 },
  desert: { base: 2.3, hills: 29, ridges: 26, mountains: 48, valleys: 13, detail: 3.15, waterLevel: 0.95 },
  swamp: { base: 0.9, hills: 15, ridges: 12, mountains: 24, valleys: 10, detail: 1.4, waterLevel: 1.05 },
  mushroom: { base: 4.8, hills: 31, ridges: 25, mountains: 52, valleys: 18, detail: 2.65, waterLevel: 1.85 },
  tallgrass: { base: 4.1, hills: 21, ridges: 15, mountains: 30, valleys: 12, detail: 1.75, waterLevel: 1.45 },
};

const survivalBiomeMountainProfile: Record<SurvivalBiome, {
  chance: number;
  radius: number;
  height: number;
}> = {
  plains: { chance: 0.42, radius: 320, height: 28 },
  jungle: { chance: 0.6, radius: 355, height: 44 },
  desert: { chance: 0.48, radius: 345, height: 36 },
  swamp: { chance: 0.26, radius: 270, height: 18 },
  mushroom: { chance: 0.54, radius: 330, height: 40 },
  tallgrass: { chance: 0.34, radius: 310, height: 24 },
};

export type BiomeWeight = {
  biome: SurvivalBiome;
  weight: number;
};

type HexCoord = {
  q: number;
  r: number;
};

const SURVIVAL_BIOME_WEIGHT_COORD_OFFSETS = (() => {
  const offsets: Array<[number, number]> = [];
  for (let dq = -2; dq <= 2; dq += 1) {
    for (let dr = -2; dr <= 2; dr += 1) {
      const distance = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
      if (distance <= 2) offsets.push([dq, dr]);
    }
  }
  return offsets;
})();

function roundAxialHex(q: number, r: number): HexCoord {
  let cubeX = q;
  let cubeZ = r;
  let cubeY = -cubeX - cubeZ;
  let roundedX = Math.round(cubeX);
  let roundedY = Math.round(cubeY);
  let roundedZ = Math.round(cubeZ);
  const xDiff = Math.abs(roundedX - cubeX);
  const yDiff = Math.abs(roundedY - cubeY);
  const zDiff = Math.abs(roundedZ - cubeZ);

  if (xDiff > yDiff && xDiff > zDiff) {
    roundedX = -roundedY - roundedZ;
  } else if (yDiff > zDiff) {
    roundedY = -roundedX - roundedZ;
  } else {
    roundedZ = -roundedX - roundedY;
  }

  return { q: roundedX, r: roundedZ };
}

function worldToBiomeHex(worldX: number, worldZ: number): HexCoord {
  const q = ((Math.sqrt(3) / 3) * worldX - worldZ / 3) / SURVIVAL_BIOME_HEX_RADIUS;
  const r = ((2 / 3) * worldZ) / SURVIVAL_BIOME_HEX_RADIUS;
  return roundAxialHex(q, r);
}

function biomeHexToWorld(q: number, r: number) {
  return {
    x: SURVIVAL_BIOME_HEX_RADIUS * Math.sqrt(3) * (q + r / 2),
    z: SURVIVAL_BIOME_HEX_RADIUS * 1.5 * r,
  };
}

function addBiomeWeight(biome: SurvivalBiome, weight: number, weights: number[]) {
  weights[SURVIVAL_BIOME_INDEX[biome]] += weight;
}

function pushBiomeWeight(target: BiomeWeight[], biome: SurvivalBiome, weight: number) {
  if (weight <= 0.0001) return;
  target.push({ biome, weight });
}

function getBiomeMountainField(biome: SurvivalBiome, worldX: number, worldZ: number) {
  const profile = survivalBiomeMountainProfile[biome];
  const biomeSeed = SURVIVAL_BIOME_INDEX[biome] + 1;
  const cellX = Math.floor(worldX / SURVIVAL_BLOCK_SIZE);
  const cellZ = Math.floor(worldZ / SURVIVAL_BLOCK_SIZE);
  let lift = 0;

  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const cx = cellX + dx;
      const cz = cellZ + dz;
      if (survivalHash01(cx, cz, 820 + biomeSeed * 11) > profile.chance) continue;

      const centerX = cx * SURVIVAL_BLOCK_SIZE + (survivalHash01(cx, cz, 821 + biomeSeed * 13) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.48;
      const centerZ = cz * SURVIVAL_BLOCK_SIZE + (survivalHash01(cx, cz, 822 + biomeSeed * 17) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.48;
      const radius = profile.radius * (0.9 + survivalHash01(cx, cz, 823 + biomeSeed * 19) * 0.28);
      const height = profile.height * (0.72 + survivalHash01(cx, cz, 824 + biomeSeed * 23) * 0.34);
      const deltaX = worldX - centerX;
      const deltaZ = worldZ - centerZ;
      const distanceSq = deltaX * deltaX + deltaZ * deltaZ;
      if (distanceSq >= radius * radius) continue;
      const distance = Math.sqrt(distanceSq);
      const raw = 1 - distance / radius;
      if (raw <= 0) continue;

      const shoulder = smoothstep01(raw);
      const summit = smoothstepRange(0.5, 1, shoulder);
      const spire = Math.pow(smoothstepRange(0.54, 0.96, raw), biome === "jungle" ? 3.0 : 3.5);
      const cliffRidges = Math.max(0, Math.sin(distance * 0.082 + survivalHash01(cx, cz, 829 + biomeSeed) * Math.PI * 2));
      const terrace = Math.floor(shoulder * 7) / 7;
      const terracedShoulder = lerpNumber(shoulder, terrace, biome === "desert" ? 0.3 : 0.17);
      const skirt = smoothstepRange(0.08, 0.46, raw) * Math.max(0, 1 - raw) * height * 0.16;
      lift +=
        (terracedShoulder * terracedShoulder * height * 0.92) +
        (summit * height * 0.26) +
        (spire * height * (biome === "jungle" ? 0.38 : 0.3)) +
        (cliffRidges * shoulder * height * 0.075) +
        skirt;
    }
  }

  return lift;
}

export function getSurvivalBiome(cx: number, cz: number): SurvivalBiome {
  if (cx === 0 && cz === 0) return "plains";
  if (cz === -3 && (cx === 3 || cx === 4 || cx === 5 || cx === 6)) return "tallgrass";
  if (cz === -4 && (cx === 4 || cx === 6)) return "desert";
  if (cz === -2 && (cx === 4 || cx === 5)) return "plains";
  return survivalBiomes[Math.floor(survivalHash01(cx, cz, 1) * survivalBiomes.length) % survivalBiomes.length];
}

export function getSurvivalBiomeWeights(worldX: number, worldZ: number): BiomeWeight[] {
  const mergedWeights = getSurvivalBiomeWeightValuesInto(worldX, worldZ, new Array<number>(SURVIVAL_BIOME_COUNT));
  const weights: BiomeWeight[] = [];
  for (let index = 0; index < SURVIVAL_BIOME_COUNT; index += 1) {
    pushBiomeWeight(weights, survivalBiomes[index], mergedWeights[index] ?? 0);
  }
  return weights;
}

export function getSurvivalBiomeWeightValuesInto(worldX: number, worldZ: number, target: number[]) {
  const center = worldToBiomeHex(worldX, worldZ);
  target.length = SURVIVAL_BIOME_COUNT;
  for (let index = 0; index < SURVIVAL_BIOME_COUNT; index += 1) {
    target[index] = 0;
  }

  const outerDistance = SURVIVAL_BIOME_HEX_RADIUS * SURVIVAL_BIOME_BLEND_OUTER_RADIUS;
  const outerDistanceSq = outerDistance * outerDistance;
  let totalWeight = 0;

  for (let index = 0; index < SURVIVAL_BIOME_WEIGHT_COORD_OFFSETS.length; index += 1) {
    const [dq, dr] = SURVIVAL_BIOME_WEIGHT_COORD_OFFSETS[index];
    const q = center.q + dq;
    const r = center.r + dr;
    const hexCenterX = SURVIVAL_BIOME_HEX_RADIUS * Math.sqrt(3) * (q + r / 2);
    const hexCenterZ = SURVIVAL_BIOME_HEX_RADIUS * 1.5 * r;
    const dx = worldX - hexCenterX;
    const dz = worldZ - hexCenterZ;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq >= outerDistanceSq) continue;

    const normalizedDistance = Math.sqrt(distanceSq) / SURVIVAL_BIOME_HEX_RADIUS;
    const falloff = 1 - smoothstepRange(
      SURVIVAL_BIOME_BLEND_INNER_RADIUS,
      SURVIVAL_BIOME_BLEND_OUTER_RADIUS,
      normalizedDistance,
    );
    const ringDistance = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
    const ringDamping = 1 / (1 + ringDistance * 0.08);
    const weight = Math.pow(Math.max(0, falloff), SURVIVAL_BIOME_BLEND_POWER) * ringDamping;
    totalWeight += weight;
    if (weight > 0.0001) {
      addBiomeWeight(getSurvivalBiome(q, r), weight, target);
    }
  }

  if (totalWeight <= 0.0001) {
    target[SURVIVAL_BIOME_INDEX[getSurvivalBiome(center.q, center.r)]] = 1;
    return target;
  }

  const invTotalWeight = 1 / totalWeight;
  for (let index = 0; index < SURVIVAL_BIOME_COUNT; index += 1) {
    target[index] *= invTotalWeight;
  }
  return target;
}

export function getBiomeTerrainHeight(biome: SurvivalBiome, worldX: number, worldZ: number) {
  const elevation = survivalBiomeElevation[biome];
  const biomeSeed = SURVIVAL_BIOME_INDEX[biome] + 1;
  const continental = Math.sin(worldX * 0.0022 + 1.7) * Math.cos(worldZ * 0.0026 - 0.9);
  const rolling = (
    Math.sin(worldX * 0.0042 + worldZ * 0.0014) +
    Math.cos(worldZ * 0.0037 - worldX * 0.0018)
  ) * 0.5;
  const broadHills = (
    Math.sin(worldX * 0.00155 + Math.sin(worldZ * 0.00072) * 1.6) +
    Math.cos(worldZ * 0.00145 - Math.sin(worldX * 0.00078) * 1.35) +
    Math.sin((worldX + worldZ) * 0.00095 + 4.2)
  ) / 3;
  const plateauNoise = (
    Math.sin(worldX * 0.00074 + worldZ * 0.00026 + 2.3) +
    Math.cos(worldZ * 0.0008 - worldX * 0.00032 - 0.4)
  ) * 0.5;
  const hillLift = smoothstepRange(-0.8, 0.72, broadHills) * elevation.hills * 0.78;
  const shoulderHills = Math.pow(
    smoothstepRange(-0.52, 0.9, rolling + broadHills * 0.58),
    1.02
  ) * elevation.hills * 0.38;
  const ridgeWave = Math.sin(worldX * 0.0068 + worldZ * 0.0047 + Math.sin(worldZ * 0.0016) * 2.1);
  const ridges = Math.pow(1 - Math.abs(ridgeWave), 1.85);
  const cliffBands = Math.pow(1 - Math.abs(Math.sin(worldX * 0.0032 - worldZ * 0.0041)), 4.4);
  const mountainNoise = (
    Math.sin(worldX * 0.00105 + 3.1) * 0.56 +
    Math.cos(worldZ * 0.00118 - 1.4) * 0.5 +
    Math.sin((worldX - worldZ) * 0.00062 + 0.7) * 0.38
  ) / 1.44;
  const mountainMask = smoothstepRange(-0.02, 0.74, mountainNoise);
  const mountainField = getBiomeMountainField(biome, worldX, worldZ);
  const valleyNoise = (
    Math.cos(worldX * 0.0037 - 0.7) * 0.52 +
    Math.sin(worldZ * 0.0032 + 2.2) * 0.48
  ) * 0.5 + 0.5;
  const valleyMask = smoothstepRange(0.58, 0.96, valleyNoise);
  const basinCut = Math.pow(smoothstepRange(0.18, 0.95, 1 - mountainNoise), 1.45) * elevation.valleys * 0.42;
  const mountainLift = Math.pow(mountainMask, 1.38) * elevation.mountains;
  const ridgeLift = ridges * elevation.ridges * (0.38 + mountainMask * 0.58);
  const cliffLift = cliffBands * elevation.ridges * smoothstepRange(0.02, 0.78, mountainMask + broadHills * 0.36) * 0.36;
  const plateauLift = smoothstepRange(0.08, 0.78, plateauNoise) * elevation.hills * (biome === "desert" ? 0.28 : 0.18);
  const detail = Math.sin(worldX * 0.024 + worldZ * 0.013) * 0.75 + Math.cos(worldZ * 0.019 - worldX * 0.012) * 0.62;
  const duneRipples = biome === "desert"
    ? Math.sin(worldX * 0.035 + worldZ * 0.011) * 1.35 + Math.sin(worldZ * 0.029) * 0.75
    : 0;
  const swampSink = biome === "swamp"
    ? smoothstepRange(0.42, 0.88, valleyNoise) * 1.7
    : 0;
  const macroSwell = (
    Math.sin(worldX * 0.00128 + Math.cos(worldZ * 0.00062) * 2.2) +
    Math.cos(worldZ * 0.00116 - Math.sin(worldX * 0.00057) * 2.4) +
    Math.sin((worldX - worldZ) * 0.00082 + biomeSeed * 1.9)
  ) / 3;
  const highlandSwell = Math.pow(smoothstepRange(-0.52, 0.82, macroSwell), 1.08) * elevation.mountains * (biome === "swamp" ? 0.34 : 0.52);
  const ravineCut = Math.pow(
    smoothstepRange(0.38, 0.94, -macroSwell + Math.sin(worldX * 0.0022 + worldZ * 0.0018) * 0.28),
    1.22
  ) * elevation.valleys * (biome === "desert" ? 0.46 : 0.58);
  const foldRidgeWave = Math.sin(worldX * 0.0034 + worldZ * 0.0058 + Math.sin(worldX * 0.0009) * 2.5);
  const foldRidges = Math.pow(1 - Math.abs(foldRidgeWave), 1.65) * elevation.ridges * (biome === "swamp" ? 0.3 : 0.52);

  return elevation.base +
    continental * elevation.hills * 0.42 +
    rolling * elevation.hills * 0.32 +
    hillLift +
    shoulderHills +
    ridgeLift +
    cliffLift +
    plateauLift +
    mountainLift -
    valleyMask * elevation.valleys * 1.28 -
    basinCut +
    highlandSwell +
    foldRidges -
    ravineCut +
    detail * elevation.detail +
    mountainField +
    duneRipples -
    swampSink;
}

export function getSurvivalWaterLevelAtWorld(worldX: number, worldZ: number) {
  const weights = getSurvivalBiomeWeightValuesInto(worldX, worldZ, survivalWaterLevelBiomeWeights);
  let waterLevel = 0;
  for (let index = 0; index < SURVIVAL_BIOME_COUNT; index += 1) {
    const weight = weights[index] ?? 0;
    if (weight <= 0) continue;
    waterLevel += survivalBiomeElevation[survivalBiomes[index]].waterLevel * weight;
  }
  return waterLevel;
}

export function getSurvivalRestoredMeadowMask(worldX: number, worldZ: number) {
  let mask = 0;
  const radialInner = SURVIVAL_BLOCK_SIZE * 0.82;
  const radialOuter = SURVIVAL_BLOCK_SIZE * 1.42;
  const radialInnerSq = radialInner * radialInner;
  const radialOuterSq = radialOuter * radialOuter;

  for (let index = 0; index < SURVIVAL_RESTORED_MEADOW_CENTERS.length; index += 1) {
    const [cx, cz] = SURVIVAL_RESTORED_MEADOW_CENTERS[index];
    const localX = worldX - cx * SURVIVAL_BLOCK_SIZE;
    const localZ = worldZ - cz * SURVIVAL_BLOCK_SIZE;
    const squareDistance = Math.max(Math.abs(localX), Math.abs(localZ));
    const radialDistanceSq = localX * localX + localZ * localZ;
    const radialDistance = radialDistanceSq <= radialInnerSq
      ? radialInner
      : radialDistanceSq >= radialOuterSq
        ? radialOuter
        : Math.sqrt(radialDistanceSq);
    const squareMask = 1 - smoothstepRange(SURVIVAL_BLOCK_SIZE * 0.64, SURVIVAL_BLOCK_SIZE * 1.24, squareDistance);
    const radialMask = 1 - smoothstepRange(SURVIVAL_BLOCK_SIZE * 0.82, SURVIVAL_BLOCK_SIZE * 1.42, radialDistance);
    mask = Math.max(mask, clamp01(squareMask * 0.72 + radialMask * 0.38));
  }

  return clamp01(mask);
}

export function isSurvivalRestoredMeadowWaterSuppressed(worldX: number, worldZ: number, radius = 0) {
  const threshold = 0.025;
  if (getSurvivalRestoredMeadowMask(worldX, worldZ) > threshold) return true;

  const sampleRadius = Math.max(0, radius);
  if (sampleRadius <= 0) return false;

  const diagonalRadius = sampleRadius * 0.72;
  return (
    getSurvivalRestoredMeadowMask(worldX + sampleRadius, worldZ) > threshold ||
    getSurvivalRestoredMeadowMask(worldX - sampleRadius, worldZ) > threshold ||
    getSurvivalRestoredMeadowMask(worldX, worldZ + sampleRadius) > threshold ||
    getSurvivalRestoredMeadowMask(worldX, worldZ - sampleRadius) > threshold ||
    getSurvivalRestoredMeadowMask(worldX + diagonalRadius, worldZ + diagonalRadius) > threshold ||
    getSurvivalRestoredMeadowMask(worldX - diagonalRadius, worldZ + diagonalRadius) > threshold ||
    getSurvivalRestoredMeadowMask(worldX + diagonalRadius, worldZ - diagonalRadius) > threshold ||
    getSurvivalRestoredMeadowMask(worldX - diagonalRadius, worldZ - diagonalRadius) > threshold
  );
}

export function getSurvivalTerrainColor(worldX: number, worldZ: number, height: number) {
  return getSurvivalTerrainColorInto(worldX, worldZ, height, new THREE.Color());
}

export function getSurvivalTerrainColorInto(worldX: number, worldZ: number, height: number, target: THREE.Color) {
  const weights = getSurvivalBiomeWeightValuesInto(worldX, worldZ, survivalTerrainColorBiomeWeights);
  let r = 0;
  let g = 0;
  let b = 0;
  let meadowWeight = 0;
  let lushMeadowWeight = 0;
  let grasslandWeight = 0;
  let desertWeight = 0;

  for (let index = 0; index < SURVIVAL_BIOME_COUNT; index += 1) {
    const weight = weights[index] ?? 0;
    if (weight <= 0) continue;
    const biome = survivalBiomes[index];
    const style = survivalBiomeStyle[biome];
    const ground = hexToRgb(style.ground);
    const accent = hexToRgb(style.accent);
    const biomeIndex = SURVIVAL_BIOME_INDEX[biome] + 1;
    const patchNoise = (
      Math.sin(worldX * (0.021 + biomeIndex * 0.002) + worldZ * 0.013 + biomeIndex * 1.7) +
      Math.cos(worldZ * (0.018 + biomeIndex * 0.0017) - worldX * 0.009)
    ) * 0.5;
    const fineNoise = Math.sin(worldX * 0.087 + worldZ * 0.061 + biomeIndex * 2.1) * 0.5 + 0.5;
    const accentMix = biome === "desert"
      ? 0.09 + smoothstepRange(-0.15, 0.85, patchNoise) * 0.05
      : biome === "jungle" || biome === "swamp"
        ? 0.14 + smoothstepRange(-0.35, 0.9, patchNoise) * 0.13
        : 0.1 + smoothstepRange(-0.25, 0.95, patchNoise) * 0.1;
    const speckle = (fineNoise - 0.5) * (biome === "desert" ? 0.012 : 0.014);
    const localR = lerpNumber(ground.r, accent.r, accentMix) + speckle;
    const localG = lerpNumber(ground.g, accent.g, accentMix) + speckle;
    const localB = lerpNumber(ground.b, accent.b, accentMix) + speckle;

    r += localR * weight;
    g += localG * weight;
    b += localB * weight;
    if (biome === "desert") {
      desertWeight += weight;
    }
    if (biome !== "desert") {
      meadowWeight += weight;
      if (biome === "tallgrass" || biome === "jungle" || biome === "mushroom") {
        lushMeadowWeight += weight;
      }
    }
    if (biome === "plains" || biome === "tallgrass" || biome === "jungle") {
      grasslandWeight += weight;
    }
  }

  const rock = hexToRgb("#7a745f");
  const peak = hexToRgb("#d6d1bc");
  const waterTint = hexToRgb("#4f7042");
  const rockMix = smoothstepRange(58, 142, height);
  const peakMix = smoothstepRange(148, 230, height);
  const lowMix = smoothstepRange(1.2, -1.5, height);
  const contour = Math.sin(height * 0.42 + worldX * 0.013 + worldZ * 0.009) * 0.004;
  const cliffStripe = Math.pow(Math.max(0, Math.sin(height * 0.58 + worldX * 0.007)), 3) * rockMix;
  const grassRows = Math.sin(worldX * 0.028 + Math.sin(worldZ * 0.012) * 2.2) * 0.002;
  const altitudeShade = lerpNumber(0.92, 1.08, smoothstepRange(-16, 92, height));
  const shade = (0.995 + Math.sin(worldX * 0.041 + worldZ * 0.029) * 0.008 + contour + grassRows) * altitudeShade;

  r = lerpNumber(r, rock.r, rockMix * 0.14);
  g = lerpNumber(g, rock.g, rockMix * 0.14);
  b = lerpNumber(b, rock.b, rockMix * 0.14);
  r = lerpNumber(r, peak.r, peakMix * 0.18);
  g = lerpNumber(g, peak.g, peakMix * 0.18);
  b = lerpNumber(b, peak.b, peakMix * 0.18);
  r = lerpNumber(r, 0.64, cliffStripe * 0.1);
  g = lerpNumber(g, 0.58, cliffStripe * 0.1);
  b = lerpNumber(b, 0.47, cliffStripe * 0.1);
  r = lerpNumber(r, waterTint.r, lowMix * 0.06);
  g = lerpNumber(g, waterTint.g, lowMix * 0.06);
  b = lerpNumber(b, waterTint.b, lowMix * 0.06);

  const meadowFiber = Math.sin(worldX * 0.092 + worldZ * 0.038) * 0.5 +
    Math.cos(worldZ * 0.084 - worldX * 0.027) * 0.5;
  const meadowSpeckle = Math.sin(worldX * 0.47 + worldZ * 0.31) * 0.5 + 0.5;
  const meadowMask = meadowWeight *
    (1 - rockMix * 0.68) *
    (1 - peakMix * 0.84) *
    (1 - lowMix * 0.04);
  const meadowTint = 0.46 + smoothstepRange(-0.34, 0.88, meadowFiber) * 0.34 + meadowSpeckle * 0.06 + lushMeadowWeight * 0.26;
  const meadowDark = hexToRgb("#3f7d28");
  const meadowLight = hexToRgb("#5ba335");
  const meadowBlend = smoothstepRange(-0.18, 0.95, meadowFiber);
  const meadowR = lerpNumber(meadowDark.r, meadowLight.r, meadowBlend);
  const meadowG = lerpNumber(meadowDark.g, meadowLight.g, meadowBlend);
  const meadowB = lerpNumber(meadowDark.b, meadowLight.b, meadowBlend);
  r = lerpNumber(r, meadowR, meadowMask * meadowTint);
  g = lerpNumber(g, meadowG, meadowMask * meadowTint);
  b = lerpNumber(b, meadowB, meadowMask * meadowTint);

  const meadowUnifier = grasslandWeight * (1 - rockMix * 0.72) * (1 - peakMix * 0.88) * 0.9;
  const meadowBase = hexToRgb("#4f9631");
  const meadowBaseShadow = hexToRgb("#3f7d28");
  const meadowBaseLift = hexToRgb("#5fa836");
  const meadowBaseFiber = Math.sin(worldX * 0.049 + worldZ * 0.033) * 0.5 +
    Math.cos(worldZ * 0.044 - worldX * 0.021) * 0.5;
  const meadowBaseBlend = smoothstepRange(-0.68, 0.88, meadowBaseFiber);
  const meadowUnifiedR = lerpNumber(lerpNumber(meadowBaseShadow.r, meadowBase.r, 0.74), meadowBaseLift.r, meadowBaseBlend * 0.18);
  const meadowUnifiedG = lerpNumber(lerpNumber(meadowBaseShadow.g, meadowBase.g, 0.74), meadowBaseLift.g, meadowBaseBlend * 0.18);
  const meadowUnifiedB = lerpNumber(lerpNumber(meadowBaseShadow.b, meadowBase.b, 0.74), meadowBaseLift.b, meadowBaseBlend * 0.18);
  r = lerpNumber(r, meadowUnifiedR, meadowUnifier);
  g = lerpNumber(g, meadowUnifiedG, meadowUnifier);
  b = lerpNumber(b, meadowUnifiedB, meadowUnifier);

  const restoredMeadowMask = getSurvivalRestoredMeadowMask(worldX, worldZ) * (1 - rockMix * 0.22) * (1 - peakMix * 0.68);
  if (restoredMeadowMask > 0.001) {
    const restoredFiber = Math.sin(worldX * 0.044 + worldZ * 0.022) * 0.26 +
      Math.cos(worldZ * 0.038 - worldX * 0.018) * 0.24;
    const restoredFine = Math.sin(worldX * 0.68 + worldZ * 0.41) * 0.5 + 0.5;
    const restoredDark = hexToRgb("#43842b");
    const restoredMid = hexToRgb("#549b31");
    const restoredLight = hexToRgb("#63aa38");
    const restoredBlend = smoothstepRange(-0.64, 1.12, restoredFiber);
    const restoredR = lerpNumber(lerpNumber(restoredDark.r, restoredMid.r, 0.58), restoredLight.r, restoredBlend * 0.24);
    const restoredG = lerpNumber(lerpNumber(restoredDark.g, restoredMid.g, 0.58), restoredLight.g, restoredBlend * 0.24);
    const restoredB = lerpNumber(lerpNumber(restoredDark.b, restoredMid.b, 0.58), restoredLight.b, restoredBlend * 0.24);
    const restoredAmount = clamp01(restoredMeadowMask * (0.52 + restoredFine * 0.04));
    r = lerpNumber(r, restoredR, restoredAmount);
    g = lerpNumber(g, restoredG, restoredAmount);
    b = lerpNumber(b, restoredB, restoredAmount);
  }

  const strictDesertTerrain = desertWeight > SURVIVAL_BOTW_GRASS_STRICT_DESERT_WEIGHT &&
    restoredMeadowMask <= 0.015 &&
    meadowWeight < 0.12 &&
    grasslandWeight < 0.1;
  const visibleRouteMask = 0;
  const routeGrassCover = smoothstepRange(0.16, 0.86, visibleRouteMask) *
    (1 - rockMix * 0.38) *
    (1 - peakMix * 0.66);
  if (routeGrassCover > 0.001) {
    const routeGrassDark = hexToRgb("#539b31");
    const routeGrassLight = hexToRgb("#62ad36");
    const routeGrassNoise = Math.sin(worldX * 0.047 + worldZ * 0.071) * 0.5 +
      Math.cos(worldZ * 0.039 - worldX * 0.022) * 0.5;
    const routeGrassBlend = smoothstepRange(-0.7, 0.95, routeGrassNoise);
    r = lerpNumber(r, lerpNumber(routeGrassDark.r, routeGrassLight.r, routeGrassBlend), routeGrassCover * 0.24);
    g = lerpNumber(g, lerpNumber(routeGrassDark.g, routeGrassLight.g, routeGrassBlend), routeGrassCover * 0.24);
    b = lerpNumber(b, lerpNumber(routeGrassDark.b, routeGrassLight.b, routeGrassBlend), routeGrassCover * 0.24);
  }
  if (!strictDesertTerrain) {
    const coverMask = clamp01(
      (1 - desertWeight) * 0.78 +
      meadowWeight * 0.58 +
      grasslandWeight * 0.92 +
      restoredMeadowMask * 1.35 +
      smoothstepRange(0.18, 0.92, visibleRouteMask) * 0.42,
    );
    const surfaceCover = smoothstepRange(0.08, 0.52, coverMask) *
      (1 - rockMix * 0.36) *
      (1 - peakMix * 0.62);
    if (surfaceCover > 0.001) {
      const coverFiber = Math.sin(worldX * 0.053 + worldZ * 0.031) * 0.5 +
        Math.cos(worldZ * 0.047 - worldX * 0.019) * 0.5;
      const restoredUndergrassMask = smoothstepRange(0.02, 0.18, restoredMeadowMask);
      const coverDark = hexToRgb(restoredUndergrassMask > 0.001 ? "#3f7d28" : "#43842b");
      const coverLight = hexToRgb(restoredUndergrassMask > 0.001 ? "#5fa836" : "#5fa836");
      const coverBlend = smoothstepRange(-0.72, 0.9, coverFiber);
      const coverAmount = surfaceCover * lerpNumber(0.82, 0.64, restoredUndergrassMask);
      r = lerpNumber(r, lerpNumber(coverDark.r, coverLight.r, coverBlend), coverAmount);
      g = lerpNumber(g, lerpNumber(coverDark.g, coverLight.g, coverBlend), coverAmount);
      b = lerpNumber(b, lerpNumber(coverDark.b, coverLight.b, coverBlend), coverAmount);
    }
  }
  const routePaintThreshold = restoredMeadowMask > 0.05 ? 0.48 : 0.22;
  const shouldPaintBareRoute = strictDesertTerrain &&
    restoredMeadowMask <= 0.015 &&
    meadowWeight < 0.18 &&
    grasslandWeight < 0.16 &&
    visibleRouteMask > 1.04;
  if (shouldPaintBareRoute && visibleRouteMask > routePaintThreshold) {
    const roadCenter = hexToRgb(restoredMeadowMask > 0.05 ? "#9b7139" : "#9b6b34");
    const roadEdge = hexToRgb(restoredMeadowMask > 0.05 ? "#4f842e" : "#5f7d3d");
    const roadBlend = smoothstepRange(0.66, 0.98, visibleRouteMask);
    const roadCore = smoothstepRange(0.78, 0.98, visibleRouteMask);
    const roadShoulder = smoothstepRange(0.28, 0.72, visibleRouteMask) * (1 - roadCore);
    const roadAmount = (
      roadCore * lerpNumber(0.82, 0.74, restoredMeadowMask) +
      roadShoulder * lerpNumber(0.12, 0.025, restoredMeadowMask)
    ) * lerpNumber(1, 0.86, restoredMeadowMask);
    const roadR = lerpNumber(roadEdge.r, roadCenter.r, roadBlend);
    const roadG = lerpNumber(roadEdge.g, roadCenter.g, roadBlend);
    const roadB = lerpNumber(roadEdge.b, roadCenter.b, roadBlend);
    r = lerpNumber(r, roadR, roadAmount);
    g = lerpNumber(g, roadG, roadAmount);
    b = lerpNumber(b, roadB, roadAmount);
  }

  const restoredSurfaceSmooth = smoothstepRange(0.001, 0.08, restoredMeadowMask);
  if (restoredSurfaceSmooth > 0.001) {
    const meadowGround = hexToRgb("#4f9631");
    const fineVariation =
      Math.sin(worldX * 0.31 + worldZ * 0.19) * 0.012 +
      Math.cos(worldZ * 0.53 - worldX * 0.17) * 0.008;
    const restoredSurfaceAmount = restoredSurfaceSmooth * 0.34;
    r = lerpNumber(r, meadowGround.r + fineVariation * 0.48, restoredSurfaceAmount);
    g = lerpNumber(g, meadowGround.g + fineVariation * 0.42, restoredSurfaceAmount);
    b = lerpNumber(b, meadowGround.b + fineVariation * 0.34, restoredSurfaceAmount);
  }

  const finalShade = restoredSurfaceSmooth > 0.001
    ? lerpNumber(shade, 0.92, restoredSurfaceSmooth * 0.84)
    : shade;
  return target.setRGB(clamp01(r * finalShade), clamp01(g * finalShade), clamp01(b * finalShade));
}

export function isSurvivalGrasslandTerrainBiome(biome: SurvivalBiome) {
  return biome === "plains" || biome === "tallgrass" || biome === "jungle";
}

export function isStrictSurvivalDesertTerrainAtWorld(worldX: number, worldZ: number) {
  if (getSurvivalRestoredMeadowMask(worldX, worldZ) > 0.015) return false;

  let desertWeight = 0;
  let meadowWeight = 0;
  let grasslandWeight = 0;
  const weights = getSurvivalBiomeWeightValuesInto(worldX, worldZ, survivalStrictDesertBiomeWeights);
  for (let index = 0; index < SURVIVAL_BIOME_COUNT; index += 1) {
    const weight = weights[index] ?? 0;
    if (weight <= 0) continue;
    const biome = survivalBiomes[index];
    if (biome === "desert") {
      desertWeight += weight;
      continue;
    }

    meadowWeight += weight;
    if (biome === "plains" || biome === "tallgrass" || biome === "jungle") {
      grasslandWeight += weight;
    }
  }

  return desertWeight > SURVIVAL_BOTW_GRASS_STRICT_DESERT_WEIGHT &&
    meadowWeight < 0.12 &&
    grasslandWeight < 0.1;
}
