import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import { isMobilePerformanceMode } from "../../input/performanceMode";
import { getSurvivalWaterLevelAtWorld } from "../survival/survivalBiome";
import { survivalHash01 } from "../survival/survivalMath";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { finalizeSurvivalInstancedMesh } from "./survivalInstancing";
import { SURVIVAL_FLOWER_COLORS } from "./survivalFoliagePalettes";

const SURVIVAL_WILDFLOWER_SOURCE_UP = new THREE.Vector3(0, 1, 0);
const SURVIVAL_WILDFLOWER_STEM_GEOMETRY = new THREE.CylinderGeometry(1, 1, 1, 4);
const SURVIVAL_WILDFLOWER_BLOOM_GEOMETRY = new THREE.OctahedronGeometry(0.5, 0);
const SURVIVAL_WILDFLOWER_CENTER_GEOMETRY = new THREE.SphereGeometry(0.5, 5, 4);
const SURVIVAL_WILDFLOWER_STEM_MATERIAL = new THREE.MeshBasicMaterial({ color: "#47742d", toneMapped: false });
const SURVIVAL_WILDFLOWER_DESERT_STEM_MATERIAL = new THREE.MeshBasicMaterial({ color: "#6f7f34", toneMapped: false });
const SURVIVAL_WILDFLOWER_BLOOM_MATERIAL = new THREE.MeshBasicMaterial({
  color: "#ffffff",
  vertexColors: true,
  toneMapped: false,
});
const SURVIVAL_WILDFLOWER_CENTER_MATERIAL = new THREE.MeshBasicMaterial({
  color: "#ffe45c",
  toneMapped: false,
});

export type SurvivalWildflowerSurfaceQuality = {
  y: number;
  heightRange: number;
  normal: THREE.Vector3;
};

export type SurvivalWildflowerSurfaceResolver = (
  chunk: SurvivalChunkInfo,
  localX: number,
  localZ: number,
  footprintRadius: number,
  sampleDistance: number,
) => SurvivalWildflowerSurfaceQuality;

type SurvivalWildflower = {
  x: number;
  y: number;
  z: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  yaw: number;
  stemHeight: number;
  stemRadius: number;
  bloomSize: number;
  color: string;
};

function getSurvivalFlowerCount(chunk: SurvivalChunkInfo, mobilePerformanceMode: boolean) {
  if (chunk.hasVillage) return 0;
  if (chunk.distance > 4) return 0;

  const lodScale = chunk.lod === "near"
    ? 1
    : chunk.lod === "mid"
      ? 0.46
      : 0.2;
  const biomeBase = chunk.biome === "desert"
    ? 24
    : chunk.biome === "jungle"
      ? 58
      : chunk.biome === "swamp"
        ? 42
        : chunk.biome === "mushroom"
          ? 72
          : chunk.biome === "tallgrass"
            ? 92
            : 74;
  return Math.max(chunk.lod === "far" ? 4 : 10, Math.round(biomeBase * lodScale * (mobilePerformanceMode ? 0.48 : 1)));
}

export function SurvivalWildflowers({
  chunk,
  enabled,
  getSurfaceQuality,
}: {
  chunk: SurvivalChunkInfo;
  enabled: boolean;
  getSurfaceQuality: SurvivalWildflowerSurfaceResolver;
}) {
  if (!enabled) return null;

  return (
    <ActiveSurvivalWildflowers
      chunk={chunk}
      getSurfaceQuality={getSurfaceQuality}
    />
  );
}

