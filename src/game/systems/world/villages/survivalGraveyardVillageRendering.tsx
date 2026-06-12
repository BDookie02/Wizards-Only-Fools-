import { Fragment, useEffect, useMemo } from "react";
import * as THREE from "three";
import { AvatarBillboard, NPC_AVATAR_SCALE } from "../../../PixelAvatar";
import { getCachedIndexRange } from "../../rendering/indexRange";
import { getSurvivalTerrainDetailTexture } from "../terrain/survivalTerrainTextures";
import { shouldRenderSurvivalChunkSkirt } from "../survival/survivalChunks";
import { useGraveyardLoadStage } from "../survival/survivalLoadStage";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { useSurvivalFeatureCount } from "../../../tools/qa/survivalFeatureCounters";
import { makeGraveyardLayout } from "./survivalGraveyardVillageLayout";
import {
  CHAPEL_NAVE_CEILING_BEAM_ROWS,
  CHAPEL_POPE_TARGET,
  CHAPEL_SIDE_SIGNS,
  CHAPEL_WING_CEILING_BEAMS,
} from "./survivalGraveyardChapelLayout";
import { CHAPEL_POPE_CHARACTER } from "./survivalGraveyardChapelCharacters";
import {
  ChapelCenterPews,
  ChapelPewNpcs,
  ChapelSideWingPewNpcs,
  ChapelSideWingPews,
} from "./survivalGraveyardChapelPews";
import {
  CHAPEL_ALTAR_GRAIN_X,
  CHAPEL_CANDLE_DRIP_ANGLES,
  CHAPEL_CENTER_HALF_DEPTH,
  CHAPEL_CENTER_HALF_WIDTH,
  CHAPEL_CENTRAL_BUTTRESS_Z,
  CHAPEL_CHANDELIER_CANDLE_POSITIONS,
  CHAPEL_DOOR_PANEL_PLANK_OFFSETS,
  CHAPEL_DOOR_STRAP_HEIGHT_OFFSETS,
  CHAPEL_EXIT_HALF_WIDTH,
  CHAPEL_EXIT_RAMP_DEFINITIONS,
  CHAPEL_EXIT_SHADOW_DEFINITIONS,
  CHAPEL_GARGOYLE_POSITIONS,
  CHAPEL_INTERIOR_CANDLE_SPOTS,
  CHAPEL_NAVE_WINDOW_Z,
  CHAPEL_OUTER_HALF_WIDTH,
  CHAPEL_PULPIT_GRAIN_X,
  CHAPEL_REAR_EXIT_CENTER_X,
  CHAPEL_REAR_EXIT_HALF_WIDTH,
  CHAPEL_SEATED_NPC_WALL_CLEARANCE,
  CHAPEL_SIDE_EXIT_HALF_WIDTH,
  CHAPEL_SIDE_WING_CENTER_X,
  CHAPEL_SIDE_WING_HALF_DEPTH,
  CHAPEL_SIDE_WING_HALF_WIDTH,
  CHAPEL_SIDE_WING_WINDOW_Z,
  CHAPEL_STAIR_RAMP_CENTER_TOP,
  CHAPEL_STAIR_RAMP_LENGTH,
  CHAPEL_STAIR_RAMP_LOW_TOP,
  CHAPEL_STAIR_RAMP_THICKNESS,
  CHAPEL_WALL_HEIGHT,
  CHAPEL_WATCH_TOWER_HEIGHT,
  CHAPEL_WATCH_TOWER_POSITIONS,
  CHAPEL_WATCH_TOWER_RADIUS,
  CHAPEL_WING_BUTTRESS_Z,
  getChapelWallSegments,
} from "./survivalGraveyardChapelStructure";
import { ChapelCrack, ChapelGiantGothicWindow, createChapelStoneBrickTexture } from "./survivalGraveyardChapelDetails";
import { GraveyardVillageColliders } from "./survivalGraveyardVillageColliders";
import { GraveyardPathStones, GraveyardSpikedFence } from "./survivalGraveyardVillageGroundProps";
import { GraveyardTombs } from "./survivalGraveyardVillageTombs";
import {
  getGraveyardVillageHeight,
  makeGraveyardVillageTerrainGeometry,
  makeGraveyardVillageTerrainSkirtGeometry,
  type SurvivalTerrainColorAtWorld,
  type SurvivalTerrainHeightForChunk,
  type SurvivalVillageBaseHeightForChunk,
} from "./survivalGraveyardVillageGeometry";

