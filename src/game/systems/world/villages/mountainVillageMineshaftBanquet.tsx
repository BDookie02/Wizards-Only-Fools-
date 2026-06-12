import { Fragment } from "react";
import * as THREE from "three";
import { MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS, MOUNTAIN_VILLAGE_MINESHAFT_THRONE_Z } from "./mountainVillageTerrain";
import { getMountainMineshaftRoyalBanquetDescriptors } from "./mountainVillageMineshaftRuntime";
import { RetroMineshaftLantern } from "./mountainVillageMineshaftLighting";

const MOUNTAIN_MINESHAFT_CHAIR_LEG_OFFSETS = [
  { x: -0.74, z: -0.5 },
  { x: -0.74, z: 0.54 },
  { x: 0.74, z: -0.5 },
  { x: 0.74, z: 0.54 },
] as const;
const MOUNTAIN_MINESHAFT_CHAIR_BACK_SPIRE_X = [-0.72, 0, 0.72] as const;
const MOUNTAIN_MINESHAFT_THRONE_ARM_SIDES = [-1.94, 1.94] as const;
const MOUNTAIN_MINESHAFT_THRONE_SPIRE_X = [-1.72, 0, 1.72] as const;

export function MountainMineshaftBottomLightRing() {
  const { bottomLights } = getMountainMineshaftRoyalBanquetDescriptors();

  return (
    <group name="mineshaft-bottom-light-ring">
      {bottomLights.map((light) => (
        <group key={`bottom-light-${light.index}`} position={light.position} rotation={light.rotation}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} renderOrder={9}>
            <circleGeometry args={[3.4, 12]} />
            <meshBasicMaterial color="#ff9d36" transparent opacity={0.24} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.12, 0]} castShadow={false}>
            <cylinderGeometry args={[1.55, 1.85, 0.24, 8]} />
            <meshBasicMaterial color="#20140d" />
          </mesh>
          <mesh position={[0, 0.42, 0]} castShadow={false}>
            <cylinderGeometry args={[1.1, 1.35, 0.46, 8]} />
            <meshBasicMaterial color={light.bodyColor} />
          </mesh>
          <mesh position={[0, 1.1, 0]} castShadow={false}>
            <boxGeometry args={[0.42, 1.35, 0.42]} />
            <meshBasicMaterial color="#1a100a" />
          </mesh>
          <RetroMineshaftLantern position={[0, 2.08, 0]} scale={0.72} withLight={light.withLight} />
        </group>
      ))}
    </group>
  );
}

export function MountainMineshaftBanquetChair({
  chair,
}: {
  chair: ReturnType<typeof getMountainMineshaftRoyalBanquetDescriptors>["chairs"][number];
}) {
  return (
    <group position={chair.position} rotation={chair.rotation}>
      <mesh position={[0, 0.72, 0]} castShadow={false}>
        <boxGeometry args={[2.0, 0.38, 1.72]} />
        <meshBasicMaterial color={chair.seatColor} />
      </mesh>
      <mesh position={[0, 0.96, -0.12]} castShadow={false}>
        <boxGeometry args={[1.62, 0.22, 1.2]} />
        <meshBasicMaterial color="#8e1e24" />
      </mesh>
      <mesh position={[0, 1.86, 0.82]} castShadow={false}>
        <boxGeometry args={[2.18, 2.32, 0.42]} />
        <meshBasicMaterial color="#3d2617" />
      </mesh>
      <mesh position={[0, 2.0, 1.08]} castShadow={false}>
        <boxGeometry args={[1.54, 1.74, 0.18]} />
        <meshBasicMaterial color="#7b5332" />
      </mesh>
      <mesh position={[-1.24, 1.12, -0.08]} castShadow={false}>
        <boxGeometry args={[0.32, 0.98, 1.74]} />
        <meshBasicMaterial color="#2a1a10" />
      </mesh>
      <mesh position={[1.24, 1.12, -0.08]} castShadow={false}>
        <boxGeometry args={[0.32, 0.98, 1.74]} />
        <meshBasicMaterial color="#2a1a10" />
      </mesh>
      {MOUNTAIN_MINESHAFT_CHAIR_LEG_OFFSETS.map(({ x: legX, z: legZ }) => (
        <mesh key={`chair-leg-${legX}-${legZ}`} position={[legX, 0.36, legZ]} castShadow={false}>
          <boxGeometry args={[0.24, 0.72, 0.24]} />
          <meshBasicMaterial color="#1b1009" />
        </mesh>
      ))}
      {MOUNTAIN_MINESHAFT_CHAIR_BACK_SPIRE_X.map((barX) => (
        <mesh key={`chair-back-gold-${barX}`} position={[barX, 2.92, 1.1]} castShadow={false}>
          <boxGeometry args={[0.24, 0.36, 0.24]} />
          <meshBasicMaterial color="#d7a548" />
        </mesh>
      ))}
    </group>
  );
}

