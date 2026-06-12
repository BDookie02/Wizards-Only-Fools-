import { Fragment } from "react";
import { getMountainMineshaftLadderDetails } from "./mountainVillageMineshaftAccessRuntime";
import {
  type MountainMineshaftLadder,
} from "./mountainVillageMineshaftRuntime";

const MOUNTAIN_MINESHAFT_LADDER_SIDES = [-1, 1] as const;

export function MountainMineshaftLadderView({ ladder, showDetails }: { ladder: MountainMineshaftLadder; showDetails: boolean }) {
  const height = Math.max(4, ladder.endY - ladder.startY);
  const ladderDetails = getMountainMineshaftLadderDetails({ height, width: ladder.width });

  return (
    <group position={[ladder.localX, ladder.startY, ladder.localZ]} rotation={[0, ladder.rotation, 0]}>
      <mesh position={[-ladder.width / 2, height / 2, 0]} castShadow={false}>
        <boxGeometry args={[0.34, height, 0.28]} />
        <meshBasicMaterial color="#26180f" />
      </mesh>
      <mesh position={[ladder.width / 2, height / 2, 0]} castShadow={false}>
        <boxGeometry args={[0.34, height, 0.28]} />
        <meshBasicMaterial color="#26180f" />
      </mesh>
      {ladderDetails.rungs.map((rung) => (
        <mesh key={`rung-${rung.index}`} position={rung.position} castShadow={false}>
          <boxGeometry args={[ladder.width + 0.55, 0.24, 0.32]} />
          <meshBasicMaterial color={rung.color} />
        </mesh>
      ))}
      {showDetails && (
        <>
          <mesh position={[0, height / 2, -0.12]} castShadow={false}>
            <boxGeometry args={[ladder.width + 0.9, height * 0.94, 0.08]} />
            <meshBasicMaterial color="#050403" transparent opacity={0.22} />
          </mesh>
          {MOUNTAIN_MINESHAFT_LADDER_SIDES.map((side) => (
            <mesh key={`rail-highlight-${side}`} position={[side * ladder.width / 2 + side * 0.08, height / 2, 0.2]} castShadow={false}>
              <boxGeometry args={[0.1, height * 0.94, 0.08]} />
              <meshBasicMaterial color="#8a5b34" />
            </mesh>
          ))}
          {ladderDetails.wraps.map((wrap) => (
            <Fragment key={`ladder-wrap-${wrap.index}`}>
              <mesh position={wrap.leftPosition} castShadow={false}>
                <boxGeometry args={[0.64, 0.3, 0.42]} />
                <meshBasicMaterial color={wrap.color} />
              </mesh>
              <mesh position={wrap.rightPosition} castShadow={false}>
                <boxGeometry args={[0.64, 0.3, 0.42]} />
                <meshBasicMaterial color={wrap.color} />
              </mesh>
            </Fragment>
          ))}
          {ladderDetails.brightEdges.map((edge) => (
            <mesh key={`rung-bright-edge-${edge.index}`} position={edge.position} castShadow={false}>
              <boxGeometry args={[ladder.width + 0.18, 0.07, 0.1]} />
              <meshBasicMaterial color="#b27a42" />
            </mesh>
          ))}
          {ladderDetails.darkEdges.map((edge) => (
            <mesh key={`rung-dark-edge-${edge.index}`} position={edge.position} castShadow={false}>
              <boxGeometry args={[ladder.width + 0.42, 0.08, 0.12]} />
              <meshBasicMaterial color="#090604" transparent opacity={0.72} />
            </mesh>
          ))}
          <mesh position={[0, height + 0.34, 0]} castShadow={false}>
            <boxGeometry args={[ladder.width + 1.2, 0.46, 0.46]} />
            <meshBasicMaterial color="#6f5131" />
          </mesh>
          <mesh position={[0, 0.34, 0]} castShadow={false}>
            <boxGeometry args={[ladder.width + 1.2, 0.46, 0.46]} />
            <meshBasicMaterial color="#6f5131" />
          </mesh>
        </>
      )}
    </group>
  );
}
