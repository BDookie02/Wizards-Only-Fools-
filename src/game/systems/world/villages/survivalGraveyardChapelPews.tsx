import { Fragment } from "react";
import * as THREE from "three";
import { AvatarWorldFacingPlane, NPC_AVATAR_GROUND_LIFT, NPC_AVATAR_SCALE } from "../../../PixelAvatar";
import {
  CHAPEL_CENTER_NPC_SEAT_OFFSETS,
  CHAPEL_CENTER_PEW_ROWS,
  CHAPEL_CENTER_PEW_X,
  CHAPEL_POPE_TARGET,
  CHAPEL_SIDE_NPC_SEAT_OFFSETS,
  CHAPEL_SIDE_SIGNS,
  CHAPEL_SIDE_WING_PEW_LAYOUT,
  getAvatarYawFacingTarget,
  getChapelSideWingPewLayout,
  getYawForPewFacingTarget,
} from "./survivalGraveyardChapelLayout";
import {
  CHAPEL_NPC_CHARACTERS,
  type ChapelCharacterCustomization,
} from "./survivalGraveyardChapelCharacters";
import {
  CHAPEL_CENTER_HALF_DEPTH,
  CHAPEL_CENTER_HALF_WIDTH,
  CHAPEL_OUTER_HALF_WIDTH,
  CHAPEL_SEATED_NPC_WALL_CLEARANCE,
  CHAPEL_SIDE_WING_HALF_DEPTH,
} from "./survivalGraveyardChapelStructure";

const CHAPEL_PEW_SEAT_GRAIN_X = [-5.6, 0, 5.6] as const;
const CHAPEL_PEW_BACK_GRAIN_X = [-6.5, 0, 6.5] as const;
const CHAPEL_PEW_LEG_X = [-7.2, 7.2] as const;
const CHAPEL_DIAGONAL_PEW_PLANK_OFFSETS = [-0.28, 0.28] as const;
const CHAPEL_DIAGONAL_PEW_BACK_OFFSETS = [-0.38, 0, 0.38] as const;
const CHAPEL_DIAGONAL_PEW_LEG_OFFSETS = [-0.42, 0.42] as const;

type ChapelNpcPlacement = {
  key: string;
  position: [number, number, number];
  yaw: number;
  character: ChapelCharacterCustomization;
};

const CHAPEL_CENTER_NPC_SEAT_Y = 2.98 + NPC_AVATAR_GROUND_LIFT;
const CHAPEL_SIDE_WING_NPC_SEAT_Y = 2.78 + NPC_AVATAR_GROUND_LIFT;

function ChapelPew({ z, side }: { z: number; side: -1 | 1 }) {
  const x = side * CHAPEL_CENTER_PEW_X;
  return (
    <group position={[x, 0.96, z]}>
      <mesh position={[0, 1.15, 0]} castShadow={false}>
        <boxGeometry args={[18, 1.2, 3.8]} />
        <meshBasicMaterial color="#5a321c" />
      </mesh>
      {CHAPEL_PEW_SEAT_GRAIN_X.map((grainX, index) => (
        <mesh key={`chapel-pew-seat-grain-${grainX}`} position={[grainX, 1.78, 0.2 - index * 0.28]} castShadow={false}>
          <boxGeometry args={[3.7, 0.12, 0.18]} />
          <meshBasicMaterial color={index % 2 === 0 ? "#9a6132" : "#2b160b"} transparent opacity={0.68} />
        </mesh>
      ))}
      <mesh position={[0, 2.32, 1.35]} rotation={[-0.14, 0, 0]} castShadow={false}>
        <boxGeometry args={[18.4, 2.05, 0.9]} />
        <meshBasicMaterial color="#3a2115" />
      </mesh>
      {CHAPEL_PEW_BACK_GRAIN_X.map((grainX) => (
        <mesh key={`chapel-pew-back-grain-${grainX}`} position={[grainX, 2.64, 1.95]} rotation={[-0.14, 0, 0]} castShadow={false}>
          <boxGeometry args={[4.2, 0.18, 0.16]} />
          <meshBasicMaterial color="#8d552c" transparent opacity={0.58} />
        </mesh>
      ))}
      {CHAPEL_PEW_LEG_X.map((legX) => (
        <Fragment key={`pew-leg-${legX}`}>
          <mesh position={[legX, 0.55, -1.1]} castShadow={false}>
            <boxGeometry args={[0.78, 1.1, 0.78]} />
            <meshBasicMaterial color="#2a160d" />
          </mesh>
          <mesh position={[legX, 0.55, 1.1]} castShadow={false}>
            <boxGeometry args={[0.78, 1.1, 0.78]} />
            <meshBasicMaterial color="#2a160d" />
          </mesh>
        </Fragment>
      ))}
    </group>
  );
}

