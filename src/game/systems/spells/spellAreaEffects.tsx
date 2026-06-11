import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Projectile } from "../../../store/gameStore";
import { emitLocalPlayerDamage } from "../../network/gameNetworkClient";
import { getPublishedLocalPlayerPosition } from "../player/playerEventBridge";
import {
  getSpellDummyDamage,
  publishSpellDummyAreaHit,
} from "./spellDummyQa";
import { getSeededRandom } from "./spellProjectileMath";
import { useProjectileLifetime } from "./spellProjectileLifetime";
import {
  PixelMeteorSprite,
  PixelTornadoSprite,
  TornadoInstancedBoxes,
  type TornadoBoxInstance,
} from "./spellPixelSprites";
import { isRemoteProjectileCreator } from "./spellProjectileOwnership";
import {
  METEOR_AREA_SEGMENTS,
  METEOR_EXPLOSION_PARTICLE_COUNT,
  METEOR_IMPACT_SEGMENTS,
  METEOR_SHOWER_DURATION,
  METEOR_SHOWER_METEOR_COUNT,
  METEOR_SHOWER_RADIUS,
  MOBILE_PERFORMANCE_MODE,
  SPELL_FORCE_EVENT_INTERVAL,
  SPELL_VISUAL_UPDATE_INTERVAL,
  TORNADO_BAND_COUNT,
  TORNADO_DURATION,
  TORNADO_GROUND_DUST_COUNT,
  TORNADO_LOOSE_PIXEL_COUNT,
  TORNADO_ORBIT_PIXEL_COUNT,
  TORNADO_RADIUS,
} from "./spellProjectileTuning";

type TornadoBandConfig = {
  boxes: TornadoBoxInstance[];
  y: number;
};

type MeteorExplosionParticle = {
  dirX: number;
  dirZ: number;
  speed: number;
  lift: number;
  size: number;
  color: string;
  smoke: boolean;
};

type MeteorConfig = {
  start: THREE.Vector3;
  target: THREE.Vector3;
  delay: number;
  duration: number;
  size: number;
  impactRadius: number;
  particles: MeteorExplosionParticle[];
};

