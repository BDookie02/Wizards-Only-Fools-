import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  DARREL_DRAGON_FOUGHT_FLAG,
  DARREL_DRAGON_NPC_ID,
  DARREL_DRAGON_PEACEFUL_FLAG,
  DARREL_DRAGON_WOKEN_FLAG,
  DARREL_POTION_FLAG,
  SURVIVAL_BLOCK_SIZE,
  type ControllerButtonName,
  useGameStore,
} from "../../../../store/gameStore";
import { isMobilePerformanceMode } from "../../input/performanceMode";
import { useLazyRef } from "../../react/useLazyRef";
import { configurePixelSpriteTexture } from "../../rendering/textures/pixelSpriteTexture";
import { getDarrelPetalNoise } from "../../rendering/textures/textureNoise";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { HIDE_FROM_MINIMAP } from "../vegetation/SurvivalFoliagePrimitives";
import {
  getDarrelBlossomTexture,
  getDarrelFujiTexture,
  getDarrelPetalCarpetTexture,
  getDarrelPetalTexture,
  getDarrelTexture,
} from "./darrelGroveTextures";
import {
  getDarrelBranchTransform,
  getDarrelHillStairRamp,
  getDarrelHillSteps,
  getDarrelQuestGateNowMs,
  getDarrelSideStairLayout,
} from "./darrelGroveRuntime";
import { SURVIVAL_DARREL_GROVE_HALF_SIZE as DARREL_GROVE_HALF_SIZE } from "./survivalVillageRegistry";

const DARREL_GROVE_GROUND_Y = 18;
const DARREL_HUT_HILL_HEIGHT = 8.8;
const DARREL_HUT_HILL_SURFACE_OFFSET = DARREL_HUT_HILL_HEIGHT + 2.05;
const DARREL_HUT_BASE_LIFT = 3.25;
const DARREL_HUT_FOUNDATION_HEIGHT = DARREL_HUT_BASE_LIFT - 2.05;
const DARREL_HUT_BASE_Y = DARREL_GROVE_GROUND_Y + DARREL_HUT_HILL_HEIGHT + DARREL_HUT_BASE_LIFT;
const DARREL_HUT_ENTRY_SURFACE_OFFSET = DARREL_HUT_HILL_HEIGHT + DARREL_HUT_BASE_LIFT + 2.1;
const DARREL_SIDE_SIGNS = [-1, 1] as const;
const DARREL_HUT_TATAMI_X = [-20, 0, 20] as const;
const DARREL_HUT_TABLE_LEG_X = [-7, 7] as const;
const DARREL_HUT_CUSHION_X = [-16, 16] as const;
const DARREL_HUT_SHELF_Y = [0, 5.5, 11] as const;
const DARREL_HUT_JAR_Z = [-9, 0, 9] as const;
const DARREL_HUT_LANTERN_X = [-28, 28] as const;
const DARREL_HUT_FOUNDATION_FRONT_STONE_X = [-42, -28, 28, 42] as const;
const DARREL_HUT_FRONT_POST_X = [-34, -14, 14, 34] as const;
const DARREL_WATERFALL_CASCADE_INDICES = [0, 1, 2] as const;
const DARREL_MOAT_STONE_RADII = [84, 116] as const;
const DARREL_MOAT_BRIDGE_RAIL_SIDE_SIGNS = [-1, 1] as const;
const DARREL_MOAT_BRIDGES = [
  { key: "front", z: -101, width: 38, depth: 58, railZ: [-76] as const, deckColor: "#7a4a2b" },
  { key: "back", z: 101, width: 26, depth: 52, railZ: [78, 124] as const, deckColor: "#6b4228" },
] as const;
const DARREL_HILL_SIDE_STONE_X = [-54, 54] as const;
const DARREL_BACKYARD_RIVER_STONE_X = [-170, -128, -88, -48, -8, 34, 78, 122, 166] as const;
const DARREL_BACKYARD_BRIDGE_RAIL_X = [-25, 25] as const;
const DARREL_WATERFALL_RUNNEL_Z = [128, 148, 166] as const;
const DARREL_RETURN_GATE_POST_X = [-8, 8] as const;
const DARREL_GROUND_BLOSSOM_X = [-118, -74, 72, 126] as const;
const DARREL_FALLEN_PETAL_TARGET_COUNT = 360;
const DARREL_FALLING_PETAL_COUNT = 68;
const MOBILE_DARREL_WATER_UPDATE_INTERVAL_SECONDS = 1 / 30;
const MOBILE_DARREL_FALLING_PETAL_UPDATE_INTERVAL_SECONDS = 1 / 24;
const MOBILE_DARREL_DRAGON_VISUAL_UPDATE_INTERVAL_SECONDS = 1 / 24;

type DarrelBlossomSprite = {
  key: number;
  x: number;
  y: number;
  z: number;
  scale: number;
};

function DarrelBranch({
  start,
  end,
  radius,
  texture,
}: {
  start: [number, number, number];
  end: [number, number, number];
  radius: number;
  texture: THREE.Texture;
}) {
  const data = useMemo(() => getDarrelBranchTransform(start, end), [start, end]);

  return (
    <mesh position={data.midpoint} quaternion={data.quaternion} castShadow receiveShadow>
      <cylinderGeometry args={[radius * 0.72, radius, data.length, 8, 1]} />
      <meshStandardMaterial map={texture} color="#556064" roughness={0.95} metalness={0} />
    </mesh>
  );
}

function DarrelBlossomCluster({
  position,
  size = 5,
  count = 6,
}: {
  position: [number, number, number];
  size?: number;
  count?: number;
}) {
  const blossomTexture = useMemo(() => getDarrelBlossomTexture(), []);
  const blossoms = useMemo(() => {
    const generated: DarrelBlossomSprite[] = [];
    for (let index = 0; index < count; index += 1) {
      const angle = index * 2.399;
      generated.push({
        key: index,
        x: Math.cos(angle) * (1.2 + (index % 3) * 0.8),
        y: ((index % 4) - 1.5) * 1.15,
        z: Math.sin(angle) * (1.2 + (index % 2) * 0.7),
        scale: size * (0.72 + (index % 3) * 0.13),
      });
    }
    return generated;
  }, [count, size]);

  return (
    <group position={position} userData={HIDE_FROM_MINIMAP}>
      {blossoms.map((blossom) => (
        <sprite key={blossom.key} position={[blossom.x, blossom.y, blossom.z]} scale={[blossom.scale, blossom.scale, 1]}>
          <spriteMaterial map={blossomTexture} transparent alphaTest={0.12} depthWrite={false} toneMapped={false} />
        </sprite>
      ))}
    </group>
  );
}

function DarrelCanopyPad({
  position,
  scale,
  rotation = 0,
  texture,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  rotation?: number;
  texture: THREE.Texture;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale} userData={HIDE_FROM_MINIMAP}>
      <mesh scale={[1.01, 1.01, 1.01]} castShadow={false} receiveShadow renderOrder={4}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#1d3217" wireframe transparent opacity={0.44} depthWrite={false} />
      </mesh>
      <mesh castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial map={texture} color="#3f7a35" roughness={0.92} metalness={0} />
      </mesh>
    </group>
  );
}

function DarrelBonsaiTree({
  position,
  rotation = 0,
  scale = 1,
}: {
  position: [number, number, number];
  rotation?: number;
  scale?: number;
}) {
  const barkTexture = useMemo(() => getDarrelTexture("bark"), []);
  const leafTexture = useMemo(() => getDarrelTexture("leaf"), []);
  const branches = [
    [[0, 0, 0], [5, 8, -6], 5.2],
    [[5, 8, -6], [2, 17, -18], 4.5],
    [[2, 17, -18], [-4, 26, -33], 3.7],
    [[-4, 26, -33], [1, 34, -52], 2.9],
    [[1, 34, -52], [0, 40, -78], 2.25],
    [[-1, 29, -40], [-24, 34, -55], 1.9],
    [[2, 30, -42], [26, 34, -58], 1.85],
    [[0, 36, -62], [-36, 39, -82], 1.45],
    [[0, 36, -62], [36, 39, -84], 1.45],
    [[0, 39, -76], [-28, 41, -102], 1.15],
    [[0, 39, -76], [28, 41, -102], 1.15],
    [[0, 40, -78], [0, 41, -116], 1.1],
    [[2, 18, -20], [18, 22, -34], 1.7],
    [[-2, 20, -22], [-20, 25, -36], 1.65],
  ] as const;
  const canopyPads = [
    [-23, 39, -78, 27, 6.5, 18, -0.16],
    [22, 39.5, -80, 29, 6.2, 19, 0.14],
    [0, 41.5, -94, 36, 7.2, 22, 0],
    [-18, 43, -108, 26, 5.5, 16, 0.22],
    [18, 43, -110, 26, 5.5, 16, -0.22],
    [0, 40, -126, 28, 4.8, 15, 0],
    [-37, 36.5, -62, 19, 4.7, 13, -0.32],
    [37, 36.5, -64, 19, 4.7, 13, 0.32],
  ] as const;
  const clusters = [
    [-24, 43, -78, 9.6],
    [22, 43, -80, 9.8],
    [0, 46, -94, 11.4],
    [-18, 47, -108, 9.2],
    [18, 47, -110, 9.2],
    [0, 44, -126, 10.6],
    [-37, 40, -62, 8.2],
    [37, 40, -64, 8.2],
    [-12, 37, -42, 7.4],
    [14, 38, -46, 7.4],
  ] as const;

  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      {branches.map(([start, end, radius], index) => (
        <DarrelBranch
          key={index}
          start={start as [number, number, number]}
          end={end as [number, number, number]}
          radius={radius}
          texture={barkTexture}
        />
      ))}
      {canopyPads.map(([x, y, z, sx, sy, sz, padRotation], index) => (
        <DarrelCanopyPad
          key={`canopy-${index}`}
          position={[x, y, z]}
          scale={[sx, sy, sz]}
          rotation={padRotation}
          texture={leafTexture}
        />
      ))}
      {clusters.map(([x, y, z, size], index) => (
        <DarrelBlossomCluster key={index} position={[x, y, z]} size={size} count={index % 2 === 0 ? 11 : 9} />
      ))}
      <mesh position={[0, 0.8, 0]} receiveShadow>
        <cylinderGeometry args={[8, 10, 1.6, 8]} />
        <meshStandardMaterial map={barkTexture} color="#384145" roughness={1} />
      </mesh>
    </group>
  );
}

