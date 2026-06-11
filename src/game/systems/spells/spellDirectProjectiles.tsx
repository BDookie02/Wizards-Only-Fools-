import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BallCollider, CuboidCollider, RapierRigidBody, RigidBody } from "@react-three/rapier";
import { Billboard, Html } from "@react-three/drei";
import * as THREE from "three";
import { Projectile, useGameStore } from "../../../store/gameStore";
import {
  emitGameNetworkEvent,
  emitLocalPlayerDamage,
  getConnectedNetworkPlayerId,
} from "../../network/gameNetworkClient";
import {
  getPublishedLocalPlayerRigidBody,
  getPublishedRemotePlayerPosition,
} from "../player/playerEventBridge";
import { isMobilePerformanceMode } from "../input/performanceMode";
import {
  getCollisionObjectName,
  getSpellDummyDamage,
  publishSpellDummyAreaHit,
  publishSpellDummyCollisionHit,
  publishSpellDummyHitscan,
} from "./spellDummyQa";
import {
  STATUS_BOLT_SPEED,
  STATUS_SPELL_CONFIG,
  isStatusSpell,
} from "./statusSpellConfig";
import {
  FIREBALL_TEXTURES,
  ICESHARD_TEXTURES,
  PALPITATE_TEXTURES,
  RINGSOFPOWER_TEXTURES,
  getCachedSpellProjectileTextures,
  preloadSpellProjectileTextures,
} from "./spellProjectileAssets";
import { getProjectileHand } from "./spellProjectileMath";
import { useProjectileLifetime } from "./spellProjectileLifetime";
import {
  isLocalNetworkPlayerId,
  isLocalProjectileCreator,
  isRemoteProjectileCreator,
} from "./spellProjectileOwnership";
import {
  ICESHARD_SPEED,
  RINGSOFPOWER_SPEED,
} from "./spellProjectileTuning";
import { getStatusEffectExpiryMs } from "./spellStatusRuntime";

const UNIT_Y = new THREE.Vector3(0, 1, 0);
const MOBILE_STATUS_BOLT_VISUAL_UPDATE_INTERVAL_SECONDS = 1 / 30;

function useSynchronousTextures(urls: string[]) {
  const [textureVersion, setTextureVersion] = useState(0);

  useEffect(() => {
    let active = true;
    preloadSpellProjectileTextures(urls, () => {
      if (active) setTextureVersion((version) => version + 1);
    });
    return () => {
      active = false;
    };
  }, [urls]);

  return useMemo(() => getCachedSpellProjectileTextures(urls), [urls, textureVersion]);
}

function useAnimatedProjectileTexture(
  materialRef: RefObject<THREE.ShaderMaterial | null>,
  textures: THREE.Texture[],
  framesPerSecond: number,
) {
  const frameIndexRef = useRef(-1);

  useEffect(() => {
    if (textures.length > 0 && materialRef.current) {
      materialRef.current.uniforms.map.value = textures[0];
    }
    frameIndexRef.current = textures.length > 0 ? 0 : -1;
  }, [materialRef, textures]);

  useFrame(({ clock }) => {
    const textureCount = textures.length;
    if (textureCount <= 1) return;

    const safeFramesPerSecond = Math.max(1, framesPerSecond);
    const frameIndex = Math.floor(clock.elapsedTime * safeFramesPerSecond) % textureCount;
    if (frameIndexRef.current === frameIndex) return;

    const material = materialRef.current;
    if (!material) return;

    frameIndexRef.current = frameIndex;
    material.uniforms.map.value = textures[frameIndex];
  });
}

