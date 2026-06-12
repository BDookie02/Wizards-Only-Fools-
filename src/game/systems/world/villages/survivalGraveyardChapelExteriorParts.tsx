import { Fragment } from "react";
import * as THREE from "three";
import { getCachedIndexRange } from "../../rendering/indexRange";
import {
  CHAPEL_NAVE_CEILING_BEAM_ROWS,
  CHAPEL_SIDE_SIGNS,
  CHAPEL_WING_CEILING_BEAMS,
} from "./survivalGraveyardChapelLayout";
import {
  CHAPEL_CENTER_HALF_DEPTH,
  CHAPEL_CENTER_HALF_WIDTH,
  CHAPEL_DOOR_PANEL_PLANK_OFFSETS,
  CHAPEL_DOOR_STRAP_HEIGHT_OFFSETS,
  CHAPEL_GARGOYLE_POSITIONS,
  CHAPEL_OUTER_HALF_WIDTH,
  CHAPEL_SIDE_WING_CENTER_X,
  CHAPEL_SIDE_WING_HALF_DEPTH,
  CHAPEL_SIDE_WING_HALF_WIDTH,
  CHAPEL_WALL_HEIGHT,
  CHAPEL_WATCH_TOWER_HEIGHT,
  CHAPEL_WATCH_TOWER_POSITIONS,
  CHAPEL_WATCH_TOWER_RADIUS,
} from "./survivalGraveyardChapelStructure";

export function getChapelExteriorPartsSummary() {
  return {
    towerCount: CHAPEL_WATCH_TOWER_POSITIONS.length,
    towerCrenelCount: 8,
    towerArrowSlitPairCount: CHAPEL_SIDE_SIGNS.length,
    gargoyleCount: CHAPEL_GARGOYLE_POSITIONS.length,
    doorPanelCount: CHAPEL_SIDE_SIGNS.length,
    doorPlankCount: CHAPEL_DOOR_PANEL_PLANK_OFFSETS.length,
    doorStrapCount: CHAPEL_DOOR_STRAP_HEIGHT_OFFSETS.length,
    naveCeilingBeamCount: CHAPEL_NAVE_CEILING_BEAM_ROWS.length,
    wingCeilingBeamCount: CHAPEL_WING_CEILING_BEAMS.length,
  };
}

export function ChapelWatchTower({
  position,
  stoneMap,
  darkStoneMap,
}: {
  position: [number, number, number];
  stoneMap: THREE.Texture;
  darkStoneMap: THREE.Texture;
}) {
  return (
    <group name="chapel-corner-watch-tower" position={position}>
      <mesh castShadow={false} receiveShadow>
        <cylinderGeometry args={[CHAPEL_WATCH_TOWER_RADIUS, CHAPEL_WATCH_TOWER_RADIUS + 1.4, CHAPEL_WATCH_TOWER_HEIGHT, 8]} />
        <meshBasicMaterial map={stoneMap} />
      </mesh>
      <mesh position={[0, CHAPEL_WATCH_TOWER_HEIGHT * 0.5 + 1.65, 0]} castShadow={false} receiveShadow>
        <cylinderGeometry args={[CHAPEL_WATCH_TOWER_RADIUS + 2.2, CHAPEL_WATCH_TOWER_RADIUS + 2.2, 3.3, 8]} />
        <meshBasicMaterial map={darkStoneMap} />
      </mesh>
      {getCachedIndexRange(8).map((index) => {
        const angle = (index / 8) * Math.PI * 2;
        return (
          <mesh
            key={`chapel-watch-tower-crenel-${index}`}
            position={[
              Math.sin(angle) * (CHAPEL_WATCH_TOWER_RADIUS + 1.9),
              CHAPEL_WATCH_TOWER_HEIGHT * 0.5 + 5.4,
              Math.cos(angle) * (CHAPEL_WATCH_TOWER_RADIUS + 1.9),
            ]}
            rotation={[0, angle, 0]}
            castShadow={false}
            receiveShadow
          >
            <boxGeometry args={[3.1, 4.7, 2.4]} />
            <meshBasicMaterial map={darkStoneMap} />
          </mesh>
        );
      })}
      <mesh position={[0, CHAPEL_WATCH_TOWER_HEIGHT * 0.5 + 12, 0]} rotation={[0, Math.PI / 4, 0]} castShadow={false}>
        <coneGeometry args={[CHAPEL_WATCH_TOWER_RADIUS + 1.2, 12.8, 4]} />
        <meshBasicMaterial color="#0d0a0f" />
      </mesh>
      {CHAPEL_SIDE_SIGNS.map((side) => (
        <Fragment key={`chapel-watch-tower-arrow-slit-${side}`}>
          <mesh position={[side * 5.2, 4.8, CHAPEL_WATCH_TOWER_RADIUS + 0.08]} castShadow={false}>
            <boxGeometry args={[1.2, 9.8, 0.22]} />
            <meshBasicMaterial color="#09070a" />
          </mesh>
          <mesh position={[CHAPEL_WATCH_TOWER_RADIUS + 0.08, 4.8, side * 5.2]} castShadow={false}>
            <boxGeometry args={[0.22, 9.8, 1.2]} />
            <meshBasicMaterial color="#09070a" />
          </mesh>
        </Fragment>
      ))}
    </group>
  );
}

