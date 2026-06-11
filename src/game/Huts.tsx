import { useMemo } from "react";
import * as THREE from "three";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { Evaluator, Brush, SUBTRACTION } from "three-bvh-csg";
import { getHutList } from "./systems/world/villages/baseVillageHutLayout";
import {
  createDirtDoorTexture,
  createDirtGrassTexture,
  createDirtWallTexture,
  createGrassTexture,
  createLogTexture,
  createMushroomCapTextures,
  createStemWallTexture,
  createWoodPlankTexture,
} from "./systems/world/villages/baseVillageHutVisuals";

function HutFloorCollider({ halfSize }: { halfSize: number }) {
  return <CuboidCollider args={[halfSize, 0.12, halfSize]} position={[0, 0.12, 0]} />;
}

function MushroomHutColliders() {
  const wallThickness = 1;
  const height = 8;
  const halfSize = 6;
  const innerHalf = 5;
  const doorWidth = 3;
  const doorHeight = 4.2;
  const frontSegmentWidth = (halfSize * 2 - doorWidth) / 2;
  const lintelHeight = height - doorHeight;

  return (
    <>
      <HutFloorCollider halfSize={5} />
      <CuboidCollider args={[wallThickness / 2, height / 2, halfSize]} position={[-innerHalf - wallThickness / 2, height / 2, 0]} />
      <CuboidCollider args={[wallThickness / 2, height / 2, halfSize]} position={[innerHalf + wallThickness / 2, height / 2, 0]} />
      <CuboidCollider args={[halfSize, height / 2, wallThickness / 2]} position={[0, height / 2, -innerHalf - wallThickness / 2]} />
      <CuboidCollider args={[frontSegmentWidth / 2, height / 2, wallThickness / 2]} position={[-doorWidth / 2 - frontSegmentWidth / 2, height / 2, innerHalf + wallThickness / 2]} />
      <CuboidCollider args={[frontSegmentWidth / 2, height / 2, wallThickness / 2]} position={[doorWidth / 2 + frontSegmentWidth / 2, height / 2, innerHalf + wallThickness / 2]} />
      <CuboidCollider args={[doorWidth / 2, lintelHeight / 2, wallThickness / 2]} position={[0, doorHeight + lintelHeight / 2, innerHalf + wallThickness / 2]} />
      <CuboidCollider args={[9, 2.4, 9]} position={[0, 13, 0]} />
    </>
  );
}

function MoundHutColliders({ hasFlatRoof = false }: { hasFlatRoof?: boolean }) {
  const wallThickness = 1;
  const height = 12;
  const halfSize = 9;
  const innerHalf = 8;
  const doorWidth = 3;
  const doorHeight = 4.2;
  const frontSegmentWidth = Math.max(1, (halfSize * 2 - doorWidth) / 2);
  const lintelHeight = height - doorHeight;

  return (
    <>
      <HutFloorCollider halfSize={8} />
      <CuboidCollider args={[wallThickness / 2, height / 2, halfSize]} position={[-innerHalf - wallThickness / 2, height / 2, 0]} />
      <CuboidCollider args={[wallThickness / 2, height / 2, halfSize]} position={[innerHalf + wallThickness / 2, height / 2, 0]} />
      <CuboidCollider args={[halfSize, height / 2, wallThickness / 2]} position={[0, height / 2, -innerHalf - wallThickness / 2]} />
      <CuboidCollider args={[frontSegmentWidth / 2, height / 2, wallThickness / 2]} position={[-doorWidth / 2 - frontSegmentWidth / 2, height / 2, innerHalf + wallThickness / 2]} />
      <CuboidCollider args={[frontSegmentWidth / 2, height / 2, wallThickness / 2]} position={[doorWidth / 2 + frontSegmentWidth / 2, height / 2, innerHalf + wallThickness / 2]} />
      <CuboidCollider args={[doorWidth / 2, lintelHeight / 2, wallThickness / 2]} position={[0, doorHeight + lintelHeight / 2, innerHalf + wallThickness / 2]} />
      {hasFlatRoof && <CuboidCollider args={[4, 0.2, 4]} position={[0, 12, 0]} />}
    </>
  );
}

function makeMushroomGeometry() {
  const geo = new THREE.CylinderGeometry(6 / Math.SQRT2, 18 / Math.SQRT2, 10, 4);
  geo.rotateY(Math.PI / 4);
  return geo;
}

