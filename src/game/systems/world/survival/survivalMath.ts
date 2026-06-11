export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function smoothstep01(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function smoothstepRange(edge0: number, edge1: number, value: number) {
  const span = edge1 - edge0;
  if (Math.abs(span) < 0.0001) return value >= edge1 ? 1 : 0;
  return smoothstep01((value - edge0) / span);
}

export function lerpNumber(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function survivalHash01(x: number, z: number, salt = 0) {
  const n = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

type RgbColor = Readonly<{
  r: number;
  g: number;
  b: number;
}>;

const HEX_RGB_CACHE = new Map<string, RgbColor>();

export function hexToRgb(hex: string): RgbColor {
  const cached = HEX_RGB_CACHE.get(hex);
  if (cached) return cached;

  const value = hex.replace("#", "");
  const normalized = value.length === 3
    ? `${value[0]}${value[0]}${value[1]}${value[1]}${value[2]}${value[2]}`
    : value.padEnd(6, "0").slice(0, 6);
  const color = {
    r: parseInt(normalized.slice(0, 2), 16) / 255,
    g: parseInt(normalized.slice(2, 4), 16) / 255,
    b: parseInt(normalized.slice(4, 6), 16) / 255,
  };
  HEX_RGB_CACHE.set(hex, color);
  return color;
}

export function getDistanceToSegment2D(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq < 0.0001) {
    const pointDx = px - ax;
    const pointDz = pz - az;
    return Math.sqrt(pointDx * pointDx + pointDz * pointDz);
  }

  const t = clamp01(((px - ax) * dx + (pz - az) * dz) / lengthSq);
  const closestX = ax + dx * t;
  const closestZ = az + dz * t;
  const closestDx = px - closestX;
  const closestDz = pz - closestZ;
  return Math.sqrt(closestDx * closestDx + closestDz * closestDz);
}