export function MountainMineshaftKingsThrone() {
  return (
    <group position={[0, 0, MOUNTAIN_VILLAGE_MINESHAFT_THRONE_Z]} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, 0.28, -0.04]} castShadow={false}>
        <boxGeometry args={[5.2, 0.56, 3.8]} />
        <meshBasicMaterial color="#21140c" />
      </mesh>
      <mesh position={[0, 0.86, -0.28]} castShadow={false}>
        <boxGeometry args={[4.35, 0.72, 3.0]} />
        <meshBasicMaterial color="#704527" />
      </mesh>
      <mesh position={[0, 1.16, -0.42]} castShadow={false}>
        <boxGeometry args={[3.45, 0.24, 2.1]} />
        <meshBasicMaterial color="#8e1e24" />
      </mesh>
      <mesh position={[0, 2.46, 1.08]} castShadow={false}>
        <boxGeometry args={[4.55, 3.8, 0.72]} />
        <meshBasicMaterial color="#3a2415" />
      </mesh>
      <mesh position={[0, 2.56, 1.48]} castShadow={false}>
        <boxGeometry args={[3.18, 2.86, 0.22]} />
        <meshBasicMaterial color="#9f2428" />
      </mesh>
      {MOUNTAIN_MINESHAFT_THRONE_ARM_SIDES.map((side) => (
        <Fragment key={`throne-arm-${side}`}>
          <mesh position={[side, 1.28, -0.3]} castShadow={false}>
            <boxGeometry args={[0.62, 1.42, 3.12]} />
            <meshBasicMaterial color="#2b1a0f" />
          </mesh>
          <mesh position={[side, 2.12, -1.18]} castShadow={false}>
            <boxGeometry args={[0.78, 0.28, 1.28]} />
            <meshBasicMaterial color="#d7a548" />
          </mesh>
        </Fragment>
      ))}
      <mesh position={[0, 4.64, 1.1]} rotation={[0, Math.PI / 4, 0]} castShadow={false}>
        <coneGeometry args={[1.26, 1.16, 4]} />
        <meshBasicMaterial color="#e2b34c" />
      </mesh>
      {MOUNTAIN_MINESHAFT_THRONE_SPIRE_X.map((x, index) => (
        <mesh key={`throne-spire-${index}`} position={[x, 4.36 + (index === 1 ? 0.36 : 0), 1.12]} castShadow={false}>
          <boxGeometry args={[0.4, index === 1 ? 1.28 : 0.9, 0.42]} />
          <meshBasicMaterial color="#d7a548" />
        </mesh>
      ))}
      <mesh position={[0, 0.74, -2.45]} castShadow={false}>
        <boxGeometry args={[6.4, 0.16, 1.7]} />
        <meshBasicMaterial color="#68161d" />
      </mesh>
    </group>
  );
}

