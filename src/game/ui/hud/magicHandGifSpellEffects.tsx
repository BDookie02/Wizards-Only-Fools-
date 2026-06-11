import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getSpriteUrl } from "../../SpriteManifest";
import { SVG_PALM_X, SVG_PALM_Y } from "./MagicHandSpriteCanvas";
import { useMagicHandEquipScale } from "./useMagicHandEquipScale";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type GifSpellEffectProps = {
  isActive: boolean;
  isCharging: boolean;
};

function getFallbackFireballUrl() {
  return getSpriteUrl("/sprites/fireball/fireball_1.png") || "/sprites/fireball/fireball_1.png";
}

export function BlinkGifCanvas({ isActive, isCharging }: GifSpellEffectProps) {
  const equipScale = useMagicHandEquipScale(isActive);

  if (equipScale === 0) return null;

  const scale = (isCharging ? 1.1 : 0.82) * equipScale;
  const shakeX = isCharging ? (Math.random() - 0.5) * 4 : 0;
  const shakeY = isCharging ? (Math.random() - 0.5) * 4 : 0;
  const fbW = 40 * scale;
  const fbH = 40 * scale;
  const fbX = SVG_PALM_X - fbW / 2 + shakeX;
  const fbY = SVG_PALM_Y - fbH + shakeY - (isCharging ? 3 : 0);

  return (
    <svg
      viewBox="0 0 256 144"
      className="absolute top-0 left-0 w-full h-full object-contain object-bottom pointer-events-none drop-shadow-[5px_5px_0_rgba(0,0,0,0.5)]"
      style={{ opacity: equipScale, zIndex: 10 }}
    >
      <foreignObject x={fbX} y={fbY} width={fbW} height={fbH}>
        <img
          onError={(e) => { if (!e.currentTarget.src.includes("fireball_1.png")) e.currentTarget.src = getFallbackFireballUrl(); }}
          src={getSpriteUrl("/sprites/misc/blink.gif") || "/sprites/misc/blink.gif"}
          decoding="async"
          className="w-full h-full object-contain"
          style={{
            mixBlendMode: "screen",
            filter: "brightness(1.5)",
            WebkitMaskImage: "radial-gradient(circle at center, black 30%, transparent 65%)",
            maskImage: "radial-gradient(circle at center, black 30%, transparent 65%)",
          }}
          alt="blink"
        />
      </foreignObject>
    </svg>
  );
}

export function SmokeBombGifCanvas({ isActive, isCharging }: GifSpellEffectProps) {
  const equipScale = useMagicHandEquipScale(isActive);

  if (equipScale === 0) return null;

  const scale = (isCharging ? 1.4 : 1.0) * equipScale;
  const shakeX = isCharging ? (Math.random() - 0.5) * 4 : 0;
  const shakeY = isCharging ? (Math.random() - 0.5) * 4 : 0;
  const fbW = 48 * scale;
  const fbH = 48 * scale;
  const fbX = SVG_PALM_X - fbW / 2 + shakeX;
  const fbY = SVG_PALM_Y - fbH + shakeY - (isCharging ? 3 : 0);

  return (
    <svg
      viewBox="0 0 256 144"
      className="absolute top-0 left-0 w-full h-full object-contain object-bottom pointer-events-none drop-shadow-[5px_5px_0_rgba(0,0,0,0.5)]"
      style={{ opacity: equipScale, zIndex: 10 }}
    >
      <foreignObject
        x={fbX - 6}
        y={fbY - 6}
        width={fbW + 12}
        height={fbH + 12}
      >
        <img
          onError={(e) => { if (!e.currentTarget.src.includes("fireball_1.png")) e.currentTarget.src = getFallbackFireballUrl(); }}
          src={getSpriteUrl("/sprites/misc/smoke_bomb.gif") || "/sprites/misc/smoke_bomb.gif"}
          decoding="async"
          className="w-full h-full object-contain"
          style={{
            mixBlendMode: "screen",
            imageRendering: "pixelated",
            opacity: 0.48,
            filter: "brightness(1.35) contrast(1.55) saturate(1.7)",
            WebkitMaskImage: "radial-gradient(circle at center, black 34%, transparent 60%)",
            maskImage: "radial-gradient(circle at center, black 34%, transparent 60%)",
          }}
          alt="smoke bomb"
        />
      </foreignObject>
    </svg>
  );
}

function PortalGifImage({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt="portal spell"
      decoding="async"
      className="h-full w-full object-contain"
      style={{
        imageRendering: "pixelated",
        mixBlendMode: "screen",
        filter: "brightness(1.5) contrast(1.28) saturate(1.35)",
        WebkitMaskImage: "radial-gradient(circle at center, transparent 0 28%, black 34%, black 51%, transparent 61%)",
        maskImage: "radial-gradient(circle at center, transparent 0 28%, black 34%, black 51%, transparent 61%)",
      }}
      onError={(e) => {
        if (!e.currentTarget.src.includes("fireball_1.png")) {
          e.currentTarget.src = getFallbackFireballUrl();
        }
      }}
    />
  );
}

export function PortalGifCanvas({ isActive, isCharging }: GifSpellEffectProps) {
  const equipScale = useMagicHandEquipScale(isActive);

  if (equipScale === 0) return null;

  const scale = (isCharging ? 1.4 : 1.0) * equipScale;
  const shakeX = isCharging ? (Math.random() - 0.5) * 4 : 0;
  const shakeY = isCharging ? (Math.random() - 0.5) * 4 : 0;
  const fbW = 48 * scale;
  const fbH = 48 * scale;
  const fbX = SVG_PALM_X - fbW / 2 + shakeX;
  const fbY = SVG_PALM_Y - fbH + shakeY - (isCharging ? 3 : 0);

  return (
    <svg
      viewBox="0 0 256 144"
      className={cn(
        "absolute top-0 left-0 w-full h-full object-contain object-bottom pointer-events-none mix-blend-screen transition-all duration-100",
        isCharging ? "scale-[1.02]" : ""
      )}
      style={{ opacity: equipScale, zIndex: 10 }}
    >
      <defs>
        <radialGradient id="portalGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(200,50,255,1)" />
          <stop offset="40%" stopColor="rgba(150,30,220,0.8)" />
          <stop offset="100%" stopColor="rgba(100,0,200,0)" />
        </radialGradient>
        <clipPath id="pixelCircleClip" clipPathUnits="objectBoundingBox">
          <polygon points="0.3,0 0.7,0 0.7,0.1 0.8,0.1 0.8,0.2 0.9,0.2 0.9,0.3 1,0.3 1,0.7 0.9,0.7 0.9,0.8 0.8,0.8 0.8,0.9 0.7,0.9 0.7,1 0.3,1 0.3,0.9 0.2,0.9 0.2,0.8 0.1,0.8 0.1,0.7 0,0.7 0,0.3 0.1,0.3 0.1,0.2 0.2,0.2 0.2,0.1 0.3,0.1" />
        </clipPath>
      </defs>

      <circle
        cx={fbX + fbW / 2}
        cy={fbY + fbH / 2}
        r={isCharging ? 10 : 8}
        fill="url(#portalGlow)"
      />

      <foreignObject
        x={fbX + fbW / 2 - (fbW * 1.5) / 2}
        y={fbY + fbH / 2 - (fbH * 1.5) / 2}
        width={fbW * 1.5}
        height={fbH * 1.5}
      >
        <PortalGifImage src={getSpriteUrl("/sprites/misc/portal.gif") || "/sprites/misc/portal.gif"} />
      </foreignObject>
    </svg>
  );
}