function ActiveSurvivalWildflowers({
  chunk,
  getSurfaceQuality,
}: {
  chunk: SurvivalChunkInfo;
  getSurfaceQuality: SurvivalWildflowerSurfaceResolver;
}) {
  const stemRef = useRef<THREE.InstancedMesh>(null);
  const bloomRef = useRef<THREE.InstancedMesh>(null);
  const centerRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const patchNormal = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const flowerColor = useMemo(() => new THREE.Color(), []);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const flowers = useMemo<SurvivalWildflower[]>(() => {
    const targetCount = getSurvivalFlowerCount(chunk, mobilePerformanceMode);
    if (targetCount <= 0) return [];

    const generated: SurvivalWildflower[] = [];
    const palette = SURVIVAL_FLOWER_COLORS[chunk.biome];
    const scatterSize = SURVIVAL_BLOCK_SIZE * 0.9;
    const gridSize = Math.ceil(Math.sqrt(targetCount * 1.8));
    const attempts = gridSize * gridSize;

    for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
      const col = index % gridSize;
      const row = Math.floor(index / gridSize);
      const jitterX = 0.08 + survivalHash01(chunk.cx + col, chunk.cz + row, 6100 + index) * 0.84;
      const jitterZ = 0.08 + survivalHash01(chunk.cx - row, chunk.cz + col, 6200 + index) * 0.84;
      const localX = (((col + jitterX) / gridSize) - 0.5) * scatterSize;
      const localZ = (((row + jitterZ) / gridSize) - 0.5) * scatterSize;

      if (Math.max(Math.abs(localX), Math.abs(localZ)) > SURVIVAL_BLOCK_SIZE * 0.48) continue;
      const worldX = chunk.x + localX;
      const worldZ = chunk.z + localZ;
      const surfaceQuality = getSurfaceQuality(chunk, localX, localZ, 1.25, 2.8);
      if (surfaceQuality.normal.y < 0.82 || surfaceQuality.heightRange > 1.6) continue;
      const terrainY = surfaceQuality.y;
      const waterY = getSurvivalWaterLevelAtWorld(worldX, worldZ);
      if (terrainY < waterY + 0.1) continue;

      const patch = survivalHash01(chunk.cx + col, chunk.cz + row, 6250);
      if (chunk.biome === "desert" && patch < 0.42) continue;
      if (chunk.biome === "swamp" && patch < 0.16) continue;

      const terrainNormal = surfaceQuality.normal;
      const variant = survivalHash01(chunk.cx, chunk.cz, 6300 + index);
      const stemHeight = (chunk.biome === "tallgrass" ? 0.74 : chunk.biome === "desert" ? 0.44 : 0.58) + variant * (chunk.biome === "tallgrass" ? 0.54 : 0.42);
      const bloomSize = (chunk.biome === "mushroom" ? 0.72 : 0.58) + survivalHash01(chunk.cx, chunk.cz, 6400 + index) * (chunk.biome === "tallgrass" ? 0.46 : 0.34);
      generated.push({
        x: localX,
        y: terrainY + 0.035,
        z: localZ,
        normalX: terrainNormal.x,
        normalY: terrainNormal.y,
        normalZ: terrainNormal.z,
        yaw: survivalHash01(chunk.cx, chunk.cz, 6500 + index) * Math.PI * 2,
        stemHeight,
        stemRadius: 0.035 + survivalHash01(chunk.cx, chunk.cz, 6600 + index) * 0.024,
        bloomSize,
        color: palette[Math.floor(variant * palette.length) % palette.length],
      });
    }

    return generated;
  }, [chunk, getSurfaceQuality, mobilePerformanceMode]);

  useEffect(() => {
    const stemMesh = stemRef.current;
    const bloomMesh = bloomRef.current;
    const centerMesh = centerRef.current;
    if (!stemMesh || !bloomMesh || !centerMesh) return;

    for (let index = 0; index < flowers.length; index += 1) {
      const flower = flowers[index];
      patchNormal.set(flower.normalX, flower.normalY, flower.normalZ).normalize();

      dummy.position
        .set(chunk.x + flower.x, flower.y, chunk.z + flower.z)
        .addScaledVector(patchNormal, flower.stemHeight * 0.5);
      dummy.quaternion.setFromUnitVectors(SURVIVAL_WILDFLOWER_SOURCE_UP, patchNormal);
      dummy.rotateY(flower.yaw);
      dummy.scale.set(flower.stemRadius, flower.stemHeight, flower.stemRadius);
      dummy.updateMatrix();
      stemMesh.setMatrixAt(index, dummy.matrix);

      dummy.position
        .set(chunk.x + flower.x, flower.y, chunk.z + flower.z)
        .addScaledVector(patchNormal, flower.stemHeight + flower.bloomSize * 0.16);
      dummy.quaternion.setFromUnitVectors(SURVIVAL_WILDFLOWER_SOURCE_UP, patchNormal);
      dummy.rotateY(flower.yaw);
      dummy.scale.setScalar(flower.bloomSize);
      dummy.updateMatrix();
      bloomMesh.setMatrixAt(index, dummy.matrix);
      bloomMesh.setColorAt(index, flowerColor.set(flower.color));
    }

    stemMesh.count = flowers.length;
    bloomMesh.count = flowers.length;
    centerMesh.count = 0;
    finalizeSurvivalInstancedMesh(stemMesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.62, 18);
    finalizeSurvivalInstancedMesh(bloomMesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.62, 18);
    finalizeSurvivalInstancedMesh(centerMesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.62, 18);
    if (bloomMesh.instanceColor) bloomMesh.instanceColor.needsUpdate = true;
  }, [chunk.x, chunk.z, dummy, flowerColor, flowers, patchNormal]);

  if (flowers.length === 0) return null;

  const stemMaterial = chunk.biome === "desert"
    ? SURVIVAL_WILDFLOWER_DESERT_STEM_MATERIAL
    : SURVIVAL_WILDFLOWER_STEM_MATERIAL;

  return (
    <group name={`survival-wildflowers-${chunk.key}`}>
      <instancedMesh ref={stemRef} args={[undefined, undefined, flowers.length]} renderOrder={5} frustumCulled={false}>
        <primitive attach="geometry" object={SURVIVAL_WILDFLOWER_STEM_GEOMETRY} />
        <primitive attach="material" object={stemMaterial} />
      </instancedMesh>
      <instancedMesh ref={bloomRef} args={[undefined, undefined, flowers.length]} renderOrder={8} frustumCulled={false}>
        <primitive attach="geometry" object={SURVIVAL_WILDFLOWER_BLOOM_GEOMETRY} />
        <primitive attach="material" object={SURVIVAL_WILDFLOWER_BLOOM_MATERIAL} />
      </instancedMesh>
      <instancedMesh ref={centerRef} args={[undefined, undefined, flowers.length]} renderOrder={9} frustumCulled={false}>
        <primitive attach="geometry" object={SURVIVAL_WILDFLOWER_CENTER_GEOMETRY} />
        <primitive attach="material" object={SURVIVAL_WILDFLOWER_CENTER_MATERIAL} />
      </instancedMesh>
    </group>
  );
}
