import { useMemo } from "react";
import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";

export const BASE_TERRAIN_SEGMENTS = 128;
export const BASE_TERRAIN_COLLISION_SEGMENTS = 64;
const BASE_TERRAIN_BLEND_FEATHER = 6;

const baseTerrainColors = {
  grass: new THREE.Color("#4f8730"),
  grassLight: new THREE.Color("#78b94f"),
  road: new THREE.Color("#c2a077"),
  plaza: new THREE.Color("#b88962"),
  moatMud: new THREE.Color("#4c3d2b"),
  dirt: new THREE.Color("#5c4033"),
};

let cachedTerrainGeometry: THREE.BufferGeometry | null = null;
let cachedCollisionGeometry: THREE.BufferGeometry | null = null;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const smoothstepRange = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const lerpNumber = (a: number, b: number, t: number) => a + (b - a) * clamp01(t);

function getBasePlanarRadius(x: number, z: number) {
  return Math.sqrt(x * x + z * z);
}

export const checkIsBaseVillageHutCell = (x: number, z: number) => {
  const absX = Math.abs(x);
  const absZ = Math.abs(z);
  const radiusSq = x * x + z * z;

  if (absX >= 240 || absZ >= 240) return true;

  const isRoad = absX < 12 || absZ < 12;
  const isMoat = (radiusSq > 42 * 42 && radiusSq < 58 * 58) || (radiusSq > 125 * 125 && radiusSq < 145 * 145);
  const isCentralPlaza = radiusSq < 35 * 35;
  const isPath = (absX >= 32 && absX < 40) && radiusSq > 60 * 60 && radiusSq < 125 * 125 ||
    (absZ >= 32 && absZ < 40) && radiusSq > 60 * 60 && radiusSq < 125 * 125;

  if (isRoad || isMoat || isCentralPlaza || isPath) return false;

  const cx = Math.floor((x + 256) / 16);
  const cz = Math.floor((z + 256) / 16);
  const hash = Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453;
  return (hash - Math.floor(hash)) <= 0.7;
};

export const getBaseVillageTerrainHeight = (x: number, z: number) => {
  const absX = Math.abs(x);
  const absZ = Math.abs(z);
  const radiusSq = x * x + z * z;

  const isRoad = absX < 12 || absZ < 12;
  if (isRoad) {
    if (radiusSq < 35 * 35) return -0.5;
    if (radiusSq >= 35 * 35 && radiusSq <= 42 * 42) return 0.0;
    if (radiusSq > 42 * 42 && radiusSq < 58 * 58) return 0.5;
    if (radiusSq >= 58 * 58 && radiusSq <= 125 * 125) return 1.0;
    if (radiusSq > 125 * 125 && radiusSq < 145 * 145) return 1.5;
    return 2.0;
  }

  if ((radiusSq > 42 * 42 && radiusSq < 58 * 58) || (radiusSq > 125 * 125 && radiusSq < 145 * 145)) {
    return -1.5;
  }

  if (radiusSq < 35 * 35) return -0.5;
  if (radiusSq >= 35 * 35 && radiusSq <= 42 * 42) return 0.0;
  if (radiusSq >= 58 * 58 && radiusSq <= 125 * 125) return 1.0;

  return 2.0;
};

function getSoftBandMask(value: number, inner: number, outer: number, feather = BASE_TERRAIN_BLEND_FEATHER) {
  return smoothstepRange(inner - feather, inner + feather, value) *
    (1 - smoothstepRange(outer - feather, outer + feather, value));
}