export function Fireball({ projectile }: { projectile: Projectile }) {
  const body = useRef<RapierRigidBody>(null);
  const scheduleProjectileRemoval = useProjectileLifetime(projectile.id, 5000);
  
  const [collided, setCollided] = useState(false);
  
  const meshRef = useRef<THREE.Mesh>(null);

  const textures = useSynchronousTextures(FIREBALL_TEXTURES);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  useAnimatedProjectileTexture(materialRef, textures, 10);

  const handleCollision = (e: any) => {
    if (collided) return;
    const objectName = getCollisionObjectName(e);
    const isMyProjectile = isLocalProjectileCreator(projectile);
    if (objectName === `shield_${projectile.creatorId}`) return;
    if (objectName === "player" && isMyProjectile) return;
    if (objectName === `remote_player_${projectile.creatorId}`) return;
    publishSpellDummyCollisionHit(e, projectile);

    if (objectName === "player" && !isMyProjectile) {
      emitLocalPlayerDamage(20);
    }
    
    if (meshRef.current) meshRef.current.visible = false;
    if (body.current) body.current.setTranslation({ x: 0, y: -1000, z: 0 }, true);
    setCollided(true);
    scheduleProjectileRemoval();
  };

  return (
    <RigidBody
      ref={body}
      position={[projectile.pos.x, projectile.pos.y, projectile.pos.z]}
      linearVelocity={[projectile.dir.x * 20, projectile.dir.y * 20, projectile.dir.z * 20]}
      type="dynamic"
      gravityScale={0}
      lockRotations
      onCollisionEnter={handleCollision}
      ccd={true}
    >
      <CuboidCollider args={[0.3, 0.3, 0.3]} />
      <Billboard visible={!collided}>
        <mesh ref={meshRef}>
          <planeGeometry args={[3, 3]} />
          <shaderMaterial 
            ref={materialRef}
            transparent={true}
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            uniforms={useMemo(() => ({
              map: { value: textures[0] }
            }), [textures])}
            vertexShader={`
              varying vec2 vUv;
              void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `}
            fragmentShader={`
              uniform sampler2D map;
              varying vec2 vUv;
              void main() {
                vec4 texColor = texture2D(map, vUv);
                
                float dist = distance(vUv, vec2(0.5, 0.5));
                float alpha = smoothstep(0.45, 0.2, dist);
                
                float val = max(texColor.r, max(texColor.g, texColor.b));
                if (val < 0.1 || alpha <= 0.01) {
                  discard;
                }
                
                // Dim down the dark background even more based on brightness
                float brightnessAlpha = smoothstep(0.1, 0.4, val);
                
                gl_FragColor = vec4(texColor.rgb, alpha * brightnessAlpha);
              }
            `}
          />
        </mesh>
      </Billboard>
    </RigidBody>
  );
}

function IceShard({ projectile }: { projectile: Projectile }) {
  const body = useRef<RapierRigidBody>(null);
  const scheduleProjectileRemoval = useProjectileLifetime(projectile.id, 5000);
  
  const [collided, setCollided] = useState(false);
  
  const meshRef = useRef<THREE.Mesh>(null);

  const textures = useSynchronousTextures(ICESHARD_TEXTURES);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  useAnimatedProjectileTexture(materialRef, textures, 15);

  const handleCollision = (e: any) => {
    if (collided) return;
    const objectName = getCollisionObjectName(e);
    const isMyProjectile = isLocalProjectileCreator(projectile);
    if (objectName === `shield_${projectile.creatorId}`) return;
    if (objectName === "player" && isMyProjectile) return;
    if (objectName === `remote_player_${projectile.creatorId}`) return;
    publishSpellDummyCollisionHit(e, projectile);

    if (objectName === "player" && !isMyProjectile) {
      emitLocalPlayerDamage(10);
    }
    
    if (meshRef.current) meshRef.current.visible = false;
    if (body.current) body.current.setTranslation({ x: 0, y: -1000, z: 0 }, true);
    setCollided(true);
    scheduleProjectileRemoval();
  };

  return (
    <RigidBody
      ref={body}
      position={[projectile.pos.x, projectile.pos.y, projectile.pos.z]}
      linearVelocity={[projectile.dir.x * ICESHARD_SPEED, projectile.dir.y * ICESHARD_SPEED, projectile.dir.z * ICESHARD_SPEED]}
      type="dynamic"
      gravityScale={0}
      lockRotations
      onCollisionEnter={handleCollision}
      ccd={true}
    >
      <CuboidCollider args={[0.3, 0.3, 0.3]} />
      <Billboard visible={!collided}>
        <mesh ref={meshRef}>
          <planeGeometry args={[4, 4]} />
          <shaderMaterial 
            ref={materialRef}
            transparent={true}
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            uniforms={useMemo(() => ({
              map: { value: textures[0] }
            }), [textures])}
            vertexShader={`
              varying vec2 vUv;
              void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `}
            fragmentShader={`
              uniform sampler2D map;
              varying vec2 vUv;
              void main() {
                vec4 texColor = texture2D(map, vUv);
                
                float val = max(texColor.r, max(texColor.g, texColor.b));
                if (val < 0.1) {
                  discard;
                }
                
                gl_FragColor = texColor;
              }
            `}
          />
        </mesh>
      </Billboard>
    </RigidBody>
  );
}

