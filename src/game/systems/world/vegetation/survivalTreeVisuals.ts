import * as THREE from "three";
import type { SurvivalBiome } from "../../../../store/gameStore";
import { clamp01, survivalHash01 } from "../survival/survivalMath";
import {
  SURVIVAL_ROOF_FOREST_CANOPY_COLORS,
  SURVIVAL_TREE_CANOPY_COLORS,
  SURVIVAL_TREE_TRUNK_COLORS,
} from "./survivalFoliagePalettes";

export const SURVIVAL_SOLID_TREE_VARIANT_COUNT = 4;

type SurvivalSolidTreeGeometryBuffers = {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
};

export type SurvivalTreeCanopySource = {
  y: number;
  scale: number;
};

let cachedSurvivalSolidTreeTexture: THREE.CanvasTexture | null = null;
const cachedSurvivalSolidTreeGeometries = new Map<string, THREE.BufferGeometry>();

export function supportsRoofForest(biome: SurvivalBiome) {
  return biome === "plains" || biome === "jungle" || biome === "mushroom";
}

export function getSurvivalTreeVisualScale(biome: SurvivalBiome, propScale: number) {
  const giantScale = 5;
  if (biome === "jungle") return Math.min(18.75, (1.24 + propScale * 0.62) * giantScale);
  if (biome === "swamp") return Math.min(15.25, (1.12 + propScale * 0.54) * giantScale);
  if (biome === "mushroom") return Math.min(15, (1.05 + propScale * 0.48) * giantScale);
  return Math.min(13.75, (1.05 + propScale * 0.48) * giantScale);
}

export function getFastGroveTreeProfile(biome: SurvivalBiome, variant: number) {
  if (biome === "jungle") {
    return {
      trunkHeight: 88 + variant * 72,
      trunkRadius: 1.7 + variant * 1.25,
      canopyRadius: 13 + variant * 10,
      canopyHeight: 10 + variant * 8,
    };
  }
  if (biome === "swamp") {
    return {
      trunkHeight: 54 + variant * 42,
      trunkRadius: 1.45 + variant * 1.05,
      canopyRadius: 9 + variant * 7,
      canopyHeight: 7 + variant * 5,
    };
  }
  if (biome === "mushroom") {
    return {
      trunkHeight: 26 + variant * 22,
      trunkRadius: 1.35 + variant * 0.9,
      canopyRadius: 9 + variant * 8,
      canopyHeight: 5.5 + variant * 4,
    };
  }
  if (biome === "desert") {
    return {
      trunkHeight: 34 + variant * 28,
      trunkRadius: 0.9 + variant * 0.55,
      canopyRadius: 6.5 + variant * 5,
      canopyHeight: 3.2 + variant * 2.6,
    };
  }
  return {
    trunkHeight: 46 + variant * 38,
    trunkRadius: 1.25 + variant * 0.9,
    canopyRadius: 9.5 + variant * 7,
    canopyHeight: 7 + variant * 5,
  };
}

export function getSurvivalTreeFootprintScale(biome: SurvivalBiome, visualScale: number) {
  if (biome === "jungle") return visualScale * 0.24;
  if (biome === "swamp") return visualScale * 0.3;
  if (biome === "mushroom") return visualScale * 0.42;
  return visualScale * 0.32;
}

