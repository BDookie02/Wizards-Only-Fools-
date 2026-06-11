import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useSurvivalFeatureCount } from "../../../tools/qa/survivalFeatureCounters";
import { getSurvivalWaterLevelAtWorld } from "../survival/survivalBiome";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import {
  makeSurvivalRockOutcrops,
  type SurvivalRockOutcrop,
  type SurvivalRockOutcropResolvers,
} from "./survivalRockOutcrops";

export type SurvivalRockOutcropsProps = {
  chunk: SurvivalChunkInfo;
  getSurfaceQuality: SurvivalRockOutcropResolvers["getSurfaceQuality"];
};

const ROCK_BOULDER_GEOMETRY = new THREE.DodecahedronGeometry(1, 0);
const ROCK_SPIRE_GEOMETRY = new THREE.ConeGeometry(1, 2.1, 5);
const ROCK_VERTEX_COLOR_MATERIAL = new THREE.MeshBasicMaterial({ vertexColors: true });

function getRockTypeCounts(rocks: SurvivalRockOutcrop[]) {
  let boulders = 0;
  let spires = 0;
  for (const rock of rocks) {
    if (rock.spire) {
      spires += 1;
    } else {
      boulders += 1;
    }
  }
  return { boulders, spires };
}

export function SurvivalRockOutcrops({
  chunk,
  getSurfaceQuality,
}: SurvivalRockOutcropsProps) {
  const boulderRef = useRef<THREE.InstancedMesh>(null);
  const spireRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const rockResolvers = useMemo(() => ({
    getSurfaceQuality,
    getWaterLevelAtWorld: getSurvivalWaterLevelAtWorld,
  }), [getSurfaceQuality]);
  const rocks = useMemo<SurvivalRockOutcrop[]>(
    () => makeSurvivalRockOutcrops(chunk, rockResolvers),
    [chunk, rockResolvers],
  );
  const rockTypeCounts = useMemo(() => getRockTypeCounts(rocks), [rocks]);

  useSurvivalFeatureCount("rockOutcrops", chunk.key, rocks.length);

  useEffect(() => {
    const boulderMesh = boulderRef.current;
    const spireMesh = spireRef.current;
    let boulderInstance = 0;
    let spireInstance = 0;

    for (const rock of rocks) {
      const mesh = rock.spire ? spireMesh : boulderMesh;
      if (!mesh) continue;
      const instance = rock.spire ? spireInstance : boulderInstance;

      dummy.position.set(chunk.x + rock.localX, rock.y + rock.scale * 0.42, chunk.z + rock.localZ);
      dummy.rotation.set(0, rock.yaw, 0);
      dummy.scale.set(rock.scale * 1.35, rock.scale * (rock.spire ? 1.95 : 0.75), rock.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(instance, dummy.matrix);
      mesh.setColorAt(instance, colorScratch.set(rock.color));

      if (rock.spire) {
        spireInstance += 1;
      } else {
        boulderInstance += 1;
      }
    }

    const finishMesh = (mesh: THREE.InstancedMesh | null, count: number) => {
      if (!mesh) return;
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.frustumCulled = false;
    };

    finishMesh(boulderMesh, boulderInstance);
    finishMesh(spireMesh, spireInstance);
  }, [chunk.x, chunk.z, colorScratch, dummy, rocks]);

  if (rocks.length === 0) return null;

  return (
    <group name={`survival-rock-outcrops-${chunk.key}`}>
      {rockTypeCounts.boulders > 0 && (
        <instancedMesh ref={boulderRef} args={[undefined, undefined, rockTypeCounts.boulders]} castShadow={false} frustumCulled={false}>
          <primitive attach="geometry" object={ROCK_BOULDER_GEOMETRY} />
          <primitive attach="material" object={ROCK_VERTEX_COLOR_MATERIAL} />
        </instancedMesh>
      )}
      {rockTypeCounts.spires > 0 && (
        <instancedMesh ref={spireRef} args={[undefined, undefined, rockTypeCounts.spires]} castShadow={false} frustumCulled={false}>
          <primitive attach="geometry" object={ROCK_SPIRE_GEOMETRY} />
          <primitive attach="material" object={ROCK_VERTEX_COLOR_MATERIAL} />
        </instancedMesh>
      )}
    </group>
  );
}
