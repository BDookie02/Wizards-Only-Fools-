import { Fragment, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SURVIVAL_BLOCK_SIZE, type CharacterCustomization } from "../../../../store/gameStore";
import { AvatarBillboard, NPC_AVATAR_GROUND_LIFT, NPC_AVATAR_SCALE } from "../../../PixelAvatar";
import { getCachedIndexRange } from "../../rendering/indexRange";
import { isMobilePerformanceMode } from "../../input/performanceMode";
import { shouldRenderSurvivalChunkSkirt } from "../survival/survivalChunks";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import { useLazyRef } from "../../react/useLazyRef";
import { FoliageDodeca } from "../vegetation/SurvivalFoliagePrimitives";
import { finalizeSurvivalInstancedMesh } from "../vegetation/survivalInstancing";
import { useSurvivalFeatureCount } from "../../../tools/qa/survivalFeatureCounters";
import {
  getChicagoAdTextures,
  getChicagoFacadeMaterials,
  getChicagoFacadeTextures,
  getChicagoLedSignTexture,
  getChicagoSignTexture,
  getChicagoStoreSignTextures,
} from "./survivalChicagoCityTextures";
import {
  CHICAGO_BEAN_BOLLARD_X,
  CHICAGO_BEAN_PARK_X,
  CHICAGO_BEAN_PARK_Z,
  CHICAGO_BENCH_LEG_X,
  CHICAGO_CAR_WHEEL_SIDES,
  CHICAGO_CITY_HALF_SIZE,
  CHICAGO_LED_SIGN_UPDATE_INTERVAL_SECONDS,
  CHICAGO_PEDESTRIAN_UPDATE_INTERVAL_SECONDS,
  CHICAGO_ROAD_POSITIONS,
  CHICAGO_SIDE_SIGNS,
  CHICAGO_TRAFFIC_LIGHT_POLES,
  CHICAGO_TRAFFIC_SIGNAL_LIGHTS,
  CHICAGO_TRAFFIC_UPDATE_INTERVAL_SECONDS,
  MOBILE_CHICAGO_LED_SIGN_UPDATE_INTERVAL_SECONDS,
  MOBILE_CHICAGO_PEDESTRIAN_UPDATE_INTERVAL_SECONDS,
  MOBILE_CHICAGO_TRAFFIC_UPDATE_INTERVAL_SECONDS,
  makeChicagoLampLayout,
  makeChicagoLayout,
  makeChicagoSidewalkSegments,
  makeChicagoStreetTreeLayout,
  makeChicagoTrafficLightIntersections,
  type ChicagoBuilding,
  type ChicagoCar,
  type ChicagoPedestrian,
} from "./survivalChicagoCityLayout";
import {
  getChicagoCarLengthScale,
  getChicagoCarLightBarColor,
  getChicagoCarSideMarkColor,
  getChicagoPedestrianTransform,
  getChicagoTaxiCarInstances,
  groupChicagoCarsByColor,
  isChicagoLightBarVehicle,
  makeChicagoCarInstances,
  setChicagoInstancedPart,
  writeChicagoVehicleTransform,
  type ChicagoVehicleTransform,
} from "./survivalChicagoCityTrafficRuntime";
import {
  groupChicagoCrosswalkStripes,
  groupChicagoGrassPatches,
  makeChicagoBenchLayout,
  makeChicagoCrosswalkStripes,
  makeChicagoGrassPatches,
  makeChicagoHydrantLayout,
  makeChicagoParkingLines,
  makeChicagoSidewalkPlanes,
  makeChicagoTrashCanLayout,
  setChicagoFlatPlaneInstancedPart,
} from "./survivalChicagoCityStreetRuntime";
import { ChicagoCityColliders } from "./survivalChicagoCityColliders";

type SurvivalVillageBaseHeightForChunk = (chunk: SurvivalChunkInfo) => number;
type SurvivalVillageGeometryFactory = (chunk: SurvivalChunkInfo) => THREE.BufferGeometry;

type ChicagoBuildingGroup = ChicagoBuilding[];

const CHICAGO_UNIT_BOX_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const CHICAGO_BUILDING_ROOF_MATERIAL = new THREE.MeshBasicMaterial({ color: "#475569" });

function ChicagoCitySurface({
  geometry,
  baseHeight,
}: {
  geometry: THREE.BufferGeometry;
  baseHeight: number;
}) {
  const roadPositions = CHICAGO_ROAD_POSITIONS;

  return (
    <group>
      <mesh geometry={geometry} receiveShadow dispose={null}>
        <meshBasicMaterial color="#52664f" vertexColors />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.075, 0]} receiveShadow>
        <planeGeometry args={[CHICAGO_CITY_HALF_SIZE * 2, CHICAGO_CITY_HALF_SIZE * 2]} />
        <meshBasicMaterial color="#4b5563" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[221, baseHeight + 0.16, 0]} renderOrder={1}>
        <planeGeometry args={[84, SURVIVAL_BLOCK_SIZE]} />
        <meshBasicMaterial color="#2563eb" transparent opacity={0.74} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[178, baseHeight + 0.23, 0]} renderOrder={2}>
        <planeGeometry args={[10, SURVIVAL_BLOCK_SIZE]} />
        <meshBasicMaterial color="#9ca3af" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[18, baseHeight + 0.24, 0]} renderOrder={3}>
        <planeGeometry args={[372, 24]} />
        <meshBasicMaterial color="#0f5d87" transparent opacity={0.92} />
      </mesh>
      {roadPositions.map((x) => (
        <group key={`chicago-vertical-road-${x}`}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, baseHeight + 0.28, 0]} renderOrder={4}>
            <planeGeometry args={[42, CHICAGO_CITY_HALF_SIZE * 2]} />
            <meshBasicMaterial color="#9ca3af" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, baseHeight + 0.31, 0]} renderOrder={5}>
            <planeGeometry args={[28, CHICAGO_CITY_HALF_SIZE * 2]} />
            <meshBasicMaterial color="#1f2937" />
          </mesh>
        </group>
      ))}
      {roadPositions.map((z) => (
        <group key={`chicago-horizontal-road-${z}`}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.29, z]} renderOrder={4}>
            <planeGeometry args={[CHICAGO_CITY_HALF_SIZE * 2, 42]} />
            <meshBasicMaterial color="#9ca3af" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, baseHeight + 0.32, z]} renderOrder={5}>
            <planeGeometry args={[CHICAGO_CITY_HALF_SIZE * 2, 28]} />
            <meshBasicMaterial color="#1f2937" />
          </mesh>
          {getCachedIndexRange(9).map((index) => (
            <mesh key={`lane-dash-${z}-${index}`} rotation={[-Math.PI / 2, 0, 0]} position={[-198 + index * 48, baseHeight + 0.36, z]} renderOrder={6}>
              <planeGeometry args={[17, 1.4]} />
              <meshBasicMaterial color="#f8fafc" transparent opacity={0.72} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CHICAGO_BEAN_PARK_X, baseHeight + 0.42, CHICAGO_BEAN_PARK_Z]} renderOrder={7}>
        <circleGeometry args={[39, 52]} />
        <meshBasicMaterial color="#3f7c3b" side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CHICAGO_BEAN_PARK_X, baseHeight + 0.455, CHICAGO_BEAN_PARK_Z]} renderOrder={8}>
        <ringGeometry args={[23, 34, 52]} />
        <meshBasicMaterial color="#cbd5e1" side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CHICAGO_BEAN_PARK_X, baseHeight + 0.47, CHICAGO_BEAN_PARK_Z + 33]} renderOrder={9}>
        <planeGeometry args={[9, 18]} />
        <meshBasicMaterial color="#d8dee6" />
      </mesh>
    </group>
  );
}

