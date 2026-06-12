import { Fragment, useMemo } from "react";
import * as THREE from "three";

const CHAPEL_GOTHIC_WINDOW_MULLION_X = [-3.15, 0, 3.15] as const;
const CHAPEL_GOTHIC_WINDOW_SIDE_RIB_X = [-4.8, 4.8] as const;
const CHAPEL_GOTHIC_WINDOW_OUTER_PIER_X = [-6.15, 6.15] as const;
const CHAPEL_GOTHIC_WINDOW_LANCET_X = [-2.6, 2.6] as const;
const CHAPEL_GOTHIC_WINDOW_GLASS_STRIP_X = [-4.2, -1.4, 1.4, 4.2] as const;

export function ChapelStainedWindow({ position, rotation = [0, 0, 0], scale = 1 }: { position: [number, number, number]; rotation?: [number, number, number]; scale?: number }) {
  return (
    <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
      <mesh castShadow={false}>
        <boxGeometry args={[6.2, 10.4, 0.22]} />
        <meshBasicMaterial color="#0b0b10" />
      </mesh>
      <mesh position={[0, 0, -0.14]} castShadow={false}>
        <boxGeometry args={[5.2, 8.8, 0.16]} />
        <meshBasicMaterial color="#1d4ed8" transparent opacity={0.82} />
      </mesh>
      <mesh position={[-1.35, 0, -0.24]} castShadow={false}>
        <boxGeometry args={[1.1, 8.2, 0.12]} />
        <meshBasicMaterial color="#7e22ce" transparent opacity={0.82} />
      </mesh>
      <mesh position={[1.35, 0, -0.26]} castShadow={false}>
        <boxGeometry args={[1.1, 8.2, 0.12]} />
        <meshBasicMaterial color="#dc2626" transparent opacity={0.76} />
      </mesh>
      <mesh position={[0, 2.25, -0.3]} castShadow={false}>
        <boxGeometry args={[5.0, 0.42, 0.1]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.88} />
      </mesh>
      <mesh position={[0, -2.25, -0.3]} castShadow={false}>
        <boxGeometry args={[5.0, 0.42, 0.1]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.88} />
      </mesh>
    </group>
  );
}

export function ChapelMuralWindow({ position, rotation = [0, 0, 0], scale = 1, variant = 0 }: { position: [number, number, number]; rotation?: [number, number, number]; scale?: number; variant?: number }) {
  const robes = variant % 2 === 0 ? "#7c3aed" : "#b91c1c";
  const halo = variant % 2 === 0 ? "#facc15" : "#f59e0b";

  return (
    <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
      <mesh castShadow={false}>
        <boxGeometry args={[10.4, 20.6, 0.3]} />
        <meshBasicMaterial color="#08090d" />
      </mesh>
      <mesh position={[0, 0, -0.2]} castShadow={false}>
        <boxGeometry args={[8.8, 18.5, 0.16]} />
        <meshBasicMaterial color="#1e3a8a" transparent opacity={0.82} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-2.9, 0, -0.34]} castShadow={false}>
        <boxGeometry args={[1.55, 17.2, 0.14]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.78} />
      </mesh>
      <mesh position={[2.9, 0, -0.36]} castShadow={false}>
        <boxGeometry args={[1.55, 17.2, 0.14]} />
        <meshBasicMaterial color="#dc2626" transparent opacity={0.76} />
      </mesh>
      <mesh position={[0, 3.2, -0.45]} castShadow={false}>
        <circleGeometry args={[2.25, 12]} />
        <meshBasicMaterial color={halo} transparent opacity={0.88} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -2.9, -0.5]} castShadow={false}>
        <boxGeometry args={[3.3, 8.6, 0.12]} />
        <meshBasicMaterial color={robes} transparent opacity={0.82} />
      </mesh>
      <mesh position={[0, 0.5, -0.58]} castShadow={false}>
        <boxGeometry args={[7.6, 0.54, 0.1]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, -5.8, -0.58]} castShadow={false}>
        <boxGeometry args={[7.6, 0.54, 0.1]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, 0, -0.6]} castShadow={false}>
        <boxGeometry args={[0.54, 17.4, 0.1]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.92} />
      </mesh>
    </group>
  );
}

