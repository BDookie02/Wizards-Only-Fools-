import { useState, useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { SpellType, hasRunePower, useGameStore } from "../store/gameStore";
import { getSpriteUrl } from "./SpriteManifest";
import { socket } from "../lib/socket";
import { isMobilePerformanceMode } from "./performanceMode";

const MOBILE_PERFORMANCE_MODE = isMobilePerformanceMode();

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function handSpriteSize(basePx: number, heightRatio = 0.27, minPx = Math.round(basePx * 0.58)) {
  if (!MOBILE_PERFORMANCE_MODE) return `${basePx}px`;
  return `clamp(${minPx}px, calc(var(--app-vh, 100dvh) * ${heightRatio}), ${basePx}px)`;
}

function heldSpellSpriteSize(basePx: number, heightRatio = 0.27, minPx = Math.round(basePx * 0.58)) {
  const scale = 0.82;
  return handSpriteSize(Math.round(basePx * scale), heightRatio * scale, Math.round(minPx * scale));
}

function processPixelFilter(ctx: CanvasRenderingContext2D, width: number, height: number) {
  // disabled for testing
}

// Global offsets for aligning spells to the center of the left hand palm.
// Tweak these values to adjust the position of ALL left-hand spells!
export const PALM_X = 360; // Increase to move right, decrease to move left
export const PALM_Y = 320; // Increase to move down, decrease to move up

export const SVG_PALM_X = (PALM_X / 859) * 256;
export const SVG_PALM_Y = (PALM_Y / 495) * 144;

const handsFrameCache: Record<string, HTMLCanvasElement> = {};

type MagicGlassOrbSignal = {
  distance: number;
  angle: number;
  depth: number;
};

const GLASS_ORB_LOCK_ANGLE = 0.12;

function normalizeRadians(angle: number) {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
}

function applyHandPixelFilter(canvas: HTMLCanvasElement) {
  const width = canvas.width;
  const height = canvas.height;
  if (width <= 0 || height <= 0) return;

  const maxPixelSourceSide = MOBILE_PERFORMANCE_MODE ? 168 : 220;
  const scale = Math.min(1, maxPixelSourceSide / Math.max(width, height));
  if (scale >= 1) return;

  const pixelWidth = Math.max(1, Math.round(width * scale));
  const pixelHeight = Math.max(1, Math.round(height * scale));
  const tiny = document.createElement("canvas");
  tiny.width = pixelWidth;
  tiny.height = pixelHeight;
  const tinyCtx = tiny.getContext("2d");
  const ctx = canvas.getContext("2d");
  if (!tinyCtx || !ctx) return;

  tinyCtx.imageSmoothingEnabled = false;
  tinyCtx.clearRect(0, 0, pixelWidth, pixelHeight);
  tinyCtx.drawImage(canvas, 0, 0, pixelWidth, pixelHeight);

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(tiny, 0, 0, pixelWidth, pixelHeight, 0, 0, width, height);
}

function ImageHandCanvas({
  imageSrc,
  side,
  mirrorRightToLeft = false,
  mirrorLeftToRight = false,
  poseScale = 1,
}: {
  imageSrc: string;
  side: 'left' | 'right';
  mirrorRightToLeft?: boolean;
  mirrorLeftToRight?: boolean;
  poseScale?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const drawCachedFrame = (sourceCanvas: HTMLCanvasElement) => {
      canvas.width = sourceCanvas.width;
      canvas.height = sourceCanvas.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (mirrorRightToLeft || mirrorLeftToRight) {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(sourceCanvas, 0, 0);
        ctx.restore();
      } else {
        ctx.drawImage(sourceCanvas, 0, 0);
      }

      ctx.clearRect(0, 0, canvas.width, 15);
      ctx.clearRect(0, canvas.height - 2, canvas.width, 2);
      ctx.clearRect(0, 0, 2, canvas.height);
      ctx.clearRect(canvas.width - 2, 0, 2, canvas.height);
    };

    const drawFallbackFrame = () => {
      const offscreen = document.createElement("canvas");
      offscreen.width = 859;
      offscreen.height = 495;
      const offCtx = offscreen.getContext("2d");

      if (offCtx) {
        const palmX = side === "left" ? 275 : 584;
        const wristX = side === "left" ? 190 : 669;
        offCtx.fillStyle = "rgba(87, 54, 39, 0.92)";
        offCtx.beginPath();
        offCtx.ellipse(palmX, 408, 124, 68, side === "left" ? -0.18 : 0.18, 0, Math.PI * 2);
        offCtx.fill();
        offCtx.fillStyle = "rgba(52, 31, 26, 0.96)";
        offCtx.fillRect(wristX - 72, 418, 144, 82);
        offCtx.fillStyle = "rgba(194, 121, 72, 0.7)";
        offCtx.fillRect(palmX - 48, 362, 96, 12);
      }

      handsFrameCache[imageSrc] = offscreen;
      drawCachedFrame(offscreen);
    };

    if (!handsFrameCache[imageSrc]) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const offscreen = document.createElement("canvas");
        offscreen.width = img.width;
        offscreen.height = img.height;
        const offCtx = offscreen.getContext("2d", { willReadFrequently: true })!;
        offCtx.drawImage(img, 0, 0);
        
        const imgData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] < 20 && data[i+1] < 20 && data[i+2] < 20) {
            data[i+3] = 0; // Make dark background transparent
          }
        }
        offCtx.putImageData(imgData, 0, 0);
        applyHandPixelFilter(offscreen);
        handsFrameCache[imageSrc] = offscreen;
        drawCachedFrame(handsFrameCache[imageSrc]);
      };
      img.onerror = drawFallbackFrame;
      img.src = imageSrc;
    } else {
      drawCachedFrame(handsFrameCache[imageSrc]);
    }
  }, [imageSrc, mirrorRightToLeft, mirrorLeftToRight]);

  return (
    <canvas 
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full object-contain object-bottom pointer-events-none"
      style={{ 
        imageRendering: "pixelated",
        zIndex: 2,
        transform: poseScale === 1 ? undefined : `scale(${poseScale})`,
        transformOrigin: side === 'left' ? 'bottom left' : 'bottom right',
        clipPath: mirrorRightToLeft
          ? 'polygon(0% 0%, 53.5% 0%, 53.5% 100%, 0% 100%)'
          : mirrorLeftToRight
            ? 'polygon(53% 0%, 100% 0%, 100% 100%, 53% 100%)'
            : side === 'left' 
              ? 'polygon(0% 0%, 42% 0%, 42% 60%, 50% 60%, 50% 100%, 0% 100%)' 
              : 'polygon(47% 0%, 100% 0%, 100% 100%, 47% 100%)'
      }}
    />
  );
}

