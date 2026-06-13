import { memo, useEffect, useRef, useState } from "react";
import { type SpellType } from "../../../store/gameStore";
import {
  getFallbackSpellThumbnail,
  getSpellThumbnail,
  isAnimatedThumbnailSource,
} from "./spellMenuRuntime";

type SpellThumbnailBlock = [number, number, number, number, string, number?];

const GRAB_THUMBNAIL_FINGER_LINES: readonly [number, number, number, number][] = [
  [45, 12, 56, 7],
  [51, 20, 62, 18],
  [50, 28, 60, 32],
  [43, 34, 49, 45],
  [35, 19, 29, 8],
];

function usesCanvasOnlySpellThumbnail(spell: SpellType) {
  switch (spell) {
    case "portal":
    case "blink":
    case "smokebomb":
    case "kunai":
    case "healingcrystals":
    case "orbshield":
    case "grab":
    case "tornado":
    case "meteorshower":
    case "magicarmor":
    case "jumpboost":
    case "speedboost":
    case "tungstonballsack":
    case "sleep":
    case "poison":
    case "acid":
    case "magicglassorb":
      return true;
    default:
      return false;
  }
}

export const SpellThumbnail = memo(function SpellThumbnail({
  spell,
  animate = false,
  deferRank = 0,
}: {
  spell: SpellType;
  animate?: boolean;
  deferRank?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [src, setSrc] = useState(() => getSpellThumbnail(spell));
  const [imageFrameVersion, setImageFrameVersion] = useState(0);
  const canvasOnlyThumbnail = usesCanvasOnlySpellThumbnail(spell);

  useEffect(() => {
    setSrc(getSpellThumbnail(spell));
  }, [spell]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const outputSize = 64;

    canvas.width = outputSize;
    canvas.height = outputSize;
    ctx.imageSmoothingEnabled = false;

    const drawPixelBlocks = (blocks: SpellThumbnailBlock[]) => {
      for (let index = 0; index < blocks.length; index += 1) {
        const [x, y, width, height, color, rotation = 0] = blocks[index];
        ctx.save();
        ctx.fillStyle = color;
        if (rotation) {
          ctx.translate(x + width / 2, y + height / 2);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.fillRect(-width / 2, -height / 2, width, height);
        } else {
          ctx.fillRect(x, y, width, height);
        }
        ctx.restore();
      }
    };

    const drawOrbShieldHex = () => {
      ctx.clearRect(0, 0, outputSize, outputSize);
      ctx.fillStyle = "rgba(217, 70, 239, 0.18)";
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(253, 244, 255, 0.82)";
      ctx.lineWidth = 2;

      const radius = 7;
      const height = Math.sqrt(3) * radius;
      for (let y = 9; y < outputSize - 5; y += height * 0.75) {
        const rowOffset = Math.round(y / (height * 0.75)) % 2 === 0 ? 0 : radius * 1.5;
        for (let x = 7 + rowOffset; x < outputSize - 5; x += radius * 3) {
          const dx = x - outputSize / 2;
          const dy = y - outputSize / 2;
          if (Math.sqrt(dx * dx + dy * dy) > 27) continue;

          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 6 + (Math.PI / 3) * i;
            const px = x + Math.cos(angle) * radius;
            const py = y + Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }

      ctx.strokeStyle = "rgba(244, 114, 182, 0.95)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, 27, 0, Math.PI * 2);
      ctx.stroke();
    };

    const drawGrabThumbnail = () => {
      ctx.clearRect(0, 0, outputSize, outputSize);
      const glow = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      glow.addColorStop(0, "rgba(255, 244, 255, 0.95)");
      glow.addColorStop(0.35, "rgba(244, 114, 182, 0.72)");
      glow.addColorStop(1, "rgba(126, 34, 206, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, outputSize, outputSize);

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(244, 114, 182, 0.5)";
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.moveTo(8, 44);
      ctx.bezierCurveTo(18, 35, 24, 28, 36, 24);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255, 214, 251, 0.95)";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(8, 44);
      ctx.bezierCurveTo(20, 36, 25, 29, 38, 24);
      ctx.stroke();

      ctx.fillStyle = "rgba(244, 114, 182, 0.72)";
      ctx.beginPath();
      ctx.ellipse(42, 24, 10, 12, -0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 214, 251, 0.9)";
      ctx.lineWidth = 5;
      for (let index = 0; index < GRAB_THUMBNAIL_FINGER_LINES.length; index += 1) {
        const [x1, y1, x2, y2] = GRAB_THUMBNAIL_FINGER_LINES[index];
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(244, 114, 182, 0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(34, 31, 25, 0.2, Math.PI * 1.6);
      ctx.stroke();
    };

    const drawTornadoThumbnail = () => {
      ctx.clearRect(0, 0, outputSize, outputSize);
      drawPixelBlocks([
        [12, 6, 40, 4, "rgba(209, 213, 219, 0.18)"],
        [7, 18, 52, 8, "rgba(156, 163, 175, 0.14)"],
        [10, 31, 46, 8, "rgba(75, 85, 99, 0.2)"],
        [16, 46, 32, 6, "rgba(248, 250, 252, 0.14)"],
        [20, 7, 22, 4, "#f8fafc"],
        [10, 11, 46, 4, "#9ca3af"],
        [16, 15, 24, 4, "#e5e7eb"],
        [42, 15, 12, 4, "#4b5563"],
        [8, 22, 18, 5, "#4b5563"],
        [26, 22, 30, 5, "#d1d5db"],
        [15, 28, 38, 5, "#f3f4f6"],
        [11, 34, 18, 5, "#9ca3af"],
        [31, 34, 20, 5, "#374151"],
        [15, 40, 38, 5, "#6b7280"],
        [22, 46, 26, 5, "#d1d5db"],
        [26, 52, 18, 5, "#9ca3af"],
        [30, 58, 10, 4, "#f8fafc"],
        [4, 16, 4, 4, "rgba(229, 231, 235, 0.75)"],
        [56, 25, 4, 4, "rgba(156, 163, 175, 0.75)"],
        [7, 52, 4, 4, "rgba(107, 114, 128, 0.62)"],
        [52, 54, 5, 5, "rgba(161, 98, 7, 0.55)"],
        [3, 24, 13, 3, "rgba(248, 250, 252, 0.72)", -14],
        [45, 27, 15, 3, "rgba(209, 213, 219, 0.68)", 16],
        [5, 40, 15, 3, "rgba(156, 163, 175, 0.64)", 18],
        [43, 43, 13, 3, "rgba(229, 231, 235, 0.62)", -16],
        [12, 55, 10, 3, "rgba(75, 85, 99, 0.58)", -12],
        [55, 8, 3, 3, "rgba(248, 250, 252, 0.8)"],
        [2, 36, 3, 3, "rgba(156, 163, 175, 0.72)"],
        [57, 50, 3, 3, "rgba(107, 114, 128, 0.7)"],
      ]);
    };

    const drawMeteorThumbnail = () => {
      ctx.clearRect(0, 0, outputSize, outputSize);
      drawPixelBlocks([
        [22, 9, 20, 5, "rgba(254, 215, 170, 0.22)"],
        [17, 16, 30, 8, "rgba(251, 146, 60, 0.22)"],
        [12, 25, 40, 12, "rgba(239, 68, 68, 0.2)"],
        [17, 39, 30, 10, "rgba(250, 204, 21, 0.16)"],
        [22, 10, 20, 5, "#fed7aa"],
        [17, 15, 30, 7, "#fb923c"],
        [13, 22, 38, 10, "#ef4444"],
        [11, 32, 42, 13, "#f97316"],
        [16, 45, 32, 10, "#b91c1c"],
        [23, 55, 18, 5, "#fb923c"],
        [23, 17, 18, 6, "#fff7ed"],
        [18, 25, 28, 10, "#fde68a"],
        [22, 35, 20, 10, "#facc15"],
        [28, 45, 10, 7, "#fffbeb"],
        [28, 28, 10, 7, "#7c2d12"],
        [40, 31, 9, 7, "#9a3412"],
        [18, 36, 9, 8, "#c2410c"],
        [35, 41, 11, 8, "#ea580c"],
        [7, 20, 3, 3, "rgba(255, 247, 237, 0.74)"],
        [54, 24, 4, 4, "rgba(254, 215, 170, 0.66)"],
        [8, 50, 3, 3, "rgba(249, 115, 22, 0.68)"],
        [54, 51, 3, 3, "rgba(254, 243, 199, 0.68)"],
      ]);
    };

    const drawMagicArmorThumbnail = () => {
      ctx.clearRect(0, 0, outputSize, outputSize);
      const glow = ctx.createRadialGradient(32, 32, 4, 32, 32, 31);
      glow.addColorStop(0, "rgba(224, 242, 254, 0.85)");
      glow.addColorStop(0.45, "rgba(56, 189, 248, 0.36)");
      glow.addColorStop(1, "rgba(14, 116, 144, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, outputSize, outputSize);
      drawPixelBlocks([
        [25, 7, 14, 5, "#e0f2fe"],
        [18, 12, 28, 6, "#7dd3fc"],
        [14, 18, 36, 10, "#38bdf8"],
        [14, 28, 36, 9, "#0284c7"],
        [18, 37, 28, 8, "#0369a1"],
        [22, 45, 20, 7, "#0c4a6e"],
        [27, 52, 10, 5, "#bae6fd"],
        [22, 20, 20, 4, "rgba(255,255,255,0.8)"],
        [27, 28, 10, 18, "rgba(224,242,254,0.45)"],
        [10, 11, 4, 4, "rgba(125,211,252,0.8)"],
        [50, 20, 4, 4, "rgba(186,230,253,0.72)"],
        [9, 47, 5, 5, "rgba(56,189,248,0.6)"],
      ]);
    };

    const drawJumpBoostThumbnail = () => {
      ctx.clearRect(0, 0, outputSize, outputSize);
      drawPixelBlocks([
        [29, 7, 6, 40, "rgba(190, 242, 100, 0.26)"],
        [21, 14, 22, 7, "#bef264"],
        [16, 21, 32, 7, "#84cc16"],
        [24, 28, 16, 19, "#22c55e"],
        [20, 47, 24, 6, "#14532d"],
        [14, 53, 12, 5, "#a3e635"],
        [38, 53, 12, 5, "#a3e635"],
        [8, 35, 7, 7, "rgba(34,197,94,0.78)"],
        [49, 32, 7, 7, "rgba(190,242,100,0.78)"],
        [27, 3, 10, 5, "#f7fee7"],
      ]);
    };

    const drawSpeedBoostThumbnail = () => {
      ctx.clearRect(0, 0, outputSize, outputSize);
      drawPixelBlocks([
        [7, 14, 34, 5, "#fef08a", -8],
        [19, 22, 38, 6, "#facc15", -8],
        [11, 32, 44, 7, "#22d3ee", -8],
        [25, 42, 28, 5, "#fde047", -8],
        [6, 49, 24, 4, "rgba(14,165,233,0.82)", -8],
        [45, 10, 7, 7, "#fefce8"],
        [51, 27, 5, 5, "#fef08a"],
        [54, 39, 4, 4, "#67e8f9"],
        [11, 24, 5, 5, "rgba(253,224,71,0.78)"],
      ]);
    };

    const drawStatusBoltThumbnail = (variant: "tungston" | "sleep" | "poison" | "acid") => {
      ctx.clearRect(0, 0, outputSize, outputSize);
      const palette = {
        tungston: ["#e2e8f0", "#94a3b8", "#475569", "rgba(148,163,184,0.26)"],
        sleep: ["#e0f2fe", "#60a5fa", "#1d4ed8", "rgba(125,211,252,0.26)"],
        poison: ["#f0abfc", "#a855f7", "#581c87", "rgba(168,85,247,0.26)"],
        acid: ["#bbf7d0", "#22c55e", "#166534", "rgba(34,197,94,0.26)"],
      }[variant];
      const glow = ctx.createRadialGradient(32, 32, 3, 32, 32, 31);
      glow.addColorStop(0, palette[0]);
      glow.addColorStop(0.42, palette[3]);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, outputSize, outputSize);

      if (variant === "tungston") {
        drawPixelBlocks([
          [12, 12, 5, 4, "#e2e8f0", -28],
          [18, 16, 5, 4, "#64748b", -28],
          [24, 20, 5, 4, "#cbd5e1", -28],
          [30, 24, 5, 4, "#475569", -28],
          [36, 28, 5, 4, "#94a3b8", -28],
          [35, 29, 18, 4, "#cbd5e1"],
          [31, 33, 26, 6, "#94a3b8"],
          [27, 39, 34, 12, "#64748b"],
          [31, 51, 26, 6, "#334155"],
          [37, 57, 16, 3, "#1f2937"],
          [33, 34, 9, 3, "#f8fafc"],
          [51, 43, 6, 6, "#0f172a"],
        ]);
        return;
      }

      if (variant === "sleep") {
        drawPixelBlocks([
          [9, 26, 46, 6, "#dbeafe"],
          [5, 32, 54, 15, "#60a5fa"],
          [9, 47, 46, 6, "#1d4ed8"],
          [4, 36, 7, 8, "#93c5fd"],
          [53, 36, 7, 8, "#1e3a8a"],
          [12, 34, 22, 10, "rgba(191,219,254,0.75)"],
          [36, 34, 18, 10, "rgba(37,99,235,0.85)"],
          [32, 31, 2, 23, "rgba(224,242,254,0.82)"],
          [15, 35, 10, 3, "#ffffff"],
        ]);
        ctx.fillStyle = "#e0f2fe";
        ctx.font = "bold 15px monospace";
        ctx.fillText("ZZZ", 18, 22);
        ctx.fillStyle = "rgba(37,99,235,0.55)";
        ctx.fillText("ZZZ", 20, 22);
        return;
      }

      const isAcid = variant === "acid";
      const liquid = isAcid ? "#22c55e" : "#a855f7";
      const liquidDark = isAcid ? "#166534" : "#581c87";
      const liquidLight = isAcid ? "#bbf7d0" : "#f0abfc";
      const glass = isAcid ? "#dcfce7" : "#fae8ff";
      const rim = isAcid ? "#86efac" : "#e879f9";

      ctx.save();
      ctx.translate(32, 34);
      ctx.rotate((-7 * Math.PI) / 180);
      ctx.translate(-32, -34);

      ctx.fillStyle = liquid;
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      ctx.moveTo(32, 16);
      ctx.lineTo(8, 60);
      ctx.lineTo(56, 60);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = glass;
      ctx.globalAlpha = 0.92;
      ctx.fillRect(26, 7, 12, 5);
      ctx.globalAlpha = 0.82;
      ctx.fillStyle = rim;
      ctx.fillRect(23, 12, 18, 4);
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = glass;
      ctx.fillRect(28, 16, 8, 8);
      ctx.globalAlpha = 1;

      ctx.beginPath();
      ctx.moveTo(32, 22);
      ctx.lineTo(11, 60);
      ctx.lineTo(53, 60);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.13)";
      ctx.fill();
      ctx.strokeStyle = glass;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(32, 32);
      ctx.lineTo(18, 57);
      ctx.lineTo(46, 57);
      ctx.closePath();
      ctx.fillStyle = liquidDark;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(32, 36);
      ctx.lineTo(23, 54);
      ctx.lineTo(43, 54);
      ctx.closePath();
      ctx.fillStyle = liquid;
      ctx.fill();

      ctx.fillStyle = liquidLight;
      ctx.globalAlpha = 0.78;
      ctx.fillRect(24, 45, 5, 5);
      ctx.globalAlpha = 0.7;
      ctx.fillRect(36, 39, 4, 4);
      ctx.globalAlpha = 0.58;
      ctx.fillStyle = glass;
      ctx.fillRect(30, 51, 3, 3);
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = liquidDark;
      ctx.fillRect(20, 58, 25, 2);
      ctx.globalAlpha = 0.76;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(28, 9, 6, 2);
      ctx.globalAlpha = 0.34;
      ctx.fillRect(18, 37, 3, 12);
      ctx.restore();
    };

    const drawGlassOrbThumbnail = () => {
      ctx.clearRect(0, 0, outputSize, outputSize);
      const glow = ctx.createRadialGradient(32, 32, 4, 32, 32, 31);
      glow.addColorStop(0, "rgba(240,249,255,0.95)");
      glow.addColorStop(0.45, "rgba(34,211,238,0.34)");
      glow.addColorStop(1, "rgba(8,47,73,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, outputSize, outputSize);
      drawPixelBlocks([
        [19, 13, 26, 5, "#e0f2fe"],
        [14, 18, 36, 8, "#67e8f9"],
        [11, 26, 42, 16, "rgba(34,211,238,0.72)"],
        [15, 42, 34, 8, "#0891b2"],
        [24, 50, 16, 5, "#cffafe"],
        [21, 21, 14, 5, "rgba(255,255,255,0.92)"],
        [31, 28, 7, 14, "rgba(255,255,255,0.42)"],
        [31, 29, 4, 18, "#fef08a"],
        [32, 19, 3, 8, "#fef08a"],
        [32, 49, 3, 8, "#fef08a"],
        [24, 37, 18, 4, "#facc15", -28],
      ]);
    };

    const drawPortalThumbnail = () => {
      ctx.clearRect(0, 0, outputSize, outputSize);
      const glow = ctx.createRadialGradient(32, 32, 4, 32, 32, 31);
      glow.addColorStop(0, "rgba(255,255,255,0.96)");
      glow.addColorStop(0.22, "rgba(103,232,249,0.78)");
      glow.addColorStop(0.5, "rgba(168,85,247,0.62)");
      glow.addColorStop(1, "rgba(15,23,42,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, outputSize, outputSize);
      ctx.save();
      ctx.translate(32, 32);
      for (let ring = 0; ring < 4; ring += 1) {
        ctx.rotate(0.42 + ring * 0.38);
        ctx.strokeStyle = ring % 2 === 0 ? "rgba(125,211,252,0.95)" : "rgba(216,180,254,0.88)";
        ctx.lineWidth = 5 - ring * 0.7;
        ctx.beginPath();
        ctx.ellipse(0, 0, 22 - ring * 2.4, 11 + ring * 1.2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      drawPixelBlocks([
        [29, 8, 6, 8, "#f8fafc"],
        [47, 21, 6, 6, "#67e8f9"],
        [12, 35, 7, 7, "#c084fc"],
        [33, 49, 8, 6, "#e0f2fe"],
      ]);
    };

    const drawBlinkThumbnail = () => {
      ctx.clearRect(0, 0, outputSize, outputSize);
      const glow = ctx.createRadialGradient(31, 31, 2, 31, 31, 31);
      glow.addColorStop(0, "rgba(204,251,241,0.96)");
      glow.addColorStop(0.45, "rgba(45,212,191,0.48)");
      glow.addColorStop(1, "rgba(15,118,110,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, outputSize, outputSize);
      ctx.strokeStyle = "#99f6e4";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(15, 38);
      ctx.bezierCurveTo(25, 8, 53, 18, 39, 34);
      ctx.bezierCurveTo(30, 44, 15, 51, 21, 24);
      ctx.stroke();
      drawPixelBlocks([
        [10, 14, 5, 5, "#ccfbf1"],
        [48, 12, 4, 4, "#5eead4"],
        [52, 39, 6, 6, "#14b8a6"],
        [8, 49, 4, 4, "#99f6e4"],
        [30, 29, 7, 7, "#f8fafc"],
      ]);
    };

    const drawSmokeBombThumbnail = () => {
      ctx.clearRect(0, 0, outputSize, outputSize);
      const glow = ctx.createRadialGradient(32, 34, 4, 32, 34, 31);
      glow.addColorStop(0, "rgba(248,250,252,0.88)");
      glow.addColorStop(0.5, "rgba(148,163,184,0.42)");
      glow.addColorStop(1, "rgba(15,23,42,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, outputSize, outputSize);
      drawPixelBlocks([
        [25, 31, 14, 14, "#111827"],
        [21, 27, 22, 10, "#374151"],
        [28, 24, 8, 8, "#f8fafc"],
        [13, 15, 17, 9, "rgba(203,213,225,0.82)"],
        [30, 10, 24, 11, "rgba(226,232,240,0.78)"],
        [40, 25, 16, 9, "rgba(148,163,184,0.76)"],
        [9, 34, 20, 10, "rgba(100,116,139,0.7)"],
        [24, 46, 31, 9, "rgba(203,213,225,0.6)"],
        [14, 51, 8, 5, "rgba(248,250,252,0.72)"],
      ]);
    };

    const drawKunaiThumbnail = () => {
      ctx.clearRect(0, 0, outputSize, outputSize);
      const glow = ctx.createLinearGradient(12, 52, 53, 10);
      glow.addColorStop(0, "rgba(15,23,42,0)");
      glow.addColorStop(0.5, "rgba(226,232,240,0.36)");
      glow.addColorStop(1, "rgba(248,250,252,0.62)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, outputSize, outputSize);
      drawPixelBlocks([
        [13, 48, 13, 4, "#94a3b8", -36],
        [22, 41, 18, 5, "#1f2937", -36],
        [36, 30, 15, 6, "#e5e7eb", -36],
        [45, 20, 10, 5, "#f8fafc", -36],
        [50, 14, 5, 5, "#cbd5e1", -36],
        [11, 43, 8, 8, "#0f172a"],
        [13, 45, 4, 4, "#e5e7eb"],
      ]);
      ctx.strokeStyle = "rgba(248,250,252,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(19, 48);
      ctx.lineTo(51, 19);
      ctx.stroke();
    };

    const drawHealingCrystalsThumbnail = () => {
      ctx.clearRect(0, 0, outputSize, outputSize);
      const glow = ctx.createRadialGradient(32, 35, 4, 32, 35, 30);
      glow.addColorStop(0, "rgba(220,252,231,0.92)");
      glow.addColorStop(0.45, "rgba(34,197,94,0.44)");
      glow.addColorStop(1, "rgba(20,83,45,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, outputSize, outputSize);
      drawPixelBlocks([
        [26, 12, 12, 7, "#dcfce7"],
        [22, 19, 20, 22, "#4ade80"],
        [26, 41, 12, 11, "#166534"],
        [13, 28, 10, 7, "#bbf7d0"],
        [10, 35, 16, 14, "#22c55e"],
        [14, 49, 8, 8, "#14532d"],
        [43, 25, 8, 6, "#ecfdf5"],
        [39, 31, 14, 18, "#16a34a"],
        [43, 49, 7, 7, "#052e16"],
        [29, 22, 5, 16, "rgba(255,255,255,0.7)"],
        [16, 37, 4, 8, "rgba(255,255,255,0.58)"],
        [46, 34, 3, 9, "rgba(255,255,255,0.52)"],
      ]);
    };

    const scheduleDraw = (drawFn: () => void, allowAnimatedRefresh = false) => {
      const delay = animate || spell === "tornado" ? 0 : Math.min(420, deferRank * 16);
      let animatedRefreshTimeout: number | null = null;
      let cancelled = false;
      const scheduleAnimatedRefresh = () => {
        animatedRefreshTimeout = window.setTimeout(() => {
          if (cancelled) return;
          drawFn();
          scheduleAnimatedRefresh();
        }, 180);
      };
      const timeout = window.setTimeout(() => {
        if (cancelled) return;
        drawFn();
        if (animate && allowAnimatedRefresh && isAnimatedThumbnailSource(src)) {
          scheduleAnimatedRefresh();
        }
      }, delay);

      return () => {
        cancelled = true;
        window.clearTimeout(timeout);
        if (animatedRefreshTimeout !== null) window.clearTimeout(animatedRefreshTimeout);
      };
    };

    if (spell === "portal") {
      return scheduleDraw(drawPortalThumbnail);
    }

    if (spell === "blink") {
      return scheduleDraw(drawBlinkThumbnail);
    }

    if (spell === "smokebomb") {
      return scheduleDraw(drawSmokeBombThumbnail);
    }

    if (spell === "kunai") {
      return scheduleDraw(drawKunaiThumbnail);
    }

    if (spell === "healingcrystals") {
      return scheduleDraw(drawHealingCrystalsThumbnail);
    }

    if (spell === "orbshield") {
      return scheduleDraw(drawOrbShieldHex);
    }

    if (spell === "grab") {
      return scheduleDraw(drawGrabThumbnail);
    }

    if (spell === "tornado") {
      return scheduleDraw(drawTornadoThumbnail);
    }

    if (spell === "meteorshower") {
      return scheduleDraw(drawMeteorThumbnail);
    }

    if (spell === "magicarmor") {
      return scheduleDraw(drawMagicArmorThumbnail);
    }

    if (spell === "jumpboost") {
      return scheduleDraw(drawJumpBoostThumbnail);
    }

    if (spell === "speedboost") {
      return scheduleDraw(drawSpeedBoostThumbnail);
    }

    if (spell === "tungstonballsack") {
      return scheduleDraw(() => drawStatusBoltThumbnail("tungston"));
    }

    if (spell === "sleep") {
      return scheduleDraw(() => drawStatusBoltThumbnail("sleep"));
    }

    if (spell === "poison") {
      return scheduleDraw(() => drawStatusBoltThumbnail("poison"));
    }

    if (spell === "acid") {
      return scheduleDraw(() => drawStatusBoltThumbnail("acid"));
    }

    if (spell === "magicglassorb") {
      return scheduleDraw(drawGlassOrbThumbnail);
    }

    const sampleSize = 36;
    const sampleCanvas = document.createElement("canvas");
    const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!sampleCtx) return;

    sampleCanvas.width = sampleSize;
    sampleCanvas.height = sampleSize;
    sampleCtx.imageSmoothingEnabled = false;

    const draw = () => {
      const img = imgRef.current;
      if (!img || !img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return;

      sampleCtx.clearRect(0, 0, sampleSize, sampleSize);
      const scale = Math.min(sampleSize / img.naturalWidth, sampleSize / img.naturalHeight);
      const width = img.naturalWidth * scale;
      const height = img.naturalHeight * scale;
      const x = (sampleSize - width) / 2;
      const y = (sampleSize - height) / 2;
      sampleCtx.drawImage(img, x, y, width, height);

      try {
        const imageData = sampleCtx.getImageData(0, 0, sampleSize, sampleSize);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (brightness < 18) {
            data[i + 3] = 0;
          } else if (brightness < 42) {
            data[i + 3] = Math.min(data[i + 3], Math.round(data[i + 3] * ((brightness - 18) / 24)));
          }
        }
        sampleCtx.putImageData(imageData, 0, 0);
      } catch {
        // If a browser marks a GIF frame as tainted, keep the thumbnail visible.
      }

      ctx.clearRect(0, 0, outputSize, outputSize);
      ctx.drawImage(sampleCanvas, 0, 0, outputSize, outputSize);
    };

    return scheduleDraw(draw, true);
  }, [spell, src, animate, deferRank, imageFrameVersion]);

  const portalMask = spell === "portal" && !canvasOnlyThumbnail
    ? {
        mixBlendMode: "screen" as const,
        filter: "brightness(1.45) contrast(1.25) saturate(1.35)",
        WebkitMaskImage: "radial-gradient(circle at center, transparent 0 28%, black 34%, black 51%, transparent 61%)",
        maskImage: "radial-gradient(circle at center, transparent 0 28%, black 34%, black 51%, transparent 61%)",
      }
    : {};

  return (
    <>
      <canvas
        ref={canvasRef}
        className="h-full w-full object-contain"
        style={{ imageRendering: "pixelated", ...portalMask }}
      />
      {!canvasOnlyThumbnail && (
        <img
          ref={imgRef}
          src={src}
          alt=""
          crossOrigin="anonymous"
          loading={animate ? "eager" : "lazy"}
          decoding="async"
          className="pointer-events-none absolute h-px w-px opacity-0"
          onLoad={() => setImageFrameVersion((version) => version + 1)}
          onError={() => {
            const fallback = getFallbackSpellThumbnail();
            if (src !== fallback) setSrc(fallback);
          }}
        />
      )}
    </>
  );
});