export function makeChapelGothicArchShape(width: number, height: number) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const springY = halfHeight * 0.2;
  const apexY = halfHeight;

  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth, -halfHeight);
  shape.lineTo(halfWidth, -halfHeight);
  shape.lineTo(halfWidth, springY);
  shape.quadraticCurveTo(halfWidth * 0.84, apexY * 0.74, 0, apexY);
  shape.quadraticCurveTo(-halfWidth * 0.84, apexY * 0.74, -halfWidth, springY);
  shape.lineTo(-halfWidth, -halfHeight);
  return shape;
}

export function ChapelGiantGothicWindow({
  position,
  rotation = [0, 0, 0],
  scale = 1,
  variant = 0,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  variant?: number;
}) {
  const outerShape = useMemo(() => makeChapelGothicArchShape(13.4, 26.8), []);
  const innerShape = useMemo(() => makeChapelGothicArchShape(10.4, 23.2), []);
  const glowColor = variant % 3 === 0 ? "#38bdf8" : variant % 3 === 1 ? "#a78bfa" : "#f472b6";
  const accentColor = variant % 2 === 0 ? "#fde68a" : "#e9d5ff";

  return (
    <group name="chapel-giant-gothic-window" position={position} rotation={rotation} scale={[scale, scale, scale]}>
      <mesh position={[0, 0, 0]} castShadow={false} renderOrder={2}>
        <shapeGeometry args={[outerShape]} />
        <meshBasicMaterial color="#121019" side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
      <mesh position={[0, -0.35, 0.08]} castShadow={false} renderOrder={3}>
        <shapeGeometry args={[innerShape]} />
        <meshBasicMaterial color="#1d4ed8" transparent opacity={0.74} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.35, 0.12]} castShadow={false} renderOrder={4}>
        <shapeGeometry args={[innerShape]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.48} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {CHAPEL_GOTHIC_WINDOW_MULLION_X.map((x) => (
        <mesh key={`chapel-gothic-window-mullion-${x}`} position={[x, -1.95, 0.2]} castShadow={false} renderOrder={5}>
          <boxGeometry args={[0.42, 17.4, 0.22]} />
          <meshBasicMaterial color="#efe5c7" />
        </mesh>
      ))}
      {CHAPEL_GOTHIC_WINDOW_SIDE_RIB_X.map((x) => (
        <mesh key={`chapel-gothic-window-side-rib-${x}`} position={[x, -1.1, 0.18]} castShadow={false} renderOrder={5}>
          <boxGeometry args={[0.36, 19.2, 0.22]} />
          <meshBasicMaterial color="#b8ad99" />
        </mesh>
      ))}
      {CHAPEL_GOTHIC_WINDOW_OUTER_PIER_X.map((x) => (
        <mesh key={`chapel-gothic-window-outer-pier-${x}`} position={[x, -1.4, 0.16]} castShadow={false} renderOrder={5}>
          <boxGeometry args={[0.62, 21.8, 0.28]} />
          <meshBasicMaterial color="#8f897f" />
        </mesh>
      ))}
      <mesh position={[0, -8.95, 0.22]} castShadow={false} renderOrder={5}>
        <boxGeometry args={[11.8, 0.62, 0.26]} />
        <meshBasicMaterial color="#d8cbb1" />
      </mesh>
      <mesh position={[0, -2.25, 0.24]} castShadow={false} renderOrder={5}>
        <boxGeometry args={[10.2, 0.46, 0.22]} />
        <meshBasicMaterial color="#b8ad99" />
      </mesh>
      {CHAPEL_GOTHIC_WINDOW_LANCET_X.map((x) => (
        <Fragment key={`chapel-gothic-window-lancet-${x}`}>
          <mesh position={[x, 5.25, 0.28]} rotation={[0, 0, x > 0 ? -0.44 : 0.44]} castShadow={false} renderOrder={6}>
            <boxGeometry args={[0.36, 8.2, 0.2]} />
            <meshBasicMaterial color={accentColor} transparent opacity={0.88} />
          </mesh>
          <mesh position={[x * 0.58, 7.7, 0.3]} rotation={[0, 0, x > 0 ? -0.78 : 0.78]} castShadow={false} renderOrder={6}>
            <boxGeometry args={[0.28, 5.6, 0.18]} />
            <meshBasicMaterial color="#d7d0bd" transparent opacity={0.9} />
          </mesh>
        </Fragment>
      ))}
      <mesh position={[0, 7.25, 0.32]} castShadow={false} renderOrder={6}>
        <circleGeometry args={[1.55, 14]} />
        <meshBasicMaterial color={accentColor} transparent opacity={0.72} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 7.25, 0.36]} castShadow={false} renderOrder={7}>
        <circleGeometry args={[0.72, 10]} />
        <meshBasicMaterial color="#070810" transparent opacity={0.82} side={THREE.DoubleSide} />
      </mesh>
      {CHAPEL_GOTHIC_WINDOW_GLASS_STRIP_X.map((x, index) => (
        <mesh key={`chapel-gothic-window-glass-strip-${index}`} position={[x, -4.85, 0.34]} castShadow={false} renderOrder={6}>
          <boxGeometry args={[1.15, 6.8, 0.12]} />
          <meshBasicMaterial color={index % 2 === 0 ? "#38bdf8" : "#a78bfa"} transparent opacity={0.76} />
        </mesh>
      ))}
    </group>
  );
}