// ============== SPELL UTILS ============== //
function processFireballPixels(ctx: CanvasRenderingContext2D, width: number, height: number) {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      
      const distSq = (r * r) + (g * g) + (b * b);
      if (distSq < 2500) { // dist < 50
         // Let's do a smooth alpha fade for dark pixels so edges don't look extremely jagged
         if (distSq < 900) { // dist < 30
            data[i+3] = 0;
         } else {
            const alpha = Math.floor(255 * ((Math.sqrt(distSq) - 30) / 20));
            data[i+3] = Math.min(data[i+3], alpha);
         }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch(e) {
    console.warn('processFireballPixels failed', e);
  }
}

// ============== SPELL: FIREBALL ============== //
const fireballFrameCache: Record<string, HTMLCanvasElement> = {};
function FireballCanvas({ isActive, isCharging }: { isActive: boolean, isCharging: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [equipFrame, setEquipFrame] = useState(0);
  const [idleFrame, setIdleFrame] = useState(1);

  useEffect(() => {
    if (equipFrame === 0) return;
    const interval = setInterval(() => {
      setIdleFrame(p => (p % 10) + 1);
    }, 100);
    return () => clearInterval(interval);
  }, [equipFrame]);

  useEffect(() => {
    let animInterval: any;
    if (isActive) {
      if (equipFrame < 5) {
        animInterval = setInterval(() => setEquipFrame(p => Math.min(5, p + 1)), 60);
      }
    } else {
      if (equipFrame > 0) {
        animInterval = setInterval(() => setEquipFrame(p => Math.max(0, p - 1)), 60);
      }
    }
    return () => clearInterval(animInterval);
  }, [isActive, equipFrame]);

  const rawImageSrc = equipFrame === 0 ? '' : equipFrame === 5 ? `/sprites/fireball/fireballidle_${idleFrame}.png` : `/sprites/fireball/fireball_${equipFrame}.png`;
  const imageSrc = rawImageSrc ? (getSpriteUrl(rawImageSrc) || rawImageSrc) : '';

  useEffect(() => {
    if (equipFrame === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!fireballFrameCache[imageSrc]) {
      const img = new Image();
      
      img.onload = () => {
        const offscreen = document.createElement('canvas');
        offscreen.width = 48; // Base width
        offscreen.height = 48; // Base height
        const offCtx = offscreen.getContext("2d", { willReadFrequently: true })!;
        
        const cropX = img.width * 0.02;
        const cropY = img.height * 0.02;
        const cropW = img.width * 0.96;
        const cropH = img.height * 0.96;
        
        offCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, 48, 48);
        processFireballPixels(offCtx, 48, 48);
        fireballFrameCache[imageSrc] = offscreen;
        
        drawFireball(ctx, canvas, fireballFrameCache[imageSrc], isCharging);
      };
            img.onerror = () => {
        const fallbackPath = '/sprites/fireball/fireball_1.png';
        const fallbackUrl = typeof getSpriteUrl !== 'undefined' ? (getSpriteUrl(fallbackPath) || fallbackPath) : fallbackPath;
        if (!img.src.includes(fallbackUrl)) {
          img.src = fallbackUrl;
        } else {
          const offscreen = document.createElement('canvas');
          offscreen.width = 48; offscreen.height = 48;
          const offCtx = offscreen.getContext('2d');
          if (offCtx) {
            offCtx.fillStyle = 'rgba(255, 150, 0, 0.5)';
            offCtx.beginPath(); offCtx.arc(24, 24, 10, 0, 3.14159*2); offCtx.fill();
          }
          ctx.clearRect(0,0,canvas.width,canvas.height);
          const scale = isCharging ? 1.4 : 1.0;
          const fbW = 160 * scale;
          const fbH = 160 * scale;
          const fbX = 308 - fbW/2;
          const fbY = 446 - fbH;
          ctx.drawImage(offscreen, fbX, fbY, fbW, fbH);
        }
      };
      img.crossOrigin = "anonymous";
      img.src = imageSrc;
    } else {
      drawFireball(ctx, canvas, fireballFrameCache[imageSrc], isCharging);
    }
  }, [imageSrc, isCharging, equipFrame]);

  function drawFireball(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, cacheCanvas: HTMLCanvasElement, charging: boolean) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const palmCenterX = 308; 
      const palmCenterY = 446; 
      const scale = charging ? 1.4 : 1.0;
      const shakeX = charging ? (Math.random() - 0.5) * 4 : 0;
      const shakeY = charging ? (Math.random() - 0.5) * 4 : 0;
      const fbW = 160 * scale; 
      const fbH = 160 * scale;
      const fbX = PALM_X - fbW / 2 + shakeX; 
      const fbY = PALM_Y - fbH + shakeY - (charging ? 10 : 0); 
      ctx.drawImage(cacheCanvas, fbX, fbY, fbW, fbH);
  }

  if (equipFrame === 0) return null;
  return (
    <canvas 
      ref={canvasRef} 
      width={859} 
      height={495} 
      className={cn(
         "absolute top-0 left-0 w-full h-full object-contain object-bottom pointer-events-none z-50 transition-all duration-100",
         isCharging ? "drop-shadow-[0_0_30px_rgba(255,150,0,1)] scale-[1.02]" : "drop-shadow-[0_0_20px_rgba(255,100,0,0.8)]"
      )}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

// ============== SPELL: BIDEN BLAST (ICE SHARD) ============== //
const iceShardFrameCache: Record<string, HTMLCanvasElement> = {};
const ICESHARD_FRAMES = [1, 2, 3, 4, 5, 6];
function IceShardCanvas({ isActive, isCharging }: { isActive: boolean, isCharging: boolean }) {
  const [equipScale, setEquipScale] = useState(0);
  const [idleFrame, setIdleFrame] = useState(1);

  useEffect(() => {
    if (equipScale === 0) return;
    const interval = setInterval(() => setIdleFrame(p => (p % 6) + 1), 100);
    return () => clearInterval(interval);
  }, [equipScale]);

  useEffect(() => {
    let animInterval: any;
    if (isActive) {
      if (equipScale < 1) animInterval = setInterval(() => setEquipScale(p => +(Math.min(1, p + 0.2)).toFixed(1)), 30);
    } else {
      if (equipScale > 0) animInterval = setInterval(() => setEquipScale(p => +(Math.max(0, p - 0.2)).toFixed(1)), 30);
    }
    return () => clearInterval(animInterval);
  }, [isActive, equipScale]);

  if (equipScale === 0) return null;

  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="remove-black-biden" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              2 2 2 1 -1.5
            " />
          </filter>
        </defs>
      </svg>
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${(PALM_X / 859) * 100}%`,
          bottom: `${((495 - PALM_Y) / 495) * 100}%`,
          opacity: equipScale,
          width: heldSpellSpriteSize(160, 0.24, 92),
          height: heldSpellSpriteSize(160, 0.24, 92),
          transform: `translate(-50%, 0) scale(${isCharging ? 1.3 : 1})`,
          overflow: 'hidden',
          clipPath: 'inset(3%)'
        }}
      >
        {ICESHARD_FRAMES.map(f => (
          <img
            key={f}
            src={getSpriteUrl(`/sprites/iceshard/spells_${f}.png`) || `/sprites/iceshard/spells_${f}.png`}
            className="absolute inset-0 w-full h-full object-contain"
            style={{
              imageRendering: 'pixelated',
              filter: 'url(#remove-black-biden)',
              visibility: f === idleFrame ? 'visible' : 'hidden'
            }}
            onError={(e) => {
              console.warn(`Biden Blast frame ${f} failed to load`);
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ))}
      </div>
    </>
  );
}


// ============== SPELL: HEAL SPELL ============== //
const healSpellFrameCache: Record<string, HTMLCanvasElement> = {};
function HealSpellCanvas({ isActive, isCharging }: { isActive: boolean, isCharging: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [equipScale, setEquipScale] = useState(0);
  const [idleFrame, setIdleFrame] = useState(1);

  useEffect(() => {
    if (equipScale === 0) return;
    const interval = setInterval(() => setIdleFrame(p => (p % 13) + 1), 100);
    return () => clearInterval(interval);
  }, [equipScale]);

  useEffect(() => {
    let animInterval: any;
    if (isActive) {
      if (equipScale < 1) animInterval = setInterval(() => setEquipScale(p => +(Math.min(1, p + 0.2)).toFixed(1)), 30);
    } else {
      if (equipScale > 0) animInterval = setInterval(() => setEquipScale(p => +(Math.max(0, p - 0.2)).toFixed(1)), 30);
    }
    return () => clearInterval(animInterval);
  }, [isActive, equipScale]);

  const rawImageSrc = `/sprites/healspell/healspell_${idleFrame}.png`;
  const imageSrc = rawImageSrc ? (getSpriteUrl(rawImageSrc) || rawImageSrc) : '';

  useEffect(() => {
    if (equipScale === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!healSpellFrameCache[imageSrc]) {
      const img = new Image();
      
      img.onload = () => {
        const offscreen = document.createElement('canvas');
        offscreen.width = 48;
        offscreen.height = 48;
        const offCtx = offscreen.getContext("2d", { willReadFrequently: true })!;
        const cropX = img.width * 0.02;
        const cropY = img.height * 0.02;
        const cropW = img.width * 0.96;
        const cropH = img.height * 0.96;
        offCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, 48, 48);
        processFireballPixels(offCtx, 48, 48);
        healSpellFrameCache[imageSrc] = offscreen;
        drawHealSpell(ctx, canvas, healSpellFrameCache[imageSrc], isCharging, equipScale);
      };
            img.onerror = () => {
        const fallbackPath = '/sprites/fireball/fireball_1.png';
        const fallbackUrl = typeof getSpriteUrl !== 'undefined' ? (getSpriteUrl(fallbackPath) || fallbackPath) : fallbackPath;
        if (!img.src.includes(fallbackUrl)) {
          img.src = fallbackUrl;
        } else {
          const offscreen = document.createElement('canvas');
          offscreen.width = 48; offscreen.height = 48;
          const offCtx = offscreen.getContext('2d');
          if (offCtx) {
            offCtx.fillStyle = 'rgba(255, 150, 0, 0.5)';
            offCtx.beginPath(); offCtx.arc(24, 24, 10, 0, 3.14159*2); offCtx.fill();
          }
          ctx.clearRect(0,0,canvas.width,canvas.height);
          const scale = (isCharging ? 1.4 : 1.0) * equipScale;
          const fbW = 160 * scale;
          const fbH = 160 * scale;
          const fbX = PALM_X - fbW/2;
          const fbY = PALM_Y - fbH;
          ctx.drawImage(offscreen, fbX, fbY, fbW, fbH);
        }
      };
      img.crossOrigin = "anonymous";
      img.src = imageSrc;
    } else {
      drawHealSpell(ctx, canvas, healSpellFrameCache[imageSrc], isCharging, equipScale);
    }
  }, [imageSrc, isCharging, equipScale]);

  function drawHealSpell(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, cacheCanvas: HTMLCanvasElement, charging: boolean, scaleIn: number) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = (charging ? 1.4 : 1.0) * scaleIn;
      const shakeX = charging ? (Math.random() - 0.5) * 4 : 0;
      const shakeY = charging ? (Math.random() - 0.5) * 4 : 0;
      const fbW = 160 * scale; 
      const fbH = 160 * scale;
      const fbX = PALM_X - fbW / 2 + shakeX; 
      const fbY = PALM_Y - fbH + shakeY - (charging ? 10 : 0); 
      ctx.drawImage(cacheCanvas, fbX, fbY, fbW, fbH);
  }

  if (equipScale === 0) return null;
  return (
    <canvas 
      ref={canvasRef} 
      width={859} 
      height={495} 
      className={cn(
         "absolute top-0 left-0 w-full h-full object-contain object-bottom pointer-events-none z-50 transition-all duration-100",
         isCharging ? "drop-shadow-[0_0_80px_rgba(255,215,0,1)] scale-[1.05]" : "drop-shadow-[0_0_20px_rgba(255,215,0,0.8)]"
      )}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

// ============== SPELL: ICE SPELL (PLASMA FLASH) ============== //
const iceSpellFrameCache: Record<string, HTMLCanvasElement> = {};
function IceSpellCanvas({ isActive, isCharging }: { isActive: boolean, isCharging: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [equipScale, setEquipScale] = useState(0);
  const [idleFrame, setIdleFrame] = useState(1);

  useEffect(() => {
    if (equipScale === 0) return;
    const interval = setInterval(() => setIdleFrame(p => (p % 8) + 1), 100);
    return () => clearInterval(interval);
  }, [equipScale]);

  useEffect(() => {
    let animInterval: any;
    if (isActive) {
      if (equipScale < 1) animInterval = setInterval(() => setEquipScale(p => +(Math.min(1, p + 0.2)).toFixed(1)), 30);
    } else {
      if (equipScale > 0) animInterval = setInterval(() => setEquipScale(p => +(Math.max(0, p - 0.2)).toFixed(1)), 30);
    }
    return () => clearInterval(animInterval);
  }, [isActive, equipScale]);

  const rawImageSrc = `/sprites/icespell/icespell_${idleFrame}.png`;
  const imageSrc = rawImageSrc ? (getSpriteUrl(rawImageSrc) || rawImageSrc) : '';

  useEffect(() => {
    if (equipScale === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!iceSpellFrameCache[imageSrc]) {
      const img = new Image();
      
      img.onload = () => {
        const offscreen = document.createElement('canvas');
        offscreen.width = 48;
        offscreen.height = 48;
        const offCtx = offscreen.getContext("2d", { willReadFrequently: true })!;
        const cropX = img.width * 0.02;
        const cropY = img.height * 0.02;
        const cropW = img.width * 0.96;
        const cropH = img.height * 0.96;
        offCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, 48, 48);
        processFireballPixels(offCtx, 48, 48);
        
        iceSpellFrameCache[imageSrc] = offscreen;
        drawIceSpell(ctx, canvas, iceSpellFrameCache[imageSrc], isCharging, equipScale);
      };
            img.onerror = (e) => {
        console.error("Image failed to load:", img.src);
        const fallbackPath = '/sprites/fireball/fireball_1.png';
        const fallbackUrl = typeof getSpriteUrl !== 'undefined' ? (getSpriteUrl(fallbackPath) || fallbackPath) : fallbackPath;
        if (!img.src.includes(fallbackUrl)) {
          console.log("Attempting fallback:", fallbackUrl);
          img.src = fallbackUrl;
        } else {
          console.error("Fallback also failed, drawing orange circle");
          const offscreen = document.createElement('canvas');
          offscreen.width = 48; offscreen.height = 48;
          const offCtx = offscreen.getContext('2d');
          if (offCtx) {
            offCtx.fillStyle = 'rgba(255, 150, 0, 0.5)';
            offCtx.beginPath(); offCtx.arc(24, 24, 10, 0, 3.14159*2); offCtx.fill();
          }
          ctx.clearRect(0,0,canvas.width,canvas.height);
          const scale = (isCharging ? 1.4 : 1.0) * equipScale;
          const fbW = 160 * scale;
          const fbH = 160 * scale;
          const fbX = PALM_X - fbW/2;
          const fbY = PALM_Y - fbH;
          ctx.drawImage(offscreen, fbX, fbY, fbW, fbH);
        }
      };
      img.crossOrigin = "anonymous";
      img.src = imageSrc;
    } else {
      drawIceSpell(ctx, canvas, iceSpellFrameCache[imageSrc], isCharging, equipScale);
    }
  }, [imageSrc, isCharging, equipScale]);

  function drawIceSpell(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, cacheCanvas: HTMLCanvasElement, charging: boolean, scaleIn: number) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = (charging ? 1.4 : 1.0) * scaleIn;
      const shakeX = charging ? (Math.random() - 0.5) * 4 : 0;
      const shakeY = charging ? (Math.random() - 0.5) * 4 : 0;
      const fbW = 160 * scale; 
      const fbH = 160 * scale;
      const fbX = PALM_X - fbW / 2 + shakeX; 
      const fbY = PALM_Y - fbH + shakeY - (charging ? 10 : 0); 
      ctx.drawImage(cacheCanvas, fbX, fbY, fbW, fbH);
  }

  if (equipScale === 0) return null;
  return (
    <canvas 
      ref={canvasRef} 
      width={859} 
      height={495} 
      className={cn(
         "absolute top-0 left-0 w-full h-full object-contain object-bottom pointer-events-none z-50 transition-all duration-100 mix-blend-screen",
         isCharging ? "drop-shadow-[0_0_30px_rgba(0,255,255,1)] scale-[1.02]" : "drop-shadow-[0_0_20px_rgba(0,255,255,0.8)]"
      )}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

// ============== SPELL: RINGS OF POWER ============== //
const ringsSpellFrameCache: Record<string, HTMLCanvasElement> = {};
function RingsSpellCanvas({ isActive, isCharging }: { isActive: boolean, isCharging: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [equipScale, setEquipScale] = useState(0);
  const [idleFrame, setIdleFrame] = useState(1);

  useEffect(() => {
    if (equipScale === 0) return;
    const interval = setInterval(() => setIdleFrame(p => (p % 6) + 1), 100);
    return () => clearInterval(interval);
  }, [equipScale]);

  useEffect(() => {
    let animInterval: any;
    if (isActive) {
      if (equipScale < 1) animInterval = setInterval(() => setEquipScale(p => +(Math.min(1, p + 0.2)).toFixed(1)), 30);
    } else {
      if (equipScale > 0) animInterval = setInterval(() => setEquipScale(p => +(Math.max(0, p - 0.2)).toFixed(1)), 30);
    }
    return () => clearInterval(animInterval);
  }, [isActive, equipScale]);

  const rawImageSrc = `/sprites/ringsofpower/ringsofpower_${idleFrame}.png`;
  const imageSrc = rawImageSrc ? (getSpriteUrl(rawImageSrc) || rawImageSrc) : '';

  useEffect(() => {
    if (equipScale === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!ringsSpellFrameCache[imageSrc]) {
      const img = new Image();
      
      img.onload = () => {
        const offscreen = document.createElement('canvas');
        offscreen.width = 48;
        offscreen.height = 48;
        const offCtx = offscreen.getContext("2d", { willReadFrequently: true })!;
        const cropX = img.width * 0.02;
        const cropY = img.height * 0.02;
        const cropW = img.width * 0.96;
        const cropH = img.height * 0.96;
        offCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, 48, 48);
        processFireballPixels(offCtx, 48, 48);
        ringsSpellFrameCache[imageSrc] = offscreen;
        drawRingsSpell(ctx, canvas, ringsSpellFrameCache[imageSrc], isCharging, equipScale);
      };
            img.onerror = () => {
        const fallbackPath = '/sprites/fireball/fireball_1.png';
        const fallbackUrl = typeof getSpriteUrl !== 'undefined' ? (getSpriteUrl(fallbackPath) || fallbackPath) : fallbackPath;
        if (!img.src.includes(fallbackUrl)) {
          img.src = fallbackUrl;
        } else {
          const offscreen = document.createElement('canvas');
          offscreen.width = 48; offscreen.height = 48;
          const offCtx = offscreen.getContext('2d');
          if (offCtx) {
            offCtx.fillStyle = 'rgba(255, 150, 0, 0.5)';
            offCtx.beginPath(); offCtx.arc(24, 24, 10, 0, 3.14159*2); offCtx.fill();
          }
          ctx.clearRect(0,0,canvas.width,canvas.height);
          const scale = (isCharging ? 1.4 : 1.0) * (typeof equipScale !== 'undefined' ? equipScale : 1);
          const fbW = 160 * scale;
          const fbH = 160 * scale;
          const fbX = PALM_X - fbW/2;
          const fbY = PALM_Y - fbH;
          ctx.drawImage(offscreen, fbX, fbY, fbW, fbH);
        }
      };
      img.crossOrigin = "anonymous";
      img.src = imageSrc;
    } else {
      drawRingsSpell(ctx, canvas, ringsSpellFrameCache[imageSrc], isCharging, equipScale);
    }
  }, [imageSrc, isCharging, equipScale]);

  function drawRingsSpell(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, cacheCanvas: HTMLCanvasElement, charging: boolean, scaleIn: number) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = (charging ? 1.4 : 1.0) * scaleIn;
      const shakeX = charging ? (Math.random() - 0.5) * 4 : 0;
      const shakeY = charging ? (Math.random() - 0.5) * 4 : 0;
      const fbW = 160 * scale; 
      const fbH = 160 * scale;
      const fbX = PALM_X - fbW / 2 + shakeX; 
      const fbY = PALM_Y - fbH + shakeY - (charging ? 10 : 0); 
      ctx.drawImage(cacheCanvas, fbX, fbY, fbW, fbH);
  }

  if (equipScale === 0) return null;
  return (
    <canvas 
      ref={canvasRef} 
      width={859} 
      height={495} 
      className={cn(
         "absolute top-0 left-0 w-full h-full object-contain object-bottom pointer-events-none z-50 transition-all duration-100",
         isCharging ? "drop-shadow-[0_0_30px_rgba(168,85,247,1)] scale-[1.02]" : "drop-shadow-[0_0_20px_rgba(168,85,247,0.8)]"
      )}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

// ============== SPELL: LIGHTNING SPELL (PALPITATE) ============== //
const lightningSpellFrameCache: Record<string, HTMLCanvasElement> = {};
function LightningSpellCanvas({ isActive, isCharging }: { isActive: boolean, isCharging: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const boltsRef = useRef<{x: number, y: number}[][]>([]);
  const lastBoltUpdate = useRef<number>(0);

  const [equipScale, setEquipScale] = useState(0);
  const [idleFrame, setIdleFrame] = useState(1);

  useEffect(() => {
    if (equipScale === 0) return;
    const interval = setInterval(() => setIdleFrame(p => (p % 11) + 1), 100);
    return () => clearInterval(interval);
  }, [equipScale]);

  useEffect(() => {
    let animInterval: any;
    if (isActive) {
      if (equipScale < 1) animInterval = setInterval(() => setEquipScale(p => +(Math.min(1, p + 0.2)).toFixed(1)), 30);
    } else {
      if (equipScale > 0) animInterval = setInterval(() => setEquipScale(p => +(Math.max(0, p - 0.2)).toFixed(1)), 30);
    }
    return () => clearInterval(animInterval);
  }, [isActive, equipScale]);

  const rawImageSrc = `/sprites/lightning/palpitate_${idleFrame}.png`;
  const imageSrc = rawImageSrc ? (getSpriteUrl(rawImageSrc) || rawImageSrc) : '';

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
        const offCtx = offscreen.getContext("2d", { willReadFrequently: true })!;
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
            const dist = Math.sqrt(Math.pow(px - cx, 2) + Math.pow(py - cy, 2));
            
            let alphaMultiplier = 1;
            if (dist > 22) {
              alphaMultiplier = 0;
            } else if (dist > 12) {
               alphaMultiplier = Math.max(0, 1 - (dist - 12) / 10);
            }
            
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const val = Math.max(r, Math.max(g, b));
            
            // Strongly reduce alpha for dark pixels (the dark box background)
            let brightnessAlpha = 1;
            if (val < 40) {
               brightnessAlpha = 0;
            } else if (val < 100) {
               brightnessAlpha = (val - 40) / 60;
            }

            data[i + 3] = Math.floor(data[i + 3] * alphaMultiplier * brightnessAlpha);
          }
          offCtx.putImageData(imgData, 0, 0);
        } catch(e) {
          console.warn("Lightning fallback");
        }
        
        lightningSpellFrameCache[imageSrc] = offscreen;
        cacheRef.current = offscreen;
      };
            img.onerror = () => {
        const fallbackPath = '/sprites/fireball/fireball_1.png';
        const fallbackUrl = typeof getSpriteUrl !== 'undefined' ? (getSpriteUrl(fallbackPath) || fallbackPath) : fallbackPath;
        if (!img.src.includes(fallbackUrl)) {
          img.src = fallbackUrl;
        } else {
          const offscreen = document.createElement('canvas');
          offscreen.width = 48; offscreen.height = 48;
          const offCtx = offscreen.getContext('2d');
          if (offCtx) {
            offCtx.fillStyle = 'rgba(255, 150, 0, 0.5)';
            offCtx.beginPath(); offCtx.arc(24, 24, 10, 0, 3.14159*2); offCtx.fill();
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
    return () => { active = false; };
  }, [imageSrc, equipScale]);

  useEffect(() => {
    if (equipScale === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = (time: number) => {
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
        const newBolts = [];
        if (isCharging) {
          for (let i = 0; i < 8; i++) {
            const bolt = [];
            let px = cx, py = cy;
            bolt.push({ x: px, y: py });
            let currentAngle = (Math.PI * 2 * i) / 8 + (Math.random() - 0.5) * 0.5;
            const steps = 6 + Math.floor(Math.random() * 4); 
            for (let j = 0; j < steps; j++) {
              currentAngle += (Math.random() - 0.5) * 1.5;
              const stepDist = 8 + Math.random() * 6;
              px += Math.cos(currentAngle) * stepDist;
              py += Math.sin(currentAngle) * stepDist;
              bolt.push({ x: px, y: py });
            }
            newBolts.push(bolt);
          }
        } else {
          for (let i = 0; i < 4; i++) {
            const bolt = [];
            let px = cx, py = cy;
            bolt.push({ x: px, y: py });
            let angle = Math.random() * Math.PI * 2;
            const steps = 3 + Math.floor(Math.random() * 3);
            for (let j = 0; j < steps; j++) {
              angle += (Math.random() - 0.5) * 2.0;
              const stepDist = 4 + Math.random() * 5;
              px += Math.cos(angle) * stepDist;
              py += Math.sin(angle) * stepDist;
              bolt.push({ x: px, y: py });
            }
            newBolts.push(bolt);
          }
        }
        boltsRef.current = newBolts;
      }

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const bolts = boltsRef.current;
      for (let i = 0; i < bolts.length; i++) {
        const bolt = bolts[i];
        if (bolt.length === 0) continue;
        ctx.beginPath();
        ctx.moveTo(bolt[0].x, bolt[0].y);
        for (let j = 1; j < bolt.length; j++) {
          ctx.lineTo(bolt[j].x, bolt[j].y);
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
      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
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

// ============== SPELL: BLINK SPELL (GIF Overlay) ============== //
function BlinkGifCanvas({ isActive, isCharging }: { isActive: boolean, isCharging: boolean }) {
  const [equipScale, setEquipScale] = useState(0);

  useEffect(() => {
    let animInterval: any;
    if (isActive) {
      if (equipScale < 1) animInterval = setInterval(() => setEquipScale(p => +(Math.min(1, p + 0.2)).toFixed(1)), 30);
    } else {
      if (equipScale > 0) animInterval = setInterval(() => setEquipScale(p => +(Math.max(0, p - 0.2)).toFixed(1)), 30);
    }
    return () => clearInterval(animInterval);
  }, [isActive, equipScale]);

  if (equipScale === 0) return null;

  const scale = (isCharging ? 1.1 : 0.82) * equipScale;
  const shakeX = isCharging ? (Math.random() - 0.5) * 4 : 0;
  const shakeY = isCharging ? (Math.random() - 0.5) * 4 : 0;
  
  const fbW = 40 * scale; 
  const fbH = 40 * scale;
  const fbX = SVG_PALM_X - fbW / 2 + shakeX; 
  const fbY = SVG_PALM_Y - fbH + shakeY - (isCharging ? 3 : 0); 

  return (
    <svg 
      viewBox="0 0 256 144" 
      className="absolute top-0 left-0 w-full h-full object-contain object-bottom pointer-events-none drop-shadow-[5px_5px_0_rgba(0,0,0,0.5)]"
      style={{ opacity: equipScale, zIndex: 10 }}
    >
      <foreignObject x={fbX} y={fbY} width={fbW} height={fbH}>
        <img 
           onError={(e) => { if(!e.currentTarget.src.includes('fireball_1.png')) e.currentTarget.src = '/sprites/fireball/fireball_1.png'; }} src={getSpriteUrl("/sprites/misc/blink.gif") || "/sprites/misc/blink.gif"} 
          className="w-full h-full object-contain" 
          style={{ 
            mixBlendMode: 'screen', 
            filter: 'brightness(1.5)',
            WebkitMaskImage: 'radial-gradient(circle at center, black 30%, transparent 65%)',
            maskImage: 'radial-gradient(circle at center, black 30%, transparent 65%)'
          }} 
          alt="blink"
        />
      </foreignObject>
    </svg>
  );
}

// ============== SPELL: SMOKE BOMB (GIF Overlay) ============== //
function SmokeBombGifCanvas({ isActive, isCharging }: { isActive: boolean, isCharging: boolean }) {
  const [equipScale, setEquipScale] = useState(0);

  useEffect(() => {
    let animInterval: any;
    if (isActive) {
      if (equipScale < 1) animInterval = setInterval(() => setEquipScale(p => +(Math.min(1, p + 0.2)).toFixed(1)), 30);
    } else {
      if (equipScale > 0) animInterval = setInterval(() => setEquipScale(p => +(Math.max(0, p - 0.2)).toFixed(1)), 30);
    }
    return () => clearInterval(animInterval);
  }, [isActive, equipScale]);

  if (equipScale === 0) return null;

  const scale = (isCharging ? 1.4 : 1.0) * equipScale;
  const shakeX = isCharging ? (Math.random() - 0.5) * 4 : 0;
  const shakeY = isCharging ? (Math.random() - 0.5) * 4 : 0;
  
  const fbW = 48 * scale; 
  const fbH = 48 * scale;
  const fbX = SVG_PALM_X - fbW / 2 + shakeX; 
  const fbY = SVG_PALM_Y - fbH + shakeY - (isCharging ? 3 : 0); 

  return (
    <svg 
      viewBox="0 0 256 144" 
      className="absolute top-0 left-0 w-full h-full object-contain object-bottom pointer-events-none drop-shadow-[5px_5px_0_rgba(0,0,0,0.5)]"
      style={{ opacity: equipScale, zIndex: 10 }}
    >
      <foreignObject 
        x={fbX - 6} 
        y={fbY - 6} 
        width={fbW + 12} 
        height={fbH + 12}
      >
        <img 
           onError={(e) => { if(!e.currentTarget.src.includes('fireball_1.png')) e.currentTarget.src = '/sprites/fireball/fireball_1.png'; }} src={getSpriteUrl("/sprites/misc/smoke_bomb.gif") || "/sprites/misc/smoke_bomb.gif"} 
          className="w-full h-full object-contain"
          style={{
            mixBlendMode: 'screen',
            imageRendering: 'pixelated',
            opacity: 0.48,
            filter: 'brightness(1.35) contrast(1.55) saturate(1.7)',
            WebkitMaskImage: 'radial-gradient(circle at center, black 34%, transparent 60%)',
            maskImage: 'radial-gradient(circle at center, black 34%, transparent 60%)'
          }}
        />
      </foreignObject>
    </svg>
  );
}

// ============== SPELL: PORTAL (GIF Overlay) ============== //
function PortalGifImage({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt="portal spell"
      className="h-full w-full object-contain"
      style={{
        imageRendering: 'pixelated',
        mixBlendMode: 'screen',
        filter: 'brightness(1.5) contrast(1.28) saturate(1.35)',
        WebkitMaskImage: 'radial-gradient(circle at center, transparent 0 28%, black 34%, black 51%, transparent 61%)',
        maskImage: 'radial-gradient(circle at center, transparent 0 28%, black 34%, black 51%, transparent 61%)',
      }}
      onError={(e) => {
        if (!e.currentTarget.src.includes('fireball_1.png')) {
          e.currentTarget.src = getSpriteUrl('/sprites/fireball/fireball_1.png') || '/sprites/fireball/fireball_1.png';
        }
      }}
    />
  );
}

function PortalGifCanvas({ isActive, isCharging }: { isActive: boolean, isCharging: boolean }) {
  const [equipScale, setEquipScale] = useState(0);

  useEffect(() => {
    let animInterval: any;
    if (isActive) {
      if (equipScale < 1) animInterval = setInterval(() => setEquipScale(p => +(Math.min(1, p + 0.2)).toFixed(1)), 30);
    } else {
      if (equipScale > 0) animInterval = setInterval(() => setEquipScale(p => +(Math.max(0, p - 0.2)).toFixed(1)), 30);
    }
    return () => clearInterval(animInterval);
  }, [isActive, equipScale]);

  if (equipScale === 0) return null;

  const scale = (isCharging ? 1.4 : 1.0) * equipScale;
  const shakeX = isCharging ? (Math.random() - 0.5) * 4 : 0;
  const shakeY = isCharging ? (Math.random() - 0.5) * 4 : 0;
  
  const fbW = 48 * scale; 
  const fbH = 48 * scale;
  const fbX = SVG_PALM_X - fbW / 2 + shakeX; 
  const fbY = SVG_PALM_Y - fbH + shakeY - (isCharging ? 3 : 0); 

  return (
    <svg 
      viewBox="0 0 256 144" 
      className={cn(
        "absolute top-0 left-0 w-full h-full object-contain object-bottom pointer-events-none mix-blend-screen transition-all duration-100",
        isCharging ? "scale-[1.02]" : ""
      )}
      style={{ opacity: equipScale, zIndex: 10 }}
    >
      <defs>
        <radialGradient id="portalGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(200,50,255,1)" />
          <stop offset="40%" stopColor="rgba(150,30,220,0.8)" />
          <stop offset="100%" stopColor="rgba(100,0,200,0)" />
        </radialGradient>
        <clipPath id="pixelCircleClip" clipPathUnits="objectBoundingBox">
          <polygon points="0.3,0 0.7,0 0.7,0.1 0.8,0.1 0.8,0.2 0.9,0.2 0.9,0.3 1,0.3 1,0.7 0.9,0.7 0.9,0.8 0.8,0.8 0.8,0.9 0.7,0.9 0.7,1 0.3,1 0.3,0.9 0.2,0.9 0.2,0.8 0.1,0.8 0.1,0.7 0,0.7 0,0.3 0.1,0.3 0.1,0.2 0.2,0.2 0.2,0.1 0.3,0.1" />
        </clipPath>
      </defs>
      
      <circle 
        cx={fbX + fbW / 2} 
        cy={fbY + fbH / 2} 
        r={isCharging ? 10 : 8} 
        fill="url(#portalGlow)" 
      />

      <foreignObject 
        x={fbX + fbW/2 - (fbW * 1.5) / 2} 
        y={fbY + fbH/2 - (fbH * 1.5) / 2} 
        width={fbW * 1.5} 
        height={fbH * 1.5}
      >
        <PortalGifImage src={getSpriteUrl("/sprites/misc/portal.gif") || "/sprites/misc/portal.gif"} />
      </foreignObject>
    </svg>
  );
}

// ============== SPELL: DISC SHIELD ============== //
function DiscShieldCanvas({ isActive, isCharging }: { isActive: boolean, isCharging: boolean }) {
  const [equipScale, setEquipScale] = useState(0);

  useEffect(() => {
    let animInterval: any;
    if (isActive) {
      if (equipScale < 1) animInterval = setInterval(() => setEquipScale(p => +(Math.min(1, p + 0.2)).toFixed(1)), 30);
    } else {
      if (equipScale > 0) animInterval = setInterval(() => setEquipScale(p => +(Math.max(0, p - 0.2)).toFixed(1)), 30);
    }
    return () => clearInterval(animInterval);
  }, [isActive, equipScale]);

  if (equipScale === 0) return null;

  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="remove-black-disc" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              2 2 2 1 -1.5
            " />
          </filter>
        </defs>
      </svg>
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${(PALM_X / 859) * 100}%`,
          bottom: `${((495 - PALM_Y) / 495) * 100}%`,
          opacity: equipScale,
          width: heldSpellSpriteSize(192, 0.28, 108),
          height: heldSpellSpriteSize(192, 0.28, 108),
          transform: `translate(-50%, 0) scale(${isCharging ? 1.2 : 1})`
        }}
      >
        <img 
           onError={(e) => { if(!e.currentTarget.src.includes('fireball_1.png')) e.currentTarget.src = '/sprites/fireball/fireball_1.png'; }} src={getSpriteUrl("/sprites/shields/disc_shield.png") || "/sprites/shields/disc_shield.png"} 
          className="w-full h-full object-contain"
          style={{ 
            imageRendering: 'pixelated',
            filter: 'url(#remove-black-disc) brightness(1.3)',
            animation: 'spin 3s linear infinite'
          }}
        />
      </div>
    </>
  );
}

