import { useEffect, useRef } from "react";
import type { CharacterCustomization } from "../../../store/gameStore";
import { drawPixelAvatarFrame } from "../../PixelAvatar";
import { getInventoryPreviewAnimation, type InventoryHudPlayerState } from "./inventoryPanelRuntime";
import { useLoopedFrameTimer } from "./useLoopedFrameTimer";

export function InventoryWizardPreview({
  character,
  playerState,
}: {
  character: CharacterCustomization;
  playerState: InventoryHudPlayerState;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frame = useLoopedFrameTimer({ frameCount: 24, intervalMs: 130 });
  const isBlinking = frame % 24 === 8;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const previewWidth = 220;
    const previewHeight = 188;
    const resolutionScale = 2;
    canvas.width = previewWidth * resolutionScale;
    canvas.height = previewHeight * resolutionScale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(resolutionScale, 0, 0, resolutionScale, 0, 0);
    ctx.clearRect(0, 0, previewWidth, previewHeight);
    ctx.fillStyle = "#020906";
    ctx.fillRect(0, 0, previewWidth, previewHeight);

    ctx.fillStyle = "rgba(16, 185, 129, 0.07)";
    for (let x = 0; x < previewWidth; x += 12) ctx.fillRect(x, 0, 1, previewHeight);
    for (let y = 0; y < previewHeight; y += 12) ctx.fillRect(0, y, previewWidth, 1);

    const glow = ctx.createRadialGradient(112, 118, 8, 112, 118, 112);
    glow.addColorStop(0, "rgba(250, 204, 21, 0.18)");
    glow.addColorStop(0.45, "rgba(16, 185, 129, 0.14)");
    glow.addColorStop(1, "rgba(2, 9, 6, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, previewWidth, previewHeight);

    ctx.strokeStyle = "rgba(167, 243, 208, 0.28)";
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 10, previewWidth - 24, previewHeight - 20);
    ctx.strokeStyle = "rgba(250, 204, 21, 0.22)";
    ctx.lineWidth = 1;
    ctx.strokeRect(22, 20, previewWidth - 44, previewHeight - 40);

    drawPixelAvatarFrame(ctx, {
      character,
      direction: 0,
      animation: getInventoryPreviewAnimation(playerState),
      frame,
      x: 48,
      y: 21,
      scale: 1.35,
      detailScale: 2,
      isBlinking,
    });
  }, [character, frame, isBlinking, playerState]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Wizard avatar preview"
      className="h-auto w-full border border-emerald-100/25 bg-[#020906] shadow-[inset_0_0_24px_rgba(16,185,129,0.08)]"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