function DarrelLegacyBonsaiTree({
  position,
  rotation = 0,
  scale = 1,
}: {
  position: [number, number, number];
  rotation?: number;
  scale?: number;
}) {
  const barkTexture = useMemo(() => getDarrelTexture("bark"), []);
  const branches = [
    [[0, 0, 0], [2, 18, -1], 4.8],
    [[2, 16, -1], [-7, 34, 4], 3.8],
    [[-5, 31, 3], [-22, 43, -4], 2.6],
    [[-8, 34, 4], [-14, 54, 10], 2.2],
    [[2, 18, -1], [13, 34, -8], 3.2],
    [[12, 33, -8], [32, 43, -18], 2.4],
    [[14, 34, -8], [18, 56, -5], 2.1],
    [[0, 10, 0], [-18, 22, -15], 2.7],
    [[-17, 21, -14], [-32, 28, -26], 1.7],
    [[1, 24, -1], [4, 47, 12], 2.9],
    [[4, 45, 12], [18, 62, 18], 1.8],
    [[2, 42, 0], [44, 70, 26], 2.1],
    [[-2, 45, 0], [-44, 72, -18], 2],
    [[0, 48, 0], [0, 82, 48], 1.8],
    [[0, 50, 0], [38, 78, -38], 1.6],
  ] as const;
  const clusters = [
    [-23, 43, -4, 10.2],
    [-14, 55, 10, 9],
    [32, 43, -18, 10],
    [18, 56, -5, 8.8],
    [-32, 28, -26, 8.4],
    [18, 62, 18, 9.2],
    [-7, 34, 4, 8],
    [12, 33, -8, 7.8],
    [44, 70, 26, 13.4],
    [-44, 72, -18, 13],
    [0, 82, 48, 12.6],
    [38, 78, -38, 12.2],
  ] as const;

  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      {branches.map(([start, end, radius], index) => (
        <DarrelBranch
          key={index}
          start={start as [number, number, number]}
          end={end as [number, number, number]}
          radius={radius}
          texture={barkTexture}
        />
      ))}
      {clusters.map(([x, y, z, size], index) => (
        <DarrelBlossomCluster key={index} position={[x, y, z]} size={size} count={index % 2 === 0 ? 11 : 9} />
      ))}
      <mesh position={[0, 0.8, 0]} receiveShadow>
        <cylinderGeometry args={[8, 10, 1.6, 8]} />
        <meshStandardMaterial map={barkTexture} color="#384145" roughness={1} />
      </mesh>
    </group>
  );
}

