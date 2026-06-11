import { useMemo } from "react";
import * as THREE from "three";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { isMobilePerformanceMode } from "./systems/input/performanceMode";
import {
  TREE_HOUSE_BRIDGE_CONNECTIONS,
  TREE_HOUSE_INTERNAL_ROPE_CONNECTIONS,
  TREE_HOUSE_ROOT_COLLIDERS,
  TREE_HOUSE_SPECS,
  buildTreeHouseVillageLayout,
  getTreeHouseIndexRange,
  getTreeHouseSpanTransform,
  type TreeHouseTreePlacement,
} from "./systems/world/villages/treeHouseVillageRuntime";
import {
  getTreeHouseBarkTexture,
  getTreeHousePlankTexture,
} from "./systems/world/villages/treeHouseVillageTextures";

const LEAF_COLOR = "#1f3b18"; // dark green
const LEAF_EDGE_COLOR = "#244a1c";
const ROOF_COLOR = "#342211"; // distinct roof brown
const WINDOW_GLOW = "#ffb347"; // warm yellow-orange
const MOBILE_PERFORMANCE_MODE = isMobilePerformanceMode();

function Window({ position, rotation = [0, 0, 0] }: { position: [number, number, number], rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation as [number, number, number]}>
      {/* Glow */}
      <mesh>
        <planeGeometry args={[1, 1.2]} />
        <meshStandardMaterial color={WINDOW_GLOW} emissive={WINDOW_GLOW} emissiveIntensity={3} />
      </mesh>
      {/* Frame details can be added as lines or small boxes */}
      {!MOBILE_PERFORMANCE_MODE && (
        <>
          <mesh position={[0, 0, 0.05]}>
             <boxGeometry args={[0.1, 1.2, 0.1]} />
             <meshStandardMaterial map={getTreeHouseBarkTexture()} />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
             <boxGeometry args={[1, 0.1, 0.1]} />
             <meshStandardMaterial map={getTreeHouseBarkTexture()} />
          </mesh>
        </>
      )}
      {/* Light Source */}
      {!MOBILE_PERFORMANCE_MODE && <pointLight position={[0, 0, 1]} intensity={3} distance={15} color={WINDOW_GLOW} decay={2} />}
    </group>
  );
}

