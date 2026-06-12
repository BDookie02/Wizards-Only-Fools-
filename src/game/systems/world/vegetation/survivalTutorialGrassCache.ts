import * as THREE from "three";
import { mergeSurvivalGrassGeometries } from "./survivalGrassGeometryMerge";
import { makeSurvivalTutorialGrassBladeGeometry } from "./survivalTutorialGrassBladeGeometry";
import { makeSurvivalTutorialGrassCarpetGeometry } from "./survivalTutorialGrassCarpetGeometry";
import { makeSurvivalTutorialGrassFlowerInstances, type SurvivalTutorialGrassFlowerInstance } from "./survivalTutorialGrassFlowers";
import { makeSurvivalTutorialGrassStrandGeometry } from "./survivalTutorialGrassStrandGeometry";
import { makeSurvivalTutorialGrassTuftInstances, type SurvivalTutorialGrassTuftInstance } from "./survivalTutorialGrassTufts";
import type { SurvivalTutorialGrassCell } from "./survivalTutorialGrassStreaming";

const SURVIVAL_TUTORIAL_GRASS_CELL_GEOMETRY_CACHE_LIMIT = 900;
const survivalTutorialGrassBladeGeometryCache = new Map<string, THREE.BufferGeometry | null>();
const survivalTutorialGrassCarpetGeometryCache = new Map<string, THREE.BufferGeometry | null>();
const survivalTutorialGrassStrandGeometryCache = new Map<string, THREE.BufferGeometry | null>();

function trimSurvivalTutorialGrassGeometryCache(cache: Map<string, THREE.BufferGeometry | null>) {
  while (cache.size > SURVIVAL_TUTORIAL_GRASS_CELL_GEOMETRY_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) return;
    const geometry = cache.get(oldestKey);
    cache.delete(oldestKey);
    geometry?.dispose();
  }
}

export function getCachedSurvivalTutorialGrassBladeGeometry(cell: SurvivalTutorialGrassCell) {
  const densityBand = Math.round(cell.densityDistance / 8);
  const cacheKey = `${cell.key}:${cell.lod}:tutorial-blades:${densityBand}`;
  if (survivalTutorialGrassBladeGeometryCache.has(cacheKey)) {
    return survivalTutorialGrassBladeGeometryCache.get(cacheKey) ?? null;
  }

  const geometry = makeSurvivalTutorialGrassBladeGeometry({
    ...cell,
    densityDistance: densityBand * 8,
  });
  survivalTutorialGrassBladeGeometryCache.set(cacheKey, geometry);
  trimSurvivalTutorialGrassGeometryCache(survivalTutorialGrassBladeGeometryCache);
  return geometry;
}

export function getCachedSurvivalTutorialGrassCarpetGeometry(cell: SurvivalTutorialGrassCell) {
  const cacheKey = `${cell.key}:${cell.lod}:carpet`;
  if (survivalTutorialGrassCarpetGeometryCache.has(cacheKey)) {
    return survivalTutorialGrassCarpetGeometryCache.get(cacheKey) ?? null;
  }

  const geometry = makeSurvivalTutorialGrassCarpetGeometry(cell);
  survivalTutorialGrassCarpetGeometryCache.set(cacheKey, geometry);
  trimSurvivalTutorialGrassGeometryCache(survivalTutorialGrassCarpetGeometryCache);
  return geometry;
}

export function getCachedSurvivalTutorialGrassStrandGeometry(cell: SurvivalTutorialGrassCell) {
  const densityBand = Math.round(cell.densityDistance / 8);
  const cacheKey = `${cell.key}:${cell.lod}:strand:${densityBand}`;
  if (survivalTutorialGrassStrandGeometryCache.has(cacheKey)) {
    return survivalTutorialGrassStrandGeometryCache.get(cacheKey) ?? null;
  }

  const geometry = makeSurvivalTutorialGrassStrandGeometry({
    ...cell,
    densityDistance: densityBand * 8,
  });
  survivalTutorialGrassStrandGeometryCache.set(cacheKey, geometry);
  trimSurvivalTutorialGrassGeometryCache(survivalTutorialGrassStrandGeometryCache);
  return geometry;
}

const SURVIVAL_TUTORIAL_GRASS_INSTANCE_CACHE_LIMIT = 900;
const survivalTutorialGrassTuftInstanceCache = new Map<string, SurvivalTutorialGrassTuftInstance[]>();
const survivalTutorialGrassFlowerInstanceCache = new Map<string, SurvivalTutorialGrassFlowerInstance[]>();

function trimSurvivalTutorialGrassInstanceCache<T>(cache: Map<string, T[]>) {
  while (cache.size > SURVIVAL_TUTORIAL_GRASS_INSTANCE_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) return;
    cache.delete(oldestKey);
  }
}

export function getCachedSurvivalTutorialGrassTuftInstances(cell: SurvivalTutorialGrassCell) {
  const densityBand = Math.round(cell.densityDistance / 8);
  const cacheKey = `${cell.key}:${cell.lod}:tufts:${densityBand}`;
  const cached = survivalTutorialGrassTuftInstanceCache.get(cacheKey);
  if (cached) return cached;

  const instances = makeSurvivalTutorialGrassTuftInstances({
    ...cell,
    densityDistance: densityBand * 8,
  });
  survivalTutorialGrassTuftInstanceCache.set(cacheKey, instances);
  trimSurvivalTutorialGrassInstanceCache(survivalTutorialGrassTuftInstanceCache);
  return instances;
}

export function getCachedSurvivalTutorialGrassFlowerInstances(
  cell: SurvivalTutorialGrassCell,
  mobilePerformanceMode: boolean,
) {
  const densityBand = Math.round(cell.densityDistance / 8);
  const cacheKey = `${cell.key}:${cell.lod}:flowers:${densityBand}:${mobilePerformanceMode ? "m" : "d"}`;
  const cached = survivalTutorialGrassFlowerInstanceCache.get(cacheKey);
  if (cached) return cached;

  const instances = makeSurvivalTutorialGrassFlowerInstances({
    ...cell,
    densityDistance: densityBand * 8,
  }, mobilePerformanceMode);
  survivalTutorialGrassFlowerInstanceCache.set(cacheKey, instances);
  trimSurvivalTutorialGrassInstanceCache(survivalTutorialGrassFlowerInstanceCache);
  return instances;
}

export function getSurvivalTutorialGrassBatchBladeGeometries(cells: SurvivalTutorialGrassCell[]) {
  const geometries = new Array<THREE.BufferGeometry | null>(cells.length);
  for (let index = 0; index < cells.length; index += 1) {
    geometries[index] = getCachedSurvivalTutorialGrassBladeGeometry(cells[index]);
  }
  return geometries;
}

export function getSurvivalTutorialGrassBatchBladeGeometry(cells: SurvivalTutorialGrassCell[]) {
  return mergeSurvivalGrassGeometries(getSurvivalTutorialGrassBatchBladeGeometries(cells), true);
}

export function getSurvivalTutorialGrassBatchFlowerInstances(
  cells: SurvivalTutorialGrassCell[],
  mobilePerformanceMode: boolean,
) {
  const flowers: SurvivalTutorialGrassFlowerInstance[] = [];
  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    const cellFlowers = getCachedSurvivalTutorialGrassFlowerInstances(cells[cellIndex], mobilePerformanceMode);
    for (let flowerIndex = 0; flowerIndex < cellFlowers.length; flowerIndex += 1) {
      flowers.push(cellFlowers[flowerIndex]);
    }
  }
  return flowers;
}
