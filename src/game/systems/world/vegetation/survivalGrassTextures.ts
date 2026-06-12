import * as THREE from "three";
import { getDarrelPetalNoise } from "../../rendering/textures/textureNoise";
import { survivalHash01 } from "../survival/survivalMath";

let cachedLilyCoilBladeAlphaTexture: THREE.CanvasTexture | null = null;
let cachedLilyCoilGrassPatchAlphaTexture: THREE.CanvasTexture | null = null;
let cachedSurvivalGroundGrassCoverAlphaTexture: THREE.CanvasTexture | null = null;
let cachedSurvivalShortGrassCarpetAlphaTexture: THREE.CanvasTexture | null = null;
let cachedSurvivalMeadowGrassCarpetTexture: THREE.CanvasTexture | null = null;
let cachedSurvivalLocalGrassClumpAlphaTexture: THREE.CanvasTexture | null = null;
let cachedSurvivalBotwGrassTexture: THREE.CanvasTexture | null = null;
let cachedSurvivalTutorialGrassBladeTexture: THREE.CanvasTexture | null = null;

export function getSurvivalBotwGrassTexture() {
  if (cachedSurvivalBotwGrassTexture) return cachedSurvivalBotwGrassTexture;
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(255, 255, 255, 0)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.lineCap = "round";
  context.lineJoin = "round";

  for (let blade = 0; blade < 96; blade += 1) {
    const seedX = blade * 19 + 3;
    const seedZ = blade * 31 + 7;
    const baseX = 10 + survivalHash01(seedX, seedZ, 3000) * 108;
    const baseY = 125 + survivalHash01(seedX, seedZ, 3100) * 8;
    const tipX = baseX + (survivalHash01(seedX, seedZ, 3200) - 0.5) * 26;
    const tipY = 12 + survivalHash01(seedX, seedZ, 3300) * 32;
    const controlX = (baseX + tipX) * 0.5 + (survivalHash01(seedX, seedZ, 3400) - 0.5) * 34;
    const controlY = (baseY + tipY) * 0.5 - 18 - survivalHash01(seedX, seedZ, 3500) * 18;
    const width = 1.55 + survivalHash01(seedX, seedZ, 3600) * 2.45;
    const alpha = 0.56 + survivalHash01(seedX, seedZ, 3700) * 0.42;

    context.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(baseX, baseY);
    context.quadraticCurveTo(controlX, controlY, tipX, tipY);
    context.stroke();
  }

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    pixels.data[index] = 255;
    pixels.data[index + 1] = 255;
    pixels.data[index + 2] = 255;
  }
  context.putImageData(pixels, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.premultiplyAlpha = true;
  texture.needsUpdate = true;
  cachedSurvivalBotwGrassTexture = texture;
  return texture;
}

export function getSurvivalTutorialGrassBladeTexture() {
  if (cachedSurvivalTutorialGrassBladeTexture) return cachedSurvivalTutorialGrassBladeTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.save();
    ctx.globalCompositeOperation = "copy";
    ctx.fillStyle = "rgba(255, 255, 255, 0)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.imageSmoothingEnabled = true;

    const drawBlade = (
      baseX: number,
      baseY: number,
      tipX: number,
      tipY: number,
      width: number,
      alpha: number,
    ) => {
      const midX = (baseX + tipX) * 0.5;
      const midY = (baseY + tipY) * 0.5;
      const curve = (tipX - baseX) * 0.22;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(baseX - width, baseY);
      ctx.quadraticCurveTo(midX - width * 0.5 - curve, midY, tipX, tipY);
      ctx.quadraticCurveTo(midX + width * 0.5 - curve * 0.35, midY + 4, baseX + width, baseY);
      ctx.closePath();
      ctx.fill();
    };

    drawBlade(31, 95, 34, 6, 4.2, 0.96);
    drawBlade(29, 95, 22, 24, 2.1, 0.5);
    drawBlade(35, 95, 43, 31, 1.8, 0.42);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  cachedSurvivalTutorialGrassBladeTexture = texture;
  return texture;
}

