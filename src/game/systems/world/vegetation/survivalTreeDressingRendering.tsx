import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import { isMobilePerformanceMode } from "../../input/performanceMode";
import { useSurvivalFeatureCount } from "../../../tools/qa/survivalFeatureCounters";
import { survivalHash01 } from "../survival/survivalMath";
import {
  BASE_VILLAGE_HALF_SIZE,
  type SurvivalChunkInfo,
} from "../survival/survivalWorldConfig";
import {
  SURVIVAL_BOTW_DECORATION_MAX_FOOTPRINT_RANGE,
  SURVIVAL_BOTW_DECORATION_MIN_NORMAL_Y,
} from "./survivalBotwGrassConfig";
import {
  createSurvivalBranchFrame,
  HIDE_FROM_MINIMAP,
  PLANT_EDGE_COLOR,
  writeSurvivalBranchFrameInto,
} from "./SurvivalFoliagePrimitives";
import {
  SURVIVAL_ROOF_FOREST_CANOPY_COLORS,
  SURVIVAL_TREE_CANOPY_COLORS,
  SURVIVAL_TREE_TRUNK_COLORS,
} from "./survivalFoliagePalettes";
import { finalizeSurvivalInstancedMesh } from "./survivalInstancing";
import {
  getFastGroveTreeProfile,
  getSurvivalSolidTreeTexture,
  supportsRoofForest,
} from "./survivalTreeVisuals";

type SurvivalTreeDressingSurfaceQuality = {
  y: number;
  normal: THREE.Vector3;
  heightRange: number;
};

type SurvivalTreeDressingResolvers = {
  getSurfaceQuality: (
    chunk: SurvivalChunkInfo,
    localX: number,
    localZ: number,
    footprintRadius: number,
    sampleStride: number,
    target?: SurvivalTreeDressingSurfaceQuality,
  ) => SurvivalTreeDressingSurfaceQuality;
  getWaterLevelAtWorld: (worldX: number, worldZ: number) => number;
};

type SurvivalFastGroveTree = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  trunkHeight: number;
  trunkRadius: number;
  canopyRadius: number;
  canopyHeight: number;
  colorIndex: number;
  variant: number;
};

type SurvivalRoofForestTree = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  trunkHeight: number;
  trunkRadius: number;
  canopyWidth: number;
  canopyDepth: number;
  canopyThickness: number;
  colorIndex: number;
  vineLength: number;
  variant: number;
};