function makeHollowStemGeometry() {
  const evaluator = new Evaluator();
  const solidGeo = new THREE.BoxGeometry(12, 8, 12);
  const outerBrush = new Brush(solidGeo);
  outerBrush.updateMatrixWorld();

  const innerGeo = new THREE.BoxGeometry(10, 8.0, 10);
  const innerBrush = new Brush(innerGeo);
  innerBrush.position.y = -0.5;
  innerBrush.updateMatrixWorld();

  const doorGeo = new THREE.BoxGeometry(3, 4.2, 5);
  const doorBrush = new Brush(doorGeo);
  doorBrush.position.set(0, -2, 6);
  doorBrush.updateMatrixWorld();

  let res = evaluator.evaluate(outerBrush, innerBrush, SUBTRACTION);
  res = evaluator.evaluate(res, doorBrush, SUBTRACTION);
  return res.geometry;
}

function makeHollowGrassMoundGeometry() {
  const evaluator = new Evaluator();
  const solidGeo = new THREE.CylinderGeometry(8 / Math.SQRT2, 18 / Math.SQRT2, 12, 4);
  solidGeo.rotateY(Math.PI / 4);

  const outerBrush = new Brush(solidGeo);
  outerBrush.updateMatrixWorld();

  const innerGeo = new THREE.CylinderGeometry(7 / Math.SQRT2, 16 / Math.SQRT2, 12, 4);
  innerGeo.rotateY(Math.PI / 4);
  const innerBrush = new Brush(innerGeo);
  innerBrush.position.y = -0.5;
  innerBrush.updateMatrixWorld();

  const doorBrush = new Brush(new THREE.BoxGeometry(3, 4.2, 10));
  doorBrush.position.set(0, -4, 7.5);
  doorBrush.updateMatrixWorld();

  let res = evaluator.evaluate(outerBrush, innerBrush, SUBTRACTION);
  res = evaluator.evaluate(res, doorBrush, SUBTRACTION);
  return res.geometry;
}

function makeHollowEntranceGeometry() {
  const evaluator = new Evaluator();
  const solidGeo = new THREE.BoxGeometry(6, 6, 2);
  const outerBrush = new Brush(solidGeo);
  outerBrush.updateMatrixWorld();

  const holeBrush = new Brush(new THREE.BoxGeometry(3, 4.2, 3));
  holeBrush.position.set(0, -1, 0);
  holeBrush.updateMatrixWorld();

  return evaluator.evaluate(outerBrush, holeBrush, SUBTRACTION).geometry;
}

