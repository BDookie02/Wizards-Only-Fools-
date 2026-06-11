import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { getDarrelPetalNoise } from "../../rendering/textures/textureNoise";
import { configureDarrelPixelTexture, drawDarrelPixels } from "./darrelGroveTextures";

export type LilyCoilTextureKind = "grass" | "wall" | "ramp" | "stone";

const cachedLilyCoilTextures: Partial<Record<LilyCoilTextureKind, THREE.CanvasTexture>> = {};
let cachedLilyCoilCallaBloomTexture: THREE.CanvasTexture | null = null;
let cachedLilyCoilMeadowOverlayTexture: THREE.CanvasTexture | null = null;
let cachedLilyCoilEyeFallbackTexture: THREE.CanvasTexture | null = null;
const LILY_COIL_EYE_TEXTURE_SIZE = 96;
const LILY_COIL_EYE_FRAME_COUNT = 36;
const LILY_COIL_EYE_FRAME_FPS = 10;
let cachedLilyCoilEyeFrameImages: HTMLImageElement[] | null = null;
let pendingLilyCoilEyeFrameImages: Promise<HTMLImageElement[]> | null = null;

function getLilyCoilEyeFramePath(index: number) {
  return `/sprites/lily-coil/eye-cap-frames/eye_${String(index).padStart(3, "0")}.png`;
}

export function getLilyCoilTexture(kind: LilyCoilTextureKind) {
  const cached = cachedLilyCoilTextures[kind];
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

    if (kind === "grass") {
      fill("#3b0764");
      drawDarrelPixels(ctx, canvas.width, canvas.height, ["#240046", "#4c1d95", "#581c87", "#6d28d9"], 0.86);
      for (let index = 0; index < 1200; index += 1) {
        const x = Math.floor(getDarrelPetalNoise(index, 410) * canvas.width);
        const y = Math.floor(getDarrelPetalNoise(index, 411) * canvas.height);
        const roll = getDarrelPetalNoise(index, 414);
        ctx.fillStyle = roll > 0.82 ? "#ddd6fe" : roll > 0.55 ? "#a78bfa" : roll > 0.28 ? "#8b5cf6" : "#6d28d9";
        ctx.globalAlpha = 0.48 + getDarrelPetalNoise(index, 415) * 0.38;
        ctx.fillRect(x, y, roll > 0.64 ? 2 : 1, 1);
        if (roll > 0.9) ctx.fillRect((x + 1) % canvas.width, (y + 1) % canvas.height, 1, 1);
      }
      for (let index = 0; index < 3200; index += 1) {
        const x = Math.floor(getDarrelPetalNoise(index, 420) * canvas.width);
        const y = Math.floor(getDarrelPetalNoise(index, 421) * canvas.height);
        const roll = getDarrelPetalNoise(index, 424);
        ctx.fillStyle = roll > 0.88
          ? "#ddd6fe"
          : roll > 0.62
            ? "#a78bfa"
            : roll > 0.28
              ? "#7c3aed"
              : "#5b21b6";
        ctx.globalAlpha = 0.42 + getDarrelPetalNoise(index, 425) * 0.5;
        const w = roll > 0.82 ? 2 : 1;
        const h = getDarrelPetalNoise(index, 426) > 0.68 ? 2 : 1;
        ctx.fillRect(x, y, w, h);
      }
      ctx.globalAlpha = 1;
      for (let index = 0; index < 260; index += 1) {
        const x = Math.floor(getDarrelPetalNoise(index, 450) * canvas.width);
        const y = Math.floor(getDarrelPetalNoise(index, 451) * canvas.height);
        ctx.fillStyle = index % 4 === 0 ? "#ffffff" : index % 3 === 0 ? "#ddd6fe" : "#bfdbfe";
        ctx.fillRect(x, y, 1, 1);
        if (index % 7 === 0) ctx.fillRect((x + 1) % canvas.width, y, 1, 1);
      }
    } else if (kind === "wall") {
      fill("#4c1d95");
      for (let y = 0; y < canvas.height; y += 12) {
        ctx.fillStyle = y % 24 === 0 ? "#7e22ce" : "#35136d";
        ctx.fillRect(0, y, canvas.width, 4);
      }
      for (let x = 0; x < canvas.width; x += 18) {
        ctx.fillStyle = x % 36 === 0 ? "#a855f7" : "#2e1065";
        ctx.fillRect(x, 0, 3, canvas.height);
      }
      drawDarrelPixels(ctx, canvas.width, canvas.height, ["#e9d5ff", "#9333ea", "#581c87", "#1e063e"], 0.18);
    } else if (kind === "ramp") {
      fill("#5b21b6");
      for (let y = 0; y < canvas.height; y += 10) {
        ctx.fillStyle = y % 20 === 0 ? "#8b5cf6" : "#3b0764";
        ctx.fillRect(0, y, canvas.width, 3);
      }
      for (let x = 0; x < canvas.width; x += 16) {
        ctx.fillStyle = "#d8b4fe";
        ctx.fillRect(x, 2, 2, canvas.height - 4);
      }
      drawDarrelPixels(ctx, canvas.width, canvas.height, ["#f5d0fe", "#7c3aed", "#240046"], 0.16);
    } else {
      fill("#3b2456");
      for (let y = 0; y < canvas.height; y += 16) {
        for (let x = 0; x < canvas.width; x += 24) {
          ctx.fillStyle = (x + y) % 48 === 0 ? "#76528f" : "#26133f";
          ctx.fillRect(x, y, 20, 12);
        }
      }
      drawDarrelPixels(ctx, canvas.width, canvas.height, ["#9f7aea", "#180929", "#c4b5fd"], 0.18);
    }
  }

  const repeat = kind === "grass" ? 10 : kind === "wall" ? 8 : kind === "ramp" ? 6 : 3;
  const texture = configureDarrelPixelTexture(new THREE.CanvasTexture(canvas), repeat, repeat);
  cachedLilyCoilTextures[kind] = texture;
  return texture;
}