export function getLilyCoilBladeAlphaTexture() {
  if (cachedLilyCoilBladeAlphaTexture) return cachedLilyCoilBladeAlphaTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const baseX = 16;
    const tipX = 13;
    for (let y = 6; y < canvas.height; y += 1) {
      const t = (y - 6) / (canvas.height - 7);
      const bend = Math.sin(t * Math.PI) * 4;
      const center = Math.round(tipX + (baseX - tipX) * t + bend);
      const tipFade = THREE.MathUtils.smoothstep(t, 0.02, 0.16);
      const body = Math.sin(t * Math.PI) * 0.85 + 0.15;
      const width = Math.max(1, Math.round(body * 4.2 * tipFade));
      const alpha = Math.min(1, tipFade * (0.5 + body * 0.5));
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillRect(center - Math.floor(width / 2), y, width, 1);
      if (width > 2) {
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.45})`;
        ctx.fillRect(center, y, 1, 1);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  cachedLilyCoilBladeAlphaTexture = texture;
  return texture;
}

export function getLilyCoilGrassPatchAlphaTexture() {
  if (cachedLilyCoilGrassPatchAlphaTexture) return cachedLilyCoilGrassPatchAlphaTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let bladeIndex = 0; bladeIndex < 32; bladeIndex += 1) {
      const baseX = 5 + getDarrelPetalNoise(bladeIndex, 940) * 86;
      const topY = 4 + getDarrelPetalNoise(bladeIndex, 941) * 58;
      const tipX = baseX + (getDarrelPetalNoise(bladeIndex, 942) - 0.5) * 42;
      const curve = (getDarrelPetalNoise(bladeIndex, 943) - 0.5) * 20;
      const maxWidth = 2.8 + getDarrelPetalNoise(bladeIndex, 944) * 4.6;
      for (let y = topY; y < canvas.height; y += 1) {
        const t = (y - topY) / Math.max(1, canvas.height - topY - 1);
        const center = Math.round(tipX + (baseX - tipX) * t + Math.sin(t * Math.PI) * curve);
        const tipFade = THREE.MathUtils.smoothstep(t, 0.02, 0.2);
        const body = Math.sin(t * Math.PI) * 0.9 + 0.1;
        const width = Math.max(1, Math.round(body * maxWidth * tipFade));
        const alpha = Math.min(1, tipFade * (0.48 + body * 0.52));
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillRect(center - Math.floor(width / 2), y, width, 1);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  cachedLilyCoilGrassPatchAlphaTexture = texture;
  return texture;
}

export function getSurvivalMeadowGrassCarpetTexture() {
  if (cachedSurvivalMeadowGrassCarpetTexture) return cachedSurvivalMeadowGrassCarpetTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = "#3f8f2f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let grain = 0; grain < canvas.width * canvas.height; grain += 1) {
      const x = grain % canvas.width;
      const y = Math.floor(grain / canvas.width);
      const noise = getDarrelPetalNoise(grain, 21202);
      const alpha = 0.004 + noise * 0.014;
      ctx.fillStyle = noise > 0.54
        ? `rgba(115,196,58,${alpha})`
        : `rgba(28,88,28,${alpha})`;
      ctx.fillRect(x, y, 1, 1);
    }

    for (let fiber = 0; fiber < 36000; fiber += 1) {
      const baseX = getDarrelPetalNoise(fiber, 21210) * canvas.width;
      const baseY = getDarrelPetalNoise(fiber, 21211) * canvas.height;
      const length = 10 + Math.pow(getDarrelPetalNoise(fiber, 21212), 0.8) * 34;
      const angle = -Math.PI * 0.5 + (getDarrelPetalNoise(fiber, 21213) - 0.5) * 1.28;
      const bend = (getDarrelPetalNoise(fiber, 21214) - 0.5) * length * 0.28;
      const tipX = baseX + Math.cos(angle) * length + bend * 0.22;
      const tipY = baseY + Math.sin(angle) * length;
      const midX = (baseX + tipX) * 0.5 + bend;
      const midY = (baseY + tipY) * 0.5 - getDarrelPetalNoise(fiber, 21215) * 2.4;
      const bladeShade = getDarrelPetalNoise(fiber, 21216);
      ctx.strokeStyle = bladeShade > 0.72
        ? `rgba(152,225,70,${0.18 + getDarrelPetalNoise(fiber, 21217) * 0.2})`
        : bladeShade > 0.34
          ? `rgba(78,170,44,${0.22 + getDarrelPetalNoise(fiber, 21218) * 0.18})`
          : `rgba(20,78,24,${0.18 + getDarrelPetalNoise(fiber, 21221) * 0.18})`;
      ctx.lineWidth = getDarrelPetalNoise(fiber, 21219) > 0.82 ? 1.28 : 0.82;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.quadraticCurveTo(midX, midY, tipX, tipY);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.anisotropy = 2;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  cachedSurvivalMeadowGrassCarpetTexture = texture;
  return texture;
}

export function getSurvivalLocalGrassClumpAlphaTexture() {
  if (cachedSurvivalLocalGrassClumpAlphaTexture) return cachedSurvivalLocalGrassClumpAlphaTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawBlade = (seed: number, baseX: number, clusterLean: number) => {
      const topY = 72 + Math.pow(getDarrelPetalNoise(seed, 19651), 1.18) * 86;
      const tipX = baseX + clusterLean + (getDarrelPetalNoise(seed, 19652) - 0.5) * 24;
      const curve = (getDarrelPetalNoise(seed, 19653) - 0.5) * 12;
      const maxWidth = 1.05 + getDarrelPetalNoise(seed, 19654) * 1.75;
      const segments = 34;
      let lastX = baseX;
      let lastY = canvas.height - 5;

      for (let segment = 1; segment <= segments; segment += 1) {
        const t = segment / segments;
        const y = (canvas.height - 5) * (1 - t) + topY * t;
        const center = baseX * (1 - t) + tipX * t + Math.sin(t * Math.PI) * curve;
        const rootFade = THREE.MathUtils.smoothstep(t, 0.012, 0.14);
        const tipFade = 1 - THREE.MathUtils.smoothstep(t, 0.86, 1);
        const alpha = Math.min(0.96, rootFade * tipFade * (0.82 - t * 0.16));
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = Math.max(0.34, maxWidth * Math.pow(1 - t, 0.82) + 0.12);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(center, y);
        ctx.stroke();
        lastX = center;
        lastY = y;
      }
    };

    for (let cluster = 0; cluster < 4; cluster += 1) {
      const clusterCenter = [27, 52, 77, 102][cluster];
      const clusterLean = [-9, -3, 3, 9][cluster];

      for (let blade = 0; blade < 14; blade += 1) {
        const seed = cluster * 40 + blade;
        const fan = (blade - 6.5) / 6.5;
        const baseX = clusterCenter + fan * 6 + (getDarrelPetalNoise(seed, 19650) - 0.5) * 6;
        drawBlade(seed, baseX, clusterLean * (0.25 + Math.abs(fan) * 0.7));
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  cachedSurvivalLocalGrassClumpAlphaTexture = texture;
  return texture;
}

export function getSurvivalGroundGrassCoverAlphaTexture() {
  if (cachedSurvivalGroundGrassCoverAlphaTexture) return cachedSurvivalGroundGrassCoverAlphaTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const u = (x + 0.5) / canvas.width;
        const v = (y + 0.5) / canvas.height;
        const edgeDistance = Math.min(u, v, 1 - u, 1 - v) * 2;
        const edgeFade = THREE.MathUtils.smoothstep(edgeDistance, 0.02, 0.24);
        const grainA = getDarrelPetalNoise(x + y * canvas.width, 986);
        const grainB = getDarrelPetalNoise(x * 13 + y * 7, 9861);
        const sweep = Math.sin(x * 0.28 + y * 0.17) * 0.5 + Math.cos(y * 0.24 - x * 0.11) * 0.5 + 1;
        const woven = Math.sin((x + y) * 0.42) * Math.cos((x - y) * 0.18) * 0.5 + 0.5;
        const alpha = edgeFade * (0.24 + grainA * 0.15 + grainB * 0.08 + sweep * 0.045 + woven * 0.036);
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.68, alpha)})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    for (let clumpIndex = 0; clumpIndex < 62; clumpIndex += 1) {
      const centerX = 8 + getDarrelPetalNoise(clumpIndex, 987) * 80;
      const centerY = 8 + getDarrelPetalNoise(clumpIndex, 988) * 80;
      const radiusX = 8 + getDarrelPetalNoise(clumpIndex, 989) * 18;
      const radiusY = 7 + getDarrelPetalNoise(clumpIndex, 990) * 16;
      const clumpAlpha = 0.13 + getDarrelPetalNoise(clumpIndex, 991) * 0.2;
      for (let y = Math.floor(centerY - radiusY); y <= Math.ceil(centerY + radiusY); y += 1) {
        for (let x = Math.floor(centerX - radiusX); x <= Math.ceil(centerX + radiusX); x += 1) {
          if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
          const dx = (x - centerX) / radiusX;
          const dy = (y - centerY) / radiusY;
          const falloff = 1 - Math.min(1, dx * dx + dy * dy);
          if (falloff <= 0) continue;
          const grain = getDarrelPetalNoise(clumpIndex * 97 + x, 992 + y);
          if (grain < 0.08) continue;
          ctx.fillStyle = `rgba(255,255,255,${clumpAlpha * falloff * (0.72 + grain * 0.28)})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    for (let streakIndex = 0; streakIndex < 70; streakIndex += 1) {
      const baseX = 4 + getDarrelPetalNoise(streakIndex, 9931) * 88;
      const baseY = 4 + getDarrelPetalNoise(streakIndex, 9932) * 88;
      const length = 5 + Math.floor(getDarrelPetalNoise(streakIndex, 9933) * 13);
      const drift = (getDarrelPetalNoise(streakIndex, 9934) - 0.5) * 0.85;
      const width = getDarrelPetalNoise(streakIndex, 9935) > 0.68 ? 2 : 1;
      const streakAlpha = 0.1 + getDarrelPetalNoise(streakIndex, 9936) * 0.14;
      for (let step = 0; step < length; step += 1) {
        const x = Math.round(baseX + Math.sin(step * 0.65 + streakIndex) * 1.2 + drift * step);
        const y = Math.round(baseY + step);
        if (x < 2 || y < 2 || x >= canvas.width - 2 || y >= canvas.height - 2) continue;
        const fade = 1 - step / Math.max(1, length);
        ctx.fillStyle = `rgba(255,255,255,${streakAlpha * (0.42 + fade * 0.58)})`;
        ctx.fillRect(x, y, width, 1);
      }
    }

    for (let fleckIndex = 0; fleckIndex < 190; fleckIndex += 1) {
      const x = Math.floor(5 + getDarrelPetalNoise(fleckIndex, 994) * 86);
      const y = Math.floor(5 + getDarrelPetalNoise(fleckIndex, 995) * 86);
      const edgeX = Math.abs((x / 96) - 0.5) * 2;
      const edgeY = Math.abs((y / 96) - 0.5) * 2;
      const edge = Math.max(edgeX, edgeY);
      if (edge > 0.92 && getDarrelPetalNoise(fleckIndex, 996) < 0.72) continue;
      const alpha = (0.12 + getDarrelPetalNoise(fleckIndex, 997) * 0.18) * (1 - Math.max(0, edge - 0.74) * 2.6);
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0.04, alpha)})`;
      ctx.fillRect(x, y, 1 + Math.floor(getDarrelPetalNoise(fleckIndex, 998) * 3), 1);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  cachedSurvivalGroundGrassCoverAlphaTexture = texture;
  return texture;
}

export function getSurvivalShortGrassCarpetAlphaTexture() {
  if (cachedSurvivalShortGrassCarpetAlphaTexture) return cachedSurvivalShortGrassCarpetAlphaTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let bladeIndex = 0; bladeIndex < 96; bladeIndex += 1) {
      const baseX = 5 + getDarrelPetalNoise(bladeIndex, 965) * 86;
      const topY = 18 + Math.pow(getDarrelPetalNoise(bladeIndex, 966), 1.18) * 48;
      const tipX = baseX + (getDarrelPetalNoise(bladeIndex, 967) - 0.5) * 24;
      const curve = (getDarrelPetalNoise(bladeIndex, 968) - 0.5) * 9;
      const maxWidth = 0.65 + getDarrelPetalNoise(bladeIndex, 969) * 1.25;
      const bladeAlpha = 0.52 + getDarrelPetalNoise(bladeIndex, 970) * 0.38;

      for (let y = topY; y < canvas.height; y += 1) {
        const t = (y - topY) / Math.max(1, canvas.height - topY - 1);
        const center = Math.round(tipX + (baseX - tipX) * t + Math.sin(t * Math.PI) * curve);
        const tipFade = THREE.MathUtils.smoothstep(t, 0.04, 0.22);
        const baseFade = 1 - THREE.MathUtils.smoothstep(t, 0.88, 1.02) * 0.24;
        const body = Math.sin(t * Math.PI) * 0.72 + 0.28;
        const width = Math.max(1, Math.round(body * maxWidth * tipFade));
        const alpha = Math.min(0.9, bladeAlpha * tipFade * (0.46 + body * 0.44) * baseFade);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillRect(center - Math.floor(width / 2), y, width, 1);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  cachedSurvivalShortGrassCarpetAlphaTexture = texture;
  return texture;
}
