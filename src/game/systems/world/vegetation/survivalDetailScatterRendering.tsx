import * as THREE from "three";
import type { SurvivalBiome } from "../../../../store/gameStore";
import { survivalBiomeStyle } from "../survival/survivalBiome";
import {
  FoliageDodeca,
  SurvivalBranch,
  SurvivalHangingVine,
} from "./SurvivalFoliagePrimitives";
import {
  getSurvivalTreeFootprintScale,
  getSurvivalTreeVisualScale,
} from "./survivalTreeVisuals";

export type SurvivalDetailScatterProp = {
  key: string;
  localX: number;
  localZ: number;
  scale: number;
  y: number;
  variant: number;
};

const JUNGLE_BRANCH_START_0 = new THREE.Vector3(0, 19, 0);
const JUNGLE_BRANCH_END_0 = new THREE.Vector3(10, 27, -4);
const JUNGLE_BRANCH_START_1 = new THREE.Vector3(0, 23, 0);
const JUNGLE_BRANCH_END_1 = new THREE.Vector3(-12, 32, 3);
const JUNGLE_BRANCH_START_2 = new THREE.Vector3(0, 26, 0);
const JUNGLE_BRANCH_END_2 = new THREE.Vector3(7, 36, 8);

const SWAMP_BRANCH_START_0 = new THREE.Vector3(0, 14, 0);
const SWAMP_BRANCH_END_0 = new THREE.Vector3(8.4, 21, -3.2);
const SWAMP_BRANCH_START_1 = new THREE.Vector3(0, 17, 0);
const SWAMP_BRANCH_END_1 = new THREE.Vector3(-7.8, 23.5, 4.6);
const SWAMP_ROOT_START_0 = new THREE.Vector3(-0.2, 4.5, 0);
const SWAMP_ROOT_END_0 = new THREE.Vector3(-4.8, 1.1, -4.5);
const SWAMP_ROOT_START_1 = new THREE.Vector3(0.3, 4.2, 0);
const SWAMP_ROOT_END_1 = new THREE.Vector3(5.2, 1, 3.6);

const DEFAULT_BRANCH_START_0 = new THREE.Vector3(0, 10, 0);
const DEFAULT_BRANCH_END_0 = new THREE.Vector3(6.4, 17.5, -2.4);
const DEFAULT_BRANCH_START_1 = new THREE.Vector3(0, 12.2, 0);
const DEFAULT_BRANCH_END_1 = new THREE.Vector3(-6.8, 18.8, 3.1);
const DEFAULT_BRANCH_START_2 = new THREE.Vector3(0, 15.5, 0);
const DEFAULT_BRANCH_END_2 = new THREE.Vector3(4.5, 21.5, 4.7);

