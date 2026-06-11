import * as THREE from "three";
import { smoothstepRange } from "../survival/survivalMath";

export function createSurvivalVertexColoredPlaneGeometry(
  widthSegments = 1,
  heightSegments = 1,
  bottomColor = "#ffffff",
  topColor = "#ffffff",
) {
  const geometry = new THREE.PlaneGeometry(1, 1, widthSegments, heightSegments);
  const positionCount = geometry.attributes.position.count;
  const colors = new Float32Array(positionCount * 3);
  const bottom = new THREE.Color(bottomColor);
  const top = new THREE.Color(topColor);
  const color = new THREE.Color();
  const position = geometry.attributes.position;

  for (let index = 0; index < positionCount; index += 1) {
    const y = position.getY(index) + 0.5;
    color.copy(bottom).lerp(top, smoothstepRange(0.05, 0.92, y));
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export function createSurvivalVertexColoredDiscGeometry(radius = 0.5, segments = 10) {
  const geometry = new THREE.CircleGeometry(radius, segments);
  const positionCount = geometry.attributes.position.count;
  const colors = new Float32Array(positionCount * 3);
  colors.fill(1);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function createSurvivalTutorialGrassTuftGeometry(bladeCount = 7) {
  const vertexCount = bladeCount * 5;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const bendWeights = new Float32Array(vertexCount);
  const indices = new Uint16Array(bladeCount * 9);
  let vertexOffset = 0;
  let indexOffset = 0;
  const baseColor = new THREE.Color("#3f8f2e");
  const midColor = new THREE.Color("#8ed84b");
  const tipColor = new THREE.Color("#d8f878");

  const pushVertex = (x: number, y: number, z: number, color: THREE.Color, bendWeight: number) => {
    const index = vertexOffset;
    const positionBase = index * 3;
    positions[positionBase] = x;
    positions[positionBase + 1] = y;
    positions[positionBase + 2] = z;
    colors[positionBase] = color.r;
    colors[positionBase + 1] = color.g;
    colors[positionBase + 2] = color.b;
    bendWeights[index] = bendWeight;
    vertexOffset += 1;
    return index;
  };

  for (let blade = 0; blade < bladeCount; blade += 1) {
    const t = bladeCount <= 1 ? 0 : blade / (bladeCount - 1);
    const angle = (t - 0.5) * Math.PI * 0.92 + (blade % 2 === 0 ? 0.18 : -0.12);
    const sideX = Math.cos(angle);
    const sideZ = -Math.sin(angle);
    const forwardX = Math.sin(angle);
    const forwardZ = Math.cos(angle);
    const fan = (t - 0.5) * 2;
    const baseScatter = Math.abs(fan) * 0.12;
    const baseX = forwardX * baseScatter + sideX * fan * 0.08;
    const baseZ = forwardZ * baseScatter + sideZ * fan * 0.08;
    const bladeWidth = 0.045 + (blade % 3) * 0.011;
    const bladeHeight = 0.74 + (blade % 4) * 0.07;
    const bend = 0.1 + Math.abs(fan) * 0.12;
    const leanX = forwardX * bend + sideX * fan * 0.055;
    const leanZ = forwardZ * bend + sideZ * fan * 0.055;

    const baseLeft = pushVertex(baseX - sideX * bladeWidth, 0, baseZ - sideZ * bladeWidth, baseColor, 0);
    const baseRight = pushVertex(baseX + sideX * bladeWidth, 0, baseZ + sideZ * bladeWidth, baseColor, 0);
    const midLeft = pushVertex(baseX + leanX * 0.48 - sideX * bladeWidth * 0.48, bladeHeight * 0.56, baseZ + leanZ * 0.48 - sideZ * bladeWidth * 0.48, midColor, 0.56);
    const midRight = pushVertex(baseX + leanX * 0.48 + sideX * bladeWidth * 0.48, bladeHeight * 0.56, baseZ + leanZ * 0.48 + sideZ * bladeWidth * 0.48, midColor, 0.56);
    const tip = pushVertex(baseX + leanX, bladeHeight, baseZ + leanZ, tipColor, 1);

    indices[indexOffset] = baseLeft;
    indices[indexOffset + 1] = midLeft;
    indices[indexOffset + 2] = baseRight;
    indices[indexOffset + 3] = baseRight;
    indices[indexOffset + 4] = midLeft;
    indices[indexOffset + 5] = midRight;
    indices[indexOffset + 6] = midLeft;
    indices[indexOffset + 7] = tip;
    indices[indexOffset + 8] = midRight;
    indexOffset += 9;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("grassBendWeight", new THREE.BufferAttribute(bendWeights, 1));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return geometry;
}

const cachedSurvivalTutorialGrassTuftGeometries = new Map<number, THREE.BufferGeometry>();

export function getSurvivalTutorialGrassTuftGeometry(bladeCount = 7) {
  const cached = cachedSurvivalTutorialGrassTuftGeometries.get(bladeCount);
  if (cached) return cached;
  const geometry = createSurvivalTutorialGrassTuftGeometry(bladeCount);
  cachedSurvivalTutorialGrassTuftGeometries.set(bladeCount, geometry);
  return geometry;
}

function createSurvivalLocalFlowerStarGeometry(petalCount = 7) {
  const positions = new Float32Array(petalCount * 5 * 3);
  const indices = new Uint16Array(petalCount * 9);
  let positionOffset = 0;
  let indexOffset = 0;
  let vertexOffset = 0;
  const innerRadius = 0.12;
  const sideRadius = 0.28;
  const tipRadius = 0.56;

  for (let petalIndex = 0; petalIndex < petalCount; petalIndex += 1) {
    const angle = (petalIndex / petalCount) * Math.PI * 2;
    const nextAngle = ((petalIndex + 1) / petalCount) * Math.PI * 2;
    const midAngle = (angle + nextAngle) * 0.5;
    const base = vertexOffset;
    positions[positionOffset] = Math.cos(angle) * innerRadius;
    positions[positionOffset + 1] = 0;
    positions[positionOffset + 2] = Math.sin(angle) * innerRadius;
    positions[positionOffset + 3] = Math.cos(angle) * sideRadius;
    positions[positionOffset + 4] = 0;
    positions[positionOffset + 5] = Math.sin(angle) * sideRadius;
    positions[positionOffset + 6] = Math.cos(midAngle) * tipRadius;
    positions[positionOffset + 7] = 0;
    positions[positionOffset + 8] = Math.sin(midAngle) * tipRadius;
    positions[positionOffset + 9] = Math.cos(nextAngle) * sideRadius;
    positions[positionOffset + 10] = 0;
    positions[positionOffset + 11] = Math.sin(nextAngle) * sideRadius;
    positions[positionOffset + 12] = Math.cos(nextAngle) * innerRadius;
    positions[positionOffset + 13] = 0;
    positions[positionOffset + 14] = Math.sin(nextAngle) * innerRadius;
    positionOffset += 15;
    vertexOffset += 5;

    indices[indexOffset] = base;
    indices[indexOffset + 1] = base + 1;
    indices[indexOffset + 2] = base + 2;
    indices[indexOffset + 3] = base;
    indices[indexOffset + 4] = base + 2;
    indices[indexOffset + 5] = base + 4;
    indices[indexOffset + 6] = base + 4;
    indices[indexOffset + 7] = base + 2;
    indices[indexOffset + 8] = base + 3;
    indexOffset += 9;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

const cachedSurvivalLocalFlowerStarGeometries = new Map<number, THREE.BufferGeometry>();

export function getSurvivalLocalFlowerStarGeometry(petalCount = 7) {
  const cached = cachedSurvivalLocalFlowerStarGeometries.get(petalCount);
  if (cached) return cached;
  const geometry = createSurvivalLocalFlowerStarGeometry(petalCount);
  cachedSurvivalLocalFlowerStarGeometries.set(petalCount, geometry);
  return geometry;
}

let cachedSurvivalBotwGrassClusterGeometry: THREE.BufferGeometry | null = null;

export function getSurvivalBotwGrassClusterGeometry() {
  if (cachedSurvivalBotwGrassClusterGeometry) return cachedSurvivalBotwGrassClusterGeometry;

  const cardCount = 4;
  const vertexCount = cardCount * 4;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const bendWeights = new Float32Array(vertexCount);
  const indices = new Uint16Array(cardCount * 6);
  let vertexOffset = 0;
  let indexOffset = 0;
  const rootColor = new THREE.Color("#85d24a");
  const tipColor = new THREE.Color("#f0ff90");

  const addVertex = (x: number, y: number, z: number, u: number, v: number, color: THREE.Color, bendWeight: number) => {
    const index = vertexOffset;
    const positionBase = index * 3;
    const uvBase = index * 2;
    positions[positionBase] = x;
    positions[positionBase + 1] = y;
    positions[positionBase + 2] = z;
    colors[positionBase] = color.r;
    colors[positionBase + 1] = color.g;
    colors[positionBase + 2] = color.b;
    uvs[uvBase] = u;
    uvs[uvBase + 1] = v;
    bendWeights[index] = bendWeight;
    vertexOffset += 1;
    return index;
  };

  for (let card = 0; card < cardCount; card += 1) {
    const angle = (card / cardCount) * Math.PI;
    const sideX = Math.cos(angle);
    const sideZ = Math.sin(angle);
    const width = card % 2 === 0 ? 0.72 : 0.58;
    const base = vertexOffset;
    addVertex(-sideX * width, 0, -sideZ * width, 0, 0, rootColor, 0);
    addVertex(sideX * width, 0, sideZ * width, 1, 0, rootColor, 0);
    addVertex(-sideX * width * 0.78, 1, -sideZ * width * 0.78, 0, 1, tipColor, 1);
    addVertex(sideX * width * 0.78, 1, sideZ * width * 0.78, 1, 1, tipColor, 1);
    indices[indexOffset] = base;
    indices[indexOffset + 1] = base + 2;
    indices[indexOffset + 2] = base + 1;
    indices[indexOffset + 3] = base + 1;
    indices[indexOffset + 4] = base + 2;
    indices[indexOffset + 5] = base + 3;
    indexOffset += 6;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute("grassBendWeight", new THREE.BufferAttribute(bendWeights, 1));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  cachedSurvivalBotwGrassClusterGeometry = geometry;
  return geometry;
}

let cachedSurvivalBotwFlowerPetalGeometry: THREE.BufferGeometry | null = null;

export function getSurvivalBotwFlowerPetalGeometry() {
  if (cachedSurvivalBotwFlowerPetalGeometry) return cachedSurvivalBotwFlowerPetalGeometry;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, 0,
    -0.34, 0, 0.34,
    0, 0, 1,
    0.34, 0, 0.34,
  ], 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute([
    0.5, 0,
    0.08, 0.38,
    0.5, 1,
    0.92, 0.38,
  ], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  cachedSurvivalBotwFlowerPetalGeometry = geometry;
  return geometry;
}

let cachedSurvivalBotwFlowerHeadGeometry: THREE.BufferGeometry | null = null;

export function getSurvivalBotwFlowerHeadGeometry() {
  if (cachedSurvivalBotwFlowerHeadGeometry) return cachedSurvivalBotwFlowerHeadGeometry;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    -0.5, -0.5, 0,
    0.5, -0.5, 0,
    0.5, 0.5, 0,
    -0.5, 0.5, 0,
  ], 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute([
    0, 0,
    1, 0,
    1, 1,
    0, 1,
  ], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  cachedSurvivalBotwFlowerHeadGeometry = geometry;
  return geometry;
}

const cachedSurvivalBotwFlowerFaceGeometries = new Map<number, THREE.BufferGeometry>();

export function getSurvivalBotwFlowerFaceGeometry(petalCount = 5) {
  const cached = cachedSurvivalBotwFlowerFaceGeometries.get(petalCount);
  if (cached) return cached;

  const innerRadius = 0.055;
  const petalLength = petalCount >= 7 ? 0.44 : petalCount <= 4 ? 0.52 : 0.5;
  const petalWidth = petalCount >= 7 ? 0.12 : petalCount <= 4 ? 0.16 : 0.14;
  const arcSegments = 8;
  const centerSegments = Math.max(8, petalCount * 2);
  const petalVertexCount = petalCount * (arcSegments + 2);
  const vertexCount = petalVertexCount + centerSegments + 1;
  const petalIndexCount = petalCount * arcSegments * 3;
  const centerIndexCount = centerSegments * 3;
  const positions = new Float32Array(vertexCount * 3);
  const indices = new Uint16Array(petalIndexCount + centerIndexCount);
  let vertexOffset = 0;
  let positionOffset = 0;
  let indexOffset = 0;

  for (let petal = 0; petal < petalCount; petal += 1) {
    const angle = (petal / petalCount) * Math.PI * 2;
    const radialX = Math.cos(angle);
    const radialY = Math.sin(angle);
    const tangent = angle + Math.PI * 0.5;
    const base = vertexOffset;
    positions[positionOffset] = radialX * innerRadius;
    positions[positionOffset + 1] = radialY * innerRadius;
    positions[positionOffset + 2] = 0;
    positionOffset += 3;
    vertexOffset += 1;

    for (let segment = 0; segment <= arcSegments; segment += 1) {
      const t = segment / arcSegments;
      const arc = -Math.PI * 0.5 + t * Math.PI;
      const petalForward = innerRadius + Math.cos(arc) * petalLength;
      const petalSide = Math.sin(arc) * petalWidth * (0.72 + Math.cos(arc) * 0.28);
      positions[positionOffset] = radialX * petalForward + Math.cos(tangent) * petalSide;
      positions[positionOffset + 1] = radialY * petalForward + Math.sin(tangent) * petalSide;
      positions[positionOffset + 2] = 0;
      positionOffset += 3;
      vertexOffset += 1;
    }

    for (let segment = 0; segment < arcSegments; segment += 1) {
      indices[indexOffset] = base;
      indices[indexOffset + 1] = base + segment + 1;
      indices[indexOffset + 2] = base + segment + 2;
      indexOffset += 3;
    }
  }

  const centerBase = vertexOffset;
  positions[positionOffset] = 0;
  positions[positionOffset + 1] = 0;
  positions[positionOffset + 2] = 0.002;
  positionOffset += 3;
  vertexOffset += 1;
  for (let segment = 0; segment < centerSegments; segment += 1) {
    const angle = (segment / centerSegments) * Math.PI * 2;
    positions[positionOffset] = Math.cos(angle) * 0.105;
    positions[positionOffset + 1] = Math.sin(angle) * 0.105;
    positions[positionOffset + 2] = 0.002;
    positionOffset += 3;
    vertexOffset += 1;
  }
  for (let segment = 0; segment < centerSegments; segment += 1) {
    indices[indexOffset] = centerBase;
    indices[indexOffset + 1] = centerBase + 1 + segment;
    indices[indexOffset + 2] = centerBase + 1 + ((segment + 1) % centerSegments);
    indexOffset += 3;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  cachedSurvivalBotwFlowerFaceGeometries.set(petalCount, geometry);
  return geometry;
}

let cachedSurvivalBotwFlowerHeadTexture: THREE.CanvasTexture | null = null;

export function getSurvivalBotwFlowerHeadTexture() {
  if (cachedSurvivalBotwFlowerHeadTexture) return cachedSurvivalBotwFlowerHeadTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    for (let petal = 0; petal < 6; petal += 1) {
      const angle = (petal / 6) * Math.PI * 2;
      const x = 48 + Math.cos(angle) * 19;
      const y = 48 + Math.sin(angle) * 19;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(48, 48, 11, 0, Math.PI * 2);
    ctx.fill();

    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      if (pixels.data[index + 3] < 8) {
        pixels.data[index] = 255;
        pixels.data[index + 1] = 255;
        pixels.data[index + 2] = 255;
      }
    }
    ctx.putImageData(pixels, 0, 0);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  cachedSurvivalBotwFlowerHeadTexture = texture;
  return texture;
}