export function TornadoSpell({ projectile }: { projectile: Projectile }) {
  useProjectileLifetime(projectile.id, TORNADO_DURATION);
  const rootRef = useRef<THREE.Group>(null);
  const swirlRef = useRef<THREE.Group>(null);
  const bandRefs = useRef<Array<THREE.Group | null>>([]);
  const spawnedClockAt = useRef<number | null>(null);
  const lastVisualUpdateAt = useRef(Number.NEGATIVE_INFINITY);
  const center = useMemo(
    () => new THREE.Vector3(projectile.pos.x, projectile.pos.y, projectile.pos.z),
    [projectile.pos.x, projectile.pos.y, projectile.pos.z]
  );
  const canPullLocalPlayer = isRemoteProjectileCreator(projectile);
  const tornadoBands = useMemo(() => {
    const bands: TornadoBandConfig[] = [];
    for (let bandIndex = 0; bandIndex < TORNADO_BAND_COUNT; bandIndex += 1) {
      const t = bandIndex / (TORNADO_BAND_COUNT - 1);
      const radius = THREE.MathUtils.lerp(0.6, 4.9, t);
      const y = THREE.MathUtils.lerp(0.32, 7.75, t);
      const height = THREE.MathUtils.lerp(0.28, 0.48, t);
      const thickness = THREE.MathUtils.lerp(0.18, 0.34, t);
      const pieces = 4 + Math.round(t * 4);
      const boxes: TornadoBoxInstance[] = [];
      for (let pieceIndex = 0; pieceIndex < pieces; pieceIndex += 1) {
        const angle = (pieceIndex / pieces) * Math.PI * 2 + bandIndex * 0.72;
        boxes.push({
          x: Math.cos(angle) * radius,
          y: 0,
          z: Math.sin(angle) * radius,
          w: THREE.MathUtils.lerp(1.3, 2.8, t) * (pieceIndex % 3 === 0 ? 1.15 : 1),
          h: height,
          d: thickness,
          rotationY: Math.PI / 2 - angle,
          color: pieceIndex % 4 === 0 ? "#f8fafc" : pieceIndex % 3 === 0 ? "#6b7280" : pieceIndex % 2 === 0 ? "#d1d5db" : "#9ca3af",
        });
      }
      bands.push({ boxes, y });
    }
    return bands;
  }, []);
  const groundDustBoxes = useMemo(() => {
    const boxes: TornadoBoxInstance[] = [];
    for (let index = 0; index < TORNADO_GROUND_DUST_COUNT; index += 1) {
      const angle = (index / TORNADO_GROUND_DUST_COUNT) * Math.PI * 2;
      const radius = 2.45 + (index % 5) * 0.68;
      boxes.push({
        x: Math.cos(angle) * radius,
        y: 0.05,
        z: Math.sin(angle) * radius,
        w: 0.36 + (index % 4) * 0.14,
        h: 0.12,
        d: 0.22,
        color: index % 4 === 0 ? "#d1d5db" : index % 4 === 1 ? "#9ca3af" : index % 4 === 2 ? "#6b7280" : "#a16207",
        rotationY: angle,
      });
    }
    return boxes;
  }, []);
  const loosePixelBoxes = useMemo(() => {
    const boxes: TornadoBoxInstance[] = [];
    for (let index = 0; index < TORNADO_LOOSE_PIXEL_COUNT; index += 1) {
      const t = index / (TORNADO_LOOSE_PIXEL_COUNT - 1);
      const angle = t * Math.PI * 9.5;
      const radius = THREE.MathUtils.lerp(1.0, 5.4, t);
      const size = THREE.MathUtils.lerp(0.22, 0.42, 1 - t);
      boxes.push({
        x: Math.cos(angle) * radius,
        y: THREE.MathUtils.lerp(0.6, 7.6, t),
        z: Math.sin(angle) * radius,
        w: size,
        h: size,
        d: size,
        color: index % 3 === 0 ? "#f8fafc" : index % 3 === 1 ? "#9ca3af" : "#4b5563",
      });
    }
    return boxes;
  }, []);
  const orbitingParticleBoxes = useMemo(() => {
    const boxes: TornadoBoxInstance[] = [];
    for (let index = 0; index < TORNADO_ORBIT_PIXEL_COUNT; index += 1) {
      const t = index / (TORNADO_ORBIT_PIXEL_COUNT - 1);
      const angle = t * Math.PI * 15.5;
      const radius = THREE.MathUtils.lerp(1.35, 7.85, t) + ((index % 5) - 2) * 0.18;
      boxes.push({
        x: Math.cos(angle) * radius,
        y: THREE.MathUtils.lerp(0.28, 8.2, t),
        z: Math.sin(angle) * radius,
        w: THREE.MathUtils.lerp(0.22, 0.7, 1 - Math.abs(t - 0.42)),
        h: THREE.MathUtils.lerp(0.14, 0.32, 1 - t),
        d: THREE.MathUtils.lerp(0.12, 0.22, t),
        color: index % 5 === 0 ? "#f8fafc" : index % 5 === 1 ? "#d1d5db" : index % 5 === 2 ? "#9ca3af" : index % 5 === 3 ? "#4b5563" : "#a16207",
        rotationY: Math.PI / 2 - angle,
      });
    }
    return boxes;
  }, []);

  useEffect(() => {
    publishSpellDummyAreaHit(projectile, center, TORNADO_RADIUS, getSpellDummyDamage("tornado"));
  }, [center, projectile]);

  useFrame((state, delta) => {
    if (spawnedClockAt.current === null) {
      spawnedClockAt.current = state.clock.elapsedTime;
    }
    const frameElapsed = state.clock.elapsedTime;
    const elapsed = frameElapsed - spawnedClockAt.current;
    const previousVisualUpdateAt = lastVisualUpdateAt.current;
    const shouldUpdateVisuals = !MOBILE_PERFORMANCE_MODE || frameElapsed - previousVisualUpdateAt >= SPELL_VISUAL_UPDATE_INTERVAL;
    if (shouldUpdateVisuals) {
      lastVisualUpdateAt.current = frameElapsed;
      const visualDelta = previousVisualUpdateAt === Number.NEGATIVE_INFINITY
        ? delta
        : frameElapsed - previousVisualUpdateAt;
      const fadeIn = THREE.MathUtils.clamp(elapsed / 0.45, 0, 1);
      const fadeOut = THREE.MathUtils.clamp((TORNADO_DURATION / 1000 - elapsed) / 1.2, 0, 1);
      const lifeScale = Math.min(fadeIn, fadeOut);

      if (rootRef.current) {
        rootRef.current.scale.setScalar(THREE.MathUtils.lerp(rootRef.current.scale.x, lifeScale, 1 - Math.exp(-10 * visualDelta)));
      }

      if (swirlRef.current) {
        swirlRef.current.rotation.y += visualDelta * 5.8;
      }

      const bands = bandRefs.current;
      for (let index = 0; index < bands.length; index++) {
        const band = bands[index];
        if (!band) continue;
        const t = index / (TORNADO_BAND_COUNT - 1);
        band.rotation.y += visualDelta * (2.7 + t * 4.1);
        band.position.x = Math.round(Math.sin(frameElapsed * (1.7 + t) + index) * (0.14 + t * 0.22) * 8) / 8;
        band.position.z = Math.round(Math.cos(frameElapsed * (1.5 + t) + index * 1.9) * (0.14 + t * 0.22) * 8) / 8;
      }
    }
  });

  return (
    <group ref={rootRef} position={[center.x, center.y + 0.05, center.z]} scale={0.001}>
      {canPullLocalPlayer && <TornadoLocalPullRuntime center={center} />}
      <PixelTornadoSprite />
      <mesh position={[0, 4.1, 0]} rotation={[0, 0, Math.PI]} renderOrder={9}>
        <coneGeometry args={[5.2, 8.3, MOBILE_PERFORMANCE_MODE ? 7 : 10, 1, true]} />
        <meshBasicMaterial
          color="#9ca3af"
          transparent
          opacity={MOBILE_PERFORMANCE_MODE ? 0.24 : 0.18}
          side={THREE.DoubleSide}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={10}>
        <ringGeometry args={[2.2, 5.8, MOBILE_PERFORMANCE_MODE ? 10 : 14]} />
        <meshBasicMaterial
          color="#d1d5db"
          transparent
          opacity={MOBILE_PERFORMANCE_MODE ? 0.34 : 0.28}
          side={THREE.DoubleSide}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <TornadoInstancedBoxes boxes={groundDustBoxes} opacity={0.46} />
      <group ref={swirlRef}>
        {tornadoBands.map((band, bandIndex) => (
          <group
            key={bandIndex}
            ref={(group) => { bandRefs.current[bandIndex] = group; }}
            position={[0, band.y, 0]}
          >
            <TornadoInstancedBoxes
              boxes={band.boxes}
              opacity={THREE.MathUtils.lerp(0.78, 0.48, bandIndex / (TORNADO_BAND_COUNT - 1))}
            />
          </group>
        ))}
        <TornadoInstancedBoxes boxes={loosePixelBoxes} opacity={0.7} />
        <TornadoInstancedBoxes boxes={orbitingParticleBoxes} opacity={0.58} />
      </group>
    </group>
  );
}

