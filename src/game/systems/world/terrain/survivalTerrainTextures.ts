import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import {
  getSurvivalBiomeWeights,
  isSurvivalGrasslandTerrainBiome,
  isSurvivalRestoredMeadowWaterSuppressed,
} from "../survival/survivalBiome";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";

let cachedDesertSandTexture: THREE.CanvasTexture | null = null;
let cachedSurvivalTerrainDetailTexture: THREE.CanvasTexture | null = null;
let cachedSurvivalGrasslandTerrainDetailTexture: THREE.CanvasTexture | null = null;
let cachedMountainVillageTerrainDetailTexture: THREE.CanvasTexture | null = null;
let cachedDesertAdobeWallTexture: THREE.CanvasTexture | null = null;

function survivalTextureHash01(x: number, z: number, salt = 0) {
  const n = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function getDesertSandTexture() {
  if (cachedDesertSandTexture) return cachedDesertSandTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#fff8e5";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const waveA = Math.sin((x * 0.17) + (y * 0.055));
        const waveB = Math.sin((x * 0.055) - (y * 0.18));
        const ridge = Math.abs(((x + y * 0.46 + waveA * 9 + waveB * 4) % 34) - 17);
        const grain = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const speckle = grain - Math.floor(grain);

        if (ridge < 2.2) {
          ctx.fillStyle = "#fff0cc";
          ctx.fillRect(x, y, 2, 2);
        } else if (ridge < 5.8) {
          ctx.fillStyle = "#f6d8b1";
          ctx.fillRect(x, y, 2, 2);
        } else if (ridge > 14.8 && ridge < 17.8) {
          ctx.fillStyle = "#ecc59e";
          ctx.fillRect(x, y, 2, 2);
        } else if (speckle > 0.988) {
          ctx.fillStyle = "#f2d7b5";
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }

    for (let stripe = -canvas.height; stripe < canvas.width + canvas.height; stripe += 22) {
      ctx.fillStyle = "rgba(255, 243, 217, 0.35)";
      for (let y = 0; y < canvas.height; y += 4) {
        const x = stripe + y * 0.48 + Math.sin(y * 0.18) * 5;
        ctx.fillRect(Math.round(x / 2) * 2, y, 4, 4);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  cachedDesertSandTexture = texture;
  return texture;
}

export function getSurvivalTerrainDetailTexture() {
  if (cachedSurvivalTerrainDetailTexture) return cachedSurvivalTerrainDetailTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const fiber = Math.sin(x * 0.31 + y * 0.12) + Math.cos(y * 0.27 - x * 0.08);
        const shortBlade = Math.sin(x * 0.72 + y * 0.41) * Math.cos(y * 0.36);
        const grain = Math.sin(x * 19.19 + y * 73.31) * 43758.5453;
        const speckle = grain - Math.floor(grain);

        if (fiber > 0.98 && speckle > 0.58) {
          ctx.fillStyle = "#f3f7eb";
          ctx.fillRect(x, y, 1, 1);
        } else if (shortBlade > 0.68 && speckle > 0.68) {
          ctx.fillStyle = "#f8fbf2";
          ctx.fillRect(x, y, 1, 1);
        } else if (fiber < -1.24 && speckle > 0.68) {
          ctx.fillStyle = "#edf3e1";
          ctx.fillRect(x, y, 1, 1);
        } else if (speckle > 0.992) {
          ctx.fillStyle = "#f1f6e8";
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(9, 9);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  cachedSurvivalTerrainDetailTexture = texture;
  return texture;
}

export function getMountainVillageTerrainDetailTexture() {
  if (cachedMountainVillageTerrainDetailTexture) return cachedMountainVillageTerrainDetailTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#f4f7ec";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const contour = Math.abs(((y + Math.sin(x * 0.07) * 9 + Math.sin((x + y) * 0.025) * 13) % 34) - 17);
        const scratch = Math.sin(x * 0.21 + y * 0.09) + Math.cos(y * 0.18 - x * 0.06);
        const grain = Math.sin(x * 17.13 + y * 63.77) * 43758.5453;
        const speckle = grain - Math.floor(grain);

        if (contour < 1.35) {
          ctx.fillStyle = "rgba(88, 98, 70, 0.1)";
          ctx.fillRect(x, y, 2, 2);
        } else if (contour < 3.2 && speckle > 0.38) {
          ctx.fillStyle = "rgba(112, 126, 82, 0.06)";
          ctx.fillRect(x, y, 2, 2);
        } else if (scratch > 1.38 && speckle > 0.42) {
          ctx.fillStyle = "rgba(255, 255, 242, 0.12)";
          ctx.fillRect(x, y, 2, 2);
        } else if (scratch < -1.32 && speckle > 0.42) {
          ctx.fillStyle = "rgba(61, 71, 52, 0.08)";
          ctx.fillRect(x, y, 2, 2);
        } else if (speckle > 0.988) {
          ctx.fillStyle = "rgba(66, 75, 58, 0.1)";
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }

    for (let streak = 0; streak < 72; streak += 1) {
      const baseX = survivalTextureHash01(streak, 0, 61700) * canvas.width;
      const baseY = survivalTextureHash01(streak, 1, 61701) * canvas.height;
      const length = 18 + survivalTextureHash01(streak, 2, 61702) * 38;
      const drift = (survivalTextureHash01(streak, 3, 61703) - 0.5) * 18;
      ctx.strokeStyle = survivalTextureHash01(streak, 4, 61704) > 0.52
        ? "rgba(81, 103, 62, 0.08)"
        : "rgba(127, 118, 78, 0.07)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo((baseX + drift + canvas.width) % canvas.width, (baseY + length) % canvas.height);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 9);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  cachedMountainVillageTerrainDetailTexture = texture;
  return texture;
}

export function getSurvivalGrasslandTerrainDetailTexture() {
  if (cachedSurvivalGrasslandTerrainDetailTexture) return cachedSurvivalGrasslandTerrainDetailTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = "#93b96b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let grain = 0; grain < canvas.width * canvas.height * 0.42; grain += 1) {
      const x = Math.floor(survivalTextureHash01(grain, 0, 21900) * canvas.width);
      const y = Math.floor(survivalTextureHash01(grain, 1, 21901) * canvas.height);
      const shade = survivalTextureHash01(grain, 2, 21902);
      ctx.fillStyle = shade > 0.72
        ? "rgba(120,164,74,0.12)"
        : shade > 0.38
          ? "rgba(84,139,55,0.12)"
          : "rgba(103,154,65,0.1)";
      ctx.fillRect(x, y, 1, 1);
    }

    for (let fiber = 0; fiber < 1600; fiber += 1) {
      const baseX = survivalTextureHash01(fiber, 0, 22000) * canvas.width;
      const baseY = survivalTextureHash01(fiber, 1, 22001) * canvas.height;
      const length = 2 + survivalTextureHash01(fiber, 2, 22002) * 5;
      const angle = -Math.PI * 0.5 + (survivalTextureHash01(fiber, 3, 22003) - 0.5) * 1.4;
      const shade = survivalTextureHash01(fiber, 4, 22004);
      ctx.strokeStyle = shade > 0.68
        ? "rgba(111,164,67,0.12)"
        : shade > 0.32
          ? "rgba(137,184,82,0.12)"
          : "rgba(69,126,45,0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(
        (baseX + Math.cos(angle) * length + canvas.width) % canvas.width,
        (baseY + Math.sin(angle) * length + canvas.height) % canvas.height,
      );
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  cachedSurvivalGrasslandTerrainDetailTexture = texture;
  return texture;
}

export function getSurvivalTerrainDetailTextureForChunk(chunk: SurvivalChunkInfo) {
  if (isSurvivalRestoredMeadowWaterSuppressed(chunk.x, chunk.z, SURVIVAL_BLOCK_SIZE * 0.72)) {
    return getSurvivalGrasslandTerrainDetailTexture();
  }

  const centerWeights = getSurvivalBiomeWeights(chunk.x, chunk.z);
  let grasslandWeight = 0;
  for (let index = 0; index < centerWeights.length; index++) {
    const { biome, weight } = centerWeights[index];
    if (isSurvivalGrasslandTerrainBiome(biome)) grasslandWeight += weight;
  }

  if (grasslandWeight > 0.42 || isSurvivalGrasslandTerrainBiome(chunk.biome)) {
    return getSurvivalGrasslandTerrainDetailTexture();
  }

  return getSurvivalTerrainDetailTexture();
}

export function getDesertAdobeWallTexture() {
  if (cachedDesertAdobeWallTexture) return cachedDesertAdobeWallTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#deb779";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < canvas.height; y += 12) {
      const rowOffset = Math.floor(((Math.sin(y * 17.17) * 43758.5453) % 1) * 16);
      let x = -rowOffset;

      while (x < canvas.width) {
        const raw = Math.sin((x + 31) * 12.9898 + (y + 7) * 78.233) * 43758.5453;
        const hash = raw - Math.floor(raw);
        const width = 18 + Math.floor(hash * 28);
        const height = 9 + Math.floor((1 - hash) * 5);
        const inset = hash > 0.72 ? 2 : 1;
        const shade = hash > 0.72 ? "#d1a362" : hash > 0.42 ? "#e4bf80" : "#e8c88d";

        ctx.fillStyle = "#c79b5f";
        ctx.fillRect(x, y + height - 1, width, 2);
        ctx.fillRect(x + width - 2, y, 2, height);
        ctx.fillStyle = "#ecd095";
        ctx.fillRect(x + inset, y + 1, Math.max(3, width - inset * 2), 2);
        ctx.fillStyle = shade;
        ctx.fillRect(x + inset, y + 3, Math.max(3, width - inset * 2), Math.max(2, height - 4));

        if (hash > 0.58) {
          ctx.fillStyle = "rgba(177, 128, 65, 0.22)";
          ctx.fillRect(x + 4, y + Math.max(4, Math.floor(height * 0.58)), Math.max(5, width - 8), 2);
        }

        x += width + 3;
      }
    }

    for (let i = 0; i < 28; i += 1) {
      const rawX = Math.sin(i * 44.13) * 43758.5453;
      const rawY = Math.sin(i * 91.77 + 3.4) * 43758.5453;
      const x = Math.floor((rawX - Math.floor(rawX)) * canvas.width / 2) * 2;
      const y = Math.floor((rawY - Math.floor(rawY)) * canvas.height / 2) * 2;
      ctx.fillStyle = i % 3 === 0 ? "#c89b5e" : "#ead198";
      ctx.fillRect(x, y, 2, 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.85, 1.85);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  cachedDesertAdobeWallTexture = texture;
  return texture;
}
