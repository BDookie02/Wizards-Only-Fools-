export type ChapelSideWingPewPlacement = {
  key: string;
  x: number;
  z: number;
  width: number;
};

export type ChapelWingCeilingBeamPlacement = {
  key: string;
  side: -1 | 1;
  z: number;
  color: string;
};

export type ChapelCenterPewColliderPlacement = {
  key: string;
  x: number;
  z: number;
};

export const CHAPEL_POPE_TARGET = { x: 0, z: -68.6 };
export const CHAPEL_CENTER_PEW_X = 17.2;
export const CHAPEL_CENTER_PEW_SEATS = [12.1, 19.2] as const;
export const CHAPEL_CENTER_PEW_ROWS = [-32, -20, -8, 4, 16] as const;
export const CHAPEL_SIDE_SIGNS = [-1, 1] as const;
export const CHAPEL_CENTER_NPC_SEAT_OFFSETS = [
  { x: CHAPEL_CENTER_PEW_SEATS[0], z: -0.92 },
  { x: CHAPEL_CENTER_PEW_SEATS[1], z: -0.22 },
] as const;
export const CHAPEL_SIDE_NPC_SEAT_OFFSETS = [-0.24, 0.24] as const;
export const CHAPEL_NAVE_CEILING_BEAM_ROWS = [-66, -44, -22, 0, 22, 44, 66] as const;
const CHAPEL_WING_CEILING_BEAM_ROWS = [-42, -21, 0, 21, 42] as const;

function buildChapelSideWingPewLayout(): ChapelSideWingPewPlacement[] {
  const layout: ChapelSideWingPewPlacement[] = [];
  for (let sideIndex = 0; sideIndex < CHAPEL_SIDE_SIGNS.length; sideIndex += 1) {
    const side = CHAPEL_SIDE_SIGNS[sideIndex];
    layout.push(
      { key: `${side}-rear-outer`, x: side * 94, z: -44, width: 16 },
      { key: `${side}-rear-inner`, x: side * 76, z: -34, width: 18 },
      { key: `${side}-rear-mid`, x: side * 94, z: -22, width: 16 },
      { key: `${side}-front-mid`, x: side * 94, z: 22, width: 16 },
      { key: `${side}-front-inner`, x: side * 76, z: 34, width: 18 },
      { key: `${side}-front-outer`, x: side * 94, z: 44, width: 16 },
    );
  }
  return layout;
}

function buildChapelWingCeilingBeams(): ChapelWingCeilingBeamPlacement[] {
  const beams: ChapelWingCeilingBeamPlacement[] = [];
  for (let sideIndex = 0; sideIndex < CHAPEL_SIDE_SIGNS.length; sideIndex += 1) {
    const side = CHAPEL_SIDE_SIGNS[sideIndex];
    for (let rowIndex = 0; rowIndex < CHAPEL_WING_CEILING_BEAM_ROWS.length; rowIndex += 1) {
      const z = CHAPEL_WING_CEILING_BEAM_ROWS[rowIndex];
      beams.push({
        key: `chapel-wing-ceiling-beam-${side}-${z}`,
        side,
        z,
        color: rowIndex % 2 === 0 ? "#171017" : "#241821",
      });
    }
  }
  return beams;
}

function buildChapelCenterPewColliders(): ChapelCenterPewColliderPlacement[] {
  const colliders: ChapelCenterPewColliderPlacement[] = [];
  for (let rowIndex = 0; rowIndex < CHAPEL_CENTER_PEW_ROWS.length; rowIndex += 1) {
    const z = CHAPEL_CENTER_PEW_ROWS[rowIndex];
    for (let sideIndex = 0; sideIndex < CHAPEL_SIDE_SIGNS.length; sideIndex += 1) {
      const side = CHAPEL_SIDE_SIGNS[sideIndex];
      colliders.push({
        key: `chapel-center-pew-collider-${side}-${z}`,
        x: side * CHAPEL_CENTER_PEW_X,
        z: z + 0.45,
      });
    }
  }
  return colliders;
}

export const CHAPEL_SIDE_WING_PEW_LAYOUT = buildChapelSideWingPewLayout();
export const CHAPEL_WING_CEILING_BEAMS = buildChapelWingCeilingBeams();
export const CHAPEL_CENTER_PEW_COLLIDERS = buildChapelCenterPewColliders();

export function getChapelSideWingPewLayout(): ChapelSideWingPewPlacement[] {
  return CHAPEL_SIDE_WING_PEW_LAYOUT;
}

export function getYawForPewFacingTarget(x: number, z: number, targetX: number, targetZ: number) {
  return Math.atan2(-(targetX - x), -(targetZ - z));
}

export function getAvatarYawFacingTarget(x: number, z: number, targetX: number, targetZ: number) {
  return Math.atan2(targetX - x, -(targetZ - z));
}
