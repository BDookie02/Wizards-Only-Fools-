import { Fragment, useEffect, useMemo } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import type { CharacterCustomization } from "../../../../store/gameStore";
import { AvatarBillboard, AvatarWorldFacingPlane, NPC_AVATAR_GROUND_LIFT, NPC_AVATAR_SCALE } from "../../../PixelAvatar";
import { getCachedIndexRange } from "../../rendering/indexRange";
import { getSurvivalTerrainDetailTexture } from "../terrain/survivalTerrainTextures";
import { shouldBuildSurvivalChunkColliders, shouldRenderSurvivalChunkSkirt } from "../survival/survivalChunks";
import { useGraveyardLoadStage } from "../survival/survivalLoadStage";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { useSurvivalFeatureCount } from "../../../tools/qa/survivalFeatureCounters";
import {
  makeGraveyardLayout,
  type GraveyardFenceSegment,
} from "./survivalGraveyardVillageLayout";
import {
  CHAPEL_CENTER_NPC_SEAT_OFFSETS,
  CHAPEL_CENTER_PEW_COLLIDERS,
  CHAPEL_CENTER_PEW_ROWS,
  CHAPEL_CENTER_PEW_X,
  CHAPEL_NAVE_CEILING_BEAM_ROWS,
  CHAPEL_POPE_TARGET,
  CHAPEL_SIDE_NPC_SEAT_OFFSETS,
  CHAPEL_SIDE_SIGNS,
  CHAPEL_SIDE_WING_PEW_LAYOUT,
  CHAPEL_WING_CEILING_BEAMS,
  getAvatarYawFacingTarget,
  getChapelSideWingPewLayout,
  getYawForPewFacingTarget,
} from "./survivalGraveyardChapelLayout";
import { ChapelCrack, ChapelGiantGothicWindow, createChapelStoneBrickTexture } from "./survivalGraveyardChapelDetails";
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

