import { useRef, useMemo } from "react";
import * as THREE from "three";
import { RigidBody } from "@react-three/rapier";
import { isMobilePerformanceMode } from "./performanceMode";

const WOOD_COLOR = "#2a1c12"; // darker brown
const LIGHT_WOOD_COLOR = "#4a3221"; // lighter brown
const LEAF_COLOR = "#1f3b18"; // dark green
const LEAF_EDGE_COLOR = "#071209";
const ROOF_COLOR = "#342211"; // distinct roof brown
const WINDOW_GLOW = "#ffb347"; // warm yellow-orange
const MOBILE_PERFORMANCE_MODE = isMobilePerformanceMode();

function getBarkTexture() {
  let cachedBark = (window as any).__barkTexture;
  if (cachedBark) return cachedBark;
  
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = WOOD_COLOR;
  ctx.fillRect(0, 0, 64, 64);
  // Vertical stripes for bark
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(20, 10, 5, 0.5)" : "rgba(80, 50, 20, 0.3)";
    const x = Math.floor(Math.random() * 64);
    const y = Math.floor(Math.random() * 64);
    const w = Math.floor(1 + Math.random() * 2);
    const h = Math.floor(4 + Math.random() * 16);
    ctx.fillRect(x, y, w, h);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 4);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  (window as any).__barkTexture = tex;
  return tex;
}

function getPlankTexture() {
  let cachedPlank = (window as any).__plankTexture;
  if (cachedPlank) return cachedPlank;

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = LIGHT_WOOD_COLOR;
  ctx.fillRect(0, 0, 64, 64);
  
  // Planks
  ctx.fillStyle = "#1a120b";
  for (let y = 0; y < 64; y += 16) {
    ctx.fillRect(0, y, 64, 2); // Horizontal lines
  }
  // Vertical staggers
  for (let y = 0; y < 64; y += 16) {
    const offsetX = (y / 16) % 2 === 0 ? 0 : 32;
    ctx.fillRect(offsetX, y, 2, 16);
  }
  
  // Wood grain noise
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(Math.floor(Math.random() * 64), Math.floor(Math.random() * 64), 4, 1);
  }
  
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  (window as any).__plankTexture = tex;
  return tex;
}

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
             <meshStandardMaterial map={getBarkTexture()} />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
             <boxGeometry args={[1, 0.1, 0.1]} />
             <meshStandardMaterial map={getBarkTexture()} />
          </mesh>
        </>
      )}
      {/* Light Source */}
      {!MOBILE_PERFORMANCE_MODE && <pointLight position={[0, 0, 1]} intensity={3} distance={15} color={WINDOW_GLOW} decay={2} />}
    </group>
  );
}