export function SurvivalBiomeTree({
  biome,
  prop,
  worldX,
  worldZ,
}: {
  biome: SurvivalBiome;
  prop: SurvivalDetailScatterProp;
  worldX: number;
  worldZ: number;
}) {
  const visualScale = getSurvivalTreeVisualScale(biome, prop.scale);
  const footprintScale = getSurvivalTreeFootprintScale(biome, visualScale);
  const style = survivalBiomeStyle[biome];
  const yaw = prop.variant * Math.PI * 2;

  if (biome === "mushroom") {
    return (
      <group position={[worldX, prop.y, worldZ]} rotation={[0, yaw, 0]} scale={[footprintScale, visualScale, footprintScale]}>
        <mesh position={[0, 3.6, 0]} castShadow={false}>
          <cylinderGeometry args={[0.75, 1.05, 8.0, 6]} />
          <meshLambertMaterial color="#e8d5bb" />
        </mesh>
        <FoliageDodeca position={[0, 8.3, 0]} radius={3.1} color={style.accent} edgeColor="#271231" />
        <mesh position={[2.7, 4.4, -1.8]} scale={[0.72, 0.72, 0.72]} castShadow={false}>
          <cylinderGeometry args={[0.55, 0.78, 5.2, 6]} />
          <meshLambertMaterial color="#dfcab0" />
        </mesh>
        <FoliageDodeca position={[2.7, 7.5, -1.8]} scale={[0.72, 0.72, 0.72]} radius={2.6} color="#eb80f0" edgeColor="#271231" />
      </group>
    );
  }

  if (biome === "jungle") {
    const branchColor = "#3a2418";
    const canopy = prop.variant > 0.5 ? "#1f6b35" : "#23763b";
    const brightCanopy = prop.variant > 0.5 ? "#32914d" : "#2e8547";

    return (
      <group position={[worldX, prop.y, worldZ]} rotation={[0, yaw, 0]} scale={[footprintScale, visualScale, footprintScale]}>
        <mesh position={[0, 16, 0]} rotation={[0.08, 0, 0.05]} castShadow={false}>
          <cylinderGeometry args={[1.35, 2.45, 36, 6]} />
          <meshBasicMaterial color={branchColor} />
        </mesh>
        <SurvivalBranch start={JUNGLE_BRANCH_START_0} end={JUNGLE_BRANCH_END_0} radius={0.52} color={branchColor} />
        <SurvivalBranch start={JUNGLE_BRANCH_START_1} end={JUNGLE_BRANCH_END_1} radius={0.48} color={branchColor} />
        <SurvivalBranch start={JUNGLE_BRANCH_START_2} end={JUNGLE_BRANCH_END_2} radius={0.42} color={branchColor} />
        <FoliageDodeca position={[0, 36, 0]} radius={7.2} color={canopy} />
        <FoliageDodeca position={[6.8, 32.5, -4.2]} radius={5.4} color={brightCanopy} />
        <FoliageDodeca position={[-7.5, 35.5, 3.2]} radius={5.8} color="#2c7b3f" />
        <FoliageDodeca position={[2.8, 42, 5.6]} radius={5.2} color="#1d5f32" />
        <SurvivalHangingVine x={9.2} y={27.2} z={-3.7} length={13.5} sway={prop.variant * 5.1} />
        <SurvivalHangingVine x={-10.6} y={32.2} z={3.1} length={16.5} sway={prop.variant * 4.4 + 1.7} />
        <SurvivalHangingVine x={5.6} y={36} z={7.6} length={12.2} sway={prop.variant * 3.8 + 2.4} />
      </group>
    );
  }

  if (biome === "swamp") {
    return (
      <group position={[worldX, prop.y, worldZ]} rotation={[0, yaw, 0]} scale={[footprintScale, visualScale, footprintScale]}>
        <mesh position={[0, 12.5, 0]} rotation={[0.1, 0, -0.07]} castShadow={false}>
          <cylinderGeometry args={[1.2, 2.25, 27, 6]} />
          <meshBasicMaterial color="#3a2a1d" />
        </mesh>
        <SurvivalBranch start={SWAMP_BRANCH_START_0} end={SWAMP_BRANCH_END_0} radius={0.46} color="#3a2a1d" />
        <SurvivalBranch start={SWAMP_BRANCH_START_1} end={SWAMP_BRANCH_END_1} radius={0.4} color="#3a2a1d" />
        <SurvivalBranch start={SWAMP_ROOT_START_0} end={SWAMP_ROOT_END_0} radius={0.36} color="#2d2117" />
        <SurvivalBranch start={SWAMP_ROOT_START_1} end={SWAMP_ROOT_END_1} radius={0.34} color="#2d2117" />
        <FoliageDodeca position={[0, 25, 0]} radius={5.5} color="#56652b" edgeColor="#171c0d" />
        <FoliageDodeca position={[5.5, 22.5, -2.4]} radius={4.1} color="#667536" edgeColor="#171c0d" />
        <FoliageDodeca position={[-4.8, 24.4, 3.5]} radius={4.4} color="#4a5f28" edgeColor="#171c0d" />
        <SurvivalHangingVine x={7.2} y={21.3} z={-2.6} length={12.2} sway={prop.variant * 5.7} />
        <SurvivalHangingVine x={-6.3} y={23.8} z={4.3} length={13.4} sway={prop.variant * 4.2 + 1.2} />
      </group>
    );
  }

  return (
    <group position={[worldX, prop.y, worldZ]} rotation={[0, yaw, 0]} scale={[footprintScale, visualScale, footprintScale]}>
      <mesh position={[0, 10.4, 0]} castShadow={false}>
        <cylinderGeometry args={[0.95, 1.55, 22.4, 6]} />
        <meshBasicMaterial color="#5b3a20" />
      </mesh>
      <SurvivalBranch start={DEFAULT_BRANCH_START_0} end={DEFAULT_BRANCH_END_0} radius={0.38} color="#5b3a20" />
      <SurvivalBranch start={DEFAULT_BRANCH_START_1} end={DEFAULT_BRANCH_END_1} radius={0.35} color="#5b3a20" />
      <SurvivalBranch start={DEFAULT_BRANCH_START_2} end={DEFAULT_BRANCH_END_2} radius={0.31} color="#5b3a20" />
      <FoliageDodeca position={[0, 22, 0]} radius={5.2} color={style.accent} />
      <FoliageDodeca position={[4.8, 18.5, -2.2]} radius={3.9} color="#6aa846" />
      <FoliageDodeca position={[-5.2, 20.2, 2.6]} radius={4.2} color="#5d9b3f" />
    </group>
  );
}

