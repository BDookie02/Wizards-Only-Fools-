import { useEffect, useRef } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getSpriteUrl } from "../../SpriteManifest";
import {
  PALM_X,
  PALM_Y,
  heldSpellSpriteSize,
} from "./MagicHandSpriteCanvas";
import { processFireballPixels } from "./magicHandSpellEffectsRuntime";
import { useMagicHandEquipScale, useSteppedToggleValue } from "./useMagicHandEquipScale";
import { useLoopedFrameTimer } from "./useLoopedFrameTimer";

type SpriteSpellEffectProps = {
  isActive: boolean;
  isCharging: boolean;
};

type FrameCache = Record<string, HTMLCanvasElement>;

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function resolveSpriteUrl(path: string) {
  return getSpriteUrl(path) || path;
}

function useLoopedFrame(isRunning: boolean, frameCount: number, intervalMs = 100) {
  return useLoopedFrameTimer({ isRunning, frameCount, intervalMs, firstFrame: 1 });
}

function buildFallbackSprite(color: string) {
  const offscreen = document.createElement("canvas");
  offscreen.width = 48;
  offscreen.height = 48;
  const offCtx = offscreen.getContext("2d");
  if (offCtx) {
    offCtx.fillStyle = color;
    offCtx.beginPath();
    offCtx.arc(24, 24, 10, 0, Math.PI * 2);
    offCtx.fill();
  }
  return offscreen;
}

function loadProcessedFrame({
  cache,
  imageSrc,
  fallbackColor,
  onReady,
}: {
  cache: FrameCache;
  imageSrc: string;
  fallbackColor: string;
  onReady: (frame: HTMLCanvasElement) => void;
}) {
  if (cache[imageSrc]) {
    onReady(cache[imageSrc]);
    return;
  }

  const img = new Image();
  let triedFallback = false;

  img.onload = () => {
    const offscreen = document.createElement("canvas");
    offscreen.width = 48;
    offscreen.height = 48;
    const offCtx = offscreen.getContext("2d", { willReadFrequently: true });
    if (!offCtx) {
      const fallback = buildFallbackSprite(fallbackColor);
      cache[imageSrc] = fallback;
      onReady(fallback);
      return;
    }

    const cropX = img.width * 0.02;
    const cropY = img.height * 0.02;
    const cropW = img.width * 0.96;
    const cropH = img.height * 0.96;
    offCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, 48, 48);
    processFireballPixels(offCtx, 48, 48);
    cache[imageSrc] = offscreen;
    onReady(offscreen);
  };

  img.onerror = () => {
    if (!triedFallback) {
      triedFallback = true;
      img.src = resolveSpriteUrl("/sprites/fireball/fireball_1.png");
      return;
    }

    const fallback = buildFallbackSprite(fallbackColor);
    cache[imageSrc] = fallback;
    onReady(fallback);
  };

  img.crossOrigin = "anonymous";
  img.src = imageSrc;
}

function drawPalmSprite(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  cacheCanvas: HTMLCanvasElement,
  isCharging: boolean,
  scaleIn = 1,
) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const scale = (isCharging ? 1.4 : 1.0) * scaleIn;
  const shakeX = isCharging ? (Math.random() - 0.5) * 4 : 0;
  const shakeY = isCharging ? (Math.random() - 0.5) * 4 : 0;
  const fbW = 160 * scale;
  const fbH = 160 * scale;
  const fbX = PALM_X - fbW / 2 + shakeX;
  const fbY = PALM_Y - fbH + shakeY - (isCharging ? 10 : 0);
  ctx.drawImage(cacheCanvas, fbX, fbY, fbW, fbH);
}

