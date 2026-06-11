import * as THREE from "three";
import { getDarrelPetalNoise } from "../../rendering/textures/textureNoise";

export type DarrelTextureKind = "ground" | "bark" | "leaf" | "wall" | "roof" | "tatami" | "wood" | "water" | "stone" | "dojo";

const cachedDarrelTextures: Partial<Record<DarrelTextureKind, THREE.CanvasTexture>> = {};
let cachedDarrelBlossomTexture: THREE.CanvasTexture | null = null;
let cachedDarrelPetalTexture: THREE.CanvasTexture | null = null;
let cachedDarrelPetalCarpetTexture: THREE.CanvasTexture | null = null;
let cachedDarrelFujiTexture: THREE.CanvasTexture | null = null;

export function configureDarrelPixelTexture(texture: THREE.CanvasTexture, repeatX = 1, repeatY = 1) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function drawDarrelPixels(ctx: CanvasRenderingContext2D, width: number, height: number, colors: string[], density = 0.12) {
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const noise = Math.sin(x * 17.17 + y * 43.33 + colors.length * 91.7) * 43758.5453;
      const value = noise - Math.floor(noise);
      if (value > 1 - density) {
        ctx.fillStyle = colors[Math.floor(value * colors.length * 7) % colors.length];
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }
}

export function getDarrelTexture(kind: DarrelTextureKind) {
  const cached = cachedDarrelTextures[kind];
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    const fill = (color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    if (kind === "ground") {
      fill("#7aa05d");
      for (let y = 0; y < canvas.height; y += 8) {
        ctx.fillStyle = y % 16 === 0 ? "#86ad65" : "#668e4f";
        ctx.fillRect(0, y, canvas.width, 2);
      }
      drawDarrelPixels(ctx, canvas.width, canvas.height, ["#f7b4ca", "#dfe9a1", "#557b44", "#9cc877"], 0.22);
    } else if (kind === "bark") {
      fill("#303a3c");
      for (let x = 0; x < canvas.width; x += 10) {
        ctx.fillStyle = x % 20 === 0 ? "#566264" : "#1b2427";
        ctx.fillRect(x, 0, 4, canvas.height);
        ctx.fillStyle = "#8b9490";
        ctx.fillRect(x + 3, 8, 2, canvas.height - 16);
      }
      drawDarrelPixels(ctx, canvas.width, canvas.height, ["#111719", "#6c7775", "#9aa19c", "#242c2e"], 0.18);
    } else if (kind === "leaf") {
      fill("#2f5f2d");
      for (let y = 0; y < canvas.height; y += 10) {
        ctx.fillStyle = y % 20 === 0 ? "#4d8a3a" : "#1f3f25";
        for (let x = (y % 4) * 3; x < canvas.width; x += 22) {
          ctx.fillRect(x, y, 15, 5);
        }
      }
      drawDarrelPixels(ctx, canvas.width, canvas.height, ["#73b45a", "#1b2f1d", "#8ed16f", "#315d2e"], 0.24);
    } else if (kind === "wall") {
      fill("#d7b986");
      for (let y = 8; y < canvas.height; y += 16) {
        ctx.fillStyle = "#b98d53";
        ctx.fillRect(0, y, canvas.width, 2);
      }
      for (let x = 10; x < canvas.width; x += 24) {
        ctx.fillStyle = "#a16e3a";
        ctx.fillRect(x, 0, 3, canvas.height);
      }
      drawDarrelPixels(ctx, canvas.width, canvas.height, ["#f3dcaa", "#9f6f3f", "#c99b62"], 0.16);
    } else if (kind === "roof") {
      fill("#641b22");
      for (let y = 0; y < canvas.height; y += 10) {
        ctx.fillStyle = y % 20 === 0 ? "#8f2931" : "#3d1118";
        ctx.fillRect(0, y, canvas.width, 4);
      }
      drawDarrelPixels(ctx, canvas.width, canvas.height, ["#d54b50", "#2c0b12", "#f0a0a0"], 0.12);
    } else if (kind === "tatami") {
      fill("#b4b66b");
      for (let y = 0; y < canvas.height; y += 16) {
        ctx.fillStyle = "#69793f";
        ctx.fillRect(0, y, canvas.width, 3);
      }
      for (let x = 0; x < canvas.width; x += 32) {
        ctx.fillStyle = "#d7d78b";
        ctx.fillRect(x, 0, 2, canvas.height);
      }
      drawDarrelPixels(ctx, canvas.width, canvas.height, ["#e9e5a5", "#87954a", "#a4a65c"], 0.13);
    } else if (kind === "wood") {
      fill("#6b4328");
      for (let y = 0; y < canvas.height; y += 12) {
        ctx.fillStyle = y % 24 === 0 ? "#9d6840" : "#3f2618";
        ctx.fillRect(0, y, canvas.width, 3);
      }
      drawDarrelPixels(ctx, canvas.width, canvas.height, ["#c28a56", "#2b1b12", "#80512f"], 0.18);
    } else if (kind === "water") {
      fill("#2f8fb5");
      for (let y = 0; y < canvas.height; y += 8) {
        ctx.fillStyle = y % 16 === 0 ? "#73d2dd" : "#1f6f99";
        for (let x = (y % 3) * 3; x < canvas.width; x += 18) {
          ctx.fillRect(x, y, 10, 3);
        }
      }
      drawDarrelPixels(ctx, canvas.width, canvas.height, ["#b9f6ff", "#155d85", "#57b9cd"], 0.16);
    } else if (kind === "stone") {
      fill("#7d8582");
      for (let y = 0; y < canvas.height; y += 18) {
        for (let x = 0; x < canvas.width; x += 24) {
          ctx.fillStyle = (x + y) % 48 === 0 ? "#9ba39f" : "#5b6462";
          ctx.fillRect(x, y, 19, 13);
        }
      }
      drawDarrelPixels(ctx, canvas.width, canvas.height, ["#c5cbc5", "#454d4b", "#8f9994"], 0.18);
    } else {
      fill("#c9604b");
      for (let y = 0; y < canvas.height; y += 18) {
        ctx.fillStyle = "#f1c37f";
        ctx.fillRect(0, y, canvas.width, 3);
      }
      for (let x = 0; x < canvas.width; x += 18) {
        ctx.fillStyle = "#743527";
        ctx.fillRect(x, 0, 3, canvas.height);
      }
      drawDarrelPixels(ctx, canvas.width, canvas.height, ["#f8d79a", "#8e3f30", "#e08a5d"], 0.12);
    }
  }

  const repeat = kind === "ground" ? 12 : kind === "water" ? 4 : kind === "leaf" ? 3.4 : kind === "roof" ? 2.4 : 2;
  const texture = configureDarrelPixelTexture(new THREE.CanvasTexture(canvas), repeat, repeat);
  cachedDarrelTextures[kind] = texture;
  return texture;
}