function getBaseTerrainSurfaceColorInto(x: number, z: number, height: number, target: THREE.Color) {
  const absX = Math.abs(x);
  const absZ = Math.abs(z);
  const radius = getBasePlanarRadius(x, z);
  const roadMask = Math.max(
    1 - smoothstepRange(10, 18, absX),
    1 - smoothstepRange(10, 18, absZ),
  );
  const innerMoatMask = getSoftBandMask(radius, 42, 58) * (1 - roadMask);
  const outerMoatMask = getSoftBandMask(radius, 125, 145) * (1 - roadMask);
  const moatMask = clamp01(innerMoatMask + outerMoatMask);
  const plazaMask = 1 - smoothstepRange(28, 42, radius);
  const pathMask = Math.max(
    getSoftBandMask(absX, 32, 40, 3.2) * getSoftBandMask(radius, 60, 125, 5),
    getSoftBandMask(absZ, 32, 40, 3.2) * getSoftBandMask(radius, 60, 125, 5),
  );
  const hutDirtMask = checkIsBaseVillageHutCell(x, z)
    ? smoothstepRange(-0.2, 1, Math.sin(x * 0.3 + z * 0.4) * Math.cos(x * 0.2 + z * 0.5))
    : 0;
  const grassNoise = (
    Math.sin(x * 0.038 + z * 0.021) +
    Math.cos(z * 0.031 - x * 0.017)
  ) * 0.5;
  const color = target.copy(baseTerrainColors.grass).lerp(
    baseTerrainColors.grassLight,
    0.22 + smoothstepRange(-0.75, 0.82, grassNoise) * 0.28,
  );
  color.lerp(baseTerrainColors.dirt, hutDirtMask * 0.44);
  color.lerp(baseTerrainColors.road, clamp01(pathMask * 0.72 + roadMask * 0.82));
  color.lerp(baseTerrainColors.plaza, plazaMask * 0.68);
  color.lerp(baseTerrainColors.moatMud, moatMask * 0.92);
  color.multiplyScalar(lerpNumber(0.94, 1.08, smoothstepRange(-1.5, 2.0, height)));
  color.r = clamp01(color.r);
  color.g = clamp01(color.g);
  color.b = clamp01(color.b);
  return color;
}

export function getBaseVillageTerrainGeometry() {
  if (cachedTerrainGeometry) return cachedTerrainGeometry;

  const geometry = new THREE.PlaneGeometry(512, 512, BASE_TERRAIN_SEGMENTS, BASE_TERRAIN_SEGMENTS);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const y = getBaseVillageTerrainHeight(x, z);
    getBaseTerrainSurfaceColorInto(x, z, y, color);
    const colorOffset = i * 3;
    positions.setY(i, y);
    colors[colorOffset] = color.r;
    colors[colorOffset + 1] = color.g;
    colors[colorOffset + 2] = color.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  cachedTerrainGeometry = geometry;
  return cachedTerrainGeometry;
}

export function getBaseVillageTerrainCollisionGeometry() {
  if (cachedCollisionGeometry) return cachedCollisionGeometry;

  const geometry = new THREE.PlaneGeometry(512, 512, BASE_TERRAIN_COLLISION_SEGMENTS, BASE_TERRAIN_COLLISION_SEGMENTS);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;

  for (let i = 0; i < positions.count; i += 1) {
    positions.setY(i, getBaseVillageTerrainHeight(positions.getX(i), positions.getZ(i)));
  }

  geometry.computeVertexNormals();
  cachedCollisionGeometry = geometry;
  return cachedCollisionGeometry;
}

export function BaseVillageTerrain({ terrainTexture }: { terrainTexture: THREE.Texture }) {
  const terrainGeometry = useMemo(() => getBaseVillageTerrainGeometry(), []);
  const terrainCollisionGeometry = useMemo(() => getBaseVillageTerrainCollisionGeometry(), []);

  return (
    <>
      <mesh receiveShadow geometry={terrainGeometry} dispose={null}>
        <meshStandardMaterial map={terrainTexture} vertexColors roughness={0.95} />
      </mesh>

      <RigidBody type="fixed" colliders="trimesh" friction={0} restitution={0}>
        <mesh geometry={terrainCollisionGeometry} dispose={null}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </RigidBody>
    </>
  );
}
