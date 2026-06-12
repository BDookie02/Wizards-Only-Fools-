import * as THREE from "three";
import { getMountainMineshaftWallDecorDescriptors } from "./mountainVillageMineshaftRuntime";

export function RetroMineshaftLantern({
  position,
  scale = 1,
  withLight = true,
  glowScale = 1,
  lightIntensity = 4.8,
  lightDistance = 22,
}: {
  position: [number, number, number];
  scale?: number;
  withLight?: boolean;
  glowScale?: number;
  lightIntensity?: number;
  lightDistance?: number;
}) {
  return (
    <group position={position} scale={[scale, scale, scale]}>
      <mesh position={[0, 0.78, 0.07]} castShadow={false} renderOrder={6}>
        <sphereGeometry args={[1.28 * glowScale, 8, 6]} />
        <meshBasicMaterial color="#ff9d36" transparent opacity={0.28} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.78, 0.12]} castShadow={false} renderOrder={7}>
        <sphereGeometry args={[0.74 * glowScale, 8, 6]} />
        <meshBasicMaterial color="#ffd56f" transparent opacity={0.38} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.78, 0]} castShadow={false}>
        <boxGeometry args={[0.82, 0.92, 0.82]} />
        <meshBasicMaterial color="#2a1b12" />
      </mesh>
      <mesh position={[0, 0.78, 0.04]} castShadow={false}>
        <boxGeometry args={[0.52, 0.62, 0.64]} />
        <meshBasicMaterial color="#ffc15d" transparent opacity={0.96} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.78, 0.08]} castShadow={false}>
        <boxGeometry args={[0.2, 0.72, 0.72]} />
        <meshBasicMaterial color="#fff0b2" transparent opacity={0.72} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.78, 0.42]} castShadow={false} renderOrder={8}>
        <boxGeometry args={[0.82 * glowScale, 0.92 * glowScale, 0.04]} />
        <meshBasicMaterial color="#ffcb62" transparent opacity={0.32} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.34, 0]} castShadow={false}>
        <boxGeometry args={[1.02, 0.22, 1.02]} />
        <meshBasicMaterial color="#51331f" />
      </mesh>
      <mesh position={[0, 0.22, 0]} castShadow={false}>
        <boxGeometry args={[0.92, 0.22, 0.92]} />
        <meshBasicMaterial color="#51331f" />
      </mesh>
      <mesh position={[0, 1.63, 0]} castShadow={false}>
        <boxGeometry args={[0.18, 0.42, 0.18]} />
        <meshBasicMaterial color="#1b120c" />
      </mesh>
      {withLight && <pointLight color="#ffb65b" intensity={lightIntensity} distance={lightDistance} decay={1.85} position={[0, 0.84, 0]} />}
    </group>
  );
}

export function MountainMineshaftLightPole({
  position,
  direction = 1,
  withLight = false,
}: {
  position: [number, number, number];
  direction?: -1 | 1;
  withLight?: boolean;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 1.72, 0]} castShadow={false}>
        <boxGeometry args={[0.42, 3.44, 0.42]} />
        <meshBasicMaterial color="#22150d" />
      </mesh>
      <mesh position={[direction * 0.68, 3.28, 0]} castShadow={false}>
        <boxGeometry args={[1.62, 0.32, 0.32]} />
        <meshBasicMaterial color="#392414" />
      </mesh>
      <mesh position={[direction * 1.38, 2.94, 0]} castShadow={false}>
        <boxGeometry args={[0.18, 0.7, 0.18]} />
        <meshBasicMaterial color="#1b120c" />
      </mesh>
      <RetroMineshaftLantern position={[direction * 1.38, 1.72, 0]} scale={0.78} withLight={withLight} />
    </group>
  );
}

function MountainMineshaftWallHangingLantern({
  position,
  rotation,
  index,
  withLight,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  index: number;
  withLight: boolean;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.42, -0.08]} castShadow={false}>
        <boxGeometry args={[2.9, 0.68, 0.34]} />
        <meshBasicMaterial color="#1b1009" />
      </mesh>
      <mesh position={[0, 0.14, -0.92]} castShadow={false}>
        <boxGeometry args={[2.54, 0.34, 1.96]} />
        <meshBasicMaterial color={index % 2 === 0 ? "#53331d" : "#342113"} />
      </mesh>
      <mesh position={[0, -0.84, -1.84]} castShadow={false}>
        <boxGeometry args={[0.24, 1.62, 0.24]} />
        <meshBasicMaterial color="#0f0906" />
      </mesh>
      <mesh position={[0, -1.74, -1.84]} rotation={[0, 0, Math.PI / 4]} castShadow={false}>
        <torusGeometry args={[0.54, 0.08, 4, 8]} />
        <meshBasicMaterial color="#2a1a10" />
      </mesh>
      <RetroMineshaftLantern position={[0, -2.9, -1.84]} scale={1.02} glowScale={1.55} lightIntensity={8.8} lightDistance={34} withLight={withLight} />
    </group>
  );
}

export function MountainMineshaftWallLanterns({
  bottomY,
  summitY,
  showDetails,
}: {
  bottomY: number;
  summitY: number;
  showDetails: boolean;
}) {
  if (!showDetails) return null;

  const { lanterns } = getMountainMineshaftWallDecorDescriptors({ bottomY, summitY });

  return (
    <group name="mineshaft-wall-hanging-lanterns">
      {lanterns.map((lantern) => (
        <MountainMineshaftWallHangingLantern
          key={`wall-lantern-${lantern.index}`}
          position={lantern.position}
          rotation={lantern.rotation}
          index={lantern.index}
          withLight={lantern.withLight}
        />
      ))}
    </group>
  );
}