export function getDarrelBlossomTexture() {
  if (cachedDarrelBlossomTexture) return cachedDarrelBlossomTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const rects = [
      [18, 12, 16, 18, "#ff9fbe"],
      [32, 14, 16, 17, "#f35b8d"],
      [13, 28, 18, 15, "#ffb7ce"],
      [32, 30, 19, 14, "#df3f79"],
      [25, 23, 16, 16, "#ffd3de"],
    ] as const;
    for (let index = 0; index < rects.length; index += 1) {
      const [x, y, w, h, color] = rects[index];
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    }
    ctx.fillStyle = "#4a1b2a";
    ctx.fillRect(30, 28, 6, 6);
    ctx.fillRect(24, 31, 7, 2);
    ctx.fillRect(35, 24, 2, 8);
    ctx.fillRect(36, 35, 9, 2);
    ctx.fillStyle = "#ffe2eb";
    ctx.fillRect(20, 16, 6, 4);
    ctx.fillRect(18, 31, 5, 3);
    ctx.fillStyle = "#161013";
    ctx.fillRect(29, 37, 2, 6);
    ctx.fillRect(37, 36, 2, 6);
  }

  cachedDarrelBlossomTexture = configureDarrelPixelTexture(new THREE.CanvasTexture(canvas));
  cachedDarrelBlossomTexture.wrapS = THREE.ClampToEdgeWrapping;
  cachedDarrelBlossomTexture.wrapT = THREE.ClampToEdgeWrapping;
  return cachedDarrelBlossomTexture;
}

export function getDarrelPetalTexture() {
  if (cachedDarrelPetalTexture) return cachedDarrelPetalTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffd7e6";
    ctx.fillRect(10, 9, 12, 5);
    ctx.fillRect(8, 12, 16, 6);
    ctx.fillStyle = "#ffc0d7";
    ctx.fillRect(14, 7, 8, 5);
    ctx.fillRect(17, 12, 8, 5);
    ctx.fillStyle = "#fff0f6";
    ctx.fillRect(9, 13, 6, 3);
    ctx.fillRect(12, 10, 5, 2);
    ctx.fillStyle = "#f0a5c1";
    ctx.fillRect(21, 15, 3, 2);
    ctx.fillRect(15, 18, 4, 2);
  }

  cachedDarrelPetalTexture = configureDarrelPixelTexture(new THREE.CanvasTexture(canvas));
  cachedDarrelPetalTexture.wrapS = THREE.ClampToEdgeWrapping;
  cachedDarrelPetalTexture.wrapT = THREE.ClampToEdgeWrapping;
  return cachedDarrelPetalTexture;
}

