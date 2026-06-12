import * as THREE from "three";

export const CHAPEL_CENTER_HALF_WIDTH = 54;
export const CHAPEL_CENTER_HALF_DEPTH = 82;
export const CHAPEL_SIDE_WING_HALF_WIDTH = 34;
export const CHAPEL_SIDE_WING_HALF_DEPTH = 57;
export const CHAPEL_SIDE_WING_CENTER_X = CHAPEL_CENTER_HALF_WIDTH + CHAPEL_SIDE_WING_HALF_WIDTH;
export const CHAPEL_OUTER_HALF_WIDTH = CHAPEL_SIDE_WING_CENTER_X + CHAPEL_SIDE_WING_HALF_WIDTH;
export const CHAPEL_WALL_THICKNESS = 2.8;
export const CHAPEL_WALL_HEIGHT = 34.8;
export const CHAPEL_WALL_HALF_HEIGHT = CHAPEL_WALL_HEIGHT / 2;
export const CHAPEL_SEATED_NPC_WALL_CLEARANCE = 13.5;
export const CHAPEL_EXIT_HALF_WIDTH = 12;
export const CHAPEL_SIDE_EXIT_HALF_WIDTH = 11;
export const CHAPEL_REAR_EXIT_CENTER_X = 33;
export const CHAPEL_REAR_EXIT_HALF_WIDTH = 8.5;
export const CHAPEL_STAIR_RAMP_LENGTH = 44;
export const CHAPEL_STAIR_RAMP_THICKNESS = 0.82;
export const CHAPEL_STAIR_RAMP_LOW_TOP = 0.02;
export const CHAPEL_STAIR_RAMP_COLLIDER_LOW_TOP = -0.32;
export const CHAPEL_STAIR_RAMP_CENTER_TOP = 1.18;
export const CHAPEL_STAIR_RAMP_WING_TOP = 1.16;
export const CHAPEL_WATCH_TOWER_HEIGHT = 42;
export const CHAPEL_WATCH_TOWER_RADIUS = 8.8;
export const CHAPEL_WATCH_TOWER_Y = 55;
export const CHAPEL_WATCH_TOWER_POSITIONS: Array<[number, number, number]> = [
  [-CHAPEL_OUTER_HALF_WIDTH + 8, CHAPEL_WATCH_TOWER_Y, -CHAPEL_SIDE_WING_HALF_DEPTH + 8],
  [CHAPEL_OUTER_HALF_WIDTH - 8, CHAPEL_WATCH_TOWER_Y, -CHAPEL_SIDE_WING_HALF_DEPTH + 8],
  [-CHAPEL_OUTER_HALF_WIDTH + 8, CHAPEL_WATCH_TOWER_Y, CHAPEL_SIDE_WING_HALF_DEPTH - 8],
  [CHAPEL_OUTER_HALF_WIDTH - 8, CHAPEL_WATCH_TOWER_Y, CHAPEL_SIDE_WING_HALF_DEPTH - 8],
];
export const CHAPEL_GARGOYLE_FOOT_DROP = 0.76;
export const CHAPEL_GARGOYLE_LEDGE_OVERLAP = 0.9;
export const CHAPEL_GARGOYLE_LEDGE_Y = CHAPEL_WALL_HEIGHT + 0.08;
export const CHAPEL_WATCH_TOWER_CAP_TOP_Y = CHAPEL_WATCH_TOWER_Y + CHAPEL_WATCH_TOWER_HEIGHT * 0.5 + 3.3;

const getChapelGargoyleRestY = (supportY: number, scale = 1) => supportY + CHAPEL_GARGOYLE_FOOT_DROP * scale;

export const CHAPEL_GARGOYLE_POSITIONS: Array<{ key: string; position: [number, number, number]; yaw: number; scale?: number }> = [
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

export const CHAPEL_EXIT_RAMP_DEFINITIONS = [
  { key: "south", position: [0, 0, 0] as [number, number, number], rotation: 0, distance: CHAPEL_CENTER_HALF_DEPTH, width: 52, top: CHAPEL_STAIR_RAMP_CENTER_TOP, outset: -1 },
  { key: "north-west", position: [-CHAPEL_REAR_EXIT_CENTER_X, 0, 0] as [number, number, number], rotation: Math.PI, distance: CHAPEL_CENTER_HALF_DEPTH, width: 40, top: CHAPEL_STAIR_RAMP_CENTER_TOP, outset: -1 },
  { key: "north-east", position: [CHAPEL_REAR_EXIT_CENTER_X, 0, 0] as [number, number, number], rotation: Math.PI, distance: CHAPEL_CENTER_HALF_DEPTH, width: 40, top: CHAPEL_STAIR_RAMP_CENTER_TOP, outset: -1 },
  { key: "east", position: [0, 0, 0] as [number, number, number], rotation: Math.PI / 2, distance: CHAPEL_OUTER_HALF_WIDTH, width: 50, top: CHAPEL_STAIR_RAMP_WING_TOP, outset: -1 },
  { key: "west", position: [0, 0, 0] as [number, number, number], rotation: -Math.PI / 2, distance: CHAPEL_OUTER_HALF_WIDTH, width: 50, top: CHAPEL_STAIR_RAMP_WING_TOP, outset: -1 },
];

export type ChapelExitShadowDefinition = {
  key: string;
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number, number];
};

