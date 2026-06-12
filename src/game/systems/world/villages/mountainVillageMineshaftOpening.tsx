import * as THREE from "three";
import { absoluteAngleDeltaRadians } from "../../math/angleMath";
import { MountainMineshaftRoyalBanquet } from "./mountainVillageMineshaftBanquet";
import { MountainMineshaftTopExitBridgeView } from "./mountainVillageMineshaftExitBridge";
import {
  MountainMineshaftWallLanterns,
} from "./mountainVillageMineshaftLighting";
import {
  MountainMineshaftWallPaintings,
  MountainMineshaftWallRopeLights,
} from "./mountainVillageMineshaftWallDecor";
import {
  getMountainMineshaftBottomRocks,
  getMountainMineshaftRimBeams,
  getMountainMineshaftSupportFrames,
  type MountainMineshaftLadder,
} from "./mountainVillageMineshaftRuntime";
import {
  MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_BASE_OFFSET,
  MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_RIM_MID_RADIUS,
  MOUNTAIN_VILLAGE_MINESHAFT_RIM_OUTER_RADIUS,
} from "./mountainVillageTerrain";
import {
  RetroHorizontalTimberDetails,
  RetroVerticalTimberDetails,
} from "./mountainVillageWoodDetails";

const MOUNTAIN_EXIT_BRIDGE_BEAM_ZS = [-2.9, 0, 2.9] as const;

