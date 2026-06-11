import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore, type Projectile } from "../../../store/gameStore";
import { isLocalNetworkPlayerId } from "../../network/gameNetworkClient";
import {
  MAGIC_HANDS_MOBILE_PERFORMANCE_MODE,
  PALM_X,
  PALM_Y,
  heldSpellSpriteSize,
} from "./MagicHandSpriteCanvas";
import {
  GLASS_ORB_LOCK_ANGLE,
  getMagicGlassOrbSignal,
  type MagicGlassOrbSignal,
} from "./magicHandSpellEffectsRuntime";
import { useLazyRef } from "../../systems/react/useLazyRef";
import { useMagicHandEquipScale } from "./useMagicHandEquipScale";

const MAGIC_GLASS_ORB_SIGNAL_REFRESH_MS = 160;
const MOBILE_KUNAI_PIXEL_CAPTURE_INTERVAL_MS = 1000 / 24;
const MOBILE_KUNAI_MODEL_UPDATE_INTERVAL_SECONDS = 1 / 24;
const MOBILE_MAGIC_GLASS_ORB_UPDATE_INTERVAL_SECONDS = 1 / 30;

type ThreeSpellEffectProps = {
  isActive: boolean;
  isCharging: boolean;
};

function hasLocalKunaiProjectile(projectiles: Projectile[]) {
  for (let index = 0; index < projectiles.length; index += 1) {
    const projectile = projectiles[index];
    if (projectile.type === "kunai" && isLocalNetworkPlayerId(projectile.creatorId)) {
      return true;
    }
  }
  return false;
}

function Kunai3DModel() {
  const groupRef = useRef<THREE.Group>(null);
  const lastMobileUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    if (
      MAGIC_HANDS_MOBILE_PERFORMANCE_MODE &&
      elapsed - lastMobileUpdateAtRef.current < MOBILE_KUNAI_MODEL_UPDATE_INTERVAL_SECONDS
    ) return;
    lastMobileUpdateAtRef.current = elapsed;

    if (groupRef.current) {
      groupRef.current.rotation.y = elapsed * 2;
      groupRef.current.position.y = Math.sin(elapsed * 1.5) * 0.3 - 0.5;
    }
  });

  return (
    <group ref={groupRef} scale={[1.2, 1.2, 1.2]} rotation={[0.5, 0, 0]}>
      <mesh position={[0, 1.0, 0]} scale={[1.2, 1, 0.15]}>
        <cylinderGeometry args={[0, 0.4, 2, 4]} />
        <meshStandardMaterial color="#d0d0d0" metalness={0.8} roughness={0.2} />
      </mesh>

      <mesh position={[0, 0, 0]} scale={[1, 0.2, 0.3]}>
        <boxGeometry args={[0.8, 1, 1]} />
        <meshStandardMaterial color="#222222" metalness={0.5} roughness={0.8} />
      </mesh>

      <mesh position={[0, -0.6, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 1.2, 8]} />
        <meshStandardMaterial color="#6b2a2a" roughness={0.9} />
      </mesh>

      <mesh position={[0, -1.4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 2]}>
        <torusGeometry args={[0.2, 0.06, 8, 16]} />
        <meshStandardMaterial color="#222222" metalness={0.8} roughness={0.5} />
      </mesh>
    </group>
  );
}

