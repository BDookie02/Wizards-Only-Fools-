import { Fragment } from "react";
import { getMountainCabinDoorMetrics } from "./mountainVillageLayoutRuntime";
import {
  MountainMineshaftLightPole,
  RetroMineshaftLantern,
} from "./mountainVillageMineshaftLighting";
import {
  getMountainMineshaftLadderLandingLocalX,
  getMountainMineshaftPlatformDetails,
  getMountainMineshaftPlatformPieces,
  type MountainMineshaftHut,
  type MountainMineshaftLadder,
} from "./mountainVillageMineshaftRuntime";
import { MOUNTAIN_VILLAGE_MINESHAFT_LADDER_PLATFORM_GAP } from "./mountainVillageTerrain";
import {
  MountainHutRoofDetails,
  MountainHutWallDetails,
  RetroVerticalTimberDetails,
  RetroWindowDetails,
} from "./mountainVillageWoodDetails";

export function MountainMineshaftMiniHutView({
  hut,
  ladder,
  showDetails,
}: {
  hut: MountainMineshaftHut;
  ladder?: MountainMineshaftLadder;
  showDetails: boolean;
}) {
  const { wallThickness, doorWidth, doorHeight, frontWallWidth, lintelHeight } = getMountainCabinDoorMetrics(hut);
  const frontZ = hut.depth / 2 - wallThickness / 2;
  const backZ = -hut.depth / 2 + wallThickness / 2;
  const platformZ = hut.depth / 2 + hut.platformDepth / 2 - 1.1;
  const floorY = 0.48;
  const ladderGapCenterX = getMountainMineshaftLadderLandingLocalX(hut, ladder);
  const platformPieces = getMountainMineshaftPlatformPieces(hut.platformWidth, ladderGapCenterX, MOUNTAIN_VILLAGE_MINESHAFT_LADDER_PLATFORM_GAP);
  const platformTopPieces = getMountainMineshaftPlatformPieces(
    hut.platformWidth * 0.94,
    ladderGapCenterX,
    MOUNTAIN_VILLAGE_MINESHAFT_LADDER_PLATFORM_GAP
  );
  const poleSide: -1 | 1 = ladderGapCenterX !== null && ladderGapCenterX > 0 ? -1 : 1;
  const platformDetails = getMountainMineshaftPlatformDetails({
    platformPieces,
    platformZ,
    platformDepth: hut.platformDepth,
    platformWidth: hut.platformWidth,
    poleSide,
    plankCount: 5,
  });

  return (
    <group position={[hut.localX, hut.y, hut.localZ]} rotation={[0, hut.rotation, 0]}>
      {platformPieces.map((piece) => (
        <mesh key={`platform-${piece.key}`} position={[piece.centerX, 0.18, platformZ]} castShadow={false} receiveShadow>
          <boxGeometry args={[piece.width, 0.52, hut.platformDepth]} />
          <meshBasicMaterial color="#3f2b1c" />
        </mesh>
      ))}
      {platformTopPieces.map((piece) => (
        <mesh key={`platform-top-${piece.key}`} position={[piece.centerX, 0.56, platformZ]} castShadow={false} receiveShadow>
          <boxGeometry args={[piece.width, 0.22, hut.platformDepth * 0.88]} />
          <meshBasicMaterial color="#6d4a2e" />
        </mesh>
      ))}
      {showDetails && platformDetails.pieces.map((pieceDetails) => (
        <Fragment key={`platform-detail-${pieceDetails.key}`}>
          {pieceDetails.sideShadows.map((shadow) => (
            <mesh key={`platform-side-shadow-${shadow.side}`} position={shadow.position} castShadow={false}>
              <boxGeometry args={[0.2, 0.12, hut.platformDepth * 0.92]} />
              <meshBasicMaterial color="#080504" transparent opacity={0.74} />
            </mesh>
          ))}
          {pieceDetails.plankGrooves.map((groove) => (
            <mesh key={`plank-groove-${groove.index}`} position={groove.position} castShadow={false}>
              <boxGeometry args={[groove.width, 0.07, 0.09]} />
              <meshBasicMaterial color={groove.color} />
            </mesh>
          ))}
          <mesh position={pieceDetails.frontRail.position} castShadow={false}>
            <boxGeometry args={[pieceDetails.frontRail.width, 0.22, 0.32]} />
            <meshBasicMaterial color="#8b6239" />
          </mesh>
          <mesh position={pieceDetails.backRail.position} castShadow={false}>
            <boxGeometry args={[pieceDetails.backRail.width, 0.18, 0.24]} />
            <meshBasicMaterial color="#2c1d13" />
          </mesh>
          {pieceDetails.bolts.map((bolt) => (
            <mesh key={`bolt-${bolt.side}`} position={bolt.position} castShadow={false}>
              <boxGeometry args={[0.28, 0.1, 0.28]} />
              <meshBasicMaterial color="#d0a05d" />
            </mesh>
          ))}
        </Fragment>
      ))}
      {platformDetails.supports.map((support) => (
        <group key={`platform-support-${support.side}`} position={support.position} rotation={support.rotation}>
          <mesh castShadow={false}>
            <boxGeometry args={[0.58, 4.8, 0.58]} />
            <meshBasicMaterial color="#2d1e14" />
          </mesh>
          {showDetails && <RetroVerticalTimberDetails height={4.8} width={0.58} depth={0.58} bandColor="#8a5b34" />}
        </group>
      ))}
      {showDetails && (
        <>
          <MountainMineshaftLightPole
            position={platformDetails.lightPole.position}
            direction={platformDetails.lightPole.direction}
          />
          <RetroMineshaftLantern position={[doorWidth / 2 + 1.35, 3.55 + floorY, frontZ + 0.34]} scale={0.62} withLight={false} />
        </>
      )}
      <mesh position={[0, hut.height / 2 + floorY, backZ - 0.42]} castShadow={false}>
        <boxGeometry args={[hut.width + 1.6, hut.height + 1.1, 0.7]} />
        <meshBasicMaterial color="#16100c" transparent opacity={0.88} />
      </mesh>
      {showDetails && (
        <mesh position={[0, floorY + 0.42, hut.depth / 2 + 0.28]} castShadow={false}>
          <boxGeometry args={[hut.width + 1.0, 0.18, 0.2]} />
          <meshBasicMaterial color="#060403" transparent opacity={0.86} />
        </mesh>
      )}
      <mesh position={[-hut.width / 2 + wallThickness / 2, hut.height / 2 + floorY, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[wallThickness, hut.height, hut.depth]} />
        <meshBasicMaterial color={hut.bodyColor} />
      </mesh>
      <mesh position={[hut.width / 2 - wallThickness / 2, hut.height / 2 + floorY, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[wallThickness, hut.height, hut.depth]} />
        <meshBasicMaterial color={hut.bodyColor} />
      </mesh>
      <mesh position={[0, hut.height / 2 + floorY, backZ]} castShadow={false} receiveShadow>
        <boxGeometry args={[hut.width, hut.height, wallThickness]} />
        <meshBasicMaterial color={hut.bodyColor} />
      </mesh>
      <mesh position={[-doorWidth / 2 - frontWallWidth / 2, hut.height / 2 + floorY, frontZ]} castShadow={false} receiveShadow>
        <boxGeometry args={[frontWallWidth, hut.height, wallThickness]} />
        <meshBasicMaterial color={hut.bodyColor} />
      </mesh>
      <mesh position={[doorWidth / 2 + frontWallWidth / 2, hut.height / 2 + floorY, frontZ]} castShadow={false} receiveShadow>
        <boxGeometry args={[frontWallWidth, hut.height, wallThickness]} />
        <meshBasicMaterial color={hut.bodyColor} />
      </mesh>
      <mesh position={[0, doorHeight + lintelHeight / 2 + floorY, frontZ]} castShadow={false} receiveShadow>
        <boxGeometry args={[doorWidth, lintelHeight, wallThickness]} />
        <meshBasicMaterial color={hut.bodyColor} />
      </mesh>
      <mesh position={[0, hut.height + 2.8 + floorY, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={false} receiveShadow>
        <coneGeometry args={[Math.max(hut.width, hut.depth) * 0.76, 6.2, 4]} />
        <meshBasicMaterial color={hut.roofColor} />
      </mesh>
      <mesh position={[0, hut.height + 6.0 + floorY, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={false}>
        <coneGeometry args={[Math.max(hut.width, hut.depth) * 0.3, 2.3, 4]} />
        <meshBasicMaterial color="#cfe6f3" />
      </mesh>
      <mesh position={[0, doorHeight / 2 + floorY, frontZ + 0.16]} castShadow={false}>
        <boxGeometry args={[doorWidth * 0.76, doorHeight * 0.78, 0.24]} />
        <meshBasicMaterial color="#1c130d" />
      </mesh>
      {showDetails && (
        <>
          <MountainHutWallDetails
            width={hut.width}
            depth={hut.depth}
            height={hut.height}
            floorY={floorY}
            frontZ={hut.depth / 2 + 0.08}
            backZ={-hut.depth / 2 - 0.08}
            doorWidth={doorWidth}
            doorHeight={doorHeight}
            compact
          />
          <MountainHutRoofDetails width={hut.width} depth={hut.depth} roofBaseY={hut.height + floorY + 0.25} roofHeight={5.2} compact />
          <mesh position={[-hut.width * 0.28, 4.6 + floorY, frontZ + 0.18]} castShadow={false}>
            <boxGeometry args={[2.0, 1.8, 0.26]} />
            <meshBasicMaterial color={hut.accentColor} transparent opacity={0.9} />
          </mesh>
          <RetroWindowDetails x={-hut.width * 0.28} y={4.6 + floorY} z={frontZ + 0.34} width={1.75} height={1.55} />
          <mesh position={[hut.width * 0.28, 4.6 + floorY, frontZ + 0.18]} castShadow={false}>
            <boxGeometry args={[2.0, 1.8, 0.26]} />
            <meshBasicMaterial color={hut.accentColor} transparent opacity={0.9} />
          </mesh>
          <RetroWindowDetails x={hut.width * 0.28} y={4.6 + floorY} z={frontZ + 0.34} width={1.75} height={1.55} />
          <mesh position={[0, 2.8, platformZ + hut.platformDepth * 0.28]} castShadow={false}>
            <sphereGeometry args={[0.78, 8, 5]} />
            <meshBasicMaterial color="#ffd47a" transparent opacity={0.86} />
          </mesh>
          <mesh position={[0, 2.08, platformZ + hut.platformDepth * 0.28]} castShadow={false}>
            <boxGeometry args={[1.16, 0.14, 1.16]} />
            <meshBasicMaterial color="#080504" transparent opacity={0.72} />
          </mesh>
        </>
      )}
    </group>
  );
}
