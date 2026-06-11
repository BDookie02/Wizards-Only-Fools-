export type MagicGlassOrbSignal = {
  distance: number;
  angle: number;
  depth: number;
};

export type MagicGlassOrbPose = {
  x: number;
  z: number;
  angle: number;
};

type MagicGlassOrbPlayer = {
  health?: number;
  pos?: number[];
};

export type PixelBlock = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  opacity?: number;
  rotation?: number;
};

export type TinyTornadoBlocks = {
  frontBands: PixelBlock[];
  backBands: PixelBlock[];
  loose: PixelBlock[];
  dust: PixelBlock[];
};

export const GLASS_ORB_LOCK_ANGLE = 0.12;

export function normalizeRadians(angle: number) {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
}

export function processFireballPixels(ctx: CanvasRenderingContext2D, width: number, height: number) {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const distSq = r * r + g * g + b * b;
      if (distSq < 2500) {
        if (distSq < 900) {
          data[i + 3] = 0;
        } else {
          const alpha = Math.floor(255 * ((Math.sqrt(distSq) - 30) / 20));
          data[i + 3] = Math.min(data[i + 3], alpha);
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (error) {
    console.warn("processFireballPixels failed", error);
  }
}

export function getMagicGlassOrbSignal(
  pose: MagicGlassOrbPose,
  players: Record<string, MagicGlassOrbPlayer>,
  previousSignal: MagicGlassOrbSignal | null,
): MagicGlassOrbSignal | null {
  let nearestDistanceSq = Number.POSITIVE_INFINITY;
  let nearestX = 0;
  let nearestZ = 0;

  for (const playerId in players) {
    const player = players[playerId];
    if (!player || Number(player.health) <= 0 || !player.pos) continue;
    const targetX = Number(player.pos[0]);
    const targetZ = Number(player.pos[2]);
    if (!Number.isFinite(targetX) || !Number.isFinite(targetZ)) continue;

    const dx = targetX - pose.x;
    const dz = targetZ - pose.z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq <= 0.01) continue;
    if (distanceSq < nearestDistanceSq) {
      nearestDistanceSq = distanceSq;
      nearestX = targetX;
      nearestZ = targetZ;
    }
  }

  if (!Number.isFinite(nearestDistanceSq)) {
    return null;
  }

  const nearestDistance = Math.sqrt(nearestDistanceSq);
  const angle = normalizeRadians(Math.atan2(nearestX - pose.x, -(nearestZ - pose.z)) - pose.angle);
  const depth = (Math.cos(angle) + 1) / 2;

  if (
    previousSignal &&
    Math.abs(previousSignal.distance - nearestDistance) < 0.75 &&
    Math.abs(previousSignal.angle - angle) < 0.04
  ) {
    return previousSignal;
  }

  return { distance: nearestDistance, angle, depth };
}

export const lerp = (start: number, end: number, amount: number) => start + (end - start) * amount;

export const roundPixel = (value: number) => Math.round(value * 2) / 2;

export function buildTinyTornadoBlocks(): TinyTornadoBlocks {
  const frontBands: PixelBlock[] = [];
  const backBands: PixelBlock[] = [];
  const loose: PixelBlock[] = [];
  const dust: PixelBlock[] = [];

  for (let bandIndex = 0; bandIndex < 9; bandIndex += 1) {
    const t = bandIndex / 8;
    const y = lerp(22, 130, t);
    const width = lerp(96, 18, t);
    const height = lerp(9, 5, t);
    const center = 80 + Math.sin(t * Math.PI * 3.7) * lerp(11, 2, t);
    const left = center - width / 2;
    const frontRight = bandIndex % 2 === 0;
    const highlightX = frontRight ? left + width * 0.2 : left + width * 0.46;
    const shadowX = frontRight ? left + width * 0.56 : left + width * 0.12;
    const targetBands = frontRight ? frontBands : backBands;

    targetBands.push(
      {
        x: roundPixel(left),
        y: roundPixel(y),
        w: roundPixel(width),
        h: roundPixel(height),
        color: bandIndex % 3 === 0 ? "#d1d5db" : bandIndex % 3 === 1 ? "#9ca3af" : "#6b7280",
        opacity: lerp(0.9, 0.68, t),
        rotation: frontRight ? -4 : 4,
      },
      {
        x: roundPixel(highlightX),
        y: roundPixel(y - height * 0.45),
        w: roundPixel(width * lerp(0.36, 0.52, 1 - t)),
        h: roundPixel(Math.max(2.5, height * 0.45)),
        color: "#f8fafc",
        opacity: lerp(0.72, 0.42, t),
        rotation: frontRight ? -4 : 4,
      },
      {
        x: roundPixel(shadowX),
        y: roundPixel(y + height * 0.58),
        w: roundPixel(width * lerp(0.34, 0.5, t)),
        h: roundPixel(Math.max(2.5, height * 0.42)),
        color: "#374151",
        opacity: lerp(0.62, 0.34, t),
        rotation: frontRight ? -4 : 4,
      },
    );
  }

  for (let index = 0; index < 12; index += 1) {
    const t = index / 11;
    const angle = t * Math.PI * 8.5;
    const radius = lerp(8, 47, t);
    const funnelTaper = 1 - t * 0.42;
    loose.push({
      x: roundPixel(80 + Math.cos(angle) * radius * funnelTaper),
      y: roundPixel(132 - lerp(0, 104, t)),
      w: roundPixel(lerp(5, 2.5, t)),
      h: roundPixel(lerp(5, 2.5, t)),
      color: index % 3 === 0 ? "#f8fafc" : index % 3 === 1 ? "#9ca3af" : "#4b5563",
      opacity: lerp(0.78, 0.42, t),
    });
  }

  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    const radius = 29 + (index % 6) * 7;
    dust.push({
      x: roundPixel(80 + Math.cos(angle) * radius),
      y: roundPixel(139 + Math.sin(angle) * 7),
      w: 6 + (index % 4),
      h: 3,
      color: index % 4 === 0 ? "#d1d5db" : index % 4 === 1 ? "#9ca3af" : index % 4 === 2 ? "#6b7280" : "#a16207",
      opacity: 0.28 + (index % 3) * 0.07,
      rotation: roundPixel(angle * 180 / Math.PI),
    });
  }

  return { frontBands, backBands, loose, dust };
}

export const tinyTornadoGlowBlocks: PixelBlock[] = [
  { x: 20, y: 16, w: 120, h: 22, color: "#d1d5db", opacity: 0.12 },
  { x: 26, y: 42, w: 108, h: 24, color: "#9ca3af", opacity: 0.13 },
  { x: 38, y: 68, w: 84, h: 28, color: "#4b5563", opacity: 0.13 },
  { x: 50, y: 96, w: 60, h: 26, color: "#6b7280", opacity: 0.12 },
];

export const tinyTornadoBlocks = buildTinyTornadoBlocks();