// ============== SPELL: ORB SHIELD ============== //
function OrbShieldCanvas({ isActive, isCharging }: { isActive: boolean, isCharging: boolean }) {
  const [equipScale, setEquipScale] = useState(0);
  const idSuffixRef = useRef<string | null>(null);
  if (!idSuffixRef.current) {
    idSuffixRef.current = Math.random().toString(36).slice(2);
  }

  useEffect(() => {
    let animInterval: any;
    if (isActive) {
      if (equipScale < 1) animInterval = setInterval(() => setEquipScale(p => +(Math.min(1, p + 0.2)).toFixed(1)), 30);
    } else {
      if (equipScale > 0) animInterval = setInterval(() => setEquipScale(p => +(Math.max(0, p - 0.2)).toFixed(1)), 30);
    }
    return () => clearInterval(animInterval);
  }, [isActive, equipScale]);

  if (equipScale === 0) return null;

  const hexPatternId = `orb-hex-pattern-${idSuffixRef.current}`;
  const orbGlowId = `orb-glow-${idSuffixRef.current}`;
  const orbClipId = `orb-clip-${idSuffixRef.current}`;
  
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${(PALM_X / 859) * 100}%`,
        bottom: `${((495 - PALM_Y) / 495) * 100}%`,
        opacity: equipScale,
        width: heldSpellSpriteSize(192, 0.28, 108),
        height: heldSpellSpriteSize(192, 0.28, 108),
        transform: `translate(-50%, 0) scale(${isCharging ? 1.2 : 1})`,
        filter: 'drop-shadow(0 0 16px rgba(244,114,182,0.7))'
      }}
    >
      <svg
        viewBox="0 0 256 256"
        className="w-full h-full object-contain"
        style={{ imageRendering: 'pixelated' }}
      >
        <defs>
          <radialGradient id={orbGlowId} cx="50%" cy="46%" r="58%">
            <stop offset="0%" stopColor="#fff7ff" stopOpacity="0.95" />
            <stop offset="28%" stopColor="#f0abfc" stopOpacity="0.82" />
            <stop offset="62%" stopColor="#d946ef" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#581c87" stopOpacity="0" />
          </radialGradient>
          <pattern id={hexPatternId} width="28" height="24" patternUnits="userSpaceOnUse">
            <path
              d="M14 1 L26 7.5 L26 16.5 L14 23 L2 16.5 L2 7.5 Z"
              fill="none"
              stroke="#fdf4ff"
              strokeWidth="1.8"
              strokeOpacity="0.82"
            />
            <path
              d="M14 1 L14 23 M2 7.5 L26 16.5 M26 7.5 L2 16.5"
              fill="none"
              stroke="#f0abfc"
              strokeWidth="0.65"
              strokeOpacity="0.45"
            />
          </pattern>
          <clipPath id={orbClipId}>
            <circle cx="128" cy="128" r="92" />
          </clipPath>
        </defs>

        <circle cx="128" cy="128" r="110" fill={`url(#${orbGlowId})`} opacity={isCharging ? 0.98 : 0.85} />
        <g clipPath={`url(#${orbClipId})`}>
          <rect
            x="18"
            y="18"
            width="220"
            height="220"
            fill={`url(#${hexPatternId})`}
            opacity={isCharging ? 1 : 0.82}
            style={{ animation: 'spin 10s linear infinite', transformOrigin: '128px 128px' }}
          />
          <circle cx="128" cy="128" r="86" fill="none" stroke="#fb7185" strokeWidth="3" strokeOpacity="0.45" />
          <circle cx="128" cy="128" r="62" fill="none" stroke="#fdf4ff" strokeWidth="1.8" strokeOpacity="0.34" />
        </g>
        <circle cx="128" cy="128" r="96" fill="none" stroke="#f9a8d4" strokeWidth="5" strokeOpacity="0.72" />
        <circle cx="128" cy="128" r="111" fill="none" stroke="#c084fc" strokeWidth="3" strokeOpacity="0.38" />
      </svg>
    </div>
  );
}

