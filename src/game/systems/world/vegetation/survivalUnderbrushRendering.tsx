import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE, type SurvivalBiome } from "../../../../store/gameStore";
import { isMobilePerformanceMode } from "../../input/performanceMode";
import { useSurvivalFeatureCount } from "../../../tools/qa/survivalFeatureCounters";
import { getSurvivalWaterLevelAtWorld } from "../survival/survivalBiome";
import { survivalHash01 } from "../survival/survivalMath";
import { getSurvivalTownRouteMask } from "../survival/survivalRoutes";
import { BASE_VILLAGE_HALF_SIZE, type SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { SURVIVAL_BOTW_DECORATION_MAX_FOOTPRINT_RANGE } from "./survivalBotwGrassConfig";
import { SURVIVAL_BUSH_COLORS } from "./survivalFoliagePalettes";
import { finalizeSurvivalInstancedMesh } from "./survivalInstancing";
import {
  PLANT_EDGE_SOFT_COLOR,
  applyFacetedPlantLines,
  getFacetedPlantLineColor,
  makeFacetedPlantLobeGeometry,
} from "./SurvivalFoliagePrimitives";

export type SurvivalUnderbrushSurfaceQuality = {
  y: number;
  heightRange: number;
  normal: THREE.Vector3;
};

export type SurvivalUnderbrushSurfaceResolver = (
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  footprintRadius: number,
  sampleDistance: number,
  target?: SurvivalUnderbrushSurfaceQuality,
) => SurvivalUnderbrushSurfaceQuality;

type SurvivalBushBlob = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  width: number;
  height: number;
  depth: number;
  colorIndex: number;
};

type SurvivalFernFrond = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  tilt: number;
  width: number;
  height: number;
  colorIndex: number;
};

const SURVIVAL_FERN_COLORS: Record<SurvivalBiome, string[]> = {
  plains: ["#3f8f35", "#67a843", "#87bd52"],
  jungle: ["#0f6b34", "#168342", "#25a05a"],
  desert: ["#8b7437", "#b59145", "#cfab5f"],
  swamp: ["#334c23", "#54642d", "#6d793a"],
  mushroom: ["#586f43", "#885caa", "#b478d0"],
  tallgrass: ["#627f2d", "#8e9f3a", "#b0a849"],
};

const SURVIVAL_UNDERBRUSH_LOBE_GEOMETRY = makeFacetedPlantLobeGeometry();
const SURVIVAL_FERN_PLANE_GEOMETRY = new THREE.PlaneGeometry(1, 1);