function TornadoLocalPullRuntime({ center }: { center: THREE.Vector3 }) {
  const playerPosRef = useRef(new THREE.Vector3());
  const toCenterRef = useRef(new THREE.Vector3());
  const spinRef = useRef(new THREE.Vector3());
  const lastForceEventAtRef = useRef<number | null>(null);

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime;
    const lastForceEventAt = lastForceEventAtRef.current;
    if (lastForceEventAt === null) {
      lastForceEventAtRef.current = elapsed;
      return;
    }
    if (elapsed - lastForceEventAt < SPELL_FORCE_EVENT_INTERVAL) return;
    lastForceEventAtRef.current = elapsed;

    const localPos = getPublishedLocalPlayerPosition();
    if (!localPos) return;

    const playerPos = playerPosRef.current.set(localPos.x, localPos.y, localPos.z);
    const toCenter = toCenterRef.current.copy(center);
    toCenter.y = playerPos.y;
    toCenter.sub(playerPos);
    const distSq = toCenter.lengthSq();
    if (distSq >= TORNADO_RADIUS * TORNADO_RADIUS || distSq <= 0.1 * 0.1) return;

    const dist = Math.sqrt(distSq);
    const strength = 1 - dist / TORNADO_RADIUS;
    const spin = spinRef.current.set(-toCenter.z, 0, toCenter.x).normalize().multiplyScalar(3.8 * strength);
    const pull = toCenter.normalize().multiplyScalar(16 * strength).add(spin);
    pull.y = 2.6 * strength;
    window.dispatchEvent(new CustomEvent('pullPlayer', { detail: { x: pull.x, y: pull.y, z: pull.z } }));
  });

  return null;
}

