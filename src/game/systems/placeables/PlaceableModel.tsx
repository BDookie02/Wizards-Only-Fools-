import type { PlaceableDefinition } from "./placeableCatalog";
import { getPlaceableBuildingMetrics } from "./placeableMetrics";

export type PlaceableColliderDescriptor =
  | { kind: "box"; args: [number, number, number]; position: [number, number, number] }
  | { kind: "cylinder"; args: [number, number]; position: [number, number, number] };

export function getPlaceableModelColors(placeable: PlaceableDefinition): [string, string, string] {
  if (placeable.preview.kind === "swatch") {
    const [base, accent, highlight = "#f8fafc"] = placeable.preview.colors;
    return [base, accent, highlight];
  }

  if (placeable.id === "magic-portal-marker") return ["#172033", "#38bdf8", "#c084fc"];
  if (placeable.id === "spellbook-pedestal") return ["#2e1a47", "#facc15", "#93c5fd"];
  return ["#38bdf8", "#c084fc", "#f8fafc"];
}

export function getPlaceableCollider(placeable: PlaceableDefinition): PlaceableColliderDescriptor {
  if (placeable.id === "campfire-small") {
    return { kind: "cylinder", args: [0.45, 1.8], position: [0, 0.35, 0] };
  }

  if (placeable.id === "training-spell-dummy") {
    return { kind: "box", args: [1.08, 1.72, 1.08], position: [0, 0, 0] };
  }

  if (placeable.category === "nature") {
    return { kind: "cylinder", args: [0.8, placeable.footprintRadius * 0.75], position: [0, 0.8, 0] };
  }

  if (placeable.category === "magic") {
    return { kind: "cylinder", args: [1.2, placeable.footprintRadius * 0.62], position: [0, 0.65, 0] };
  }

  const { bodyWidth, bodyDepth, bodyHeight } = getPlaceableBuildingMetrics(placeable);
  return { kind: "box", args: [bodyWidth / 2, bodyHeight / 2, bodyDepth / 2], position: [0, bodyHeight / 2, 0] };
}

export function getPlaceablePreviewCamera(placeable: PlaceableDefinition) {
  if (placeable.id === "campfire-small") return { targetY: 0.75, zoom: 23 };
  if (placeable.id === "training-spell-dummy") return { targetY: 0.1, zoom: 19 };
  if (placeable.category === "nature") return { targetY: 1.2, zoom: 16 };
  if (placeable.category === "magic") return { targetY: 1.35, zoom: 15 };
  if (placeable.category === "village") return { targetY: 4.6, zoom: 5.2 };
  return { targetY: 4.2, zoom: 5.8 };
}

function getPreviewMaterialProps(opacity: number) {
  return opacity < 1 ? { transparent: true, opacity, depthWrite: false } : {};
}

function scaleMaterialOpacity(baseOpacity: number, opacity: number) {
  return Math.max(0, Math.min(1, baseOpacity * opacity));
}

function SpellDummyModel({ markerColor = "#f97316", opacity = 1 }: { markerColor?: string; opacity?: number }) {
  const materialProps = getPreviewMaterialProps(opacity);
  return (
    <group>
      <mesh position={[0, -1.58, 0]}>
        <cylinderGeometry args={[1.28, 1.42, 0.36, 8]} />
        <meshBasicMaterial color="#334155" {...materialProps} />
      </mesh>
      <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[1.72, 2.72, 1.08]} />
        <meshBasicMaterial color={markerColor} {...materialProps} />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[1.22, 0.86, 0.86]} />
        <meshBasicMaterial color="#fde68a" {...materialProps} />
      </mesh>
      <mesh position={[0, -0.25, -0.43]}>
        <planeGeometry args={[1.32, 1.86]} />
        <meshBasicMaterial color="#111827" transparent opacity={scaleMaterialOpacity(0.86, opacity)} depthWrite={opacity >= 1} />
      </mesh>
      <mesh position={[0, 1.78, 0]}>
        <boxGeometry args={[2.45, 0.18, 0.18]} />
        <meshBasicMaterial color={markerColor} {...materialProps} />
      </mesh>
      <mesh position={[0, 1.78, 0]}>
        <boxGeometry args={[0.18, 0.18, 2.45]} />
        <meshBasicMaterial color={markerColor} {...materialProps} />
      </mesh>
    </group>
  );
}

