import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Projectile, useGameStore } from "../../../store/gameStore";
import {
  dispatchReleaseGrabPlayer,
  getPublishedLocalPlayerPosition,
} from "../player/playerEventBridge";
import { getCachedIndexRange } from "../rendering/indexRange";
import {
  createCylinderBetweenScratch,
  getPlayerAimDirectionInto,
  getProjectileHand,
  setCylinderBetween,
} from "./spellProjectileMath";
import { isLocalProjectileCreator } from "./spellProjectileOwnership";
import {
  GRAB_MAX_REACH,
  GRAB_TARGET_RADIUS,
} from "./spellProjectileTuning";

const GRAB_ARM_SEGMENTS = 7;
const GRAB_FINGER_OFFSETS = [-0.42, -0.2, 0.02, 0.24, 0.44] as const;
const UNIT_Z = new THREE.Vector3(0, 0, 1);
const WORLD_UP = new THREE.Vector3(0, 1, 0);

function makeGrabPathPoints(): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let index = 0; index <= GRAB_ARM_SEGMENTS; index += 1) {
    points.push(new THREE.Vector3());
  }
  return points;
}

const GRAB_ARM_INDICES = getCachedIndexRange(GRAB_ARM_SEGMENTS);
const GRAB_FINGER_INDICES = getCachedIndexRange(GRAB_FINGER_OFFSETS.length);

function useLazyRef<T>(factory: () => T): MutableRefObject<T> {
  const ref = useRef<T | null>(null);
  if (ref.current === null) ref.current = factory();
  return ref as MutableRefObject<T>;
}

export function GrabSpell({ projectile }: { projectile: Projectile }) {
  const isRelease = projectile.grabPhase === "release";
  if (isRelease) return <GrabReleaseEffect projectile={projectile} />;
  return <ActiveGrabSpell projectile={projectile} />;
}

function GrabReleaseEffect({ projectile }: { projectile: Projectile }) {
  const removeProjectile = useGameStore(s => s.removeProjectile);

  useEffect(() => {
    dispatchReleaseGrabPlayer({
      casterId: projectile.creatorId,
      grabId: projectile.grabId,
      dir: projectile.dir,
      origin: projectile.pos,
    });
    if (projectile.grabId) {
      removeProjectile(projectile.grabId);
    }
    removeProjectile(projectile.id);
  }, [projectile.creatorId, projectile.dir, projectile.grabId, projectile.id, projectile.pos, removeProjectile]);

  return null;
}