export function MeteorShowerSpell({ projectile }: { projectile: Projectile }) {
  useProjectileLifetime(projectile.id, METEOR_SHOWER_DURATION + 900);
  const meteorRefs = useRef<Array<THREE.Group | null>>([]);
  const impactRefs = useRef<Array<THREE.Mesh | null>>([]);
  const impactFlashRefs = useRef<Array<THREE.Mesh | null>>([]);
  const explosionRefs = useRef<Array<THREE.Group | null>>([]);
  const explosionParticleRefs = useRef<Array<Array<THREE.Mesh | null>>>([]);
  const spawnedClockAt = useRef<number | null>(null);
  const lastVisualUpdateAt = useRef(0);
  const center = useMemo(
    () => new THREE.Vector3(projectile.pos.x, projectile.pos.y, projectile.pos.z),
    [projectile.pos.x, projectile.pos.y, projectile.pos.z]
  );
  const meteors = useMemo(() => {
    const random = getSeededRandom(`${projectile.id}-${projectile.createdAt}`);
    const nextMeteors: MeteorConfig[] = [];
    for (let index = 0; index < METEOR_SHOWER_METEOR_COUNT; index += 1) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * METEOR_SHOWER_RADIUS;
      const target = new THREE.Vector3(
        center.x + Math.cos(angle) * radius,
        center.y + 0.12,
        center.z + Math.sin(angle) * radius
      );
      const driftAngle = angle + Math.PI * (0.65 + random() * 0.45);
      const start = new THREE.Vector3(
        target.x + Math.cos(driftAngle) * (8 + random() * 6),
        target.y + 24 + random() * 9,
        target.z + Math.sin(driftAngle) * (8 + random() * 6),
      );
      const particles: MeteorExplosionParticle[] = [];
      for (let particleIndex = 0; particleIndex < METEOR_EXPLOSION_PARTICLE_COUNT; particleIndex += 1) {
        const particleAngle = random() * Math.PI * 2;
        const speed = 2.2 + random() * 5.4;
        particles.push({
          dirX: Math.cos(particleAngle),
          dirZ: Math.sin(particleAngle),
          speed,
          lift: 0.45 + random() * 2.6,
          size: 0.13 + random() * 0.32,
          color: particleIndex % 5 === 0 ? "#fff7ed" : particleIndex % 5 === 1 ? "#facc15" : particleIndex % 5 === 2 ? "#fb923c" : particleIndex % 5 === 3 ? "#ef4444" : "#4b2a1a",
          smoke: particleIndex % 5 === 4,
        });
      }
      nextMeteors.push({
        start,
        target,
        delay: index * 0.24 + random() * 0.32,
        duration: 0.9 + random() * 0.35,
        size: 0.7 + random() * 0.5,
        impactRadius: 3.2 + random() * 0.5,
        particles,
      });
    }
    return nextMeteors;
  }, [center, projectile.createdAt, projectile.id]);
  const canDamageLocalPlayer = isRemoteProjectileCreator(projectile);

  useFrame((state) => {
    if (MOBILE_PERFORMANCE_MODE && state.clock.elapsedTime - lastVisualUpdateAt.current < SPELL_VISUAL_UPDATE_INTERVAL) return;
    lastVisualUpdateAt.current = state.clock.elapsedTime;

    if (spawnedClockAt.current === null) {
      spawnedClockAt.current = state.clock.elapsedTime;
    }
    const elapsed = state.clock.elapsedTime - spawnedClockAt.current;

    for (let index = 0; index < meteors.length; index++) {
      const meteor = meteors[index];
      const meteorGroup = meteorRefs.current[index];
      const impactMesh = impactRefs.current[index];
      const impactFlash = impactFlashRefs.current[index];
      const explosionGroup = explosionRefs.current[index];
      const particleMeshes = explosionParticleRefs.current[index];
      const localTime = elapsed - meteor.delay;
      const progress = THREE.MathUtils.clamp(localTime / meteor.duration, 0, 1);
      const impactAge = localTime - meteor.duration;

      if (meteorGroup) {
        const falling = localTime >= 0 && progress < 1;
        meteorGroup.visible = falling;
        if (falling) {
          meteorGroup.position.lerpVectors(meteor.start, meteor.target, progress);
          meteorGroup.scale.setScalar(meteor.size * (0.86 + progress * 0.22));
        }
      }

      if (impactMesh) {
        const visible = impactAge >= 0 && impactAge <= 0.58;
        impactMesh.visible = visible;
        if (visible) {
          const pulse = 1 + impactAge * 4.5;
          impactMesh.scale.setScalar(pulse);
          const material = impactMesh.material as THREE.MeshBasicMaterial;
          material.opacity = THREE.MathUtils.lerp(0.55, 0, impactAge / 0.58);
        }
      }

      if (explosionGroup) {
        const explosionDuration = 0.86;
        const visible = impactAge >= 0 && impactAge <= explosionDuration;
        explosionGroup.visible = visible;
        if (visible) {
          const burstProgress = THREE.MathUtils.clamp(impactAge / explosionDuration, 0, 1);
          explosionGroup.position.set(meteor.target.x, meteor.target.y + 0.08, meteor.target.z);

          if (impactFlash) {
            impactFlash.scale.setScalar((1 + burstProgress * 4.8) * meteor.size);
            const flashMaterial = impactFlash.material as THREE.MeshBasicMaterial;
            flashMaterial.opacity = THREE.MathUtils.lerp(0.74, 0, burstProgress);
          }

          if (particleMeshes) {
            for (let particleIndex = 0; particleIndex < particleMeshes.length; particleIndex++) {
              const particleMesh = particleMeshes[particleIndex];
              if (!particleMesh) continue;
              const particle = meteor.particles[particleIndex];
              const travel = particle.speed * burstProgress * meteor.size;
              const lift = particle.lift * Math.sin(burstProgress * Math.PI) + burstProgress * 0.38;
              particleMesh.position.set(particle.dirX * travel, 0.18 + lift, particle.dirZ * travel);
              particleMesh.scale.setScalar(Math.max(0.02, particle.size * meteor.size * (1.05 - burstProgress)));
              const particleMaterial = particleMesh.material as THREE.MeshBasicMaterial;
              particleMaterial.opacity = particle.smoke
                ? THREE.MathUtils.lerp(0.38, 0, burstProgress)
                : THREE.MathUtils.lerp(0.9, 0, burstProgress);
            }
          }
        }
      }
    }
  });

  return (
    <group>
      <MeteorImpactRuntime
        canDamageLocalPlayer={canDamageLocalPlayer}
        meteors={meteors}
        projectile={projectile}
      />
      <mesh position={[center.x, center.y + 0.03, center.z]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[METEOR_SHOWER_RADIUS - 0.35, METEOR_SHOWER_RADIUS, METEOR_AREA_SEGMENTS]} />
        <meshBasicMaterial color="#ff7a1a" transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[center.x, center.y + 0.025, center.z]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[METEOR_SHOWER_RADIUS, METEOR_AREA_SEGMENTS]} />
        <meshBasicMaterial color="#44170c" transparent opacity={0.12} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {meteors.map((meteor, index) => (
        <group key={index}>
          <group
            ref={(group) => { meteorRefs.current[index] = group; }}
            position={[meteor.start.x, meteor.start.y, meteor.start.z]}
            visible={false}
          >
            <PixelMeteorSprite />
          </group>
          <mesh
            ref={(mesh) => { impactRefs.current[index] = mesh; }}
            position={[meteor.target.x, meteor.target.y + 0.05, meteor.target.z]}
            rotation={[Math.PI / 2, 0, 0]}
            visible={false}
          >
            <ringGeometry args={[0.28, meteor.impactRadius, METEOR_IMPACT_SEGMENTS]} />
            <meshBasicMaterial color="#ffb347" transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <group
            ref={(group) => { explosionRefs.current[index] = group; }}
            position={[meteor.target.x, meteor.target.y + 0.08, meteor.target.z]}
            visible={false}
          >
            <mesh ref={(mesh) => { impactFlashRefs.current[index] = mesh; }} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[1, METEOR_IMPACT_SEGMENTS]} />
              <meshBasicMaterial color="#fff1a8" transparent opacity={0.74} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
            {meteor.particles.map((particle, particleIndex) => (
              <mesh
                key={particleIndex}
                ref={(mesh) => {
                  if (!explosionParticleRefs.current[index]) explosionParticleRefs.current[index] = [];
                  explosionParticleRefs.current[index][particleIndex] = mesh;
                }}
              >
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial
                  color={particle.color}
                  transparent
                  opacity={particle.smoke ? 0.38 : 0.9}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            ))}
          </group>
        </group>
      ))}
    </group>
  );
}

