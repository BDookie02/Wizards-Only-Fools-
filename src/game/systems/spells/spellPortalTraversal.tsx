import { useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { Billboard, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RapierRigidBody, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { Projectile, useGameStore } from "../../../store/gameStore";
import { getCollisionObjectName } from "./spellDummyQa";
import { FIREBALL_TEXTURES, PORTAL_GIF_URL } from "./spellProjectileAssets";
import { useProjectileLifetime } from "./spellProjectileLifetime";
import { isLocalProjectileCreator } from "./spellProjectileOwnership";
import { tryReservePortalTeleport } from "./spellPortalRuntime";

export function PortalSpell({ projectile }: { projectile: Projectile }) {
  const body = useRef<RapierRigidBody>(null);
  const removeProjectile = useGameStore(s => s.removeProjectile);
  const addPortal = useGameStore(s => s.addPortal);
  const [collided, setCollided] = useState(false);
  const collidedRef = useRef(false);
  useProjectileLifetime(projectile.id, 12000);

  const handleCollision = (e: any) => {
    if (collidedRef.current) return;
    const objectName = getCollisionObjectName(e);
    const isMyProjectile = isLocalProjectileCreator(projectile);
    if (objectName === `shield_${projectile.creatorId}`) return;
    if (objectName === "player" && isMyProjectile) return;
    if (objectName?.startsWith("remote_player_")) return;

    collidedRef.current = true;
    setCollided(true);
    if (body.current) {
      const pos = body.current.translation();
      addPortal({
        id: projectile.id,
        pos: {
          x: pos.x - projectile.dir.x * 1.5,
          y: pos.y + 1.0 - projectile.dir.y * 1.0,
          z: pos.z - projectile.dir.z * 1.5,
        },
      });
      removeProjectile(projectile.id);
    }
  };

  const speed = 50;

  return (
    <RigidBody
      ref={body}
      position={[projectile.pos.x, projectile.pos.y, projectile.pos.z]}
      linearVelocity={[projectile.dir.x * speed, projectile.dir.y * speed, projectile.dir.z * speed]}
      gravityScale={0}
      onIntersectionEnter={handleCollision}
      sensor
      name={`projectile_${projectile.id}`}
    >
      <CuboidCollider args={[0.2, 0.2, 0.2]} />
      {!collided && (
        <Billboard>
          <mesh>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color="#8800ff" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </Billboard>
      )}
    </RigidBody>
  );
}

export function ActivePortals() {
  const portals = useGameStore(s => s.portals);
  const renderedPortals: ReactNode[] = [];
  for (let index = 0; index < portals.length; index += 1) {
    const portal = portals[index];
    renderedPortals.push(<PortalActive key={portal.id} id={portal.id} pos={portal.pos} index={index} />);
  }

  return (
    <>
      {renderedPortals}
    </>
  );
}

function PortalActive({ pos, index, id }: { pos: { x: number; y: number; z: number }; index: number; id: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const portals = useGameStore(s => s.portals);
  const removePortal = useGameStore(s => s.removePortal);
  const [isScalingIn, setIsScalingIn] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      removePortal(id);
    }, 12000);

    return () => {
      clearTimeout(timeout);
    };
  }, [id, removePortal]);

  const handlePortalEnter = (e: any) => {
    const objectName = e.colliderObject?.name || e.other.rigidBodyObject?.name;
    if (objectName !== "player") return;

    if (portals.length === 2) {
      if (!tryReservePortalTeleport()) return;

      const otherPortal = portals[1 - index];
      if (otherPortal) {
        window.dispatchEvent(new CustomEvent("teleportPlayer", {
          detail: { x: otherPortal.pos.x, y: otherPortal.pos.y, z: otherPortal.pos.z },
        }));
      }
    }
  };

  return (
    <RigidBody position={[pos.x, pos.y, pos.z]} type="fixed" sensor onIntersectionEnter={handlePortalEnter}>
      <CuboidCollider args={[1.6, 2.4, 1.6]} />
      <Billboard>
        <group ref={groupRef} scale={0.1}>
          {isScalingIn && <PortalScaleIn groupRef={groupRef} onComplete={() => setIsScalingIn(false)} />}
          <Html center transform sprite distanceFactor={8} style={{ pointerEvents: "none" }}>
            <img
              src={PORTAL_GIF_URL}
              alt=""
              style={{
                width: "148px",
                height: "190px",
                objectFit: "contain",
                imageRendering: "pixelated",
                mixBlendMode: "screen",
                filter: "brightness(1.55) contrast(1.3) saturate(1.4)",
                WebkitMaskImage: "radial-gradient(circle at center, transparent 0 28%, black 34%, black 51%, transparent 61%)",
                maskImage: "radial-gradient(circle at center, transparent 0 28%, black 34%, black 51%, transparent 61%)",
              }}
              onError={(e) => {
                const fallbackUrl = FIREBALL_TEXTURES[0];
                if (fallbackUrl && e.currentTarget.src !== fallbackUrl) {
                  e.currentTarget.src = fallbackUrl;
                }
              }}
            />
          </Html>
        </group>
      </Billboard>
    </RigidBody>
  );
}

function PortalScaleIn({
  groupRef,
  onComplete,
}: {
  groupRef: RefObject<THREE.Group | null>;
  onComplete: () => void;
}) {
  const scaleRef = useRef(0.1);
  const completedRef = useRef(false);

  useFrame((_, delta) => {
    if (completedRef.current) return;
    const group = groupRef.current;
    if (!group) return;

    const nextScale = Math.min(3.6, scaleRef.current + delta * 6);
    scaleRef.current = nextScale;
    group.scale.set(nextScale, nextScale, nextScale);

    if (nextScale >= 3.6) {
      completedRef.current = true;
      onComplete();
    }
  });

  return null;
}

export function BlinkSpell({ projectile }: { projectile: Projectile }) {
  useProjectileLifetime(projectile.id, 200);

  return (
    <Billboard position={[projectile.pos.x, projectile.pos.y, projectile.pos.z]}>
      <mesh>
        <planeGeometry args={[3, 5]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </Billboard>
  );
}
