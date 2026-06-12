import * as THREE from "three";
import { getCachedIndexRange } from "../../rendering/indexRange";
import { getMountainMineshaftWallDecorDescriptors } from "./mountainVillageMineshaftWallDecorRuntime";

const MOUNTAIN_MINESHAFT_PAINTING_PIN_XS = [-2.56, 2.56] as const;

function MountainMineshaftVillagerFigure({
  x,
  y,
  scale = 1,
  bodyColor,
  hatColor,
}: {
  x: number;
  y: number;
  scale?: number;
  bodyColor: string;
  hatColor: string;
}) {
  const z = -0.36;

  return (
    <group position={[x, y, z]} scale={[scale, scale, 1]}>
      <mesh position={[0, 0.74, 0]} castShadow={false}>
        <boxGeometry args={[0.46, 0.42, 0.08]} />
        <meshBasicMaterial color="#c88d68" />
      </mesh>
      <mesh position={[0, 0.28, 0.02]} castShadow={false}>
        <boxGeometry args={[0.58, 0.74, 0.08]} />
        <meshBasicMaterial color={bodyColor} />
      </mesh>
      <mesh position={[-0.4, 0.28, 0.02]} castShadow={false}>
        <boxGeometry args={[0.18, 0.58, 0.08]} />
        <meshBasicMaterial color="#3a2415" />
      </mesh>
      <mesh position={[0.4, 0.28, 0.02]} castShadow={false}>
        <boxGeometry args={[0.18, 0.58, 0.08]} />
        <meshBasicMaterial color="#3a2415" />
      </mesh>
      <mesh position={[0, 1.06, 0.03]} castShadow={false}>
        <boxGeometry args={[0.72, 0.22, 0.08]} />
        <meshBasicMaterial color={hatColor} />
      </mesh>
      <mesh position={[0, 1.24, 0.04]} castShadow={false}>
        <boxGeometry args={[0.46, 0.28, 0.08]} />
        <meshBasicMaterial color={hatColor} />
      </mesh>
      <mesh position={[-0.1, 0.82, 0.06]} castShadow={false}>
        <boxGeometry args={[0.08, 0.08, 0.06]} />
        <meshBasicMaterial color="#090604" />
      </mesh>
      <mesh position={[0.14, 0.82, 0.06]} castShadow={false}>
        <boxGeometry args={[0.08, 0.08, 0.06]} />
        <meshBasicMaterial color="#090604" />
      </mesh>
    </group>
  );
}

export function MountainMineshaftVillagerPainting({
  variant,
}: {
  variant: number;
}) {
  const frameColor = variant % 2 === 0 ? "#5c3a20" : "#2e1d12";
  const canvasColor = ["#263345", "#473328", "#2f4638", "#3b2d4f"][variant % 4];
  const floorColor = ["#6d4a2e", "#4e3826", "#3f4f37", "#7b5730"][variant % 4];
  const moon = variant % 3 === 0;
  const groupScene = variant % 2 === 0;

  return (
    <group name="villager-wall-painting">
      <mesh castShadow={false}>
        <boxGeometry args={[6.8, 4.92, 0.28]} />
        <meshBasicMaterial color="#0b0705" />
      </mesh>
      <mesh position={[0, 0, -0.08]} castShadow={false}>
        <boxGeometry args={[6.28, 4.42, 0.18]} />
        <meshBasicMaterial color={frameColor} />
      </mesh>
      <mesh position={[0, 0, -0.2]} castShadow={false}>
        <boxGeometry args={[5.38, 3.48, 0.12]} />
        <meshBasicMaterial color={canvasColor} />
      </mesh>
      <mesh position={[0, -1.18, -0.29]} castShadow={false}>
        <boxGeometry args={[5.42, 1.1, 0.08]} />
        <meshBasicMaterial color={floorColor} />
      </mesh>
      <mesh position={[moon ? -1.92 : 1.78, 1.08, -0.31]} castShadow={false}>
        <boxGeometry args={[0.64, 0.64, 0.08]} />
        <meshBasicMaterial color={moon ? "#f4e5b0" : "#ffb347"} transparent opacity={0.9} />
      </mesh>
      {groupScene ? (
        <>
          <MountainMineshaftVillagerFigure x={-1.55} y={-0.78} scale={0.94} bodyColor="#8e1e24" hatColor="#d7a548" />
          <MountainMineshaftVillagerFigure x={0} y={-0.72} scale={1.08} bodyColor="#3a6b78" hatColor="#6f4528" />
          <MountainMineshaftVillagerFigure x={1.48} y={-0.82} scale={0.88} bodyColor="#5c6f35" hatColor="#a67642" />
        </>
      ) : (
        <>
          <MountainMineshaftVillagerFigure x={-0.72} y={-0.88} scale={1.22} bodyColor="#6d4a8e" hatColor="#d7a548" />
          <mesh position={[1.28, -0.34, -0.34]} castShadow={false}>
            <boxGeometry args={[0.82, 1.94, 0.08]} />
            <meshBasicMaterial color="#2a1a10" />
          </mesh>
          <mesh position={[1.28, 0.7, -0.32]} castShadow={false}>
            <boxGeometry args={[1.24, 0.34, 0.08]} />
            <meshBasicMaterial color="#d7a548" />
          </mesh>
          <mesh position={[1.28, 1.0, -0.3]} castShadow={false}>
            <boxGeometry args={[0.74, 0.58, 0.08]} />
            <meshBasicMaterial color="#9f2428" />
          </mesh>
        </>
      )}
      {MOUNTAIN_MINESHAFT_PAINTING_PIN_XS.map((x) => (
        <mesh key={`painting-pin-${x}`} position={[x, 1.82, -0.38]} castShadow={false}>
          <boxGeometry args={[0.22, 0.22, 0.08]} />
          <meshBasicMaterial color="#d7a548" />
        </mesh>
      ))}
      {getCachedIndexRange(4).map((index) => (
        <mesh key={`painting-highlight-${index}`} position={[-2.1 + index * 1.35, 1.54 - (index % 2) * 0.36, -0.36]} castShadow={false}>
          <boxGeometry args={[0.92, 0.08, 0.06]} />
          <meshBasicMaterial color="#f6e2a8" transparent opacity={0.26} />
        </mesh>
      ))}
    </group>
  );
}

