import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { getBaseVillageTerrainHeight as getTerrainHeight } from "./systems/world/terrain/BaseVillageTerrain";
import { isHutCell } from "./systems/world/villages/baseVillageHutLayout";
import { isMobilePerformanceMode } from "./systems/input/performanceMode";

type BushInstance = {
  x: number;
  y: number;
  z: number;
  widthScale: number;
  heightScale: number;
  yaw: number;
  variant: number;
};

const BUSH_LOBE_COUNT = 5;
const BUSH_CLUSTER_COLORS = ["#416035", "#5a8643", "#7dad52"];
const BUSH_BLOCKER_RADIUS_SQ = 400;
const BUSH_TREE_BLOCKERS: readonly [number, number][] = [
  [0, 0],
  [25, 20],
  [-28, 15],
  [18, -26],
  [-22, -24],
];
const bushLineColorCache = new Map<string, THREE.Color>();
type BushLineShader = Parameters<THREE.Material["onBeforeCompile"]>[0];

function makeBushLobeGeometry() {
  const source = new THREE.DodecahedronGeometry(0.5, 0);
  const geometry = source.index ? source.toNonIndexed() : source;
  const positions = geometry.getAttribute("position");
  const barycentric: number[] = [];

  for (let index = 0; index < positions.count; index += 3) {
    barycentric.push(1, 0, 0, 0, 1, 0, 0, 0, 1);
  }

  geometry.setAttribute("bushBarycentric", new THREE.Float32BufferAttribute(barycentric, 3));
  return geometry;
}

function getBushLineColor(fillColor: string) {
  const cached = bushLineColorCache.get(fillColor);
  if (cached) return cached;

  const color = new THREE.Color(fillColor);
  const luminance = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
  const target = new THREE.Color(luminance < 0.38 ? "#d9f99d" : "#16240f");
  const lineColor = color.lerp(target, luminance < 0.38 ? 0.74 : 0.78);
  bushLineColorCache.set(fillColor, lineColor);
  return lineColor;
}

function applyBushLineShader(
  shader: BushLineShader,
  lineColor: THREE.Color,
  lineWidth = 0.044,
  lineOpacity = 0.74,
) {
  shader.uniforms.uBushLineColor = { value: lineColor };
  shader.uniforms.uBushLineWidth = { value: lineWidth };
  shader.uniforms.uBushLineOpacity = { value: lineOpacity };
  shader.vertexShader = `attribute vec3 bushBarycentric;
varying vec3 vBushBarycentric;
${shader.vertexShader.replace(
    "#include <begin_vertex>",
    `#include <begin_vertex>
  vBushBarycentric = bushBarycentric;`,
  )}`;
  shader.fragmentShader = `uniform vec3 uBushLineColor;
uniform float uBushLineWidth;
uniform float uBushLineOpacity;
varying vec3 vBushBarycentric;
${shader.fragmentShader.replace(
    "vec4 diffuseColor = vec4( diffuse, opacity );",
    `vec4 diffuseColor = vec4( diffuse, opacity );
  float bushEdgeDistance = min(min(vBushBarycentric.x, vBushBarycentric.y), vBushBarycentric.z);
  float bushEdge = 1.0 - smoothstep(uBushLineWidth, uBushLineWidth + 0.055, bushEdgeDistance);
  diffuseColor.rgb = mix(diffuseColor.rgb, uBushLineColor, bushEdge * uBushLineOpacity);`,
  )}`;
}

function isInsideHutBlocker(x: number, z: number, hutX: number, hutZ: number) {
  if (!isHutCell(hutX, hutZ)) return false;
  const dx = x - hutX;
  const dz = z - hutZ;
  return dx * dx + dz * dz < BUSH_BLOCKER_RADIUS_SQ;
}

function isInsideAnyBaseTreeBlocker(x: number, z: number) {
  for (let index = 0; index < BUSH_TREE_BLOCKERS.length; index += 1) {
    const [treeX, treeZ] = BUSH_TREE_BLOCKERS[index];
    const dx = x - treeX;
    const dz = z - treeZ;
    if (dx * dx + dz * dz < BUSH_BLOCKER_RADIUS_SQ) return true;
  }
  return false;
}