function Kunai3DModel() {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
       groupRef.current.rotation.y = state.clock.elapsedTime * 2;
       groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.3 - 0.5;
    }
  });

  return (
    <group ref={groupRef} scale={[1.2, 1.2, 1.2]} rotation={[0.5, 0, 0]}>
      {/* Blade */}
      <mesh position={[0, 1.0, 0]} scale={[1.2, 1, 0.15]}>
        <cylinderGeometry args={[0, 0.4, 2, 4]} />
        <meshStandardMaterial color="#d0d0d0" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Crossguard / Handle Wrap top */}
      <mesh position={[0, 0, 0]} scale={[1, 0.2, 0.3]}>
        <boxGeometry args={[0.8, 1, 1]} />
        <meshStandardMaterial color="#222222" metalness={0.5} roughness={0.8} />
      </mesh>
      
      {/* Handle */}
      <mesh position={[0, -0.6, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 1.2, 8]} />
        <meshStandardMaterial color="#6b2a2a" roughness={0.9} />
      </mesh>
      
      {/* Ring */}
      <mesh position={[0, -1.4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 2]}>
        <torusGeometry args={[0.2, 0.06, 8, 16]} />
        <meshStandardMaterial color="#222222" metalness={0.8} roughness={0.5} />
      </mesh>
    </group>
  );
}

function KunaiCanvas({ isActive, isCharging }: { isActive: boolean, isCharging: boolean }) {
  const [equipScale, setEquipScale] = useState(0);
  const isKunaiOut = useGameStore(s => s.projectiles.some(p => p.type === 'kunai' && p.creatorId === (socket.id || "local")));
  const pixelCanvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const kunaiSize = heldSpellSpriteSize(220, 0.3, 120);

  useEffect(() => {
    let animInterval: any;
    if (isActive && !isKunaiOut) {
      if (equipScale < 1) animInterval = setInterval(() => setEquipScale(p => +(Math.min(1, p + 0.2)).toFixed(1)), 30);
    } else {
      if (equipScale > 0) animInterval = setInterval(() => setEquipScale(p => +(Math.max(0, p - 0.2)).toFixed(1)), 30);
    }
    return () => clearInterval(animInterval);
  }, [isActive, equipScale, isKunaiOut]);

  // Pixel filter: grab the offscreen 3D canvas and redraw pixelated
  useEffect(() => {
    if (equipScale === 0) return;
    const pixelCanvas = pixelCanvasRef.current;
    if (!pixelCanvas) return;
    const ctx = pixelCanvas.getContext('2d');
    if (!ctx) return;

    const PIXEL_SIZE = 64; // Render resolution (low)
    const OUTPUT_SIZE = 256; // Display resolution (upscaled)
    pixelCanvas.width = OUTPUT_SIZE;
    pixelCanvas.height = OUTPUT_SIZE;

    let animFrame: number;
    const renderLoop = () => {
      const source = offscreenRef.current;
      if (source && source.width > 0) {
        // Step 1: Draw the 3D canvas into a tiny resolution
        const tiny = document.createElement('canvas');
        tiny.width = PIXEL_SIZE;
        tiny.height = PIXEL_SIZE;
        const tinyCtx = tiny.getContext('2d')!;
        tinyCtx.imageSmoothingEnabled = false;
        tinyCtx.clearRect(0, 0, PIXEL_SIZE, PIXEL_SIZE);
        tinyCtx.drawImage(source, 0, 0, PIXEL_SIZE, PIXEL_SIZE);

        // Step 2: Color quantize for retro palette feel
        try {
          const imgData = tinyCtx.getImageData(0, 0, PIXEL_SIZE, PIXEL_SIZE);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            // Quantize to ~32 levels per channel for 16-bit look
            data[i]   = Math.round(data[i] / 8) * 8;
            data[i+1] = Math.round(data[i+1] / 8) * 8;
            data[i+2] = Math.round(data[i+2] / 8) * 8;
          }
          tinyCtx.putImageData(imgData, 0, 0);
        } catch(e) { /* canvas tainted, skip quantize */ }

        // Step 3: Upscale with nearest-neighbor to output size
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
        ctx.drawImage(tiny, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      }
      animFrame = requestAnimationFrame(renderLoop);
    };
    renderLoop();
    return () => cancelAnimationFrame(animFrame);
  }, [equipScale]);

  if (equipScale === 0) return null;

  return (
    <div 
      className="absolute pointer-events-none z-50 transition-all duration-100"
      style={{ 
        left: `${((PALM_X - 24) / 859) * 100}%`,
        bottom: `${((495 - PALM_Y - 8) / 495) * 100}%`,
        opacity: isKunaiOut ? 0 : equipScale, 
        width: kunaiSize, 
        height: kunaiSize, 
        transform: `translate(-50%, 0) scale(${isCharging ? 1.2 : 1})` 
      }}
    >
      {/* Hidden 3D canvas — rendered offscreen at 1x1 CSS but full internal res */}
      <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}>
        <Canvas 
          camera={{ position: [0, 0, 5], fov: 50 }}
          gl={{ antialias: false, alpha: true }}
          style={{ width: 256, height: 256 }}
          onCreated={({ gl }) => { offscreenRef.current = gl.domElement; }}
        >
          <ambientLight intensity={1.5} />
          <directionalLight position={[10, 10, 10]} intensity={2} />
          <group position={[0, -0.5, 0]}>
             <Kunai3DModel />
          </group>
        </Canvas>
      </div>
      {/* Visible pixelated output */}
      <canvas
        ref={pixelCanvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}

function MagicGlassOrbModel({ signal, isCharging }: { signal: MagicGlassOrbSignal | null; isCharging: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Group>(null);
  const dotRef = useRef<THREE.Mesh>(null);
  const lineRef = useRef<THREE.Mesh>(null);

  const angle = signal?.angle ?? 0;
  const depth = signal?.depth ?? 0.5;
  const dotX = signal ? Math.sin(angle) * 0.62 : 0;
  const dotY = signal ? Math.cos(angle) * 0.45 : 0;
  const dotZ = signal ? 0.14 + Math.cos(angle) * 0.16 : 0.12;
  const lineLength = Math.max(0.001, Math.hypot(dotX, dotY));
  const lineRotation = -Math.atan2(dotX, dotY);
  const isLockedOn = Boolean(signal && Math.abs(signal.angle) <= GLASS_ORB_LOCK_ANGLE);
  const dotColor = signal ? (isLockedOn ? "#4ade80" : "#ef4444") : "#7dd3fc";
  const dotGlowColor = signal ? (isLockedOn ? "#bbf7d0" : "#fecaca") : "#67e8f9";

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    const pulse = 1 + Math.sin(elapsed * 5.8) * 0.06;

    if (groupRef.current) {
      groupRef.current.rotation.x = -0.12 + Math.sin(elapsed * 0.45) * 0.05;
      groupRef.current.rotation.y = Math.sin(elapsed * 0.38) * 0.22;
      groupRef.current.position.y = Math.sin(elapsed * 1.25) * 0.035;
      groupRef.current.scale.setScalar((isCharging ? 1.08 : 1) * pulse);
    }

    if (shellRef.current) {
      shellRef.current.rotation.y = elapsed * 0.18;
      shellRef.current.rotation.z = elapsed * 0.08;
    }

    if (innerRef.current) {
      innerRef.current.rotation.x = elapsed * 0.28;
      innerRef.current.rotation.y = elapsed * -0.22;
    }

    if (dotRef.current) {
      dotRef.current.scale.setScalar(signal ? (0.62 + depth * 0.42) * pulse : 0.46);
    }

    if (lineRef.current) {
      const material = lineRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = signal ? 0.32 + depth * 0.28 : 0.1;
    }
  });

  return (
    <group ref={groupRef} scale={[1, 1, 1]}>
      <ambientLight intensity={0.85} />
      <directionalLight position={[2.5, 3.5, 4]} intensity={1.7} />
      <pointLight position={[-1.5, 1.2, 1.7]} intensity={2} color="#67e8f9" />
      <pointLight position={[dotX, dotY, dotZ + 0.24]} intensity={signal ? 1.35 : 0.35} color={dotColor} />

      <mesh ref={shellRef}>
        <sphereGeometry args={[0.95, 32, 22]} />
        <meshPhysicalMaterial
          color="#9af8ff"
          transparent
          opacity={0.38}
          roughness={0.08}
          metalness={0}
          transmission={0.44}
          thickness={0.7}
          depthWrite={false}
        />
      </mesh>

      <group ref={innerRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.76, 0.009, 8, 72]} />
          <meshBasicMaterial color="#cffafe" transparent opacity={0.52} depthWrite={false} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.76, 0.009, 8, 72]} />
          <meshBasicMaterial color="#67e8f9" transparent opacity={0.46} depthWrite={false} />
        </mesh>
        <mesh rotation={[0.82, 0.18, -0.35]}>
          <torusGeometry args={[0.62, 0.007, 8, 64]} />
          <meshBasicMaterial color="#fef9c3" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      </group>

      <mesh
        ref={lineRef}
        position={[dotX / 2, dotY / 2, dotZ / 2]}
        rotation={[0, 0, lineRotation]}
        scale={[1, lineLength, 1]}
      >
        <cylinderGeometry args={[0.014, 0.014, 1, 8]} />
        <meshBasicMaterial color={dotColor} transparent opacity={signal ? 0.48 : 0.1} depthWrite={false} />
      </mesh>

      <mesh position={[dotX, dotY, dotZ]} scale={signal ? 1.55 + depth * 0.5 : 1.05}>
        <sphereGeometry args={[0.13, 16, 12]} />
        <meshBasicMaterial color={dotGlowColor} transparent opacity={signal ? 0.64 : 0.22} depthWrite={false} />
      </mesh>

      <mesh ref={dotRef} position={[dotX, dotY, dotZ]}>
        <sphereGeometry args={[0.12, 18, 14]} />
        <meshBasicMaterial color={dotColor} transparent opacity={signal ? 1 : 0.58} />
      </mesh>

      <mesh position={[-0.27, 0.34, 0.72]} rotation={[0.25, -0.25, -0.45]} scale={[0.27, 0.09, 0.025]}>
        <sphereGeometry args={[1, 16, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.72} depthWrite={false} />
      </mesh>

      <mesh position={[0.17, -0.23, 0.7]} rotation={[-0.1, 0.38, 0.32]} scale={[0.18, 0.055, 0.018]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial color="#e0f2fe" transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  );
}

