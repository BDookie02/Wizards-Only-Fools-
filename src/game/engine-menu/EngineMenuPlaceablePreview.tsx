import { memo, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import type { OrthographicCamera } from "three";
import type { PlaceableDefinition } from "../systems/placeables/placeableCatalog";
import { getPlaceablePreviewCamera, PlaceableModel } from "../systems/placeables/PlaceableModel";

function EngineMenuPlaceablePreviewCamera({ placeable }: { placeable: PlaceableDefinition }) {
  const { camera, invalidate } = useThree();

  useEffect(() => {
    const previewCamera = camera as OrthographicCamera;
    const { targetY, zoom } = getPlaceablePreviewCamera(placeable);
    previewCamera.position.set(12, 9.5, 14);
    previewCamera.lookAt(0, targetY, 0);
    previewCamera.zoom = zoom;
    previewCamera.near = 0.1;
    previewCamera.far = 100;
    previewCamera.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate, placeable]);

  return null;
}

function EngineMenuPlaceablePreviewContent({ placeable }: { placeable: PlaceableDefinition }) {
  return (
    <div className="engine-preview-grid h-full w-full overflow-hidden bg-black/35">
      <Canvas
        orthographic
        frameloop="demand"
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power", preserveDrawingBuffer: true }}
        className="pointer-events-none h-full w-full"
      >
        <EngineMenuPlaceablePreviewCamera placeable={placeable} />
        <ambientLight intensity={1.45} />
        <directionalLight position={[8, 12, 7]} intensity={2.2} />
        <directionalLight position={[-6, 5, -4]} intensity={0.65} color="#67e8f9" />
        <group rotation={[0, -0.32, 0]}>
          <PlaceableModel placeable={placeable} />
        </group>
      </Canvas>
    </div>
  );
}

export const EngineMenuPlaceablePreview = memo(EngineMenuPlaceablePreviewContent);
