import { getCachedIndexRange } from "../../rendering/indexRange";

const MOUNTAIN_RETRO_WOOD_DARK_COLORS = ["#0a0604", "#1a100a", "#2f1d11", "#4d301b"] as const;
const MOUNTAIN_RETRO_WOOD_LIGHT_COLORS = ["#1b1009", "#3c2415", "#704627", "#b47a3f"] as const;

export function RetroPixelWoodTexture({
  width,
  height,
  z = 0.08,
  count = 10,
  seed = 0,
  dark = false,
}: {
  width: number;
  height: number;
  z?: number;
  count?: number;
  seed?: number;
  dark?: boolean;
}) {
  const colors = dark ? MOUNTAIN_RETRO_WOOD_DARK_COLORS : MOUNTAIN_RETRO_WOOD_LIGHT_COLORS;

  return (
    <>
      {getCachedIndexRange(count).map((index) => {
        const t = ((index * 37 + seed * 19) % 100) / 100;
        const u = ((index * 53 + seed * 11) % 100) / 100;
        const x = -width * 0.42 + t * width * 0.84;
        const y = -height * 0.38 + u * height * 0.76;
        const pieceWidth = width * (0.09 + ((index + seed) % 3) * 0.045);
        const pieceHeight = Math.max(0.08, height * (0.025 + (index % 2) * 0.012));

        return (
          <mesh key={`pixel-wood-${index}`} position={[x, y, z]} castShadow={false}>
            <boxGeometry args={[pieceWidth, pieceHeight, 0.08]} />
            <meshBasicMaterial color={colors[(index + seed) % colors.length]} transparent opacity={dark ? 0.76 : 0.68} />
          </mesh>
        );
      })}
      {getCachedIndexRange(Math.max(2, Math.floor(count / 4))).map((index) => {
        const t = ((index * 29 + seed * 7) % 100) / 100;
        const u = ((index * 41 + seed * 13) % 100) / 100;

        return (
          <mesh key={`pixel-knot-${index}`} position={[-width * 0.36 + t * width * 0.72, -height * 0.32 + u * height * 0.64, z + 0.02]} castShadow={false}>
            <boxGeometry args={[Math.max(0.28, width * 0.08), Math.max(0.18, height * 0.035), 0.1]} />
            <meshBasicMaterial color="#090604" transparent opacity={0.72} />
          </mesh>
        );
      })}
    </>
  );
}
