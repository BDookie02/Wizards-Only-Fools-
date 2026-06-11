import type { SurvivalBiome } from "../../../../store/gameStore";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { survivalHash01 } from "../survival/survivalMath";

export type SurvivalAmbientBirdSpecies = {
  name: string;
  body: string;
  wing: string;
  accent: string;
  wingLength: number;
  bodyLength: number;
  baseScale: number;
};

export type SurvivalAmbientBird = {
  key: string;
  species: SurvivalAmbientBirdSpecies;
  x: number;
  y: number;
  z: number;
  scale: number;
  tilt: number;
  wingPhase: number;
};

export type SurvivalAmbientBirdFlock = {
  seed: number;
  baseY: number;
  birds: SurvivalAmbientBird[];
};

const DESERT_AMBIENT_BIRD_SPECIES: SurvivalAmbientBirdSpecies[] = [
  { name: "vulture", body: "#d6bf8a", wing: "#ead6a3", accent: "#fff1b8", wingLength: 3.4, bodyLength: 2.3, baseScale: 0.94 },
  { name: "hawk", body: "#e7c98e", wing: "#f0dda8", accent: "#fff3bf", wingLength: 2.7, bodyLength: 1.8, baseScale: 0.84 },
];

const JUNGLE_AMBIENT_BIRD_SPECIES: SurvivalAmbientBirdSpecies[] = [
  { name: "parrot", body: "#86efac", wing: "#bbf7d0", accent: "#fca5a5", wingLength: 2.2, bodyLength: 1.55, baseScale: 0.78 },
  { name: "toucan", body: "#fef3c7", wing: "#bae6fd", accent: "#fde68a", wingLength: 2.5, bodyLength: 1.75, baseScale: 0.84 },
  { name: "macaw", body: "#93c5fd", wing: "#fca5a5", accent: "#fef08a", wingLength: 2.4, bodyLength: 1.7, baseScale: 0.8 },
];

const SWAMP_AMBIENT_BIRD_SPECIES: SurvivalAmbientBirdSpecies[] = [
  { name: "heron", body: "#f1f5f9", wing: "#cbd5e1", accent: "#fef3c7", wingLength: 3.05, bodyLength: 2, baseScale: 0.9 },
  { name: "marshbird", body: "#ddd6fe", wing: "#bfdbfe", accent: "#fef08a", wingLength: 2.35, bodyLength: 1.65, baseScale: 0.78 },
];

const MUSHROOM_AMBIENT_BIRD_SPECIES: SurvivalAmbientBirdSpecies[] = [
  { name: "moth", body: "#f5d0fe", wing: "#e9d5ff", accent: "#fef3c7", wingLength: 3.15, bodyLength: 1.35, baseScale: 0.74 },
  { name: "owl", body: "#e6c8a2", wing: "#f0d9b2", accent: "#fde68a", wingLength: 2.25, bodyLength: 1.7, baseScale: 0.8 },
];

const DEFAULT_AMBIENT_BIRD_SPECIES: SurvivalAmbientBirdSpecies[] = [
  { name: "swallow", body: "#eff6ff", wing: "#bfdbfe", accent: "#fff7d6", wingLength: 2.2, bodyLength: 1.45, baseScale: 0.72 },
  { name: "bluebird", body: "#bfdbfe", wing: "#93c5fd", accent: "#fef08a", wingLength: 2.05, bodyLength: 1.4, baseScale: 0.68 },
];

function getSurvivalAmbientBirdSpecies(biome: SurvivalBiome) {
  if (biome === "desert") {
    return DESERT_AMBIENT_BIRD_SPECIES;
  }
  if (biome === "jungle") {
    return JUNGLE_AMBIENT_BIRD_SPECIES;
  }
  if (biome === "swamp") {
    return SWAMP_AMBIENT_BIRD_SPECIES;
  }
  if (biome === "mushroom") {
    return MUSHROOM_AMBIENT_BIRD_SPECIES;
  }
  return DEFAULT_AMBIENT_BIRD_SPECIES;
}

function getSurvivalAmbientBirdBaseCount(biome: SurvivalBiome) {
  return biome === "jungle"
    ? 14
    : biome === "desert"
      ? 12
      : biome === "mushroom"
        ? 12
        : biome === "swamp"
          ? 11
          : 12;
}

function getSurvivalAmbientBirdFlockBaseY(biome: SurvivalBiome) {
  return biome === "jungle"
    ? 192
    : biome === "swamp"
      ? 168
      : biome === "desert"
        ? 176
        : 166;
}

export function makeSurvivalAmbientBirdFlock(chunk: SurvivalChunkInfo): SurvivalAmbientBirdFlock {
  const seed = survivalHash01(chunk.cx, chunk.cz, 410);
  const speciesList = getSurvivalAmbientBirdSpecies(chunk.biome);
  const baseBirdCount = getSurvivalAmbientBirdBaseCount(chunk.biome);
  const birdCount = Math.max(3, Math.round(baseBirdCount * (chunk.distance === 0 ? 0.72 : chunk.distance === 1 ? 0.38 : 0.22)));
  const baseY = getSurvivalAmbientBirdFlockBaseY(chunk.biome);
  const birds: SurvivalAmbientBird[] = [];

  for (let index = 0; index < birdCount; index += 1) {
    const angle = (Math.PI * 2 * index) / birdCount + seed * Math.PI;
    const radius = 170 + survivalHash01(chunk.cx, chunk.cz, 430 + index) * 190;
    const species = speciesList[Math.floor(survivalHash01(chunk.cx, chunk.cz, 412 + index) * speciesList.length) % speciesList.length];
    birds.push({
      key: `${chunk.key}-bird-${index}`,
      species,
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      y: 28 + survivalHash01(chunk.cx, chunk.cz, 450 + index) * (chunk.biome === "jungle" ? 84 : 62),
      scale: (species.baseScale + survivalHash01(chunk.cx, chunk.cz, 470 + index) * 0.34) * 0.88,
      tilt: survivalHash01(chunk.cx, chunk.cz, 490 + index) - 0.5,
      wingPhase: survivalHash01(chunk.cx, chunk.cz, 492 + index) * Math.PI * 2,
    });
  }

  return { seed, baseY, birds };
}
