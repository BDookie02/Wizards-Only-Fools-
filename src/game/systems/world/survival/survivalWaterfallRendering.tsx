import { useMemo } from "react";
import * as THREE from "three";
import { useSurvivalFeatureCount } from "../../../tools/qa/survivalFeatureCounters";
import {
  makeSurvivalWaterfalls,
  type SurvivalWaterfallFeature,
  type SurvivalWaterfallResolvers,
} from "./survivalWaterfalls";
import type { SurvivalChunkInfo } from "./survivalWorldConfig";

export function SurvivalWaterfalls({
  chunk,
  resolvers,
}: {
  chunk: SurvivalChunkInfo;
  resolvers: SurvivalWaterfallResolvers;
}) {
  const waterfalls = useMemo<SurvivalWaterfallFeature[]>(
    () => makeSurvivalWaterfalls(chunk, resolvers),
    [chunk, resolvers],
  );

  useSurvivalFeatureCount("waterfalls", chunk.key, waterfalls.length);

  if (waterfalls.length === 0) return null;

  return (
    <>
      {waterfalls.map((fall) => (
        <group key={fall.key} name={`survival-waterfall-${fall.key}`}>
          <mesh position={[fall.x, fall.y, fall.z]} rotation={[0, fall.yaw, 0]} renderOrder={-1}>
            <planeGeometry args={[fall.width, fall.height]} />
            <meshBasicMaterial color="#8de8ff" transparent opacity={0.42} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh position={[fall.x, fall.y + fall.height * 0.08, fall.z]} rotation={[0, fall.yaw, 0]} renderOrder={0}>
            <planeGeometry args={[fall.width * 0.34, fall.height * 0.96]} />
            <meshBasicMaterial color="#e8fdff" transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[fall.poolX, fall.poolY, fall.poolZ]} scale={[fall.poolScale * 1.35, fall.poolScale, 1]} renderOrder={-2}>
            <circleGeometry args={[1, 18]} />
            <meshBasicMaterial color="#5fc0d5" transparent opacity={0.62} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}
