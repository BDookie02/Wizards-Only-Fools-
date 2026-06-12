import { Fragment, useEffect, useMemo } from "react";
import * as THREE from "three";
import { AvatarBillboard, NPC_AVATAR_SCALE } from "../../../PixelAvatar";
import { CHAPEL_POPE_TARGET, CHAPEL_SIDE_SIGNS } from "./survivalGraveyardChapelLayout";
import { CHAPEL_POPE_CHARACTER } from "./survivalGraveyardChapelCharacters";
import {
  ChapelCenterPews,
  ChapelPewNpcs,
  ChapelSideWingPewNpcs,
  ChapelSideWingPews,
  getChapelPewSeatingSummary,
} from "./survivalGraveyardChapelPews";
import {
  CHAPEL_ALTAR_GRAIN_X,
  CHAPEL_CANDLE_DRIP_ANGLES,
  CHAPEL_CENTER_HALF_DEPTH,
  CHAPEL_CENTER_HALF_WIDTH,
  CHAPEL_CHANDELIER_CANDLE_POSITIONS,
  CHAPEL_INTERIOR_CANDLE_SPOTS,
  CHAPEL_PULPIT_GRAIN_X,
  CHAPEL_SIDE_WING_CENTER_X,
  CHAPEL_SIDE_WING_HALF_DEPTH,
  CHAPEL_SIDE_WING_HALF_WIDTH,
} from "./survivalGraveyardChapelStructure";

function createChapelPopeMiterTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f4f1e8";
    ctx.fillRect(24, 6, 16, 6);
    ctx.fillRect(20, 12, 24, 8);
    ctx.fillRect(16, 20, 32, 8);
    ctx.fillRect(12, 28, 40, 10);
    ctx.fillRect(16, 38, 32, 8);
    ctx.fillRect(22, 46, 20, 6);
    ctx.fillStyle = "#c8c1b4";
    ctx.fillRect(12, 36, 40, 4);
    ctx.fillRect(18, 44, 28, 4);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(18, 22, 24, 4);
    ctx.fillRect(22, 14, 14, 4);
    ctx.fillStyle = "#d4af37";
    ctx.fillRect(30, 11, 4, 31);
    ctx.fillRect(24, 22, 16, 4);
    ctx.fillRect(28, 6, 8, 4);
    ctx.fillStyle = "#7a5328";
    ctx.fillRect(35, 15, 3, 25);
    ctx.fillRect(26, 27, 15, 3);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

function ChapelPopeMiter() {
  const texture = useMemo(() => createChapelPopeMiterTexture(), []);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={[0, 2.08, 0.08]} scale={[1.36, 1.36, 1]}>
      <spriteMaterial map={texture} transparent alphaTest={0.04} depthWrite={false} toneMapped={false} />
    </sprite>
  );
}

function ChapelPopeAtPulpit() {
  return (
    <group name="chapel-pope-at-pulpit" position={[CHAPEL_POPE_TARGET.x, 7.1, CHAPEL_POPE_TARGET.z]} scale={[NPC_AVATAR_SCALE, NPC_AVATAR_SCALE, NPC_AVATAR_SCALE]}>
      <AvatarBillboard character={CHAPEL_POPE_CHARACTER} animation="idle" yaw={Math.PI} health={100} staticFrame fixedDirection={0} />
      <ChapelPopeMiter />
    </group>
  );
}

function ChapelWallCross() {
  return (
    <group name="chapel-wall-cross-behind-pope" position={[0, 18.2, -(CHAPEL_CENTER_HALF_DEPTH - 1.4)]}>
      <mesh position={[0.35, -0.35, -0.06]} castShadow={false}>
        <boxGeometry args={[2.7, 19.8, 0.34]} />
        <meshBasicMaterial color="#120d08" transparent opacity={0.72} />
      </mesh>
      <mesh position={[0.35, 2.8, -0.08]} castShadow={false}>
        <boxGeometry args={[13.6, 2.7, 0.34]} />
        <meshBasicMaterial color="#120d08" transparent opacity={0.72} />
      </mesh>
      <mesh castShadow={false}>
        <boxGeometry args={[2.25, 19.2, 0.46]} />
        <meshBasicMaterial color="#d7b46a" />
      </mesh>
      <mesh position={[0, 3.05, 0.03]} castShadow={false}>
        <boxGeometry args={[13.2, 2.25, 0.52]} />
        <meshBasicMaterial color="#d7b46a" />
      </mesh>
      <mesh position={[-0.34, 0.6, 0.08]} castShadow={false}>
        <boxGeometry args={[0.36, 16.8, 0.12]} />
        <meshBasicMaterial color="#f5d990" transparent opacity={0.72} />
      </mesh>
      <mesh position={[-0.55, 3.55, 0.1]} castShadow={false}>
        <boxGeometry args={[10.6, 0.34, 0.12]} />
        <meshBasicMaterial color="#f5d990" transparent opacity={0.7} />
      </mesh>
      <mesh position={[0.62, -0.5, 0.09]} castShadow={false}>
        <boxGeometry args={[0.34, 15.6, 0.12]} />
        <meshBasicMaterial color="#7a5328" transparent opacity={0.62} />
      </mesh>
      <mesh position={[0.66, 2.35, 0.11]} castShadow={false}>
        <boxGeometry args={[10.8, 0.34, 0.12]} />
        <meshBasicMaterial color="#7a5328" transparent opacity={0.56} />
      </mesh>
    </group>
  );
}