type ChapelStoneBrickTextureOptions = {
  base: string;
  mid: string;
  light: string;
  mortar: string;
  highlight: string;
  shadow: string;
  chip: string;
  repeatX: number;
  repeatY: number;
};

export function createChapelStoneBrickTexture({
  base,
  mid,
  light,
  mortar,
  highlight,
  shadow,
  chip,
  repeatX,
  repeatY,
}: ChapelStoneBrickTextureOptions) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = mortar;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const brickHeights = [54, 58, 50, 62];
    const brickWidths = [124, 152, 108, 176, 136, 164];
    let y = -8;

    for (let row = 0; y < canvas.height + 64; row++) {
      const brickHeight = brickHeights[row % brickHeights.length];
      let x = row % 2 === 0 ? -34 : -108;
      let col = 0;

      while (x < canvas.width + 190) {
        const brickWidth = brickWidths[(row + col) % brickWidths.length];
        const inset = 5;
        const shade = row % 3 === 0 ? base : row % 3 === 1 ? mid : light;

        ctx.fillStyle = shade;
        ctx.fillRect(x + inset, y + inset, brickWidth - inset * 2, brickHeight - inset * 2);
        ctx.fillStyle = highlight;
        ctx.fillRect(x + inset + 4, y + inset + 4, brickWidth - inset * 2 - 12, 5);
        ctx.fillRect(x + inset + 4, y + inset + 12, 6, brickHeight - inset * 2 - 20);
        ctx.fillStyle = shadow;
        ctx.fillRect(x + inset + 5, y + brickHeight - inset - 8, brickWidth - inset * 2 - 10, 7);
        ctx.fillRect(x + brickWidth - inset - 9, y + inset + 9, 6, brickHeight - inset * 2 - 18);

        if ((row + col) % 2 === 0) {
          ctx.fillStyle = chip;
          ctx.fillRect(x + brickWidth * 0.42, y + brickHeight * 0.35, 16, 7);
          ctx.fillRect(x + brickWidth * 0.66, y + brickHeight * 0.66, 10, 5);
        } else {
          ctx.fillStyle = shadow;
          ctx.fillRect(x + brickWidth * 0.24, y + brickHeight * 0.56, 13, 5);
        }

        x += brickWidth;
        col++;
      }

      y += brickHeight;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.needsUpdate = true;
  return texture;
}

export function ChapelCrack({ position, rotation = [0, 0, 0], scale = 1 }: { position: [number, number, number]; rotation?: [number, number, number]; scale?: number }) {
  return (
    <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
      <mesh position={[0, 0, 0]} rotation={[0, 0, 0.62]} castShadow={false}>
        <boxGeometry args={[0.34, 5.6, 0.18]} />
        <meshBasicMaterial color="#151319" />
      </mesh>
      <mesh position={[1.1, -1.7, -0.04]} rotation={[0, 0, -0.9]} castShadow={false}>
        <boxGeometry args={[0.28, 3.2, 0.16]} />
        <meshBasicMaterial color="#17151b" />
      </mesh>
      <mesh position={[-0.9, 1.9, -0.04]} rotation={[0, 0, -0.72]} castShadow={false}>
        <boxGeometry args={[0.26, 2.7, 0.16]} />
        <meshBasicMaterial color="#17151b" />
      </mesh>
    </group>
  );
}