function ChicagoRevolvingLedSign({
  width,
  depth,
  y,
}: {
  width: number;
  depth: number;
  y: number;
}) {
  const signRef = useRef<THREE.Group>(null);
  const lastSignUpdateRef = useRef(-1);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const signTexture = useMemo(() => getChicagoLedSignTexture(), []);
  const radius = Math.max(width, depth) * 0.86;
  const signHeight = 22.5;

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const updateInterval = mobilePerformanceMode
      ? MOBILE_CHICAGO_LED_SIGN_UPDATE_INTERVAL_SECONDS
      : CHICAGO_LED_SIGN_UPDATE_INTERVAL_SECONDS;
    if (elapsed - lastSignUpdateRef.current < updateInterval) return;
    lastSignUpdateRef.current = elapsed;
    if (signRef.current) signRef.current.rotation.y = elapsed * 0.55;
    signTexture.offset.x = -elapsed * 0.12;
  });

  return (
    <group ref={signRef} position={[0, y, 0]} frustumCulled={false}>
      <mesh castShadow={false}>
        <cylinderGeometry args={[radius + 1.15, radius + 1.15, signHeight + 3.1, 48, 1, true]} />
        <meshBasicMaterial color="#020617" transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh castShadow={false}>
        <cylinderGeometry args={[radius, radius, signHeight, 64, 1, true]} />
        <meshBasicMaterial
          map={signTexture}
          color="#ffffff"
          transparent
          opacity={0.98}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function ChicagoBuildings({
  buildings,
  baseHeight,
  showDetails,
}: {
  buildings: ChicagoBuilding[];
  baseHeight: number;
  showDetails: boolean;
}) {
  const bodyRefs = useLazyRef<Array<THREE.InstancedMesh | null>>(() => []);
  const roofRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const facadeTextures = useMemo(() => getChicagoFacadeTextures(), []);
  const bodyMaterials = useMemo(() => getChicagoFacadeMaterials(), []);
  const buildingGroups = useMemo(() => {
    const groups = new Array<ChicagoBuildingGroup>(facadeTextures.length);
    for (let style = 0; style < facadeTextures.length; style += 1) {
      groups[style] = [];
    }
    for (let index = 0; index < buildings.length; index += 1) {
      const building = buildings[index];
      const style = building.facadeStyle;
      if (style < 0 || style >= groups.length) continue;
      groups[style].push(building);
    }
    return groups;
  }, [buildings, facadeTextures]);

  useEffect(() => {
    const roofMesh = roofRef.current;
    if (!roofMesh) return;

    for (let styleIndex = 0; styleIndex < buildingGroups.length; styleIndex += 1) {
      const group = buildingGroups[styleIndex];
      const bodyMesh = bodyRefs.current[styleIndex];
      if (!bodyMesh) continue;

      bodyMesh.count = group.length;
      for (let index = 0; index < group.length; index += 1) {
        const building = group[index];
        dummy.position.set(building.localX, baseHeight + building.height / 2, building.localZ);
        dummy.rotation.set(0, building.rotation, 0);
        dummy.scale.set(building.width, building.height, building.depth);
        dummy.updateMatrix();
        bodyMesh.setMatrixAt(index, dummy.matrix);
      }

      bodyMesh.instanceMatrix.needsUpdate = true;
      finalizeSurvivalInstancedMesh(bodyMesh, 0, 0, CHICAGO_CITY_HALF_SIZE + 80, baseHeight + 92);
    }

    for (let index = 0; index < buildings.length; index += 1) {
      const building = buildings[index];
      dummy.position.set(building.localX, baseHeight + building.height + 1.3, building.localZ);
      dummy.rotation.set(0, building.rotation, 0);
      dummy.scale.set(building.width + 3.4, 2.6, building.depth + 3.4);
      dummy.updateMatrix();
      roofMesh.setMatrixAt(index, dummy.matrix);
    }

    roofMesh.count = buildings.length;
    finalizeSurvivalInstancedMesh(roofMesh, 0, 0, CHICAGO_CITY_HALF_SIZE + 80, baseHeight + 112);
  }, [baseHeight, buildingGroups, buildings, dummy]);

  const landmarks = useMemo(() => {
    if (!showDetails) return [] as ChicagoBuilding[];
    const items: ChicagoBuilding[] = [];
    for (let index = 0; index < buildings.length; index += 1) {
      const building = buildings[index];
      if (building.landmark) items.push(building);
    }
    return items;
  }, [buildings, showDetails]);

  return (
    <group>
      {buildingGroups.map((group, styleIndex) => (
        <instancedMesh
          key={`chicago-facade-style-${styleIndex}`}
          ref={(mesh) => {
            bodyRefs.current[styleIndex] = mesh;
          }}
          args={[CHICAGO_UNIT_BOX_GEOMETRY, bodyMaterials[styleIndex], Math.max(1, group.length)]}
          castShadow={false}
          receiveShadow
        />
      ))}
      <instancedMesh ref={roofRef} args={[CHICAGO_UNIT_BOX_GEOMETRY, CHICAGO_BUILDING_ROOF_MATERIAL, buildings.length]} castShadow={false} receiveShadow={false} />
      {landmarks.map((building) => (
        <group key={`${building.key}-landmark-details`} position={[building.localX, baseHeight, building.localZ]} rotation={[0, building.rotation, 0]}>
          {building.landmark === "willis" && (
            <>
              <mesh position={[-7.2, building.height + 18, -3]} castShadow={false}>
                <cylinderGeometry args={[0.55, 0.75, 34, 5]} />
                <meshBasicMaterial color="#475569" />
              </mesh>
              <mesh position={[7.2, building.height + 18, 3]} castShadow={false}>
                <cylinderGeometry args={[0.55, 0.75, 34, 5]} />
                <meshBasicMaterial color="#475569" />
              </mesh>
              <mesh position={[0, building.height + 4.6, 0]} castShadow={false}>
                <boxGeometry args={[building.width * 0.52, 4.4, building.depth * 0.52]} />
                <meshBasicMaterial color="#334155" />
              </mesh>
            </>
          )}
          {building.landmark === "hancock" && (
            <>
              {CHICAGO_SIDE_SIGNS.map((side) => (
                <mesh key={`x-brace-${side}`} position={[0, building.height * 0.56, side * (building.depth / 2 + 0.14)]} rotation={[0, 0, side * 0.74]} castShadow={false}>
                  <boxGeometry args={[building.width * 1.18, 1.25, 0.42]} />
                  <meshBasicMaterial color="#334155" />
                </mesh>
              ))}
              <mesh position={[0, building.height + 10, 0]} castShadow={false}>
                <cylinderGeometry args={[0.45, 0.65, 20, 5]} />
                <meshBasicMaterial color="#475569" />
              </mesh>
            </>
          )}
          {building.landmark === "watertower" && (
            <mesh position={[0, building.height + 6.2, 0]} castShadow={false}>
              <coneGeometry args={[9, 12, 4]} />
              <meshBasicMaterial color="#e5e7eb" />
            </mesh>
          )}
          {building.landmark === "skyscraper" && (
            <>
              <ChicagoRevolvingLedSign width={building.width} depth={building.depth} y={92} />
              <mesh position={[0, building.height + 7.4, 0]} castShadow={false}>
                <boxGeometry args={[building.width * 0.58, 12.2, building.depth * 0.58]} />
                <meshBasicMaterial color="#dbeafe" transparent opacity={0.88} />
              </mesh>
              <mesh position={[0, building.height + 21.5, 0]} castShadow={false}>
                <coneGeometry args={[building.width * 0.24, 20, 4]} />
                <meshBasicMaterial color="#cbd5e1" />
              </mesh>
              <mesh position={[0, building.height + 44, 0]} castShadow={false}>
                <cylinderGeometry args={[0.72, 1.1, 38, 6]} />
                <meshBasicMaterial color="#e5e7eb" />
              </mesh>
              {CHICAGO_SIDE_SIGNS.map((side) => (
                <Fragment key={`skyscraper-light-bars-${side}`}>
                  <mesh position={[side * (building.width / 2 + 0.24), building.height * 0.52, 0]} castShadow={false}>
                    <boxGeometry args={[0.42, building.height * 0.84, 1.2]} />
                    <meshBasicMaterial color="#bae6fd" transparent opacity={0.64} />
                  </mesh>
                  <mesh position={[0, building.height * 0.52, side * (building.depth / 2 + 0.24)]} castShadow={false}>
                    <boxGeometry args={[1.2, building.height * 0.84, 0.42]} />
                    <meshBasicMaterial color="#bae6fd" transparent opacity={0.64} />
                  </mesh>
                </Fragment>
              ))}
            </>
          )}
        </group>
      ))}
    </group>
  );
}

function ChicagoBuildingDetails({
  buildings,
  baseHeight,
  showDetails,
}: {
  buildings: ChicagoBuilding[];
  baseHeight: number;
  showDetails: boolean;
}) {
  const storeSigns = useMemo(() => getChicagoStoreSignTextures(), []);
  const adTextures = useMemo(() => getChicagoAdTextures(), []);
  if (!showDetails) return null;

  return (
    <group name="chicago-building-details">
      {buildings.map((building, index) => {
        const signTexture = storeSigns[index % storeSigns.length];
        const adTexture = adTextures[index % adTextures.length];
        const storefrontWidth = Math.min(building.width - 4, 26);
        const hasAdPanel = building.height > 72 && index % 3 === 0;

        return (
          <group
            key={`${building.key}-city-detail`}
            position={[building.localX, baseHeight, building.localZ]}
            rotation={[0, building.rotation, 0]}
          >
            <mesh position={[0, 3.55, building.depth / 2 + 0.24]} castShadow={false}>
              <boxGeometry args={[building.enterable ? 8.4 : 6.2, building.enterable ? 8.4 : 7.1, 0.5]} />
              <meshBasicMaterial color={building.enterable ? "#020617" : "#101827"} />
            </mesh>
            <mesh position={[0, 3.8, building.depth / 2 + 0.54]} castShadow={false}>
              <boxGeometry args={[building.enterable ? 5.9 : 4.35, building.enterable ? 6.5 : 5.6, 0.34]} />
              <meshBasicMaterial color={building.enterable ? "#0f172a" : "#7dd3fc"} transparent opacity={building.enterable ? 0.86 : 0.72} />
            </mesh>
            {building.enterable && (
              <mesh position={[0, 7.65, building.depth / 2 + 0.72]} castShadow={false}>
                <boxGeometry args={[5.8, 0.54, 0.4]} />
                <meshBasicMaterial color="#22c55e" transparent opacity={0.88} />
              </mesh>
            )}
            <mesh position={[0, 8.35, building.depth / 2 + 0.52]} castShadow={false}>
              <boxGeometry args={[storefrontWidth, 1.15, 0.48]} />
              <meshBasicMaterial color="#111827" />
            </mesh>
            <mesh position={[0, 10.15, building.depth / 2 + 0.62]} castShadow={false}>
              <planeGeometry args={[Math.min(building.width * 0.72, 24), 5.2]} />
              <meshBasicMaterial map={signTexture} transparent alphaTest={0.04} side={THREE.DoubleSide} />
            </mesh>
            {CHICAGO_SIDE_SIGNS.map((side) => (
              <mesh key={`${building.key}-store-window-${side}`} position={[side * storefrontWidth * 0.28, 4.4, building.depth / 2 + 0.42]} castShadow={false}>
                <boxGeometry args={[4.1, 4.7, 0.38]} />
                <meshBasicMaterial color="#bae6fd" transparent opacity={0.62} />
              </mesh>
            ))}
            {hasAdPanel && (
              <>
                <mesh position={[0, building.height * 0.55, building.depth / 2 + 0.72]} castShadow={false}>
                  <planeGeometry args={[Math.min(building.width * 0.68, 22), 31]} />
                  <meshBasicMaterial map={adTexture} transparent alphaTest={0.04} side={THREE.DoubleSide} />
                </mesh>
                <mesh position={[0, building.height * 0.55, building.depth / 2 + 0.56]} castShadow={false}>
                  <boxGeometry args={[Math.min(building.width * 0.72, 23.4), 32.4, 0.26]} />
                  <meshBasicMaterial color="#020617" transparent opacity={0.72} />
                </mesh>
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}

function ChicagoInteriorVillager({ character }: { character: CharacterCustomization }) {
  return (
    <group
      name="chicago-interior-villager"
      position={[0, 0.95 + NPC_AVATAR_GROUND_LIFT, 0]}
      scale={[NPC_AVATAR_SCALE, NPC_AVATAR_SCALE, NPC_AVATAR_SCALE]}
    >
      <AvatarBillboard character={character} animation="idle" yaw={Math.PI} health={100} staticFrame fixedDirection={0} />
    </group>
  );
}

function ChicagoBuildingInteriors({
  buildings,
  baseHeight,
  showDetails,
}: {
  buildings: ChicagoBuilding[];
  baseHeight: number;
  showDetails: boolean;
}) {
  if (!showDetails) return null;
  const enterableBuildings: ChicagoBuilding[] = [];
  for (let index = 0; index < buildings.length; index += 1) {
    const building = buildings[index];
    if (building.enterable) enterableBuildings.push(building);
  }

  return (
    <group name="chicago-building-interiors">
      {enterableBuildings.map((building, index) => {
        const roomWidth = Math.max(10, Math.min(building.width - 4.8, 20));
        const roomDepth = Math.max(10, Math.min(building.depth - 5.2, 18));
        const frontZ = building.depth / 2;
        const roomCenterZ = frontZ - roomDepth / 2 - 2.2;

        return (
          <group
            key={`${building.key}-interior`}
            position={[building.localX, baseHeight + 0.5, building.localZ]}
            rotation={[0, building.rotation, 0]}
          >
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, roomCenterZ]} renderOrder={11}>
              <planeGeometry args={[roomWidth, roomDepth]} />
              <meshBasicMaterial color={index % 2 === 0 ? "#4b5563" : "#3f3f46"} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 2.4, frontZ - roomDepth - 2.2]} castShadow={false}>
              <boxGeometry args={[roomWidth, 4.8, 0.5]} />
              <meshBasicMaterial color="#1f2937" transparent opacity={0.72} />
            </mesh>
            <mesh position={[0, 1.6, frontZ - roomDepth * 0.72]} castShadow={false}>
              <boxGeometry args={[Math.min(roomWidth - 2, 13), 2.1, 2.1]} />
              <meshBasicMaterial color="#7c4a2d" />
            </mesh>
            <mesh position={[0, 2.82, frontZ - roomDepth * 0.72 - 1.1]} castShadow={false}>
              <boxGeometry args={[Math.min(roomWidth - 2, 13.4), 0.42, 2.5]} />
              <meshBasicMaterial color="#a16207" />
            </mesh>
            {CHICAGO_SIDE_SIGNS.map((side) => (
              <mesh key={`${building.key}-interior-shelf-${side}`} position={[side * (roomWidth / 2 - 1.3), 2.2, roomCenterZ - 0.8]} castShadow={false}>
                <boxGeometry args={[1.1, 3.8, roomDepth * 0.52]} />
              <meshBasicMaterial color="#5b3a25" />
            </mesh>
            ))}
            <group position={[0, 0, frontZ - roomDepth * 0.82]}>
              <ChicagoInteriorVillager character={building.operatorCharacter} />
            </group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, frontZ + 1.9]} renderOrder={12}>
              <planeGeometry args={[8.8, 3.2]} />
              <meshBasicMaterial color="#111827" transparent opacity={0.9} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function ChicagoTrafficLights({ baseHeight }: { baseHeight: number }) {
  const intersections = useMemo(() => makeChicagoTrafficLightIntersections(), []);

  return (
    <group name="chicago-traffic-lights">
      {intersections.map((intersection, index) => (
        <group key={`traffic-light-${intersection.key}`}>
          {CHICAGO_TRAFFIC_LIGHT_POLES.map((pole, poleIndex) => (
            <group
              key={`traffic-light-pole-${pole.key}`}
              position={[intersection.x + pole.offsetX, baseHeight + 0.36, intersection.z + pole.offsetZ]}
              rotation={[0, pole.yaw, 0]}
            >
              <mesh position={[0, 4.1, 0]} castShadow={false}>
                <cylinderGeometry args={[0.28, 0.34, 8.2, 6]} />
                <meshBasicMaterial color="#1f2937" />
              </mesh>
              <mesh position={[4.0, 8.1, 0]} rotation={[0, 0, Math.PI / 2]} castShadow={false}>
                <cylinderGeometry args={[0.18, 0.18, 8.1, 6]} />
                <meshBasicMaterial color="#1f2937" />
              </mesh>
              <mesh position={[8.3, 7.55, 0]} castShadow={false}>
                <boxGeometry args={[1.45, 3.4, 1.0]} />
                <meshBasicMaterial color="#111827" />
              </mesh>
              {CHICAGO_TRAFFIC_SIGNAL_LIGHTS.map((light, lightIndex) => (
                <mesh key={`signal-light-${light.color}`} position={[8.32, light.y, 0.55]} castShadow={false}>
                  <sphereGeometry args={[0.33, 8, 6]} />
                  <meshBasicMaterial
                    color={light.color}
                    transparent
                    opacity={(index + poleIndex + lightIndex) % 3 === 0 ? 1 : 0.42}
                  />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

function ChicagoStreetDetails({ baseHeight }: { baseHeight: number }) {
  const sidewalkSegments = useMemo(() => makeChicagoSidewalkSegments(), []);
  const flatPlaneDummy = useMemo(() => new THREE.Object3D(), []);
  const sidewalkRef = useRef<THREE.InstancedMesh>(null);
  const parkingRef = useRef<THREE.InstancedMesh>(null);
  const grassRefs = useLazyRef<Array<THREE.InstancedMesh | null>>(() => []);
  const crosswalkRefs = useLazyRef<Array<THREE.InstancedMesh | null>>(() => []);

  const hydrants = useMemo(() => makeChicagoHydrantLayout(), []);

  const lamps = useMemo(() => makeChicagoLampLayout(), []);

  const trashCans = useMemo(() => makeChicagoTrashCanLayout(), []);

  const benches = useMemo(() => makeChicagoBenchLayout(), []);

  const streetTrees = useMemo(() => makeChicagoStreetTreeLayout(), []);

  const grassPatches = useMemo(() => makeChicagoGrassPatches(), []);

  const crosswalks = useMemo(() => makeChicagoCrosswalkStripes(), []);

  const sidewalkPlanes = useMemo(() => makeChicagoSidewalkPlanes(sidewalkSegments), [sidewalkSegments]);

  const parkingLines = useMemo(() => makeChicagoParkingLines(), []);

  const grassGroups = useMemo(() => groupChicagoGrassPatches(grassPatches), [grassPatches]);

  const crosswalkGroups = useMemo(() => groupChicagoCrosswalkStripes(crosswalks), [crosswalks]);

  useEffect(() => {
    const sidewalkMesh = sidewalkRef.current;
    if (sidewalkMesh) {
      for (let index = 0; index < sidewalkPlanes.length; index += 1) {
        const item = sidewalkPlanes[index];
        setChicagoFlatPlaneInstancedPart(flatPlaneDummy, sidewalkMesh, index, item.x, baseHeight + 0.37, item.z, item.width, item.depth);
      }
      sidewalkMesh.count = sidewalkPlanes.length;
      sidewalkMesh.instanceMatrix.needsUpdate = true;
    }

    const parkingMesh = parkingRef.current;
    if (parkingMesh) {
      for (let index = 0; index < parkingLines.length; index += 1) {
        const item = parkingLines[index];
        setChicagoFlatPlaneInstancedPart(flatPlaneDummy, parkingMesh, index, item.x, baseHeight + 0.395, item.z, item.width, item.depth);
      }
      parkingMesh.count = parkingLines.length;
      parkingMesh.instanceMatrix.needsUpdate = true;
    }

    for (let groupIndex = 0; groupIndex < grassGroups.length; groupIndex += 1) {
      const group = grassGroups[groupIndex];
      const mesh = grassRefs.current[groupIndex];
      if (!mesh) continue;
      for (let index = 0; index < group.items.length; index += 1) {
        const patch = group.items[index];
        setChicagoFlatPlaneInstancedPart(flatPlaneDummy, mesh, index, patch.x, baseHeight + 0.405, patch.z, patch.width, patch.depth);
      }
      mesh.count = group.items.length;
      mesh.instanceMatrix.needsUpdate = true;
    }

    for (let groupIndex = 0; groupIndex < crosswalkGroups.length; groupIndex += 1) {
      const group = crosswalkGroups[groupIndex];
      const mesh = crosswalkRefs.current[groupIndex];
      if (!mesh) continue;
      for (let index = 0; index < group.items.length; index += 1) {
        const stripe = group.items[index];
        setChicagoFlatPlaneInstancedPart(flatPlaneDummy, mesh, index, stripe.x, baseHeight + 0.43, stripe.z, stripe.width, stripe.depth);
      }
      mesh.count = group.items.length;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }, [baseHeight, crosswalkGroups, flatPlaneDummy, grassGroups, parkingLines, sidewalkPlanes]);

  return (
    <group name="chicago-street-details">
      <instancedMesh ref={sidewalkRef} args={[undefined, undefined, Math.max(1, sidewalkPlanes.length)]} renderOrder={7} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#b6bec9" />
      </instancedMesh>
      <instancedMesh ref={parkingRef} args={[undefined, undefined, Math.max(1, parkingLines.length)]} renderOrder={8} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#f8fafc" transparent opacity={0.58} />
      </instancedMesh>
      {grassGroups.map((group, groupIndex) => (
        <instancedMesh
          key={`grass-patches-${group.color}`}
          ref={(mesh) => {
            grassRefs.current[groupIndex] = mesh;
          }}
          args={[undefined, undefined, Math.max(1, group.items.length)]}
          renderOrder={8}
          frustumCulled={false}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color={group.color} transparent opacity={0.82} />
        </instancedMesh>
      ))}
      {crosswalkGroups.map((group, groupIndex) => (
        <instancedMesh
          key={`crosswalks-${group.opacity}`}
          ref={(mesh) => {
            crosswalkRefs.current[groupIndex] = mesh;
          }}
          args={[undefined, undefined, Math.max(1, group.items.length)]}
          renderOrder={10}
          frustumCulled={false}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color="#f8fafc" transparent opacity={group.opacity} side={THREE.DoubleSide} />
        </instancedMesh>
      ))}
      {hydrants.map((hydrant) => (
        <group key={hydrant.key} position={[hydrant.x, baseHeight + 0.56, hydrant.z]}>
          <mesh position={[0, 1.0, 0]} castShadow={false}>
            <cylinderGeometry args={[0.7, 0.74, 2.0, 8]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
          <mesh position={[0, 2.25, 0]} castShadow={false}>
            <sphereGeometry args={[0.78, 8, 6]} />
            <meshBasicMaterial color="#f87171" />
          </mesh>
          <mesh position={[0, 1.55, 0]} rotation={[0, 0, Math.PI / 2]} castShadow={false}>
            <cylinderGeometry args={[0.24, 0.24, 2.2, 6]} />
            <meshBasicMaterial color="#b91c1c" />
          </mesh>
        </group>
      ))}
      {lamps.map((lamp) => (
        <group key={lamp.key} position={[lamp.x, baseHeight + 0.48, lamp.z]} rotation={[0, lamp.rotation, 0]}>
          <mesh position={[0, 5.7, 0]} castShadow={false}>
            <cylinderGeometry args={[0.28, 0.38, 11.4, 6]} />
            <meshBasicMaterial color="#1f2937" />
          </mesh>
          <mesh position={[0, 11.25, 1.4]} rotation={[Math.PI / 2, 0, 0]} castShadow={false}>
            <cylinderGeometry args={[0.18, 0.22, 3.1, 6]} />
            <meshBasicMaterial color="#1f2937" />
          </mesh>
          <mesh position={[0, 10.9, 2.95]} castShadow={false}>
            <boxGeometry args={[2.35, 1.22, 2.0]} />
            <meshBasicMaterial color="#fde68a" transparent opacity={0.96} />
          </mesh>
          <mesh position={[0, 10.9, 2.95]} castShadow={false}>
            <sphereGeometry args={[2.2, 10, 6]} />
            <meshBasicMaterial color="#fde68a" transparent opacity={0.18} depthWrite={false} />
          </mesh>
        </group>
      ))}
      {trashCans.map((can) => (
        <group key={can.key} position={[can.x, baseHeight + 0.56, can.z]}>
          <mesh position={[0, 1.05, 0]} castShadow={false}>
            <cylinderGeometry args={[1.05, 0.92, 2.1, 8]} />
            <meshBasicMaterial color="#374151" />
          </mesh>
          <mesh position={[0, 2.22, 0]} castShadow={false}>
            <cylinderGeometry args={[1.16, 1.16, 0.24, 8]} />
            <meshBasicMaterial color="#111827" />
          </mesh>
          <mesh position={[0, 1.25, 1.0]} castShadow={false}>
            <boxGeometry args={[1.25, 0.16, 0.12]} />
            <meshBasicMaterial color="#9ca3af" />
          </mesh>
        </group>
      ))}
      {benches.map((bench) => (
        <group key={bench.key} position={[bench.x, baseHeight + 0.58, bench.z]} rotation={[0, bench.rotation, 0]}>
          <mesh position={[0, 1.04, 0]} castShadow={false}>
            <boxGeometry args={[5.6, 0.36, 1.35]} />
            <meshBasicMaterial color="#7c4a2d" />
          </mesh>
          <mesh position={[0, 1.72, -0.64]} castShadow={false}>
            <boxGeometry args={[5.7, 1.1, 0.32]} />
            <meshBasicMaterial color="#5c331f" />
          </mesh>
          {CHICAGO_BENCH_LEG_X.map((x) => (
            <mesh key={`bench-leg-${x}`} position={[x, 0.52, 0]} castShadow={false}>
              <boxGeometry args={[0.32, 1.0, 0.32]} />
              <meshBasicMaterial color="#1f2937" />
            </mesh>
          ))}
        </group>
      ))}
      {streetTrees.map((tree) => (
        <group key={tree.key} position={[tree.x, baseHeight + 0.52, tree.z]} scale={[tree.scale, tree.scale, tree.scale]}>
          <mesh position={[0, 2.65, 0]} castShadow={false}>
            <cylinderGeometry args={[0.55, 0.78, 5.3, 7]} />
            <meshBasicMaterial color="#6b3f22" />
          </mesh>
          <FoliageDodeca position={[0, 6.2, 0]} radius={2.85} color="#15803d" />
          <FoliageDodeca position={[1.1, 5.55, -0.8]} radius={2.05} color="#166534" />
        </group>
      ))}
      <ChicagoTrafficLights baseHeight={baseHeight} />
    </group>
  );
}

function ChicagoBeanPark({ baseHeight }: { baseHeight: number }) {
  return (
    <group name="chicago-bean-park" position={[CHICAGO_BEAN_PARK_X, baseHeight, CHICAGO_BEAN_PARK_Z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.505, 0]} renderOrder={12}>
        <circleGeometry args={[15.5, 42]} />
        <meshBasicMaterial color="#94a3b8" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      {CHICAGO_SIDE_SIGNS.map((side) => (
        <mesh
          key={`bean-lobe-${side}`}
          position={[side * 5.8, 8.55, side * 0.25]}
          rotation={[0, 0.32 + side * 0.05, -0.08 - side * 0.035]}
          scale={[14.6, 8.8, 14.2]}
          castShadow={false}
        >
          <sphereGeometry args={[1, 48, 24]} />
          <meshBasicMaterial color="#dce8f3" />
        </mesh>
      ))}
      {CHICAGO_SIDE_SIGNS.map((side) => (
        <mesh
          key={`bean-inner-shadow-${side}`}
          position={[side * 2.15, 8.35, side * 0.05]}
          rotation={[0, 0.32 + side * 0.035, -0.08 - side * 0.025]}
          scale={[2.85, 6.35, 12.35]}
          castShadow={false}
        >
          <sphereGeometry args={[1, 32, 16]} />
          <meshBasicMaterial color="#8ea0b4" transparent opacity={0.28} depthWrite={false} />
        </mesh>
      ))}
      {CHICAGO_SIDE_SIGNS.map((side) => (
        <mesh
          key={`bean-lower-shadow-${side}`}
          position={[side * 5.65, 5.72, side * 0.22]}
          rotation={[0, 0.32 + side * 0.05, -0.08 - side * 0.035]}
          scale={[12.2, 2.85, 12.4]}
          castShadow={false}
        >
          <sphereGeometry args={[1, 32, 12]} />
          <meshBasicMaterial color="#74879d" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      ))}
      {CHICAGO_SIDE_SIGNS.map((side) => (
        <mesh
          key={`bean-cleft-rim-highlight-${side}`}
          position={[side * 1.08, 8.85, side * 0.06]}
          rotation={[0, 0.32 + side * 0.018, -0.08 - side * 0.018]}
          scale={[0.42, 6.7, 11.6]}
          castShadow={false}
        >
          <sphereGeometry args={[1, 24, 12]} />
          <meshBasicMaterial color="#f8fbff" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      ))}
      <mesh position={[0, 8.25, 0]} rotation={[0, 0.32, -0.08]} scale={[0.74, 7.35, 13.2]} castShadow={false}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshBasicMaterial color="#334155" transparent opacity={0.62} depthWrite={false} />
      </mesh>
      <mesh position={[0, 8.25, -0.35]} rotation={[0, 0.32, -0.08]} scale={[0.34, 7.8, 10.8]} castShadow={false}>
        <sphereGeometry args={[1, 24, 12]} />
        <meshBasicMaterial color="#111827" transparent opacity={0.42} depthWrite={false} />
      </mesh>
      <mesh position={[0, 4.6, 0]} rotation={[0, 0.32, -0.08]} scale={[0.46, 2.1, 9.8]} castShadow={false}>
        <sphereGeometry args={[1, 24, 10]} />
        <meshBasicMaterial color="#1f2937" transparent opacity={0.46} depthWrite={false} />
      </mesh>
      <mesh position={[-7.6, 12.4, -4.8]} rotation={[0, 0.25, -0.04]} scale={[5.8, 1.65, 3.3]} castShadow={false}>
        <sphereGeometry args={[1, 24, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.38} depthWrite={false} />
      </mesh>
      <mesh position={[7.4, 11.7, 4.4]} rotation={[0, 0.36, -0.11]} scale={[4.6, 1.15, 2.4]} castShadow={false}>
        <sphereGeometry args={[1, 24, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.24} depthWrite={false} />
      </mesh>
      {CHICAGO_SIDE_SIGNS.map((side) => (
        <group key={`bean-park-bollards-${side}`} rotation={[0, side * 0.68, 0]}>
          {CHICAGO_BEAN_BOLLARD_X.map((x) => (
            <mesh key={`bollard-${side}-${x}`} position={[x, 0.98, 31.5]} castShadow={false}>
              <cylinderGeometry args={[0.42, 0.5, 1.9, 8]} />
              <meshBasicMaterial color="#e5e7eb" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function ChicagoTraffic({ cars, baseHeight }: { cars: ChicagoCar[]; baseHeight: number }) {
  const bodyRefs = useLazyRef<Array<THREE.InstancedMesh | null>>(() => []);
  const sideMarkRefs = useLazyRef<Array<THREE.InstancedMesh | null>>(() => []);
  const lightBarRefs = useLazyRef<Array<THREE.InstancedMesh | null>>(() => []);
  const cabinRef = useRef<THREE.InstancedMesh>(null);
  const taxiSignRef = useRef<THREE.InstancedMesh>(null);
  const wheelRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const lastUpdateRef = useRef(-1);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const transformBufferRef = useLazyRef<ChicagoVehicleTransform[]>(() => []);
  const carInstances = useMemo(() => makeChicagoCarInstances(cars), [cars]);
  const bodyGroups = useMemo(() => groupChicagoCarsByColor(cars, (car) => car.color), [cars]);
  const sideMarkGroups = useMemo(() => groupChicagoCarsByColor(cars, getChicagoCarSideMarkColor), [cars]);
  const lightBarGroups = useMemo(
    () => groupChicagoCarsByColor(cars, getChicagoCarLightBarColor, isChicagoLightBarVehicle),
    [cars],
  );
  const taxiCars = useMemo(() => getChicagoTaxiCarInstances(carInstances), [carInstances]);

  const finalizeMesh = (mesh: THREE.InstancedMesh, count: number) => {
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  };

  const writeCarMatrices = (elapsedSeconds: number) => {
    const cabinMesh = cabinRef.current;
    const taxiSignMesh = taxiSignRef.current;
    const wheelMesh = wheelRef.current;
    if (!cabinMesh || !taxiSignMesh || !wheelMesh) return;

    const transforms = transformBufferRef.current;
    for (let index = 0; index < cars.length; index += 1) {
      let transform = transforms[index];
      if (!transform) {
        transform = { x: 0, z: 0, yaw: 0 };
        transforms[index] = transform;
      }
      writeChicagoVehicleTransform(transform, cars[index], elapsedSeconds);
    }
    transforms.length = cars.length;
    const placePart = (
      mesh: THREE.InstancedMesh,
      matrixIndex: number,
      car: ChicagoCar,
      carIndex: number,
      offsetX: number,
      offsetY: number,
      offsetZ: number,
      scaleX: number,
      scaleY: number,
      scaleZ: number,
      rotationX = 0,
    ) => {
      const transform = transforms[carIndex];
      if (!transform) return;
      const baseY = baseHeight + 0.1;
      setChicagoInstancedPart(dummy, mesh, matrixIndex, transform.x, baseY, transform.z, transform.yaw, offsetX, offsetY, offsetZ, scaleX, scaleY, scaleZ, rotationX);
    };

    for (let groupIndex = 0; groupIndex < bodyGroups.length; groupIndex += 1) {
      const group = bodyGroups[groupIndex];
      const mesh = bodyRefs.current[groupIndex];
      if (!mesh) continue;
      for (let matrixIndex = 0; matrixIndex < group.items.length; matrixIndex += 1) {
        const { car, index } = group.items[matrixIndex];
        const lengthScale = getChicagoCarLengthScale(car);
        placePart(mesh, matrixIndex, car, index, 0, 0.85 * car.scale, 0, 5.2 * car.scale, 1.35 * car.scale, 8.7 * car.scale * lengthScale);
      }
      finalizeMesh(mesh, group.items.length);
    }

    for (let carInstanceIndex = 0; carInstanceIndex < carInstances.length; carInstanceIndex += 1) {
      const { car, index } = carInstances[carInstanceIndex];
      placePart(
        cabinMesh,
        index,
        car,
        index,
        0,
        1.72 * car.scale,
        car.vehicleType === "bus" ? 0.2 * car.scale : -0.65 * car.scale,
        car.vehicleType === "bus" ? 4.3 * car.scale : 3.8 * car.scale,
        car.vehicleType === "bus" ? 1.02 * car.scale : 1.04 * car.scale,
        car.vehicleType === "bus" ? 8.4 * car.scale : 3.7 * car.scale,
      );
    }
    finalizeMesh(cabinMesh, cars.length);

    for (let groupIndex = 0; groupIndex < sideMarkGroups.length; groupIndex += 1) {
      const group = sideMarkGroups[groupIndex];
      const mesh = sideMarkRefs.current[groupIndex];
      if (!mesh) continue;
      for (let matrixIndex = 0; matrixIndex < group.items.length; matrixIndex += 1) {
        const { car, index } = group.items[matrixIndex];
        const lengthScale = getChicagoCarLengthScale(car);
        placePart(
          mesh,
          matrixIndex,
          car,
          index,
          0,
          1.34 * car.scale,
          4.42 * car.scale * lengthScale,
          car.vehicleType === "sedan" ? 3.6 * car.scale : 4.2 * car.scale,
          car.vehicleType === "sedan" ? 0.26 * car.scale : 0.34 * car.scale,
          car.vehicleType === "sedan" ? 0.26 * car.scale : 0.38 * car.scale,
        );
      }
      finalizeMesh(mesh, group.items.length);
    }

    for (let matrixIndex = 0; matrixIndex < taxiCars.length; matrixIndex += 1) {
      const { car, index } = taxiCars[matrixIndex];
      placePart(taxiSignMesh, matrixIndex, car, index, 0, 2.58 * car.scale, -0.75 * car.scale, 2.3 * car.scale, 0.6 * car.scale, 1.2 * car.scale);
    }
    finalizeMesh(taxiSignMesh, taxiCars.length);

    for (let groupIndex = 0; groupIndex < lightBarGroups.length; groupIndex += 1) {
      const group = lightBarGroups[groupIndex];
      const mesh = lightBarRefs.current[groupIndex];
      if (!mesh) continue;
      for (let matrixIndex = 0; matrixIndex < group.items.length; matrixIndex += 1) {
        const { car, index } = group.items[matrixIndex];
        placePart(mesh, matrixIndex, car, index, 0, 2.45 * car.scale, -0.92 * car.scale, 2.2 * car.scale, 0.32 * car.scale, 0.65 * car.scale);
      }
      finalizeMesh(mesh, group.items.length);
    }

    for (let carInstanceIndex = 0; carInstanceIndex < carInstances.length; carInstanceIndex += 1) {
      const { car, index } = carInstances[carInstanceIndex];
      const lengthScale = getChicagoCarLengthScale(car);
      let wheelIndex = index * 4;
      for (let xSideIndex = 0; xSideIndex < CHICAGO_CAR_WHEEL_SIDES.length; xSideIndex += 1) {
        const xSide = CHICAGO_CAR_WHEEL_SIDES[xSideIndex];
        for (let zSideIndex = 0; zSideIndex < CHICAGO_CAR_WHEEL_SIDES.length; zSideIndex += 1) {
          const zSide = CHICAGO_CAR_WHEEL_SIDES[zSideIndex];
          placePart(
            wheelMesh,
            wheelIndex,
            car,
            index,
            xSide * 2.65 * car.scale,
            0.42 * car.scale,
            zSide * 3.15 * car.scale * lengthScale,
            0.48 * car.scale,
            0.42 * car.scale,
            0.48 * car.scale,
            Math.PI / 2,
          );
          wheelIndex += 1;
        }
      }
    }
    finalizeMesh(wheelMesh, cars.length * 4);
  };

  useEffect(() => {
    writeCarMatrices(0);
  }, [baseHeight, bodyGroups, carInstances, cars, dummy, lightBarGroups, sideMarkGroups, taxiCars]);

  useFrame((state) => {
    const elapsedSeconds = state.clock.elapsedTime;
    const updateInterval = mobilePerformanceMode
      ? MOBILE_CHICAGO_TRAFFIC_UPDATE_INTERVAL_SECONDS
      : CHICAGO_TRAFFIC_UPDATE_INTERVAL_SECONDS;
    if (elapsedSeconds - lastUpdateRef.current < updateInterval) return;
    lastUpdateRef.current = elapsedSeconds;
    writeCarMatrices(elapsedSeconds);
  });

  return (
    <group name="chicago-traffic">
      {bodyGroups.map((group, groupIndex) => (
        <instancedMesh
          key={`chicago-car-body-${group.color}`}
          ref={(mesh) => {
            bodyRefs.current[groupIndex] = mesh;
          }}
          args={[undefined, undefined, Math.max(1, group.items.length)]}
          castShadow={false}
          receiveShadow={false}
          frustumCulled={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={group.color} />
        </instancedMesh>
      ))}
      <instancedMesh ref={cabinRef} args={[undefined, undefined, cars.length]} castShadow={false} receiveShadow={false} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#dff9ff" transparent opacity={0.92} />
      </instancedMesh>
      {sideMarkGroups.map((group, groupIndex) => (
        <instancedMesh
          key={`chicago-car-side-mark-${group.color}`}
          ref={(mesh) => {
            sideMarkRefs.current[groupIndex] = mesh;
          }}
          args={[undefined, undefined, Math.max(1, group.items.length)]}
          castShadow={false}
          receiveShadow={false}
          frustumCulled={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={group.color} />
        </instancedMesh>
      ))}
      <instancedMesh ref={taxiSignRef} args={[undefined, undefined, Math.max(1, taxiCars.length)]} castShadow={false} receiveShadow={false} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#f8fafc" />
      </instancedMesh>
      {lightBarGroups.map((group, groupIndex) => (
        <instancedMesh
          key={`chicago-car-lightbar-${group.color}`}
          ref={(mesh) => {
            lightBarRefs.current[groupIndex] = mesh;
          }}
          args={[undefined, undefined, Math.max(1, group.items.length)]}
          castShadow={false}
          receiveShadow={false}
          frustumCulled={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={group.color} />
        </instancedMesh>
      ))}
      <instancedMesh ref={wheelRef} args={[undefined, undefined, Math.max(1, cars.length * 4)]} castShadow={false} receiveShadow={false} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 8]} />
        <meshBasicMaterial color="#111827" />
      </instancedMesh>
    </group>
  );
}

function ChicagoPedestrians({ pedestrians, baseHeight }: { pedestrians: ChicagoPedestrian[]; baseHeight: number }) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const legLeftRef = useRef<THREE.InstancedMesh>(null);
  const legRightRef = useRef<THREE.InstancedMesh>(null);
  const armLeftRef = useRef<THREE.InstancedMesh>(null);
  const armRightRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const lastUpdateRef = useRef(-1);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);

  const writePedestrianMatrices = (elapsedSeconds: number) => {
    const bodyMesh = bodyRef.current;
    const headMesh = headRef.current;
    const legLeftMesh = legLeftRef.current;
    const legRightMesh = legRightRef.current;
    const armLeftMesh = armLeftRef.current;
    const armRightMesh = armRightRef.current;
    if (!bodyMesh || !headMesh || !legLeftMesh || !legRightMesh || !armLeftMesh || !armRightMesh) return;

    for (let index = 0; index < pedestrians.length; index += 1) {
      const pedestrian = pedestrians[index];
      const transform = getChicagoPedestrianTransform(pedestrian, elapsedSeconds);
      const groundY = baseHeight + 0.08;
      const step = Math.sin(elapsedSeconds * 9 + index * 0.73) * 0.16 * pedestrian.direction;
      setChicagoInstancedPart(dummy, bodyMesh, index, transform.x, groundY, transform.z, transform.yaw, 0, 1.85, 0, 0.78, 1.55, 0.48);
      setChicagoInstancedPart(dummy, headMesh, index, transform.x, groundY, transform.z, transform.yaw, 0, 3.0, -0.02, 0.94, 0.9, 0.72);
      setChicagoInstancedPart(dummy, legLeftMesh, index, transform.x, groundY, transform.z, transform.yaw, -0.22, 0.74, step, 0.26, 1.05, 0.26);
      setChicagoInstancedPart(dummy, legRightMesh, index, transform.x, groundY, transform.z, transform.yaw, 0.22, 0.74, -step, 0.26, 1.05, 0.26);
      setChicagoInstancedPart(dummy, armLeftMesh, index, transform.x, groundY, transform.z, transform.yaw, -0.58, 1.82, -step, 0.2, 1.05, 0.22);
      setChicagoInstancedPart(dummy, armRightMesh, index, transform.x, groundY, transform.z, transform.yaw, 0.58, 1.82, step, 0.2, 1.05, 0.22);
    }

    bodyMesh.instanceMatrix.needsUpdate = true;
    headMesh.instanceMatrix.needsUpdate = true;
    legLeftMesh.instanceMatrix.needsUpdate = true;
    legRightMesh.instanceMatrix.needsUpdate = true;
    armLeftMesh.instanceMatrix.needsUpdate = true;
    armRightMesh.instanceMatrix.needsUpdate = true;
  };

  useEffect(() => {
    const bodyMesh = bodyRef.current;
    const headMesh = headRef.current;
    const legLeftMesh = legLeftRef.current;
    const legRightMesh = legRightRef.current;
    const armLeftMesh = armLeftRef.current;
    const armRightMesh = armRightRef.current;
    if (!bodyMesh || !headMesh || !legLeftMesh || !legRightMesh || !armLeftMesh || !armRightMesh) return;

    bodyMesh.count = pedestrians.length;
    headMesh.count = pedestrians.length;
    legLeftMesh.count = pedestrians.length;
    legRightMesh.count = pedestrians.length;
    armLeftMesh.count = pedestrians.length;
    armRightMesh.count = pedestrians.length;
    writePedestrianMatrices(0);
  }, [baseHeight, dummy, pedestrians]);

  useFrame((state) => {
    const elapsedSeconds = state.clock.elapsedTime;
    const updateInterval = mobilePerformanceMode
      ? MOBILE_CHICAGO_PEDESTRIAN_UPDATE_INTERVAL_SECONDS
      : CHICAGO_PEDESTRIAN_UPDATE_INTERVAL_SECONDS;
    if (elapsedSeconds - lastUpdateRef.current < updateInterval) return;
    lastUpdateRef.current = elapsedSeconds;
    writePedestrianMatrices(elapsedSeconds);
  });

  return (
    <group name="chicago-pedestrians">
      <instancedMesh ref={bodyRef} args={[undefined, undefined, pedestrians.length]} castShadow={false} receiveShadow={false} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#2563eb" />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, pedestrians.length]} castShadow={false} receiveShadow={false} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#e0ac69" />
      </instancedMesh>
      <instancedMesh ref={legLeftRef} args={[undefined, undefined, pedestrians.length]} castShadow={false} receiveShadow={false} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#334155" />
      </instancedMesh>
      <instancedMesh ref={legRightRef} args={[undefined, undefined, pedestrians.length]} castShadow={false} receiveShadow={false} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#334155" />
      </instancedMesh>
      <instancedMesh ref={armLeftRef} args={[undefined, undefined, pedestrians.length]} castShadow={false} receiveShadow={false} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#e0ac69" />
      </instancedMesh>
      <instancedMesh ref={armRightRef} args={[undefined, undefined, pedestrians.length]} castShadow={false} receiveShadow={false} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#e0ac69" />
      </instancedMesh>
    </group>
  );
}

export function SurvivalChicagoCity({
  chunk,
  villageBaseHeightForChunk,
  makeVillagePadGeometry,
  makeVillagePadSkirtGeometry,
}: {
  chunk: SurvivalChunkInfo;
  villageBaseHeightForChunk: SurvivalVillageBaseHeightForChunk;
  makeVillagePadGeometry: SurvivalVillageGeometryFactory;
  makeVillagePadSkirtGeometry: SurvivalVillageGeometryFactory;
}) {
  const cityBaseHeight = useMemo(() => villageBaseHeightForChunk(chunk), [chunk]);
  const cityPadGeometry = useMemo(() => makeVillagePadGeometry(chunk), [chunk]);
  const hasCityPadSkirt = shouldRenderSurvivalChunkSkirt(chunk);
  const cityPadSkirtGeometry = useMemo(
    () => hasCityPadSkirt ? makeVillagePadSkirtGeometry(chunk) : null,
    [chunk, hasCityPadSkirt]
  );
  const cityPadCollisionGeometry = useMemo(() => makeVillagePadGeometry(chunk), [chunk]);
  const layout = useMemo(() => makeChicagoLayout(chunk), [chunk]);
  const signTexture = useMemo(() => getChicagoSignTexture(), []);
  const showNearDetails = chunk.distance === 0;
  useSurvivalFeatureCount("chicagoBuildings", chunk.key, layout.buildings.length);
  useSurvivalFeatureCount("chicagoCars", chunk.key, showNearDetails ? layout.cars.length : 0);
  useSurvivalFeatureCount("chicagoPedestrians", chunk.key, showNearDetails ? layout.pedestrians.length : 0);

  return (
    <>
      <ChicagoCityColliders
        chunk={chunk}
        baseHeight={cityBaseHeight}
        buildings={layout.buildings}
        groundGeometry={cityPadCollisionGeometry}
      />
      <group name={`survival-chicago-city-${chunk.key}`} position={[chunk.x, 0, chunk.z]}>
        {cityPadSkirtGeometry && (
          <mesh geometry={cityPadSkirtGeometry} dispose={null}>
            <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
          </mesh>
        )}
        <ChicagoCitySurface geometry={cityPadGeometry} baseHeight={cityBaseHeight} />
        <ChicagoBuildings buildings={layout.buildings} baseHeight={cityBaseHeight} showDetails={showNearDetails} />
        <ChicagoBuildingDetails buildings={layout.buildings} baseHeight={cityBaseHeight} showDetails={showNearDetails} />
        <ChicagoBuildingInteriors buildings={layout.buildings} baseHeight={cityBaseHeight} showDetails={showNearDetails} />
        {showNearDetails && <ChicagoStreetDetails baseHeight={cityBaseHeight} />}
        {showNearDetails && <ChicagoBeanPark baseHeight={cityBaseHeight} />}
        <group position={[-206, cityBaseHeight + 15, 214]}>
          <mesh position={[0, -6, 0]} castShadow={false}>
            <boxGeometry args={[4, 12, 3]} />
            <meshBasicMaterial color="#111827" />
          </mesh>
          <sprite scale={[72, 20, 1]} frustumCulled={false}>
            <spriteMaterial map={signTexture} transparent alphaTest={0.05} depthWrite={false} />
          </sprite>
        </group>
        {showNearDetails && (
          <>
            <ChicagoTraffic cars={layout.cars} baseHeight={cityBaseHeight} />
            <ChicagoPedestrians pedestrians={layout.pedestrians} baseHeight={cityBaseHeight} />
          </>
        )}
      </group>
    </>
  );
}
