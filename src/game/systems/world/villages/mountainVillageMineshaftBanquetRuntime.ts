import {
  MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_ANGLES,
  MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_TABLE_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_LIGHT_COUNT,
  MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_LIGHT_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_THRONE_Z,
} from "./mountainVillageTerrain";

export type MountainMineshaftBottomLightDescriptor = {
  index: number;
  position: [number, number, number];
  rotation: [number, number, number];
  bodyColor: string;
  withLight: boolean;
};

export type MountainMineshaftBanquetChairDescriptor = {
  index: number;
  position: [number, number, number];
  rotation: [number, number, number];
  seatColor: string;
};

export type MountainMineshaftTablePlankDescriptor = {
  index: number;
  z: number;
  width: number;
  color: string;
};

export type MountainMineshaftTableLegDescriptor = {
  index: number;
  position: [number, number, number];
};

export type MountainMineshaftBreadDescriptor = {
  index: number;
  position: [number, number, number];
  rotation: [number, number, number];
  color: string;
};

export type MountainMineshaftFruitDescriptor = {
  index: number;
  position: [number, number, number];
  color: string;
};

export type MountainMineshaftFruitBowlDescriptor = {
  index: number;
  position: [number, number, number];
  fruits: MountainMineshaftFruitDescriptor[];
};

export type MountainMineshaftPlateDescriptor = {
  index: number;
  position: [number, number, number];
  rotation: [number, number, number];
  foodColor: string;
};

export type MountainMineshaftCandleDescriptor = {
  index: number;
  position: [number, number, number];
};

export type MountainMineshaftBanquetTableDescriptors = {
  radius: number;
  planks: MountainMineshaftTablePlankDescriptor[];
  legs: MountainMineshaftTableLegDescriptor[];
  breads: MountainMineshaftBreadDescriptor[];
  fruitBowls: MountainMineshaftFruitBowlDescriptor[];
  plates: MountainMineshaftPlateDescriptor[];
  candles: MountainMineshaftCandleDescriptor[];
};

export type MountainMineshaftRoyalBanquetDescriptors = {
  bottomLights: MountainMineshaftBottomLightDescriptor[];
  chairs: MountainMineshaftBanquetChairDescriptor[];
  table: MountainMineshaftBanquetTableDescriptors;
};

export type MountainMineshaftBanquetCollider = {
  args: [number, number, number];
  positionOffset: [number, number, number];
  rotation?: [number, number, number];
};

export type MountainMineshaftBanquetChairCollider = MountainMineshaftBanquetCollider & {
  index: number;
  rotation: [number, number, number];
};

export type MountainMineshaftBanquetColliderDetails = {
  table: MountainMineshaftBanquetCollider;
  throne: MountainMineshaftBanquetCollider;
  chairs: MountainMineshaftBanquetChairCollider[];
};

const MOUNTAIN_MINESHAFT_BANQUET_BREAD_POSITIONS = [
  { x: -2.9, z: -1.3 },
  { x: 2.65, z: 1.45 },
  { x: -0.9, z: 3.2 },
  { x: 1.34, z: -3.1 },
] as const;
const MOUNTAIN_MINESHAFT_FRUIT_BOWL_POSITIONS = [
  { x: -3.7, z: 1.7 },
  { x: 3.55, z: -1.55 },
  { x: 0.8, z: 3.9 },
  { x: -1.2, z: -3.75 },
] as const;
const MOUNTAIN_MINESHAFT_FRUIT_COLORS = ["#b7202e", "#d6a43e", "#7aa34b", "#8a2b5f", "#efc55b"];
const MOUNTAIN_MINESHAFT_TABLE_CANDLE_POSITIONS = [
  { x: -1.8, z: 2.2 },
  { x: 1.8, z: -2.2 },
] as const;
const MOUNTAIN_MINESHAFT_BANQUET_PLATE_ANGLES = [
  ...MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_ANGLES,
  Math.PI,
] as const;

