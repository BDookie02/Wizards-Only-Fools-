export function getHudMenuNowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export {
  clampMenuIndex,
  findDirectionalMenuIndex,
} from "../menu/menuNavigation";
export type { MenuDirection } from "../menu/menuNavigation";
