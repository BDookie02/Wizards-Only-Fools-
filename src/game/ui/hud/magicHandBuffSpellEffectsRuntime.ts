import type { PixelBlock } from "./magicHandSpellEffectsRuntime";

export type BuffSpellVariant = "armor" | "jump" | "speed" | "tungston" | "sleep" | "poison" | "acid";

export type BuffSpellConfig = {
  glow: string;
  shadow: string;
  duration: string;
  blocks: PixelBlock[];
  sparks: PixelBlock[];
};

export const buffSpellConfigs: Record<BuffSpellVariant, BuffSpellConfig> = {
  armor: {
    glow: "rgba(56,189,248,0.78)",
    shadow: "rgba(14,165,233,0.35)",
    duration: "0.72s",
    blocks: [
      { x: 65, y: 16, w: 30, h: 10, color: "#e0f2fe" },
      { x: 48, y: 26, w: 64, h: 14, color: "#7dd3fc" },
      { x: 39, y: 40, w: 82, h: 28, color: "#38bdf8" },
      { x: 43, y: 68, w: 74, h: 24, color: "#0284c7" },
      { x: 53, y: 92, w: 54, h: 22, color: "#0369a1" },
      { x: 67, y: 114, w: 26, h: 14, color: "#bae6fd" },
      { x: 58, y: 46, w: 44, h: 8, color: "rgba(255,255,255,0.78)" },
      { x: 74, y: 55, w: 12, h: 50, color: "rgba(224,242,254,0.38)" },
      { x: 22, y: 44, w: 8, h: 8, color: "#7dd3fc", opacity: 0.72 },
      { x: 130, y: 52, w: 8, h: 8, color: "#bae6fd", opacity: 0.72 },
    ],
    sparks: [
      { x: 23, y: 25, w: 6, h: 6, color: "#e0f2fe", opacity: 0.75 },
      { x: 132, y: 88, w: 7, h: 7, color: "#7dd3fc", opacity: 0.7 },
      { x: 31, y: 116, w: 8, h: 8, color: "#38bdf8", opacity: 0.58 },
    ],
  },
  jump: {
    glow: "rgba(190,242,100,0.78)",
    shadow: "rgba(34,197,94,0.35)",
    duration: "0.62s",
    blocks: [
      { x: 74, y: 16, w: 12, h: 78, color: "rgba(190,242,100,0.22)" },
      { x: 58, y: 20, w: 44, h: 14, color: "#f7fee7" },
      { x: 48, y: 34, w: 64, h: 16, color: "#bef264" },
      { x: 60, y: 50, w: 40, h: 44, color: "#22c55e" },
      { x: 50, y: 94, w: 60, h: 12, color: "#14532d" },
      { x: 32, y: 110, w: 32, h: 12, color: "#a3e635" },
      { x: 96, y: 110, w: 32, h: 12, color: "#a3e635" },
      { x: 24, y: 70, w: 10, h: 10, color: "#22c55e", opacity: 0.72 },
      { x: 128, y: 62, w: 10, h: 10, color: "#bef264", opacity: 0.72 },
    ],
    sparks: [
      { x: 74, y: 4, w: 12, h: 8, color: "#f7fee7", opacity: 0.85 },
      { x: 15, y: 89, w: 8, h: 8, color: "#bef264", opacity: 0.65 },
      { x: 138, y: 101, w: 7, h: 7, color: "#22c55e", opacity: 0.65 },
    ],
  },
  speed: {
    glow: "rgba(250,204,21,0.82)",
    shadow: "rgba(34,211,238,0.34)",
    duration: "0.36s",
    blocks: [
      { x: 22, y: 35, w: 82, h: 12, color: "#fef08a", rotation: -8 },
      { x: 46, y: 53, w: 86, h: 14, color: "#facc15", rotation: -8 },
      { x: 28, y: 76, w: 96, h: 16, color: "#22d3ee", rotation: -8 },
      { x: 61, y: 99, w: 62, h: 12, color: "#fde047", rotation: -8 },
      { x: 18, y: 113, w: 52, h: 9, color: "#0ea5e9", rotation: -8, opacity: 0.85 },
      { x: 120, y: 25, w: 14, h: 14, color: "#fefce8" },
      { x: 133, y: 62, w: 10, h: 10, color: "#fef08a" },
      { x: 138, y: 92, w: 8, h: 8, color: "#67e8f9" },
    ],
    sparks: [
      { x: 18, y: 56, w: 8, h: 8, color: "#fde047", opacity: 0.72 },
      { x: 12, y: 88, w: 7, h: 7, color: "#67e8f9", opacity: 0.68 },
      { x: 134, y: 119, w: 8, h: 8, color: "#fef08a", opacity: 0.7 },
    ],
  },
  tungston: {
    glow: "rgba(148,163,184,0.78)",
    shadow: "rgba(15,23,42,0.45)",
    duration: "0.82s",
    blocks: [
      { x: 48, y: 48, w: 64, h: 20, color: "rgba(148,163,184,0.22)" },
      { x: 52, y: 50, w: 28, h: 28, color: "#cbd5e1" },
      { x: 81, y: 62, w: 28, h: 28, color: "#64748b" },
      { x: 60, y: 58, w: 12, h: 8, color: "#f8fafc", opacity: 0.86 },
      { x: 88, y: 70, w: 10, h: 8, color: "#94a3b8", opacity: 0.82 },
      { x: 37, y: 84, w: 86, h: 8, color: "#475569", rotation: -7 },
      { x: 29, y: 98, w: 102, h: 6, color: "rgba(226,232,240,0.58)", rotation: 9 },
    ],
    sparks: [
      { x: 28, y: 40, w: 8, h: 8, color: "#e2e8f0", opacity: 0.72 },
      { x: 124, y: 48, w: 7, h: 7, color: "#94a3b8", opacity: 0.72 },
      { x: 36, y: 116, w: 8, h: 8, color: "#475569", opacity: 0.58 },
    ],
  },
  sleep: {
    glow: "rgba(125,211,252,0.78)",
    shadow: "rgba(29,78,216,0.38)",
    duration: "1.05s",
    blocks: [
      { x: 55, y: 34, w: 48, h: 12, color: "#e0f2fe" },
      { x: 45, y: 46, w: 68, h: 20, color: "#7dd3fc" },
      { x: 49, y: 66, w: 62, h: 22, color: "#38bdf8" },
      { x: 58, y: 88, w: 42, h: 16, color: "#1d4ed8" },
      { x: 75, y: 47, w: 12, h: 38, color: "rgba(255,255,255,0.44)" },
      { x: 106, y: 25, w: 12, h: 12, color: "#e0f2fe" },
      { x: 123, y: 13, w: 8, h: 8, color: "#e0f2fe" },
    ],
    sparks: [
      { x: 26, y: 48, w: 8, h: 8, color: "#bae6fd", opacity: 0.74 },
      { x: 128, y: 86, w: 7, h: 7, color: "#7dd3fc", opacity: 0.68 },
      { x: 34, y: 111, w: 8, h: 8, color: "#1d4ed8", opacity: 0.58 },
    ],
  },
  poison: {
    glow: "rgba(168,85,247,0.82)",
    shadow: "rgba(88,28,135,0.48)",
    duration: "0.7s",
    blocks: [
      { x: 54, y: 30, w: 52, h: 11, color: "#f0abfc" },
      { x: 44, y: 41, w: 72, h: 17, color: "#d946ef" },
      { x: 38, y: 58, w: 84, h: 34, color: "#a855f7" },
      { x: 47, y: 92, w: 66, h: 22, color: "#581c87" },
      { x: 63, y: 114, w: 34, h: 11, color: "#f0abfc" },
      { x: 66, y: 47, w: 30, h: 8, color: "rgba(255,255,255,0.62)" },
      { x: 31, y: 73, w: 12, h: 12, color: "#c084fc" },
      { x: 118, y: 67, w: 10, h: 10, color: "#e879f9" },
    ],
    sparks: [
      { x: 24, y: 34, w: 8, h: 8, color: "#f0abfc", opacity: 0.75 },
      { x: 129, y: 98, w: 8, h: 8, color: "#c084fc", opacity: 0.66 },
      { x: 38, y: 128, w: 7, h: 7, color: "#a855f7", opacity: 0.62 },
    ],
  },
  acid: {
    glow: "rgba(34,197,94,0.82)",
    shadow: "rgba(22,101,52,0.48)",
    duration: "0.62s",
    blocks: [
      { x: 54, y: 30, w: 52, h: 11, color: "#bbf7d0" },
      { x: 44, y: 41, w: 72, h: 17, color: "#86efac" },
      { x: 38, y: 58, w: 84, h: 34, color: "#22c55e" },
      { x: 47, y: 92, w: 66, h: 22, color: "#166534" },
      { x: 63, y: 114, w: 34, h: 11, color: "#dcfce7" },
      { x: 66, y: 47, w: 30, h: 8, color: "rgba(255,255,255,0.62)" },
      { x: 31, y: 73, w: 12, h: 12, color: "#4ade80" },
      { x: 118, y: 67, w: 10, h: 10, color: "#bbf7d0" },
    ],
    sparks: [
      { x: 24, y: 34, w: 8, h: 8, color: "#bbf7d0", opacity: 0.75 },
      { x: 129, y: 98, w: 8, h: 8, color: "#4ade80", opacity: 0.66 },
      { x: 38, y: 128, w: 7, h: 7, color: "#22c55e", opacity: 0.62 },
    ],
  },
};