export function getDarrelPetalCarpetTexture() {
  if (cachedDarrelPetalCarpetTexture) return cachedDarrelPetalCarpetTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 42; index += 1) {
      const x = Math.floor(getDarrelPetalNoise(index, 11) * canvas.width);
      const y = Math.floor(getDarrelPetalNoise(index, 12) * canvas.height);
      const width = 6 + Math.floor(getDarrelPetalNoise(index, 13) * 11);
      const height = 3 + Math.floor(getDarrelPetalNoise(index, 14) * 6);
      ctx.fillStyle = index % 4 === 0 ? "#fff0f6" : index % 3 === 0 ? "#ffd3e4" : "#ffbad2";
      ctx.fillRect(x, y, width, height);
      if (index % 5 === 0) {
        ctx.fillStyle = "#f1a0bd";
        ctx.fillRect(x + width - 2, y + 1, 2, 2);
      }
    }
  }

  cachedDarrelPetalCarpetTexture = configureDarrelPixelTexture(new THREE.CanvasTexture(canvas), 4, 4);
  return cachedDarrelPetalCarpetTexture;
}

export function getDarrelFujiTexture() {
  if (cachedDarrelFujiTexture) return cachedDarrelFujiTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 144;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const block = (x: number, y: number, width: number, height: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
    };

    for (let y = 10; y < canvas.height; y += 12) {
      block(0, y, canvas.width, 2, "rgba(168, 219, 239, 0.18)");
    }

    const cloudBlocks = [
      [18, 33, 42, 4],
      [33, 29, 24, 4],
      [184, 42, 46, 4],
      [202, 38, 24, 4],
      [72, 56, 28, 3],
    ] as const;
    for (let index = 0; index < cloudBlocks.length; index += 1) {
      const [x, y, width, height] = cloudBlocks[index];
      block(x, y, width, height, index % 2 === 0 ? "rgba(246, 252, 255, 0.72)" : "rgba(226, 242, 249, 0.62)");
    }

    const centerX = 128;
    const peakY = 22;
    for (let row = 0; row < 52; row += 1) {
      const y = peakY + row * 2;
      const halfWidth = 8 + row * 2.05;
      const x = centerX - halfWidth;
      const width = halfWidth * 2;
      const baseColor = row < 19 ? "#f8f5e9" : row % 4 === 0 ? "#a9c4d8" : "#bbd0de";
      block(x, y, width, 2, baseColor);
      if (row > 15) {
        block(x, y, width * 0.34, 2, row % 3 === 0 ? "#7f99ad" : "#8ea8bc");
        block(centerX + width * 0.18, y, width * 0.26, 2, row % 5 === 0 ? "#d9e8ef" : "#c8dbe7");
      }
    }

    for (let row = 0; row < 18; row += 1) {
      const y = peakY + row * 2;
      const halfWidth = 9 + row * 1.3;
      block(centerX - halfWidth, y, halfWidth * 2, 2, row % 3 === 0 ? "#fffaf2" : "#edf7fb");
    }

    const mountainShadowBlocks = [
      [101, 52, 15, 4, "#c6dae5"],
      [121, 60, 19, 4, "#e6f1f4"],
      [78, 80, 23, 4, "#7d98ad"],
      [148, 88, 28, 4, "#d8e7ec"],
      [172, 104, 18, 4, "#8ea9b9"],
    ] as const;
    for (let index = 0; index < mountainShadowBlocks.length; index += 1) {
      const [x, y, width, height, color] = mountainShadowBlocks[index];
      block(x, y, width, height, color);
    }

    const forestBlocks = [
      [19, 126, 70, 9, "#5e7f69"],
      [62, 119, 78, 16, "#70977a"],
      [114, 124, 79, 11, "#54745f"],
      [160, 116, 84, 19, "#668b72"],
    ] as const;
    for (let index = 0; index < forestBlocks.length; index += 1) {
      const [x, y, width, height, color] = forestBlocks[index];
      block(x, y, width, height, color);
    }

    for (let index = 0; index < 24; index += 1) {
      const x = Math.floor(getDarrelPetalNoise(index, 31) * 230) + 12;
      const y = Math.floor(getDarrelPetalNoise(index, 32) * 18) + 116;
      block(x, y, 3 + Math.floor(getDarrelPetalNoise(index, 33) * 5), 2, index % 3 === 0 ? "#ffd9e8" : "#ffb7d1");
    }
  }

  cachedDarrelFujiTexture = configureDarrelPixelTexture(new THREE.CanvasTexture(canvas));
  cachedDarrelFujiTexture.wrapS = THREE.ClampToEdgeWrapping;
  cachedDarrelFujiTexture.wrapT = THREE.ClampToEdgeWrapping;
  return cachedDarrelFujiTexture;
}
