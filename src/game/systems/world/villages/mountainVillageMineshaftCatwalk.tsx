import { Fragment } from "react";
import * as THREE from "three";
import { absoluteAngleDeltaRadians } from "../../math/angleMath";
import {
  getMountainMineshaftCatwalkDescriptors,
  getMountainMineshaftCatwalkLightPoles,
  type MountainMineshaftHut,
  type MountainMineshaftLadder,
} from "./mountainVillageMineshaftRuntime";
import {
  MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_SEGMENTS,
} from "./mountainVillageTerrain";
import { RetroMineshaftLantern } from "./mountainVillageMineshaftLighting";

const MOUNTAIN_CATWALK_CENTER_RAIL_HEIGHTS = [0.86, 1.55, 2.08] as const;

export function MountainMineshaftCatwalkRingView({
  hut,
  ladder,
  nextLadder,
  showDetails,
}: {
  hut: MountainMineshaftHut;
  ladder?: MountainMineshaftLadder;
  nextLadder?: MountainMineshaftLadder;
  showDetails: boolean;
}) {
  const catwalkDescriptors = getMountainMineshaftCatwalkDescriptors({
    segments: MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_SEGMENTS,
    innerRadius: MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS,
    outerRadius: MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS,
  });
  const lightPoles = getMountainMineshaftCatwalkLightPoles(hut.angle, catwalkDescriptors.lightPoleRadius);
  const centerGuardRailRadius = catwalkDescriptors.centerGuardRailRadius;
  const centerGuardRailSegmentLength = catwalkDescriptors.centerGuardRailSegmentLength;
  const balconyGapHalfAngle = Math.min(0.52, Math.max(0.34, (hut.platformWidth * 0.38) / centerGuardRailRadius));
  const ladderGapHalfAngle = ladder
    ? Math.min(0.5, Math.max(0.34, (ladder.width * 1.35) / centerGuardRailRadius))
    : 0;
  const nextLadderGapHalfAngle = nextLadder
    ? Math.min(0.5, Math.max(0.34, (nextLadder.width * 1.35) / centerGuardRailRadius))
    : 0;
  const isGuardRailOpening = (angle: number) => {
    if (absoluteAngleDeltaRadians(hut.angle, angle) < balconyGapHalfAngle) return true;
    if (ladder && absoluteAngleDeltaRadians(ladder.angle, angle) < ladderGapHalfAngle) return true;
    return Boolean(nextLadder && absoluteAngleDeltaRadians(nextLadder.angle, angle) < nextLadderGapHalfAngle);
  };

  return (
    <group name={`${hut.key}-catwalk`} position={[0, hut.y + 0.08, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow={false} receiveShadow>
        <ringGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS, MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS, 64]} />
        <meshBasicMaterial color="#47311f" side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, hut.angle]} position={[0, 0.05, 0]} castShadow={false} receiveShadow>
        <ringGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS + 1.1, MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS - 1.2, 64]} />
        <meshBasicMaterial color="#6b4a2d" side={THREE.DoubleSide} />
      </mesh>
      {showDetails && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.18, 0]} castShadow={false}>
            <ringGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS, MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS + 0.62, 64]} />
            <meshBasicMaterial color="#070504" side={THREE.DoubleSide} transparent opacity={0.7} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]} castShadow={false}>
            <ringGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS - 0.58, MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS, 64]} />
            <meshBasicMaterial color="#0d0805" side={THREE.DoubleSide} transparent opacity={0.54} />
          </mesh>
        </>
      )}
      {showDetails && catwalkDescriptors.planks.map((plank) => (
        <mesh key={`catwalk-plank-${plank.index}`} position={plank.position} rotation={plank.rotation} castShadow={false}>
          <boxGeometry args={[1.15, 0.24, MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS - MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS + 0.8]} />
          <meshBasicMaterial color={plank.index % 2 === 0 ? "#7a5635" : "#5d3f28"} />
        </mesh>
      ))}
      {showDetails && catwalkDescriptors.darkGaps.map((darkGap) => (
        <mesh key={`catwalk-dark-gap-${darkGap.index}`} position={darkGap.position} rotation={darkGap.rotation} castShadow={false}>
          <boxGeometry args={[0.16, 0.08, MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_OUTER_RADIUS - MOUNTAIN_VILLAGE_MINESHAFT_CATWALK_INNER_RADIUS + 1.0]} />
          <meshBasicMaterial color="#080504" transparent opacity={0.58} />
        </mesh>
      ))}
      {showDetails && catwalkDescriptors.edgeBlocks.map((edgeBlock) => {
        if (isGuardRailOpening(edgeBlock.angle)) return null;

        return (
          <mesh key={`catwalk-edge-block-${edgeBlock.index}`} position={edgeBlock.position} rotation={edgeBlock.rotation} castShadow={false}>
            <boxGeometry args={[0.68, 0.34, 0.54]} />
            <meshBasicMaterial color={edgeBlock.index % 3 === 0 ? "#9b6a3b" : "#2f1e13"} />
          </mesh>
        );
      })}
      {showDetails && catwalkDescriptors.guardPosts.map((guardPost) => {
        if (isGuardRailOpening(guardPost.angle)) return null;

        return (
          <mesh key={`catwalk-center-guard-post-${guardPost.index}`} position={guardPost.position} rotation={guardPost.rotation} castShadow={false}>
            <boxGeometry args={[0.42, 1.48, 0.42]} />
            <meshBasicMaterial color={guardPost.index % 2 === 0 ? "#2b1c12" : "#4d301b"} />
          </mesh>
        );
      })}
      {showDetails && MOUNTAIN_CATWALK_CENTER_RAIL_HEIGHTS.map((height, railIndex) => (
        <Fragment key={`catwalk-center-guard-rail-row-${railIndex}`}>
          {catwalkDescriptors.railSegments.map((railSegment) => {
            if (isGuardRailOpening(railSegment.angle)) return null;

            return (
              <mesh key={`rail-${railSegment.index}`} position={[railSegment.position[0], height, railSegment.position[2]]} rotation={railSegment.rotation} castShadow={false}>
                <boxGeometry args={[centerGuardRailSegmentLength, 0.24, railIndex === 0 ? 0.32 : 0.28]} />
                <meshBasicMaterial color={railIndex === 1 ? "#8d6238" : "#24170f"} />
              </mesh>
            );
          })}
        </Fragment>
      ))}
      {showDetails && lightPoles.map((lightPole) => (
        <group key={`catwalk-light-pole-${lightPole.index}`} position={lightPole.position} rotation={lightPole.rotation}>
          <mesh position={[0, 1.44, 0]} castShadow={false}>
            <boxGeometry args={[0.34, 2.88, 0.34]} />
            <meshBasicMaterial color="#25170e" />
          </mesh>
          <mesh position={[-0.62, 2.78, 0]} castShadow={false}>
            <boxGeometry args={[1.36, 0.26, 0.26]} />
            <meshBasicMaterial color="#4f321c" />
          </mesh>
          <mesh position={[-1.18, 2.48, 0]} castShadow={false}>
            <boxGeometry args={[0.16, 0.58, 0.16]} />
            <meshBasicMaterial color="#1b120c" />
          </mesh>
          <RetroMineshaftLantern position={[-1.18, 1.44, 0]} scale={0.62} withLight={false} />
        </group>
      ))}
    </group>
  );
}