export function IceSpell({ projectile }: { projectile: Projectile }) {
  const { camera } = useThree();
  useProjectileLifetime(projectile.id, 600);
  const setFlashbangOpacity = useGameStore(s => s.setFlashbangOpacity);
  const initialOpacityRef = useRef(0);
  const fadeStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const isMyProjectile = isLocalProjectileCreator(projectile);
    const dx = camera.position.x - projectile.pos.x;
    const dy = camera.position.y - projectile.pos.y;
    const dz = camera.position.z - projectile.pos.z;
    const distSq = dx * dx + dy * dy + dz * dz;

    let initialOpacity = 0;
    if (isMyProjectile) {
      initialOpacity = 0.4;
    } else if (distSq < 40 * 40) {
      initialOpacity = 1;
    }

    initialOpacityRef.current = initialOpacity;
    fadeStartedAtRef.current = null;
    if (initialOpacity <= 0) return undefined;

    setFlashbangOpacity(initialOpacity);
    return () => {
      initialOpacityRef.current = 0;
      fadeStartedAtRef.current = null;
      setFlashbangOpacity(0);
    };
  }, [camera, projectile.creatorId, projectile.pos.x, projectile.pos.y, projectile.pos.z, setFlashbangOpacity]);

  useFrame(({ clock }) => {
    const initialOpacity = initialOpacityRef.current;
    if (initialOpacity <= 0) return;
    if (fadeStartedAtRef.current === null) {
      fadeStartedAtRef.current = clock.elapsedTime;
      return;
    }

    const elapsedSeconds = clock.elapsedTime - fadeStartedAtRef.current;
    const nextOpacity = Math.max(0, initialOpacity - elapsedSeconds * 1.5);
    setFlashbangOpacity(nextOpacity);
    if (nextOpacity <= 0) {
      initialOpacityRef.current = 0;
    }
  });

  return null;
}

export function FlamethrowerParticle({ projectile }: { projectile: Projectile }) {
  const body = useRef<RapierRigidBody>(null);
  useProjectileLifetime(projectile.id, 400);
  const [collided, setCollided] = useState(false);

  const handleCollision = (e: any) => {
    if (collided) return;
    const objectName = getCollisionObjectName(e);
    const isMyProjectile = isLocalProjectileCreator(projectile);
    if (objectName === `shield_${projectile.creatorId}`) return;
    if (objectName === "player" && isMyProjectile) return;
    if (objectName === `remote_player_${projectile.creatorId}`) return;
    publishSpellDummyCollisionHit(e, projectile);

    if (objectName === "player" && !isMyProjectile) {
      emitLocalPlayerDamage(5); // small continuous damage
    }
    
    setCollided(true);
    if (body.current) body.current.setTranslation({ x: 0, y: -1000, z: 0 }, true);
  };

  const speed = 90;

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
      <CuboidCollider args={[0.3, 0.3, 0.3]} />
      {!collided && (
        <Billboard>
          <mesh>
            <planeGeometry args={[1.5, 1.5]} />
            <meshBasicMaterial color="#ff5500" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh>
            <planeGeometry args={[0.8, 0.8]} />
            <meshBasicMaterial color="#ffff00" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </Billboard>
      )}
    </RigidBody>
  );
}

