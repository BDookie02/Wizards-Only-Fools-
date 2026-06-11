import { useFrame, useThree } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { LILY_COIL_QUEST_CHUNK, SURVIVAL_BLOCK_SIZE } from "../../../../store/gameStore";
import { isMobilePerformanceMode } from "../../input/performanceMode";
import { useLazyRef } from "../../react/useLazyRef";
import { getLastKnownLocalPlayerPosition } from "../../player/playerEventBridge";
import { getDarrelPetalNoise } from "../../rendering/textures/textureNoise";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { HIDE_FROM_MINIMAP } from "../vegetation/SurvivalFoliagePrimitives";
import {
  getLilyCoilBladeAlphaTexture,
  getLilyCoilGrassPatchAlphaTexture,
} from "../vegetation/survivalGrassTextures";
import {
  getLilyCoilCallaBloomTexture,
  getLilyCoilMeadowOverlayTexture,
  getLilyCoilTexture,
  useLilyCoilEyeSpriteTexture,
} from "./lilyCoilTextures";
const LILY_COIL_GROUND_Y = 10;
const LILY_COIL_RADIUS = 640;
const LILY_COIL_WALL_HEIGHT = 650;
const LILY_COIL_RAMP_RADIUS = 238;
const LILY_COIL_RAMP_WIDTH = 82;
const LILY_COIL_RAMP_THICKNESS = 1.6;
const LILY_COIL_RAMP_SEGMENTS = 160;
const LILY_COIL_RAMP_TURNS = 3.15;
const LILY_COIL_RAMP_START_ANGLE = -Math.PI / 2;
const LILY_COIL_RAMP_START_Y = 108;
const LILY_COIL_RAMP_RISE = 520;
const LILY_COIL_TUBE_RADIUS = 76;
const LILY_COIL_TUBE_CENTER_OFFSET_Y = 0;

const LILY_COIL_EYE_CAP_RADIUS = LILY_COIL_TUBE_RADIUS + 30;
const LILY_COIL_EYE_CAP_FLORA_CLEAR_T = 0.075;
const LILY_COIL_EYE_CAP_VIEW_CONE = 0.22;
const LILY_COIL_WALL_SEGMENT_COUNT = 36;
const LILY_COIL_CURVE_POINT_COUNT = 120;
const LILY_COIL_HIGHLIGHT_COUNT = 7;
const MOBILE_LILY_COIL_EYE_CAP_UPDATE_INTERVAL_SECONDS = 1 / 16;
const MOBILE_LILY_COIL_TUNNEL_FLORA_UPDATE_INTERVAL_SECONDS = 1 / 24;
const MOBILE_LILY_COIL_GROUND_GLOW_UPDATE_INTERVAL_SECONDS = 1 / 24;

type LilyCoilWallSegment = {
  key: number;
  angle: number;
  x: number;
  z: number;
};

type LilyCoilHighlight = {
  key: number;
  t: number;
  x: number;
  y: number;
  z: number;
};

function isLilyCoilFloraTAllowed(t: number) {
  return t > LILY_COIL_EYE_CAP_FLORA_CLEAR_T && t < 1 - LILY_COIL_EYE_CAP_FLORA_CLEAR_T;
}

function writeLilyCoilViewerWorldPosition(target: THREE.Vector3, cameraPosition: THREE.Vector3) {
  const playerPosition = getLastKnownLocalPlayerPosition();
  if (playerPosition) {
    target.set(playerPosition.x, playerPosition.y, playerPosition.z);
  } else {
    target.copy(cameraPosition);
  }
}

function LilyCoilWallColliders() {
  const arcLength = (Math.PI * 2 * LILY_COIL_RADIUS) / LILY_COIL_WALL_SEGMENT_COUNT;
  const wallSegments = useMemo<LilyCoilWallSegment[]>(() => {
    const segments: LilyCoilWallSegment[] = [];
    for (let index = 0; index < LILY_COIL_WALL_SEGMENT_COUNT; index += 1) {
      const angle = (index / LILY_COIL_WALL_SEGMENT_COUNT) * Math.PI * 2;
      segments.push({
        key: index,
        angle,
        x: Math.cos(angle) * LILY_COIL_RADIUS,
        z: Math.sin(angle) * LILY_COIL_RADIUS,
      });
    }
    return segments;
  }, []);

  return (
    <RigidBody type="fixed" colliders={false} name="lily-coil-cylinder-wall">
      {wallSegments.map((segment) => (
        <CuboidCollider
          key={`lily-coil-wall-collider-${segment.key}`}
          args={[3.2, LILY_COIL_WALL_HEIGHT / 2, arcLength / 2]}
          position={[segment.x, LILY_COIL_GROUND_Y + LILY_COIL_WALL_HEIGHT / 2, segment.z]}
          rotation={[0, -segment.angle, 0]}
        />
      ))}
    </RigidBody>
  );
}

function makeLilyCoilPoint(t: number) {
  const angle = LILY_COIL_RAMP_START_ANGLE + Math.PI * 2 * LILY_COIL_RAMP_TURNS * t;
  return new THREE.Vector3(
    Math.cos(angle) * LILY_COIL_RAMP_RADIUS,
    LILY_COIL_RAMP_START_Y + LILY_COIL_RAMP_RISE * t + LILY_COIL_TUBE_CENTER_OFFSET_Y,
    Math.sin(angle) * LILY_COIL_RAMP_RADIUS,
  );
}

function makeLilyCoilFrame(t: number) {
  const clampedT = THREE.MathUtils.clamp(t, 0, 1);
  const angleRate = Math.PI * 2 * LILY_COIL_RAMP_TURNS;
  const angle = LILY_COIL_RAMP_START_ANGLE + angleRate * clampedT;
  const center = new THREE.Vector3(
    Math.cos(angle) * LILY_COIL_RAMP_RADIUS,
    LILY_COIL_RAMP_START_Y + LILY_COIL_RAMP_RISE * clampedT + LILY_COIL_TUBE_CENTER_OFFSET_Y,
    Math.sin(angle) * LILY_COIL_RAMP_RADIUS,
  );
  const tangent = new THREE.Vector3(
    -Math.sin(angle) * LILY_COIL_RAMP_RADIUS * angleRate,
    LILY_COIL_RAMP_RISE,
    Math.cos(angle) * LILY_COIL_RAMP_RADIUS * angleRate,
  ).normalize();
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(tangent, -tangent.y);
  if (up.lengthSq() < 0.0001) up.set(1, 0, 0);
  up.normalize();
  const side = new THREE.Vector3().crossVectors(tangent, up).normalize();
  return { center, tangent, up, side };
}