function CanopyBlock({ position, size, color = LEAF_COLOR }: { position: [number, number, number]; size: [number, number, number]; color?: string }) {
  const radius = 1;
  const scale: [number, number, number] = [size[0] * 0.52, size[1] * 0.52, size[2] * 0.52];
  const edgeScale: [number, number, number] = [scale[0] * 1.01, scale[1] * 1.01, scale[2] * 1.01];

  return (
    <group position={position}>
      <mesh castShadow={false} receiveShadow scale={edgeScale} renderOrder={3}>
        <dodecahedronGeometry args={[radius, 0]} />
        <meshStandardMaterial color={LEAF_EDGE_COLOR} roughness={1} wireframe transparent opacity={0.44} depthWrite={false} />
      </mesh>
      <mesh castShadow receiveShadow scale={scale}>
        <dodecahedronGeometry args={[radius, 0]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      {!MOBILE_PERFORMANCE_MODE && (
        <group position={[0, size[1] * 0.18, -size[2] * 0.28]} scale={[size[0] * 0.32, size[1] * 0.12, size[2] * 0.16]}>
          <mesh scale={[1.012, 1.012, 1.012]} castShadow={false} renderOrder={3}>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={LEAF_EDGE_COLOR} roughness={1} wireframe transparent opacity={0.4} depthWrite={false} />
          </mesh>
          <mesh castShadow={false}>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#2e5a22" roughness={1} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function House({ position, rotation, scale = 1 }: { position: [number, number, number], rotation?: [number, number, number], scale?: number }) {
  return (
    <group position={position} rotation={rotation || [0, 0, 0]} scale={scale}>
      {/* Main Blocky Body */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[5, 5, 5]} />
        <meshStandardMaterial map={getTreeHousePlankTexture()} roughness={0.9} />
      </mesh>
      
      {/* Flat/Blocky Roof */}
      <mesh castShadow receiveShadow position={[0, 3, 0]}>
        <boxGeometry args={[6, 2, 6]} />
        <meshStandardMaterial color={ROOF_COLOR} roughness={0.9} />
      </mesh>

      {/* Main Wrapper Balcony */}
      <mesh castShadow receiveShadow position={[0, -2.5, 0]}>
        <boxGeometry args={[7, 0.5, 7]} />
        <meshStandardMaterial map={getTreeHousePlankTexture()} roughness={0.9} />
      </mesh>
      
      {/* Windows on multiple sides */}
      <Window position={[0, 0.5, 2.51]} />
      <Window position={[2.51, 0.5, 0]} rotation={[0, Math.PI / 2, 0]} />
      <Window position={[-2.51, 0.5, 0]} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}

function HouseColliders({ position, rotation, scale = 1 }: { position: [number, number, number]; rotation?: [number, number, number]; scale?: number }) {
  return (
    <group position={position} rotation={rotation || [0, 0, 0]}>
      <CuboidCollider args={[2.5 * scale, 2.5 * scale, 2.5 * scale]} />
      <CuboidCollider args={[3 * scale, 1 * scale, 3 * scale]} position={[0, 3 * scale, 0]} />
      <CuboidCollider args={[3.5 * scale, 0.25 * scale, 3.5 * scale]} position={[0, -2.5 * scale, 0]} />
    </group>
  );
}

function GiantTreeCanopy({ position, angleOffset = 0 }: { position: [number, number, number], angleOffset?: number }) {
  return (
    <group position={position} rotation={[0, angleOffset, 0]}>
      <CanopyBlock position={[0, 40, 0]} size={[30, 15, 30]} color="#1f3b18" />
      <CanopyBlock position={[12, 35, 10]} size={[20, 15, 20]} color="#2d5a22" />
      <CanopyBlock position={[-15, 38, -12]} size={[25, 20, 25]} color="#284f1d" />
      <CanopyBlock position={[-10, 36, 15]} size={[20, 12, 20]} color="#3a6a2a" />
      <CanopyBlock position={[16, 43, -8]} size={[17, 10, 18]} color="#335f25" />
      <CanopyBlock position={[-4, 43.5, 8]} size={[16, 7, 14]} color="#244719" />
    </group>
  );
}

function SpiralStaircase({ radius = 6.5, height = 15, steps = MOBILE_PERFORMANCE_MODE ? 16 : 30 }: { radius?: number, height?: number, steps?: number }) {
  return (
    <group>
      {getTreeHouseIndexRange(steps).map((i) => {
        const t = i / (steps - 1);
        const y = t * height;
        const angle = t * Math.PI * 4; // 2 full turns
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        return (
          <mesh key={i} position={[x, y, z]} rotation={[0, -angle, 0]} castShadow receiveShadow>
            <boxGeometry args={[3, 0.2, 1.5]} />
            <meshStandardMaterial map={getTreeHousePlankTexture()} roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}

function SpiralStaircaseColliders({ radius = 6.5, height = 15, steps = MOBILE_PERFORMANCE_MODE ? 16 : 30 }: { radius?: number; height?: number; steps?: number }) {
  return (
    <group>
      {getTreeHouseIndexRange(steps).map((i) => {
        const t = i / (steps - 1);
        const y = t * height;
        const angle = t * Math.PI * 4;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        return (
          <CuboidCollider
            key={`stair-step-collider-${i}`}
            args={[1.5, 0.1, 0.75]}
            position={[x, y, z]}
            rotation={[0, -angle, 0]}
          />
        );
      })}
    </group>
  );
}

function GiantTree({ position, angleOffset = 0 }: { position: [number, number, number], angleOffset?: number }) {
  
  return (
    <group position={position} rotation={[0, angleOffset, 0]}>
      {/* Blocky Twisted Trunk (Wizard Tower style) */}
      <mesh castShadow receiveShadow position={[0, 20, 0]}>
        <boxGeometry args={[10, 40, 10]} />
        <meshStandardMaterial map={getTreeHouseBarkTexture()} roughness={1} />
      </mesh>
      <mesh castShadow receiveShadow position={[2, 20, 2]} rotation={[0, 0.5, 0]}>
        <boxGeometry args={[8, 40, 8]} />
        <meshStandardMaterial map={getTreeHouseBarkTexture()} roughness={1} />
      </mesh>

      {/* Blocky Roots (Sloped) */}
      <group position={[4, 0, 4]} rotation={[0, Math.PI/4, 0]}>
        <mesh castShadow receiveShadow position={[0, -2, 4]} rotation={[Math.PI/6, 0, 0]}>
          <boxGeometry args={[4, 4, 15]} />
          <meshStandardMaterial map={getTreeHouseBarkTexture()} roughness={1} />
        </mesh>
      </group>
      <group position={[-4, 0, -4]} rotation={[0, -Math.PI*3/4, 0]}>
        <mesh castShadow receiveShadow position={[0, -2, 4]} rotation={[Math.PI/6, 0, 0]}>
          <boxGeometry args={[4, 4, 15]} />
          <meshStandardMaterial map={getTreeHouseBarkTexture()} roughness={1} />
        </mesh>
      </group>
      <group position={[-4, 0, 4]} rotation={[0, -Math.PI/4, 0]}>
        <mesh castShadow receiveShadow position={[0, -2, 4]} rotation={[Math.PI/6, 0, 0]}>
          <boxGeometry args={[4, 4, 15]} />
          <meshStandardMaterial map={getTreeHouseBarkTexture()} roughness={1} />
        </mesh>
      </group>
      <group position={[4, 0, -4]} rotation={[0, Math.PI*3/4, 0]}>
        <mesh castShadow receiveShadow position={[0, -2, 4]} rotation={[Math.PI/6, 0, 0]}>
          <boxGeometry args={[4, 4, 15]} />
          <meshStandardMaterial map={getTreeHouseBarkTexture()} roughness={1} />
        </mesh>
      </group>

      {/* Spiral Staircase up to the first house */}
      <SpiralStaircase />

      {/* Houses Clustered on Trunk */}
      {TREE_HOUSE_SPECS.map((house, index) => (
        <House key={`tree-house-${index}`} position={house.position} rotation={house.rotation} scale={house.scale} />
      ))}
    </group>
  );
}

function GiantTreeColliders({ position, angleOffset = 0 }: { position: [number, number, number]; angleOffset?: number }) {
  return (
    <group position={position} rotation={[0, angleOffset, 0]}>
      <CuboidCollider args={[5, 20, 5]} position={[0, 20, 0]} />
      <CuboidCollider args={[4, 20, 4]} position={[2, 20, 2]} rotation={[0, 0.5, 0]} />
      {TREE_HOUSE_ROOT_COLLIDERS.map((root, index) => (
        <group key={`root-collider-${index}`} position={root.position} rotation={[0, root.rotation, 0]}>
          <CuboidCollider args={[2, 2, 7.5]} position={[0, -2, 4]} rotation={[Math.PI / 6, 0, 0]} />
        </group>
      ))}
      <SpiralStaircaseColliders />
      {TREE_HOUSE_SPECS.map((house, index) => (
        <HouseColliders key={`tree-house-collider-${index}`} position={house.position} rotation={house.rotation} scale={house.scale} />
      ))}
    </group>
  );
}

function Bridge({ start, end }: { start: THREE.Vector3, end: THREE.Vector3 }) {
  const { length, position, angleX, angleY } = getTreeHouseSpanTransform(start, end);
  
  return (
    <group position={position} rotation={[angleX, angleY, 0]}>
      {/* Walkway */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[4, 0.5, length]} />
        <meshStandardMaterial map={getTreeHousePlankTexture()} roughness={0.9} />
      </mesh>
      {/* Side Rails */}
      <mesh castShadow receiveShadow position={[2, 1, 0]}>
        <boxGeometry args={[0.2, 0.2, length]} />
        <meshStandardMaterial map={getTreeHouseBarkTexture()} roughness={0.9} />
      </mesh>
      <mesh castShadow receiveShadow position={[-2, 1, 0]}>
        <boxGeometry args={[0.2, 0.2, length]} />
        <meshStandardMaterial map={getTreeHouseBarkTexture()} roughness={0.9} />
      </mesh>
    </group>
  );
}

function BridgeColliders({ start, end }: { start: THREE.Vector3; end: THREE.Vector3 }) {
  const { length, position, angleX, angleY } = getTreeHouseSpanTransform(start, end);

  return (
    <group position={position} rotation={[angleX, angleY, 0]}>
      <CuboidCollider args={[2, 0.25, length / 2]} />
      <CuboidCollider args={[0.1, 0.1, length / 2]} position={[2, 1, 0]} />
      <CuboidCollider args={[0.1, 0.1, length / 2]} position={[-2, 1, 0]} />
    </group>
  );
}

function RopeClimb({ start, end }: { start: THREE.Vector3, end: THREE.Vector3 }) {
  const { length, position, angleX, angleY } = getTreeHouseSpanTransform(start, end);
  const rungStep = MOBILE_PERFORMANCE_MODE ? 2 : 1;
  const rungCount = Math.floor(length / rungStep);
  
  return (
    <group position={position} rotation={[angleX, angleY, 0]}>
      {/* Main Rope - needs to be rotated to run along local Z */}
      <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, length, 8]} />
        <meshStandardMaterial color="#8b5a2b" roughness={0.9} />
      </mesh>
      {/* Wooden climbing rungs */}
      {getTreeHouseIndexRange(rungCount).map((i) => {
        return (
         <mesh key={i} position={[0, 0, -length / 2 + i * rungStep + rungStep * 0.5]} castShadow receiveShadow>
            <boxGeometry args={[1.5, 0.2, 0.2]} />
            <meshStandardMaterial map={getTreeHouseBarkTexture()} />
         </mesh>
        );
      })}
    </group>
  );
}

function RopeClimbColliders({ start, end }: { start: THREE.Vector3; end: THREE.Vector3 }) {
  const { length, position, angleX, angleY } = getTreeHouseSpanTransform(start, end);

  return (
    <group position={position} rotation={[angleX, angleY, 0]}>
      <CuboidCollider args={[0.55, 0.14, length / 2]} />
    </group>
  );
}

function TreeHouseVillageCollisionLayer({
  treePositions,
  houseBalconies,
  treeBases,
}: {
  treePositions: TreeHouseTreePlacement[];
  houseBalconies: THREE.Vector3[][];
  treeBases: THREE.Vector3[];
}) {
  return (
    <>
      {treePositions.map((tree, index) => (
        <GiantTreeColliders key={`tree-colliders-${index}`} position={[tree.pos.x, tree.pos.y, tree.pos.z]} angleOffset={tree.angle} />
      ))}

      {treePositions.map((_, index) => (
        <group key={`internal-rope-colliders-${index}`}>
          {TREE_HOUSE_INTERNAL_ROPE_CONNECTIONS.map(([startHouse, endHouse]) => (
            <RopeClimbColliders
              key={`internal-rope-collider-${index}-${startHouse}-${endHouse}`}
              start={houseBalconies[index][startHouse]}
              end={houseBalconies[index][endHouse]}
            />
          ))}
        </group>
      ))}

      {treePositions.map((_, index) => (
        <RopeClimbColliders key={`ground-rope-collider-${index}`} start={treeBases[index]} end={houseBalconies[index][0]} />
      ))}

      {TREE_HOUSE_BRIDGE_CONNECTIONS.map((connection, index) => (
        <BridgeColliders
          key={`bridge-collider-${index}`}
          start={houseBalconies[connection.startTree][connection.startHouse]}
          end={houseBalconies[connection.endTree][connection.endHouse]}
        />
      ))}
    </>
  );
}

export function TreeHouseVillage() {
  const { treePositions, houseBalconies, treeBases } = useMemo(buildTreeHouseVillageLayout, []);

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <TreeHouseVillageCollisionLayer
          treePositions={treePositions}
          houseBalconies={houseBalconies}
          treeBases={treeBases}
        />
        <group>
          {treePositions.map((t, i) => (
             <GiantTree key={i} position={[t.pos.x, t.pos.y, t.pos.z]} angleOffset={t.angle} />
          ))}
          
          {/* Internal Tree Connections (Ropes between houses on same tree) */}
          {treePositions.map((_, i) => (
             <group key={`internal-${i}`}>
               {TREE_HOUSE_INTERNAL_ROPE_CONNECTIONS.map(([startHouse, endHouse]) => (
                 <RopeClimb
                   key={`internal-rope-${i}-${startHouse}-${endHouse}`}
                   start={houseBalconies[i][startHouse]}
                   end={houseBalconies[i][endHouse]}
                 />
               ))}
             </group>
          ))}

          {/* Ropes from Ground to first house of each tree */}
          {treePositions.map((_, i) => (
             <RopeClimb key={`ground-${i}`} start={treeBases[i]} end={houseBalconies[i][0]} />
          ))}

          {TREE_HOUSE_BRIDGE_CONNECTIONS.map((connection, index) => (
            <Bridge
              key={`bridge-${index}`}
              start={houseBalconies[connection.startTree][connection.startHouse]}
              end={houseBalconies[connection.endTree][connection.endHouse]}
            />
          ))}
          
        </group>
      </RigidBody>
      <group>
        {treePositions.map((t, i) => (
          <GiantTreeCanopy key={`canopy-${i}`} position={[t.pos.x, t.pos.y, t.pos.z]} angleOffset={t.angle} />
        ))}
      </group>
    </group>
  );
}
