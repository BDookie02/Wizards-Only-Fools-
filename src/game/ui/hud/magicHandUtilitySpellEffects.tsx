import { useId } from "react";
import { getSpriteUrl } from "../../SpriteManifest";
import {
  PALM_X,
  PALM_Y,
  heldSpellSpriteSize,
} from "./MagicHandSpriteCanvas";
import { getMagicHandSvgIdSuffix } from "./magicHandSvgIds";
import { useMagicHandEquipScale } from "./useMagicHandEquipScale";

type UtilitySpellEffectProps = {
  isActive: boolean;
  isCharging: boolean;
};

const GRAB_SPELL_FINGER_PATHS = [
  "M171 69 C190 46 209 37 224 40",
  "M181 84 C207 72 226 73 238 82",
  "M180 101 C204 102 220 112 229 128",
  "M166 114 C181 132 188 148 185 163",
  "M142 82 C126 62 112 53 96 55",
] as const;

export function HealingCrystalsCanvas({ isActive, isCharging }: UtilitySpellEffectProps) {
  const equipScale = useMagicHandEquipScale(isActive);

  if (equipScale === 0) return null;

  return (
    <>
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
        decoding="async"
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

export function GrabSpellCanvas({ isActive, isCharging }: UtilitySpellEffectProps) {
  const equipScale = useMagicHandEquipScale(isActive);
  const idSuffix = getMagicHandSvgIdSuffix(useId());

  if (equipScale === 0) return null;

  const glowId = `grab-hand-glow-${idSuffix}`;
  const armId = `grab-arm-core-${idSuffix}`;

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
        {GRAB_SPELL_FINGER_PATHS.map((d, index) => (
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