function LilyCoilEndEyeCap({
  t,
  glowColor,
}: {
  t: number;
  glowColor: string;
}) {
  const eyeSpriteTexture = useLilyCoilEyeSpriteTexture();
  const visualGroupRef = useRef<THREE.Group | null>(null);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const lastMobileVisibilityUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);
  const viewerWorldPosition = useMemo(() => new THREE.Vector3(), []);
  const endPoints = useMemo(() => ({
    start: makeLilyCoilFrame(0).center,
    end: makeLilyCoilFrame(1).center,
  }), []);
  const cap = useMemo(() => {
    const frame = makeLilyCoilFrame(t);
    const facing = frame.tangent.clone().multiplyScalar(t <= 0 ? 1 : -1).normalize();
    const yAxis = frame.up.clone();
    const xAxis = new THREE.Vector3().crossVectors(yAxis, facing).normalize();
    const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, facing);
    return {
      position: frame.center,
      facing,
      quaternion: new THREE.Quaternion().setFromRotationMatrix(basis),
    };
  }, [t]);

  useFrame(({ camera, clock }) => {
    const time = clock.getElapsedTime();
    if (
      mobilePerformanceMode &&
      time - lastMobileVisibilityUpdateAtRef.current < MOBILE_LILY_COIL_EYE_CAP_UPDATE_INTERVAL_SECONDS
    ) {
      return;
    }
    lastMobileVisibilityUpdateAtRef.current = time;

    const visualGroup = visualGroupRef.current;
    if (!visualGroup) return;

    writeLilyCoilViewerWorldPosition(viewerWorldPosition, camera.position);

    const viewerLocalX = viewerWorldPosition.x - LILY_COIL_QUEST_CHUNK.cx * SURVIVAL_BLOCK_SIZE;
    const viewerLocalZ = viewerWorldPosition.z - LILY_COIL_QUEST_CHUNK.cz * SURVIVAL_BLOCK_SIZE;
    const startDistanceSq =
      (viewerLocalX - endPoints.start.x) ** 2 +
      (viewerWorldPosition.y - endPoints.start.y) ** 2 +
      (viewerLocalZ - endPoints.start.z) ** 2;
    const endDistanceSq =
      (viewerLocalX - endPoints.end.x) ** 2 +
      (viewerWorldPosition.y - endPoints.end.y) ** 2 +
      (viewerLocalZ - endPoints.end.z) ** 2;
    const toViewerX = viewerLocalX - cap.position.x;
    const toViewerY = viewerWorldPosition.y - cap.position.y;
    const toViewerZ = viewerLocalZ - cap.position.z;
    const toViewerLength = Math.sqrt(toViewerX * toViewerX + toViewerY * toViewerY + toViewerZ * toViewerZ) || 1;
    const capFaceAmount = (
      toViewerX * cap.facing.x +
      toViewerY * cap.facing.y +
      toViewerZ * cap.facing.z
    ) / toViewerLength;
    const onCapFaceSide = capFaceAmount > LILY_COIL_EYE_CAP_VIEW_CONE;

    visualGroup.visible = t < 0.5
      ? startDistanceSq <= endDistanceSq && onCapFaceSide
      : endDistanceSq < startDistanceSq && onCapFaceSide;
    visualGroup.quaternion.identity();
  });

  return (
    <group name={`lily-coil-eye-cap-${t}`} position={cap.position.toArray()} quaternion={cap.quaternion}>
      <RigidBody type="fixed" colliders={false} name={`lily-coil-eye-cap-collider-${t}`}>
        <CuboidCollider args={[LILY_COIL_EYE_CAP_RADIUS, LILY_COIL_EYE_CAP_RADIUS, 18]} />
      </RigidBody>
      <group ref={visualGroupRef}>
        <mesh position={[0, 0, 22.05]} renderOrder={2} frustumCulled={false}>
          <circleGeometry args={[LILY_COIL_EYE_CAP_RADIUS * 1.12, 72]} />
          <meshBasicMaterial color="#0d0317" depthWrite depthTest side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 22.12]} renderOrder={3} frustumCulled={false}>
          <ringGeometry args={[LILY_COIL_EYE_CAP_RADIUS * 0.97, LILY_COIL_EYE_CAP_RADIUS * 1.1, 72]} />
          <meshBasicMaterial color="#d8b4fe" transparent opacity={0.9} depthWrite={false} depthTest side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 22.18]} renderOrder={3} frustumCulled={false}>
          <circleGeometry args={[LILY_COIL_EYE_CAP_RADIUS * 1.03, 72]} />
          <meshBasicMaterial map={eyeSpriteTexture} depthTest depthWrite side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 22.24]} scale={[1.08, 1.08, 1]} renderOrder={3} frustumCulled={false}>
          <circleGeometry args={[LILY_COIL_EYE_CAP_RADIUS, 48]} />
          <meshBasicMaterial color={glowColor} transparent opacity={0.08} depthWrite={false} depthTest side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
        <pointLight position={[0, 0, 28]} color={glowColor} intensity={1.35} distance={82} decay={2} />
      </group>
    </group>
  );
}

