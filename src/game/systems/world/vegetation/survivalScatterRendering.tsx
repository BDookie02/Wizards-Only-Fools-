import { lazy, Suspense, useMemo } from "react";
import type { Vector3 } from "three";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import { isMobilePerformanceMode } from "../../input/performanceMode";
import { useSurvivalFeatureCount } from "../../../tools/qa/survivalFeatureCounters";
import { isSurvivalGrassInspectionView } from "../../../tools/qa/survivalGrassDebug";
import { isSurvivalRestoredMeadowWaterSuppressed } from "../survival/survivalBiome";
import { useChunkTreeLoadStage } from "../survival/survivalLoadStage";
import { survivalHash01 } from "../survival/survivalMath";
import { BASE_VILLAGE_HALF_SIZE, type SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import {
  DesertCactus,
  DesertTumbleweed,
  SurvivalBiomeTree,
  type SurvivalDetailScatterProp,
} from "./survivalDetailScatterRendering";
import {
  SURVIVAL_BOTW_DECORATION_MAX_FOOTPRINT_RANGE,
  SURVIVAL_BOTW_DECORATION_MIN_NORMAL_Y,
} from "./survivalBotwGrassConfig";
import { SurvivalAmbientInsects } from "./survivalAmbientInsectRendering";
import { SurvivalBirdFlock } from "./survivalAmbientBirdRendering";
import { SurvivalRockOutcrops } from "./survivalRockOutcropRendering";
import {
  SurvivalBushClusters,
  SurvivalFernClusters,
} from "./survivalUnderbrushRendering";
import { SurvivalSolidTreeGroves } from "./survivalSolidTreeGroveRendering";

const SURVIVAL_LEGACY_GRASS_SYSTEM_ENABLED = false;

const LazyDesertLandmarks = lazy(() => import("../survival/survivalDesertLandmarkRendering").then((module) => ({ default: module.DesertLandmarks })));
const LazySurvivalHobbitHuts = lazy(() => import("../villages/survivalHobbitHutRendering").then((module) => ({ default: module.SurvivalHobbitHuts })));
const LazySurvivalWildflowers = lazy(() => import("./survivalWildflowerRendering").then((module) => ({ default: module.SurvivalWildflowers })));

export type SurvivalScatterSurfaceQuality = {
  y: number;
  heightRange: number;
  normal: Vector3;
};

export type SurvivalScatterSurfaceResolver = (
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  footprintRadius: number,
  sampleDistance: number,
) => SurvivalScatterSurfaceQuality;

export type SurvivalScatterTerrainHeightResolver = (
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
) => number;

export type SurvivalScatterWaterLevelResolver = (worldX: number, worldZ: number) => number;

export function SurvivalScatterProps({
  chunk,
  grassSystemEnabled,
  getSurfaceQuality,
  terrainHeightForChunk,
  getWaterLevelAtWorld,
}: {
  chunk: SurvivalChunkInfo;
  grassSystemEnabled: boolean;
  getSurfaceQuality: SurvivalScatterSurfaceResolver;
  terrainHeightForChunk: SurvivalScatterTerrainHeightResolver;
  getWaterLevelAtWorld: SurvivalScatterWaterLevelResolver;
}) {
  const treeLoadStage = useChunkTreeLoadStage(chunk);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const grassInspectionView = useMemo(() => isSurvivalGrassInspectionView(), []);
  const showBushes = treeLoadStage >= 2 && !grassInspectionView;
  const showSolidTrees = treeLoadStage >= 3 && !grassInspectionView;
  const showDenseSolidTrees = treeLoadStage >= 4 && !grassInspectionView;
  const showDetailTrees = treeLoadStage >= 5 && chunk.distance === 0 && !mobilePerformanceMode && !grassInspectionView;
  const showAmbientLife = treeLoadStage >= 1 && !grassInspectionView;
  const localGrassOwnsMeadowDetail =
    grassSystemEnabled &&
    chunk.biome !== "desert" &&
    (
      chunk.biome === "tallgrass" ||
      isSurvivalRestoredMeadowWaterSuppressed(chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.58)
    );
  const showRockOutcrops = treeLoadStage >= 1 && !localGrassOwnsMeadowDetail;
  const showLandmarks = treeLoadStage >= 2;
  const showChunkWildflowers = showAmbientLife && !grassSystemEnabled && !localGrassOwnsMeadowDetail;
  const showAmbientInsects = showAmbientLife && !grassInspectionView && chunk.distance === 0 && !chunk.hasVillage;
  const showFernClusters = showBushes && !localGrassOwnsMeadowDetail;
  const showBushClusters = showBushes && !localGrassOwnsMeadowDetail;
  const showBirds = showAmbientLife && !grassInspectionView && chunk.distance === 0 && !chunk.hasVillage;
  const props = useMemo(() => {
    if (!showDetailTrees) return [];
    if (chunk.lod === "far") return [];
    const densityMultiplier = chunk.lod === "mid" ? 0.3 : 1;
    const baseCount = chunk.biome === "desert"
      ? 9
      : chunk.biome === "jungle"
        ? 5
        : chunk.biome === "swamp"
          ? 4
          : chunk.biome === "mushroom"
            ? 3
            : 4;
    const count = Math.max(chunk.lod === "mid" ? 1 : 3, Math.round(baseCount * densityMultiplier));
    const generated: SurvivalDetailScatterProp[] = [];
    const attempts = count * 8;

    for (let index = 0; index < attempts && generated.length < count; index += 1) {
      const localX = (survivalHash01(chunk.cx, chunk.cz, 20 + index) - 0.5) * (SURVIVAL_BLOCK_SIZE * 0.78);
      const localZ = (survivalHash01(chunk.cx, chunk.cz, 60 + index) - 0.5) * (SURVIVAL_BLOCK_SIZE * 0.78);
      if (chunk.hasVillage && Math.max(Math.abs(localX), Math.abs(localZ)) < BASE_VILLAGE_HALF_SIZE + 28) continue;
      if (chunk.biome !== "desert" && Math.min(Math.abs(localX), Math.abs(localZ)) < 34) continue;

      const worldX = chunk.x + localX;
      const worldZ = chunk.z + localZ;
      const surfaceQuality = getSurfaceQuality(chunk, localX, localZ, 8.8, 5.2);
      if (
        surfaceQuality.normal.y < SURVIVAL_BOTW_DECORATION_MIN_NORMAL_Y ||
        surfaceQuality.heightRange > SURVIVAL_BOTW_DECORATION_MAX_FOOTPRINT_RANGE
      ) continue;
      const y = surfaceQuality.y;
      const waterY = getWaterLevelAtWorld(worldX, worldZ);
      if (y < waterY + 0.18) continue;

      const scale = 1.35 + survivalHash01(chunk.cx, chunk.cz, 90 + index) * (
        chunk.biome === "jungle" ? 2.95 : chunk.biome === "swamp" ? 2.45 : 2.1
      );
      const variant = survivalHash01(chunk.cx, chunk.cz, 120 + index);
      if (chunk.biome !== "desert") {
        const minSpacing = chunk.biome === "jungle"
          ? 118
          : chunk.biome === "swamp"
            ? 96
            : chunk.biome === "mushroom"
              ? 82
              : 88;
        const minSpacingSq = minSpacing * minSpacing;
        let tooClose = false;
        for (let propIndex = 0; propIndex < generated.length; propIndex += 1) {
          const prop = generated[propIndex];
          const deltaX = prop.localX - localX;
          const deltaZ = prop.localZ - localZ;
          if (deltaX * deltaX + deltaZ * deltaZ < minSpacingSq) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;
      }
      generated.push({ localX, localZ, scale, y, variant, key: `${chunk.key}-prop-${index}` });
    }

    return generated;
  }, [chunk, getSurfaceQuality, getWaterLevelAtWorld, showDetailTrees]) satisfies SurvivalDetailScatterProp[];

  useSurvivalFeatureCount("detailScatterProps", `survival-detail-scatter-${chunk.key}`, props.length);

  return (
    <>
      {showSolidTrees && <SurvivalSolidTreeGroves chunk={chunk} dense={showDenseSolidTrees} getSurfaceQuality={getSurfaceQuality} />}
      {showDetailTrees && (
        <Suspense fallback={null}>
          <LazySurvivalHobbitHuts
            chunk={chunk}
            getSurfaceQuality={getSurfaceQuality}
            terrainHeightForChunk={terrainHeightForChunk}
            getWaterLevelAtWorld={getWaterLevelAtWorld}
          />
        </Suspense>
      )}
      {showChunkWildflowers && (
        <Suspense fallback={null}>
          <LazySurvivalWildflowers
            chunk={chunk}
            enabled={SURVIVAL_LEGACY_GRASS_SYSTEM_ENABLED}
            getSurfaceQuality={getSurfaceQuality}
          />
        </Suspense>
      )}
      {showAmbientInsects && <SurvivalAmbientInsects chunk={chunk} getTerrainHeightForChunk={terrainHeightForChunk} />}
      {showFernClusters && <SurvivalFernClusters chunk={chunk} getSurfaceQuality={getSurfaceQuality} />}
      {showBushClusters && <SurvivalBushClusters chunk={chunk} getSurfaceQuality={getSurfaceQuality} />}
      {showRockOutcrops && <SurvivalRockOutcrops chunk={chunk} getSurfaceQuality={getSurfaceQuality} />}
      {showLandmarks && (
        <Suspense fallback={null}>
          <LazyDesertLandmarks
            chunk={chunk}
            terrainHeightForChunk={terrainHeightForChunk}
            getWaterLevelAtWorld={getWaterLevelAtWorld}
          />
        </Suspense>
      )}
      {showBirds && <SurvivalBirdFlock chunk={chunk} />}
      {props.map((prop) => {
        if (chunk.biome === "desert") {
          if (prop.variant > 0.56) {
            return (
              <DesertTumbleweed
                key={prop.key}
                x={chunk.x + prop.localX}
                y={prop.y}
                z={chunk.z + prop.localZ}
                scale={prop.scale}
                seed={prop.variant}
              />
            );
          }

          return (
            <DesertCactus
              key={prop.key}
              x={chunk.x + prop.localX}
              y={prop.y}
              z={chunk.z + prop.localZ}
              scale={prop.scale}
              variant={prop.variant}
            />
          );
        }

        return (
          <SurvivalBiomeTree
            key={prop.key}
            biome={chunk.biome}
            prop={prop}
            worldX={chunk.x + prop.localX}
            worldZ={chunk.z + prop.localZ}
          />
        );
      })}
    </>
  );
}