export function getSurvivalSolidTreeTexture() {
  if (cachedSurvivalSolidTreeTexture) return cachedSurvivalSolidTreeTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#f3dfbd";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let x = 0; x < canvas.width; x += 8) {
      const columnShade = survivalHash01(x, 11, 18910);
      ctx.fillStyle = columnShade > 0.68
        ? "rgba(255,255,255,0.16)"
        : columnShade > 0.34
          ? "rgba(0,0,0,0.08)"
          : "rgba(94,45,18,0.18)";
      ctx.fillRect(x, 0, 4 + Math.floor(columnShade * 5), canvas.height);
    }

    for (let y = 0; y < canvas.height; y += 8) {
      for (let x = 0; x < canvas.width; x += 8) {
        const chip = survivalHash01(x, y, 18920);
        if (chip > 0.78) {
          ctx.fillStyle = "rgba(255,246,211,0.24)";
          ctx.fillRect(x + 1, y + 1, 4, 2);
        } else if (chip < 0.18) {
          ctx.fillStyle = "rgba(66,28,12,0.2)";
          ctx.fillRect(x + 2, y + 3, 3, 3);
        }
      }
    }

    for (let crack = 0; crack < 12; crack += 1) {
      const baseX = Math.floor(survivalHash01(crack, 3, 18930) * canvas.width);
      const width = survivalHash01(crack, 4, 18931) > 0.68 ? 3 : 2;
      ctx.fillStyle = survivalHash01(crack, 5, 18932) > 0.44
        ? "rgba(35,16,8,0.48)"
        : "rgba(75,33,14,0.32)";
      for (let y = -8; y < canvas.height; y += 8) {
        const wobble = Math.floor((survivalHash01(crack, y, 18933) - 0.5) * 6);
        const h = 5 + Math.floor(survivalHash01(crack, y, 18934) * 8);
        ctx.fillRect((baseX + wobble + canvas.width) % canvas.width, y, width, h);
      }
    }

    for (let knot = 0; knot < 7; knot += 1) {
      const x = 7 + Math.floor(survivalHash01(knot, 13, 18940) * (canvas.width - 14));
      const y = 8 + Math.floor(survivalHash01(knot, 17, 18941) * (canvas.height - 16));
      const w = 6 + Math.floor(survivalHash01(knot, 19, 18942) * 6);
      const h = 4 + Math.floor(survivalHash01(knot, 23, 18943) * 5);
      ctx.fillStyle = "rgba(59,28,13,0.42)";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(246,214,163,0.18)";
      ctx.fillRect(x + 1, y + 1, Math.max(2, w - 3), 1);
      ctx.fillStyle = "rgba(22,10,5,0.36)";
      ctx.fillRect(x + Math.floor(w * 0.35), y + Math.floor(h * 0.45), Math.max(2, Math.floor(w * 0.34)), 1);
    }

    for (let y = 0; y < canvas.height; y += 16) {
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(0, y, canvas.width, 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.8, 2.6);
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  cachedSurvivalSolidTreeTexture = texture;
  return texture;
}

function appendSurvivalSolidTreeGeometry(
  buffers: SurvivalSolidTreeGeometryBuffers,
  source: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  baseColor: THREE.Color,
  darkFacetEvery = 0,
) {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  geometry.applyMatrix4(matrix);
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");

  for (let i = 0; i < position.count; i += 1) {
    buffers.positions.push(position.getX(i), position.getY(i), position.getZ(i));
    if (normal) {
      buffers.normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
    } else {
      buffers.normals.push(0, 1, 0);
    }
    if (uv) {
      buffers.uvs.push(uv.getX(i), uv.getY(i));
    } else {
      buffers.uvs.push(0, 0);
    }

    const face = Math.floor(i / 3);
    const shade = 0.82 + survivalHash01(face, position.count, 8800) * 0.28;
    const lineShade = darkFacetEvery > 0 && face % darkFacetEvery === 0 ? 0.58 : 1;
    buffers.colors.push(
      clamp01(baseColor.r * shade * lineShade),
      clamp01(baseColor.g * shade * lineShade),
      clamp01(baseColor.b * shade * lineShade),
    );
  }

  geometry.dispose();
}