export function SurvivalBushClusters({
  chunk,
  getSurfaceQuality,
}: {
  chunk: SurvivalChunkInfo;
  getSurfaceQuality: SurvivalUnderbrushSurfaceResolver;
}) {
  const bushRef0 = useRef<THREE.InstancedMesh>(null);
  const bushRef1 = useRef<THREE.InstancedMesh>(null);
  const bushRef2 = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const palette = SURVIVAL_BUSH_COLORS[chunk.biome];
  const surfaceQualityScratch = useMemo<SurvivalUnderbrushSurfaceQuality>(() => ({
    y: 0,
    heightRange: 0,
    normal: new THREE.Vector3(),
  }), []);
  const blobs = useMemo<SurvivalBushBlob[]>(() => {
    if (chunk.lod === "far") return [];

    const densityMultiplier = (chunk.lod === "mid" ? 0.12 : 0.42) * (mobilePerformanceMode ? 0.58 : 1);
    const baseCount = chunk.biome === "jungle"
      ? 50
      : chunk.biome === "swamp"
        ? 44
        : chunk.biome === "mushroom"
          ? 38
          : chunk.biome === "desert"
            ? 26
            : 40;
    const count = Math.round(baseCount * densityMultiplier);
    const generated: SurvivalBushBlob[] = [];
    const attempts = count * 3;
    let clusters = 0;

    for (let index = 0; index < attempts && clusters < count; index += 1) {
      const localX = (survivalHash01(chunk.cx, chunk.cz, 1810 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.9;
      const localZ = (survivalHash01(chunk.cx, chunk.cz, 1850 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.9;
      if (chunk.hasVillage && Math.max(Math.abs(localX), Math.abs(localZ)) < BASE_VILLAGE_HALF_SIZE + 34) continue;

      const worldX = chunk.x + localX;
      const worldZ = chunk.z + localZ;
      const surfaceQuality = getSurfaceQuality(chunk, localX, localZ, 6.6, 4.8, surfaceQualityScratch);
      if (
        surfaceQuality.normal.y < 0.68 ||
        surfaceQuality.heightRange > SURVIVAL_BOTW_DECORATION_MAX_FOOTPRINT_RANGE
      ) continue;
      const terrainY = surfaceQuality.y;
      const waterY = getSurvivalWaterLevelAtWorld(worldX, worldZ);
      if (terrainY < waterY + 0.18) continue;

      const shape = survivalHash01(chunk.cx, chunk.cz, 1890 + index);
      const biomeScale = chunk.biome === "jungle"
        ? 2.2
        : chunk.biome === "swamp"
          ? 1.9
          : chunk.biome === "desert"
            ? 1.05
            : 1.55;
      const clusterHeight = (1.5 + shape * 3.2) * biomeScale;
      const clusterWidth = clusterHeight * (1.28 + survivalHash01(chunk.cx, chunk.cz, 1930 + index) * 1.22);
      const lobeCount = 3 + Math.floor(survivalHash01(chunk.cx, chunk.cz, 1970 + index) * 4);
      const clusterYaw = survivalHash01(chunk.cx, chunk.cz, 2010 + index) * Math.PI * 2;

      for (let lobeIndex = 0; lobeIndex < lobeCount; lobeIndex += 1) {
        const lobeAngle = clusterYaw + (lobeIndex / lobeCount) * Math.PI * 2 + (survivalHash01(index, lobeIndex, 2030) - 0.5) * 0.78;
        const lobeSpread = clusterWidth * (0.12 + survivalHash01(index, lobeIndex, 2040) * 0.24);
        const lobeHeight = clusterHeight * (0.58 + survivalHash01(index, lobeIndex, 2050) * 0.72);
        const lobeWidth = clusterWidth * (0.34 + survivalHash01(index, lobeIndex, 2060) * 0.5);
        const lobeDepth = clusterHeight * (0.44 + survivalHash01(index, lobeIndex, 2070) * 0.58);

        generated.push({
          x: localX + Math.sin(lobeAngle) * lobeSpread,
          y: terrainY + lobeHeight * (0.42 + survivalHash01(index, lobeIndex, 2080) * 0.14),
          z: localZ + Math.cos(lobeAngle) * lobeSpread,
          yaw: lobeAngle + survivalHash01(index, lobeIndex, 2090) * 0.7,
          pitch: (survivalHash01(index, lobeIndex, 2100) - 0.5) * 0.18,
          roll: (survivalHash01(index, lobeIndex, 2110) - 0.5) * 0.28,
          width: lobeWidth,
          height: lobeHeight,
          depth: lobeDepth,
          colorIndex: Math.floor(survivalHash01(chunk.cx, chunk.cz, 2120 + index + lobeIndex * 17) * palette.length) % palette.length,
        });
      }
      clusters += 1;
    }

    return generated;
  }, [chunk, getSurfaceQuality, mobilePerformanceMode, palette.length, surfaceQualityScratch]);

  useSurvivalFeatureCount("bushBlobs", chunk.key, blobs.length);

  useEffect(() => {
    const meshes = [bushRef0.current, bushRef1.current, bushRef2.current];
    const instances = [0, 0, 0];

    for (let index = 0; index < blobs.length; index += 1) {
      const blob = blobs[index];
      const mesh = meshes[blob.colorIndex];
      if (!mesh) continue;

      const instance = instances[blob.colorIndex];
      dummy.position.set(chunk.x + blob.x, blob.y, chunk.z + blob.z);
      dummy.rotation.set(blob.pitch, blob.yaw, blob.roll);
      dummy.scale.set(blob.width, blob.height, blob.depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(instance, dummy.matrix);
      instances[blob.colorIndex] = instance + 1;
    }

    for (let colorIndex = 0; colorIndex < meshes.length; colorIndex += 1) {
      const mesh = meshes[colorIndex];
      if (!mesh) continue;
      mesh.count = instances[colorIndex];
      finalizeSurvivalInstancedMesh(mesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.74, 24);
    }
  }, [blobs, chunk.x, chunk.z, dummy]);

  if (blobs.length === 0) return null;

  const capacity = Math.max(1, blobs.length);

  return (
    <group name={`survival-bushes-${chunk.key}`}>
      <instancedMesh ref={bushRef0} args={[undefined, undefined, capacity]}>
        <primitive attach="geometry" object={SURVIVAL_UNDERBRUSH_LOBE_GEOMETRY} />
        <meshBasicMaterial
          color={palette[0]}
          onBeforeCompile={(shader) => applyFacetedPlantLines(shader, getFacetedPlantLineColor(palette[0]))}
        />
      </instancedMesh>
      <instancedMesh ref={bushRef1} args={[undefined, undefined, capacity]}>
        <primitive attach="geometry" object={SURVIVAL_UNDERBRUSH_LOBE_GEOMETRY} />
        <meshBasicMaterial
          color={palette[1]}
          onBeforeCompile={(shader) => applyFacetedPlantLines(shader, getFacetedPlantLineColor(palette[1]))}
        />
      </instancedMesh>
      <instancedMesh ref={bushRef2} args={[undefined, undefined, capacity]}>
        <primitive attach="geometry" object={SURVIVAL_UNDERBRUSH_LOBE_GEOMETRY} />
        <meshBasicMaterial
          color={palette[2]}
          onBeforeCompile={(shader) => applyFacetedPlantLines(shader, getFacetedPlantLineColor(palette[2]))}
        />
      </instancedMesh>
    </group>
  );
}

export function SurvivalFernClusters({
  chunk,
  getSurfaceQuality,
}: {
  chunk: SurvivalChunkInfo;
  getSurfaceQuality: SurvivalUnderbrushSurfaceResolver;
}) {
  const fernEdgeRef0 = useRef<THREE.InstancedMesh>(null);
  const fernEdgeRef1 = useRef<THREE.InstancedMesh>(null);
  const fernEdgeRef2 = useRef<THREE.InstancedMesh>(null);
  const fernRef0 = useRef<THREE.InstancedMesh>(null);
  const fernRef1 = useRef<THREE.InstancedMesh>(null);
  const fernRef2 = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const palette = SURVIVAL_FERN_COLORS[chunk.biome];
  const surfaceQualityScratch = useMemo<SurvivalUnderbrushSurfaceQuality>(() => ({
    y: 0,
    heightRange: 0,
    normal: new THREE.Vector3(),
  }), []);
  const fronds = useMemo<SurvivalFernFrond[]>(() => {
    if (chunk.lod === "far") return [];
    if (chunk.biome === "desert") return [];

    const baseCount = chunk.lod === "mid"
      ? chunk.biome === "jungle" ? 34 : chunk.biome === "swamp" ? 26 : 24
      : chunk.biome === "jungle"
        ? 140
        : chunk.biome === "swamp"
          ? 105
          : chunk.biome === "mushroom"
            ? 100
            : 105;
    const targetCount = Math.max(
      chunk.lod === "mid" ? 3 : 18,
      Math.round(baseCount * (chunk.lod === "mid" ? 0.42 : 0.5) * (mobilePerformanceMode ? 0.58 : 1)),
    );
    const generated: SurvivalFernFrond[] = [];
    const attempts = targetCount * 3;

    for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
      const localX = (survivalHash01(chunk.cx, chunk.cz, 2610 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.93;
      const localZ = (survivalHash01(chunk.cx, chunk.cz, 2650 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.93;
      if (chunk.hasVillage && Math.max(Math.abs(localX), Math.abs(localZ)) < BASE_VILLAGE_HALF_SIZE + 30) continue;

      const worldX = chunk.x + localX;
      const worldZ = chunk.z + localZ;
      if (getSurvivalTownRouteMask(worldX, worldZ) > 0.12) continue;
      const surfaceQuality = getSurfaceQuality(chunk, localX, localZ, 2.6, 3.4, surfaceQualityScratch);
      if (surfaceQuality.normal.y < 0.78 || surfaceQuality.heightRange > 2.4) continue;
      const y = surfaceQuality.y;
      const waterY = getSurvivalWaterLevelAtWorld(worldX, worldZ);
      if (y < waterY + 0.08) continue;

      const variant = survivalHash01(chunk.cx, chunk.cz, 2690 + index);
      const biomeScale = chunk.biome === "jungle"
        ? 1.75
        : chunk.biome === "swamp"
          ? 1.45
          : 1.1;
      generated.push({
        x: localX,
        y: y + 0.08,
        z: localZ,
        yaw: survivalHash01(chunk.cx, chunk.cz, 2730 + index) * Math.PI * 2,
        tilt: -0.3 + survivalHash01(chunk.cx, chunk.cz, 2770 + index) * 0.58,
        width: (0.42 + variant * 0.68) * biomeScale,
        height: (2.1 + variant * 4.2) * biomeScale,
        colorIndex: Math.floor(survivalHash01(chunk.cx, chunk.cz, 2810 + index) * palette.length) % palette.length,
      });
    }

    return generated;
  }, [chunk, getSurfaceQuality, mobilePerformanceMode, palette.length, surfaceQualityScratch]);

  useSurvivalFeatureCount("fernFronds", chunk.key, fronds.length);

  useEffect(() => {
    const edgeMeshes = [fernEdgeRef0.current, fernEdgeRef1.current, fernEdgeRef2.current];
    const meshes = [fernRef0.current, fernRef1.current, fernRef2.current];
    const instances = [0, 0, 0];

    for (let index = 0; index < fronds.length; index += 1) {
      const frond = fronds[index];
      const colorIndex = frond.colorIndex;
      const mesh = meshes[colorIndex];
      if (!mesh) continue;
      const edgeMesh = edgeMeshes[colorIndex];
      const instance = instances[colorIndex];

      if (edgeMesh) {
        dummy.position.set(chunk.x + frond.x, frond.y + frond.height * 0.49, chunk.z + frond.z);
        dummy.rotation.set(frond.tilt, frond.yaw, Math.sin(frond.yaw) * 0.18);
        dummy.scale.set(frond.width * 1.36, frond.height * 1.08, 1);
        dummy.updateMatrix();
        edgeMesh.setMatrixAt(instance, dummy.matrix);
      }
      dummy.position.set(chunk.x + frond.x, frond.y + frond.height * 0.5, chunk.z + frond.z);
      dummy.rotation.set(frond.tilt, frond.yaw, Math.sin(frond.yaw) * 0.18);
      dummy.scale.set(frond.width, frond.height, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(instance, dummy.matrix);
      instances[colorIndex] = instance + 1;
    }

    for (let colorIndex = 0; colorIndex < meshes.length; colorIndex += 1) {
      const mesh = meshes[colorIndex];
      const edgeMesh = edgeMeshes[colorIndex];
      if (!mesh) continue;
      mesh.count = instances[colorIndex];
      finalizeSurvivalInstancedMesh(mesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.74, 20);
      if (edgeMesh) {
        edgeMesh.count = instances[colorIndex];
        finalizeSurvivalInstancedMesh(edgeMesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.74, 20);
      }
    }
  }, [chunk.x, chunk.z, dummy, fronds]);

  if (fronds.length === 0) return null;

  const capacity = Math.max(1, fronds.length);
  const opacity = 0.88;
  const showPlantEdges = false;

  return (
    <group name={`survival-ferns-${chunk.key}`}>
      {showPlantEdges && (
        <instancedMesh ref={fernEdgeRef0} args={[undefined, undefined, capacity]}>
          <primitive attach="geometry" object={SURVIVAL_FERN_PLANE_GEOMETRY} />
          <meshBasicMaterial color={PLANT_EDGE_SOFT_COLOR} side={THREE.DoubleSide} transparent opacity={opacity * 0.26} depthWrite={false} />
        </instancedMesh>
      )}
      {showPlantEdges && (
        <instancedMesh ref={fernEdgeRef1} args={[undefined, undefined, capacity]}>
          <primitive attach="geometry" object={SURVIVAL_FERN_PLANE_GEOMETRY} />
          <meshBasicMaterial color={PLANT_EDGE_SOFT_COLOR} side={THREE.DoubleSide} transparent opacity={opacity * 0.26} depthWrite={false} />
        </instancedMesh>
      )}
      {showPlantEdges && (
        <instancedMesh ref={fernEdgeRef2} args={[undefined, undefined, capacity]}>
          <primitive attach="geometry" object={SURVIVAL_FERN_PLANE_GEOMETRY} />
          <meshBasicMaterial color={PLANT_EDGE_SOFT_COLOR} side={THREE.DoubleSide} transparent opacity={opacity * 0.26} depthWrite={false} />
        </instancedMesh>
      )}
      <instancedMesh ref={fernRef0} args={[undefined, undefined, capacity]}>
        <primitive attach="geometry" object={SURVIVAL_FERN_PLANE_GEOMETRY} />
        <meshBasicMaterial color={palette[0]} side={THREE.DoubleSide} transparent opacity={opacity} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={fernRef1} args={[undefined, undefined, capacity]}>
        <primitive attach="geometry" object={SURVIVAL_FERN_PLANE_GEOMETRY} />
        <meshBasicMaterial color={palette[1]} side={THREE.DoubleSide} transparent opacity={opacity} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={fernRef2} args={[undefined, undefined, capacity]}>
        <primitive attach="geometry" object={SURVIVAL_FERN_PLANE_GEOMETRY} />
        <meshBasicMaterial color={palette[2]} side={THREE.DoubleSide} transparent opacity={opacity} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}
