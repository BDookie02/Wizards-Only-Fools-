import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import type { EnginePlacedObjectRecord } from "./enginePlacedObjectStorage";
import { getPlaceableDefinition } from "./placeableCatalog";
import { getPlaceableCollider, PlaceableModel } from "./PlaceableModel";

export type EnginePlacementPreview = {
  ok: boolean;
  placeableId: string;
  label: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  gridSize: number;
  snapped: boolean;
  reason?: string;
};

export function EnginePlacedObjectVisual({ object }: { object: EnginePlacedObjectRecord }) {
  const placeable = getPlaceableDefinition(object.placeableId);
  if (!placeable) return null;

  const position: [number, number, number] = [object.x, object.y, object.z];
  const rotation: [number, number, number] = [0, object.yaw, 0];
  const collider = getPlaceableCollider(placeable);

  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation={rotation}>
      {collider.kind === "cylinder"
        ? <CylinderCollider args={collider.args} position={collider.position} />
        : <CuboidCollider args={collider.args} position={collider.position} />
      }
      <PlaceableModel placeable={placeable} name={object.instanceId} />
    </RigidBody>
  );
}

export function EnginePlacementPreviewVisual({ preview }: { preview: EnginePlacementPreview }) {
  const placeable = getPlaceableDefinition(preview.placeableId);
  if (!placeable) return null;

  const color = preview.ok ? "#22c55e" : "#ef4444";
  const gridSize = Math.max(0.5, preview.gridSize || 1);
  const gridSpan = Math.max(gridSize * 4, placeable.footprintRadius * 2.4);
  const gridDivisions = Math.max(2, Math.min(16, Math.round(gridSpan / gridSize)));

  return (
    <group
      name={preview.ok ? "engine-placement-preview-valid" : "engine-placement-preview-invalid"}
      position={[preview.x, preview.y + 0.05, preview.z]}
      rotation={[0, preview.yaw, 0]}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[placeable.footprintRadius, 48]} />
        <meshBasicMaterial color={color} transparent opacity={preview.ok ? 0.18 : 0.24} depthWrite={false} toneMapped={false} />
      </mesh>
      <gridHelper args={[gridSpan, gridDivisions, color, color]} position={[0, 0.04, 0]} />
      <PlaceableModel placeable={placeable} name="engine-placement-preview-model" opacity={preview.ok ? 0.42 : 0.22} />
    </group>
  );
}
