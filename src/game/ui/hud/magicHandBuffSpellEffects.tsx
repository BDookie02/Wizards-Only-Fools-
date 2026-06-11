import {
  PALM_X,
  PALM_Y,
  heldSpellSpriteSize,
} from "./MagicHandSpriteCanvas";
import { buffSpellConfigs, type BuffSpellVariant } from "./magicHandBuffSpellEffectsRuntime";
import { PixelBlocks } from "./magicHandPixelBlocks";
import type { PixelBlock } from "./magicHandSpellEffectsRuntime";
import { useMagicHandEquipScale } from "./useMagicHandEquipScale";

const TUNGSTON_CHAIN_BLOCKS: PixelBlock[] = [
  { x: 32, y: 34, w: 10, h: 8, color: "#e2e8f0", rotation: -28 },
  { x: 43, y: 41, w: 10, h: 8, color: "#64748b", rotation: -28 },
  { x: 54, y: 48, w: 10, h: 8, color: "#cbd5e1", rotation: -28 },
  { x: 65, y: 55, w: 10, h: 8, color: "#475569", rotation: -28 },
  { x: 76, y: 62, w: 10, h: 8, color: "#94a3b8", rotation: -28 },
  { x: 87, y: 69, w: 10, h: 8, color: "#334155", rotation: -28 },
];

const TUNGSTON_BALL_BLOCKS: PixelBlock[] = [
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

const SLEEP_PILL_BLOCKS: PixelBlock[] = [
  { x: 22, y: 57, w: 116, h: 12, color: "#dbeafe" },
  { x: 12, y: 69, w: 136, h: 32, color: "#60a5fa" },
  { x: 22, y: 101, w: 116, h: 12, color: "#1d4ed8" },
  { x: 8, y: 78, w: 16, h: 18, color: "#93c5fd" },
  { x: 136, y: 78, w: 16, h: 18, color: "#1e3a8a" },
  { x: 18, y: 73, w: 58, h: 24, color: "#bfdbfe", opacity: 0.72 },
  { x: 84, y: 73, w: 56, h: 24, color: "#2563eb", opacity: 0.88 },
  { x: 78, y: 66, w: 5, h: 48, color: "#e0f2fe", opacity: 0.76 },
  { x: 30, y: 75, w: 26, h: 5, color: "#ffffff", opacity: 0.72 },
];

function TungstonChainGlyph({ isCharging }: { isCharging: boolean }) {
  return (
    <>
      <PixelBlocks blocks={TUNGSTON_CHAIN_BLOCKS} />
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values={isCharging ? "-2 -1;2 1;-1 2;-2 -1" : "0 0;1 -1;0 0"}
          dur={isCharging ? "0.32s" : "1.1s"}
          repeatCount="indefinite"
        />
        <PixelBlocks blocks={TUNGSTON_BALL_BLOCKS} />
      </g>
    </>
  );
}

function SleepPillGlyph() {
  return (
    <>
      <PixelBlocks
        blocks={SLEEP_PILL_BLOCKS}
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

export function BuffSpellCanvas({ isActive, isCharging, variant }: { isActive: boolean, isCharging: boolean, variant: BuffSpellVariant }) {
  const equipScale = useMagicHandEquipScale(isActive);

  if (equipScale === 0) return null;

  const config = buffSpellConfigs[variant];

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