export function KunaiCanvas({ isActive, isCharging }: ThreeSpellEffectProps) {
  const isKunaiOut = useGameStore((s) => hasLocalKunaiProjectile(s.projectiles));
  const equipScale = useMagicHandEquipScale(isActive && !isKunaiOut);
  const pixelCanvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const kunaiSize = heldSpellSpriteSize(220, 0.3, 120);

  useEffect(() => {
    if (equipScale === 0) return;
    const pixelCanvas = pixelCanvasRef.current;
    if (!pixelCanvas) return;
    const ctx = pixelCanvas.getContext("2d");
    if (!ctx) return;

    const pixelSize = 64;
    const outputSize = 256;
    pixelCanvas.width = outputSize;
    pixelCanvas.height = outputSize;

    const tiny = document.createElement("canvas");
    tiny.width = pixelSize;
    tiny.height = pixelSize;
    const tinyCtx = tiny.getContext("2d");
    if (tinyCtx) {
      tinyCtx.imageSmoothingEnabled = false;
    }

    const pixelCaptureIntervalMs = MAGIC_HANDS_MOBILE_PERFORMANCE_MODE ? MOBILE_KUNAI_PIXEL_CAPTURE_INTERVAL_MS : 0;
    let lastPixelCaptureAt = -Infinity;
    let animFrame: number | null = null;
    let captureTimeout: number | null = null;
    const scheduleNextCapture = () => {
      if (pixelCaptureIntervalMs > 0) {
        captureTimeout = window.setTimeout(() => {
          animFrame = requestAnimationFrame(renderLoop);
        }, pixelCaptureIntervalMs);
        return;
      }
      animFrame = requestAnimationFrame(renderLoop);
    };
    const renderLoop = (now: number) => {
      const source = offscreenRef.current;
      const canCapturePixelFrame = pixelCaptureIntervalMs <= 0 || now - lastPixelCaptureAt >= pixelCaptureIntervalMs;
      if (source && source.width > 0 && tinyCtx && canCapturePixelFrame) {
          lastPixelCaptureAt = now;
          tinyCtx.clearRect(0, 0, pixelSize, pixelSize);
          tinyCtx.drawImage(source, 0, 0, pixelSize, pixelSize);

          try {
            const imgData = tinyCtx.getImageData(0, 0, pixelSize, pixelSize);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
              data[i] = Math.round(data[i] / 8) * 8;
              data[i + 1] = Math.round(data[i + 1] / 8) * 8;
              data[i + 2] = Math.round(data[i + 2] / 8) * 8;
            }
            tinyCtx.putImageData(imgData, 0, 0);
          } catch {
            // Canvas may be unreadable on some embedded browser paths; the raw pixel pass is still usable.
          }

          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, outputSize, outputSize);
          ctx.drawImage(tiny, 0, 0, outputSize, outputSize);
      }
      scheduleNextCapture();
    };
    animFrame = requestAnimationFrame(renderLoop);
    return () => {
      if (animFrame !== null) cancelAnimationFrame(animFrame);
      if (captureTimeout !== null) window.clearTimeout(captureTimeout);
    };
  }, [equipScale]);

  if (equipScale === 0) return null;

  return (
    <div
      className="absolute pointer-events-none z-50 transition-all duration-100"
      style={{
        left: `${((PALM_X - 24) / 859) * 100}%`,
        bottom: `${((495 - PALM_Y - 8) / 495) * 100}%`,
        opacity: isKunaiOut ? 0 : equipScale,
        width: kunaiSize,
        height: kunaiSize,
        transform: `translate(-50%, 0) scale(${isCharging ? 1.2 : 1})`,
      }}
    >
      <div style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0 }}>
        <Canvas
          camera={{ position: [0, 0, 5], fov: 50 }}
          gl={{ antialias: false, alpha: true }}
          style={{ width: 256, height: 256 }}
          onCreated={({ gl }) => { offscreenRef.current = gl.domElement; }}
        >
          <ambientLight intensity={1.5} />
          <directionalLight position={[10, 10, 10]} intensity={2} />
          <group position={[0, -0.5, 0]}>
            <Kunai3DModel />
          </group>
        </Canvas>
      </div>
      <canvas
        ref={pixelCanvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}