const CHAPEL_CENTER_HALF_WIDTH = 54;
const CHAPEL_CENTER_HALF_DEPTH = 82;
const CHAPEL_SIDE_WING_HALF_WIDTH = 34;
const CHAPEL_SIDE_WING_HALF_DEPTH = 57;
const CHAPEL_SIDE_WING_CENTER_X = CHAPEL_CENTER_HALF_WIDTH + CHAPEL_SIDE_WING_HALF_WIDTH;
const CHAPEL_OUTER_HALF_WIDTH = CHAPEL_SIDE_WING_CENTER_X + CHAPEL_SIDE_WING_HALF_WIDTH;
const CHAPEL_WALL_THICKNESS = 2.8;
const CHAPEL_WALL_HEIGHT = 34.8;
const CHAPEL_WALL_HALF_HEIGHT = CHAPEL_WALL_HEIGHT / 2;
const CHAPEL_SEATED_NPC_WALL_CLEARANCE = 13.5;
const CHAPEL_EXIT_HALF_WIDTH = 12;
const CHAPEL_SIDE_EXIT_HALF_WIDTH = 11;
const CHAPEL_REAR_EXIT_CENTER_X = 33;
const CHAPEL_REAR_EXIT_HALF_WIDTH = 8.5;
const CHAPEL_STAIR_RAMP_LENGTH = 44;
const CHAPEL_STAIR_RAMP_THICKNESS = 0.82;
const CHAPEL_STAIR_RAMP_LOW_TOP = 0.02;
const CHAPEL_STAIR_RAMP_COLLIDER_LOW_TOP = -0.32;
const CHAPEL_STAIR_RAMP_CENTER_TOP = 1.18;
const CHAPEL_STAIR_RAMP_WING_TOP = 1.16;
const CHAPEL_WATCH_TOWER_HEIGHT = 42;
const CHAPEL_WATCH_TOWER_RADIUS = 8.8;
const CHAPEL_WATCH_TOWER_Y = 55;
const CHAPEL_WATCH_TOWER_POSITIONS: Array<[number, number, number]> = [
  [-CHAPEL_OUTER_HALF_WIDTH + 8, CHAPEL_WATCH_TOWER_Y, -CHAPEL_SIDE_WING_HALF_DEPTH + 8],
  [CHAPEL_OUTER_HALF_WIDTH - 8, CHAPEL_WATCH_TOWER_Y, -CHAPEL_SIDE_WING_HALF_DEPTH + 8],
  [-CHAPEL_OUTER_HALF_WIDTH + 8, CHAPEL_WATCH_TOWER_Y, CHAPEL_SIDE_WING_HALF_DEPTH - 8],
  [CHAPEL_OUTER_HALF_WIDTH - 8, CHAPEL_WATCH_TOWER_Y, CHAPEL_SIDE_WING_HALF_DEPTH - 8],
];
const CHAPEL_GARGOYLE_FOOT_DROP = 0.76;
const CHAPEL_GARGOYLE_LEDGE_OVERLAP = 0.9;
const CHAPEL_GARGOYLE_LEDGE_Y = CHAPEL_WALL_HEIGHT + 0.08;
const CHAPEL_WATCH_TOWER_CAP_TOP_Y = CHAPEL_WATCH_TOWER_Y + CHAPEL_WATCH_TOWER_HEIGHT * 0.5 + 3.3;
const getChapelGargoyleRestY = (supportY: number, scale = 1) => supportY + CHAPEL_GARGOYLE_FOOT_DROP * scale;
const CHAPEL_GARGOYLE_POSITIONS: Array<{ key: string; position: [number, number, number]; yaw: number; scale?: number }> = [
  { key: "north-left", position: [-32, getChapelGargoyleRestY(CHAPEL_GARGOYLE_LEDGE_Y), -(CHAPEL_CENTER_HALF_DEPTH + CHAPEL_GARGOYLE_LEDGE_OVERLAP)], yaw: Math.PI },
  { key: "north-right", position: [32, getChapelGargoyleRestY(CHAPEL_GARGOYLE_LEDGE_Y), -(CHAPEL_CENTER_HALF_DEPTH + CHAPEL_GARGOYLE_LEDGE_OVERLAP)], yaw: Math.PI },
  { key: "south-left", position: [-32, getChapelGargoyleRestY(CHAPEL_GARGOYLE_LEDGE_Y), CHAPEL_CENTER_HALF_DEPTH + CHAPEL_GARGOYLE_LEDGE_OVERLAP], yaw: 0 },
  { key: "south-right", position: [32, getChapelGargoyleRestY(CHAPEL_GARGOYLE_LEDGE_Y), CHAPEL_CENTER_HALF_DEPTH + CHAPEL_GARGOYLE_LEDGE_OVERLAP], yaw: 0 },
  { key: "west-north", position: [-(CHAPEL_OUTER_HALF_WIDTH + CHAPEL_GARGOYLE_LEDGE_OVERLAP), getChapelGargoyleRestY(CHAPEL_GARGOYLE_LEDGE_Y, 0.9), -36], yaw: -Math.PI / 2, scale: 0.9 },
  { key: "west-mid", position: [-(CHAPEL_OUTER_HALF_WIDTH + CHAPEL_GARGOYLE_LEDGE_OVERLAP), getChapelGargoyleRestY(CHAPEL_GARGOYLE_LEDGE_Y, 0.9), 0], yaw: -Math.PI / 2, scale: 0.9 },
  { key: "west-south", position: [-(CHAPEL_OUTER_HALF_WIDTH + CHAPEL_GARGOYLE_LEDGE_OVERLAP), getChapelGargoyleRestY(CHAPEL_GARGOYLE_LEDGE_Y, 0.9), 36], yaw: -Math.PI / 2, scale: 0.9 },
  { key: "east-north", position: [CHAPEL_OUTER_HALF_WIDTH + CHAPEL_GARGOYLE_LEDGE_OVERLAP, getChapelGargoyleRestY(CHAPEL_GARGOYLE_LEDGE_Y, 0.9), -36], yaw: Math.PI / 2, scale: 0.9 },
  { key: "east-mid", position: [CHAPEL_OUTER_HALF_WIDTH + CHAPEL_GARGOYLE_LEDGE_OVERLAP, getChapelGargoyleRestY(CHAPEL_GARGOYLE_LEDGE_Y, 0.9), 0], yaw: Math.PI / 2, scale: 0.9 },
  { key: "east-south", position: [CHAPEL_OUTER_HALF_WIDTH + CHAPEL_GARGOYLE_LEDGE_OVERLAP, getChapelGargoyleRestY(CHAPEL_GARGOYLE_LEDGE_Y, 0.9), 36], yaw: Math.PI / 2, scale: 0.9 },
  { key: "tower-nw", position: [-CHAPEL_OUTER_HALF_WIDTH + 8, getChapelGargoyleRestY(CHAPEL_WATCH_TOWER_CAP_TOP_Y, 0.78), -CHAPEL_SIDE_WING_HALF_DEPTH + 8], yaw: -Math.PI * 0.75, scale: 0.78 },
  { key: "tower-ne", position: [CHAPEL_OUTER_HALF_WIDTH - 8, getChapelGargoyleRestY(CHAPEL_WATCH_TOWER_CAP_TOP_Y, 0.78), -CHAPEL_SIDE_WING_HALF_DEPTH + 8], yaw: Math.PI * 0.75, scale: 0.78 },
  { key: "tower-sw", position: [-CHAPEL_OUTER_HALF_WIDTH + 8, getChapelGargoyleRestY(CHAPEL_WATCH_TOWER_CAP_TOP_Y, 0.78), CHAPEL_SIDE_WING_HALF_DEPTH - 8], yaw: -Math.PI * 0.25, scale: 0.78 },
  { key: "tower-se", position: [CHAPEL_OUTER_HALF_WIDTH - 8, getChapelGargoyleRestY(CHAPEL_WATCH_TOWER_CAP_TOP_Y, 0.78), CHAPEL_SIDE_WING_HALF_DEPTH - 8], yaw: Math.PI * 0.25, scale: 0.78 },
];
const CHAPEL_EXIT_RAMP_DEFINITIONS = [
  { key: "south", position: [0, 0, 0] as [number, number, number], rotation: 0, distance: CHAPEL_CENTER_HALF_DEPTH, width: 52, top: CHAPEL_STAIR_RAMP_CENTER_TOP, outset: -1 },
  { key: "north-west", position: [-CHAPEL_REAR_EXIT_CENTER_X, 0, 0] as [number, number, number], rotation: Math.PI, distance: CHAPEL_CENTER_HALF_DEPTH, width: 40, top: CHAPEL_STAIR_RAMP_CENTER_TOP, outset: -1 },
  { key: "north-east", position: [CHAPEL_REAR_EXIT_CENTER_X, 0, 0] as [number, number, number], rotation: Math.PI, distance: CHAPEL_CENTER_HALF_DEPTH, width: 40, top: CHAPEL_STAIR_RAMP_CENTER_TOP, outset: -1 },
  { key: "east", position: [0, 0, 0] as [number, number, number], rotation: Math.PI / 2, distance: CHAPEL_OUTER_HALF_WIDTH, width: 50, top: CHAPEL_STAIR_RAMP_WING_TOP, outset: -1 },
  { key: "west", position: [0, 0, 0] as [number, number, number], rotation: -Math.PI / 2, distance: CHAPEL_OUTER_HALF_WIDTH, width: 50, top: CHAPEL_STAIR_RAMP_WING_TOP, outset: -1 },
];
type ChapelExitShadowDefinition = {
  key: string;
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number, number];
};
const CHAPEL_EXIT_SHADOW_DEFINITIONS: ChapelExitShadowDefinition[] = [
  { key: "south", position: [0, 12.4, CHAPEL_CENTER_HALF_DEPTH + 0.85], rotation: [0, 0, 0], size: [CHAPEL_EXIT_HALF_WIDTH * 2 - 3, 24, 0.32] },
  { key: "north-west", position: [-CHAPEL_REAR_EXIT_CENTER_X, 12.4, -(CHAPEL_CENTER_HALF_DEPTH + 0.85)], rotation: [0, Math.PI, 0], size: [CHAPEL_REAR_EXIT_HALF_WIDTH * 2, 21, 0.32] },
  { key: "north-east", position: [CHAPEL_REAR_EXIT_CENTER_X, 12.4, -(CHAPEL_CENTER_HALF_DEPTH + 0.85)], rotation: [0, Math.PI, 0], size: [CHAPEL_REAR_EXIT_HALF_WIDTH * 2, 21, 0.32] },
  { key: "east", position: [CHAPEL_OUTER_HALF_WIDTH + 0.85, 12.4, 0], rotation: [0, Math.PI / 2, 0], size: [CHAPEL_SIDE_EXIT_HALF_WIDTH * 2 - 2, 20, 0.32] },
  { key: "west", position: [-(CHAPEL_OUTER_HALF_WIDTH + 0.85), 12.4, 0], rotation: [0, -Math.PI / 2, 0], size: [CHAPEL_SIDE_EXIT_HALF_WIDTH * 2 - 2, 20, 0.32] },
];
const CHAPEL_CHANDELIER_CANDLE_POSITIONS: Array<[number, number, number]> = [];
for (let index = 0; index < 8; index += 1) {
  const angle = (index / 8) * Math.PI * 2;
  CHAPEL_CHANDELIER_CANDLE_POSITIONS.push([Math.cos(angle) * 6.2, 0, Math.sin(angle) * 6.2]);
}
const CHAPEL_CANDLE_DRIP_ANGLES = [0.2, 2.45, 4.1] as const;
const CHAPEL_INTERIOR_CANDLE_SPOTS: Array<[number, number, number]> = [
  [-45, 0.9, 54], [45, 0.9, 54], [-45, 0.9, 18], [45, 0.9, 18],
  [-45, 0.9, -18], [45, 0.9, -18], [-28, 0.9, -66], [28, 0.9, -66],
  [-104, 0.9, 34], [104, 0.9, 34], [-104, 0.9, -34], [104, 0.9, -34],
  [-6, 1.3, -66], [6, 1.3, -66],
];
const CHAPEL_ALTAR_GRAIN_X = [-7.2, 0, 7.2] as const;
const CHAPEL_PULPIT_GRAIN_X = [-2.4, 0, 2.4] as const;
const CHAPEL_DOOR_PANEL_PLANK_OFFSETS = [-0.24, 0.24] as const;
const CHAPEL_DOOR_STRAP_HEIGHT_OFFSETS = [-0.34, 0.34] as const;
const CHAPEL_SIDE_WING_WINDOW_Z = [-34, 34] as const;
const CHAPEL_NAVE_WINDOW_Z = [-68, 68] as const;
const CHAPEL_WING_BUTTRESS_Z = [-46, -18, 18, 46] as const;
const CHAPEL_CENTRAL_BUTTRESS_Z = [-72, 72] as const;

