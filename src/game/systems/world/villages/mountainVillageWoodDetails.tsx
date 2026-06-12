import { Fragment } from "react";
import { getCachedIndexRange } from "../../rendering/indexRange";
import { lerpNumber } from "../survival/survivalMath";
import { RetroPixelWoodTexture } from "./mountainVillageRetroWoodTexture";

const MOUNTAIN_HUT_DETAIL_SIDES = [-1, 1] as const;
const MOUNTAIN_DOOR_STRAP_HEIGHT_RATIOS = [0.31, 0.64] as const;
const MOUNTAIN_WOOD_RENDER_SIDES = [-1, 1] as const;
const MOUNTAIN_TIMBER_GRAIN_OFFSETS = [-0.27, 0.26] as const;
const MOUNTAIN_HORIZONTAL_GRAIN_OFFSETS = [-0.2, 0.22] as const;

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

export function MountainHutDoorPanel({
  doorWidth,
  doorHeight,
  floorY,
  frontZ,
  compact = false,
}: {
  doorWidth: number;
  doorHeight: number;
  floorY: number;
  frontZ: number;
  compact?: boolean;
}) {
  const panelWidth = doorWidth * 0.86;
  const panelHeight = doorHeight * 0.84;
  const boardCount = compact ? 3 : 4;
  const boardWidth = panelWidth / boardCount;
  const panelY = floorY + doorHeight * 0.46;
  const panelZ = frontZ + 0.42;

  return (
    <group name="solid-pixel-wood-door">
      <mesh position={[0, panelY, panelZ - 0.04]} castShadow={false}>
        <boxGeometry args={[panelWidth + 0.28, panelHeight + 0.22, 0.32]} />
        <meshBasicMaterial color="#1b1009" />
      </mesh>
      {getCachedIndexRange(boardCount).map((index) => {
        const x = -panelWidth / 2 + boardWidth * (index + 0.5);

        return (
          <group key={`door-board-${index}`} position={[x, panelY, panelZ]}>
            <mesh castShadow={false}>
              <boxGeometry args={[boardWidth + 0.04, panelHeight, 0.24]} />
              <meshBasicMaterial color={index % 2 === 0 ? "#6f4528" : "#4c2e1a"} />
            </mesh>
            <RetroPixelWoodTexture width={boardWidth * 0.88} height={panelHeight * 0.92} z={0.16} count={compact ? 5 : 7} seed={index + (compact ? 8 : 2)} />
          </group>
        );
      })}
      {getCachedIndexRange(boardCount + 1).map((index) => {
        const x = -panelWidth / 2 + index * boardWidth;

        return (
          <mesh key={`door-board-gap-${index}`} position={[x, panelY, panelZ + 0.18]} castShadow={false}>
            <boxGeometry args={[0.1, panelHeight * 0.96, 0.1]} />
            <meshBasicMaterial color="#080504" />
          </mesh>
        );
      })}
      {MOUNTAIN_DOOR_STRAP_HEIGHT_RATIOS.map((heightRatio, index) => (
        <mesh key={`door-cross-brace-${index}`} position={[0, floorY + doorHeight * heightRatio, panelZ + 0.24]} castShadow={false}>
          <boxGeometry args={[panelWidth + 0.42, 0.42, 0.2]} />
          <meshBasicMaterial color={index === 0 ? "#2a180d" : "#9a6333"} />
        </mesh>
      ))}
      <mesh position={[panelWidth * 0.24, floorY + doorHeight * 0.5, panelZ + 0.34]} castShadow={false}>
        <boxGeometry args={[0.36, 0.36, 0.22]} />
        <meshBasicMaterial color="#d0a05d" />
      </mesh>
      <mesh position={[0, floorY + doorHeight + 0.08, panelZ + 0.08]} castShadow={false}>
        <boxGeometry args={[panelWidth + 0.72, 0.24, 0.16]} />
        <meshBasicMaterial color="#070504" transparent opacity={0.78} />
      </mesh>
    </group>
  );
}

