import { Fragment } from "react";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { shouldBuildSurvivalChunkColliders } from "../survival/survivalChunks";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import {
  CHICAGO_SIDE_SIGNS,
  CHICAGO_TRAFFIC_LIGHT_POLES,
  makeChicagoLampLayout,
  makeChicagoStreetTreeLayout,
  makeChicagoTrafficLightIntersections,
  type ChicagoBuilding,
} from "./survivalChicagoCityLayout";

export function ChicagoCityColliders({
  chunk,
  baseHeight,
  buildings,
  groundGeometry,
}: {
  chunk: SurvivalChunkInfo;
  baseHeight: number;
  buildings: ChicagoBuilding[];
  groundGeometry: THREE.BufferGeometry;
}) {
  if (!shouldBuildSurvivalChunkColliders(chunk)) return null;

  const trafficLightIntersections = makeChicagoTrafficLightIntersections();
  const lamps = makeChicagoLampLayout();
  const streetTrees = makeChicagoStreetTreeLayout();

  return (
    <>
      <RigidBody type="fixed" colliders="trimesh" friction={0.38} restitution={0} position={[chunk.x, 0, chunk.z]}>
        <mesh geometry={groundGeometry} dispose={null}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders={false} friction={0.35} restitution={0} position={[chunk.x, 0, chunk.z]}>
        {buildings.map((building) => {
          if (!building.enterable) {
            return (
              <CuboidCollider
                key={`${building.key}-collider`}
                args={[building.width / 2, building.height / 2, building.depth / 2]}
                position={[building.localX, baseHeight + building.height / 2, building.localZ]}
                rotation={[0, building.rotation, 0]}
              />
            );
          }

          const wallThickness = 1.15;
          const doorWidth = Math.min(8.6, building.width * 0.42);
          const frontSegmentWidth = Math.max(1.4, (building.width - doorWidth) / 2);
          const wallY = baseHeight + building.height / 2;
          const placeWall = (offsetX: number, offsetZ: number): [number, number, number] => {
            const cos = Math.cos(building.rotation);
            const sin = Math.sin(building.rotation);
            return [
              building.localX + cos * offsetX + sin * offsetZ,
              wallY,
              building.localZ - sin * offsetX + cos * offsetZ,
            ];
          };

          return (
            <Fragment key={`${building.key}-enterable-colliders`}>
              <CuboidCollider
                args={[building.width / 2, building.height / 2, wallThickness / 2]}
                position={placeWall(0, -building.depth / 2 + wallThickness / 2)}
                rotation={[0, building.rotation, 0]}
              />
              {CHICAGO_SIDE_SIGNS.map((side) => (
                <CuboidCollider
                  key={`${building.key}-side-wall-${side}`}
                  args={[wallThickness / 2, building.height / 2, building.depth / 2]}
                  position={placeWall(side * (building.width / 2 - wallThickness / 2), 0)}
                  rotation={[0, building.rotation, 0]}
                />
              ))}
              {CHICAGO_SIDE_SIGNS.map((side) => (
                <CuboidCollider
                  key={`${building.key}-front-wall-${side}`}
                  args={[frontSegmentWidth / 2, building.height / 2, wallThickness / 2]}
                  position={placeWall(side * (doorWidth / 2 + frontSegmentWidth / 2), building.depth / 2 - wallThickness / 2)}
                  rotation={[0, building.rotation, 0]}
                />
              ))}
            </Fragment>
          );
        })}
        {trafficLightIntersections.map((intersection) => (
          <Fragment key={`traffic-light-colliders-${intersection.key}`}>
            {CHICAGO_TRAFFIC_LIGHT_POLES.map((pole) => (
              <group
                key={`traffic-light-collider-${intersection.key}-${pole.key}`}
                position={[intersection.x + pole.offsetX, baseHeight + 0.36, intersection.z + pole.offsetZ]}
                rotation={[0, pole.yaw, 0]}
              >
                <CylinderCollider args={[4.1, 0.34]} position={[0, 4.1, 0]} />
                <CuboidCollider args={[4.05, 0.18, 0.18]} position={[4, 8.1, 0]} />
                <CuboidCollider args={[0.725, 1.7, 0.5]} position={[8.3, 7.55, 0]} />
              </group>
            ))}
          </Fragment>
        ))}
        {lamps.map((lamp) => (
          <group key={`${lamp.key}-colliders`} position={[lamp.x, baseHeight + 0.48, lamp.z]} rotation={[0, lamp.rotation, 0]}>
            <CylinderCollider args={[5.7, 0.38]} position={[0, 5.7, 0]} />
            <CuboidCollider args={[0.22, 0.22, 1.55]} position={[0, 11.25, 1.4]} />
            <CuboidCollider args={[1.175, 0.61, 1]} position={[0, 10.9, 2.95]} />
          </group>
        ))}
        {streetTrees.map((tree) => (
          <CylinderCollider
            key={`${tree.key}-trunk-collider`}
            args={[2.65 * tree.scale, 0.78 * tree.scale]}
            position={[tree.x, baseHeight + 0.52 + 2.65 * tree.scale, tree.z]}
          />
        ))}
      </RigidBody>
    </>
  );
}