function ChapelCandle({ position, scale = 1, light = false }: { position: [number, number, number]; scale?: number; light?: boolean }) {
  return (
    <group position={position} scale={[scale, scale, scale]}>
      <mesh position={[0, 0.12, 0]} castShadow={false}>
        <cylinderGeometry args={[0.7, 0.82, 0.24, 10]} />
        <meshBasicMaterial color="#3a2a1b" />
      </mesh>
      <mesh position={[0, 0.28, 0]} castShadow={false}>
        <cylinderGeometry args={[0.44, 0.56, 0.3, 10]} />
        <meshBasicMaterial color="#7f6035" />
      </mesh>
      <mesh position={[0, 0.98, 0]} castShadow={false}>
        <cylinderGeometry args={[0.33, 0.38, 1.38, 12]} />
        <meshBasicMaterial color="#f0e2bd" />
      </mesh>
      <mesh position={[0, 1.69, 0]} castShadow={false}>
        <cylinderGeometry args={[0.32, 0.34, 0.12, 12]} />
        <meshBasicMaterial color="#fff1ca" />
      </mesh>
      {CHAPEL_CANDLE_DRIP_ANGLES.map((angle, index) => (
        <mesh key={`chapel-candle-drip-${index}`} position={[Math.cos(angle) * 0.3, 1.24 - index * 0.14, Math.sin(angle) * 0.3]} rotation={[0, angle, 0]} castShadow={false}>
          <boxGeometry args={[0.1, 0.44 + index * 0.08, 0.08]} />
          <meshBasicMaterial color="#fff3cf" />
        </mesh>
      ))}
      <mesh position={[0, 1.9, 0]} castShadow={false}>
        <cylinderGeometry args={[0.035, 0.045, 0.44, 5]} />
        <meshBasicMaterial color="#18110a" />
      </mesh>
      <mesh position={[0, 2.24, 0]} castShadow={false}>
        <coneGeometry args={[0.38, 0.92, 8]} />
        <meshBasicMaterial color="#ff9d1f" transparent opacity={0.94} />
      </mesh>
      <mesh position={[0, 2.32, 0]} castShadow={false}>
        <coneGeometry args={[0.18, 0.52, 8]} />
        <meshBasicMaterial color="#fff4a8" transparent opacity={0.96} />
      </mesh>
      <mesh position={[0, 2.28, 0]} castShadow={false}>
        <sphereGeometry args={[0.72, 10, 8]} />
        <meshBasicMaterial color="#ffb347" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      {light && <pointLight color="#ffd27a" intensity={4.4} distance={32} decay={2} position={[0, 2.22, 0]} />}
    </group>
  );
}

function ChapelChandelier({ z, light = false }: { z: number; light?: boolean }) {
  return (
    <group position={[0, 23.4, z]}>
      <mesh position={[0, 7.3, 0]} castShadow={false}>
        <cylinderGeometry args={[0.16, 0.16, 14.6, 5]} />
        <meshBasicMaterial color="#15110c" />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow={false}>
        <torusGeometry args={[6.2, 0.24, 6, 24]} />
        <meshBasicMaterial color="#24180c" />
      </mesh>
      {CHAPEL_CHANDELIER_CANDLE_POSITIONS.map(([x, y, zOffset], index) => (
        <Fragment key={`chapel-chandelier-candle-${index}`}>
          <mesh position={[x * 0.5, 0, zOffset * 0.5]} rotation={[0, 0, Math.atan2(zOffset, x)]} castShadow={false}>
            <boxGeometry args={[6.2, 0.16, 0.16]} />
            <meshBasicMaterial color="#2f1e0f" />
          </mesh>
          <ChapelCandle position={[x, y - 0.15, zOffset]} scale={0.86} light={false} />
        </Fragment>
      ))}
      <mesh position={[0, 0.9, 0]} castShadow={false}>
        <sphereGeometry args={[8.6, 14, 10]} />
        <meshBasicMaterial color="#ffbf5a" transparent opacity={0.14} depthWrite={false} />
      </mesh>
      {light && <pointLight color="#ffd27a" intensity={4.2} distance={58} decay={2} position={[0, 1.4, 0]} />}
    </group>
  );
}