function MagicGlassOrbCanvas({ isActive, isCharging, align }: { isActive: boolean; isCharging: boolean; align: 'left' | 'right' }) {
  const [equipScale, setEquipScale] = useState(0);
  const [signal, setSignal] = useState<MagicGlassOrbSignal | null>(null);
  const poseRef = useRef({ x: 0, z: 30, angle: 0 });

  useEffect(() => {
    let animInterval: number | undefined;
    if (isActive) {
      if (equipScale < 1) {
        animInterval = window.setInterval(() => setEquipScale(p => +(Math.min(1, p + 0.2)).toFixed(1)), 30);
      }
    } else if (equipScale > 0) {
      animInterval = window.setInterval(() => setEquipScale(p => +(Math.max(0, p - 0.2)).toFixed(1)), 30);
    }
    return () => {
      if (animInterval !== undefined) window.clearInterval(animInterval);
    };
  }, [isActive, equipScale]);

  useEffect(() => {
    const handlePlayerMoved = (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {};
      poseRef.current = {
        x: Number(detail.x) || 0,
        z: Number(detail.z) || 0,
        angle: Number(detail.angle) || 0,
      };
    };

    window.addEventListener("player-moved", handlePlayerMoved);
    return () => window.removeEventListener("player-moved", handlePlayerMoved);
  }, []);

  useEffect(() => {
    if (!isActive) {
      setSignal(null);
      return;
    }

    const updateSignal = () => {
      const pose = poseRef.current;
      const players = useGameStore.getState().players;
      let nearest: null | { distance: number; x: number; z: number } = null;

      Object.values(players).forEach((player) => {
        if (!player || player.health <= 0) return;
        const dx = player.pos[0] - pose.x;
        const dz = player.pos[2] - pose.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        if (distance <= 0.1) return;
        if (!nearest || distance < nearest.distance) {
          nearest = { distance, x: player.pos[0], z: player.pos[2] };
        }
      });

      if (!nearest) {
        setSignal(null);
        return;
      }

      const angle = normalizeRadians(Math.atan2(nearest.x - pose.x, -(nearest.z - pose.z)) - pose.angle);
      const depth = (Math.cos(angle) + 1) / 2;
      setSignal((prev) => {
        if (prev && Math.abs(prev.distance - nearest.distance) < 0.75 && Math.abs(prev.angle - angle) < 0.04) {
          return prev;
        }
        return { distance: nearest.distance, angle, depth };
      });
    };

    updateSignal();
    const interval = window.setInterval(updateSignal, 160);
    return () => window.clearInterval(interval);
  }, [isActive]);

  if (equipScale === 0) return null;

  return (
    <div
      className="absolute pointer-events-none z-50 transition-all duration-100"
      style={{
        left: `${((PALM_X + 44) / 859) * 100}%`,
        bottom: `${((495 - PALM_Y - 96) / 495) * 100}%`,
        opacity: equipScale,
        width: MOBILE_PERFORMANCE_MODE ? heldSpellSpriteSize(260, 0.3, 118) : 'clamp(156px, 15vh, 214px)',
        height: MOBILE_PERFORMANCE_MODE ? heldSpellSpriteSize(260, 0.3, 118) : 'clamp(156px, 15vh, 214px)',
        transform: `translate(-50%, 0) scaleX(${align === 'right' ? -1 : 1}) scale(${isCharging ? 1.06 : 1}) translateY(${isCharging ? '-4px' : '0'})`,
        filter: 'drop-shadow(0 0 22px rgba(103,232,249,0.88)) drop-shadow(0 0 44px rgba(250,204,21,0.44))',
        borderRadius: '9999px',
        background: 'radial-gradient(circle at 50% 54%, rgba(103,232,249,0.24), rgba(14,165,233,0.12) 42%, transparent 70%)',
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 4.2], fov: 34 }}
        dpr={[1, 1.3]}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        <MagicGlassOrbModel signal={signal} isCharging={isCharging} />
      </Canvas>
    </div>
  );
}

function HealingCrystalsCanvas({ isActive, isCharging }: { isActive: boolean, isCharging: boolean }) {
  const [equipScale, setEquipScale] = useState(0);

  useEffect(() => {
    let animInterval: any;
    if (isActive) {
      if (equipScale < 1) animInterval = setInterval(() => setEquipScale(p => +(Math.min(1, p + 0.2)).toFixed(1)), 30);
    } else {
      if (equipScale > 0) animInterval = setInterval(() => setEquipScale(p => +(Math.max(0, p - 0.2)).toFixed(1)), 30);
    }
    return () => clearInterval(animInterval);
  }, [isActive, equipScale]);

  if (equipScale === 0) return null;
  
  return (
    <>
      {/* SVG filter that makes dark pixels transparent */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="remove-black" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              2 2 2 1 -1.5
            " />
          </filter>
        </defs>
      </svg>
      <img
        src={getSpriteUrl("/sprites/misc/healing_gems.gif") || "/sprites/misc/healing_gems.gif"}
        onError={(e) => { if(!e.currentTarget.src.includes('fireball_1.png')) e.currentTarget.src = '/sprites/fireball/fireball_1.png'; }}
        className="absolute pointer-events-none"
        style={{
          left: `${(PALM_X / 859) * 100}%`,
          bottom: `${((495 - PALM_Y) / 495) * 100}%`,
          opacity: equipScale,
          width: heldSpellSpriteSize(160, 0.24, 92),
          height: heldSpellSpriteSize(160, 0.24, 92),
          transform: `translate(-50%, 0) scale(${isCharging ? 1.2 : 1})`,
          imageRendering: 'pixelated',
          filter: 'url(#remove-black)'
        }}
      />
    </>
  );
}

function GrabSpellCanvas({ isActive, isCharging }: { isActive: boolean, isCharging: boolean }) {
  const [equipScale, setEquipScale] = useState(0);
  const idSuffixRef = useRef<string | null>(null);
  if (!idSuffixRef.current) {
    idSuffixRef.current = Math.random().toString(36).slice(2);
  }

  useEffect(() => {
    let animInterval: any;
    if (isActive) {
      if (equipScale < 1) animInterval = setInterval(() => setEquipScale(p => +(Math.min(1, p + 0.2)).toFixed(1)), 30);
    } else {
      if (equipScale > 0) animInterval = setInterval(() => setEquipScale(p => +(Math.max(0, p - 0.2)).toFixed(1)), 30);
    }
    return () => clearInterval(animInterval);
  }, [isActive, equipScale]);

  if (equipScale === 0) return null;

  const glowId = `grab-hand-glow-${idSuffixRef.current}`;
  const armId = `grab-arm-core-${idSuffixRef.current}`;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${(PALM_X / 859) * 100}%`,
        bottom: `${((495 - PALM_Y + 4) / 495) * 100}%`,
        opacity: equipScale,
        width: heldSpellSpriteSize(190, 0.28, 108),
        height: heldSpellSpriteSize(190, 0.28, 108),
        transform: `translate(-50%, 0) scale(${isCharging ? 1.16 : 1}) rotate(${isCharging ? -5 : -2}deg)`,
        filter: 'drop-shadow(0 0 18px rgba(244,114,182,0.75)) drop-shadow(0 0 36px rgba(168,85,247,0.35))'
      }}
    >
      <svg viewBox="0 0 256 256" className="h-full w-full" style={{ imageRendering: 'pixelated' }}>
        <defs>
          <radialGradient id={glowId} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#fff7ff" stopOpacity="0.95" />
            <stop offset="42%" stopColor="#f472b6" stopOpacity="0.68" />
            <stop offset="100%" stopColor="#7e22ce" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={armId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#be185d" stopOpacity="0.25" />
            <stop offset="55%" stopColor="#f9a8d4" stopOpacity="0.82" />
            <stop offset="100%" stopColor="#fff7ff" stopOpacity="0.72" />
          </linearGradient>
        </defs>
        <ellipse cx="128" cy="134" rx="92" ry="74" fill={`url(#${glowId})`} opacity={isCharging ? 0.85 : 0.58} />
        <path
          d="M36 190 C58 158 80 135 108 120 C121 113 134 105 148 94"
          fill="none"
          stroke="#f472b6"
          strokeWidth="34"
          strokeLinecap="round"
          strokeOpacity="0.28"
        />
        <path
          d="M38 190 C61 159 83 136 110 121 C124 113 136 104 150 94"
          fill="none"
          stroke={`url(#${armId})`}
          strokeWidth="19"
          strokeLinecap="round"
          strokeOpacity="0.86"
        />
        <ellipse cx="161" cy="91" rx="29" ry="34" fill="#f472b6" opacity="0.46" transform="rotate(-23 161 91)" />
        <ellipse cx="157" cy="88" rx="20" ry="24" fill="#ffd6fb" opacity="0.58" transform="rotate(-23 157 88)" />
        {[
          "M171 69 C190 46 209 37 224 40",
          "M181 84 C207 72 226 73 238 82",
          "M180 101 C204 102 220 112 229 128",
          "M166 114 C181 132 188 148 185 163",
          "M142 82 C126 62 112 53 96 55",
        ].map((d, index) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke={index === 4 ? "#f9a8d4" : "#fff7ff"}
            strokeWidth={index === 4 ? 12 : 10}
            strokeLinecap="round"
            strokeOpacity="0.75"
          />
        ))}
        <path d="M58 181 L74 166 M84 143 L100 128 M122 111 L139 98" stroke="#fff7ff" strokeWidth="4" strokeOpacity="0.5" strokeLinecap="round" />
        <circle cx="160" cy="92" r="56" fill="none" stroke="#f0abfc" strokeWidth="5" strokeOpacity={isCharging ? 0.7 : 0.36} />
      </svg>
    </div>
  );
}

type PixelBlock = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  opacity?: number;
  rotation?: number;
};

function PixelBlocks({ blocks }: { blocks: PixelBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => (
        <rect
          key={`${block.x}-${block.y}-${block.w}-${block.h}-${index}`}
          x={block.x}
          y={block.y}
          width={block.w}
          height={block.h}
          fill={block.color}
          opacity={block.opacity ?? 1}
          transform={block.rotation ? `rotate(${block.rotation} ${block.x + block.w / 2} ${block.y + block.h / 2})` : undefined}
        />
      ))}
    </>
  );
}

const lerp = (start: number, end: number, amount: number) => start + (end - start) * amount;
const roundPixel = (value: number) => Math.round(value * 2) / 2;

type TinyTornadoBlocks = {
  frontBands: PixelBlock[];
  backBands: PixelBlock[];
  loose: PixelBlock[];
  dust: PixelBlock[];
};

