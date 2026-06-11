import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import { isMobilePerformanceMode } from "../../input/performanceMode";
import { useSurvivalFeatureCount } from "../../../tools/qa/survivalFeatureCounters";
import { getSurvivalWaterLevelAtWorld } from "../survival/survivalBiome";
import { survivalHash01 } from "../survival/survivalMath";
import { BASE_VILLAGE_HALF_SIZE, type SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import {
  SURVIVAL_BOTW_DECORATION_MAX_FOOTPRINT_RANGE,
  SURVIVAL_BOTW_DECORATION_MIN_NORMAL_Y,
} from "./survivalBotwGrassConfig";
import { HIDE_FROM_MINIMAP } from "./SurvivalFoliagePrimitives";
import { finalizeSurvivalInstancedMesh } from "./survivalInstancing";
import {
  SURVIVAL_SOLID_TREE_VARIANT_COUNT,
  getFastGroveTreeProfile,
  getSurvivalSolidTreeTexture,
  makeSurvivalSolidTreeGeometry,
} from "./survivalTreeVisuals";

export type SurvivalSolidTreeSurfaceQuality = {
  y: number;
  heightRange: number;
  normal: { y: number };
};

export type SurvivalSolidTreeSurfaceResolver = (
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  footprintRadius: number,
  sampleDistance: number,
) => SurvivalSolidTreeSurfaceQuality;

type SurvivalSolidGroveTree = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  trunkHeight: number;
  canopyRadius: number;
  colorIndex: number;
  variant: number;
};

