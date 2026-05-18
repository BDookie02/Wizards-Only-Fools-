import { getSpriteUrl } from "./SpriteManifest";
import { useEffect, useRef, useState, useMemo, Suspense } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody, CuboidCollider, BallCollider, CylinderCollider, RapierRigidBody, useRapier, interactionGroups } from "@react-three/rapier";
import { Billboard, useTexture, Html } from "@react-three/drei";
import {
  ACID_DURATION_MS,
  POISON_DURATION_MS,
  SLEEP_DURATION_MS,
  TUNGSTON_SLOW_DURATION_MS,
  Projectile,
  HandType,
  SpellType,
  StatusEffectType,
  useGameStore
} from "../store/gameStore";
import { socket } from "../lib/socket";
import * as THREE from "three";
import { isMobilePerformanceMode } from "./performanceMode";

const MOBILE_PERFORMANCE_MODE = isMobilePerformanceMode();

const FIREBALL_SPEED = 80;
const ICESPELL_SPEED = 60;
const ICESHARD_SPEED = 70;
const RINGSOFPOWER_SPEED = 40;
const LIGHTNING_SPEED = 120;
const GRAB_MAX_REACH = 40;
const GRAB_TARGET_RADIUS = 1.8;
const TORNADO_RADIUS = 17;
const TORNADO_DURATION = 8000;
const TORNADO_BAND_COUNT = MOBILE_PERFORMANCE_MODE ? 4 : 5;
const TORNADO_GROUND_DUST_COUNT = MOBILE_PERFORMANCE_MODE ? 4 : 7;
const TORNADO_LOOSE_PIXEL_COUNT = MOBILE_PERFORMANCE_MODE ? 3 : 5;
const TORNADO_ORBIT_PIXEL_COUNT = MOBILE_PERFORMANCE_MODE ? 3 : 6;
const METEOR_SHOWER_RADIUS = 15;
const METEOR_SHOWER_DURATION = 6500;
const METEOR_SHOWER_METEOR_COUNT = MOBILE_PERFORMANCE_MODE ? 3 : 5;
const METEOR_EXPLOSION_PARTICLE_COUNT = MOBILE_PERFORMANCE_MODE ? 1 : 3;
const METEOR_AREA_SEGMENTS = MOBILE_PERFORMANCE_MODE ? 14 : 24;
const METEOR_IMPACT_SEGMENTS = MOBILE_PERFORMANCE_MODE ? 8 : 12;
const SPELL_FORCE_EVENT_INTERVAL = MOBILE_PERFORMANCE_MODE ? 1 / 20 : 1 / 30;
const SPELL_VISUAL_UPDATE_INTERVAL = MOBILE_PERFORMANCE_MODE ? 1 / 24 : 0;
const STATUS_BOLT_SPEED = 56;
type StatusSpellType = Extract<SpellType, 'tungstonballsack' | 'sleep' | 'poison' | 'acid'>;

const STATUS_SPELL_CONFIG: Record<StatusSpellType, {
  effect: StatusEffectType;
  durationMs: number;
  color: string;
  glow: string;
  core: string;
  label: string;
}> = {
  tungstonballsack: {
    effect: 'slow',
    durationMs: TUNGSTON_SLOW_DURATION_MS,
    color: '#94a3b8',
    glow: '#475569',
    core: '#e2e8f0',
    label: 'TUNGSTON'
  },
  sleep: {
    effect: 'sleep',
    durationMs: SLEEP_DURATION_MS,
    color: '#7dd3fc',
    glow: '#1d4ed8',
    core: '#e0f2fe',
    label: 'SLEEP'
  },
  poison: {
    effect: 'poison',
    durationMs: POISON_DURATION_MS,
    color: '#a855f7',
    glow: '#581c87',
    core: '#f0abfc',
    label: 'POISON'
  },
  acid: {
    effect: 'acid',
    durationMs: ACID_DURATION_MS,
    color: '#22c55e',
    glow: '#166534',
    core: '#bbf7d0',
    label: 'ACID'
  },
};

function getSeededRandom(seedText: string) {
  let seed = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    seed ^= seedText.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }

  return () => {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getAimDirectionFromRotation(rot?: [number, number, number]) {
  if (!rot) return new THREE.Vector3(0, 0, -1);

  const pitch = THREE.MathUtils.clamp(rot[0] ?? 0, -1.35, 1.35);
  const yaw = rot[1] ?? 0;
  return new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch)
  ).normalize();
}

function getPlayerAimDirection(player?: { aimDir?: [number, number, number]; rot?: [number, number, number] }) {
  if (player?.aimDir) {
    return new THREE.Vector3(player.aimDir[0], player.aimDir[1], player.aimDir[2]).normalize();
  }

  return getAimDirectionFromRotation(player?.rot);
}

const FIREBALL_TEXTURES = ["/sprites/fireball/fireball_1.png",
  "/sprites/fireball/fireball_2.png",
  "/sprites/fireball/fireball_3.png",
  "/sprites/fireball/fireball_4.png",
  "/sprites/fireball/fireball_5.png",].map(url => getSpriteUrl(url) || url);

const ICESPELL_TEXTURES = ["/sprites/icespell/icespell_1.png",
  "/sprites/icespell/icespell_2.png",
  "/sprites/icespell/icespell_3.png",
  "/sprites/icespell/icespell_4.png",
  "/sprites/icespell/icespell_5.png",
  "/sprites/icespell/icespell_6.png",
  "/sprites/icespell/icespell_7.png",
  "/sprites/icespell/icespell_8.png"].map(url => getSpriteUrl(url) || url);

const ICESHARD_TEXTURES = Array.from({ length: 6 }).map((_, i) => {
  const url = `/sprites/iceshard/spells_${i + 1}.png`;
  return getSpriteUrl(url) || url;
});

const RINGSOFPOWER_TEXTURES = Array.from({ length: 7 }).map((_, i) => {
  const url = `/sprites/ringsofpower/ringsofpower_${i + 1}.png`;
  return getSpriteUrl(url) || url;
});
const PALPITATE_TEXTURES = Array.from({ length: 11 }).map((_, i) => {
  const url = `/sprites/lightning/palpitate_${i + 1}.png`;
  return getSpriteUrl(url) || url;
});
const PORTAL_GIF_URL = getSpriteUrl("/sprites/misc/portal.gif") || "/sprites/misc/portal.gif";

function getProjectileHand(projectile: Projectile): HandType {
  return projectile.hand === "right" ? "right" : "left";
}



const _textureCache: Record<string, THREE.Texture> = {};

const fallbackTex = new THREE.DataTexture(new Uint8Array([255, 150, 0, 128]), 1, 1, THREE.RGBAFormat);
fallbackTex.needsUpdate = true;

function preloadTextures(urls: string[]) {
  if (typeof window === 'undefined') return;
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  urls.forEach(url => {
    if (!_textureCache[url]) {
       // set a temporary fallback so we don't crash before loading
       _textureCache[url] = fallbackTex;
       loader.load(url, tex => {
         tex.colorSpace = THREE.SRGBColorSpace;
         tex.magFilter = THREE.NearestFilter;
         tex.minFilter = THREE.NearestFilter;
         _textureCache[url] = tex;
       }, undefined, err => {
         console.warn("Failed to load texture, using fallback:", url);
         _textureCache[url] = fallbackTex;
       });
    }
  });
}

// Prepare immediately.
preloadTextures(FIREBALL_TEXTURES);
preloadTextures(ICESPELL_TEXTURES);
preloadTextures(ICESHARD_TEXTURES);
preloadTextures(RINGSOFPOWER_TEXTURES);
preloadTextures(PALPITATE_TEXTURES);

function useSynchronousTextures(urls: string[]) {
  return useMemo(() => urls.map(url => _textureCache[url]), [urls]);
}

