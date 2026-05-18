import { useEffect, useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { isMobilePerformanceMode } from './performanceMode';

interface Ripple {
  id: number;
  x: number;
  y: number;
  z: number;
  spawnTime: number;
}

const BASE_WATER_Y = -0.79;

function isBaseVillageWaterRippleSpot(x: number, y: number, z: number) {
  const radius = Math.hypot(x, z);
  const inMoatOrOuterWater = (radius > 42 && radius < 58) || (radius > 125 && radius < 145);
  return inMoatOrOuterWater && y < 1.15;
}

export function WaterRipples() {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const rippleIdRef = useRef(0);
  const lastRippleTime = useRef(0);
  const mobilePerformanceMode = useRef(isMobilePerformanceMode());
  
  useEffect(() => {
    const handlePlayerMoved = (e: any) => {
      const { x, y, z, isMoving, grounded, isInWater, waterY } = e.detail;
      const rippleY = typeof waterY === "number" ? waterY + 0.01 : BASE_WATER_Y;
      const shouldRipple = Boolean(isInWater) || isBaseVillageWaterRippleSpot(x, y, z);

      if (shouldRipple && isMoving && grounded) {
        const now = performance.now();
        const rippleInterval = mobilePerformanceMode.current ? 700 : 400;
        if (now - lastRippleTime.current > rippleInterval) { // step timing
           lastRippleTime.current = now;
           setRipples(prev => [
             ...prev.filter(r => now - r.spawnTime < 500), // Clean up old
             { id: rippleIdRef.current++, x, y: rippleY, z, spawnTime: now }
           ]);
        }
      }
    };
    
    window.addEventListener('player-moved', handlePlayerMoved);
    return () => window.removeEventListener('player-moved', handlePlayerMoved);
  }, []);

  useFrame(() => {
    const now = performance.now();
    if (ripples.length > 0) {
       let NeedsCleanup = false;
       for (let i = 0; i < ripples.length; i++) {
           if (now - ripples[i].spawnTime >= 500) {
               NeedsCleanup = true;
               break;
           }
       }
       if (NeedsCleanup) {
           setRipples(prev => prev.filter(r => now - r.spawnTime < 500));
       }
    }
  });

  return (
    <>
      {ripples.map(r => (
        <RippleMesh key={r.id} ripple={r} />
      ))}
    </>
  );
}

function RippleMesh({ ripple }: { ripple: Ripple }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const segments = isMobilePerformanceMode() ? 18 : 32;

  useFrame(() => {
    if (!meshRef.current || !materialRef.current) return;
    const now = performance.now();
    const age = (now - ripple.spawnTime) / 500.0;
    if (age <= 1.0) {
      const scale = 0.5 + age * 2.0; 
      meshRef.current.scale.set(scale, scale, scale);
      materialRef.current.opacity = Math.max(0, 1.0 - age);
    }
  });

  return (
    <mesh ref={meshRef} position={[ripple.x, ripple.y, ripple.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
      <ringGeometry args={[0.8, 1.0, segments]} />
      <meshBasicMaterial ref={materialRef} color="white" transparent opacity={1} depthWrite={false} />
    </mesh>
  );
}