export function getLilyCoilCallaBloomTexture() {
  if (cachedLilyCoilCallaBloomTexture) return cachedLilyCoilCallaBloomTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y += 1) {
      const t = y / (canvas.height - 1);
      const neck = THREE.MathUtils.smoothstep(t, 0.55, 1);
      const flare = Math.sin(Math.min(1, t * 1.18) * Math.PI);
      const center = 48 + Math.sin(t * Math.PI * 1.45) * 6 - (1 - t) * 5;
      const width = 5 + flare * 22 + (1 - t) * 17 - neck * 17;
      const bite = t < 0.34 ? Math.max(0, 1 - Math.abs(t - 0.18) / 0.18) * 8 : 0;
      for (let x = 0; x < canvas.width; x += 1) {
        const edgeCurve = Math.sin(t * Math.PI * 2.5) * 2.2;
        const dx = x - center - edgeCurve;
        const rightCut = x > center + width - bite && t < 0.34;
        const inside = Math.abs(dx) <= width && !rightCut;
        if (!inside) continue;
        const edge = Math.abs(dx) / Math.max(1, width);
        const vein = Math.abs(Math.sin((x + t * 44) * 0.22)) < 0.11 ? 0.12 : 0;
        const rim = edge > 0.84 ? 0.38 : 0;
        const topPink = Math.max(0, 1 - t);
        const throat = THREE.MathUtils.smoothstep(t, 0.52, 0.96);
        const r = Math.round(168 + topPink * 70 - throat * 36 + rim * 34);
        const g = Math.round(78 + topPink * 42 + throat * 72 - rim * 48);
        const b = Math.round(216 + topPink * 24 - throat * 34 + rim * 36);
        const alpha = Math.max(0.18, 0.9 - rim * 0.18 - vein);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    ctx.globalAlpha = 0.7;
    for (let vein = 0; vein < 9; vein += 1) {
      const x = 22 + vein * 6 + (vein % 2) * 2;
      ctx.strokeStyle = vein % 2 === 0 ? "#f0abfc" : "#7e22ce";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 110);
      ctx.quadraticCurveTo(44 + vein, 68 - vein * 1.8, 32 + vein * 6, 20 + (vein % 3) * 5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  cachedLilyCoilCallaBloomTexture = texture;
  return texture;
}

function getLilyCoilEyeFallbackTexture() {
  if (cachedLilyCoilEyeFallbackTexture) return cachedLilyCoilEyeFallbackTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f1d6c8";
    ctx.beginPath();
    ctx.arc(80, 80, 74, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff7ed";
    ctx.beginPath();
    ctx.ellipse(80, 82, 54, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4d7c0f";
    ctx.beginPath();
    ctx.arc(80, 82, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#05010a";
    ctx.beginPath();
    ctx.arc(80, 82, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fillRect(58, 62, 14, 18);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  cachedLilyCoilEyeFallbackTexture = texture;
  return texture;
}

function configureLilyCoilEyeTexture(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function loadLilyCoilEyeFrameImages() {
  if (cachedLilyCoilEyeFrameImages) return Promise.resolve(cachedLilyCoilEyeFrameImages);
  if (pendingLilyCoilEyeFrameImages) return pendingLilyCoilEyeFrameImages;

  const framePromises = new Array<Promise<HTMLImageElement | null>>(LILY_COIL_EYE_FRAME_COUNT);
  for (let index = 0; index < LILY_COIL_EYE_FRAME_COUNT; index += 1) {
    framePromises[index] = new Promise<HTMLImageElement | null>((resolve) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = getLilyCoilEyeFramePath(index);
    });
  }

  pendingLilyCoilEyeFrameImages = Promise.all(framePromises).then((images) => {
    const loadedImages: HTMLImageElement[] = [];
    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];
      if (image) loadedImages.push(image);
    }
    cachedLilyCoilEyeFrameImages = loadedImages;
    return cachedLilyCoilEyeFrameImages;
  });

  return pendingLilyCoilEyeFrameImages;
}

export function useLilyCoilEyeSpriteTexture() {
  const state = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = LILY_COIL_EYE_TEXTURE_SIZE;
    canvas.height = LILY_COIL_EYE_TEXTURE_SIZE;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.imageSmoothingEnabled = false;
    const texture = configureLilyCoilEyeTexture(new THREE.CanvasTexture(canvas));
    return {
      canvas,
      ctx,
      texture,
      frames: [] as HTMLImageElement[],
      lastFrame: -2,
      nextFrameUpdateAt: 0,
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadLilyCoilEyeFrameImages().then((frames) => {
      if (!cancelled) state.frames = frames;
    });
    return () => {
      cancelled = true;
    };
  }, [state]);

  useFrame(({ clock }) => {
    if (!state.ctx) return;
    const elapsed = clock.getElapsedTime();
    if (elapsed < state.nextFrameUpdateAt) return;
    state.nextFrameUpdateAt = Math.floor(elapsed * LILY_COIL_EYE_FRAME_FPS + 1) / LILY_COIL_EYE_FRAME_FPS;
    const { canvas, ctx } = state;
    const frameCount = state.frames.length;
    const frameIndex = frameCount > 0
      ? Math.floor(elapsed * LILY_COIL_EYE_FRAME_FPS) % frameCount
      : -1;
    if (frameIndex === state.lastFrame) return;

    state.lastFrame = frameIndex;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#160725";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#2d1046";
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width * 0.49, 0, Math.PI * 2);
    ctx.fill();
    if (frameIndex >= 0) ctx.drawImage(state.frames[frameIndex], 0, 0, canvas.width, canvas.height);
    else ctx.drawImage(getLilyCoilEyeFallbackTexture().image as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    state.texture.needsUpdate = true;
  });

  return state.texture;
}

export function getLilyCoilMeadowOverlayTexture() {
  if (cachedLilyCoilMeadowOverlayTexture) return cachedLilyCoilMeadowOverlayTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawBlade = (x: number, baseY: number, height: number, lean: number, width: number, color: string, alpha: number) => {
      const tipX = x + lean;
      const tipY = baseY - height;
      const midX = x + lean * 0.38;
      const midY = baseY - height * 0.58;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(Math.round(x), Math.round(baseY));
      ctx.quadraticCurveTo(Math.round(midX), Math.round(midY), Math.round(tipX), Math.round(tipY));
      ctx.stroke();
      if (width > 1.5) {
        ctx.globalAlpha = alpha * 0.34;
        ctx.strokeStyle = "#e9d5ff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(x + width * 0.18), Math.round(baseY));
        ctx.quadraticCurveTo(Math.round(midX + 1), Math.round(midY + 2), Math.round(tipX), Math.round(tipY));
        ctx.stroke();
      }
    };

    for (let index = 0; index < 3400; index += 1) {
      const depth = getDarrelPetalNoise(index, 520);
      const x = Math.floor(getDarrelPetalNoise(index, 521) * canvas.width);
      const baseY = Math.floor(canvas.height - 2 - Math.pow(depth, 2.15) * 106);
      const height = 22 + getDarrelPetalNoise(index, 522) * 84 * (0.38 + depth * 0.82);
      const lean = (getDarrelPetalNoise(index, 523) - 0.5) * (10 + height * 0.36);
      const width = depth > 0.68 ? 1 : 1.2 + getDarrelPetalNoise(index, 524) * 1.8;
      const roll = getDarrelPetalNoise(index, 525);
      const color = roll > 0.88 ? "#ddd6fe" : roll > 0.66 ? "#b794f4" : roll > 0.3 ? "#8b5cf6" : "#5b21b6";
      drawBlade(x, baseY, height, lean, width, color, 0.26 + depth * 0.46);
    }

    for (let index = 0; index < 190; index += 1) {
      const x = Math.floor(getDarrelPetalNoise(index, 560) * canvas.width);
      const y = Math.floor(canvas.height * 0.42 + getDarrelPetalNoise(index, 561) * canvas.height * 0.5);
      const petal = index % 3 === 0 ? "#ffffff" : index % 3 === 1 ? "#ddd6fe" : "#93c5fd";
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = petal;
      ctx.fillRect(x, y, 2, 2);
      if (index % 4 === 0) {
        ctx.fillRect((x + 3) % canvas.width, y + 1, 2, 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  cachedLilyCoilMeadowOverlayTexture = texture;
  return texture;
}