export function MountainMineshaftWallPaintings({
  bottomY,
  summitY,
  showDetails,
}: {
  bottomY: number;
  summitY: number;
  showDetails: boolean;
}) {
  if (!showDetails) return null;

  const { paintings } = getMountainMineshaftWallDecorDescriptors({ bottomY, summitY });

  return (
    <group name="mineshaft-villager-wall-paintings">
      {paintings.map((painting) => (
        <group key={`villager-painting-${painting.index}`} position={painting.position} rotation={painting.rotation}>
          <MountainMineshaftVillagerPainting variant={painting.variant} />
        </group>
      ))}
    </group>
  );
}

export function MountainMineshaftWallRopeLights({
  bottomY,
  summitY,
  showDetails,
}: {
  bottomY: number;
  summitY: number;
  showDetails: boolean;
}) {
  if (!showDetails) return null;

  const { ropeLights } = getMountainMineshaftWallDecorDescriptors({ bottomY, summitY });

  return (
    <group name="mineshaft-wall-rope-lights">
      {ropeLights.map((light) => (
        <group key={light.key} position={light.position} rotation={light.rotation}>
          <mesh position={[0, 0, -0.14]} castShadow={false}>
            <boxGeometry args={[2.08 * light.bulbScale, 0.24 * light.bulbScale, 0.16]} />
            <meshBasicMaterial color="#160d08" />
          </mesh>
          <mesh position={[-0.66 * light.bulbScale, 0, -0.18]} castShadow={false}>
            <boxGeometry args={[0.22 * light.bulbScale, 0.36 * light.bulbScale, 0.18]} />
            <meshBasicMaterial color="#4f321f" />
          </mesh>
          <mesh position={[0.66 * light.bulbScale, 0, -0.18]} castShadow={false}>
            <boxGeometry args={[0.22 * light.bulbScale, 0.36 * light.bulbScale, 0.18]} />
            <meshBasicMaterial color="#4f321f" />
          </mesh>
          <mesh position={[0, 0, -0.28]} castShadow={false} renderOrder={9}>
            <boxGeometry args={[0.92 * light.bulbScale, 0.92 * light.bulbScale, 0.1]} />
            <meshBasicMaterial color={light.glowColor} transparent opacity={0.96} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, -0.36]} castShadow={false} renderOrder={8}>
            <boxGeometry args={[2.75 * light.bulbScale, 2.75 * light.bulbScale, 0.04]} />
            <meshBasicMaterial color={light.glowColor} transparent opacity={0.28} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, -0.42]} castShadow={false} renderOrder={7}>
            <boxGeometry args={[4.1 * light.bulbScale, 4.1 * light.bulbScale, 0.035]} />
            <meshBasicMaterial color={light.glowColor} transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          {light.hasLight && <pointLight color={light.glowColor} intensity={3.6} distance={20} decay={2} position={[0, 0, -1.1]} />}
        </group>
      ))}
    </group>
  );
}
