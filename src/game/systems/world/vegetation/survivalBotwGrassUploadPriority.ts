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

const SURVIVAL_BOTW_GRASS_UPLOAD_SCORE_BUCKET_COUNT = 8;
const survivalBotwGrassUploadScoreBuckets: SurvivalBotwGrassBladeInstance[][] = [];
for (let index = 0; index < SURVIVAL_BOTW_GRASS_UPLOAD_SCORE_BUCKET_COUNT; index += 1) {
  survivalBotwGrassUploadScoreBuckets.push([]);
}

function getSurvivalBotwGrassUploadScore(
  instance: SurvivalBotwGrassBladeInstance,
  priority: SurvivalBotwGrassUploadPriority,
) {
  const viewerDx = instance.x - priority.viewerX;
  const viewerDz = instance.z - priority.viewerZ;
  const leadDx = instance.x - priority.leadX;
  const leadDz = instance.z - priority.leadZ;
  const viewerDistanceSq = viewerDx * viewerDx + viewerDz * viewerDz;
  const leadDistanceSq = leadDx * leadDx + leadDz * leadDz;
  return Math.min(viewerDistanceSq, leadDistanceSq * 0.86);
}

function clearSurvivalBotwGrassUploadScoreBuckets() {
  for (let index = 0; index < survivalBotwGrassUploadScoreBuckets.length; index += 1) {
    survivalBotwGrassUploadScoreBuckets[index].length = 0;
  }
}

function appendSurvivalBotwGrassUploadBucketByScore(
  bucket: SurvivalBotwGrassBladeInstance[],
  maxScore: number,
  priority: SurvivalBotwGrassUploadPriority,
  ordered: SurvivalBotwGrassBladeInstance[],
) {
  if (bucket.length < 2) {
    for (const instance of bucket) ordered.push(instance);
    return;
  }

  clearSurvivalBotwGrassUploadScoreBuckets();
  const safeMaxScore = Math.max(1, maxScore);
  for (const instance of bucket) {
    const bucketIndex = Math.max(
      0,
      Math.min(
        SURVIVAL_BOTW_GRASS_UPLOAD_SCORE_BUCKET_COUNT - 1,
        Math.floor(
          (getSurvivalBotwGrassUploadScore(instance, priority) / safeMaxScore) *
          SURVIVAL_BOTW_GRASS_UPLOAD_SCORE_BUCKET_COUNT,
        ),
      ),
    );
    survivalBotwGrassUploadScoreBuckets[bucketIndex].push(instance);
  }

  for (const scoreBucket of survivalBotwGrassUploadScoreBuckets) {
    for (const instance of scoreBucket) {
      ordered.push(instance);
    }
  }
  clearSurvivalBotwGrassUploadScoreBuckets();
}

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

  const ordered: SurvivalBotwGrassBladeInstance[] = [];
  appendSurvivalBotwGrassUploadBucketByScore(viewerNear, nearRadiusSq, priority, ordered);
  appendSurvivalBotwGrassUploadBucketByScore(leadNear, nearRadiusSq, priority, ordered);
  appendSurvivalBotwGrassUploadBucketByScore(viewerMid, midRadiusSq, priority, ordered);
  appendSurvivalBotwGrassUploadBucketByScore(leadMid, midRadiusSq, priority, ordered);
  for (const instance of far) ordered.push(instance);
  return ordered;
}
