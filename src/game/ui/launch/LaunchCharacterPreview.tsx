import { useEffect, useRef } from "react";
import type { CharacterCustomization } from "../../../store/gameStore";
import { drawPixelAvatarFrame } from "../../PixelAvatar";

export function LaunchCharacterPreview({ character }: { character: CharacterCustomization }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const size = 180;
    const scale = 2;
    canvas.width = size * scale;
    canvas.height = size * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = "#090510";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "rgba(34, 211, 238, 0.08)";
    for (let x = 0; x < size; x += 12) ctx.fillRect(x, 0, 1, size);
    for (let y = 0; y < size; y += 12) ctx.fillRect(0, y, size, 1);
    ctx.strokeStyle = "rgba(250, 204, 21, 0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 10, size - 24, size - 20);
    drawPixelAvatarFrame(ctx, {
      character,
      direction: 0,
      animation: "holding",
      frame: 0,
      x: 26,
      y: 28,
      scale: 1.35,
      detailScale: 1.35,
    });
  }, [character]);

  return (
    <canvas
      ref={canvasRef}
      className="h-auto w-full border border-yellow-200/35 bg-black"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

export default LaunchCharacterPreview;