function makeHorizontalPlaneGeometry() {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function makePoleAngleGeometry() {
  const geo = new THREE.BoxGeometry(0.6, 0.6, 3);
  geo.rotateX(-Math.PI / 4);
  return geo;
}

const MUSHROOM_HUT_GEOMETRY = makeMushroomGeometry();
const HOLLOW_STEM_GEOMETRY = makeHollowStemGeometry();
const HOLLOW_GRASS_MOUND_GEOMETRY = makeHollowGrassMoundGeometry();
const HOLLOW_ENTRANCE_GEOMETRY = makeHollowEntranceGeometry();
const HUT_DOOR_GEOMETRY = new THREE.PlaneGeometry(3, 4);
const HUT_WINDOW_GEOMETRY = new THREE.PlaneGeometry(1.5, 1.5);
const HUT_TOP_ROOF_GEOMETRY = new THREE.BoxGeometry(8, 0.4, 8);
const HUT_FLOOR_GEOMETRY = makeHorizontalPlaneGeometry();
const HUT_PATH_GEOMETRY = new THREE.PlaneGeometry(3, 12);

const LANTERN_BASE_GEOMETRY = new THREE.BoxGeometry(1.6, 0.4, 1.6);
const LANTERN_TOP_GEOMETRY = new THREE.BoxGeometry(1.6, 0.4, 1.6);
const LANTERN_CAP_GEOMETRY = new THREE.BoxGeometry(1.0, 0.4, 1.0);
const LANTERN_GLASS_GEOMETRY = new THREE.BoxGeometry(1.1, 1.6, 1.1);
const LANTERN_FRAME_GEOMETRY = new THREE.BoxGeometry(0.2, 1.6, 0.2);
const LANTERN_GLOW_GEOMETRY = new THREE.SphereGeometry(1.55, 8, 6);
const LANTERN_OUTER_GLOW_GEOMETRY = new THREE.SphereGeometry(2.35, 8, 6);
const LANTERN_CHAIN_GEOMETRY = new THREE.BoxGeometry(0.2, 2, 0.2);
const LANTERN_POLE_VERTICAL_GEOMETRY = new THREE.BoxGeometry(0.8, 16, 0.8);
const LANTERN_POLE_HORIZONTAL_GEOMETRY = new THREE.BoxGeometry(0.8, 0.8, 6);
const LANTERN_POLE_ANGLE_GEOMETRY = makePoleAngleGeometry();

const HUT_GLASS_MATERIAL = new THREE.MeshStandardMaterial({ color: "#88ccff", roughness: 0.2 });
const HUT_IRON_MATERIAL = new THREE.MeshStandardMaterial({ color: "#222222", roughness: 0.8 });
const LANTERN_GLOW_MATERIAL = new THREE.MeshBasicMaterial({ color: "#ffd36f", transparent: true, opacity: 0.98, toneMapped: false });
const LANTERN_GLOW_HALO_MATERIAL = new THREE.MeshBasicMaterial({
  color: "#ff9d36",
  transparent: true,
  opacity: 0.34,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
});
const LANTERN_OUTER_GLOW_MATERIAL = new THREE.MeshBasicMaterial({
  color: "#ffd56f",
  transparent: true,
  opacity: 0.13,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
});
const HUT_PATH_MATERIAL = new THREE.MeshStandardMaterial({ color: "#c2a077" });

export function Huts() {
  // --- Textures ---
  const mushroomCapTextures = useMemo(createMushroomCapTextures, []);
  const stemWallTexture = useMemo(createStemWallTexture, []);
  const dirtDoorTexture = useMemo(createDirtDoorTexture, []);
  const grassTexture = useMemo(createGrassTexture, []);
  const logTexture = useMemo(createLogTexture, []);
  const dirtGrassTexture = useMemo(createDirtGrassTexture, []);
  const woodPlankTexture = useMemo(createWoodPlankTexture, []);
  const dirtWallTexture = useMemo(createDirtWallTexture, []);

  // --- Materials ---
  const mushroomMats = useMemo(() => {
    const materials = new Array<THREE.MeshStandardMaterial>(mushroomCapTextures.length);
    for (let index = 0; index < mushroomCapTextures.length; index += 1) {
      materials[index] = new THREE.MeshStandardMaterial({ map: mushroomCapTextures[index], roughness: 0.9, side: THREE.DoubleSide });
    }
    return materials;
  }, [mushroomCapTextures]);
  const stemMat = useMemo(() => new THREE.MeshStandardMaterial({ map: stemWallTexture, roughness: 1.0, side: THREE.DoubleSide }), [stemWallTexture]);
  const grassMat = useMemo(() => new THREE.MeshStandardMaterial({ map: grassTexture, roughness: 1.0, side: THREE.DoubleSide }), [grassTexture]);
  const stoneworkMat = useMemo(() => new THREE.MeshStandardMaterial({ map: dirtWallTexture, roughness: 0.9, side: THREE.DoubleSide }), [dirtWallTexture]);
  const doorMat = useMemo(() => new THREE.MeshStandardMaterial({ map: dirtDoorTexture, roughness: 1.0, side: THREE.DoubleSide }), [dirtDoorTexture]);
  const woodPlankMat = useMemo(() => new THREE.MeshStandardMaterial({ map: woodPlankTexture, roughness: 0.9 }), [woodPlankTexture]);
  const logMat = useMemo(() => new THREE.MeshStandardMaterial({ map: logTexture, roughness: 0.9, side: THREE.DoubleSide }), [logTexture]);
  const dirtGrassMat = useMemo(() => new THREE.MeshStandardMaterial({ map: dirtGrassTexture, roughness: 1.0, side: THREE.DoubleSide }), [dirtGrassTexture]);

  const Lantern = ({ position, chainLength = 2 }: { position: [number, number, number], chainLength?: number }) => (
    <group position={position}>
      {/* Hitboxes */}
      <CuboidCollider args={[0.1, chainLength / 2, 0.1]} position={[0, 1.2 + chainLength/2, 0]} />
      <CuboidCollider args={[0.8, 1.3, 0.8]} position={[0, -0.1, 0]} />

      <mesh geometry={LANTERN_CHAIN_GEOMETRY} scale={[1, chainLength / 2, 1]} material={HUT_IRON_MATERIAL} position={[0, 1.2 + chainLength/2, 0]} castShadow />
      
      <mesh geometry={LANTERN_CAP_GEOMETRY} material={HUT_IRON_MATERIAL} position={[0, 1.0, 0]} castShadow />
      <mesh geometry={LANTERN_TOP_GEOMETRY} material={HUT_IRON_MATERIAL} position={[0, 0.6, 0]} castShadow />
      
      <mesh geometry={LANTERN_OUTER_GLOW_GEOMETRY} material={LANTERN_OUTER_GLOW_MATERIAL} position={[0, -0.4, 0]} renderOrder={4} />
      <mesh geometry={LANTERN_GLOW_GEOMETRY} material={LANTERN_GLOW_HALO_MATERIAL} position={[0, -0.4, 0]} renderOrder={5} />
      <mesh geometry={LANTERN_GLASS_GEOMETRY} material={LANTERN_GLOW_MATERIAL} position={[0, -0.4, 0]} />
      
      <mesh geometry={LANTERN_FRAME_GEOMETRY} material={HUT_IRON_MATERIAL} position={[-0.7, -0.4, -0.7]} castShadow />
      <mesh geometry={LANTERN_FRAME_GEOMETRY} material={HUT_IRON_MATERIAL} position={[0.7, -0.4, -0.7]} castShadow />
      <mesh geometry={LANTERN_FRAME_GEOMETRY} material={HUT_IRON_MATERIAL} position={[-0.7, -0.4, 0.7]} castShadow />
      <mesh geometry={LANTERN_FRAME_GEOMETRY} material={HUT_IRON_MATERIAL} position={[0.7, -0.4, 0.7]} castShadow />
      
      <mesh geometry={LANTERN_BASE_GEOMETRY} material={HUT_IRON_MATERIAL} position={[0, -1.4, 0]} castShadow />
    </group>
  );

  const huts = useMemo(() => getHutList(), []);

  return (
    <>
      {huts.map((hut) => (
        <RigidBody key={hut.id} type="fixed" position={[hut.x, hut.y, hut.z]} colliders={false}>
          {hut.hasPath && (
             <group rotation={[0, hut.pathRot, 0]}>
               <mesh geometry={HUT_PATH_GEOMETRY} material={HUT_PATH_MATERIAL} rotation={[-Math.PI/2, 0, 0]} position={[0, 0.05, 10]} />
             </group>
          )}
          {hut.hutType === 0 && ( // Mushroom
            <group rotation={[0, hut.rotation, 0]}>
              <group>
                <MushroomHutColliders />
                <mesh geometry={HUT_FLOOR_GEOMETRY} material={woodPlankMat} scale={[10, 1, 10]} position={[0, 0.1, 0]} receiveShadow />
                <mesh geometry={HOLLOW_STEM_GEOMETRY} material={stemMat} position={[0, 4, 0]} castShadow receiveShadow />
                <mesh geometry={MUSHROOM_HUT_GEOMETRY} material={mushroomMats[hut.colorIndex]} position={[0, 13, 0]} castShadow receiveShadow />
                
                <mesh geometry={HUT_DOOR_GEOMETRY} material={doorMat} position={[0, 2, 6.01]} castShadow />
                <mesh geometry={HUT_WINDOW_GEOMETRY} material={HUT_GLASS_MATERIAL} position={[-3.5, 4.5, 6.01]} />
                <mesh geometry={HUT_WINDOW_GEOMETRY} material={HUT_GLASS_MATERIAL} position={[3.5, 4.5, 6.01]} />
                <Lantern position={[7.5, 6, 7.5]} chainLength={2.5} />
              </group>
            </group>
          )}

          {hut.hutType === 1 && ( // Grass Mound
            <group rotation={[0, hut.rotation, 0]}>
              <group>
                <MoundHutColliders />
                <mesh geometry={HUT_FLOOR_GEOMETRY} material={woodPlankMat} scale={[16, 1, 16]} position={[0, 0.1, 0]} receiveShadow />
                <mesh geometry={HOLLOW_GRASS_MOUND_GEOMETRY} material={grassMat} position={[0, 6, 0]} castShadow receiveShadow />
                <mesh geometry={HOLLOW_ENTRANCE_GEOMETRY} material={stoneworkMat} position={[0, 3, 7.5]} castShadow receiveShadow />
                
                <mesh geometry={HUT_DOOR_GEOMETRY} material={doorMat} position={[0, 2, 8.51]} />
                
                <group>
                  <CuboidCollider args={[0.4, 8, 0.4]} position={[-3, 8, 2]} />
                  <CuboidCollider args={[0.4, 0.4, 3]} position={[-3, 15.6, 5.6]} />
                  <CuboidCollider args={[0.3, 0.3, 1.5]} position={[-3, 14.2, 3.2]} rotation={[-Math.PI / 4, 0, 0]} />
                  <mesh geometry={LANTERN_POLE_VERTICAL_GEOMETRY} material={HUT_IRON_MATERIAL} position={[-3, 8, 2]} castShadow />
                  <mesh geometry={LANTERN_POLE_HORIZONTAL_GEOMETRY} material={HUT_IRON_MATERIAL} position={[-3, 15.6, 5.6]} castShadow />
                  <mesh geometry={LANTERN_POLE_ANGLE_GEOMETRY} material={HUT_IRON_MATERIAL} position={[-3, 14.2, 3.2]} castShadow />
                </group>
                <Lantern position={[-3, 13, 9.2]} chainLength={3} />
              </group>
            </group>
          )}

          {hut.hutType === 2 && ( // Log Hut
            <group rotation={[0, hut.rotation, 0]}>
              <group>
                <MoundHutColliders hasFlatRoof />
                <mesh geometry={HUT_FLOOR_GEOMETRY} material={woodPlankMat} scale={[16, 1, 16]} position={[0, 0.1, 0]} receiveShadow />

                <mesh geometry={HOLLOW_GRASS_MOUND_GEOMETRY} material={logMat} position={[0, 6, 0]} castShadow receiveShadow />
                <mesh geometry={HOLLOW_ENTRANCE_GEOMETRY} material={logMat} position={[0, 3, 7.5]} castShadow receiveShadow />
                <mesh geometry={HUT_TOP_ROOF_GEOMETRY} material={woodPlankMat} position={[0, 12, 0]} castShadow receiveShadow />
                
                <mesh geometry={HUT_DOOR_GEOMETRY} material={doorMat} position={[0, 2, 8.51]} />
                
                <group>
                  <CuboidCollider args={[0.4, 8, 0.4]} position={[-3, 8, 2]} />
                  <CuboidCollider args={[0.4, 0.4, 3]} position={[-3, 15.5, 5]} />
                  <mesh geometry={LANTERN_POLE_VERTICAL_GEOMETRY} material={HUT_IRON_MATERIAL} position={[-3, 8, 2]} castShadow />
                  <mesh geometry={LANTERN_POLE_HORIZONTAL_GEOMETRY} material={HUT_IRON_MATERIAL} position={[-3, 15.5, 5]} castShadow />
                </group>
                <Lantern position={[-3, 13, 9.2]} chainLength={3} />
              </group>
            </group>
          )}

          {hut.hutType === 3 && ( // Dirt/Stone Hut with Grass Roof
            <group rotation={[0, hut.rotation, 0]}>
              <group>
                <MoundHutColliders hasFlatRoof />
                <mesh geometry={HUT_FLOOR_GEOMETRY} material={woodPlankMat} scale={[16, 1, 16]} position={[0, 0.1, 0]} receiveShadow />

                <mesh geometry={HOLLOW_GRASS_MOUND_GEOMETRY} material={dirtGrassMat} position={[0, 6, 0]} castShadow receiveShadow />
                <mesh geometry={HOLLOW_ENTRANCE_GEOMETRY} material={stoneworkMat} position={[0, 3, 7.5]} castShadow receiveShadow />
                <mesh geometry={HUT_TOP_ROOF_GEOMETRY} material={grassMat} position={[0, 12, 0]} castShadow receiveShadow />
                
                <mesh geometry={HUT_DOOR_GEOMETRY} material={doorMat} position={[0, 2, 8.51]} />
                
                <group>
                  <CuboidCollider args={[0.4, 8, 0.4]} position={[-3, 8, 2]} />
                  <CuboidCollider args={[0.4, 0.4, 3]} position={[-3, 15.5, 5]} />
                  <mesh geometry={LANTERN_POLE_VERTICAL_GEOMETRY} material={HUT_IRON_MATERIAL} position={[-3, 8, 2]} castShadow />
                  <mesh geometry={LANTERN_POLE_HORIZONTAL_GEOMETRY} material={HUT_IRON_MATERIAL} position={[-3, 15.5, 5]} castShadow />
                </group>
                <Lantern position={[-3, 13, 9.2]} chainLength={3} />
              </group>
            </group>
          )}
        </RigidBody>
      ))}
    </>
  );
}