export function SurvivalFastGroves({
  chunk,
  getSurfaceQuality,
  getWaterLevelAtWorld,
}: {
  chunk: SurvivalChunkInfo;
} & SurvivalTreeDressingResolvers) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const branchRef = useRef<THREE.InstancedMesh>(null);
  const canopyEdgeRef0 = useRef<THREE.InstancedMesh>(null);
  const canopyEdgeRef1 = useRef<THREE.InstancedMesh>(null);
  const canopyRef0 = useRef<THREE.InstancedMesh>(null);
  const canopyRef1 = useRef<THREE.InstancedMesh>(null);
  const sideCanopyEdgeRef0 = useRef<THREE.InstancedMesh>(null);
  const sideCanopyEdgeRef1 = useRef<THREE.InstancedMesh>(null);
  const sideCanopyRef0 = useRef<THREE.InstancedMesh>(null);
  const sideCanopyRef1 = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const branchScratch = useMemo(() => ({
    start: new THREE.Vector3(),
    end: new THREE.Vector3(),
    frame: createSurvivalBranchFrame(),
  }), []);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const canopyColors = SURVIVAL_TREE_CANOPY_COLORS[chunk.biome];
  const trunkColor = SURVIVAL_TREE_TRUNK_COLORS[chunk.biome];
  const barkTexture = useMemo(() => getSurvivalSolidTreeTexture(), []);
  const surfaceQualityScratch = useMemo<SurvivalTreeDressingSurfaceQuality>(() => ({
    y: 0,
    normal: new THREE.Vector3(),
    heightRange: 0,
  }), []);
  const trees = useMemo<SurvivalFastGroveTree[]>(() => {
    if (chunk.lod === "far") return [];

    const density = (chunk.lod === "mid" ? 0.12 : 0.58) * (mobilePerformanceMode ? 0.58 : 1);
    const baseCount = chunk.biome === "jungle"
      ? 27
      : chunk.biome === "swamp"
        ? 22
        : chunk.biome === "mushroom"
          ? 18
          : chunk.biome === "desert"
            ? 11
            : 21;
    const count = Math.max(chunk.lod === "mid" ? 1 : 4, Math.round(baseCount * density));
    const generated: SurvivalFastGroveTree[] = [];
    const attempts = count * 10;

    for (let index = 0; index < attempts && generated.length < count; index += 1) {
      const localX = (survivalHash01(chunk.cx, chunk.cz, 2310 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.94;
      const localZ = (survivalHash01(chunk.cx, chunk.cz, 2350 + index) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.94;
      if (chunk.hasVillage && Math.max(Math.abs(localX), Math.abs(localZ)) < BASE_VILLAGE_HALF_SIZE + 40) continue;
      if (chunk.biome !== "desert" && Math.min(Math.abs(localX), Math.abs(localZ)) < 22) continue;

      const worldX = chunk.x + localX;
      const worldZ = chunk.z + localZ;
      const surfaceQuality = getSurfaceQuality(chunk, localX, localZ, 8.5, 5.2, surfaceQualityScratch);
      if (
        surfaceQuality.normal.y < SURVIVAL_BOTW_DECORATION_MIN_NORMAL_Y ||
        surfaceQuality.heightRange > SURVIVAL_BOTW_DECORATION_MAX_FOOTPRINT_RANGE
      ) continue;
      const y = surfaceQuality.y;
      const waterY = getWaterLevelAtWorld(worldX, worldZ);
      if (y < waterY + 0.2) continue;

      const spacing = chunk.biome === "jungle"
        ? 24
        : chunk.biome === "swamp"
          ? 22
          : chunk.biome === "desert"
            ? 32
            : 26;
      const spacingSq = spacing * spacing;
      let tooClose = false;
      for (let treeIndex = 0; treeIndex < generated.length; treeIndex += 1) {
        const tree = generated[treeIndex];
        const dx = tree.x - localX;
        const dz = tree.z - localZ;
        if (dx * dx + dz * dz < spacingSq) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      const variant = survivalHash01(chunk.cx, chunk.cz, 2390 + index);
      const profile = getFastGroveTreeProfile(chunk.biome, variant);
      generated.push({
        x: localX,
        y,
        z: localZ,
        yaw: survivalHash01(chunk.cx, chunk.cz, 2430 + index) * Math.PI * 2,
        trunkHeight: profile.trunkHeight,
        trunkRadius: profile.trunkRadius,
        canopyRadius: profile.canopyRadius,
        canopyHeight: profile.canopyHeight,
        colorIndex: Math.floor(survivalHash01(chunk.cx, chunk.cz, 2470 + index) * canopyColors.length) % canopyColors.length,
        variant,
      });
    }

    return generated;
  }, [canopyColors.length, chunk, getSurfaceQuality, getWaterLevelAtWorld, mobilePerformanceMode, surfaceQualityScratch]);

  useSurvivalFeatureCount("fastGroveTrees", `survival-fast-groves-${chunk.key}`, trees.length);

  useEffect(() => {
    const trunkMesh = trunkRef.current;
    if (trunkMesh) {
      for (let index = 0; index < trees.length; index += 1) {
        const tree = trees[index];
        const lean = (tree.variant - 0.5) * 0.08;
        const rootTuck = Math.min(8, tree.trunkHeight * 0.11);
        const groundedTrunkHeight = tree.trunkHeight + rootTuck;
        dummy.position.set(chunk.x + tree.x, tree.y + (tree.trunkHeight - rootTuck) * 0.5, chunk.z + tree.z);
        dummy.rotation.set(lean, tree.yaw, -lean * 0.6);
        dummy.scale.set(tree.trunkRadius, groundedTrunkHeight, tree.trunkRadius);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(index, dummy.matrix);
      }
      trunkMesh.count = trees.length;
      finalizeSurvivalInstancedMesh(trunkMesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.84, 72);
    }

    const branchMesh = branchRef.current;
    if (branchMesh) {
      const { start, end, frame } = branchScratch;
      let branchInstance = 0;
      for (let treeIndex = 0; treeIndex < trees.length; treeIndex += 1) {
        const tree = trees[treeIndex];
        for (let branchIndex = 0; branchIndex < 3; branchIndex += 1) {
          const branchSeed = survivalHash01(chunk.cx + treeIndex, chunk.cz - treeIndex, 4520 + branchIndex);
          const angle = tree.yaw + branchIndex * 2.14 + branchSeed * 0.82;
          start.set(
            chunk.x + tree.x,
            tree.y + tree.trunkHeight * (0.34 + branchIndex * 0.15),
            chunk.z + tree.z,
          );
          const length = tree.canopyRadius * (0.5 + branchSeed * 0.42);
          end.set(
            start.x + Math.sin(angle) * length,
            start.y + tree.canopyHeight * (0.36 + branchSeed * 0.42),
            start.z + Math.cos(angle) * length,
          );
          writeSurvivalBranchFrameInto(start, end, frame);
          dummy.position.copy(frame.midpoint);
          dummy.quaternion.copy(frame.quaternion);
          dummy.scale.set(tree.trunkRadius * (0.28 + branchSeed * 0.2), frame.length, tree.trunkRadius * (0.24 + branchSeed * 0.16));
          dummy.updateMatrix();
          branchMesh.setMatrixAt(branchInstance, dummy.matrix);
          branchInstance += 1;
        }
      }
      branchMesh.count = branchInstance;
      finalizeSurvivalInstancedMesh(branchMesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.88, 86);
    }

    const canopyMeshes = [canopyRef0.current, canopyRef1.current];
    const canopyEdgeMeshes = [canopyEdgeRef0.current, canopyEdgeRef1.current];
    const sideMeshes = [sideCanopyRef0.current, sideCanopyRef1.current];
    const sideEdgeMeshes = [sideCanopyEdgeRef0.current, sideCanopyEdgeRef1.current];
    for (let colorIndex = 0; colorIndex < canopyMeshes.length; colorIndex += 1) {
      const mesh = canopyMeshes[colorIndex];
      if (!mesh) continue;
      const edgeMesh = canopyEdgeMeshes[colorIndex];
      let instance = 0;
      for (let treeIndex = 0; treeIndex < trees.length; treeIndex += 1) {
        const tree = trees[treeIndex];
        if (tree.colorIndex !== colorIndex) continue;
        if (edgeMesh) {
          dummy.position.set(chunk.x + tree.x, tree.y + tree.trunkHeight + tree.canopyHeight * 0.18, chunk.z + tree.z);
          dummy.rotation.set(0, tree.yaw, 0);
          dummy.scale.set(tree.canopyRadius * 1.25, tree.canopyHeight, tree.canopyRadius);
          dummy.updateMatrix();
          edgeMesh.setMatrixAt(instance, dummy.matrix);
        }
        dummy.position.set(chunk.x + tree.x, tree.y + tree.trunkHeight + tree.canopyHeight * 0.2, chunk.z + tree.z);
        dummy.rotation.set(0, tree.yaw, 0);
        dummy.scale.set(tree.canopyRadius * 1.25, tree.canopyHeight, tree.canopyRadius);
        dummy.updateMatrix();
        mesh.setMatrixAt(instance, dummy.matrix);
        instance += 1;
      }
      mesh.count = instance;
      finalizeSurvivalInstancedMesh(mesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.88, 96);
      if (edgeMesh) {
        edgeMesh.count = instance;
        finalizeSurvivalInstancedMesh(edgeMesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.88, 96);
      }
    }

    for (let colorIndex = 0; colorIndex < sideMeshes.length; colorIndex += 1) {
      const mesh = sideMeshes[colorIndex];
      if (!mesh) continue;
      const edgeMesh = sideEdgeMeshes[colorIndex];
      let instance = 0;
      for (let treeIndex = 0; treeIndex < trees.length; treeIndex += 1) {
        const tree = trees[treeIndex];
        if (tree.colorIndex !== colorIndex) continue;
        const lobeCount = 3 + Math.floor(tree.variant * 2);
        for (let lobeIndex = 0; lobeIndex < lobeCount; lobeIndex += 1) {
          const lobeSeed = survivalHash01(chunk.cx + treeIndex, chunk.cz - treeIndex, 4620 + lobeIndex);
          const angle = tree.yaw + (lobeIndex / lobeCount) * Math.PI * 2 + lobeSeed * 0.72;
          const offset = tree.canopyRadius * (0.42 + lobeSeed * 0.34);
          const lobeY = tree.y + tree.trunkHeight + tree.canopyHeight * (-0.12 + lobeSeed * 0.36);
          const lobeScale = 0.48 + lobeSeed * 0.38;
          if (edgeMesh) {
            dummy.position.set(
              chunk.x + tree.x + Math.sin(angle) * offset,
              lobeY - tree.canopyHeight * 0.02,
              chunk.z + tree.z + Math.cos(angle) * offset,
            );
            dummy.rotation.set(0.05 + (lobeSeed - 0.5) * 0.08, angle, (lobeSeed - 0.5) * 0.12);
            dummy.scale.set(tree.canopyRadius * lobeScale * 1.08, tree.canopyHeight * (0.55 + lobeSeed * 0.28), tree.canopyRadius * (0.42 + lobeSeed * 0.22));
            dummy.updateMatrix();
            edgeMesh.setMatrixAt(instance, dummy.matrix);
          }
          dummy.position.set(
            chunk.x + tree.x + Math.sin(angle) * offset,
            lobeY,
            chunk.z + tree.z + Math.cos(angle) * offset,
          );
          dummy.rotation.set(0.05 + (lobeSeed - 0.5) * 0.08, angle, (lobeSeed - 0.5) * 0.12);
          dummy.scale.set(tree.canopyRadius * lobeScale, tree.canopyHeight * (0.55 + lobeSeed * 0.28), tree.canopyRadius * (0.42 + lobeSeed * 0.22));
          dummy.updateMatrix();
          mesh.setMatrixAt(instance, dummy.matrix);
          instance += 1;
        }
      }
      mesh.count = instance;
      finalizeSurvivalInstancedMesh(mesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.88, 86);
      if (edgeMesh) {
        edgeMesh.count = instance;
        finalizeSurvivalInstancedMesh(edgeMesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.88, 86);
      }
    }
  }, [branchScratch, chunk.cx, chunk.cz, chunk.x, chunk.z, dummy, trees]);

  if (trees.length === 0) return null;

  const capacity = Math.max(1, trees.length);
  const branchCapacity = Math.max(1, trees.length * 3);
  const sideCapacity = Math.max(1, trees.length * 4);
  const canopyOpacity = chunk.biome === "desert" ? 0.92 : 1;
  const showTreeEdges = chunk.lod === "near" && !mobilePerformanceMode;

  return (
    <group name={`survival-fast-groves-${chunk.key}`}>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, capacity]}>
        <cylinderGeometry args={[1, 1, 1, 5]} />
        <meshBasicMaterial map={barkTexture} color={trunkColor} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={branchRef} args={[undefined, undefined, branchCapacity]}>
        <cylinderGeometry args={[1, 1, 1, 5]} />
        <meshBasicMaterial map={barkTexture} color={trunkColor} toneMapped={false} />
      </instancedMesh>
      {showTreeEdges && (
        <instancedMesh ref={canopyEdgeRef0} args={[undefined, undefined, capacity]} userData={HIDE_FROM_MINIMAP}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={PLANT_EDGE_COLOR} wireframe transparent opacity={canopyOpacity * 0.42} depthWrite={false} />
        </instancedMesh>
      )}
      {showTreeEdges && (
        <instancedMesh ref={canopyEdgeRef1} args={[undefined, undefined, capacity]} userData={HIDE_FROM_MINIMAP}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={PLANT_EDGE_COLOR} wireframe transparent opacity={canopyOpacity * 0.42} depthWrite={false} />
        </instancedMesh>
      )}
      <instancedMesh ref={canopyRef0} args={[undefined, undefined, capacity]} userData={HIDE_FROM_MINIMAP}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={canopyColors[0]} transparent={canopyOpacity < 1} opacity={canopyOpacity} />
      </instancedMesh>
      <instancedMesh ref={canopyRef1} args={[undefined, undefined, capacity]} userData={HIDE_FROM_MINIMAP}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={canopyColors[1]} transparent={canopyOpacity < 1} opacity={canopyOpacity} />
      </instancedMesh>
      {showTreeEdges && (
        <instancedMesh ref={sideCanopyEdgeRef0} args={[undefined, undefined, sideCapacity]} userData={HIDE_FROM_MINIMAP}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={PLANT_EDGE_COLOR} wireframe transparent opacity={canopyOpacity * 0.38} depthWrite={false} />
        </instancedMesh>
      )}
      {showTreeEdges && (
        <instancedMesh ref={sideCanopyEdgeRef1} args={[undefined, undefined, sideCapacity]} userData={HIDE_FROM_MINIMAP}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={PLANT_EDGE_COLOR} wireframe transparent opacity={canopyOpacity * 0.38} depthWrite={false} />
        </instancedMesh>
      )}
      <instancedMesh ref={sideCanopyRef0} args={[undefined, undefined, sideCapacity]} userData={HIDE_FROM_MINIMAP}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={canopyColors[0]} transparent={canopyOpacity < 1} opacity={canopyOpacity * 0.94} />
      </instancedMesh>
      <instancedMesh ref={sideCanopyRef1} args={[undefined, undefined, sideCapacity]} userData={HIDE_FROM_MINIMAP}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={canopyColors[1]} transparent={canopyOpacity < 1} opacity={canopyOpacity * 0.94} />
      </instancedMesh>
    </group>
  );
}

export function SurvivalRoofForests({
  chunk,
  getSurfaceQuality,
  getWaterLevelAtWorld,
}: {
  chunk: SurvivalChunkInfo;
} & SurvivalTreeDressingResolvers) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const topCanopyEdgeRef0 = useRef<THREE.InstancedMesh>(null);
  const topCanopyEdgeRef1 = useRef<THREE.InstancedMesh>(null);
  const topCanopyEdgeRef2 = useRef<THREE.InstancedMesh>(null);
  const topCanopyRef0 = useRef<THREE.InstancedMesh>(null);
  const topCanopyRef1 = useRef<THREE.InstancedMesh>(null);
  const topCanopyRef2 = useRef<THREE.InstancedMesh>(null);
  const lowerCanopyEdgeRef0 = useRef<THREE.InstancedMesh>(null);
  const lowerCanopyEdgeRef1 = useRef<THREE.InstancedMesh>(null);
  const lowerCanopyEdgeRef2 = useRef<THREE.InstancedMesh>(null);
  const lowerCanopyRef0 = useRef<THREE.InstancedMesh>(null);
  const lowerCanopyRef1 = useRef<THREE.InstancedMesh>(null);
  const lowerCanopyRef2 = useRef<THREE.InstancedMesh>(null);
  const vineRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const canopyColors = SURVIVAL_ROOF_FOREST_CANOPY_COLORS[chunk.biome];
  const trunkColor = chunk.biome === "jungle"
    ? "#20130c"
    : chunk.biome === "mushroom"
      ? "#553064"
      : "#3f2818";
  const vineColor = chunk.biome === "mushroom"
    ? "#d783e5"
    : chunk.biome === "jungle"
      ? "#1f6d2c"
      : "#2f7a36";
  const surfaceQualityScratch = useMemo<SurvivalTreeDressingSurfaceQuality>(() => ({
    y: 0,
    normal: new THREE.Vector3(),
    heightRange: 0,
  }), []);

  const trees = useMemo<SurvivalRoofForestTree[]>(() => {
    if (chunk.lod === "far" || !supportsRoofForest(chunk.biome)) return [];

    const near = chunk.lod === "near";
    const baseTargetCount = near
      ? chunk.biome === "jungle" ? 42 : chunk.biome === "mushroom" ? 30 : 36
      : chunk.biome === "jungle" ? 8 : chunk.biome === "mushroom" ? 6 : 7;
    const targetCount = Math.max(near ? 8 : 2, Math.round(baseTargetCount * 0.58 * (mobilePerformanceMode ? 0.58 : 1)));
    const clusterCount = near ? (chunk.biome === "jungle" ? 3 : 2) : 1;
    const clusterRadius = chunk.biome === "jungle" ? 154 : chunk.biome === "mushroom" ? 124 : 132;
    const centers: Array<{ x: number; z: number; radius: number }> = [];
    for (let centerIndex = 0; centerIndex < clusterCount; centerIndex += 1) {
      centers.push({
        x: (survivalHash01(chunk.cx, chunk.cz, 6410 + centerIndex) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.68,
        z: (survivalHash01(chunk.cx, chunk.cz, 6460 + centerIndex) - 0.5) * SURVIVAL_BLOCK_SIZE * 0.68,
        radius: clusterRadius * (0.78 + survivalHash01(chunk.cx, chunk.cz, 6510 + centerIndex) * 0.44),
      });
    }
    const generated: SurvivalRoofForestTree[] = [];
    const attempts = targetCount * 8;

    for (let index = 0; index < attempts && generated.length < targetCount; index += 1) {
      const center = centers[index % centers.length];
      const angle = survivalHash01(chunk.cx, chunk.cz, 6560 + index) * Math.PI * 2;
      const distance = Math.pow(survivalHash01(chunk.cx, chunk.cz, 6610 + index), 0.62) * center.radius;
      const localX = center.x + Math.cos(angle) * distance + (survivalHash01(chunk.cx, chunk.cz, 6660 + index) - 0.5) * 24;
      const localZ = center.z + Math.sin(angle) * distance + (survivalHash01(chunk.cx, chunk.cz, 6710 + index) - 0.5) * 24;
      if (Math.abs(localX) > SURVIVAL_BLOCK_SIZE * 0.47 || Math.abs(localZ) > SURVIVAL_BLOCK_SIZE * 0.47) continue;
      if (chunk.hasVillage && Math.max(Math.abs(localX), Math.abs(localZ)) < BASE_VILLAGE_HALF_SIZE + 62) continue;
      if (Math.min(Math.abs(localX), Math.abs(localZ)) < 16) continue;

      const worldX = chunk.x + localX;
      const worldZ = chunk.z + localZ;
      const surfaceQuality = getSurfaceQuality(chunk, localX, localZ, 9.5, 5.8, surfaceQualityScratch);
      if (
        surfaceQuality.normal.y < SURVIVAL_BOTW_DECORATION_MIN_NORMAL_Y ||
        surfaceQuality.heightRange > SURVIVAL_BOTW_DECORATION_MAX_FOOTPRINT_RANGE
      ) continue;
      const y = surfaceQuality.y;
      const waterY = getWaterLevelAtWorld(worldX, worldZ);
      if (y < waterY + 0.26) continue;

      const spacing = near
        ? chunk.biome === "jungle" ? 10.5 : 12.5
        : chunk.biome === "jungle" ? 18 : 22;
      const spacingSq = spacing * spacing;
      let tooClose = false;
      for (let treeIndex = 0; treeIndex < generated.length; treeIndex += 1) {
        const tree = generated[treeIndex];
        const dx = tree.x - localX;
        const dz = tree.z - localZ;
        if (dx * dx + dz * dz < spacingSq) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      const variant = survivalHash01(chunk.cx, chunk.cz, 6760 + index);
      const heightBias = chunk.biome === "jungle" ? 1.16 : chunk.biome === "mushroom" ? 0.92 : 1;
      const trunkHeight = (72 + variant * 62 + survivalHash01(chunk.cx, chunk.cz, 6810 + index) * 34) * heightBias;
      const canopyScale = chunk.biome === "jungle" ? 1.18 : chunk.biome === "mushroom" ? 1.05 : 1;
      const canopyWidth = (20 + variant * 22) * canopyScale;
      const canopyDepth = (18 + survivalHash01(chunk.cx, chunk.cz, 6860 + index) * 20) * canopyScale;
      const canopyThickness = (4.6 + survivalHash01(chunk.cx, chunk.cz, 6910 + index) * 5.2) * (
        chunk.biome === "jungle" ? 1.1 : chunk.biome === "mushroom" ? 1.18 : 1
      );
      const vineLength = chunk.biome === "jungle"
        ? 10 + survivalHash01(chunk.cx, chunk.cz, 7110 + index) * 28
        : chunk.biome === "mushroom"
          ? 8 + survivalHash01(chunk.cx, chunk.cz, 7110 + index) * 22
          : 6 + survivalHash01(chunk.cx, chunk.cz, 7110 + index) * 16;

      generated.push({
        x: localX,
        y,
        z: localZ,
        yaw: survivalHash01(chunk.cx, chunk.cz, 6960 + index) * Math.PI * 2,
        trunkHeight,
        trunkRadius: (1.05 + survivalHash01(chunk.cx, chunk.cz, 7010 + index) * 1.1) * heightBias,
        canopyWidth,
        canopyDepth,
        canopyThickness,
        colorIndex: Math.floor(survivalHash01(chunk.cx, chunk.cz, 7060 + index) * canopyColors.length) % canopyColors.length,
        vineLength,
        variant,
      });
    }

    return generated;
  }, [canopyColors.length, chunk, getSurfaceQuality, getWaterLevelAtWorld, mobilePerformanceMode, surfaceQualityScratch]);

  useSurvivalFeatureCount("roofForestTrees", `survival-roof-forest-${chunk.key}`, trees.length);

  useEffect(() => {
    const trunkMesh = trunkRef.current;
    if (trunkMesh) {
      for (let index = 0; index < trees.length; index += 1) {
        const tree = trees[index];
        const lean = (tree.variant - 0.5) * 0.035;
        const rootTuck = Math.min(9, tree.trunkHeight * 0.1);
        const groundedTrunkHeight = tree.trunkHeight + rootTuck;
        dummy.position.set(chunk.x + tree.x, tree.y + (tree.trunkHeight - rootTuck) * 0.5, chunk.z + tree.z);
        dummy.rotation.set(lean, tree.yaw, -lean * 0.4);
        dummy.scale.set(tree.trunkRadius, groundedTrunkHeight, tree.trunkRadius);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(index, dummy.matrix);
      }
      trunkMesh.count = trees.length;
      finalizeSurvivalInstancedMesh(trunkMesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.9, 88);
    }

    const topMeshes = [topCanopyRef0.current, topCanopyRef1.current, topCanopyRef2.current];
    const topEdgeMeshes = [topCanopyEdgeRef0.current, topCanopyEdgeRef1.current, topCanopyEdgeRef2.current];
    const lowerMeshes = [lowerCanopyRef0.current, lowerCanopyRef1.current, lowerCanopyRef2.current];
    const lowerEdgeMeshes = [lowerCanopyEdgeRef0.current, lowerCanopyEdgeRef1.current, lowerCanopyEdgeRef2.current];
    for (let colorIndex = 0; colorIndex < topMeshes.length; colorIndex += 1) {
      const mesh = topMeshes[colorIndex];
      if (!mesh) continue;
      const edgeMesh = topEdgeMeshes[colorIndex];
      let instance = 0;
      for (let treeIndex = 0; treeIndex < trees.length; treeIndex += 1) {
        const tree = trees[treeIndex];
        if (tree.colorIndex !== colorIndex) continue;
        if (edgeMesh) {
          dummy.position.set(chunk.x + tree.x, tree.y + tree.trunkHeight + tree.canopyThickness * 0.25, chunk.z + tree.z);
          dummy.rotation.set(0.02, tree.yaw, 0);
          dummy.scale.set(tree.canopyWidth, tree.canopyThickness, tree.canopyDepth);
          dummy.updateMatrix();
          edgeMesh.setMatrixAt(instance, dummy.matrix);
        }
        dummy.position.set(chunk.x + tree.x, tree.y + tree.trunkHeight + tree.canopyThickness * 0.28, chunk.z + tree.z);
        dummy.rotation.set(0.02, tree.yaw, 0);
        dummy.scale.set(tree.canopyWidth, tree.canopyThickness, tree.canopyDepth);
        dummy.updateMatrix();
        mesh.setMatrixAt(instance, dummy.matrix);
        instance += 1;
      }
      mesh.count = instance;
      finalizeSurvivalInstancedMesh(mesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.92, 128);
      if (edgeMesh) {
        edgeMesh.count = instance;
        finalizeSurvivalInstancedMesh(edgeMesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.92, 128);
      }
    }

    for (let colorIndex = 0; colorIndex < lowerMeshes.length; colorIndex += 1) {
      const mesh = lowerMeshes[colorIndex];
      if (!mesh) continue;
      const edgeMesh = lowerEdgeMeshes[colorIndex];
      let instance = 0;
      for (let treeIndex = 0; treeIndex < trees.length; treeIndex += 1) {
        const tree = trees[treeIndex];
        if (tree.colorIndex !== colorIndex) continue;
        const side = tree.variant > 0.5 ? 1 : -1;
        const offset = tree.canopyWidth * 0.28;
        if (edgeMesh) {
          dummy.position.set(
            chunk.x + tree.x + Math.cos(tree.yaw) * offset * side,
            tree.y + tree.trunkHeight - tree.canopyThickness * 0.36,
            chunk.z + tree.z + Math.sin(tree.yaw) * offset * side,
          );
          dummy.rotation.set(0.1 * side, tree.yaw + side * 0.28, 0.03 * side);
          dummy.scale.set(tree.canopyWidth * 0.72, tree.canopyThickness * 0.75, tree.canopyDepth * 0.72);
          dummy.updateMatrix();
          edgeMesh.setMatrixAt(instance, dummy.matrix);
        }
        dummy.position.set(
          chunk.x + tree.x + Math.cos(tree.yaw) * offset * side,
          tree.y + tree.trunkHeight - tree.canopyThickness * 0.34,
          chunk.z + tree.z + Math.sin(tree.yaw) * offset * side,
        );
        dummy.rotation.set(0.1 * side, tree.yaw + side * 0.28, 0.03 * side);
        dummy.scale.set(tree.canopyWidth * 0.72, tree.canopyThickness * 0.75, tree.canopyDepth * 0.72);
        dummy.updateMatrix();
        mesh.setMatrixAt(instance, dummy.matrix);
        instance += 1;
      }
      mesh.count = instance;
      finalizeSurvivalInstancedMesh(mesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.92, 112);
      if (edgeMesh) {
        edgeMesh.count = instance;
        finalizeSurvivalInstancedMesh(edgeMesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.92, 112);
      }
    }

    const vineMesh = vineRef.current;
    if (vineMesh) {
      let instance = 0;
      for (let treeIndex = 0; treeIndex < trees.length; treeIndex += 1) {
        const tree = trees[treeIndex];
        if (tree.vineLength <= 0 || tree.variant < 0.38) continue;
        const side = tree.variant > 0.68 ? 1 : -1;
        const offset = tree.canopyWidth * (0.22 + tree.variant * 0.18);
        dummy.position.set(
          chunk.x + tree.x + Math.cos(tree.yaw + 1.1) * offset * side,
          tree.y + tree.trunkHeight - tree.vineLength * 0.5,
          chunk.z + tree.z + Math.sin(tree.yaw + 1.1) * offset * side,
        );
        dummy.rotation.set(0.06, tree.yaw, 0.12 * side);
        dummy.scale.set(0.34 + tree.variant * 0.18, tree.vineLength, 1);
        dummy.updateMatrix();
        vineMesh.setMatrixAt(instance, dummy.matrix);
        instance += 1;
      }
      vineMesh.count = instance;
      finalizeSurvivalInstancedMesh(vineMesh, chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.9, 96);
    }
  }, [chunk.x, chunk.z, dummy, trees]);

  if (trees.length === 0) return null;

  const capacity = Math.max(1, trees.length);
  const showCanopyEdges = chunk.lod === "near" && !mobilePerformanceMode;
  const showLowerCanopies = chunk.lod === "near" && !mobilePerformanceMode;
  const showVines = false;

  return (
    <group name={`survival-roof-forest-${chunk.key}`}>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, capacity]}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshBasicMaterial color={trunkColor} />
      </instancedMesh>
      {showCanopyEdges && (
        <instancedMesh ref={topCanopyEdgeRef0} args={[undefined, undefined, capacity]} userData={HIDE_FROM_MINIMAP}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={PLANT_EDGE_COLOR} wireframe transparent opacity={0.4} depthWrite={false} />
        </instancedMesh>
      )}
      {showCanopyEdges && (
        <instancedMesh ref={topCanopyEdgeRef1} args={[undefined, undefined, capacity]} userData={HIDE_FROM_MINIMAP}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={PLANT_EDGE_COLOR} wireframe transparent opacity={0.4} depthWrite={false} />
        </instancedMesh>
      )}
      {showCanopyEdges && (
        <instancedMesh ref={topCanopyEdgeRef2} args={[undefined, undefined, capacity]} userData={HIDE_FROM_MINIMAP}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={PLANT_EDGE_COLOR} wireframe transparent opacity={0.4} depthWrite={false} />
        </instancedMesh>
      )}
      <instancedMesh ref={topCanopyRef0} args={[undefined, undefined, capacity]} userData={HIDE_FROM_MINIMAP}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={canopyColors[0]} />
      </instancedMesh>
      <instancedMesh ref={topCanopyRef1} args={[undefined, undefined, capacity]} userData={HIDE_FROM_MINIMAP}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={canopyColors[1]} />
      </instancedMesh>
      <instancedMesh ref={topCanopyRef2} args={[undefined, undefined, capacity]} userData={HIDE_FROM_MINIMAP}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={canopyColors[2]} />
      </instancedMesh>
      {showCanopyEdges && showLowerCanopies && (
        <instancedMesh ref={lowerCanopyEdgeRef0} args={[undefined, undefined, capacity]} userData={HIDE_FROM_MINIMAP}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={PLANT_EDGE_COLOR} wireframe transparent opacity={0.36} depthWrite={false} />
        </instancedMesh>
      )}
      {showCanopyEdges && showLowerCanopies && (
        <instancedMesh ref={lowerCanopyEdgeRef1} args={[undefined, undefined, capacity]} userData={HIDE_FROM_MINIMAP}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={PLANT_EDGE_COLOR} wireframe transparent opacity={0.36} depthWrite={false} />
        </instancedMesh>
      )}
      {showCanopyEdges && showLowerCanopies && (
        <instancedMesh ref={lowerCanopyEdgeRef2} args={[undefined, undefined, capacity]} userData={HIDE_FROM_MINIMAP}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={PLANT_EDGE_COLOR} wireframe transparent opacity={0.36} depthWrite={false} />
        </instancedMesh>
      )}
      {showLowerCanopies && (
        <instancedMesh ref={lowerCanopyRef0} args={[undefined, undefined, capacity]} userData={HIDE_FROM_MINIMAP}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={canopyColors[0]} />
        </instancedMesh>
      )}
      {showLowerCanopies && (
        <instancedMesh ref={lowerCanopyRef1} args={[undefined, undefined, capacity]} userData={HIDE_FROM_MINIMAP}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={canopyColors[1]} />
        </instancedMesh>
      )}
      {showLowerCanopies && (
        <instancedMesh ref={lowerCanopyRef2} args={[undefined, undefined, capacity]} userData={HIDE_FROM_MINIMAP}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={canopyColors[2]} />
        </instancedMesh>
      )}
      {showVines && (
        <instancedMesh ref={vineRef} args={[undefined, undefined, capacity]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color={vineColor} side={THREE.DoubleSide} transparent opacity={chunk.biome === "mushroom" ? 0.68 : 0.76} />
        </instancedMesh>
      )}
    </group>
  );
}