function PalmSpriteCanvas({
  isActive,
  isCharging,
  frameCount,
  framePath,
  frameCache,
  fallbackColor = "rgba(255, 150, 0, 0.5)",
  chargingClassName,
  idleClassName,
}: SpriteSpellEffectProps & {
  frameCount: number;
  framePath: (frame: number) => string;
  frameCache: FrameCache;
  fallbackColor?: string;
  chargingClassName: string;
  idleClassName: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const equipScale = useMagicHandEquipScale(isActive);
  const idleFrame = useLoopedFrame(equipScale > 0, frameCount);
  const imageSrc = resolveSpriteUrl(framePath(idleFrame));

  useEffect(() => {
    if (equipScale === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    loadProcessedFrame({
      cache: frameCache,
      imageSrc,
      fallbackColor,
      onReady: (frame) => drawPalmSprite(ctx, canvas, frame, isCharging, equipScale),
    });
  }, [equipScale, fallbackColor, frameCache, imageSrc, isCharging]);

  if (equipScale === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      width={859}
      height={495}
      className={cn(
        "absolute top-0 left-0 w-full h-full object-contain object-bottom pointer-events-none z-50 transition-all duration-100",
        isCharging ? chargingClassName : idleClassName,
      )}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

const fireballFrameCache: FrameCache = {};

function useFireballEquipFrame(isActive: boolean) {
  return useSteppedToggleValue({
    isActive,
    minValue: 0,
    maxValue: 5,
    step: 1,
    intervalMs: 60,
    roundValue: Math.round,
  });
}

export function FireballCanvas({ isActive, isCharging }: SpriteSpellEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const equipFrame = useFireballEquipFrame(isActive);
  const idleFrame = useLoopedFrame(equipFrame > 0, 10);
  const rawImageSrc = equipFrame === 0
    ? ""
    : equipFrame === 5
      ? `/sprites/fireball/fireballidle_${idleFrame}.png`
      : `/sprites/fireball/fireball_${equipFrame}.png`;
  const imageSrc = rawImageSrc ? resolveSpriteUrl(rawImageSrc) : "";

  useEffect(() => {
    if (equipFrame === 0 || !imageSrc) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    loadProcessedFrame({
      cache: fireballFrameCache,
      imageSrc,
      fallbackColor: "rgba(255, 150, 0, 0.5)",
      onReady: (frame) => drawPalmSprite(ctx, canvas, frame, isCharging),
    });
  }, [equipFrame, imageSrc, isCharging]);

  if (equipFrame === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      width={859}
      height={495}
      className={cn(
        "absolute top-0 left-0 w-full h-full object-contain object-bottom pointer-events-none z-50 transition-all duration-100",
        isCharging ? "drop-shadow-[0_0_30px_rgba(255,150,0,1)] scale-[1.02]" : "drop-shadow-[0_0_20px_rgba(255,100,0,0.8)]",
      )}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

const ICESHARD_FRAMES = [1, 2, 3, 4, 5, 6];

export function IceShardCanvas({ isActive, isCharging }: SpriteSpellEffectProps) {
  const equipScale = useMagicHandEquipScale(isActive);
  const idleFrame = useLoopedFrame(equipScale > 0, 6);

  if (equipScale === 0) return null;

  return (
    <>
      <svg width="0" height="0" style={{ position: "absolute" }}>
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
          overflow: "hidden",
          clipPath: "inset(3%)",
        }}
      >
        {ICESHARD_FRAMES.map((frame) => (
          <img
            key={frame}
            src={resolveSpriteUrl(`/sprites/iceshard/spells_${frame}.png`)}
            decoding="async"
            className="absolute inset-0 w-full h-full object-contain"
            style={{
              imageRendering: "pixelated",
              filter: "url(#remove-black-biden)",
              visibility: frame === idleFrame ? "visible" : "hidden",
            }}
            onError={(event) => {
              console.warn(`Biden Blast frame ${frame} failed to load`);
              event.currentTarget.style.display = "none";
            }}
          />
        ))}
      </div>
    </>
  );
}

const healSpellFrameCache: FrameCache = {};

export function HealSpellCanvas(props: SpriteSpellEffectProps) {
  return (
    <PalmSpriteCanvas
      {...props}
      frameCount={13}
      framePath={(frame) => `/sprites/healspell/healspell_${frame}.png`}
      frameCache={healSpellFrameCache}
      chargingClassName="drop-shadow-[0_0_80px_rgba(255,215,0,1)] scale-[1.05]"
      idleClassName="drop-shadow-[0_0_20px_rgba(255,215,0,0.8)]"
    />
  );
}

const iceSpellFrameCache: FrameCache = {};

export function IceSpellCanvas(props: SpriteSpellEffectProps) {
  return (
    <PalmSpriteCanvas
      {...props}
      frameCount={8}
      framePath={(frame) => `/sprites/icespell/icespell_${frame}.png`}
      frameCache={iceSpellFrameCache}
      chargingClassName="drop-shadow-[0_0_30px_rgba(0,255,255,1)] scale-[1.02] mix-blend-screen"
      idleClassName="drop-shadow-[0_0_20px_rgba(0,255,255,0.8)] mix-blend-screen"
    />
  );
}

const ringsSpellFrameCache: FrameCache = {};

export function RingsSpellCanvas(props: SpriteSpellEffectProps) {
  return (
    <PalmSpriteCanvas
      {...props}
      frameCount={6}
      framePath={(frame) => `/sprites/ringsofpower/ringsofpower_${frame}.png`}
      frameCache={ringsSpellFrameCache}
      chargingClassName="drop-shadow-[0_0_30px_rgba(168,85,247,1)] scale-[1.02]"
      idleClassName="drop-shadow-[0_0_20px_rgba(168,85,247,0.8)]"
    />
  );
}
