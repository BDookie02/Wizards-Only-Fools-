import { Fragment } from "react";
import {
  getMountainMineshaftExitBridgeDetails,
  getMountainMineshaftExitBridgeFrame,
} from "./mountainVillageMineshaftAccessRuntime";
import {
  type MountainMineshaftLadder,
} from "./mountainVillageMineshaftRuntime";
import {
  MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH,
  MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_Y_OFFSET,
} from "./mountainVillageTerrain";
import { RetroMineshaftLantern } from "./mountainVillageMineshaftLighting";
import { RetroHorizontalTimberDetails } from "./mountainVillageWoodDetails";

export function MountainMineshaftTopExitBridgeView({ ladder, summitY, showDetails }: { ladder: MountainMineshaftLadder; summitY: number; showDetails: boolean }) {
  const bridge = getMountainMineshaftExitBridgeFrame(ladder);
  const exitDetails = getMountainMineshaftExitBridgeDetails({
    length: bridge.length,
    width: MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH,
  });
  const y = summitY + MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_Y_OFFSET;

  return (
    <group name="mountain-village-mineshaft-top-exit" position={[bridge.x, y, bridge.z]} rotation={[0, bridge.angle, 0]}>
      <mesh castShadow={false} receiveShadow>
        <boxGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH, 0.58, bridge.length]} />
        <meshBasicMaterial color="#5d3f28" />
      </mesh>
      <mesh position={[0, 0.42, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH * 0.88, 0.2, bridge.length * 0.96]} />
        <meshBasicMaterial color="#8a653f" />
      </mesh>
      {showDetails && (
        <>
          {exitDetails.edgeShadows.map((edge) => (
            <mesh key={`exit-bridge-edge-shadow-${edge.side}`} position={edge.position} castShadow={false}>
              <boxGeometry args={[0.24, 0.12, bridge.length * 0.98]} />
              <meshBasicMaterial color="#080504" transparent opacity={0.72} />
            </mesh>
          ))}
          {exitDetails.darkGaps.map((gap) => (
            <mesh key={`exit-bridge-dark-gap-${gap.index}`} position={[0, 0.8, gap.z]} castShadow={false}>
              <boxGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH * 0.84, 0.08, 0.14]} />
              <meshBasicMaterial color="#090604" transparent opacity={0.56} />
            </mesh>
          ))}
        </>
      )}
      {showDetails && exitDetails.planks.map((plank) => (
        <mesh key={`exit-plank-${plank.index}`} position={[0, 0.64, plank.z]} castShadow={false}>
          <boxGeometry args={[MOUNTAIN_VILLAGE_MINESHAFT_EXIT_BRIDGE_WIDTH + 0.8, 0.16, 1.45]} />
          <meshBasicMaterial color={plank.color} />
        </mesh>
      ))}
      {exitDetails.sideRails.map((rail) => (
        <Fragment key={`exit-side-${rail.side}`}>
          <mesh position={rail.position} castShadow={false}>
            <boxGeometry args={[0.36, 0.36, bridge.length * 0.92]} />
            <meshBasicMaterial color="#2b1c12" />
          </mesh>
          {showDetails && rail.posts.map((post) => (
            <mesh key={`exit-post-${post.side}-${post.index}`} position={post.position} castShadow={false}>
              <boxGeometry args={[0.46, 1.34, 0.46]} />
              <meshBasicMaterial color={post.color} />
            </mesh>
          ))}
        </Fragment>
      ))}
      {showDetails && (
        <>
          {exitDetails.supports.map((support) => (
            <group key={`exit-support-${support.key}`} position={support.position} rotation={support.rotation}>
              <mesh castShadow={false}>
                <boxGeometry args={[exitDetails.supportLength, 0.42, 0.6]} />
                <meshBasicMaterial color="#3a2719" />
              </mesh>
              <RetroHorizontalTimberDetails length={exitDetails.supportLength} height={0.42} depth={0.6} bandColor="#8a5b34" />
            </group>
          ))}
          <RetroMineshaftLantern position={exitDetails.lanternPosition} scale={0.7} withLight />
        </>
      )}
    </group>
  );
}
