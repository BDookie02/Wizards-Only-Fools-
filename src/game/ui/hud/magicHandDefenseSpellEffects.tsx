import { useRef } from "react";
import { getSpriteUrl } from "../../SpriteManifest";
import {
  PALM_X,
  PALM_Y,
  heldSpellSpriteSize,
} from "./MagicHandSpriteCanvas";
import { useMagicHandEquipScale } from "./useMagicHandEquipScale";

type DefenseSpellEffectProps = {
  isActive: boolean;
  isCharging: boolean;
};

export function DiscShieldCanvas({ isActive, isCharging }: DefenseSpellEffectProps) {
  const equipScale = useMagicHandEquipScale(isActive);

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
          onError={(e) => { if(!e.currentTarget.src.includes('fireball_1.png')) e.currentTarget.src = '/sprites/fireball/fireball_1.png'; }}
          src={getSpriteUrl("/sprites/shields/disc_shield.png") || "/sprites/shields/disc_shield.png"}
          decoding="async"
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

export function OrbShieldCanvas({ isActive, isCharging }: DefenseSpellEffectProps) {
  const equipScale = useMagicHandEquipScale(isActive);
  const idSuffixRef = useRef<string | null>(null);
  if (!idSuffixRef.current) {
    idSuffixRef.current = Math.random().toString(36).slice(2);
  }

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
