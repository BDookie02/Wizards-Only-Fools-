import {
  MAGIC_HANDS_MOBILE_PERFORMANCE_MODE,
  PALM_X,
  PALM_Y,
  heldSpellSpriteSize,
} from "./MagicHandSpriteCanvas";
import { PixelBlocks } from "./magicHandPixelBlocks";
import {
  tinyTornadoBlocks,
  tinyTornadoGlowBlocks,
  type PixelBlock,
} from "./magicHandSpellEffectsRuntime";
import { useMagicHandEquipScale } from "./useMagicHandEquipScale";

export function TornadoSpellCanvas({ isActive, isCharging }: { isActive: boolean, isCharging: boolean }) {
  const equipScale = useMagicHandEquipScale(isActive);

  if (equipScale === 0) return null;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${(PALM_X / 859) * 100}%`,
        bottom: `${((495 - PALM_Y + 2) / 495) * 100}%`,
        opacity: equipScale,
        width: heldSpellSpriteSize(170, 0.25, 98),
        height: heldSpellSpriteSize(170, 0.25, 98),
        transform: `translate(-50%, 0) scale(${isCharging ? 1.12 : 1}) translateY(${isCharging ? '-5px' : '0'})`,
        filter: 'drop-shadow(0 0 10px rgba(229,231,235,0.7)) drop-shadow(0 0 22px rgba(75,85,99,0.45))'
      }}
    >
      <svg viewBox="0 0 160 160" className="h-full w-full" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
        <PixelBlocks blocks={tinyTornadoGlowBlocks} />
        <g>
          <animateTransform attributeName="transform" type="translate" values="-2 0;3 0;-1 0;-2 0" dur="0.74s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.62;0.82;0.58;0.76;0.62" dur="0.58s" repeatCount="indefinite" />
          <PixelBlocks blocks={tinyTornadoBlocks.backBands} />
        </g>
        <g>
          <animateTransform attributeName="transform" type="translate" values="3 0;-3 0;2 0;3 0" dur="0.62s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.78;1;0.72;0.94;0.78" dur="0.5s" repeatCount="indefinite" />
          <PixelBlocks blocks={tinyTornadoBlocks.frontBands} />
        </g>
        <g>
          <animateTransform attributeName="transform" type="translate" values="-2 1;2 -1;-1 -1;-2 1" dur="0.78s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.58;0.82;0.5;0.74;0.58" dur="0.56s" repeatCount="indefinite" />
          <PixelBlocks blocks={tinyTornadoBlocks.loose} />
        </g>
        <g>
          <animateTransform attributeName="transform" type="translate" values="-3 0;3 0;-2 0;-3 0" dur="0.68s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.42;0.68;0.34;0.6;0.42" dur="0.48s" repeatCount="indefinite" />
          <PixelBlocks blocks={tinyTornadoBlocks.dust} />
        </g>
        {isCharging && (
          <PixelBlocks
            blocks={[
              { x: 8, y: 62, w: 8, h: 8, color: "#f8fafc", opacity: 0.82 },
              { x: 144, y: 78, w: 8, h: 8, color: "#e5e7eb", opacity: 0.82 },
              { x: 18, y: 126, w: 8, h: 8, color: "#9ca3af", opacity: 0.72 },
              { x: 134, y: 134, w: 10, h: 10, color: "#6b7280", opacity: 0.72 },
            ]}
          />
        )}
      </svg>
    </div>
  );
}

export function MeteorShowerCanvas({ isActive, isCharging }: { isActive: boolean, isCharging: boolean }) {
  const equipScale = useMagicHandEquipScale(isActive);

  if (equipScale === 0) return null;
  const meteorFlameBlocks: PixelBlock[] = [
    { x: 54, y: 28, w: 52, h: 12, color: "#fed7aa", opacity: 0.62 },
    { x: 42, y: 40, w: 76, h: 16, color: "#fb923c", opacity: 0.78 },
    { x: 32, y: 56, w: 96, h: 22, color: "#ef4444", opacity: 0.84 },
    { x: 26, y: 78, w: 108, h: 30, color: "#f97316", opacity: 0.94 },
    { x: 38, y: 108, w: 84, h: 22, color: "#b91c1c", opacity: 0.84 },
    { x: 56, y: 130, w: 48, h: 12, color: "#fb923c", opacity: 0.72 },
  ];
  const meteorCoreBlocks: PixelBlock[] = [
    { x: 58, y: 44, w: 46, h: 16, color: "#fff7ed", opacity: 0.92 },
    { x: 46, y: 62, w: 68, h: 24, color: "#fde68a", opacity: 0.94 },
    { x: 54, y: 86, w: 52, h: 24, color: "#facc15", opacity: 0.92 },
    { x: 68, y: 108, w: 28, h: 16, color: "#fffbeb", opacity: 0.88 },
  ];
  const meteorRockBlocks: PixelBlock[] = [
    { x: 70, y: 68, w: 24, h: 16, color: "#7c2d12", opacity: 0.96 },
    { x: 98, y: 74, w: 22, h: 16, color: "#9a3412", opacity: 0.96 },
    { x: 46, y: 84, w: 22, h: 18, color: "#c2410c", opacity: 0.96 },
    { x: 86, y: 98, w: 28, h: 18, color: "#ea580c", opacity: 0.96 },
  ];
  const meteorEmberBlocks: PixelBlock[] = [
    { x: 22, y: 50, w: 8, h: 8, color: "#fff7ed", opacity: 0.74 },
    { x: 130, y: 58, w: 9, h: 9, color: "#fed7aa", opacity: 0.66 },
    { x: 18, y: 116, w: 8, h: 8, color: "#f97316", opacity: 0.68 },
    { x: 132, y: 120, w: 8, h: 8, color: "#fef3c7", opacity: 0.68 },
  ];
  const glowBlocks: PixelBlock[] = [
    { x: 38, y: 48, w: 84, h: 26, color: "#fed7aa", opacity: 0.14 },
    { x: 28, y: 66, w: 100, h: 38, color: "#fb923c", opacity: 0.15 },
    { x: 34, y: 92, w: 82, h: 34, color: "#ef4444", opacity: 0.13 },
    { x: 14, y: 24, w: 58, h: 26, color: "#fb923c", opacity: 0.11 },
    { x: 96, y: 26, w: 52, h: 24, color: "#facc15", opacity: 0.1 },
  ];
  const meteorites = [
    { id: "main", x: 80, y: 91, scale: 0.66, flameDur: 0.44, coreDur: 0.55, emberDur: 1.25 },
    { id: "small-left", x: 47, y: 48, scale: 0.38, flameDur: 0.5, coreDur: 0.62, emberDur: 1.45 },
    { id: "small-right", x: 114, y: 45, scale: 0.33, flameDur: 0.56, coreDur: 0.68, emberDur: 1.6 },
  ];

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${(PALM_X / 859) * 100}%`,
        bottom: `${((495 - PALM_Y + 6) / 495) * 100}%`,
        opacity: equipScale,
        width: heldSpellSpriteSize(178, 0.26, 102),
        height: heldSpellSpriteSize(178, 0.26, 102),
        transform: `translate(-50%, 0) scale(${isCharging ? 1.14 : 1}) translateY(${isCharging ? '-4px' : '0'})`,
        filter: 'drop-shadow(0 0 12px rgba(251,146,60,0.78)) drop-shadow(0 0 24px rgba(248,113,113,0.36))'
      }}
    >
      <svg viewBox="0 0 160 160" className="h-full w-full" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
        <PixelBlocks blocks={glowBlocks} />
        {meteorites.map((meteorite) => (
          <g key={meteorite.id} transform={`translate(${meteorite.x} ${meteorite.y}) scale(${meteorite.scale}) translate(-80 -82)`}>
            <g transform="translate(80 82)">
              <g>
                {!MAGIC_HANDS_MOBILE_PERFORMANCE_MODE && (
                  <>
                    <animateTransform attributeName="transform" type="scale" values="1;1.07 0.95;0.96 1.05;1.04 0.98;1" dur={`${meteorite.flameDur}s`} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.84;1;0.9;1;0.84" dur={`${meteorite.flameDur * 0.82}s`} repeatCount="indefinite" />
                  </>
                )}
                <g transform="translate(-80 -82)">
                  <PixelBlocks blocks={meteorFlameBlocks} />
                </g>
              </g>
            </g>
            <g transform="translate(80 82)">
              <g>
                {!MAGIC_HANDS_MOBILE_PERFORMANCE_MODE && (
                  <>
                    <animateTransform attributeName="transform" type="scale" values="1;0.95;1.04;0.98;1" dur={`${meteorite.coreDur}s`} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.9;1;0.82;1;0.9" dur={`${meteorite.coreDur * 0.76}s`} repeatCount="indefinite" />
                  </>
                )}
                <g transform="translate(-80 -82)">
                  <PixelBlocks blocks={meteorCoreBlocks} />
                </g>
              </g>
            </g>
            <PixelBlocks blocks={meteorRockBlocks} />
            <g>
              {!MAGIC_HANDS_MOBILE_PERFORMANCE_MODE && (
                <>
                  <animateTransform attributeName="transform" type="rotate" from="0 80 82" to="360 80 82" dur={`${meteorite.emberDur}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0.86;0.42;0.76;0.5" dur={`${meteorite.flameDur}s`} repeatCount="indefinite" />
                </>
              )}
              <PixelBlocks blocks={meteorEmberBlocks} />
            </g>
          </g>
        ))}
        {isCharging && (
          <PixelBlocks
            blocks={[
              { x: 122, y: 18, w: 10, h: 10, color: "#fff7ed", opacity: 0.72 },
              { x: 18, y: 44, w: 10, h: 10, color: "#fed7aa", opacity: 0.66 },
              { x: 118, y: 132, w: 12, h: 12, color: "#fb923c", opacity: 0.68 },
              { x: 28, y: 144, w: 8, h: 8, color: "#fef3c7", opacity: 0.68 },
            ]}
          />
        )}
      </svg>
    </div>
  );
}
