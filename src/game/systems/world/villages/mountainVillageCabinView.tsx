import {
  getMountainCabinDoorMetrics,
  type MountainVillageCabin,
} from "./mountainVillageLayoutRuntime";
import {
  MountainHutRoofDetails,
  MountainHutWallDetails,
  RetroWindowDetails,
} from "./mountainVillageWoodDetails";

export function MountainCabinView({ cabin, summitY, showDetails }: { cabin: MountainVillageCabin; summitY: number; showDetails: boolean }) {
  const { wallThickness, doorWidth, doorHeight, frontWallWidth, lintelHeight } = getMountainCabinDoorMetrics(cabin);
  const frontZ = cabin.depth / 2 - wallThickness / 2;
  const backZ = -cabin.depth / 2 + wallThickness / 2;

  return (
    <group position={[cabin.localX, summitY, cabin.localZ]} rotation={[0, cabin.rotation, 0]}>
      <mesh position={[0, 0.18, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[cabin.width + 0.8, 0.36, cabin.depth + 0.8]} />
        <meshBasicMaterial color="#4b3826" />
      </mesh>
      {showDetails && (
        <>
          <mesh position={[0, 0.42, cabin.depth / 2 + 0.52]} castShadow={false}>
            <boxGeometry args={[cabin.width + 1.15, 0.18, 0.24]} />
            <meshBasicMaterial color="#080504" transparent opacity={0.78} />
          </mesh>
          <mesh position={[0, 0.38, -cabin.depth / 2 - 0.44]} castShadow={false}>
            <boxGeometry args={[cabin.width + 0.7, 0.14, 0.22]} />
            <meshBasicMaterial color="#080504" transparent opacity={0.56} />
          </mesh>
        </>
      )}
      <mesh position={[-cabin.width / 2 + wallThickness / 2, cabin.height / 2, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[wallThickness, cabin.height, cabin.depth]} />
        <meshBasicMaterial color={cabin.bodyColor} />
      </mesh>
      <mesh position={[cabin.width / 2 - wallThickness / 2, cabin.height / 2, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[wallThickness, cabin.height, cabin.depth]} />
        <meshBasicMaterial color={cabin.bodyColor} />
      </mesh>
      <mesh position={[0, cabin.height / 2, backZ]} castShadow={false} receiveShadow>
        <boxGeometry args={[cabin.width, cabin.height, wallThickness]} />
        <meshBasicMaterial color={cabin.bodyColor} />
      </mesh>
      <mesh position={[-doorWidth / 2 - frontWallWidth / 2, cabin.height / 2, frontZ]} castShadow={false} receiveShadow>
        <boxGeometry args={[frontWallWidth, cabin.height, wallThickness]} />
        <meshBasicMaterial color={cabin.bodyColor} />
      </mesh>
      <mesh position={[doorWidth / 2 + frontWallWidth / 2, cabin.height / 2, frontZ]} castShadow={false} receiveShadow>
        <boxGeometry args={[frontWallWidth, cabin.height, wallThickness]} />
        <meshBasicMaterial color={cabin.bodyColor} />
      </mesh>
      <mesh position={[0, doorHeight + lintelHeight / 2, frontZ]} castShadow={false} receiveShadow>
        <boxGeometry args={[doorWidth, lintelHeight, wallThickness]} />
        <meshBasicMaterial color={cabin.bodyColor} />
      </mesh>
      <mesh position={[0, doorHeight * 0.46, cabin.depth / 2 + 0.16]} castShadow={false}>
        <boxGeometry args={[doorWidth * 0.84, doorHeight * 0.86, 0.32]} />
        <meshBasicMaterial color="#4c2e1a" />
      </mesh>
      <mesh position={[0, cabin.height + 4.2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={false} receiveShadow>
        <coneGeometry args={[Math.max(cabin.width, cabin.depth) * 0.78, 9.2, 4]} />
        <meshBasicMaterial color={cabin.roofColor} />
      </mesh>
      <mesh position={[0, cabin.height + 8.9, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={false}>
        <coneGeometry args={[Math.max(cabin.width, cabin.depth) * 0.34, 3.4, 4]} />
        <meshBasicMaterial color="#f8fdff" />
      </mesh>
      <mesh position={[-doorWidth / 2 - 0.28, doorHeight / 2, cabin.depth / 2 + 0.12]} castShadow={false}>
        <boxGeometry args={[0.56, doorHeight, 0.62]} />
        <meshBasicMaterial color="#251a12" />
      </mesh>
      <mesh position={[doorWidth / 2 + 0.28, doorHeight / 2, cabin.depth / 2 + 0.12]} castShadow={false}>
        <boxGeometry args={[0.56, doorHeight, 0.62]} />
        <meshBasicMaterial color="#251a12" />
      </mesh>
      <mesh position={[0, doorHeight + 0.28, cabin.depth / 2 + 0.12]} castShadow={false}>
        <boxGeometry args={[doorWidth + 1.1, 0.56, 0.62]} />
        <meshBasicMaterial color="#251a12" />
      </mesh>
      <mesh position={[0, 3.25, backZ + 0.08]} castShadow={false}>
        <boxGeometry args={[doorWidth * 0.86, 5.1, 0.22]} />
        <meshBasicMaterial color="#251a12" />
      </mesh>
      {showDetails && (
        <>
          <MountainHutWallDetails
            width={cabin.width}
            depth={cabin.depth}
            height={cabin.height}
            floorY={0}
            frontZ={cabin.depth / 2 + 0.08}
            backZ={-cabin.depth / 2 - 0.08}
            doorWidth={doorWidth}
            doorHeight={doorHeight}
          />
          <MountainHutRoofDetails width={cabin.width} depth={cabin.depth} roofBaseY={cabin.height + 0.35} roofHeight={7.8} />
          <mesh position={[-cabin.width * 0.27, 5.9, cabin.depth / 2 + 0.16]} castShadow={false}>
            <boxGeometry args={[3.4, 2.8, 0.36]} />
            <meshBasicMaterial color={cabin.accentColor} transparent opacity={0.88} />
          </mesh>
          <RetroWindowDetails x={-cabin.width * 0.27} y={5.9} z={cabin.depth / 2 + 0.4} width={3.1} height={2.5} />
          <mesh position={[cabin.width * 0.27, 5.9, cabin.depth / 2 + 0.16]} castShadow={false}>
            <boxGeometry args={[3.4, 2.8, 0.36]} />
            <meshBasicMaterial color={cabin.accentColor} transparent opacity={0.88} />
          </mesh>
          <RetroWindowDetails x={cabin.width * 0.27} y={5.9} z={cabin.depth / 2 + 0.4} width={3.1} height={2.5} />
          <mesh position={[0, cabin.height + 2.4, cabin.depth * 0.18]} castShadow={false}>
            <boxGeometry args={[2.2, 5.4, 2.2]} />
            <meshBasicMaterial color="#3b2b1d" />
          </mesh>
          <mesh position={[0, cabin.height + 5.4, cabin.depth * 0.18]} castShadow={false}>
            <boxGeometry args={[3.2, 1.2, 3.2]} />
            <meshBasicMaterial color="#d8edf8" />
          </mesh>
          <mesh position={[0, cabin.height + 4.82, cabin.depth * 0.18 + 1.72]} castShadow={false}>
            <boxGeometry args={[3.55, 0.18, 0.2]} />
            <meshBasicMaterial color="#080504" transparent opacity={0.62} />
          </mesh>
        </>
      )}
    </group>
  );
}