let royalBanquetDescriptorCache: MountainMineshaftRoyalBanquetDescriptors | null = null;
let banquetColliderDescriptorCache: MountainMineshaftBanquetColliderDetails | null = null;

export function getMountainMineshaftRoyalBanquetDescriptors(): MountainMineshaftRoyalBanquetDescriptors {
  if (royalBanquetDescriptorCache) return royalBanquetDescriptorCache;

  const bottomLights = new Array<MountainMineshaftBottomLightDescriptor>(MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_LIGHT_COUNT);
  for (let index = 0; index < MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_LIGHT_COUNT; index += 1) {
    const angle = (index / MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_LIGHT_COUNT) * Math.PI * 2;
    bottomLights[index] = {
      index,
      position: [
        Math.sin(angle) * MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_LIGHT_RADIUS,
        0.08,
        Math.cos(angle) * MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_LIGHT_RADIUS,
      ],
      rotation: [0, angle + Math.PI, 0],
      bodyColor: index % 2 === 0 ? "#5c3d24" : "#372315",
      withLight: index % 3 === 0,
    };
  }

  const chairs = new Array<MountainMineshaftBanquetChairDescriptor>(MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_ANGLES.length);
  for (let index = 0; index < MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_ANGLES.length; index += 1) {
    const angle = MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_ANGLES[index];
    chairs[index] = {
      index,
      position: [
        Math.sin(angle) * MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_RADIUS,
        0,
        Math.cos(angle) * MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_CHAIR_RADIUS,
      ],
      rotation: [0, angle, 0],
      seatColor: index % 2 === 0 ? "#6f4528" : "#55341e",
    };
  }

  const tableRadius = MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_TABLE_RADIUS;
  const planks = new Array<MountainMineshaftTablePlankDescriptor>(9);
  for (let index = 0; index < planks.length; index += 1) {
    const z = -tableRadius * 0.72 + index * ((tableRadius * 1.44) / 8);
    planks[index] = {
      index,
      z,
      width: Math.sqrt(Math.max(0, tableRadius * tableRadius - z * z)) * 1.82,
      color: index % 2 === 0 ? "#8a5b34" : "#3c2415",
    };
  }

  const legs = new Array<MountainMineshaftTableLegDescriptor>(6);
  for (let index = 0; index < legs.length; index += 1) {
    const angle = (index / legs.length) * Math.PI * 2;
    legs[index] = {
      index,
      position: [Math.sin(angle) * 3.95, 0.92, Math.cos(angle) * 3.95],
    };
  }

  const breads = new Array<MountainMineshaftBreadDescriptor>(MOUNTAIN_MINESHAFT_BANQUET_BREAD_POSITIONS.length);
  for (let index = 0; index < MOUNTAIN_MINESHAFT_BANQUET_BREAD_POSITIONS.length; index += 1) {
    const { x, z } = MOUNTAIN_MINESHAFT_BANQUET_BREAD_POSITIONS[index];
    breads[index] = {
      index,
      position: [x, 2.5, z],
      rotation: [0, index * 0.7, 0],
      color: index % 2 === 0 ? "#d29a4a" : "#b87833",
    };
  }

  const fruitBowls = new Array<MountainMineshaftFruitBowlDescriptor>(MOUNTAIN_MINESHAFT_FRUIT_BOWL_POSITIONS.length);
  for (let bowlIndex = 0; bowlIndex < MOUNTAIN_MINESHAFT_FRUIT_BOWL_POSITIONS.length; bowlIndex += 1) {
    const { x, z } = MOUNTAIN_MINESHAFT_FRUIT_BOWL_POSITIONS[bowlIndex];
    const fruits = new Array<MountainMineshaftFruitDescriptor>(5);
    for (let fruitIndex = 0; fruitIndex < fruits.length; fruitIndex += 1) {
      fruits[fruitIndex] = {
        index: fruitIndex,
        position: [(fruitIndex - 2) * 0.22, 0.18 + (fruitIndex % 2) * 0.12, Math.sin(fruitIndex) * 0.24],
        color: MOUNTAIN_MINESHAFT_FRUIT_COLORS[(fruitIndex + bowlIndex) % MOUNTAIN_MINESHAFT_FRUIT_COLORS.length],
      };
    }
    fruitBowls[bowlIndex] = {
      index: bowlIndex,
      position: [x, 2.48, z],
      fruits,
    };
  }

  const plates = new Array<MountainMineshaftPlateDescriptor>(MOUNTAIN_MINESHAFT_BANQUET_PLATE_ANGLES.length);
  for (let index = 0; index < MOUNTAIN_MINESHAFT_BANQUET_PLATE_ANGLES.length; index += 1) {
    const angle = MOUNTAIN_MINESHAFT_BANQUET_PLATE_ANGLES[index];
    plates[index] = {
      index,
      position: [Math.sin(angle) * 4.5, 2.42, Math.cos(angle) * 4.5],
      rotation: [0, angle, 0],
      foodColor: index % 3 === 0 ? "#89422b" : "#c38a42",
    };
  }

  const candles = new Array<MountainMineshaftCandleDescriptor>(MOUNTAIN_MINESHAFT_TABLE_CANDLE_POSITIONS.length);
  for (let index = 0; index < MOUNTAIN_MINESHAFT_TABLE_CANDLE_POSITIONS.length; index += 1) {
    const { x, z } = MOUNTAIN_MINESHAFT_TABLE_CANDLE_POSITIONS[index];
    candles[index] = {
      index,
      position: [x, 2.54, z],
    };
  }

  royalBanquetDescriptorCache = {
    bottomLights,
    chairs,
    table: {
      radius: tableRadius,
      planks,
      legs,
      breads,
      fruitBowls,
      plates,
      candles,
    },
  };
  return royalBanquetDescriptorCache;
}