export function MountainMineshaftOpeningView({
  baseHeight,
  summitY,
  exitLadder,
  showDetails,
}: {
  baseHeight: number;
  summitY: number;
  exitLadder?: MountainMineshaftLadder;
  showDetails: boolean;
}) {
  const bottomY = baseHeight + MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_BASE_OFFSET;
  const shaftWallHeight = Math.max(32, summitY - bottomY + 1.2);
  const shaftWallY = bottomY + shaftWallHeight / 2 - 0.2;
  const rimBeams = getMountainMineshaftRimBeams({
    count: 12,
    holeRadius: MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS,
    outerRadius: MOUNTAIN_VILLAGE_MINESHAFT_RIM_OUTER_RADIUS,
  });
  const bottomRocks = getMountainMineshaftBottomRocks({
    count: 14,
    bottomRadius: MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS,
  });
  const supportFrames = getMountainMineshaftSupportFrames({ count: 4 });

  return (
    <group name="mountain-village-mineshaft">
      <mesh position={[0, shaftWallY, 0]} castShadow={false} renderOrder={3}>
        <cylinderGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS, MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS * 0.82, shaftWallHeight, 48, 1, true]} />
        <meshStandardMaterial color="#0b0908" roughness={1} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      <MountainMineshaftWallRopeLights bottomY={bottomY} summitY={summitY} showDetails={showDetails} />
      <MountainMineshaftWallLanterns bottomY={bottomY} summitY={summitY} showDetails={showDetails} />
      <MountainMineshaftWallPaintings bottomY={bottomY} summitY={summitY} showDetails={showDetails} />
      <mesh position={[0, bottomY - 0.28, 0]} receiveShadow={showDetails} renderOrder={4}>
        <cylinderGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS, MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS * 0.96, 0.56, 48]} />
        <meshStandardMaterial color="#342519" roughness={0.96} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, bottomY + 0.04, 0]} renderOrder={5}>
        <ringGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS * 0.28, MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS * 0.96, 48]} />
        <meshBasicMaterial color="#5c4932" transparent opacity={0.58} />
      </mesh>
      {showDetails && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, bottomY + 0.12, 0]} renderOrder={6}>
          <ringGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS * 0.7, MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS * 0.98, 48]} />
          <meshBasicMaterial color="#070504" transparent opacity={0.38} />
        </mesh>
      )}
      {showDetails && bottomRocks.map((rock) => (
        <mesh key={`mine-bottom-rock-${rock.index}`} position={[rock.x, bottomY + 0.12, rock.z]} rotation={rock.rotation} scale={rock.scale} castShadow={false}>
          <boxGeometry args={[1.8, 0.65, 1.25]} />
          <meshStandardMaterial color={rock.color} roughness={1} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, bottomY - 0.08, 0]} renderOrder={4}>
        <circleGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_BOTTOM_RADIUS * 0.32, 36]} />
        <meshBasicMaterial color="#080605" transparent opacity={0.48} />
      </mesh>
      <MountainMineshaftRoyalBanquet bottomY={bottomY} showDetails={showDetails} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, summitY + 0.42, 0]} renderOrder={5}>
        <ringGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS, MOUNTAIN_VILLAGE_MINESHAFT_RIM_MID_RADIUS, 48]} />
        <meshBasicMaterial color="#3a281a" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, summitY + 0.5, 0]} renderOrder={6}>
        <ringGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_RIM_MID_RADIUS, MOUNTAIN_VILLAGE_MINESHAFT_RIM_OUTER_RADIUS, 48]} />
        <meshBasicMaterial color="#796650" />
      </mesh>
      {showDetails && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, summitY + 0.58, 0]} renderOrder={7}>
            <ringGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS, MOUNTAIN_VILLAGE_MINESHAFT_HOLE_RADIUS + 2.4, 48]} />
            <meshBasicMaterial color="#050403" transparent opacity={0.58} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, summitY + 0.6, 0]} renderOrder={7}>
            <ringGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_RIM_OUTER_RADIUS - 1.35, MOUNTAIN_VILLAGE_MINESHAFT_RIM_OUTER_RADIUS, 48]} />
            <meshBasicMaterial color="#120c08" transparent opacity={0.42} />
          </mesh>
        </>
      )}
      {rimBeams.map((beam) => {
        if (exitLadder && absoluteAngleDeltaRadians(exitLadder.angle, beam.angle) < 0.38) return null;

        return (
          <group key={`mine-rim-beam-${beam.index}`} position={[beam.x, summitY + 1.02, beam.z]} rotation={beam.rotation}>
            <mesh castShadow={false}>
              <boxGeometry args={[3.4, 0.9, 9.5]} />
              <meshBasicMaterial color={beam.index % 2 === 0 ? "#4b3421" : "#5e442d"} />
            </mesh>
            {showDetails && (
              <>
                {MOUNTAIN_EXIT_BRIDGE_BEAM_ZS.map((beamZ, bandIndex) => (
                  <mesh key={`rim-beam-band-${bandIndex}`} position={[0, 0.12, beamZ]} castShadow={false}>
                    <boxGeometry args={[3.76, 0.16, 0.24]} />
                    <meshBasicMaterial color={bandIndex === 1 ? "#a67642" : "#24170f"} />
                  </mesh>
                ))}
                <mesh position={[0, 0.54, 0]} castShadow={false}>
                  <boxGeometry args={[0.22, 0.12, 8.2]} />
                  <meshBasicMaterial color="#d2a46a" transparent opacity={0.52} />
                </mesh>
                <mesh position={[0, -0.52, 0]} castShadow={false}>
                  <boxGeometry args={[3.22, 0.16, 8.9]} />
                  <meshBasicMaterial color="#060403" transparent opacity={0.62} />
                </mesh>
              </>
            )}
          </group>
        );
      })}
      {exitLadder && <MountainMineshaftTopExitBridgeView ladder={exitLadder} summitY={summitY} showDetails={showDetails} />}
      {showDetails && supportFrames.map((frame) => (
        <group key={`mine-support-${frame.index}`} rotation={frame.rotation}>
          {frame.posts.map((post) => (
            <group
              key={`mine-support-post-${post.side}`}
              position={[post.positionOffset[0], summitY + post.positionOffset[1], post.positionOffset[2]]}
              rotation={post.rotation}
            >
              <mesh castShadow={false}>
                <boxGeometry args={[2.3, 15.5, 2.3]} />
                <meshBasicMaterial color="#392719" />
              </mesh>
              <RetroVerticalTimberDetails height={15.5} width={2.3} depth={2.3} bandColor="#a67642" lightColor="#8a5b34" />
            </group>
          ))}
          <group position={[frame.topBeamPositionOffset[0], summitY + frame.topBeamPositionOffset[1], frame.topBeamPositionOffset[2]]}>
            <mesh castShadow={false}>
              <boxGeometry args={[27.5, 2.4, 2.6]} />
              <meshBasicMaterial color="#513821" />
            </mesh>
            <RetroHorizontalTimberDetails length={27.5} height={2.4} depth={2.6} bandColor="#be8a4c" />
            {frame.snowCaps.map((snowCap) => (
              <mesh key={`support-snow-cap-${snowCap.side}`} position={snowCap.position} castShadow={false}>
                <boxGeometry args={[5.1, 0.22, 1.88]} />
                <meshBasicMaterial color="#e8f8ff" transparent opacity={0.7} />
              </mesh>
            ))}
          </group>
        </group>
      ))}
    </group>
  );
}
