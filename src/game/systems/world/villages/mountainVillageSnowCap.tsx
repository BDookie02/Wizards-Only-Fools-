import { getMountainMineshaftSummitSnowDrifts } from "./mountainVillageMineshaftOpeningRuntime";

export function MountainSnowCapView({ summitY, showDetails }: { summitY: number; showDetails: boolean }) {
  if (!showDetails) return null;

  const snowDrifts = getMountainMineshaftSummitSnowDrifts();

  return (
    <group name="mountain-village-snow-cap">
      {snowDrifts.map((drift) => (
        <mesh
          key={`summit-snow-drift-${drift.index}`}
          rotation={drift.rotation}
          position={[drift.positionXZ[0], summitY + drift.yOffset, drift.positionXZ[1]]}
          scale={drift.scale}
        >
          <circleGeometry args={[1, 12]} />
          <meshBasicMaterial color={drift.color} transparent opacity={0.46} />
        </mesh>
      ))}
    </group>
  );
}