function MeteorImpactRuntime({
  canDamageLocalPlayer,
  meteors,
  projectile,
}: {
  canDamageLocalPlayer: boolean;
  meteors: readonly MeteorConfig[];
  projectile: Projectile;
}) {
  const playerPosRef = useRef(new THREE.Vector3());
  const groundPointRef = useRef(new THREE.Vector3());

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const timeouts: number[] = [];
    for (let index = 0; index < meteors.length; index += 1) {
      const meteor = meteors[index];
      const timeout = window.setTimeout(() => {
        publishSpellDummyAreaHit(projectile, meteor.target, meteor.impactRadius, getSpellDummyDamage("meteorshower"));
        const localPos = getPublishedLocalPlayerPosition();
        if (!localPos) return;

        const playerPos = playerPosRef.current.set(localPos.x, localPos.y, localPos.z);
        const groundPoint = groundPointRef.current.set(meteor.target.x, playerPos.y, meteor.target.z);
        const shakeRadius = 30;
        const distanceToImpactSq = playerPos.distanceToSquared(groundPoint);
        if (distanceToImpactSq <= shakeRadius * shakeRadius) {
          const distanceToImpact = Math.sqrt(distanceToImpactSq);
          const shakeFalloff = 1 - distanceToImpact / shakeRadius;
          window.dispatchEvent(new CustomEvent("screenShake", {
            detail: {
              strength: THREE.MathUtils.lerp(0.08, 0.48, shakeFalloff) * meteor.size,
              duration: THREE.MathUtils.lerp(180, 520, shakeFalloff),
            }
          }));
        }
        if (canDamageLocalPlayer && distanceToImpactSq <= meteor.impactRadius * meteor.impactRadius) {
          emitLocalPlayerDamage(18);
        }
      }, (meteor.delay + meteor.duration) * 1000);
      timeouts.push(timeout);
    }

    return () => {
      for (let index = 0; index < timeouts.length; index += 1) {
        window.clearTimeout(timeouts[index]);
      }
    };
  }, [canDamageLocalPlayer, meteors, projectile]);

  return null;
}
