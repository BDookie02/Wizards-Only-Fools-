import * as THREE from "three";
import {
  MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS,
  MOUNTAIN_VILLAGE_SUMMIT_COLLIDER_RADIUS,
} from "./mountainVillageTerrain";

export function makeMountainVillageSummitColliderGeometry(summitY: number) {
  const segments = 32;
  const y = summitY + 0.32;
  const vertices = new Float32Array(segments * 2 * 3);
  const indices = new Uint16Array(segments * 6);
  let vertexOffset = 0;
  let indexOffset = 0;

  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    vertices[vertexOffset] = Math.sin(angle) * MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS;
    vertices[vertexOffset + 1] = y;
    vertices[vertexOffset + 2] = Math.cos(angle) * MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS;
    vertices[vertexOffset + 3] = Math.sin(angle) * MOUNTAIN_VILLAGE_SUMMIT_COLLIDER_RADIUS;
    vertices[vertexOffset + 4] = y;
    vertices[vertexOffset + 5] = Math.cos(angle) * MOUNTAIN_VILLAGE_SUMMIT_COLLIDER_RADIUS;
    vertexOffset += 6;
  }

  for (let index = 0; index < segments; index += 1) {
    const inner = index * 2;
    const outer = inner + 1;
    const nextInner = ((index + 1) % segments) * 2;
    const nextOuter = nextInner + 1;
    indices[indexOffset] = inner;
    indices[indexOffset + 1] = outer;
    indices[indexOffset + 2] = nextInner;
    indices[indexOffset + 3] = outer;
    indices[indexOffset + 4] = nextOuter;
    indices[indexOffset + 5] = nextInner;
    indexOffset += 6;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}
