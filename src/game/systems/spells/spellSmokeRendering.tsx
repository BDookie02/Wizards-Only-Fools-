import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { BallCollider, RapierRigidBody, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { Projectile, useGameStore } from "../../../store/gameStore";
import {
  getCollisionObjectName,
  publishSpellDummyCollisionHit,
} from "./spellDummyQa";
import { isLocalProjectileCreator } from "./spellProjectileOwnership";
import { useProjectileLifetime } from "./spellProjectileLifetime";
import { SMOKE_CLOUD_PARTICLE_COUNT } from "./spellProjectileTuning";
import { isMobilePerformanceMode } from "../input/performanceMode";

type SmokeCloudParticle = {
  x: number;
  y: number;
  z: number;
  s: number;
  rot: number;
};

const MOBILE_SMOKE_CLOUD_UPDATE_INTERVAL_SECONDS = 1 / 24;

function SmokeCloud() {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const lastMobileUpdateAtRef = useRef(-Infinity);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);

  const particles = useRef((() => {
    const nextParticles: SmokeCloudParticle[] = [];
    for (let index = 0; index < SMOKE_CLOUD_PARTICLE_COUNT; index += 1) {
      nextParticles.push({
        x: (Math.random() - 0.5) * 4,
        y: (Math.random() - 0.5) * 2.4,
        z: (Math.random() - 0.5) * 4,
        s: 0.8 + Math.random() * 1.25,
        rot: Math.random() * Math.PI,
      });
    }
    return nextParticles;
  })()).current;

  useFrame((state, delta) => {
    timeRef.current += delta;
    if (timeRef.current > 6) return;
    if (mobilePerformanceMode) {
      const elapsed = state.clock.elapsedTime;
      if (elapsed - lastMobileUpdateAtRef.current < MOBILE_SMOKE_CLOUD_UPDATE_INTERVAL_SECONDS) return;
      lastMobileUpdateAtRef.current = elapsed;
    }

    const t = timeRef.current;
    const scale = Math.min(2.7, 0.1 + t * 4.8);
    let opacity = 0.8;
    if (t > 4) {
      opacity = Math.max(0, 0.8 - (t - 4) * 0.4);
    }

    if (groupRef.current) {
      const children = groupRef.current.children;
      for (let i = 0; i < children.length; i += 1) {
        const child = children[i];
        const p = particles[i];
        if (!p) continue;
        child.position.set(p.x * scale * 1.25, p.y * scale * 1.25 + scale * 0.42, p.z * scale * 1.25);
        child.scale.set(scale * p.s, scale * p.s, scale * p.s);
        const material = (child as any).material;
        if (material) {
          material.opacity = opacity;
          if (opacity <= 0) child.visible = false;
        }
      }
    }
  });

  return (
    <group ref={groupRef}>
      {particles.map((p, i) => (
        <mesh key={i} rotation={[p.rot, p.rot, p.rot]} scale={0.1}>
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial
            color="#333"
            transparent
            opacity={0.8}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export function SmokeBomb({ projectile }: { projectile: Projectile }) {
  const body = useRef<RapierRigidBody>(null);
  const removeProjectile = useGameStore(s => s.removeProjectile);
  const cleanupTimeoutRef = useRef<number | null>(null);
  useProjectileLifetime(projectile.id, 16000);
  const [collided, setCollided] = useState(false);
  const [smokeSpawn, setSmokeSpawn] = useState<{ x: number, y: number, z: number } | null>(null);

  useEffect(() => {
    return () => {
      if (cleanupTimeoutRef.current !== null) {
        window.clearTimeout(cleanupTimeoutRef.current);
      }
    };
  }, []);

  const handleCollision = (e: any) => {
    if (collided) return;
    const objectName = getCollisionObjectName(e);
    const isMyProjectile = isLocalProjectileCreator(projectile);
    if (objectName === `shield_${projectile.creatorId}`) return;
    if (objectName === "player" && isMyProjectile) return;
    if (objectName === `remote_player_${projectile.creatorId}`) return;
    publishSpellDummyCollisionHit(e, projectile, 0);

    setCollided(true);
    if (body.current) {
      const pos = body.current.translation();
      setSmokeSpawn({ x: pos.x, y: pos.y, z: pos.z });
      body.current.setTranslation({ x: 0, y: -1000, z: 0 }, true);
      cleanupTimeoutRef.current = window.setTimeout(() => {
        removeProjectile(projectile.id);
      }, 6500);
    }
  };

  const speed = 45;

  return (
    <>
      <RigidBody
        ref={body}
        position={[projectile.pos.x, projectile.pos.y, projectile.pos.z]}
        linearVelocity={[projectile.dir.x * speed, projectile.dir.y * speed + 5, projectile.dir.z * speed]}
        gravityScale={2}
        onIntersectionEnter={handleCollision}
        onCollisionEnter={handleCollision}
        ccd={true}
        sensor
        name={`projectile_${projectile.id}`}
      >
        <BallCollider args={[0.5]} />
        {!collided && (
          <mesh>
            <boxGeometry args={[0.4, 0.4, 0.4]} />
            <meshBasicMaterial color="#555" />
          </mesh>
        )}
      </RigidBody>
      {smokeSpawn && (
        <group position={[smokeSpawn.x, smokeSpawn.y + 2, smokeSpawn.z]}>
          <SmokeCloud />
        </group>
      )}
    </>
  );
}