function DarrelHutFurniture() {
  const woodTexture = useMemo(() => getDarrelTexture("wood"), []);
  const tatamiTexture = useMemo(() => getDarrelTexture("tatami"), []);
  const wallTexture = useMemo(() => getDarrelTexture("wall"), []);

  return (
    <group>
      {DARREL_HUT_TATAMI_X.map((x) => (
        <mesh key={`mat-a-${x}`} position={[x, 1.08, -6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[18, 28]} />
          <meshStandardMaterial map={tatamiTexture} color="#f0df92" roughness={1} />
        </mesh>
      ))}
      {DARREL_HUT_TATAMI_X.map((x) => (
        <mesh key={`mat-b-${x}`} position={[x, 1.09, 17]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} receiveShadow>
          <planeGeometry args={[16, 28]} />
          <meshStandardMaterial map={tatamiTexture} color="#d6cf83" roughness={1} />
        </mesh>
      ))}
      <group position={[0, 2.4, -4]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[18, 1.4, 10]} />
          <meshStandardMaterial map={woodTexture} color="#7b4b2b" roughness={0.9} />
        </mesh>
        {DARREL_HUT_TABLE_LEG_X.map((x) => (
          <mesh key={`table-leg-${x}`} position={[x, -2.6, -3]} castShadow>
            <boxGeometry args={[1.4, 4.2, 1.4]} />
            <meshStandardMaterial map={woodTexture} color="#4a2c1a" roughness={0.95} />
          </mesh>
        ))}
        {DARREL_HUT_TABLE_LEG_X.map((x) => (
          <mesh key={`table-leg-b-${x}`} position={[x, -2.6, 3]} castShadow>
            <boxGeometry args={[1.4, 4.2, 1.4]} />
            <meshStandardMaterial map={woodTexture} color="#4a2c1a" roughness={0.95} />
          </mesh>
        ))}
        <mesh position={[0, 1.25, 0]} castShadow>
          <cylinderGeometry args={[2.2, 2.2, 1.1, 8]} />
          <meshStandardMaterial color="#d9a441" roughness={0.7} />
        </mesh>
      </group>
      {DARREL_HUT_CUSHION_X.map((x) => (
        <mesh key={`cushion-${x}`} position={[x, 1.45, -5]} castShadow>
          <boxGeometry args={[8, 0.8, 7]} />
          <meshStandardMaterial color={x < 0 ? "#b91c1c" : "#1d4ed8"} roughness={0.9} />
        </mesh>
      ))}
      <group position={[-31.5, 7, 8]}>
        {DARREL_HUT_SHELF_Y.map((y) => (
          <mesh key={`shelf-${y}`} position={[0, y, 0]} castShadow receiveShadow>
            <boxGeometry args={[2, 1.2, 26]} />
            <meshStandardMaterial map={woodTexture} color="#5b341e" roughness={0.95} />
          </mesh>
        ))}
        {DARREL_HUT_JAR_Z.map((z, index) => (
          <mesh key={`jar-${z}`} position={[0.4, 12.2, z]} castShadow>
            <cylinderGeometry args={[1.6, 1.9, 3.4, 8]} />
            <meshStandardMaterial color={index % 2 ? "#94a3b8" : "#d97706"} roughness={0.8} />
          </mesh>
        ))}
      </group>
      <mesh position={[31.1, 9.2, 2]} rotation={[0, -Math.PI / 2, 0]} castShadow>
        <planeGeometry args={[14, 18]} />
        <meshStandardMaterial map={wallTexture} color="#f4deb0" roughness={1} />
      </mesh>
      <mesh position={[31.0, 9.2, 2.1]} rotation={[0, -Math.PI / 2, 0]} castShadow>
        <planeGeometry args={[10, 12]} />
        <meshBasicMaterial color="#111827" transparent opacity={0.16} />
      </mesh>
      <mesh position={[0, 9.5, 28.8]} rotation={[0, Math.PI, 0]} castShadow>
        <planeGeometry args={[16, 18]} />
        <meshStandardMaterial color="#fef3c7" roughness={1} />
      </mesh>
      <mesh position={[0, 9.4, 28.7]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[10, 11]} />
        <meshBasicMaterial color="#991b1b" transparent opacity={0.28} />
      </mesh>
      {DARREL_HUT_LANTERN_X.map((x) => (
        <pointLight key={`lantern-light-${x}`} position={[x, 12, -18]} color="#ffb454" intensity={3.2} distance={30} decay={2} />
      ))}
      {DARREL_HUT_LANTERN_X.map((x) => (
        <group key={`lantern-${x}`} position={[x, 11, -18]}>
          <mesh renderOrder={5}>
            <sphereGeometry args={[5.2, 8, 6]} />
            <meshBasicMaterial color="#ffb454" transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh castShadow>
            <boxGeometry args={[3.8, 4.5, 3.8]} />
            <meshBasicMaterial color="#ffb454" transparent opacity={0.95} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function DarrelChineseHut() {
  const wallTexture = useMemo(() => getDarrelTexture("wall"), []);
  const roofTexture = useMemo(() => getDarrelTexture("roof"), []);
  const woodTexture = useMemo(() => getDarrelTexture("wood"), []);
  const stoneTexture = useMemo(() => getDarrelTexture("stone"), []);
  const width = 78;
  const depth = 62;
  const wallHeight = 28;
  const wallThickness = 2.4;
  const doorWidth = 20;
  const wallCenterY = wallHeight / 2 + 1;
  const roofLift = 11;
  const foundationWidth = width + 20;
  const foundationDepth = depth + 48;
  const foundationZ = -10;
  const foundationCenterY = -DARREL_HUT_FOUNDATION_HEIGHT / 2;
  const foundationFrontSupportDepth = 34;
  const foundationRearDepth = foundationDepth - foundationFrontSupportDepth;
  const foundationFrontZ = foundationZ - foundationDepth / 2;
  const foundationFrontSupportZ = foundationFrontZ + foundationFrontSupportDepth / 2;
  const foundationRearZ = foundationFrontZ + foundationFrontSupportDepth + foundationRearDepth / 2;
  const foundationOpeningHalfWidth = 22;
  const foundationFrontSupportWidth = (foundationWidth - foundationOpeningHalfWidth * 2) / 2;
  const foundationSideX = foundationOpeningHalfWidth + foundationFrontSupportWidth / 2;
  const foundationTrimHeight = Math.min(0.7, DARREL_HUT_FOUNDATION_HEIGHT * 0.56);
  const foundationTrimY = foundationCenterY + DARREL_HUT_FOUNDATION_HEIGHT * 0.34;
  const porchDepth = 30;
  const porchZ = -50;
  const porchTopY = 2.12;
  const porchHalfWidth = 23;
  const sideStairRun = 17;
  const sideStairDepth = porchDepth - 2.4;
  const sideStairCount = 4;
  const sideStairLayout = useMemo(
    () =>
      getDarrelSideStairLayout({
        porchHalfWidth,
        porchTopY,
        porchZ,
        sideStairRun,
        sideStairCount,
      }),
    [porchHalfWidth, porchTopY, porchZ, sideStairRun, sideStairCount],
  );

  return (
    <group position={[0, DARREL_HUT_BASE_Y, 0]}>
      <RigidBody type="fixed" colliders={false} name="darrel-grove-hut">
        <CuboidCollider args={[foundationWidth / 2, DARREL_HUT_FOUNDATION_HEIGHT / 2, foundationRearDepth / 2]} position={[0, foundationCenterY, foundationRearZ]} />
        <CuboidCollider args={[foundationFrontSupportWidth / 2, DARREL_HUT_FOUNDATION_HEIGHT / 2, foundationFrontSupportDepth / 2]} position={[-foundationSideX, foundationCenterY, foundationFrontSupportZ]} />
        <CuboidCollider args={[foundationFrontSupportWidth / 2, DARREL_HUT_FOUNDATION_HEIGHT / 2, foundationFrontSupportDepth / 2]} position={[foundationSideX, foundationCenterY, foundationFrontSupportZ]} />
        <CuboidCollider args={[width / 2, 1, depth / 2]} position={[0, 1, 0]} />
        <CuboidCollider args={[23, 1, porchDepth / 2]} position={[0, 1, porchZ]} />
        <CuboidCollider args={[width / 2, wallHeight / 2, wallThickness / 2]} position={[0, wallCenterY, depth / 2]} />
        <CuboidCollider args={[wallThickness / 2, wallHeight / 2, depth / 2]} position={[-width / 2, wallCenterY, 0]} />
        <CuboidCollider args={[wallThickness / 2, wallHeight / 2, depth / 2]} position={[width / 2, wallCenterY, 0]} />
        <CuboidCollider args={[(width - doorWidth) / 4, wallHeight / 2, wallThickness / 2]} position={[-(doorWidth / 2 + (width - doorWidth) / 4), wallCenterY, -depth / 2]} />
        <CuboidCollider args={[(width - doorWidth) / 4, wallHeight / 2, wallThickness / 2]} position={[(doorWidth / 2 + (width - doorWidth) / 4), wallCenterY, -depth / 2]} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false} friction={0.96} restitution={0} name="darrel-hut-side-stair-ramp">
        {sideStairLayout.ramps.map((ramp) => (
          <CuboidCollider
            key={`hut-side-step-smooth-ramp-${ramp.side}`}
            args={[sideStairLayout.rampLength / 2, sideStairLayout.rampHalfThickness, sideStairDepth / 2]}
            position={ramp.position}
            rotation={ramp.rotation}
          />
        ))}
      </RigidBody>
      <mesh position={[0, foundationCenterY, foundationRearZ]} castShadow receiveShadow>
        <boxGeometry args={[foundationWidth, DARREL_HUT_FOUNDATION_HEIGHT, foundationRearDepth]} />
        <meshStandardMaterial map={stoneTexture} color="#777f78" roughness={1} />
      </mesh>
      {DARREL_SIDE_SIGNS.map((side) => (
        <mesh key={`hut-foundation-front-support-${side}`} position={[side * foundationSideX, foundationCenterY, foundationFrontSupportZ]} castShadow receiveShadow>
          <boxGeometry args={[foundationFrontSupportWidth, DARREL_HUT_FOUNDATION_HEIGHT, foundationFrontSupportDepth]} />
          <meshStandardMaterial map={stoneTexture} color="#747c75" roughness={1} />
        </mesh>
      ))}
      {DARREL_SIDE_SIGNS.map((side) => (
        <mesh key={`hut-foundation-front-trim-${side}`} position={[side * foundationSideX, foundationTrimY, foundationFrontZ - 0.35]} castShadow receiveShadow>
          <boxGeometry args={[foundationFrontSupportWidth + 4, foundationTrimHeight, 2.4]} />
          <meshStandardMaterial map={stoneTexture} color="#949b93" roughness={1} />
        </mesh>
      ))}
      {DARREL_HUT_FOUNDATION_FRONT_STONE_X.map((x) => (
        <mesh key={`hut-foundation-front-stone-${x}`} position={[x, foundationCenterY - 0.2, foundationFrontZ - 0.8]} castShadow receiveShadow>
          <boxGeometry args={[8, DARREL_HUT_FOUNDATION_HEIGHT * 0.72, 1.2]} />
          <meshStandardMaterial map={stoneTexture} color={Math.abs(x) < 30 ? "#8c948c" : "#6f776f"} roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, 1.05, 0]} receiveShadow>
        <boxGeometry args={[width + 8, 2.1, depth + 8]} />
        <meshStandardMaterial map={woodTexture} color="#7a4a2b" roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.05, porchZ]} castShadow receiveShadow>
        <boxGeometry args={[46, 2.1, porchDepth]} />
        <meshStandardMaterial map={woodTexture} color="#825433" roughness={0.95} />
      </mesh>
      {sideStairLayout.steps.map(({ side, index, x, stepHeight }) => (
        <group key={`hut-side-step-${side}-${index}`} position={[x, stepHeight / 2, porchZ]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[sideStairLayout.stepWidth + 0.18, stepHeight, sideStairDepth]} />
            <meshStandardMaterial map={stoneTexture} color={index % 2 === 0 ? "#7f887d" : "#949b90"} roughness={1} />
          </mesh>
          <mesh position={[0, stepHeight / 2 + 0.065, 0]} castShadow receiveShadow>
            <boxGeometry args={[sideStairLayout.stepWidth + 0.44, 0.13, sideStairDepth + 0.42]} />
            <meshStandardMaterial map={woodTexture} color={index === sideStairCount - 1 ? "#8b5a36" : "#745037"} roughness={0.95} />
          </mesh>
        </group>
      ))}
      <mesh position={[-width / 2, wallCenterY, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, wallHeight, depth]} />
        <meshStandardMaterial map={wallTexture} color="#d9b77f" roughness={1} />
      </mesh>
      <mesh position={[width / 2, wallCenterY, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, wallHeight, depth]} />
        <meshStandardMaterial map={wallTexture} color="#d9b77f" roughness={1} />
      </mesh>
      <mesh position={[0, wallCenterY, depth / 2]} castShadow receiveShadow>
        <boxGeometry args={[width, wallHeight, 2.2]} />
        <meshStandardMaterial map={wallTexture} color="#d9b77f" roughness={1} />
      </mesh>
      <mesh position={[-(doorWidth / 2 + 14), wallCenterY, -depth / 2]} castShadow receiveShadow>
        <boxGeometry args={[28, wallHeight, 2.2]} />
        <meshStandardMaterial map={wallTexture} color="#d9b77f" roughness={1} />
      </mesh>
      <mesh position={[(doorWidth / 2 + 14), wallCenterY, -depth / 2]} castShadow receiveShadow>
        <boxGeometry args={[28, wallHeight, 2.2]} />
        <meshStandardMaterial map={wallTexture} color="#d9b77f" roughness={1} />
      </mesh>
      {DARREL_HUT_FRONT_POST_X.map((x) => (
        <mesh key={`front-post-${x}`} position={[x, 15.5, -35.2]} castShadow>
          <cylinderGeometry args={[1.7, 2, 31, 8]} />
          <meshStandardMaterial map={woodTexture} color="#8b1f24" roughness={0.8} />
        </mesh>
      ))}
      <DarrelHutFurniture />
      <mesh position={[0, 20.5 + roofLift, 0]} castShadow receiveShadow>
        <boxGeometry args={[94, 4, 78]} />
        <meshStandardMaterial map={roofTexture} color="#7f1d1d" roughness={0.86} />
      </mesh>
      <mesh position={[0, 24.2 + roofLift, 0]} castShadow receiveShadow>
        <boxGeometry args={[70, 5, 54]} />
        <meshStandardMaterial map={roofTexture} color="#991b1b" roughness={0.86} />
      </mesh>
      <mesh position={[0, 27.5 + roofLift, 0]} castShadow receiveShadow>
        <boxGeometry args={[42, 3.4, 28]} />
        <meshStandardMaterial map={roofTexture} color="#5c1117" roughness={0.9} />
      </mesh>
      <mesh position={[-49, 19.4 + roofLift, 0]} rotation={[0, 0, -0.17]} castShadow>
        <boxGeometry args={[4, 3.2, 80]} />
        <meshStandardMaterial map={roofTexture} color="#3f1115" roughness={0.9} />
      </mesh>
      <mesh position={[49, 19.4 + roofLift, 0]} rotation={[0, 0, 0.17]} castShadow>
        <boxGeometry args={[4, 3.2, 80]} />
        <meshStandardMaterial map={roofTexture} color="#3f1115" roughness={0.9} />
      </mesh>
      <mesh position={[0, 19.4 + roofLift, -41]} rotation={[0, Math.PI / 2, -0.17]} castShadow>
        <boxGeometry args={[4, 3.2, 80]} />
        <meshStandardMaterial map={roofTexture} color="#3f1115" roughness={0.9} />
      </mesh>
      <mesh position={[0, 19.4 + roofLift, 41]} rotation={[0, Math.PI / 2, 0.17]} castShadow>
        <boxGeometry args={[4, 3.2, 80]} />
        <meshStandardMaterial map={roofTexture} color="#3f1115" roughness={0.9} />
      </mesh>
    </group>
  );
}

function DarrelHouseHillAndMoat() {
  const groundTexture = useMemo(() => getDarrelTexture("ground"), []);
  const waterTexture = useMemo(() => getDarrelTexture("water"), []);
  const stoneTexture = useMemo(() => getDarrelTexture("stone"), []);
  const woodTexture = useMemo(() => getDarrelTexture("wood"), []);
  const stepCount = 16;
  const stairRamp = useMemo(
    () => getDarrelHillStairRamp(-120.5, -44, 1.55, DARREL_HUT_ENTRY_SURFACE_OFFSET + 0.05, 0.44),
    [],
  );
  const steps = useMemo(() => getDarrelHillSteps(DARREL_HUT_ENTRY_SURFACE_OFFSET, stepCount), [stepCount]);

  return (
    <group name="darrel-house-hill-and-moat" position={[0, DARREL_GROVE_GROUND_Y, 0]}>
      <RigidBody type="fixed" colliders={false} name="darrel-house-hill">
        <CuboidCollider args={[70, 0.9, 56]} position={[0, DARREL_HUT_HILL_SURFACE_OFFSET - 0.45, 0]} />
        <CuboidCollider args={[18, 0.7, 28]} position={[0, 0.72, -101]} />
        <CuboidCollider args={[12, 0.6, 25]} position={[0, 0.65, 101]} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false} friction={0.9} restitution={0} name="darrel-front-stair-smooth-ramp">
        <CuboidCollider
          args={[15.5, stairRamp.halfThickness, stairRamp.length / 2]}
          position={[0, stairRamp.centerY, stairRamp.centerZ]}
          rotation={[stairRamp.angle, 0, 0]}
        />
      </RigidBody>
      <RigidBody type="fixed" colliders="trimesh" friction={0.82} restitution={0} name="darrel-house-hill-slope">
        <mesh position={[0, DARREL_HUT_HILL_SURFACE_OFFSET / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[72, 108, DARREL_HUT_HILL_SURFACE_OFFSET, 56, 1]} />
          <meshStandardMaterial map={groundTexture} color="#87b66a" roughness={1} />
        </mesh>
      </RigidBody>
      <mesh position={[0, DARREL_HUT_HILL_SURFACE_OFFSET + 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[73, 56]} />
        <meshStandardMaterial map={groundTexture} color="#9ccf78" roughness={1} />
      </mesh>
      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <ringGeometry args={[84, 116, 96, 1]} />
        <meshStandardMaterial
          map={waterTexture}
          color="#74d7e0"
          roughness={0.5}
          metalness={0.04}
          transparent
          opacity={0.88}
          side={THREE.DoubleSide}
        />
      </mesh>
      {DARREL_MOAT_STONE_RADII.map((radius, index) => (
        <mesh key={`moat-stone-ring-${radius}`} position={[0, 0.48 + index * 0.08, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <torusGeometry args={[radius, 1.35 + index * 0.25, 8, 96]} />
          <meshStandardMaterial map={stoneTexture} color={index === 0 ? "#8f958d" : "#6f776f"} roughness={1} />
        </mesh>
      ))}
      {DARREL_MOAT_BRIDGES.map((bridge) => (
        <group key={`moat-bridge-${bridge.key}`}>
          <mesh position={[0, 1.04, bridge.z]} castShadow receiveShadow>
            <boxGeometry args={[bridge.width, 1.4, bridge.depth]} />
            <meshStandardMaterial map={woodTexture} color={bridge.deckColor} roughness={0.92} />
          </mesh>
          {DARREL_MOAT_BRIDGE_RAIL_SIDE_SIGNS.map((side) => (
            <mesh key={`moat-bridge-rail-${bridge.key}-${side}`} position={[side * (bridge.width / 2 - 3), 3.2, bridge.z]} castShadow>
              <boxGeometry args={[2.2, 4.2, bridge.depth]} />
              <meshStandardMaterial map={woodTexture} color="#4b2e1c" roughness={0.95} />
            </mesh>
          ))}
          {bridge.railZ.map((z) => (
            <mesh key={`moat-bridge-end-${bridge.key}-${z}`} position={[0, 2.25, z]} castShadow>
              <boxGeometry args={[bridge.width + 4, 2.1, 2.2]} />
              <meshStandardMaterial map={woodTexture} color="#5b341e" roughness={0.95} />
            </mesh>
          ))}
        </group>
      ))}
      {steps.map((step, index) => (
        <mesh key={`hill-step-${index}`} position={[0, step.y / 2, step.z]} castShadow receiveShadow>
          <boxGeometry args={[step.width, step.y, step.depth]} />
          <meshStandardMaterial map={stoneTexture} color={index % 2 === 0 ? "#8f968d" : "#77806f"} roughness={1} />
        </mesh>
      ))}
      {DARREL_HILL_SIDE_STONE_X.map((x) => (
        <mesh key={`hill-side-stone-${x}`} position={[x, DARREL_HUT_HILL_SURFACE_OFFSET - 1.8, -38]} rotation={[0, x > 0 ? -0.2 : 0.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[12, 4, 18]} />
          <meshStandardMaterial map={stoneTexture} color="#757d73" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function DarrelBackyardRiver() {
  const waterTexture = useMemo(() => getDarrelTexture("water"), []);
  const stoneTexture = useMemo(() => getDarrelTexture("stone"), []);
  const segments = [
    { x: -110, z: 104, width: 112, depth: 34, rot: -0.18 },
    { x: -12, z: 116, width: 118, depth: 38, rot: 0.08 },
    { x: 96, z: 106, width: 124, depth: 34, rot: 0.22 },
  ];

  return (
    <group position={[0, DARREL_GROVE_GROUND_Y + 0.08, 0]}>
      {segments.map((segment, index) => (
        <mesh key={`river-${index}`} position={[segment.x, 0.05, segment.z]} rotation={[-Math.PI / 2, 0, segment.rot]} receiveShadow>
          <planeGeometry args={[segment.width, segment.depth]} />
          <meshStandardMaterial map={waterTexture} color="#49bfd0" roughness={0.58} metalness={0.05} transparent opacity={0.88} />
        </mesh>
      ))}
      {DARREL_BACKYARD_RIVER_STONE_X.map((x, index) => (
        <mesh key={`river-stone-${index}`} position={[x, 0.42, 135 + Math.sin(index) * 10]} rotation={[0, index * 0.7, 0]} castShadow receiveShadow>
          <boxGeometry args={[12 + (index % 3) * 3, 1.2, 7 + (index % 2) * 4]} />
          <meshStandardMaterial map={stoneTexture} color="#9aa09a" roughness={1} />
        </mesh>
      ))}
      <group position={[0, 2.1, 114]}>
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[58, 2.4, 9]} />
          <meshStandardMaterial map={getDarrelTexture("wood")} color="#7b4b2c" roughness={0.9} />
        </mesh>
        {DARREL_BACKYARD_BRIDGE_RAIL_X.map((x) => (
          <mesh key={`bridge-rail-${x}`} position={[x, 3.2, 0]} castShadow>
            <boxGeometry args={[2.2, 5.2, 11]} />
            <meshStandardMaterial map={getDarrelTexture("wood")} color="#4a2d1c" roughness={0.95} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function DarrelWaterfallHill() {
  const groundTexture = useMemo(() => getDarrelTexture("ground"), []);
  const fallWaterTexture = useMemo(() => {
    const texture = getDarrelTexture("water").clone();
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.15, 2.8);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return texture;
  }, []);
  const poolWaterTexture = useMemo(() => {
    const texture = getDarrelTexture("water").clone();
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.6, 1.7);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return texture;
  }, []);
  const runnelWaterTexture = useMemo(() => {
    const texture = getDarrelTexture("water").clone();
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.6, 1.15);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return texture;
  }, []);
  const stoneTexture = useMemo(() => getDarrelTexture("stone"), []);
  const leafTexture = useMemo(() => getDarrelTexture("leaf"), []);
  const fallMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const foamMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const poolMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const runnelRefs = useLazyRef<Array<THREE.Mesh | null>>(() => []);
  const sprayRefs = useLazyRef<Array<THREE.Mesh | null>>(() => []);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const lastMobileWaterUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);
  const hillStones = [
    [-62, 3.2, 28, 18, 5, 12, -0.3],
    [-42, 7.4, -24, 14, 7, 11, 0.48],
    [-24, 1.9, 62, 12, 3.8, 9, 0.16],
    [28, 6.8, 18, 18, 7, 12, -0.16],
    [52, 3.1, 41, 15, 4.8, 10, 0.33],
    [40, 10.5, -20, 15, 7.2, 10, -0.54],
  ] as const;
  const mossPads = [
    [-34, 24.35, -16, 26, 10, -0.18],
    [22, 23.9, -10, 24, 9, 0.2],
    [-50, 14.9, 10, 28, 8, 0.52],
    [48, 14.7, 7, 25, 8, -0.44],
  ] as const;
  const riverFeedChannels = [
    [-30, 184, 37, 20, -0.26],
    [-48, 210, 44, 22, -0.1],
    [-63, 238, 54, 24, 0.08],
    [30, 184, 37, 20, 0.26],
    [48, 210, 44, 22, 0.1],
    [63, 238, 54, 24, -0.08],
  ] as const;
  const riverMouths = [
    [-78, 251, 44, 17, -0.14],
    [78, 251, 44, 17, 0.14],
  ] as const;
  const sprayPuffs = [
    [-12, 5.8, 92, 3.8],
    [10, 6.6, 94, 4.2],
    [-4, 8.2, 87, 3.2],
    [18, 4.7, 89, 3.5],
    [-20, 4.9, 89, 3.4],
  ] as const;

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime;
    if (
      mobilePerformanceMode &&
      elapsed - lastMobileWaterUpdateAtRef.current < MOBILE_DARREL_WATER_UPDATE_INTERVAL_SECONDS
    ) {
      return;
    }
    lastMobileWaterUpdateAtRef.current = elapsed;

    fallWaterTexture.offset.y = (elapsed * 0.82) % 1;
    fallWaterTexture.offset.x = Math.sin(elapsed * 1.35) * 0.035;
    poolWaterTexture.offset.x = (elapsed * 0.08) % 1;
    poolWaterTexture.offset.y = Math.sin(elapsed * 0.62) * 0.035;
    runnelWaterTexture.offset.y = (elapsed * 0.36) % 1;
    runnelWaterTexture.offset.x = Math.sin(elapsed * 0.9) * 0.04;

    if (fallMaterialRef.current) {
      fallMaterialRef.current.opacity = 0.55 + Math.sin(elapsed * 4.2) * 0.08;
    }
    if (foamMaterialRef.current) {
      foamMaterialRef.current.opacity = 0.28 + Math.sin(elapsed * 5.1 + 0.8) * 0.08;
    }
    if (poolMaterialRef.current) {
      poolMaterialRef.current.opacity = 0.82 + Math.sin(elapsed * 1.7) * 0.06;
    }

    for (let index = 0; index < runnelRefs.current.length; index += 1) {
      const mesh = runnelRefs.current[index];
      if (!mesh) continue;
      mesh.position.x = Math.sin(index) * 7 + Math.sin(elapsed * 1.7 + index * 1.8) * 0.42;
    }
    for (let index = 0; index < sprayRefs.current.length; index += 1) {
      const mesh = sprayRefs.current[index];
      if (!mesh) continue;
      const [, baseY, , baseScale] = sprayPuffs[index] ?? [0, 0, 0, 1];
      const pulse = 0.86 + Math.sin(elapsed * 3.8 + index * 1.4) * 0.18;
      mesh.position.y = baseY + Math.sin(elapsed * 4.7 + index) * 0.42;
      mesh.scale.set(baseScale * pulse, baseScale * 0.45 * pulse, baseScale * pulse);
    }
  });

  return (
    <group name="darrel-waterfall-hill" position={[0, DARREL_GROVE_GROUND_Y, -145]}>
      <RigidBody type="fixed" colliders="trimesh" friction={0.95} restitution={0} name="darrel-waterfall-hill-slope">
        <mesh position={[0, 12.2, -4]} castShadow receiveShadow>
          <cylinderGeometry args={[44, 90, 24.4, 56, 1]} />
          <meshStandardMaterial map={groundTexture} color="#7fad62" roughness={1} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders={false} name="darrel-waterfall-hill-terraces">
        <CuboidCollider args={[43, 0.8, 22]} position={[0, 24.35, -12]} />
        <CuboidCollider args={[57, 0.65, 15]} position={[0, 15.1, 8]} />
        <CuboidCollider args={[24, 0.5, 12]} position={[0, 7.4, 36]} />
      </RigidBody>
      <mesh position={[0, 24.72, -12]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[38, 48]} />
        <meshStandardMaterial map={groundTexture} color="#9bd37a" roughness={1} />
      </mesh>
      <mesh position={[0, 13.7, 22]} castShadow receiveShadow>
        <boxGeometry args={[47, 27, 7]} />
        <meshStandardMaterial map={stoneTexture} color="#6f7b73" roughness={1} />
      </mesh>
      <mesh position={[0, 13.1, 67]} rotation={[-1.08, 0, 0]} renderOrder={12}>
        <planeGeometry args={[27, 63]} />
        <meshBasicMaterial ref={fallMaterialRef} map={fallWaterTexture} color="#8eeaff" transparent opacity={0.62} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-8} />
      </mesh>
      <mesh position={[0, 13.25, 67.24]} rotation={[-1.08, 0, 0]} renderOrder={13}>
        <planeGeometry args={[8, 60]} />
        <meshBasicMaterial ref={foamMaterialRef} color="#f1feff" transparent opacity={0.36} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-9} />
      </mesh>
      {DARREL_SIDE_SIGNS.map((side) => (
        <mesh key={`darrel-fall-edge-${side}`} position={[side * 14.8, 12.75, 67.32]} rotation={[-1.08, 0, 0]} renderOrder={13}>
          <planeGeometry args={[2.5, 58]} />
          <meshBasicMaterial color="#2e8fa8" transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-7} />
        </mesh>
      ))}
      {DARREL_WATERFALL_CASCADE_INDICES.map((index) => (
        <mesh
          key={`darrel-visible-cascade-${index}`}
          ref={(mesh) => {
            runnelRefs.current[index] = mesh;
          }}
          position={[(index - 1) * 7, 0.55 + index * 0.08, 102 + index * 16]}
          rotation={[-Math.PI / 2, 0, index === 1 ? 0 : index === 0 ? 0.16 : -0.14]}
          renderOrder={11}
        >
          <planeGeometry args={[22 - index * 3, 20]} />
          <meshStandardMaterial map={runnelWaterTexture} color="#5dc3d6" roughness={0.55} transparent opacity={0.64} depthWrite={false} />
        </mesh>
      ))}
      <mesh position={[0, 0.34, 94]} rotation={[-Math.PI / 2, 0, 0]} scale={[52, 32, 1]} renderOrder={4}>
        <circleGeometry args={[1, 32]} />
        <meshStandardMaterial ref={poolMaterialRef} map={poolWaterTexture} color="#65cddd" roughness={0.48} metalness={0.04} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 0.38, 94]} rotation={[-Math.PI / 2, 0, 0]} scale={[52, 32, 1]} renderOrder={4}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial color="#dffbff" transparent opacity={0.14} depthWrite={false} toneMapped={false} />
      </mesh>
      {DARREL_WATERFALL_RUNNEL_Z.map((z, index) => (
        <mesh
          key={`darrel-fall-runnel-${index}`}
          ref={(mesh) => {
            runnelRefs.current[index + 3] = mesh;
          }}
          position={[Math.sin(index) * 7, 0.2, z]}
          rotation={[-Math.PI / 2, 0, index % 2 === 0 ? 0.12 : -0.16]}
          renderOrder={3}
        >
          <planeGeometry args={[24 - index * 3, 18]} />
          <meshStandardMaterial map={runnelWaterTexture} color="#5dc3d6" roughness={0.55} transparent opacity={0.56} />
        </mesh>
      ))}
      {riverFeedChannels.map(([x, z, width, depth, yaw], index) => (
        <mesh key={`darrel-waterfall-feed-${index}`} position={[x, 0.24 + index * 0.003, z]} rotation={[-Math.PI / 2, 0, yaw]} renderOrder={4}>
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial
            map={runnelWaterTexture}
            color="#58c7d8"
            roughness={0.52}
            transparent
            opacity={0.58}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-4}
          />
        </mesh>
      ))}
      {riverMouths.map(([x, z, width, depth, yaw], index) => (
        <mesh key={`darrel-waterfall-river-mouth-${index}`} position={[x, 0.27 + index * 0.004, z]} rotation={[-Math.PI / 2, 0, yaw]} renderOrder={5}>
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial
            map={poolWaterTexture}
            color="#72dbe4"
            roughness={0.5}
            transparent
            opacity={0.72}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-5}
          />
        </mesh>
      ))}
      {hillStones.map(([x, y, z, sx, sy, sz, yaw], index) => (
        <mesh key={`darrel-waterfall-stone-${index}`} position={[x, y, z]} rotation={[0, yaw, 0]} castShadow receiveShadow>
          <boxGeometry args={[sx, sy, sz]} />
          <meshStandardMaterial map={stoneTexture} color={index % 2 === 0 ? "#89908b" : "#717c75"} roughness={1} />
        </mesh>
      ))}
      {mossPads.map(([x, y, z, sx, sz, yaw], index) => (
        <mesh key={`darrel-waterfall-moss-${index}`} position={[x, y, z]} rotation={[-Math.PI / 2, 0, yaw]} renderOrder={7}>
          <planeGeometry args={[sx, sz]} />
          <meshStandardMaterial map={leafTexture} color={index % 2 === 0 ? "#6fb85a" : "#4f8b43"} roughness={1} transparent opacity={0.92} />
        </mesh>
      ))}
      {sprayPuffs.map(([x, y, z, scale], index) => (
        <mesh
          key={`darrel-waterfall-spray-${index}`}
          ref={(mesh) => {
            sprayRefs.current[index] = mesh;
          }}
          position={[x, y, z]}
          scale={[scale, scale * 0.45, scale]}
          renderOrder={8}
        >
          <sphereGeometry args={[1, 7, 4]} />
          <meshBasicMaterial color="#eaffff" transparent opacity={0.32} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      <pointLight position={[0, 11, 47]} color="#a7f3ff" intensity={1.7} distance={62} />
    </group>
  );
}

function DarrelQuestReturnGate() {
  const onReturn = (event: any) => {
    const objectName = event.colliderObject?.name || event.other?.rigidBodyObject?.name;
    if (objectName !== "player") return;
    const now = getDarrelQuestGateNowMs();
    const lastReturn = (window as unknown as { __darrelQuestReturnAt?: number }).__darrelQuestReturnAt ?? 0;
    if (now - lastReturn < 1200) return;
    (window as unknown as { __darrelQuestReturnAt?: number }).__darrelQuestReturnAt = now;
    const darrelQuestState = window as unknown as {
      __darrelQuestNpcId?: string;
      __darrelQuestReturnPosition?: { x: number; y: number; z: number };
    };
    if (darrelQuestState.__darrelQuestNpcId) {
      useGameStore.getState().completeDarrelGroveQuestReturn(darrelQuestState.__darrelQuestNpcId);
      delete darrelQuestState.__darrelQuestNpcId;
    }
    const savedReturn = (window as unknown as { __darrelQuestReturnPosition?: { x: number; y: number; z: number } }).__darrelQuestReturnPosition;
    window.dispatchEvent(new CustomEvent("teleportPlayer", {
      detail: savedReturn ?? { x: 0, y: 12, z: 30 },
    }));
  };

  return (
    <group position={[0, DARREL_GROVE_GROUND_Y, -224]}>
      <RigidBody type="fixed" sensor colliders={false} onIntersectionEnter={onReturn}>
        <CuboidCollider args={[8, 8, 5]} position={[0, 8, 0]} />
      </RigidBody>
      {DARREL_RETURN_GATE_POST_X.map((x) => (
        <mesh key={`return-post-${x}`} position={[x, 8, 0]} castShadow>
          <cylinderGeometry args={[1.4, 1.8, 16, 8]} />
          <meshStandardMaterial color="#7f1d1d" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 16.5, 0]} castShadow>
        <boxGeometry args={[22, 2.6, 4]} />
        <meshStandardMaterial color="#991b1b" roughness={0.8} />
      </mesh>
      <mesh position={[0, 8, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[6.2, 0.38, 8, 24]} />
        <meshBasicMaterial color="#f9a8d4" transparent opacity={0.78} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 9, 0]} color="#f9a8d4" intensity={2.4} distance={26} />
    </group>
  );
}

function DarrelMountFujiSkybox() {
  const fujiTexture = useMemo(() => getDarrelFujiTexture(), []);

  return (
    <group name="darrel-mount-fuji-skybox" position={[0, DARREL_GROVE_GROUND_Y + 146, -DARREL_GROVE_HALF_SIZE - 34]}>
      <mesh renderOrder={-12}>
        <planeGeometry args={[560, 310]} />
        <meshBasicMaterial
          map={fujiTexture}
          transparent
          opacity={0.96}
          alphaTest={0.03}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function DarrelGroveBoundary() {
  const woodTexture = useMemo(() => getDarrelTexture("wood"), []);
  const fencePositions = [
    [0, DARREL_GROVE_GROUND_Y + 4, -DARREL_GROVE_HALF_SIZE + 8, DARREL_GROVE_HALF_SIZE, 4, 3],
    [0, DARREL_GROVE_GROUND_Y + 4, DARREL_GROVE_HALF_SIZE - 8, DARREL_GROVE_HALF_SIZE, 4, 3],
    [-DARREL_GROVE_HALF_SIZE + 8, DARREL_GROVE_GROUND_Y + 4, 0, 3, 4, DARREL_GROVE_HALF_SIZE],
    [DARREL_GROVE_HALF_SIZE - 8, DARREL_GROVE_GROUND_Y + 4, 0, 3, 4, DARREL_GROVE_HALF_SIZE],
  ] as const;

  return (
    <>
      <RigidBody type="fixed" colliders={false} name="darrel-grove-boundary">
        <CuboidCollider args={[DARREL_GROVE_HALF_SIZE, 16, 2]} position={[0, DARREL_GROVE_GROUND_Y + 8, -DARREL_GROVE_HALF_SIZE]} />
        <CuboidCollider args={[DARREL_GROVE_HALF_SIZE, 16, 2]} position={[0, DARREL_GROVE_GROUND_Y + 8, DARREL_GROVE_HALF_SIZE]} />
        <CuboidCollider args={[2, 16, DARREL_GROVE_HALF_SIZE]} position={[-DARREL_GROVE_HALF_SIZE, DARREL_GROVE_GROUND_Y + 8, 0]} />
        <CuboidCollider args={[2, 16, DARREL_GROVE_HALF_SIZE]} position={[DARREL_GROVE_HALF_SIZE, DARREL_GROVE_GROUND_Y + 8, 0]} />
      </RigidBody>
      {fencePositions.map(([x, y, z, sx, sy, sz], index) => (
        <mesh key={`grove-fence-${index}`} position={[x, y, z]} receiveShadow castShadow>
          <boxGeometry args={[sx * 2, sy * 2, sz * 2]} />
          <meshStandardMaterial map={woodTexture} color="#59361f" roughness={1} />
        </mesh>
      ))}
    </>
  );
}

type DarrelFallenPetal = {
  x: number;
  z: number;
  y: number;
  yaw: number;
  sx: number;
  sz: number;
};

type DarrelFallingPetal = {
  x: number;
  z: number;
  phase: number;
  speed: number;
  sway: number;
  drift: number;
  scale: number;
  spin: number;
};

function isInsideDarrelHutFootprint(x: number, z: number) {
  return Math.abs(x) < 48 && Math.abs(z) < 40;
}

function DarrelPetalDriftPatches() {
  const carpetTexture = useMemo(() => getDarrelPetalCarpetTexture(), []);
  const patches = [
    [-154, -158, 136, 76, -0.18],
    [154, -156, 138, 78, 0.14],
    [-158, 154, 142, 80, 0.26],
    [158, 154, 138, 78, -0.2],
    [0, -186, 174, 50, 0.05],
    [0, 186, 180, 52, -0.08],
    [-190, 0, 58, 168, 0.08],
    [190, 0, 60, 168, -0.1],
  ] as const;

  return (
    <group name="darrel-petal-drift-patches" userData={HIDE_FROM_MINIMAP}>
      {patches.map(([x, z, width, depth, yaw], index) => (
        <mesh key={`darrel-petal-drift-${index}`} position={[x, DARREL_GROVE_GROUND_Y + 0.105 + index * 0.002, z]} rotation={[-Math.PI / 2, 0, yaw]} renderOrder={2}>
          <planeGeometry args={[width, depth]} />
          <meshBasicMaterial
            map={carpetTexture}
            color="#ffd9e8"
            transparent
            opacity={0.68}
            alphaTest={0.08}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
            polygonOffset
            polygonOffsetFactor={-2}
          />
        </mesh>
      ))}
    </group>
  );
}

function DarrelFallenPetalField() {
  const petalTexture = useMemo(() => getDarrelPetalTexture(), []);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const petals = useMemo<DarrelFallenPetal[]>(() => {
    const generated: DarrelFallenPetal[] = [];
    for (let index = 0; index < DARREL_FALLEN_PETAL_TARGET_COUNT; index += 1) {
      const x = -242 + getDarrelPetalNoise(index, 1) * 484;
      const z = -242 + getDarrelPetalNoise(index, 2) * 484;
      if (isInsideDarrelHutFootprint(x, z)) continue;

      const nearTree = Math.abs(x) > 118 || Math.abs(z) > 118;
      const scale = nearTree ? 3.15 : 2.25;
      generated.push({
        x,
        z,
        y: DARREL_GROVE_GROUND_Y + 0.16 + (index % 5) * 0.004,
        yaw: getDarrelPetalNoise(index, 3) * Math.PI * 2,
        sx: (4.4 + getDarrelPetalNoise(index, 4) * 7.8) * scale,
        sz: (2.3 + getDarrelPetalNoise(index, 5) * 4.2) * scale,
      });
    }
    return generated;
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let index = 0; index < petals.length; index += 1) {
      const petal = petals[index];
      dummy.position.set(petal.x, petal.y, petal.z);
      dummy.rotation.set(-Math.PI / 2, 0, petal.yaw);
      dummy.scale.set(petal.sx, petal.sz, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.count = petals.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, DARREL_GROVE_GROUND_Y + 0.2, 0),
      DARREL_GROVE_HALF_SIZE * 1.45,
    );
  }, [dummy, petals]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, petals.length]} renderOrder={3} userData={HIDE_FROM_MINIMAP}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={petalTexture}
        color="#ffe1ec"
        transparent
        alphaTest={0.08}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
        polygonOffset
        polygonOffsetFactor={-1}
      />
    </instancedMesh>
  );
}

function DarrelFallingPetals() {
  const petalTexture = useMemo(() => getDarrelPetalTexture(), []);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const lastMobilePetalUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);
  const petals = useMemo<DarrelFallingPetal[]>(() => {
    const generated: DarrelFallingPetal[] = [];
    for (let index = 0; index < DARREL_FALLING_PETAL_COUNT; index += 1) {
      const nearCorner = getDarrelPetalNoise(index, 8) > 0.34;
      const side = Math.floor(getDarrelPetalNoise(index, 9) * 4);
      const cornerX = side === 0 || side === 3 ? -1 : 1;
      const cornerZ = side < 2 ? -1 : 1;
      const x = nearCorner
        ? cornerX * (110 + getDarrelPetalNoise(index, 1) * 115)
        : -165 + getDarrelPetalNoise(index, 1) * 330;
      const z = nearCorner
        ? cornerZ * (110 + getDarrelPetalNoise(index, 2) * 115)
        : -165 + getDarrelPetalNoise(index, 2) * 330;

      generated.push({
        x,
        z,
        phase: getDarrelPetalNoise(index, 3),
        speed: 0.045 + getDarrelPetalNoise(index, 4) * 0.05,
        sway: 4 + getDarrelPetalNoise(index, 5) * 8,
        drift: getDarrelPetalNoise(index, 6) * Math.PI * 2,
        scale: 7.2 + getDarrelPetalNoise(index, 7) * 8.8,
        spin: (getDarrelPetalNoise(index, 10) - 0.5) * 2.2,
      });
    }
    return generated;
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, DARREL_GROVE_GROUND_Y + 44, 0),
      DARREL_GROVE_HALF_SIZE * 1.4,
    );
  }, []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const elapsed = clock.elapsedTime;
    if (
      mobilePerformanceMode &&
      elapsed - lastMobilePetalUpdateAtRef.current < MOBILE_DARREL_FALLING_PETAL_UPDATE_INTERVAL_SECONDS
    ) {
      return;
    }
    lastMobilePetalUpdateAtRef.current = elapsed;

    const topY = DARREL_HUT_BASE_Y + 92;
    const spanY = 104;
    for (let index = 0; index < petals.length; index += 1) {
      const petal = petals[index];
      const fall = (petal.phase + elapsed * petal.speed) % 1;
      const flutter = elapsed * (0.8 + petal.speed * 12) + petal.phase * Math.PI * 2;
      const x = petal.x + Math.sin(flutter + petal.drift) * petal.sway;
      const z = petal.z + Math.cos(flutter * 0.72 + petal.drift) * petal.sway * 0.72;
      const y = topY - fall * spanY;
      dummy.position.set(x, y, z);
      dummy.rotation.set(
        Math.sin(flutter * 0.83) * 0.55,
        flutter * petal.spin,
        Math.cos(flutter) * 0.7,
      );
      dummy.scale.set(petal.scale, petal.scale * 0.56, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, petals.length]} frustumCulled={false} renderOrder={4} userData={HIDE_FROM_MINIMAP}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={petalTexture}
        color="#ffd8e8"
        transparent
        opacity={0.72}
        alphaTest={0.08}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

const DARREL_DRAGON_MANIFEST_SRC = "/sprites/darrel-dragon/manifest.json";
const DARREL_DRAGON_PROMPT_DOM_ID = "darrel-dragon-interact-prompt";
const DARREL_DRAGON_LOCAL_POSITION: [number, number, number] = [10, DARREL_HUT_BASE_Y + 9.3, 6];
const DARREL_DRAGON_HOUSE_HALF_WIDTH = 39;
const DARREL_DRAGON_HOUSE_HALF_DEPTH = 31;
const DARREL_DRAGON_TALK_RADIUS = 34;
const DARREL_DRAGON_TALK_RADIUS_SQ = DARREL_DRAGON_TALK_RADIUS * DARREL_DRAGON_TALK_RADIUS;
const DARREL_DRAGON_WORLD_PROMPT_STYLE: CSSProperties = {
  width: 214,
  minHeight: 58,
  border: "2px solid rgba(207, 250, 254, 0.9)",
  background: "rgba(8, 13, 30, 0.86)",
  color: "#f0fdff",
  fontFamily: "monospace",
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: "0.12em",
  lineHeight: 1.15,
  padding: "8px 10px",
  textAlign: "center",
  textTransform: "uppercase",
  boxShadow: "0 0 18px rgba(125, 211, 252, 0.55)",
};
const DARREL_DRAGON_PROMPT_ICON_STYLE: CSSProperties = {
  display: "grid",
  width: 24,
  minWidth: 24,
  height: 24,
  placeItems: "center",
  border: "2px solid #cffafe",
  background: "#a5f3fc",
  color: "#0f172a",
  fontSize: 14,
};
const DARREL_DRAGON_SCREEN_PROMPT_CSS = [
  "position:fixed",
  "left:50%",
  "top:14%",
  "z-index:9999",
  "display:flex",
  "align-items:center",
  "gap:8px",
  "width:max-content",
  "max-width:86vw",
  "min-height:38px",
  "transform:translateX(-50%)",
  "border:2px solid rgba(207,250,254,0.9)",
  "background:rgba(8,13,30,0.88)",
  "color:#f0fdff",
  "font-family:monospace",
  "font-size:11px",
  "font-weight:900",
  "letter-spacing:0.12em",
  "line-height:1.1",
  "padding:8px 12px",
  "text-transform:uppercase",
  "box-shadow:0 0 18px rgba(125,211,252,0.5)",
  "pointer-events:none",
].join(";");
const DARREL_DRAGON_PROMPT_ICON_CSS = [
  "display:grid",
  "width:24px",
  "min-width:24px",
  "height:24px",
  "place-items:center",
  "border:2px solid #cffafe",
  "background:#a5f3fc",
  "color:#0f172a",
  "font-size:14px",
].join(";");

function setDarrelDragonScreenPrompt(visible: boolean, promptText: string) {
  if (typeof document === "undefined") return;

  const existing = document.getElementById(DARREL_DRAGON_PROMPT_DOM_ID);
  if (!visible) {
    existing?.remove();
    return;
  }

  const container = existing ?? document.createElement("div");
  container.id = DARREL_DRAGON_PROMPT_DOM_ID;
  container.setAttribute("style", DARREL_DRAGON_SCREEN_PROMPT_CSS);
  container.replaceChildren();

  const icon = document.createElement("span");
  icon.setAttribute("style", DARREL_DRAGON_PROMPT_ICON_CSS);
  icon.textContent = "!";
  const label = document.createElement("span");
  label.textContent = `Press ${promptText}`;
  container.append(icon, label);

  if (!existing) {
    document.body.appendChild(container);
  }
}

const DARREL_DRAGON_CONTROLLER_LABELS: Record<ControllerButtonName, string> = {
  a: "A",
  b: "B",
  x: "X",
  y: "Y",
  leftBumper: "LB",
  rightBumper: "RB",
  leftTrigger: "LT",
  rightTrigger: "RT",
  back: "Select",
  start: "Start",
  leftStick: "LS",
  rightStick: "RS",
  dpadUp: "D-Up",
  dpadDown: "D-Down",
  dpadLeft: "D-Left",
  dpadRight: "D-Right",
};

type DarrelDragonAnimationManifest = {
  sleep?: string[];
  wake?: string[];
  idle?: string[];
  attack?: string[];
  sleepFrameMs?: number;
  wakeFrameMs?: number;
  idleFrameMs?: number;
  attackFrameMs?: number;
};

type DarrelDragonAnimationTextures = {
  sleep: THREE.Texture[];
  wake: THREE.Texture[];
  idle: THREE.Texture[];
  attack: THREE.Texture[];
  sleepFrameMs: number;
  wakeFrameMs: number;
  idleFrameMs: number;
  attackFrameMs: number;
};

type DarrelDragonMode = "sleep" | "wake" | "idle" | "attack";

type DarrelDragonQuestInteractDetail = {
  source?: "keyboard" | "controller" | "cast" | string;
  handled?: boolean;
};

function isDarrelDragonEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT";
}

function getDarrelDragonLocalPosition(position: THREE.Vector3, worldOrigin: { x: number; z: number }) {
  return {
    x: position.x - worldOrigin.x,
    y: position.y,
    z: position.z - worldOrigin.z,
  };
}

function isInsideDarrelDragonHouse(localPosition: { x: number; y: number; z: number }) {
  return Math.abs(localPosition.x) <= DARREL_DRAGON_HOUSE_HALF_WIDTH &&
    Math.abs(localPosition.z) <= DARREL_DRAGON_HOUSE_HALF_DEPTH;
}

function isNearDarrelDragon(localPosition: { x: number; y: number; z: number }) {
  const dx = localPosition.x - DARREL_DRAGON_LOCAL_POSITION[0];
  const dz = localPosition.z - DARREL_DRAGON_LOCAL_POSITION[2];
  return dx * dx + dz * dz <= DARREL_DRAGON_TALK_RADIUS_SQ;
}

function getDarrelDragonInteractPrompt(
  controllerBindings: Record<string, ControllerButtonName>,
  isControllerGameplayActive: boolean,
  isTouchControlsActive: boolean,
) {
  if (isTouchControlsActive) return "TAP CAST / INTERACT";
  if (!isControllerGameplayActive) return "F / LMB / RMB";

  const buttons = [
    controllerBindings.interact,
    controllerBindings.leftCast,
    controllerBindings.rightCast,
  ];
  const labels: string[] = [];
  for (let index = 0; index < buttons.length; index += 1) {
    const button = buttons[index];
    if (!button) continue;
    const label = DARREL_DRAGON_CONTROLLER_LABELS[button] ?? button;
    if (!labels.includes(label)) labels.push(label);
  }

  return labels.join(" / ") || "INTERACT";
}

function makeDarrelDragonFallbackTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) return configurePixelSpriteTexture(new THREE.CanvasTexture(canvas));

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const pixel = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };

  pixel(40, 96, 154, 24, "rgba(203,213,225,0.55)");
  pixel(72, 72, 88, 28, "rgba(226,232,240,0.62)");
  pixel(42, 78, 42, 20, "rgba(191,219,254,0.58)");
  pixel(160, 54, 38, 66, "rgba(147,197,253,0.42)");
  pixel(30, 70, 24, 10, "rgba(226,232,240,0.7)");
  pixel(51, 70, 5, 5, "#67e8f9");
  pixel(184, 42, 24, 14, "rgba(226,232,240,0.42)");
  pixel(202, 32, 16, 10, "rgba(226,232,240,0.34)");

  return configurePixelSpriteTexture(new THREE.CanvasTexture(canvas));
}

function useDarrelDragonAnimationTextures(fallbackTexture: THREE.Texture) {
  const [textures, setTextures] = useState<DarrelDragonAnimationTextures>(() => ({
    sleep: [fallbackTexture],
    wake: [fallbackTexture],
    idle: [fallbackTexture],
    attack: [fallbackTexture],
    sleepFrameMs: 240,
    wakeFrameMs: 115,
    idleFrameMs: 155,
    attackFrameMs: 95,
  }));

  useEffect(() => {
    let cancelled = false;
    const ownedTextures: THREE.Texture[] = [];
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");

    const loadTexture = (src: string) => new Promise<THREE.Texture>((resolve, reject) => {
      loader.load(
        src,
        (loadedTexture) => {
          configurePixelSpriteTexture(loadedTexture);
          ownedTextures.push(loadedTexture);
          resolve(loadedTexture);
        },
        undefined,
        reject,
      );
    });

    const loadOptionalTexture = async (src: string | undefined) => {
      if (!src) return fallbackTexture;
      try {
        return await loadTexture(src);
      } catch {
        return fallbackTexture;
      }
    };

    const loadFrameSet = async (srcs: string[] | undefined) => {
      if (!srcs?.length) return [fallbackTexture];
      const framePromises = new Array<Promise<THREE.Texture>>(srcs.length);
      for (let index = 0; index < srcs.length; index += 1) {
        framePromises[index] = loadOptionalTexture(srcs[index]);
      }
      const loadedFrames = await Promise.all(framePromises);
      let hasUsableFrame = false;
      for (let index = 0; index < loadedFrames.length; index += 1) {
        if (loadedFrames[index] !== fallbackTexture) {
          hasUsableFrame = true;
          break;
        }
      }
      return hasUsableFrame ? loadedFrames : [fallbackTexture];
    };

    const loadManifest = async () => {
      try {
        const response = await fetch(DARREL_DRAGON_MANIFEST_SRC, { cache: "no-cache" });
        if (!response.ok) throw new Error(`Unable to load dragon manifest: ${response.status}`);
        const manifest = await response.json() as DarrelDragonAnimationManifest;
        const [sleep, wake, idle, attack] = await Promise.all([
          loadFrameSet(manifest.sleep),
          loadFrameSet(manifest.wake),
          loadFrameSet(manifest.idle),
          loadFrameSet(manifest.attack),
        ]);

        if (cancelled) return;
        setTextures({
          sleep,
          wake,
          idle,
          attack,
          sleepFrameMs: Math.max(80, manifest.sleepFrameMs ?? 240),
          wakeFrameMs: Math.max(80, manifest.wakeFrameMs ?? 115),
          idleFrameMs: Math.max(80, manifest.idleFrameMs ?? 155),
          attackFrameMs: Math.max(60, manifest.attackFrameMs ?? 95),
        });
      } catch {
        if (!cancelled) {
          setTextures({
            sleep: [fallbackTexture],
            wake: [fallbackTexture],
            idle: [fallbackTexture],
            attack: [fallbackTexture],
            sleepFrameMs: 240,
            wakeFrameMs: 115,
            idleFrameMs: 155,
            attackFrameMs: 95,
          });
        }
      }
    };

    void loadManifest();

    return () => {
      cancelled = true;
      for (let index = 0; index < ownedTextures.length; index += 1) {
        ownedTextures[index].dispose();
      }
    };
  }, [fallbackTexture]);

  return textures;
}

function isDarrelDragonQuestReadyForEncounter(flags: Record<string, unknown>, unlocked: string[]) {
  return !unlocked.includes("healingcrystals") &&
    (flags[DARREL_POTION_FLAG] === "drunk" || flags["quest:darrel-grove"] === "started");
}

function DarrelSpiritDragon({ worldOrigin }: { worldOrigin: { x: number; z: number } }) {
  const questFlags = useGameStore(s => s.questFlags);
  const questUnlockedSpells = useGameStore(s => s.questUnlockedSpells);
  const questDialogSession = useGameStore(s => s.questDialogSession);
  const controllerBindings = useGameStore(s => s.controllerBindings);
  const isControllerGameplayActive = useGameStore(s => s.isControllerGameplayActive);
  const isTouchControlsActive = useGameStore(s => s.isTouchControlsActive);
  const fallbackTexture = useMemo(() => makeDarrelDragonFallbackTexture(), []);
  const textures = useDarrelDragonAnimationTextures(fallbackTexture);
  const spriteRef = useRef<THREE.Sprite>(null);
  const materialRef = useRef<THREE.SpriteMaterial>(null);
  const modeRef = useRef<DarrelDragonMode>("sleep");
  const modeStartedAtRef = useRef<number | null>(null);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const lastMobileDragonVisualUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);
  const lastDialogAtRef = useRef(0);
  const latestDragonFrameClockMsRef = useRef(0);
  const playerEnteredHouseRef = useRef(false);
  const showInteractPromptRef = useRef(false);
  const [hasPlayerEnteredHouse, setHasPlayerEnteredHouse] = useState(false);
  const [showInteractPrompt, setShowInteractPrompt] = useState(false);
  const interactPromptText = getDarrelDragonInteractPrompt(controllerBindings, isControllerGameplayActive, isTouchControlsActive);
  const hasPeacefulDragon = questFlags[DARREL_DRAGON_PEACEFUL_FLAG] === true ||
    questFlags[DARREL_DRAGON_PEACEFUL_FLAG] === "true" ||
    questUnlockedSpells.includes("healingcrystals");
  const hasFoughtDragon = (questFlags[DARREL_DRAGON_FOUGHT_FLAG] === true ||
    questFlags[DARREL_DRAGON_FOUGHT_FLAG] === "true") && !hasPeacefulDragon;
  const hasWoken = questFlags[DARREL_DRAGON_WOKEN_FLAG] === true ||
    questFlags[DARREL_DRAGON_WOKEN_FLAG] === "true" ||
    hasPeacefulDragon ||
    hasFoughtDragon ||
    questDialogSession?.npcId === DARREL_DRAGON_NPC_ID ||
    hasPlayerEnteredHouse;
  const { camera } = useThree();

  useEffect(() => {
    const setDragonMode = (nextMode: DarrelDragonMode) => {
      if (modeRef.current === nextMode) return;
      modeRef.current = nextMode;
      modeStartedAtRef.current = null;
    };

    if (hasFoughtDragon) {
      setDragonMode("attack");
    } else if (hasWoken && modeRef.current === "sleep") {
      setDragonMode("wake");
    } else if (hasWoken && modeRef.current === "attack") {
      setDragonMode("idle");
    } else if (!hasWoken) {
      setDragonMode("sleep");
    }
  }, [hasFoughtDragon, hasWoken]);

  useEffect(() => () => {
    fallbackTexture.dispose();
  }, [fallbackTexture]);

  useEffect(() => {
    setDarrelDragonScreenPrompt(showInteractPrompt, interactPromptText);
    return () => setDarrelDragonScreenPrompt(false, interactPromptText);
  }, [interactPromptText, showInteractPrompt]);

  useEffect(() => {
    const openDragonDialogIfReady = (detail?: DarrelDragonQuestInteractDetail) => {
      const store = useGameStore.getState();
      if (detail?.handled) return;
      if (
        store.questDialogSession ||
        store.questNpcEditorTarget ||
        store.isInventoryOpen ||
        store.isPauseMenuOpen ||
        store.isSpellMenuOpen ||
        store.isMapExpanded ||
        store.isScoreboardOpen ||
        store.health <= 0
      ) {
        return false;
      }

      const localPosition = getDarrelDragonLocalPosition(camera.position, worldOrigin);
      if (!isInsideDarrelDragonHouse(localPosition) || !isNearDarrelDragon(localPosition)) return false;

      const now = latestDragonFrameClockMsRef.current;
      if (now - lastDialogAtRef.current < 450) return false;
      lastDialogAtRef.current = now;
      if (!playerEnteredHouseRef.current) {
        playerEnteredHouseRef.current = true;
        setHasPlayerEnteredHouse(true);
      }
      if (detail) {
        detail.handled = true;
      }
      store.openDarrelDragonDialog();
      return true;
    };

    const handleDragonInteract = (event: Event) => {
      openDragonDialogIfReady((event as CustomEvent<DarrelDragonQuestInteractDetail>).detail);
    };

    const handleDragonKeyboardInteract = (event: KeyboardEvent) => {
      if (event.repeat || event.code !== "KeyF" || isDarrelDragonEditableTarget(event.target)) return;
      if (openDragonDialogIfReady({ source: "keyboard" })) {
        event.preventDefault();
      }
    };

    const handleDragonMouseInteract = (event: MouseEvent) => {
      if ((event.button !== 0 && event.button !== 2) || isDarrelDragonEditableTarget(event.target)) return;
      if (openDragonDialogIfReady({ source: "cast" })) {
        event.preventDefault();
      }
    };

    window.addEventListener("quest-villager-interact", handleDragonInteract);
    window.addEventListener("keydown", handleDragonKeyboardInteract);
    window.addEventListener("mousedown", handleDragonMouseInteract);
    return () => {
      window.removeEventListener("quest-villager-interact", handleDragonInteract);
      window.removeEventListener("keydown", handleDragonKeyboardInteract);
      window.removeEventListener("mousedown", handleDragonMouseInteract);
    };
  }, [camera, worldOrigin.x, worldOrigin.z]);

  useFrame((state) => {
    const elapsedSeconds = state.clock.elapsedTime;
    const now = elapsedSeconds * 1000;
    latestDragonFrameClockMsRef.current = now;
    if (modeStartedAtRef.current === null) {
      modeStartedAtRef.current = now;
    }

    const store = useGameStore.getState();
    const localPosition = getDarrelDragonLocalPosition(camera.position, worldOrigin);
    const playerInsideHouse = isInsideDarrelDragonHouse(localPosition);
    if (playerInsideHouse && !playerEnteredHouseRef.current) {
      playerEnteredHouseRef.current = true;
      setHasPlayerEnteredHouse(true);
    }

    const shouldShowInteractPrompt =
      playerInsideHouse &&
      isNearDarrelDragon(localPosition) &&
      !store.questDialogSession &&
      !store.questNpcEditorTarget &&
      !store.isInventoryOpen &&
      !store.isPauseMenuOpen &&
      !store.isSpellMenuOpen &&
      !store.isMapExpanded &&
      !store.isScoreboardOpen &&
      store.health > 0;
    if (showInteractPromptRef.current !== shouldShowInteractPrompt) {
      showInteractPromptRef.current = shouldShowInteractPrompt;
      setShowInteractPrompt(shouldShowInteractPrompt);
    }

    if (
      mobilePerformanceMode &&
      elapsedSeconds - lastMobileDragonVisualUpdateAtRef.current < MOBILE_DARREL_DRAGON_VISUAL_UPDATE_INTERVAL_SECONDS
    ) {
      return;
    }
    lastMobileDragonVisualUpdateAtRef.current = elapsedSeconds;

    const material = materialRef.current;
    if (!material) return;
    const mode = modeRef.current;
    const getFrameMs = (dragonMode: DarrelDragonMode) => {
      if (dragonMode === "sleep") return textures.sleepFrameMs;
      if (dragonMode === "wake") return textures.wakeFrameMs;
      if (dragonMode === "attack") return textures.attackFrameMs;
      return textures.idleFrameMs;
    };
    const frameMs = getFrameMs(mode);
    const modeStartedAt = modeStartedAtRef.current;
    const elapsed = Math.max(0, now - modeStartedAt);
    const wakeFinished = mode === "wake" && elapsed >= textures.wake.length * frameMs;
    if (wakeFinished) {
      modeRef.current = "idle";
      modeStartedAtRef.current = now;
    }
    const activeMode = modeRef.current;
    const activeFrames = textures[activeMode];
    const activeFrameMs = getFrameMs(activeMode);
    const activeModeStartedAt = modeStartedAtRef.current ?? now;
    const frameIndex = activeMode === "wake"
      ? Math.min(activeFrames.length - 1, Math.floor((now - activeModeStartedAt) / activeFrameMs))
      : Math.floor((now - activeModeStartedAt) / activeFrameMs) % activeFrames.length;
    const texture = activeFrames[frameIndex] ?? fallbackTexture;
    if (material.map !== texture) {
      material.map = texture;
      material.needsUpdate = true;
    }

    if (spriteRef.current) {
      const breath = 1 + Math.sin(now / 620) * (activeMode === "sleep" ? 0.018 : activeMode === "attack" ? 0.055 : 0.035);
      const wakeProgress = activeMode === "sleep"
        ? 0
        : activeMode === "wake"
          ? THREE.MathUtils.clamp((now - activeModeStartedAt) / Math.max(1, textures.wake.length * textures.wakeFrameMs), 0, 1)
          : 1;
      const width = activeMode === "attack" ? 49 : THREE.MathUtils.lerp(43, 38, wakeProgress);
      const height = activeMode === "attack" ? 34 : THREE.MathUtils.lerp(27, 31, wakeProgress);
      const attentionLift = activeMode === "attack" ? 4.2 : THREE.MathUtils.lerp(0, 2.7, wakeProgress);
      spriteRef.current.position.y = attentionLift + Math.sin(now / 700) * (activeMode === "attack" ? 0.34 : 0.18) * wakeProgress;
      spriteRef.current.scale.set(width * breath, height * breath, 1);
    }
  });

  return (
    <group name="darrel-spirit-dragon" position={DARREL_DRAGON_LOCAL_POSITION}>
      <pointLight position={[0, 3, 0]} color={hasFoughtDragon ? "#7dd3fc" : "#bfdbfe"} intensity={hasFoughtDragon ? 4.4 : hasWoken ? 2.4 : 1.2} distance={hasFoughtDragon ? 58 : 44} />
      <sprite ref={spriteRef} scale={[43, 27, 1]} frustumCulled={false} renderOrder={12}>
        <spriteMaterial
          ref={materialRef}
          map={fallbackTexture}
          color={hasFoughtDragon ? "#dff7ff" : hasWoken ? "#e0f2fe" : "#cbd5e1"}
          transparent
          opacity={hasFoughtDragon ? 0.94 : hasWoken ? 0.88 : 0.78}
          alphaTest={0.04}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
      {showInteractPrompt && (
        <>
          <Html center distanceFactor={12} position={[0, 18.5, 0]} style={{ pointerEvents: "none" }}>
            <div style={DARREL_DRAGON_WORLD_PROMPT_STYLE}>
              <div style={{ ...DARREL_DRAGON_PROMPT_ICON_STYLE, margin: "0 auto 5px" }}>
                !
              </div>
              <div>Press {interactPromptText}</div>
              <div style={{ marginTop: 4, color: "rgba(165, 243, 252, 0.86)", fontSize: 8, letterSpacing: "0.18em" }}>
                Speak
              </div>
            </div>
          </Html>
        </>
      )}
    </group>
  );
}