function CanopyBlock({ position, size }: { position: [number, number, number]; size: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow scale={[1.045, 1.045, 1.045]}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={LEAF_EDGE_COLOR} roughness={1} side={THREE.BackSide} />
      </mesh>
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={LEAF_COLOR} roughness={1} />
      </mesh>
      {!MOBILE_PERFORMANCE_MODE && (
        <mesh position={[0, size[1] * 0.28, -size[2] * 0.36]} castShadow={false}>
          <boxGeometry args={[size[0] * 0.62, 0.55, size[2] * 0.12]} />
          <meshStandardMaterial color="#2e5a22" roughness={1} />
        </mesh>
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
        <meshStandardMaterial map={getPlankTexture()} roughness={0.9} />
      </mesh>
      
      {/* Flat/Blocky Roof */}
      <mesh castShadow receiveShadow position={[0, 3, 0]}>
        <boxGeometry args={[6, 2, 6]} />
        <meshStandardMaterial color={ROOF_COLOR} roughness={0.9} />
      </mesh>

      {/* Main Wrapper Balcony */}
      <mesh castShadow receiveShadow position={[0, -2.5, 0]}>
        <boxGeometry args={[7, 0.5, 7]} />
        <meshStandardMaterial map={getPlankTexture()} roughness={0.9} />
      </mesh>
      
      {/* Windows on multiple sides */}
      <Window position={[0, 0.5, 2.51]} />
      <Window position={[2.51, 0.5, 0]} rotation={[0, Math.PI / 2, 0]} />
      <Window position={[-2.51, 0.5, 0]} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}

function GiantTreeCanopy({ position, angleOffset = 0 }: { position: [number, number, number], angleOffset?: number }) {
  return (
    <group position={position} rotation={[0, angleOffset, 0]}>
      {/* Blocky Canopy for DOOM feel */}
      <CanopyBlock position={[0, 40, 0]} size={[30, 15, 30]} />
      <CanopyBlock position={[12, 35, 10]} size={[20, 15, 20]} />
      <CanopyBlock position={[-15, 38, -12]} size={[25, 20, 25]} />
      <CanopyBlock position={[-10, 36, 15]} size={[20, 12, 20]} />
    </group>
  );
}

function SpiralStaircase({ radius = 6.5, height = 15, steps = MOBILE_PERFORMANCE_MODE ? 16 : 30 }: { radius?: number, height?: number, steps?: number }) {
  return (
    <group>
      {Array.from({ length: steps }).map((_, i) => {
        const t = i / (steps - 1);
        const y = t * height;
        const angle = t * Math.PI * 4; // 2 full turns
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        return (
          <mesh key={i} position={[x, y, z]} rotation={[0, -angle, 0]} castShadow receiveShadow>
            <boxGeometry args={[3, 0.2, 1.5]} />
            <meshStandardMaterial map={getPlankTexture()} roughness={0.9} />
          </mesh>
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
        <meshStandardMaterial map={getBarkTexture()} roughness={1} />
      </mesh>
      <mesh castShadow receiveShadow position={[2, 20, 2]} rotation={[0, 0.5, 0]}>
        <boxGeometry args={[8, 40, 8]} />
        <meshStandardMaterial map={getBarkTexture()} roughness={1} />
      </mesh>

      {/* Blocky Roots (Sloped) */}
      <group position={[4, 0, 4]} rotation={[0, Math.PI/4, 0]}>
        <mesh castShadow receiveShadow position={[0, -2, 4]} rotation={[Math.PI/6, 0, 0]}>
          <boxGeometry args={[4, 4, 15]} />
          <meshStandardMaterial map={getBarkTexture()} roughness={1} />
        </mesh>
      </group>
      <group position={[-4, 0, -4]} rotation={[0, -Math.PI*3/4, 0]}>
        <mesh castShadow receiveShadow position={[0, -2, 4]} rotation={[Math.PI/6, 0, 0]}>
          <boxGeometry args={[4, 4, 15]} />
          <meshStandardMaterial map={getBarkTexture()} roughness={1} />
        </mesh>
      </group>
      <group position={[-4, 0, 4]} rotation={[0, -Math.PI/4, 0]}>
        <mesh castShadow receiveShadow position={[0, -2, 4]} rotation={[Math.PI/6, 0, 0]}>
          <boxGeometry args={[4, 4, 15]} />
          <meshStandardMaterial map={getBarkTexture()} roughness={1} />
        </mesh>
      </group>
      <group position={[4, 0, -4]} rotation={[0, Math.PI*3/4, 0]}>
        <mesh castShadow receiveShadow position={[0, -2, 4]} rotation={[Math.PI/6, 0, 0]}>
          <boxGeometry args={[4, 4, 15]} />
          <meshStandardMaterial map={getBarkTexture()} roughness={1} />
        </mesh>
      </group>

      {/* Spiral Staircase up to the first house */}
      <SpiralStaircase />

      {/* Houses Clustered on Trunk */}
      <House position={[6.5, 15, 6.5]} rotation={[0, Math.PI / 4, 0]} scale={1.2} />
      <House position={[-7, 22, 5]} rotation={[0, -Math.PI / 6, 0]} scale={1.0} />
      <House position={[-2, 28, -7.5]} rotation={[0, Math.PI, 0]} scale={1.5} />
      <House position={[8, 25, -4]} rotation={[0, Math.PI / 2, 0]} scale={0.9} />
    </group>
  );
}

function Bridge({ start, end }: { start: THREE.Vector3, end: THREE.Vector3 }) {
  const length = start.distanceTo(end);
  const position = start.clone().lerp(end, 0.5);
  // Calculate horizontal rotation (Y-axis)
  const angleY = Math.atan2(end.x - start.x, end.z - start.z);
  // Calculate vertical angle (X-axis pitch)
  const distXZ = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.z - start.z, 2));
  const angleX = Math.atan2(end.y - start.y, distXZ);
  
  return (
    <group position={position} rotation={[angleX, angleY, 0]}>
      {/* Walkway */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[4, 0.5, length]} />
        <meshStandardMaterial map={getPlankTexture()} roughness={0.9} />
      </mesh>
      {/* Side Rails */}
      <mesh castShadow receiveShadow position={[2, 1, 0]}>
        <boxGeometry args={[0.2, 0.2, length]} />
        <meshStandardMaterial map={getBarkTexture()} roughness={0.9} />
      </mesh>
      <mesh castShadow receiveShadow position={[-2, 1, 0]}>
        <boxGeometry args={[0.2, 0.2, length]} />
        <meshStandardMaterial map={getBarkTexture()} roughness={0.9} />
      </mesh>
    </group>
  );
}

function RopeClimb({ start, end }: { start: THREE.Vector3, end: THREE.Vector3 }) {
  const length = start.distanceTo(end);
  const position = start.clone().lerp(end, 0.5);
  const angleY = Math.atan2(end.x - start.x, end.z - start.z);
  const distXZ = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.z - start.z, 2));
  const angleX = Math.atan2(end.y - start.y, distXZ);
  
  return (
    <group position={position} rotation={[angleX, angleY, 0]}>
      {/* Main Rope - needs to be rotated to run along local Z */}
      <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, length, 8]} />
        <meshStandardMaterial color="#8b5a2b" roughness={0.9} />
      </mesh>
      {/* Wooden climbing rungs */}
      {Array.from({ length: Math.floor(length / (MOBILE_PERFORMANCE_MODE ? 2 : 1)) }).map((_, i) => {
        const rungStep = MOBILE_PERFORMANCE_MODE ? 2 : 1;
        return (
         <mesh key={i} position={[0, 0, -length / 2 + i * rungStep + rungStep * 0.5]} castShadow receiveShadow>
            <boxGeometry args={[1.5, 0.2, 0.2]} />
            <meshStandardMaterial map={getBarkTexture()} />
         </mesh>
        );
      })}
    </group>
  );
}

export function TreeHouseVillage() {
  const treePositions = useMemo(() => [
    { pos: new THREE.Vector3(0, -0.5, 0), angle: 0 },
    { pos: new THREE.Vector3(25, -0.5, 20), angle: 1.2 },
    { pos: new THREE.Vector3(-28, -0.5, 15), angle: -0.5 },
    { pos: new THREE.Vector3(18, -0.5, -26), angle: 2.1 },
    { pos: new THREE.Vector3(-22, -0.5, -24), angle: 0.8 },
  ], []);

  const houseLocalPositions = useMemo(() => [
    new THREE.Vector3(6.5, 15, 6.5),
    new THREE.Vector3(-7, 22, 5),
    new THREE.Vector3(-2, 28, -7.5),
    new THREE.Vector3(8, 25, -4),
  ], []);

  const getHouseBalcony = (treeIndex: number, houseIndex: number) => {
    const tree = treePositions[treeIndex];
    const localPos = houseLocalPositions[houseIndex];
    const pos = localPos.clone();
    pos.applyAxisAngle(new THREE.Vector3(0, 1, 0), tree.angle);
    pos.add(tree.pos);
    pos.y -= 2.5; // Balcony offset
    return pos;
  };

  const getTreeBase = (treeIndex: number) => {
     const tree = treePositions[treeIndex];
     return new THREE.Vector3(tree.pos.x, 0, tree.pos.z);
  };

  return (
    <group>
      <RigidBody type="fixed" colliders="trimesh">
        <group>
          {treePositions.map((t, i) => (
             <GiantTree key={i} position={[t.pos.x, t.pos.y, t.pos.z]} angleOffset={t.angle} />
          ))}
          
          {/* Internal Tree Connections (Ropes between houses on same tree) */}
          {treePositions.map((_, i) => (
             <group key={`internal-${i}`}>
               <RopeClimb start={getHouseBalcony(i, 0)} end={getHouseBalcony(i, 1)} />
               <RopeClimb start={getHouseBalcony(i, 1)} end={getHouseBalcony(i, 3)} />
               <RopeClimb start={getHouseBalcony(i, 3)} end={getHouseBalcony(i, 2)} />
             </group>
          ))}

          {/* Ropes from Ground to first house of each tree */}
          {treePositions.map((_, i) => (
             <RopeClimb key={`ground-${i}`} start={getTreeBase(i)} end={getHouseBalcony(i, 0)} />
          ))}

          {/* Lower Level Bridges (Connecting house 0 of trees for easy navigation) */}
          <Bridge start={getHouseBalcony(0, 0)} end={getHouseBalcony(1, 0)} />
          <Bridge start={getHouseBalcony(0, 0)} end={getHouseBalcony(2, 0)} />
          <Bridge start={getHouseBalcony(0, 0)} end={getHouseBalcony(3, 0)} />
          <Bridge start={getHouseBalcony(0, 0)} end={getHouseBalcony(4, 0)} />
          
          <Bridge start={getHouseBalcony(1, 0)} end={getHouseBalcony(2, 0)} />
          <Bridge start={getHouseBalcony(2, 0)} end={getHouseBalcony(4, 0)} />
          <Bridge start={getHouseBalcony(4, 0)} end={getHouseBalcony(3, 0)} />
          <Bridge start={getHouseBalcony(3, 0)} end={getHouseBalcony(1, 0)} />

          {/* Higher Level Bridges (Existing) */}
          <Bridge start={getHouseBalcony(0, 2)} end={getHouseBalcony(1, 1)} />
          <Bridge start={getHouseBalcony(1, 2)} end={getHouseBalcony(3, 3)} />
          <Bridge start={getHouseBalcony(0, 1)} end={getHouseBalcony(2, 0)} />
          <Bridge start={getHouseBalcony(2, 2)} end={getHouseBalcony(4, 3)} />
          <Bridge start={getHouseBalcony(0, 3)} end={getHouseBalcony(4, 1)} />
          
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
