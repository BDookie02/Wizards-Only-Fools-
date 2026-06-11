import {
  DEFAULT_MOBILE_LOOK_SENSITIVITY,
  DEFAULT_MOUSE_SENSITIVITY,
} from "../../../store/gameStore";
import { isMobileLikeDevice } from "./performanceMode";

export const CONTROLLER_INVENTORY_HOLD_MS = 3000;
export const MAGIC_UNARM_HOLD_MS = 650;

export function getPlatformDefaultLookSensitivity() {
  return isMobileLikeDevice() ? DEFAULT_MOBILE_LOOK_SENSITIVITY : DEFAULT_MOUSE_SENSITIVITY;
}