export function MountainHutWallDetails({
  width,
  depth,
  height,
  floorY,
  frontZ,
  backZ,
  doorWidth,
  doorHeight,
  compact = false,
}: {
  width: number;
  depth: number;
  height: number;
  floorY: number;
  frontZ: number;
  backZ: number;
  doorWidth: number;
  doorHeight: number;
  compact?: boolean;
}) {
  const frontPlankCount = compact ? 5 : 7;
  const sidePlankCount = compact ? 4 : 5;
  const lowerBandY = floorY + 1.2;
  const upperBandY = floorY + height - 1.2;
  const frontPanelWidth = Math.max(1.2, (width - doorWidth) / 2);

  return (
    <>
      {getCachedIndexRange(frontPlankCount).map((index) => {
        const x = -width / 2 + ((index + 1) * width) / (frontPlankCount + 1);
        if (Math.abs(x) < doorWidth / 2 + 0.55) return null;

        return (
          <mesh key={`front-plank-seam-${index}`} position={[x, floorY + height / 2, frontZ + 0.2]} castShadow={false}>
            <boxGeometry args={[0.12, height * 0.78, 0.14]} />
            <meshBasicMaterial color="#21160f" transparent opacity={0.72} />
          </mesh>
        );
      })}
      {MOUNTAIN_HUT_DETAIL_SIDES.map((side) => (
        <Fragment key={`side-wall-detail-${side}`}>
          {getCachedIndexRange(sidePlankCount).map((index) => {
            const z = -depth / 2 + ((index + 1) * depth) / (sidePlankCount + 1);

            return (
              <mesh key={`side-plank-${index}`} position={[side * (width / 2 + 0.08), floorY + height / 2, z]} castShadow={false}>
                <boxGeometry args={[0.12, height * 0.72, 0.1]} />
                <meshBasicMaterial color={index % 2 === 0 ? "#241810" : "#7b5332"} transparent opacity={0.62} />
              </mesh>
            );
          })}
        </Fragment>
      ))}
      <Fragment>
        <mesh position={[0, lowerBandY, frontZ + 0.24]} castShadow={false}>
          <boxGeometry args={[width + 0.58, 0.32, 0.2]} />
          <meshBasicMaterial color="#2b1c12" />
        </mesh>
        <mesh position={[0, lowerBandY, backZ - 0.18]} castShadow={false}>
          <boxGeometry args={[width + 0.28, 0.24, 0.18]} />
          <meshBasicMaterial color="#2b1c12" />
        </mesh>
      </Fragment>
      <Fragment>
        <mesh position={[0, upperBandY, frontZ + 0.24]} castShadow={false}>
          <boxGeometry args={[width + 0.58, 0.32, 0.2]} />
          <meshBasicMaterial color="#805832" />
        </mesh>
        <mesh position={[0, upperBandY, backZ - 0.18]} castShadow={false}>
          <boxGeometry args={[width + 0.28, 0.24, 0.18]} />
          <meshBasicMaterial color="#2b1c12" />
        </mesh>
      </Fragment>
      {MOUNTAIN_HUT_DETAIL_SIDES.map((side) => (
        <Fragment key={`hut-corner-shadow-${side}`}>
          <mesh position={[side * (width / 2 + 0.18), floorY + height / 2, frontZ + 0.18]} castShadow={false}>
            <boxGeometry args={[0.34, height + 0.44, 0.22]} />
            <meshBasicMaterial color="#0b0705" transparent opacity={0.76} />
          </mesh>
          <mesh position={[side * (width / 2 + 0.12), floorY + height / 2, backZ - 0.1]} castShadow={false}>
            <boxGeometry args={[0.24, height * 0.9, 0.2]} />
            <meshBasicMaterial color="#0b0705" transparent opacity={0.58} />
          </mesh>
        </Fragment>
      ))}
      <mesh position={[0, floorY + 0.34, frontZ + 0.3]} castShadow={false}>
        <boxGeometry args={[width + 0.86, 0.42, 0.22]} />
        <meshBasicMaterial color="#0c0805" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, floorY + height + 0.14, frontZ + 0.26]} castShadow={false}>
        <boxGeometry args={[width + 1.1, 0.3, 0.2]} />
        <meshBasicMaterial color="#100b07" transparent opacity={0.68} />
      </mesh>
      {MOUNTAIN_HUT_DETAIL_SIDES.map((side) => (
        <group key={`front-wall-pixel-wood-${side}`} position={[side * (doorWidth / 2 + frontPanelWidth / 2), floorY + height / 2, frontZ + 0.36]}>
          <RetroPixelWoodTexture width={frontPanelWidth * 0.82} height={height * 0.78} z={0} count={compact ? 7 : 10} seed={side > 0 ? 4 : 9} dark />
        </group>
      ))}
      <MountainHutDoorPanel doorWidth={doorWidth} doorHeight={doorHeight} floorY={floorY} frontZ={frontZ} compact={compact} />
    </>
  );
}

