import type { SurvivalBotwGrassBladeInstance } from "./survivalBotwGrassConfig";
import {
  SURVIVAL_BOTW_GRASS_UPLOAD_MID_PRIORITY_RADIUS,
  SURVIVAL_BOTW_GRASS_UPLOAD_NEAR_PRIORITY_RADIUS,
} from "./survivalBotwGrassConfig";

export type SurvivalBotwGrassUploadPriority = {
  viewerX: number;
  viewerZ: number;
  leadX: number;
  leadZ: number;
};

export function getSurvivalBotwGrassUploadPrioritizedInstances(
  instances: SurvivalBotwGrassBladeInstance[],
  priority: SurvivalBotwGrassUploadPriority,
) {
  if (instances.length < 2) return instances;

  const nearRadiusSq = SURVIVAL_BOTW_GRASS_UPLOAD_NEAR_PRIORITY_RADIUS * SURVIVAL_BOTW_GRASS_UPLOAD_NEAR_PRIORITY_RADIUS;
  const midRadiusSq = SURVIVAL_BOTW_GRASS_UPLOAD_MID_PRIORITY_RADIUS * SURVIVAL_BOTW_GRASS_UPLOAD_MID_PRIORITY_RADIUS;
  const viewerNear: SurvivalBotwGrassBladeInstance[] = [];
  const leadNear: SurvivalBotwGrassBladeInstance[] = [];
  const viewerMid: SurvivalBotwGrassBladeInstance[] = [];
  const leadMid: SurvivalBotwGrassBladeInstance[] = [];
  const far: SurvivalBotwGrassBladeInstance[] = [];

  const getUploadScore = (instance: SurvivalBotwGrassBladeInstance) => {
    const viewerDx = instance.x - priority.viewerX;
    const viewerDz = instance.z - priority.viewerZ;
    const leadDx = instance.x - priority.leadX;
    const leadDz = instance.z - priority.leadZ;
    const viewerDistanceSq = viewerDx * viewerDx + viewerDz * viewerDz;
    const leadDistanceSq = leadDx * leadDx + leadDz * leadDz;
    return Math.min(viewerDistanceSq, leadDistanceSq * 0.86);
  };

  const bucketByUploadScore = (bucket: SurvivalBotwGrassBladeInstance[], maxScore: number) => {
    if (bucket.length < 2) return bucket;
    const bucketCount = 8;
    const buckets: SurvivalBotwGrassBladeInstance[][] = [];
    for (let index = 0; index < bucketCount; index += 1) {
      buckets.push([]);
    }
    const safeMaxScore = Math.max(1, maxScore);
    for (const instance of bucket) {
      const bucketIndex = Math.max(
        0,
        Math.min(
          bucketCount - 1,
          Math.floor((getUploadScore(instance) / safeMaxScore) * bucketCount),
        ),
      );
      buckets[bucketIndex].push(instance);
    }

    const ordered: SurvivalBotwGrassBladeInstance[] = [];
    for (const scoreBucket of buckets) {
      for (const instance of scoreBucket) {
        ordered.push(instance);
      }
    }
    return ordered;
  };

  for (const instance of instances) {
    const viewerDx = instance.x - priority.viewerX;
    const viewerDz = instance.z - priority.viewerZ;
    const leadDx = instance.x - priority.leadX;
    const leadDz = instance.z - priority.leadZ;
    const viewerDistanceSq = viewerDx * viewerDx + viewerDz * viewerDz;
    const leadDistanceSq = leadDx * leadDx + leadDz * leadDz;
    if (viewerDistanceSq <= nearRadiusSq) {
      viewerNear.push(instance);
    } else if (leadDistanceSq <= nearRadiusSq) {
      leadNear.push(instance);
    } else if (viewerDistanceSq <= midRadiusSq) {
      viewerMid.push(instance);
    } else if (leadDistanceSq <= midRadiusSq) {
      leadMid.push(instance);
    } else {
      far.push(instance);
    }
  }

  return bucketByUploadScore(viewerNear, nearRadiusSq)
    .concat(
      bucketByUploadScore(leadNear, nearRadiusSq),
      bucketByUploadScore(viewerMid, midRadiusSq),
      bucketByUploadScore(leadMid, midRadiusSq),
      far,
    );
}