export function ChapelGargoyle({
  position,
  yaw,
  scale = 1,
}: {
  position: [number, number, number];
  yaw: number;
  scale?: number;
}) {
  return (
    <group name="chapel-roof-gargoyle" position={position} rotation={[0, yaw, 0]} scale={[scale, scale, scale]}>
      <mesh position={[0, 0.7, 0]} rotation={[-0.18, 0, 0]} castShadow={false}>
        <boxGeometry args={[2.3, 1.65, 3]} />
        <meshBasicMaterial color="#313039" />
      </mesh>
      <mesh position={[0, 1.72, 1.26]} castShadow={false}>
        <boxGeometry args={[1.55, 1.25, 1.45]} />
        <meshBasicMaterial color="#3c3a43" />
      </mesh>
      <mesh position={[0, 1.58, 2.1]} castShadow={false}>
        <boxGeometry args={[0.9, 0.55, 1]} />
        <meshBasicMaterial color="#232129" />
      </mesh>
      {CHAPEL_SIDE_SIGNS.map((side) => (
        <Fragment key={`chapel-gargoyle-side-${side}`}>
          <mesh position={[side * 1.38, 1.05, -0.24]} rotation={[0.18, 0, side * 0.72]} castShadow={false}>
            <boxGeometry args={[0.42, 2.5, 2.6]} />
            <meshBasicMaterial color="#27262e" />
          </mesh>
          <mesh position={[side * 0.54, 2.42, 1.45]} rotation={[0, 0, side * 0.58]} castShadow={false}>
            <coneGeometry args={[0.34, 1.15, 4]} />
            <meshBasicMaterial color="#191820" />
          </mesh>
          <mesh position={[side * 0.66, -0.16, 0.96]} rotation={[0.28, 0, side * 0.2]} castShadow={false}>
            <boxGeometry args={[0.52, 1.2, 0.5]} />
            <meshBasicMaterial color="#1f1e25" />
          </mesh>
        </Fragment>
      ))}
      <mesh position={[0, 0.38, -1.96]} rotation={[-0.55, 0, 0]} castShadow={false}>
        <coneGeometry args={[0.42, 2.4, 5]} />
        <meshBasicMaterial color="#24232b" />
      </mesh>
      <mesh position={[0, 2.04, 2.85]} rotation={[Math.PI / 2, 0, 0]} castShadow={false}>
        <coneGeometry args={[0.28, 1.5, 6]} />
        <meshBasicMaterial color="#18171d" />
      </mesh>
    </group>
  );
}

function ChapelDoorKnocker({ x = 0 }: { x?: number }) {
  return (
    <group position={[x, 1.4, 0.68]}>
      <mesh position={[0, 1.34, 0]} scale={[1.05, 0.82, 0.2]} castShadow={false}>
        <sphereGeometry args={[0.78, 12, 8]} />
        <meshBasicMaterial color="#a66f2f" />
      </mesh>
      <mesh position={[0, 1.36, 0.16]} scale={[0.58, 0.36, 0.16]} castShadow={false}>
        <sphereGeometry args={[0.7, 10, 6]} />
        <meshBasicMaterial color="#d19a45" />
      </mesh>
      <mesh position={[0, 0.9, 0.22]} scale={[0.5, 0.22, 0.12]} castShadow={false}>
        <sphereGeometry args={[0.62, 10, 6]} />
        <meshBasicMaterial color="#6b421e" />
      </mesh>
      {CHAPEL_SIDE_SIGNS.map((side) => (
        <Fragment key={`chapel-lion-knocker-ear-${side}`}>
          <mesh position={[side * 0.52, 1.88, 0.08]} rotation={[0, 0, side * 0.46]} castShadow={false}>
            <coneGeometry args={[0.24, 0.7, 4]} />
            <meshBasicMaterial color="#7e5228" />
          </mesh>
          <mesh position={[side * 0.22, 1.48, 0.34]} castShadow={false}>
            <boxGeometry args={[0.12, 0.12, 0.08]} />
            <meshBasicMaterial color="#1b1008" />
          </mesh>
        </Fragment>
      ))}
      <mesh position={[0, -0.36, 0.14]} rotation={[0, 0, Math.PI]} castShadow={false}>
        <torusGeometry args={[1.02, 0.12, 8, 18, Math.PI]} />
        <meshBasicMaterial color="#c68a35" />
      </mesh>
      <mesh position={[0, 0.2, 0.17]} castShadow={false}>
        <boxGeometry args={[0.42, 0.34, 0.16]} />
        <meshBasicMaterial color="#7a4b21" />
      </mesh>
    </group>
  );
}

