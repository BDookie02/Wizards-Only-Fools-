import { useEffect, useRef } from "react";
import type { CharacterCustomization } from "../../../store/gameStore";
import { drawPixelAvatarFrame } from "../../PixelAvatar";
import { useLoopedFrameTimer } from "./useLoopedFrameTimer";

export function CharacterPreview({ character }: { character: CharacterCustomization }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frame = useLoopedFrameTimer({ frameCount: 24, intervalMs: 160 });
  const isBlinking = frame % 24 === 6;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const previewWidth = 360;
    const previewHeight = 360;
    const previewResolutionScale = 2;
    canvas.width = previewWidth * previewResolutionScale;
    canvas.height = previewHeight * previewResolutionScale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(previewResolutionScale, 0, 0, previewResolutionScale, 0, 0);
    ctx.clearRect(0, 0, previewWidth, previewHeight);
    ctx.fillStyle = "rgba(12, 7, 18, 0.92)";
    ctx.fillRect(0, 0, previewWidth, previewHeight);

    ctx.fillStyle = "rgba(34, 211, 238, 0.06)";
    for (let x = 0; x < previewWidth; x += 18) {
      ctx.fillRect(x, 0, 1, previewHeight);
    }
    for (let y = 0; y < previewHeight; y += 18) {
      ctx.fillRect(0, y, previewWidth, 1);
    }

    const glow = ctx.createRadialGradient(180, 188, 18, 180, 188, 150);
    glow.addColorStop(0, "rgba(250, 204, 21, 0.22)");
    glow.addColorStop(0.42, "rgba(236, 72, 153, 0.12)");
    glow.addColorStop(1, "rgba(12, 7, 18, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, previewWidth, previewHeight);

    ctx.strokeStyle = "rgba(250, 204, 21, 0.28)";
    ctx.lineWidth = 3;
    ctx.strokeRect(39, 34, 282, 292);
    ctx.strokeStyle = "rgba(34, 211, 238, 0.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(51, 46, 258, 268);

    ctx.fillStyle = "rgba(250, 204, 21, 0.9)";
    ctx.font = "13px monospace";
    ctx.fillText("LIVE CHARACTER VIEW", 84, 24);

    const animation = frame % 12 < 6 ? "holding" : "walk";
    drawPixelAvatarFrame(ctx, {
      character,
      direction: 0,
      animation,
      frame,
      x: 52,
      y: 62,
      scale: 2,
      detailScale: 2,
      isBlinking,
    });

    ctx.fillStyle = "rgba(240, 249, 255, 0.78)";
    ctx.font = "10px monospace";
    ctx.fillText("FRONT PREVIEW UPDATES LIVE", 90, 342);
  }, [character, frame, isBlinking]);

  return (
    <canvas
      ref={canvasRef}
      className="character-preview-canvas h-auto w-full border border-yellow-200/30 bg-black shadow-[0_0_18px_rgba(250,204,21,0.16)]"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
