import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { shouldPublishCurrentMountainSlopeGrassTelemetry } from "../../../tools/qa/survivalQaTelemetryRoutes";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { getSurvivalTutorialGrassTuftGeometry } from "../vegetation/survivalGrassGeometry";
import { HIDE_FROM_MINIMAP } from "../vegetation/SurvivalFoliagePrimitives";
import {
  ensureSurvivalInstancedMeshColors,
  finalizeSurvivalInstancedMesh,
  finalizeSurvivalInstancedMeshColors,
} from "../vegetation/survivalInstancing";
import { makeMountainVillageSlopeGrassTufts, type MountainSlopeGrassTuft } from "../vegetation/survivalMountainSlopeGrass";
import {
  MOUNTAIN_VILLAGE_HEIGHT,
  MOUNTAIN_VILLAGE_RADIUS,
  getMountainVillageHeight,
} from "./mountainVillageTerrain";
import { getMountainVillageTerrainColorInto } from "./mountainVillageTerrainGeometry";

export type MountainSlopeGrassTerrainHeightForChunk = (chunk: SurvivalChunkInfo, localX: number, localZ: number) => number;
export type MountainSlopeGrassTerrainColorAtWorld = (worldX: number, worldZ: number, height: number) => THREE.Color;
export type MountainSlopeGrassTuftResolveOptions = {
  chunk: SurvivalChunkInfo;
  baseHeight: number;
  active: boolean;
  terrainHeightForChunk: MountainSlopeGrassTerrainHeightForChunk;
  terrainColorAtWorld: MountainSlopeGrassTerrainColorAtWorld;
  terrainColorScratch?: THREE.Color;
};

const MOUNTAIN_GRASS_BLADE_SOURCE_UP = new THREE.Vector3(0, 1, 0);
const EMPTY_MOUNTAIN_SLOPE_GRASS_TUFTS: MountainSlopeGrassTuft[] = [];

function shouldPublishMountainSlopeGrassTelemetry() {
  return shouldPublishCurrentMountainSlopeGrassTelemetry();
}

export function resolveMountainSlopeGrassTuftsForView({
  chunk,
  baseHeight,
  active,
  terrainHeightForChunk,
  terrainColorAtWorld,
  terrainColorScratch = new THREE.Color(),
}: MountainSlopeGrassTuftResolveOptions) {
  return active
    ? makeMountainVillageSlopeGrassTufts(
      chunk,
      baseHeight,
      (sampleChunk, sampleLocalX, sampleLocalZ, sampleBaseHeight) => getMountainVillageHeight(
        sampleChunk,
        sampleLocalX,
        sampleLocalZ,
        terrainHeightForChunk,
        sampleBaseHeight,
      ),
      (sampleChunk, sampleLocalX, sampleLocalZ, sampleY, sampleBaseHeight, showTrailSurface) => getMountainVillageTerrainColorInto(
        terrainColorScratch,
        sampleChunk,
        sampleLocalX,
        sampleLocalZ,
        sampleY,
        sampleBaseHeight,
        showTrailSurface,
        terrainHeightForChunk,
        terrainColorAtWorld,
      ),
    )
    : EMPTY_MOUNTAIN_SLOPE_GRASS_TUFTS;
}

export function MountainSlopeGrassView({
  chunk,
  baseHeight,
  active,
  terrainHeightForChunk,
  terrainColorAtWorld,
}: {
  chunk: SurvivalChunkInfo;
  baseHeight: number;
  active: boolean;
  terrainHeightForChunk: MountainSlopeGrassTerrainHeightForChunk;
  terrainColorAtWorld: MountainSlopeGrassTerrainColorAtWorld;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const normal = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const grassGeometry = useMemo(() => getSurvivalTutorialGrassTuftGeometry(6), []);
  const grassColorScratch = useMemo(() => new THREE.Color(), []);
  const terrainColorScratch = useMemo(() => new THREE.Color(), []);
  const tufts = useMemo(
    () => resolveMountainSlopeGrassTuftsForView({
      chunk,
      baseHeight,
      active,
      terrainHeightForChunk,
      terrainColorAtWorld,
      terrainColorScratch,
    }),
    [active, baseHeight, chunk, terrainColorAtWorld, terrainColorScratch, terrainHeightForChunk],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || tufts.length === 0) return;

    ensureSurvivalInstancedMeshColors(mesh, tufts.length);
    for (let index = 0; index < tufts.length; index += 1) {
      const tuft = tufts[index];
      normal.set(tuft.normalX, tuft.normalY, tuft.normalZ).normalize();
      dummy.position
        .set(tuft.localX, tuft.y, tuft.localZ)
        .addScaledVector(normal, 0.08);
      dummy.quaternion.setFromUnitVectors(MOUNTAIN_GRASS_BLADE_SOURCE_UP, normal);
      dummy.rotateY(tuft.yaw);
      dummy.scale.set(tuft.width, tuft.height, tuft.width);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, grassColorScratch.setRGB(tuft.colorR, tuft.colorG, tuft.colorB));
    }

    mesh.count = tufts.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (shouldPublishMountainSlopeGrassTelemetry()) {
      document.documentElement.dataset.wofMountainSlopeGrass = String(tufts.length);
    }
    finalizeSurvivalInstancedMeshColors(mesh);
    finalizeSurvivalInstancedMesh(
      mesh,
      0,
      0,
      MOUNTAIN_VILLAGE_RADIUS + 34,
      baseHeight + MOUNTAIN_VILLAGE_HEIGHT * 0.48,
    );
  }, [baseHeight, dummy, grassColorScratch, normal, tufts]);

  if (tufts.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[grassGeometry, undefined, Math.max(1, tufts.length)]}
      renderOrder={5.1}
      frustumCulled
      userData={HIDE_FROM_MINIMAP}
    >
      <meshBasicMaterial
        color="#ffffff"
        vertexColors
        side={THREE.DoubleSide}
        depthWrite
        depthTest
        toneMapped={false}
      />
    </instancedMesh>
  );
}
