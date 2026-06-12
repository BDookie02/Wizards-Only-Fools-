import * as THREE from "three";

export function mergeSurvivalGrassGeometries(geometries: Array<THREE.BufferGeometry | null>, includeUv = false) {
  const entries: Array<{
    geometry: THREE.BufferGeometry;
    position: THREE.BufferAttribute;
    color: THREE.BufferAttribute;
    normal: THREE.BufferAttribute | null;
    bendWeight: THREE.BufferAttribute | null;
    uv: THREE.BufferAttribute | null;
    vertexOffset: number;
  }> = [];
  let vertexCount = 0;
  let indexCount = 0;
  let hasNormals = false;
  let hasBendWeights = false;

  for (let geometryIndex = 0; geometryIndex < geometries.length; geometryIndex += 1) {
    const geometry = geometries[geometryIndex];
    if (!geometry) continue;
    const positionAttribute = geometry.getAttribute("position");
    const colorAttribute = geometry.getAttribute("color");
    const normalAttribute = geometry.getAttribute("normal");
    const bendWeightAttribute = geometry.getAttribute("grassBendWeight");
    const uvAttribute = geometry.getAttribute("uv");
    if (!positionAttribute || !colorAttribute) continue;

    entries.push({
      geometry,
      position: positionAttribute as THREE.BufferAttribute,
      color: colorAttribute as THREE.BufferAttribute,
      normal: normalAttribute ? normalAttribute as THREE.BufferAttribute : null,
      bendWeight: bendWeightAttribute ? bendWeightAttribute as THREE.BufferAttribute : null,
      uv: includeUv && uvAttribute ? uvAttribute as THREE.BufferAttribute : null,
      vertexOffset: vertexCount,
    });
    hasNormals = hasNormals || Boolean(normalAttribute);
    hasBendWeights = hasBendWeights || Boolean(bendWeightAttribute);
    vertexCount += positionAttribute.count;
    indexCount += geometry.index?.count ?? positionAttribute.count;
  }

  if (vertexCount === 0 || indexCount === 0) return null;

  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const normals = hasNormals ? new Float32Array(vertexCount * 3) : null;
  const bendWeights = hasBendWeights ? new Float32Array(vertexCount) : null;
  const uvs = includeUv ? new Float32Array(vertexCount * 2) : null;
  const indices = new Uint32Array(indexCount);
  let indexOffset = 0;

  for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
    const entry = entries[entryIndex];
    positions.set(entry.position.array as ArrayLike<number>, entry.vertexOffset * 3);
    colors.set(entry.color.array as ArrayLike<number>, entry.vertexOffset * 3);
    if (normals) {
      if (entry.normal) {
        normals.set(entry.normal.array as ArrayLike<number>, entry.vertexOffset * 3);
      } else {
        for (let index = 0; index < entry.position.count; index += 1) {
          const offset = (entry.vertexOffset + index) * 3;
          normals[offset] = 0;
          normals[offset + 1] = 1;
          normals[offset + 2] = 0;
        }
      }
    }
    if (bendWeights) {
      if (entry.bendWeight) {
        bendWeights.set(entry.bendWeight.array as ArrayLike<number>, entry.vertexOffset);
      }
    }
    if (uvs && entry.uv) {
      uvs.set(entry.uv.array as ArrayLike<number>, entry.vertexOffset * 2);
    }

    if (entry.geometry.index) {
      const sourceIndex = entry.geometry.index.array as ArrayLike<number>;
      for (let index = 0; index < sourceIndex.length; index += 1) {
        indices[indexOffset + index] = sourceIndex[index] + entry.vertexOffset;
      }
      indexOffset += sourceIndex.length;
    } else {
      for (let index = 0; index < entry.position.count; index += 1) {
        indices[indexOffset + index] = entry.vertexOffset + index;
      }
      indexOffset += entry.position.count;
    }
  }

  const mergedGeometry = new THREE.BufferGeometry();
  mergedGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  mergedGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  if (normals) {
    mergedGeometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  }
  if (bendWeights) {
    mergedGeometry.setAttribute("grassBendWeight", new THREE.BufferAttribute(bendWeights, 1));
  }
  if (uvs) {
    mergedGeometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  }
  mergedGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
  mergedGeometry.computeBoundingSphere();
  return mergedGeometry;
}
