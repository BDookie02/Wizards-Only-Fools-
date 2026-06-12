import {
  SURVIVAL_BOTW_GRASS_FAST_LEAD_SPEED,
  SURVIVAL_BOTW_GRASS_FAST_MIN_LEAD_DISTANCE,
  SURVIVAL_BOTW_GRASS_LEAD_SECONDS,
  SURVIVAL_BOTW_GRASS_LEAD_SMOOTHING,
  SURVIVAL_BOTW_GRASS_MAX_LEAD_DISTANCE,
  SURVIVAL_BOTW_GRASS_MIN_LEAD_DISTANCE,
} from "./survivalBotwGrassConfig";

export type SurvivalBotwGrassViewerPosition = { x: number; y: number; z: number };

export type SurvivalBotwGrassLastViewerState = {
  x: number;
  z: number;
  time: number;
  ready: boolean;
};

export type SurvivalBotwGrassLeadVelocity = { x: number; z: number };

export function resolveSurvivalBotwGrassLeadFrame({
  viewerPosition,
  lastViewer,
  leadVelocity,
  elapsedTime,
  leadSmoothing = SURVIVAL_BOTW_GRASS_LEAD_SMOOTHING,
  leadSeconds = SURVIVAL_BOTW_GRASS_LEAD_SECONDS,
  fastLeadSpeed = SURVIVAL_BOTW_GRASS_FAST_LEAD_SPEED,
  fastMinLeadDistance = SURVIVAL_BOTW_GRASS_FAST_MIN_LEAD_DISTANCE,
  minLeadDistance = SURVIVAL_BOTW_GRASS_MIN_LEAD_DISTANCE,
  maxLeadDistance = SURVIVAL_BOTW_GRASS_MAX_LEAD_DISTANCE,
}: {
  viewerPosition: SurvivalBotwGrassViewerPosition;
  lastViewer: SurvivalBotwGrassLastViewerState;
  leadVelocity: SurvivalBotwGrassLeadVelocity;
  elapsedTime: number;
  leadSmoothing?: number;
  leadSeconds?: number;
  fastLeadSpeed?: number;
  fastMinLeadDistance?: number;
  minLeadDistance?: number;
  maxLeadDistance?: number;
}) {
  let predictedX = viewerPosition.x;
  let predictedZ = viewerPosition.z;
  let leadDistance = 0;
  let leadSpeed = 0;
  let leadDirectionX = 0;
  let leadDirectionZ = 0;

  if (lastViewer.ready) {
    const deltaTime = Math.max(0.016, elapsedTime - lastViewer.time);
    const deltaX = viewerPosition.x - lastViewer.x;
    const deltaZ = viewerPosition.z - lastViewer.z;
    const travelDistanceSq = deltaX * deltaX + deltaZ * deltaZ;
    const hasTravelDistance = travelDistanceSq > 0.001 * 0.001;
    const instantVelocityX = hasTravelDistance ? deltaX / deltaTime : 0;
    const instantVelocityZ = hasTravelDistance ? deltaZ / deltaTime : 0;
    const velocityAlpha = 1 - Math.exp(-deltaTime * leadSmoothing);
    leadVelocity.x += (instantVelocityX - leadVelocity.x) * velocityAlpha;
    leadVelocity.z += (instantVelocityZ - leadVelocity.z) * velocityAlpha;
    const leadSpeedSq = leadVelocity.x * leadVelocity.x + leadVelocity.z * leadVelocity.z;
    if (leadSpeedSq > 0.49) {
      leadSpeed = Math.sqrt(leadSpeedSq);
      leadDirectionX = leadVelocity.x / leadSpeed;
      leadDirectionZ = leadVelocity.z / leadSpeed;
      const leadFloor = leadSpeed >= fastLeadSpeed ? fastMinLeadDistance : minLeadDistance;
      leadDistance = Math.max(leadFloor, Math.min(maxLeadDistance, leadSpeed * leadSeconds));
      predictedX += leadDirectionX * leadDistance;
      predictedZ += leadDirectionZ * leadDistance;
    }
  }

  lastViewer.x = viewerPosition.x;
  lastViewer.z = viewerPosition.z;
  lastViewer.time = elapsedTime;
  lastViewer.ready = true;

  return {
    predictedX,
    predictedZ,
    leadDistance,
    leadSpeed,
    leadDirectionX,
    leadDirectionZ,
  };
}
