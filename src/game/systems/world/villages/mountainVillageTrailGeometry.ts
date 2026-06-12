import * as THREE from "three";
import type { MountainVillageTrailPoint } from "./mountainVillageLayoutRuntime";

function getMountainVillageTrailFrame(points: MountainVillageTrailPoint[], index: number) {
  const previous = points[Math.max(0, index - 1)];
  const next = points[Math.min(points.length - 1, index + 1)];
  const dx = next.localX - previous.localX;
  const dz = next.localZ - previous.localZ;
  const yaw = Math.atan2(dx, dz);

  return {
    rightX: Math.cos(yaw),
    rightZ: -Math.sin(yaw),
  };
}

export function makeMountainVillageTrailSurfaceGeometry(
  points: MountainVillageTrailPoint[],
  widthScale: number,
  yOffset: number,
) {
  const vertexCount = points.length * 2;
  const segmentCount = Math.max(0, points.length - 1);
  const vertices = new Float32Array(vertexCount * 3);
  const indices = vertexCount > 65535 ? new Uint32Array(segmentCount * 6) : new Uint16Array(segmentCount * 6);
  let vertexOffset = 0;
  let indexOffset = 0;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const { rightX, rightZ } = getMountainVillageTrailFrame(points, index);
    const halfWidth = point.width * widthScale * 0.5;
    const y = point.y + yOffset;

    vertices[vertexOffset] = point.localX - rightX * halfWidth;
    vertices[vertexOffset + 1] = y;
    vertices[vertexOffset + 2] = point.localZ - rightZ * halfWidth;
    vertices[vertexOffset + 3] = point.localX + rightX * halfWidth;
    vertices[vertexOffset + 4] = y;
    vertices[vertexOffset + 5] = point.localZ + rightZ * halfWidth;
    vertexOffset += 6;
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const left = index * 2;
    const right = left + 1;
    const nextLeft = left + 2;
    const nextRight = left + 3;

    indices[indexOffset] = left;
    indices[indexOffset + 1] = nextLeft;
    indices[indexOffset + 2] = right;
    indices[indexOffset + 3] = right;
    indices[indexOffset + 4] = nextLeft;
    indices[indexOffset + 5] = nextRight;
    indexOffset += 6;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

export function makeMountainVillageTrailDeckGeometry(points: MountainVillageTrailPoint[]) {
  const vertexCount = points.length * 4;
  const segmentCount = Math.max(0, points.length - 1);
  const vertices = new Float32Array(vertexCount * 3);
  const indices = vertexCount > 65535
    ? new Uint32Array(segmentCount * 24 + 12)
    : new Uint16Array(segmentCount * 24 + 12);
  let vertexOffset = 0;
  let indexOffset = 0;
  const topOffset = 0.46;
  const bottomOffset = -0.42;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const { rightX, rightZ } = getMountainVillageTrailFrame(points, index);
    const halfWidth = point.width * 0.5;
    const leftX = point.localX - rightX * halfWidth;
    const leftZ = point.localZ - rightZ * halfWidth;
    const rightXPos = point.localX + rightX * halfWidth;
    const rightZPos = point.localZ + rightZ * halfWidth;

    vertices[vertexOffset] = leftX;
    vertices[vertexOffset + 1] = point.y + topOffset;
    vertices[vertexOffset + 2] = leftZ;
    vertices[vertexOffset + 3] = rightXPos;
    vertices[vertexOffset + 4] = point.y + topOffset;
    vertices[vertexOffset + 5] = rightZPos;
    vertices[vertexOffset + 6] = leftX;
    vertices[vertexOffset + 7] = point.y + bottomOffset;
    vertices[vertexOffset + 8] = leftZ;
    vertices[vertexOffset + 9] = rightXPos;
    vertices[vertexOffset + 10] = point.y + bottomOffset;
    vertices[vertexOffset + 11] = rightZPos;
    vertexOffset += 12;
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const base = index * 4;
    const nextBase = base + 4;
    const topLeft = base;
    const topRight = base + 1;
    const bottomLeft = base + 2;
    const bottomRight = base + 3;
    const nextTopLeft = nextBase;
    const nextTopRight = nextBase + 1;
    const nextBottomLeft = nextBase + 2;
    const nextBottomRight = nextBase + 3;

    indices[indexOffset] = topLeft;
    indices[indexOffset + 1] = nextTopLeft;
    indices[indexOffset + 2] = topRight;
    indices[indexOffset + 3] = topRight;
    indices[indexOffset + 4] = nextTopLeft;
    indices[indexOffset + 5] = nextTopRight;
    indices[indexOffset + 6] = bottomLeft;
    indices[indexOffset + 7] = bottomRight;
    indices[indexOffset + 8] = nextBottomLeft;
    indices[indexOffset + 9] = bottomRight;
    indices[indexOffset + 10] = nextBottomRight;
    indices[indexOffset + 11] = nextBottomLeft;
    indices[indexOffset + 12] = topLeft;
    indices[indexOffset + 13] = bottomLeft;
    indices[indexOffset + 14] = nextTopLeft;
    indices[indexOffset + 15] = bottomLeft;
    indices[indexOffset + 16] = nextBottomLeft;
    indices[indexOffset + 17] = nextTopLeft;
    indices[indexOffset + 18] = topRight;
    indices[indexOffset + 19] = nextTopRight;
    indices[indexOffset + 20] = bottomRight;
    indices[indexOffset + 21] = bottomRight;
    indices[indexOffset + 22] = nextTopRight;
    indices[indexOffset + 23] = nextBottomRight;
    indexOffset += 24;
  }

  const first = 0;
  const last = (points.length - 1) * 4;
  indices[indexOffset] = first;
  indices[indexOffset + 1] = first + 1;
  indices[indexOffset + 2] = first + 2;
  indices[indexOffset + 3] = first + 1;
  indices[indexOffset + 4] = first + 3;
  indices[indexOffset + 5] = first + 2;
  indices[indexOffset + 6] = last;
  indices[indexOffset + 7] = last + 2;
  indices[indexOffset + 8] = last + 1;
  indices[indexOffset + 9] = last + 1;
  indices[indexOffset + 10] = last + 2;
  indices[indexOffset + 11] = last + 3;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}