function Fireball({ projectile }: { projectile: Projectile }) {
  const body = useRef<RapierRigidBody>(null);
  const removeProjectile = useGameStore(s => s.removeProjectile);
  
  const [collided, setCollided] = useState(false);
  
  const meshRef = useRef<THREE.Mesh>(null);

  const textures = useSynchronousTextures(FIREBALL_TEXTURES);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(({ clock }) => {
    if (materialRef.current && textures.length > 0) {
      const frameIndex = Math.floor(clock.elapsedTime * 10) % textures.length;
      materialRef.current.uniforms.map.value = textures[frameIndex];
    }
  });

  useEffect(() => {
    const timeout = setTimeout(() => removeProjectile(projectile.id), 5000); 
    return () => clearTimeout(timeout);
  }, [projectile.id, removeProjectile]);

  const handleCollision = (e: any) => {
    if (collided) return;
    const objectName = e.rigidBodyObject?.name;
    const isMyProjectile = projectile.creatorId === (socket.id || "local");
    if (objectName === `shield_${projectile.creatorId}`) return;
    if (objectName === "player" && isMyProjectile) return;
    if (objectName === `remote_player_${projectile.creatorId}`) return;

    if (objectName === "player" && !isMyProjectile) {
      socket.emit("hitPlayer", socket.id, 20);
    }
    
    if (meshRef.current) meshRef.current.visible = false;
    if (body.current) body.current.setTranslation({ x: 0, y: -1000, z: 0 }, true);
    setCollided(true);
    setTimeout(() => removeProjectile(projectile.id), 0);
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
  const removeProjectile = useGameStore(s => s.removeProjectile);
  
  const [collided, setCollided] = useState(false);
  
  const meshRef = useRef<THREE.Mesh>(null);

  const textures = useSynchronousTextures(ICESHARD_TEXTURES);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(({ clock }) => {
    if (materialRef.current && textures.length > 0) {
      const frameIndex = Math.floor(clock.elapsedTime * 15) % textures.length;
      materialRef.current.uniforms.map.value = textures[frameIndex];
    }
  });

  useEffect(() => {
    const timeout = setTimeout(() => removeProjectile(projectile.id), 5000); 
    return () => clearTimeout(timeout);
  }, [projectile.id, removeProjectile]);

  const handleCollision = (e: any) => {
    if (collided) return;
    const objectName = e.rigidBodyObject?.name;
    const isMyProjectile = projectile.creatorId === (socket.id || "local");
    if (objectName === `shield_${projectile.creatorId}`) return;
    if (objectName === "player" && isMyProjectile) return;
    if (objectName === `remote_player_${projectile.creatorId}`) return;

    if (objectName === "player" && !isMyProjectile) {
      socket.emit("hitPlayer", socket.id, 10);
    }
    
    if (meshRef.current) meshRef.current.visible = false;
    if (body.current) body.current.setTranslation({ x: 0, y: -1000, z: 0 }, true);
    setCollided(true);
    setTimeout(() => removeProjectile(projectile.id), 0);
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

function IceSpell({ projectile }: { projectile: Projectile }) {
  const { camera } = useThree();
  const removeProjectile = useGameStore(s => s.removeProjectile);
  const setFlashbangOpacity = useGameStore(s => s.setFlashbangOpacity);
  
  const opacityRef = useRef(1.0);
  const isBlindRef = useRef(false);

  useEffect(() => {
    const isMyProjectile = projectile.creatorId === (socket.id || "local");
    const pos = new THREE.Vector3(projectile.pos.x, projectile.pos.y, projectile.pos.z);
    
    // Check distance to camera
    const dist = camera.position.distanceTo(pos);
    
    // Blind everyone else within range
    if (!isMyProjectile && dist < 40) {
      opacityRef.current = 1.0;
      isBlindRef.current = true;
    } else if (isMyProjectile) {
      opacityRef.current = 0.4;
      isBlindRef.current = true;
    }

    const timeout = setTimeout(() => {
        removeProjectile(projectile.id);
    }, 600); // 600ms TTL
    
    return () => {
      clearTimeout(timeout);
    };
  }, [projectile.id, projectile.creatorId, projectile.pos, camera, removeProjectile]);

  useFrame((_, delta) => {
    if (isBlindRef.current && opacityRef.current > 0) {
      opacityRef.current -= delta * 1.5; // fade out speed
      if (opacityRef.current < 0) {
        opacityRef.current = 0;
        isBlindRef.current = false;
      }
      setFlashbangOpacity(opacityRef.current);
    }
  });

  return null;
}

function FlamethrowerParticle({ projectile }: { projectile: Projectile }) {
  const body = useRef<RapierRigidBody>(null);
  const removeProjectile = useGameStore(s => s.removeProjectile);
  const [collided, setCollided] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => removeProjectile(projectile.id), 400); // 400ms TTL
    return () => clearTimeout(timeout);
  }, [projectile.id, removeProjectile]);

  const handleCollision = (e: any) => {
    if (collided) return;
    const objectName = e.colliderObject?.name || e.other.rigidBodyObject?.name;
    const isMyProjectile = projectile.creatorId === (socket.id || "local");
    if (objectName === `shield_${projectile.creatorId}`) return;
    if (objectName === "player" && isMyProjectile) return;
    if (objectName === `remote_player_${projectile.creatorId}`) return;

    if (objectName === "player" && !isMyProjectile) {
      socket.emit("hitPlayer", socket.id, 5); // small continuous damage
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

function SmokeBomb({ projectile }: { projectile: Projectile }) {
  const body = useRef<RapierRigidBody>(null);
  const removeProjectile = useGameStore(s => s.removeProjectile);
  const [collided, setCollided] = useState(false);
  const [smokeSpawn, setSmokeSpawn] = useState<{x: number, y: number, z: number} | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => removeProjectile(projectile.id), 16000); 
    return () => clearTimeout(timeout);
  }, [projectile.id, removeProjectile]);

  const handleCollision = (e: any) => {
    if (collided) return;
    const objectName = e.colliderObject?.name || e.other.rigidBodyObject?.name;
    const isMyProjectile = projectile.creatorId === (socket.id || "local");
    if (objectName === `shield_${projectile.creatorId}`) return;
    if (objectName === "player" && isMyProjectile) return;
    if (objectName === `remote_player_${projectile.creatorId}`) return;
    
    setCollided(true);
    if (body.current) {
      const pos = body.current.translation();
      setSmokeSpawn({ x: pos.x, y: pos.y, z: pos.z });
      body.current.setTranslation({ x: 0, y: -1000, z: 0 }, true);
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

function SmokeCloud() {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  // Generate some random offsets for a composite cloud
  const particles = useRef(Array.from({length: 12}).map(() => ({
    x: (Math.random() - 0.5) * 5, 
    y: (Math.random() - 0.5) * 3,
    z: (Math.random() - 0.5) * 5,
    s: 1.0 + Math.random() * 1.5,
    rot: Math.random() * Math.PI,
  }))).current;

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (timeRef.current > 6) { return; } // fade out done

    const t = timeRef.current;
    
    // Scale goes from 0.1 to 3.5 over roughly 1 second
    const scale = Math.min(3.5, 0.1 + t * 6);
    
    // Opacity goes down after 6s
    let opacity = 0.8;
    if (t > 4) { // Start fading out after 4 seconds
      opacity = Math.max(0, 0.8 - (t - 4) * 0.4);
    }
    
    if (groupRef.current) {
        let i = 0;
        groupRef.current.children.forEach(child => {
            const p = particles[i];
            child.position.set(p.x * scale * 1.5, p.y * scale * 1.5 + scale * 0.5, p.z * scale * 1.5);
            child.scale.set(scale * p.s, scale * p.s, scale * p.s);
            const material = (child as any).material;
            if (material) {
                material.opacity = opacity;
                if (opacity <= 0) child.visible = false;
            }
            i++;
        });
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

function PortalSpell({ projectile }: { projectile: Projectile }) {
  const body = useRef<RapierRigidBody>(null);
  const removeProjectile = useGameStore(s => s.removeProjectile);
  const addPortal = useGameStore(s => s.addPortal);
  const [collided, setCollided] = useState(false);
  const collidedRef = useRef(false);

  useEffect(() => {
    const timeout = setTimeout(() => removeProjectile(projectile.id), 12000); 
    return () => clearTimeout(timeout);
  }, [projectile.id, removeProjectile]);

  const handleCollision = (e: any) => {
    if (collidedRef.current) return;
    const objectName = e.colliderObject?.name || e.other.rigidBodyObject?.name;
    const isMyProjectile = projectile.creatorId === (socket.id || "local");
    if (objectName === `shield_${projectile.creatorId}`) return;
    if (objectName === "player" && isMyProjectile) return;
    if (objectName?.startsWith("remote_player_")) return;
    
    collidedRef.current = true;
    setCollided(true);
    if (body.current) {
      const pos = body.current.translation();
      // Backtrack the portal slightly to avoid clipping into the wall
      addPortal({ 
        id: projectile.id, 
        pos: { 
          x: pos.x - projectile.dir.x * 1.5, 
          y: pos.y + 1.0 - projectile.dir.y * 1.0, 
          z: pos.z - projectile.dir.z * 1.5 
        } 
      });
      removeProjectile(projectile.id);
    }
  };

  const speed = 50;

  return (
    <>
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
    </>
  );
}

function PortalActive({ pos, index, id }: { pos: {x: number, y: number, z: number}, index: number, id: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const scaleRef = useRef(0.1);
  const portals = useGameStore(s => s.portals);
  const removePortal = useGameStore(s => s.removePortal);
  
  useEffect(() => {
    const timeout = setTimeout(() => {
      removePortal(id);
    }, 12000);

    return () => {
      clearTimeout(timeout);
    };
  }, [id, removePortal]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      if (scaleRef.current < 3.6) {
        scaleRef.current = Math.min(3.6, scaleRef.current + delta * 6);
        groupRef.current.scale.set(scaleRef.current, scaleRef.current, scaleRef.current);
      }
    }
  });

  const handlePortalEnter = (e: any) => {
    const objectName = e.colliderObject?.name || e.other.rigidBodyObject?.name;
    if (objectName !== "player") return;
    
    if (portals.length === 2) {
      const now = Date.now();
      const lastTP = (window as any).__lastTeleport || 0;
      if (now - lastTP < 1000) return; // 1 second cooldown
      
      const otherPortal = portals[1 - index];
      if (otherPortal) {
        (window as any).__lastTeleport = now;
        window.dispatchEvent(new CustomEvent('teleportPlayer', { 
          detail: { x: otherPortal.pos.x, y: otherPortal.pos.y, z: otherPortal.pos.z } 
        }));
      }
    }
  };

  return (
    <RigidBody position={[pos.x, pos.y, pos.z]} type="fixed" sensor onIntersectionEnter={handlePortalEnter}>
      <CuboidCollider args={[1.6, 2.4, 1.6]} />
      <Billboard>
        <group ref={groupRef} scale={0.1}>
          <Html center transform sprite distanceFactor={8} style={{ pointerEvents: 'none' }}>
            <img
              src={PORTAL_GIF_URL}
              alt=""
              style={{
                width: '148px',
                height: '190px',
                objectFit: 'contain',
                imageRendering: 'pixelated',
                mixBlendMode: 'screen',
                filter: 'brightness(1.55) contrast(1.3) saturate(1.4)',
                WebkitMaskImage: 'radial-gradient(circle at center, transparent 0 28%, black 34%, black 51%, transparent 61%)',
                maskImage: 'radial-gradient(circle at center, transparent 0 28%, black 34%, black 51%, transparent 61%)',
              }}
              onError={(e) => {
                if (!e.currentTarget.src.includes('fireball_1.png')) {
                  e.currentTarget.src = getSpriteUrl('/sprites/fireball/fireball_1.png') || '/sprites/fireball/fireball_1.png';
                }
              }}
            />
          </Html>
        </group>
      </Billboard>
    </RigidBody>
  );
}

function BlinkSpell({ projectile }: { projectile: Projectile }) {
  const removeProjectile = useGameStore(s => s.removeProjectile);
  useEffect(() => {
    const timeout = setTimeout(() => removeProjectile(projectile.id), 200); 
    return () => clearTimeout(timeout);
  }, [projectile.id, removeProjectile]);

  return (
    <Billboard position={[projectile.pos.x, projectile.pos.y, projectile.pos.z]}>
      <mesh>
        <planeGeometry args={[3, 5]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </Billboard>
  );
}

function DiscShieldMaterial() {
  const texture = useTexture("/sprites/shields/disc_shield.png");
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return (
    <meshBasicMaterial 
      map={texture}
      transparent={true}
      opacity={0.9}
      side={THREE.DoubleSide}
      blending={THREE.AdditiveBlending}
      depthWrite={false}
    />
  );
}

function DiscShield({ projectile }: { projectile: Projectile }) {
  const removeProjectile = useGameStore(s => s.removeProjectile);
  const meshRef = useRef<THREE.Mesh>(null);
  
  useEffect(() => {
    const timeout = setTimeout(() => removeProjectile(projectile.id), 10000);
    return () => clearTimeout(timeout);
  }, [projectile.id, removeProjectile]);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.05;
      meshRef.current.position.y = Math.sin(clock.elapsedTime * 2) * 0.15;
    }
  });

  const rotation = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3().copy(projectile.dir).normalize()
    )
  );

  const isMyProjectile = projectile.creatorId === (socket.id || "local");

  return (
    <RigidBody name={`shield_${projectile.creatorId}`} collisionGroups={isMyProjectile ? interactionGroups(0, [0]) : undefined} position={[projectile.pos.x, projectile.pos.y, projectile.pos.z]} rotation={rotation} type="fixed" colliders={false}>
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

function OrbShield({ projectile }: { projectile: Projectile }) {
  const removeProjectile = useGameStore(s => s.removeProjectile);
  const meshRef = useRef<THREE.Mesh>(null);
  const bodyRef1 = useRef<RapierRigidBody>(null);
  const bodyRef2 = useRef<RapierRigidBody>(null);
  const { camera } = useThree();
  const isMyProjectile = projectile.creatorId === (socket.id || "local");

  const floatY = useRef(projectile.pos.y);

  useEffect(() => {
    const timeout = setTimeout(() => removeProjectile(projectile.id), 10000); // 10 seconds
    return () => clearTimeout(timeout);
  }, [projectile.id, removeProjectile]);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.008;
      meshRef.current.rotation.x += 0.005;
      // Update shader time uniform
      const mat = (meshRef.current.material as any);
      if (mat.uniforms?.uTime) {
        mat.uniforms.uTime.value = clock.elapsedTime;
      }
    }

    let targetX = projectile.pos.x;
    let targetZ = projectile.pos.z;

    let targetY = floatY.current;

    if (isMyProjectile) {
        // Use exact rigid body position for perfectly smooth local tracking
        const p = (window as any).localPlayerPos;
        if (p) {
            targetX = p.x;
            targetY = p.y;
            targetZ = p.z;
        } else {
            targetX = camera.position.x;
            targetZ = camera.position.z;
        }
    } else {
        const pStore = useGameStore.getState().players[projectile.creatorId];
        if (pStore) {
            targetX = pStore.pos[0];
            targetY = pStore.pos[1];
            targetZ = pStore.pos[2];
        }
    }

    if (bodyRef1.current) {
        bodyRef1.current.setNextKinematicTranslation({
            x: targetX, 
            y: targetY + Math.sin(clock.elapsedTime * 2) * 0.15, 
            z: targetZ
        });
    }
    if (bodyRef2.current) {
        bodyRef2.current.setNextKinematicTranslation({
            x: targetX, 
            y: targetY, 
            z: targetZ
        });
    }
  });

  return (
    <group>
      {/* The visible orb and outer collision */}
      <RigidBody ref={bodyRef1} name={`shield_${projectile.creatorId}`} collisionGroups={isMyProjectile ? interactionGroups(0, [0]) : undefined} type="kinematicPosition" colliders={false} position={[projectile.pos.x, projectile.pos.y, projectile.pos.z]}>
        <BallCollider args={[2]} />
        <mesh ref={meshRef}>
          <sphereGeometry args={[2, 32, 32]} />
          <shaderMaterial
            transparent={true}
            depthWrite={false}
            side={THREE.DoubleSide}
            uniforms={{
              uTime: { value: 0 },
              uColor: { value: new THREE.Color('#cc44ff') },
              uGlowColor: { value: new THREE.Color('#ff88ff') },
            }}
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
                // Fresnel for edge glow
                vec3 viewDir = normalize(cameraPosition - vWorldPosition);
                float fresnel = 1.0 - abs(dot(viewDir, vNormal));
                fresnel = pow(fresnel, 2.0);

                // Hex grid on the surface
                float hex = hexPattern(vUv * 12.0 + uTime * 0.1);
                float hexLines = 1.0 - hex;

                // Pulsing energy
                float pulse = 0.5 + 0.5 * sin(uTime * 2.0);

                // Combine: mostly transparent with hex grid lines and glowing edges
                vec3 color = mix(uColor, uGlowColor, fresnel);
                color += hexLines * uGlowColor * 0.4 * (0.7 + 0.3 * pulse);

                float alpha = fresnel * 0.6 + hexLines * 0.15 + 0.05;
                alpha = clamp(alpha, 0.0, 0.85);

                gl_FragColor = vec4(color, alpha);
              }
            `}
          />
        </mesh>
        {/* Inner glow core */}
        <mesh>
          <sphereGeometry args={[1.2, 16, 16]} />
          <meshBasicMaterial
            color="#dd55ff"
            transparent={true}
            opacity={0.15}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </RigidBody>

      {/* The invisible floor so the creator can stand inside it mid-air */}
      <RigidBody ref={bodyRef2} type="kinematicPosition" colliders={false} position={[projectile.pos.x, projectile.pos.y, projectile.pos.z]}>
        <CylinderCollider args={[0.1, 1.9]} position={[0, -1.9, 0]} />
      </RigidBody>
    </group>
  );
}





function setCylinderBetween(mesh: THREE.Mesh | null, start: THREE.Vector3, end: THREE.Vector3, radius: number) {
  if (!mesh) return;

  const segment = end.clone().sub(start);
  const length = segment.length();
  if (length <= 0.001) return;

  const direction = segment.normalize();
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  mesh.scale.set(radius, length, radius);
}

function GrabSpell({ projectile }: { projectile: Projectile }) {
  const removeProjectile = useGameStore(s => s.removeProjectile);
  const isMyProjectile = projectile.creatorId === (socket.id || "local");
  const isRelease = projectile.grabPhase === "release";
  const startPos = useRef(new THREE.Vector3(projectile.pos.x, projectile.pos.y, projectile.pos.z));
  const dirRef = useRef(new THREE.Vector3(projectile.dir.x, projectile.dir.y, projectile.dir.z).normalize());
  const lengthRef = useRef(0);
  const hitLocalPlayerRef = useRef(false);
  const armSegmentRefs = useRef<Array<THREE.Mesh | null>>([]);
  const coreSegmentRefs = useRef<Array<THREE.Mesh | null>>([]);
  const palmRef = useRef<THREE.Mesh>(null);
  const fingerRefs = useRef<Array<THREE.Mesh | null>>([]);

  const getAimedTargetDistance = () => {
    let nearestDistance = GRAB_MAX_REACH;
    const checkPoint = (point: THREE.Vector3) => {
      const toPoint = point.clone().sub(startPos.current);
      const projectedDistance = toPoint.dot(dirRef.current);
      if (projectedDistance <= 1.5 || projectedDistance >= nearestDistance) return;

      const closest = startPos.current.clone().add(dirRef.current.clone().multiplyScalar(projectedDistance));
      if (point.distanceTo(closest) <= GRAB_TARGET_RADIUS) {
        nearestDistance = projectedDistance;
      }
    };

    Object.entries(useGameStore.getState().players).forEach(([playerId, player]) => {
      if (playerId === projectile.creatorId || player.health <= 0) return;
      checkPoint(new THREE.Vector3(player.pos[0], player.pos[1] + 0.85, player.pos[2]));
    });

    if (!isMyProjectile) {
      const localPos = (window as any).localPlayerPos;
      if (localPos) {
        checkPoint(new THREE.Vector3(localPos.x, localPos.y + 0.85, localPos.z));
      }
    }

    return nearestDistance;
  };

  useEffect(() => {
    if (isRelease) {
      window.dispatchEvent(new CustomEvent('releaseGrabPlayer', {
        detail: {
          casterId: projectile.creatorId,
          grabId: projectile.grabId,
          dir: projectile.dir,
          origin: projectile.pos,
        }
      }));
      if (projectile.grabId) {
        removeProjectile(projectile.grabId);
      }
      removeProjectile(projectile.id);
      return;
    }

    const timeout = window.setTimeout(() => {
      removeProjectile(projectile.id);
    }, 6200);
    return () => window.clearTimeout(timeout);
  }, [isRelease, projectile.creatorId, projectile.dir, projectile.grabId, projectile.id, projectile.pos, removeProjectile]);

  useFrame((state, delta) => {
    if (isRelease) return;

    if (isMyProjectile) {
      const d = new THREE.Vector3();
      state.camera.getWorldDirection(d);
      dirRef.current.copy(d.normalize());

      const lateral = new THREE.Vector3().crossVectors(state.camera.up, dirRef.current).normalize();
      const handOffset = getProjectileHand(projectile) === "right" ? -1.05 : 1.05;
      const camPos = state.camera.position;
      startPos.current.set(
        camPos.x + dirRef.current.x * 1.8 + lateral.x * handOffset,
        camPos.y + dirRef.current.y * 1.8 - 0.08,
        camPos.z + dirRef.current.z * 1.8 + lateral.z * handOffset
      );
    } else {
      const caster = useGameStore.getState().players[projectile.creatorId];
      if (caster) {
        const targetStart = new THREE.Vector3(caster.pos[0], caster.pos[1] + 1.1, caster.pos[2]);
        startPos.current.lerp(targetStart, 0.35);
        const liveAimDir = getPlayerAimDirection(caster);
        dirRef.current.lerp(liveAimDir, 0.45).normalize();
      }
    }

    const aimedTargetDistance = getAimedTargetDistance();
    const visualTargetDistance = aimedTargetDistance < GRAB_MAX_REACH
      ? Math.max(2.5, aimedTargetDistance - 1.05)
      : GRAB_MAX_REACH;
    lengthRef.current = THREE.MathUtils.damp(lengthRef.current, visualTargetDistance, 18, delta);

    if (!isMyProjectile && !hitLocalPlayerRef.current) {
      const localPos = (window as any).localPlayerPos;
      if (localPos) {
        const playerPoint = new THREE.Vector3(localPos.x, localPos.y + 0.8, localPos.z);
        const line = dirRef.current.clone().multiplyScalar(lengthRef.current);
        const lineLenSq = line.lengthSq();
        if (lineLenSq > 0) {
          const t = THREE.MathUtils.clamp(playerPoint.clone().sub(startPos.current).dot(line) / lineLenSq, 0, 1);
          const closest = startPos.current.clone().add(line.multiplyScalar(t));
          if (playerPoint.distanceTo(closest) < GRAB_TARGET_RADIUS) {
            const grabDistance = playerPoint.clone().sub(startPos.current).dot(dirRef.current);
            hitLocalPlayerRef.current = true;
            window.dispatchEvent(new CustomEvent('grabPlayer', {
              detail: {
                casterId: projectile.creatorId,
                grabId: projectile.grabId ?? projectile.id,
                dir: { x: dirRef.current.x, y: dirRef.current.y, z: dirRef.current.z },
                origin: { x: startPos.current.x, y: startPos.current.y, z: startPos.current.z },
                distance: grabDistance,
              }
            }));
          }
        }
      }
    }

    const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dirRef.current);
    if (side.lengthSq() < 0.001) side.set(1, 0, 0);
    side.normalize();
    const up = new THREE.Vector3().crossVectors(dirRef.current, side).normalize();
    const armSegments = 7;
    const bend = Math.min(4.6, lengthRef.current * 0.12);
    const wobble = Math.sin(state.clock.elapsedTime * 3.2) * 0.18;
    const pathPoints = Array.from({ length: armSegments + 1 }, (_, index) => {
      const t = index / armSegments;
      const eased = t * t * (3 - 2 * t);
      return startPos.current.clone()
        .add(dirRef.current.clone().multiplyScalar(lengthRef.current * t))
        .add(side.clone().multiplyScalar(Math.sin(eased * Math.PI) * (bend + wobble)))
        .add(up.clone().multiplyScalar(Math.sin(t * Math.PI) * bend * 0.24 - t * 0.35));
    });
    const palmCenter = pathPoints[pathPoints.length - 1];

    pathPoints.slice(0, -1).forEach((point, index) => {
      const nextPoint = pathPoints[index + 1];
      const t = index / Math.max(1, armSegments - 1);
      setCylinderBetween(armSegmentRefs.current[index], point, nextPoint, THREE.MathUtils.lerp(0.62, 0.78, t));
      setCylinderBetween(coreSegmentRefs.current[index], point, nextPoint, THREE.MathUtils.lerp(0.22, 0.34, t));
    });

    if (palmRef.current) {
      palmRef.current.position.copy(palmCenter);
      palmRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirRef.current);
      palmRef.current.scale.set(1.45, 0.95, 1.6);
    }

    const fingerOffsets = [-0.42, -0.2, 0.02, 0.24, 0.44];
    fingerOffsets.forEach((offset, index) => {
      const isThumb = index === 4;
      const base = palmCenter.clone()
        .add(side.clone().multiplyScalar(isThumb ? -0.78 : offset))
        .add(up.clone().multiplyScalar(isThumb ? -0.44 : 0.18));
      const tip = base.clone()
        .add(dirRef.current.clone().multiplyScalar(isThumb ? 0.6 : 1.05))
        .add(side.clone().multiplyScalar(isThumb ? -0.7 : offset * 0.55))
        .add(up.clone().multiplyScalar(isThumb ? -0.28 : 0.42 - index * 0.11 + Math.sin(state.clock.elapsedTime * 5 + index) * 0.06));

      setCylinderBetween(fingerRefs.current[index], base, tip, isThumb ? 0.22 : 0.18);
    });
  });

  if (isRelease) return null;

  return (
    <group>
      {Array.from({ length: 7 }).map((_, index) => (
        <group key={`arm-${index}`}>
          <mesh ref={(mesh) => { armSegmentRefs.current[index] = mesh; }}>
            <cylinderGeometry args={[1, 1, 1, 12]} />
            <meshBasicMaterial color="#f472b6" transparent opacity={0.24} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh ref={(mesh) => { coreSegmentRefs.current[index] = mesh; }}>
            <cylinderGeometry args={[1, 1, 1, 10]} />
            <meshBasicMaterial color="#ffd6fb" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      ))}
      <mesh ref={palmRef}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshBasicMaterial color="#ff5adf" transparent opacity={0.38} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {Array.from({ length: 5 }).map((_, index) => (
        <group key={index}>
          <mesh ref={(mesh) => { fingerRefs.current[index] = mesh; }}>
            <cylinderGeometry args={[1, 1, 1, 8]} />
            <meshBasicMaterial color={index === 4 ? "#f9a8d4" : "#fff7ff"} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

type WorldPixelPlane = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  opacity?: number;
  rotation?: number;
};

type TornadoBoxInstance = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: string;
  rotationY?: number;
};

function TornadoInstancedBoxes({ boxes, opacity }: { boxes: TornadoBoxInstance[]; opacity: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const visibleOpacity = Math.min(0.96, opacity * (MOBILE_PERFORMANCE_MODE ? 1.65 : 1.35));

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    boxes.forEach((box, index) => {
      dummy.position.set(box.x, box.y, box.z);
      dummy.rotation.set(0, box.rotationY ?? 0, 0);
      dummy.scale.set(box.w, box.h, box.d);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, color.set(box.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [boxes, color, dummy]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, boxes.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={visibleOpacity}
        blending={THREE.NormalBlending}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

const pixelMeteorBlocks: WorldPixelPlane[] = [
  { x: -0.72, y: 1.34, w: 1.44, h: 0.42, color: "#fed7aa", opacity: 0.62 },
  { x: -1.16, y: 0.96, w: 2.32, h: 0.52, color: "#fb923c", opacity: 0.78 },
  { x: -1.42, y: 0.44, w: 2.84, h: 0.64, color: "#ef4444", opacity: 0.82 },
  { x: -1.62, y: -0.22, w: 3.24, h: 0.82, color: "#f97316", opacity: 0.92 },
  { x: -1.32, y: -0.9, w: 2.64, h: 0.68, color: "#b91c1c", opacity: 0.82 },
  { x: -0.82, y: -1.32, w: 1.64, h: 0.42, color: "#fb923c", opacity: 0.7 },
  { x: -0.72, y: 0.78, w: 1.44, h: 0.46, color: "#fff7ed", opacity: 0.92 },
  { x: -1.02, y: 0.16, w: 2.04, h: 0.68, color: "#fde68a", opacity: 0.94 },
  { x: -0.82, y: -0.48, w: 1.64, h: 0.7, color: "#facc15", opacity: 0.92 },
  { x: -0.42, y: -0.9, w: 0.84, h: 0.42, color: "#fffbeb", opacity: 0.88 },
  { x: -0.38, y: 0.08, w: 0.76, h: 0.44, color: "#7c2d12", opacity: 0.95 },
  { x: 0.42, y: -0.08, w: 0.58, h: 0.42, color: "#9a3412", opacity: 0.95 },
  { x: -0.92, y: -0.38, w: 0.56, h: 0.44, color: "#c2410c", opacity: 0.95 },
  { x: 0.18, y: -0.62, w: 0.72, h: 0.5, color: "#ea580c", opacity: 0.95 },
  { x: -1.68, y: 0.86, w: 0.16, h: 0.16, color: "#fff7ed", opacity: 0.72 },
  { x: 1.66, y: 0.48, w: 0.18, h: 0.18, color: "#fed7aa", opacity: 0.68 },
  { x: -1.54, y: -1.08, w: 0.16, h: 0.16, color: "#fb923c", opacity: 0.66 },
  { x: 1.38, y: -1.08, w: 0.16, h: 0.16, color: "#fef3c7", opacity: 0.68 },
];

let cachedMeteorTexture: THREE.CanvasTexture | null = null;
let cachedTornadoTexture: THREE.CanvasTexture | null = null;

function getPixelMeteorTexture() {
  if (cachedMeteorTexture || typeof document === "undefined") return cachedMeteorTexture;

  const canvas = document.createElement("canvas");
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = false;
  pixelMeteorBlocks.forEach((block) => {
    const x = Math.round(((block.x - block.w / 2 + 2) / 4) * size);
    const y = Math.round(((2 - (block.y + block.h / 2)) / 4) * size);
    const w = Math.max(1, Math.round((block.w / 4) * size));
    const h = Math.max(1, Math.round((block.h / 4) * size));
    ctx.globalAlpha = block.opacity ?? 1;
    ctx.fillStyle = block.color;
    ctx.fillRect(x, y, w, h);
  });
  ctx.globalAlpha = 1;

  cachedMeteorTexture = new THREE.CanvasTexture(canvas);
  cachedMeteorTexture.magFilter = THREE.NearestFilter;
  cachedMeteorTexture.minFilter = THREE.NearestFilter;
  cachedMeteorTexture.generateMipmaps = false;
  cachedMeteorTexture.colorSpace = THREE.SRGBColorSpace;
  cachedMeteorTexture.needsUpdate = true;
  return cachedMeteorTexture;
}

function PixelMeteorSprite() {
  const texture = getPixelMeteorTexture();
  if (!texture) return null;

  return (
    <Billboard>
      <mesh>
        <planeGeometry args={[4.1, 4.1]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={0.96}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </Billboard>
  );
}

function getPixelTornadoTexture() {
  if (cachedTornadoTexture || typeof document === "undefined") return cachedTornadoTexture;

  const canvas = document.createElement("canvas");
  const width = 96;
  const height = 128;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = false;
  const drawBlock = (x: number, y: number, w: number, h: number, color: string, alpha = 1) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };

  const shades = ["#f8fafc", "#d1d5db", "#9ca3af", "#6b7280", "#4b5563"];
  for (let band = 0; band < 12; band += 1) {
    const t = band / 11;
    const y = 12 + band * 8.4;
    const bandWidth = 62 - t * 42;
    const centerX = width / 2 + Math.sin(t * Math.PI * 5.2) * (8 - t * 4);
    const heightStep = 5 + (band % 3);
    const shade = shades[band % shades.length];
    const highlight = shades[(band + 1) % shades.length];

    drawBlock(centerX - bandWidth / 2, y, bandWidth * 0.72, heightStep, shade, 0.78);
    drawBlock(centerX - bandWidth / 2 + bandWidth * 0.34, y + 3, bandWidth * 0.72, heightStep, highlight, 0.68);
    drawBlock(centerX - bandWidth / 2 + bandWidth * 0.08, y + 6, bandWidth * 0.46, 3, "#ffffff", 0.2);
  }

  for (let i = 0; i < 18; i += 1) {
    const t = i / 17;
    const angle = t * Math.PI * 8.5;
    const radius = 28 - t * 18;
    const x = width / 2 + Math.cos(angle) * radius + Math.sin(t * 13) * 3;
    const y = 10 + t * 108;
    const size = 2 + (i % 3);
    drawBlock(x, y, size + 1, size, shades[(i + 2) % shades.length], 0.78);
  }

  for (let i = 0; i < 7; i += 1) {
    const x = 18 + i * 9 + (i % 2) * 3;
    drawBlock(x, 116 + (i % 2) * 3, 7, 3, i % 2 ? "#a16207" : "#6b7280", 0.54);
  }
  ctx.globalAlpha = 1;

  cachedTornadoTexture = new THREE.CanvasTexture(canvas);
  cachedTornadoTexture.magFilter = THREE.NearestFilter;
  cachedTornadoTexture.minFilter = THREE.NearestFilter;
  cachedTornadoTexture.generateMipmaps = false;
  cachedTornadoTexture.colorSpace = THREE.SRGBColorSpace;
  cachedTornadoTexture.needsUpdate = true;
  return cachedTornadoTexture;
}

function PixelTornadoSprite() {
  const texture = getPixelTornadoTexture();
  if (!texture) return null;

  return (
    <Billboard position={[0, 4.2, 0]} renderOrder={12}>
      <mesh>
        <planeGeometry args={[7.6, 9.4]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={MOBILE_PERFORMANCE_MODE ? 0.96 : 0.82}
          alphaTest={0.03}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </Billboard>
  );
}

function TornadoSpell({ projectile }: { projectile: Projectile }) {
  const removeProjectile = useGameStore(s => s.removeProjectile);
  const rootRef = useRef<THREE.Group>(null);
  const swirlRef = useRef<THREE.Group>(null);
  const bandRefs = useRef<Array<THREE.Group | null>>([]);
  const spawnedAt = useRef(Date.now());
  const playerPosRef = useRef(new THREE.Vector3());
  const toCenterRef = useRef(new THREE.Vector3());
  const spinRef = useRef(new THREE.Vector3());
  const lastForceEventAt = useRef(0);
  const lastVisualUpdateAt = useRef(0);
  const center = useMemo(
    () => new THREE.Vector3(projectile.pos.x, projectile.pos.y, projectile.pos.z),
    [projectile.pos.x, projectile.pos.y, projectile.pos.z]
  );
  const tornadoBands = useMemo(() => Array.from({ length: TORNADO_BAND_COUNT }).map((_, bandIndex) => {
    const t = bandIndex / (TORNADO_BAND_COUNT - 1);
    const radius = THREE.MathUtils.lerp(0.6, 4.9, t);
    const y = THREE.MathUtils.lerp(0.32, 7.75, t);
    const pieces = 4 + Math.round(t * 4);
    return {
      radius,
      y,
      height: THREE.MathUtils.lerp(0.28, 0.48, t),
      thickness: THREE.MathUtils.lerp(0.18, 0.34, t),
      pieces: Array.from({ length: pieces }).map((_, pieceIndex) => {
        const angle = (pieceIndex / pieces) * Math.PI * 2 + bandIndex * 0.72;
        return {
          angle,
          length: THREE.MathUtils.lerp(1.3, 2.8, t) * (pieceIndex % 3 === 0 ? 1.15 : 1),
          color: pieceIndex % 4 === 0 ? "#f8fafc" : pieceIndex % 3 === 0 ? "#6b7280" : pieceIndex % 2 === 0 ? "#d1d5db" : "#9ca3af",
          opacity: THREE.MathUtils.lerp(0.66, 0.36, t),
        };
      }),
    };
  }), []);
  const groundDust = useMemo(() => Array.from({ length: TORNADO_GROUND_DUST_COUNT }).map((_, index) => {
    const angle = (index / TORNADO_GROUND_DUST_COUNT) * Math.PI * 2;
    const radius = 2.45 + (index % 5) * 0.68;
    return {
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      angle,
      width: 0.36 + (index % 4) * 0.14,
      color: index % 4 === 0 ? "#d1d5db" : index % 4 === 1 ? "#9ca3af" : index % 4 === 2 ? "#6b7280" : "#a16207",
      opacity: 0.24 + (index % 3) * 0.06,
    };
  }), []);
  const loosePixels = useMemo(() => Array.from({ length: TORNADO_LOOSE_PIXEL_COUNT }).map((_, index) => {
    const t = index / (TORNADO_LOOSE_PIXEL_COUNT - 1);
    const angle = t * Math.PI * 9.5;
    const radius = THREE.MathUtils.lerp(1.0, 5.4, t);
    return {
      x: Math.cos(angle) * radius,
      y: THREE.MathUtils.lerp(0.6, 7.6, t),
      z: Math.sin(angle) * radius,
      size: THREE.MathUtils.lerp(0.22, 0.42, 1 - t),
      color: index % 3 === 0 ? "#f8fafc" : index % 3 === 1 ? "#9ca3af" : "#4b5563",
      opacity: THREE.MathUtils.lerp(0.78, 0.42, t),
    };
  }), []);
  const orbitingParticles = useMemo(() => Array.from({ length: TORNADO_ORBIT_PIXEL_COUNT }).map((_, index) => {
    const t = index / (TORNADO_ORBIT_PIXEL_COUNT - 1);
    const angle = t * Math.PI * 15.5;
    const radius = THREE.MathUtils.lerp(1.35, 7.85, t) + ((index % 5) - 2) * 0.18;
    return {
      x: Math.cos(angle) * radius,
      y: THREE.MathUtils.lerp(0.28, 8.2, t),
      z: Math.sin(angle) * radius,
      angle,
      w: THREE.MathUtils.lerp(0.22, 0.7, 1 - Math.abs(t - 0.42)),
      h: THREE.MathUtils.lerp(0.14, 0.32, 1 - t),
      d: THREE.MathUtils.lerp(0.12, 0.22, t),
      color: index % 5 === 0 ? "#f8fafc" : index % 5 === 1 ? "#d1d5db" : index % 5 === 2 ? "#9ca3af" : index % 5 === 3 ? "#4b5563" : "#a16207",
      opacity: THREE.MathUtils.lerp(0.68, 0.28, t),
    };
  }), []);
  const groundDustBoxes = useMemo(() => groundDust.map((marker) => ({
    x: marker.x,
    y: 0.05,
    z: marker.z,
    w: marker.width,
    h: 0.12,
    d: 0.22,
    color: marker.color,
    rotationY: marker.angle,
  })), [groundDust]);
  const loosePixelBoxes = useMemo(() => loosePixels.map((pixel) => ({
    x: pixel.x,
    y: pixel.y,
    z: pixel.z,
    w: pixel.size,
    h: pixel.size,
    d: pixel.size,
    color: pixel.color,
  })), [loosePixels]);
  const orbitingParticleBoxes = useMemo(() => orbitingParticles.map((particle) => ({
    x: particle.x,
    y: particle.y,
    z: particle.z,
    w: particle.w,
    h: particle.h,
    d: particle.d,
    color: particle.color,
    rotationY: Math.PI / 2 - particle.angle,
  })), [orbitingParticles]);

  useEffect(() => {
    const timeout = window.setTimeout(() => removeProjectile(projectile.id), TORNADO_DURATION);
    return () => window.clearTimeout(timeout);
  }, [projectile.id, removeProjectile]);

  useFrame((state, delta) => {
    const elapsed = (Date.now() - spawnedAt.current) / 1000;
    const shouldUpdateVisuals = !MOBILE_PERFORMANCE_MODE || state.clock.elapsedTime - lastVisualUpdateAt.current >= SPELL_VISUAL_UPDATE_INTERVAL;
    if (shouldUpdateVisuals) {
      lastVisualUpdateAt.current = state.clock.elapsedTime;
      const fadeIn = THREE.MathUtils.clamp(elapsed / 0.45, 0, 1);
      const fadeOut = THREE.MathUtils.clamp((TORNADO_DURATION / 1000 - elapsed) / 1.2, 0, 1);
      const lifeScale = Math.min(fadeIn, fadeOut);

      if (rootRef.current) {
        rootRef.current.scale.setScalar(THREE.MathUtils.lerp(rootRef.current.scale.x, lifeScale, 1 - Math.exp(-10 * delta)));
      }

      if (swirlRef.current) {
        swirlRef.current.rotation.y += delta * 5.8;
      }

      bandRefs.current.forEach((band, index) => {
        if (!band) return;
        const t = index / (TORNADO_BAND_COUNT - 1);
        band.rotation.y += delta * (2.7 + t * 4.1);
        band.position.x = Math.round(Math.sin(state.clock.elapsedTime * (1.7 + t) + index) * (0.14 + t * 0.22) * 8) / 8;
        band.position.z = Math.round(Math.cos(state.clock.elapsedTime * (1.5 + t) + index * 1.9) * (0.14 + t * 0.22) * 8) / 8;
      });
    }

    const localPos = (window as any).localPlayerPos;
    if (!localPos) return;

    const playerPos = playerPosRef.current.set(localPos.x, localPos.y, localPos.z);
    const toCenter = toCenterRef.current.copy(center);
    toCenter.y = playerPos.y;
    toCenter.sub(playerPos);
    const dist = toCenter.length();
    if (dist >= TORNADO_RADIUS || dist <= 0.1) return;

    if (state.clock.elapsedTime - lastForceEventAt.current < SPELL_FORCE_EVENT_INTERVAL) return;
    lastForceEventAt.current = state.clock.elapsedTime;

    const strength = 1 - dist / TORNADO_RADIUS;
    const spin = spinRef.current.set(-toCenter.z, 0, toCenter.x).normalize().multiplyScalar(3.8 * strength);
    const pull = toCenter.normalize().multiplyScalar(16 * strength).add(spin);
    pull.y = 2.6 * strength;
    window.dispatchEvent(new CustomEvent('pullPlayer', { detail: { x: pull.x, y: pull.y, z: pull.z } }));
  });

  return (
    <group ref={rootRef} position={[center.x, center.y + 0.05, center.z]} scale={0.001}>
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
              boxes={band.pieces.map((piece) => ({
                x: Math.cos(piece.angle) * band.radius,
                y: 0,
                z: Math.sin(piece.angle) * band.radius,
                w: piece.length,
                h: band.height,
                d: band.thickness,
                color: piece.color,
                rotationY: Math.PI / 2 - piece.angle,
              }))}
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

function MeteorShowerSpell({ projectile }: { projectile: Projectile }) {
  const removeProjectile = useGameStore(s => s.removeProjectile);
  const meteorRefs = useRef<Array<THREE.Group | null>>([]);
  const impactRefs = useRef<Array<THREE.Mesh | null>>([]);
  const impactFlashRefs = useRef<Array<THREE.Mesh | null>>([]);
  const explosionRefs = useRef<Array<THREE.Group | null>>([]);
  const explosionParticleRefs = useRef<Array<Array<THREE.Mesh | null>>>([]);
  const hitRefs = useRef<boolean[]>([]);
  const spawnedAt = useRef(Date.now());
  const lastVisualUpdateAt = useRef(0);
  const playerPosRef = useRef(new THREE.Vector3());
  const groundPointRef = useRef(new THREE.Vector3());
  const center = useMemo(
    () => new THREE.Vector3(projectile.pos.x, projectile.pos.y, projectile.pos.z),
    [projectile.pos.x, projectile.pos.y, projectile.pos.z]
  );
  const meteors = useMemo(() => {
    const random = getSeededRandom(`${projectile.id}-${projectile.createdAt}`);
    return Array.from({ length: METEOR_SHOWER_METEOR_COUNT }).map((_, index) => {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * METEOR_SHOWER_RADIUS;
      const target = new THREE.Vector3(
        center.x + Math.cos(angle) * radius,
        center.y + 0.12,
        center.z + Math.sin(angle) * radius
      );
      const driftAngle = angle + Math.PI * (0.65 + random() * 0.45);
      const start = target.clone().add(new THREE.Vector3(
        Math.cos(driftAngle) * (8 + random() * 6),
        24 + random() * 9,
        Math.sin(driftAngle) * (8 + random() * 6)
      ));
      const particles = Array.from({ length: METEOR_EXPLOSION_PARTICLE_COUNT }).map((__, particleIndex) => {
        const particleAngle = random() * Math.PI * 2;
        const speed = 2.2 + random() * 5.4;
        return {
          dirX: Math.cos(particleAngle),
          dirZ: Math.sin(particleAngle),
          speed,
          lift: 0.45 + random() * 2.6,
          size: 0.13 + random() * 0.32,
          color: particleIndex % 5 === 0 ? "#fff7ed" : particleIndex % 5 === 1 ? "#facc15" : particleIndex % 5 === 2 ? "#fb923c" : particleIndex % 5 === 3 ? "#ef4444" : "#4b2a1a",
          smoke: particleIndex % 5 === 4,
        };
      });
      return {
        start,
        target,
        delay: index * 0.24 + random() * 0.32,
        duration: 0.9 + random() * 0.35,
        size: 0.7 + random() * 0.5,
        impactRadius: 3.2 + random() * 0.5,
        particles,
      };
    });
  }, [center, projectile.createdAt, projectile.id]);
  const canDamageLocalPlayer = projectile.creatorId !== (socket.id || "local");

  useEffect(() => {
    const timeout = window.setTimeout(() => removeProjectile(projectile.id), METEOR_SHOWER_DURATION + 900);
    return () => window.clearTimeout(timeout);
  }, [projectile.id, removeProjectile]);

  useFrame((state) => {
    if (MOBILE_PERFORMANCE_MODE && state.clock.elapsedTime - lastVisualUpdateAt.current < SPELL_VISUAL_UPDATE_INTERVAL) return;
    lastVisualUpdateAt.current = state.clock.elapsedTime;

    const elapsed = (Date.now() - spawnedAt.current) / 1000;

    meteors.forEach((meteor, index) => {
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

      if (!hitRefs.current[index] && localTime >= meteor.duration) {
        hitRefs.current[index] = true;
        const localPos = (window as any).localPlayerPos;
        if (localPos) {
          const playerPos = playerPosRef.current.set(localPos.x, localPos.y, localPos.z);
          const groundPoint = groundPointRef.current.set(meteor.target.x, playerPos.y, meteor.target.z);
          const distanceToImpact = playerPos.distanceTo(groundPoint);
          const shakeRadius = 30;
          if (distanceToImpact <= shakeRadius) {
            const shakeFalloff = 1 - distanceToImpact / shakeRadius;
            window.dispatchEvent(new CustomEvent("screenShake", {
              detail: {
                strength: THREE.MathUtils.lerp(0.08, 0.48, shakeFalloff) * meteor.size,
                duration: THREE.MathUtils.lerp(180, 520, shakeFalloff),
              }
            }));
          }
          if (canDamageLocalPlayer && distanceToImpact <= meteor.impactRadius) {
            socket.emit("hitPlayer", socket.id, 18);
          }
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

          particleMeshes?.forEach((particleMesh, particleIndex) => {
            if (!particleMesh) return;
            const particle = meteor.particles[particleIndex];
            const travel = particle.speed * burstProgress * meteor.size;
            const lift = particle.lift * Math.sin(burstProgress * Math.PI) + burstProgress * 0.38;
            particleMesh.position.set(particle.dirX * travel, 0.18 + lift, particle.dirZ * travel);
            particleMesh.scale.setScalar(Math.max(0.02, particle.size * meteor.size * (1.05 - burstProgress)));
            const particleMaterial = particleMesh.material as THREE.MeshBasicMaterial;
            particleMaterial.opacity = particle.smoke
              ? THREE.MathUtils.lerp(0.38, 0, burstProgress)
              : THREE.MathUtils.lerp(0.9, 0, burstProgress);
          });
        }
      }
    });
  });

  return (
    <group>
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

function isStatusSpell(type: SpellType): type is StatusSpellType {
  return type === 'tungstonballsack' || type === 'sleep' || type === 'poison' || type === 'acid';
}

function StatusBolt({ projectile }: { projectile: Projectile }) {
  const body = useRef<RapierRigidBody>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Group>(null);
  const removeProjectile = useGameStore(s => s.removeProjectile);
  const [collided, setCollided] = useState(false);
  const type = isStatusSpell(projectile.type) ? projectile.type : 'poison';
  const config = STATUS_SPELL_CONFIG[type];
  const isMyProjectile = projectile.creatorId === (socket.id || "local");

  useEffect(() => {
    const timeout = window.setTimeout(() => removeProjectile(projectile.id), 4500);
    return () => window.clearTimeout(timeout);
  }, [projectile.id, removeProjectile]);

  useFrame(({ clock }) => {
    if (coreRef.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 12) * 0.12;
      coreRef.current.scale.setScalar(pulse);
    }
    if (ringRef.current) {
      ringRef.current.rotation.x += 0.08;
      ringRef.current.rotation.y += 0.11;
    }
  });

  const applyStatusToLocalPlayer = () => {
    if (!socket.id) return;

    useGameStore.getState().setStatusEffect(config.effect, Date.now() + config.durationMs);
    socket.emit("applyStatusEffect", {
      targetId: socket.id,
      effect: config.effect,
      durationMs: config.durationMs,
    });
  };

  const handleCollision = (e: any) => {
    if (collided) return;

    const objectName = e.rigidBodyObject?.name || e.colliderObject?.name || e.other?.rigidBodyObject?.name;
    if (objectName === `shield_${projectile.creatorId}`) return;
    if (objectName === "player" && isMyProjectile) return;
    if (objectName?.startsWith("remote_player_")) return;

    if (objectName === "player" && !isMyProjectile) {
      applyStatusToLocalPlayer();
    }

    if (body.current) {
      body.current.setTranslation({ x: 0, y: -1000, z: 0 }, true);
    }
    setCollided(true);
    window.setTimeout(() => removeProjectile(projectile.id), 0);
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

export function Projectiles() {
  const projectiles = useGameStore(s => s.projectiles);
  const portals = useGameStore(s => s.portals);

  return (
    <>
      {projectiles.map(p => {
        switch(p.type) {
          case 'fireball': return <Fireball key={p.id} projectile={p} />;
          case 'iceshard': return <PhaseBeam key={p.id} projectile={p} />;
          case 'arcanebeam': return <PhaseBeam key={p.id} projectile={p} />;
          case 'icespell': return <IceSpell key={p.id} projectile={p} />;
          case 'ringsofpower': return <RingsOfPower key={p.id} projectile={p} />;
          case 'lightning': return <Lightning key={p.id} projectile={p} />;
          case 'portal': return <PortalSpell key={p.id} projectile={p} />;
          case 'blink': return <BlinkSpell key={p.id} projectile={p} />;
          case 'grab': return <GrabSpell key={p.id} projectile={p} />;
          case 'tornado': return <TornadoSpell key={p.id} projectile={p} />;
          case 'meteorshower': return <MeteorShowerSpell key={p.id} projectile={p} />;
          case 'smokebomb': return <SmokeBomb key={p.id} projectile={p} />;
          case 'flamethrower': return <FlamethrowerParticle key={p.id} projectile={p} />;
          case 'discshield': return <DiscShield key={p.id} projectile={p} />;
          case 'orbshield': return <OrbShield key={p.id} projectile={p} />;
          case 'kunai': return <Kunai key={p.id} projectile={p} />;
          case 'healingcrystals': return <HealingCrystals key={p.id} projectile={p} />;
          case 'tungstonballsack': return null;
          case 'sleep': return <StatusBolt key={p.id} projectile={p} />;
          case 'poison': return <StatusBolt key={p.id} projectile={p} />;
          case 'acid': return <StatusBolt key={p.id} projectile={p} />;
          default: return null;
        }
      })}
      {portals.map((portal, idx) => (
        <PortalActive key={portal.id} id={portal.id} pos={portal.pos} index={idx} />
      ))}
    </>
  );
}

function PhaseBeam({ projectile }: { projectile: Projectile }) {
  const removeProjectile = useGameStore(s => s.removeProjectile);
  
  const startPos = useRef(new THREE.Vector3(projectile.pos.x, projectile.pos.y, projectile.pos.z));
  const dir = useRef(new THREE.Vector3(projectile.dir.x, projectile.dir.y, projectile.dir.z).normalize());
  
  const outerRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const outerMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const coreMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const isMyProjectile = projectile.creatorId === (socket.id || "local");
  const spawnTime = useRef(Date.now());
  const beamLength = 150;
  const flashDuration = 350; // ms

  // Auto-remove after flash
  useEffect(() => {
    const timeout = setTimeout(() => {
      removeProjectile(projectile.id);
    }, flashDuration + 50);
    return () => clearTimeout(timeout);
  }, [projectile.id, removeProjectile]);

  // Hit detection on spawn (instant)
  useEffect(() => {
    if (!isMyProjectile) return;
    const store = useGameStore.getState();
    Object.entries(store.players).forEach(([playerId, pInfo]) => {
      if (playerId === (socket.id || "local")) return;
      if (pInfo.health <= 0) return;
      const pPos = new THREE.Vector3(pInfo.pos[0], pInfo.pos[1] + 1, pInfo.pos[2]);
      const lineVec = dir.current.clone().multiplyScalar(beamLength);
      const ptVec = pPos.clone().sub(startPos.current);
      const lineLenSq = lineVec.lengthSq();
      if (lineLenSq > 0) {
        const t = Math.max(0, Math.min(1, ptVec.dot(lineVec) / lineLenSq));
        const projection = startPos.current.clone().add(lineVec.clone().multiplyScalar(t));
        const distance = pPos.distanceTo(projection);
        if (distance < 2.5) {
          socket.emit("hitPlayer", playerId, 35);
        }
      }
    });
  }, []);

  useFrame((state) => {
    // Lock beam to camera for local player
    if (isMyProjectile) {
      const d = new THREE.Vector3();
      state.camera.getWorldDirection(d);
      const camPos = state.camera.position.clone();
      const left = new THREE.Vector3().crossVectors(state.camera.up, d).normalize();
      const handOffset = getProjectileHand(projectile) === "right" ? -1.05 : 1.05;
      startPos.current.set(
        camPos.x + d.x * 2 + left.x * handOffset,
        camPos.y + d.y * 2 - 0.18,
        camPos.z + d.z * 2 + left.z * handOffset
      );
      dir.current.copy(d);
    }

    const elapsed = Date.now() - spawnTime.current;
    const progress = Math.min(1, elapsed / flashDuration);
    
    // Flash bright then fade: starts at full opacity, fades to 0
    const fade = 1 - progress * progress; // quadratic ease-out fade

    if (outerRef.current && coreRef.current && outerMatRef.current && coreMatRef.current) {
      const halfLen = beamLength / 2;
      const midPoint = startPos.current.clone().add(dir.current.clone().multiplyScalar(halfLen));
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.current);

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

function RingsOfPower({ projectile }: { projectile: Projectile }) {
  const body = useRef<RapierRigidBody>(null);
  const removeProjectile = useGameStore(s => s.removeProjectile);
  const [collided, setCollided] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);
  const textures = useSynchronousTextures(RINGSOFPOWER_TEXTURES);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(({ clock }) => {
    if (materialRef.current && textures.length > 0) {
      const frameIndex = Math.floor(clock.elapsedTime * 10) % textures.length;
      materialRef.current.uniforms.map.value = textures[frameIndex];
    }
  });

  useEffect(() => {
    if (body.current) {
      body.current.setLinvel(
        new THREE.Vector3(projectile.dir.x * RINGSOFPOWER_SPEED, projectile.dir.y * RINGSOFPOWER_SPEED, projectile.dir.z * RINGSOFPOWER_SPEED),
        true
      );
    }
  }, [projectile]);

  useEffect(() => {
    const timeout = setTimeout(() => removeProjectile(projectile.id), 5000);
    return () => clearTimeout(timeout);
  }, [projectile.id, removeProjectile]);

  const handleCollision = (e: any) => {
    if (collided) return;
    const objectName = e.rigidBodyObject?.name;
    const isMyProjectile = projectile.creatorId === (socket.id || "local");
    if (objectName === "player" && isMyProjectile) return;
    if (objectName === `shield_${projectile.creatorId}`) return;
    if (objectName?.startsWith("remote_player_")) return;

    if (objectName === "player" && !isMyProjectile) {
      socket.emit("hitPlayer", socket.id, 20);
    }
    
    if (meshRef.current) meshRef.current.visible = false;
    if (body.current) body.current.setTranslation({ x: 0, y: -1000, z: 0 }, true);
    setCollided(true);
    setTimeout(() => removeProjectile(projectile.id), 0);
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
  const rot = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dir.x, dir.y, dir.z)));
  
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

function Kunai({ projectile }: { projectile: Projectile }) {
  const body = useRef<RapierRigidBody>(null);
  const meshRef = useRef<THREE.Group>(null);
  
  const [lineGeom] = useState(() => new THREE.BufferGeometry());

  const removeProjectile = useGameStore(s => s.removeProjectile);
  const isMyProjectile = projectile.creatorId === (socket.id || "local");

  const [collided, setCollided] = useState(false);
  const startPos = useMemo(() => new THREE.Vector3(projectile.pos.x, projectile.pos.y, projectile.pos.z), [projectile.pos]);
  const speed = 120; // Very fast!

  const visualPos = useRef<THREE.Vector3>(new THREE.Vector3());
  const hasInitializedVisual = useRef(false);

  useEffect(() => {
    const timeout = setTimeout(() => removeProjectile(projectile.id), 2000); 
    return () => clearTimeout(timeout);
  }, [projectile.id, removeProjectile]);

  useFrame((state) => {
    if (body.current) {
      const currentPos = body.current.translation();
      let updatedStart = startPos.clone();
      
      if (isMyProjectile) {
          const hand = getProjectileHand(projectile);
          const offset = new THREE.Vector3(hand === "right" ? 0.55 : -0.55, -0.24, -0.58);
          offset.applyQuaternion(state.camera.quaternion);
          updatedStart.copy(state.camera.position).add(offset);
      } else {
          const p = (window as any).remotePlayersPositions?.[projectile.creatorId];
          if (p) updatedStart.set(p.x, p.y + 1, p.z);
      }

      if (!hasInitializedVisual.current) {
          visualPos.current.copy(updatedStart);
          hasInitializedVisual.current = true;
      }
      
      const worldTarget = new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z);
      const dist = visualPos.current.distanceTo(worldTarget);
      
      if (dist > 0.1) {
          visualPos.current.lerp(worldTarget, 0.4); 
      } else {
          visualPos.current.copy(worldTarget);
      }

      if (meshRef.current) {
         meshRef.current.position.copy(visualPos.current);
      }
      
      const ringOffset = new THREE.Vector3(projectile.dir.x, projectile.dir.y, projectile.dir.z).multiplyScalar(-1.5);
      const ringPos = visualPos.current.clone().add(ringOffset);
      
      lineGeom.setFromPoints([updatedStart, ringPos]);
    }
  });

  const handleCollision = (e: any) => {
    if (collided) return;
    const objectName = e.colliderObject?.name || e.other.rigidBodyObject?.name;
    if (objectName === `shield_${projectile.creatorId}`) return;
    if (objectName === "player" && isMyProjectile) return;

    if (objectName === "player" && !isMyProjectile) {
      socket.emit("hitPlayer", socket.id, 15);
    }
    
    // Grappling hook logic
    if (isMyProjectile && body.current) {
        const hitPos = body.current.translation();
        const myBody = (window as any).localPlayerRigidBody;
        if (myBody) {
            // we pull the player towards hitPos
            const p = myBody.translation();
            const pullDir = new THREE.Vector3(hitPos.x - p.x, hitPos.y - p.y, hitPos.z - p.z).normalize();
            window.dispatchEvent(new CustomEvent('pullPlayer', {
                detail: { x: pullDir.x * 60, y: pullDir.y * 60 + 5, z: pullDir.z * 60 }
            }));
            myBody.setLinvel({ x: pullDir.x * 60, y: pullDir.y * 60 + 5, z: pullDir.z * 60 }, true);
        }
    }

    if (body.current) body.current.setTranslation({ x: 0, y: -1000, z: 0 }, true);
    setCollided(true);
    setTimeout(() => removeProjectile(projectile.id), 100); // give time for the line to snap? No, remove.
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
        <LineComponent geometry={lineGeom}>
          <lineBasicMaterial color="#ffffff" linewidth={2} />
        </LineComponent>
      )}
    </>
  );
}

function HealingCrystalMesh() {
  const ref = useRef<THREE.Group>(null);
  const texture = useTexture(getSpriteUrl("/sprites/misc/healing_gems.gif") || "/sprites/misc/healing_gems.gif");
  
  useEffect(() => {
    if (texture) {
      texture.minFilter = THREE.NearestFilter;
      texture.magFilter = THREE.NearestFilter;
    }
  }, [texture]);
  
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = Math.sin(clock.elapsedTime * 3) * 0.5 + 1.0;
    }
  });

  return (
    <group ref={ref}>
      <Billboard>
        <mesh>
          <planeGeometry args={[2.5, 2.5]} />
          <meshBasicMaterial 
            map={texture} 
            transparent={true} 
            depthWrite={false} 
            blending={THREE.AdditiveBlending}
            alphaTest={0.05}
          />
        </mesh>
      </Billboard>
    </group>
  );
}

function HealingCrystals({ projectile }: { projectile: Projectile }) {
  const removeProjectile = useGameStore(s => s.removeProjectile);
  const isMyProjectile = projectile.creatorId === (socket.id || "local");
  
  useEffect(() => {
    const timeout = setTimeout(() => removeProjectile(projectile.id), 10000); 
    return () => clearTimeout(timeout);
  }, [projectile.id, removeProjectile]);

  useFrame((_, delta) => {
    if (isMyProjectile) {
        const p = (window as any).localPlayerPos;
        if (p) {
            const dist = new THREE.Vector3(p.x, p.y, p.z).distanceTo(new THREE.Vector3(projectile.pos.x, projectile.pos.y, projectile.pos.z));
            if (dist < 3) { 
                const store = useGameStore.getState();
                let health = store.health;
                const hasToxicEffect = store.poisonUntil > Date.now() || store.acidUntil > Date.now();
                if (hasToxicEffect) {
                    store.clearToxicEffects();
                    if (socket.id) {
                      socket.emit("clearStatusEffect", { targetId: socket.id, effects: ["poison", "acid"] });
                    }
                }
                if (health < 100 && health > 0) {
                    health = Math.min(100, health + (10 * delta)); 
                    useGameStore.getState().setHealth(health);
                }
            }
        }
    }
  });

  return (
    <group position={[projectile.pos.x, projectile.pos.y, projectile.pos.z]}>
      <HealingCrystalMesh />
      <mesh position={[0, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
         <circleGeometry args={[2.5, 32]} />
         <meshBasicMaterial color="#00ff88" transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
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

function Lightning({ projectile }: { projectile: Projectile }) {
  const body = useRef<RapierRigidBody>(null);
  const removeProjectile = useGameStore(s => s.removeProjectile);
  const textures = useSynchronousTextures(PALPITATE_TEXTURES);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  useFrame(({ clock }) => {
    if (materialRef.current && textures.length > 0) {
        const frameIndex = Math.floor(clock.elapsedTime * 12.5) % textures.length;
        materialRef.current.uniforms.map.value = textures[frameIndex];
    }
  });

  useEffect(() => {
    if (projectile.creatorId === (socket.id || "local")) {
      socket.emit("lightningStrike", { pos: projectile.pos });
    }
    const timeout = setTimeout(() => removeProjectile(projectile.id), 2000);
    return () => clearTimeout(timeout);
  }, [projectile, removeProjectile]);

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