export function Bushes({ amount = 600, mapSize = 510 }) {
  const bushRef0 = useRef<THREE.InstancedMesh>(null);
  const bushRef1 = useRef<THREE.InstancedMesh>(null);
  const bushRef2 = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const bushGeometry = useMemo(() => makeBushLobeGeometry(), []);
  const boundingSphere = useMemo(() => new THREE.Sphere(new THREE.Vector3(0, 3, 0), mapSize * 0.78), [mapSize]);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const effectiveAmount = mobilePerformanceMode ? Math.min(amount, 150) : amount;

  const bushData = useMemo(() => {
    const data: BushInstance[] = [];
    for (let i = 0; i < effectiveAmount; i++) {
      const x = (Math.random() - 0.5) * mapSize;
      const z = (Math.random() - 0.5) * mapSize;
      const y = getTerrainHeight(x, z);
      
      // Skip spawning bushes on walls or in moats/roads
      if (y > 2.0 || y < -0.5) continue;
      
      const absX = Math.abs(x);
      const absZ = Math.abs(z);
      const R = Math.sqrt(x*x + z*z);
      
      const isRoad = absX < 12 || absZ < 12;
      const isMoat = (R > 42 && R < 58) || (R > 125 && R < 145);
      const isCentralPlaza = R < 35;
      const isPath = (absX >= 32 && absX < 40) && R > 60 && R < 125 || (absZ >= 32 && absZ < 40) && R > 60 && R < 125;
      
      if (isRoad || isMoat || isCentralPlaza || isPath) continue;
      
      const fx = Math.floor(x / 16) * 16;
      const cx = Math.ceil(x / 16) * 16;
      const fz = Math.floor(z / 16) * 16;
      const cz = Math.ceil(z / 16) * 16;

      if (
        isInsideHutBlocker(x, z, fx, fz) ||
        isInsideHutBlocker(x, z, fx, cz) ||
        isInsideHutBlocker(x, z, cx, fz) ||
        isInsideHutBlocker(x, z, cx, cz)
      ) {
        continue;
      }

      if (isInsideAnyBaseTreeBlocker(x, z)) {
        continue;
      }

      // Keep bushes huge to hide behind
      const heightScale = 3 + Math.random() * 4;
      const widthScale = heightScale * (1.5 + Math.random() * 2); // wider for hedge look
      data.push({
        x,
        y,
        z,
        widthScale,
        heightScale,
        yaw: Math.random() * Math.PI * 2,
        variant: Math.random(),
      });
    }
    return data;
  }, [effectiveAmount, mapSize]);

  useEffect(() => {
    const meshes = [bushRef0.current, bushRef1.current, bushRef2.current];

    for (let colorIndex = 0; colorIndex < meshes.length; colorIndex += 1) {
      const mesh = meshes[colorIndex];
      if (!mesh) continue;
      let instance = 0;

      for (let bushIndex = 0; bushIndex < bushData.length; bushIndex += 1) {
        const bush = bushData[bushIndex];
        for (let lobeIndex = 0; lobeIndex < BUSH_LOBE_COUNT; lobeIndex += 1) {
          if ((bushIndex + lobeIndex) % BUSH_CLUSTER_COLORS.length !== colorIndex) continue;

          const centerLobe = lobeIndex === 0;
          const angle = bush.yaw + (lobeIndex / BUSH_LOBE_COUNT) * Math.PI * 2 + bush.variant * 0.45;
          const spread = centerLobe ? 0 : bush.widthScale * (0.12 + lobeIndex * 0.018);
          const lobeWidth = bush.widthScale * (centerLobe ? 0.56 : 0.28 + ((lobeIndex + bushIndex) % 3) * 0.055);
          const lobeHeight = bush.heightScale * (centerLobe ? 0.82 : 0.44 + ((lobeIndex + bushIndex) % 4) * 0.07);
          const lobeDepth = bush.heightScale * (centerLobe ? 0.66 : 0.38 + ((lobeIndex + bushIndex) % 3) * 0.08);
          const lobeY = bush.y + lobeHeight * (centerLobe ? 0.5 : 0.42 + lobeIndex * 0.025);
          const x = bush.x + Math.sin(angle) * spread;
          const z = bush.z + Math.cos(angle) * spread;
          const pitch = centerLobe ? 0 : (bush.variant - 0.5) * 0.16;
          const roll = centerLobe ? 0 : Math.sin(angle) * 0.18;

          dummy.position.set(x, lobeY, z);
          dummy.rotation.set(pitch, angle, roll);
          dummy.scale.set(lobeWidth, lobeHeight, lobeDepth);
          dummy.updateMatrix();
          mesh.setMatrixAt(instance, dummy.matrix);
          instance += 1;
        }
      }

      mesh.count = instance;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.boundingSphere = boundingSphere;
    }
  }, [boundingSphere, bushData, dummy]);

  const capacity = Math.max(1, bushData.length * BUSH_LOBE_COUNT);

  return (
    <group name="faceted-village-bushes">
      <instancedMesh ref={bushRef0} args={[bushGeometry, undefined, capacity]} receiveShadow castShadow>
        <meshStandardMaterial
          color={BUSH_CLUSTER_COLORS[0]}
          roughness={1}
          onBeforeCompile={(shader) => applyBushLineShader(shader, getBushLineColor(BUSH_CLUSTER_COLORS[0]))}
        />
      </instancedMesh>
      <instancedMesh ref={bushRef1} args={[bushGeometry, undefined, capacity]} receiveShadow castShadow>
        <meshStandardMaterial
          color={BUSH_CLUSTER_COLORS[1]}
          roughness={1}
          onBeforeCompile={(shader) => applyBushLineShader(shader, getBushLineColor(BUSH_CLUSTER_COLORS[1]))}
        />
      </instancedMesh>
      <instancedMesh ref={bushRef2} args={[bushGeometry, undefined, capacity]} receiveShadow castShadow>
        <meshStandardMaterial
          color={BUSH_CLUSTER_COLORS[2]}
          roughness={1}
          onBeforeCompile={(shader) => applyBushLineShader(shader, getBushLineColor(BUSH_CLUSTER_COLORS[2]))}
        />
      </instancedMesh>
    </group>
  );
}