function makeChapelRampColliderGeometry(baseHeight: number) {
  const exitCount = CHAPEL_EXIT_RAMP_DEFINITIONS.length;
  const positions = new Float32Array(exitCount * 4 * 3);
  const indices = new Uint16Array(exitCount * 6);

  for (let exitIndex = 0; exitIndex < CHAPEL_EXIT_RAMP_DEFINITIONS.length; exitIndex += 1) {
    const exit = CHAPEL_EXIT_RAMP_DEFINITIONS[exitIndex];
    const baseIndex = exitIndex * 4;
    let positionOffset = baseIndex * 3;
    const halfWidth = exit.width / 2;
    const highZ = exit.distance + exit.outset;
    const lowZ = highZ + CHAPEL_STAIR_RAMP_LENGTH;
    const cos = Math.cos(exit.rotation);
    const sin = Math.sin(exit.rotation);
    const transformPoint = (x: number, y: number, z: number) => {
      positions[positionOffset] = exit.position[0] + x * cos + z * sin;
      positions[positionOffset + 1] = baseHeight + y;
      positions[positionOffset + 2] = exit.position[2] - x * sin + z * cos;
      positionOffset += 3;
    };

    transformPoint(-halfWidth, exit.top, highZ);
    transformPoint(-halfWidth, CHAPEL_STAIR_RAMP_COLLIDER_LOW_TOP, lowZ);
    transformPoint(halfWidth, exit.top, highZ);
    transformPoint(halfWidth, CHAPEL_STAIR_RAMP_COLLIDER_LOW_TOP, lowZ);
    const indexOffset = exitIndex * 6;
    indices[indexOffset] = baseIndex;
    indices[indexOffset + 1] = baseIndex + 1;
    indices[indexOffset + 2] = baseIndex + 2;
    indices[indexOffset + 3] = baseIndex + 2;
    indices[indexOffset + 4] = baseIndex + 1;
    indices[indexOffset + 5] = baseIndex + 3;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

type ChapelWallSegment = {
  key: string;
  position: [number, number, number];
  size: [number, number, number];
};

let chapelWallSegmentsCache: ChapelWallSegment[] | null = null;

function getChapelWallSegments(): ChapelWallSegment[] {
  if (chapelWallSegmentsCache) return chapelWallSegmentsCache;

  const t = CHAPEL_WALL_THICKNESS;
  const h = CHAPEL_WALL_HEIGHT;
  const y = CHAPEL_WALL_HALF_HEIGHT;
  const frontDoorTop = 24.4;
  const sideDoorTop = 22.4;
  const frontLintelHeight = h - frontDoorTop;
  const sideLintelHeight = h - sideDoorTop;
  const frontLintelY = frontDoorTop + frontLintelHeight * 0.5;
  const sideLintelY = sideDoorTop + sideLintelHeight * 0.5;
  const frontDoorSideWidth = CHAPEL_CENTER_HALF_WIDTH - CHAPEL_EXIT_HALF_WIDTH;
  const frontDoorSideX = CHAPEL_EXIT_HALF_WIDTH + frontDoorSideWidth * 0.5;
  const rearOuterWallWidth = CHAPEL_CENTER_HALF_WIDTH - CHAPEL_REAR_EXIT_CENTER_X - CHAPEL_REAR_EXIT_HALF_WIDTH;
  const rearOuterWallX = CHAPEL_REAR_EXIT_CENTER_X + CHAPEL_REAR_EXIT_HALF_WIDTH + rearOuterWallWidth * 0.5;
  const rearCenterWallWidth = (CHAPEL_REAR_EXIT_CENTER_X - CHAPEL_REAR_EXIT_HALF_WIDTH) * 2;
  const centralSideDepth = CHAPEL_CENTER_HALF_DEPTH - CHAPEL_SIDE_WING_HALF_DEPTH;
  const centralSideZ = CHAPEL_SIDE_WING_HALF_DEPTH + centralSideDepth * 0.5;
  const wingDoorSideDepth = CHAPEL_SIDE_WING_HALF_DEPTH - CHAPEL_SIDE_EXIT_HALF_WIDTH;
  const wingDoorSideZ = CHAPEL_SIDE_EXIT_HALF_WIDTH + wingDoorSideDepth * 0.5;

  const segments: ChapelWallSegment[] = [
    { key: "central-north-west-outer", position: [-rearOuterWallX, y, -CHAPEL_CENTER_HALF_DEPTH], size: [rearOuterWallWidth, h, t] },
    { key: "central-north-center", position: [0, y, -CHAPEL_CENTER_HALF_DEPTH], size: [rearCenterWallWidth, h, t] },
    { key: "central-north-east-outer", position: [rearOuterWallX, y, -CHAPEL_CENTER_HALF_DEPTH], size: [rearOuterWallWidth, h, t] },
    { key: "central-south-west", position: [-frontDoorSideX, y, CHAPEL_CENTER_HALF_DEPTH], size: [frontDoorSideWidth, h, t] },
    { key: "central-south-east", position: [frontDoorSideX, y, CHAPEL_CENTER_HALF_DEPTH], size: [frontDoorSideWidth, h, t] },
    { key: "central-south-door-lintel", position: [0, frontLintelY, CHAPEL_CENTER_HALF_DEPTH], size: [CHAPEL_EXIT_HALF_WIDTH * 2 + 4, frontLintelHeight, t] },
    { key: "central-north-west-door-lintel", position: [-CHAPEL_REAR_EXIT_CENTER_X, sideLintelY, -CHAPEL_CENTER_HALF_DEPTH], size: [CHAPEL_REAR_EXIT_HALF_WIDTH * 2 + 4, sideLintelHeight, t] },
    { key: "central-north-east-door-lintel", position: [CHAPEL_REAR_EXIT_CENTER_X, sideLintelY, -CHAPEL_CENTER_HALF_DEPTH], size: [CHAPEL_REAR_EXIT_HALF_WIDTH * 2 + 4, sideLintelHeight, t] },
    { key: "central-west-north", position: [-CHAPEL_CENTER_HALF_WIDTH, y, -centralSideZ], size: [t, h, centralSideDepth] },
    { key: "central-west-south", position: [-CHAPEL_CENTER_HALF_WIDTH, y, centralSideZ], size: [t, h, centralSideDepth] },
    { key: "central-east-north", position: [CHAPEL_CENTER_HALF_WIDTH, y, -centralSideZ], size: [t, h, centralSideDepth] },
    { key: "central-east-south", position: [CHAPEL_CENTER_HALF_WIDTH, y, centralSideZ], size: [t, h, centralSideDepth] },
    { key: "west-wing-north", position: [-CHAPEL_SIDE_WING_CENTER_X, y, -CHAPEL_SIDE_WING_HALF_DEPTH], size: [CHAPEL_SIDE_WING_HALF_WIDTH * 2, h, t] },
    { key: "west-wing-south", position: [-CHAPEL_SIDE_WING_CENTER_X, y, CHAPEL_SIDE_WING_HALF_DEPTH], size: [CHAPEL_SIDE_WING_HALF_WIDTH * 2, h, t] },
    { key: "east-wing-north", position: [CHAPEL_SIDE_WING_CENTER_X, y, -CHAPEL_SIDE_WING_HALF_DEPTH], size: [CHAPEL_SIDE_WING_HALF_WIDTH * 2, h, t] },
    { key: "east-wing-south", position: [CHAPEL_SIDE_WING_CENTER_X, y, CHAPEL_SIDE_WING_HALF_DEPTH], size: [CHAPEL_SIDE_WING_HALF_WIDTH * 2, h, t] },
    { key: "west-wing-side-north", position: [-CHAPEL_OUTER_HALF_WIDTH, y, -wingDoorSideZ], size: [t, h, wingDoorSideDepth] },
    { key: "west-wing-side-south", position: [-CHAPEL_OUTER_HALF_WIDTH, y, wingDoorSideZ], size: [t, h, wingDoorSideDepth] },
    { key: "east-wing-side-north", position: [CHAPEL_OUTER_HALF_WIDTH, y, -wingDoorSideZ], size: [t, h, wingDoorSideDepth] },
    { key: "east-wing-side-south", position: [CHAPEL_OUTER_HALF_WIDTH, y, wingDoorSideZ], size: [t, h, wingDoorSideDepth] },
    { key: "west-wing-side-door-lintel", position: [-CHAPEL_OUTER_HALF_WIDTH, sideLintelY, 0], size: [t, sideLintelHeight, CHAPEL_SIDE_EXIT_HALF_WIDTH * 2 + 5] },
    { key: "east-wing-side-door-lintel", position: [CHAPEL_OUTER_HALF_WIDTH, sideLintelY, 0], size: [t, sideLintelHeight, CHAPEL_SIDE_EXIT_HALF_WIDTH * 2 + 5] },
  ];
  chapelWallSegmentsCache = segments;
  return segments;
}

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

const CHAPEL_PEW_SEAT_GRAIN_X = [-5.6, 0, 5.6] as const;
const CHAPEL_PEW_BACK_GRAIN_X = [-6.5, 0, 6.5] as const;
const CHAPEL_PEW_LEG_X = [-7.2, 7.2] as const;
const CHAPEL_DIAGONAL_PEW_PLANK_OFFSETS = [-0.28, 0.28] as const;
const CHAPEL_DIAGONAL_PEW_BACK_OFFSETS = [-0.38, 0, 0.38] as const;
const CHAPEL_DIAGONAL_PEW_LEG_OFFSETS = [-0.42, 0.42] as const;

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

const CHAPEL_NPC_CHARACTERS: CharacterCustomization[] = [
  {
    skinColor: "#c68a5c",
    topColor: "#5b2f2a",
    pantsColor: "#242126",
    shoesColor: "#2c2116",
    hatColor: "#5b2f2a",
    hairColor: "#2b160d",
    facialHairColor: "#2b160d",
    topStyle: "tunic",
    pantsStyle: "pants",
    shoesStyle: "boots",
    hatStyle: "none",
    hairStyle: "short",
    facialHairStyle: "none",
    eyeStyle: "calm",
    mouthStyle: "neutral",
  },
  {
    skinColor: "#8f5f3f",
    topColor: "#2e4a63",
    pantsColor: "#334155",
    shoesColor: "#1f2937",
    hatColor: "#2e4a63",
    hairColor: "#1b130d",
    facialHairColor: "#1b130d",
    topStyle: "vest",
    pantsStyle: "skirt",
    shoesStyle: "shoes",
    hatStyle: "none",
    hairStyle: "bob",
    facialHairStyle: "none",
    eyeStyle: "content",
    mouthStyle: "smile",
  },
  {
    skinColor: "#d39a6b",
    topColor: "#4f5830",
    pantsColor: "#3f3f2b",
    shoesColor: "#2a1f16",
    hatColor: "#4f5830",
    hairColor: "#4a2b18",
    facialHairColor: "#4a2b18",
    topStyle: "simple",
    pantsStyle: "pants",
    shoesStyle: "boots",
    hatStyle: "none",
    hairStyle: "long",
    facialHairStyle: "mustache",
    eyeStyle: "dull",
    mouthStyle: "neutral",
  },
  {
    skinColor: "#b97850",
    topColor: "#51365f",
    pantsColor: "#312e42",
    shoesColor: "#27212f",
    hatColor: "#51365f",
    hairColor: "#24160f",
    facialHairColor: "#24160f",
    topStyle: "tunic",
    pantsStyle: "robe",
    shoesStyle: "sandals",
    hatStyle: "none",
    hairStyle: "spikes",
    facialHairStyle: "goatee",
    eyeStyle: "sus",
    mouthStyle: "frown",
  },
  {
    skinColor: "#e0aa79",
    topColor: "#6a4a30",
    pantsColor: "#4b3b24",
    shoesColor: "#2c2116",
    hatColor: "#6a4a30",
    hairColor: "#5d351e",
    facialHairColor: "#5d351e",
    topStyle: "vest",
    pantsStyle: "shorts",
    shoesStyle: "boots",
    hatStyle: "none",
    hairStyle: "short",
    facialHairStyle: "beard",
    eyeStyle: "happy",
    mouthStyle: "smile",
  },
  {
    skinColor: "#9f6d4b",
    topColor: "#273f35",
    pantsColor: "#1f2f25",
    shoesColor: "#161d18",
    hatColor: "#273f35",
    hairColor: "#19110b",
    facialHairColor: "#19110b",
    topStyle: "simple",
    pantsStyle: "skirt",
    shoesStyle: "barefoot",
    hatStyle: "none",
    hairStyle: "bob",
    facialHairStyle: "none",
    eyeStyle: "nervous",
    mouthStyle: "neutral",
  },
];

const CHAPEL_POPE_CHARACTER: CharacterCustomization = {
  skinColor: "#f5d0a8",
  topColor: "#fff8e7",
  pantsColor: "#f5f0dc",
  shoesColor: "#d4af37",
  hatColor: "#f4f1e8",
  hairColor: "#f8fafc",
  facialHairColor: "#f8fafc",
  topStyle: "robe",
  pantsStyle: "robe",
  shoesStyle: "shoes",
  hatStyle: "none",
  hairStyle: "short",
  facialHairStyle: "none",
  eyeStyle: "calm",
  mouthStyle: "neutral",
};

type ChapelNpcPlacement = {
  key: string;
  position: [number, number, number];
  yaw: number;
  character: CharacterCustomization;
};

const CHAPEL_CENTER_NPC_SEAT_Y = 2.98 + NPC_AVATAR_GROUND_LIFT;
const CHAPEL_SIDE_WING_NPC_SEAT_Y = 2.78 + NPC_AVATAR_GROUND_LIFT;

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
  character: CharacterCustomization;
}) {
  return (
    <group position={position} scale={[NPC_AVATAR_SCALE, NPC_AVATAR_SCALE, NPC_AVATAR_SCALE]} name="chapel-pew-npc">
      <AvatarWorldFacingPlane character={character} animation="idle" yaw={yaw} health={100} />
    </group>
  );
}