function buildTinyTornadoBlocks(): TinyTornadoBlocks {
  const frontBands: PixelBlock[] = [];
  const backBands: PixelBlock[] = [];
  const loose: PixelBlock[] = [];
  const dust: PixelBlock[] = [];

  Array.from({ length: 9 }).forEach((_, bandIndex) => {
    const t = bandIndex / 8;
    const y = lerp(22, 130, t);
    const width = lerp(96, 18, t);
    const height = lerp(9, 5, t);
    const center = 80 + Math.sin(t * Math.PI * 3.7) * lerp(11, 2, t);
    const left = center - width / 2;
    const frontRight = bandIndex % 2 === 0;
    const highlightX = frontRight ? left + width * 0.2 : left + width * 0.46;
    const shadowX = frontRight ? left + width * 0.56 : left + width * 0.12;
    const targetBands = frontRight ? frontBands : backBands;

    targetBands.push(
      {
        x: roundPixel(left),
        y: roundPixel(y),
        w: roundPixel(width),
        h: roundPixel(height),
        color: bandIndex % 3 === 0 ? "#d1d5db" : bandIndex % 3 === 1 ? "#9ca3af" : "#6b7280",
        opacity: lerp(0.9, 0.68, t),
        rotation: frontRight ? -4 : 4,
      },
      {
        x: roundPixel(highlightX),
        y: roundPixel(y - height * 0.45),
        w: roundPixel(width * lerp(0.36, 0.52, 1 - t)),
        h: roundPixel(Math.max(2.5, height * 0.45)),
        color: "#f8fafc",
        opacity: lerp(0.72, 0.42, t),
        rotation: frontRight ? -4 : 4,
      },
      {
        x: roundPixel(shadowX),
        y: roundPixel(y + height * 0.58),
        w: roundPixel(width * lerp(0.34, 0.5, t)),
        h: roundPixel(Math.max(2.5, height * 0.42)),
        color: "#374151",
        opacity: lerp(0.62, 0.34, t),
        rotation: frontRight ? -4 : 4,
      }
    );
  });

  Array.from({ length: 12 }).forEach((_, index) => {
    const t = index / 11;
    const angle = t * Math.PI * 8.5;
    const radius = lerp(8, 47, t);
    const funnelTaper = 1 - t * 0.42;
    loose.push({
      x: roundPixel(80 + Math.cos(angle) * radius * funnelTaper),
      y: roundPixel(132 - lerp(0, 104, t)),
      w: roundPixel(lerp(5, 2.5, t)),
      h: roundPixel(lerp(5, 2.5, t)),
      color: index % 3 === 0 ? "#f8fafc" : index % 3 === 1 ? "#9ca3af" : "#4b5563",
      opacity: lerp(0.78, 0.42, t),
    });
  });

  Array.from({ length: 8 }).forEach((_, index) => {
    const angle = (index / 8) * Math.PI * 2;
    const radius = 29 + (index % 6) * 7;
    dust.push({
      x: roundPixel(80 + Math.cos(angle) * radius),
      y: roundPixel(139 + Math.sin(angle) * 7),
      w: 6 + (index % 4),
      h: 3,
      color: index % 4 === 0 ? "#d1d5db" : index % 4 === 1 ? "#9ca3af" : index % 4 === 2 ? "#6b7280" : "#a16207",
      opacity: 0.28 + (index % 3) * 0.07,
      rotation: roundPixel(angle * 180 / Math.PI),
    });
  });

  return { frontBands, backBands, loose, dust };
}

const tinyTornadoGlowBlocks: PixelBlock[] = [
  { x: 20, y: 16, w: 120, h: 22, color: "#d1d5db", opacity: 0.12 },
  { x: 26, y: 42, w: 108, h: 24, color: "#9ca3af", opacity: 0.13 },
  { x: 38, y: 68, w: 84, h: 28, color: "#4b5563", opacity: 0.13 },
  { x: 50, y: 96, w: 60, h: 26, color: "#6b7280", opacity: 0.12 },
];

const tinyTornadoBlocks = buildTinyTornadoBlocks();