export function StatusBolt({ projectile }: { projectile: Projectile }) {
  const body = useRef<RapierRigidBody>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Group>(null);
  const scheduleProjectileRemoval = useProjectileLifetime(projectile.id, 4500);
  const [collided, setCollided] = useState(false);
  const type = isStatusSpell(projectile.type) ? projectile.type : 'poison';
  const config = STATUS_SPELL_CONFIG[type];
  const isMyProjectile = isLocalProjectileCreator(projectile);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const lastMobileVisualUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime;
    if (
      mobilePerformanceMode &&
      elapsed - lastMobileVisualUpdateAtRef.current < MOBILE_STATUS_BOLT_VISUAL_UPDATE_INTERVAL_SECONDS
    ) {
      return;
    }
    lastMobileVisualUpdateAtRef.current = elapsed;
    if (coreRef.current) {
      const pulse = 1 + Math.sin(elapsed * 12) * 0.12;
      coreRef.current.scale.setScalar(pulse);
    }
    if (ringRef.current) {
      ringRef.current.rotation.x += 0.08;
      ringRef.current.rotation.y += 0.11;
    }
  });

  const applyStatusToLocalPlayer = () => {
    const connectedPlayerId = getConnectedNetworkPlayerId();
    if (!connectedPlayerId) return;

    const nowMs = Date.now();
    useGameStore.getState().setStatusEffect(config.effect, getStatusEffectExpiryMs(nowMs, config.durationMs));
    emitGameNetworkEvent("applyStatusEffect", {
      targetId: connectedPlayerId,
      effect: config.effect,
      durationMs: config.durationMs,
    });
  };

  const handleCollision = (e: any) => {
    if (collided) return;

    const objectName = getCollisionObjectName(e);
    if (objectName === `shield_${projectile.creatorId}`) return;
    if (objectName === "player" && isMyProjectile) return;
    if (objectName?.startsWith("remote_player_")) return;
    publishSpellDummyCollisionHit(e, projectile);

    if (objectName === "player" && !isMyProjectile) {
      applyStatusToLocalPlayer();
    }

    if (body.current) {
      body.current.setTranslation({ x: 0, y: -1000, z: 0 }, true);
    }
    setCollided(true);
    scheduleProjectileRemoval();
  };

  const velocity = [
    projectile.dir.x * STATUS_BOLT_SPEED,
    projectile.dir.y * STATUS_BOLT_SPEED,
    projectile.dir.z * STATUS_BOLT_SPEED,
  ] as [number, number, number];

  return (
    <RigidBody
      ref={body}
      position={[projectile.pos.x, projectile.pos.y, projectile.pos.z]}
      linearVelocity={velocity}
      type="dynamic"
      gravityScale={0}
      lockRotations
      onCollisionEnter={handleCollision}
      ccd
      name={`projectile_${projectile.id}`}
    >
      <BallCollider args={[0.42]} />
      <group visible={!collided}>
        <Billboard>
          <mesh>
            <planeGeometry args={[2.6, 2.6]} />
            <meshBasicMaterial color={config.glow} transparent opacity={0.24} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        </Billboard>
        <mesh ref={coreRef}>
          <sphereGeometry args={[0.38, 10, 10]} />
          <meshStandardMaterial color={config.color} emissive={config.glow} emissiveIntensity={1.7} roughness={0.35} metalness={type === 'tungstonballsack' ? 0.9 : 0.15} />
        </mesh>
        <group ref={ringRef}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.72, 0.045, 6, 20]} />
            <meshBasicMaterial color={config.core} transparent opacity={0.72} depthWrite={false} />
          </mesh>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.55, 0.035, 6, 18]} />
            <meshBasicMaterial color={config.color} transparent opacity={0.58} depthWrite={false} />
          </mesh>
        </group>
        {type === 'tungstonballsack' && (
          <group>
            <mesh position={[0.55, -0.08, 0]}>
              <sphereGeometry args={[0.2, 8, 8]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.22} />
            </mesh>
            <mesh position={[-0.55, 0.08, 0]}>
              <sphereGeometry args={[0.2, 8, 8]} />
              <meshStandardMaterial color="#64748b" metalness={0.95} roughness={0.24} />
            </mesh>
          </group>
        )}
      </group>
    </RigidBody>
  );
}