function ChapelPewNpcs() {
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

function ChapelSideWingPewNpcs() {
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
  const sideWingPews = getChapelSideWingPewLayout();

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
      {CHAPEL_CENTER_PEW_ROWS.map((z) => (
        <Fragment key={`chapel-pews-${z}`}>
          <ChapelPew side={-1} z={z} />
          <ChapelPew side={1} z={z} />
        </Fragment>
      ))}
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

function GraveyardVillageColliders({
  chunk,
  baseHeight,
  groundGeometry,
  fenceSegments,
}: {
  chunk: SurvivalChunkInfo;
  baseHeight: number;
  groundGeometry: THREE.BufferGeometry;
  fenceSegments: GraveyardFenceSegment[];
}) {
  const rampColliderGeometry = useMemo(() => makeChapelRampColliderGeometry(baseHeight), [baseHeight]);
  const sideWingPews = useMemo(() => getChapelSideWingPewLayout(), []);
  if (!shouldBuildSurvivalChunkColliders(chunk)) return null;

  return (
    <>
      <RigidBody type="fixed" colliders="trimesh" friction={0.5} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <mesh geometry={groundGeometry} dispose={null}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="trimesh" friction={0.82} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <mesh geometry={rampColliderGeometry} dispose={null}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders={false} friction={0.55} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <CuboidCollider args={[CHAPEL_CENTER_HALF_WIDTH, 0.58, CHAPEL_CENTER_HALF_DEPTH]} position={[0, baseHeight + 0.56, 0]} />
        <CuboidCollider args={[CHAPEL_SIDE_WING_HALF_WIDTH, 0.56, CHAPEL_SIDE_WING_HALF_DEPTH]} position={[-CHAPEL_SIDE_WING_CENTER_X, baseHeight + 0.54, 0]} />
        <CuboidCollider args={[CHAPEL_SIDE_WING_HALF_WIDTH, 0.56, CHAPEL_SIDE_WING_HALF_DEPTH]} position={[CHAPEL_SIDE_WING_CENTER_X, baseHeight + 0.54, 0]} />
        {CHAPEL_CENTER_PEW_COLLIDERS.map((pew) => (
          <CuboidCollider
            key={pew.key}
            args={[9.5, 1.75, 2.55]}
            position={[pew.x, baseHeight + 2.65, pew.z]}
          />
        ))}
        {sideWingPews.map((pew) => (
          <CuboidCollider
            key={`chapel-side-pew-collider-${pew.key}`}
            args={[pew.width / 2 + 0.9, 1.75, 2.65]}
            position={[pew.x, baseHeight + 2.65, pew.z]}
            rotation={[0, getYawForPewFacingTarget(pew.x, pew.z, CHAPEL_POPE_TARGET.x, CHAPEL_POPE_TARGET.z), 0]}
          />
        ))}
        <CuboidCollider args={[11.2, 2.9, 4.7]} position={[0, baseHeight + 3.9, -68]} />
        <CuboidCollider args={[4.35, 3.05, 3.45]} position={[30, baseHeight + 4.05, -54]} />
        {getChapelWallSegments().map((wall) => (
          <CuboidCollider
            key={`chapel-wall-collider-${wall.key}`}
            args={[wall.size[0] / 2, wall.size[1] / 2, wall.size[2] / 2]}
            position={[wall.position[0], baseHeight + wall.position[1], wall.position[2]]}
          />
        ))}
        <CuboidCollider args={[1.3, 33.2, 21]} position={[-17.3, baseHeight + 33.2, CHAPEL_CENTER_HALF_DEPTH - 20]} />
        <CuboidCollider args={[1.3, 33.2, 21]} position={[17.3, baseHeight + 33.2, CHAPEL_CENTER_HALF_DEPTH - 20]} />
        <CuboidCollider args={[2.7, 33.2, 1.3]} position={[-13.7, baseHeight + 33.2, CHAPEL_CENTER_HALF_DEPTH - 3.5]} />
        <CuboidCollider args={[2.7, 33.2, 1.3]} position={[13.7, baseHeight + 33.2, CHAPEL_CENTER_HALF_DEPTH - 3.5]} />
        <CuboidCollider args={[2.7, 33.2, 1.2]} position={[-13.7, baseHeight + 33.2, CHAPEL_CENTER_HALF_DEPTH - 40.5]} />
        <CuboidCollider args={[2.7, 33.2, 1.2]} position={[13.7, baseHeight + 33.2, CHAPEL_CENTER_HALF_DEPTH - 40.5]} />
        <CuboidCollider args={[11, 20, 1.3]} position={[0, baseHeight + 46.4, CHAPEL_CENTER_HALF_DEPTH - 3.5]} />
        <CuboidCollider args={[11, 20, 1.2]} position={[0, baseHeight + 46.4, CHAPEL_CENTER_HALF_DEPTH - 40.5]} />
        {fenceSegments.map((segment) => (
          <group key={`${segment.key}-collider`} position={[segment.localX, 0, segment.localZ]} rotation={[0, segment.rotation, 0]}>
            <CuboidCollider args={[(segment.length + 3.2) / 2, 7.2, 1.8]} position={[0, segment.localY + 5.6, 0]} />
          </group>
        ))}
      </RigidBody>
    </>
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