export function MountainMineshaftBanquetTable() {
  const { table } = getMountainMineshaftRoyalBanquetDescriptors();

  return (
    <group name="mineshaft-royal-banquet-table">
      <mesh position={[0, 1.2, 0]} castShadow={false}>
        <cylinderGeometry args={[1.55, 2.1, 1.75, 12]} />
        <meshBasicMaterial color="#3a2415" />
      </mesh>
      <mesh position={[0, 1.78, 0]} castShadow={false}>
        <cylinderGeometry args={[table.radius, table.radius * 0.96, 0.58, 20]} />
        <meshBasicMaterial color="#5e3a20" />
      </mesh>
      <mesh position={[0, 2.14, 0]} castShadow={false}>
        <cylinderGeometry args={[table.radius * 1.05, table.radius * 1.05, 0.22, 20]} />
        <meshBasicMaterial color="#2a1a10" />
      </mesh>
      {table.planks.map((plank) => (
        <mesh key={`table-plank-${plank.index}`} position={[0, 2.28, plank.z]} castShadow={false}>
          <boxGeometry args={[plank.width, 0.08, 0.32]} />
          <meshBasicMaterial color={plank.color} transparent opacity={0.76} />
        </mesh>
      ))}
      {table.legs.map((leg) => (
        <mesh key={`table-leg-${leg.index}`} position={leg.position} castShadow={false}>
          <boxGeometry args={[0.42, 1.55, 0.42]} />
          <meshBasicMaterial color="#21140c" />
        </mesh>
      ))}
      <mesh position={[0, 2.7, 0]} scale={[2.35, 0.52, 1.22]} castShadow={false}>
        <sphereGeometry args={[1, 10, 6]} />
        <meshBasicMaterial color="#9a4f2c" />
      </mesh>
      <mesh position={[-1.86, 2.72, 0.12]} rotation={[0, 0, Math.PI / 2]} castShadow={false}>
        <cylinderGeometry args={[0.16, 0.16, 1.42, 8]} />
        <meshBasicMaterial color="#f1d8a0" />
      </mesh>
      <mesh position={[1.86, 2.72, 0.12]} rotation={[0, 0, Math.PI / 2]} castShadow={false}>
        <cylinderGeometry args={[0.16, 0.16, 1.42, 8]} />
        <meshBasicMaterial color="#f1d8a0" />
      </mesh>
      {table.breads.map((bread) => (
        <group key={`banquet-bread-${bread.index}`} position={bread.position} rotation={bread.rotation}>
          <mesh scale={[1.18, 0.36, 0.62]} castShadow={false}>
            <sphereGeometry args={[1, 8, 5]} />
            <meshBasicMaterial color={bread.color} />
          </mesh>
          <mesh position={[0, 0.12, 0.18]} castShadow={false}>
            <boxGeometry args={[1.4, 0.08, 0.12]} />
            <meshBasicMaterial color="#fff0b2" transparent opacity={0.44} />
          </mesh>
        </group>
      ))}
      {table.fruitBowls.map((bowl) => (
        <group key={`fruit-bowl-${bowl.index}`} position={bowl.position}>
          <mesh position={[0, -0.04, 0]} castShadow={false}>
            <cylinderGeometry args={[0.86, 0.7, 0.18, 10]} />
            <meshBasicMaterial color="#2b1a0f" />
          </mesh>
          {bowl.fruits.map((fruit) => (
            <mesh key={`fruit-${fruit.index}`} position={fruit.position} scale={[0.24, 0.24, 0.24]} castShadow={false}>
              <sphereGeometry args={[1, 6, 4]} />
              <meshBasicMaterial color={fruit.color} />
            </mesh>
          ))}
        </group>
      ))}
      {table.plates.map((plate) => (
        <group key={`banquet-place-${plate.index}`} position={plate.position} rotation={plate.rotation}>
          <mesh castShadow={false}>
            <cylinderGeometry args={[0.82, 0.9, 0.08, 12]} />
            <meshBasicMaterial color="#d7cab2" />
          </mesh>
          <mesh position={[0, 0.09, -0.05]} scale={[0.48, 0.12, 0.32]} castShadow={false}>
            <sphereGeometry args={[1, 6, 4]} />
            <meshBasicMaterial color={plate.foodColor} />
          </mesh>
          <mesh position={[0.78, 0.2, -0.18]} castShadow={false}>
            <cylinderGeometry args={[0.16, 0.22, 0.42, 8]} />
            <meshBasicMaterial color="#b58b45" />
          </mesh>
        </group>
      ))}
      {table.candles.map((candle) => (
        <group key={`table-candle-${candle.index}`} position={candle.position}>
          <mesh position={[0, 0.3, 0]} castShadow={false}>
            <cylinderGeometry args={[0.16, 0.16, 0.6, 8]} />
            <meshBasicMaterial color="#f6e2a8" />
          </mesh>
          <mesh position={[0, 0.74, 0]} castShadow={false} renderOrder={8}>
            <sphereGeometry args={[0.34, 8, 5]} />
            <meshBasicMaterial color="#ffb347" transparent opacity={0.84} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function MountainMineshaftRoyalBanquet({ bottomY, showDetails }: { bottomY: number; showDetails: boolean }) {
  if (!showDetails) return null;

  const { chairs } = getMountainMineshaftRoyalBanquetDescriptors();

  return (
    <group name="mineshaft-bottom-royal-banquet" position={[0, bottomY, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]} renderOrder={8}>
        <circleGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS * 0.62, 40]} />
        <meshBasicMaterial color="#120b07" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <MountainMineshaftBottomLightRing />
      <MountainMineshaftBanquetTable />
      {chairs.map((chair) => (
        <MountainMineshaftBanquetChair key={`banquet-chair-${chair.index}`} chair={chair} />
      ))}
      <MountainMineshaftKingsThrone />
    </group>
  );
}
