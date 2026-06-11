import * as THREE from "three";
import {
  createSurvivalDayNightCycle,
  getEffectiveSurvivalCycleElapsedSeconds,
  getSurvivalDayNightCycleInto,
} from "../../rendering/sky/survivalSkyCycleMath";

const terrainDayTint = new THREE.Color("#ffffff");
const terrainNightTint = new THREE.Color("#3f4f45");
const terrainDuskTint = new THREE.Color("#c4ae72");
const cachedTint = new THREE.Color("#ffffff");
const cachedCycle = createSurvivalDayNightCycle();
const registeredTerrainTintMaterials = new Set<THREE.MeshBasicMaterial>();

let cachedElapsedSeconds = Number.NaN;
let cachedSurvivalTimeOverrideSeconds: number | null | undefined;
let cachedQaSurvivalTimeOverrideSeconds: number | null | undefined;

export function getSurvivalTerrainTintInto(
  target: THREE.Color,
  elapsedSeconds: number,
  survivalTimeOverrideSeconds: number | null | undefined,
  qaSurvivalTimeOverrideSeconds: number | null | undefined,
) {
  if (
    elapsedSeconds !== cachedElapsedSeconds ||
    survivalTimeOverrideSeconds !== cachedSurvivalTimeOverrideSeconds ||
    qaSurvivalTimeOverrideSeconds !== cachedQaSurvivalTimeOverrideSeconds
  ) {
    cachedElapsedSeconds = elapsedSeconds;
    cachedSurvivalTimeOverrideSeconds = survivalTimeOverrideSeconds;
    cachedQaSurvivalTimeOverrideSeconds = qaSurvivalTimeOverrideSeconds;

    const cycle = getSurvivalDayNightCycleInto(
      getEffectiveSurvivalCycleElapsedSeconds(
        survivalTimeOverrideSeconds,
        elapsedSeconds,
        qaSurvivalTimeOverrideSeconds,
      ),
      cachedCycle,
    );
    cachedTint
      .copy(terrainNightTint)
      .lerp(terrainDayTint, cycle.dayAmount)
      .lerp(terrainDuskTint, cycle.duskAmount * 0.16);
  }

  return target.copy(cachedTint);
}

export function registerSurvivalTerrainTintMaterial(material: THREE.MeshBasicMaterial) {
  registeredTerrainTintMaterials.add(material);
  material.color.copy(cachedTint);
  return () => {
    registeredTerrainTintMaterials.delete(material);
  };
}

export function applySurvivalTerrainTintToRegisteredMaterials(
  elapsedSeconds: number,
  survivalTimeOverrideSeconds: number | null | undefined,
  qaSurvivalTimeOverrideSeconds: number | null | undefined,
) {
  getSurvivalTerrainTintInto(
    cachedTint,
    elapsedSeconds,
    survivalTimeOverrideSeconds,
    qaSurvivalTimeOverrideSeconds,
  );

  for (const material of registeredTerrainTintMaterials) {
    material.color.copy(cachedTint);
  }

  return registeredTerrainTintMaterials.size;
}