export function PlaceableModel({ placeable, name, opacity = 1 }: { placeable: PlaceableDefinition; name?: string; opacity?: number }) {
  const [baseColor, accentColor, highlightColor] = getPlaceableModelColors(placeable);
  const materialProps = getPreviewMaterialProps(opacity);

  if (placeable.id === "training-spell-dummy") {
    return (
      <group name={name}>
        <SpellDummyModel markerColor={accentColor} opacity={opacity} />
      </group>
    );
  }

  if (placeable.id === "campfire-small") {
    return (
      <group name={name}>
        <mesh position={[0, 0.18, 0]} rotation={[Math.PI / 2, 0, Math.PI / 4]}>
          <cylinderGeometry args={[0.22, 0.26, 4.2, 8]} />
          <meshStandardMaterial color={baseColor} roughness={0.9} {...materialProps} />
        </mesh>
        <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, -Math.PI / 4]}>
          <cylinderGeometry args={[0.2, 0.24, 4.0, 8]} />
          <meshStandardMaterial color="#3a2515" roughness={0.9} {...materialProps} />
        </mesh>
        <mesh position={[0, 1.12, 0]}>
          <coneGeometry args={[0.82, 1.8, 6]} />
          <meshBasicMaterial color={accentColor} transparent opacity={scaleMaterialOpacity(0.82, opacity)} toneMapped={false} depthWrite={opacity >= 1} />
        </mesh>
        <pointLight color={highlightColor} intensity={1.4 * opacity} distance={16} position={[0, 1.5, 0]} />
      </group>
    );
  }

  if (placeable.category === "nature") {
    return (
      <group name={name}>
        <mesh position={[0, 1.05, 0]}>
          <sphereGeometry args={[placeable.footprintRadius * 0.72, 12, 8]} />
          <meshStandardMaterial color={accentColor} roughness={0.95} {...materialProps} />
        </mesh>
        <mesh position={[0.9, 1.25, -0.35]}>
          <sphereGeometry args={[placeable.footprintRadius * 0.42, 10, 6]} />
          <meshStandardMaterial color={highlightColor} roughness={0.95} {...materialProps} />
        </mesh>
      </group>
    );
  }

  if (placeable.category === "magic") {
    return (
      <group name={name}>
        <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[placeable.footprintRadius * 0.68, placeable.footprintRadius * 0.78, 0.35, 18]} />
          <meshStandardMaterial color={baseColor} roughness={0.72} emissive={accentColor} emissiveIntensity={0.16 * opacity} {...materialProps} />
        </mesh>
        <mesh position={[0, 2.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[placeable.footprintRadius * 0.48, 0.12, 8, 24]} />
          <meshBasicMaterial color={accentColor} transparent opacity={scaleMaterialOpacity(0.86, opacity)} toneMapped={false} depthWrite={opacity >= 1} />
        </mesh>
        <mesh position={[0, 2.4, 0]}>
          <sphereGeometry args={[0.38, 12, 8]} />
          <meshBasicMaterial color={highlightColor} transparent opacity={scaleMaterialOpacity(0.72, opacity)} toneMapped={false} depthWrite={opacity >= 1} />
        </mesh>
        <pointLight color={accentColor} intensity={0.75 * opacity} distance={18} position={[0, 2.4, 0]} />
      </group>
    );
  }

  const { bodyWidth, bodyDepth, bodyHeight, roofHeight } = getPlaceableBuildingMetrics(placeable);
  const isMushroom = placeable.id.includes("mushroom");

  return (
    <group name={name}>
      <mesh position={[0, bodyHeight / 2, 0]}>
        <boxGeometry args={[bodyWidth, bodyHeight, bodyDepth]} />
        <meshStandardMaterial color={baseColor} roughness={0.9} {...materialProps} />
      </mesh>
      <mesh position={[0, bodyHeight + roofHeight * 0.46, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[Math.max(bodyWidth, bodyDepth) * 0.76, roofHeight, isMushroom ? 20 : 4]} />
        <meshStandardMaterial color={accentColor} roughness={0.85} {...materialProps} />
      </mesh>
      <mesh position={[0, 1.8, bodyDepth / 2 + 0.04]}>
        <boxGeometry args={[1.8, 3.2, 0.18]} />
        <meshStandardMaterial color="#1d120b" roughness={0.95} {...materialProps} />
      </mesh>
    </group>
  );
}