function LilyCoilEndSolidSeal({ t }: { t: number }) {
  const visualGroupRef = useRef<THREE.Group | null>(null);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const lastMobileVisibilityUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);
  const viewerWorldPosition = useMemo(() => new THREE.Vector3(), []);
  const endPoints = useMemo(() => ({
    start: makeLilyCoilFrame(0).center,
    end: makeLilyCoilFrame(1).center,
  }), []);
  const cap = useMemo(() => {
    const frame = makeLilyCoilFrame(t);
    const facing = frame.tangent.clone().multiplyScalar(t <= 0 ? 1 : -1).normalize();
    const yAxis = frame.up.clone();
    const xAxis = new THREE.Vector3().crossVectors(yAxis, facing).normalize();
    const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, facing);
    return {
      position: frame.center,
      facing,
      quaternion: new THREE.Quaternion().setFromRotationMatrix(basis),
    };
  }, [t]);

  useFrame(({ camera, clock }) => {
    const time = clock.getElapsedTime();
    if (
      mobilePerformanceMode &&
      time - lastMobileVisibilityUpdateAtRef.current < MOBILE_LILY_COIL_EYE_CAP_UPDATE_INTERVAL_SECONDS
    ) {
      return;
    }
    lastMobileVisibilityUpdateAtRef.current = time;

    const visualGroup = visualGroupRef.current;
    if (!visualGroup) return;

    writeLilyCoilViewerWorldPosition(viewerWorldPosition, camera.position);

    const viewerLocalX = viewerWorldPosition.x - LILY_COIL_QUEST_CHUNK.cx * SURVIVAL_BLOCK_SIZE;
    const viewerLocalZ = viewerWorldPosition.z - LILY_COIL_QUEST_CHUNK.cz * SURVIVAL_BLOCK_SIZE;
    const startDistanceSq =
      (viewerLocalX - endPoints.start.x) ** 2 +
      (viewerWorldPosition.y - endPoints.start.y) ** 2 +
      (viewerLocalZ - endPoints.start.z) ** 2;
    const endDistanceSq =
      (viewerLocalX - endPoints.end.x) ** 2 +
      (viewerWorldPosition.y - endPoints.end.y) ** 2 +
      (viewerLocalZ - endPoints.end.z) ** 2;
    const toViewerX = viewerLocalX - cap.position.x;
    const toViewerY = viewerWorldPosition.y - cap.position.y;
    const toViewerZ = viewerLocalZ - cap.position.z;
    const toViewerLength = Math.sqrt(toViewerX * toViewerX + toViewerY * toViewerY + toViewerZ * toViewerZ) || 1;
    const capFaceAmount = (
      toViewerX * cap.facing.x +
      toViewerY * cap.facing.y +
      toViewerZ * cap.facing.z
    ) / toViewerLength;
    const onCapFaceSide = capFaceAmount > LILY_COIL_EYE_CAP_VIEW_CONE;

    visualGroup.visible = t < 0.5
      ? startDistanceSq <= endDistanceSq && onCapFaceSide
      : endDistanceSq < startDistanceSq && onCapFaceSide;
    visualGroup.quaternion.identity();
  });

  return (
    <group name={`lily-coil-solid-end-seal-${t}`} position={cap.position.toArray()} quaternion={cap.quaternion}>
      <RigidBody type="fixed" colliders={false} name={`lily-coil-solid-end-seal-collider-${t}`}>
        <CuboidCollider args={[LILY_COIL_EYE_CAP_RADIUS * 1.08, LILY_COIL_EYE_CAP_RADIUS * 1.08, 22]} />
      </RigidBody>
      <group ref={visualGroupRef}>
        <mesh position={[0, 0, 0]} scale={[LILY_COIL_EYE_CAP_RADIUS * 1.08, LILY_COIL_EYE_CAP_RADIUS * 1.08, 20]} receiveShadow renderOrder={0} frustumCulled={false}>
          <sphereGeometry args={[1, 32, 14]} />
          <meshStandardMaterial color="#12051f" roughness={0.94} emissive="#2e1065" emissiveIntensity={0.34} />
        </mesh>
        <mesh position={[0, 0, 21.5]} renderOrder={1} frustumCulled={false}>
          <circleGeometry args={[LILY_COIL_EYE_CAP_RADIUS * 1.08, 72]} />
          <meshBasicMaterial color="#12051f" depthWrite side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

function LilyCoilSpringBody() {
  const coilCurve = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let index = 0; index < LILY_COIL_CURVE_POINT_COUNT; index += 1) {
      points.push(makeLilyCoilPoint(index / (LILY_COIL_CURVE_POINT_COUNT - 1)));
    }
    return new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.04);
  }, []);
  const tunnelGeometry = useMemo(() => new THREE.TubeGeometry(coilCurve, 144, LILY_COIL_TUBE_RADIUS, 16, false), [coilCurve]);
  const tunnelColliderGeometry = useMemo(() => new THREE.TubeGeometry(coilCurve, 72, LILY_COIL_TUBE_RADIUS, 8, false), [coilCurve]);
  const highlights = useMemo<LilyCoilHighlight[]>(() => {
    const generated: LilyCoilHighlight[] = [];
    for (let index = 0; index < LILY_COIL_HIGHLIGHT_COUNT; index += 1) {
      const t = (index + 0.35) / 7.6;
      const point = makeLilyCoilPoint(t);
      generated.push({
        key: index,
        t,
        x: point.x * 0.985,
        y: point.y + LILY_COIL_TUBE_RADIUS * 0.46,
        z: point.z * 0.985,
      });
    }
    return generated;
  }, []);

  return (
    <group name="lily-coil-hollow-tunnel">
      <RigidBody type="fixed" colliders="trimesh" friction={0.96} restitution={0} name="lily-coil-tunnel-collider">
        <mesh geometry={tunnelColliderGeometry} visible={false} />
      </RigidBody>
      <mesh geometry={tunnelGeometry} receiveShadow renderOrder={-1}>
        <meshStandardMaterial
          color="#7c3aed"
          roughness={0.96}
          metalness={0.02}
          emissive="#4c1d95"
          emissiveIntensity={0.18}
          side={THREE.BackSide}
        />
      </mesh>
      <mesh geometry={tunnelGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          color="#07020d"
          roughness={0.22}
          metalness={0.5}
          emissive="#2e1065"
          emissiveIntensity={0.2}
          side={THREE.FrontSide}
        />
      </mesh>
      <LilyCoilEndSolidSeal t={0} />
      <LilyCoilEndSolidSeal t={1} />
      <LilyCoilEndEyeCap t={0} glowColor="#93c5fd" />
      <LilyCoilEndEyeCap t={1} glowColor="#86efac" />
      {highlights.map((highlight) => (
        <mesh
          key={`lily-coil-highlight-${highlight.key}`}
          position={[highlight.x, highlight.y, highlight.z]}
          scale={[3.4, 0.48, 1.05]}
          rotation={[0.2, -LILY_COIL_RAMP_START_ANGLE - Math.PI * 2 * LILY_COIL_RAMP_TURNS * highlight.t, -0.24]}
          renderOrder={4}
        >
          <sphereGeometry args={[5.2, 10, 6]} />
          <meshBasicMaterial color="#f3e8ff" transparent opacity={0.36} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

type LilyCoilTubeDecor = { t: number; angle: number; yaw: number; scale: number };
type LilyCoilTubeGrassTuft = { t: number; angle: number; yaw: number; radius: number; height: number; width: number; lean: number };
type LilyCoilTubeFlower = LilyCoilTubeDecor & { stemHeight: number; bloomHeight: number; bloomWidth: number; tilt: number };
type LilyCoilBloomParticle = { flowerIndex: number; phase: number; radius: number; speed: number; size: number; height: number };
type LilyCoilFlyingLight = { anchor: number; hop: number; phase: number; speed: number; arc: number; wander: number; size: number };
type LilyCoilTubeAnchor = {
  base: THREE.Vector3;
  growth: THREE.Vector3;
  around: THREE.Vector3;
  widthAxis: THREE.Vector3;
  normal: THREE.Vector3;
  glow: THREE.Vector3;
};
type LilyCoilGroundGrassTuft = { x: number; z: number; yaw: number; height: number; width: number; lean: number };
const LILY_COIL_GROUND_GRASS_BLADES_PER_TUFT = 2;
const LILY_COIL_TUBE_GRASS_BLADES_PER_TUFT = 1;
const LILY_COIL_TUBE_LILY_PETALS = 5;
const LILY_COIL_GROUND_LILY_PETALS = 5;
const LILY_COIL_SMALL_BLOOM_PETALS = 4;

function makeLilyCoilTubeAnchor(t: number, angle: number, yaw: number, radius = LILY_COIL_TUBE_RADIUS - 1.4, glowHeight = 18): LilyCoilTubeAnchor {
  const frame = makeLilyCoilFrame(t);
  const radial = frame.up.clone().multiplyScalar(Math.cos(angle)).addScaledVector(frame.side, Math.sin(angle)).normalize();
  const growth = radial.clone().multiplyScalar(-1);
  const around = frame.up.clone().multiplyScalar(-Math.sin(angle)).addScaledVector(frame.side, Math.cos(angle)).normalize();
  const widthAxis = frame.tangent.clone().multiplyScalar(Math.cos(yaw)).addScaledVector(around, Math.sin(yaw)).normalize();
  const normal = new THREE.Vector3().crossVectors(widthAxis, growth).normalize();
  const base = frame.center.clone().addScaledVector(radial, radius);
  const glow = base.clone().addScaledVector(growth, glowHeight);
  return { base, growth, around, widthAxis, normal, glow };
}

function LilyCoilForegroundMeadow() {
  const { camera } = useThree();
  const nearRef = useRef<THREE.Mesh>(null);
  const farRef = useRef<THREE.Mesh>(null);
  const meadowTexture = useMemo(() => getLilyCoilMeadowOverlayTexture(), []);
  const viewRight = useMemo(() => new THREE.Vector3(), []);
  const viewUp = useMemo(() => new THREE.Vector3(), []);
  const cameraForward = useMemo(() => new THREE.Vector3(), []);
  const worldPosition = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    viewRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    viewUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    cameraForward.setFromMatrixColumn(camera.matrixWorld, 2).multiplyScalar(-1).normalize();

    const updateLayer = (
      mesh: THREE.Mesh | null,
      distance: number,
      down: number,
      width: number,
      height: number,
    ) => {
      if (!mesh) return;
      worldPosition
        .copy(camera.position)
        .addScaledVector(cameraForward, distance)
        .addScaledVector(viewUp, -down)
        .addScaledVector(viewRight, 0);
      mesh.position.copy(mesh.parent ? mesh.parent.worldToLocal(worldPosition) : worldPosition);
      mesh.quaternion.copy(camera.quaternion);
      mesh.scale.set(width, height, 1);
      mesh.frustumCulled = false;
    };

    updateLayer(farRef.current, 17.5, 3.45, 35, 9.2);
    updateLayer(nearRef.current, 8.5, 3.05, 22, 6.2);
  });

  return (
    <group name="lily-coil-foreground-meadow" userData={HIDE_FROM_MINIMAP}>
      <mesh ref={farRef} renderOrder={8} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={meadowTexture}
          transparent
          opacity={0.68}
          depthTest={false}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={nearRef} renderOrder={9} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={meadowTexture}
          transparent
          opacity={0.84}
          depthTest={false}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function LilyCoilTunnelFlora() {
  const grassRefs = useLazyRef<Array<THREE.InstancedMesh | null>>(() => []);
  const grassUniformsRef = useLazyRef<Array<{ uTime: THREE.IUniform<number> } | null>>(() => []);
  const lilyRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const flowerStemRef = useRef<THREE.InstancedMesh>(null);
  const flowerBloomRef = useRef<THREE.InstancedMesh>(null);
  const flowerBloomGlowRef = useRef<THREE.InstancedMesh>(null);
  const smallFlowerStemRef = useRef<THREE.InstancedMesh>(null);
  const smallFlowerBloomRef = useRef<THREE.InstancedMesh>(null);
  const smallFlowerBloomGlowRef = useRef<THREE.InstancedMesh>(null);
  const smallFlowerParticleRef = useRef<THREE.InstancedMesh>(null);
  const smallFlowerParticleGlowRef = useRef<THREE.InstancedMesh>(null);
  const fireflyRef = useRef<THREE.InstancedMesh>(null);
  const fireflyGlowRef = useRef<THREE.InstancedMesh>(null);
  const butterflyLeftWingRef = useRef<THREE.InstancedMesh>(null);
  const butterflyRightWingRef = useRef<THREE.InstancedMesh>(null);
  const butterflyBodyRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const basis = useMemo(() => new THREE.Matrix4(), []);
  const motionTemp = useMemo(() => ({
    position: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(),
  }), []);
  const floraUploadScratch = useMemo(() => ({
    radial: new THREE.Vector3(),
    inward: new THREE.Vector3(),
    around: new THREE.Vector3(),
    base: new THREE.Vector3(),
    widthAxis: new THREE.Vector3(),
    windLean: new THREE.Vector3(),
    growth: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    lilyCenter: new THREE.Vector3(),
  }), []);
  const grassPatchAlphaTexture = useMemo(() => getLilyCoilGrassPatchAlphaTexture(), []);
  const callaBloomTexture = useMemo(() => getLilyCoilCallaBloomTexture(), []);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const lastMobileVisualUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);
  const grassGroups = useMemo<LilyCoilTubeGrassTuft[][]>(() => {
    const groups: LilyCoilTubeGrassTuft[][] = [[], [], []];
    const longitudinalSegments = mobilePerformanceMode ? 180 : 300;
    const ringSegments = mobilePerformanceMode ? 40 : 56;
    for (let tIndex = 0; tIndex < longitudinalSegments; tIndex += 1) {
      for (let angleIndex = 0; angleIndex < ringSegments; angleIndex += 1) {
        const seed = tIndex * 997 + angleIndex * 37;
        const tone = (tIndex + angleIndex) % groups.length;
        const tJitter = (getDarrelPetalNoise(seed, 191) - 0.5) * 0.72;
        const angleJitter = (getDarrelPetalNoise(seed, 192) - 0.5) * 0.82;
        const t = THREE.MathUtils.clamp((tIndex + 0.5 + tJitter) / longitudinalSegments, 0.012, 0.988);
        if (!isLilyCoilFloraTAllowed(t)) continue;
        groups[tone].push({
          t,
          angle: ((angleIndex + 0.5 + angleJitter) / ringSegments) * Math.PI * 2,
          yaw: 0,
          radius: LILY_COIL_TUBE_RADIUS - 0.8,
          height: 5.5 + getDarrelPetalNoise(seed, 194) * 4.5,
          width: 10 + getDarrelPetalNoise(seed, 195) * 7,
          lean: 0.04 + getDarrelPetalNoise(seed, 196) * 0.1,
        });
      }
    }
    return groups;
  }, [mobilePerformanceMode]);
  const lilies = useMemo<LilyCoilTubeDecor[]>(() => {
    const generated: LilyCoilTubeDecor[] = [];
    const count = mobilePerformanceMode ? 520 : 1500;
    for (let index = 0; index < count; index += 1) {
      const t = 0.018 + getDarrelPetalNoise(index, 91) * 0.964;
      if (!isLilyCoilFloraTAllowed(t)) continue;
      generated.push({
        t,
        angle: getDarrelPetalNoise(index, 92) * Math.PI * 2,
        yaw: getDarrelPetalNoise(index, 93) * Math.PI * 2,
        scale: 0.78 + getDarrelPetalNoise(index, 94) * 1.35,
      });
    }
    return generated;
  }, [mobilePerformanceMode]);
  const flowers = useMemo<LilyCoilTubeFlower[]>(() => {
    const generated: LilyCoilTubeFlower[] = [];
    const count = mobilePerformanceMode ? 80 : 200;
    for (let index = 0; index < count; index += 1) {
      const scale = 0.82 + getDarrelPetalNoise(index, 681) * 0.7;
      const t = 0.026 + getDarrelPetalNoise(index, 682) * 0.948;
      if (!isLilyCoilFloraTAllowed(t)) continue;
      generated.push({
        t,
        angle: getDarrelPetalNoise(index, 683) * Math.PI * 2,
        yaw: getDarrelPetalNoise(index, 684) * Math.PI * 2,
        scale,
        stemHeight: (14 + getDarrelPetalNoise(index, 685) * 5.5) * scale,
        bloomHeight: (9.5 + getDarrelPetalNoise(index, 686) * 4) * scale,
        bloomWidth: (7 + getDarrelPetalNoise(index, 687) * 3.5) * scale,
        tilt: (getDarrelPetalNoise(index, 688) - 0.5) * 0.5,
      });
    }
    return generated;
  }, [mobilePerformanceMode]);
  const flowerAnchors = useMemo<LilyCoilTubeAnchor[]>(() => {
    const anchors: LilyCoilTubeAnchor[] = [];
    for (let index = 0; index < flowers.length; index += 1) {
      const flower = flowers[index];
      anchors.push(makeLilyCoilTubeAnchor(
        flower.t,
        flower.angle,
        flower.yaw,
        LILY_COIL_TUBE_RADIUS - 1.8,
        flower.stemHeight + flower.bloomHeight * 0.44,
      ));
    }
    return anchors;
  }, [flowers]);
  const smallFlowers = useMemo<LilyCoilTubeFlower[]>(() => {
    const generated: LilyCoilTubeFlower[] = [];
    const showcaseCount = mobilePerformanceMode ? 12 : 18;
    for (let index = 0; index < showcaseCount; index += 1) {
      const row = Math.floor(index / 3);
      const column = index % 3;
      const scale = 0.62 + getDarrelPetalNoise(index, 756) * 0.2;
      const t = 0.112 + row * 0.0075;
      if (isLilyCoilFloraTAllowed(t)) {
        generated.push({
          t,
          angle: Math.PI + (column - 1) * 0.34 + (getDarrelPetalNoise(index, 757) - 0.5) * 0.08,
          yaw: getDarrelPetalNoise(index, 758) * Math.PI * 2,
          scale,
          stemHeight: (9.2 + getDarrelPetalNoise(index, 759) * 3.2) * scale,
          bloomHeight: (4.8 + getDarrelPetalNoise(index, 760) * 1.8) * scale,
          bloomWidth: (3.8 + getDarrelPetalNoise(index, 761) * 1.7) * scale,
          tilt: (getDarrelPetalNoise(index, 762) - 0.5) * 0.48,
        });
      }
    }
    const scatteredCount = mobilePerformanceMode ? 90 : 260;
    for (let index = 0; index < scatteredCount; index += 1) {
      const scale = 0.56 + getDarrelPetalNoise(index, 761) * 0.28;
      const t = 0.028 + getDarrelPetalNoise(index, 762) * 0.944;
      if (!isLilyCoilFloraTAllowed(t)) continue;
      generated.push({
        t,
        angle: getDarrelPetalNoise(index, 763) * Math.PI * 2,
        yaw: getDarrelPetalNoise(index, 764) * Math.PI * 2,
        scale,
        stemHeight: (8.8 + getDarrelPetalNoise(index, 765) * 3.4) * scale,
        bloomHeight: (4.4 + getDarrelPetalNoise(index, 766) * 1.8) * scale,
        bloomWidth: (3.6 + getDarrelPetalNoise(index, 767) * 1.7) * scale,
        tilt: (getDarrelPetalNoise(index, 768) - 0.5) * 0.62,
      });
    }
    return generated;
  }, [mobilePerformanceMode]);
  const smallFlowerAnchors = useMemo<LilyCoilTubeAnchor[]>(() => {
    const anchors: LilyCoilTubeAnchor[] = [];
    for (let index = 0; index < smallFlowers.length; index += 1) {
      const flower = smallFlowers[index];
      anchors.push(makeLilyCoilTubeAnchor(
        flower.t,
        flower.angle,
        flower.yaw,
        LILY_COIL_TUBE_RADIUS - 1.6,
        flower.stemHeight + flower.bloomHeight * 0.56,
      ));
    }
    return anchors;
  }, [smallFlowers]);
  const smallFlowerParticles = useMemo<LilyCoilBloomParticle[]>(() => {
    const particlesPerFlower = mobilePerformanceMode ? 2 : 3;
    const generated: LilyCoilBloomParticle[] = [];
    const count = smallFlowers.length * particlesPerFlower;
    const divisor = Math.max(1, smallFlowers.length);
    for (let index = 0; index < count; index += 1) {
      const flowerIndex = index % divisor;
      generated.push({
        flowerIndex,
        phase: getDarrelPetalNoise(index, 781) * Math.PI * 2,
        radius: 1.2 + getDarrelPetalNoise(index, 782) * 2.1,
        speed: 0.34 + getDarrelPetalNoise(index, 783) * 0.28,
        size: 0.18 + getDarrelPetalNoise(index, 784) * 0.22,
        height: (getDarrelPetalNoise(index, 785) - 0.5) * 2.4,
      });
    }
    return generated;
  }, [mobilePerformanceMode, smallFlowers.length]);
  const fireflies = useMemo<LilyCoilFlyingLight[]>(() => {
    const generated: LilyCoilFlyingLight[] = [];
    const count = mobilePerformanceMode ? 70 : 160;
    const anchorCount = Math.max(1, flowers.length);
    for (let index = 0; index < count; index += 1) {
      generated.push({
        anchor: Math.floor(getDarrelPetalNoise(index, 701) * anchorCount),
        hop: 5 + Math.floor(getDarrelPetalNoise(index, 702) * 23),
        phase: getDarrelPetalNoise(index, 703) * 48,
        speed: 0.055 + getDarrelPetalNoise(index, 704) * 0.13,
        arc: 3.5 + getDarrelPetalNoise(index, 705) * 7,
        wander: 1.1 + getDarrelPetalNoise(index, 706) * 2.6,
        size: 0.68 + getDarrelPetalNoise(index, 707) * 0.72,
      });
    }
    return generated;
  }, [flowers.length, mobilePerformanceMode]);
  const butterflies = useMemo<LilyCoilFlyingLight[]>(() => {
    const generated: LilyCoilFlyingLight[] = [];
    const count = mobilePerformanceMode ? 4 : 10;
    const anchorCount = Math.max(1, flowers.length);
    for (let index = 0; index < count; index += 1) {
      generated.push({
        anchor: Math.floor(getDarrelPetalNoise(index, 721) * anchorCount),
        hop: 13 + Math.floor(getDarrelPetalNoise(index, 722) * 39),
        phase: getDarrelPetalNoise(index, 723) * 40,
        speed: 0.055 + getDarrelPetalNoise(index, 724) * 0.09,
        arc: 9 + getDarrelPetalNoise(index, 725) * 15,
        wander: 3.2 + getDarrelPetalNoise(index, 726) * 5,
        size: 1.08 + getDarrelPetalNoise(index, 727) * 0.82,
      });
    }
    return generated;
  }, [flowers.length, mobilePerformanceMode]);

  useFrame(({ clock, camera }) => {
    const time = clock.getElapsedTime();
    if (
      mobilePerformanceMode &&
      time - lastMobileVisualUpdateAtRef.current < MOBILE_LILY_COIL_TUNNEL_FLORA_UPDATE_INTERVAL_SECONDS
    ) {
      return;
    }
    lastMobileVisualUpdateAtRef.current = time;

    for (let index = 0; index < grassUniformsRef.current.length; index += 1) {
      const uniforms = grassUniformsRef.current[index];
      if (!uniforms) continue;
      uniforms.uTime.value = time + index * 0.37;
    }

    const smallFlowerCount = smallFlowerAnchors.length;
    if (smallFlowerCount > 0) {
      const particleMesh = smallFlowerParticleRef.current;
      const particleGlowMesh = smallFlowerParticleGlowRef.current;
      for (let index = 0; index < smallFlowerParticles.length; index += 1) {
        const particle = smallFlowerParticles[index];
        const anchor = smallFlowerAnchors[particle.flowerIndex % smallFlowerCount];
        const orbit = time * particle.speed + particle.phase;
        dummy.position
          .copy(anchor.glow)
          .addScaledVector(anchor.widthAxis, Math.cos(orbit) * particle.radius)
          .addScaledVector(anchor.normal, Math.sin(orbit * 0.86) * particle.radius * 0.72)
          .addScaledVector(anchor.growth, particle.height + Math.sin(time * 1.7 + particle.phase) * 0.72);
        dummy.quaternion.identity();
        const sparkle = 0.76 + Math.sin(time * 4.6 + particle.phase) * 0.24;
        dummy.scale.setScalar(particle.size * sparkle);
        dummy.updateMatrix();
        particleMesh?.setMatrixAt(index, dummy.matrix);
        dummy.scale.setScalar(particle.size * (2 + sparkle * 1.45));
        dummy.updateMatrix();
        particleGlowMesh?.setMatrixAt(index, dummy.matrix);
      }
      if (particleMesh) {
        particleMesh.count = smallFlowerParticles.length;
        particleMesh.instanceMatrix.needsUpdate = true;
        particleMesh.frustumCulled = false;
      }
      if (particleGlowMesh) {
        particleGlowMesh.count = smallFlowerParticles.length;
        particleGlowMesh.instanceMatrix.needsUpdate = true;
        particleGlowMesh.frustumCulled = false;
      }
    }

    const flowerCount = flowerAnchors.length;
    if (flowerCount > 1) {
      const fireflyMesh = fireflyRef.current;
      const fireflyGlowMesh = fireflyGlowRef.current;
      for (let index = 0; index < fireflies.length; index += 1) {
        const fly = fireflies[index];
        const route = time * fly.speed + fly.phase;
        const step = Math.floor(route);
        const amount = THREE.MathUtils.smoothstep(route - step, 0, 1);
        const from = flowerAnchors[(fly.anchor + step * fly.hop) % flowerCount];
        const to = flowerAnchors[(fly.anchor + (step + 1) * fly.hop) % flowerCount];
        dummy.position.copy(from.glow).lerp(to.glow, amount);
        dummy.position
          .addScaledVector(from.growth, Math.sin(amount * Math.PI) * fly.arc)
          .addScaledVector(from.widthAxis, Math.sin(time * 2.7 + fly.phase) * fly.wander)
          .addScaledVector(from.normal, Math.cos(time * 2.1 + fly.phase * 1.7) * fly.wander * 0.55);
        dummy.quaternion.identity();
        const pulse = 0.72 + Math.sin(time * 5.8 + fly.phase) * 0.22;
        dummy.scale.setScalar(fly.size * pulse);
        dummy.updateMatrix();
        fireflyMesh?.setMatrixAt(index, dummy.matrix);
        const blink = Math.pow(Math.max(0, Math.sin(time * 1.35 + fly.phase * 2.1)), 8);
        const blinkSize = blink > 0.035 ? fly.size * (3.2 + blink * 9.5) : 0.001;
        dummy.scale.setScalar(blinkSize);
        dummy.updateMatrix();
        fireflyGlowMesh?.setMatrixAt(index, dummy.matrix);
      }
      if (fireflyMesh) {
        fireflyMesh.count = fireflies.length;
        fireflyMesh.instanceMatrix.needsUpdate = true;
        fireflyMesh.frustumCulled = false;
      }
      if (fireflyGlowMesh) {
        fireflyGlowMesh.count = fireflies.length;
        fireflyGlowMesh.instanceMatrix.needsUpdate = true;
        fireflyGlowMesh.frustumCulled = false;
      }

      motionTemp.right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
      motionTemp.up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
      const leftWingMesh = butterflyLeftWingRef.current;
      const rightWingMesh = butterflyRightWingRef.current;
      const bodyMesh = butterflyBodyRef.current;
      for (let index = 0; index < butterflies.length; index += 1) {
        const butterfly = butterflies[index];
        const route = time * butterfly.speed + butterfly.phase;
        const step = Math.floor(route);
        const amount = THREE.MathUtils.smoothstep(route - step, 0, 1);
        const from = flowerAnchors[(butterfly.anchor + step * butterfly.hop) % flowerCount];
        const to = flowerAnchors[(butterfly.anchor + (step + 1) * butterfly.hop) % flowerCount];
        motionTemp.position.copy(from.glow).lerp(to.glow, amount);
        motionTemp.position
          .addScaledVector(from.growth, Math.sin(amount * Math.PI) * butterfly.arc)
          .addScaledVector(from.widthAxis, Math.sin(time * 1.3 + butterfly.phase) * butterfly.wander)
          .addScaledVector(from.normal, Math.cos(time * 1.7 + butterfly.phase) * butterfly.wander * 0.75);
        const flap = Math.sin(time * (7.5 + index * 0.17) + butterfly.phase);
        const wingSpread = butterfly.size * (0.82 + Math.abs(flap) * 0.32);
        if (leftWingMesh) {
          dummy.position.copy(motionTemp.position).addScaledVector(motionTemp.right, -wingSpread * 1.15);
          dummy.quaternion.copy(camera.quaternion);
          dummy.rotateZ(-0.35 - Math.abs(flap) * 0.52);
          dummy.scale.set(butterfly.size * 1.25, butterfly.size * 1.85, 1);
          dummy.updateMatrix();
          leftWingMesh.setMatrixAt(index, dummy.matrix);
        }
        if (rightWingMesh) {
          dummy.position.copy(motionTemp.position).addScaledVector(motionTemp.right, wingSpread * 1.15);
          dummy.quaternion.copy(camera.quaternion);
          dummy.rotateZ(0.35 + Math.abs(flap) * 0.52);
          dummy.scale.set(butterfly.size * 1.25, butterfly.size * 1.85, 1);
          dummy.updateMatrix();
          rightWingMesh.setMatrixAt(index, dummy.matrix);
        }
        if (bodyMesh) {
          dummy.position.copy(motionTemp.position);
          dummy.quaternion.copy(camera.quaternion);
          dummy.scale.set(butterfly.size * 0.2, butterfly.size * 0.72, butterfly.size * 0.2);
          dummy.updateMatrix();
          bodyMesh.setMatrixAt(index, dummy.matrix);
        }
      }
      if (leftWingMesh) {
        leftWingMesh.count = butterflies.length;
        leftWingMesh.instanceMatrix.needsUpdate = true;
        leftWingMesh.frustumCulled = false;
      }
      if (rightWingMesh) {
        rightWingMesh.count = butterflies.length;
        rightWingMesh.instanceMatrix.needsUpdate = true;
        rightWingMesh.frustumCulled = false;
      }
      if (bodyMesh) {
        bodyMesh.count = butterflies.length;
        bodyMesh.instanceMatrix.needsUpdate = true;
        bodyMesh.frustumCulled = false;
      }
    }
  });

  useEffect(() => {
    const {
      radial,
      inward,
      around,
      base,
      widthAxis,
      windLean,
      growth,
      normal,
      lilyCenter,
    } = floraUploadScratch;

    for (let groupIndex = 0; groupIndex < grassGroups.length; groupIndex += 1) {
      const grass = grassGroups[groupIndex];
      const grassMesh = grassRefs.current[groupIndex];
      if (!grassMesh) {
        continue;
      }
      for (let index = 0; index < grass.length; index += 1) {
        const tuft = grass[index];
        const frame = makeLilyCoilFrame(tuft.t);
        radial.copy(frame.up).multiplyScalar(Math.cos(tuft.angle)).addScaledVector(frame.side, Math.sin(tuft.angle)).normalize();
        inward.copy(radial).multiplyScalar(-1);
        around.copy(frame.up).multiplyScalar(-Math.sin(tuft.angle)).addScaledVector(frame.side, Math.cos(tuft.angle)).normalize();
        base.copy(frame.center).addScaledVector(radial, tuft.radius);
        for (let bladeIndex = 0; bladeIndex < LILY_COIL_TUBE_GRASS_BLADES_PER_TUFT; bladeIndex += 1) {
          const bladeYaw = tuft.yaw;
          widthAxis.copy(frame.tangent).multiplyScalar(Math.cos(bladeYaw)).addScaledVector(around, Math.sin(bladeYaw)).normalize();
          windLean.copy(around)
            .multiplyScalar(Math.sin(bladeYaw) * tuft.lean)
            .addScaledVector(frame.tangent, Math.cos(bladeYaw) * tuft.lean * 0.62);
          growth.copy(inward).add(windLean).normalize();
          normal.crossVectors(widthAxis, growth).normalize();
          basis.makeBasis(widthAxis, growth, normal);
          const height = tuft.height * (0.86 + getDarrelPetalNoise(index, 211 + bladeIndex) * 0.34);
          const width = tuft.width * (0.82 + getDarrelPetalNoise(index, 221 + bladeIndex) * 0.36);
          const instanceIndex = index * LILY_COIL_TUBE_GRASS_BLADES_PER_TUFT + bladeIndex;
          dummy.position
            .copy(base)
            .addScaledVector(widthAxis, (getDarrelPetalNoise(index, 231 + bladeIndex) - 0.5) * 2.6)
            .addScaledVector(growth, height * 0.5);
          dummy.quaternion.setFromRotationMatrix(basis);
          dummy.scale.set(width, height, width * 0.28);
          dummy.updateMatrix();
          grassMesh.setMatrixAt(instanceIndex, dummy.matrix);
        }
      }
      grassMesh.count = grass.length * LILY_COIL_TUBE_GRASS_BLADES_PER_TUFT;
      grassMesh.instanceMatrix.needsUpdate = true;
      grassMesh.frustumCulled = false;
    }

    const lilyMesh = lilyRef.current;
    const glowMesh = glowRef.current;
    for (let index = 0; index < lilies.length; index += 1) {
      const lily = lilies[index];
      const frame = makeLilyCoilFrame(lily.t);
      radial.copy(frame.up).multiplyScalar(Math.cos(lily.angle)).addScaledVector(frame.side, Math.sin(lily.angle)).normalize();
      inward.copy(radial).multiplyScalar(-1);
      around.crossVectors(frame.tangent, inward).normalize();
      basis.makeBasis(frame.tangent, around, inward);
      lilyCenter.copy(frame.center).addScaledVector(radial, LILY_COIL_TUBE_RADIUS - 2.1);
      for (let petalIndex = 0; petalIndex < LILY_COIL_TUBE_LILY_PETALS; petalIndex += 1) {
        const petalAngle = lily.yaw + (petalIndex / LILY_COIL_TUBE_LILY_PETALS) * Math.PI * 2 + (index % 3) * 0.13;
        const petalOffset = lily.scale * 0.42;
        dummy.position
          .copy(lilyCenter)
          .addScaledVector(frame.tangent, Math.cos(petalAngle) * petalOffset)
          .addScaledVector(around, Math.sin(petalAngle) * petalOffset);
        dummy.quaternion.setFromRotationMatrix(basis);
        dummy.rotateZ(petalAngle);
        dummy.scale.set(lily.scale * 0.18, lily.scale * 0.36, 1);
        dummy.updateMatrix();
        lilyMesh?.setMatrixAt(index * LILY_COIL_TUBE_LILY_PETALS + petalIndex, dummy.matrix);
      }
      dummy.position.copy(lilyCenter);
      dummy.quaternion.setFromRotationMatrix(basis);
      dummy.rotateZ(lily.yaw);
      dummy.scale.set(lily.scale * 2.1, lily.scale * 2.1, 1);
      dummy.updateMatrix();
      glowMesh?.setMatrixAt(index, dummy.matrix);
    }
    const flowerStemMesh = flowerStemRef.current;
    const flowerBloomMesh = flowerBloomRef.current;
    const flowerBloomGlowMesh = flowerBloomGlowRef.current;
    const smallFlowerStemMesh = smallFlowerStemRef.current;
    const smallFlowerBloomMesh = smallFlowerBloomRef.current;
    const smallFlowerBloomGlowMesh = smallFlowerBloomGlowRef.current;
    for (let index = 0; index < flowers.length; index += 1) {
      const flower = flowers[index];
      const anchor = flowerAnchors[index];
      if (!anchor) {
        continue;
      }
      basis.makeBasis(anchor.widthAxis, anchor.growth, anchor.normal);
      dummy.quaternion.setFromRotationMatrix(basis);
      dummy.position.copy(anchor.base).addScaledVector(anchor.growth, flower.stemHeight * 0.5);
      dummy.scale.set(0.34 * flower.scale, flower.stemHeight, 0.34 * flower.scale);
      dummy.updateMatrix();
      flowerStemMesh?.setMatrixAt(index, dummy.matrix);

      dummy.quaternion.setFromRotationMatrix(basis);
      dummy.rotateZ(flower.tilt);
      dummy.position.copy(anchor.base).addScaledVector(anchor.growth, flower.stemHeight + flower.bloomHeight * 0.48);
      dummy.scale.set(flower.bloomWidth, flower.bloomHeight, 1);
      dummy.updateMatrix();
      flowerBloomMesh?.setMatrixAt(index, dummy.matrix);

      dummy.quaternion.setFromRotationMatrix(basis);
      dummy.position.copy(anchor.glow);
      dummy.scale.set(flower.bloomWidth * 0.72, flower.bloomHeight * 0.42, 1);
      dummy.updateMatrix();
      flowerBloomGlowMesh?.setMatrixAt(index, dummy.matrix);
    }
    for (let index = 0; index < smallFlowers.length; index += 1) {
      const flower = smallFlowers[index];
      const anchor = smallFlowerAnchors[index];
      if (!anchor) {
        continue;
      }
      basis.makeBasis(anchor.widthAxis, anchor.growth, anchor.normal);
      dummy.quaternion.setFromRotationMatrix(basis);
      dummy.position.copy(anchor.base).addScaledVector(anchor.growth, flower.stemHeight * 0.5);
      dummy.scale.set(0.12 * flower.scale, flower.stemHeight, 0.12 * flower.scale);
      dummy.updateMatrix();
      smallFlowerStemMesh?.setMatrixAt(index, dummy.matrix);

      for (let petalIndex = 0; petalIndex < LILY_COIL_SMALL_BLOOM_PETALS; petalIndex += 1) {
        const petalAngle = flower.yaw + (petalIndex / LILY_COIL_SMALL_BLOOM_PETALS) * Math.PI * 2 + flower.tilt;
        const petalOffset = flower.bloomWidth * 0.34;
        dummy.quaternion.setFromRotationMatrix(basis);
        dummy.rotateZ(petalAngle);
        dummy.position
          .copy(anchor.glow)
          .addScaledVector(anchor.widthAxis, Math.cos(petalAngle) * petalOffset)
          .addScaledVector(anchor.growth, Math.sin(petalAngle) * petalOffset * 0.7);
        dummy.scale.set(flower.bloomWidth * 0.36, flower.bloomHeight * 0.27, 1);
        dummy.updateMatrix();
        smallFlowerBloomMesh?.setMatrixAt(index * LILY_COIL_SMALL_BLOOM_PETALS + petalIndex, dummy.matrix);
      }

      dummy.quaternion.setFromRotationMatrix(basis);
      dummy.position.copy(anchor.glow);
      dummy.scale.set(flower.bloomWidth * 0.48, flower.bloomHeight * 0.38, 1);
      dummy.updateMatrix();
      smallFlowerBloomGlowMesh?.setMatrixAt(index, dummy.matrix);
    }
    if (flowerStemMesh) {
      flowerStemMesh.count = flowers.length;
      flowerStemMesh.instanceMatrix.needsUpdate = true;
      flowerStemMesh.frustumCulled = false;
    }
    if (flowerBloomMesh) {
      flowerBloomMesh.count = flowers.length;
      flowerBloomMesh.instanceMatrix.needsUpdate = true;
      flowerBloomMesh.frustumCulled = false;
    }
    if (flowerBloomGlowMesh) {
      flowerBloomGlowMesh.count = flowers.length;
      flowerBloomGlowMesh.instanceMatrix.needsUpdate = true;
      flowerBloomGlowMesh.frustumCulled = false;
    }
    if (smallFlowerStemMesh) {
      smallFlowerStemMesh.count = smallFlowers.length;
      smallFlowerStemMesh.instanceMatrix.needsUpdate = true;
      smallFlowerStemMesh.frustumCulled = false;
    }
    if (smallFlowerBloomMesh) {
      smallFlowerBloomMesh.count = smallFlowers.length * LILY_COIL_SMALL_BLOOM_PETALS;
      smallFlowerBloomMesh.instanceMatrix.needsUpdate = true;
      smallFlowerBloomMesh.frustumCulled = false;
    }
    if (smallFlowerBloomGlowMesh) {
      smallFlowerBloomGlowMesh.count = smallFlowers.length;
      smallFlowerBloomGlowMesh.instanceMatrix.needsUpdate = true;
      smallFlowerBloomGlowMesh.frustumCulled = false;
    }
    if (lilyMesh) {
      lilyMesh.count = lilies.length * LILY_COIL_TUBE_LILY_PETALS;
      lilyMesh.instanceMatrix.needsUpdate = true;
      lilyMesh.frustumCulled = false;
    }
    if (glowMesh) {
      glowMesh.count = lilies.length;
      glowMesh.instanceMatrix.needsUpdate = true;
      glowMesh.frustumCulled = false;
    }
  }, [basis, dummy, floraUploadScratch, flowerAnchors, flowers, grassGroups, lilies, smallFlowerAnchors, smallFlowers]);

  const callaLightAnchors = useMemo(() => {
    const maxLights = mobilePerformanceMode ? 4 : 8;
    const items: LilyCoilTubeAnchor[] = [];
    for (let index = 0; index < flowerAnchors.length && items.length < maxLights; index += 36) {
      items.push(flowerAnchors[index]);
    }
    return items;
  }, [flowerAnchors, mobilePerformanceMode]);

  const tubeLilyLights = useMemo(() => {
    const items: LilyCoilTubeDecor[] = [];
    for (let index = 0; index < lilies.length && items.length < 5; index += 360) {
      items.push(lilies[index]);
    }
    return items;
  }, [lilies]);
  const tubeLilyLightPositions = useMemo(() => {
    const positions: Array<[number, number, number]> = [];
    const radial = new THREE.Vector3();
    const position = new THREE.Vector3();
    for (let index = 0; index < tubeLilyLights.length; index += 1) {
      const lily = tubeLilyLights[index];
      const frame = makeLilyCoilFrame(lily.t);
      radial.copy(frame.up).multiplyScalar(Math.cos(lily.angle)).addScaledVector(frame.side, Math.sin(lily.angle)).normalize();
      position.copy(frame.center).addScaledVector(radial, LILY_COIL_TUBE_RADIUS - 8);
      positions.push([position.x, position.y, position.z]);
    }
    return positions;
  }, [tubeLilyLights]);

  return (
    <group name="lily-coil-tunnel-flora" userData={HIDE_FROM_MINIMAP}>
      {grassGroups.map((grass, groupIndex) => {
        const colors = ["#4c1d95", "#7c3aed", "#a78bfa"];
        return (
          <instancedMesh
            key={`lily-coil-tube-grass-${groupIndex}`}
            ref={(mesh) => {
              grassRefs.current[groupIndex] = mesh;
            }}
            args={[undefined, undefined, grass.length * LILY_COIL_TUBE_GRASS_BLADES_PER_TUFT]}
            renderOrder={4}
            frustumCulled={false}
          >
            <planeGeometry args={[1, 1, 1, 3]} />
            <meshBasicMaterial
              onBeforeCompile={(shader) => {
                const uTime: THREE.IUniform<number> = { value: 0 };
                shader.uniforms.uTime = uTime;
                shader.vertexShader = `uniform float uTime;\n${shader.vertexShader.replace(
                  "#include <begin_vertex>",
                  `#include <begin_vertex>
                  float lilyBladeMask = smoothstep(-0.5, 0.5, position.y);
                  float lilyWindSeed = position.x * 6.0;
                  #ifdef USE_INSTANCING
                    lilyWindSeed += instanceMatrix[3].x * 0.031 + instanceMatrix[3].y * 0.017 + instanceMatrix[3].z * 0.027;
                  #endif
                  float lilyWind = sin(uTime * 1.65 + lilyWindSeed) + sin(uTime * 2.35 + lilyWindSeed * 1.73) * 0.42;
                  transformed.x += lilyWind * lilyBladeMask * lilyBladeMask * 0.18;
                  transformed.z += cos(uTime * 1.2 + lilyWindSeed) * lilyBladeMask * 0.04;`,
                )}`;
                grassUniformsRef.current[groupIndex] = { uTime };
              }}
              alphaMap={grassPatchAlphaTexture}
              alphaTest={0.14}
              color={colors[groupIndex]}
              depthWrite
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </instancedMesh>
        );
      })}
      <instancedMesh ref={flowerStemRef} args={[undefined, undefined, flowers.length]} renderOrder={5} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 5, 1]} />
        <meshStandardMaterial color="#a3c96a" roughness={0.72} emissive="#65a30d" emissiveIntensity={0.28} />
      </instancedMesh>
      <instancedMesh ref={flowerBloomGlowRef} args={[undefined, undefined, flowers.length]} renderOrder={7} frustumCulled={false}>
        <circleGeometry args={[1, 12]} />
        <meshBasicMaterial color="#fff7ad" transparent opacity={0.28} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={flowerBloomRef} args={[undefined, undefined, flowers.length]} renderOrder={8} frustumCulled={false}>
        <planeGeometry args={[1, 1, 3, 5]} />
        <meshBasicMaterial map={callaBloomTexture} transparent alphaTest={0.06} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={smallFlowerStemRef} args={[undefined, undefined, smallFlowers.length]} renderOrder={5} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 5, 1]} />
        <meshStandardMaterial color="#6f9a55" roughness={0.78} emissive="#365314" emissiveIntensity={0.16} />
      </instancedMesh>
      <instancedMesh ref={smallFlowerBloomGlowRef} args={[undefined, undefined, smallFlowers.length]} renderOrder={7} frustumCulled={false}>
        <circleGeometry args={[1, 12]} />
        <meshBasicMaterial color="#f5d0fe" transparent opacity={0.15} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={smallFlowerBloomRef} args={[undefined, undefined, smallFlowers.length * LILY_COIL_SMALL_BLOOM_PETALS]} renderOrder={8} frustumCulled={false}>
        <circleGeometry args={[1, 10]} />
        <meshBasicMaterial color="#f0abfc" transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </instancedMesh>
      {callaLightAnchors.map((anchor, index) => (
        <pointLight key={`lily-coil-calla-light-${index}`} position={anchor.glow.toArray()} color={index % 3 === 0 ? "#fde68a" : "#f0abfc"} intensity={0.82} distance={42} decay={2.1} />
      ))}
      <instancedMesh ref={glowRef} args={[undefined, undefined, lilies.length]} renderOrder={5} frustumCulled={false}>
        <circleGeometry args={[1, 10]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.16} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={lilyRef} args={[undefined, undefined, lilies.length * LILY_COIL_TUBE_LILY_PETALS]} renderOrder={6} frustumCulled={false}>
        <circleGeometry args={[1, 8]} />
        <meshStandardMaterial color="#fffaf0" roughness={0.34} emissive="#ffffff" emissiveIntensity={1.9} side={THREE.DoubleSide} transparent opacity={0.88} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={smallFlowerParticleGlowRef} args={[undefined, undefined, smallFlowerParticles.length]} renderOrder={9} frustumCulled={false}>
        <sphereGeometry args={[1, 7, 4]} />
        <meshBasicMaterial color="#f0abfc" transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={smallFlowerParticleRef} args={[undefined, undefined, smallFlowerParticles.length]} renderOrder={10} frustumCulled={false}>
        <sphereGeometry args={[1, 6, 4]} />
        <meshBasicMaterial color="#fff7ed" transparent opacity={0.88} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={fireflyGlowRef} args={[undefined, undefined, fireflies.length]} renderOrder={10} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 5]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.42} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={fireflyRef} args={[undefined, undefined, fireflies.length]} renderOrder={11} frustumCulled={false}>
        <sphereGeometry args={[1, 6, 4]} />
        <meshBasicMaterial color="#fef9c3" transparent opacity={1} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={butterflyLeftWingRef} args={[undefined, undefined, butterflies.length]} renderOrder={12} frustumCulled={false}>
        <circleGeometry args={[1, 9]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.62} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={butterflyRightWingRef} args={[undefined, undefined, butterflies.length]} renderOrder={12} frustumCulled={false}>
        <circleGeometry args={[1, 9]} />
        <meshBasicMaterial color="#f0abfc" transparent opacity={0.58} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={butterflyBodyRef} args={[undefined, undefined, butterflies.length]} renderOrder={13} frustumCulled={false}>
        <sphereGeometry args={[1, 6, 4]} />
        <meshBasicMaterial color="#ecfeff" transparent opacity={0.72} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
      {tubeLilyLightPositions.map((position, index) => (
        <pointLight key={`lily-coil-tube-lily-light-${index}`} position={position} color="#f8fafc" intensity={1.18} distance={68} decay={2} />
      ))}
    </group>
  );
}