function ActiveGrabSpell({ projectile }: { projectile: Projectile }) {
  const removeProjectile = useGameStore(s => s.removeProjectile);
  const isMyProjectile = isLocalProjectileCreator(projectile);
  const startPos = useLazyRef(() => new THREE.Vector3(projectile.pos.x, projectile.pos.y, projectile.pos.z));
  const dirRef = useLazyRef(() => new THREE.Vector3(projectile.dir.x, projectile.dir.y, projectile.dir.z).normalize());
  const lengthRef = useRef(0);
  const hitLocalPlayerRef = useRef(false);
  const armSegmentRefs = useLazyRef<Array<THREE.Mesh | null>>(() => []);
  const coreSegmentRefs = useLazyRef<Array<THREE.Mesh | null>>(() => []);
  const palmRef = useRef<THREE.Mesh>(null);
  const fingerRefs = useLazyRef<Array<THREE.Mesh | null>>(() => []);
  const targetPointScratch = useLazyRef(() => new THREE.Vector3());
  const toPointScratch = useLazyRef(() => new THREE.Vector3());
  const closestPointScratch = useLazyRef(() => new THREE.Vector3());
  const cameraDirScratch = useLazyRef(() => new THREE.Vector3());
  const lateralScratch = useLazyRef(() => new THREE.Vector3());
  const casterStartScratch = useLazyRef(() => new THREE.Vector3());
  const casterAimScratch = useLazyRef(() => new THREE.Vector3());
  const playerPointScratch = useLazyRef(() => new THREE.Vector3());
  const lineScratch = useLazyRef(() => new THREE.Vector3());
  const sideScratch = useLazyRef(() => new THREE.Vector3());
  const upScratch = useLazyRef(() => new THREE.Vector3());
  const pathPoints = useMemo(makeGrabPathPoints, []);
  const cylinderScratch = useLazyRef(() => createCylinderBetweenScratch());
  const fingerBaseScratch = useLazyRef(() => new THREE.Vector3());
  const fingerTipScratch = useLazyRef(() => new THREE.Vector3());

  const getAimedTargetDistance = () => {
    let nearestDistance = GRAB_MAX_REACH;
    const targetRadiusSq = GRAB_TARGET_RADIUS * GRAB_TARGET_RADIUS;
    const checkPoint = (x: number, y: number, z: number) => {
      const point = targetPointScratch.current.set(x, y, z);
      const toPoint = toPointScratch.current.copy(point).sub(startPos.current);
      const projectedDistance = toPoint.dot(dirRef.current);
      if (projectedDistance <= 1.5 || projectedDistance >= nearestDistance) return;

      const closest = closestPointScratch.current.copy(startPos.current).addScaledVector(dirRef.current, projectedDistance);
      if (point.distanceToSquared(closest) <= targetRadiusSq) {
        nearestDistance = projectedDistance;
      }
    };

    const players = useGameStore.getState().players;
    for (const playerId in players) {
      const player = players[playerId];
      if (playerId === projectile.creatorId || !player || player.health <= 0) continue;
      checkPoint(player.pos[0], player.pos[1] + 0.85, player.pos[2]);
    }

    if (!isMyProjectile) {
      const localPos = getPublishedLocalPlayerPosition();
      if (localPos) {
        checkPoint(localPos.x, localPos.y + 0.85, localPos.z);
      }
    }

    return nearestDistance;
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      removeProjectile(projectile.id);
    }, 6200);
    return () => window.clearTimeout(timeout);
  }, [projectile.id, removeProjectile]);

  useFrame((state, delta) => {
    if (isMyProjectile) {
      const d = cameraDirScratch.current;
      state.camera.getWorldDirection(d);
      dirRef.current.copy(d.normalize());

      const lateral = lateralScratch.current.crossVectors(state.camera.up, dirRef.current).normalize();
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
        const targetStart = casterStartScratch.current.set(caster.pos[0], caster.pos[1] + 1.1, caster.pos[2]);
        startPos.current.lerp(targetStart, 0.35);
        const liveAimDir = getPlayerAimDirectionInto(caster, casterAimScratch.current);
        dirRef.current.lerp(liveAimDir, 0.45).normalize();
      }
    }

    const aimedTargetDistance = getAimedTargetDistance();
    const visualTargetDistance = aimedTargetDistance < GRAB_MAX_REACH
      ? Math.max(2.5, aimedTargetDistance - 1.05)
      : GRAB_MAX_REACH;
    lengthRef.current = THREE.MathUtils.damp(lengthRef.current, visualTargetDistance, 18, delta);

    if (!isMyProjectile && !hitLocalPlayerRef.current) {
      const localPos = getPublishedLocalPlayerPosition();
      if (localPos) {
        const playerPoint = playerPointScratch.current.set(localPos.x, localPos.y + 0.8, localPos.z);
        const line = lineScratch.current.copy(dirRef.current).multiplyScalar(lengthRef.current);
        const lineLenSq = line.lengthSq();
        if (lineLenSq > 0) {
          const t = THREE.MathUtils.clamp(toPointScratch.current.copy(playerPoint).sub(startPos.current).dot(line) / lineLenSq, 0, 1);
          const closest = closestPointScratch.current.copy(startPos.current).addScaledVector(line, t);
          if (playerPoint.distanceToSquared(closest) < GRAB_TARGET_RADIUS * GRAB_TARGET_RADIUS) {
            const grabDistance = toPointScratch.current.copy(playerPoint).sub(startPos.current).dot(dirRef.current);
            hitLocalPlayerRef.current = true;
            window.dispatchEvent(new CustomEvent("grabPlayer", {
              detail: {
                casterId: projectile.creatorId,
                grabId: projectile.grabId ?? projectile.id,
                dir: { x: dirRef.current.x, y: dirRef.current.y, z: dirRef.current.z },
                origin: { x: startPos.current.x, y: startPos.current.y, z: startPos.current.z },
                distance: grabDistance,
              },
            }));
          }
        }
      }
    }

    const side = sideScratch.current.crossVectors(WORLD_UP, dirRef.current);
    if (side.lengthSq() < 0.001) side.set(1, 0, 0);
    side.normalize();
    const up = upScratch.current.crossVectors(dirRef.current, side).normalize();
    const bend = Math.min(4.6, lengthRef.current * 0.12);
    const wobble = Math.sin(state.clock.elapsedTime * 3.2) * 0.18;
    for (let index = 0; index <= GRAB_ARM_SEGMENTS; index += 1) {
      const t = index / GRAB_ARM_SEGMENTS;
      const eased = t * t * (3 - 2 * t);
      pathPoints[index]
        .copy(startPos.current)
        .addScaledVector(dirRef.current, lengthRef.current * t)
        .addScaledVector(side, Math.sin(eased * Math.PI) * (bend + wobble))
        .addScaledVector(up, Math.sin(t * Math.PI) * bend * 0.24 - t * 0.35);
    }
    const palmCenter = pathPoints[pathPoints.length - 1];

    for (let index = 0; index < GRAB_ARM_SEGMENTS; index += 1) {
      const point = pathPoints[index];
      const nextPoint = pathPoints[index + 1];
      const t = index / Math.max(1, GRAB_ARM_SEGMENTS - 1);
      setCylinderBetween(armSegmentRefs.current[index], point, nextPoint, THREE.MathUtils.lerp(0.62, 0.78, t), cylinderScratch.current);
      setCylinderBetween(coreSegmentRefs.current[index], point, nextPoint, THREE.MathUtils.lerp(0.22, 0.34, t), cylinderScratch.current);
    }

    if (palmRef.current) {
      palmRef.current.position.copy(palmCenter);
      palmRef.current.quaternion.setFromUnitVectors(UNIT_Z, dirRef.current);
      palmRef.current.scale.set(1.45, 0.95, 1.6);
    }

    for (let index = 0; index < GRAB_FINGER_OFFSETS.length; index += 1) {
      const offset = GRAB_FINGER_OFFSETS[index];
      const isThumb = index === 4;
      const base = fingerBaseScratch.current
        .copy(palmCenter)
        .addScaledVector(side, isThumb ? -0.78 : offset)
        .addScaledVector(up, isThumb ? -0.44 : 0.18);
      const tip = fingerTipScratch.current
        .copy(base)
        .addScaledVector(dirRef.current, isThumb ? 0.6 : 1.05)
        .addScaledVector(side, isThumb ? -0.7 : offset * 0.55)
        .addScaledVector(up, isThumb ? -0.28 : 0.42 - index * 0.11 + Math.sin(state.clock.elapsedTime * 5 + index) * 0.06);

      setCylinderBetween(fingerRefs.current[index], base, tip, isThumb ? 0.22 : 0.18, cylinderScratch.current);
    }
  });

  return (
    <group>
      {GRAB_ARM_INDICES.map((index) => (
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
      {GRAB_FINGER_INDICES.map((index) => (
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