export function DesertCactus({ x, y, z, scale, variant }: { x: number; y: number; z: number; scale: number; variant: number }) {
  const cactusScale = scale * (variant > 0.62 ? 1.16 : 0.92);
  const armHeight = 3.8 * cactusScale;
  const armSide = variant > 0.5 ? -1 : 1;

  return (
    <group position={[x, y, z]} scale={[cactusScale, cactusScale, cactusScale]}>
      <mesh position={[0, 4.58, 0]} scale={[1.18, 1.05, 1.18]} castShadow={false}>
        <cylinderGeometry args={[0.72, 0.9, 9.2, 6]} />
        <meshBasicMaterial color="#12351f" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 4.6, 0]} castShadow={false}>
        <cylinderGeometry args={[0.72, 0.9, 9.2, 6]} />
        <meshBasicMaterial color="#2f7a3f" />
      </mesh>
      <mesh position={[0, 9.24, 0]} scale={[1.22, 1.16, 1.22]} castShadow={false}>
        <sphereGeometry args={[0.72, 6, 4]} />
        <meshBasicMaterial color="#12351f" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 9.25, 0]} castShadow={false}>
        <sphereGeometry args={[0.72, 6, 4]} />
        <meshBasicMaterial color="#3a8f4b" />
      </mesh>
      <mesh position={[armSide * 1.45, armHeight + 1.88, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1.22, 1.12, 1.22]} castShadow={false}>
        <cylinderGeometry args={[0.34, 0.42, 2.4, 5]} />
        <meshBasicMaterial color="#12351f" side={THREE.BackSide} />
      </mesh>
      <mesh position={[armSide * 1.45, armHeight + 1.9, 0]} rotation={[0, 0, Math.PI / 2]} castShadow={false}>
        <cylinderGeometry args={[0.34, 0.42, 2.4, 5]} />
        <meshBasicMaterial color="#2f7a3f" />
      </mesh>
      <mesh position={[armSide * 2.55, armHeight + 2.78, 0]} scale={[1.22, 1.1, 1.22]} castShadow={false}>
        <cylinderGeometry args={[0.34, 0.4, 2.9, 5]} />
        <meshBasicMaterial color="#12351f" side={THREE.BackSide} />
      </mesh>
      <mesh position={[armSide * 2.55, armHeight + 2.8, 0]} castShadow={false}>
        <cylinderGeometry args={[0.34, 0.4, 2.9, 5]} />
        <meshBasicMaterial color="#3a8f4b" />
      </mesh>
      <mesh position={[-armSide * 1.2, armHeight + 0.18, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1.2, 1.12, 1.2]} castShadow={false}>
        <cylinderGeometry args={[0.25, 0.32, 1.8, 5]} />
        <meshBasicMaterial color="#12351f" side={THREE.BackSide} />
      </mesh>
      <mesh position={[-armSide * 1.2, armHeight + 0.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow={false}>
        <cylinderGeometry args={[0.25, 0.32, 1.8, 5]} />
        <meshBasicMaterial color="#256b37" />
      </mesh>
      <mesh position={[-armSide * 2.05, armHeight + 0.83, 0]} scale={[1.2, 1.1, 1.2]} castShadow={false}>
        <cylinderGeometry args={[0.25, 0.3, 2.1, 5]} />
        <meshBasicMaterial color="#12351f" side={THREE.BackSide} />
      </mesh>
      <mesh position={[-armSide * 2.05, armHeight + 0.85, 0]} castShadow={false}>
        <cylinderGeometry args={[0.25, 0.3, 2.1, 5]} />
        <meshBasicMaterial color="#2f7a3f" />
      </mesh>
    </group>
  );
}

export function DesertTumbleweed({ x, y, z, scale, seed }: { x: number; y: number; z: number; scale: number; seed: number }) {
  const tumbleScale = scale * 1.25;

  return (
    <group
      position={[x + Math.sin(seed * 6.28) * 2.2, y + 1.35 * tumbleScale, z]}
      rotation={[seed * Math.PI * 2, seed * Math.PI, seed * Math.PI * 1.3]}
      scale={[tumbleScale, tumbleScale, tumbleScale]}
    >
      <mesh castShadow={false}>
        <dodecahedronGeometry args={[1.25, 0]} />
        <meshBasicMaterial color="#9b6a35" wireframe />
      </mesh>
      <mesh rotation={[0.6, 0.3, 0.15]} castShadow={false}>
        <cylinderGeometry args={[0.045, 0.045, 2.6, 4]} />
        <meshBasicMaterial color="#6f4a22" />
      </mesh>
      <mesh rotation={[1.2, -0.7, 1.1]} castShadow={false}>
        <cylinderGeometry args={[0.04, 0.04, 2.35, 4]} />
        <meshBasicMaterial color="#7f5629" />
      </mesh>
      <mesh rotation={[-0.5, 1.1, 0.9]} castShadow={false}>
        <cylinderGeometry args={[0.035, 0.035, 2.2, 4]} />
        <meshBasicMaterial color="#8a5d2c" />
      </mesh>
    </group>
  );
}