export function ChapelDoubleDoor({
  position,
  yaw,
  width,
  height = 22,
}: {
  position: [number, number, number];
  yaw: number;
  width: number;
  height?: number;
}) {
  const panelWidth = width * 0.48;
  const panelHeight = height;
  const hingeInset = panelWidth * 0.5;

  return (
    <group name="chapel-open-double-door" position={position} rotation={[0, yaw, 0]}>
      {CHAPEL_SIDE_SIGNS.map((side) => (
        <group
          key={`chapel-door-panel-${side}`}
          position={[side * (width * 0.5 - 0.7), 1.2 + panelHeight * 0.5, 0.65]}
          rotation={[0, side * -0.44, 0]}
        >
          <mesh position={[side * -hingeInset * 0.45, 0, 0]} castShadow={false} receiveShadow>
            <boxGeometry args={[panelWidth, panelHeight, 1.05]} />
            <meshBasicMaterial color="#5b351f" />
          </mesh>
          {CHAPEL_DOOR_PANEL_PLANK_OFFSETS.map((offset) => (
            <mesh key={`chapel-door-plank-${offset}`} position={[side * (-hingeInset * 0.45 + offset * panelWidth), 0, 0.58]} castShadow={false}>
              <boxGeometry args={[0.28, panelHeight - 1.8, 0.18]} />
              <meshBasicMaterial color="#7a4928" transparent opacity={0.76} />
            </mesh>
          ))}
          {CHAPEL_DOOR_STRAP_HEIGHT_OFFSETS.map((yOffset) => (
            <mesh key={`chapel-door-strap-${yOffset}`} position={[side * -hingeInset * 0.45, yOffset * panelHeight, 0.7]} castShadow={false}>
              <boxGeometry args={[panelWidth - 1.5, 0.52, 0.24]} />
              <meshBasicMaterial color="#1c1410" />
            </mesh>
          ))}
          <mesh position={[side * -hingeInset * 0.9, 0, 0.78]} castShadow={false}>
            <boxGeometry args={[0.5, panelHeight + 1.2, 0.34]} />
            <meshBasicMaterial color="#24150d" />
          </mesh>
          <ChapelDoorKnocker x={side * -hingeInset * 0.42} />
        </group>
      ))}
    </group>
  );
}

export function ChapelCeiling({ darkStoneMap }: { darkStoneMap: THREE.Texture }) {
  return (
    <group name="chapel-roof-and-ceiling-fill">
      <mesh position={[0, CHAPEL_WALL_HEIGHT + 0.6, 0]} castShadow={false} receiveShadow>
        <boxGeometry args={[CHAPEL_CENTER_HALF_WIDTH * 2 - 5, 2.4, CHAPEL_CENTER_HALF_DEPTH * 2 - 6]} />
        <meshBasicMaterial map={darkStoneMap} side={THREE.DoubleSide} />
      </mesh>
      {CHAPEL_SIDE_SIGNS.map((side) => (
        <mesh key={`chapel-wing-ceiling-${side}`} position={[side * CHAPEL_SIDE_WING_CENTER_X, CHAPEL_WALL_HEIGHT + 0.3, 0]} castShadow={false} receiveShadow>
          <boxGeometry args={[CHAPEL_SIDE_WING_HALF_WIDTH * 2 - 4, 2.1, CHAPEL_SIDE_WING_HALF_DEPTH * 2 - 5]} />
          <meshBasicMaterial map={darkStoneMap} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {CHAPEL_NAVE_CEILING_BEAM_ROWS.map((z, index) => (
        <mesh key={`chapel-nave-ceiling-beam-${z}`} position={[0, CHAPEL_WALL_HEIGHT - 1.15, z]} castShadow={false}>
          <boxGeometry args={[CHAPEL_CENTER_HALF_WIDTH * 2 - 8, 2.1, 1.8]} />
          <meshBasicMaterial color={index % 2 === 0 ? "#171017" : "#241821"} />
        </mesh>
      ))}
      {CHAPEL_WING_CEILING_BEAMS.map((beam) => (
        <mesh key={beam.key} position={[beam.side * CHAPEL_SIDE_WING_CENTER_X, CHAPEL_WALL_HEIGHT - 1.35, beam.z]} castShadow={false}>
          <boxGeometry args={[CHAPEL_SIDE_WING_HALF_WIDTH * 2 - 8, 1.7, 1.55]} />
          <meshBasicMaterial color={beam.color} />
        </mesh>
      ))}
      <mesh position={[0, CHAPEL_WALL_HEIGHT - 0.2, 0]} castShadow={false}>
        <boxGeometry args={[3.4, 3, CHAPEL_CENTER_HALF_DEPTH * 2 - 10]} />
        <meshBasicMaterial color="#100b10" />
      </mesh>
      <mesh position={[0, CHAPEL_WALL_HEIGHT - 0.35, 0]} castShadow={false}>
        <boxGeometry args={[CHAPEL_OUTER_HALF_WIDTH * 2 - 18, 2.6, 3.2]} />
        <meshBasicMaterial color="#100b10" />
      </mesh>
    </group>
  );
}