export function getMountainMineshaftBanquetColliderDetails(): MountainMineshaftBanquetColliderDetails {
  if (banquetColliderDescriptorCache) return banquetColliderDescriptorCache;

  const { chairs } = getMountainMineshaftRoyalBanquetDescriptors();
  const chairColliders = new Array<MountainMineshaftBanquetChairCollider>(chairs.length);
  for (let index = 0; index < chairs.length; index += 1) {
    const chair = chairs[index];
    chairColliders[index] = {
      index: chair.index,
      args: [1.18, 1.35, 1.05],
      positionOffset: [chair.position[0], 1.28, chair.position[2]],
      rotation: chair.rotation,
    };
  }

  banquetColliderDescriptorCache = {
    table: {
      args: [
        MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_TABLE_RADIUS * 0.82,
        1.18,
        MOUNTAIN_VILLAGE_MINESHAFT_BANQUET_TABLE_RADIUS * 0.82,
      ],
      positionOffset: [0, 1.2, 0],
    },
    throne: {
      args: [2.65, 2.2, 1.85],
      positionOffset: [0, 2.12, MOUNTAIN_VILLAGE_MINESHAFT_THRONE_Z],
      rotation: [0, Math.PI, 0],
    },
    chairs: chairColliders,
  };
  return banquetColliderDescriptorCache;
}

export function getMountainMineshaftBanquetRuntimeSummary() {
  const descriptors = getMountainMineshaftRoyalBanquetDescriptors();
  const colliders = getMountainMineshaftBanquetColliderDetails();
  return {
    bottomLightCount: descriptors.bottomLights.length,
    chairCount: descriptors.chairs.length,
    tablePlankCount: descriptors.table.planks.length,
    tableLegCount: descriptors.table.legs.length,
    breadCount: descriptors.table.breads.length,
    fruitBowlCount: descriptors.table.fruitBowls.length,
    fruitCount: descriptors.table.fruitBowls.reduce((sum, bowl) => sum + bowl.fruits.length, 0),
    plateCount: descriptors.table.plates.length,
    candleCount: descriptors.table.candles.length,
    chairColliderCount: colliders.chairs.length,
  };
}