export function PhaseBeam({ projectile }: { projectile: Projectile }) {
  const startPos = useRef(new THREE.Vector3(projectile.pos.x, projectile.pos.y, projectile.pos.z));
  const dir = useRef(new THREE.Vector3(projectile.dir.x, projectile.dir.y, projectile.dir.z).normalize());
  
  const outerRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const outerMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const coreMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const isMyProjectile = isLocalProjectileCreator(projectile);
  const spawnClockAt = useRef<number | null>(null);
  const playerPosScratch = useRef(new THREE.Vector3());
  const lineVecScratch = useRef(new THREE.Vector3());
  const pointVecScratch = useRef(new THREE.Vector3());
  const projectionScratch = useRef(new THREE.Vector3());
  const cameraDirScratch = useRef(new THREE.Vector3());
  const cameraLeftScratch = useRef(new THREE.Vector3());
  const beamMidPointScratch = useRef(new THREE.Vector3());
  const beamQuatScratch = useRef(new THREE.Quaternion());
  const beamLength = 150;
  const flashDuration = 350; // ms
  const flashDurationSeconds = flashDuration / 1000;
  useProjectileLifetime(projectile.id, flashDuration + 50);

  // Hit detection on spawn (instant)
  useEffect(() => {
    if (!isMyProjectile) return;
    const store = useGameStore.getState();
    const beamHitRadiusSq = 2.5 * 2.5;
    for (const playerId in store.players) {
      if (isLocalNetworkPlayerId(playerId)) continue;
      const pInfo = store.players[playerId];
      if (!pInfo || pInfo.health <= 0) continue;
      const pPos = playerPosScratch.current.set(pInfo.pos[0], pInfo.pos[1] + 1, pInfo.pos[2]);
      const lineVec = lineVecScratch.current.copy(dir.current).multiplyScalar(beamLength);
      const ptVec = pointVecScratch.current.copy(pPos).sub(startPos.current);
      const lineLenSq = lineVec.lengthSq();
      if (lineLenSq > 0) {
        const t = Math.max(0, Math.min(1, ptVec.dot(lineVec) / lineLenSq));
        const projection = projectionScratch.current.copy(startPos.current).addScaledVector(lineVec, t);
        if (pPos.distanceToSquared(projection) < beamHitRadiusSq) {
          emitGameNetworkEvent("hitPlayer", playerId, 35);
        }
      }
    }
    publishSpellDummyHitscan(projectile, startPos.current, dir.current, beamLength, 2.5, getSpellDummyDamage(projectile.type));
  }, []);

  useFrame((state) => {
    // Lock beam to camera for local player
    if (isMyProjectile) {
      const d = cameraDirScratch.current;
      state.camera.getWorldDirection(d);
      const camPos = state.camera.position;
      const left = cameraLeftScratch.current.crossVectors(state.camera.up, d).normalize();
      const handOffset = getProjectileHand(projectile) === "right" ? -1.05 : 1.05;
      startPos.current.set(
        camPos.x + d.x * 2 + left.x * handOffset,
        camPos.y + d.y * 2 - 0.18,
        camPos.z + d.z * 2 + left.z * handOffset
      );
      dir.current.copy(d);
    }

    if (spawnClockAt.current === null) {
      spawnClockAt.current = state.clock.elapsedTime;
    }
    const elapsed = state.clock.elapsedTime - spawnClockAt.current;
    const progress = Math.min(1, elapsed / flashDurationSeconds);
    
    // Flash bright then fade: starts at full opacity, fades to 0
    const fade = 1 - progress * progress; // quadratic ease-out fade

    if (outerRef.current && coreRef.current && outerMatRef.current && coreMatRef.current) {
      const halfLen = beamLength / 2;
      const midPoint = beamMidPointScratch.current.copy(startPos.current).addScaledVector(dir.current, halfLen);
      const quat = beamQuatScratch.current.setFromUnitVectors(UNIT_Y, dir.current);

      outerRef.current.position.copy(midPoint);
      outerRef.current.quaternion.copy(quat);
      outerRef.current.scale.set(1, beamLength, 1);

      coreRef.current.position.copy(midPoint);
      coreRef.current.quaternion.copy(quat);
      coreRef.current.scale.set(1, beamLength, 1);

      // Fade opacity
      outerMatRef.current.opacity = 0.5 * fade;
      coreMatRef.current.opacity = 0.9 * fade;
    }
  });

  return (
    <group>
      {/* Outer transparent purple cylinder */}
      <mesh ref={outerRef}>
        <cylinderGeometry args={[1.2, 1.2, 1, 8]} />
        <meshBasicMaterial ref={outerMatRef} color="#aa00ff" transparent opacity={0.5} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Bright core */}
      <mesh ref={coreRef}>
        <cylinderGeometry args={[0.35, 0.35, 1, 8]} />
        <meshBasicMaterial ref={coreMatRef} color="#eeddff" transparent opacity={0.9} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function RingsOfPower({ projectile }: { projectile: Projectile }) {
  const body = useRef<RapierRigidBody>(null);
  const scheduleProjectileRemoval = useProjectileLifetime(projectile.id, 5000);
  const [collided, setCollided] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);
  const textures = useSynchronousTextures(RINGSOFPOWER_TEXTURES);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  useAnimatedProjectileTexture(materialRef, textures, 10);

  useEffect(() => {
    if (body.current) {
      body.current.setLinvel(
        {
          x: projectile.dir.x * RINGSOFPOWER_SPEED,
          y: projectile.dir.y * RINGSOFPOWER_SPEED,
          z: projectile.dir.z * RINGSOFPOWER_SPEED,
        },
        true
      );
    }
  }, [projectile]);

  const handleCollision = (e: any) => {
    if (collided) return;
    const objectName = getCollisionObjectName(e);
    const isMyProjectile = isLocalProjectileCreator(projectile);
    if (objectName === "player" && isMyProjectile) return;
    if (objectName === `shield_${projectile.creatorId}`) return;
    if (objectName?.startsWith("remote_player_")) return;
    publishSpellDummyCollisionHit(e, projectile);

    if (objectName === "player" && !isMyProjectile) {
      emitLocalPlayerDamage(20);
    }
    
    if (meshRef.current) meshRef.current.visible = false;
    if (body.current) body.current.setTranslation({ x: 0, y: -1000, z: 0 }, true);
    setCollided(true);
    scheduleProjectileRemoval();
  };

  return (
    <RigidBody ref={body} position={[projectile.pos.x, projectile.pos.y, projectile.pos.z]} type="dynamic" gravityScale={0} lockRotations onCollisionEnter={handleCollision} ccd={true}>
      <CuboidCollider args={[0.5, 0.5, 0.5]} />
      <Billboard visible={!collided}>
        <mesh ref={meshRef}>
          <planeGeometry args={[4, 4]} />
          <shaderMaterial 
            ref={materialRef} transparent={true} depthWrite={false} side={THREE.DoubleSide}
            uniforms={useMemo(() => ({ map: { value: textures[0] } }), [textures])}
            vertexShader={`
              varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
            `}
            fragmentShader={`
              uniform sampler2D map; varying vec2 vUv;
              void main() {
                vec4 texColor = texture2D(map, vUv);
                if (texColor.r < 0.1 && texColor.g < 0.1 && texColor.b < 0.1) discard;
                gl_FragColor = vec4(texColor.rgb, 1.0);
              }
            `}
          />
        </mesh>
      </Billboard>
    </RigidBody>
  );
}