function LilyCoilSpiralRamp() {
  return (
    <group name="lily-coil-tunnel-interior-detail">
      <LilyCoilTunnelFlora />
    </group>
  );
}

function LilyCoilGroundFlora() {
  const grassRef = useRef<THREE.InstancedMesh>(null);
  const lilyRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const glowMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const bladeAlphaTexture = useMemo(() => getLilyCoilBladeAlphaTexture(), []);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const lastMobileGlowUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);
  const grass = useMemo(() => {
    const items: LilyCoilGroundGrassTuft[] = [];
    const count = mobilePerformanceMode ? 1800 : 5200;
    for (let index = 0; index < count; index += 1) {
      const radius = 4 + Math.pow(getDarrelPetalNoise(index, 11), 1.95) * (LILY_COIL_RADIUS - 46);
      const angle = getDarrelPetalNoise(index, 12) * Math.PI * 2;
      items.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        yaw: getDarrelPetalNoise(index, 13) * Math.PI * 2,
        height: 16 + getDarrelPetalNoise(index, 14) * 22,
        width: 0.35 + getDarrelPetalNoise(index, 15) * 0.65,
        lean: 0.22 + getDarrelPetalNoise(index, 16) * 0.42,
      });
    }
    return items;
  }, [mobilePerformanceMode]);
  const lilies = useMemo(() => {
    const items: Array<{ x: number; z: number; yaw: number; scale: number }> = [];
    const count = mobilePerformanceMode ? 220 : 560;
    for (let index = 0; index < count; index += 1) {
      const radius = 20 + Math.sqrt(getDarrelPetalNoise(index, 31)) * (LILY_COIL_RADIUS - 50);
      const angle = getDarrelPetalNoise(index, 32) * Math.PI * 2;
      items.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        yaw: getDarrelPetalNoise(index, 33) * Math.PI * 2,
        scale: 0.85 + getDarrelPetalNoise(index, 34) * 1.85,
      });
    }
    return items;
  }, [mobilePerformanceMode]);

  useEffect(() => {
    const grassMesh = grassRef.current;
    if (grassMesh) {
      for (let index = 0; index < grass.length; index += 1) {
        const blade = grass[index];
        for (let bladeIndex = 0; bladeIndex < LILY_COIL_GROUND_GRASS_BLADES_PER_TUFT; bladeIndex += 1) {
          const instanceIndex = index * LILY_COIL_GROUND_GRASS_BLADES_PER_TUFT + bladeIndex;
          const yaw = blade.yaw + (bladeIndex / LILY_COIL_GROUND_GRASS_BLADES_PER_TUFT) * Math.PI * 2 + (index % 4) * 0.11;
          const height = blade.height * (0.78 + getDarrelPetalNoise(index, 58 + bladeIndex) * 0.44);
          const width = blade.width * (0.62 + getDarrelPetalNoise(index, 64 + bladeIndex) * 0.42);
          const spread = 0.44 + getDarrelPetalNoise(index, 70 + bladeIndex) * 1.24;
          dummy.position.set(
            blade.x + Math.cos(yaw) * spread,
            LILY_COIL_GROUND_Y + height / 2,
            blade.z + Math.sin(yaw) * spread,
          );
          dummy.rotation.set(
            blade.lean + (getDarrelPetalNoise(index, 76 + bladeIndex) - 0.5) * 0.42,
            yaw,
            Math.sin(yaw) * 0.16,
          );
          dummy.scale.set(width, height, 1);
          dummy.updateMatrix();
          grassMesh.setMatrixAt(instanceIndex, dummy.matrix);
        }
      }
      grassMesh.count = grass.length * LILY_COIL_GROUND_GRASS_BLADES_PER_TUFT;
      grassMesh.instanceMatrix.needsUpdate = true;
      grassMesh.frustumCulled = false;
    }

    const lilyMesh = lilyRef.current;
    const glowMesh = glowRef.current;
    for (let index = 0; index < lilies.length; index += 1) {
      const lily = lilies[index];
      const lilyY = LILY_COIL_GROUND_Y + 0.18 + (index % 5) * 0.012;
      for (let petalIndex = 0; petalIndex < LILY_COIL_GROUND_LILY_PETALS; petalIndex += 1) {
        const petalAngle = lily.yaw + (petalIndex / LILY_COIL_GROUND_LILY_PETALS) * Math.PI * 2 + (index % 4) * 0.11;
        const petalOffset = lily.scale * 0.42;
        dummy.position.set(
          lily.x + Math.cos(petalAngle) * petalOffset,
          lilyY,
          lily.z + Math.sin(petalAngle) * petalOffset,
        );
        dummy.rotation.set(-Math.PI / 2, 0, petalAngle);
        dummy.scale.set(lily.scale * 0.26, lily.scale * 0.5, 1);
        dummy.updateMatrix();
        lilyMesh?.setMatrixAt(index * LILY_COIL_GROUND_LILY_PETALS + petalIndex, dummy.matrix);
      }

      dummy.position.set(lily.x, lilyY + 0.02, lily.z);
      dummy.rotation.set(-Math.PI / 2, 0, lily.yaw);
      dummy.scale.set(lily.scale * 1.9, lily.scale * 1.9, 1);
      dummy.updateMatrix();
      glowMesh?.setMatrixAt(index, dummy.matrix);
    }
    if (lilyMesh) {
      lilyMesh.count = lilies.length * LILY_COIL_GROUND_LILY_PETALS;
      lilyMesh.instanceMatrix.needsUpdate = true;
      lilyMesh.frustumCulled = false;
    }
    if (glowMesh) {
      glowMesh.count = lilies.length;
      glowMesh.instanceMatrix.needsUpdate = true;
      glowMesh.frustumCulled = false;
    }
  }, [dummy, grass, lilies]);

  useFrame(({ clock }) => {
    if (
      mobilePerformanceMode &&
      clock.elapsedTime - lastMobileGlowUpdateAtRef.current < MOBILE_LILY_COIL_GROUND_GLOW_UPDATE_INTERVAL_SECONDS
    ) {
      return;
    }
    lastMobileGlowUpdateAtRef.current = clock.elapsedTime;

    if (glowMaterialRef.current) {
      glowMaterialRef.current.opacity = 0.22 + Math.sin(clock.elapsedTime * 1.8) * 0.07;
    }
  });

  const lilyLights = useMemo(() => {
    const items: Array<{ x: number; z: number; yaw: number; scale: number }> = [];
    for (let index = 0; index < lilies.length && items.length < 4; index += 112) {
      items.push(lilies[index]);
    }
    return items;
  }, [lilies]);

  return (
    <group name="lily-coil-ground-flora" userData={HIDE_FROM_MINIMAP}>
      <instancedMesh ref={grassRef} args={[undefined, undefined, grass.length * LILY_COIL_GROUND_GRASS_BLADES_PER_TUFT]} renderOrder={7} frustumCulled={false}>
        <planeGeometry args={[1, 1, 1, 3]} />
        <meshBasicMaterial
          alphaMap={bladeAlphaTexture}
          alphaTest={0.16}
          color="#8b5cf6"
          transparent
          opacity={0.78}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh ref={glowRef} args={[undefined, undefined, lilies.length]} renderOrder={5} frustumCulled={false}>
        <circleGeometry args={[1, 10]} />
        <meshBasicMaterial ref={glowMaterialRef} color="#ffffff" transparent opacity={0.2} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={lilyRef} args={[undefined, undefined, lilies.length * LILY_COIL_GROUND_LILY_PETALS]} renderOrder={6} frustumCulled={false}>
        <circleGeometry args={[1, 8]} />
        <meshStandardMaterial color="#fff7ed" roughness={0.38} emissive="#ffffff" emissiveIntensity={1.55} side={THREE.DoubleSide} />
      </instancedMesh>
      {lilyLights.map((lily, index) => (
        <pointLight key={`lily-coil-lily-light-${index}`} position={[lily.x, LILY_COIL_GROUND_Y + 2.4, lily.z]} color="#f8fafc" intensity={0.85} distance={34} decay={2} />
      ))}
    </group>
  );
}