export const CHAPEL_EXIT_SHADOW_DEFINITIONS: ChapelExitShadowDefinition[] = [
  { key: "south", position: [0, 12.4, CHAPEL_CENTER_HALF_DEPTH + 0.85], rotation: [0, 0, 0], size: [CHAPEL_EXIT_HALF_WIDTH * 2 - 3, 24, 0.32] },
  { key: "north-west", position: [-CHAPEL_REAR_EXIT_CENTER_X, 12.4, -(CHAPEL_CENTER_HALF_DEPTH + 0.85)], rotation: [0, Math.PI, 0], size: [CHAPEL_REAR_EXIT_HALF_WIDTH * 2, 21, 0.32] },
  { key: "north-east", position: [CHAPEL_REAR_EXIT_CENTER_X, 12.4, -(CHAPEL_CENTER_HALF_DEPTH + 0.85)], rotation: [0, Math.PI, 0], size: [CHAPEL_REAR_EXIT_HALF_WIDTH * 2, 21, 0.32] },
  { key: "east", position: [CHAPEL_OUTER_HALF_WIDTH + 0.85, 12.4, 0], rotation: [0, Math.PI / 2, 0], size: [CHAPEL_SIDE_EXIT_HALF_WIDTH * 2 - 2, 20, 0.32] },
  { key: "west", position: [-(CHAPEL_OUTER_HALF_WIDTH + 0.85), 12.4, 0], rotation: [0, -Math.PI / 2, 0], size: [CHAPEL_SIDE_EXIT_HALF_WIDTH * 2 - 2, 20, 0.32] },
];

export const CHAPEL_CHANDELIER_CANDLE_POSITIONS: Array<[number, number, number]> = [];
for (let index = 0; index < 8; index += 1) {
  const angle = (index / 8) * Math.PI * 2;
  CHAPEL_CHANDELIER_CANDLE_POSITIONS.push([Math.cos(angle) * 6.2, 0, Math.sin(angle) * 6.2]);
}

export const CHAPEL_CANDLE_DRIP_ANGLES = [0.2, 2.45, 4.1] as const;
export const CHAPEL_INTERIOR_CANDLE_SPOTS: Array<[number, number, number]> = [
  [-45, 0.9, 54], [45, 0.9, 54], [-45, 0.9, 18], [45, 0.9, 18],
  [-45, 0.9, -18], [45, 0.9, -18], [-28, 0.9, -66], [28, 0.9, -66],
  [-104, 0.9, 34], [104, 0.9, 34], [-104, 0.9, -34], [104, 0.9, -34],
  [-6, 1.3, -66], [6, 1.3, -66],
];
export const CHAPEL_ALTAR_GRAIN_X = [-7.2, 0, 7.2] as const;
export const CHAPEL_PULPIT_GRAIN_X = [-2.4, 0, 2.4] as const;
export const CHAPEL_DOOR_PANEL_PLANK_OFFSETS = [-0.24, 0.24] as const;
export const CHAPEL_DOOR_STRAP_HEIGHT_OFFSETS = [-0.34, 0.34] as const;
export const CHAPEL_SIDE_WING_WINDOW_Z = [-34, 34] as const;
export const CHAPEL_NAVE_WINDOW_Z = [-68, 68] as const;
export const CHAPEL_WING_BUTTRESS_Z = [-46, -18, 18, 46] as const;
export const CHAPEL_CENTRAL_BUTTRESS_Z = [-72, 72] as const;

export function makeChapelRampColliderGeometry(baseHeight: number) {
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

export type ChapelWallSegment = {
  key: string;
  position: [number, number, number];
  size: [number, number, number];
};

let chapelWallSegmentsCache: ChapelWallSegment[] | null = null;

export function getChapelWallSegments(): ChapelWallSegment[] {
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
