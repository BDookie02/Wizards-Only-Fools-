import { Suspense, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { BallCollider, CylinderCollider, interactionGroups, RapierRigidBody, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { getSpriteUrl } from "../../SpriteManifest";
import { Projectile, useGameStore } from "../../../store/gameStore";
import { isMobilePerformanceMode } from "../input/performanceMode";
import { getPublishedLocalPlayerPosition } from "../player/playerEventBridge";
import { useProjectileLifetime } from "./spellProjectileLifetime";
import { isLocalProjectileCreator } from "./spellProjectileOwnership";
import {
  copyShieldPoint,
  createDiscShieldRotationScratch,
  createShieldPoint,
  getDiscShieldRotation,
  resolveOrbShieldTarget,
  writeFloatingShieldPoint,
} from "./spellShieldRuntime";

const DISC_SHIELD_TEXTURE_URL = getSpriteUrl("/sprites/shields/disc_shield.png") || "/sprites/shields/disc_shield.png";
const MOBILE_DISC_SHIELD_VISUAL_UPDATE_INTERVAL_SECONDS = 1 / 30;

function DiscShieldMaterial() {
  const texture = useTexture(DISC_SHIELD_TEXTURE_URL);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return (
    <meshBasicMaterial
      map={texture}
      transparent
      opacity={0.9}
      side={THREE.DoubleSide}
      blending={THREE.AdditiveBlending}
      depthWrite={false}
    />
  );
}

export function DiscShield({ projectile }: { projectile: Projectile }) {
  useProjectileLifetime(projectile.id, 10000);
  const meshRef = useRef<THREE.Mesh>(null);
  const rotationScratch = useRef(createDiscShieldRotationScratch()).current;
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const lastMobileVisualUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime;
    if (
      mobilePerformanceMode &&
      elapsed - lastMobileVisualUpdateAtRef.current < MOBILE_DISC_SHIELD_VISUAL_UPDATE_INTERVAL_SECONDS
    ) return;
    lastMobileVisualUpdateAtRef.current = elapsed;

    if (!meshRef.current) return;
    meshRef.current.rotation.y = elapsed * 3;
    meshRef.current.position.y = Math.sin(elapsed * 2) * 0.15;
  });

  const rotation = useMemo(
    () => getDiscShieldRotation(projectile.dir, rotationScratch),
    [projectile.dir.x, projectile.dir.y, projectile.dir.z, rotationScratch],
  );

  const isMyProjectile = isLocalProjectileCreator(projectile);

  return (
    <RigidBody
      name={`shield_${projectile.creatorId}`}
      collisionGroups={isMyProjectile ? interactionGroups(0, [0]) : undefined}
      position={[projectile.pos.x, projectile.pos.y, projectile.pos.z]}
      rotation={rotation}
      type="fixed"
      colliders={false}
    >
      <CylinderCollider args={[0.1, 1.5]} />
      <mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.5, 1.5, 0.2, 16]} />
        <Suspense fallback={<meshBasicMaterial color="#aa00ff" transparent opacity={0.8} />}>
          <DiscShieldMaterial />
        </Suspense>
      </mesh>
    </RigidBody>
  );
}

export function OrbShield({ projectile }: { projectile: Projectile }) {
  useProjectileLifetime(projectile.id, 10000);
  const meshRef = useRef<THREE.Mesh>(null);
  const bodyRef1 = useRef<RapierRigidBody>(null);
  const bodyRef2 = useRef<RapierRigidBody>(null);
  const { camera } = useThree();
  const isMyProjectile = isLocalProjectileCreator(projectile);
  const shieldUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color("#cc44ff") },
    uGlowColor: { value: new THREE.Color("#ff88ff") },
  }), []);

  const floatY = useRef(projectile.pos.y);
  const targetPointRef = useRef(createShieldPoint(projectile.pos));
  const floatingTargetRef = useRef(createShieldPoint(projectile.pos));
  const baseTargetRef = useRef(createShieldPoint(projectile.pos));

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.008;
      meshRef.current.rotation.x += 0.005;
      const mat = meshRef.current.material as any;
      if (mat.uniforms?.uTime) {
        mat.uniforms.uTime.value = clock.elapsedTime;
      }
    }

    const target = resolveOrbShieldTarget(
      projectile,
      isMyProjectile,
      camera.position,
      useGameStore.getState().players,
      floatY.current,
      getPublishedLocalPlayerPosition(),
      targetPointRef.current,
    );

    if (bodyRef1.current) {
      bodyRef1.current.setNextKinematicTranslation(
        writeFloatingShieldPoint(target, clock.elapsedTime, floatingTargetRef.current),
      );
    }
    if (bodyRef2.current) {
      bodyRef2.current.setNextKinematicTranslation(copyShieldPoint(target, baseTargetRef.current));
    }
  });

  return (
    <group>
      <RigidBody
        ref={bodyRef1}
        name={`shield_${projectile.creatorId}`}
        collisionGroups={isMyProjectile ? interactionGroups(0, [0]) : undefined}
        type="kinematicPosition"
        colliders={false}
        position={[projectile.pos.x, projectile.pos.y, projectile.pos.z]}
      >
        <BallCollider args={[2]} />
        <mesh ref={meshRef}>
          <sphereGeometry args={[2, 32, 32]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            uniforms={shieldUniforms}
            vertexShader={`
              varying vec3 vNormal;
              varying vec3 vWorldPosition;
              varying vec2 vUv;
              void main() {
                vNormal = normalize(normalMatrix * normal);
                vUv = uv;
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPos.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `}
            fragmentShader={`
              uniform float uTime;
              uniform vec3 uColor;
              uniform vec3 uGlowColor;
              varying vec3 vNormal;
              varying vec3 vWorldPosition;
              varying vec2 vUv;

              float hexPattern(vec2 p) {
                vec2 q = vec2(p.x * 2.0, p.y * 2.0 + p.x);
                vec2 pi = floor(q);
                vec2 pf = fract(q);
                float v = mod(pi.x + pi.y, 3.0);
                float ca = step(1.0, v);
                float cb = step(2.0, v);
                vec2 ma = step(pf.xy, pf.yx);
                float e = dot(ma, vec2(1.0 - cb, 1.0) - 2.0 * vec2(ca, cb));
                float dist = abs(pf.x - pf.y);
                return smoothstep(0.0, 0.08, dist);
              }

              void main() {
                vec3 viewDir = normalize(cameraPosition - vWorldPosition);
                float fresnel = 1.0 - abs(dot(viewDir, vNormal));
                fresnel = pow(fresnel, 2.0);

                float hex = hexPattern(vUv * 12.0 + uTime * 0.1);
                float hexLines = 1.0 - hex;
                float pulse = 0.5 + 0.5 * sin(uTime * 2.0);

                vec3 color = mix(uColor, uGlowColor, fresnel);
                color += hexLines * uGlowColor * 0.4 * (0.7 + 0.3 * pulse);

                float alpha = fresnel * 0.6 + hexLines * 0.15 + 0.05;
                alpha = clamp(alpha, 0.0, 0.85);

                gl_FragColor = vec4(color, alpha);
              }
            `}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[1.2, 16, 16]} />
          <meshBasicMaterial
            color="#dd55ff"
            transparent
            opacity={0.15}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </RigidBody>

      <RigidBody ref={bodyRef2} type="kinematicPosition" colliders={false} position={[projectile.pos.x, projectile.pos.y, projectile.pos.z]}>
        <CylinderCollider args={[0.1, 1.9]} position={[0, -1.9, 0]} />
      </RigidBody>
    </group>
  );
}
