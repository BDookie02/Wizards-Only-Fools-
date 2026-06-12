import { Fragment } from "react";
import { getCachedIndexRange } from "../../rendering/indexRange";

const MOUNTAIN_WOOD_RENDER_SIDES = [-1, 1] as const;
const MOUNTAIN_TIMBER_GRAIN_OFFSETS = [-0.27, 0.26] as const;
const MOUNTAIN_HORIZONTAL_GRAIN_OFFSETS = [-0.2, 0.22] as const;
const MOUNTAIN_RETRO_WOOD_DARK_COLORS = ["#0a0604", "#1a100a", "#2f1d11", "#4d301b"] as const;
const MOUNTAIN_RETRO_WOOD_LIGHT_COLORS = ["#1b1009", "#3c2415", "#704627", "#b47a3f"] as const;

export function RetroVerticalTimberDetails({
  height,
  width,
  depth,
  frontZ,
  bandColor = "#a67642",
  darkColor = "#1d130d",
  lightColor = "#6f4b2b",
}: {
  height: number;
  width: number;
  depth: number;
  frontZ?: number;
  bandColor?: string;
  darkColor?: string;
  lightColor?: string;
}) {
  const z = frontZ ?? depth / 2 + 0.035;
  const bandCount = Math.max(2, Math.min(6, Math.floor(height / 5.2)));

  return (
    <>
      {getCachedIndexRange(bandCount).map((index) => {
        const y = -height / 2 + (index + 1) * (height / (bandCount + 1));

        return (
          <Fragment key={`timber-band-${index}`}>
            <mesh position={[0, y, z]} castShadow={false}>
              <boxGeometry args={[width + 0.28, 0.28, 0.12]} />
              <meshBasicMaterial color={bandColor} />
            </mesh>
            {MOUNTAIN_WOOD_RENDER_SIDES.map((side) => (
              <mesh key={`timber-bolt-${side}`} position={[side * width * 0.32, y + 0.01, z + 0.07]} castShadow={false}>
                <boxGeometry args={[0.18, 0.18, 0.12]} />
                <meshBasicMaterial color="#d7a85e" />
              </mesh>
            ))}
          </Fragment>
        );
      })}
      {MOUNTAIN_TIMBER_GRAIN_OFFSETS.map((offset, index) => (
        <mesh key={`timber-grain-${index}`} position={[offset * width, 0, z + 0.04]} castShadow={false}>
          <boxGeometry args={[0.08, height * 0.86, 0.08]} />
          <meshBasicMaterial color={index === 0 ? darkColor : lightColor} transparent opacity={0.82} />
        </mesh>
      ))}
      <RetroPixelWoodTexture width={width * 0.82} height={height * 0.86} z={z + 0.12} count={Math.max(5, Math.min(14, Math.floor(height / 2.8)))} seed={Math.floor(height + width * 5)} dark />
      {MOUNTAIN_WOOD_RENDER_SIDES.map((side) => (
        <mesh key={`timber-dark-edge-${side}`} position={[side * (width / 2 + 0.03), 0, z + 0.02]} castShadow={false}>
          <boxGeometry args={[0.12, height * 0.92, 0.1]} />
          <meshBasicMaterial color="#080504" transparent opacity={0.62} />
        </mesh>
      ))}
      <mesh position={[0, -height / 2 + 0.2, z + 0.05]} castShadow={false}>
        <boxGeometry args={[width + 0.22, 0.18, 0.12]} />
        <meshBasicMaterial color="#090604" transparent opacity={0.72} />
      </mesh>
    </>
  );
}

export function RetroHorizontalTimberDetails({
  length,
  height,
  depth,
  frontZ,
  bandColor = "#a67642",
  darkColor = "#21150d",
}: {
  length: number;
  height: number;
  depth: number;
  frontZ?: number;
  bandColor?: string;
  darkColor?: string;
}) {
  const z = frontZ ?? depth / 2 + 0.035;
  const bandCount = Math.max(2, Math.min(7, Math.floor(length / 5.8)));

  return (
    <>
      {getCachedIndexRange(bandCount).map((index) => {
        const x = -length / 2 + (index + 1) * (length / (bandCount + 1));

        return (
          <Fragment key={`horizontal-band-${index}`}>
            <mesh position={[x, 0, z]} castShadow={false}>
              <boxGeometry args={[0.28, height + 0.22, 0.13]} />
              <meshBasicMaterial color={bandColor} />
            </mesh>
            <mesh position={[x, height * 0.18, z + 0.08]} castShadow={false}>
              <boxGeometry args={[0.18, 0.18, 0.12]} />
              <meshBasicMaterial color="#d7a85e" />
            </mesh>
          </Fragment>
        );
      })}
      {MOUNTAIN_HORIZONTAL_GRAIN_OFFSETS.map((offset, index) => (
        <mesh key={`horizontal-grain-${index}`} position={[0, offset * height, z + 0.04]} castShadow={false}>
          <boxGeometry args={[length * 0.86, 0.08, 0.08]} />
          <meshBasicMaterial color={darkColor} transparent opacity={index === 0 ? 0.72 : 0.46} />
        </mesh>
      ))}
      <RetroPixelWoodTexture width={length * 0.86} height={height * 0.86} z={z + 0.12} count={Math.max(6, Math.min(16, Math.floor(length / 2.8)))} seed={Math.floor(length + height * 9)} dark />
      {MOUNTAIN_WOOD_RENDER_SIDES.map((side) => (
        <mesh key={`horizontal-end-shadow-${side}`} position={[side * (length / 2 + 0.02), 0, z + 0.04]} castShadow={false}>
          <boxGeometry args={[0.16, height + 0.16, 0.12]} />
          <meshBasicMaterial color="#080504" transparent opacity={0.68} />
        </mesh>
      ))}
      <mesh position={[0, -height / 2 - 0.02, z + 0.04]} castShadow={false}>
        <boxGeometry args={[length * 0.96, 0.14, 0.12]} />
        <meshBasicMaterial color="#090604" transparent opacity={0.58} />
      </mesh>
    </>
  );
}

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