function KunaiPlane({ dir }: { dir: {x: number, y: number, z: number} }) {
  const rot = useMemo(() => {
    const direction = new THREE.Vector3(dir.x, dir.y, dir.z).normalize();
    return new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UNIT_Y, direction));
  }, [dir.x, dir.y, dir.z]);
  
  return (
    <group rotation={rot}>
      <group scale={[0.5, 0.5, 0.5]}>
        {/* Blade */}
        <mesh position={[0, 1.0, 0]} scale={[1.2, 1, 0.15]}>
          <cylinderGeometry args={[0, 0.4, 2, 4]} />
          <meshStandardMaterial color="#d0d0d0" metalness={0.8} roughness={0.2} />
        </mesh>
        
        {/* Crossguard */}
        <mesh position={[0, 0, 0]} scale={[1, 0.2, 0.3]}>
          <boxGeometry args={[0.8, 1, 1]} />
          <meshStandardMaterial color="#222222" metalness={0.5} roughness={0.8} />
        </mesh>
        
        {/* Handle */}
        <mesh position={[0, -0.6, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 1.2, 8]} />
          <meshStandardMaterial color="#6b2a2a" roughness={0.9} />
        </mesh>
        
        {/* Ring */}
        <mesh position={[0, -1.4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 2]}>
          <torusGeometry args={[0.2, 0.06, 8, 16]} />
          <meshStandardMaterial color="#222222" metalness={0.8} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

export function Kunai({ projectile }: { projectile: Projectile }) {
  const body = useRef<RapierRigidBody>(null);
  const meshRef = useRef<THREE.Group>(null);
  const scheduleProjectileRemoval = useProjectileLifetime(projectile.id, 2000);
  
  const linePositions = useMemo(() => new Float32Array(6), []);
  const lineGeom = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    geometry.setDrawRange(0, 2);
    return geometry;
  }, [linePositions]);

  const isMyProjectile = isLocalProjectileCreator(projectile);

  const [collided, setCollided] = useState(false);
  const startPos = useMemo(() => new THREE.Vector3(projectile.pos.x, projectile.pos.y, projectile.pos.z), [projectile.pos]);
  const speed = 120; // Very fast!

  const visualPos = useRef<THREE.Vector3>(new THREE.Vector3());
  const hasInitializedVisual = useRef(false);
  const updatedStartScratch = useRef(new THREE.Vector3());
  const handOffsetScratch = useRef(new THREE.Vector3());
  const worldTargetScratch = useRef(new THREE.Vector3());
  const ringOffsetScratch = useRef(new THREE.Vector3());
  const ringPosScratch = useRef(new THREE.Vector3());
  const pullDirScratch = useRef(new THREE.Vector3());

  useFrame((state) => {
    if (body.current) {
      const currentPos = body.current.translation();
      const updatedStart = updatedStartScratch.current.copy(startPos);
      
      if (isMyProjectile) {
          const hand = getProjectileHand(projectile);
          const offset = handOffsetScratch.current.set(hand === "right" ? 0.55 : -0.55, -0.24, -0.58);
          offset.applyQuaternion(state.camera.quaternion);
          updatedStart.copy(state.camera.position).add(offset);
      } else {
          const p = getPublishedRemotePlayerPosition(projectile.creatorId);
          if (p) updatedStart.set(p.x, p.y + 1, p.z);
      }

      if (!hasInitializedVisual.current) {
          visualPos.current.copy(updatedStart);
          hasInitializedVisual.current = true;
      }
      
      const worldTarget = worldTargetScratch.current.set(currentPos.x, currentPos.y, currentPos.z);
      const distSq = visualPos.current.distanceToSquared(worldTarget);
      
      if (distSq > 0.1 * 0.1) {
          visualPos.current.lerp(worldTarget, 0.4); 
      } else {
          visualPos.current.copy(worldTarget);
      }

      if (meshRef.current) {
         meshRef.current.position.copy(visualPos.current);
      }
      
      const ringOffset = ringOffsetScratch.current.set(projectile.dir.x, projectile.dir.y, projectile.dir.z).multiplyScalar(-1.5);
      const ringPos = ringPosScratch.current.copy(visualPos.current).add(ringOffset);
      
      linePositions[0] = updatedStart.x;
      linePositions[1] = updatedStart.y;
      linePositions[2] = updatedStart.z;
      linePositions[3] = ringPos.x;
      linePositions[4] = ringPos.y;
      linePositions[5] = ringPos.z;
      (lineGeom.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  const handleCollision = (e: any) => {
    if (collided) return;
    const objectName = getCollisionObjectName(e);
    if (objectName === `shield_${projectile.creatorId}`) return;
    if (objectName === "player" && isMyProjectile) return;
    const hitSpellDummy = publishSpellDummyCollisionHit(e, projectile);

    if (objectName === "player" && !isMyProjectile) {
      emitLocalPlayerDamage(15);
    }
    
    // Grappling hook logic
    if (isMyProjectile && body.current && !hitSpellDummy) {
        const hitPos = body.current.translation();
        const myBody = getPublishedLocalPlayerRigidBody();
        if (myBody) {
            // we pull the player towards hitPos
            const p = myBody.translation();
            const pullDir = pullDirScratch.current.set(hitPos.x - p.x, hitPos.y - p.y, hitPos.z - p.z).normalize();
            window.dispatchEvent(new CustomEvent('pullPlayer', {
                detail: { x: pullDir.x * 60, y: pullDir.y * 60 + 5, z: pullDir.z * 60 }
            }));
            myBody.setLinvel?.({ x: pullDir.x * 60, y: pullDir.y * 60 + 5, z: pullDir.z * 60 }, true);
        }
    }

    if (body.current) body.current.setTranslation({ x: 0, y: -1000, z: 0 }, true);
    setCollided(true);
    scheduleProjectileRemoval(100); // give time for the line to snap
  };

  // We cast line to any to bypass react svg type
  const LineComponent = 'line' as any;

  return (
    <>
      <RigidBody 
        ref={body} 
        position={[projectile.pos.x, projectile.pos.y, projectile.pos.z]} 
        linearVelocity={[projectile.dir.x * speed, projectile.dir.y * speed, projectile.dir.z * speed]}
        gravityScale={0.5}
        onIntersectionEnter={handleCollision}
        ccd={true}
        sensor
        name={`projectile_${projectile.id}`}
      >
        <CuboidCollider args={[0.2, 0.2, 0.2]} />
      </RigidBody>
      
      {!collided && (
        <group ref={meshRef}>
          <KunaiPlane dir={projectile.dir} />
        </group>
      )}

      {!collided && (
        <LineComponent geometry={lineGeom} frustumCulled={false}>
          <lineBasicMaterial color="#ffffff" linewidth={2} />
        </LineComponent>
      )}
    </>
  );
}

function LightningArc({ offset }: { offset: number }) {
  const points = useMemo(() => {
    const pts = [];
    let startY = 50;
    while(startY > -2) {
      pts.push(new THREE.Vector3((Math.random() - 0.5) * 4 + offset * 2, startY, (Math.random() - 0.5) * 4));
      startY -= Math.random() * 8 + 4;
    }
    pts.push(new THREE.Vector3(offset * 2, -2, 0));
    return pts;
  }, [offset]);

  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);

  return (
    <mesh>
      <tubeGeometry args={[curve, 20, 0.3, 8, false]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
    </mesh>
  );
}

export function Lightning({ projectile }: { projectile: Projectile }) {
  const body = useRef<RapierRigidBody>(null);
  useProjectileLifetime(projectile.id, 2000);
  const textures = useSynchronousTextures(PALPITATE_TEXTURES);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  useAnimatedProjectileTexture(materialRef, textures, 12.5);

  useEffect(() => {
    if (isLocalProjectileCreator(projectile)) {
      emitGameNetworkEvent("lightningStrike", { pos: projectile.pos });
      publishSpellDummyAreaHit(
        projectile,
        projectile.pos,
        12,
        getSpellDummyDamage("lightning"),
      );
    }
  }, [projectile]);

  return (
    <group position={[projectile.pos.x, projectile.pos.y, projectile.pos.z]}>
      <LightningArc offset={0} />
      <LightningArc offset={1} />
      <LightningArc offset={-1} />
      <Billboard>
        <mesh position={[0, -1, 0]}>
          <planeGeometry args={[15, 15]} />
          <shaderMaterial 
            ref={materialRef} transparent={true} depthWrite={false} side={THREE.DoubleSide}
            uniforms={useMemo(() => ({ map: { value: textures[0] || null } }), [textures])}
            vertexShader={`
              varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
            `}
            fragmentShader={`
              uniform sampler2D map; varying vec2 vUv;
              void main() {
                vec4 texColor = texture2D(map, vUv);
                if (texColor.r < 0.1 && texColor.g < 0.1 && texColor.b < 0.1) discard;
                gl_FragColor = vec4(texColor.rgb, 1.0);
              }
            `}
          />
        </mesh>
      </Billboard>
    </group>
  );
}
