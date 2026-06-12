import { getLilyCoilTubePlayerRadius } from "../world/villages/lilyCoilTubeMotion";
import { PLAYER_FOOT_OFFSET } from "./playerMovementConfig";

export const LILY_COIL_TUBE_PLAYER_RADIUS = getLilyCoilTubePlayerRadius(PLAYER_FOOT_OFFSET);
export const QA_LILY_COIL_TUBE_FORWARD = 0.78;
export const QA_LILY_COIL_TUBE_STRAFE = 0.24;
export const QA_LILY_COIL_TUBE_LOOK_AHEAD_T = 0.048;
export const QA_LILY_COIL_TUBE_REVERSE_EDGE_T = 0.94;
export const QA_LILY_COIL_TUBE_RESTART_EDGE_T = 0.045;