export function getChapelInteriorSummary() {
  const pewSummary = getChapelPewSeatingSummary();
  return {
    ...pewSummary,
    altarGrainCount: CHAPEL_ALTAR_GRAIN_X.length,
    pulpitGrainCount: CHAPEL_PULPIT_GRAIN_X.length,
    interiorCandleCount: CHAPEL_INTERIOR_CANDLE_SPOTS.length,
    chandelierCount: 3,
    chandelierCandleCount: CHAPEL_CHANDELIER_CANDLE_POSITIONS.length,
  };
}

export function ChapelInterior({ showDetails }: { showDetails: boolean }) {
  return (
    <group name="graveyard-chapel-interior">
      <mesh position={[0, 1.02, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[CHAPEL_CENTER_HALF_WIDTH * 2 + 8, 0.18, CHAPEL_CENTER_HALF_DEPTH * 2 - 12]} />
        <meshBasicMaterial color="#242019" />
      </mesh>
      {CHAPEL_SIDE_SIGNS.map((side) => (
        <mesh key={`chapel-wing-floor-${side}`} position={[side * CHAPEL_SIDE_WING_CENTER_X, 1.02, 0]} castShadow={false} receiveShadow>
          <boxGeometry args={[CHAPEL_SIDE_WING_HALF_WIDTH * 2 + 6, 0.18, CHAPEL_SIDE_WING_HALF_DEPTH * 2 - 6]} />
          <meshBasicMaterial color="#211d17" />
        </mesh>
      ))}
      <ChapelCenterPews />
      <ChapelSideWingPews />
      <group position={[0, 1, -68]}>
        <mesh position={[0, 2.1, 0]} castShadow={false}>
          <boxGeometry args={[18, 3.2, 7.5]} />
          <meshBasicMaterial color="#5b351f" />
        </mesh>
        <mesh position={[0, 4, -0.2]} castShadow={false}>
          <boxGeometry args={[21, 1.2, 8.6]} />
          <meshBasicMaterial color="#7a4928" />
        </mesh>
        {CHAPEL_ALTAR_GRAIN_X.map((x, index) => (
          <mesh key={`chapel-altar-grain-${x}`} position={[x, 4.7, 4.18]} castShadow={false}>
            <boxGeometry args={[4.2, 0.22, 0.2]} />
            <meshBasicMaterial color={index % 2 === 0 ? "#b06d36" : "#2a170e"} transparent opacity={0.66} />
          </mesh>
        ))}
        <mesh position={[0, 5.15, 2.2]} rotation={[-0.28, 0, 0]} castShadow={false}>
          <boxGeometry args={[11.5, 0.7, 5.2]} />
          <meshBasicMaterial color="#3c2416" />
        </mesh>
      </group>
      <ChapelWallCross />
      <group position={[30, 1, -54]}>
        <mesh position={[0, 2.0, 0]} castShadow={false}>
          <boxGeometry args={[7.4, 4, 6.4]} />
          <meshBasicMaterial color="#4b2c1a" />
        </mesh>
        <mesh position={[0, 4.5, -0.6]} rotation={[-0.35, 0, 0]} castShadow={false}>
          <boxGeometry args={[8.2, 1, 5.6]} />
          <meshBasicMaterial color="#724526" />
        </mesh>
        {CHAPEL_PULPIT_GRAIN_X.map((x) => (
          <mesh key={`chapel-pulpit-grain-${x}`} position={[x, 4.96, 2.02]} castShadow={false}>
            <boxGeometry args={[1.6, 0.18, 0.18]} />
            <meshBasicMaterial color="#af7038" transparent opacity={0.64} />
          </mesh>
        ))}
        <mesh position={[0, 5.25, 1.9]} castShadow={false}>
          <boxGeometry args={[4.2, 0.42, 2.4]} />
          <meshBasicMaterial color="#d6c28a" />
        </mesh>
      </group>
      {showDetails && (
        <>
          <ChapelPewNpcs />
          <ChapelSideWingPewNpcs />
          <ChapelPopeAtPulpit />
          {CHAPEL_INTERIOR_CANDLE_SPOTS.map((position, index) => (
            <ChapelCandle key={`chapel-candle-${index}`} position={position} scale={index > 7 ? 1.28 : 1} light={false} />
          ))}
          <ChapelChandelier z={-48} />
          <ChapelChandelier z={0} light />
          <ChapelChandelier z={42} />
        </>
      )}
    </group>
  );
}