function MagicGlassOrbModel({ signal, isCharging }: { signal: MagicGlassOrbSignal | null; isCharging: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Group>(null);
  const dotRef = useRef<THREE.Mesh>(null);
  const lineRef = useRef<THREE.Mesh>(null);
  const lastMobileUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);

  const angle = signal?.angle ?? 0;
  const depth = signal?.depth ?? 0.5;
  const dotX = signal ? Math.sin(angle) * 0.62 : 0;
  const dotY = signal ? Math.cos(angle) * 0.45 : 0;
  const dotZ = signal ? 0.14 + Math.cos(angle) * 0.16 : 0.12;
  const lineLength = Math.max(0.001, Math.sqrt(dotX * dotX + dotY * dotY));
  const lineRotation = -Math.atan2(dotX, dotY);
  const isLockedOn = Boolean(signal && Math.abs(signal.angle) <= GLASS_ORB_LOCK_ANGLE);
  const dotColor = signal ? (isLockedOn ? "#4ade80" : "#ef4444") : "#7dd3fc";
  const dotGlowColor = signal ? (isLockedOn ? "#bbf7d0" : "#fecaca") : "#67e8f9";

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    if (
      MAGIC_HANDS_MOBILE_PERFORMANCE_MODE &&
      elapsed - lastMobileUpdateAtRef.current < MOBILE_MAGIC_GLASS_ORB_UPDATE_INTERVAL_SECONDS
    ) return;
    lastMobileUpdateAtRef.current = elapsed;

    const pulse = 1 + Math.sin(elapsed * 5.8) * 0.06;

    if (groupRef.current) {
      groupRef.current.rotation.x = -0.12 + Math.sin(elapsed * 0.45) * 0.05;
      groupRef.current.rotation.y = Math.sin(elapsed * 0.38) * 0.22;
      groupRef.current.position.y = Math.sin(elapsed * 1.25) * 0.035;
      groupRef.current.scale.setScalar((isCharging ? 1.08 : 1) * pulse);
    }

    if (shellRef.current) {
      shellRef.current.rotation.y = elapsed * 0.18;
      shellRef.current.rotation.z = elapsed * 0.08;
    }

    if (innerRef.current) {
      innerRef.current.rotation.x = elapsed * 0.28;
      innerRef.current.rotation.y = elapsed * -0.22;
    }

    if (dotRef.current) {
      dotRef.current.scale.setScalar(signal ? (0.62 + depth * 0.42) * pulse : 0.46);
    }

    if (lineRef.current) {
      const material = lineRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = signal ? 0.32 + depth * 0.28 : 0.1;
    }
  });

  return (
    <group ref={groupRef} scale={[1, 1, 1]}>
      <ambientLight intensity={0.85} />
      <directionalLight position={[2.5, 3.5, 4]} intensity={1.7} />
      <pointLight position={[-1.5, 1.2, 1.7]} intensity={2} color="#67e8f9" />
      <pointLight position={[dotX, dotY, dotZ + 0.24]} intensity={signal ? 1.35 : 0.35} color={dotColor} />

      <mesh ref={shellRef}>
        <sphereGeometry args={[0.95, 32, 22]} />
        <meshPhysicalMaterial
          color="#9af8ff"
          transparent
          opacity={0.38}
          roughness={0.08}
          metalness={0}
          transmission={0.44}
          thickness={0.7}
          depthWrite={false}
        />
      </mesh>

      <group ref={innerRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.76, 0.009, 8, 72]} />
          <meshBasicMaterial color="#cffafe" transparent opacity={0.52} depthWrite={false} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.76, 0.009, 8, 72]} />
          <meshBasicMaterial color="#67e8f9" transparent opacity={0.46} depthWrite={false} />
        </mesh>
        <mesh rotation={[0.82, 0.18, -0.35]}>
          <torusGeometry args={[0.62, 0.007, 8, 64]} />
          <meshBasicMaterial color="#fef9c3" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      </group>

      <mesh
        ref={lineRef}
        position={[dotX / 2, dotY / 2, dotZ / 2]}
        rotation={[0, 0, lineRotation]}
        scale={[1, lineLength, 1]}
      >
        <cylinderGeometry args={[0.014, 0.014, 1, 8]} />
        <meshBasicMaterial color={dotColor} transparent opacity={signal ? 0.48 : 0.1} depthWrite={false} />
      </mesh>

      <mesh position={[dotX, dotY, dotZ]} scale={signal ? 1.55 + depth * 0.5 : 1.05}>
        <sphereGeometry args={[0.13, 16, 12]} />
        <meshBasicMaterial color={dotGlowColor} transparent opacity={signal ? 0.64 : 0.22} depthWrite={false} />
      </mesh>

      <mesh ref={dotRef} position={[dotX, dotY, dotZ]}>
        <sphereGeometry args={[0.12, 18, 14]} />
        <meshBasicMaterial color={dotColor} transparent opacity={signal ? 1 : 0.58} />
      </mesh>

      <mesh position={[-0.27, 0.34, 0.72]} rotation={[0.25, -0.25, -0.45]} scale={[0.27, 0.09, 0.025]}>
        <sphereGeometry args={[1, 16, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.72} depthWrite={false} />
      </mesh>

      <mesh position={[0.17, -0.23, 0.7]} rotation={[-0.1, 0.38, 0.32]} scale={[0.18, 0.055, 0.018]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial color="#e0f2fe" transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function MagicGlassOrbCanvas({
  isActive,
  isCharging,
  align,
}: ThreeSpellEffectProps & { align: "left" | "right" }) {
  const equipScale = useMagicHandEquipScale(isActive);
  const [signal, setSignal] = useState<MagicGlassOrbSignal | null>(null);
  const poseRef = useLazyRef(() => ({ x: 0, z: 30, angle: 0 }));

  useEffect(() => {
    if (!isActive) return undefined;

    const handlePlayerMoved = (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {};
      const pose = poseRef.current;
      pose.x = Number(detail.x) || 0;
      pose.z = Number(detail.z) || 0;
      pose.angle = Number(detail.angle) || 0;
    };

    window.addEventListener("player-moved", handlePlayerMoved);
    return () => window.removeEventListener("player-moved", handlePlayerMoved);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) {
      setSignal(null);
      return;
    }

    let cancelled = false;
    let signalTimeout: number | null = null;
    const updateSignal = () => {
      if (cancelled) return;
      const pose = poseRef.current;
      const players = useGameStore.getState().players;
      setSignal((prev) => getMagicGlassOrbSignal(pose, players, prev));
    };
    const scheduleSignalUpdate = () => {
      signalTimeout = window.setTimeout(() => {
        updateSignal();
        scheduleSignalUpdate();
      }, MAGIC_GLASS_ORB_SIGNAL_REFRESH_MS);
    };

    updateSignal();
    scheduleSignalUpdate();
    return () => {
      cancelled = true;
      if (signalTimeout !== null) window.clearTimeout(signalTimeout);
    };
  }, [isActive]);

  if (equipScale === 0) return null;

  return (
    <div
      className="absolute pointer-events-none z-50 transition-all duration-100"
      style={{
        left: `${((PALM_X + 44) / 859) * 100}%`,
        bottom: `${((495 - PALM_Y - 96) / 495) * 100}%`,
        opacity: equipScale,
        width: MAGIC_HANDS_MOBILE_PERFORMANCE_MODE ? heldSpellSpriteSize(260, 0.3, 118) : "clamp(156px, 15vh, 214px)",
        height: MAGIC_HANDS_MOBILE_PERFORMANCE_MODE ? heldSpellSpriteSize(260, 0.3, 118) : "clamp(156px, 15vh, 214px)",
        transform: `translate(-50%, 0) scaleX(${align === "right" ? -1 : 1}) scale(${isCharging ? 1.06 : 1}) translateY(${isCharging ? "-4px" : "0"})`,
        filter: "drop-shadow(0 0 22px rgba(103,232,249,0.88)) drop-shadow(0 0 44px rgba(250,204,21,0.44))",
        borderRadius: "9999px",
        background: "radial-gradient(circle at 50% 54%, rgba(103,232,249,0.24), rgba(14,165,233,0.12) 42%, transparent 70%)",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 4.2], fov: 34 }}
        dpr={[1, 1.3]}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        <MagicGlassOrbModel signal={signal} isCharging={isCharging} />
      </Canvas>
    </div>
  );
}
