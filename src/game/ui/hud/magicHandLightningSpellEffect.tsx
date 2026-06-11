import { useEffect, useRef } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getSpriteUrl } from "../../SpriteManifest";
import { MAGIC_HANDS_MOBILE_PERFORMANCE_MODE, PALM_X, PALM_Y } from "./MagicHandSpriteCanvas";
import { useMagicHandEquipScale } from "./useMagicHandEquipScale";
import { useLoopedFrameTimer } from "./useLoopedFrameTimer";

type LightningSpellEffectProps = {
  isActive: boolean;
  isCharging: boolean;
};

type LightningPoint = { x: number; y: number };
type LightningBolt = {
  points: LightningPoint[];
  length: number;
};

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const lightningSpellFrameCache: Record<string, HTMLCanvasElement> = {};
const LIGHTNING_MAX_BOLTS = 8;
const LIGHTNING_MAX_POINTS = 10;
const MOBILE_LIGHTNING_RENDER_INTERVAL_MS = 1000 / 30;

function createLightningBoltBuffer() {
  const bolts: LightningBolt[] = [];
  for (let i = 0; i < LIGHTNING_MAX_BOLTS; i += 1) {
    const points: LightningPoint[] = [];
    for (let j = 0; j < LIGHTNING_MAX_POINTS; j += 1) {
      points.push({ x: 0, y: 0 });
    }
    bolts.push({ points, length: 0 });
  }
  return bolts;
}

function writeLightningPoint(bolt: LightningBolt, index: number, x: number, y: number) {
  const point = bolt.points[index];
  point.x = x;
  point.y = y;
  bolt.length = index + 1;
}

function clearInactiveBolts(bolts: LightningBolt[], activeCount: number) {
  for (let i = activeCount; i < bolts.length; i += 1) {
    bolts[i].length = 0;
  }
}

function updateLightningBoltBuffer(bolts: LightningBolt[], isCharging: boolean, cx: number, cy: number) {
  const activeCount = isCharging ? 8 : 4;
  for (let i = 0; i < activeCount; i += 1) {
    const bolt = bolts[i];
    bolt.length = 0;
    let px = cx;
    let py = cy;
    writeLightningPoint(bolt, 0, px, py);

    if (isCharging) {
      let currentAngle = (Math.PI * 2 * i) / activeCount + (Math.random() - 0.5) * 0.5;
      const steps = Math.min(LIGHTNING_MAX_POINTS - 1, 6 + Math.floor(Math.random() * 4));
      for (let j = 1; j <= steps; j += 1) {
        currentAngle += (Math.random() - 0.5) * 1.5;
        const stepDist = 8 + Math.random() * 6;
        px += Math.cos(currentAngle) * stepDist;
        py += Math.sin(currentAngle) * stepDist;
        writeLightningPoint(bolt, j, px, py);
      }
      continue;
    }

    let angle = Math.random() * Math.PI * 2;
    const steps = Math.min(LIGHTNING_MAX_POINTS - 1, 3 + Math.floor(Math.random() * 3));
    for (let j = 1; j <= steps; j += 1) {
      angle += (Math.random() - 0.5) * 2.0;
      const stepDist = 4 + Math.random() * 5;
      px += Math.cos(angle) * stepDist;
      py += Math.sin(angle) * stepDist;
      writeLightningPoint(bolt, j, px, py);
    }
  }
  clearInactiveBolts(bolts, activeCount);
}