function TornadoSpellCanvas({ isActive, isCharging }: { isActive: boolean, isCharging: boolean }) {
  const [equipScale, setEquipScale] = useState(0);

  useEffect(() => {
    let animInterval: any;
    if (isActive) {
      if (equipScale < 1) animInterval = setInterval(() => setEquipScale(p => +(Math.min(1, p + 0.2)).toFixed(1)), 30);
    } else {
      if (equipScale > 0) animInterval = setInterval(() => setEquipScale(p => +(Math.max(0, p - 0.2)).toFixed(1)), 30);
    }
    return () => clearInterval(animInterval);
  }, [isActive, equipScale]);

  if (equipScale === 0) return null;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${(PALM_X / 859) * 100}%`,
        bottom: `${((495 - PALM_Y + 2) / 495) * 100}%`,
        opacity: equipScale,
        width: heldSpellSpriteSize(170, 0.25, 98),
        height: heldSpellSpriteSize(170, 0.25, 98),
        transform: `translate(-50%, 0) scale(${isCharging ? 1.12 : 1}) translateY(${isCharging ? '-5px' : '0'})`,
        filter: 'drop-shadow(0 0 10px rgba(229,231,235,0.7)) drop-shadow(0 0 22px rgba(75,85,99,0.45))'
      }}
    >
      <svg viewBox="0 0 160 160" className="h-full w-full" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
        <PixelBlocks blocks={tinyTornadoGlowBlocks} />
        <g>
          <animateTransform attributeName="transform" type="translate" values="-2 0;3 0;-1 0;-2 0" dur="0.74s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.62;0.82;0.58;0.76;0.62" dur="0.58s" repeatCount="indefinite" />
          <PixelBlocks blocks={tinyTornadoBlocks.backBands} />
        </g>
        <g>
          <animateTransform attributeName="transform" type="translate" values="3 0;-3 0;2 0;3 0" dur="0.62s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.78;1;0.72;0.94;0.78" dur="0.5s" repeatCount="indefinite" />
          <PixelBlocks blocks={tinyTornadoBlocks.frontBands} />
        </g>
        <g>
          <animateTransform attributeName="transform" type="translate" values="-2 1;2 -1;-1 -1;-2 1" dur="0.78s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.58;0.82;0.5;0.74;0.58" dur="0.56s" repeatCount="indefinite" />
          <PixelBlocks blocks={tinyTornadoBlocks.loose} />
        </g>
        <g>
          <animateTransform attributeName="transform" type="translate" values="-3 0;3 0;-2 0;-3 0" dur="0.68s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.42;0.68;0.34;0.6;0.42" dur="0.48s" repeatCount="indefinite" />
          <PixelBlocks blocks={tinyTornadoBlocks.dust} />
        </g>
        {isCharging && (
          <PixelBlocks
            blocks={[
              { x: 8, y: 62, w: 8, h: 8, color: "#f8fafc", opacity: 0.82 },
              { x: 144, y: 78, w: 8, h: 8, color: "#e5e7eb", opacity: 0.82 },
              { x: 18, y: 126, w: 8, h: 8, color: "#9ca3af", opacity: 0.72 },
              { x: 134, y: 134, w: 10, h: 10, color: "#6b7280", opacity: 0.72 },
            ]}
          />
        )}
      </svg>
    </div>
  );
}

function MeteorShowerCanvas({ isActive, isCharging }: { isActive: boolean, isCharging: boolean }) {
  const [equipScale, setEquipScale] = useState(0);

  useEffect(() => {
    let animInterval: any;
    if (isActive) {
      if (equipScale < 1) animInterval = setInterval(() => setEquipScale(p => +(Math.min(1, p + 0.2)).toFixed(1)), 30);
    } else {
      if (equipScale > 0) animInterval = setInterval(() => setEquipScale(p => +(Math.max(0, p - 0.2)).toFixed(1)), 30);
    }
    return () => clearInterval(animInterval);
  }, [isActive, equipScale]);

  if (equipScale === 0) return null;
  const meteorFlameBlocks: PixelBlock[] = [
    { x: 54, y: 28, w: 52, h: 12, color: "#fed7aa", opacity: 0.62 },
    { x: 42, y: 40, w: 76, h: 16, color: "#fb923c", opacity: 0.78 },
    { x: 32, y: 56, w: 96, h: 22, color: "#ef4444", opacity: 0.84 },
    { x: 26, y: 78, w: 108, h: 30, color: "#f97316", opacity: 0.94 },
    { x: 38, y: 108, w: 84, h: 22, color: "#b91c1c", opacity: 0.84 },
    { x: 56, y: 130, w: 48, h: 12, color: "#fb923c", opacity: 0.72 },
  ];
  const meteorCoreBlocks: PixelBlock[] = [
    { x: 58, y: 44, w: 46, h: 16, color: "#fff7ed", opacity: 0.92 },
    { x: 46, y: 62, w: 68, h: 24, color: "#fde68a", opacity: 0.94 },
    { x: 54, y: 86, w: 52, h: 24, color: "#facc15", opacity: 0.92 },
    { x: 68, y: 108, w: 28, h: 16, color: "#fffbeb", opacity: 0.88 },
  ];
  const meteorRockBlocks: PixelBlock[] = [
    { x: 70, y: 68, w: 24, h: 16, color: "#7c2d12", opacity: 0.96 },
    { x: 98, y: 74, w: 22, h: 16, color: "#9a3412", opacity: 0.96 },
    { x: 46, y: 84, w: 22, h: 18, color: "#c2410c", opacity: 0.96 },
    { x: 86, y: 98, w: 28, h: 18, color: "#ea580c", opacity: 0.96 },
  ];
  const meteorEmberBlocks: PixelBlock[] = [
    { x: 22, y: 50, w: 8, h: 8, color: "#fff7ed", opacity: 0.74 },
    { x: 130, y: 58, w: 9, h: 9, color: "#fed7aa", opacity: 0.66 },
    { x: 18, y: 116, w: 8, h: 8, color: "#f97316", opacity: 0.68 },
    { x: 132, y: 120, w: 8, h: 8, color: "#fef3c7", opacity: 0.68 },
  ];
  const glowBlocks: PixelBlock[] = [
    { x: 38, y: 48, w: 84, h: 26, color: "#fed7aa", opacity: 0.14 },
    { x: 28, y: 66, w: 100, h: 38, color: "#fb923c", opacity: 0.15 },
    { x: 34, y: 92, w: 82, h: 34, color: "#ef4444", opacity: 0.13 },
    { x: 14, y: 24, w: 58, h: 26, color: "#fb923c", opacity: 0.11 },
    { x: 96, y: 26, w: 52, h: 24, color: "#facc15", opacity: 0.1 },
  ];
  const meteorites = [
    { id: "main", x: 80, y: 91, scale: 0.66, flameDur: 0.44, coreDur: 0.55, emberDur: 1.25 },
    { id: "small-left", x: 47, y: 48, scale: 0.38, flameDur: 0.5, coreDur: 0.62, emberDur: 1.45 },
    { id: "small-right", x: 114, y: 45, scale: 0.33, flameDur: 0.56, coreDur: 0.68, emberDur: 1.6 },
  ];

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${(PALM_X / 859) * 100}%`,
        bottom: `${((495 - PALM_Y + 6) / 495) * 100}%`,
        opacity: equipScale,
        width: heldSpellSpriteSize(178, 0.26, 102),
        height: heldSpellSpriteSize(178, 0.26, 102),
        transform: `translate(-50%, 0) scale(${isCharging ? 1.14 : 1}) translateY(${isCharging ? '-4px' : '0'})`,
        filter: 'drop-shadow(0 0 12px rgba(251,146,60,0.78)) drop-shadow(0 0 24px rgba(248,113,113,0.36))'
      }}
    >
      <svg viewBox="0 0 160 160" className="h-full w-full" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
        <PixelBlocks blocks={glowBlocks} />
        {meteorites.map((meteorite) => (
          <g key={meteorite.id} transform={`translate(${meteorite.x} ${meteorite.y}) scale(${meteorite.scale}) translate(-80 -82)`}>
            <g transform="translate(80 82)">
              <g>
                {!MOBILE_PERFORMANCE_MODE && (
                  <>
                    <animateTransform attributeName="transform" type="scale" values="1;1.07 0.95;0.96 1.05;1.04 0.98;1" dur={`${meteorite.flameDur}s`} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.84;1;0.9;1;0.84" dur={`${meteorite.flameDur * 0.82}s`} repeatCount="indefinite" />
                  </>
                )}
                <g transform="translate(-80 -82)">
                  <PixelBlocks blocks={meteorFlameBlocks} />
                </g>
              </g>
            </g>
            <g transform="translate(80 82)">
              <g>
                {!MOBILE_PERFORMANCE_MODE && (
                  <>
                    <animateTransform attributeName="transform" type="scale" values="1;0.95;1.04;0.98;1" dur={`${meteorite.coreDur}s`} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.9;1;0.82;1;0.9" dur={`${meteorite.coreDur * 0.76}s`} repeatCount="indefinite" />
                  </>
                )}
                <g transform="translate(-80 -82)">
                  <PixelBlocks blocks={meteorCoreBlocks} />
                </g>
              </g>
            </g>
            <PixelBlocks blocks={meteorRockBlocks} />
            <g>
              {!MOBILE_PERFORMANCE_MODE && (
                <>
                  <animateTransform attributeName="transform" type="rotate" from="0 80 82" to="360 80 82" dur={`${meteorite.emberDur}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0.86;0.42;0.76;0.5" dur={`${meteorite.flameDur}s`} repeatCount="indefinite" />
                </>
              )}
              <PixelBlocks blocks={meteorEmberBlocks} />
            </g>
          </g>
        ))}
        {isCharging && (
          <PixelBlocks
            blocks={[
              { x: 122, y: 18, w: 10, h: 10, color: "#fff7ed", opacity: 0.72 },
              { x: 18, y: 44, w: 10, h: 10, color: "#fed7aa", opacity: 0.66 },
              { x: 118, y: 132, w: 12, h: 12, color: "#fb923c", opacity: 0.68 },
              { x: 28, y: 144, w: 8, h: 8, color: "#fef3c7", opacity: 0.68 },
            ]}
          />
        )}
      </svg>
    </div>
  );
}

type BuffSpellVariant = 'armor' | 'jump' | 'speed' | 'tungston' | 'sleep' | 'poison' | 'acid';

function TungstonChainGlyph({ isCharging }: { isCharging: boolean }) {
  const chainBlocks: PixelBlock[] = [
    { x: 32, y: 34, w: 10, h: 8, color: "#e2e8f0", rotation: -28 },
    { x: 43, y: 41, w: 10, h: 8, color: "#64748b", rotation: -28 },
    { x: 54, y: 48, w: 10, h: 8, color: "#cbd5e1", rotation: -28 },
    { x: 65, y: 55, w: 10, h: 8, color: "#475569", rotation: -28 },
    { x: 76, y: 62, w: 10, h: 8, color: "#94a3b8", rotation: -28 },
    { x: 87, y: 69, w: 10, h: 8, color: "#334155", rotation: -28 },
  ];
  const ballBlocks: PixelBlock[] = [
    { x: 82, y: 66, w: 44, h: 8, color: "#cbd5e1" },
    { x: 72, y: 74, w: 64, h: 14, color: "#94a3b8" },
    { x: 64, y: 88, w: 80, h: 28, color: "#64748b" },
    { x: 72, y: 116, w: 64, h: 14, color: "#334155" },
    { x: 84, y: 130, w: 40, h: 8, color: "#1f2937" },
    { x: 82, y: 76, w: 22, h: 8, color: "#f8fafc", opacity: 0.8 },
    { x: 74, y: 90, w: 16, h: 10, color: "#e2e8f0", opacity: 0.58 },
    { x: 122, y: 102, w: 14, h: 14, color: "#0f172a", opacity: 0.7 },
    { x: 96, y: 126, w: 28, h: 6, color: "#0f172a", opacity: 0.62 },
  ];

  return (
    <>
      <PixelBlocks blocks={chainBlocks} />
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values={isCharging ? "-2 -1;2 1;-1 2;-2 -1" : "0 0;1 -1;0 0"}
          dur={isCharging ? "0.32s" : "1.1s"}
          repeatCount="indefinite"
        />
        <PixelBlocks blocks={ballBlocks} />
      </g>
    </>
  );
}

function SleepPillGlyph() {
  return (
    <>
      <PixelBlocks
        blocks={[
          { x: 22, y: 57, w: 116, h: 12, color: "#dbeafe" },
          { x: 12, y: 69, w: 136, h: 32, color: "#60a5fa" },
          { x: 22, y: 101, w: 116, h: 12, color: "#1d4ed8" },
          { x: 8, y: 78, w: 16, h: 18, color: "#93c5fd" },
          { x: 136, y: 78, w: 16, h: 18, color: "#1e3a8a" },
          { x: 18, y: 73, w: 58, h: 24, color: "#bfdbfe", opacity: 0.72 },
          { x: 84, y: 73, w: 56, h: 24, color: "#2563eb", opacity: 0.88 },
          { x: 78, y: 66, w: 5, h: 48, color: "#e0f2fe", opacity: 0.76 },
          { x: 30, y: 75, w: 26, h: 5, color: "#ffffff", opacity: 0.72 },
        ]}
      />
      <text x="34" y="45" fill="#e0f2fe" fontFamily="monospace" fontSize="24" fontWeight="900">ZZZ</text>
      <text x="37" y="45" fill="#2563eb" fontFamily="monospace" fontSize="24" fontWeight="900" opacity="0.55">ZZZ</text>
    </>
  );
}

function ScienceVialGlyph({ variant }: { variant: 'poison' | 'acid' }) {
  const isAcid = variant === 'acid';
  const liquid = isAcid ? "#22c55e" : "#a855f7";
  const liquidDark = isAcid ? "#166534" : "#581c87";
  const liquidLight = isAcid ? "#bbf7d0" : "#f0abfc";
  const glass = isAcid ? "#dcfce7" : "#fae8ff";
  const rim = isAcid ? "#86efac" : "#e879f9";

  return (
    <g transform="rotate(-7 80 86)">
      <polygon points="80,38 21,138 139,138" fill={liquid} opacity="0.12" />
      <rect x="66" y="20" width="28" height="11" fill={glass} opacity="0.92" />
      <rect x="61" y="31" width="38" height="8" fill={rim} opacity="0.82" />
      <rect x="70" y="38" width="20" height="18" fill={glass} opacity="0.28" />
      <polygon points="80,50 29,136 131,136" fill="rgba(255,255,255,0.13)" stroke={glass} strokeWidth="5" strokeLinejoin="round" />
      <polygon points="80,72 45,130 115,130" fill={liquidDark} opacity="0.92" />
      <polygon points="80,82 54,125 107,125" fill={liquid} opacity="1" />
      <polygon points="80,95 64,122 99,122" fill={liquidLight} opacity="0.36" />
      <rect x="55" y="119" width="50" height="7" fill={liquidLight} opacity="0.25" />
      <rect x="58" y="98" width="12" height="12" fill={liquidLight} opacity="0.8" />
      <rect x="88" y="85" width="9" height="9" fill={liquidLight} opacity="0.72" />
      <rect x="76" y="112" width="7" height="7" fill={glass} opacity="0.62" />
      <rect x="48" y="131" width="66" height="6" fill={liquidDark} opacity="0.72" />
      <rect x="71" y="24" width="15" height="4" fill="#ffffff" opacity="0.74" />
      <rect x="43" y="84" width="7" height="28" fill="#ffffff" opacity="0.34" />
      <rect x="53" y="68" width="7" height="11" fill="#ffffff" opacity="0.22" />
      <rect x="119" y="118" width="8" height="8" fill={liquid} opacity="0.5" />
      <rect x="29" y="126" width="8" height="8" fill={liquidLight} opacity="0.46" />
    </g>
  );
}

function BuffSpellGlyph({ variant, blocks, isCharging }: { variant: BuffSpellVariant; blocks: PixelBlock[]; isCharging: boolean }) {
  if (variant === 'tungston') return <TungstonChainGlyph isCharging={isCharging} />;
  if (variant === 'sleep') return <SleepPillGlyph />;
  if (variant === 'poison' || variant === 'acid') return <ScienceVialGlyph variant={variant} />;
  return <PixelBlocks blocks={blocks} />;
}

function BuffSpellCanvas({ isActive, isCharging, variant }: { isActive: boolean, isCharging: boolean, variant: BuffSpellVariant }) {
  const [equipScale, setEquipScale] = useState(0);

  useEffect(() => {
    let animInterval: any;
    if (isActive) {
      if (equipScale < 1) animInterval = setInterval(() => setEquipScale(p => +(Math.min(1, p + 0.2)).toFixed(1)), 30);
    } else {
      if (equipScale > 0) animInterval = setInterval(() => setEquipScale(p => +(Math.max(0, p - 0.2)).toFixed(1)), 30);
    }
    return () => clearInterval(animInterval);
  }, [isActive, equipScale]);

  if (equipScale === 0) return null;

  const config = {
    armor: {
      glow: 'rgba(56,189,248,0.78)',
      shadow: 'rgba(14,165,233,0.35)',
      duration: '0.72s',
      blocks: [
        { x: 65, y: 16, w: 30, h: 10, color: '#e0f2fe' },
        { x: 48, y: 26, w: 64, h: 14, color: '#7dd3fc' },
        { x: 39, y: 40, w: 82, h: 28, color: '#38bdf8' },
        { x: 43, y: 68, w: 74, h: 24, color: '#0284c7' },
        { x: 53, y: 92, w: 54, h: 22, color: '#0369a1' },
        { x: 67, y: 114, w: 26, h: 14, color: '#bae6fd' },
        { x: 58, y: 46, w: 44, h: 8, color: 'rgba(255,255,255,0.78)' },
        { x: 74, y: 55, w: 12, h: 50, color: 'rgba(224,242,254,0.38)' },
        { x: 22, y: 44, w: 8, h: 8, color: '#7dd3fc', opacity: 0.72 },
        { x: 130, y: 52, w: 8, h: 8, color: '#bae6fd', opacity: 0.72 },
      ] satisfies PixelBlock[],
      sparks: [
        { x: 23, y: 25, w: 6, h: 6, color: '#e0f2fe', opacity: 0.75 },
        { x: 132, y: 88, w: 7, h: 7, color: '#7dd3fc', opacity: 0.7 },
        { x: 31, y: 116, w: 8, h: 8, color: '#38bdf8', opacity: 0.58 },
      ] satisfies PixelBlock[],
    },
    jump: {
      glow: 'rgba(190,242,100,0.78)',
      shadow: 'rgba(34,197,94,0.35)',
      duration: '0.62s',
      blocks: [
        { x: 74, y: 16, w: 12, h: 78, color: 'rgba(190,242,100,0.22)' },
        { x: 58, y: 20, w: 44, h: 14, color: '#f7fee7' },
        { x: 48, y: 34, w: 64, h: 16, color: '#bef264' },
        { x: 60, y: 50, w: 40, h: 44, color: '#22c55e' },
        { x: 50, y: 94, w: 60, h: 12, color: '#14532d' },
        { x: 32, y: 110, w: 32, h: 12, color: '#a3e635' },
        { x: 96, y: 110, w: 32, h: 12, color: '#a3e635' },
        { x: 24, y: 70, w: 10, h: 10, color: '#22c55e', opacity: 0.72 },
        { x: 128, y: 62, w: 10, h: 10, color: '#bef264', opacity: 0.72 },
      ] satisfies PixelBlock[],
      sparks: [
        { x: 74, y: 4, w: 12, h: 8, color: '#f7fee7', opacity: 0.85 },
        { x: 15, y: 89, w: 8, h: 8, color: '#bef264', opacity: 0.65 },
        { x: 138, y: 101, w: 7, h: 7, color: '#22c55e', opacity: 0.65 },
      ] satisfies PixelBlock[],
    },
    speed: {
      glow: 'rgba(250,204,21,0.82)',
      shadow: 'rgba(34,211,238,0.34)',
      duration: '0.36s',
      blocks: [
        { x: 22, y: 35, w: 82, h: 12, color: '#fef08a', rotation: -8 },
        { x: 46, y: 53, w: 86, h: 14, color: '#facc15', rotation: -8 },
        { x: 28, y: 76, w: 96, h: 16, color: '#22d3ee', rotation: -8 },
        { x: 61, y: 99, w: 62, h: 12, color: '#fde047', rotation: -8 },
        { x: 18, y: 113, w: 52, h: 9, color: '#0ea5e9', rotation: -8, opacity: 0.85 },
        { x: 120, y: 25, w: 14, h: 14, color: '#fefce8' },
        { x: 133, y: 62, w: 10, h: 10, color: '#fef08a' },
        { x: 138, y: 92, w: 8, h: 8, color: '#67e8f9' },
      ] satisfies PixelBlock[],
      sparks: [
        { x: 18, y: 56, w: 8, h: 8, color: '#fde047', opacity: 0.72 },
        { x: 12, y: 88, w: 7, h: 7, color: '#67e8f9', opacity: 0.68 },
        { x: 134, y: 119, w: 8, h: 8, color: '#fef08a', opacity: 0.7 },
      ] satisfies PixelBlock[],
    },
    tungston: {
      glow: 'rgba(148,163,184,0.78)',
      shadow: 'rgba(15,23,42,0.45)',
      duration: '0.82s',
      blocks: [
        { x: 48, y: 48, w: 64, h: 20, color: 'rgba(148,163,184,0.22)' },
        { x: 52, y: 50, w: 28, h: 28, color: '#cbd5e1' },
        { x: 81, y: 62, w: 28, h: 28, color: '#64748b' },
        { x: 60, y: 58, w: 12, h: 8, color: '#f8fafc', opacity: 0.86 },
        { x: 88, y: 70, w: 10, h: 8, color: '#94a3b8', opacity: 0.82 },
        { x: 37, y: 84, w: 86, h: 8, color: '#475569', rotation: -7 },
        { x: 29, y: 98, w: 102, h: 6, color: 'rgba(226,232,240,0.58)', rotation: 9 },
      ] satisfies PixelBlock[],
      sparks: [
        { x: 28, y: 40, w: 8, h: 8, color: '#e2e8f0', opacity: 0.72 },
        { x: 124, y: 48, w: 7, h: 7, color: '#94a3b8', opacity: 0.72 },
        { x: 36, y: 116, w: 8, h: 8, color: '#475569', opacity: 0.58 },
      ] satisfies PixelBlock[],
    },
    sleep: {
      glow: 'rgba(125,211,252,0.78)',
      shadow: 'rgba(29,78,216,0.38)',
      duration: '1.05s',
      blocks: [
        { x: 55, y: 34, w: 48, h: 12, color: '#e0f2fe' },
        { x: 45, y: 46, w: 68, h: 20, color: '#7dd3fc' },
        { x: 49, y: 66, w: 62, h: 22, color: '#38bdf8' },
        { x: 58, y: 88, w: 42, h: 16, color: '#1d4ed8' },
        { x: 75, y: 47, w: 12, h: 38, color: 'rgba(255,255,255,0.44)' },
        { x: 106, y: 25, w: 12, h: 12, color: '#e0f2fe' },
        { x: 123, y: 13, w: 8, h: 8, color: '#e0f2fe' },
      ] satisfies PixelBlock[],
      sparks: [
        { x: 26, y: 48, w: 8, h: 8, color: '#bae6fd', opacity: 0.74 },
        { x: 128, y: 86, w: 7, h: 7, color: '#7dd3fc', opacity: 0.68 },
        { x: 34, y: 111, w: 8, h: 8, color: '#1d4ed8', opacity: 0.58 },
      ] satisfies PixelBlock[],
    },
    poison: {
      glow: 'rgba(168,85,247,0.82)',
      shadow: 'rgba(88,28,135,0.48)',
      duration: '0.7s',
      blocks: [
        { x: 54, y: 30, w: 52, h: 11, color: '#f0abfc' },
        { x: 44, y: 41, w: 72, h: 17, color: '#d946ef' },
        { x: 38, y: 58, w: 84, h: 34, color: '#a855f7' },
        { x: 47, y: 92, w: 66, h: 22, color: '#581c87' },
        { x: 63, y: 114, w: 34, h: 11, color: '#f0abfc' },
        { x: 66, y: 47, w: 30, h: 8, color: 'rgba(255,255,255,0.62)' },
        { x: 31, y: 73, w: 12, h: 12, color: '#c084fc' },
        { x: 118, y: 67, w: 10, h: 10, color: '#e879f9' },
      ] satisfies PixelBlock[],
      sparks: [
        { x: 24, y: 34, w: 8, h: 8, color: '#f0abfc', opacity: 0.75 },
        { x: 129, y: 98, w: 8, h: 8, color: '#c084fc', opacity: 0.66 },
        { x: 38, y: 128, w: 7, h: 7, color: '#a855f7', opacity: 0.62 },
      ] satisfies PixelBlock[],
    },
    acid: {
      glow: 'rgba(34,197,94,0.82)',
      shadow: 'rgba(22,101,52,0.48)',
      duration: '0.62s',
      blocks: [
        { x: 54, y: 30, w: 52, h: 11, color: '#bbf7d0' },
        { x: 44, y: 41, w: 72, h: 17, color: '#86efac' },
        { x: 38, y: 58, w: 84, h: 34, color: '#22c55e' },
        { x: 47, y: 92, w: 66, h: 22, color: '#166534' },
        { x: 63, y: 114, w: 34, h: 11, color: '#dcfce7' },
        { x: 66, y: 47, w: 30, h: 8, color: 'rgba(255,255,255,0.62)' },
        { x: 31, y: 73, w: 12, h: 12, color: '#4ade80' },
        { x: 118, y: 67, w: 10, h: 10, color: '#bbf7d0' },
      ] satisfies PixelBlock[],
      sparks: [
        { x: 24, y: 34, w: 8, h: 8, color: '#bbf7d0', opacity: 0.75 },
        { x: 129, y: 98, w: 8, h: 8, color: '#4ade80', opacity: 0.66 },
        { x: 38, y: 128, w: 7, h: 7, color: '#22c55e', opacity: 0.62 },
      ] satisfies PixelBlock[],
    },
  }[variant];

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${(PALM_X / 859) * 100}%`,
        bottom: `${((495 - PALM_Y + 5) / 495) * 100}%`,
        opacity: equipScale,
        width: heldSpellSpriteSize(165, 0.25, 96),
        height: heldSpellSpriteSize(165, 0.25, 96),
        transform: `translate(-50%, 0) scale(${isCharging ? 1.14 : 1}) translateY(${isCharging ? '-5px' : '0'})`,
        filter: `drop-shadow(0 0 12px ${config.glow}) drop-shadow(0 0 24px ${config.shadow})`
      }}
    >
      <svg viewBox="0 0 160 160" className="h-full w-full" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
        <rect x="18" y="24" width="124" height="108" fill={config.glow} opacity="0.23" />
        <g>
          <animateTransform attributeName="transform" type="scale" values="1;1.04 0.98;0.98 1.03;1" dur={config.duration} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.86;1;0.78;0.96;0.86" dur={config.duration} repeatCount="indefinite" />
          <BuffSpellGlyph variant={variant} blocks={config.blocks} isCharging={isCharging} />
        </g>
        <g>
          <animateTransform attributeName="transform" type="translate" values="-2 0;3 -2;-1 1;-2 0" dur="0.68s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0.92;0.32;0.76;0.4" dur="0.52s" repeatCount="indefinite" />
          <PixelBlocks blocks={config.sparks} />
        </g>
      </svg>
    </div>
  );
}

// ============== SPELL: ARCANE BEAM (BIDEN BLAST) ============== //
// "Hands" mode — no HUD spell effect. The purple phase beam only exists
// as a 3D projectile (PhaseBeam in Projectiles.tsx) when fired.
function ArcaneBeamCanvas({ isActive, isCharging }: { isActive: boolean, isCharging: boolean }) {
  return null;
}

function MagicHandsContent({
  playerState,
  currentSpell,
  frame,
  isChargingSpell,
  align,
  showFiringPose,
  showSpellEffects,
}: {
  playerState: any,
  currentSpell: SpellType,
  frame: number,
  isChargingSpell: boolean,
  align: 'left' | 'right',
  showFiringPose: boolean,
  showSpellEffects: boolean,
}) {
  const isSpellMenuOpen = useGameStore(s => s.isSpellMenuOpen);
  const shouldMirrorLeftHand = align === 'left' && showFiringPose && !isSpellMenuOpen;
  const shouldMirrorRightHand = align === 'right' && !showFiringPose;
  const shouldPutSpellsBehindHand = showSpellEffects && showFiringPose && !isSpellMenuOpen;
  const activeSpellEffect = (() => {
    switch (currentSpell) {
      case 'fireball':
      case 'flamethrower':
        return <FireballCanvas isActive isCharging={isChargingSpell} />;
      case 'iceshard':
        return !isChargingSpell ? <IceShardCanvas isActive isCharging={isChargingSpell} /> : null;
      case 'icespell':
        return <IceSpellCanvas isActive isCharging={isChargingSpell} />;
      case 'healspell':
        return <HealSpellCanvas isActive isCharging={isChargingSpell} />;
      case 'ringsofpower':
        return <RingsSpellCanvas isActive isCharging={isChargingSpell} />;
      case 'portal':
        return <PortalGifCanvas isActive isCharging={isChargingSpell} />;
      case 'lightning':
        return <LightningSpellCanvas isActive isCharging={isChargingSpell} />;
      case 'blink':
        return <BlinkGifCanvas isActive isCharging={isChargingSpell} />;
      case 'grab':
        return !isChargingSpell ? <GrabSpellCanvas isActive isCharging={isChargingSpell} /> : null;
      case 'tornado':
        return <TornadoSpellCanvas isActive isCharging={isChargingSpell} />;
      case 'meteorshower':
        return <MeteorShowerCanvas isActive isCharging={isChargingSpell} />;
      case 'smokebomb':
        return <SmokeBombGifCanvas isActive isCharging={isChargingSpell} />;
      case 'discshield':
        return <DiscShieldCanvas isActive isCharging={isChargingSpell} />;
      case 'orbshield':
        return <OrbShieldCanvas isActive isCharging={isChargingSpell} />;
      case 'kunai':
        return <KunaiCanvas isActive isCharging={isChargingSpell} />;
      case 'healingcrystals':
        return <HealingCrystalsCanvas isActive isCharging={isChargingSpell} />;
      case 'magicarmor':
        return <BuffSpellCanvas isActive isCharging={isChargingSpell} variant="armor" />;
      case 'jumpboost':
        return <BuffSpellCanvas isActive isCharging={isChargingSpell} variant="jump" />;
      case 'speedboost':
        return <BuffSpellCanvas isActive isCharging={isChargingSpell} variant="speed" />;
      case 'tungstonballsack':
        return <BuffSpellCanvas isActive isCharging={isChargingSpell} variant="tungston" />;
      case 'sleep':
        return <BuffSpellCanvas isActive isCharging={isChargingSpell} variant="sleep" />;
      case 'poison':
        return <BuffSpellCanvas isActive isCharging={isChargingSpell} variant="poison" />;
      case 'acid':
        return <BuffSpellCanvas isActive isCharging={isChargingSpell} variant="acid" />;
      case 'magicglassorb':
        return <MagicGlassOrbCanvas isActive isCharging={isChargingSpell} align={align} />;
      default:
        return null;
    }
  })();
  const spellEffects = (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        transform: align === 'right' ? 'scaleX(-1)' : undefined,
        transformOrigin: 'center',
        zIndex: shouldPutSpellsBehindHand ? 1 : 3,
      }}
    >
      {activeSpellEffect}
    </div>
  );
  
  return (
    <div className={cn(
      "absolute inset-0 pointer-events-none transition-transform duration-200",
      playerState.isSliding ? "translate-y-16" :
      playerState.isCrouching ? "translate-y-10" :
      (playerState.isGrounded && playerState.isSprinting) ? "animate-bob-sprint" : 
      (playerState.isGrounded && playerState.isMoving) ? "animate-bob-walk" : ""
    )}>
      <div className="absolute inset-0">
        {showSpellEffects && !isSpellMenuOpen && shouldPutSpellsBehindHand && spellEffects}
        <ImageHandCanvas
          imageSrc={getSpriteUrl(`/sprites/misc/idle_${frame}.png`) || `/sprites/misc/idle_${frame}.png`}
          side={align}
          mirrorRightToLeft={shouldMirrorLeftHand}
          mirrorLeftToRight={shouldMirrorRightHand}
          poseScale={showFiringPose ? 0.76 : 1}
        />
        
        {showSpellEffects && !isSpellMenuOpen && !shouldPutSpellsBehindHand && spellEffects}
      </div>
    </div>
  );
}