function ChapelDiagonalPew({
  position,
  yaw,
  width = 20,
}: {
  position: [number, number, number];
  yaw: number;
  width?: number;
}) {
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <mesh position={[0, 1.08, 0]} castShadow={false}>
        <boxGeometry args={[width, 1.08, 3.5]} />
        <meshBasicMaterial color="#5a321c" />
      </mesh>
      <mesh position={[0, 2.12, 1.22]} rotation={[-0.14, 0, 0]} castShadow={false}>
        <boxGeometry args={[width + 0.5, 1.8, 0.78]} />
        <meshBasicMaterial color="#321d12" />
      </mesh>
      {CHAPEL_DIAGONAL_PEW_PLANK_OFFSETS.map((offset, index) => (
        <mesh key={`chapel-diagonal-pew-plank-${offset}`} position={[0, 1.62, offset]} castShadow={false}>
          <boxGeometry args={[width - 1.7, 0.11, 0.16]} />
          <meshBasicMaterial color={index % 2 === 0 ? "#9a6132" : "#2b160b"} transparent opacity={0.62} />
        </mesh>
      ))}
      {CHAPEL_DIAGONAL_PEW_BACK_OFFSETS.map((offset) => (
        <mesh key={`chapel-diagonal-pew-back-grain-${offset}`} position={[offset * width, 2.44, 1.74]} rotation={[-0.14, 0, 0]} castShadow={false}>
          <boxGeometry args={[width * 0.22, 0.15, 0.14]} />
          <meshBasicMaterial color="#8d552c" transparent opacity={0.56} />
        </mesh>
      ))}
      {CHAPEL_DIAGONAL_PEW_LEG_OFFSETS.map((offset) => (
        <Fragment key={`chapel-diagonal-pew-leg-${offset}`}>
          <mesh position={[offset * width, 0.48, -0.95]} castShadow={false}>
            <boxGeometry args={[0.7, 0.96, 0.7]} />
            <meshBasicMaterial color="#2a160d" />
          </mesh>
          <mesh position={[offset * width, 0.48, 0.95]} castShadow={false}>
            <boxGeometry args={[0.7, 0.96, 0.7]} />
            <meshBasicMaterial color="#2a160d" />
          </mesh>
        </Fragment>
      ))}
    </group>
  );
}

function getRotatedChapelSeatPosition(x: number, z: number, localX: number, localZ: number, yaw: number): [number, number] {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return [
    x + localX * cos + localZ * sin,
    z - localX * sin + localZ * cos,
  ];
}

function clampChapelNpcSeatPosition(x: number, z: number): [number, number] {
  if (Math.abs(x) > CHAPEL_CENTER_HALF_WIDTH) {
    const side = x < 0 ? -1 : 1;
    const safeAbsX = THREE.MathUtils.clamp(
      Math.abs(x),
      CHAPEL_CENTER_HALF_WIDTH + CHAPEL_SEATED_NPC_WALL_CLEARANCE,
      CHAPEL_OUTER_HALF_WIDTH - CHAPEL_SEATED_NPC_WALL_CLEARANCE,
    );
    return [
      side * safeAbsX,
      THREE.MathUtils.clamp(
        z,
        -CHAPEL_SIDE_WING_HALF_DEPTH + CHAPEL_SEATED_NPC_WALL_CLEARANCE,
        CHAPEL_SIDE_WING_HALF_DEPTH - CHAPEL_SEATED_NPC_WALL_CLEARANCE,
      ),
    ];
  }

  return [
    THREE.MathUtils.clamp(
      x,
      -CHAPEL_CENTER_HALF_WIDTH + CHAPEL_SEATED_NPC_WALL_CLEARANCE,
      CHAPEL_CENTER_HALF_WIDTH - CHAPEL_SEATED_NPC_WALL_CLEARANCE,
    ),
    THREE.MathUtils.clamp(
      z,
      -CHAPEL_CENTER_HALF_DEPTH + CHAPEL_SEATED_NPC_WALL_CLEARANCE,
      CHAPEL_CENTER_HALF_DEPTH - CHAPEL_SEATED_NPC_WALL_CLEARANCE,
    ),
  ];
}

function buildChapelCenterNpcPlacements(): ChapelNpcPlacement[] {
  const placements: ChapelNpcPlacement[] = [];
  for (let rowIndex = 0; rowIndex < CHAPEL_CENTER_PEW_ROWS.length; rowIndex += 1) {
    const z = CHAPEL_CENTER_PEW_ROWS[rowIndex];
    for (let sideIndex = 0; sideIndex < CHAPEL_SIDE_SIGNS.length; sideIndex += 1) {
      const side = CHAPEL_SIDE_SIGNS[sideIndex];
      for (let seatIndex = 0; seatIndex < CHAPEL_CENTER_NPC_SEAT_OFFSETS.length; seatIndex += 1) {
        const seat = CHAPEL_CENTER_NPC_SEAT_OFFSETS[seatIndex];
        const [seatX, seatZ] = clampChapelNpcSeatPosition(side * seat.x, z + seat.z);
        placements.push({
          key: `chapel-pew-npc-${rowIndex}-${side}-${seatIndex}`,
          position: [seatX, CHAPEL_CENTER_NPC_SEAT_Y, seatZ],
          yaw: getAvatarYawFacingTarget(seatX, seatZ, CHAPEL_POPE_TARGET.x, CHAPEL_POPE_TARGET.z),
          character: CHAPEL_NPC_CHARACTERS[(rowIndex * 4 + (side > 0 ? 2 : 0) + seatIndex) % CHAPEL_NPC_CHARACTERS.length],
        });
      }
    }
  }
  return placements;
}

