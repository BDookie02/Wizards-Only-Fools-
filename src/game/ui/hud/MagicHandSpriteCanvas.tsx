import { useEffect, useRef } from "react";
import { isMobilePerformanceMode } from "../../systems/input/performanceMode";

export const MAGIC_HANDS_MOBILE_PERFORMANCE_MODE = isMobilePerformanceMode();

export function handSpriteSize(basePx: number, heightRatio = 0.27, minPx = Math.round(basePx * 0.58)) {
  if (!MAGIC_HANDS_MOBILE_PERFORMANCE_MODE) return `${basePx}px`;
  return `clamp(${minPx}px, calc(var(--app-vh, 100dvh) * ${heightRatio}), ${basePx}px)`;
}

export function heldSpellSpriteSize(basePx: number, heightRatio = 0.27, minPx = Math.round(basePx * 0.58)) {
  const scale = 0.82;
  return handSpriteSize(Math.round(basePx * scale), heightRatio * scale, Math.round(minPx * scale));
}

// Global offsets for aligning spells to the center of the left hand palm.
export const PALM_X = 360;
export const PALM_Y = 320;
export const SVG_PALM_X = (PALM_X / 859) * 256;
export const SVG_PALM_Y = (PALM_Y / 495) * 144;

const handsFrameCache: Record<string, HTMLCanvasElement> = {};

function applyHandPixelFilter(canvas: HTMLCanvasElement) {
  const width = canvas.width;
  const height = canvas.height;
  if (width <= 0 || height <= 0) return;

  const maxPixelSourceSide = MAGIC_HANDS_MOBILE_PERFORMANCE_MODE ? 168 : 220;
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

export function ImageHandCanvas({
  imageSrc,
  side,
  mirrorRightToLeft = false,
  mirrorLeftToRight = false,
  poseScale = 1,
}: {
  imageSrc: string;
  side: "left" | "right";
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
        const offCtx = offscreen.getContext("2d", { willReadFrequently: true });
        if (!offCtx) {
          drawFallbackFrame();
          return;
        }

        offCtx.drawImage(img, 0, 0);
        try {
          const imgData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
          const data = imgData.data;
          for (let index = 0; index < data.length; index += 4) {
            if (data[index] < 20 && data[index + 1] < 20 && data[index + 2] < 20) {
              data[index + 3] = 0;
            }
          }
          offCtx.putImageData(imgData, 0, 0);
        } catch {
          // If an embedded browser marks the hand source unreadable, keep the raw frame visible.
        }
        applyHandPixelFilter(offscreen);
        handsFrameCache[imageSrc] = offscreen;
        drawCachedFrame(handsFrameCache[imageSrc]);
      };
      img.onerror = drawFallbackFrame;
      img.src = imageSrc;
    } else {
      drawCachedFrame(handsFrameCache[imageSrc]);
    }
  }, [imageSrc, mirrorLeftToRight, mirrorRightToLeft, side]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full object-contain object-bottom pointer-events-none"
      style={{
        imageRendering: "pixelated",
        zIndex: 2,
        transform: poseScale === 1 ? undefined : `scale(${poseScale})`,
        transformOrigin: side === "left" ? "bottom left" : "bottom right",
        clipPath: mirrorRightToLeft
          ? "polygon(0% 0%, 53.5% 0%, 53.5% 100%, 0% 100%)"
          : mirrorLeftToRight
            ? "polygon(53% 0%, 100% 0%, 100% 100%, 53% 100%)"
            : side === "left"
              ? "polygon(0% 0%, 42% 0%, 42% 60%, 50% 60%, 50% 100%, 0% 100%)"
              : "polygon(47% 0%, 100% 0%, 100% 100%, 47% 100%)",
      }}
    />
  );
}
