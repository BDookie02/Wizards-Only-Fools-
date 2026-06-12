import { useRef, type Ref } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import type { MountainVillageWaterfall } from "./mountainVillageLayoutRuntime";
import { getMountainWaterfallVisualDescriptors, shouldHideMountainWaterfallForCamera } from "./mountainVillageWaterfallRuntime";

const MOUNTAIN_WATERFALL_VISIBILITY_CHECK_INTERVAL_SECONDS = 1 / 12;

export function MountainWaterfallView({
  chunk,
  waterfall,
  summitY,
  showDetails,
}: {
  chunk: SurvivalChunkInfo;
  waterfall: MountainVillageWaterfall;
  summitY: number;
  showDetails: boolean;
}) {
  if (!showDetails) return null;

  return (
    <VisibleMountainWaterfall
      chunk={chunk}
      waterfall={waterfall}
      summitY={summitY}
    />
  );
}

function VisibleMountainWaterfall({
  chunk,
  waterfall,
  summitY,
}: {
  chunk: SurvivalChunkInfo;
  waterfall: MountainVillageWaterfall;
  summitY: number;
}) {
  const waterfallRef = useRef<THREE.Group>(null);
  const visibleRef = useRef(true);
  const lastVisibilityCheckAtRef = useRef(Number.NEGATIVE_INFINITY);

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime;
    if (elapsed - lastVisibilityCheckAtRef.current < MOUNTAIN_WATERFALL_VISIBILITY_CHECK_INTERVAL_SECONDS) return;
    lastVisibilityCheckAtRef.current = elapsed;

    const group = waterfallRef.current;
    if (!group) return;
    const nextVisible = !shouldHideMountainWaterfallForCamera(chunk, waterfall);
    if (visibleRef.current === nextVisible && group.visible === nextVisible) return;
    visibleRef.current = nextVisible;
    group.visible = nextVisible;
  });

  return <MountainWaterfallVisualView waterfall={waterfall} summitY={summitY} waterfallRef={waterfallRef} />;
}

export function MountainWaterfallVisualView({
  waterfall,
  summitY,
  waterfallRef,
}: {
  waterfall: MountainVillageWaterfall;
  summitY: number;
  waterfallRef?: Ref<THREE.Group>;
}) {
  const waterfallVisuals = getMountainWaterfallVisualDescriptors({ waterfall, summitY });

  return (
    <group ref={waterfallRef} name="mountain-village-waterfall">
      <mesh position={waterfallVisuals.mainFall.position} rotation={waterfallVisuals.mainFall.rotation}>
        <planeGeometry args={[waterfallVisuals.mainFall.width, waterfallVisuals.mainFall.height]} />
        <meshBasicMaterial color="#89e9ff" transparent opacity={0.48} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={waterfallVisuals.brightFall.position} rotation={waterfallVisuals.brightFall.rotation}>
        <planeGeometry args={[waterfallVisuals.brightFall.width, waterfallVisuals.brightFall.height]} />
        <meshBasicMaterial color="#effdff" transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {waterfallVisuals.darkEdges.map((edge) => (
        <mesh
          key={`mountain-fall-dark-edge-${edge.side}`}
          position={edge.position}
          rotation={edge.rotation}
        >
          <planeGeometry args={[edge.width, edge.height]} />
          <meshBasicMaterial color="#16596d" transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      <mesh rotation={waterfallVisuals.topFoam.rotation} position={waterfallVisuals.topFoam.position} scale={waterfallVisuals.topFoam.scale}>
        <circleGeometry args={[1, 18]} />
        <meshBasicMaterial color="#b9f1ff" transparent opacity={0.48} depthWrite={false} />
      </mesh>
      <mesh rotation={waterfallVisuals.bottomFoam.rotation} position={waterfallVisuals.bottomFoam.position} scale={waterfallVisuals.bottomFoam.scale}>
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial color="#5bbbd4" transparent opacity={0.56} depthWrite={false} />
      </mesh>
      {waterfallVisuals.sprayPuffs.map((spray) => (
        <mesh key={`mountain-fall-spray-${spray.index}`} position={spray.position} scale={spray.scale} castShadow={false}>
          <sphereGeometry args={[1, 6, 4]} />
          <meshBasicMaterial color="#dffaff" transparent opacity={0.26} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
