import { useMemo } from "react";
import * as THREE from "three";

export const PLANT_EDGE_COLOR = "#244a1c";
export const PLANT_EDGE_SOFT_COLOR = "#3a6330";
export const HIDE_FROM_MINIMAP = { hideFromMiniMap: true };

export type PlantLineShader = Parameters<THREE.Material["onBeforeCompile"]>[0];

export function makeFacetedPlantLobeGeometry() {
  const source = new THREE.DodecahedronGeometry(0.5, 0);
  const geometry = source.index ? source.toNonIndexed() : source;
  const positions = geometry.getAttribute("position");
  const barycentric: number[] = [];

  for (let index = 0; index < positions.count; index += 3) {
    barycentric.push(1, 0, 0, 0, 1, 0, 0, 0, 1);
  }

  geometry.setAttribute("plantBarycentric", new THREE.Float32BufferAttribute(barycentric, 3));
  return geometry;
}

export function getFacetedPlantLineColor(fillColor: string) {
  const color = new THREE.Color(fillColor);
  const luminance = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
  const target = new THREE.Color(luminance < 0.38 ? "#d9f99d" : "#17250f");
  return color.clone().lerp(target, luminance < 0.38 ? 0.74 : 0.78);
}

export function applyFacetedPlantLines(
  shader: PlantLineShader,
  lineColor: THREE.Color,
  lineWidth = 0.044,
  lineOpacity = 0.74,
) {
  shader.uniforms.uPlantLineColor = { value: lineColor };
  shader.uniforms.uPlantLineWidth = { value: lineWidth };
  shader.uniforms.uPlantLineOpacity = { value: lineOpacity };
  shader.vertexShader = `attribute vec3 plantBarycentric;
varying vec3 vPlantBarycentric;
${shader.vertexShader.replace(
    "#include <begin_vertex>",
    `#include <begin_vertex>
  vPlantBarycentric = plantBarycentric;`,
  )}`;
  shader.fragmentShader = `uniform vec3 uPlantLineColor;
uniform float uPlantLineWidth;
uniform float uPlantLineOpacity;
varying vec3 vPlantBarycentric;
${shader.fragmentShader.replace(
    "vec4 diffuseColor = vec4( diffuse, opacity );",
    `vec4 diffuseColor = vec4( diffuse, opacity );
  float plantEdgeDistance = min(min(vPlantBarycentric.x, vPlantBarycentric.y), vPlantBarycentric.z);
  float plantEdge = 1.0 - smoothstep(uPlantLineWidth, uPlantLineWidth + 0.055, plantEdgeDistance);
  diffuseColor.rgb = mix(diffuseColor.rgb, uPlantLineColor, plantEdge * uPlantLineOpacity);`,
  )}`;
}

export function FoliageDodeca({
  position,
  radius,
  color,
  edgeColor = PLANT_EDGE_COLOR,
  scale = [1, 1, 1],
}: {
  position: [number, number, number];
  radius: number;
  color: string;
  edgeColor?: string;
  scale?: [number, number, number];
}) {
  return (
    <group position={position} scale={scale} userData={HIDE_FROM_MINIMAP}>
      <mesh castShadow={false}>
        <dodecahedronGeometry args={[radius, 0]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh castShadow={false} renderOrder={3}>
        <dodecahedronGeometry args={[radius * 1.004, 0]} />
        <meshBasicMaterial color={edgeColor} wireframe transparent opacity={0.48} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function FoliageLeafPlane({
  position,
  rotation,
  width,
  height,
  color,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  width: number;
  height: number;
  color: string;
}) {
  return (
    <group position={position} rotation={rotation} userData={HIDE_FROM_MINIMAP}>
      <mesh position={[0, 0, -0.01]} scale={[1.14, 1.1, 1]} castShadow={false}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color={PLANT_EDGE_SOFT_COLOR} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.01]} castShadow={false}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function SurvivalVine({ start, end }: { start: THREE.Vector3; end: THREE.Vector3 }) {
  const segments = useMemo(() => {
    const totalDistance = start.distanceTo(end);
    const drop = Math.min(34, Math.max(10, totalDistance * 0.11));
    const pointCount = 6;
    const points = new Array<THREE.Vector3>(pointCount);
    for (let index = 0; index < pointCount; index += 1) {
      const t = index / 5;
      const point = new THREE.Vector3().lerpVectors(start, end, t);
      point.y -= Math.sin(t * Math.PI) * drop;
      point.x += Math.sin(t * Math.PI * 2) * 1.2;
      point.z += Math.cos(t * Math.PI * 2) * 1.2;
      points[index] = point;
    }

    const segmentCount = pointCount - 1;
    const vineSegments = new Array<{ key: number; start: THREE.Vector3; end: THREE.Vector3 }>(segmentCount);
    for (let index = 0; index < segmentCount; index += 1) {
      vineSegments[index] = {
        key: index,
        start: points[index],
        end: points[index + 1],
      };
    }
    return vineSegments;
  }, [end, start]);

  return (
    <group>
      {segments.map((segment) => (
        <SurvivalBranch
          key={segment.key}
          start={segment.start}
          end={segment.end}
          radius={0.22}
          color="#233c19"
        />
      ))}
    </group>
  );
}

export function SurvivalBranch({
  start,
  end,
  radius,
  color,
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  radius: number;
  color: string;
}) {
  const { midpoint, length, quaternion } = useMemo(() => {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = Math.max(0.1, direction.length());
    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize()
    );
    return { midpoint, length, quaternion };
  }, [end, start]);

  return (
    <mesh position={midpoint} quaternion={quaternion} castShadow={false}>
      <cylinderGeometry args={[radius * 0.68, radius, length, 5]} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

export function SurvivalHangingVine({
  x,
  y,
  z,
  length,
  sway,
}: {
  x: number;
  y: number;
  z: number;
  length: number;
  sway: number;
}) {
  const start = useMemo(() => new THREE.Vector3(x, y, z), [x, y, z]);
  const end = useMemo(() => new THREE.Vector3(x + Math.sin(sway) * 1.25, y - length, z + Math.cos(sway) * 1.25), [length, sway, x, y, z]);

  return (
    <group>
      <SurvivalBranch start={start} end={end} radius={0.13} color="#1f4f20" />
      <FoliageLeafPlane
        position={[x + Math.sin(sway) * 0.65, y - length * 0.52, z + Math.cos(sway) * 0.65]}
        rotation={[0.25, sway, 0.65]}
        width={1.2}
        height={2.6}
        color="#2f7b35"
      />
      <FoliageLeafPlane
        position={[x - Math.sin(sway) * 0.55, y - length * 0.78, z - Math.cos(sway) * 0.55]}
        rotation={[-0.18, sway + 0.9, -0.5]}
        width={1}
        height={2.1}
        color="#3d8f42"
      />
    </group>
  );
}