function buildChapelSideWingNpcPlacements(): ChapelNpcPlacement[] {
  const placements: ChapelNpcPlacement[] = [];
  for (let pewIndex = 0; pewIndex < CHAPEL_SIDE_WING_PEW_LAYOUT.length; pewIndex += 1) {
    const pew = CHAPEL_SIDE_WING_PEW_LAYOUT[pewIndex];
    const yaw = getYawForPewFacingTarget(pew.x, pew.z, CHAPEL_POPE_TARGET.x, CHAPEL_POPE_TARGET.z);
    for (let seatIndex = 0; seatIndex < CHAPEL_SIDE_NPC_SEAT_OFFSETS.length; seatIndex += 1) {
      const offset = CHAPEL_SIDE_NPC_SEAT_OFFSETS[seatIndex];
      const [rawSeatX, rawSeatZ] = getRotatedChapelSeatPosition(pew.x, pew.z, offset * pew.width, -0.42, yaw);
      const [seatX, seatZ] = clampChapelNpcSeatPosition(rawSeatX, rawSeatZ);
      placements.push({
        key: `chapel-side-pew-npc-${pew.key}-${seatIndex}`,
        position: [seatX, CHAPEL_SIDE_WING_NPC_SEAT_Y, seatZ],
        yaw: getAvatarYawFacingTarget(seatX, seatZ, CHAPEL_POPE_TARGET.x, CHAPEL_POPE_TARGET.z),
        character: CHAPEL_NPC_CHARACTERS[(pewIndex * 3 + seatIndex + 7) % CHAPEL_NPC_CHARACTERS.length],
      });
    }
  }
  return placements;
}

const CHAPEL_CENTER_NPC_PLACEMENTS = buildChapelCenterNpcPlacements();
const CHAPEL_SIDE_WING_NPC_PLACEMENTS = buildChapelSideWingNpcPlacements();

function ChapelSeatedNpc({
  position,
  yaw,
  character,
}: {
  position: [number, number, number];
  yaw: number;
  character: ChapelCharacterCustomization;
}) {
  return (
    <group position={position} scale={[NPC_AVATAR_SCALE, NPC_AVATAR_SCALE, NPC_AVATAR_SCALE]} name="chapel-pew-npc">
      <AvatarWorldFacingPlane character={character} animation="idle" yaw={yaw} health={100} />
    </group>
  );
}

export function getChapelPewSeatingSummary() {
  return {
    centerPewRows: CHAPEL_CENTER_PEW_ROWS.length,
    centerPewCount: CHAPEL_CENTER_PEW_ROWS.length * CHAPEL_SIDE_SIGNS.length,
    sideWingPewCount: getChapelSideWingPewLayout().length,
    centerNpcCount: CHAPEL_CENTER_NPC_PLACEMENTS.length,
    sideWingNpcCount: CHAPEL_SIDE_WING_NPC_PLACEMENTS.length,
  };
}

export function ChapelCenterPews() {
  return (
    <>
      {CHAPEL_CENTER_PEW_ROWS.map((z) => (
        <Fragment key={`chapel-pews-${z}`}>
          <ChapelPew side={-1} z={z} />
          <ChapelPew side={1} z={z} />
        </Fragment>
      ))}
    </>
  );
}

export function ChapelSideWingPews() {
  const sideWingPews = getChapelSideWingPewLayout();

  return (
    <group name="chapel-side-wing-diagonal-pews">
      {sideWingPews.map((pew) => (
        <ChapelDiagonalPew
          key={`chapel-side-wing-diagonal-pew-${pew.key}`}
          position={[pew.x, 0.96, pew.z]}
          yaw={getYawForPewFacingTarget(pew.x, pew.z, CHAPEL_POPE_TARGET.x, CHAPEL_POPE_TARGET.z)}
          width={pew.width}
        />
      ))}
    </group>
  );
}

export function ChapelPewNpcs() {
  return (
    <group name="chapel-pew-npcs">
      {CHAPEL_CENTER_NPC_PLACEMENTS.map((seat) => (
        <ChapelSeatedNpc
          key={seat.key}
          position={seat.position}
          yaw={seat.yaw}
          character={seat.character}
        />
      ))}
    </group>
  );
}

export function ChapelSideWingPewNpcs() {
  return (
    <group name="chapel-side-wing-pew-npcs">
      {CHAPEL_SIDE_WING_NPC_PLACEMENTS.map((seat) => (
        <ChapelSeatedNpc
          key={seat.key}
          position={seat.position}
          yaw={seat.yaw}
          character={seat.character}
        />
      ))}
    </group>
  );
}