export function LightningSpellCanvas({ isActive, isCharging }: LightningSpellEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const boltsRef = useRef<LightningBolt[]>([]);
  const lastBoltUpdate = useRef<number>(0);
  const equipScale = useMagicHandEquipScale(isActive);
  const idleFrame = useLoopedFrameTimer({
    isRunning: equipScale !== 0,
    frameCount: 11,
    intervalMs: 100,
    firstFrame: 1,
  });
  if (boltsRef.current.length === 0) {
    boltsRef.current = createLightningBoltBuffer();
  }

  const rawImageSrc = `/sprites/lightning/palpitate_${idleFrame}.png`;
  const imageSrc = getSpriteUrl(rawImageSrc) || rawImageSrc;

  useEffect(() => {
    if (equipScale === 0) return;
    let active = true;

    if (!lightningSpellFrameCache[imageSrc]) {
      const img = new Image();

      img.onload = () => {
        if (!active) return;
        const offscreen = document.createElement('canvas');
        offscreen.width = 48;
        offscreen.height = 48;
        const offCtx = offscreen.getContext("2d", { willReadFrequently: true });
        if (!offCtx) return;
        const cropX = img.width * 0.02;
        const cropY = img.height * 0.02;
        const cropW = img.width * 0.96;
        const cropH = img.height * 0.96;
        offCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, 48, 48);

        try {
          const imgData = offCtx.getImageData(0, 0, 48, 48);
          const data = imgData.data;
          const cx = 24;
          const cy = 24;
          for (let i = 0; i < data.length; i += 4) {
            const px = (i / 4) % 48;
            const py = Math.floor((i / 4) / 48);
            const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
            let alphaMultiplier = 1;
            if (dist > 22) {
              alphaMultiplier = 0;
            } else if (dist > 12) {
              alphaMultiplier = Math.max(0, 1 - (dist - 12) / 10);
            }

            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const val = Math.max(r, g, b);
            let brightnessAlpha = 1;
            if (val < 40) {
              brightnessAlpha = 0;
            } else if (val < 100) {
              brightnessAlpha = (val - 40) / 60;
            }

            data[i + 3] = Math.floor(data[i + 3] * alphaMultiplier * brightnessAlpha);
          }
          offCtx.putImageData(imgData, 0, 0);
        } catch {
          console.warn("Lightning fallback");
        }

        lightningSpellFrameCache[imageSrc] = offscreen;
        cacheRef.current = offscreen;
      };
      img.onerror = () => {
        const fallbackPath = '/sprites/fireball/fireball_1.png';
        const fallbackUrl = getSpriteUrl(fallbackPath) || fallbackPath;
        if (!img.src.includes(fallbackUrl)) {
          img.src = fallbackUrl;
        } else {
          const offscreen = document.createElement('canvas');
          offscreen.width = 48;
          offscreen.height = 48;
          const offCtx = offscreen.getContext('2d');
          if (offCtx) {
            offCtx.fillStyle = 'rgba(255, 150, 0, 0.5)';
            offCtx.beginPath();
            offCtx.arc(24, 24, 10, 0, Math.PI * 2);
            offCtx.fill();
          }
          lightningSpellFrameCache[imageSrc] = offscreen;
          cacheRef.current = offscreen;
        }
      };
      img.crossOrigin = "anonymous";
      img.src = imageSrc;
    } else {
      cacheRef.current = lightningSpellFrameCache[imageSrc];
    }

    return () => {
      active = false;
    };
  }, [imageSrc, equipScale]);

  useEffect(() => {
    if (equipScale === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const renderIntervalMs = MAGIC_HANDS_MOBILE_PERFORMANCE_MODE ? MOBILE_LIGHTNING_RENDER_INTERVAL_MS : 0;
    let lastRenderAt = -Infinity;
    let renderTimeout: number | null = null;
    const scheduleNextRender = () => {
      if (renderIntervalMs > 0) {
        renderTimeout = window.setTimeout(() => {
          rafRef.current = requestAnimationFrame(render);
        }, renderIntervalMs);
        return;
      }
      rafRef.current = requestAnimationFrame(render);
    };
    const render = (time: number) => {
      if (renderIntervalMs > 0 && time - lastRenderAt < renderIntervalMs) {
        scheduleNextRender();
        return;
      }
      lastRenderAt = time;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = (isCharging ? 1.4 : 1.0) * equipScale;
      const shakeX = isCharging ? (Math.random() - 0.5) * 4 : 0;
      const shakeY = isCharging ? (Math.random() - 0.5) * 4 : 0;
      const fbW = 160 * scale;
      const fbH = 160 * scale;
      const fbX = PALM_X - fbW / 2 + shakeX;
      const fbY = PALM_Y - fbH + shakeY - (isCharging ? 10 : 0);
      const cx = fbX + fbW / 2;
      const cy = fbY + fbH / 2;

      if (time - lastBoltUpdate.current > (isCharging ? 50 : 100)) {
        lastBoltUpdate.current = time;
        updateLightningBoltBuffer(boltsRef.current, isCharging, cx, cy);
      }

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const bolts = boltsRef.current;
      for (let i = 0; i < bolts.length; i += 1) {
        const bolt = bolts[i];
        if (bolt.length === 0) continue;
        const points = bolt.points;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let j = 1; j < bolt.length; j += 1) {
          ctx.lineTo(points[j].x, points[j].y);
        }
        ctx.lineWidth = 1 + Math.random() * 0.5;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        ctx.lineWidth = isCharging ? (2 + Math.random() * 2) : 2;
        ctx.strokeStyle = "rgba(100, 200, 255, 0.7)";
        ctx.stroke();
      }
      ctx.restore();

      if (cacheRef.current) {
        ctx.drawImage(cacheRef.current, fbX, fbY, fbW, fbH);
      }
      scheduleNextRender();
    };

    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (renderTimeout !== null) window.clearTimeout(renderTimeout);
    };
  }, [isCharging, equipScale]);

  if (equipScale === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      width={859}
      height={495}
      className={cn(
        "absolute top-0 left-0 w-full h-full object-contain object-bottom pointer-events-none z-50 transition-all duration-100 mix-blend-screen",
        isCharging ? "drop-shadow-[0_0_40px_rgba(100,200,255,1)] scale-[1.03]" : "drop-shadow-[0_0_20px_rgba(100,200,255,0.8)]"
      )}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
