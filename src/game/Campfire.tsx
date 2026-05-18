import React, { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../store/gameStore";

export function Campfire({ position = [0, 0, 30] }: { position?: [number, number, number] }) {
  const fireRef = useRef<THREE.PointLight>(null);
  const { camera } = useThree();
  const campfirePos = new THREE.Vector3(...position);

  useFrame((state, delta) => {
    if (fireRef.current) {
      fireRef.current.intensity = 2 + Math.random() * 0.5;
      fireRef.current.position.y = 1 + Math.random() * 0.2;
    }

    if (!document.pointerLockElement) return;
    
    // Check distance to player
    const dist = camera.position.distanceTo(campfirePos);
    if (dist < 2.5) {
      const health = useGameStore.getState().health;
      if (health > 0) {
        useGameStore.getState().damagePlayer(2 * delta);
      }
    }
  });

  return (
    <group position={position}>
      {/* Logs */}
      <mesh position={[0, 0.2, 0]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[1.5, 0.4, 0.4]} />
        <meshStandardMaterial color="#4a3221" />
      </mesh>
      <mesh position={[0, 0.2, 0]} rotation={[0, -Math.PI / 4, 0]}>
        <boxGeometry args={[1.5, 0.4, 0.4]} />
        <meshStandardMaterial color="#4a3221" />
      </mesh>
      
      {/* Fire blob */}
      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.4, 8, 8]} />
        <meshBasicMaterial color="#ff5500" transparent opacity={0.8} />
      </mesh>
      
      <pointLight ref={fireRef} color="#ff8800" distance={15} intensity={2} position={[0, 1, 0]} />
    </group>
  );
}