function useDarrelGroveDetailPhase(active: boolean, chunkKey: string) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!active) {
      setPhase(0);
      return;
    }

    setPhase(0);
    const waterAndGate = window.setTimeout(() => setPhase(1), 120);
    const trees = window.setTimeout(() => setPhase(2), 360);
    const finishingDetails = window.setTimeout(() => setPhase(3), 760);
    return () => {
      window.clearTimeout(waterAndGate);
      window.clearTimeout(trees);
      window.clearTimeout(finishingDetails);
    };
  }, [active, chunkKey]);

  return phase;
}

export function SurvivalDarrelGrove({ chunk }: { chunk: SurvivalChunkInfo }) {
  const groundTexture = useMemo(() => getDarrelTexture("ground"), []);
  const showDetails = chunk.distance === 0;
  const detailPhase = useDarrelGroveDetailPhase(showDetails, chunk.key);
  const showWaterAndGate = !showDetails || detailPhase >= 1;
  const showTrees = !showDetails || detailPhase >= 2;
  const showFinishingDetails = showDetails && detailPhase >= 3;

  return (
    <group name={`survival-darrel-grove-${chunk.key}`}>
      <RigidBody type="fixed" colliders={false} name="darrel-grove-ground">
        <CuboidCollider args={[DARREL_GROVE_HALF_SIZE, 1, DARREL_GROVE_HALF_SIZE]} position={[chunk.x, DARREL_GROVE_GROUND_Y - 1, chunk.z]} />
      </RigidBody>
      <group position={[chunk.x, 0, chunk.z]}>
        <mesh position={[0, DARREL_GROVE_GROUND_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[SURVIVAL_BLOCK_SIZE, SURVIVAL_BLOCK_SIZE, 1, 1]} />
          <meshStandardMaterial map={groundTexture} color="#80a963" roughness={1} />
        </mesh>
        <DarrelMountFujiSkybox />
        <DarrelGroveBoundary />
        <DarrelHouseHillAndMoat />
        <DarrelChineseHut />
        {showWaterAndGate && (
          <>
            <DarrelBackyardRiver />
            <DarrelWaterfallHill />
            <DarrelQuestReturnGate />
          </>
        )}
        {showTrees && (
          <>
            {[
              { position: [-176, DARREL_GROVE_GROUND_Y, -176] as [number, number, number], rotation: -2.35619449, scale: 2.45 },
              { position: [176, DARREL_GROVE_GROUND_Y, -176] as [number, number, number], rotation: 2.35619449, scale: 2.45 },
              { position: [-176, DARREL_GROVE_GROUND_Y, 176] as [number, number, number], rotation: -0.78539816, scale: 2.45 },
              { position: [176, DARREL_GROVE_GROUND_Y, 176] as [number, number, number], rotation: 0.78539816, scale: 2.45 },
            ].map((tree, index) => (
              <DarrelBonsaiTree key={`darrel-tree-${index}`} {...tree} />
            ))}
            {[
              { position: [-92, DARREL_GROVE_GROUND_Y, -184] as [number, number, number], rotation: 0.42, scale: 2.18 },
              { position: [92, DARREL_GROVE_GROUND_Y, -184] as [number, number, number], rotation: -0.42, scale: 2.18 },
              { position: [176, DARREL_GROVE_GROUND_Y, 0] as [number, number, number], rotation: -1.32, scale: 2.28 },
              { position: [0, DARREL_GROVE_GROUND_Y, 176] as [number, number, number], rotation: Math.PI + 0.18, scale: 2.35 },
              { position: [-176, DARREL_GROVE_GROUND_Y, 0] as [number, number, number], rotation: 1.42, scale: 2.28 },
            ].map((tree, index) => (
              <DarrelLegacyBonsaiTree key={`darrel-legacy-tree-${index}`} {...tree} />
            ))}
          </>
        )}
        {showFinishingDetails && (
          <>
            <DarrelSpiritDragon worldOrigin={{ x: chunk.x, z: chunk.z }} />
            <DarrelPetalDriftPatches />
            <DarrelFallenPetalField />
            <DarrelFallingPetals />
            {DARREL_GROUND_BLOSSOM_X.map((x, index) => (
              <DarrelBlossomCluster key={`ground-blossom-${index}`} position={[x, DARREL_GROVE_GROUND_Y + 2.4, 64 + Math.sin(index) * 42]} size={3.6} count={4} />
            ))}
            <pointLight position={[0, DARREL_GROVE_GROUND_Y + 26, -6]} color="#ffd6a0" intensity={1.6} distance={88} />
            <pointLight position={[0, DARREL_GROVE_GROUND_Y + 18, -145]} color="#fca5a5" intensity={1.1} distance={66} />
          </>
        )}
      </group>
    </group>
  );
}