export function makeSurvivalSolidTreeGeometry(biome: SurvivalBiome, variantIndex = 0) {
  const variantKey = `${biome}:${variantIndex}`;
  const cached = cachedSurvivalSolidTreeGeometries.get(variantKey);
  if (cached) return cached;

  const buffers: SurvivalSolidTreeGeometryBuffers = {
    positions: [],
    normals: [],
    uvs: [],
    colors: [],
  };
  const trunkColor = new THREE.Color(SURVIVAL_TREE_TRUNK_COLORS[biome]);
  const canopyColors = SURVIVAL_ROOF_FOREST_CANOPY_COLORS[biome] ?? [
    SURVIVAL_TREE_CANOPY_COLORS[biome][0],
    SURVIVAL_TREE_CANOPY_COLORS[biome][1],
    SURVIVAL_TREE_CANOPY_COLORS[biome][0],
  ];
  const variantShape = variantIndex % SURVIVAL_SOLID_TREE_VARIANT_COUNT;
  const trunkGeometry = new THREE.CylinderGeometry(0.82 + variantShape * 0.05, 1.18 + variantShape * 0.08, 1, 5 + (variantShape % 2), 1);
  const branchGeometry = new THREE.CylinderGeometry(1, 1, 1, 5, 1);
  const leafGeometry = new THREE.DodecahedronGeometry(1, 0);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const positionScratch = new THREE.Vector3();
  const scaleScratch = new THREE.Vector3();
  const branchStartScratch = new THREE.Vector3();
  const branchEndScratch = new THREE.Vector3();
  const branchDirectionScratch = new THREE.Vector3();
  const branchMidpointScratch = new THREE.Vector3();
  const colorScratch = new THREE.Color();
  const lobeEulerScratch = new THREE.Euler();
  const lobeColorScratch = new THREE.Color();

  matrix.compose(
    positionScratch.set(0, -0.055, 0),
    quaternion,
    scaleScratch.set(0.12 + variantShape * 0.01, 0.2 + variantShape * 0.025, 0.112 + variantShape * 0.008),
  );
  appendSurvivalSolidTreeGeometry(buffers, trunkGeometry, matrix, colorScratch.copy(trunkColor).multiplyScalar(0.82), 4);

  matrix.compose(
    positionScratch.set(0, 0.5, 0),
    quaternion,
    scaleScratch.set(0.082 + variantShape * 0.009, 0.92 + variantShape * 0.08, 0.078 + variantShape * 0.006),
  );
  appendSurvivalSolidTreeGeometry(buffers, trunkGeometry, matrix, trunkColor, 5);

  const branchCount = 3 + (variantShape % 2) + (variantShape === 3 ? 1 : 0);
  for (let index = 0; index < branchCount; index += 1) {
    const angle = variantShape * 0.56 + index * (Math.PI * 2 / branchCount);
    const startY = 0.54 + index * 0.1 + variantShape * 0.025;
    const reach = 0.24 + variantShape * 0.035 + (index % 2) * 0.06;
    const radius = 0.034 - index * 0.003 + variantShape * 0.002;
    branchStartScratch.set(0, startY, 0);
    branchEndScratch.set(Math.sin(angle) * reach, startY + 0.24 + index * 0.025, Math.cos(angle) * reach);
    branchDirectionScratch.subVectors(branchEndScratch, branchStartScratch);
    const length = branchDirectionScratch.length();
    branchMidpointScratch.addVectors(branchStartScratch, branchEndScratch).multiplyScalar(0.5);
    quaternion.setFromUnitVectors(up, branchDirectionScratch.normalize());
    matrix.compose(branchMidpointScratch, quaternion, scaleScratch.set(radius, length, radius));
    appendSurvivalSolidTreeGeometry(buffers, branchGeometry, matrix, colorScratch.copy(trunkColor).multiplyScalar(0.88 + index * 0.04), 4);
  }

  const lobeCount = 5 + variantShape;
  quaternion.setFromEuler(lobeEulerScratch.set(variantShape * 0.025, variantShape * 0.3, 0));
  matrix.compose(
    positionScratch.set(0, 1.05 + variantShape * 0.04, 0),
    quaternion,
    scaleScratch.set(0.56 + variantShape * 0.035, 0.25 + variantShape * 0.018, 0.54 + variantShape * 0.025),
  );
  appendSurvivalSolidTreeGeometry(buffers, leafGeometry, matrix, lobeColorScratch.set(canopyColors[0]), 3);

  for (let index = 0; index < lobeCount - 1; index += 1) {
    const lobeIndex = index + 1;
    const angle = variantShape * 0.7 + index * (Math.PI * 2 / (lobeCount - 1));
    const outward = 0.24 + survivalHash01(variantShape, index, 8820) * 0.2;
    const lift = 0.9 + survivalHash01(variantShape, index, 8830) * (0.34 + variantShape * 0.035);
    const width = 0.26 + survivalHash01(variantShape, index, 8840) * 0.18;
    quaternion.setFromEuler(lobeEulerScratch.set(0.06 * lobeIndex + variantShape * 0.025, lobeIndex * 0.62 + variantShape * 0.3, -0.05 * lobeIndex));
    matrix.compose(
      positionScratch.set(Math.sin(angle) * outward, lift, Math.cos(angle) * outward),
      quaternion,
      scaleScratch.set(width * (1.18 + variantShape * 0.06), 0.17 + survivalHash01(variantShape, index, 8850) * 0.1, width),
    );
    appendSurvivalSolidTreeGeometry(buffers, leafGeometry, matrix, lobeColorScratch.set(canopyColors[(index + variantShape) % canopyColors.length]), 3);
  }

  trunkGeometry.dispose();
  branchGeometry.dispose();
  leafGeometry.dispose();

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(buffers.normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(buffers.uvs, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(buffers.colors, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  cachedSurvivalSolidTreeGeometries.set(variantKey, geometry);
  return geometry;
}

export function getSurvivalTreeCanopyY(biome: SurvivalBiome, prop: SurvivalTreeCanopySource) {
  const visualScale = getSurvivalTreeVisualScale(biome, prop.scale);
  if (biome === "jungle") return prop.y + 34 * visualScale;
  if (biome === "swamp") return prop.y + 25 * visualScale;
  if (biome === "mushroom") return prop.y + 8 * visualScale;
  return prop.y + 20 * visualScale;
}