// ============== MAIN COMPONENT ============== //
export function MagicHands({ playerState, leftSpell, rightSpell }: { playerState: any, leftSpell: SpellType, rightSpell: SpellType }) {
  const isChargingSpell = useGameStore(s => s.isChargingSpell);
  const chargingHand = useGameStore(s => s.chargingHand);
  const chargingHands = useGameStore(s => s.chargingHands);
  const aspectRatio = useGameStore(s => s.aspectRatio);
  const isSpellMenuOpen = useGameStore(s => s.isSpellMenuOpen);
  const isMagicArmed = useGameStore(s => s.isMagicArmed);
  const leftRunePower = useGameStore(s => s.leftRunePower);
  const rightRunePower = useGameStore(s => s.rightRunePower);
  const [frame, setFrame] = useState(1);
  const [showLeftFiringPose, setShowLeftFiringPose] = useState(false);
  const [showRightFiringPose, setShowRightFiringPose] = useState(false);
  const leftFiringPoseTimeoutRef = useRef<number | null>(null);
  const rightFiringPoseTimeoutRef = useRef<number | null>(null);
  const totalFrames = 4;
  const isLeftCharging = chargingHands.left || (isChargingSpell && chargingHand === 'left');
  const isRightCharging = chargingHands.right || (isChargingSpell && chargingHand === 'right');
  const leftRuneReady = hasRunePower(leftRunePower);
  const rightRuneReady = hasRunePower(rightRunePower);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(prev => (prev % totalFrames) + 1);
    }, 200);
    return () => clearInterval(interval);
  }, [totalFrames]);

  useEffect(() => {
    if (leftFiringPoseTimeoutRef.current !== null) {
      window.clearTimeout(leftFiringPoseTimeoutRef.current);
      leftFiringPoseTimeoutRef.current = null;
    }

    if (!isMagicArmed || isSpellMenuOpen || leftSpell === 'arcanebeam') {
      setShowLeftFiringPose(false);
      return;
    }

    if (isLeftCharging) {
      setShowLeftFiringPose(true);
      return;
    }

    if (showLeftFiringPose) {
      leftFiringPoseTimeoutRef.current = window.setTimeout(() => {
        setShowLeftFiringPose(false);
        leftFiringPoseTimeoutRef.current = null;
      }, 140);
    }
  }, [isMagicArmed, leftSpell, isLeftCharging, isSpellMenuOpen, showLeftFiringPose]);

  useEffect(() => {
    if (rightFiringPoseTimeoutRef.current !== null) {
      window.clearTimeout(rightFiringPoseTimeoutRef.current);
      rightFiringPoseTimeoutRef.current = null;
    }

    if (!isMagicArmed || isSpellMenuOpen || rightSpell === 'arcanebeam') {
      setShowRightFiringPose(false);
      return;
    }

    if (isRightCharging) {
      setShowRightFiringPose(true);
      return;
    }

    if (showRightFiringPose) {
      rightFiringPoseTimeoutRef.current = window.setTimeout(() => {
        setShowRightFiringPose(false);
        rightFiringPoseTimeoutRef.current = null;
      }, 140);
    }
  }, [isMagicArmed, rightSpell, isRightCharging, isSpellMenuOpen, showRightFiringPose]);

  useEffect(() => () => {
    if (leftFiringPoseTimeoutRef.current !== null) {
      window.clearTimeout(leftFiringPoseTimeoutRef.current);
    }
    if (rightFiringPoseTimeoutRef.current !== null) {
      window.clearTimeout(rightFiringPoseTimeoutRef.current);
    }
  }, []);

  const leftFiringPoseActive = isMagicArmed && !isSpellMenuOpen && leftRuneReady && leftSpell !== 'arcanebeam' && (isLeftCharging || showLeftFiringPose);
  const rightFiringPoseActive = isMagicArmed && !isSpellMenuOpen && rightRuneReady && rightSpell !== 'arcanebeam' && (isRightCharging || showRightFiringPose);
  const leftUnpoweredPoseActive = isMagicArmed && !isSpellMenuOpen && !leftRuneReady;
  const rightUnpoweredPoseActive = isMagicArmed && !isSpellMenuOpen && !rightRuneReady;
  const leftHandUsesFiringSprite = leftFiringPoseActive || leftUnpoweredPoseActive;
  const rightHandUsesFiringSprite = rightFiringPoseActive || rightUnpoweredPoseActive;
  const leftHandTranslate = leftHandUsesFiringSprite ? '-8%' : '-8.5%';
  const rightHandTranslate = rightHandUsesFiringSprite ? '8%' : '8.5%';
  const aspectOffsetClass =
    aspectRatio === '21/9' ? "magic-hands-ultrawide-offset" :
    aspectRatio === '4/3' ? "magic-hands-classic-offset" :
    aspectRatio === 'Fill' ? "magic-hands-fill-offset" : "";

  if ((playerState.isMeditating || !isMagicArmed) && !isSpellMenuOpen) {
    return null;
  }

  const handsLayer = (
    <>
      {/* Left Half (Left Hand & Spells) */}
      <div className="absolute top-0 left-0 w-1/2 h-full overflow-hidden pointer-events-none z-[60]">
        <div className="magic-hands-frame magic-hands-frame-left absolute top-0 left-0 h-full aspect-video" style={{ transform: `translateX(${leftHandTranslate})` }}>
          <MagicHandsContent playerState={playerState} currentSpell={leftSpell} frame={frame} isChargingSpell={leftRuneReady && isLeftCharging} align="left" showFiringPose={leftHandUsesFiringSprite} showSpellEffects={leftRuneReady} />
        </div>
      </div>
      
      {/* Right Half (Right Hand) */}
      <div className="absolute top-0 right-0 w-1/2 h-full overflow-hidden pointer-events-none z-[60]">
        <div className="magic-hands-frame magic-hands-frame-right absolute top-0 right-0 h-full aspect-video" style={{ transform: `translateX(${rightHandTranslate})`, transformOrigin: 'bottom right' }}>
          <MagicHandsContent playerState={playerState} currentSpell={rightSpell} frame={frame} isChargingSpell={rightRuneReady && isRightCharging} align="right" showFiringPose={rightHandUsesFiringSprite} showSpellEffects={rightRuneReady} />
        </div>
      </div>
    </>
  );

  if (isSpellMenuOpen) {
    return null;
  }

  return (
    <div className={cn("absolute inset-0 pointer-events-none transition-transform duration-200 z-40", aspectOffsetClass)}>
      {handsLayer}
    </div>
  );
}