function ChapelEntranceStairs({
  axisDistance = CHAPEL_CENTER_HALF_DEPTH,
  width = 48,
  top = CHAPEL_STAIR_RAMP_CENTER_TOP,
  outset = 2,
}: {
  axisDistance?: number;
  width?: number;
  top?: number;
  outset?: number;
}) {
  const slope = Math.atan2(top - CHAPEL_STAIR_RAMP_LOW_TOP, CHAPEL_STAIR_RAMP_LENGTH);
  const halfThickness = CHAPEL_STAIR_RAMP_THICKNESS / 2;
  const midTop = (top + CHAPEL_STAIR_RAMP_LOW_TOP) / 2;
  const centerY = midTop - halfThickness * Math.cos(slope);
  const centerZ = axisDistance + outset + CHAPEL_STAIR_RAMP_LENGTH / 2 - 0.25;

  return (
    <group name="chapel-entry-smooth-ramp">
      <mesh position={[0, centerY, centerZ]} rotation={[slope, 0, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[width, CHAPEL_STAIR_RAMP_THICKNESS, CHAPEL_STAIR_RAMP_LENGTH]} />
        <meshBasicMaterial color="#3a3530" />
      </mesh>
      <mesh position={[0, CHAPEL_STAIR_RAMP_LOW_TOP * 0.5, centerZ + CHAPEL_STAIR_RAMP_LENGTH * 0.5 + 1.2]} castShadow={false} receiveShadow>
        <boxGeometry args={[width + 4, CHAPEL_STAIR_RAMP_LOW_TOP, 5.2]} />
        <meshBasicMaterial color="#302b26" />
      </mesh>
    </group>
  );
}

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

function ChapelInterior({ showDetails }: { showDetails: boolean }) {
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

function ChapelWatchTower({
  position,
  stoneMap,
  darkStoneMap,
}: {
  position: [number, number, number];
  stoneMap: THREE.Texture;
  darkStoneMap: THREE.Texture;
}) {
  return (
    <group name="chapel-corner-watch-tower" position={position}>
      <mesh castShadow={false} receiveShadow>
        <cylinderGeometry args={[CHAPEL_WATCH_TOWER_RADIUS, CHAPEL_WATCH_TOWER_RADIUS + 1.4, CHAPEL_WATCH_TOWER_HEIGHT, 8]} />
        <meshBasicMaterial map={stoneMap} />
      </mesh>
      <mesh position={[0, CHAPEL_WATCH_TOWER_HEIGHT * 0.5 + 1.65, 0]} castShadow={false} receiveShadow>
        <cylinderGeometry args={[CHAPEL_WATCH_TOWER_RADIUS + 2.2, CHAPEL_WATCH_TOWER_RADIUS + 2.2, 3.3, 8]} />
        <meshBasicMaterial map={darkStoneMap} />
      </mesh>
      {getCachedIndexRange(8).map((index) => {
        const angle = (index / 8) * Math.PI * 2;
        return (
          <mesh
            key={`chapel-watch-tower-crenel-${index}`}
            position={[
              Math.sin(angle) * (CHAPEL_WATCH_TOWER_RADIUS + 1.9),
              CHAPEL_WATCH_TOWER_HEIGHT * 0.5 + 5.4,
              Math.cos(angle) * (CHAPEL_WATCH_TOWER_RADIUS + 1.9),
            ]}
            rotation={[0, angle, 0]}
            castShadow={false}
            receiveShadow
          >
            <boxGeometry args={[3.1, 4.7, 2.4]} />
            <meshBasicMaterial map={darkStoneMap} />
          </mesh>
        );
      })}
      <mesh position={[0, CHAPEL_WATCH_TOWER_HEIGHT * 0.5 + 12, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={false}>
        <coneGeometry args={[CHAPEL_WATCH_TOWER_RADIUS + 1.2, 12.8, 4]} />
        <meshBasicMaterial color="#0d0a0f" />
      </mesh>
      {CHAPEL_SIDE_SIGNS.map((side) => (
        <Fragment key={`chapel-watch-tower-arrow-slit-${side}`}>
          <mesh position={[side * 5.2, 4.8, CHAPEL_WATCH_TOWER_RADIUS + 0.08]} castShadow={false}>
            <boxGeometry args={[1.2, 9.8, 0.22]} />
            <meshBasicMaterial color="#09070a" />
          </mesh>
          <mesh position={[CHAPEL_WATCH_TOWER_RADIUS + 0.08, 4.8, side * 5.2]} castShadow={false}>
            <boxGeometry args={[0.22, 9.8, 1.2]} />
            <meshBasicMaterial color="#09070a" />
          </mesh>
        </Fragment>
      ))}
    </group>
  );
}

function ChapelGargoyle({
  position,
  yaw,
  scale = 1,
}: {
  position: [number, number, number];
  yaw: number;
  scale?: number;
}) {
  return (
    <group name="chapel-roof-gargoyle" position={position} rotation={[0, yaw, 0]} scale={[scale, scale, scale]}>
      <mesh position={[0, 0.7, 0]} rotation={[-0.18, 0, 0]} castShadow={false}>
        <boxGeometry args={[2.3, 1.65, 3]} />
        <meshBasicMaterial color="#313039" />
      </mesh>
      <mesh position={[0, 1.72, 1.26]} castShadow={false}>
        <boxGeometry args={[1.55, 1.25, 1.45]} />
        <meshBasicMaterial color="#3c3a43" />
      </mesh>
      <mesh position={[0, 1.58, 2.1]} castShadow={false}>
        <boxGeometry args={[0.9, 0.55, 1]} />
        <meshBasicMaterial color="#232129" />
      </mesh>
      {CHAPEL_SIDE_SIGNS.map((side) => (
        <Fragment key={`chapel-gargoyle-side-${side}`}>
          <mesh position={[side * 1.38, 1.05, -0.24]} rotation={[0.18, 0, side * 0.72]} castShadow={false}>
            <boxGeometry args={[0.42, 2.5, 2.6]} />
            <meshBasicMaterial color="#27262e" />
          </mesh>
          <mesh position={[side * 0.54, 2.42, 1.45]} rotation={[0, 0, side * 0.58]} castShadow={false}>
            <coneGeometry args={[0.34, 1.15, 4]} />
            <meshBasicMaterial color="#191820" />
          </mesh>
          <mesh position={[side * 0.66, -0.16, 0.96]} rotation={[0.28, 0, side * 0.2]} castShadow={false}>
            <boxGeometry args={[0.52, 1.2, 0.5]} />
            <meshBasicMaterial color="#1f1e25" />
          </mesh>
        </Fragment>
      ))}
      <mesh position={[0, 0.38, -1.96]} rotation={[-0.55, 0, 0]} castShadow={false}>
        <coneGeometry args={[0.42, 2.4, 5]} />
        <meshBasicMaterial color="#24232b" />
      </mesh>
      <mesh position={[0, 2.04, 2.85]} rotation={[Math.PI / 2, 0, 0]} castShadow={false}>
        <coneGeometry args={[0.28, 1.5, 6]} />
        <meshBasicMaterial color="#18171d" />
      </mesh>
    </group>
  );
}

function ChapelDoorKnocker({ x = 0 }: { x?: number }) {
  return (
    <group position={[x, 1.4, 0.68]}>
      <mesh position={[0, 1.34, 0]} scale={[1.05, 0.82, 0.2]} castShadow={false}>
        <sphereGeometry args={[0.78, 12, 8]} />
        <meshBasicMaterial color="#a66f2f" />
      </mesh>
      <mesh position={[0, 1.36, 0.16]} scale={[0.58, 0.36, 0.16]} castShadow={false}>
        <sphereGeometry args={[0.7, 10, 6]} />
        <meshBasicMaterial color="#d19a45" />
      </mesh>
      <mesh position={[0, 0.9, 0.22]} scale={[0.5, 0.22, 0.12]} castShadow={false}>
        <sphereGeometry args={[0.62, 10, 6]} />
        <meshBasicMaterial color="#6b421e" />
      </mesh>
      {CHAPEL_SIDE_SIGNS.map((side) => (
        <Fragment key={`chapel-lion-knocker-ear-${side}`}>
          <mesh position={[side * 0.52, 1.88, 0.08]} rotation={[0, 0, side * 0.46]} castShadow={false}>
            <coneGeometry args={[0.24, 0.7, 4]} />
            <meshBasicMaterial color="#7e5228" />
          </mesh>
          <mesh position={[side * 0.22, 1.48, 0.34]} castShadow={false}>
            <boxGeometry args={[0.12, 0.12, 0.08]} />
            <meshBasicMaterial color="#1b1008" />
          </mesh>
        </Fragment>
      ))}
      <mesh position={[0, -0.36, 0.14]} rotation={[0, 0, Math.PI]} castShadow={false}>
        <torusGeometry args={[1.02, 0.12, 8, 18, Math.PI]} />
        <meshBasicMaterial color="#c68a35" />
      </mesh>
      <mesh position={[0, 0.2, 0.17]} castShadow={false}>
        <boxGeometry args={[0.42, 0.34, 0.16]} />
        <meshBasicMaterial color="#7a4b21" />
      </mesh>
    </group>
  );
}

function ChapelDoubleDoor({
  position,
  yaw,
  width,
  height = 22,
}: {
  position: [number, number, number];
  yaw: number;
  width: number;
  height?: number;
}) {
  const panelWidth = width * 0.48;
  const panelHeight = height;
  const hingeInset = panelWidth * 0.5;

  return (
    <group name="chapel-open-double-door" position={position} rotation={[0, yaw, 0]}>
      {CHAPEL_SIDE_SIGNS.map((side) => (
        <group
          key={`chapel-door-panel-${side}`}
          position={[side * (width * 0.5 - 0.7), 1.2 + panelHeight * 0.5, 0.65]}
          rotation={[0, side * -0.44, 0]}
        >
          <mesh position={[side * -hingeInset * 0.45, 0, 0]} castShadow={false} receiveShadow>
            <boxGeometry args={[panelWidth, panelHeight, 1.05]} />
            <meshBasicMaterial color="#5b351f" />
          </mesh>
          {CHAPEL_DOOR_PANEL_PLANK_OFFSETS.map((offset) => (
            <mesh key={`chapel-door-plank-${offset}`} position={[side * (-hingeInset * 0.45 + offset * panelWidth), 0, 0.58]} castShadow={false}>
              <boxGeometry args={[0.28, panelHeight - 1.8, 0.18]} />
              <meshBasicMaterial color="#7a4928" transparent opacity={0.76} />
            </mesh>
          ))}
          {CHAPEL_DOOR_STRAP_HEIGHT_OFFSETS.map((yOffset) => (
            <mesh key={`chapel-door-strap-${yOffset}`} position={[side * -hingeInset * 0.45, yOffset * panelHeight, 0.7]} castShadow={false}>
              <boxGeometry args={[panelWidth - 1.5, 0.52, 0.24]} />
              <meshBasicMaterial color="#1c1410" />
            </mesh>
          ))}
          <mesh position={[side * -hingeInset * 0.9, 0, 0.78]} castShadow={false}>
            <boxGeometry args={[0.5, panelHeight + 1.2, 0.34]} />
            <meshBasicMaterial color="#24150d" />
          </mesh>
          <ChapelDoorKnocker x={side * -hingeInset * 0.42} />
        </group>
      ))}
    </group>
  );
}

function ChapelCeiling({ darkStoneMap }: { darkStoneMap: THREE.Texture }) {
  return (
    <group name="chapel-roof-and-ceiling-fill">
      <mesh position={[0, CHAPEL_WALL_HEIGHT + 0.6, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[CHAPEL_CENTER_HALF_WIDTH * 2 - 5, 2.4, CHAPEL_CENTER_HALF_DEPTH * 2 - 6]} />
        <meshBasicMaterial map={darkStoneMap} side={THREE.DoubleSide} />
      </mesh>
      {CHAPEL_SIDE_SIGNS.map((side) => (
        <mesh key={`chapel-wing-ceiling-${side}`} position={[side * CHAPEL_SIDE_WING_CENTER_X, CHAPEL_WALL_HEIGHT + 0.3, 0]} castShadow={false} receiveShadow>
          <boxGeometry args={[CHAPEL_SIDE_WING_HALF_WIDTH * 2 - 4, 2.1, CHAPEL_SIDE_WING_HALF_DEPTH * 2 - 5]} />
          <meshBasicMaterial map={darkStoneMap} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {CHAPEL_NAVE_CEILING_BEAM_ROWS.map((z, index) => (
        <mesh key={`chapel-nave-ceiling-beam-${z}`} position={[0, CHAPEL_WALL_HEIGHT - 1.15, z]} castShadow={false}>
          <boxGeometry args={[CHAPEL_CENTER_HALF_WIDTH * 2 - 8, 2.1, 1.8]} />
          <meshBasicMaterial color={index % 2 === 0 ? "#171017" : "#241821"} />
        </mesh>
      ))}
      {CHAPEL_WING_CEILING_BEAMS.map((beam) => (
        <mesh key={beam.key} position={[beam.side * CHAPEL_SIDE_WING_CENTER_X, CHAPEL_WALL_HEIGHT - 1.35, beam.z]} castShadow={false}>
          <boxGeometry args={[CHAPEL_SIDE_WING_HALF_WIDTH * 2 - 8, 1.7, 1.55]} />
          <meshBasicMaterial color={beam.color} />
        </mesh>
      ))}
      <mesh position={[0, CHAPEL_WALL_HEIGHT - 0.2, 0]} castShadow={false}>
        <boxGeometry args={[3.4, 3, CHAPEL_CENTER_HALF_DEPTH * 2 - 10]} />
        <meshBasicMaterial color="#100b10" />
      </mesh>
      <mesh position={[0, CHAPEL_WALL_HEIGHT - 0.35, 0]} castShadow={false}>
        <boxGeometry args={[CHAPEL_OUTER_HALF_WIDTH * 2 - 18, 2.6, 3.2]} />
        <meshBasicMaterial color="#100b10" />
      </mesh>
    </group>
  );
}

function GraveyardCatholicChapel({ baseHeight, showDetails }: { baseHeight: number; showDetails: boolean }) {
  const roof = "#171319";
  const chapelStoneTexture = useMemo(
    () => createChapelStoneBrickTexture({
      base: "#46454d",
      mid: "#535159",
      light: "#5d5a63",
      mortar: "#1b1a20",
      highlight: "#8d8780",
      shadow: "#2b2a30",
      chip: "#706b67",
      repeatX: 3,
      repeatY: 2,
    }),
    [],
  );
  const chapelDarkStoneTexture = useMemo(
    () => createChapelStoneBrickTexture({
      base: "#292830",
      mid: "#33323a",
      light: "#3b3942",
      mortar: "#0f0e13",
      highlight: "#625e5a",
      shadow: "#16151b",
      chip: "#4a4744",
      repeatX: 2,
      repeatY: 3,
    }),
    [],
  );
  useEffect(() => () => {
    chapelStoneTexture.dispose();
    chapelDarkStoneTexture.dispose();
  }, [chapelDarkStoneTexture, chapelStoneTexture]);

  return (
    <group name="giant-catholic-chapel" position={[0, baseHeight, 0]}>
      <mesh position={[0, 0.48, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[CHAPEL_CENTER_HALF_WIDTH * 2 + 10, 0.96, CHAPEL_CENTER_HALF_DEPTH * 2 + 8]} />
        <meshBasicMaterial color="#17141a" />
      </mesh>
      {CHAPEL_SIDE_SIGNS.map((side) => (
        <mesh key={`chapel-wing-foundation-${side}`} position={[side * CHAPEL_SIDE_WING_CENTER_X, 0.44, 0]} castShadow={false} receiveShadow>
          <boxGeometry args={[CHAPEL_SIDE_WING_HALF_WIDTH * 2 + 10, 0.88, CHAPEL_SIDE_WING_HALF_DEPTH * 2 + 8]} />
          <meshBasicMaterial color="#161319" />
        </mesh>
      ))}
      <ChapelInterior showDetails={showDetails} />
      {getChapelWallSegments().map((wall) => (
        <mesh key={`chapel-wall-${wall.key}`} position={wall.position} castShadow={false} receiveShadow>
          <boxGeometry args={wall.size} />
          <meshBasicMaterial map={chapelStoneTexture} />
        </mesh>
      ))}
      <ChapelCeiling darkStoneMap={chapelDarkStoneTexture} />
      <mesh position={[0, 39.2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={false}>
        <coneGeometry args={[82, 23, 4]} />
        <meshBasicMaterial color={roof} side={THREE.DoubleSide} />
      </mesh>
      {CHAPEL_SIDE_SIGNS.map((side) => (
        <mesh key={`chapel-wing-roof-${side}`} position={[side * CHAPEL_SIDE_WING_CENTER_X, 31.8, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={false}>
          <coneGeometry args={[49, 16, 4]} />
          <meshBasicMaterial color="#141016" side={THREE.DoubleSide} />
        </mesh>
      ))}
      {CHAPEL_WATCH_TOWER_POSITIONS.map((position, index) => (
        <ChapelWatchTower
          key={`chapel-corner-watch-tower-${index}`}
          position={position}
          stoneMap={chapelStoneTexture}
          darkStoneMap={chapelDarkStoneTexture}
        />
      ))}
      {CHAPEL_SIDE_SIGNS.map((side) => (
        <Fragment key={`chapel-tower-side-${side}`}>
          <mesh position={[side * 17.3, 33.2, CHAPEL_CENTER_HALF_DEPTH - 20]} castShadow={false} receiveShadow>
            <boxGeometry args={[2.6, 66.4, 42]} />
            <meshBasicMaterial map={chapelDarkStoneTexture} />
          </mesh>
          <mesh position={[side * 13.7, 33.2, CHAPEL_CENTER_HALF_DEPTH - 3.5]} castShadow={false} receiveShadow>
            <boxGeometry args={[5.4, 66.4, 2.6]} />
            <meshBasicMaterial map={chapelDarkStoneTexture} />
          </mesh>
        </Fragment>
      ))}
      <mesh position={[0, 46.4, CHAPEL_CENTER_HALF_DEPTH - 3.5]} castShadow={false} receiveShadow>
        <boxGeometry args={[22, 40, 2.6]} />
        <meshBasicMaterial map={chapelDarkStoneTexture} />
      </mesh>
      {CHAPEL_SIDE_SIGNS.map((side) => (
        <mesh key={`chapel-tower-rear-pier-${side}`} position={[side * 13.7, 33.2, CHAPEL_CENTER_HALF_DEPTH - 40.5]} castShadow={false} receiveShadow>
          <boxGeometry args={[5.4, 66.4, 2.4]} />
          <meshBasicMaterial map={chapelDarkStoneTexture} />
        </mesh>
      ))}
      <mesh position={[0, 46.4, CHAPEL_CENTER_HALF_DEPTH - 40.5]} castShadow={false} receiveShadow>
        <boxGeometry args={[22, 40, 2.4]} />
        <meshBasicMaterial map={chapelDarkStoneTexture} />
      </mesh>
      <mesh position={[0, 72.5, CHAPEL_CENTER_HALF_DEPTH - 20]} rotation={[0, Math.PI / 4, 0]} castShadow={false}>
        <coneGeometry args={[22, 34, 4]} />
        <meshBasicMaterial color="#0e0b10" />
      </mesh>
      <mesh position={[0, 96.2, CHAPEL_CENTER_HALF_DEPTH - 20]} castShadow={false}>
        <boxGeometry args={[2.4, 22, 2.4]} />
        <meshBasicMaterial color="#050505" />
      </mesh>
      <mesh position={[0, 100.8, CHAPEL_CENTER_HALF_DEPTH - 20]} castShadow={false}>
        <boxGeometry args={[13.5, 2.4, 2.4]} />
        <meshBasicMaterial color="#050505" />
      </mesh>
      {CHAPEL_EXIT_SHADOW_DEFINITIONS.map((door) => (
        <mesh key={`chapel-exit-shadow-${door.key}`} position={door.position} rotation={door.rotation} castShadow={false} renderOrder={2}>
          <boxGeometry args={door.size} />
          <meshBasicMaterial color="#050403" transparent opacity={0.16} depthWrite={false} />
        </mesh>
      ))}
      <ChapelDoubleDoor
        position={[0, 0, CHAPEL_CENTER_HALF_DEPTH + 1.35]}
        yaw={0}
        width={CHAPEL_EXIT_HALF_WIDTH * 2 + 2}
        height={23}
      />
      <ChapelDoubleDoor
        position={[-CHAPEL_REAR_EXIT_CENTER_X, 0, -(CHAPEL_CENTER_HALF_DEPTH + 1.35)]}
        yaw={Math.PI}
        width={CHAPEL_REAR_EXIT_HALF_WIDTH * 2 + 2}
        height={21}
      />
      <ChapelDoubleDoor
        position={[CHAPEL_REAR_EXIT_CENTER_X, 0, -(CHAPEL_CENTER_HALF_DEPTH + 1.35)]}
        yaw={Math.PI}
        width={CHAPEL_REAR_EXIT_HALF_WIDTH * 2 + 2}
        height={21}
      />
      <ChapelDoubleDoor
        position={[CHAPEL_OUTER_HALF_WIDTH + 1.35, 0, 0]}
        yaw={Math.PI / 2}
        width={CHAPEL_SIDE_EXIT_HALF_WIDTH * 2 + 1}
        height={21}
      />
      <ChapelDoubleDoor
        position={[-(CHAPEL_OUTER_HALF_WIDTH + 1.35), 0, 0]}
        yaw={-Math.PI / 2}
        width={CHAPEL_SIDE_EXIT_HALF_WIDTH * 2 + 1}
        height={21}
      />
      {CHAPEL_EXIT_RAMP_DEFINITIONS.map((exit) => (
        <group key={`chapel-entry-ramp-${exit.key}`} position={exit.position} rotation={[0, exit.rotation, 0]}>
          <ChapelEntranceStairs axisDistance={exit.distance} width={exit.width} top={exit.top} outset={exit.outset} />
        </group>
      ))}
      <ChapelGiantGothicWindow position={[0, 42.2, CHAPEL_CENTER_HALF_DEPTH + 1.55]} scale={1.2} variant={0} />
      {CHAPEL_SIDE_SIGNS.map((side) => (
        <ChapelGiantGothicWindow
          key={`chapel-front-giant-window-${side}`}
          position={[side * 35.5, 23.4, CHAPEL_CENTER_HALF_DEPTH + 1.5]}
          scale={0.74}
          variant={side > 0 ? 1 : 2}
        />
      ))}
      <mesh position={[0, 54.8, CHAPEL_CENTER_HALF_DEPTH + 1.36]} castShadow={false}>
        <circleGeometry args={[7.4, 16]} />
        <meshBasicMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0, 54.8, CHAPEL_CENTER_HALF_DEPTH + 1.18]} castShadow={false}>
        <circleGeometry args={[5.6, 16]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.84} />
      </mesh>
      <mesh position={[0, 54.8, CHAPEL_CENTER_HALF_DEPTH + 0.94]} castShadow={false}>
        <boxGeometry args={[10.2, 0.62, 0.14]} />
        <meshBasicMaterial color="#fde68a" />
      </mesh>
      <mesh position={[0, 54.8, CHAPEL_CENTER_HALF_DEPTH + 0.9]} castShadow={false}>
        <boxGeometry args={[0.62, 10.2, 0.14]} />
        <meshBasicMaterial color="#fde68a" />
      </mesh>
      <ChapelGiantGothicWindow position={[0, 25.8, -(CHAPEL_CENTER_HALF_DEPTH + 1.5)]} rotation={[0, Math.PI, 0]} scale={1.05} variant={2} />
      {CHAPEL_SIDE_SIGNS.map((side) => (
        <Fragment key={`chapel-side-${side}`}>
          {CHAPEL_SIDE_WING_WINDOW_Z.map((z, index) => (
            <ChapelGiantGothicWindow
              key={`chapel-wing-giant-window-${side}-${index}`}
              position={[side * (CHAPEL_OUTER_HALF_WIDTH + 1.55), 24.2, z]}
              rotation={[0, side * Math.PI / 2, 0]}
              scale={0.98}
              variant={index + (side > 0 ? 1 : 0)}
            />
          ))}
          {CHAPEL_NAVE_WINDOW_Z.map((z, index) => (
            <ChapelGiantGothicWindow
              key={`chapel-nave-giant-window-${side}-${index}`}
              position={[side * (CHAPEL_CENTER_HALF_WIDTH + 1.48), 24.6, z]}
              rotation={[0, side * Math.PI / 2, 0]}
              scale={0.9}
              variant={index + 2}
            />
          ))}
          {CHAPEL_WING_BUTTRESS_Z.map((z) => (
            <mesh key={`chapel-wing-buttress-${side}-${z}`} position={[side * (CHAPEL_OUTER_HALF_WIDTH + 4), 12.8, z]} castShadow={false}>
              <boxGeometry args={[4.2, 25.6, 6.2]} />
              <meshBasicMaterial map={chapelDarkStoneTexture} />
            </mesh>
          ))}
          {CHAPEL_CENTRAL_BUTTRESS_Z.map((z) => (
            <mesh key={`chapel-central-buttress-${side}-${z}`} position={[side * (CHAPEL_CENTER_HALF_WIDTH + 4), 12.8, z]} castShadow={false}>
              <boxGeometry args={[4.2, 25.6, 6.2]} />
              <meshBasicMaterial map={chapelDarkStoneTexture} />
            </mesh>
          ))}
        </Fragment>
      ))}
      {showDetails && (
        <>
          {CHAPEL_GARGOYLE_POSITIONS.map((gargoyle) => (
            <ChapelGargoyle
              key={`chapel-gargoyle-${gargoyle.key}`}
              position={gargoyle.position}
              yaw={gargoyle.yaw}
              scale={gargoyle.scale}
            />
          ))}
          <ChapelCrack position={[-32, 24, CHAPEL_CENTER_HALF_DEPTH - 3.8]} scale={1.12} />
          <ChapelCrack position={[28, 18, CHAPEL_CENTER_HALF_DEPTH + 1.92]} scale={0.86} />
          <pointLight color="#f8d477" intensity={2.6} distance={52} decay={2} position={[0, 18, CHAPEL_CENTER_HALF_DEPTH - 4]} />
          <pointLight color="#f9cf71" intensity={2.4} distance={64} decay={2} position={[0, 18, -36]} />
        </>
      )}
    </group>
  );
}

export function SurvivalGraveyardVillage({
  chunk,
  terrainHeightForChunk,
  terrainColorAtWorld,
  villageBaseHeightForChunk,
}: {
  chunk: SurvivalChunkInfo;
  terrainHeightForChunk: SurvivalTerrainHeightForChunk;
  terrainColorAtWorld: SurvivalTerrainColorAtWorld;
  villageBaseHeightForChunk: SurvivalVillageBaseHeightForChunk;
}) {
  const graveyardLoadStage = useGraveyardLoadStage(chunk);
  const baseHeight = useMemo(() => villageBaseHeightForChunk(chunk), [chunk, villageBaseHeightForChunk]);
  const terrainGeometry = useMemo(
    () => makeGraveyardVillageTerrainGeometry(chunk, terrainHeightForChunk, terrainColorAtWorld, villageBaseHeightForChunk),
    [chunk, terrainColorAtWorld, terrainHeightForChunk, villageBaseHeightForChunk],
  );
  const hasTerrainSkirt = shouldRenderSurvivalChunkSkirt(chunk);
  const terrainSkirtGeometry = useMemo(
    () => hasTerrainSkirt
      ? makeGraveyardVillageTerrainSkirtGeometry(chunk, terrainHeightForChunk, terrainColorAtWorld, villageBaseHeightForChunk)
      : null,
    [chunk, hasTerrainSkirt, terrainColorAtWorld, terrainHeightForChunk, villageBaseHeightForChunk],
  );
  const terrainDetailTexture = useMemo(() => getSurvivalTerrainDetailTexture(), []);
  const showNearDetails = chunk.distance === 0;
  const showPathStones = showNearDetails && graveyardLoadStage >= 1;
  const showFenceDetails = showNearDetails && graveyardLoadStage >= 2;
  const showTombDetails = showNearDetails && graveyardLoadStage >= 3;
  const showChapelDetails = showNearDetails && graveyardLoadStage >= 4;
  const showChapelShell = !showNearDetails || graveyardLoadStage >= 2;
  const layout = useMemo(
    () => makeGraveyardLayout(
      chunk,
      baseHeight,
      showPathStones,
      (localX, localZ) => getGraveyardVillageHeight(chunk, localX, localZ, terrainHeightForChunk, baseHeight),
    ),
    [chunk, baseHeight, showPathStones, terrainHeightForChunk],
  );

  useSurvivalFeatureCount("graveyardTombs", chunk.key, showTombDetails ? layout.tombs.length : Math.ceil(layout.tombs.length / 4));
  useSurvivalFeatureCount("graveyardFenceSegments", chunk.key, layout.fenceSegments.length);
  useSurvivalFeatureCount("graveyardPathStones", chunk.key, showPathStones ? layout.pathStones.length : 0);

  return (
    <>
      <GraveyardVillageColliders chunk={chunk} baseHeight={baseHeight} groundGeometry={terrainGeometry} fenceSegments={layout.fenceSegments} />
      <group name={`survival-graveyard-village-${chunk.key}`} position={[chunk.x, 0, chunk.z]}>
        {terrainSkirtGeometry && (
          <mesh geometry={terrainSkirtGeometry} dispose={null}>
            <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
          </mesh>
        )}
        <mesh geometry={terrainGeometry} dispose={null} receiveShadow={showNearDetails}>
          <meshStandardMaterial vertexColors map={terrainDetailTexture} roughness={1} metalness={0} />
        </mesh>
        <GraveyardPathStones stones={layout.pathStones} showDetails={showPathStones} />
        <GraveyardSpikedFence segments={layout.fenceSegments} showDetails={showFenceDetails} />
        <GraveyardTombs tombs={layout.tombs} showDetails={showTombDetails} />
        {showChapelShell && <GraveyardCatholicChapel baseHeight={baseHeight} showDetails={showChapelDetails} />}
      </group>
    </>
  );
}