export function MountainHutRoofDetails({
  width,
  depth,
  roofBaseY,
  roofHeight,
  compact = false,
}: {
  width: number;
  depth: number;
  roofBaseY: number;
  roofHeight: number;
  compact?: boolean;
}) {
  const rowCount = compact ? 3 : 4;
  const frontZ = depth * 0.44;
  const sideX = width * 0.44;

  return (
    <>
      {getCachedIndexRange(rowCount).map((index) => {
        const t = (index + 1) / (rowCount + 1);
        const y = roofBaseY + t * roofHeight;
        const widthScale = lerpNumber(width * 0.84, width * 0.32, t);
        const depthScale = lerpNumber(depth * 0.84, depth * 0.32, t);

        return (
          <Fragment key={`roof-shingle-row-${index}`}>
            <mesh position={[0, y, frontZ - t * depth * 0.2]} castShadow={false}>
              <boxGeometry args={[widthScale, 0.16, 0.24]} />
              <meshBasicMaterial color={index % 2 === 0 ? "#311f15" : "#8f6338"} />
            </mesh>
            <mesh position={[0, y + 0.06, -frontZ + t * depth * 0.2]} castShadow={false}>
              <boxGeometry args={[widthScale * 0.86, 0.14, 0.2]} />
              <meshBasicMaterial color="#2a1b12" />
            </mesh>
            <mesh position={[sideX - t * width * 0.22, y + 0.02, 0]} castShadow={false}>
              <boxGeometry args={[0.2, 0.14, depthScale]} />
              <meshBasicMaterial color="#7b5332" />
            </mesh>
            <mesh position={[-sideX + t * width * 0.22, y + 0.02, 0]} castShadow={false}>
              <boxGeometry args={[0.2, 0.14, depthScale]} />
              <meshBasicMaterial color="#2a1b12" />
            </mesh>
          </Fragment>
        );
      })}
      <mesh position={[0, roofBaseY + 0.28, frontZ + 0.22]} castShadow={false}>
        <boxGeometry args={[width * 1.06, 0.26, 0.32]} />
        <meshBasicMaterial color="#080504" transparent opacity={0.78} />
      </mesh>
      <mesh position={[0, roofBaseY + 0.24, -frontZ - 0.18]} castShadow={false}>
        <boxGeometry args={[width * 0.92, 0.22, 0.28]} />
        <meshBasicMaterial color="#080504" transparent opacity={0.62} />
      </mesh>
      <mesh position={[0, roofBaseY + roofHeight * 0.86, 0]} castShadow={false}>
        <boxGeometry args={[width * 0.3, 0.22, depth * 0.3]} />
        <meshBasicMaterial color="#090605" transparent opacity={0.72} />
      </mesh>
      <mesh position={[-width * 0.24, roofBaseY + roofHeight * 0.66, depth * 0.2]} castShadow={false}>
        <boxGeometry args={[width * 0.28, 0.2, 0.42]} />
        <meshBasicMaterial color="#f7fcff" transparent opacity={0.82} />
      </mesh>
      <mesh position={[width * 0.18, roofBaseY + roofHeight * 0.5, -depth * 0.28]} castShadow={false}>
        <boxGeometry args={[width * 0.22, 0.18, 0.36]} />
        <meshBasicMaterial color="#cdeafa" transparent opacity={0.7} />
      </mesh>
    </>
  );
}

export function RetroWindowDetails({ x, y, z, width, height }: { x: number; y: number; z: number; width: number; height: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh castShadow={false}>
        <boxGeometry args={[width + 0.32, height + 0.32, 0.12]} />
        <meshBasicMaterial color="#18100a" transparent opacity={0.54} />
      </mesh>
      <mesh position={[0, -height / 2 - 0.15, 0.16]} castShadow={false}>
        <boxGeometry args={[width + 0.62, 0.24, 0.14]} />
        <meshBasicMaterial color="#050403" transparent opacity={0.82} />
      </mesh>
      <mesh position={[0, 0, 0.1]} castShadow={false}>
        <boxGeometry args={[0.18, height + 0.42, 0.14]} />
        <meshBasicMaterial color="#2b1c12" />
      </mesh>
      <mesh position={[0, 0, 0.12]} castShadow={false}>
        <boxGeometry args={[width + 0.42, 0.18, 0.14]} />
        <meshBasicMaterial color="#2b1c12" />
      </mesh>
      {MOUNTAIN_HUT_DETAIL_SIDES.map((side) => (
        <mesh key={`window-glint-${side}`} position={[side * width * 0.24, height * 0.18, 0.16]} castShadow={false}>
          <boxGeometry args={[0.28, 0.34, 0.1]} />
          <meshBasicMaterial color="#fff1a9" transparent opacity={0.58} />
        </mesh>
      ))}
    </group>
  );
}