export function SurvivalSolidTreeGroves({
  chunk,
  dense = false,
  getSurfaceQuality,
}: {
  chunk: SurvivalChunkInfo;
  dense?: boolean;
  getSurfaceQuality: SurvivalSolidTreeSurfaceResolver;
}) {
  const treeRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geometries = useMemo(() => {
    const nextGeometries: THREE.BufferGeometry[] = [];
    for (let index = 0; index < SURVIVAL_SOLID_TREE_VARIANT_COUNT; index += 1) {
      nextGeometries.push(makeSurvivalSolidTreeGeometry(chunk.biome, index));
    }
    return nextGeometries;
  }, [chunk.biome]);
  const texture = useMemo(() => getSurvivalSolidTreeTexture(), []);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const trees = useMemo<SurvivalSolidGroveTree[]>(() => {
    if (chunk.lod === "far") return [];
    const isMidDistanceLod = chunk.lod === "mid";

    const density = (isMidDistanceLod ? 0.055 : dense ? 0.92 : 0.62) * (mobilePerformanceMode ? 0.54 : 1);
    const baseCount = chunk.biome === "jungle"
      ? 44
      : chunk.biome === "swamp"
        ? 38
        : chunk.biome === "mushroom"
          ? 34
          : chunk.biome === "desert"
            ? 22
            : 36;
    const count = Math.max(isMidDistanceLod ? 1 : 8, Math.round(baseCount * density));
    const generated: SurvivalSolidGroveTree[] = [];
    const attempts = count * 12;
    const footprintRadius = isMidDistanceLod ? 11.5 : 8.5;
    const sampleDistance = isMidDistanceLod ? 7.2 : 5.2;
    const minNormalY = isMidDistanceLod ? 0.86 : SURVIVAL_BOTW_DECORATION_MIN_NORMAL_Y;
    const maxHeightRange = isMidDistanceLod ? 3.2 : SURVIVAL_BOTW_DECORATION_MAX_FOOTPRINT_RANGE;
    const midDistanceTreeScale = isMidDistanceLod ? 0.58 : 1;

    for (let index = 0; index < attempts && generated.length < count; index += 1) {
      const localX = (survivalHash01(chunk.cx, chunk.cz, 2310 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.94;
      const localZ = (survivalHash01(chunk.cx, chunk.cz, 2350 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.94;
      if (chunk.hasVillage && Math.max(Math.abs(localX), Math.abs(localZ)) < BASE_VILLAGE_HALF_SIZE + 40) continue;
      if (chunk.biome !== "desert" && Math.min(Math.abs(localX), Math.abs(localZ)) < 22) continue;

      const worldX = chunk.x + localX;
      const worldZ = chunk.z + localZ;
      const surfaceQuality = getSurfaceQuality(chunk, localX, localZ, footprintRadius, sampleDistance);
      if (
        surfaceQuality.normal.y < minNormalY ||
        surfaceQuality.heightRange > maxHeightRange
      ) continue;
      const y = surfaceQuality.y;
      const waterY = getSurvivalWaterLevelAtWorld(worldX, worldZ);
      if (y < waterY + 0.2) continue;

      const baseSpacing = chunk.biome === "jungle"
        ? 22
        : chunk.biome === "swamp"
          ? 20
          : chunk.biome === "desert"
            ? 28
            : 23;
      const spacing = isMidDistanceLod ? baseSpacing * 2.35 : baseSpacing;
      const spacingSquared = spacing * spacing;
      let tooClose = false;
      for (let treeIndex = 0; treeIndex < generated.length; treeIndex += 1) {
        const tree = generated[treeIndex];
        const dx = tree.x - localX;
        const dz = tree.z - localZ;
        if (dx * dx + dz * dz < spacingSquared) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      const variant = survivalHash01(chunk.cx, chunk.cz, 2390 + index);
      const profile = getFastGroveTreeProfile(chunk.biome, variant);
      const geometryVariant = Math.floor(survivalHash01(chunk.cx, chunk.cz, 2465 + index) * SURVIVAL_SOLID_TREE_VARIANT_COUNT) % SURVIVAL_SOLID_TREE_VARIANT_COUNT;
      generated.push({
        x: localX,
        y,
        z: localZ,
        yaw: survivalHash01(chunk.cx, chunk.cz, 2430 + index) * Math.PI * 2,
        trunkHeight: profile.trunkHeight * midDistanceTreeScale,
        canopyRadius: profile.canopyRadius * midDistanceTreeScale,
        colorIndex: geometryVariant,
        variant,
      });
    }

    return generated;
  }, [chunk, dense, getSurfaceQuality, mobilePerformanceMode]);

  useSurvivalFeatureCount("solidTrees", chunk.key, trees.length);

  useEffect(() => {
    const instances = new Array<number>(SURVIVAL_SOLID_TREE_VARIANT_COUNT).fill(0);

    for (let treeIndex = 0; treeIndex < trees.length; treeIndex += 1) {
      const tree = trees[treeIndex];
      const variantIndex = tree.colorIndex;
      const mesh = treeRefs.current[variantIndex];
      if (!mesh) continue;

      const instance = instances[variantIndex];
      const isMidDistanceLod = chunk.lod === "mid";
      const leanScale = isMidDistanceLod ? 0.36 : 1;
      const lean = (tree.variant - 0.5) * (0.08 + variantIndex * 0.018) * leanScale;
      const heightStretch = isMidDistanceLod
        ? 0.72 + survivalHash01(chunk.cx + treeIndex, chunk.cz - treeIndex, 8220) * 0.22
        : 0.82 + survivalHash01(chunk.cx + treeIndex, chunk.cz - treeIndex, 8220) * 0.46;
      const radiusStretch = isMidDistanceLod
        ? 0.82 + survivalHash01(chunk.cx - treeIndex, chunk.cz + treeIndex, 8230) * 0.2
        : 1.12 + survivalHash01(chunk.cx - treeIndex, chunk.cz + treeIndex, 8230) * 0.52;
      const depthStretch = isMidDistanceLod
        ? 0.74 + survivalHash01(chunk.cx + variantIndex, chunk.cz - variantIndex, 8240 + treeIndex) * 0.18
        : 0.82 + survivalHash01(chunk.cx + variantIndex, chunk.cz - variantIndex, 8240 + treeIndex) * 0.42;
      const radiusScale = tree.canopyRadius * radiusStretch;
      dummy.position.set(chunk.x + tree.x, tree.y + 0.04, chunk.z + tree.z);
      dummy.rotation.set(lean, tree.yaw, -lean * 0.62);
      dummy.scale.set(radiusScale, tree.trunkHeight * heightStretch, radiusScale * depthStretch);
      dummy.updateMatrix();
      mesh.setMatrixAt(instance, dummy.matrix);
      instances[variantIndex] = instance + 1;
    }

    for (let variantIndex = 0; variantIndex < treeRefs.current.length; variantIndex += 1) {
      const mesh = treeRefs.current[variantIndex];
      if (!mesh) continue;
      mesh.count = instances[variantIndex] ?? 0;
      finalizeSurvivalInstancedMesh(mesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.92, 112);
    }
  }, [chunk.cx, chunk.cz, chunk.x, chunk.z, dummy, trees]);

  if (trees.length === 0) return null;

  return (
    <group name={`survival-solid-tree-groves-${chunk.key}`} userData={HIDE_FROM_MINIMAP}>
      {geometries.map((geometry, variantIndex) => (
        <instancedMesh
          key={`${chunk.key}-solid-tree-variant-${variantIndex}`}
          ref={(mesh) => {
            treeRefs.current[variantIndex] = mesh;
          }}
          args={[geometry, undefined, Math.max(1, trees.length)]}
        >
          <meshBasicMaterial map={texture} vertexColors toneMapped={false} />
        </instancedMesh>
      ))}
    </group>
  );
}
