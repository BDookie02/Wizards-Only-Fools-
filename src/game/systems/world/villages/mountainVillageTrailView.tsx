import * as THREE from "three";
import { getCachedIndexRange } from "../../rendering/indexRange";
import type {
  MountainVillageTrailSegment,
  MountainVillageTrailSupport,
} from "./mountainVillageLayoutRuntime";
import { RetroVerticalTimberDetails } from "./mountainVillageWoodDetails";

const MOUNTAIN_TRAIL_RENDER_SIDES = [-1, 1] as const;

export function MountainVillageTrailView({
  trailSegments,
  trailDeckGeometry,
  trailTopGeometry,
  showDetails,
}: {
  trailSegments: MountainVillageTrailSegment[];
  trailDeckGeometry: THREE.BufferGeometry;
  trailTopGeometry: THREE.BufferGeometry;
  showDetails: boolean;
}) {
  const supports: MountainVillageTrailSupport[] = [];
  if (showDetails) {
    for (let segmentIndex = 0; segmentIndex < trailSegments.length; segmentIndex += 1) {
      const segmentSupports = trailSegments[segmentIndex].supports;
      for (let supportIndex = 0; supportIndex < segmentSupports.length; supportIndex += 1) {
        supports.push(segmentSupports[supportIndex]);
      }
    }
  }

  return (
    <group name="mountain-village-wrapping-trail">
      <mesh geometry={trailDeckGeometry} castShadow={false} receiveShadow dispose={null}>
        <meshBasicMaterial color="#4b3827" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={trailTopGeometry} castShadow={false} receiveShadow dispose={null} renderOrder={2}>
        <meshBasicMaterial color="#74613f" side={THREE.DoubleSide} />
      </mesh>
      {trailSegments.map((segment) => {
        const hasLanding = showDetails && (segment.index === 0 || segment.index === trailSegments.length - 1);
        const landingLength = Math.min(22, segment.length * 0.72);
        const landingZ = segment.index === 0 ? -segment.length * 0.28 : segment.length * 0.28;

        return (
          <group key={segment.key} position={[segment.localX, segment.y, segment.localZ]} rotation={[segment.slope, segment.yaw, 0]}>
            <mesh position={[-segment.width / 2 + 0.94, -0.72, 0]} castShadow={false}>
              <boxGeometry args={[1.24, 0.54, segment.length * 1.02]} />
              <meshBasicMaterial color="#2f2117" />
            </mesh>
            <mesh position={[segment.width / 2 - 0.94, -0.72, 0]} castShadow={false}>
              <boxGeometry args={[1.24, 0.54, segment.length * 1.02]} />
              <meshBasicMaterial color="#2f2117" />
            </mesh>
            {showDetails && (
              <>
                {hasLanding && (
                  <mesh position={[0, -0.96, landingZ]} castShadow={false}>
                    <boxGeometry args={[segment.width * 1.08, 0.42, landingLength * 0.84]} />
                    <meshBasicMaterial color="#3a2719" />
                  </mesh>
                )}
                {MOUNTAIN_TRAIL_RENDER_SIDES.map((side) => (
                  <mesh key={`trail-top-shadow-${side}`} position={[side * (segment.width / 2 - 0.52), 0.08, 0]} castShadow={false}>
                    <boxGeometry args={[0.42, 0.08, segment.length * 0.92]} />
                    <meshBasicMaterial color="#120c08" transparent opacity={0.5} />
                  </mesh>
                ))}
                {getCachedIndexRange(4).map((plankIndex) => {
                  const z = -segment.length * 0.38 + plankIndex * ((segment.length * 0.76) / 3);

                  return (
                    <mesh key={`trail-cross-shadow-${plankIndex}`} position={[0, 0.1, z]} castShadow={false}>
                      <boxGeometry args={[segment.width * 0.86, 0.07, 0.18]} />
                      <meshBasicMaterial color={plankIndex % 2 === 0 ? "#16100b" : "#5b3b22"} transparent opacity={0.58} />
                    </mesh>
                  );
                })}
                <mesh position={[0, -0.32, 0]} castShadow={false}>
                  <boxGeometry args={[segment.width * 1.02, 0.16, segment.length * 0.96]} />
                  <meshBasicMaterial color="#090604" transparent opacity={0.3} />
                </mesh>
                <mesh position={[0, -1.02, -segment.length * 0.34]} castShadow={false}>
                  <boxGeometry args={[segment.width + 1.6, 0.5, 0.9]} />
                  <meshBasicMaterial color="#3a2719" />
                </mesh>
                <mesh position={[0, -1.02, segment.length * 0.34]} castShadow={false}>
                  <boxGeometry args={[segment.width + 1.6, 0.5, 0.9]} />
                  <meshBasicMaterial color="#3a2719" />
                </mesh>
                <mesh position={[0, -1.3, 0]} rotation={[0, 0, 0.24]} castShadow={false}>
                  <boxGeometry args={[segment.width * 0.72, 0.42, 0.72]} />
                  <meshBasicMaterial color="#5b4029" />
                </mesh>
                <mesh position={[0, -1.3, 0]} rotation={[0, 0, -0.24]} castShadow={false}>
                  <boxGeometry args={[segment.width * 0.72, 0.42, 0.72]} />
                  <meshBasicMaterial color="#5b4029" />
                </mesh>
              </>
            )}
          </group>
        );
      })}
      {showDetails && supports.map((support) => (
        <group key={support.key} position={[support.localX, support.topY - support.height / 2, support.localZ]} rotation={[0, support.yaw, 0]}>
          <mesh castShadow={false}>
            <boxGeometry args={[2.15, support.height, 2.15]} />
            <meshBasicMaterial color="#2f2117" />
          </mesh>
          <RetroVerticalTimberDetails height={support.height} width={2.15} depth={2.15} bandColor="#8e6137" />
          <mesh position={[0, -support.height / 2 - 0.08, 0]} castShadow={false}>
            <boxGeometry args={[5.6, 0.62, 5.6]} />
            <meshBasicMaterial color="#4b3524" />
          </mesh>
          <mesh position={[0, -support.height / 2 + 0.25, -2.92]} castShadow={false}>
            <boxGeometry args={[4.6, 0.2, 0.18]} />
            <meshBasicMaterial color="#080504" transparent opacity={0.82} />
          </mesh>
          <mesh position={[0, -support.height / 2 + 0.28, 2.92]} castShadow={false}>
            <boxGeometry args={[4.6, 0.18, 0.16]} />
            <meshBasicMaterial color="#9a7045" />
          </mesh>
          {support.height > 4.2 && (
            <>
              <group position={[support.side * 0.98, -support.height * 0.08, 0]} rotation={[0, 0, -support.side * 0.24]}>
                <mesh castShadow={false}>
                  <boxGeometry args={[0.9, support.height * 0.86, 0.9]} />
                  <meshBasicMaterial color="#3f2d1f" />
                </mesh>
                <RetroVerticalTimberDetails height={support.height * 0.86} width={0.9} depth={0.9} bandColor="#6d4a2e" />
              </group>
              <group position={[-support.side * 0.9, -support.height * 0.14, 0]} rotation={[0, 0, support.side * 0.18]}>
                <mesh castShadow={false}>
                  <boxGeometry args={[0.72, support.height * 0.7, 0.72]} />
                  <meshBasicMaterial color="#5b4029" />
                </mesh>
                <RetroVerticalTimberDetails height={support.height * 0.7} width={0.72} depth={0.72} bandColor="#a67642" />
              </group>
            </>
          )}
        </group>
      ))}
    </group>
  );
}