export function SurvivalLilyCoil({ chunk }: { chunk: SurvivalChunkInfo }) {
  const stoneTexture = useMemo(() => getLilyCoilTexture("stone"), []);
  const grassTexture = useMemo(() => getLilyCoilTexture("grass"), []);

  return (
    <group name={`survival-lily-coil-${chunk.key}`}>
      <RigidBody type="fixed" colliders={false} name="lily-coil-ground">
        <CuboidCollider args={[LILY_COIL_RADIUS, 1, LILY_COIL_RADIUS]} position={[chunk.x, LILY_COIL_GROUND_Y - 1, chunk.z]} />
      </RigidBody>
      <group position={[chunk.x, 0, chunk.z]}>
        <mesh position={[0, LILY_COIL_GROUND_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[LILY_COIL_RADIUS - 5, 96]} />
          <meshStandardMaterial map={grassTexture} color="#a78bfa" roughness={0.95} emissive="#3b0764" emissiveIntensity={0.16} />
        </mesh>
        <mesh position={[0, LILY_COIL_GROUND_Y + 0.04, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
          <torusGeometry args={[LILY_COIL_RADIUS - 5, 1.8, 8, 96]} />
          <meshStandardMaterial map={stoneTexture} color="#4c1d95" roughness={0.82} emissive="#4c1d95" emissiveIntensity={0.28} transparent opacity={0.54} />
        </mesh>
        <LilyCoilGroundFlora />
        <LilyCoilWallColliders />
        <LilyCoilSpringBody />
        <LilyCoilSpiralRamp />
        <pointLight position={[0, LILY_COIL_GROUND_Y + 34, 0]} color="#c084fc" intensity={3.2} distance={230} decay={1.35} />
        <pointLight position={[0, LILY_COIL_GROUND_Y + 118, 0]} color="#ffffff" intensity={1.8} distance={190} decay={1.6} />
        <ambientLight color="#8b5cf6" intensity={0.28} />
      </group>
    </group>
  );
}


